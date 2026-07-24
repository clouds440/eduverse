import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { OrgStatus, Role, UserStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { AuditLogInput, RequestMetadata } from './auth-internal.types';
import { hashSecret } from './auth-internal.utils';
import { EmailTemplateService } from './email-template.service';
import { SecurityService } from './security.service';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly templates: EmailTemplateService,
    private readonly securityService: SecurityService,
  ) {}

  async resendContactEmailVerification(
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      sessionId?: string;
    },
    meta: RequestMetadata,
  ) {
    this.assertOrganizationAdmin(user);
    await this.issueContactEmailVerification(user.organizationId!, {
      ...meta,
      actorUserId: user.id,
      targetUserId: user.id,
      organizationId: user.organizationId!,
      sessionId: user.sessionId,
    });
    return {
      message: 'Verification code sent. Please check your contact email.',
    };
  }

  async verifyContactEmail(
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      sessionId?: string;
    },
    code: string,
    meta: RequestMetadata,
  ) {
    this.assertOrganizationAdmin(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId! },
      select: {
        id: true,
        name: true,
        status: true,
        contactEmail: true,
        contactEmailVerifiedAt: true,
        contactEmailVerificationCodeHash: true,
        contactEmailVerificationExpiresAt: true,
        contactEmailVerificationAttempts: true,
      },
    });
    if (!org) throw new BadRequestException('Organization not found');
    if (org.contactEmailVerifiedAt) {
      return { message: 'Contact email is already verified.' };
    }
    if (
      !org.contactEmailVerificationCodeHash ||
      !org.contactEmailVerificationExpiresAt ||
      org.contactEmailVerificationExpiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Verification code expired. Please request a new code.',
      );
    }
    if (org.contactEmailVerificationAttempts >= 5) {
      await this.securityService.recordEvent(
        'contact_email_verification_failed',
        {
          ...meta,
          actorUserId: user.id,
          targetUserId: user.id,
          organizationId: user.organizationId!,
          sessionId: user.sessionId,
          details: { reason: 'too_many_attempts' },
        },
      );
      throw new HttpException(
        'Too many incorrect attempts. Please resend a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (hashSecret(code) !== org.contactEmailVerificationCodeHash) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { contactEmailVerificationAttempts: { increment: 1 } },
      });
      await this.securityService.recordEvent(
        'contact_email_verification_failed',
        {
          ...meta,
          actorUserId: user.id,
          targetUserId: user.id,
          organizationId: user.organizationId!,
          sessionId: user.sessionId,
          details: { reason: 'invalid_code' },
        },
      );
      throw new BadRequestException('Invalid verification code.');
    }

    const reason =
      await this.securityService.getLatestContactEmailVerificationReason(org.id);
    const shouldNotifyPlatformAdmins =
      org.status === OrgStatus.PENDING && reason === 'first_registration';
    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        contactEmailVerifiedAt: new Date(),
        contactEmailVerificationCodeHash: null,
        contactEmailVerificationExpiresAt: null,
        contactEmailVerificationAttempts: 0,
      },
    });
    await this.securityService.recordEvent('contact_email_verified', {
      ...meta,
      actorUserId: user.id,
      targetUserId: user.id,
      organizationId: user.organizationId!,
      sessionId: user.sessionId,
    });
    if (shouldNotifyPlatformAdmins) {
      await this.sendPendingOrganizationVerifiedEmail({
        organizationId: org.id,
        organizationName: org.name,
        contactEmail: org.contactEmail,
      }).catch((error) => {
        this.logger.error(
          `Failed to notify platform admins for verified pending org ${org.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }
    return { message: 'Contact email verified successfully.' };
  }

  async issueContactEmailVerification(
    orgId: string,
    audit: AuditLogInput,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        contactEmailVerifiedAt: true,
        lastVerificationSentAt: true,
        logoUrl: true,
      },
    });
    if (!org) throw new BadRequestException('Organization not found');
    if (org.contactEmailVerifiedAt) return;
    if (
      org.lastVerificationSentAt &&
      Date.now() - org.lastVerificationSentAt.getTime() < 60_000
    ) {
      throw new HttpException(
        'Please wait before resending a verification code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        contactEmailVerificationCodeHash: hashSecret(code),
        contactEmailVerificationExpiresAt: expiresAt,
        contactEmailVerificationAttempts: 0,
        lastVerificationSentAt: new Date(),
      },
    });
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const email = this.templates.buildContactEmailVerificationEmail({
      appBaseUrl,
      code,
      organizationName: org.name,
      contactEmail: org.contactEmail,
      organizationLogoUrl: this.templates.getSafeAssetUrl(
        org.logoUrl,
        appBaseUrl,
      ),
      reason:
        typeof audit.details?.reason === 'string'
          ? audit.details.reason
          : null,
    });
    await this.emailService.send({
      to: org.contactEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    await this.securityService.recordEvent(
      'contact_email_verification_requested',
      audit,
    );
  }

  private assertOrganizationAdmin(user: {
    role: string;
    organizationId?: string | null;
  }) {
    if (user.role !== Role.ORG_ADMIN || !user.organizationId) {
      throw new UnauthorizedException(
        'Only organization admins can verify contact email',
      );
    }
  }

  private async sendPendingOrganizationVerifiedEmail(input: {
    organizationId: string;
    organizationName: string;
    contactEmail: string;
  }) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.SUPER_ADMIN, Role.PLATFORM_ADMIN] },
        status: UserStatus.ACTIVE,
      },
      select: { email: true },
    });
    if (admins.length === 0) return;
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const actionUrl = `${appBaseUrl}/admin/organizations`;
    const email = this.templates.buildPendingOrganizationVerifiedEmail({
      ...input,
      appBaseUrl,
      actionUrl,
    });
    const results = await Promise.allSettled(
      admins.map((admin) =>
        this.emailService.send({
          to: admin.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      ),
    );
    const failedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;
    if (failedCount > 0) {
      this.logger.warn(
        `Failed to send ${failedCount} pending organization verification alert email(s) for org ${input.organizationId}`,
      );
    }
  }
}
