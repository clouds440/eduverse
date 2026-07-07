import { Injectable } from '@nestjs/common';
import {
  AISubscription,
  AIUsageSourceType,
  Prisma,
  Role,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentAIBillingPeriod } from './ai-period.util';
import type { AIBillingPeriod, AICreditBalance } from './ai.types';

export interface AIUsageRecordInput {
  subscription: AISubscription;
  sourceType: AIUsageSourceType;
  userId: string;
  organizationId?: string | null;
  role?: Role | string | null;
  creditUsed: number;
  providerTokenEstimate?: number;
  estimatedCost?: number;
  overageCredits?: number;
  period?: AIBillingPeriod;
}

@Injectable()
export class AIUsageService {
  constructor(private readonly prisma: PrismaService) {}

  getCurrentPeriod(subscription?: Pick<AISubscription, 'currentPeriodStart' | 'currentPeriodEnd'> | null) {
    return getCurrentAIBillingPeriod(subscription);
  }

  async getSubscriptionBalance(
    subscription: Pick<AISubscription, 'id' | 'monthlyCredits' | 'currentPeriodStart' | 'currentPeriodEnd'>,
  ): Promise<AICreditBalance & AIBillingPeriod> {
    const period = this.getCurrentPeriod(subscription);
    const aggregate = await this.prisma.aIUsage.aggregate({
      where: {
        subscriptionId: subscription.id,
        periodStart: period.periodStart,
      },
      _sum: {
        creditUsed: true,
        overageCredits: true,
      },
    });

    const usedCredits = aggregate._sum.creditUsed ?? 0;
    const overageCredits = aggregate._sum.overageCredits ?? 0;
    return {
      ...period,
      monthlyCredits: subscription.monthlyCredits,
      usedCredits,
      overageCredits,
      remainingCredits: Math.max(0, subscription.monthlyCredits - usedCredits),
    };
  }

  async getUserCreditsUsed(subscriptionId: string, userId: string, period: AIBillingPeriod) {
    const aggregate = await this.prisma.aIUsage.aggregate({
      where: {
        subscriptionId,
        userId,
        periodStart: period.periodStart,
      },
      _sum: { creditUsed: true },
    });

    return aggregate._sum.creditUsed ?? 0;
  }

  async recordUsage(input: AIUsageRecordInput) {
    const period = input.period ?? this.getCurrentPeriod(input.subscription);
    const creditUsed = Math.max(0, Math.round(input.creditUsed));
    const providerTokenEstimate = Math.max(0, Math.round(input.providerTokenEstimate ?? 0));
    const overageCredits = Math.max(0, Math.round(input.overageCredits ?? 0));
    const estimatedCost = new Prisma.Decimal(input.estimatedCost ?? 0);

    return this.prisma.aIUsage.upsert({
      where: {
        subscriptionId_userId_periodStart: {
          subscriptionId: input.subscription.id,
          userId: input.userId,
          periodStart: period.periodStart,
        },
      },
      create: {
        subscriptionId: input.subscription.id,
        sourceType: input.sourceType,
        organizationId: input.organizationId ?? input.subscription.organizationId ?? null,
        userId: input.userId,
        role: input.role ? (input.role as Role) : null,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        creditUsed,
        providerTokenEstimate,
        estimatedCost,
        overageCredits,
      },
      update: {
        creditUsed: { increment: creditUsed },
        providerTokenEstimate: { increment: providerTokenEstimate },
        estimatedCost: { increment: estimatedCost },
        overageCredits: { increment: overageCredits },
        periodEnd: period.periodEnd,
        role: input.role ? (input.role as Role) : undefined,
      },
    });
  }

  estimateCreditsFromProviderTokens(providerTokens: number) {
    return Math.max(1, Math.ceil(Math.max(0, providerTokens) / 1000));
  }

  estimateProviderTokensFromText(value: string) {
    return Math.ceil(value.length / 4);
  }
}
