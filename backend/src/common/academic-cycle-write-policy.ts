import { ConflictException, NotFoundException } from '@nestjs/common';
import { AcademicCycleStatus, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

export type AcademicCycleWriteMode = 'SETUP' | 'DELIVERY' | 'CLOSEOUT';

const ALLOWED_STATUSES: Record<AcademicCycleWriteMode, readonly AcademicCycleStatus[]> = {
  SETUP: [AcademicCycleStatus.DRAFT, AcademicCycleStatus.ACTIVE],
  DELIVERY: [AcademicCycleStatus.ACTIVE],
  CLOSEOUT: [AcademicCycleStatus.ACTIVE, AcademicCycleStatus.COMPLETED],
};

export async function assertAcademicCycleWritable(
  prisma: PrismaService | Prisma.TransactionClient,
  organizationId: string,
  academicCycleId: string,
  mode: AcademicCycleWriteMode,
) {
  const cycle = await prisma.academicCycle.findFirst({
    where: { id: academicCycleId, organizationId },
    select: { id: true, status: true },
  });

  if (!cycle) throw new NotFoundException('Academic cycle not found in this organization');
  if (!ALLOWED_STATUSES[mode].includes(cycle.status)) {
    throw new ConflictException(`Academic cycle ${cycle.status.toLowerCase()} status does not allow ${mode.toLowerCase()} writes`);
  }
  return cycle;
}
