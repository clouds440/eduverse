import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  CurriculumStatus,
  ProgramStageOfferingStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { ProgramStageOfferingInputDto } from './dto/program-offering.dto';

@Injectable()
export class CampusProgramOfferingBindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateContext(organizationId: string, programId: string, curriculumVersionId: string, academicCycleId: string) {
    const [curriculum, cycle] = await Promise.all([
      this.prisma.curriculumVersion.findFirst({ where: { id: curriculumVersionId, organizationId, programId } }),
      this.prisma.academicCycle.findFirst({ where: { id: academicCycleId, organizationId } }),
    ]);
    if (!curriculum) throw new BadRequestException('Curriculum does not belong to the selected program');
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    if (curriculum.status === CurriculumStatus.RETIRED || curriculum.status === CurriculumStatus.ARCHIVED) {
      throw new ConflictException('Retired or archived curricula cannot create new offerings');
    }
    if (cycle.status === AcademicCycleStatus.COMPLETED || cycle.status === AcademicCycleStatus.ARCHIVED) {
      throw new ConflictException('Completed or archived cycles cannot accept new offerings');
    }
    await assertAcademicCycleWritable(this.prisma, organizationId, academicCycleId, 'SETUP');
    return { curriculum, cycle };
  }

  async validateStages(organizationId: string, curriculumVersionId: string, stages: ProgramStageOfferingInputDto[]) {
    const ids = stages.map((stage) => stage.programStageId);
    if (new Set(ids).size !== ids.length) throw new ConflictException('A stage can only be added once per offering');
    const count = await this.prisma.programStage.count({
      where: { id: { in: ids }, organizationId, curriculumVersionId },
    });
    if (count !== ids.length) throw new BadRequestException('One or more stages do not belong to the selected curriculum');
    for (const stage of stages) {
      if (stage.startsAt && stage.endsAt && new Date(stage.startsAt) >= new Date(stage.endsAt)) {
        throw new BadRequestException('A stage offering end date must be after its start date');
      }
    }
  }

  deliveryReadiness(offering: {
    campusBinding: {
      curriculumVersion: { status: CurriculumStatus };
      academicCycle: { status: AcademicCycleStatus };
    } | null;
    stageOfferings: Array<{
      id: string;
      programStage: { name: string; isOptional: boolean; courseRequirements: unknown[] };
      _count: { cohortOfferings: number; sectionMappings: number };
    }>;
  }) {
    const blockers: Array<{ code: string; message: string }> = [];
    const warnings: Array<{ code: string; message: string; stageOfferingId?: string }> = [];
    if (!offering.campusBinding) {
      blockers.push({ code: 'CAMPUS_BINDING_REQUIRED', message: 'Bind this offering to a Campus curriculum and academic cycle.' });
      return { ready: false, blockers, warnings };
    }
    if (offering.campusBinding.curriculumVersion.status !== CurriculumStatus.ACTIVE) {
      blockers.push({ code: 'CURRICULUM_NOT_ACTIVE', message: 'The selected curriculum must be active.' });
    }
    if (!([AcademicCycleStatus.DRAFT, AcademicCycleStatus.ACTIVE] as AcademicCycleStatus[]).includes(offering.campusBinding.academicCycle.status)) {
      blockers.push({ code: 'CYCLE_NOT_WRITABLE', message: 'The academic cycle is no longer open for setup.' });
    }
    if (!offering.stageOfferings.length) blockers.push({ code: 'NO_STAGES', message: 'Add at least one stage offering.' });
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
      ready: blockers.length === 0 && warnings.every((warning) => warning.code !== 'STAGE_WITHOUT_SECTIONS'),
      blockers,
      warnings,
    };
  }

  assertNewStages(stages: ProgramStageOfferingInputDto[]) {
    if (stages.some((stage) => stage.status && stage.status !== ProgramStageOfferingStatus.PLANNED)) {
      throw new ConflictException('New stage offerings must start as PLANNED');
    }
  }
}
