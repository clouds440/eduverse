import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  CurriculumStatus,
  OrgStatus,
  ProgramOfferingStatus,
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
            configurationVersion: true,
            structureType: true,
            durationValue: true,
            durationUnit: true,
            department: { select: { id: true, name: true, code: true } },
            configurationRevisions: {
              orderBy: { version: 'desc' },
              select: { id: true, version: true },
            },
            offerings: {
              where: { status: ProgramOfferingStatus.OPEN },
              orderBy: { academicCycle: { startDate: 'asc' } },
              select: {
                id: true,
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
      const structurallyComplete = Boolean(
        revision
        && curriculum
        && curriculum.stages.length > 0
        && curriculum.stages.every((stage) => stage.isOptional || stage._count.courseRequirements > 0),
      );
      if (!structurallyComplete || !revision || !curriculum) return [];

      const seenCycles = new Set<string>();
      const eligibleEntryCycles = program.offerings.flatMap((association) => {
        if (
          seenCycles.has(association.academicCycle.id)
          || !ELIGIBLE_ENTRY_CYCLE_STATUSES.has(association.academicCycle.status)
        ) return [];
        seenCycles.add(association.academicCycle.id);
        return [{
          programOfferingId: association.id,
          academicCycle: association.academicCycle,
        }];
      });

      return [{
        programId: program.id,
        name: program.admissionsLabel || program.name,
        code: program.code,
        description: program.admissionsDescription,
        department: program.department,
        requiredStageCount: curriculum.stages.length,
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
