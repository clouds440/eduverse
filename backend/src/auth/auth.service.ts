import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  LinkedAccountProvider,
  Prisma,
  User,
  Organization,
  Teacher,
  ThemeMode,
} from '@prisma/client';
import { Role, OrgStatus, UserStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../common/utils';
import { resolveAccessLevel } from '../common/access-control/access.utils';
import { EmailService } from '../security/email.service';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  NOTIFICATIONS_SERVICE,
  type NotificationCreator,
} from '../notifications/notifications.tokens';

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
    @Inject(NOTIFICATIONS_SERVICE)
    private notificationsService: NotificationCreator,
  ) {}

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
    loginDto?: SessionDeviceInput,
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
          await this.notificationsService.createNotification({
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
          await this.notificationsService.createNotification({
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

  async getGoogleAuthorizationUrl(
    purpose: GoogleOAuthPurpose,
    options: {
      userId?: string;
      device?: SessionDeviceInput;
      returnTo?: string;
    } = {},
  ) {
    const config = this.getGoogleConfig();
    const state = await this.jwtService.signAsync(
      {
        purpose,
        userId: options.userId,
        device: options.device,
        returnTo: this.sanitizeFrontendPath(options.returnTo),
        nonce: randomBytes(16).toString('hex'),
      } satisfies GoogleOAuthState,
      {
        secret: this.getGoogleStateSecret(),
        expiresIn: '10m',
      },
    );

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(input: {
    code?: string;
    state?: string;
    currentToken?: string;
    ip?: string;
  }) {
    if (!input.code || !input.state) {
      throw new BadRequestException('Google sign-in was cancelled or incomplete.');
    }

    const state = await this.verifyGoogleState(input.state);
    const googleIdentity = await this.verifyGoogleCode(input.code);

    if (state.purpose === 'link') {
      if (!state.userId) {
        throw new BadRequestException('Invalid Google link state.');
      }
      if (!input.currentToken) {
        throw new UnauthorizedException('Please log in before linking Google.');
      }

      await this.assertTokenBelongsToUser(input.currentToken, state.userId);
      await this.linkGoogleAccount(state.userId, googleIdentity);

      return {
        purpose: state.purpose,
        redirectUrl: this.buildFrontendRedirect('/settings', {
          googleLink: 'success',
        }, 'linked-accounts'),
      };
    }

    const result = await this.loginWithGoogle(
      googleIdentity.providerAccountId,
      state.device,
      input.ip,
    );

    return {
      purpose: state.purpose,
      access_token: result.access_token,
      rememberMe: state.device?.rememberMe === true,
      redirectUrl: this.buildFrontendRedirect(state.returnTo || '/login', {
        google: 'success',
      }),
    };
  }

  async getLinkedAccounts(userId: string) {
    const accounts = await this.prisma.linkedAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        provider: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return accounts.map((account) => ({
      ...account,
      provider: account.provider.toLowerCase(),
    }));
  }

  async unlinkGoogleAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.password) {
      throw new BadRequestException(
        'Cannot unlink Google until another login method is available.',
      );
    }

    await this.prisma.linkedAccount.deleteMany({
      where: {
        userId,
        provider: LinkedAccountProvider.GOOGLE,
      },
    });

    return { message: 'Google account unlinked successfully.' };
  }

  private async loginWithGoogle(
    providerAccountId: string,
    device?: SessionDeviceInput,
    ip = 'unknown',
  ) {
    const linkedAccount = await this.prisma.linkedAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: LinkedAccountProvider.GOOGLE,
          providerAccountId,
        },
      },
      include: {
        user: {
          include: { organization: true, teacherProfile: true },
        },
      },
    });

    if (!linkedAccount) {
      throw new UnauthorizedException(
        'No EduVerse account is linked to this Google account. Log in with your EduVerse password first, then link Google from settings.',
      );
    }

    const user = linkedAccount.user;
    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException(
        'Your account has been deleted by your organization',
      );
    }

    await this.cleanupOldSessions(user.id);

    const sessionDevice = device?.deviceId
      ? device
      : {
          ...device,
          deviceId: `fallback-${randomBytes(16).toString('hex')}`,
          deviceName: device?.deviceName || 'Unknown device',
          deviceType: device?.deviceType || 'unknown',
          browser: device?.browser || 'Unknown',
          os: device?.os || 'Unknown',
          rememberMe: device?.rememberMe,
        };

    return this.generateToken(
      user,
      device?.rememberMe === true,
      sessionDevice,
      ip,
    );
  }

  private async linkGoogleAccount(
    userId: string,
    googleIdentity: GoogleIdentity,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('User is not allowed to link Google.');
    }

    const existing = await this.prisma.linkedAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: LinkedAccountProvider.GOOGLE,
          providerAccountId: googleIdentity.providerAccountId,
        },
      },
    });

    if (existing) {
      if (existing.userId === userId) {
        return existing;
      }
      throw new ConflictException(
        'This Google account is already linked to another EduVerse account.',
      );
    }

    return this.prisma.linkedAccount.upsert({
      where: {
        userId_provider: {
          userId,
          provider: LinkedAccountProvider.GOOGLE,
        },
      },
      update: {
        providerAccountId: googleIdentity.providerAccountId,
        email: googleIdentity.email,
      },
      create: {
        userId,
        provider: LinkedAccountProvider.GOOGLE,
        providerAccountId: googleIdentity.providerAccountId,
        email: googleIdentity.email,
      },
    });
  }

  private async assertTokenBelongsToUser(token: string, expectedUserId: string) {
    const isValidSession = await this.validateSessionToken(token);
    if (!isValidSession) {
      throw new UnauthorizedException('Session expired or revoked. Please log in again.');
    }

    const payload = await this.jwtService.verifyAsync<{ sub?: string }>(token, {
      secret: this.configService.get<string>('JWT_SECRET') || '',
    });

    if (payload.sub !== expectedUserId) {
      throw new UnauthorizedException('Google link session mismatch.');
    }
  }

  private async verifyGoogleState(state: string) {
    try {
      return await this.jwtService.verifyAsync<GoogleOAuthState>(state, {
        secret: this.getGoogleStateSecret(),
      });
    } catch {
      throw new BadRequestException('Google sign-in state expired. Please try again.');
    }
  }

  private async verifyGoogleCode(code: string): Promise<GoogleIdentity> {
    const config = this.getGoogleConfig();
    const tokenParams = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Google could not verify this sign-in.');
    }

    const tokenData = (await tokenResponse.json()) as { id_token?: string };
    if (!tokenData.id_token) {
      throw new UnauthorizedException('Google did not return an identity token.');
    }

    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`,
    );
    if (!tokenInfoResponse.ok) {
      throw new UnauthorizedException('Google identity token is invalid.');
    }

    const tokenInfo = (await tokenInfoResponse.json()) as GoogleTokenInfo;
    const issuer = tokenInfo.iss;
    const expiresAt = Number(tokenInfo.exp || 0) * 1000;

    if (
      tokenInfo.aud !== config.clientId ||
      (issuer !== 'https://accounts.google.com' && issuer !== 'accounts.google.com') ||
      !tokenInfo.sub ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      throw new UnauthorizedException('Google identity token failed validation.');
    }

    return {
      providerAccountId: tokenInfo.sub,
      email: tokenInfo.email,
    };
  }

  private getGoogleConfig() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google sign-in is not configured.');
    }

    return { clientId, clientSecret, redirectUri };
  }

  private getGoogleStateSecret() {
    return (
      this.configService.get<string>('GOOGLE_OAUTH_STATE_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      ''
    );
  }

  private buildFrontendRedirect(
    path: string,
    params: Record<string, string>,
    hash?: string,
  ) {
    const frontendBase = this.getPrimaryFrontendUrl();
    const url = new URL(this.sanitizeFrontendPath(path), frontendBase);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    if (hash) url.hash = hash;
    return url.toString();
  }

  private sanitizeFrontendPath(path?: string) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
      return '/login';
    }
    return path;
  }

  private getPrimaryFrontendUrl() {
    return this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)[0];
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
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.prisma.session.updateMany({
        where: {
          userId,
          token: currentToken,
          isActive: true,
        },
        data: {
          token: newToken,
          lastSeenAt: new Date(),
          expiresAt,
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

  async getSessions(userId: string, currentToken?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map(({ token, ...session }) => ({
      ...session,
      isCurrent: !!currentToken && token === currentToken,
    }));
  }

  async validateSessionToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
        token,
        {
          secret: this.configService.get<string>('JWT_SECRET') || '',
        },
      );

      if (!payload.sub) return false;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!user) return false;

      const session = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          token,
          isActive: true,
        },
        select: { id: true },
      });
      if (!session) return false;

      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });

      return true;
    } catch {
      return false;
    }
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

    await this.writeAuditLog('password_reset_requested', {
      ...meta,
      targetUserId: candidateUsers.length === 1 ? candidateUsers[0].id : undefined,
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
          this.writeAuditLog('password_reset_failed', {
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
    const appUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const appBaseUrl = appUrl.replace(/\/+$/, '');
    const resetOptions = await Promise.all(
      eligibleUsers.map(async (user) => {
        await this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = this.hashSecret(rawToken);

        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
        });

        return {
          adminEmail: user.email,
          organizationName: user.organization!.name,
          organizationLogoUrl: this.getSafeAssetUrl(
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
    const email = this.buildPasswordResetEmail({
      recipient,
      appBaseUrl,
      options: resetOptions,
      expiresAt,
    });

    await this.emailService.send({
      to: recipient,
      subject:
        resetOptions.length > 1
          ? 'Choose an EduVerse account to recover'
          : 'Reset your EduVerse password',
      text: email.text,
      html: email.html,
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

    await this.notificationsService.createNotification({
      userId: resetToken.userId,
      title: 'Password reset completed',
      body: 'Your organization admin password was reset. All active sessions were signed out.',
      type: 'SECURITY',
      actionUrl: '/settings#sessions',
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
        logoUrl: true,
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

    const appBaseUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/+$/, '');
    const email = this.buildContactEmailVerificationEmail({
      appBaseUrl,
      code,
      organizationName: org.name,
      contactEmail: org.contactEmail,
      organizationLogoUrl: this.getSafeAssetUrl(org.logoUrl, appBaseUrl),
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

  private buildPasswordResetEmail(input: {
    recipient: string;
    appBaseUrl: string;
    options: Array<{
      adminEmail: string;
      organizationName: string;
      organizationLogoUrl?: string | null;
      resetUrl: string;
    }>;
    expiresAt: Date;
  }) {
    const isMultiple = input.options.length > 1;
    const title = isMultiple
      ? 'Choose an account to recover'
      : 'Reset your EduVerse password';
    const intro = isMultiple
      ? `We found ${input.options.length} organization admin accounts that use this recovery email. Choose the one you want to reset.`
      : `A password reset was requested for ${input.options[0].organizationName}.`;

    const optionText = input.options
      .map((option, index) =>
        [
          `${index + 1}. ${option.organizationName}`,
          `Admin login: ${option.adminEmail}`,
          `Reset link: ${option.resetUrl}`,
        ].join('\n'),
      )
      .join('\n\n');

    const optionCards = input.options
      .map((option, index) => {
        const escapedOrgName = this.escapeHtml(option.organizationName);
        const escapedAdminEmail = this.escapeHtml(option.adminEmail);
        const escapedResetUrl = this.escapeHtml(option.resetUrl);
        const logoHtml = option.organizationLogoUrl
          ? `<img src="${this.escapeHtml(option.organizationLogoUrl)}" width="42" height="42" alt="" style="height:42px;width:42px;border-radius:12px;object-fit:cover;border:1px solid #e5e7eb;background:#ffffff;" />`
          : `<div style="height:42px;width:42px;border-radius:12px;background:#eef2ff;color:#4f46e5;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;">${this.escapeHtml(option.organizationName.charAt(0).toUpperCase() || 'E')}</div>`;

        return `
          <div style="border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;padding:18px;margin-top:${index === 0 ? '0' : '14px'};">
            <div style="display:flex;gap:12px;align-items:center;">
              ${logoHtml}
              <div style="min-width:0;">
                <p style="margin:0;color:#111827;font-size:16px;font-weight:800;line-height:1.35;">${escapedOrgName}</p>
                <p style="margin:4px 0 0;color:#6b7280;font-size:13px;font-weight:600;line-height:1.4;">Admin login: ${escapedAdminEmail}</p>
              </div>
            </div>
            <a href="${escapedResetUrl}" style="display:block;margin-top:16px;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:800;">Reset this account</a>
          </div>
        `;
      })
      .join('');

    return {
      text: [
        title,
        intro,
        optionText,
        'Each link expires in 30 minutes.',
        'If you did not request this, ignore this email. Your password will not change.',
      ].join('\n\n'),
      html: this.buildSecurityEmailHtml({
        appBaseUrl: input.appBaseUrl,
        eyebrow: 'Password recovery',
        title,
        preview: intro,
        bodyHtml: `
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${this.escapeHtml(intro)}</p>
          ${optionCards}
          <div style="margin-top:18px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;">
            <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;"><strong>Security note:</strong> each reset link expires in 30 minutes. If this mailbox handles multiple organizations, only use the card for the account you intended to recover.</p>
          </div>
        `,
      }),
    };
  }

  private buildContactEmailVerificationEmail(input: {
    appBaseUrl: string;
    code: string;
    organizationName: string;
    contactEmail: string;
    organizationLogoUrl?: string | null;
    reason: string | null;
  }) {
    const isFirstRegistration = input.reason === 'first_registration';
    const intro = input.reason === 'contact_email_changed'
      ? `A new contact email was set for ${input.organizationName}.`
      : isFirstRegistration
        ? `Welcome to EduVerse, ${input.organizationName}.`
        : `Please verify the contact email for ${input.organizationName}.`;
    const guidance = isFirstRegistration
      ? 'Before approval can continue, verify this contact email. It will be used for password recovery, important organization notifications, and security communication.'
      : 'This code verifies the contact email for this organization workspace only.';

    return {
      subject: isFirstRegistration
        ? `Welcome to EduVerse, ${input.organizationName}`
        : `Verify ${input.organizationName}'s EduVerse contact email`,
      text: [
        intro,
        guidance,
        `Contact email: ${input.contactEmail}`,
        `Verification code: ${input.code}`,
        'This code expires in 10 minutes.',
        'If this mailbox is used for multiple EduVerse organizations, use this code only in the workspace named above.',
      ].join('\n\n'),
      html: this.buildSecurityEmailHtml({
        appBaseUrl: input.appBaseUrl,
        eyebrow: isFirstRegistration ? 'Welcome to EduVerse' : 'Contact email verification',
        title: isFirstRegistration ? 'Verify your organization contact' : 'Confirm this contact email',
        preview: `${intro} ${guidance}`,
        organizationName: input.organizationName,
        organizationLogoUrl: input.organizationLogoUrl,
        bodyHtml: `
          <p style="margin:0 0 10px;color:#4b5563;font-size:15px;line-height:1.65;">${this.escapeHtml(intro)}</p>
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${this.escapeHtml(guidance)}</p>
          <div style="border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;padding:14px;margin-bottom:18px;">
            <p style="margin:0;color:#6b7280;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Contact email</p>
            <p style="margin:5px 0 0;color:#111827;font-size:14px;font-weight:800;">${this.escapeHtml(input.contactEmail)}</p>
          </div>
          <div style="text-align:center;margin:22px 0;">
            <p style="margin:0 0 10px;color:#6b7280;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Verification code</p>
            ${this.renderVerificationCode(input.code)}
          </div>
          <div style="border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;padding:14px;">
            <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.6;"><strong>Shared mailbox?</strong> This code verifies only ${this.escapeHtml(input.organizationName)}. It does not verify any other EduVerse organization that may use the same contact email.</p>
          </div>
        `,
      }),
    };
  }

  private buildSecurityEmailHtml(input: {
    appBaseUrl: string;
    eyebrow: string;
    title: string;
    preview: string;
    bodyHtml: string;
    organizationName?: string;
    organizationLogoUrl?: string | null;
  }) {
    const platformLogoUrl = `${input.appBaseUrl}/assets/eduverse-icon-192.png`;
    const orgLogoHtml = input.organizationLogoUrl
      ? `<img src="${this.escapeHtml(input.organizationLogoUrl)}" width="34" height="34" alt="" style="height:34px;width:34px;border-radius:10px;object-fit:cover;border:1px solid #e5e7eb;background:#ffffff;" />`
      : '';
    const orgNameHtml = input.organizationName
      ? `<span style="color:#6b7280;font-size:13px;font-weight:700;">${this.escapeHtml(input.organizationName)}</span>`
      : '';

    return `
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>${this.escapeHtml(input.title)}</title>
        </head>
        <body style="margin:0;background:#eef2f7;padding:28px 14px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${this.escapeHtml(input.preview)}</div>
          <div style="max-width:640px;margin:0 auto;">
            <div style="text-align:center;margin-bottom:18px;">
              <img src="${this.escapeHtml(platformLogoUrl)}" width="56" height="56" alt="EduVerse" style="height:56px;width:56px;border-radius:16px;box-shadow:0 10px 28px rgba(79,70,229,.25);" />
            </div>
            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.12);">
              <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#eef2ff 0%,#ffffff 58%,#ecfeff 100%);border-bottom:1px solid #e5e7eb;">
                <p style="margin:0 0 10px;color:#4f46e5;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">${this.escapeHtml(input.eyebrow)}</p>
                <h1 style="margin:0;color:#111827;font-size:25px;line-height:1.2;font-weight:900;">${this.escapeHtml(input.title)}</h1>
                ${
                  input.organizationName
                    ? `<div style="margin-top:16px;display:flex;align-items:center;gap:10px;">${orgLogoHtml}${orgNameHtml}</div>`
                    : ''
                }
              </div>
              <div style="padding:26px 28px 28px;">
                ${input.bodyHtml}
              </div>
            </div>
            <p style="margin:18px 0 0;text-align:center;color:#6b7280;font-size:12px;line-height:1.6;">EduVerse security email. You can safely ignore this message if you did not request it.</p>
          </div>
        </body>
      </html>
    `;
  }

  private renderVerificationCode(code: string) {
    return `
      <div style="display:inline-flex;gap:8px;justify-content:center;">
        ${code
          .split('')
          .map(
            (digit) =>
              `<span style="display:inline-flex;height:48px;width:40px;align-items:center;justify-content:center;border-radius:12px;background:#111827;color:#ffffff;font-size:24px;font-weight:900;letter-spacing:0;">${this.escapeHtml(digit)}</span>`,
          )
          .join('')}
      </div>
    `;
  }

  private getSafeAssetUrl(value: string | null | undefined, appBaseUrl: string) {
    if (!value) return null;
    try {
      const url = value.startsWith('/')
        ? new URL(value, appBaseUrl)
        : new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
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

type GoogleOAuthPurpose = 'login' | 'link';

interface SessionDeviceInput {
  rememberMe?: boolean;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}

interface GoogleOAuthState {
  purpose: GoogleOAuthPurpose;
  userId?: string;
  device?: SessionDeviceInput;
  returnTo?: string;
  nonce: string;
}

interface GoogleIdentity {
  providerAccountId: string;
  email?: string;
}

interface GoogleTokenInfo {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: string;
  email?: string;
}
