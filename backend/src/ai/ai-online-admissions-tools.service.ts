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
      description: 'Read-only, role- and department-scoped online admission offering readiness. Returns organization public-admission state, enabled or optionally disabled offerings, application windows, document requirements, and submission counts.',
      run: (input, context) => this.getOfferingReadiness(context, parseInput(input)),
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
          department: submission.department.name,
          program: `${submission.program.code} - ${submission.program.name}`,
          academicCycle: submission.academicCycle.code || submission.academicCycle.name,
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
      organizationId: context.orgId,
      ...(input.includeDisabled ? {} : { onlineAdmissionEnabled: true }),
      ...(input.programId ? { programId: input.programId } : {}),
      ...(input.academicCycleId ? { academicCycleId: input.academicCycleId } : {}),
      program: {
        ...(departmentIds ? { departmentId: { in: departmentIds.length ? departmentIds : ['__no_department_scope__'] } } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { department: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
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
        orderBy: [{ academicCycle: { startDate: 'desc' } }, { program: { admissionsSortOrder: 'asc' } }],
        include: {
          program: { select: { id: true, name: true, code: true, status: true, isVisibleForAdmissions: true, department: { select: { id: true, name: true } } } },
          curriculumVersion: { select: { id: true, name: true, code: true, status: true, isDefaultForAdmissions: true } },
          academicCycle: { select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true } },
          onlineAdmissionDocumentRequirements: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
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
          publicAdmissionsHref: organization?.slug ? `/admissions/${organization.slug}` : '/admissions',
        },
        offerings: offerings.map((offering) => ({
          offeringId: offering.id,
          program: `${offering.program.code} - ${offering.program.name}`,
          department: offering.program.department.name,
          offeringStatus: offering.status,
          programStatus: offering.program.status,
          curriculum: `${offering.curriculumVersion.code} - ${offering.curriculumVersion.name}`,
          curriculumStatus: offering.curriculumVersion.status,
          isDefaultAdmissionsCurriculum: offering.curriculumVersion.isDefaultForAdmissions,
          academicCycle: offering.academicCycle.code || offering.academicCycle.name,
          onlineAdmissionEnabled: offering.onlineAdmissionEnabled,
          opensAt: offering.opensAt?.toISOString() ?? null,
          closesAt: offering.closesAt?.toISOString() ?? null,
          applicationWindowOpen: (!offering.opensAt || offering.opensAt.getTime() <= now)
            && (!offering.closesAt || offering.closesAt.getTime() >= now),
          capacity: offering.capacity,
          submissions: offering._count.onlineAdmissionSubmissions,
          documentRequirements: offering.onlineAdmissionDocumentRequirements.map((requirement) => ({
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
}

function parseInput(input: unknown): OnlineAdmissionsToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const rawStatus = stringValue(value.status)?.toUpperCase();
  return {
    search: stringValue(value.search ?? value.query ?? value.q),
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
