import { Injectable } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

type MappableActivityLog = {
  id: string;
  type: string;
  action: string;
  actorUserId: string | null;
  targetUserId: string | null;
  module: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceTitle: string | null;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  details: Prisma.JsonValue | null;
  createdAt: Date;
  organization?: {
    id: string;
    name: string;
    logoUrl: string | null;
    avatarUpdatedAt: Date | null;
  } | null;
  financeStructureId?: string | null;
  financeEntryId?: string | null;
  paymentClaimId?: string | null;
  transactionId?: string | null;
};

@Injectable()
export class ActivityLogMapperService {
  constructor(private readonly prisma: PrismaService) {}

  async map(logs: MappableActivityLog[]) {
    const userIds = Array.from(
      new Set(
        logs
          .flatMap((log) => [log.actorUserId, log.targetUserId])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const sessionIds = Array.from(
      new Set(logs.map((log) => log.sessionId).filter((id): id is string => Boolean(id))),
    );

    const [users, sessions] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : [],
      sessionIds.length
        ? this.prisma.session.findMany({
            where: { id: { in: sessionIds } },
            select: {
              id: true,
              deviceName: true,
              deviceType: true,
              browser: true,
              os: true,
              ip: true,
              location: true,
            },
          })
        : [],
    ]);

    const userMap = new Map(users.map((user) => [user.id, user] as const));
    const sessionMap = new Map(sessions.map((session) => [session.id, session] as const));

    return logs.map((log) => {
      const actor = log.actorUserId ? userMap.get(log.actorUserId) : null;
      const target = log.targetUserId ? userMap.get(log.targetUserId) : null;
      const session = log.sessionId ? sessionMap.get(log.sessionId) : null;
      return {
        id: log.id,
        type: log.type,
        action: log.action,
        message: this.humanize(log.action, {
          actorName: actor?.name || actor?.email || null,
          targetName: target?.name || target?.email || null,
          organizationName: log.organization?.name || this.getDetailsString(log.details, 'organizationName'),
          details: log.details,
        }),
        actor,
        target,
        organization: log.organization ?? null,
        module: log.module,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceTitle: log.resourceTitle || this.getDetailsString(log.details, 'organizationName'),
        financeStructureId: log.financeStructureId ?? null,
        financeEntryId: log.financeEntryId ?? null,
        paymentClaimId: log.paymentClaimId ?? null,
        transactionId: log.transactionId ?? null,
        ip: log.ip || session?.ip || null,
        userAgent: log.userAgent,
        sessionId: log.sessionId,
        device: session
          ? {
              name: session.deviceName,
              type: session.deviceType,
              browser: session.browser,
              os: session.os,
            }
          : null,
        location: session?.location || null,
        details: log.details,
        createdAt: log.createdAt,
      };
    });
  }

  private getDetailsString(details: Prisma.JsonValue | null, key: string) {
    if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
    const value = (details as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  }

  private humanize(
    action: string,
    context: {
      actorName?: string | null;
      targetName?: string | null;
      organizationName?: string | null;
      details?: Prisma.JsonValue;
    },
  ) {
    const actor = context.actorName || 'Someone';
    const target = context.targetName || 'an account';
    const org = context.organizationName || 'an organization';
    const details =
      context.details && typeof context.details === 'object' && !Array.isArray(context.details)
        ? (context.details as Record<string, unknown>)
        : null;
    const reason =
      typeof details?.reason === 'string'
        ? details.reason.replace(/_/g, ' ')
        : null;

    switch (action) {
      case 'contact_email_verification_requested':
        return `A verification code was sent for ${org}'s contact email.`;
      case 'contact_email_verified':
        return `${org}'s contact email was verified.`;
      case 'contact_email_verification_failed':
        return `${actor} failed contact email verification for ${org}${reason ? ` because ${reason}` : ''}.`;
      case 'password_reset_requested':
        return `A password reset was requested.`;
      case 'password_reset_completed':
        return `${target}'s password reset was completed and active sessions were revoked.`;
      case 'password_reset_failed':
        return `A password reset attempt failed for ${target}${reason ? ` because ${reason}` : ''}.`;
      case 'excessive_reset_attempts':
        return `Excessive password reset attempts were detected.`;
      case 'organization_registered':
        return `${org} registered and is waiting for verification and approval.`;
      case 'login_success':
        return `${actor} signed in successfully.`;
      case 'login_failed':
        return `A sign-in attempt failed for ${target}${reason ? ` because ${reason}` : ''}.`;
      case 'organization_contact_email_recovered':
        return `${actor} changed the recovery contact email for ${org}.`;
      case 'organization_deleted':
        return `${actor} permanently deleted ${org}.`;
      default:
        return action
          .split('_')
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
    }
  }
}
