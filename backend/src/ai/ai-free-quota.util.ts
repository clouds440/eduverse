import { Role } from '@/prisma/prisma-client';
import { AI_FREE_ORG_ROLE_QUOTAS } from './ai.constants';

export function freeOrgMonthlyCredits() {
  return Object.values(AI_FREE_ORG_ROLE_QUOTAS).reduce(
    (sum, quota) => sum + Math.max(0, quota ?? 0),
    0,
  );
}

export function currentUtcMonthPeriod(now = new Date()) {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function freeOrgQuotaRoles() {
  return Object.keys(AI_FREE_ORG_ROLE_QUOTAS) as Role[];
}

export function getFreeOrgRoleMonthlyCredits(role?: Role | string | null) {
  if (!role) return null;
  return AI_FREE_ORG_ROLE_QUOTAS[role as Role] ?? 0;
}
