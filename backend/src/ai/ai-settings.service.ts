import { Injectable } from '@nestjs/common';
import {
  AISubscriptionOwnerType,
  AISubscriptionPlan,
  AIUsageSourceType,
  Role,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_ORG_ACCESS_ROLES,
  AI_PLAN_CONFIG,
  AI_STUDENT_GUARDIAN_ACCESS_WARNING,
} from './ai.constants';
import { AISubscriptionService } from './ai-subscription.service';
import { AIUsageService } from './ai-usage.service';

@Injectable()
export class AISettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: AISubscriptionService,
    private readonly usageService: AIUsageService,
  ) {}

  async getOrgSettings(organizationId: string) {
    const [subscription, accessPolicy, roleCreditPolicies] = await Promise.all([
      this.subscriptionService.getOrCreateOrgSubscription(organizationId),
      this.subscriptionService.getOrCreateOrgAccessPolicy(organizationId),
      this.subscriptionService.getOrCreateRoleCreditPolicies(organizationId),
    ]);
    const balance = await this.usageService.getSubscriptionBalance(subscription);

    return {
      plans: this.getPlanOptions(),
      subscription,
      accessPolicy,
      roleCreditPolicies,
      usage: balance,
      orgAccessRoles: AI_ORG_ACCESS_ROLES,
      warning: AI_STUDENT_GUARDIAN_ACCESS_WARNING,
    };
  }

  async updateOrgSubscription(organizationId: string, plan: AISubscriptionPlan) {
    await this.subscriptionService.updatePlan(
      { ownerType: AISubscriptionOwnerType.ORGANIZATION, organizationId },
      plan,
    );
    return this.getOrgSettings(organizationId);
  }

  async updateOrgAccessPolicy(
    organizationId: string,
    data: {
      allowSubAdmins?: boolean;
      allowManagers?: boolean;
      allowFinanceManagers?: boolean;
      allowTeachers?: boolean;
      allowStudents?: boolean;
      allowGuardians?: boolean;
    },
  ) {
    await this.subscriptionService.updateOrgAccessPolicy(organizationId, data);
    return this.getOrgSettings(organizationId);
  }

  async updateRoleCreditPolicy(organizationId: string, role: Role, monthlyCredits: number) {
    await this.subscriptionService.updateRoleCreditPolicy(organizationId, role, monthlyCredits);
    return this.getOrgSettings(organizationId);
  }

  async getOrgUsage(organizationId: string) {
    const subscription = await this.subscriptionService.getOrCreateOrgSubscription(organizationId);
    const balance = await this.usageService.getSubscriptionBalance(subscription);
    const usageRows = await this.prisma.aIUsage.findMany({
      where: {
        subscriptionId: subscription.id,
        periodStart: balance.periodStart,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { creditUsed: 'desc' },
    });
    const toolLogs = await this.prisma.aIToolCallLog.findMany({
      where: {
        orgId: organizationId,
        createdAt: {
          gte: balance.periodStart,
          lt: balance.periodEnd,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    return {
      subscription,
      usage: balance,
      topUsers: usageRows.slice(0, 10).map((row) => ({
        userId: row.userId,
        name: row.user?.name ?? 'Unknown user',
        email: row.user?.email ?? null,
        role: row.role ?? row.user?.role ?? null,
        creditsUsed: row.creditUsed,
        providerTokenEstimate: row.providerTokenEstimate,
        estimatedCost: Number(row.estimatedCost ?? 0),
        overageCredits: row.overageCredits,
      })),
      roleUsage: this.aggregateRoleUsage(usageRows),
      featureUsage: this.aggregateToolUsage(toolLogs),
      estimatedCost: usageRows.reduce((sum, row) => sum + Number(row.estimatedCost ?? 0), 0),
      trends: this.buildDailyTrends(usageRows),
    };
  }

  async getPersonalSettings(userId: string, organizationId?: string | null) {
    const subscription = await this.subscriptionService.getOrCreatePersonalSubscription(
      userId,
      organizationId,
    );
    const balance = await this.usageService.getSubscriptionBalance(subscription);

    return {
      plans: this.getPlanOptions(),
      subscription,
      usage: balance,
    };
  }

  async updatePersonalSubscription(
    userId: string,
    organizationId: string | null | undefined,
    plan: AISubscriptionPlan,
  ) {
    await this.subscriptionService.updatePlan(
      { ownerType: AISubscriptionOwnerType.USER, userId, organizationId },
      plan,
    );
    return this.getPersonalSettings(userId, organizationId);
  }

  async getPersonalUsage(userId: string, organizationId?: string | null) {
    const subscription = await this.subscriptionService.getOrCreatePersonalSubscription(
      userId,
      organizationId,
    );
    const balance = await this.usageService.getSubscriptionBalance(subscription);
    const usage = await this.prisma.aIUsage.findMany({
      where: {
        subscriptionId: subscription.id,
        userId,
        sourceType: AIUsageSourceType.PERSONAL,
        periodStart: balance.periodStart,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const toolLogs = await this.prisma.aIToolCallLog.findMany({
      where: {
        subscriptionId: subscription.id,
        userId,
        sourceType: AIUsageSourceType.PERSONAL,
        createdAt: {
          gte: balance.periodStart,
          lt: balance.periodEnd,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      subscription,
      usage: balance,
      estimatedCost: usage.reduce((sum, row) => sum + Number(row.estimatedCost ?? 0), 0),
      featureUsage: this.aggregateToolUsage(toolLogs),
      trends: this.buildDailyTrends(usage),
    };
  }

  private getPlanOptions() {
    return Object.values(AISubscriptionPlan).map((plan) => ({
      plan,
      ...AI_PLAN_CONFIG[plan],
    }));
  }

  private aggregateRoleUsage(
    usageRows: Array<{
      role: Role | null;
      creditUsed: number;
      providerTokenEstimate: number;
      estimatedCost: unknown;
      overageCredits: number;
      user?: { role: Role } | null;
    }>,
  ) {
    const roleMap = new Map<
      string,
      {
        role: string | null;
        creditsUsed: number;
        providerTokenEstimate: number;
        estimatedCost: number;
        overageCredits: number;
      }
    >();

    for (const row of usageRows) {
      const role = row.role ?? row.user?.role ?? null;
      const key = role ?? 'UNKNOWN';
      const current = roleMap.get(key) ?? {
        role,
        creditsUsed: 0,
        providerTokenEstimate: 0,
        estimatedCost: 0,
        overageCredits: 0,
      };
      current.creditsUsed += row.creditUsed;
      current.providerTokenEstimate += row.providerTokenEstimate;
      current.estimatedCost += Number(row.estimatedCost ?? 0);
      current.overageCredits += row.overageCredits;
      roleMap.set(key, current);
    }

    return [...roleMap.values()].sort((a, b) => b.creditsUsed - a.creditsUsed);
  }

  private aggregateToolUsage(
    toolLogs: Array<{ toolName: string; allowed: boolean; creditEstimate: number | null }>,
  ) {
    const toolMap = new Map<
      string,
      { toolName: string; calls: number; allowed: number; denied: number; creditEstimate: number }
    >();

    for (const log of toolLogs) {
      const current = toolMap.get(log.toolName) ?? {
        toolName: log.toolName,
        calls: 0,
        allowed: 0,
        denied: 0,
        creditEstimate: 0,
      };
      current.calls += 1;
      current.allowed += log.allowed ? 1 : 0;
      current.denied += log.allowed ? 0 : 1;
      current.creditEstimate += log.creditEstimate ?? 0;
      toolMap.set(log.toolName, current);
    }

    return [...toolMap.values()].sort((a, b) => b.calls - a.calls).slice(0, 12);
  }

  private buildDailyTrends(usageRows: Array<{ updatedAt: Date; creditUsed: number }>) {
    const trendMap = new Map<string, { date: string; creditsUsed: number }>();

    for (const row of usageRows) {
      const date = row.updatedAt.toISOString().slice(0, 10);
      const current = trendMap.get(date) ?? { date, creditsUsed: 0 };
      current.creditsUsed += row.creditUsed;
      trendMap.set(date, current);
    }

    return [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
