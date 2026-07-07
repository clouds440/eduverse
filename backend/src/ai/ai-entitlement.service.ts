import { Injectable } from '@nestjs/common';
import {
  AILimitMode,
  AISubscription,
  AISubscriptionStatus,
  AIUsageSourceType,
  Role,
} from '@/prisma/prisma-client';
import { AI_SUPPORTED_USER_STATUSES } from './ai.constants';
import { AISubscriptionService } from './ai-subscription.service';
import { AIUsageService } from './ai-usage.service';
import type {
  AIActor,
  AIEntitlementResult,
  AIEntitlementSource,
} from './ai.types';

@Injectable()
export class AIEntitlementService {
  constructor(
    private readonly subscriptionService: AISubscriptionService,
    private readonly usageService: AIUsageService,
  ) {}

  async resolveEntitlement(
    actor: AIActor,
    estimatedCredits = 1,
  ): Promise<AIEntitlementResult> {
    if (!this.isSupportedAccount(actor)) {
      return {
        allowed: false,
        code: 'UNSUPPORTED_ACCOUNT_STATUS',
        message: 'This account is not eligible to use EduVerse AI Copilot.',
      };
    }

    const orgSubscription = actor.organizationId
      ? await this.subscriptionService.getOrgSubscription(actor.organizationId)
      : null;
    const personalSubscription = await this.subscriptionService.getPersonalSubscription(actor.id);

    const orgSource = actor.organizationId && orgSubscription
      ? await this.resolveOrgSource(actor, orgSubscription, estimatedCredits)
      : null;

    if (orgSource?.allowed) {
      return { allowed: true, source: orgSource.source };
    }

    const personalSource = personalSubscription
      ? await this.resolvePersonalSource(actor, personalSubscription, estimatedCredits)
      : null;

    if (personalSource?.allowed) {
      return { allowed: true, source: personalSource.source };
    }

    return {
      allowed: false,
      code: personalSource?.code ?? orgSource?.code ?? 'NO_SUBSCRIPTION',
      message:
        personalSource?.message ??
        orgSource?.message ??
        'EduVerse AI Copilot requires an organization or personal AI subscription.',
      orgSubscriptionStatus: orgSubscription?.status ?? null,
      orgLimitMode: orgSubscription?.limitMode ?? null,
      personalSubscriptionStatus: personalSubscription?.status ?? null,
    };
  }

  private isSupportedAccount(actor: AIActor) {
    return AI_SUPPORTED_USER_STATUSES.has(actor.status ?? 'ACTIVE');
  }

  private async resolveOrgSource(
    actor: AIActor,
    subscription: AISubscription,
    estimatedCredits: number,
  ): Promise<AIEntitlementResult> {
    if (!this.isActive(subscription)) {
      return {
        allowed: false,
        code: 'NO_SUBSCRIPTION',
        message: 'This organization does not have an active AI Copilot subscription.',
      };
    }

    if (!actor.organizationId) {
      return {
        allowed: false,
        code: 'NO_SUBSCRIPTION',
        message: 'This account is not attached to an organization subscription.',
      };
    }

    const accessPolicy = await this.subscriptionService.getOrCreateOrgAccessPolicy(
      actor.organizationId,
    );
    const roleAllowed = this.subscriptionService.canUseOrgSubscriptionForRole(
      accessPolicy,
      actor.role,
    );

    if (!roleAllowed) {
      return {
        allowed: false,
        code: 'ORG_ROLE_DISABLED',
        message: 'Your organization has not enabled AI Copilot for your role.',
      };
    }

    const period = this.usageService.getCurrentPeriod(subscription);
    const balance = await this.usageService.getSubscriptionBalance(subscription);
    const overageAllowed = subscription.limitMode === AILimitMode.SOFT;

    if (balance.remainingCredits < estimatedCredits && !overageAllowed) {
      return {
        allowed: false,
        code: 'ORG_CREDITS_EXHAUSTED',
        message: 'Your organization has used all AI Credits for this period.',
      };
    }

    const roleMonthlyCredits = await this.subscriptionService.getRoleMonthlyCredits(
      actor.organizationId,
      actor.role,
    );
    const roleUsedCredits = await this.usageService.getUserCreditsUsed(
      subscription.id,
      actor.id,
      period,
    );
    const roleRemainingCredits =
      roleMonthlyCredits === null
        ? null
        : Math.max(0, roleMonthlyCredits - roleUsedCredits);

    if (roleRemainingCredits !== null && roleRemainingCredits < estimatedCredits) {
      return {
        allowed: false,
        code: 'ROLE_CREDITS_EXHAUSTED',
        message: 'You have used your role-based AI Credits for this period.',
      };
    }

    return this.allowedSource({
      sourceType: AIUsageSourceType.ORGANIZATION,
      subscription,
      period,
      balance,
      roleMonthlyCredits,
      roleUsedCredits,
      roleRemainingCredits,
      overageAllowed,
    });
  }

  private async resolvePersonalSource(
    actor: AIActor,
    subscription: AISubscription,
    estimatedCredits: number,
  ): Promise<AIEntitlementResult> {
    if (!this.isActive(subscription)) {
      return {
        allowed: false,
        code: 'NO_SUBSCRIPTION',
        message: 'You do not have an active personal AI Copilot subscription.',
      };
    }

    const balance = await this.usageService.getSubscriptionBalance(subscription);
    const period = this.usageService.getCurrentPeriod(subscription);
    const overageAllowed = subscription.limitMode === AILimitMode.SOFT;

    if (balance.remainingCredits < estimatedCredits && !overageAllowed) {
      return {
        allowed: false,
        code: 'PERSONAL_CREDITS_EXHAUSTED',
        message: 'You have used all personal AI Credits for this period.',
      };
    }

    return this.allowedSource({
      sourceType: AIUsageSourceType.PERSONAL,
      subscription,
      period,
      balance,
      overageAllowed,
    });
  }

  private allowedSource(source: AIEntitlementSource): AIEntitlementResult {
    return { allowed: true, source };
  }

  private isActive(subscription: AISubscription) {
    return subscription.status === AISubscriptionStatus.ACTIVE && subscription.monthlyCredits > 0;
  }
}
