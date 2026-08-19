import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  CurriculumStatus,
  Prisma,
  ProgramOfferingStatus,
  ProgramStageOfferingStatus,
  ProgramStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { assertDepartmentInScope, getDepartmentScope, type DepartmentScopedUser } from '../common/department-scope';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import {
  CreateProgramOfferingDto,
  OnlineAdmissionDocumentRequirementInputDto,
  ProgramStageOfferingInputDto,
  UpdateProgramOfferingDto,
} from './dto/program-offering.dto';
import {
  assertLifecycleTransition,
  PROGRAM_OFFERING_TRANSITIONS,
  PROGRAM_STAGE_OFFERING_TRANSITIONS,
} from '../common/offering-lifecycle';

type Actor = DepartmentScopedUser & { id: string };

const OFFERING_INCLUDE = {
  program: { include: { department: true } },
  curriculumVersion: true,
  academicCycle: true,
  stageOfferings: {
    orderBy: { programStage: { sequence: 'asc' as const } },
    include: {
      programStage: { include: { courseRequirements: { include: { course: true } } } },
      _count: { select: { cohortOfferings: true, sectionMappings: true, studentStageEnrollments: true } },
    },
  },
  onlineAdmissionDocumentRequirements: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
} satisfies Prisma.ProgramOfferingInclude;

@Injectable()
export class AdminProgramOfferingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(orgId: string, programId: string, curriculumVersionId: string, academicCycleId: string, actor: Actor) {
    const [program, curriculum, cycle] = await Promise.all([
      this.prisma.program.findFirst({ where: { id: programId, organizationId: orgId } }),
      this.prisma.curriculumVersion.findFirst({ where: { id: curriculumVersionId, organizationId: orgId, programId } }),
      this.prisma.academicCycle.findFirst({ where: { id: academicCycleId, organizationId: orgId } }),
    ]);
    if (!program) throw new NotFoundException('Program not found');
    if (!curriculum) throw new BadRequestException('Curriculum does not belong to the selected program');
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, program.departmentId, 'You cannot manage offerings outside your assigned departments');
    if (program.status === ProgramStatus.ARCHIVED) throw new ConflictException('Archived programs cannot be offered');
    if (curriculum.status === CurriculumStatus.RETIRED) throw new ConflictException('Retired curricula cannot create new offerings');
    if (cycle.status === AcademicCycleStatus.COMPLETED || cycle.status === AcademicCycleStatus.ARCHIVED) {
      throw new ConflictException('Completed or archived cycles cannot accept new offerings');
    }
    await assertAcademicCycleWritable(this.prisma, orgId, academicCycleId, 'SETUP');
    return { program, curriculum, cycle };
  }

  private async validateStages(orgId: string, curriculumVersionId: string, stages: ProgramStageOfferingInputDto[]) {
    const ids = stages.map((stage) => stage.programStageId);
    if (new Set(ids).size !== ids.length) throw new ConflictException('A stage can only be added once per offering');
    const count = await this.prisma.programStage.count({
      where: { id: { in: ids }, organizationId: orgId, curriculumVersionId },
    });
    if (count !== ids.length) throw new BadRequestException('One or more stages do not belong to the selected curriculum');
    for (const stage of stages) {
      if (stage.startsAt && stage.endsAt && new Date(stage.startsAt) >= new Date(stage.endsAt)) {
        throw new BadRequestException('A stage offering end date must be after its start date');
      }
    }
  }

  private normalizeOnlineAdmissionInstructions(value: string | null | undefined) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeDocumentRequirements(requirements: OnlineAdmissionDocumentRequirementInputDto[]) {
    const seenLabels = new Set<string>();
    return requirements.map((requirement, index) => {
      const label = requirement.label.trim();
      if (!label) throw new BadRequestException('Document requirement label is required');
      const key = label.toLowerCase();
      if (seenLabels.has(key)) throw new BadRequestException('Document requirement labels must be unique per offering');
      seenLabels.add(key);
      const acceptedMimeTypes = requirement.acceptedMimeTypes
        ?.map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      return {
        label,
        description: requirement.description?.trim() || null,
        isRequired: requirement.isRequired ?? true,
        sortOrder: requirement.sortOrder ?? index,
        acceptedMimeTypes: acceptedMimeTypes?.length ? acceptedMimeTypes : undefined,
        maxFileSizeBytes: requirement.maxFileSizeBytes ?? null,
      };
    });
  }

  private async scopedOffering(orgId: string, id: string, actor: Actor) {
    const offering = await this.prisma.programOffering.findFirst({
      where: { id, organizationId: orgId },
      include: { program: true, academicCycle: true },
    });
    if (!offering) throw new NotFoundException('Program offering not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, offering.program.departmentId, 'You cannot manage offerings outside your assigned departments');
    return offering;
  }

  async create(orgId: string, dto: CreateProgramOfferingDto, actor: Actor) {
    if (dto.status && dto.status !== ProgramOfferingStatus.DRAFT) {
      throw new ConflictException('New program offerings must start as DRAFT and pass readiness before opening');
    }
    if (dto.stages.some((stage) => stage.status && stage.status !== ProgramStageOfferingStatus.PLANNED)) {
      throw new ConflictException('New stage offerings must start as PLANNED');
    }
    await this.context(orgId, dto.programId, dto.curriculumVersionId, dto.academicCycleId, actor);
    await this.validateStages(orgId, dto.curriculumVersionId, dto.stages);
    if (dto.opensAt && dto.closesAt && new Date(dto.opensAt) >= new Date(dto.closesAt)) {
      throw new BadRequestException('Offering close date must be after its open date');
    }
    try {
      return await this.prisma.programOffering.create({
        data: {
          organizationId: orgId,
          programId: dto.programId,
          curriculumVersionId: dto.curriculumVersionId,
          academicCycleId: dto.academicCycleId,
          status: dto.status ?? ProgramOfferingStatus.DRAFT,
          opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
          capacity: dto.capacity,
          notes: dto.notes?.trim() || null,
          onlineAdmissionEnabled: dto.onlineAdmissionEnabled ?? false,
          onlineAdmissionInstructions: this.normalizeOnlineAdmissionInstructions(dto.onlineAdmissionInstructions),
          createdById: actor.id,
          stageOfferings: {
            create: dto.stages.map((stage) => ({
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
        throw new ConflictException('This program and curriculum are already offered in the selected cycle');
      }
      throw error;
    }
  }

  async list(orgId: string, actor: Actor, academicCycleId?: string, programId?: string) {
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    return this.prisma.programOffering.findMany({
      where: {
        organizationId: orgId,
        academicCycleId,
        programId,
        program: { departmentId: !scope.applies || scope.all ? undefined : { in: scope.departmentIds } },
      },
      orderBy: [{ academicCycle: { startDate: 'desc' } }, { program: { name: 'asc' } }],
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

    const blockers: Array<{ code: string; message: string }> = [];
    const warnings: Array<{ code: string; message: string; stageOfferingId?: string }> = [];
    if (!([ProgramStatus.ACTIVE, ProgramStatus.TEACH_OUT] as ProgramStatus[]).includes(offering.program.status)) {
      blockers.push({ code: 'PROGRAM_NOT_ACTIVE', message: 'Activate the program before opening this offering.' });
    }
    if (offering.curriculumVersion.status !== CurriculumStatus.ACTIVE) {
      blockers.push({ code: 'CURRICULUM_NOT_ACTIVE', message: 'The selected curriculum must be active.' });
    }
    if (!([AcademicCycleStatus.DRAFT, AcademicCycleStatus.ACTIVE] as AcademicCycleStatus[]).includes(offering.academicCycle.status)) {
      blockers.push({ code: 'CYCLE_NOT_WRITABLE', message: 'The academic cycle is no longer open for setup.' });
    }
    if (!offering.stageOfferings.length) {
      blockers.push({ code: 'NO_STAGES', message: 'Add at least one stage offering.' });
    }
    for (const stage of offering.stageOfferings) {
      if (!stage.programStage.isOptional && stage.programStage.courseRequirements.length === 0) {
        blockers.push({ code: 'STAGE_WITHOUT_REQUIREMENTS', message: `${stage.programStage.name} has no course requirements.` });
      }
      if (stage._count.sectionMappings === 0) {
        warnings.push({ code: 'STAGE_WITHOUT_SECTIONS', message: `${stage.programStage.name} has no mapped sections.`, stageOfferingId: stage.id });
      }
      if (stage._count.cohortOfferings === 0) {
        warnings.push({ code: 'STAGE_WITHOUT_COHORTS', message: `${stage.programStage.name} has no cohort offering.`, stageOfferingId: stage.id });
      }
    }
    return {
      offeringId: offering.id,
      readyForAdmissions: blockers.length === 0,
      readyForDelivery: blockers.length === 0 && warnings.every((warning) => warning.code !== 'STAGE_WITHOUT_SECTIONS'),
      blockers,
      warnings,
    };
  }

  async update(orgId: string, id: string, dto: UpdateProgramOfferingDto, actor: Actor) {
    const offering = await this.scopedOffering(orgId, id, actor);
    await assertAcademicCycleWritable(this.prisma, orgId, offering.academicCycleId, 'SETUP');
    assertLifecycleTransition(offering.status, dto.status, PROGRAM_OFFERING_TRANSITIONS, 'Program offering');
    const nextOpensAt = dto.opensAt === undefined ? offering.opensAt : dto.opensAt ? new Date(dto.opensAt) : null;
    const nextClosesAt = dto.closesAt === undefined ? offering.closesAt : dto.closesAt ? new Date(dto.closesAt) : null;
    if (nextOpensAt && nextClosesAt && nextOpensAt >= nextClosesAt) {
      throw new BadRequestException('Offering close date must be after its open date');
    }
    if (dto.status === ProgramOfferingStatus.OPEN) {
      const readiness = await this.readiness(orgId, id, actor);
      if (!readiness.readyForAdmissions) {
        throw new ConflictException(readiness.blockers.map((blocker) => blocker.message).join(' '));
      }
    }
    if (dto.stages) await this.validateStages(orgId, offering.curriculumVersionId, dto.stages);
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
      return tx.programOffering.update({
        where: { id },
        data: {
          status: dto.status,
          opensAt: dto.opensAt === undefined ? undefined : dto.opensAt ? new Date(dto.opensAt) : null,
          closesAt: dto.closesAt === undefined ? undefined : dto.closesAt ? new Date(dto.closesAt) : null,
          capacity: dto.capacity,
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
          onlineAdmissionEnabled: dto.onlineAdmissionEnabled,
          onlineAdmissionInstructions: this.normalizeOnlineAdmissionInstructions(dto.onlineAdmissionInstructions),
        },
        include: OFFERING_INCLUDE,
      });
    });
  }

  async listOnlineAdmissionRequirements(orgId: string, offeringId: string, actor: Actor) {
    await this.scopedOffering(orgId, offeringId, actor);
    return this.prisma.onlineAdmissionDocumentRequirement.findMany({
      where: { organizationId: orgId, programOfferingId: offeringId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async replaceOnlineAdmissionRequirements(
    orgId: string,
    offeringId: string,
    requirements: OnlineAdmissionDocumentRequirementInputDto[],
    actor: Actor,
  ) {
    await this.scopedOffering(orgId, offeringId, actor);
    const normalized = this.normalizeDocumentRequirements(requirements);
    const submissionCount = await this.prisma.onlineAdmissionSubmission.count({
      where: { organizationId: orgId, programOfferingId: offeringId },
    });
    if (submissionCount) {
      throw new ConflictException(
        'Document requirements cannot be changed after applications have been submitted for this offering',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.onlineAdmissionDocumentRequirement.deleteMany({
        where: { organizationId: orgId, programOfferingId: offeringId },
      });
      if (normalized.length) {
        await tx.onlineAdmissionDocumentRequirement.createMany({
          data: normalized.map((requirement) => ({
            organizationId: orgId,
            programOfferingId: offeringId,
            ...requirement,
          })),
        });
      }
      return tx.onlineAdmissionDocumentRequirement.findMany({
        where: { organizationId: orgId, programOfferingId: offeringId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  }
}
