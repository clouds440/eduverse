import { BadRequestException, ConflictException } from '@nestjs/common';
import { ProgramClassificationStatus } from '@/prisma/prisma-client';
import { CohortsService } from '../cohorts/cohorts.service';
import { SectionsService } from '../sections/sections.service';

function currentStage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stage-1',
    programAcademicCycleId: 'association-1',
    curriculumVersion: {
      status: 'ACTIVE',
      programConfigurationRevision: { version: 4 },
    },
    programAcademicCycle: {
      id: 'association-1',
      program: { id: 'program-1', configurationVersion: 4 },
    },
    ...overrides,
  };
}

describe('program delivery mapping invariants', () => {
  it('keeps standalone cohorts free of program relationship fields', async () => {
    const service = new CohortsService({} as never, {} as never);

    await expect((service as any).validateProgramPlacement(
      {},
      'org-1',
      'cycle-1',
      ProgramClassificationStatus.STANDALONE,
      'association-1',
      'stage-1',
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires both association and stage for a mapped cohort', async () => {
    const service = new CohortsService({} as never, {} as never);

    await expect((service as any).validateProgramPlacement(
      {},
      'org-1',
      'cycle-1',
      ProgramClassificationStatus.PROGRAM_MAPPED,
      'association-1',
      null,
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queries the exact organization, shared cycle, association, and stage', async () => {
    const client = { programStage: { findFirst: jest.fn().mockResolvedValue(currentStage()) } };
    const service = new CohortsService({} as never, {} as never);

    await (service as any).validateProgramPlacement(
      client,
      'org-1',
      'cycle-1',
      ProgramClassificationStatus.PROGRAM_MAPPED,
      'association-1',
      'stage-1',
    );

    expect(client.programStage.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'stage-1',
        organizationId: 'org-1',
        programAcademicCycleId: 'association-1',
        programAcademicCycle: expect.objectContaining({ academicCycleId: 'cycle-1', organizationId: 'org-1' }),
      }),
    }));
  });

  it('rejects a stage from an obsolete program configuration', async () => {
    const client = {
      programStage: {
        findFirst: jest.fn().mockResolvedValue(currentStage({
          curriculumVersion: { status: 'ACTIVE', programConfigurationRevision: { version: 3 } },
        })),
      },
    };
    const service = new CohortsService({} as never, {} as never);

    await expect((service as any).validateProgramPlacement(
      client,
      'org-1',
      'cycle-1',
      ProgramClassificationStatus.PROGRAM_MAPPED,
      'association-1',
      'stage-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps standalone sections free of curriculum requirement mappings', async () => {
    const service = new SectionsService({} as never, {} as never);

    await expect((service as any).validateRequirementMappings({}, 'org-1', {
      classification: ProgramClassificationStatus.STANDALONE,
      academicCycleId: 'cycle-1',
      courseId: 'course-1',
      requirementIds: ['requirement-1'],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one curriculum requirement for mapped sections', async () => {
    const service = new SectionsService({} as never, {} as never);

    await expect((service as any).validateRequirementMappings({}, 'org-1', {
      classification: ProgramClassificationStatus.PROGRAM_MAPPED,
      academicCycleId: 'cycle-1',
      courseId: 'course-1',
      requirementIds: [],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects requirements spanning multiple program-cycle associations', async () => {
    const client = {
      stageCourseRequirement: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'requirement-1', programStage: currentStage() },
          {
            id: 'requirement-2',
            programStage: currentStage({
              id: 'stage-2',
              programAcademicCycleId: 'association-2',
              programAcademicCycle: { id: 'association-2', program: { id: 'program-2', configurationVersion: 4 } },
            }),
          },
        ]),
      },
    };
    const service = new SectionsService({} as never, {} as never);

    await expect((service as any).validateRequirementMappings(client, 'org-1', {
      classification: ProgramClassificationStatus.PROGRAM_MAPPED,
      academicCycleId: 'cycle-1',
      courseId: 'course-1',
      requirementIds: ['requirement-1', 'requirement-2'],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts deduplicated current requirements from one exact association', async () => {
    const client = {
      stageCourseRequirement: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'requirement-1', programStage: currentStage() },
        ]),
      },
    };
    const service = new SectionsService({} as never, {} as never);

    await expect((service as any).validateRequirementMappings(client, 'org-1', {
      classification: ProgramClassificationStatus.PROGRAM_MAPPED,
      academicCycleId: 'cycle-1',
      courseId: 'course-1',
      requirementIds: ['requirement-1', 'requirement-1'],
    })).resolves.toEqual({
      requirementIds: ['requirement-1'],
      programAcademicCycleId: 'association-1',
    });
  });
});
