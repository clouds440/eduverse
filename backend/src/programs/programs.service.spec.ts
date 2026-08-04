import { ConflictException } from '@nestjs/common';
import {
  AcademicCycleStatus,
  CourseRequirementType,
  ProgramCompletionMode,
  ProgramProgressionMode,
  ProgramStatus,
  ProgramStructureType,
} from '@/prisma/prisma-client';
import { ProgramsService } from './programs.service';
import { ProgramCycleInputKind } from './dto/program.dto';

const actor = { id: 'admin-1', role: 'ORG_ADMIN' };

function baseProgram(overrides: Record<string, unknown> = {}) {
  return {
    id: 'program-1',
    organizationId: 'org-1',
    departmentId: 'department-1',
    name: 'Computer Science',
    code: 'BSCS',
    status: ProgramStatus.DRAFT,
    configurationVersion: 1,
    requiredCycleCount: 2,
    isVisibleForAdmissions: false,
    ...overrides,
  };
}

function createHarness() {
  const tx = {
    program: {
      create: jest.fn().mockResolvedValue(baseProgram()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(baseProgram({ configurationVersion: 2 })),
      update: jest.fn().mockResolvedValue(baseProgram()),
    },
    academicCycle: {
      findFirst: jest.fn(async ({ where }) => {
        if (where.id === 'cycle-existing') {
          return { id: 'cycle-existing', name: 'Fall 2026', code: 'FALL-2026', status: AcademicCycleStatus.DRAFT };
        }
        return null;
      }),
      create: jest.fn().mockResolvedValue({ id: 'cycle-new', name: 'Spring 2027', code: 'SPRING-2027', status: AcademicCycleStatus.DRAFT }),
    },
    programAcademicCycle: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn(async ({ create }) => ({
        id: `association-${create.sequence}`,
        ...create,
        academicCycle: create.academicCycleId === 'cycle-existing'
          ? { id: 'cycle-existing', name: 'Fall 2026', code: 'FALL-2026' }
          : { id: 'cycle-new', name: 'Spring 2027', code: 'SPRING-2027' },
      })),
    },
    programConfigurationRevision: {
      create: jest.fn().mockResolvedValue({ id: 'revision-1', version: 1 }),
      findUnique: jest.fn(),
    },
    curriculumVersion: {
      create: jest.fn().mockResolvedValue({ id: 'curriculum-1' }),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    course: {
      findMany: jest.fn(async ({ where }) => where.id.in.map((id: string) => ({
        id,
        creditHours: 3,
        departmentId: 'department-1',
      }))),
    },
    programStage: {
      create: jest.fn(async ({ data }) => ({ id: `stage-${data.sequence}`, ...data })),
    },
    stageCourseRequirement: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    department: { findFirst: jest.fn().mockResolvedValue({ id: 'department-1', isActive: true }) },
    program: {
      findFirst: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(baseProgram()),
    },
    gpaPolicy: { findFirst: jest.fn() },
    $transaction: jest.fn(async (operation: (client: unknown) => unknown) => operation(tx)),
  };
  const gpaService = {
    getDefaultPolicy: jest.fn().mockResolvedValue({ id: 'gpa-1' }),
    snapshotPolicy: jest.fn().mockReturnValue({ policyId: 'gpa-1', name: 'Standard' }),
  };
  const activity = { record: jest.fn().mockResolvedValue({}) };
  const service = new ProgramsService(prisma as never, gpaService as never, activity as never);
  jest.spyOn(service, 'get').mockResolvedValue(baseProgram() as never);
  return { service, prisma, tx, activity };
}

function createDto() {
  return {
    name: 'Computer Science',
    code: 'bscs',
    departmentId: 'department-1',
    structureType: ProgramStructureType.TERM_BASED,
    progressionMode: ProgramProgressionMode.SEQUENTIAL,
    completionMode: ProgramCompletionMode.REQUIREMENTS,
    curriculumName: 'BSCS 2026',
    curriculumCode: 'BSCS-2026',
    cycles: [
      {
        kind: ProgramCycleInputKind.EXISTING,
        academicCycleId: 'cycle-existing',
        stage: {
          name: 'Semester 1',
          code: 'SEM-1',
          courseRequirements: [{ courseId: 'course-1', requirementType: CourseRequirementType.REQUIRED }],
        },
      },
      {
        kind: ProgramCycleInputKind.NEW,
        name: 'Spring 2027',
        code: 'SPRING-2027',
        startDate: '2027-01-01',
        endDate: '2027-05-31',
        stage: {
          name: 'Semester 2',
          code: 'SEM-2',
          courseRequirements: [{ courseId: 'course-2', requirementType: CourseRequirementType.REQUIRED }],
        },
      },
    ],
  };
}

describe('ProgramsService', () => {
  it('creates mixed shared/new cycles and scaffolds the complete draft structure atomically', async () => {
    const { service, tx, activity } = createHarness();

    await service.create('org-1', createDto(), actor);

    expect(tx.program.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ code: 'BSCS', requiredCycleCount: 2, departmentId: 'department-1' }),
    }));
    expect(tx.academicCycle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ code: 'SPRING-2027', status: AcademicCycleStatus.DRAFT }),
    }));
    expect(tx.programAcademicCycle.upsert).toHaveBeenCalledTimes(2);
    expect(tx.programConfigurationRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 1, requiredCycleCount: 2, checksum: expect.any(String) }),
    }));
    expect(tx.programStage.create).toHaveBeenCalledTimes(2);
    expect(tx.stageCourseRequirement.create).toHaveBeenCalledTimes(2);
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'program_created' }));
  });

  it('rejects duplicate cycle selections before opening a transaction', async () => {
    const { service, prisma } = createHarness();
    const dto = createDto();
    dto.cycles[1] = { ...dto.cycles[0], stage: { ...dto.cycles[0].stage, code: 'SEM-2' } } as never;

    await expect(service.create('org-1', dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns a row-level conflict when an inline institute cycle already exists', async () => {
    const { service, tx } = createHarness();
    tx.academicCycle.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === 'cycle-existing') return { id: 'cycle-existing', name: 'Fall 2026', code: 'FALL-2026' };
      if (where.code) return { id: 'existing-spring', name: 'Spring 2027', code: 'SPRING-2027', status: AcademicCycleStatus.DRAFT };
      return null;
    });

    await expect(service.create('org-1', createDto(), actor)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INLINE_CYCLE_EXISTS', rowIndex: 1 }),
    });
  });

  it('rejects stale cycle-array edits using the configuration version claim', async () => {
    const { service, tx } = createHarness();
    jest.spyOn(service, 'get').mockResolvedValue(baseProgram() as never);
    tx.program.updateMany.mockResolvedValue({ count: 0 });
    const dto = createDto();

    await expect(service.replaceCycles('org-1', 'program-1', {
      configurationVersion: 1,
      changeReason: 'Reordered stages',
      curriculumName: dto.curriculumName,
      curriculumCode: 'BSCS-2026-R2',
      cycles: dto.cycles,
    }, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks program activation until a current default curriculum is active', async () => {
    const { service, tx } = createHarness();
    jest.spyOn(service, 'get').mockResolvedValue(baseProgram() as never);
    tx.programConfigurationRevision.findUnique.mockResolvedValue({ id: 'revision-1' });
    tx.curriculumVersion.findFirst.mockResolvedValue(null);

    await expect(
      service.transitionProgram('org-1', 'program-1', ProgramStatus.ACTIVE, undefined, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.program.update).not.toHaveBeenCalled();
  });
});
