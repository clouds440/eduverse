import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Role } from '../common/enums';
import { BCRYPT_ROUNDS } from '../common/utils';
import {
  NOTIFICATIONS_SERVICE,
  type NotificationCreator,
} from '../notifications/notifications.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestMetadata } from './auth-internal.types';
import { hashSecret } from './auth-internal.utils';
import { EmailTemplateService } from './email-template.service';
import { SecurityService } from './security.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly forgotIpAttempts = new Map<string, number[]>();
  private readonly forgotEmailAttempts = new Map<string, number[]>();
  private readonly genericForgotMessage =
    'If an eligible account exists, password reset instructions will be sent.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly templates: EmailTemplateService,
    private readonly securityService: SecurityService,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: NotificationCreator,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMetadata) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const emailHash = hashSecret(normalizedEmail);
    if (
      !this.allowAttempt(
        this.forgotIpAttempts,
        meta.ip || 'unknown',
        5,
        15 * 60_000,
      )
    ) {
      await this.securityService.recordEvent('excessive_reset_attempts', {
        ...meta,
        details: { scope: 'ip', emailHash },
      });
      throw new HttpException(
        'Please wait before requesting another password reset.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      !this.allowAttempt(
        this.forgotEmailAttempts,
        normalizedEmail,
        3,
        60 * 60_000,
      )
    ) {
      await this.securityService.recordEvent('excessive_reset_attempts', {
        ...meta,
        details: { scope: 'email', emailHash },
      });
      return { message: this.genericForgotMessage };
    }

    const users = await this.prisma.user.findMany({
      where: {
        role: Role.ORG_ADMIN,
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          {
            organization: {
              contactEmail: { equals: normalizedEmail, mode: 'insensitive' },
            },
          },
        ],
      },
      include: { organization: true },
    });
    const requestedLoginMatches = users.filter(
      (user) => user.email.toLowerCase() === normalizedEmail,
    );
    const candidateUsers =
      requestedLoginMatches.length > 0 ? requestedLoginMatches : users;

    await this.securityService.recordEvent('password_reset_requested', {
      ...meta,
      targetUserId:
        candidateUsers.length === 1 ? candidateUsers[0].id : undefined,
      organizationId:
        candidateUsers.length === 1
          ? candidateUsers[0].organizationId ?? undefined
          : undefined,
      details: { emailHash, matchCount: candidateUsers.length },
    });

    const eligibleUsers = candidateUsers.filter(
      (user) =>
        user.role === Role.ORG_ADMIN &&
        user.organization?.contactEmailVerifiedAt &&
        user.organization.contactEmail,
    );
    if (eligibleUsers.length === 0) {
      await Promise.all(
        candidateUsers.map((user) =>
          this.securityService.recordEvent('password_reset_failed', {
            ...meta,
            targetUserId: user.id,
            organizationId: user.organizationId ?? undefined,
            details: {
              reason:
                user.role === Role.ORG_ADMIN
                  ? 'contact_email_unverified'
                  : 'automated_reset_not_available_for_role',
            },
          }),
        ),
      );
      return { message: this.genericForgotMessage };
    }

    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const resetOptions = await Promise.all(
      eligibleUsers.map(async (user) => {
        await this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        const rawToken = randomBytes(32).toString('hex');
        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashSecret(rawToken),
            expiresAt,
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
        });
        return {
          adminEmail: user.email,
          organizationName: user.organization!.name,
          organizationLogoUrl: this.templates.getSafeAssetUrl(
            user.organization!.logoUrl,
            appBaseUrl,
          ),
          resetUrl: `${appBaseUrl}/reset-password?token=${rawToken}`,
        };
      }),
    );
    const recipient =
      requestedLoginMatches.length > 0
        ? eligibleUsers[0].organization!.contactEmail
        : normalizedEmail;
    const email = this.templates.buildPasswordResetEmail({
      recipient,
      appBaseUrl,
      options: resetOptions,
      expiresAt,
    });
    await this.emailService.send({
      to: recipient,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return { message: this.genericForgotMessage };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMetadata) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashSecret(dto.token) },
      include: { user: { include: { organization: true } } },
    });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      await this.securityService.recordEvent('password_reset_failed', {
        ...meta,
        targetUserId: resetToken?.userId,
        organizationId: resetToken?.user.organizationId ?? undefined,
        details: { reason: 'invalid_or_expired_token' },
      });
      throw new BadRequestException(
        'Password reset link is invalid or expired.',
      );
    }
    const hashedNew = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedNew, isFirstLogin: false },
      });
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId: resetToken.userId, isActive: true },
        data: { isActive: false },
      });
    });
    await this.securityService.recordEvent('password_reset_completed', {
      ...meta,
      targetUserId: resetToken.userId,
      organizationId: resetToken.user.organizationId ?? undefined,
    });
    await this.notificationsService.createNotification({
      userId: resetToken.userId,
      title: 'Password reset completed',
      body: 'Your EduVerse password was reset. All active sessions were signed out.',
      type: 'SECURITY',
      actionUrl: this.securityService.getAccountSecurityUrl(resetToken.user),
    });
    return {
      message:
        'Password reset successful. Please sign in with your new password.',
    };
  }

  async generateManagedUserPasswordResetLink(
    actor: { id: string; role?: string; organizationId?: string | null },
    targetUserId: string,
    meta: RequestMetadata,
  ) {
    if (!actor.organizationId) {
      throw new ForbiddenException('Organization context is required.');
    }
    if (actor.role !== Role.ORG_ADMIN && actor.role !== Role.SUB_ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to generate password reset links.',
      );
    }
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: actor.organizationId },
      include: { organization: true },
    });
    if (!targetUser) throw new NotFoundException('User not found.');
    const targetRole = targetUser.role as Role;
    const resettableRoles = new Set<Role>([
      Role.TEACHER,
      Role.ORG_MANAGER,
      Role.STUDENT,
      Role.FINANCE_MANAGER,
      Role.SUB_ADMIN,
    ]);
    if (!resettableRoles.has(targetRole)) {
      throw new ForbiddenException(
        'Password reset links can only be generated for organization users.',
      );
    }
    if (targetRole === Role.SUB_ADMIN && actor.role !== Role.ORG_ADMIN) {
      throw new ForbiddenException(
        'Only the main organization admin can reset sub-admin passwords.',
      );
    }
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: targetUser.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
    await this.prisma.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        tokenHash: hashSecret(rawToken),
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    let emailSent = false;
    let emailWarning: string | undefined;
    const email = this.templates.buildManagedPasswordResetEmail({
      appBaseUrl,
      resetUrl,
      expiresAt,
      userName: targetUser.name || targetUser.email,
      organizationName: targetUser.organization?.name || 'your organization',
      organizationLogoUrl: this.templates.getSafeAssetUrl(
        targetUser.organization?.logoUrl,
        appBaseUrl,
      ),
    });
    try {
      const delivery = await this.emailService.send({
        to: targetUser.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      emailSent = !(
        delivery &&
        typeof delivery === 'object' &&
        'skipped' in delivery
      );
      if (!emailSent) {
        emailWarning =
          'The reset link was copied, but EduVerse could not send email right now. Share the copied link with the user directly.';
      }
    } catch (error) {
      emailWarning =
        'The reset link was copied, but EduVerse could not deliver the email. Share the copied link with the user directly.';
      this.logger.warn(
        `Failed to email managed reset link to ${targetUser.email}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
    await this.securityService.recordEvent(
      'managed_password_reset_link_generated',
      {
        ...meta,
        actorUserId: actor.id,
        targetUserId: targetUser.id,
        organizationId: actor.organizationId,
        details: { targetRole, emailSent },
      },
    );
    return {
      resetUrl,
      expiresAt,
      emailSent,
      message: emailSent
        ? 'Password reset link copied. EduVerse also emailed it to the user.'
        : emailWarning,
      warning: emailWarning,
    };
  }

  private allowAttempt(
    bucket: Map<string, number[]>,
    key: string,
    limit: number,
    windowMs: number,
  ) {
    const now = Date.now();
    const attempts = (bucket.get(key) || []).filter(
      (timestamp) => now - timestamp < windowMs,
    );
    if (attempts.length >= limit) {
      bucket.set(key, attempts);
      return false;
    }
    attempts.push(now);
    bucket.set(key, attempts);
    return true;
  }
}
