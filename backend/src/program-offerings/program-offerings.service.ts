import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  CurriculumStatus,
  OrgStatus,
  ProgramAcademicCycleStatus,
  ProgramStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

const ELIGIBLE_ENTRY_CYCLE_STATUSES = new Set<AcademicCycleStatus>([
  AcademicCycleStatus.DRAFT,
  AcademicCycleStatus.ACTIVE,
]);

@Injectable()
export class ProgramOfferingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationSlug: string) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: organizationSlug.toLowerCase(),
        status: OrgStatus.APPROVED,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        programs: {
          where: {
            status: ProgramStatus.ACTIVE,
            isVisibleForAdmissions: true,
            department: { isActive: true },
          },
          orderBy: [{ admissionsSortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            code: true,
            admissionsLabel: true,
            admissionsDescription: true,
            requiredCycleCount: true,
            configurationVersion: true,
            structureType: true,
            durationValue: true,
            durationUnit: true,
            department: { select: { id: true, name: true, code: true } },
            configurationRevisions: {
              orderBy: { version: 'desc' },
              select: { id: true, version: true, requiredCycleCount: true },
            },
            academicCycles: {
              where: { status: ProgramAcademicCycleStatus.ACTIVE, isRequired: true },
              orderBy: { sequence: 'asc' },
              select: {
                id: true,
                sequence: true,
                academicCycle: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    startDate: true,
                    endDate: true,
                    status: true,
                  },
                },
              },
            },
            curriculumVersions: {
              where: {
                status: CurriculumStatus.ACTIVE,
                isDefaultForAdmissions: true,
              },
              select: {
                id: true,
                name: true,
                code: true,
                programConfigurationRevisionId: true,
                stages: {
                  select: {
                    id: true,
                    sequence: true,
                    programAcademicCycleId: true,
                    isOptional: true,
                    _count: { select: { courseRequirements: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const offerings = organization.programs.flatMap((program) => {
      const revision = program.configurationRevisions.find(
        (row) => row.version === program.configurationVersion,
      );
      const curriculum = program.curriculumVersions.find(
        (row) => row.programConfigurationRevisionId === revision?.id,
      );
      const associationIds = new Set(program.academicCycles.map((row) => row.id));
      const stageAssociationIds = new Set(curriculum?.stages.map((row) => row.programAcademicCycleId));
      const structurallyComplete = Boolean(
        revision
        && revision.requiredCycleCount === program.requiredCycleCount
        && program.requiredCycleCount > 0
        && program.academicCycles.length === program.requiredCycleCount
        && new Set(program.academicCycles.map((row) => row.sequence)).size === program.requiredCycleCount
        && program.academicCycles.every((row, index) => row.sequence === index + 1)
        && curriculum
        && curriculum.stages.length === program.requiredCycleCount
        && stageAssociationIds.size === associationIds.size
        && [...associationIds].every((id) => stageAssociationIds.has(id))
        && curriculum.stages.every((stage) => stage.isOptional || stage._count.courseRequirements > 0),
      );
      if (!structurallyComplete || !revision || !curriculum) return [];

      const seenCycles = new Set<string>();
      const eligibleEntryCycles = program.academicCycles.flatMap((association) => {
        if (
          seenCycles.has(association.academicCycle.id)
          || !ELIGIBLE_ENTRY_CYCLE_STATUSES.has(association.academicCycle.status)
        ) return [];
        seenCycles.add(association.academicCycle.id);
        return [{
          programAcademicCycleId: association.id,
          sequence: association.sequence,
          academicCycle: association.academicCycle,
        }];
      });

      return [{
        programId: program.id,
        name: program.admissionsLabel || program.name,
        code: program.code,
        description: program.admissionsDescription,
        department: program.department,
        requiredCycleCount: program.requiredCycleCount,
        structureType: program.structureType,
        duration: program.durationValue && program.durationUnit
          ? { value: program.durationValue, unit: program.durationUnit }
          : null,
        curriculum: { id: curriculum.id, name: curriculum.name, code: curriculum.code },
        programConfigurationRevision: { id: revision.id, version: revision.version },
        eligibleEntryCycles,
      }];
    });

    return {
      organization: {
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
      },
      offerings,
    };
  }
}
