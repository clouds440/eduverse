import { ConflictException } from '@nestjs/common';
import {
  CurriculumStatus,
  ProgramStatus,
  StudentProgramEnrollmentStatus,
  StudentStageEnrollmentStatus,
} from '@/prisma/prisma-client';
import { StudentProgramEnrollmentsService } from './student-program-enrollments.service';

function admissionProgram() {
  return {
    id: 'program-1',
    status: ProgramStatus.ACTIVE,
    campusConfiguration: {
      organizationId: 'org-1',
      departmentId: 'department-1',
      configurationVersion: 2,
      progressionMode: 'SEQUENTIAL',
      completionMode: 'REQUIREMENTS',
      minimumPassingPercentage: 50,
      minimumAttendancePercentage: null,
      department: { id: 'department-1' },
    },
    configurationRevisions: [{ id: 'revision-2', version: 2, checksum: 'curriculum-hash' }],
    curriculumVersions: [{
      id: 'curriculum-1',
      programConfigurationRevisionId: 'revision-2',
      status: CurriculumStatus.ACTIVE,
      isDefaultForAdmissions: true,
      stages: [
        { id: 'stage-1', name: 'Semester 1', code: 'SEM-1', sequence: 1, isOptional: false },
        { id: 'stage-2', name: 'Semester 2', code: 'SEM-2', sequence: 2, isOptional: false },
      ],
    }],
  };
}

function harness() {
  const created = { id: 'major-1', program: { campusConfiguration: { departmentId: 'department-1' } } };
  const tx = {
    student: { findFirst: jest.fn().mockResolvedValue({ id: 'student-1' }), update: jest.fn() },
    studentProgramEnrollment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn(),
    },
    program: { findFirst: jest.fn().mockResolvedValue(admissionProgram()) },
    programOffering: { findFirst: jest.fn() },
    studentStageEnrollment: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0), create: jest.fn(), updateMany: jest.fn() },
    programStageOffering: { findFirst: jest.fn() },
    cohortOffering: { findFirst: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((operation) => operation(tx)) };
  return { service: new StudentProgramEnrollmentsService(prisma as never), tx };
}

describe('StudentProgramEnrollmentsService', () => {
  it('admits a long-lived major without pre-creating future cycle or stage rows', async () => {
    const { service, tx } = harness();
    await service.admitInTransaction(tx as never, 'org-1', 'student-1', { programId: 'program-1' }, 'admin-1');

    expect(tx.studentProgramEnrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requiredStageCountSnapshot: 2,
        entryStageId: 'stage-1',
        curriculumSnapshotHash: 'curriculum-hash',
      }),
    }));
    expect(tx.studentProgramEnrollment.create.mock.calls[0][0].data).not.toHaveProperty('cycles');
    expect(tx.studentStageEnrollment.create).not.toHaveBeenCalled();
  });

  it('rejects a second open major before loading another program', async () => {
    const { service, tx } = harness();
    tx.studentProgramEnrollment.findFirst.mockResolvedValue({ id: 'existing-major' });
    await expect(service.admitInTransaction(tx as never, 'org-1', 'student-1', { programId: 'program-1' }, 'admin-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.program.findFirst).not.toHaveBeenCalled();
  });

  it('uses the selected offering curriculum instead of the program admissions default', async () => {
    const { service, tx } = harness();
    const program = admissionProgram();
    tx.programOffering.findFirst.mockResolvedValue({
      id: 'offering-2',
      program,
      campusBinding: {
        organizationId: 'org-1',
        curriculumVersion: {
          id: 'curriculum-2',
          programConfigurationRevisionId: 'revision-1',
          stages: [{ id: 'offering-stage-1', sequence: 1, isOptional: false }],
          programConfigurationRevision: { id: 'revision-1', checksum: 'offering-curriculum-hash' },
        },
      },
    });

    await service.admitInTransaction(tx as never, 'org-1', 'student-1', {
      programId: 'program-1',
      programOfferingId: 'offering-2',
    }, 'admin-1');

    expect(tx.studentProgramEnrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        curriculumVersionId: 'curriculum-2',
        programConfigurationRevisionId: 'revision-1',
        curriculumSnapshotHash: 'offering-curriculum-hash',
        entryStageId: 'offering-stage-1',
      }),
    }));
    expect(tx.program.findFirst).not.toHaveBeenCalled();
  });

  it('requires an active stage enrollment before a mapped section can be joined', async () => {
    const { service, tx } = harness();
    tx.studentStageEnrollment.findFirst.mockResolvedValue(null);
    await expect(service.ensureMappedSectionEnrollment(
      tx as never,
      'org-1',
      'student-1',
      { id: 'section-1', academicCycleId: 'cycle-1', programMappings: [{ programStageOfferingId: 'offering-1' }] },
      'admin-1',
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts a current stage placement without mutating an old attempt', async () => {
    const { service, tx } = harness();
    const active = {
      id: 'stage-enrollment-1',
      status: StudentStageEnrollmentStatus.IN_PROGRESS,
      studentProgramEnrollment: { id: 'major-1', status: StudentProgramEnrollmentStatus.ACTIVE },
    };
    tx.studentStageEnrollment.findFirst.mockResolvedValue(active);
    const result = await service.ensureMappedSectionEnrollment(
      tx as never,
      'org-1',
      'student-1',
      { id: 'section-1', academicCycleId: 'cycle-1', programMappings: [{ programStageOfferingId: 'offering-1' }] },
      'admin-1',
    );
    expect(result?.stageEnrollment).toBe(active);
    expect(tx.studentStageEnrollment.create).not.toHaveBeenCalled();
  });
});
