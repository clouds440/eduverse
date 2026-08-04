import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CurriculumStatus,
  ProgramAcademicCycleStatus,
  ProgramStatus,
  StudentProgramCycleStatus,
  StudentProgramEnrollmentStatus,
} from '@/prisma/prisma-client';
import { StudentProgramEnrollmentsService } from './student-program-enrollments.service';

function admissionProgram() {
  const associations = [1, 2].map((sequence) => ({
    id: `association-${sequence}`,
    academicCycleId: `cycle-${sequence}`,
    sequence,
    isRequired: true,
    status: ProgramAcademicCycleStatus.ACTIVE,
    academicCycle: {
      id: `cycle-${sequence}`,
      name: sequence === 1 ? 'Fall 2026' : 'Spring 2027',
      code: sequence === 1 ? 'FALL-2026' : 'SPRING-2027',
      startDate: new Date(`202${sequence + 5}-01-01`),
      endDate: new Date(`202${sequence + 5}-05-31`),
    },
  }));
  return {
    id: 'program-1',
    organizationId: 'org-1',
    departmentId: 'department-1',
    status: ProgramStatus.ACTIVE,
    configurationVersion: 3,
    requiredCycleCount: 2,
    department: { id: 'department-1' },
    configurationRevisions: [{ id: 'revision-3', version: 3, checksum: 'frozen-plan-checksum' }],
    curriculumVersions: [{
      id: 'curriculum-3',
      status: CurriculumStatus.ACTIVE,
      isDefaultForAdmissions: true,
      programConfigurationRevisionId: 'revision-3',
      stages: associations.map((association) => ({
        id: `stage-${association.sequence}`,
        name: `Semester ${association.sequence}`,
        code: `SEM-${association.sequence}`,
        programAcademicCycleId: association.id,
      })),
    }],
    academicCycles: associations,
  };
}

function createHarness() {
  const tx = {
    student: {
      findFirst: jest.fn().mockResolvedValue({ id: 'student-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    program: { findFirst: jest.fn().mockResolvedValue(admissionProgram()) },
    academicCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status: 'ACTIVE' }) },
    studentProgramEnrollment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => ({ id: 'enrollment-1', ...data, program: admissionProgram() })),
      update: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
    },
    studentProgramEnrollmentCycle: {
      update: jest.fn().mockResolvedValue({ id: 'plan-1' }),
    },
    studentStageAttempt: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
      count: jest.fn().mockResolvedValue(0),
    },
    cohort: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: (client: unknown) => unknown) => operation(tx)),
  };
  return {
    service: new StudentProgramEnrollmentsService(prisma as never),
    prisma,
    tx,
  };
}

describe('StudentProgramEnrollmentsService', () => {
  it('snapshots the complete ordered program plan at admission', async () => {
    const { service, tx } = createHarness();

    await service.admitInTransaction(
      tx as never,
      'org-1',
      'student-1',
      { programId: 'program-1' },
      'admin-1',
    );

    expect(tx.studentProgramEnrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        openSlot: 'student:student-1',
        requiredCycleCountSnapshot: 2,
        programConfigurationVersionSnapshot: 3,
        programCyclePlanSnapshotHash: 'frozen-plan-checksum',
        cycles: {
          create: [
            expect.objectContaining({ sequenceSnapshot: 1, cycleCodeSnapshot: 'FALL-2026', stageCodeSnapshot: 'SEM-1' }),
            expect.objectContaining({ sequenceSnapshot: 2, cycleCodeSnapshot: 'SPRING-2027', stageCodeSnapshot: 'SEM-2' }),
          ],
        },
      }),
    }));
  });

  it('rejects a second open major before reading a new program plan', async () => {
    const { service, tx } = createHarness();
    tx.studentProgramEnrollment.findFirst.mockResolvedValue({ id: 'existing-major' });

    await expect(service.admitInTransaction(
      tx as never,
      'org-1',
      'student-1',
      { programId: 'program-1' },
      'admin-1',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(tx.program.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a mapped section when the student major does not contain its stage', async () => {
    const { service, tx } = createHarness();
    tx.studentProgramEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      cycles: [{
        id: 'plan-1',
        academicCycleId: 'cycle-1',
        programAcademicCycleId: 'association-1',
        programStageId: 'stage-1',
        status: StudentProgramCycleStatus.IN_PROGRESS,
      }],
    });

    await expect(service.ensureMappedSectionEnrollment(
      tx as never,
      'org-1',
      'student-1',
      {
        academicCycleId: 'cycle-1',
        cohort: null,
        requirementMappings: [{
          programAcademicCycleId: 'association-2',
          stageCourseRequirement: { programStageId: 'stage-2' },
        }],
      },
      'admin-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a repeat cohort outside the exact snapshotted cycle and stage', async () => {
    const { service, tx } = createHarness();
    tx.studentProgramEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      status: StudentProgramEnrollmentStatus.ACTIVE,
      cycles: [{
        id: 'plan-1',
        organizationId: 'org-1',
        academicCycleId: 'cycle-1',
        programAcademicCycleId: 'association-1',
        programStageId: 'stage-1',
        cohortId: null,
        status: StudentProgramCycleStatus.COMPLETED,
      }],
    });
    tx.cohort.findFirst.mockResolvedValue(null);

    await expect(service.repeatCycle(
      'org-1',
      'student-1',
      'enrollment-1',
      'plan-1',
      { reason: 'Repeat approved', cohortId: 'wrong-cohort' },
      'admin-1',
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an explicitly skipped required stage to satisfy frozen-plan completion', async () => {
    const { service, tx } = createHarness();
    tx.studentProgramEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      status: StudentProgramEnrollmentStatus.ACTIVE,
      requiredCycleCountSnapshot: 2,
      cycles: [
        { id: 'plan-1', isRequiredSnapshot: true, status: StudentProgramCycleStatus.COMPLETED },
        { id: 'plan-2', isRequiredSnapshot: true, status: StudentProgramCycleStatus.SKIPPED },
      ],
    });

    await service.completeProgram(
      'org-1',
      'student-1',
      'enrollment-1',
      { reason: 'Requirements approved' },
      'admin-1',
    );

    expect(tx.studentProgramEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: StudentProgramEnrollmentStatus.COMPLETED,
        openSlot: null,
      }),
    }));
  });
});
