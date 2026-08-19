import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AdmissionApplicationVersionStatus, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { EducationProvidersService } from '../education-providers/education-providers.service';
import { DEFAULT_CAMPUS_ADMISSION_DEFINITION, validateAdmissionFormDefinition } from './admission-form-definition';
import { AdmissionDocumentRequirementDto, BindOfferingApplicationFormDto, CreateAdmissionFormDto, UpdateAdmissionFormVersionDto } from './dto/admission-form.dto';

const VERSION_INCLUDE = {
  documentRequirements: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  _count: { select: { offeringConfigs: true, submissions: true } },
} satisfies Prisma.AdmissionApplicationTemplateVersionInclude;

const TEMPLATE_INCLUDE = {
  versions: { orderBy: { version: 'desc' as const }, include: VERSION_INCLUDE },
} satisfies Prisma.AdmissionApplicationTemplateInclude;

@Injectable()
export class AdmissionFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: EducationProvidersService,
  ) {}

  private normalizeRequirements(requirements: AdmissionDocumentRequirementDto[]) {
    const keys = new Set<string>();
    return requirements.map((requirement, index) => {
      const key = requirement.key.trim();
      if (!/^[a-z][a-zA-Z0-9_]{1,63}$/.test(key)) throw new BadRequestException(`Invalid document requirement key: ${key}`);
      if (keys.has(key)) throw new BadRequestException(`Duplicate document requirement key: ${key}`);
      keys.add(key);
      return {
        key,
        label: requirement.label.trim(),
        description: requirement.description?.trim() || null,
        category: requirement.category?.trim() || null,
        isRequired: requirement.isRequired ?? true,
        sortOrder: requirement.sortOrder ?? index,
        acceptedMimeTypes: [...new Set((requirement.acceptedMimeTypes ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))],
        acceptedExtensions: [...new Set((requirement.acceptedExtensions ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))],
        maxFileSizeBytes: requirement.maxFileSizeBytes ?? null,
        maxFileCount: requirement.maxFileCount ?? 1,
        requiresExpiryDate: requirement.requiresExpiryDate ?? false,
      };
    });
  }

  async ensureDefaultCampusTemplate(orgId: string, actorId: string) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    const existing = await this.prisma.admissionApplicationTemplate.findFirst({
      where: { providerId, isDefaultCampus: true }, include: TEMPLATE_INCLUDE,
    });
    if (existing) return existing;
    try {
      return await this.prisma.admissionApplicationTemplate.create({
        data: {
          providerId,
          name: 'Campus Student Admission',
          description: 'Default application fields mapped to Campus student admission.',
          isDefaultCampus: true,
          createdById: actorId,
          versions: {
            create: {
              version: 1,
              status: AdmissionApplicationVersionStatus.PUBLISHED,
              schemaVersion: 1,
              definition: DEFAULT_CAMPUS_ADMISSION_DEFINITION as unknown as Prisma.InputJsonValue,
              consentText: 'I confirm that the information provided is accurate and may be used to process this application.',
              consentVersion: 'campus-default-v1',
              createdById: actorId,
              publishedById: actorId,
              publishedAt: new Date(),
            },
          },
        },
        include: TEMPLATE_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.admissionApplicationTemplate.findFirst({ where: { providerId, isDefaultCampus: true }, include: TEMPLATE_INCLUDE });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  async list(orgId: string, actorId: string) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    await this.ensureDefaultCampusTemplate(orgId, actorId);
    return this.prisma.admissionApplicationTemplate.findMany({
      where: { providerId }, orderBy: [{ isDefaultCampus: 'desc' }, { name: 'asc' }], include: TEMPLATE_INCLUDE,
    });
  }

  async get(orgId: string, id: string) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    const template = await this.prisma.admissionApplicationTemplate.findFirst({ where: { id, providerId }, include: TEMPLATE_INCLUDE });
    if (!template) throw new NotFoundException('Admission form not found');
    return template;
  }

  async create(orgId: string, dto: CreateAdmissionFormDto, actorId: string) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    const definition = validateAdmissionFormDefinition(dto.definition);
    const requirements = this.normalizeRequirements(dto.documentRequirements ?? []);
    try {
      return await this.prisma.admissionApplicationTemplate.create({
        data: {
          providerId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          createdById: actorId,
          versions: { create: {
            version: 1,
            definition: definition as unknown as Prisma.InputJsonValue,
            uiSchema: dto.uiSchema as Prisma.InputJsonValue | undefined,
            consentText: dto.consentText?.trim() || null,
            consentVersion: dto.consentVersion?.trim() || null,
            createdById: actorId,
            documentRequirements: { create: requirements },
          } },
        },
        include: TEMPLATE_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An admission form with this name already exists');
      throw error;
    }
  }

  private async scopedVersion(orgId: string, id: string) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    const version = await this.prisma.admissionApplicationTemplateVersion.findFirst({
      where: { id, template: { providerId } }, include: { ...VERSION_INCLUDE, template: true },
    });
    if (!version) throw new NotFoundException('Admission form version not found');
    return { providerId, version };
  }

  async updateDraft(orgId: string, id: string, dto: UpdateAdmissionFormVersionDto) {
    const { version } = await this.scopedVersion(orgId, id);
    if (version.status !== AdmissionApplicationVersionStatus.DRAFT) throw new ConflictException('Published admission form versions are immutable');
    const definition = validateAdmissionFormDefinition(dto.definition);
    const requirements = this.normalizeRequirements(dto.documentRequirements ?? []);
    return this.prisma.$transaction(async (tx) => {
      await tx.admissionDocumentRequirement.deleteMany({ where: { templateVersionId: id } });
      return tx.admissionApplicationTemplateVersion.update({
        where: { id },
        data: {
          definition: definition as unknown as Prisma.InputJsonValue,
          uiSchema: dto.uiSchema === undefined ? undefined : dto.uiSchema as Prisma.InputJsonValue,
          consentText: dto.consentText?.trim() || null,
          consentVersion: dto.consentVersion?.trim() || null,
          documentRequirements: { create: requirements },
        },
        include: VERSION_INCLUDE,
      });
    });
  }

  async publish(orgId: string, id: string, actorId: string) {
    const { version } = await this.scopedVersion(orgId, id);
    if (version.status !== AdmissionApplicationVersionStatus.DRAFT) throw new ConflictException('Only draft versions can be published');
    validateAdmissionFormDefinition(version.definition);
    return this.prisma.admissionApplicationTemplateVersion.update({
      where: { id },
      data: { status: AdmissionApplicationVersionStatus.PUBLISHED, publishedById: actorId, publishedAt: new Date() },
      include: VERSION_INCLUDE,
    });
  }

  async createDraftVersion(orgId: string, templateId: string, actorId: string) {
    const template = await this.get(orgId, templateId);
    if (template.versions.some((version) => version.status === AdmissionApplicationVersionStatus.DRAFT)) {
      throw new ConflictException('This admission form already has a draft version');
    }
    const source = template.versions[0];
    if (!source) throw new ConflictException('Admission form has no source version');
    return this.prisma.admissionApplicationTemplateVersion.create({
      data: {
        templateId,
        version: source.version + 1,
        definition: source.definition as Prisma.InputJsonValue,
        uiSchema: source.uiSchema as Prisma.InputJsonValue | undefined,
        consentText: source.consentText,
        consentVersion: source.consentVersion,
        createdById: actorId,
        documentRequirements: { create: source.documentRequirements.map(({ id: _id, templateVersionId: _versionId, createdAt: _createdAt, ...requirement }) => requirement) },
      },
      include: VERSION_INCLUDE,
    });
  }

  async bindOffering(orgId: string, offeringId: string, dto: BindOfferingApplicationFormDto) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    const [offering, version] = await Promise.all([
      this.prisma.programOffering.findFirst({ where: { id: offeringId, providerId, campusBinding: { organizationId: orgId } } }),
      this.prisma.admissionApplicationTemplateVersion.findFirst({
        where: { id: dto.applicationVersionId, status: AdmissionApplicationVersionStatus.PUBLISHED, template: { providerId } },
      }),
    ]);
    if (!offering) throw new NotFoundException('Program offering not found');
    if (!version) throw new BadRequestException('Select a published admission form version owned by this provider');
    return this.prisma.$transaction(async (tx) => {
      const config = await tx.programOfferingApplicationConfig.upsert({
        where: { programOfferingId: offeringId },
        create: { providerId, programOfferingId: offeringId, applicationVersionId: version.id, allowApplicantUpdates: dto.allowApplicantUpdates ?? true, requireEmailVerification: dto.requireEmailVerification ?? false },
        update: { applicationVersionId: version.id, allowApplicantUpdates: dto.allowApplicantUpdates, requireEmailVerification: dto.requireEmailVerification },
        include: { applicationVersion: { include: VERSION_INCLUDE } },
      });
      await tx.programOffering.update({
        where: { id: offeringId },
        data: {
          onlineAdmissionEnabled: dto.onlineAdmissionEnabled ?? true,
          onlineAdmissionInstructions: dto.onlineAdmissionInstructions === undefined
            ? undefined
            : dto.onlineAdmissionInstructions.trim() || null,
        },
      });
      return config;
    });
  }
}
