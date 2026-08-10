import 'reflect-metadata';
import { ProgramStageOfferingStatus, Role, StudentStageEnrollmentStatus } from '@/prisma/prisma-client';
import { BulkProgressionAction } from './dto/progression-workbench.dto';
import { ProgressionWorkbenchService } from './progression-workbench.service';

describe('ProgressionWorkbenchService', () => {
  it('applies row-level progression and persists the replayable result', async () => {
    const operationUpdate = jest.fn();
    const prisma = {
      programStageOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'source', status: ProgramStageOfferingStatus.OPEN, programStage: { id: 'stage-1' }, programOffering: { program: { departmentId: 'department-1' }, academicCycle: {} } }) },
      progressionBulkOperation: { create: jest.fn().mockResolvedValue({ id: 'operation-1' }), update: operationUpdate },
      studentStageEnrollment: { findMany: jest.fn().mockResolvedValue([{ id: 'attempt-1', studentProgramEnrollmentId: 'major-1', programStageOfferingId: 'source', status: StudentStageEnrollmentStatus.IN_PROGRESS, cohortOfferingId: null, studentProgramEnrollment: { studentId: 'student-1' } }]) },
    };
    const studentPrograms = { advanceStage: jest.fn().mockResolvedValue({ id: 'next-attempt' }) };
    const service = new ProgressionWorkbenchService(prisma as never, studentPrograms as never);

    const result = await service.apply('org-1', {
      programStageOfferingId: 'source',
      idempotencyKey: 'request-1',
      items: [{ stageEnrollmentId: 'attempt-1', action: BulkProgressionAction.ADVANCE, reason: 'Passed', targetProgramStageOfferingId: 'target' }],
    }, { id: 'admin-1', role: Role.ORG_ADMIN });

    expect(result).toMatchObject({ succeeded: 1, failed: 0 });
    expect(studentPrograms.advanceStage).toHaveBeenCalledWith('org-1', 'student-1', 'major-1', 'attempt-1', expect.objectContaining({ targetProgramStageOfferingId: 'target' }), expect.anything(), 'request-1:attempt-1');
    expect(operationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
  });

  it('returns a row failure without rolling back successful students', async () => {
    const prisma = {
      programStageOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'source', programStage: {}, programOffering: { program: { departmentId: 'department-1' }, academicCycle: {} } }) },
      progressionBulkOperation: { create: jest.fn(), update: jest.fn() },
      studentStageEnrollment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ProgressionWorkbenchService(prisma as never, {} as never);
    const result = await service.apply('org-1', {
      programStageOfferingId: 'source',
      idempotencyKey: 'request-2',
      items: [{ stageEnrollmentId: 'outside', action: BulkProgressionAction.SKIP, reason: 'Approved exception' }],
    }, { id: 'admin-1', role: Role.ORG_ADMIN });
    expect(result).toMatchObject({ succeeded: 0, failed: 1, results: [{ success: false }] });
  });

  it('resolves the final stage and program through one atomic command', async () => {
    const prisma = {
      programStageOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'source', programStage: { id: 'final-stage' }, programOffering: { program: { departmentId: 'department-1' }, academicCycle: {} } }) },
      progressionBulkOperation: { create: jest.fn(), update: jest.fn() },
      studentStageEnrollment: { findMany: jest.fn().mockResolvedValue([{ id: 'attempt-final', studentProgramEnrollmentId: 'major-1', programStageOfferingId: 'source', cohortOfferingId: null, studentProgramEnrollment: { studentId: 'student-1' } }]) },
    };
    const studentPrograms = { completeStageAndProgram: jest.fn().mockResolvedValue({}) };
    const service = new ProgressionWorkbenchService(prisma as never, studentPrograms as never);
    const result = await service.apply('org-1', {
      programStageOfferingId: 'source',
      idempotencyKey: 'request-final',
      items: [{ stageEnrollmentId: 'attempt-final', action: BulkProgressionAction.COMPLETE_PROGRAM, reason: 'Requirements met' }],
    }, { id: 'admin-1', role: Role.ORG_ADMIN });

    expect(result).toMatchObject({ succeeded: 1, failed: 0 });
    expect(studentPrograms.completeStageAndProgram).toHaveBeenCalledWith(
      'org-1',
      'student-1',
      'major-1',
      'attempt-final',
      expect.anything(),
      expect.anything(),
      'request-final:attempt-final',
    );
  });
});
