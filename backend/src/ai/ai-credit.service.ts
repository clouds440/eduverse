import { Injectable } from '@nestjs/common';
import { AIUsageSourceType, Role } from '@/prisma/prisma-client';
import { AIUsageService } from './ai-usage.service';
import type { AIEntitlementSource } from './ai.types';

export interface AIRecordCreditUsageInput {
  source: AIEntitlementSource;
  userId: string;
  organizationId?: string | null;
  role?: Role | string | null;
  credits: number;
  providerTokenEstimate?: number;
  estimatedCost?: number;
}

@Injectable()
export class AICreditService {
  constructor(private readonly usageService: AIUsageService) {}

  estimateCreditsFromText(value: string) {
    return this.usageService.estimateCreditsFromProviderTokens(
      this.usageService.estimateProviderTokensFromText(value),
    );
  }

  estimateCreditsFromProviderTokens(providerTokens: number) {
    return this.usageService.estimateCreditsFromProviderTokens(providerTokens);
  }

  async recordUsage(input: AIRecordCreditUsageInput) {
    const overageCredits = this.resolveOverageCredits(input.source, input.credits);

    return this.usageService.recordUsage({
      subscription: input.source.subscription,
      sourceType: input.source.sourceType,
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
      creditUsed: input.credits,
      providerTokenEstimate: input.providerTokenEstimate,
      estimatedCost: input.estimatedCost,
      overageCredits,
      period: input.source.period,
    });
  }

  private resolveOverageCredits(source: AIEntitlementSource, credits: number) {
    if (source.sourceType === AIUsageSourceType.ORGANIZATION) {
      return Math.max(0, credits - source.balance.remainingCredits);
    }

    return Math.max(0, credits - source.balance.remainingCredits);
  }
}
