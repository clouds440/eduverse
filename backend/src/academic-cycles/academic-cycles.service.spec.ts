import { ConflictException } from '@nestjs/common';
import { AcademicCycleStatus } from '@/prisma/prisma-client';
import { AcademicCyclesService } from './academic-cycles.service';

function createTransactionClient(status: AcademicCycleStatus) {
  return {
    academicCycle: {
      findFirst: jest.fn(async ({ where }) => (
        where.status === AcademicCycleStatus.ACTIVE
          ? null
          : { id: 'cycle-1', organizationId: 'org-1', status }
      )),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'cycle-1', status }),
    },
    section: { count: jest.fn().mockResolvedValue(0) },
    enrollment: { count: jest.fn().mockResolvedValue(0) },
    assessment: { count: jest.fn().mockResolvedValue(0) },
    attendanceSession: { count: jest.fn().mockResolvedValue(0) },
    evaluation: { count: jest.fn().mockResolvedValue(0) },
    preferenceWindow: { count: jest.fn().mockResolvedValue(0) },
    studentProgramEnrollmentCycle: { count: jest.fn().mockResolvedValue(0) },
  };
}

function createService(tx: ReturnType<typeof createTransactionClient>) {
  const prisma = {
    $transaction: jest.fn(async (operation: (client: unknown) => unknown) => operation(tx)),
  };
  return { service: new AcademicCyclesService(prisma as never, {} as never), prisma };
}

describe('AcademicCyclesService lifecycle transitions', () => {
  it('activates a draft only when no other cycle is active', async () => {
    const tx = createTransactionClient(AcademicCycleStatus.DRAFT);
    tx.academicCycle.findUniqueOrThrow.mockResolvedValue({
      id: 'cycle-1',
      status: AcademicCycleStatus.ACTIVE,
    });
    const { service } = createService(tx);

    await expect(
      service.transitionCycle('org-1', 'cycle-1', AcademicCycleStatus.ACTIVE, 'admin-1'),
    ).resolves.toEqual({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE });

    expect(tx.academicCycle.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cycle-1',
        organizationId: 'org-1',
        status: AcademicCycleStatus.DRAFT,
      },
      data: {
        status: AcademicCycleStatus.ACTIVE,
        completedAt: null,
        completedById: null,
      },
    });
  });

  it('rejects transitions that are not in the lifecycle matrix', async () => {
    const tx = createTransactionClient(AcademicCycleStatus.COMPLETED);
    const { service } = createService(tx);

    await expect(
      service.transitionCycle('org-1', 'cycle-1', AcademicCycleStatus.ACTIVE, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.academicCycle.updateMany).not.toHaveBeenCalled();
  });

  it('does not return an active cycle with delivery activity to draft', async () => {
    const tx = createTransactionClient(AcademicCycleStatus.ACTIVE);
    tx.section.count.mockResolvedValue(1);
    const { service } = createService(tx);

    await expect(
      service.transitionCycle('org-1', 'cycle-1', AcademicCycleStatus.DRAFT, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.academicCycle.updateMany).not.toHaveBeenCalled();
  });

  it('records who completed an active cycle', async () => {
    const tx = createTransactionClient(AcademicCycleStatus.ACTIVE);
    const { service } = createService(tx);

    await service.transitionCycle(
      'org-1',
      'cycle-1',
      AcademicCycleStatus.COMPLETED,
      'admin-1',
    );

    expect(tx.academicCycle.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'cycle-1',
        organizationId: 'org-1',
        status: AcademicCycleStatus.ACTIVE,
      },
      data: {
        status: AcademicCycleStatus.COMPLETED,
        completedAt: expect.any(Date),
        completedById: 'admin-1',
      },
    });
  });

  it('blocks completion while student program progression is unresolved', async () => {
    const tx = createTransactionClient(AcademicCycleStatus.ACTIVE);
    tx.studentProgramEnrollmentCycle.count.mockResolvedValue(2);
    const { service } = createService(tx);

    await expect(service.transitionCycle(
      'org-1',
      'cycle-1',
      AcademicCycleStatus.COMPLETED,
      'admin-1',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(tx.academicCycle.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a transition when another request changed the status first', async () => {
    const tx = createTransactionClient(AcademicCycleStatus.DRAFT);
    tx.academicCycle.updateMany.mockResolvedValue({ count: 0 });
    const { service } = createService(tx);

    await expect(
      service.transitionCycle('org-1', 'cycle-1', AcademicCycleStatus.ACTIVE, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
