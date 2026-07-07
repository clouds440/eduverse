import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  AISubscriptionOwnerType,
  AISubscriptionPlan,
  AISubscriptionStatus,
  User,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_PLAN_CONFIG } from './ai.constants';
import { AISubscriptionService } from './ai-subscription.service';

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

    const stripe = this.stripe();
    const customerId = subscription.stripeCustomerId
      ?? await this.createCustomer({
        email: organization.contactEmail || actor.email,
        name: organization.name,
        metadata: {
          ownerType: AISubscriptionOwnerType.ORGANIZATION,
          organizationId,
        },
      });
    const priceId = this.priceId(AISubscriptionOwnerType.ORGANIZATION, plan);
    await this.prisma.aISubscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customerId, stripePriceId: priceId },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendBaseUrl()}/ai?ai_billing=success`,
      cancel_url: `${frontendBaseUrl()}/settings?ai_billing=cancelled`,
      client_reference_id: organizationId,
      metadata: {
        ownerType: AISubscriptionOwnerType.ORGANIZATION,
        organizationId,
        plan,
        subscriptionId: subscription.id,
      },
      subscription_data: {
        metadata: {
          ownerType: AISubscriptionOwnerType.ORGANIZATION,
          organizationId,
          plan,
          subscriptionId: subscription.id,
        },
      },
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async createPersonalCheckoutSession(user: User, plan: AISubscriptionPlan) {
    if (plan === AISubscriptionPlan.NONE) {
      throw new BadRequestException('Use the billing portal or cancel flow for disabling a paid AI subscription.');
    }

    const subscription = await this.subscriptionService.getOrCreatePersonalSubscription(
      user.id,
      user.organizationId,
    );
    const stripe = this.stripe();
    const customerId = subscription.stripeCustomerId
      ?? await this.createCustomer({
        email: user.email,
        name: user.name ?? user.email,
        metadata: {
          ownerType: AISubscriptionOwnerType.USER,
          userId: user.id,
          organizationId: user.organizationId ?? '',
        },
      });
    const priceId = this.priceId(AISubscriptionOwnerType.USER, plan);
    await this.prisma.aISubscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customerId, stripePriceId: priceId },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendBaseUrl()}/ai?ai_billing=success`,
      cancel_url: `${frontendBaseUrl()}/ai?ai_billing=cancelled`,
      client_reference_id: user.id,
      metadata: {
        ownerType: AISubscriptionOwnerType.USER,
        userId: user.id,
        organizationId: user.organizationId ?? '',
        plan,
        subscriptionId: subscription.id,
      },
      subscription_data: {
        metadata: {
          ownerType: AISubscriptionOwnerType.USER,
          userId: user.id,
          organizationId: user.organizationId ?? '',
          plan,
          subscriptionId: subscription.id,
        },
      },
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async createPortalSession(user: User, ownerType: AISubscriptionOwnerType, returnPath?: string) {
    const subscription = ownerType === AISubscriptionOwnerType.ORGANIZATION
      ? await this.subscriptionService.getOrCreateOrgSubscription(requiredOrgId(user))
      : await this.subscriptionService.getOrCreatePersonalSubscription(user.id, user.organizationId);

    if (!subscription.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer exists for this AI subscription yet.');
    }

    const session = await this.stripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${frontendBaseUrl()}${returnPath?.startsWith('/') ? returnPath : '/ai'}`,
    });

    return { portalUrl: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature?: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured.');
    if (!signature) throw new BadRequestException('Missing Stripe signature.');

    const event = this.stripe().webhooks.constructEvent(rawBody, signature, secret);

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      await this.syncStripeSubscription(event.data.object as Stripe.Subscription);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode !== 'subscription' || !session.subscription) return;
    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;
    const subscription = await this.stripe().subscriptions.retrieve(stripeSubscriptionId);
    await this.syncStripeSubscription(subscription, session.metadata ?? undefined);
  }

  private async syncStripeSubscription(
    stripeSubscription: Stripe.Subscription,
    metadataOverride?: Stripe.Metadata | null,
  ) {
    const metadata = metadataOverride ?? stripeSubscription.metadata ?? {};
    const ownerType = metadata.ownerType as AISubscriptionOwnerType | undefined;
    const plan = this.planFromStripe(stripeSubscription, metadata.plan);
    const firstItem = stripeSubscription.items.data[0];
    const periodStart = timestampToDate((stripeSubscription as any).current_period_start ?? (firstItem as any)?.current_period_start);
    const periodEnd = timestampToDate((stripeSubscription as any).current_period_end ?? (firstItem as any)?.current_period_end);
    const stripePriceId = firstItem?.price?.id ?? null;
    const stripeCustomerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id ?? null;
    const data = {
      plan,
      status: stripeStatusToAIStatus(stripeSubscription.status),
      monthlyCredits: AI_PLAN_CONFIG[plan].monthlyCredits,
      limitMode: AI_PLAN_CONFIG[plan].limitMode,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId,
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

  private async createCustomer(input: {
    email?: string | null;
    name?: string | null;
    metadata: Record<string, string>;
  }) {
    const customer = await this.stripe().customers.create({
      email: input.email ?? undefined,
      name: input.name ?? undefined,
      metadata: input.metadata,
    });
    return customer.id;
  }

  private stripe() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) throw new BadRequestException('STRIPE_SECRET_KEY is not configured.');
    return new Stripe(apiKey);
  }

  private priceId(ownerType: AISubscriptionOwnerType, plan: AISubscriptionPlan) {
    const prefix = ownerType === AISubscriptionOwnerType.ORGANIZATION ? 'ORG' : 'PERSONAL';
    const specific = process.env[`STRIPE_AI_${prefix}_${plan}_PRICE_ID`];
    const fallback = process.env[`STRIPE_AI_${plan}_PRICE_ID`];
    const priceId = specific ?? fallback;
    if (!priceId) {
      throw new BadRequestException(`Stripe price id is not configured for ${prefix} ${plan}.`);
    }
    return priceId;
  }

  private planFromStripe(stripeSubscription: Stripe.Subscription, metadataPlan?: string) {
    if (metadataPlan && metadataPlan in AISubscriptionPlan) {
      return metadataPlan as AISubscriptionPlan;
    }

    const priceId = stripeSubscription.items.data[0]?.price?.id;
    const matched = Object.values(AISubscriptionPlan).find((plan) =>
      plan !== AISubscriptionPlan.NONE
      && [
        process.env[`STRIPE_AI_ORG_${plan}_PRICE_ID`],
        process.env[`STRIPE_AI_PERSONAL_${plan}_PRICE_ID`],
        process.env[`STRIPE_AI_${plan}_PRICE_ID`],
      ].includes(priceId),
    );

    return matched ?? AISubscriptionPlan.NONE;
  }
}

function stripeStatusToAIStatus(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'trialing') return AISubscriptionStatus.ACTIVE;
  if (status === 'canceled' || status === 'incomplete_expired') return AISubscriptionStatus.CANCELED;
  if (status === 'past_due' || status === 'unpaid') return AISubscriptionStatus.PAST_DUE;
  return AISubscriptionStatus.INACTIVE;
}

function timestampToDate(value?: number | null) {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',')[0].trim();
}

function requiredOrgId(user: User) {
  if (!user.organizationId) throw new BadRequestException('Organization context is required.');
  return user.organizationId;
}
