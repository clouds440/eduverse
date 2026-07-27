import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { OrgStatus, Role, UserStatus } from '../common/enums';
import { LinkedAccountProvider } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { AuditLogInput, RequestMetadata } from './auth-internal.types';
import { hashSecret } from './auth-internal.utils';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
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

  async getContactEmail(user: {
    id: string;
    role: string;
    organizationId?: string | null;
  }) {
    if (this.usesOrganizationContact(user)) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: user.organizationId! },
        select: { contactEmail: true, contactEmailVerifiedAt: true },
      });
      if (!organization) throw new BadRequestException('Organization not found');
      return {
        contactEmail: organization.contactEmail,
        contactEmailVerifiedAt:
          organization.contactEmailVerifiedAt?.toISOString() || null,
        managedByOrganization: true,
      };
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { contactEmail: true, contactEmailVerifiedAt: true },
    });
    if (!account) throw new BadRequestException('User not found');
    return {
      contactEmail: account.contactEmail,
      contactEmailVerifiedAt:
        account.contactEmailVerifiedAt?.toISOString() || null,
      managedByOrganization: false,
    };
  }

  async updateContactEmail(
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      sessionId?: string;
    },
    contactEmail: string,
  ) {
    if (this.usesOrganizationContact(user)) {
      throw new BadRequestException(
        'Update the organization contact email from the Profile tab.',
      );
    }
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        contactEmail: true,
        contactEmailVerifiedAt: true,
        settings: { select: { deviceTwoFactorEnabled: true } },
      },
    });
    if (!current) throw new BadRequestException('User not found');
    const normalized = contactEmail.trim().toLowerCase();
    if (
      current.contactEmail?.toLowerCase() === normalized &&
      current.contactEmailVerifiedAt
    ) {
      return this.getContactEmail(user);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        contactEmail: normalized,
        contactEmailVerifiedAt: null,
        contactEmailVerificationCodeHash: null,
        contactEmailVerificationExpiresAt: null,
        contactEmailVerificationAttempts: 0,
        lastContactEmailVerificationSentAt: null,
      },
    });
    await this.prisma.userSettings.updateMany({
      where: { userId: user.id },
      data: {
        emailTwoFactorEnabled: false,
        twoFactorEnabled: current.settings?.deviceTwoFactorEnabled || false,
        twoFactorMethod: 'DEVICE',
      },
    });
    await this.issueUserContactEmailVerification(user, normalized);
    return this.getContactEmail(user);
  }

  async useLinkedGoogleContactEmail(user: {
    id: string;
    role: string;
    organizationId?: string | null;
  }) {
    const linked = await this.prisma.linkedAccount.findFirst({
      where: {
        userId: user.id,
        provider: LinkedAccountProvider.GOOGLE,
        email: { not: null },
      },
      select: { email: true },
    });
    const contactEmail = linked?.email?.trim().toLowerCase();
    if (!contactEmail) {
      throw new BadRequestException(
        'Link a Google account with an email address first.',
      );
    }
    const verifiedAt = new Date();
    if (this.usesOrganizationContact(user)) {
      await this.prisma.organization.update({
        where: { id: user.organizationId! },
        data: {
          contactEmail,
          contactEmailVerifiedAt: verifiedAt,
          contactEmailVerificationCodeHash: null,
          contactEmailVerificationExpiresAt: null,
          contactEmailVerificationAttempts: 0,
          lastVerificationSentAt: null,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          contactEmail,
          contactEmailVerifiedAt: verifiedAt,
          contactEmailVerificationCodeHash: null,
          contactEmailVerificationExpiresAt: null,
          contactEmailVerificationAttempts: 0,
          lastContactEmailVerificationSentAt: null,
        },
      });
    }
    return this.getContactEmail(user);
  }

  async resendContactEmailVerification(
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      sessionId?: string;
    },
    meta: RequestMetadata,
  ) {
    if (!this.usesOrganizationContact(user)) {
      const account = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { contactEmail: true },
      });
      if (!account?.contactEmail) {
        throw new BadRequestException('Add a contact email first.');
      }
      await this.issueUserContactEmailVerification(user, account.contactEmail);
      return {
        message: 'Verification code sent. Please check your contact email.',
      };
    }
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
    if (!this.usesOrganizationContact(user)) {
      return this.verifyUserContactEmail(user, code, meta);
    }
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

  private usesOrganizationContact(user: {
    role: string;
    organizationId?: string | null;
  }) {
    return user.role === Role.ORG_ADMIN && Boolean(user.organizationId);
  }

  private async issueUserContactEmailVerification(
    user: { id: string; organizationId?: string | null; sessionId?: string },
    contactEmail: string,
  ) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        contactEmailVerifiedAt: true,
        lastContactEmailVerificationSentAt: true,
        organization: { select: { name: true, logoUrl: true } },
      },
    });
    if (!account) throw new BadRequestException('User not found');
    if (account.contactEmailVerifiedAt) return;
    if (
      account.lastContactEmailVerificationSentAt &&
      Date.now() - account.lastContactEmailVerificationSentAt.getTime() < 60_000
    ) {
      throw new HttpException(
        'Please wait before resending a verification code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        contactEmailVerificationCodeHash: hashSecret(code),
        contactEmailVerificationExpiresAt: expiresAt,
        contactEmailVerificationAttempts: 0,
        lastContactEmailVerificationSentAt: new Date(),
      },
    });
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const email = this.templates.buildContactEmailVerificationEmail({
      appBaseUrl,
      code,
      organizationName:
        account.organization?.name || account.name || 'your EduVerse account',
      contactEmail,
      organizationLogoUrl: this.templates.getSafeAssetUrl(
        account.organization?.logoUrl,
        appBaseUrl,
      ),
      reason: 'account_contact_email',
    });
    await this.emailService.send({
      to: contactEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    await this.securityService.recordEvent(
      'contact_email_verification_requested',
      {
        actorUserId: user.id,
        targetUserId: user.id,
        organizationId: user.organizationId || undefined,
        sessionId: user.sessionId,
        details: { reason: 'account_contact_email' },
      },
    );
  }

  private async verifyUserContactEmail(
    user: {
      id: string;
      organizationId?: string | null;
      sessionId?: string;
    },
    code: string,
    meta: RequestMetadata,
  ) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        contactEmail: true,
        contactEmailVerifiedAt: true,
        contactEmailVerificationCodeHash: true,
        contactEmailVerificationExpiresAt: true,
        contactEmailVerificationAttempts: true,
      },
    });
    if (!account?.contactEmail) throw new BadRequestException('Add a contact email first.');
    if (account.contactEmailVerifiedAt) {
      return { message: 'Contact email is already verified.' };
    }
    if (
      !account.contactEmailVerificationCodeHash ||
      !account.contactEmailVerificationExpiresAt ||
      account.contactEmailVerificationExpiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'Verification code expired. Please request a new code.',
      );
    }
    if (account.contactEmailVerificationAttempts >= 5) {
      throw new HttpException(
        'Too many incorrect attempts. Please resend a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (hashSecret(code) !== account.contactEmailVerificationCodeHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { contactEmailVerificationAttempts: { increment: 1 } },
      });
      await this.securityService.recordEvent(
        'contact_email_verification_failed',
        {
          ...meta,
          actorUserId: user.id,
          targetUserId: user.id,
          organizationId: user.organizationId || undefined,
          sessionId: user.sessionId,
          details: { reason: 'invalid_code' },
        },
      );
      throw new BadRequestException('Invalid verification code.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
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
      organizationId: user.organizationId || undefined,
      sessionId: user.sessionId,
    });
    return { message: 'Contact email verified successfully.' };
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
