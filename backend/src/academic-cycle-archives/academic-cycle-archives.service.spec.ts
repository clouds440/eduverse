import { ConflictException } from '@nestjs/common';
import { AcademicCycleStatus, StudentStageEnrollmentStatus } from '@/prisma/prisma-client';
import { AcademicCycleArchivesService } from './academic-cycle-archives.service';

describe('AcademicCycleArchivesService', () => {
  it('blocks archive creation while a stage enrollment is in progress in the cycle', async () => {
    const prisma = {
      academicCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-1',
          status: AcademicCycleStatus.COMPLETED,
          currentArchiveId: null,
        }),
      },
      studentStageEnrollment: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new AcademicCycleArchivesService(prisma as never, {} as never);
    await expect((service as any).preflight('org-1', 'cycle-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.studentStageEnrollment.count).toHaveBeenCalledWith({
      where: {
        programStageOffering: { programOffering: { academicCycleId: 'cycle-1' } },
        status: StudentStageEnrollmentStatus.IN_PROGRESS,
      },
    });
  });
});
