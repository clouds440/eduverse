import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingCycle, EntrySource, EntryStatus, FinanceTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FinanceCron {
  private readonly logger = new Logger(FinanceCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyEntries() {
    this.logger.log('Running daily finance generation cron...');

    const activeStructures = await this.prisma.financialStructure.findMany({
      where: { isActive: true },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            student: { include: { user: { select: { id: true, name: true, email: true } } } },
            teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });

    const now = new Date();
    const leadDays = 7;
    const targetDate = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);

    for (const structure of activeStructures) {
      const period = this.getPeriodForTargetDate(structure.billingCycle, structure.startDate, structure.endDate, targetDate);
      if (!period) continue;

      const dueDate = this.getDueDate(structure.billingCycle, period.periodStart, structure.dueDay);

      for (const assignment of structure.assignments) {
        const existingEntry = await this.prisma.financialEntry.findFirst({
          where: {
            assignmentId: assignment.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          },
        });

        if (existingEntry) continue;

        const entry = await this.prisma.financialEntry.create({
          data: {
            organizationId: structure.organizationId,
            structureId: structure.id,
            assignmentId: assignment.id,
            title: `${structure.title} - ${this.formatPeriodLabel(period.periodStart, structure.billingCycle)}`,
            studentId: assignment.studentId,
            teacherId: assignment.teacherId,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            dueDate,
            amount: structure.amount,
            source: EntrySource.SYSTEM,
          },
        });

        await this.notifyAssignment(structure.title, entry.id, dueDate, structure.amount, assignment);
        this.logger.log(`Generated finance entry ${entry.id} for assignment ${assignment.id}`);
      }
    }

    const overdueEntries = await this.prisma.financialEntry.updateMany({
      where: {
        status: EntryStatus.PENDING,
        dueDate: { lt: now },
      },
      data: { status: EntryStatus.OVERDUE },
    });

    if (overdueEntries.count > 0) {
      this.logger.log(`Marked ${overdueEntries.count} entries as OVERDUE.`);
    }

    this.logger.log('Daily finance generation cron completed.');
  }

  private getPeriodForTargetDate(billingCycle: BillingCycle, startDate: Date, endDate: Date | null, targetDate: Date) {
    if (endDate && targetDate > endDate) return null;
    if (targetDate < startDate) return null;

    if (billingCycle === BillingCycle.ONCE) {
      return {
        periodStart: startDate,
        periodEnd: endDate || startDate,
      };
    }

    if (billingCycle === BillingCycle.SEMESTER) {
      const startMonth = targetDate.getMonth() < 6 ? 0 : 6;
      return {
        periodStart: new Date(targetDate.getFullYear(), startMonth, 1),
        periodEnd: new Date(targetDate.getFullYear(), startMonth + 6, 0),
      };
    }

    if (billingCycle === BillingCycle.YEARLY || billingCycle === BillingCycle.ACADEMIC_CYCLE) {
      return {
        periodStart: new Date(targetDate.getFullYear(), 0, 1),
        periodEnd: new Date(targetDate.getFullYear(), 11, 31),
      };
    }

    return {
      periodStart: new Date(targetDate.getFullYear(), targetDate.getMonth(), 1),
      periodEnd: new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0),
    };
  }

  private getDueDate(billingCycle: BillingCycle, periodStart: Date, dueDay: number | null) {
    if (billingCycle === BillingCycle.ONCE) return periodStart;
    return new Date(periodStart.getFullYear(), periodStart.getMonth(), dueDay || 5);
  }

  private formatPeriodLabel(periodStart: Date, billingCycle: BillingCycle) {
    if (billingCycle === BillingCycle.YEARLY || billingCycle === BillingCycle.ACADEMIC_CYCLE) {
      return `${periodStart.getFullYear()}`;
    }
    if (billingCycle === BillingCycle.SEMESTER) {
      return `${periodStart.getFullYear()} ${periodStart.getMonth() < 6 ? 'Spring' : 'Fall'}`;
    }
    return periodStart.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  private async notifyAssignment(
    structureTitle: string,
    entryId: string,
    dueDate: Date,
    amount: number,
    assignment: {
      targetType: FinanceTargetType;
      student?: { user?: { id: string; name: string | null; email: string } | null } | null;
      teacher?: { user?: { id: string; name: string | null; email: string } | null } | null;
      entityName?: string | null;
    },
  ) {
    const userId = assignment.student?.user?.id || assignment.teacher?.user?.id;
    if (!userId) return;

    const isExpense = assignment.targetType === FinanceTargetType.TEACHER || assignment.targetType === FinanceTargetType.OTHER_EXPENSE;
    const title = isExpense ? 'Finance expense entry generated' : 'New payment entry generated';
    const body = `${structureTitle} for ${amount.toLocaleString()} is due ${dueDate.toLocaleDateString()}.`;

    try {
      await this.notifications.createNotificationOnce({
        userId,
        title,
        body,
        actionUrl: isExpense ? '/finance/entries' : '/fees',
        type: 'FINANCE_ENTRY_CREATED',
        metadata: { entryId, targetType: assignment.targetType },
      }, { entryId });
    } catch (error) {
      this.logger.warn(`Failed to notify finance entry ${entryId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
