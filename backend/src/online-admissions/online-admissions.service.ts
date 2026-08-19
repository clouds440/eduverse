import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { extname } from 'path';
import {
  AcademicCycleStatus,
  AdditionalDocumentRequestStatus,
  AdmissionApplicationVersionStatus,
  StudentProgramEnrollmentStatus,
  OnlineAdmissionSubmissionStatus,
  OrgStatus,
  Prisma,
  ProgramOfferingAction,
  ProgramOfferingStatus,
  ProgramStatus,
  EducationProviderStatus,
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
import { CreateAdditionalDocumentRequestDto, CreateOnlineAdmissionSubmissionDto } from './dto/online-admission.dto';
import { CaptchaService } from '../captcha/captcha.service';
import { EducationProvidersService } from '../education-providers/education-providers.service';
import { EducationProviderCapability } from '../education-providers/education-provider.types';
import {
  type AdmissionFormDefinition,
  validateAdmissionAnswers,
  validateAdmissionFormDefinition,
} from '../admission-forms/admission-form-definition';

type Actor = DepartmentScopedUser & { id: string; email?: string | null; name?: string | null };

type AdminSubmissionFilters = {
  providerId?: string;
  departmentId?: string;
  programId?: string;
  programOfferingId?: string;
  academicCycleId?: string;
  status?: string;
  submittedFrom?: string;
  submittedTo?: string;
  missingRequiredDocuments?: boolean;
};

type DocumentUploadPolicy = {
  id: string;
  key?: string;
  label: string;
  description?: string | null;
  category?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
  acceptedMimeTypes: string[];
  acceptedExtensions: string[];
  maxFileSizeBytes: number | null;
  maxFileCount: number;
  requiresExpiryDate: boolean;
  additionalDocumentRequestId?: string;
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
  provider: true,
  program: { include: { campusConfiguration: { include: { department: true } } } },
  campusBinding: {
    include: {
      organization: { select: { id: true, name: true, slug: true, location: true, logoUrl: true, onlineAdmissionsEnabled: true, onlineAdmissionEmailTemplates: true } },
      academicCycle: true,
      curriculumVersion: true,
    },
  },
  locations: { orderBy: { sortOrder: 'asc' as const }, include: { providerLocation: true } },
  fees: { orderBy: { sortOrder: 'asc' as const } },
  fundingOptions: { orderBy: { sortOrder: 'asc' as const } },
  admissionRequirements: { orderBy: { sortOrder: 'asc' as const } },
  applicationConfig: {
    include: {
      applicationVersion: {
        include: { documentRequirements: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] } },
      },
    },
  },
} satisfies Prisma.ProgramOfferingInclude;

const ADMIN_SUBMISSION_INCLUDE = {
  provider: true,
  organization: { select: { id: true, name: true, slug: true, logoUrl: true, onlineAdmissionEmailTemplates: true } },
  department: true,
  program: { select: { id: true, name: true, code: true } },
  programOffering: {
    include: {
      campusBinding: { include: { academicCycle: true } },
      locations: { orderBy: { sortOrder: 'asc' as const }, include: { providerLocation: true } },
      fees: { orderBy: { sortOrder: 'asc' as const } },
      fundingOptions: { orderBy: { sortOrder: 'asc' as const } },
      admissionRequirements: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
  applicationVersion: {
    include: { documentRequirements: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] } },
  },
  academicCycle: true,
  documentUploads: { include: { requirement: true, additionalDocumentRequest: true, file: true }, orderBy: { createdAt: 'asc' as const } },
  additionalDocumentRequests: {
    include: { uploads: { include: { file: true }, orderBy: { createdAt: 'asc' as const } } },
    orderBy: { createdAt: 'asc' as const },
  },
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
    private readonly providers: EducationProvidersService,
  ) {}

  private nowWindowWhere(): Prisma.ProgramOfferingWhereInput {
    const now = new Date();
    return {
      OR: [{ applicationOpensAt: null }, { applicationOpensAt: { lte: now } }],
      AND: [{ OR: [{ applicationClosesAt: null }, { applicationClosesAt: { gte: now } }] }],
    };
  }

  private publicOfferingWhere(): Prisma.ProgramOfferingWhereInput {
    return {
      status: ProgramOfferingStatus.OPEN,
      onlineAdmissionEnabled: true,
      provider: { status: EducationProviderStatus.ACTIVE },
      AND: [
        this.nowWindowWhere(),
        {
          OR: [
            { campusBinding: null },
            {
              campusBinding: {
                organization: { status: OrgStatus.APPROVED, onlineAdmissionsEnabled: true },
                academicCycle: { status: { in: ACTIVE_ENTRY_CYCLE_STATUSES } },
              },
            },
          ],
        },
        {
          OR: [
            { program: { status: ProgramStatus.ACTIVE, campusConfiguration: null } },
            { program: { status: ProgramStatus.ACTIVE, campusConfiguration: { department: { isActive: true } } } },
          ],
        },
      ],
      supportedActions: { has: ProgramOfferingAction.APPLY },
      applicationConfig: {
        applicationVersion: { status: AdmissionApplicationVersionStatus.PUBLISHED },
      },
    };
  }

  private publicOfferingSearchWhere(search?: string): Prisma.ProgramOfferingWhereInput {
    if (!search) return {};
    return {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { intakeName: { contains: search, mode: 'insensitive' } },
        { publicSummary: { contains: search, mode: 'insensitive' } },
        { program: { code: { contains: search, mode: 'insensitive' } } },
        { program: { name: { contains: search, mode: 'insensitive' } } },
        { program: { subjectArea: { contains: search, mode: 'insensitive' } } },
        { provider: { displayName: { contains: search, mode: 'insensitive' } } },
        { locations: { some: { providerLocation: { OR: [
          { city: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
          { countryCode: { contains: search, mode: 'insensitive' } },
          { displayLabel: { contains: search, mode: 'insensitive' } },
        ] } } } },
      ],
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

  async listPublicOfferings(filters: {
    search?: string;
    providerSlug?: string;
    programType?: string;
    subject?: string;
    location?: string;
    onlineOnly?: boolean;
    minFee?: number;
    maxFee?: number;
    intake?: string;
    deadlineBefore?: string;
  } = {}) {
    if ((filters.minFee !== undefined && !Number.isFinite(filters.minFee))
      || (filters.maxFee !== undefined && !Number.isFinite(filters.maxFee))) {
      throw new BadRequestException('Fee filters must be valid numbers');
    }
    if (filters.minFee !== undefined && filters.maxFee !== undefined && filters.minFee > filters.maxFee) {
      throw new BadRequestException('Minimum fee cannot be greater than maximum fee');
    }
    const deadline = filters.deadlineBefore ? new Date(`${filters.deadlineBefore}T23:59:59.999Z`) : null;
    if (filters.deadlineBefore && Number.isNaN(deadline?.getTime())) throw new BadRequestException('Deadline filter must use YYYY-MM-DD');
    const feeWhere = (filters.minFee !== undefined || filters.maxFee !== undefined)
      ? { some: { amount: { gte: filters.minFee, lte: filters.maxFee } } }
      : undefined;
    const offerings = await this.prisma.programOffering.findMany({
      where: {
        ...this.publicOfferingWhere(),
        ...this.publicOfferingSearchWhere(filters.search?.trim() || undefined),
        provider: {
          status: EducationProviderStatus.ACTIVE,
          ...(filters.providerSlug ? { slug: filters.providerSlug.toLowerCase() } : {}),
        },
        program: {
          ...(filters.programType ? { programType: filters.programType as never } : {}),
          ...(filters.subject ? { subjectArea: { contains: filters.subject, mode: 'insensitive' as const } } : {}),
        },
        deliveryMode: filters.onlineOnly ? { in: ['ONLINE', 'HYBRID'] as never } : undefined,
        intakeName: filters.intake ? { contains: filters.intake, mode: 'insensitive' } : undefined,
        applicationClosesAt: deadline ? { lte: deadline } : undefined,
        fees: feeWhere,
        locations: filters.location ? { some: { providerLocation: { OR: [
          { city: { contains: filters.location, mode: 'insensitive' } },
          { region: { contains: filters.location, mode: 'insensitive' } },
          { countryCode: { contains: filters.location, mode: 'insensitive' } },
          { displayLabel: { contains: filters.location, mode: 'insensitive' } },
        ] } } } : undefined,
      },
      orderBy: [{ applicationClosesAt: 'asc' }, { provider: { displayName: 'asc' } }, { program: { name: 'asc' } }],
      take: 100,
      include: PUBLIC_OFFERING_INCLUDE,
    });
    return offerings.map((offering) => this.toPublicOfferingPayload(offering));
  }

  async getPublicProvider(slug: string) {
    const provider = await this.prisma.educationProvider.findFirst({
      where: { slug: slug.toLowerCase(), status: EducationProviderStatus.ACTIVE },
      select: {
        id: true,
        displayName: true,
        slug: true,
        kind: true,
        defaultCurrency: true,
        contactEmail: true,
        campusOrganization: { select: { id: true, name: true, slug: true, location: true, logoUrl: true, onlineAdmissionsEnabled: true } },
      },
    });
    if (!provider) throw new NotFoundException('Education provider not found');
    return {
      ...provider,
      programOfferings: await this.listPublicOfferings({ providerSlug: provider.slug }),
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
            { campusProgramOfferingBindings: { some: { programOffering: { program: { code: { contains: search, mode: 'insensitive' } } } } } },
          ],
        } : {}),
        campusProgramOfferingBindings: { some: { programOffering: this.publicOfferingWhere() } },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        logoUrl: true,
        campusProgramOfferingBindings: {
          where: { programOffering: this.publicOfferingWhere() },
          orderBy: { programOffering: { program: { code: 'asc' } } },
          select: { programOffering: { select: { program: { select: { id: true, code: true, name: true } } } } },
        },
      },
    });

    return organizations.map(({ campusProgramOfferingBindings, ...organization }) => ({
      ...organization,
      programTags: [...new Map(campusProgramOfferingBindings.map(({ programOffering: { program } }) => [program.id, {
        id: program.id,
        code: program.code,
        label: program.name,
      }])).values()],
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
        campusProgramOfferingBindings: {
          where: { programOffering: this.publicOfferingWhere() },
          orderBy: { programOffering: { program: { name: 'asc' } } },
          select: { programOffering: { include: PUBLIC_OFFERING_INCLUDE } },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return {
      ...organization,
      programOfferings: organization.campusProgramOfferingBindings.map(({ programOffering }) =>
        this.toPublicOfferingPayload(programOffering),
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
    const publicCampusOrganization = offering.campusBinding
      ? (({ onlineAdmissionEmailTemplates: _privateTemplates, ...organization }) => organization)(offering.campusBinding.organization)
      : null;
    return {
      ...offering,
      applicationConfig: undefined,
      provider: {
        id: offering.provider.id,
        displayName: offering.provider.displayName,
        slug: offering.provider.slug,
        kind: offering.provider.kind,
        defaultCurrency: offering.provider.defaultCurrency,
        contactEmail: offering.provider.contactEmail,
      },
      applicationForm: offering.applicationConfig ? {
        versionId: offering.applicationConfig.applicationVersion.id,
        schemaVersion: offering.applicationConfig.applicationVersion.schemaVersion,
        definition: offering.applicationConfig.applicationVersion.definition,
        uiSchema: offering.applicationConfig.applicationVersion.uiSchema,
        consentText: offering.applicationConfig.applicationVersion.consentText,
        consentVersion: offering.applicationConfig.applicationVersion.consentVersion,
        documentRequirements: offering.applicationConfig.applicationVersion.documentRequirements,
        allowApplicantUpdates: offering.applicationConfig.allowApplicantUpdates,
      } : null,
      campusBinding: offering.campusBinding ? { ...offering.campusBinding, organization: publicCampusOrganization } : null,
      organization: publicCampusOrganization,
      academicCycle: offering.campusBinding?.academicCycle ?? null,
      curriculumVersion: offering.campusBinding?.curriculumVersion ?? null,
    };
  }

  async submitPublicApplication(
    offeringId: string,
    dto: CreateOnlineAdmissionSubmissionDto,
    metadata: { ip?: string | null; userAgent?: string | null } = {},
    files: Express.Multer.File[] = [],
  ) {
    await this.captcha.verifyToken('ONLINE_ADMISSION', dto.captchaToken);
    const offering = await this.findPublicOffering(offeringId);
    const campusBinding = offering.campusBinding;
    const providerId = campusBinding
      ? await this.providers.providerIdForOrganization(campusBinding.organizationId, offering.providerId)
      : offering.providerId;
    const config = offering.applicationConfig;
    if (!config || config.applicationVersion.status !== AdmissionApplicationVersionStatus.PUBLISHED) {
      throw new ConflictException('This offering does not have a published application form');
    }
    const intent = dto.intent ?? ProgramOfferingAction.APPLY;
    if (!offering.supportedActions.includes(intent)) {
      throw new BadRequestException('This application action is not available for the selected offering');
    }
    const definition = validateAdmissionFormDefinition(config.applicationVersion.definition);
    const { answers, canonical } = validateAdmissionAnswers(definition, dto.answers);
    if (config.applicationVersion.consentText && dto.consentAccepted !== true) {
      throw new BadRequestException('You must accept the application consent statement');
    }
    const applicantName = String(canonical['applicant.name'] || '').trim();
    const applicantEmail = String(canonical['applicant.email'] || '').trim().toLowerCase();
    const applicantPhone = canonical['applicant.phone'] == null
      ? null
      : String(canonical['applicant.phone']).trim() || null;
    const duplicate = await this.prisma.onlineAdmissionSubmission.findFirst({
      where: {
        providerId,
        programOfferingId: offering.id,
        intent,
        applicantEmail: { equals: applicantEmail, mode: 'insensitive' },
        status: { notIn: TERMINAL_DUPLICATE_EXEMPT_STATUSES },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('An active application already exists for this email and offering');
    }
    const requirements = config.applicationVersion.documentRequirements;
    const filesByRequirement = this.validateSubmissionFiles(requirements, files, dto.documentExpiryDates);
    const missingRequired = requirements.filter((item) => item.isRequired && !filesByRequirement.has(item.id));
    if (missingRequired.length > 0) throw new BadRequestException(`Missing required documents: ${missingRequired.map((item) => item.label).join(', ')}`);
    const reference = this.buildReference();
    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.onlineAdmissionSubmission.create({
        data: {
          publicReference: reference,
          providerId,
          organizationId: campusBinding?.organizationId ?? null,
          departmentId: offering.program.campusConfiguration?.departmentId ?? null,
          programId: offering.programId,
          programOfferingId: offering.id,
          academicCycleId: campusBinding?.academicCycleId ?? null,
          applicationVersionId: config.applicationVersion.id,
          intent,
          applicantEmail,
          applicantName,
          applicantPhone,
          formData: answers as Prisma.InputJsonValue,
          formDefinitionSnapshot: config.applicationVersion.definition as Prisma.InputJsonValue,
          documentRequirementsSnapshot: requirements.map((requirement) => this.documentPolicy(requirement)) as Prisma.InputJsonValue,
          consentVersionSnapshot: config.applicationVersion.consentVersion,
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
      await tx.admissionsDomainEvent.create({
        data: {
          providerId,
          programOfferingId: offering.id,
          submissionId: created.id,
          eventType: 'admissions.application.submitted',
          payload: {
            reference,
            offeringId: offering.id,
            programId: offering.programId,
            intent,
          },
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
        await this.persistSubmissionFiles(
          submission.id,
          providerId,
          campusBinding?.organizationId ?? null,
          filesByRequirement,
          requirements,
        );
      } catch (error) {
        await this.cleanupFailedInitialSubmission(submission.id, providerId, campusBinding?.organizationId ?? null);
        throw error;
      }
    }
    await this.sendApplicantStatusEmail({
      to: submission.applicantEmail,
      name: submission.applicantName,
      reference: submission.publicReference,
      organizationName: campusBinding?.organization.name ?? offering.provider.displayName,
      programLabel: offering.program.name,
      status: OnlineAdmissionSubmissionStatus.SUBMITTED,
      templates: campusBinding?.organization.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return { reference: submission.publicReference, status: submission.status };
  }

  private async cleanupFailedInitialSubmission(
    submissionId: string,
    providerId: string,
    organizationId: string | null,
  ) {
    const uploads = await this.prisma.onlineAdmissionDocumentUpload.findMany({
      where: { submissionId },
      select: { fileId: true },
    }).catch(() => []);
    await this.prisma.onlineAdmissionSubmission.delete({ where: { id: submissionId } }).catch(() => undefined);
    await Promise.all(uploads.map((upload) => this.files.deleteProviderManagedFile(upload.fileId, {
      providerId,
      organizationId,
      entityType: 'ONLINE_ADMISSION',
      entityId: submissionId,
    }).catch(() => undefined)));
  }

  private validateSubmissionFiles(
    requirements: DocumentUploadPolicy[],
    files: Express.Multer.File[],
    expiryDates: Record<string, string> = {},
  ) {
    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    const filesByRequirement = new Map<string, Array<{ file: Express.Multer.File; expiryDate: Date | null }>>();
    for (const file of files) {
      const requirementId = file.fieldname.startsWith('document:')
        ? file.fieldname.slice('document:'.length)
        : file.fieldname;
      const requirement = requirementById.get(requirementId);
      if (!requirement) throw new BadRequestException('One or more uploaded documents do not match this program');
      const existing = filesByRequirement.get(requirementId) || [];
      if (existing.length >= requirement.maxFileCount) {
        throw new BadRequestException(`${requirement.label} accepts at most ${requirement.maxFileCount} file(s)`);
      }
      if (requirement.acceptedMimeTypes.length && !requirement.acceptedMimeTypes.includes(file.mimetype.toLowerCase())) {
        throw new BadRequestException(`${requirement.label} must use an accepted file type`);
      }
      const extension = extname(file.originalname).toLowerCase();
      if (requirement.acceptedExtensions.length
        && !requirement.acceptedExtensions.map((value) => value.startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`).includes(extension)) {
        throw new BadRequestException(`${requirement.label} must use an accepted file extension`);
      }
      if (requirement.maxFileSizeBytes && file.size > requirement.maxFileSizeBytes) {
        throw new BadRequestException(`${requirement.label} exceeds the configured file size limit`);
      }
      const expiryValue = expiryDates[requirementId];
      const expiryDate = expiryValue ? new Date(`${expiryValue}T00:00:00.000Z`) : null;
      if (expiryValue && Number.isNaN(expiryDate?.getTime())) throw new BadRequestException(`${requirement.label} has an invalid expiry date`);
      if (requirement.requiresExpiryDate && !expiryDate) throw new BadRequestException(`${requirement.label} requires an expiry date`);
      existing.push({ file, expiryDate });
      filesByRequirement.set(requirementId, existing);
    }
    return filesByRequirement;
  }

  private documentPolicy(requirement: DocumentUploadPolicy) {
    return {
      id: requirement.id,
      key: requirement.key,
      label: requirement.label,
      description: requirement.description ?? null,
      category: requirement.category ?? null,
      isRequired: requirement.isRequired ?? true,
      sortOrder: requirement.sortOrder ?? 0,
      acceptedMimeTypes: requirement.acceptedMimeTypes,
      acceptedExtensions: requirement.acceptedExtensions,
      maxFileSizeBytes: requirement.maxFileSizeBytes,
      maxFileCount: requirement.maxFileCount,
      requiresExpiryDate: requirement.requiresExpiryDate,
    };
  }

  private async persistSubmissionFiles(
    submissionId: string,
    providerId: string,
    organizationId: string | null,
    filesByRequirement: Map<string, Array<{ file: Express.Multer.File; expiryDate: Date | null }>>,
    requirements: DocumentUploadPolicy[],
  ) {
    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    for (const [requirementId, entries] of filesByRequirement) for (const { file, expiryDate } of entries) {
      const fileScope = {
        providerId,
        organizationId,
        entityType: 'ONLINE_ADMISSION',
        entityId: submissionId,
      };
      const stored = await this.files.saveProviderFile(
        fileScope,
        file,
        `public-applicant:${submissionId}`,
      );
      try {
        const requirement = requirementById.get(requirementId);
        if (!requirement) throw new BadRequestException('Document requirement was no longer available');
        await this.prisma.onlineAdmissionDocumentUpload.create({
          data: {
            providerId,
            organizationId,
            submissionId,
            requirementId: requirement.additionalDocumentRequestId ? null : requirementId,
            additionalDocumentRequestId: requirement.additionalDocumentRequestId || null,
            fileId: stored.id,
            labelSnapshot: requirement.label,
            policySnapshot: this.documentPolicy(requirement) as Prisma.InputJsonValue,
            expiryDate,
          },
        });
      } catch (error) {
        await this.files.deleteProviderManagedFile(stored.id, fileScope).catch(() => undefined);
        throw error;
      }
    }
  }

  async getPublicUpdateSubmission(token: string) {
    const submission = await this.findSubmissionByUpdateToken(token);
    return this.toPublicUpdatePayload(submission);
  }

  async uploadPublicUpdateDocuments(
    token: string,
    files: Express.Multer.File[],
    expiryDates: Record<string, string> = {},
  ) {
    if (!files.length) throw new BadRequestException('No documents were uploaded');
    const submission = await this.findSubmissionByUpdateToken(token);
    if (submission.status !== OnlineAdmissionSubmissionStatus.NEEDS_UPDATE) {
      throw new ConflictException('This application is not waiting for document updates');
    }
    const providerId = submission.organizationId
      ? await this.providers.providerIdForOrganization(submission.organizationId, submission.providerId)
      : submission.providerId;
    const requirements: DocumentUploadPolicy[] = [
      ...submission.applicationVersion.documentRequirements,
      ...submission.additionalDocumentRequests
        .filter((request) => request.status === AdditionalDocumentRequestStatus.REQUESTED)
        .map((request) => ({
          ...request,
          isRequired: true,
          additionalDocumentRequestId: request.id,
        })),
    ];
    const filesByRequirement = this.validateSubmissionFiles(requirements, files, expiryDates);
    await this.persistSubmissionFiles(
      submission.id,
      providerId,
      submission.organizationId,
      filesByRequirement,
      requirements,
    );
    await this.assertRequiredDocumentsComplete(
      submission.id,
      submission.applicationVersion.documentRequirements,
      submission.additionalDocumentRequests,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.additionalDocumentRequest.updateMany({
        where: {
          submissionId: submission.id,
          status: AdditionalDocumentRequestStatus.REQUESTED,
          uploads: { some: {} },
        },
        data: { status: AdditionalDocumentRequestStatus.SUBMITTED },
      });
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
    additionalRequests: Array<{ id: string; label: string; status: AdditionalDocumentRequestStatus }> = [],
  ) {
    const required = requirements.filter((requirement) => requirement.isRequired);
    if (required.length) {
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
    const requested = additionalRequests.filter((request) => request.status === AdditionalDocumentRequestStatus.REQUESTED);
    if (!requested.length) return;
    const additionalUploads = await this.prisma.onlineAdmissionDocumentUpload.findMany({
      where: { submissionId, additionalDocumentRequestId: { in: requested.map((request) => request.id) } },
      select: { additionalDocumentRequestId: true },
    });
    const uploadedRequestIds = new Set(additionalUploads.map((upload) => upload.additionalDocumentRequestId));
    const missingRequests = requested.filter((request) => !uploadedRequestIds.has(request.id));
    if (missingRequests.length) {
      throw new BadRequestException(`Missing requested documents: ${missingRequests.map((request) => request.label).join(', ')}`);
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
    const organization = submission.organization ? {
      id: submission.organization.id,
      name: submission.organization.name,
      slug: submission.organization.slug,
      logoUrl: submission.organization.logoUrl,
    } : null;
    return {
      id: submission.id,
      publicReference: submission.publicReference,
      status: submission.status,
      applicantName: submission.applicantName,
      provider: {
        id: submission.provider.id,
        displayName: submission.provider.displayName,
        slug: submission.provider.slug,
        kind: submission.provider.kind,
      },
      organization,
      program: submission.program,
      submittedAt: submission.submittedAt,
      formDefinition: submission.formDefinitionSnapshot,
      documentRequirements: submission.documentRequirementsSnapshot,
      additionalDocumentRequests: submission.additionalDocumentRequests.map((request) => ({
        id: request.id,
        key: request.key,
        label: request.label,
        description: request.description,
        category: request.category,
        acceptedMimeTypes: request.acceptedMimeTypes,
        acceptedExtensions: request.acceptedExtensions,
        maxFileSizeBytes: request.maxFileSizeBytes,
        maxFileCount: request.maxFileCount,
        requiresExpiryDate: request.requiresExpiryDate,
        status: request.status,
        dueAt: request.dueAt,
      })),
      documentUploads: submission.documentUploads.map((upload) => ({
        id: upload.id,
        requirementId: upload.requirementId,
        additionalDocumentRequestId: upload.additionalDocumentRequestId,
        labelSnapshot: upload.labelSnapshot,
        expiryDate: upload.expiryDate,
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

  private snapshotRequirements(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) return [] as Array<{ id: string; label: string; isRequired: boolean }>;
    return value.flatMap((item) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') return [];
      const record = item as Record<string, Prisma.JsonValue>;
      if (typeof record.id !== 'string' || typeof record.label !== 'string') return [];
      return [{ id: record.id, label: record.label, isRequired: record.isRequired === true }];
    });
  }

  private canonicalData(definitionValue: Prisma.JsonValue, answersValue: Prisma.JsonValue) {
    const answers = answersValue && !Array.isArray(answersValue) && typeof answersValue === 'object'
      ? answersValue as Record<string, unknown>
      : {};
    const canonical: Record<string, unknown> = {};
    if (!definitionValue || Array.isArray(definitionValue) || typeof definitionValue !== 'object') return canonical;
    const sections = (definitionValue as Record<string, Prisma.JsonValue>).sections;
    if (!Array.isArray(sections)) return canonical;
    for (const section of sections) {
      if (!section || Array.isArray(section) || typeof section !== 'object') continue;
      const fields = (section as Record<string, Prisma.JsonValue>).fields;
      if (!Array.isArray(fields)) continue;
      for (const field of fields) {
        if (!field || Array.isArray(field) || typeof field !== 'object') continue;
        const record = field as Record<string, Prisma.JsonValue>;
        if (typeof record.key === 'string' && typeof record.canonicalTarget === 'string' && answers[record.key] !== undefined) {
          canonical[record.canonicalTarget] = answers[record.key];
        }
      }
    }
    return canonical;
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
          program: { select: { id: true, name: true, code: true } },
          academicCycle: true,
          programOffering: {
            select: {
              id: true,
              status: true,
              onlineAdmissionEnabled: true,
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
      const requiredIds = this.snapshotRequirements(submission.documentRequirementsSnapshot)
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

  async listProviderSubmissions(
    providerId: string,
    actor: Actor,
    options: PaginationOptions & AdminSubmissionFilters,
  ) {
    const context = await this.providers.actorContext({
      providerId,
      userId: actor.id,
      campusRole: actor.role as never,
    });
    this.providers.assertCapability(context, EducationProviderCapability.REVIEW_APPLICATIONS);
    const { skip, take, search, sortBy, sortOrder } = getPaginationOptions(options);
    const safeSortBy = sortBy && ADMIN_SORT_FIELDS.has(sortBy) ? sortBy : 'submittedAt';
    const orderBy = { [safeSortBy]: sortOrder || 'desc' } as Prisma.OnlineAdmissionSubmissionOrderByWithRelationInput;
    const where = this.buildProviderSubmissionWhere(providerId, options, search);
    const [data, totalRecords, statusCounts] = await Promise.all([
      this.prisma.onlineAdmissionSubmission.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          provider: true,
          organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
          department: true,
          program: { select: { id: true, name: true, code: true } },
          academicCycle: true,
          programOffering: { select: { id: true, status: true, onlineAdmissionEnabled: true, campusBinding: true } },
          documentUploads: { select: { requirementId: true } },
          _count: { select: { documentUploads: true } },
        },
      }),
      this.prisma.onlineAdmissionSubmission.count({ where }),
      this.prisma.onlineAdmissionSubmission.groupBy({
        by: ['status'],
        where: { providerId },
        _count: { _all: true },
      }),
    ]);
    return {
      ...formatPaginatedResponse(data.map((submission) => {
        const requiredIds = this.snapshotRequirements(submission.documentRequirementsSnapshot)
          .filter((requirement) => requirement.isRequired)
          .map((requirement) => requirement.id);
        const uploadedIds = new Set(submission.documentUploads.map((upload) => upload.requirementId));
        return {
          ...submission,
          requiredDocumentCount: requiredIds.length,
          uploadedRequiredDocumentCount: requiredIds.filter((id) => uploadedIds.has(id)).length,
        };
      }), totalRecords, options.page || 1, options.limit || 10),
      statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
    };
  }

  private buildProviderSubmissionWhere(providerId: string, options: AdminSubmissionFilters, search?: string): Prisma.OnlineAdmissionSubmissionWhereInput {
    const submittedAt = this.buildSubmittedAtFilter(options.submittedFrom, options.submittedTo);
    return {
      providerId,
      departmentId: options.departmentId,
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
          { provider: { displayName: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
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
        AND (
          EXISTS (
            SELECT 1
            FROM jsonb_array_elements(submission."documentRequirementsSnapshot"::jsonb) requirement
            WHERE COALESCE((requirement->>'isRequired')::boolean, false) = true
              AND NOT EXISTS (
                SELECT 1
                FROM "OnlineAdmissionDocumentUpload" upload
                WHERE upload."submissionId" = submission."id"
                  AND upload."requirementId" = requirement->>'id'
              )
          )
          OR EXISTS (
            SELECT 1
            FROM "AdditionalDocumentRequest" request
            WHERE request."submissionId" = submission."id"
              AND request."status" = 'REQUESTED'
              AND NOT EXISTS (
                SELECT 1
                FROM "OnlineAdmissionDocumentUpload" upload
                WHERE upload."submissionId" = submission."id"
                  AND upload."additionalDocumentRequestId" = request."id"
              )
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
        submission.department?.name || 'Provider admissions',
        submission.academicCycle?.code || submission.academicCycle?.name || 'Provider intake',
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
    if (submission.departmentId) {
      assertDepartmentInScope(scope, submission.departmentId, 'You cannot view admissions outside your department scope');
    }
    return {
      ...submission,
      canonicalData: this.canonicalData(submission.formDefinitionSnapshot, submission.formData),
    };
  }

  async createAdditionalDocumentRequest(
    orgId: string,
    submissionId: string,
    actor: Actor,
    dto: CreateAdditionalDocumentRequestDto,
  ) {
    const submission = await this.getAdminSubmission(orgId, submissionId, actor);
    if (([OnlineAdmissionSubmissionStatus.REJECTED, OnlineAdmissionSubmissionStatus.ADMITTED, OnlineAdmissionSubmissionStatus.WITHDRAWN] as OnlineAdmissionSubmissionStatus[])
      .includes(submission.status)) {
      throw new ConflictException('Additional documents cannot be requested for a finalized application');
    }
    const key = dto.key.trim();
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    const updateToken = this.buildUpdateToken();
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.additionalDocumentRequest.create({
        data: {
          providerId: submission.providerId,
          organizationId: orgId,
          submissionId,
          key,
          label: dto.label.trim(),
          description: dto.description?.trim() || null,
          category: dto.category?.trim() || null,
          acceptedMimeTypes: [...new Set((dto.acceptedMimeTypes || []).map((value) => value.trim().toLowerCase()).filter(Boolean))],
          acceptedExtensions: [...new Set((dto.acceptedExtensions || []).map((value) => value.trim().toLowerCase()).filter(Boolean))],
          maxFileSizeBytes: dto.maxFileSizeBytes ?? null,
          maxFileCount: dto.maxFileCount ?? 1,
          requiresExpiryDate: dto.requiresExpiryDate ?? false,
          dueAt,
          requestedById: actor.id,
        },
      });
      await tx.onlineAdmissionSubmission.update({
        where: { id: submissionId },
        data: {
          status: OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          updateTokenHash: updateToken.hash,
          updateTokenExpiresAt: updateToken.expiresAt,
        },
      });
      await tx.onlineAdmissionStatusEvent.create({
        data: {
          submissionId,
          fromStatus: submission.status,
          toStatus: OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
          note: `Additional document requested: ${created.label}`,
          actorUserId: actor.id,
          actorType: 'ADMIN',
        },
      });
      await tx.admissionsDomainEvent.create({
        data: {
          providerId: submission.providerId,
          programOfferingId: submission.programOfferingId,
          submissionId,
          eventType: 'admissions.document.requested',
          payload: {
            requestId: created.id,
            label: created.label,
            dueAt: created.dueAt,
            actorId: actor.id,
          },
        },
      });
      return created;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A document request with this key already exists for the application');
      }
      throw error;
    });
    await this.sendApplicantStatusEmail({
      to: submission.applicantEmail,
      name: submission.applicantName,
      reference: submission.publicReference,
      organizationName: submission.organization?.name || submission.provider.displayName,
      programLabel: submission.program.name,
      status: OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
      note: dto.description?.trim() || `Please upload: ${request.label}`,
      updateToken: updateToken.token,
      templates: submission.organization?.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return request;
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
      await tx.admissionsDomainEvent.create({
        data: {
          providerId: next.providerId,
          programOfferingId: next.programOfferingId,
          submissionId: id,
          eventType: 'admissions.application.status_changed',
          payload: {
            fromStatus: submission.status,
            toStatus: status,
            actorId: actor.id,
          },
        },
      });
      return next;
    });
    await this.sendApplicantStatusEmail({
      to: updated.applicantEmail,
      name: updated.applicantName,
      reference: updated.publicReference,
      organizationName: updated.organization?.name || updated.provider.displayName,
      programLabel: updated.program.name,
      status: updated.status,
      note,
      updateToken: updateToken?.token,
      templates: updated.organization?.onlineAdmissionEmailTemplates,
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
    if (!submission.organizationId || !submission.programOffering.campusBinding) {
      throw new ConflictException('Provider-only applications must be accepted without Campus student conversion');
    }
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
        organizationName: submission.organization?.name || submission.provider.displayName,
        programLabel: submission.program.name,
        status: submission.status,
        note,
        templates: submission.organization?.onlineAdmissionEmailTemplates,
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
      await tx.admissionsDomainEvent.create({
        data: {
          providerId: next.providerId,
          programOfferingId: next.programOfferingId,
          submissionId: id,
          eventType: 'admissions.application.admitted',
          payload: {
            studentId,
            actorId: actor.id,
          },
        },
      });
      return next;
    });
    await this.sendApplicantStatusEmail({
      to: updated.applicantEmail,
      name: updated.applicantName,
      reference: updated.publicReference,
      organizationName: updated.organization?.name || updated.provider.displayName,
      programLabel: updated.program.name,
      status: updated.status,
      note,
      templates: updated.organization?.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return updated;
  }

  async acceptProviderApplication(
    providerId: string,
    id: string,
    actor: Actor,
    note?: string,
  ) {
    const context = await this.providers.actorContext({
      providerId,
      userId: actor.id,
      campusRole: actor.role as never,
    });
    this.providers.assertCapability(context, EducationProviderCapability.REVIEW_APPLICATIONS);
    const submission = await this.prisma.onlineAdmissionSubmission.findFirst({
      where: { id, providerId },
      include: ADMIN_SUBMISSION_INCLUDE,
    });
    if (!submission) throw new NotFoundException('Online admission submission not found');
    if (([OnlineAdmissionSubmissionStatus.REJECTED, OnlineAdmissionSubmissionStatus.WITHDRAWN] as OnlineAdmissionSubmissionStatus[]).includes(submission.status)) {
      throw new ConflictException('Finalized applications cannot be accepted');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.onlineAdmissionSubmission.update({
        where: { id },
        data: {
          status: OnlineAdmissionSubmissionStatus.ACCEPTED,
          providerOutcome: 'ACCEPTED',
          providerOutcomeNote: note?.trim() || null,
          providerOutcomeAt: new Date(),
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
          toStatus: OnlineAdmissionSubmissionStatus.ACCEPTED,
          note: note?.trim() || null,
          actorUserId: actor.id,
          actorType: 'PROVIDER',
        },
      });
      await tx.admissionsDomainEvent.create({
        data: {
          providerId: next.providerId,
          programOfferingId: next.programOfferingId,
          submissionId: id,
          eventType: 'admissions.application.accepted',
          payload: {
            actorId: actor.id,
          },
        },
      });
      return next;
    });
    await this.sendApplicantStatusEmail({
      to: updated.applicantEmail,
      name: updated.applicantName,
      reference: updated.publicReference,
      organizationName: updated.organization?.name || updated.provider.displayName,
      programLabel: updated.program.name,
      status: updated.status,
      note,
      templates: updated.organization?.onlineAdmissionEmailTemplates,
    }).catch(() => undefined);
    return updated;
  }

  private async assertStudentMatchesSubmissionOffering(
    submission: Prisma.OnlineAdmissionSubmissionGetPayload<{ include: typeof ADMIN_SUBMISSION_INCLUDE }>,
    studentId: string,
  ) {
    if (!submission.organizationId || !submission.programOffering.campusBinding) {
      throw new ConflictException('Provider-only applications do not have a Campus curriculum enrollment to verify');
    }
    const enrollment = await this.prisma.studentProgramEnrollment.findFirst({
      where: {
        organizationId: submission.organizationId,
        studentId,
        programId: submission.programId,
        curriculumVersionId: submission.programOffering.campusBinding!.curriculumVersionId,
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
