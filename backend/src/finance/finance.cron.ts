import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EntrySource, EntryStatus, BillingCycle } from '@prisma/client';

@Injectable()
export class FinanceCron {
  private readonly logger = new Logger(FinanceCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyEntries() {
    this.logger.log('Running daily finance generation cron...');

    const activeStructures = await this.prisma.financialStructure.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    // For generating next month's entries a few days early
    const leadDays = 7;
    const targetDate = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);

    for (const structure of activeStructures) {
      if (structure.billingCycle === BillingCycle.ONCE) continue;

      // Simplistic approach: if targetDate is a new month/period we should generate an entry.
      // In a real app, calculate exact periods based on startDate and billingCycle.
      
      const periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const existingEntry = await this.prisma.financialEntry.findFirst({
        where: {
          structureId: structure.id,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
      });

      if (!existingEntry) {
        let dueDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), structure.dueDay || 5);
        if (dueDate < periodStart) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        await this.prisma.financialEntry.create({
          data: {
            organizationId: structure.organizationId,
            structureId: structure.id,
            title: `${structure.title} - ${periodStart.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            studentId: structure.studentId,
            teacherId: structure.teacherId,
            periodStart,
            periodEnd,
            dueDate,
            amount: structure.amount,
            source: EntrySource.SYSTEM,
          },
        });
        this.logger.log(`Generated entry for structure ${structure.id}`);
      }
    }

    // Mark pending entries as overdue
    const overdueEntries = await this.prisma.financialEntry.updateMany({
      where: {
        status: EntryStatus.PENDING,
        dueDate: { lt: now },
      },
      data: {
        status: EntryStatus.OVERDUE,
      },
    });

    if (overdueEntries.count > 0) {
      this.logger.log(`Marked ${overdueEntries.count} entries as OVERDUE.`);
    }

    this.logger.log('Daily finance generation cron completed.');
  }
}
