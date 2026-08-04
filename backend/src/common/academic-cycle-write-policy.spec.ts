import { ConflictException, NotFoundException } from '@nestjs/common';
import { AcademicCycleStatus } from '@/prisma/prisma-client';
import { assertAcademicCycleWritable, AcademicCycleWriteMode } from './academic-cycle-write-policy';

describe('assertAcademicCycleWritable', () => {
  const allowed: Array<[AcademicCycleWriteMode, AcademicCycleStatus]> = [
    ['SETUP', AcademicCycleStatus.DRAFT],
    ['SETUP', AcademicCycleStatus.ACTIVE],
    ['DELIVERY', AcademicCycleStatus.ACTIVE],
    ['CLOSEOUT', AcademicCycleStatus.ACTIVE],
    ['CLOSEOUT', AcademicCycleStatus.COMPLETED],
  ];

  it.each(allowed)('allows %s writes in %s cycles', async (mode, status) => {
    const prisma = {
      academicCycle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status }),
      },
    };

    await expect(
      assertAcademicCycleWritable(prisma as never, 'org-1', 'cycle-1', mode),
    ).resolves.toEqual({ id: 'cycle-1', status });
  });

  it.each([
    AcademicCycleStatus.ARCHIVING,
    AcademicCycleStatus.ARCHIVED,
  ])('rejects every write mode in a %s cycle', async (status) => {
    for (const mode of ['SETUP', 'DELIVERY', 'CLOSEOUT'] as AcademicCycleWriteMode[]) {
      const prisma = {
        academicCycle: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status }),
        },
      };

      await expect(
        assertAcademicCycleWritable(prisma as never, 'org-1', 'cycle-1', mode),
      ).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('rejects delivery writes in draft and completed cycles', async () => {
    for (const status of [AcademicCycleStatus.DRAFT, AcademicCycleStatus.COMPLETED]) {
      const prisma = {
        academicCycle: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status }),
        },
      };

      await expect(
        assertAcademicCycleWritable(prisma as never, 'org-1', 'cycle-1', 'DELIVERY'),
      ).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('does not expose a cycle from another organization', async () => {
    const prisma = {
      academicCycle: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(
      assertAcademicCycleWritable(prisma as never, 'org-1', 'cycle-1', 'SETUP'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
