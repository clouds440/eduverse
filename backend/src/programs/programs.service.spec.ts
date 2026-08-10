import { ConflictException } from '@nestjs/common';
import {
  CourseRequirementType,
  ProgramCompletionMode,
  ProgramProgressionMode,
  ProgramStatus,
  ProgramStructureType,
} from '@/prisma/prisma-client';
import { ProgramsService } from './programs.service';

const actor = { id: 'admin-1', role: 'ORG_ADMIN' };

function dto() {
  return {
    name: 'Computer Science',
    code: 'bscs',
    departmentId: 'department-1',
    structureType: ProgramStructureType.TERM_BASED,
    progressionMode: ProgramProgressionMode.SEQUENTIAL,
    completionMode: ProgramCompletionMode.REQUIREMENTS,
    curriculumName: 'BSCS Core',
    curriculumCode: 'BSCS-CORE',
    stages: [
      {
        name: 'Semester 1',
        code: 'SEM-1',
        courseRequirements: [{ courseId: 'course-1', requirementType: CourseRequirementType.REQUIRED }],
      },
      {
        name: 'Semester 2',
        code: 'SEM-2',
        courseRequirements: [{ courseId: 'course-2', requirementType: CourseRequirementType.REQUIRED }],
      },
    ],
  };
}

function harness() {
  const program = {
    id: 'program-1',
    organizationId: 'org-1',
    departmentId: 'department-1',
    name: 'Computer Science',
    code: 'BSCS',
    status: ProgramStatus.DRAFT,
    configurationVersion: 1,
  };
  const tx = {
    program: { create: jest.fn().mockResolvedValue(program), updateMany: jest.fn() },
    course: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'course-1', creditHours: 3 },
        { id: 'course-2', creditHours: 3 },
      ]),
    },
    programConfigurationRevision: { create: jest.fn().mockResolvedValue({ id: 'revision-1' }) },
    curriculumVersion: { create: jest.fn().mockResolvedValue({ id: 'curriculum-1' }) },
    programStage: { create: jest.fn(async ({ data }) => ({ id: `stage-${data.sequence}`, ...data })) },
    stageCourseRequirement: { create: jest.fn() },
  };
  const prisma = {
    department: { findFirst: jest.fn().mockResolvedValue({ id: 'department-1', isActive: true }) },
    program: { findFirst: jest.fn().mockResolvedValue(null) },
    curriculumVersion: { findFirst: jest.fn() },
    $transaction: jest.fn((operation) => operation(tx)),
  };
  const activity = { record: jest.fn() };
  const service = new ProgramsService(prisma as never, {} as never, activity as never);
  jest.spyOn(service, 'get').mockResolvedValue(program as never);
  return { service, prisma, tx, activity };
}

describe('ProgramsService stable curriculum structure', () => {
  it('creates stages without creating or requiring academic cycles', async () => {
    const { service, tx, activity } = harness();
    await service.create('org-1', dto(), actor);

    expect(tx.program.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ requiredCycleCount: expect.anything() }),
    }));
    expect(tx.programConfigurationRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ configurationSnapshot: expect.objectContaining({ stages: expect.any(Array) }) }),
    }));
    expect(tx.programStage.create).toHaveBeenCalledTimes(2);
    expect(tx.stageCourseRequirement.create).toHaveBeenCalledTimes(2);
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'program_created' }));
  });

  it('rejects duplicate stable stage codes', async () => {
    const { service } = harness();
    const input = dto();
    input.stages[1].code = 'sem-1';
    await expect(service.create('org-1', input, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks activation until an active default curriculum exists', async () => {
    const { service, prisma } = harness();
    (service as any).scopedProgram = jest.fn().mockResolvedValue({
      id: 'program-1',
      name: 'Computer Science',
      status: ProgramStatus.DRAFT,
    });
    prisma.curriculumVersion.findFirst.mockResolvedValue(null);
    await expect(service.transitionProgram('org-1', 'program-1', ProgramStatus.ACTIVE, undefined, actor))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
