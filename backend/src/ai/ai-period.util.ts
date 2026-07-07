import type { AISubscription } from '@/prisma/prisma-client';
import type { AIBillingPeriod } from './ai.types';

export function getCurrentAIBillingPeriod(
  subscription?: Pick<AISubscription, 'currentPeriodStart' | 'currentPeriodEnd'> | null,
  now = new Date(),
): AIBillingPeriod {
  if (
    subscription?.currentPeriodStart &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodStart <= now &&
    subscription.currentPeriodEnd > now
  ) {
    return {
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    };
  }

  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}
