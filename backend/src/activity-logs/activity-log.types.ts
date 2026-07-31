import { ActivityLogType, Prisma } from '@/prisma/prisma-client';

export { ActivityLogType };

export interface ActivityLogRecordInput {
  type?: ActivityLogType;
  action: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  module?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceTitle?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  details?: Record<string, unknown> | Prisma.JsonObject | null;
}

export interface OrganizationActivityLogRecordInput
  extends ActivityLogRecordInput {
  organizationId: string;
  financeStructureId?: string | null;
  financeEntryId?: string | null;
  paymentClaimId?: string | null;
  transactionId?: string | null;
}

export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  type?: ActivityLogType | 'ALL' | string;
}

export function resolveActivityLogType(
  action: string,
  explicit?: ActivityLogType | null,
): ActivityLogType {
  if (explicit) return explicit;
  if (action.startsWith('finance_')) return ActivityLogType.FINANCE;
  if (action.includes('mail') || action.includes('contact_reply')) {
    return ActivityLogType.COMMUNICATION;
  }
  if (action.includes('ai_') || action.includes('copilot')) {
    return ActivityLogType.AI;
  }
  if (
    action.includes('login') ||
    action.includes('password') ||
    action.includes('two_factor') ||
    action.includes('verification') ||
    action.includes('security') ||
    action.includes('session') ||
    action.includes('device')
  ) {
    return ActivityLogType.SECURITY;
  }
  if (action.includes('organization_') || action.includes('admin')) {
    return ActivityLogType.ADMIN;
  }
  return ActivityLogType.SYSTEM;
}

export function isActivityLogType(value: string | undefined): value is ActivityLogType {
  return !!value && Object.values(ActivityLogType).includes(value as ActivityLogType);
}
