import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  AISubscriptionOwnerType,
  AISubscriptionPlan,
  AISubscriptionStatus,
  User,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PLAN_CONFIG } from './ai.constants';
import { AISubscriptionService } from './ai-subscription.service';

type LemonSqueezySubscriptionStatus =
  | 'on_trial'
  | 'active'
  | 'paused'
  | 'past_due'
  | 'unpaid'
  | 'cancelled'
  | 'expired';

interface LemonSqueezyResource<TAttributes = Record<string, unknown>> {
  type: string;
  id: string;
  attributes?: TAttributes;
}

interface LemonSqueezyCheckoutResponse {
  data?: LemonSqueezyResource<{
    url?: string;
  }>;
}

interface LemonSqueezyWebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: LemonSqueezyResource<LemonSqueezyWebhookAttributes>;
}

interface LemonSqueezySubscriptionAttributes {
  status?: LemonSqueezySubscriptionStatus;
  customer_id?: number | string | null;
  variant_id?: number | string | null;
  renews_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
  urls?: {
    customer_portal?: string;
    update_payment_method?: string;
  };
  first_subscription_item?: {
    variant_id?: number | string | null;
  };
}

type LemonSqueezyWebhookAttributes = LemonSqueezySubscriptionAttributes & {
  subscription_id?: number | string | null;
  subscription?: number | string | null;
  variant_id?: number | string | null;
  first_order_item?: {
    variant_id?: number | string | null;
    subscription_id?: number | string | null;
  };
};

interface LemonSqueezyCheckoutInput {
  ownerType: AISubscriptionOwnerType;
  plan: AISubscriptionPlan;
  subscriptionId: string;
  organizationId?: string | null;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  cancelPath: string;
}

@Injectable()
export class AIBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: AISubscriptionService,
  ) {}

  async createOrgCheckoutSession(organizationId: string, actor: User, plan: AISubscriptionPlan) {
    if (plan === AISubscriptionPlan.NONE) {
      throw new BadRequestException('Use the billing portal or cancel flow for disabling a paid AI subscription.');
    }

    const subscription = await this.subscriptionService.getOrCreateOrgSubscription(organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, contactEmail: true },
    });
    if (!organization) throw new BadRequestException('Organization not found.');

    return this.createCheckout({
      ownerType: AISubscriptionOwnerType.ORGANIZATION,
      plan,
      subscriptionId: subscription.id,
      organizationId,
      email: organization.contactEmail || actor.email,
      name: organization.name,
      cancelPath: '/settings?ai_billing=cancelled',
    });
  }

  async createPersonalCheckoutSession(user: User, plan: AISubscriptionPlan) {
    if (plan === AISubscriptionPlan.NONE) {
      throw new BadRequestException('Use the billing portal or cancel flow for disabling a paid AI subscription.');
    }

    const subscription = await this.subscriptionService.getOrCreatePersonalSubscription(
      user.id,
      user.organizationId,
    );

    return this.createCheckout({
      ownerType: AISubscriptionOwnerType.USER,
      plan,
      subscriptionId: subscription.id,
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name ?? user.email,
      cancelPath: '/ai?ai_billing=cancelled',
    });
  }

  async createPortalSession(user: User, ownerType: AISubscriptionOwnerType, returnPath?: string) {
    const subscription = ownerType === AISubscriptionOwnerType.ORGANIZATION
      ? await this.subscriptionService.getOrCreateOrgSubscription(requiredOrgId(user))
      : await this.subscriptionService.getOrCreatePersonalSubscription(user.id, user.organizationId);

    if (subscription.lemonSqueezySubscriptionId) {
      const resource = await this.retrieveSubscription(subscription.lemonSqueezySubscriptionId);
      const portalUrl = resource.attributes?.urls?.customer_portal;
      if (portalUrl) {
        await this.prisma.aISubscription.update({
          where: { id: subscription.id },
          data: { lemonSqueezyPortalUrl: portalUrl },
        });
        return { portalUrl };
      }
    }

    if (subscription.lemonSqueezyPortalUrl) {
      return { portalUrl: subscription.lemonSqueezyPortalUrl };
    }

    throw new BadRequestException('No Lemon Squeezy subscription portal is available for this AI subscription yet.');
  }

  async handleWebhook(rawBody: Buffer, signature?: string) {
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('LEMON_SQUEEZY_WEBHOOK_SECRET is not configured.');
    if (!signature) throw new BadRequestException('Missing Lemon Squeezy signature.');

    verifyLemonSqueezySignature(rawBody, signature, secret);
    const payload = JSON.parse(rawBody.toString('utf8')) as LemonSqueezyWebhookPayload;
    const result = await this.processWebhookEvent(payload);

    return { received: true, ...result };
  }

  private async processWebhookEvent(payload: LemonSqueezyWebhookPayload) {
    const eventName = payload.meta?.event_name ?? '';
    const data = payload.data;

    if (eventName.startsWith('subscription_') && data?.type === 'subscriptions') {
      await this.syncLemonSqueezySubscription(
        data as LemonSqueezyResource<LemonSqueezySubscriptionAttributes>,
        payload.meta?.custom_data,
      );
      return { handled: true, eventName, source: 'subscription' };
    }

    if (shouldSyncRelatedSubscription(eventName)) {
      const subscriptionId = relatedSubscriptionId(payload);
      if (subscriptionId) {
        const subscription = await this.retrieveSubscription(subscriptionId);
        await this.syncLemonSqueezySubscription(subscription, payload.meta?.custom_data);
        return { handled: true, eventName, source: 'related-subscription' };
      }
    }

    return { handled: false, eventName };
  }

  private async createCheckout(input: LemonSqueezyCheckoutInput) {
    const storeId = requiredEnv('LEMON_SQUEEZY_STORE_ID');
    const variantId = this.variantId(input.ownerType, input.plan);
    const body = {
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            redirect_url: `${frontendBaseUrl()}/ai?ai_billing=success`,
            enabled_variants: [Number(variantId)],
          },
          checkout_data: {
            email: input.email ?? undefined,
            name: input.name ?? undefined,
            custom: {
              ownerType: input.ownerType,
              organizationId: input.organizationId ?? '',
              userId: input.userId ?? '',
              plan: input.plan,
              subscriptionId: input.subscriptionId,
            },
          },
          expires_at: checkoutExpiryDate(),
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: storeId,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId,
            },
          },
        },
      },
    };

    const response = await this.lemonRequest<LemonSqueezyCheckoutResponse>('/v1/checkouts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const checkoutUrl = response.data?.attributes?.url;
    const checkoutId = response.data?.id;
    if (!checkoutUrl || !checkoutId) {
      throw new BadRequestException('Lemon Squeezy did not return a checkout URL.');
    }

    await this.prisma.aISubscription.update({
      where: { id: input.subscriptionId },
      data: { lemonSqueezyVariantId: variantId },
    });

    return { checkoutUrl, sessionId: checkoutId };
  }

  private async retrieveSubscription(subscriptionId: string) {
    const response = await this.lemonRequest<{ data?: LemonSqueezyResource<LemonSqueezySubscriptionAttributes> }>(
      `/v1/subscriptions/${subscriptionId}`,
    );
    if (!response.data) throw new BadRequestException('Lemon Squeezy subscription was not found.');
    return response.data;
  }

  private async syncLemonSqueezySubscription(
    resource: LemonSqueezyResource<LemonSqueezySubscriptionAttributes>,
    customData?: Record<string, unknown>,
  ) {
    const attributes = resource.attributes ?? {};
    const metadata = normalizeCustomData(customData);
    const ownerType = metadata.ownerType as AISubscriptionOwnerType | undefined;
    const plan = this.planFromLemonSqueezy(attributes, metadata.plan);
    const currentPeriodEnd = parseDate(attributes.renews_at ?? attributes.ends_at);
    const data = {
      plan,
      status: lemonStatusToAIStatus(attributes.status, attributes.ends_at),
      monthlyCredits: AI_PLAN_CONFIG[plan].monthlyCredits,
      limitMode: AI_PLAN_CONFIG[plan].limitMode,
      currentPeriodStart: parseDate(attributes.created_at) ?? new Date(),
      currentPeriodEnd,
      lemonSqueezyCustomerId: valueToString(attributes.customer_id),
      lemonSqueezySubscriptionId: resource.id,
      lemonSqueezyVariantId: valueToString(attributes.variant_id ?? attributes.first_subscription_item?.variant_id),
      lemonSqueezyPortalUrl: attributes.urls?.customer_portal ?? null,
    };

    if (metadata.subscriptionId) {
      await this.prisma.aISubscription.update({
        where: { id: metadata.subscriptionId },
        data,
      });
      return;
    }

    if (ownerType === AISubscriptionOwnerType.ORGANIZATION && metadata.organizationId) {
      await this.prisma.aISubscription.upsert({
        where: {
          ownerType_organizationId: {
            ownerType,
            organizationId: metadata.organizationId,
          },
        },
        create: {
          ownerType,
          organizationId: metadata.organizationId,
          ...data,
        },
        update: data,
      });
      return;
    }

    if (ownerType === AISubscriptionOwnerType.USER && metadata.userId) {
      await this.prisma.aISubscription.upsert({
        where: {
          ownerType_userId: {
            ownerType,
            userId: metadata.userId,
          },
        },
        create: {
          ownerType,
          userId: metadata.userId,
          organizationId: metadata.organizationId || null,
          ...data,
        },
        update: {
          ...data,
          organizationId: metadata.organizationId || undefined,
        },
      });
    }
  }

  private variantId(ownerType: AISubscriptionOwnerType, plan: AISubscriptionPlan) {
    const prefix = ownerType === AISubscriptionOwnerType.ORGANIZATION ? 'ORG' : 'PERSONAL';
    const specific = process.env[`LEMON_SQUEEZY_AI_${prefix}_${plan}_VARIANT_ID`];
    const fallback = process.env[`LEMON_SQUEEZY_AI_${plan}_VARIANT_ID`];
    const variantId = specific ?? fallback;
    if (!variantId) {
      throw new BadRequestException(`Lemon Squeezy variant id is not configured for ${prefix} ${plan}.`);
    }
    return variantId;
  }

  private planFromLemonSqueezy(attributes: LemonSqueezySubscriptionAttributes, metadataPlan?: string) {
    if (metadataPlan && metadataPlan in AISubscriptionPlan) {
      return metadataPlan as AISubscriptionPlan;
    }

    const variantId = valueToString(attributes.variant_id ?? attributes.first_subscription_item?.variant_id);
    if (!variantId) return AISubscriptionPlan.NONE;
    const matched = Object.values(AISubscriptionPlan).find((plan) =>
      plan !== AISubscriptionPlan.NONE
      && [
        process.env[`LEMON_SQUEEZY_AI_ORG_${plan}_VARIANT_ID`],
        process.env[`LEMON_SQUEEZY_AI_PERSONAL_${plan}_VARIANT_ID`],
        process.env[`LEMON_SQUEEZY_AI_${plan}_VARIANT_ID`],
      ].includes(variantId),
    );

    return matched ?? AISubscriptionPlan.NONE;
  }

  private async lemonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.lemonsqueezy.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${requiredEnv('LEMON_SQUEEZY_API_KEY')}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`Lemon Squeezy request failed (${response.status}): ${body.slice(0, 240)}`);
    }

    return response.json() as Promise<T>;
  }
}

function lemonStatusToAIStatus(status?: LemonSqueezySubscriptionStatus, endsAt?: string | null) {
  if (status === 'active' || status === 'on_trial') return AISubscriptionStatus.ACTIVE;
  if (status === 'cancelled') {
    const endDate = parseDate(endsAt);
    return endDate && endDate > new Date()
      ? AISubscriptionStatus.ACTIVE
      : AISubscriptionStatus.CANCELED;
  }
  if (status === 'past_due' || status === 'unpaid' || status === 'paused') return AISubscriptionStatus.PAST_DUE;
  if (status === 'expired') return AISubscriptionStatus.CANCELED;
  return AISubscriptionStatus.INACTIVE;
}

function verifyLemonSqueezySignature(rawBody: Buffer, signature: string, secret: string) {
  const digest = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  if (digest.length !== received.length || !timingSafeEqual(digest, received)) {
    throw new BadRequestException('Invalid Lemon Squeezy signature.');
  }
}

function normalizeCustomData(value?: Record<string, unknown>) {
  const custom = value ?? {};
  return {
    ownerType: stringValue(custom.ownerType),
    organizationId: stringValue(custom.organizationId),
    userId: stringValue(custom.userId),
    plan: stringValue(custom.plan),
    subscriptionId: stringValue(custom.subscriptionId),
  };
}

function shouldSyncRelatedSubscription(eventName: string) {
  return [
    'order_created',
    'order_refunded',
    'subscription_payment_failed',
    'subscription_payment_success',
    'subscription_payment_recovered',
    'subscription_payment_refunded',
    'subscription_plan_changed',
  ].includes(eventName);
}

function relatedSubscriptionId(payload: LemonSqueezyWebhookPayload) {
  const data = payload.data;
  const attributes = data?.attributes;
  if (!attributes || typeof attributes !== 'object') return undefined;

  return valueToString(
    attributes.subscription_id
    ?? attributes.subscription
    ?? attributes.first_order_item?.subscription_id
    ?? relationshipId(data),
  ) ?? undefined;
}

function relationshipId(resource: unknown) {
  const relationships = (resource as { relationships?: Record<string, unknown> } | undefined)?.relationships;
  const relationship = relationships?.subscription;
  if (!relationship || typeof relationship !== 'object') return undefined;
  const data = (relationship as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return undefined;
  return (data as { id?: unknown }).id;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new BadRequestException(`${name} is not configured.`);
  return value;
}

function checkoutExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2);
  return expiresAt.toISOString();
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',')[0].trim();
}

function requiredOrgId(user: User) {
  if (!user.organizationId) throw new BadRequestException('Organization context is required.');
  return user.organizationId;
}
