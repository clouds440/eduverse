import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProgramOfferingStatus,
  ProgramStageOfferingStatus,
  ProgramStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { assertDepartmentInScope, getDepartmentScope, type DepartmentScopedUser } from '../common/department-scope';
import {
  CreateProgramOfferingDto,
  CreateProviderLocationDto,
  ProgramStageOfferingInputDto,
  UpdateProgramOfferingDto,
} from './dto/program-offering.dto';
import {
  assertLifecycleTransition,
  PROGRAM_OFFERING_TRANSITIONS,
  PROGRAM_STAGE_OFFERING_TRANSITIONS,
} from '../common/offering-lifecycle';
import { EducationProvidersService } from '../education-providers/education-providers.service';
import { ProgramOfferingCatalogService } from './program-offering-catalog.service';
import { CampusProgramOfferingBindingsService } from './campus-program-offering-bindings.service';

type Actor = DepartmentScopedUser & { id: string };

const OFFERING_INCLUDE = {
  program: { include: { campusConfiguration: { include: { department: true } } } },
  campusBinding: { include: { curriculumVersion: true, academicCycle: true } },
  locations: { orderBy: { sortOrder: 'asc' as const }, include: { providerLocation: true } },
  fees: { orderBy: { sortOrder: 'asc' as const } },
  fundingOptions: { orderBy: { sortOrder: 'asc' as const } },
  admissionRequirements: { orderBy: { sortOrder: 'asc' as const } },
  publications: { orderBy: { version: 'desc' as const }, take: 1 },
  stageOfferings: {
    orderBy: { programStage: { sequence: 'asc' as const } },
    include: {
      programStage: { include: { courseRequirements: { include: { course: true } } } },
      _count: { select: { cohortOfferings: true, sectionMappings: true, studentStageEnrollments: true } },
    },
  },
  applicationConfig: { include: { applicationVersion: { include: { documentRequirements: { orderBy: { sortOrder: 'asc' as const } } } } } },
} satisfies Prisma.ProgramOfferingInclude;

@Injectable()
export class AdminProgramOfferingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: EducationProvidersService,
    private readonly catalog: ProgramOfferingCatalogService,
    private readonly campusBindings: CampusProgramOfferingBindingsService,
  ) {}

  async listLocations(orgId: string) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    return this.prisma.providerLocation.findMany({
      where: { providerId, isActive: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createLocation(orgId: string, dto: CreateProviderLocationDto) {
    const providerId = await this.providers.providerIdForOrganization(orgId);
    try {
      return await this.prisma.providerLocation.create({
        data: {
          providerId,
          name: dto.name.trim(),
          code: dto.code?.trim().toUpperCase() || null,
          displayLabel: dto.displayLabel.trim(),
          addressLine1: dto.addressLine1?.trim() || null,
          addressLine2: dto.addressLine2?.trim() || null,
          city: dto.city?.trim() || null,
          region: dto.region?.trim() || null,
          countryCode: dto.countryCode?.trim().toUpperCase() || null,
          postalCode: dto.postalCode?.trim() || null,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A provider location with this name or code already exists');
      }
      throw error;
    }
  }

  private async context(orgId: string, programId: string, curriculumVersionId: string, academicCycleId: string, actor: Actor) {
    const program = await this.prisma.program.findFirst({
        where: { id: programId, campusConfiguration: { organizationId: orgId } },
        include: { campusConfiguration: true },
      });
    if (!program) throw new NotFoundException('Program not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (!program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
    assertDepartmentInScope(scope, program.campusConfiguration.departmentId, 'You cannot manage offerings outside your assigned departments');
    if (program.status === ProgramStatus.ARCHIVED) throw new ConflictException('Archived programs cannot be offered');
    const { curriculum, cycle } = await this.campusBindings.validateContext(orgId, programId, curriculumVersionId, academicCycleId);
    return { program, curriculum, cycle };
  }

  private normalizeOnlineAdmissionInstructions(value: string | null | undefined) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async scopedOffering(orgId: string, id: string, actor: Actor) {
    const offering = await this.prisma.programOffering.findFirst({
      where: { id, campusBinding: { organizationId: orgId } },
      include: { program: { include: { campusConfiguration: true } }, campusBinding: { include: { academicCycle: true } } },
    });
    if (!offering) throw new NotFoundException('Program offering not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (!offering.program.campusConfiguration) throw new NotFoundException('Campus program configuration not found');
    assertDepartmentInScope(scope, offering.program.campusConfiguration.departmentId, 'You cannot manage offerings outside your assigned departments');
    return offering;
  }

  async create(orgId: string, dto: CreateProgramOfferingDto, actor: Actor) {
    if (dto.status && dto.status !== ProgramOfferingStatus.DRAFT) {
      throw new ConflictException('New program offerings must start as DRAFT and pass readiness before opening');
    }
    this.campusBindings.assertNewStages(dto.campusBinding.stages);
    const { program } = await this.context(
      orgId,
      dto.programId,
      dto.campusBinding.curriculumVersionId,
      dto.campusBinding.academicCycleId,
      actor,
    );
    const providerId = await this.providers.providerIdForOrganization(orgId, program.providerId);
    await this.campusBindings.validateStages(orgId, dto.campusBinding.curriculumVersionId, dto.campusBinding.stages);
    await this.catalog.assertLocationsBelongToProvider(providerId, dto.locationIds);
    try {
      return await this.prisma.programOffering.create({
        data: {
          ...this.catalog.createData(providerId, dto, actor.id),
          campusBinding: {
            create: {
              organizationId: orgId,
              curriculumVersionId: dto.campusBinding.curriculumVersionId,
              academicCycleId: dto.campusBinding.academicCycleId,
            },
          },
          stageOfferings: {
            create: dto.campusBinding.stages.map((stage) => ({
              organizationId: orgId,
              programStageId: stage.programStageId,
              status: stage.status,
              startsAt: stage.startsAt ? new Date(stage.startsAt) : null,
              endsAt: stage.endsAt ? new Date(stage.endsAt) : null,
              capacity: stage.capacity,
              createdById: actor.id,
            })),
          },
        },
        include: OFFERING_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This offering code, slug, curriculum, or cycle binding is already in use');
      }
      throw error;
    }
  }

  async list(orgId: string, actor: Actor, academicCycleId?: string, programId?: string) {
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    return this.prisma.programOffering.findMany({
      where: {
        campusBinding: { organizationId: orgId, academicCycleId },
        programId,
        program: {
          campusConfiguration: {
            departmentId: !scope.applies || scope.all ? undefined : { in: scope.departmentIds },
          },
        },
      },
      orderBy: [{ campusBinding: { academicCycle: { startDate: 'desc' } } }, { program: { name: 'asc' } }],
      include: OFFERING_INCLUDE,
    });
  }

  async get(orgId: string, id: string, actor: Actor) {
    await this.scopedOffering(orgId, id, actor);
    return this.prisma.programOffering.findUnique({ where: { id }, include: OFFERING_INCLUDE });
  }

  async readiness(orgId: string, id: string, actor: Actor) {
    await this.scopedOffering(orgId, id, actor);
    const offering = await this.prisma.programOffering.findUnique({
      where: { id },
      include: OFFERING_INCLUDE,
    });
    if (!offering) throw new NotFoundException('Program offering not found');

    const publicListing = this.catalog.publicReadiness(offering);
    const campusDelivery = this.campusBindings.deliveryReadiness(offering);
    return {
      offeringId: offering.id,
      readyForPublicListing: publicListing.ready,
      publicListingBlockers: publicListing.blockers,
      readyForCampusDelivery: campusDelivery.ready,
      campusDeliveryBlockers: campusDelivery.blockers,
      campusDeliveryWarnings: campusDelivery.warnings,
    };
  }

  private feeData(fees: UpdateProgramOfferingDto['fees']): Prisma.ProgramOfferingFeeCreateManyProgramOfferingInput[] | undefined {
    if (!fees) return undefined;
    return fees.map((fee, sortOrder) => ({
      label: fee.label.trim(),
      description: fee.description?.trim() || null,
      amount: fee.amount === null || fee.amount === undefined ? null : new Prisma.Decimal(fee.amount),
      currencyCode: fee.currencyCode.trim().toUpperCase(),
      frequency: fee.frequency?.trim() || null,
      isMandatory: fee.isMandatory ?? true,
      isApplicationFee: fee.isApplicationFee ?? false,
      refundable: fee.refundable ?? null,
      sortOrder,
    }));
  }

  private fundingData(fundingOptions: UpdateProgramOfferingDto['fundingOptions']): Prisma.ProgramOfferingFundingOptionCreateManyProgramOfferingInput[] | undefined {
    if (!fundingOptions) return undefined;
    return fundingOptions.map((option, sortOrder) => ({
      title: option.title.trim(),
      description: option.description?.trim() || null,
      fundingType: option.fundingType?.trim() || null,
      amountSummary: option.amountSummary?.trim() || null,
      eligibilitySummary: option.eligibilitySummary?.trim() || null,
      applicationUrl: option.applicationUrl?.trim() || null,
      sortOrder,
    }));
  }

  private requirementData(admissionRequirements: UpdateProgramOfferingDto['admissionRequirements']): Prisma.ProgramAdmissionRequirementCreateManyProgramOfferingInput[] | undefined {
    if (!admissionRequirements) return undefined;
    return admissionRequirements.map((requirement, sortOrder) => ({
      label: requirement.label.trim(),
      description: requirement.description?.trim() || null,
      requirementType: requirement.requirementType?.trim() || null,
      isRequired: requirement.isRequired ?? true,
      sortOrder,
    }));
  }

  private publicationSnapshot(offering: Prisma.ProgramOfferingGetPayload<{ include: typeof OFFERING_INCLUDE }>) {
    return JSON.parse(JSON.stringify({
      id: offering.id,
      providerId: offering.providerId,
      programId: offering.programId,
      code: offering.code,
      slug: offering.slug,
      intakeName: offering.intakeName,
      status: offering.status,
      applicationOpensAt: offering.applicationOpensAt,
      applicationClosesAt: offering.applicationClosesAt,
      teachingStartsAt: offering.teachingStartsAt,
      teachingEndsAt: offering.teachingEndsAt,
      timezone: offering.timezone,
      capacity: offering.capacity,
      waitlistEnabled: offering.waitlistEnabled,
      deliveryMode: offering.deliveryMode,
      attendanceMode: offering.attendanceMode,
      scheduleSummary: offering.scheduleSummary,
      durationValue: offering.durationValue,
      durationUnit: offering.durationUnit,
      languageCodes: offering.languageCodes,
      publicSummary: offering.publicSummary,
      detailedInstructions: offering.detailedInstructions,
      contactEmail: offering.contactEmail,
      supportedActions: offering.supportedActions,
      onlineAdmissionEnabled: offering.onlineAdmissionEnabled,
      onlineAdmissionInstructions: offering.onlineAdmissionInstructions,
      program: offering.program,
      campusBinding: offering.campusBinding,
      locations: offering.locations,
      fees: offering.fees,
      fundingOptions: offering.fundingOptions,
      admissionRequirements: offering.admissionRequirements,
      applicationConfig: offering.applicationConfig,
    })) as Prisma.InputJsonValue;
  }

  async update(orgId: string, id: string, dto: UpdateProgramOfferingDto, actor: Actor) {
    const offering = await this.scopedOffering(orgId, id, actor);
    if (!offering.campusBinding) throw new NotFoundException('Campus offering binding not found');
    await this.campusBindings.validateContext(
      orgId,
      offering.programId,
      offering.campusBinding.curriculumVersionId,
      offering.campusBinding.academicCycleId,
    );
    assertLifecycleTransition(offering.status, dto.status, PROGRAM_OFFERING_TRANSITIONS, 'Program offering');
    const nextOpensAt = dto.applicationOpensAt === undefined ? offering.applicationOpensAt : dto.applicationOpensAt ? new Date(dto.applicationOpensAt) : null;
    const nextClosesAt = dto.applicationClosesAt === undefined ? offering.applicationClosesAt : dto.applicationClosesAt ? new Date(dto.applicationClosesAt) : null;
    if (nextOpensAt && nextClosesAt && nextOpensAt >= nextClosesAt) {
      throw new BadRequestException('Offering close date must be after its open date');
    }
    const nextTeachingStartsAt = dto.teachingStartsAt === undefined ? offering.teachingStartsAt : dto.teachingStartsAt ? new Date(dto.teachingStartsAt) : null;
    const nextTeachingEndsAt = dto.teachingEndsAt === undefined ? offering.teachingEndsAt : dto.teachingEndsAt ? new Date(dto.teachingEndsAt) : null;
    if (nextTeachingStartsAt && nextTeachingEndsAt && nextTeachingStartsAt >= nextTeachingEndsAt) {
      throw new BadRequestException('Teaching end date must be after its start date');
    }
    await this.catalog.assertLocationsBelongToProvider(offering.providerId, dto.locationIds);
    if (dto.status === ProgramOfferingStatus.PUBLISHED || dto.status === ProgramOfferingStatus.OPEN) {
      const readiness = await this.readiness(orgId, id, actor);
      const campusRequired = dto.status === ProgramOfferingStatus.OPEN;
      if (!readiness.readyForPublicListing || (campusRequired && !readiness.readyForCampusDelivery)) {
        throw new ConflictException([
          ...readiness.publicListingBlockers,
          ...(campusRequired ? readiness.campusDeliveryBlockers : []),
        ].map((blocker) => blocker.message).join(' '));
      }
    }
    if (dto.stages) await this.campusBindings.validateStages(orgId, offering.campusBinding.curriculumVersionId, dto.stages);
    return this.prisma.$transaction(async (tx) => {
      if (dto.stages) {
        const existingStages = await tx.programStageOffering.findMany({
          where: { programOfferingId: id },
          select: { programStageId: true, status: true, startsAt: true, endsAt: true },
        });
        const existingStatus = new Map(existingStages.map((stage) => [stage.programStageId, stage.status]));
        for (const stage of dto.stages) {
          const existing = existingStages.find((item) => item.programStageId === stage.programStageId);
          if (existing) assertLifecycleTransition(existing.status, stage.status, PROGRAM_STAGE_OFFERING_TRANSITIONS, 'Program stage offering');
          const startsAt = stage.startsAt === undefined ? existing?.startsAt : stage.startsAt ? new Date(stage.startsAt) : null;
          const endsAt = stage.endsAt === undefined ? existing?.endsAt : stage.endsAt ? new Date(stage.endsAt) : null;
          if (startsAt && endsAt && startsAt >= endsAt) throw new BadRequestException('A stage offering end date must be after its start date');
        }
        const nextParentStatus = dto.status ?? offering.status;
        const nextStageStatuses = dto.stages.map((stage) => stage.status ?? existingStatus.get(stage.programStageId) ?? ProgramStageOfferingStatus.PLANNED);
        if (nextStageStatuses.includes(ProgramStageOfferingStatus.OPEN) && nextParentStatus !== ProgramOfferingStatus.OPEN) {
          throw new ConflictException('A stage offering can only be open while its program offering is open');
        }
        if ([ProgramOfferingStatus.CLOSED, ProgramOfferingStatus.CANCELLED].includes(nextParentStatus as never)
          && nextStageStatuses.some((status) => !([ProgramStageOfferingStatus.CLOSED, ProgramStageOfferingStatus.CANCELLED] as ProgramStageOfferingStatus[]).includes(status))) {
          throw new ConflictException('Close or cancel every stage offering before closing the program offering');
        }
        const inUse = await tx.programStageOffering.count({
          where: {
            programOfferingId: id,
            programStageId: { notIn: dto.stages.map((stage) => stage.programStageId) },
            OR: [
              { cohortOfferings: { some: {} } },
              { sectionMappings: { some: {} } },
              { studentStageEnrollments: { some: {} } },
            ],
          },
        });
        if (inUse) throw new ConflictException('Stage offerings with delivery or student history cannot be removed');
        await tx.programStageOffering.deleteMany({
          where: { programOfferingId: id, programStageId: { notIn: dto.stages.map((stage) => stage.programStageId) } },
        });
        for (const stage of dto.stages) {
          await tx.programStageOffering.upsert({
            where: { programOfferingId_programStageId: { programOfferingId: id, programStageId: stage.programStageId } },
            create: {
              organizationId: orgId,
              programOfferingId: id,
              programStageId: stage.programStageId,
              status: stage.status,
              startsAt: stage.startsAt === undefined ? undefined : stage.startsAt ? new Date(stage.startsAt) : null,
              endsAt: stage.endsAt === undefined ? undefined : stage.endsAt ? new Date(stage.endsAt) : null,
              capacity: stage.capacity,
              createdById: actor.id,
            },
            update: {
              status: stage.status,
              startsAt: stage.startsAt ? new Date(stage.startsAt) : null,
              endsAt: stage.endsAt ? new Date(stage.endsAt) : null,
              capacity: stage.capacity,
            },
          });
        }
      }
      if (dto.locationIds) {
        await tx.programOfferingLocation.deleteMany({ where: { programOfferingId: id } });
        if (dto.locationIds.length) {
          await tx.programOfferingLocation.createMany({
            data: [...new Set(dto.locationIds)].map((providerLocationId, sortOrder) => ({
              programOfferingId: id,
              providerLocationId,
              sortOrder,
            })),
          });
        }
      }
      const feeData = this.feeData(dto.fees);
      if (feeData) {
        await tx.programOfferingFee.deleteMany({ where: { programOfferingId: id } });
        if (feeData.length) await tx.programOfferingFee.createMany({ data: feeData.map((fee) => ({ ...fee, programOfferingId: id })) });
      }
      const fundingData = this.fundingData(dto.fundingOptions);
      if (fundingData) {
        await tx.programOfferingFundingOption.deleteMany({ where: { programOfferingId: id } });
        if (fundingData.length) await tx.programOfferingFundingOption.createMany({ data: fundingData.map((option) => ({ ...option, programOfferingId: id })) });
      }
      const requirementData = this.requirementData(dto.admissionRequirements);
      if (requirementData) {
        await tx.programAdmissionRequirement.deleteMany({ where: { programOfferingId: id } });
        if (requirementData.length) await tx.programAdmissionRequirement.createMany({ data: requirementData.map((requirement) => ({ ...requirement, programOfferingId: id })) });
      }
      const updated = await tx.programOffering.update({
        where: { id },
        data: {
          status: dto.status,
          applicationOpensAt: dto.applicationOpensAt === undefined ? undefined : dto.applicationOpensAt ? new Date(dto.applicationOpensAt) : null,
          applicationClosesAt: dto.applicationClosesAt === undefined ? undefined : dto.applicationClosesAt ? new Date(dto.applicationClosesAt) : null,
          teachingStartsAt: dto.teachingStartsAt === undefined ? undefined : dto.teachingStartsAt ? new Date(dto.teachingStartsAt) : null,
          teachingEndsAt: dto.teachingEndsAt === undefined ? undefined : dto.teachingEndsAt ? new Date(dto.teachingEndsAt) : null,
          intakeName: dto.intakeName?.trim(),
          timezone: dto.timezone?.trim(),
          capacity: dto.capacity,
          waitlistEnabled: dto.waitlistEnabled,
          deliveryMode: dto.deliveryMode,
          attendanceMode: dto.attendanceMode,
          scheduleSummary: dto.scheduleSummary === undefined ? undefined : dto.scheduleSummary?.trim() || null,
          publicSummary: dto.publicSummary === undefined ? undefined : dto.publicSummary?.trim() || null,
          detailedInstructions: dto.detailedInstructions === undefined ? undefined : dto.detailedInstructions?.trim() || null,
          contactEmail: dto.contactEmail === undefined ? undefined : dto.contactEmail?.trim().toLowerCase() || null,
          supportedActions: dto.supportedActions,
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
          onlineAdmissionEnabled: dto.onlineAdmissionEnabled,
          onlineAdmissionInstructions: this.normalizeOnlineAdmissionInstructions(dto.onlineAdmissionInstructions),
        },
        include: OFFERING_INCLUDE,
      });
      if (dto.status && ([ProgramOfferingStatus.PUBLISHED, ProgramOfferingStatus.OPEN] as ProgramOfferingStatus[]).includes(dto.status)) {
        const version = await tx.programOfferingPublication.count({ where: { programOfferingId: id } });
        await tx.programOfferingPublication.create({
          data: {
            providerId: updated.providerId,
            programOfferingId: id,
            version: version + 1,
            snapshot: this.publicationSnapshot(updated),
            publishedById: actor.id,
          },
        });
        await tx.admissionsDomainEvent.create({
          data: {
            providerId: updated.providerId,
            programOfferingId: id,
            eventType: dto.status === ProgramOfferingStatus.OPEN ? 'admissions.offering.opened' : 'admissions.offering.published',
            payload: {
              offeringId: id,
              status: dto.status,
              version: version + 1,
              actorId: actor.id,
            },
          },
        });
      }
      return updated;
    });
  }

}
