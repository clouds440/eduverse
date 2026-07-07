import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AISubscriptionOwnerType,
  AISubscriptionPlan,
  AISubscriptionStatus,
  Role,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_DEFAULT_ROLE_CREDIT_CAPS,
  AI_ORG_ACCESS_ROLES,
  AI_PLAN_CONFIG,
} from './ai.constants';
import type { AISubscriptionTarget } from './ai.types';

interface AIOrgAccessPolicyUpdate {
  allowSubAdmins?: boolean;
  allowManagers?: boolean;
  allowFinanceManagers?: boolean;
  allowTeachers?: boolean;
  allowStudents?: boolean;
  allowGuardians?: boolean;
}

interface AISubscriptionPlanFields {
  plan: AISubscriptionPlan;
  status: AISubscriptionStatus;
  monthlyCredits: number;
  limitMode: (typeof AI_PLAN_CONFIG)[AISubscriptionPlan]['limitMode'];
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

@Injectable()
export class AISubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  getPlanConfig(plan: AISubscriptionPlan) {
    return AI_PLAN_CONFIG[plan];
  }

  async getOrgSubscription(organizationId: string) {
    return this.prisma.aISubscription.findFirst({
      where: { ownerType: AISubscriptionOwnerType.ORGANIZATION, organizationId },
    });
  }

  async getPersonalSubscription(userId: string) {
    return this.prisma.aISubscription.findFirst({
      where: { ownerType: AISubscriptionOwnerType.USER, userId },
    });
  }

  async getOrCreateOrgSubscription(organizationId: string) {
    const existing = await this.getOrgSubscription(organizationId);
    if (existing) return existing;

    return this.prisma.aISubscription.create({
      data: {
        ownerType: AISubscriptionOwnerType.ORGANIZATION,
        organizationId,
        plan: AISubscriptionPlan.NONE,
        status: AISubscriptionStatus.INACTIVE,
        monthlyCredits: AI_PLAN_CONFIG[AISubscriptionPlan.NONE].monthlyCredits,
        limitMode: AI_PLAN_CONFIG[AISubscriptionPlan.NONE].limitMode,
      },
    });
  }

  async getOrCreatePersonalSubscription(userId: string, organizationId?: string | null) {
    const existing = await this.getPersonalSubscription(userId);
    if (existing) return existing;

    return this.prisma.aISubscription.create({
      data: {
        ownerType: AISubscriptionOwnerType.USER,
        userId,
        organizationId: organizationId ?? null,
        plan: AISubscriptionPlan.NONE,
        status: AISubscriptionStatus.INACTIVE,
        monthlyCredits: AI_PLAN_CONFIG[AISubscriptionPlan.NONE].monthlyCredits,
        limitMode: AI_PLAN_CONFIG[AISubscriptionPlan.NONE].limitMode,
      },
    });
  }

  async updatePlan(target: AISubscriptionTarget, plan: AISubscriptionPlan) {
    const data = this.buildPlanUpdate(plan);

    if (target.ownerType === AISubscriptionOwnerType.ORGANIZATION) {
      if (!target.organizationId) {
        throw new BadRequestException('organizationId is required for organization AI subscriptions');
      }

      return this.prisma.aISubscription.upsert({
        where: {
          ownerType_organizationId: {
            ownerType: AISubscriptionOwnerType.ORGANIZATION,
            organizationId: target.organizationId,
          },
        },
        create: {
          ownerType: AISubscriptionOwnerType.ORGANIZATION,
          organizationId: target.organizationId,
          ...data,
        },
        update: data,
      });
    }

    if (!target.userId) {
      throw new BadRequestException('userId is required for personal AI subscriptions');
    }

    return this.prisma.aISubscription.upsert({
      where: {
        ownerType_userId: {
          ownerType: AISubscriptionOwnerType.USER,
          userId: target.userId,
        },
      },
      create: {
        ownerType: AISubscriptionOwnerType.USER,
        userId: target.userId,
        organizationId: target.organizationId ?? null,
        ...data,
      },
      update: {
        ...data,
        organizationId: target.organizationId ?? undefined,
      },
    });
  }

  async getOrCreateOrgAccessPolicy(organizationId: string) {
    return this.prisma.aIOrgAccessPolicy.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
  }

  async updateOrgAccessPolicy(organizationId: string, data: AIOrgAccessPolicyUpdate) {
    return this.prisma.aIOrgAccessPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  async getOrCreateRoleCreditPolicies(organizationId: string) {
    await Promise.all(
      Object.entries(AI_DEFAULT_ROLE_CREDIT_CAPS).map(([role, monthlyCredits]) =>
        this.prisma.aIRoleCreditPolicy.upsert({
          where: { organizationId_role: { organizationId, role: role as Role } },
          create: { organizationId, role: role as Role, monthlyCredits: monthlyCredits ?? 0 },
          update: {},
        }),
      ),
    );

    return this.prisma.aIRoleCreditPolicy.findMany({
      where: { organizationId },
      orderBy: { role: 'asc' },
    });
  }

  async getRoleMonthlyCredits(organizationId: string, role?: Role | string | null) {
    if (!role) return null;
    const normalizedRole = role as Role;
    const policy = await this.prisma.aIRoleCreditPolicy.findUnique({
      where: { organizationId_role: { organizationId, role: normalizedRole } },
    });

    if (policy) return policy.monthlyCredits;
    return AI_DEFAULT_ROLE_CREDIT_CAPS[normalizedRole] ?? null;
  }

  async updateRoleCreditPolicy(organizationId: string, role: Role, monthlyCredits: number) {
    return this.prisma.aIRoleCreditPolicy.upsert({
      where: { organizationId_role: { organizationId, role } },
      create: { organizationId, role, monthlyCredits },
      update: { monthlyCredits },
    });
  }

  canUseOrgSubscriptionForRole(
    policy: {
      allowSubAdmins: boolean;
      allowManagers: boolean;
      allowFinanceManagers: boolean;
      allowTeachers: boolean;
      allowStudents: boolean;
      allowGuardians: boolean;
    },
    role?: Role | string | null,
  ) {
    if (!role) return false;
    if (role === Role.ORG_ADMIN) return true;
    if (role === Role.SUB_ADMIN) return policy.allowSubAdmins;
    if (role === Role.ORG_MANAGER) return policy.allowManagers;
    if (role === Role.FINANCE_MANAGER) return policy.allowFinanceManagers;
    if (role === Role.TEACHER) return policy.allowTeachers;
    if (role === Role.STUDENT) return policy.allowStudents;
    if (role === Role.GUARDIAN) return policy.allowGuardians;
    return false;
  }

  getOrgAccessRoles() {
    return AI_ORG_ACCESS_ROLES;
  }

  private buildPlanUpdate(plan: AISubscriptionPlan): AISubscriptionPlanFields {
    const config = AI_PLAN_CONFIG[plan];
    return {
      plan,
      status: plan === AISubscriptionPlan.NONE
        ? AISubscriptionStatus.INACTIVE
        : AISubscriptionStatus.ACTIVE,
      monthlyCredits: config.monthlyCredits,
      limitMode: config.limitMode,
      currentPeriodStart: plan === AISubscriptionPlan.NONE ? null : new Date(),
      currentPeriodEnd: plan === AISubscriptionPlan.NONE
        ? null
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }
}
