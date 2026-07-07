import { AILimitMode, AISubscriptionPlan, Role } from '@/prisma/prisma-client';

export const AI_PLAN_CONFIG: Record<
  AISubscriptionPlan,
  { label: string; monthlyCredits: number; limitMode: AILimitMode; description: string }
> = {
  [AISubscriptionPlan.NONE]: {
    label: 'No AI',
    monthlyCredits: 0,
    limitMode: AILimitMode.HARD,
    description: 'EduVerse AI Copilot disabled.',
  },
  [AISubscriptionPlan.STARTER]: {
    label: 'Starter',
    monthlyCredits: 500,
    limitMode: AILimitMode.HARD,
    description: 'Light monthly Copilot usage for focused productivity workflows.',
  },
  [AISubscriptionPlan.GROWTH]: {
    label: 'Growth',
    monthlyCredits: 2000,
    limitMode: AILimitMode.HARD,
    description: 'More Copilot capacity for staff and selected learner workflows.',
  },
  [AISubscriptionPlan.SCALE]: {
    label: 'Scale',
    monthlyCredits: 8000,
    limitMode: AILimitMode.SOFT,
    description: 'High-volume Copilot access with soft-limit overage tracking.',
  },
};

export const AI_STUDENT_GUARDIAN_ACCESS_WARNING =
  'Allowing students or guardians to use Copilot can increase monthly AI Credit usage and subscription costs.';

export const AI_DEFAULT_ROLE_CREDIT_CAPS: Partial<Record<Role, number>> = {
  [Role.ORG_ADMIN]: 500,
  [Role.SUB_ADMIN]: 250,
  [Role.ORG_MANAGER]: 250,
  [Role.FINANCE_MANAGER]: 150,
  [Role.TEACHER]: 200,
  [Role.STUDENT]: 80,
  [Role.GUARDIAN]: 50,
};

export const AI_ORG_ACCESS_ROLES = [
  Role.SUB_ADMIN,
  Role.ORG_MANAGER,
  Role.FINANCE_MANAGER,
  Role.TEACHER,
  Role.STUDENT,
  Role.GUARDIAN,
] as const;

export const AI_SUPPORTED_USER_STATUSES = new Set(['ACTIVE', 'ON_LEAVE']);
