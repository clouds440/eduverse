import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  OnlineAdmissionSubmissionStatus,
  Prisma,
  Role,
} from '@/prisma/prisma-client';
import { getDepartmentScope } from '../common/department-scope';
import { OnlineAdmissionsService } from '../online-admissions/online-admissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

const ADMISSIONS_READER_ROLES = new Set<string>([
  Role.ORG_ADMIN,
  Role.SUB_ADMIN,
  Role.ORG_MANAGER,
]);

interface OnlineAdmissionsToolInput {
  search?: string;
  providerSlug?: string;
  programType?: string;
  subject?: string;
  location?: string;
  onlineOnly?: boolean;
  maxFee?: number;
  deadlineBefore?: string;
  status?: OnlineAdmissionSubmissionStatus;
  departmentId?: string;
  programId?: string;
  academicCycleId?: string;
  missingRequiredDocuments?: boolean;
  includeDisabled?: boolean;
  limit?: number;
}

@Injectable()
export class AIOnlineAdmissionsToolsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissions: OnlineAdmissionsService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.toolRegistry.register({
      name: 'getOnlineAdmissionsContext',
      description: 'Read-only, role- and department-scoped online admissions context. Returns status counts and matching applicants with program, cycle, document completion, and review state. Accepts search, status, departmentId, programId, academicCycleId, missingRequiredDocuments, and limit.',
      run: (input, context) => this.getAdmissionsContext(context, parseInput(input)),
    });
    this.toolRegistry.register({
      name: 'getOnlineAdmissionOfferingReadiness',
      description: 'Read-only, role- and department-scoped online admission offering readiness. Returns organization public-admission state, enabled or optionally disabled offerings, application windows, forms, fees, eligibility, document requirements, and submission counts.',
      run: (input, context) => this.getOfferingReadiness(context, parseInput(input)),
    });
    this.toolRegistry.register({
      name: 'getPublicAdmissionsCatalogContext',
      description: 'Read-only public admissions catalog context. Returns provider-neutral open offerings with provider, program, delivery, location, deadline, fee, eligibility, funding, and application href. Accepts search, providerSlug, programType, subject, location, onlineOnly, maxFee, deadlineBefore, and limit.',
      run: (input) => this.getPublicCatalogContext(parseInput(input)),
    });
  }

  private async getAdmissionsContext(
    context: AIToolContext,
    input: OnlineAdmissionsToolInput,
  ): Promise<AIToolResult<unknown>> {
    const denied = permissionCheck(context);
    if (denied) return denied;

    const result = await this.admissions.listAdminSubmissions(
      context.orgId,
      { id: context.userId, role: context.role },
      {
        page: 1,
        limit: clampLimit(input.limit, 10),
        search: input.search,
        status: input.status,
        departmentId: input.departmentId,
        programId: input.programId,
        academicCycleId: input.academicCycleId,
        missingRequiredDocuments: input.missingRequiredDocuments,
        sortBy: 'submittedAt',
        sortOrder: 'desc',
      },
    );

    return {
      ok: true,
      data: {
        scope: context.role === Role.ORG_ADMIN ? 'organization' : 'department-scoped',
        filters: compactFilters(input),
        totalRecords: result.totalRecords,
        statusCounts: result.statusCounts,
        submissions: result.data.map((submission) => ({
          submissionId: submission.id,
          reference: submission.publicReference,
          applicantName: submission.applicantName,
          applicantEmail: submission.applicantEmail,
          status: submission.status,
          department: submission.department?.name || 'Provider admissions',
          program: `${submission.program.code} - ${submission.program.name}`,
          academicCycle: submission.academicCycle?.code || submission.academicCycle?.name || 'Provider intake',
          submittedAt: submission.submittedAt.toISOString(),
          requiredDocuments: submission.requiredDocumentCount,
          uploadedRequiredDocuments: submission.uploadedRequiredDocumentCount,
          missingRequiredDocuments: submission.uploadedRequiredDocumentCount < submission.requiredDocumentCount,
          href: `/online-admissions/${submission.id}`,
        })),
      },
    };
  }

  private async getOfferingReadiness(
    context: AIToolContext,
    input: OnlineAdmissionsToolInput,
  ): Promise<AIToolResult<unknown>> {
    const denied = permissionCheck(context);
    if (denied) return denied;

    const scope = await getDepartmentScope(this.prisma, context.orgId, {
      id: context.userId,
      role: context.role,
    });
    const departmentIds = input.departmentId
      ? [input.departmentId]
      : scope.applies && !scope.all
        ? scope.departmentIds
        : undefined;
    if (input.departmentId && scope.applies && !scope.all && !scope.departmentIds.includes(input.departmentId)) {
      return permissionDenied('The requested department is outside your admissions scope.');
    }

    const search = input.search?.trim();
    const where: Prisma.ProgramOfferingWhereInput = {
      campusBinding: {
        organizationId: context.orgId,
        ...(input.academicCycleId ? { academicCycleId: input.academicCycleId } : {}),
      },
      ...(input.includeDisabled ? {} : { onlineAdmissionEnabled: true }),
      ...(input.programId ? { programId: input.programId } : {}),
      program: {
        campusConfiguration: {
          organizationId: context.orgId,
          ...(departmentIds ? { departmentId: { in: departmentIds.length ? departmentIds : ['__no_department_scope__'] } } : {}),
        },
        ...(search ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { campusConfiguration: { department: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
          ],
        } : {}),
      },
    };
    const [organization, offerings] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: context.orgId },
        select: { onlineAdmissionsEnabled: true, status: true, slug: true },
      }),
      this.prisma.programOffering.findMany({
        where,
        take: clampLimit(input.limit, 10),
        orderBy: [{ campusBinding: { academicCycle: { startDate: 'desc' } } }, { program: { name: 'asc' } }],
        include: {
          program: { select: { id: true, name: true, code: true, status: true, campusConfiguration: { select: { department: { select: { id: true, name: true } } } } } },
          campusBinding: { include: {
            curriculumVersion: { select: { id: true, name: true, code: true, status: true, isDefaultForAdmissions: true } },
            academicCycle: { select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true } },
          } },
          fees: { orderBy: { sortOrder: 'asc' } },
          fundingOptions: { orderBy: { sortOrder: 'asc' } },
          admissionRequirements: { orderBy: { sortOrder: 'asc' } },
          applicationConfig: {
            include: {
              applicationVersion: {
                include: { documentRequirements: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
              },
            },
          },
          _count: { select: { onlineAdmissionSubmissions: true } },
        },
      }),
    ]);

    const now = Date.now();
    return {
      ok: true,
      data: {
        scope: context.role === Role.ORG_ADMIN ? 'organization' : 'department-scoped',
        organization: {
          status: organization?.status ?? null,
          publicAdmissionsEnabled: organization?.onlineAdmissionsEnabled ?? false,
          publicAdmissionsHref: organization?.slug ? `/admissions/providers/${organization.slug}` : '/admissions',
        },
        offerings: offerings.map((offering) => ({
          offeringId: offering.id,
          program: `${offering.program.code} - ${offering.program.name}`,
          department: offering.program.campusConfiguration?.department.name ?? null,
          offeringStatus: offering.status,
          programStatus: offering.program.status,
          curriculum: offering.campusBinding ? `${offering.campusBinding.curriculumVersion.code} - ${offering.campusBinding.curriculumVersion.name}` : null,
          curriculumStatus: offering.campusBinding?.curriculumVersion.status ?? null,
          isDefaultAdmissionsCurriculum: offering.campusBinding?.curriculumVersion.isDefaultForAdmissions ?? false,
          academicCycle: offering.campusBinding ? offering.campusBinding.academicCycle.code || offering.campusBinding.academicCycle.name : null,
          onlineAdmissionEnabled: offering.onlineAdmissionEnabled,
          opensAt: offering.applicationOpensAt?.toISOString() ?? null,
          closesAt: offering.applicationClosesAt?.toISOString() ?? null,
          applicationWindowOpen: (!offering.applicationOpensAt || offering.applicationOpensAt.getTime() <= now)
            && (!offering.applicationClosesAt || offering.applicationClosesAt.getTime() >= now),
          capacity: offering.capacity,
          submissions: offering._count.onlineAdmissionSubmissions,
          publicSummary: offering.publicSummary,
          feeCount: offering.fees?.length ?? 0,
          eligibilityCount: offering.admissionRequirements?.length ?? 0,
          fundingCount: offering.fundingOptions?.length ?? 0,
          applicationForm: offering.applicationConfig ? {
            name: offering.applicationConfig.applicationVersion.id,
            version: offering.applicationConfig.applicationVersion.version,
            status: offering.applicationConfig.applicationVersion.status,
          } : null,
          documentRequirements: (offering.applicationConfig?.applicationVersion.documentRequirements || []).map((requirement) => ({
            label: requirement.label,
            required: requirement.isRequired,
            acceptedMimeTypes: requirement.acceptedMimeTypes,
            maxFileSizeBytes: requirement.maxFileSizeBytes,
          })),
          href: `/programs/${offering.program.id}`,
        })),
      },
    };
  }

  private async getPublicCatalogContext(input: OnlineAdmissionsToolInput): Promise<AIToolResult<unknown>> {
    const offerings = await this.admissions.listPublicOfferings({
      search: input.search,
      providerSlug: input.providerSlug,
      programType: input.programType,
      subject: input.subject,
      location: input.location,
      onlineOnly: input.onlineOnly,
      maxFee: input.maxFee,
      deadlineBefore: input.deadlineBefore,
    });
    return {
      ok: true,
      data: {
        filters: compactFilters(input),
        totalRecords: offerings.length,
        offerings: offerings.slice(0, clampLimit(input.limit, 10)).map((offering) => ({
          offeringId: offering.id,
          provider: offering.provider.displayName,
          providerSlug: offering.provider.slug,
          program: `${offering.program.code} - ${offering.program.name}`,
          programType: offering.program.programType,
          subjectArea: offering.program.subjectArea,
          deliveryMode: offering.deliveryMode,
          attendanceMode: offering.attendanceMode,
          intakeName: offering.intakeName,
          applicationClosesAt: offering.applicationClosesAt,
          location: offering.locations?.[0]?.providerLocation.displayLabel || offering.organization?.location || null,
          fees: (offering.fees || []).map((fee) => ({ label: fee.label, amount: fee.amount, currencyCode: fee.currencyCode, frequency: fee.frequency })),
          eligibility: (offering.admissionRequirements || []).map((requirement) => ({ label: requirement.label, required: requirement.isRequired })),
          funding: (offering.fundingOptions || []).map((option) => ({ title: option.title, amountSummary: option.amountSummary })),
          documentRequirements: (offering.applicationForm?.documentRequirements || []).map((requirement) => ({ label: requirement.label, required: requirement.isRequired })),
          href: `/admissions/apply/${offering.id}`,
        })),
      },
    };
  }
}

function parseInput(input: unknown): OnlineAdmissionsToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const rawStatus = stringValue(value.status)?.toUpperCase();
  return {
    search: stringValue(value.search ?? value.query ?? value.q),
    providerSlug: stringValue(value.providerSlug),
    programType: stringValue(value.programType),
    subject: stringValue(value.subject),
    location: stringValue(value.location),
    onlineOnly: booleanValue(value.onlineOnly),
    maxFee: numberValue(value.maxFee),
    deadlineBefore: stringValue(value.deadlineBefore),
    status: rawStatus && Object.values(OnlineAdmissionSubmissionStatus).includes(rawStatus as OnlineAdmissionSubmissionStatus)
      ? rawStatus as OnlineAdmissionSubmissionStatus
      : undefined,
    departmentId: stringValue(value.departmentId),
    programId: stringValue(value.programId),
    academicCycleId: stringValue(value.academicCycleId),
    missingRequiredDocuments: booleanValue(value.missingRequiredDocuments),
    includeDisabled: booleanValue(value.includeDisabled),
    limit: numberValue(value.limit),
  };
}

function permissionCheck(context: AIToolContext): AIToolResult<never> | null {
  if (!context.orgId) return permissionDenied('Organization context is required.');
  if (!context.role || !ADMISSIONS_READER_ROLES.has(context.role)) {
    return permissionDenied('Online admissions context is available only to authorized organization admissions staff.');
  }
  return null;
}

function compactFilters(input: OnlineAdmissionsToolInput) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return undefined;
}

function clampLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(20, Math.round(parsed)));
}

function permissionDenied(message: string): AIToolResult<never> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}
