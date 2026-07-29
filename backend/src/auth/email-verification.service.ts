import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { OrgStatus, Role } from '../common/enums';
import { LinkedAccountProvider } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { AuditLogInput, RequestMetadata } from './auth-internal.types';
import { hashSecret } from './auth-internal.utils';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
import { SecurityService } from './security.service';

const CONTACT_EMAIL_CHANGE_CODE_TTL_MS = 10 * 60_000;
const CONTACT_EMAIL_CHANGE_AUTH_TTL_MS = 15 * 60_000;
const CONTACT_EMAIL_CHANGE_RESEND_COOLDOWN_MS = 60_000;
const MAX_CONTACT_EMAIL_CHANGE_ATTEMPTS = 5;

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
    sessionId?: string;
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
        ...(await this.getContactEmailChangeAuthorizationState(user)),
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
      ...(await this.getContactEmailChangeAuthorizationState(user)),
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
    if (current.contactEmailVerifiedAt) {
      await this.assertContactEmailChangeAuthorized(user);
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
    if (current.contactEmailVerifiedAt) {
      await this.consumeContactEmailChangeAuthorization(user);
    }
    await this.issueUserContactEmailVerification(user, normalized);
    return this.getContactEmail(user);
  }

  async useLinkedGoogleContactEmail(user: {
    id: string;
    role: string;
    organizationId?: string | null;
    sessionId?: string;
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
    const current = await this.getCurrentContactEmail(user);
    if (
      current.verifiedAt &&
      current.email.toLowerCase() !== contactEmail
    ) {
      await this.assertContactEmailChangeAuthorized(user);
    }
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
    if (
      current.verifiedAt &&
      current.email.toLowerCase() !== contactEmail
    ) {
      await this.consumeContactEmailChangeAuthorization(user);
    }
    return this.getContactEmail(user);
  }

  async requestContactEmailChangeConfirmation(user: {
    id: string;
    role: string;
    organizationId?: string | null;
    sessionId?: string;
  }) {
    const current = await this.getCurrentContactEmail(user);
    if (!current.verifiedAt) {
      return {
        message: 'No current verified contact email needs confirmation.',
        required: false,
      };
    }
    const session = await this.getActiveSession(user);
    if (
      session.contactEmailChangeCodeSentAt &&
      Date.now() - session.contactEmailChangeCodeSentAt.getTime() <
        CONTACT_EMAIL_CHANGE_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Please wait before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        contactEmailChangeCodeHash: hashSecret(code),
        contactEmailChangeCodeExpiresAt: new Date(
          Date.now() + CONTACT_EMAIL_CHANGE_CODE_TTL_MS,
        ),
        contactEmailChangeCodeAttempts: 0,
        contactEmailChangeCodeSentAt: new Date(),
        contactEmailChangeAuthorizedAt: null,
      },
    });
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')[0]
      .replace(/\/+$/, '');
    const email = this.templates.buildContactEmailVerificationEmail({
      appBaseUrl,
      code,
      organizationName: current.accountName,
      contactEmail: current.email,
      organizationLogoUrl: this.templates.getSafeAssetUrl(
        current.logoUrl,
        appBaseUrl,
      ),
      reason: 'contact_email_change_confirmation',
    });
    await this.emailService.send({ to: current.email, ...email });
    await this.securityService.recordEvent(
      'contact_email_change_confirmation_requested',
      {
        actorUserId: user.id,
        targetUserId: user.id,
        organizationId: user.organizationId || undefined,
        sessionId: session.id,
      },
    );
    return {
      message: 'A confirmation code was sent to your current contact email.',
      required: true,
    };
  }

  async confirmContactEmailChange(
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      sessionId?: string;
    },
    code: string,
  ) {
    const session = await this.getActiveSession(user);
    if (
      !session.contactEmailChangeCodeHash ||
      !session.contactEmailChangeCodeExpiresAt ||
      session.contactEmailChangeCodeExpiresAt <= new Date()
    ) {
      throw new BadRequestException(
        'This confirmation code expired. Request a new code.',
      );
    }
    if (
      session.contactEmailChangeCodeAttempts >=
      MAX_CONTACT_EMAIL_CHANGE_ATTEMPTS
    ) {
      throw new HttpException(
        'Too many incorrect attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (hashSecret(code) !== session.contactEmailChangeCodeHash) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { contactEmailChangeCodeAttempts: { increment: 1 } },
      });
      throw new BadRequestException('That confirmation code is not correct.');
    }

    const authorizedAt = new Date();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        contactEmailChangeAuthorizedAt: authorizedAt,
        contactEmailChangeCodeHash: null,
        contactEmailChangeCodeExpiresAt: null,
        contactEmailChangeCodeAttempts: 0,
      },
    });
    await this.securityService.recordEvent(
      'contact_email_change_confirmed',
      {
        actorUserId: user.id,
        targetUserId: user.id,
        organizationId: user.organizationId || undefined,
        sessionId: session.id,
      },
    );
    return {
      message: 'Current email confirmed. You can now change it.',
      authorizedUntil: new Date(
        authorizedAt.getTime() + CONTACT_EMAIL_CHANGE_AUTH_TTL_MS,
      ).toISOString(),
    };
  }

  async assertContactEmailChangeAuthorized(user: {
    id: string;
    sessionId?: string;
  }) {
    const session = await this.getActiveSession(user);
    if (
      !session.contactEmailChangeAuthorizedAt ||
      Date.now() - session.contactEmailChangeAuthorizedAt.getTime() >
        CONTACT_EMAIL_CHANGE_AUTH_TTL_MS
    ) {
      throw new ForbiddenException(
        'Confirm the code sent to your current contact email before changing it.',
      );
    }
  }

  async consumeContactEmailChangeAuthorization(user: {
    id: string;
    sessionId?: string;
  }) {
    const session = await this.getActiveSession(user);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        contactEmailChangeAuthorizedAt: null,
        contactEmailChangeCodeHash: null,
        contactEmailChangeCodeExpiresAt: null,
        contactEmailChangeCodeAttempts: 0,
        contactEmailChangeCodeSentAt: null,
      },
    });
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

  private async getCurrentContactEmail(user: {
    id: string;
    role: string;
    organizationId?: string | null;
  }) {
    if (this.usesOrganizationContact(user)) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: user.organizationId! },
        select: {
          contactEmail: true,
          contactEmailVerifiedAt: true,
          name: true,
          logoUrl: true,
        },
      });
      if (!organization) {
        throw new BadRequestException('Organization not found.');
      }
      return {
        email: organization.contactEmail,
        verifiedAt: organization.contactEmailVerifiedAt,
        accountName: organization.name,
        logoUrl: organization.logoUrl,
      };
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        contactEmail: true,
        contactEmailVerifiedAt: true,
        name: true,
        organization: { select: { name: true, logoUrl: true } },
      },
    });
    if (!account) throw new BadRequestException('User not found.');
    return {
      email: account.contactEmail || '',
      verifiedAt: account.contactEmailVerifiedAt,
      accountName:
        account.organization?.name || account.name || 'your EduVerse account',
      logoUrl: account.organization?.logoUrl || null,
    };
  }

  private async getActiveSession(user: { id: string; sessionId?: string }) {
    if (!user.sessionId) {
      throw new ForbiddenException(
        'An active signed-in session is required to change the contact email.',
      );
    }
    const session = await this.prisma.session.findFirst({
      where: {
        id: user.sessionId,
        userId: user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        contactEmailChangeCodeHash: true,
        contactEmailChangeCodeExpiresAt: true,
        contactEmailChangeCodeAttempts: true,
        contactEmailChangeCodeSentAt: true,
        contactEmailChangeAuthorizedAt: true,
      },
    });
    if (!session) {
      throw new ForbiddenException(
        'This session is no longer active. Sign in and confirm your current email again.',
      );
    }
    return session;
  }

  private async getContactEmailChangeAuthorizationState(user: {
    id: string;
    sessionId?: string;
  }) {
    if (!user.sessionId) {
      return {
        changeAuthorizedUntil: null,
      };
    }
    const session = await this.prisma.session.findFirst({
      where: { id: user.sessionId, userId: user.id, isActive: true },
      select: { contactEmailChangeAuthorizedAt: true },
    });
    const authorizedAt = session?.contactEmailChangeAuthorizedAt;
    const authorizedUntil = authorizedAt
      ? new Date(
          authorizedAt.getTime() + CONTACT_EMAIL_CHANGE_AUTH_TTL_MS,
        )
      : null;
    return {
      changeAuthorizedUntil:
        authorizedUntil && authorizedUntil > new Date()
          ? authorizedUntil.toISOString()
          : null,
    };
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
    const superAdminEmail = this.configService.get<string>('SUPER_ADMIN_EMAIL');
    if (!superAdminEmail) {
      this.logger.warn(
        `SUPER_ADMIN_EMAIL is not configured; skipped pending organization alert for ${input.organizationId}`,
      );
      return;
    }
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const actionUrl = `${appBaseUrl}/admin/organizations`;
    const email = this.templates.buildPendingOrganizationVerifiedEmail({
      ...input,
      appBaseUrl,
      actionUrl,
    });
    await this.emailService.send({
      to: superAdminEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }
}
