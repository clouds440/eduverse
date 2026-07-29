import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AISubscriptionOwnerType,
  AISubscriptionPlan,
  AISubscriptionStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { currentUtcMonthPeriod, freeOrgMonthlyCredits } from './ai-free-quota.util';
import { AI_PLAN_CONFIG } from './ai.constants';

@Injectable()
export class AIFreeQuotaService implements OnModuleInit {
  private readonly logger = new Logger(AIFreeQuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.renewMonthlyFreeOrgQuotas();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async renewMonthlyFreeOrgQuotas() {
    const now = new Date();
    const period = currentUtcMonthPeriod(now);
    const result = await this.prisma.aISubscription.updateMany({
      where: {
        ownerType: AISubscriptionOwnerType.ORGANIZATION,
        plan: AISubscriptionPlan.FREE,
        status: AISubscriptionStatus.ACTIVE,
        OR: [
          { currentPeriodStart: null },
          { currentPeriodEnd: null },
          { currentPeriodEnd: { lte: now } },
        ],
      },
      data: {
        monthlyCredits: freeOrgMonthlyCredits(),
        limitMode: AI_PLAN_CONFIG[AISubscriptionPlan.FREE].limitMode,
        currentPeriodStart: period.periodStart,
        currentPeriodEnd: period.periodEnd,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Renewed monthly free AI quota for ${result.count} organization subscription(s).`);
    }
  }
}
