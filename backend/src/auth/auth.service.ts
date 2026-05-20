import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, Organization, Teacher, ThemeMode } from '@prisma/client';
import { Role, OrgStatus, UserStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../common/utils';
import { resolveAccessLevel } from '../common/access-control/access.utils';
import { EmailService } from '../security/email.service';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export type TokenUser = User & {
  organization?: Organization | null;
  teacherProfile?: Teacher | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: Date | null;
  themeMode?: ThemeMode | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly forgotIpAttempts = new Map<string, number[]>();
  private readonly forgotEmailAttempts = new Map<string, number[]>();
  private readonly genericForgotMessage =
    'If an eligible account exists, password reset instructions will be sent.';

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });
    if (existing) {
      throw new UnauthorizedException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      BCRYPT_ROUNDS,
    );

    // Transaction to ensure both Org and User are created
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: registerDto.name,
          location: registerDto.location,
          type: registerDto.type,
          contactEmail: registerDto.contactEmail,
          phone: registerDto.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          role: Role.ORG_ADMIN,
          organizationId: org.id,
          name: registerDto.adminName, // Set name to Admin Name for ORG_ADMIN
        },
      });

      return { org, user };
    });

    await this.issueContactEmailVerification(result.org.id, {
      targetUserId: result.user.id,
      organizationId: result.org.id,
      details: { reason: 'first_registration' },
    }).catch((error) => {
      this.logger.error(
        `Failed to send contact email verification for org ${result.org.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    });

    return {
      id: result.user.id,
      email: result.user.email,
      orgName: result.org.name,
      message:
        'Registration successful. Please verify your contact email before approval can continue.',
    };
  }

  async login(loginDto: LoginDto, ip: string = 'unknown') {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: { organization: true, teacherProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'DELETED') {
      throw new UnauthorizedException(
        'Your account has been deleted by your organization',
      );
    }

    // Cleanup old inactive sessions for this user (older than 90 days)
    await this.cleanupOldSessions(user.id);

    const rememberMe = loginDto.rememberMe === true;
    const sessionLoginDto = loginDto.deviceId
      ? loginDto
      : {
          ...loginDto,
          deviceId: `fallback-${randomBytes(16).toString('hex')}`,
          deviceName: 'Unknown device',
          deviceType: 'unknown',
          browser: 'Unknown',
          os: 'Unknown',
        };

    return this.generateToken(user, rememberMe, sessionLoginDto, ip);
  }

  async generateToken(
    user: TokenUser,
    rememberMe: boolean = false,
    loginDto?: LoginDto,
    ip: string = 'unknown',
  ) {
    const payload = {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name, // Include name in JWT payload
      role: user.role,
      designation: user.teacherProfile?.designation || null, // Added for teacher personalization
      orgName: user.organization?.name || null,
      orgId: user.organizationId,
      orgLogoUrl: user.organization?.logoUrl || null,
      contactEmailVerifiedAt:
        user.organization?.contactEmailVerifiedAt?.toISOString() || null,
      avatarUrl: user.avatarUrl || null,
      avatarUpdatedAt: user.avatarUpdatedAt || null,
      themeMode: user.themeMode ?? ThemeMode.SYSTEM,
      status: user.organization ? user.organization.status : OrgStatus.APPROVED, // Keep SUPER_ADMIN as APPROVED
      userStatus: user.status as unknown as UserStatus,
      accessLevel: resolveAccessLevel({
        userStatus: user.status as unknown as UserStatus,
        orgStatus: (user.organization?.status as unknown as OrgStatus) || OrgStatus.APPROVED,
      }),
      isFirstLogin: user.isFirstLogin,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: rememberMe ? '30d' : '1d',
    });

    // Create session if deviceId is provided
    if (loginDto?.deviceId) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 1));

      // Get location (country only) from IP (simple lookup)
      let location: string | null = null;
      if (ip !== 'unknown') {
        try {
          // Using a free IP geolocation API
          const response = await fetch(`http://ip-api.com/json/${ip}`);
          const data = await response.json();
          if (data.status === 'success') {
            location = data.country;
          }
        } catch (error) {
          // Silently fail location lookup
          console.warn('Failed to lookup location from IP:', error);
        }
      }

      // Check if this device already has an active session
      const existingSession = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          deviceId: loginDto.deviceId,
          isActive: true,
        },
      });

      if (existingSession) {
        // Check for country change (suspicious activity)
        const countryChanged = existingSession.location && location && existingSession.location !== location;

        // Update existing session (IP binding removed to support mobile users with changing IPs)
        await this.prisma.session.update({
          where: { id: existingSession.id },
          data: {
            token,
            lastSeenAt: new Date(),
            expiresAt,
            deviceName: loginDto.deviceName,
            deviceType: loginDto.deviceType,
            ip,
            location,
          },
        });

        // Send notification if country changed (suspicious activity)
        if (countryChanged) {
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              title: 'Suspicious Activity Detected',
              body: `Your account was accessed from a new location (${location}). Previous location: ${existingSession.location}. If this wasn't you, please revoke this session in your settings.`,
              type: 'SECURITY',
              actionUrl: '/settings#sessions',
              metadata: {
                deviceId: loginDto.deviceId,
                deviceName: loginDto.deviceName,
                previousLocation: existingSession.location,
                newLocation: location,
                loginTime: new Date().toISOString(),
              },
            },
          });
        }
      } else {
        // Check if this is a new device (first time seeing this deviceId)
        const deviceSessions = await this.prisma.session.findMany({
          where: { userId: user.id },
          select: { deviceId: true, ip: true, location: true },
        });
        const isNewDevice = !deviceSessions.some(
          (s) => s.deviceId === loginDto.deviceId,
        );
        const isFirstLogin = deviceSessions.length === 0;

        // Create new session
        await this.prisma.session.create({
          data: {
            userId: user.id,
            deviceId: loginDto.deviceId,
            deviceName: loginDto.deviceName,
            deviceType: loginDto.deviceType,
            browser: loginDto.browser,
            os: loginDto.os,
            token,
            expiresAt,
            ip,
            location,
          },
        });

        // Send notification if this is a new device (but not on first ever login)
        if (isNewDevice && !isFirstLogin) {
          await this.prisma.notification.create({
            data: {
              userId: user.id,
              title: 'New Device Login',
              body: `A new device (${loginDto.deviceName || 'Unknown Device'}) has logged into your account from ${location || 'Unknown Location'} (IP: ${ip}). If this wasn't you, please revoke this session in your settings.`,
              type: 'SECURITY',
              actionUrl: '/settings#sessions',
              metadata: {
                deviceId: loginDto.deviceId,
                deviceName: loginDto.deviceName,
                ip,
                location,
                loginTime: new Date().toISOString(),
              },
            },
          });
        }
      }
    }

    return {
      access_token: token,
      role: user.role,
      status: user.status as unknown as UserStatus,
      accessLevel: resolveAccessLevel({
        userStatus: user.status as unknown as UserStatus,
        orgStatus: (user.organization?.status as unknown as OrgStatus) || OrgStatus.APPROVED,
      }),
    };
  }

  async updateProfile(
    userId: string,
    data: Partial<{ themeMode: 'LIGHT' | 'DARK' | 'SYSTEM'; name?: string }>,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        themeMode: data.themeMode,
        name: data.name,
      },
      include: { organization: true, teacherProfile: true },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      organization: updated.organization,
      teacherProfile: updated.teacherProfile,
      themeMode: updated.themeMode,
    };
  }

  async changePassword(userId: string, oldPass: string, newPass: string, currentToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect old password');
    }

    const hashedNew = await bcrypt.hash(newPass, BCRYPT_ROUNDS);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNew,
        isFirstLogin: false,
      },
      include: { organization: true, teacherProfile: true },
    });

    // Issue a NEW token so the isFirstLogin: false change is reflected in the JWT payload
    const { access_token: newToken } = await this.generateToken(updatedUser, true);

    // Update the session in database if it exists
    if (currentToken) {
      await this.prisma.session.updateMany({
        where: {
          userId,
          token: currentToken,
          isActive: true,
        },
        data: {
          token: newToken,
          lastSeenAt: new Date(),
        },
      });

      // Revoke all other sessions
      await this.prisma.session.updateMany({
        where: {
          userId,
          token: { not: newToken },
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    return {
      access_token: newToken,
      role: updatedUser.role,
      status: updatedUser.status as unknown as UserStatus,
      accessLevel: resolveAccessLevel({
        userStatus: updatedUser.status as unknown as UserStatus,
        orgStatus: (updatedUser.organization?.status as unknown as OrgStatus) || OrgStatus.APPROVED,
      }),
    };
  }

  async logout(userId: string, token?: string) {
    if (token) {
      // Revoke only the current session
      const session = await this.prisma.session.findFirst({
        where: {
          userId,
          token,
          isActive: true,
        },
      });

      if (session) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { isActive: false },
        });
      }
    } else {
      // Fallback: revoke all sessions if no token provided
      await this.prisma.session.updateMany({
        where: { userId },
        data: { isActive: false },
      });
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * Cleanup old inactive sessions for a user
   * Removes inactive sessions older than 90 days
   */
  private async cleanupOldSessions(userId: string) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    await this.prisma.session.deleteMany({
      where: {
        userId,
        isActive: false,
        expiresAt: { lt: ninetyDaysAgo },
      },
    });
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions;
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentToken?: string,
  ) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // Check if trying to revoke current session
    if (currentToken && session.token === currentToken) {
      // Instead of revoking, return instruction to logout
      return {
        message: 'Cannot revoke current session. Please log out instead.',
        shouldLogout: true,
      };
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return { message: 'Session revoked successfully' };
  }

  async revokeAllSessions(userId: string, excludeToken?: string) {
    await this.prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        ...(excludeToken && { token: { not: excludeToken } }),
      },
      data: { isActive: false },
    });

    return { message: 'All sessions revoked successfully' };
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
    if (user.role !== Role.ORG_ADMIN || !user.organizationId) {
      throw new UnauthorizedException('Only organization admins can verify contact email');
    }

    await this.issueContactEmailVerification(user.organizationId, {
      ...meta,
      actorUserId: user.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
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
    if (user.role !== Role.ORG_ADMIN || !user.organizationId) {
      throw new UnauthorizedException('Only organization admins can verify contact email');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
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
      throw new BadRequestException('Verification code expired. Please request a new code.');
    }

    if (org.contactEmailVerificationAttempts >= 5) {
      await this.writeAuditLog('contact_email_verification_failed', {
        ...meta,
        actorUserId: user.id,
        targetUserId: user.id,
        organizationId: user.organizationId,
        sessionId: user.sessionId,
        details: { reason: 'too_many_attempts' },
      });
      throw new HttpException(
        'Too many incorrect attempts. Please resend a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.hashSecret(code) !== org.contactEmailVerificationCodeHash) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { contactEmailVerificationAttempts: { increment: 1 } },
      });
      await this.writeAuditLog('contact_email_verification_failed', {
        ...meta,
        actorUserId: user.id,
        targetUserId: user.id,
        organizationId: user.organizationId,
        sessionId: user.sessionId,
        details: { reason: 'invalid_code' },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        contactEmailVerifiedAt: new Date(),
        contactEmailVerificationCodeHash: null,
        contactEmailVerificationExpiresAt: null,
        contactEmailVerificationAttempts: 0,
      },
    });

    await this.writeAuditLog('contact_email_verified', {
      ...meta,
      actorUserId: user.id,
      targetUserId: user.id,
      organizationId: user.organizationId,
      sessionId: user.sessionId,
    });

    return { message: 'Contact email verified successfully.' };
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMetadata) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const emailHash = this.hashSecret(normalizedEmail);

    if (!this.allowAttempt(this.forgotIpAttempts, meta.ip || 'unknown', 5, 15 * 60_000)) {
      await this.writeAuditLog('excessive_reset_attempts', {
        ...meta,
        details: { scope: 'ip', emailHash },
      });
      throw new HttpException(
        'Please wait before requesting another password reset.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.allowAttempt(this.forgotEmailAttempts, normalizedEmail, 3, 60 * 60_000)) {
      await this.writeAuditLog('excessive_reset_attempts', {
        ...meta,
        details: { scope: 'email', emailHash },
      });
      return { message: this.genericForgotMessage };
    }

    const user = await this.prisma.user.findFirst({
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

    await this.writeAuditLog('password_reset_requested', {
      ...meta,
      targetUserId: user?.id,
      organizationId: user?.organizationId ?? undefined,
      details: { emailHash },
    });

    const eligible =
      user?.role === Role.ORG_ADMIN &&
      user.organization?.contactEmailVerifiedAt &&
      user.organization.contactEmail;

    if (!eligible || !user?.organization) {
      if (user) {
        await this.writeAuditLog('password_reset_failed', {
          ...meta,
          targetUserId: user.id,
          organizationId: user.organizationId ?? undefined,
          details: {
            reason:
              user.role === Role.ORG_ADMIN
                ? 'contact_email_unverified'
                : 'automated_reset_not_available_for_role',
          },
        });
      }
      return { message: this.genericForgotMessage };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashSecret(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60_000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const appUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const resetUrl = `${appUrl.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;

    await this.emailService.send({
      to: user.organization.contactEmail,
      subject: 'Reset your EduVerse password',
      text: [
        `A password reset was requested for ${user.organization.name}.`,
        `Open this link within 30 minutes to set a new password: ${resetUrl}`,
        'If you did not request this, you can ignore this email.',
      ].join('\n\n'),
      html: `
        <p>A password reset was requested for <strong>${this.escapeHtml(user.organization.name)}</strong>.</p>
        <p><a href="${this.escapeHtml(resetUrl)}">Reset your password</a></p>
        <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
      `,
    });

    return { message: this.genericForgotMessage };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMetadata) {
    const tokenHash = this.hashSecret(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { organization: true } } },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date() ||
      resetToken.user.role !== Role.ORG_ADMIN ||
      !resetToken.user.organization?.contactEmailVerifiedAt
    ) {
      await this.writeAuditLog('password_reset_failed', {
        ...meta,
        targetUserId: resetToken?.userId,
        organizationId: resetToken?.user.organizationId ?? undefined,
        details: { reason: 'invalid_or_expired_token' },
      });
      throw new BadRequestException('Password reset link is invalid or expired.');
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

    await this.writeAuditLog('password_reset_completed', {
      ...meta,
      targetUserId: resetToken.userId,
      organizationId: resetToken.user.organizationId ?? undefined,
    });

    await this.prisma.notification.create({
      data: {
        userId: resetToken.userId,
        title: 'Password reset completed',
        body: 'Your organization admin password was reset. All active sessions were signed out.',
        type: 'SECURITY',
        actionUrl: '/settings#sessions',
      },
    });

    return { message: 'Password reset successful. Please sign in with your new password.' };
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
      },
    });

    if (!org) throw new BadRequestException('Organization not found');
    if (org.contactEmailVerifiedAt) {
      return;
    }

    const cooldownMs = 60_000;
    if (
      org.lastVerificationSentAt &&
      Date.now() - org.lastVerificationSentAt.getTime() < cooldownMs
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
        contactEmailVerificationCodeHash: this.hashSecret(code),
        contactEmailVerificationExpiresAt: expiresAt,
        contactEmailVerificationAttempts: 0,
        lastVerificationSentAt: new Date(),
      },
    });

    const email = this.buildContactEmailVerificationEmail({
      code,
      organizationName: org.name,
      contactEmail: org.contactEmail,
      reason: this.getAuditReason(audit),
    });

    await this.emailService.send({
      to: org.contactEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    await this.writeAuditLog('contact_email_verification_requested', audit);
  }

  private hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private allowAttempt(
    bucket: Map<string, number[]>,
    key: string,
    limit: number,
    windowMs: number,
  ) {
    const now = Date.now();
    const attempts = (bucket.get(key) || []).filter((ts) => now - ts < windowMs);
    if (attempts.length >= limit) {
      bucket.set(key, attempts);
      return false;
    }
    attempts.push(now);
    bucket.set(key, attempts);
    return true;
  }

  private async writeAuditLog(action: string, input: AuditLogInput) {
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

  private getAuditReason(input: AuditLogInput) {
    return typeof input.details?.reason === 'string' ? input.details.reason : null;
  }

  private buildContactEmailVerificationEmail(input: {
    code: string;
    organizationName: string;
    contactEmail: string;
    reason: string | null;
  }) {
    const escapedOrgName = this.escapeHtml(input.organizationName);
    const escapedContactEmail = this.escapeHtml(input.contactEmail);
    const escapedCode = this.escapeHtml(input.code);

    if (input.reason === 'first_registration') {
      return {
        subject: `Welcome to EduVerse, ${input.organizationName}`,
        text: [
          `Welcome to EduVerse, ${input.organizationName}!`,
          'EduVerse helps your organization manage students, teachers, courses, schedules, attendance, communication, and academic records from one secure workspace.',
          'Before approval can continue, please verify this contact email. It will be used for password recovery, important organization notifications, and security communication.',
          `Your verification code is ${input.code}.`,
          'This code expires in 10 minutes.',
        ].join('\n\n'),
        html: `
          <p>Welcome to <strong>EduVerse</strong>, <strong>${escapedOrgName}</strong>!</p>
          <p>EduVerse helps your organization manage students, teachers, courses, schedules, attendance, communication, and academic records from one secure workspace.</p>
          <p>Before approval can continue, please verify this contact email. It will be used for password recovery, important organization notifications, and security communication.</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:4px">${escapedCode}</p>
          <p>This code expires in 10 minutes.</p>
        `,
      };
    }

    const intro = input.reason === 'contact_email_changed'
      ? `A new contact email was set for ${input.organizationName}.`
      : `Please verify the contact email for ${input.organizationName}.`;

    return {
      subject: `Verify ${input.organizationName}'s EduVerse contact email`,
      text: [
        intro,
        `Contact email: ${input.contactEmail}`,
        `Verification code: ${input.code}`,
        'This code expires in 10 minutes.',
      ].join('\n\n'),
      html: `
        <p>${this.escapeHtml(intro)}</p>
        <p>Contact email: <strong>${escapedContactEmail}</strong></p>
        <p style="font-size:24px;font-weight:700;letter-spacing:4px">${escapedCode}</p>
        <p>This code expires in 10 minutes.</p>
      `,
    };
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

interface AuditLogInput extends RequestMetadata {
  actorUserId?: string;
  targetUserId?: string;
  organizationId?: string;
  sessionId?: string;
  details?: Record<string, unknown>;
}
