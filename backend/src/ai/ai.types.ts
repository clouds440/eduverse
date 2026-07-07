import type {
  AIUsageSourceType,
  AISubscription,
  AISubscriptionOwnerType,
  AISubscriptionStatus,
  AILimitMode,
  Role,
} from '@/prisma/prisma-client';

export type AIToolResultCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'UNAVAILABLE';

export type AIToolResult<T> = {
  ok: boolean;
  code?: AIToolResultCode;
  message?: string;
  data?: T;
};

export interface AIToolContext {
  userId: string;
  orgId: string;
  role?: string;
  subscriptionId?: string;
  sourceType?: AIUsageSourceType;
}

export interface AIToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  run: (input: TInput, context: AIToolContext) => Promise<AIToolResult<TOutput>>;
}

export interface AIActor {
  id: string;
  role?: Role | string | null;
  status?: string | null;
  organizationId?: string | null;
}

export interface AIBillingPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export interface AICreditBalance {
  monthlyCredits: number;
  usedCredits: number;
  remainingCredits: number;
  overageCredits: number;
}

export interface AIEntitlementSource {
  sourceType: AIUsageSourceType;
  subscription: AISubscription;
  period: AIBillingPeriod;
  balance: AICreditBalance;
  roleMonthlyCredits?: number | null;
  roleUsedCredits?: number;
  roleRemainingCredits?: number | null;
  overageAllowed: boolean;
}

export type AIEntitlementDeniedCode =
  | 'UNSUPPORTED_ACCOUNT_STATUS'
  | 'NO_SUBSCRIPTION'
  | 'ORG_ROLE_DISABLED'
  | 'ORG_CREDITS_EXHAUSTED'
  | 'ROLE_CREDITS_EXHAUSTED'
  | 'PERSONAL_CREDITS_EXHAUSTED';

export type AIEntitlementResult =
  | {
      allowed: true;
      source: AIEntitlementSource;
    }
  | {
      allowed: false;
      code: AIEntitlementDeniedCode;
      message: string;
      orgSubscriptionStatus?: AISubscriptionStatus | null;
      orgLimitMode?: AILimitMode | null;
      personalSubscriptionStatus?: AISubscriptionStatus | null;
    };

export interface AISubscriptionTarget {
  ownerType: AISubscriptionOwnerType;
  organizationId?: string | null;
  userId?: string | null;
}

export type AIProviderMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIProviderMessage {
  role: AIProviderMessageRole;
  content: string;
  name?: string;
}

export interface AIProviderToolDefinition {
  name: string;
  description: string;
}

export interface AIProviderToolRequest {
  name: string;
  input?: Record<string, unknown>;
}

export interface AIProviderChatInput {
  systemPrompt: string;
  messages: AIProviderMessage[];
  tools: AIProviderToolDefinition[];
  metadata?: Record<string, unknown>;
}

export interface AIProviderChatOutput {
  content: string;
  providerName: string;
  model?: string;
  providerTokenEstimate: number;
  creditEstimate: number;
  toolCalls?: Array<{
    name: string;
    input?: unknown;
  }>;
}

export type AIStreamEvent =
  | {
      type: 'conversation';
      conversationId: string;
      title?: string | null;
    }
  | {
      type: 'delta';
      content: string;
    }
  | {
      type: 'status';
      label: string;
    }
  | {
      type: 'complete';
      response: {
        conversationId: string;
        title?: string | null;
        message: {
          role: 'assistant';
          content: string;
        };
        provider: {
          name: string;
          model?: string;
        };
        usage: {
          creditEstimate: number;
          providerTokenEstimate: number;
          sourceType: AIUsageSourceType;
          remainingCreditsBeforeRequest: number;
        };
        toolCalls: Array<{
          name: string;
          input?: unknown;
        }>;
      };
    }
  | {
      type: 'error';
      code?: string;
      message: string;
    };

export interface AIProviderAdapter {
  chat(input: AIProviderChatInput): Promise<AIProviderChatOutput>;
  stream(input: AIProviderChatInput): AsyncIterable<AIProviderChatOutput>;
  planTools?(input: AIProviderChatInput): Promise<AIProviderToolRequest[]>;
  estimateProviderTokens(input: AIProviderChatInput | string): number;
  estimateCredits(input: AIProviderChatInput | string): number;
  getProviderName(): string;
}
