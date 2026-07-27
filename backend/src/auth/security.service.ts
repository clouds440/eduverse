import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import {
  NOTIFICATIONS_SERVICE,
  type NotificationCreator,
} from '../notifications/notifications.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogInput } from './auth-internal.types';
import { getDetailsReason } from './auth-internal.utils';
import { EmailService } from '../security/email.service';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
import { UserSettingsContextService } from './user-settings-context.service';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: NotificationCreator,
    @Optional() private readonly emailService?: EmailService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly templates?: EmailTemplateService,
    @Optional()
    private readonly settingsContext?: UserSettingsContextService,
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
    const title = 'Sign-in from a new location';
    const body = `Your account was accessed from ${input.newLocation}. Your previous location was ${input.previousLocation}.`;
    await this.deliverLoginAlert(input, {
      title,
      body,
      location: input.newLocation,
      metadata: {
          deviceId: input.deviceId ?? null,
          deviceName: input.deviceName ?? null,
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
    await this.deliverLoginAlert(input, {
      title: 'New device sign-in',
      body: `${input.deviceName || 'A new device'} signed in from ${input.location || 'an unknown location'}.`,
      location: input.location,
      ip: input.ip,
      metadata: {
        deviceId: input.deviceId ?? null,
        deviceName: input.deviceName ?? null,
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

  private async deliverLoginAlert(
    user: {
      userId: string;
      role: Role;
      deviceName?: string;
    },
    alert: {
      title: string;
      body: string;
      location?: string | null;
      ip?: string | null;
      metadata: Prisma.JsonObject;
    },
  ) {
    const preferences = await this.getLoginNotificationPreferences(user.userId);
    if (!preferences) return;

    const securityPath = this.getAccountSecurityUrl(user);
    const deliveries: Promise<unknown>[] = [];

    if (preferences.push) {
      deliveries.push(
        this.notificationsService.createNotification({
          userId: user.userId,
          title: alert.title,
          body: `${alert.body} If this wasn't you, review your sessions.`,
          type: 'SECURITY',
          actionUrl: securityPath,
          metadata: alert.metadata,
        }),
      );
    }

    if (
      preferences.email &&
      preferences.emailAddress &&
      this.emailService &&
      this.templates
    ) {
      const appBaseUrl =
        this.configService?.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';
      const securityUrl = new URL(securityPath, appBaseUrl).toString();
      const email = this.templates.buildLoginSecurityAlertEmail({
        appBaseUrl,
        title: alert.title,
        summary: `${alert.body} If this wasn't you, review your sessions and sign out devices you do not recognize.`,
        deviceName: user.deviceName,
        location: alert.location,
        ip: alert.ip,
        securityUrl,
      });
      deliveries.push(
        this.emailService.send({
          to: preferences.emailAddress,
          ...email,
        }),
      );
    }

    const results = await Promise.allSettled(deliveries);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Security alert delivery failed for ${user.userId}`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    }
  }

  /**
   * One policy read supplies every login-alert channel. Future login security
   * events should call deliverLoginAlert instead of querying UserSettings.
   */
  private async getLoginNotificationPreferences(userId: string) {
    const context =
      (await this.settingsContext?.get(userId)) ??
      (await new UserSettingsContextService(this.prisma).get(userId));
    if (!context) return null;
    return {
      emailAddress: context.user.email,
      email: context.settings.loginNotificationEmail,
      push: context.settings.loginNotificationPush,
    };
  }
}
