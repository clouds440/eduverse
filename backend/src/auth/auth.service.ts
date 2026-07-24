import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  LinkedAccountProvider,
  User,
  Organization,
  Teacher,
  ThemeMode,
  UserSettings,
} from '@/prisma/prisma-client';
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
import {
  AuditLogInput,
  RequestMetadata,
  SessionDeviceInput,
} from './auth-internal.types';
import { hashSecret } from './auth-internal.utils';
import { EmailTemplateService } from './email-template.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { SecurityService } from './security.service';
import { SessionService } from './session.service';
import { UserPreferencesService } from './user-preferences.service';

export type TokenUser = User & {
  organization?: Organization | null;
  teacherProfile?: Teacher | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: Date | null;
  settings?: UserSettings | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionManager: SessionService;
  private readonly passwordResetManager: PasswordResetService;
  private readonly emailVerificationManager: EmailVerificationService;
  private readonly preferencesManager: UserPreferencesService;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @Inject(NOTIFICATIONS_SERVICE)
    private notificationsService: NotificationCreator,
    @Optional() sessionService?: SessionService,
    @Optional() securityService?: SecurityService,
    @Optional() passwordResetService?: PasswordResetService,
    @Optional() emailVerificationService?: EmailVerificationService,
    @Optional() userPreferencesService?: UserPreferencesService,
    @Optional() emailTemplateService?: EmailTemplateService,
  ) {
    const security =
      securityService ??
      new SecurityService(this.prisma, this.notificationsService);
    const templates = emailTemplateService ?? new EmailTemplateService();
    this.sessionManager =
      sessionService ??
      new SessionService(
        this.prisma,
        this.jwtService,
        this.configService,
        security,
      );
    this.passwordResetManager =
      passwordResetService ??
      new PasswordResetService(
        this.prisma,
        this.emailService,
        this.configService,
        templates,
        security,
        this.notificationsService,
      );
    this.emailVerificationManager =
      emailVerificationService ??
      new EmailVerificationService(
        this.prisma,
        this.emailService,
        this.configService,
        templates,
        security,
      );
    this.preferencesManager =
      userPreferencesService ?? new UserPreferencesService(this.prisma);
  }

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
          isFirstLogin: false,
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
      include: { organization: true, teacherProfile: true, settings: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.completeLogin(user, loginDto, ip);
  }

  async generateToken(
    user: TokenUser,
    rememberMe: boolean = false,
    loginDto?: SessionDeviceInput,
    ip: string = 'unknown',
  ) {
    const orgStatus =
      (user.organization?.status as unknown as OrgStatus) ||
      OrgStatus.APPROVED;
    const userStatus = user.status as unknown as UserStatus;
    const accessLevel = resolveAccessLevel({
      userStatus,
      orgStatus,
    });
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
      themeMode: user.settings?.themeMode ?? ThemeMode.SYSTEM,
      status: orgStatus,
      userStatus,
      accessLevel,
      isFirstLogin: user.isFirstLogin,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: rememberMe ? '30d' : '1d',
    });

    if (loginDto?.deviceId) {
      await this.sessionManager.persistLoginSession(
        { id: user.id, role: user.role as Role },
        token,
        rememberMe,
        loginDto,
        ip,
      );
    }

    return {
      access_token: token,
      role: user.role,
      status: userStatus,
      accessLevel,
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
    const signedState = await this.createGoogleOAuthState({
      purpose,
      userId: options.userId,
      device: options.device,
      returnTo: options.returnTo,
    });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state: signedState,
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private createGoogleOAuthState(input: {
    purpose: GoogleOAuthPurpose;
    userId?: string;
    device?: SessionDeviceInput;
    returnTo?: string;
  }) {
    return this.jwtService.signAsync(
      {
        purpose: input.purpose,
        userId: input.userId,
        device: input.device,
        returnTo: this.sanitizeFrontendPath(input.returnTo),
        nonce: randomBytes(16).toString('hex'),
      } satisfies GoogleOAuthState,
      {
        secret: this.getGoogleStateSecret(),
        expiresIn: '10m',
      },
    );
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
      const user = await this.prisma.user.findUnique({
        where: { id: state.userId },
        select: { id: true, role: true },
      });
      const target = this.getAccountSettingsTarget(
        user ?? { id: state.userId, role: Role.ORG_ADMIN },
        'linked-accounts',
      );

      return {
        purpose: state.purpose,
        redirectUrl: this.buildFrontendRedirect(target.path, {
          googleLink: 'success',
        }, target.hash),
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
          include: {
            organization: true,
            teacherProfile: true,
            settings: true,
          },
        },
      },
    });

    if (!linkedAccount) {
      throw new UnauthorizedException(
        'No EduVerse account is linked to this Google account. Log in with your EduVerse password first, then link Google from settings.',
      );
    }

    return this.completeLogin(linkedAccount.user, device, ip);
  }

  private async completeLogin(
    user: TokenUser,
    device?: SessionDeviceInput,
    ip = 'unknown',
  ) {
    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException(
        'Your account has been deleted by your organization',
      );
    }

    await this.sessionManager.cleanupOldSessions(user.id);

    const sessionDevice = this.normalizeSessionDevice(device);
    const rememberMe = device?.rememberMe === true;

    return this.generateToken(user, rememberMe, sessionDevice, ip);
  }

  private normalizeSessionDevice(
    device?: SessionDeviceInput,
  ): SessionDeviceInput {
    if (device?.deviceId) return device;

    return {
      ...device,
      deviceId: `fallback-${randomBytes(16).toString('hex')}`,
      deviceName: device?.deviceName || 'Unknown device',
      deviceType: device?.deviceType || 'unknown',
      browser: device?.browser || 'Unknown',
      os: device?.os || 'Unknown',
    };
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

  private getAccountSecurityUrl(user: Pick<User, 'id' | 'role'>) {
    const target = this.getAccountSettingsTarget(user, 'sessions');
    return `${target.path}${target.hash ? `#${target.hash}` : ''}`;
  }

  private getAccountSettingsTarget(
    user: Pick<User, 'id' | 'role'>,
    hash?: string,
  ) {
    switch (user.role) {
      case Role.SUPER_ADMIN:
      case Role.PLATFORM_ADMIN:
        return { path: '/admin/settings', hash };
      case Role.ORG_MANAGER:
      case Role.TEACHER:
        return { path: `/teacher/${user.id}/profile`, hash };
      case Role.STUDENT:
        return { path: `/student/${user.id}?tab=profile`, hash };
      case Role.SUB_ADMIN:
        return { path: `/sub-admin/${user.id}/profile`, hash };
      case Role.FINANCE_MANAGER:
        return { path: `/finance-manager/${user.id}/profile`, hash };
      case Role.GUARDIAN:
        return { path: '/guardian?view=profile', hash: undefined };
      case Role.ORG_ADMIN:
      default:
        return { path: '/settings', hash };
    }
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
    data: Partial<{ themeMode: ThemeMode; name?: string }>,
  ) {
    return this.preferencesManager.updateProfile(userId, data);
  }

  async getUserSettings(userId: string) {
    return this.preferencesManager.getSettings(userId);
  }

  async updateUserSettings(
    userId: string,
    data: Parameters<UserPreferencesService['updateSettings']>[1],
  ) {
    return this.preferencesManager.updateSettings(userId, data);
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
      include: { organization: true, teacherProfile: true, settings: true },
    });

    // Issue a NEW token so the isFirstLogin: false change is reflected in the JWT payload
    const { access_token: newToken } = await this.generateToken(updatedUser, true);

    if (currentToken) {
      await this.sessionManager.replaceCurrentAndRevokeOthers(
        userId,
        currentToken,
        newToken,
      );
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
    return this.sessionManager.logout(userId, token);
  }

  async getSessions(userId: string, currentToken?: string) {
    return this.sessionManager.getSessions(userId, currentToken);
  }

  async validateSessionToken(token: string) {
    return this.sessionManager.validateSessionToken(token);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentToken?: string,
  ) {
    return this.sessionManager.revokeSession(
      userId,
      sessionId,
      currentToken,
    );
  }

  async revokeAllSessions(userId: string, excludeToken?: string) {
    return this.sessionManager.revokeAllSessions(userId, excludeToken);
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
    return this.emailVerificationManager.resendContactEmailVerification(
      user,
      meta,
    );
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
    return this.emailVerificationManager.verifyContactEmail(user, code, meta);
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMetadata) {
    return this.passwordResetManager.forgotPassword(dto, meta);
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMetadata) {
    return this.passwordResetManager.resetPassword(dto, meta);
  }

  async generateManagedUserPasswordResetLink(
    actor: { id: string; role?: string; organizationId?: string | null },
    targetUserId: string,
    meta: RequestMetadata,
  ) {
    return this.passwordResetManager.generateManagedUserPasswordResetLink(
      actor,
      targetUserId,
      meta,
    );
  }

  async issueContactEmailVerification(
    orgId: string,
    audit: AuditLogInput,
  ) {
    return this.emailVerificationManager.issueContactEmailVerification(
      orgId,
      audit,
    );
  }

  private hashSecret(value: string) {
    return hashSecret(value);
  }

}

type GoogleOAuthPurpose = 'login' | 'link';

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
