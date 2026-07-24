import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import {
  NOTIFICATIONS_SERVICE,
  type NotificationCreator,
} from '../notifications/notifications.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogInput } from './auth-internal.types';
import { getDetailsReason } from './auth-internal.utils';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: NotificationCreator,
  ) {}

  async recordEvent(action: string, input: AuditLogInput) {
    await this.prisma.auditLog.create({
      data: {
        action,
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        organizationId: input.organizationId,
        ip: input.ip,
        userAgent: input.userAgent,
        sessionId: input.sessionId,
        details: input.details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getLatestContactEmailVerificationReason(orgId: string) {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        action: 'contact_email_verification_requested',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { details: true },
    });

    for (const log of auditLogs) {
      const reason = getDetailsReason(log.details);
      if (reason === 'first_registration' || reason === 'contact_email_changed') {
        return reason;
      }
    }
    return null;
  }

  async notifySuspiciousLocation(input: {
    userId: string;
    role: Role;
    deviceId?: string;
    deviceName?: string;
    previousLocation: string;
    newLocation: string;
  }) {
    if (!(await this.allowsLoginPushNotification(input.userId))) return;

    await this.notificationsService.createNotification({
      userId: input.userId,
      title: 'Suspicious Activity Detected',
      body: `Your account was accessed from a new location (${input.newLocation}). Previous location: ${input.previousLocation}. If this wasn't you, please revoke this session in your settings.`,
      type: 'SECURITY',
      actionUrl: this.getAccountSecurityUrl(input),
      metadata: {
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        previousLocation: input.previousLocation,
        newLocation: input.newLocation,
        loginTime: new Date().toISOString(),
      },
    });
  }

  async notifyNewDevice(input: {
    userId: string;
    role: Role;
    deviceId?: string;
    deviceName?: string;
    ip: string;
    location: string | null;
    targetClientDeviceIds: string[];
  }) {
    if (!(await this.allowsLoginPushNotification(input.userId))) return;

    await this.notificationsService.createNotification({
      userId: input.userId,
      title: 'New Device Login',
      body: `A new device (${input.deviceName || 'Unknown Device'}) has logged into your account from ${input.location || 'Unknown Location'} (IP: ${input.ip}). If this wasn't you, please revoke this session in your settings.`,
      type: 'SECURITY',
      actionUrl: this.getAccountSecurityUrl(input),
      metadata: {
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        ip: input.ip,
        location: input.location,
        loginTime: new Date().toISOString(),
        targetClientDeviceIds: input.targetClientDeviceIds,
      },
    });
  }

  getAccountSecurityUrl(user: {
    userId?: string;
    id?: string;
    role: Role | string;
  }) {
    const id = user.userId || user.id || '';
    switch (user.role) {
      case Role.SUPER_ADMIN:
      case Role.PLATFORM_ADMIN:
        return '/admin/settings#sessions';
      case Role.TEACHER:
      case Role.ORG_MANAGER:
        return `/teacher/${id}/profile#sessions`;
      case Role.STUDENT:
        return `/student/${id}?tab=profile#sessions`;
      case Role.SUB_ADMIN:
        return `/sub-admin/${id}/profile#sessions`;
      case Role.FINANCE_MANAGER:
        return `/finance-manager/${id}/profile#sessions`;
      case Role.GUARDIAN:
        return '/guardian?view=profile';
      default:
        return '/settings#sessions';
    }
  }

  private async allowsLoginPushNotification(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { loginNotificationPush: true },
    });
    return settings?.loginNotificationPush ?? true;
  }
}
