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
        campusProgramConfigurations: {
          where: { program: { status: ProgramStatus.ACTIVE } },
          orderBy: { program: { name: 'asc' } },
          select: {
            configurationVersion: true,
            structureType: true,
            department: { select: { id: true, name: true, code: true } },
            program: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
                durationValue: true,
                durationUnit: true,
                configurationRevisions: {
                  orderBy: { version: 'desc' },
                  select: { id: true, version: true },
                },
                offerings: {
                  where: { status: ProgramOfferingStatus.OPEN, campusBinding: { isNot: null } },
                  orderBy: { campusBinding: { academicCycle: { startDate: 'asc' } } },
                  select: {
                    id: true,
                    campusBinding: {
                      select: {
                        academicCycle: {
                          select: { id: true, name: true, code: true, startDate: true, endDate: true, status: true },
                        },
                      },
                    },
                  },
                },
                curriculumVersions: {
                  where: { status: CurriculumStatus.ACTIVE, isDefaultForAdmissions: true },
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
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const offerings = organization.campusProgramConfigurations.flatMap((configuration) => {
      const program = configuration.program;
      const revision = program.configurationRevisions.find(
        (row) => row.version === configuration.configurationVersion,
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
          !association.campusBinding
          || seenCycles.has(association.campusBinding.academicCycle.id)
          || !ELIGIBLE_ENTRY_CYCLE_STATUSES.has(association.campusBinding.academicCycle.status)
        ) return [];
        seenCycles.add(association.campusBinding.academicCycle.id);
        return [{
          programOfferingId: association.id,
          academicCycle: association.campusBinding.academicCycle,
        }];
      });

      return [{
        programId: program.id,
        name: program.name,
        code: program.code,
        description: program.description,
        department: configuration.department,
        requiredStageCount: curriculum.stages.length,
        structureType: configuration.structureType,
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
