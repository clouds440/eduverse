import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import {
  AcademicCycleStatus,
  StudentProgramEnrollmentStatus,
  OnlineAdmissionSubmissionStatus,
  OrgStatus,
  Prisma,
  ProgramOfferingStatus,
  ProgramStatus,
  Role,
} from '@/prisma/prisma-client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatPaginatedResponse,
  getPaginationOptions,
  type PaginationOptions,
} from '../common/utils';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';
import { EmailService } from '../security/email.service';
import { FilesService, type DownloadPayload } from '../files/files.service';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
import { CreateOnlineAdmissionSubmissionDto } from './dto/online-admission.dto';
import { CaptchaService } from '../captcha/captcha.service';

type Actor = DepartmentScopedUser & { id: string; email?: string | null; name?: string | null };
type PublicUploadOwner = { id: string; role: string; organizationId: string | null };

type AdminSubmissionFilters = {
  departmentId?: string;
  programId?: string;
  programOfferingId?: string;
  academicCycleId?: string;
  status?: string;
  submittedFrom?: string;
  submittedTo?: string;
  missingRequiredDocuments?: boolean;
};

const TERMINAL_DUPLICATE_EXEMPT_STATUSES: OnlineAdmissionSubmissionStatus[] = [
  OnlineAdmissionSubmissionStatus.REJECTED,
  OnlineAdmissionSubmissionStatus.WITHDRAWN,
];

const ADMIN_SORT_FIELDS = new Set([
  'applicantName',
  'publicReference',
  'status',
  'submittedAt',
  'updatedAt',
]);

const ADMIN_STATUS_TRANSITIONS: Partial<Record<OnlineAdmissionSubmissionStatus, OnlineAdmissionSubmissionStatus[]>> = {
  [OnlineAdmissionSubmissionStatus.SUBMITTED]: [
    OnlineAdmissionSubmissionStatus.UNDER_REVIEW,
    OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
    OnlineAdmissionSubmissionStatus.ACCEPTED,
    OnlineAdmissionSubmissionStatus.REJECTED,
  ],
  [OnlineAdmissionSubmissionStatus.UNDER_REVIEW]: [
    OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
    OnlineAdmissionSubmissionStatus.ACCEPTED,
    OnlineAdmissionSubmissionStatus.REJECTED,
  ],
  [OnlineAdmissionSubmissionStatus.NEEDS_UPDATE]: [
    OnlineAdmissionSubmissionStatus.UNDER_REVIEW,
    OnlineAdmissionSubmissionStatus.ACCEPTED,
    OnlineAdmissionSubmissionStatus.REJECTED,
  ],
  [OnlineAdmissionSubmissionStatus.ACCEPTED]: [
    OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
    OnlineAdmissionSubmissionStatus.REJECTED,
  ],
};

const ACTIVE_ENTRY_CYCLE_STATUSES: AcademicCycleStatus[] = [
  AcademicCycleStatus.DRAFT,
  AcademicCycleStatus.ACTIVE,
];

const OPEN_STUDENT_PROGRAM_ENROLLMENT_STATUSES: StudentProgramEnrollmentStatus[] = [
  StudentProgramEnrollmentStatus.ADMITTED,
  StudentProgramEnrollmentStatus.ACTIVE,
  StudentProgramEnrollmentStatus.ON_HOLD,
];

const PUBLIC_OFFERING_INCLUDE = {
  organization: { select: { id: true, name: true, slug: true, location: true, logoUrl: true, onlineAdmissionsEnabled: true, onlineAdmissionEmailTemplates: true } },
  program: { include: { department: true } },
  academicCycle: true,
  curriculumVersion: true,
  onlineAdmissionDocumentRequirements: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
} satisfies Prisma.ProgramOfferingInclude;

const ADMIN_SUBMISSION_INCLUDE = {
  organization: { select: { id: true, name: true, slug: true, logoUrl: true, onlineAdmissionEmailTemplates: true } },
  department: true,
  program: { select: { id: true, name: true, code: true, departmentId: true } },
  programOffering: {
    include: {
      academicCycle: true,
      onlineAdmissionDocumentRequirements: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
    },
  },
  academicCycle: true,
  documentUploads: { include: { requirement: true, file: true }, orderBy: { createdAt: 'asc' as const } },
  statusEvents: { include: { actor: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: 'asc' as const } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  admittedStudent: { select: { id: true, registrationNumber: true, rollNumber: true, user: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.OnlineAdmissionSubmissionInclude;

type PublicOfferingRecord = Prisma.ProgramOfferingGetPayload<{
  include: typeof PUBLIC_OFFERING_INCLUDE;
}>;

@Injectable()
export class OnlineAdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly files: FilesService,
    private readonly emailTemplates: EmailTemplateService,
    private readonly captcha: CaptchaService,
  ) {}

  private nowWindowWhere(): Prisma.ProgramOfferingWhereInput {
    const now = new Date();
    return {
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    };
  }

  private publicOfferingWhere(): Prisma.ProgramOfferingWhereInput {
    return {
      status: ProgramOfferingStatus.OPEN,
      onlineAdmissionEnabled: true,
      ...this.nowWindowWhere(),
      organization: {
        status: OrgStatus.APPROVED,
        onlineAdmissionsEnabled: true,
      },
      academicCycle: { status: { in: ACTIVE_ENTRY_CYCLE_STATUSES } },
      program: {
        status: ProgramStatus.ACTIVE,
        isVisibleForAdmissions: true,
        department: { isActive: true },
      },
    };
  }

  private buildReference() {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const randomPart = randomBytes(5).toString('hex').toUpperCase();
    return `OA-${datePart}-${randomPart}`;
  }

  private buildUpdateToken() {
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return { token, hash, expiresAt };
  }

  private hashUpdateToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashSourceIp(ip: string) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) return null;
    return createHmac('sha256', secret).update(ip).digest('hex');
  }

  private appBaseUrl() {
    return (
      this.config.get<string>('FRONTEND_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  private async sendApplicantStatusEmail(input: {
    to: string;
    name: string;
    reference: string;
    organizationName: string;
    programLabel: string;
    status: OnlineAdmissionSubmissionStatus;
    note?: string | null;
    updateToken?: string | null;
    templates?: Prisma.JsonValue | null;
  }) {
    const message = this.emailTemplates.buildOnlineAdmissionStatusEmail({
      ...input,
      appBaseUrl: this.appBaseUrl(),
      updateUrl: input.updateToken
        ? `${this.appBaseUrl()}/admissions/update/${input.updateToken}`
        : null,
      templates: this.parseEmailTemplateOverrides(input.templates),
    });
    await this.email.send({ to: input.to, ...message });
  }

  private parseEmailTemplateOverrides(value?: Prisma.JsonValue | null) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const record = value as Record<string, Prisma.JsonValue>;
    const read = (key: string) => typeof record[key] === 'string' ? record[key] : undefined;
    return {
      submissionSubject: read('submissionSubject'),
      submissionBody: read('submissionBody'),
      statusSubject: read('statusSubject'),
      statusBody: read('statusBody'),
    };
  }

  async listPublicOrganizations(search?: string) {
    const organizations = await this.prisma.organization.findMany({
      where: {
        status: OrgStatus.APPROVED,
        onlineAdmissionsEnabled: true,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { programs: { some: { code: { contains: search, mode: 'insensitive' } } } },
          ],
        } : {}),
        programOfferings: { some: this.publicOfferingWhere() },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        logoUrl: true,
        programs: {
          where: {
            status: ProgramStatus.ACTIVE,
            isVisibleForAdmissions: true,
            department: { isActive: true },
            offerings: { some: this.publicOfferingWhere() },
          },
          orderBy: [{ admissionsSortOrder: 'asc' }, { code: 'asc' }],
          select: { id: true, code: true, name: true, admissionsLabel: true },
        },
      },
    });

    return organizations.map((organization) => ({
      ...organization,
      programTags: organization.programs.map((program) => ({
        id: program.id,
        code: program.code,
        label: program.admissionsLabel || program.name,
      })),
    }));
  }

  async getPublicOrganization(slug: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: slug.toLowerCase(),
        status: OrgStatus.APPROVED,
        onlineAdmissionsEnabled: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        logoUrl: true,
        programOfferings: {
          where: this.publicOfferingWhere(),
          orderBy: [{ program: { admissionsSortOrder: 'asc' } }, { program: { name: 'asc' } }],
          include: PUBLIC_OFFERING_INCLUDE,
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return {
      ...organization,
      programOfferings: organization.programOfferings.map((offering) =>
        this.toPublicOfferingPayload(offering),
      ),
    };
  }

  async getPublicOffering(id: string) {
    return this.toPublicOfferingPayload(await this.findPublicOffering(id));
  }

  private async findPublicOffering(id: string) {
    const offering = await this.prisma.programOffering.findFirst({
      where: { id, ...this.publicOfferingWhere() },
      include: PUBLIC_OFFERING_INCLUDE,
    });
    if (!offering) throw new NotFoundException('Online admission offering not found');
    return offering;
  }

  private toPublicOfferingPayload(offering: PublicOfferingRecord) {
    const organization = {
      id: offering.organization.id,
      name: offering.organization.name,
      slug: offering.organization.slug,
      location: offering.organization.location,
      logoUrl: offering.organization.logoUrl,
      onlineAdmissionsEnabled: offering.organization.onlineAdmissionsEnabled,
    };
    return { ...offering, organization };
  }

  async submitPublicApplication(
    offeringId: string,
    dto: CreateOnlineAdmissionSubmissionDto,
    metadata: { ip?: string | null; userAgent?: string | null } = {},
    files: Express.Multer.File[] = [],
  ) {
    await this.captcha.verifyToken('ONLINE_ADMISSION', dto.captchaToken);
    const offering = await this.findPublicOffering(offeringId);
    const applicantEmail = dto.applicantEmail.trim().toLowerCase();
    const duplicate = await this.prisma.onlineAdmissionSubmission.findFirst({
      where: {
        programOfferingId: offering.id,
        applicantEmail: { equals: applicantEmail, mode: 'insensitive' },
        status: { notIn: TERMINAL_DUPLICATE_EXEMPT_STATUSES },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('An active application already exists for this email and offering');
    }
    const requiredDocuments = offering.onlineAdmissionDocumentRequirements.filter((item) => item.isRequired);
    const filesByRequirement = this.validateSubmissionFiles(offering.onlineAdmissionDocumentRequirements, files);
    const missingRequired = requiredDocuments.filter((item) => !filesByRequirement.has(item.id));
    if (missingRequired.length > 0) throw new BadRequestException(`Missing required documents: ${missingRequired.map((item) => item.label).join(', ')}`);
    const uploadOwner = files.length ? await this.resolvePublicUploadOwner(offering.organizationId) : null;
    const reference = this.buildReference();
    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.onlineAdmissionSubmission.create({
        data: {
          publicReference: reference,
          organizationId: offering.organizationId,
          departmentId: offering.program.departmentId,
          programId: offering.programId,
          programOfferingId: offering.id,
          academicCycleId: offering.academicCycleId,
          applicantEmail,
          applicantName: dto.applicantName.trim(),
          applicantPhone: dto.applicantPhone?.trim() || null,
          formData: dto.formData as Prisma.InputJsonValue,
          sourceIpHash: metadata.ip ? this.hashSourceIp(metadata.ip) : null,
          userAgent: metadata.userAgent || null,
        },
      });
      await tx.onlineAdmissionStatusEvent.create({
        data: {
          submissionId: created.id,
          toStatus: OnlineAdmissionSubmissionStatus.SUBMITTED,
          actorType: 'APPLICANT',
        },
      });
      return created;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An active application already exists for this email and offering');
      }
      throw error;
    });
    if (files.length) {
      try {
        await this.persistSubmissionFiles(submission.id, offering.organizationId, filesByRequirement, uploadOwner!);
      } catch (error) {
        await this.cleanupFailedInitialSubmission(submission.id, uploadOwner!);
        throw error;
      }
    }
    await this.sendApplicantStatusEmail({
      to: submission.applicantEmail,
      name: submission.applicantName,
      reference: submission.publicReference,
      organizationName: offering.organization.name,
      programLabel: offering.program.admissionsLabel || offering.program.name,
      status: OnlineAdmissionSubmissionStatus.SUBMITTED,
      templates: offering.organization.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return { reference: submission.publicReference, status: submission.status };
  }

  private async cleanupFailedInitialSubmission(submissionId: string, uploadOwner: PublicUploadOwner) {
    const uploads = await this.prisma.onlineAdmissionDocumentUpload.findMany({
      where: { submissionId },
      select: { fileId: true },
    }).catch(() => []);
    await this.prisma.onlineAdmissionSubmission.delete({ where: { id: submissionId } }).catch(() => undefined);
    await Promise.all(uploads.map((upload) => this.files.deleteFile(upload.fileId, uploadOwner).catch(() => undefined)));
  }

  private validateSubmissionFiles(
    requirements: Array<{
      id: string;
      label: string;
      isRequired: boolean;
      acceptedMimeTypes: Prisma.JsonValue;
      maxFileSizeBytes: number | null;
    }>,
    files: Express.Multer.File[],
  ) {
    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    const filesByRequirement = new Map<string, Express.Multer.File>();
    for (const file of files) {
      const requirementId = file.fieldname.startsWith('document:')
        ? file.fieldname.slice('document:'.length)
        : file.fieldname;
      const requirement = requirementById.get(requirementId);
      if (!requirement) throw new BadRequestException('One or more uploaded documents do not match this program');
      if (filesByRequirement.has(requirementId)) throw new BadRequestException(`Only one file can be uploaded for ${requirement.label}`);
      const acceptedMimeTypes = Array.isArray(requirement.acceptedMimeTypes)
        ? requirement.acceptedMimeTypes.filter((value): value is string => typeof value === 'string')
        : [];
      if (acceptedMimeTypes.length && !acceptedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(`${requirement.label} must use an accepted file type`);
      }
      if (requirement.maxFileSizeBytes && file.size > requirement.maxFileSizeBytes) {
        throw new BadRequestException(`${requirement.label} exceeds the configured file size limit`);
      }
      filesByRequirement.set(requirementId, file);
    }
    return filesByRequirement;
  }

  private async resolvePublicUploadOwner(organizationId: string): Promise<PublicUploadOwner> {
    const user = await this.prisma.user.findFirst({
      where: { organizationId, role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, organizationId: true },
    });
    if (!user) throw new BadRequestException('This organization cannot receive public document uploads yet');
    return user;
  }

  private async persistSubmissionFiles(
    submissionId: string,
    organizationId: string,
    filesByRequirement: Map<string, Express.Multer.File>,
    uploadOwner: PublicUploadOwner,
  ) {
    for (const [requirementId, file] of filesByRequirement) {
      const stored = await this.files.saveFile({
        orgId: organizationId,
        entityType: 'ONLINE_ADMISSION',
        entityId: submissionId,
      }, file, uploadOwner.id);
      try {
        const requirement = await this.prisma.onlineAdmissionDocumentRequirement.findFirst({
          where: { id: requirementId, organizationId },
          select: { id: true, label: true },
        });
        if (!requirement) throw new BadRequestException('Document requirement was no longer available');
        const existing = await this.prisma.onlineAdmissionDocumentUpload.findUnique({
          where: { submissionId_requirementId: { submissionId, requirementId } },
          select: { id: true, fileId: true },
        });
        if (existing) {
          await this.prisma.onlineAdmissionDocumentUpload.update({
            where: { id: existing.id },
            data: {
              fileId: stored.id,
              labelSnapshot: requirement.label,
            },
          });
          await this.files.deleteFile(existing.fileId, uploadOwner).catch(() => undefined);
        } else {
          await this.prisma.onlineAdmissionDocumentUpload.create({
            data: {
              organizationId,
              submissionId,
              requirementId,
              fileId: stored.id,
              labelSnapshot: requirement.label,
            },
          });
        }
      } catch (error) {
        await this.files.deleteFile(stored.id, uploadOwner).catch(() => undefined);
        throw error;
      }
    }
  }

  async getPublicUpdateSubmission(token: string) {
    const submission = await this.findSubmissionByUpdateToken(token);
    return this.toPublicUpdatePayload(submission);
  }

  async uploadPublicUpdateDocuments(token: string, files: Express.Multer.File[]) {
    if (!files.length) throw new BadRequestException('No documents were uploaded');
    const submission = await this.findSubmissionByUpdateToken(token);
    if (submission.status !== OnlineAdmissionSubmissionStatus.NEEDS_UPDATE) {
      throw new ConflictException('This application is not waiting for document updates');
    }
    const uploadOwner = await this.resolvePublicUploadOwner(submission.organizationId);
    const requirements = submission.programOffering.onlineAdmissionDocumentRequirements;
    const filesByRequirement = this.validateSubmissionFiles(requirements, files);
    await this.persistSubmissionFiles(submission.id, submission.organizationId, filesByRequirement, uploadOwner);
    await this.assertRequiredDocumentsComplete(submission.id, requirements);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.onlineAdmissionSubmission.update({
        where: { id: submission.id },
        data: {
          status: OnlineAdmissionSubmissionStatus.SUBMITTED,
          updateTokenHash: null,
          updateTokenExpiresAt: null,
        },
        include: ADMIN_SUBMISSION_INCLUDE,
      });
      await tx.onlineAdmissionStatusEvent.create({
        data: {
          submissionId: submission.id,
          fromStatus: submission.status,
          toStatus: OnlineAdmissionSubmissionStatus.SUBMITTED,
          actorType: 'APPLICANT',
          note: 'Applicant uploaded requested documents',
        },
      });
      return next;
    });
    return this.toPublicUpdatePayload(updated);
  }

  private async assertRequiredDocumentsComplete(
    submissionId: string,
    requirements: Array<{ id: string; label: string; isRequired: boolean }>,
  ) {
    const required = requirements.filter((requirement) => requirement.isRequired);
    if (required.length === 0) return;
    const uploads = await this.prisma.onlineAdmissionDocumentUpload.findMany({
      where: { submissionId, requirementId: { in: required.map((requirement) => requirement.id) } },
      select: { requirementId: true },
    });
    const uploadedIds = new Set(uploads.map((upload) => upload.requirementId));
    const missing = required.filter((requirement) => !uploadedIds.has(requirement.id));
    if (missing.length) {
      throw new BadRequestException(`Missing required documents: ${missing.map((requirement) => requirement.label).join(', ')}`);
    }
  }

  private async findSubmissionByUpdateToken(token: string) {
    const tokenHash = this.hashUpdateToken(token);
    const submission = await this.prisma.onlineAdmissionSubmission.findFirst({
      where: {
        updateTokenHash: tokenHash,
        updateTokenExpiresAt: { gt: new Date() },
      },
      include: ADMIN_SUBMISSION_INCLUDE,
    });
    if (!submission) throw new NotFoundException('Document update link is invalid or expired');
    return submission;
  }

  private toPublicUpdatePayload(submission: Prisma.OnlineAdmissionSubmissionGetPayload<{ include: typeof ADMIN_SUBMISSION_INCLUDE }>) {
    const organization = {
      id: submission.organization.id,
      name: submission.organization.name,
      slug: submission.organization.slug,
      logoUrl: submission.organization.logoUrl,
    };
    return {
      id: submission.id,
      publicReference: submission.publicReference,
      status: submission.status,
      applicantName: submission.applicantName,
      organization,
      program: submission.program,
      submittedAt: submission.submittedAt,
      documentRequirements: submission.programOffering.onlineAdmissionDocumentRequirements,
      documentUploads: submission.documentUploads.map((upload) => ({
        id: upload.id,
        requirementId: upload.requirementId,
        labelSnapshot: upload.labelSnapshot,
        file: {
          id: upload.file.id,
          filename: upload.file.filename,
          mimeType: upload.file.mimeType,
          size: upload.file.size,
        },
        createdAt: upload.createdAt,
      })),
    };
  }

  async listAdminSubmissions(
    orgId: string,
    actor: Actor,
    options: PaginationOptions & AdminSubmissionFilters,
  ) {
    const { skip, take, search, sortBy, sortOrder } = getPaginationOptions(options);
    const { where, departmentWhere } = await this.buildAdminSubmissionWhere(orgId, actor, options, search);
    const safeSortBy = sortBy && ADMIN_SORT_FIELDS.has(sortBy) ? sortBy : 'submittedAt';
    const orderBy = { [safeSortBy]: sortOrder || 'desc' } as Prisma.OnlineAdmissionSubmissionOrderByWithRelationInput;
    const [data, totalRecords, statusCounts] = await Promise.all([
      this.prisma.onlineAdmissionSubmission.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          department: true,
          program: { select: { id: true, name: true, code: true, departmentId: true } },
          academicCycle: true,
          programOffering: {
            select: {
              id: true,
              status: true,
              onlineAdmissionEnabled: true,
              onlineAdmissionDocumentRequirements: {
                select: { id: true, isRequired: true },
              },
            },
          },
          documentUploads: { select: { requirementId: true } },
          _count: { select: { documentUploads: true } },
        },
      }),
      this.prisma.onlineAdmissionSubmission.count({ where }),
      this.prisma.onlineAdmissionSubmission.groupBy({
        by: ['status'],
        where: { organizationId: orgId, departmentId: departmentWhere },
        _count: { _all: true },
      }),
    ]);
    const withDocumentCompletion = data.map((submission) => {
      const requiredIds = submission.programOffering.onlineAdmissionDocumentRequirements
        .filter((requirement) => requirement.isRequired)
        .map((requirement) => requirement.id);
      const uploadedIds = new Set(submission.documentUploads.map((upload) => upload.requirementId));
      return {
        ...submission,
        requiredDocumentCount: requiredIds.length,
        uploadedRequiredDocumentCount: requiredIds.filter((id) => uploadedIds.has(id)).length,
      };
    });
    return {
      ...formatPaginatedResponse(withDocumentCompletion, totalRecords, options.page || 1, options.limit || 10),
      statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
    };
  }

  private async buildAdminSubmissionWhere(
    orgId: string,
    actor: Actor,
    options: AdminSubmissionFilters,
    search?: string,
  ) {
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    const requestedDepartmentId = options.departmentId || undefined;
    if (requestedDepartmentId) {
      assertDepartmentInScope(scope, requestedDepartmentId, 'You cannot view admissions outside your department scope');
    }
    const departmentWhere = requestedDepartmentId
      ? requestedDepartmentId
      : !scope.applies || scope.all
        ? undefined
        : { in: scope.departmentIds.length ? scope.departmentIds : ['__no_department_scope__'] };
    const submittedAt = this.buildSubmittedAtFilter(options.submittedFrom, options.submittedTo);
    const missingIds = options.missingRequiredDocuments
      ? await this.findSubmissionIdsMissingRequiredDocuments(orgId)
      : undefined;
    const where: Prisma.OnlineAdmissionSubmissionWhereInput = {
      id: missingIds ? { in: missingIds.length ? missingIds : ['__no_missing_documents__'] } : undefined,
      organizationId: orgId,
      departmentId: departmentWhere,
      programId: options.programId,
      programOfferingId: options.programOfferingId,
      academicCycleId: options.academicCycleId,
      status: options.status && Object.values(OnlineAdmissionSubmissionStatus).includes(options.status as OnlineAdmissionSubmissionStatus)
        ? options.status as OnlineAdmissionSubmissionStatus
        : undefined,
      submittedAt,
      ...(search ? {
        OR: [
          { publicReference: { contains: search, mode: 'insensitive' } },
          { applicantName: { contains: search, mode: 'insensitive' } },
          { applicantEmail: { contains: search, mode: 'insensitive' } },
          { applicantPhone: { contains: search, mode: 'insensitive' } },
          { program: { code: { contains: search, mode: 'insensitive' } } },
          { program: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    return { where, departmentWhere };
  }

  private buildSubmittedAtFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const start = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
    const end = to ? new Date(`${to}T23:59:59.999Z`) : undefined;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new BadRequestException('Admission date filters must use YYYY-MM-DD');
    }
    if (start && end && start > end) {
      throw new BadRequestException('Submitted from date cannot be after submitted to date');
    }
    return { gte: start, lte: end };
  }

  private async findSubmissionIdsMissingRequiredDocuments(orgId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT submission."id"
      FROM "OnlineAdmissionSubmission" submission
      WHERE submission."organizationId" = ${orgId}
        AND EXISTS (
          SELECT 1
          FROM "OnlineAdmissionDocumentRequirement" requirement
          WHERE requirement."programOfferingId" = submission."programOfferingId"
            AND requirement."isRequired" = true
            AND NOT EXISTS (
              SELECT 1
              FROM "OnlineAdmissionDocumentUpload" upload
              WHERE upload."submissionId" = submission."id"
                AND upload."requirementId" = requirement."id"
            )
        )
    `);
    return rows.map((row) => row.id);
  }

  async exportAdminSubmissions(orgId: string, actor: Actor, options: AdminSubmissionFilters & { search?: string }) {
    const { where } = await this.buildAdminSubmissionWhere(orgId, actor, options, options.search?.trim());
    const submissions = await this.prisma.onlineAdmissionSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 10_000,
      include: {
        department: { select: { name: true } },
        program: { select: { code: true, name: true } },
        academicCycle: { select: { code: true, name: true } },
      },
    });
    const csv = [
      ['Reference', 'Applicant', 'Email', 'Phone', 'Status', 'Program Code', 'Program', 'Department', 'Academic Cycle', 'Submitted At'],
      ...submissions.map((submission) => [
        submission.publicReference,
        submission.applicantName,
        submission.applicantEmail,
        submission.applicantPhone || '',
        submission.status,
        submission.program.code,
        submission.program.name,
        submission.department.name,
        submission.academicCycle.code || submission.academicCycle.name,
        submission.submittedAt.toISOString(),
      ]),
    ].map((row) => row.map((value) => this.escapeCsv(String(value))).join(',')).join('\r\n');
    return `\uFEFF${csv}`;
  }

  private escapeCsv(value: string) {
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }

  async getAdminSubmission(orgId: string, id: string, actor: Actor) {
    const submission = await this.prisma.onlineAdmissionSubmission.findFirst({
      where: { id, organizationId: orgId },
      include: ADMIN_SUBMISSION_INCLUDE,
    });
    if (!submission) throw new NotFoundException('Online admission submission not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, submission.departmentId, 'You cannot view admissions outside your department scope');
    return submission;
  }

  async getAdminDocumentDownload(
    orgId: string,
    submissionId: string,
    fileId: string,
    actor: Actor,
  ): Promise<DownloadPayload> {
    const submission = await this.getAdminSubmission(orgId, submissionId, actor);
    const upload = submission.documentUploads.find((item) => item.fileId === fileId);
    if (!upload) throw new NotFoundException('Admission document not found');
    return this.files.getDownloadPayload(fileId, {
      id: actor.id,
      role: actor.role || '',
      organizationId: orgId,
    });
  }

  async updateStatus(
    orgId: string,
    id: string,
    actor: Actor,
    status: OnlineAdmissionSubmissionStatus,
    note?: string,
  ) {
    const submission = await this.getAdminSubmission(orgId, id, actor);
    const allowedStatuses = ADMIN_STATUS_TRANSITIONS[submission.status] || [];
    if (!allowedStatuses.includes(status)) {
      throw new ConflictException(`Cannot change an application from ${submission.status} to ${status}`);
    }
    const updateToken = status === OnlineAdmissionSubmissionStatus.NEEDS_UPDATE ? this.buildUpdateToken() : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.onlineAdmissionSubmission.update({
        where: { id },
        data: {
          status,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          decisionReason: note?.trim() || null,
          ...(updateToken ? {
            updateTokenHash: updateToken.hash,
            updateTokenExpiresAt: updateToken.expiresAt,
          } : {
            updateTokenHash: null,
            updateTokenExpiresAt: null,
          }),
        },
        include: ADMIN_SUBMISSION_INCLUDE,
      });
      await tx.onlineAdmissionStatusEvent.create({
        data: {
          submissionId: id,
          fromStatus: submission.status,
          toStatus: status,
          note: note?.trim() || null,
          actorUserId: actor.id,
          actorType: 'ADMIN',
        },
      });
      return next;
    });
    await this.sendApplicantStatusEmail({
      to: updated.applicantEmail,
      name: updated.applicantName,
      reference: updated.publicReference,
      organizationName: updated.organization.name,
      programLabel: updated.program.name,
      status: updated.status,
      note,
      updateToken: updateToken?.token,
      templates: updated.organization.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return updated;
  }

  async markAdmitted(
    orgId: string,
    id: string,
    actor: Actor,
    studentId: string,
    note?: string,
  ) {
    const submission = await this.getAdminSubmission(orgId, id, actor);
    if (submission.status === OnlineAdmissionSubmissionStatus.REJECTED) {
      throw new ConflictException('Rejected submissions cannot be admitted');
    }
    if (submission.status === OnlineAdmissionSubmissionStatus.ADMITTED) {
      if (submission.admittedStudentId !== studentId) {
        throw new ConflictException('Submission is already linked to another student');
      }
      await this.sendApplicantStatusEmail({
        to: submission.applicantEmail,
        name: submission.applicantName,
        reference: submission.publicReference,
        organizationName: submission.organization.name,
        programLabel: submission.program.name,
        status: submission.status,
        note,
        templates: submission.organization.onlineAdmissionEmailTemplates,
      }).catch(() => undefined);
      return submission;
    }
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId },
      select: { id: true },
    });
    if (!student) throw new BadRequestException('Admitted student must belong to this organization');
    await this.assertStudentMatchesSubmissionOffering(submission, studentId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.onlineAdmissionSubmission.update({
        where: { id },
        data: {
          status: OnlineAdmissionSubmissionStatus.ADMITTED,
          admittedStudentId: studentId,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          decisionReason: note?.trim() || submission.decisionReason,
          updateTokenHash: null,
          updateTokenExpiresAt: null,
        },
        include: ADMIN_SUBMISSION_INCLUDE,
      });
      await tx.onlineAdmissionStatusEvent.create({
        data: {
          submissionId: id,
          fromStatus: submission.status,
          toStatus: OnlineAdmissionSubmissionStatus.ADMITTED,
          note: note?.trim() || null,
          actorUserId: actor.id,
          actorType: 'ADMIN',
        },
      });
      return next;
    });
    await this.sendApplicantStatusEmail({
      to: updated.applicantEmail,
      name: updated.applicantName,
      reference: updated.publicReference,
      organizationName: updated.organization.name,
      programLabel: updated.program.name,
      status: updated.status,
      note,
      templates: updated.organization.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return updated;
  }

  private async assertStudentMatchesSubmissionOffering(
    submission: Prisma.OnlineAdmissionSubmissionGetPayload<{ include: typeof ADMIN_SUBMISSION_INCLUDE }>,
    studentId: string,
  ) {
    const enrollment = await this.prisma.studentProgramEnrollment.findFirst({
      where: {
        organizationId: submission.organizationId,
        studentId,
        programId: submission.programId,
        curriculumVersionId: submission.programOffering.curriculumVersionId,
        status: { in: OPEN_STUDENT_PROGRAM_ENROLLMENT_STATUSES },
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ConflictException(
        'The admitted student is not enrolled in the same program and curriculum as this online admission offering. Update the program default admissions curriculum or use an offering-aware admission path before marking this submission admitted.',
      );
    }
  }
}
