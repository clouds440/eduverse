import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import {
  E2EEDeviceTrustStatus,
  PendingLoginStatus,
  Role,
  TwoFactorMethod,
} from '@/prisma/prisma-client';
import { EventsGateway } from '../events/events.gateway';
import {
  NOTIFICATIONS_SERVICE,
} from '../notifications/notifications.tokens';
import type { NotificationCreator } from '../notifications/notifications.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { SessionDeviceInput } from './auth-internal.types';
import { hashSecret } from './auth-internal.utils';
import { EmailTemplateService } from '../common/email-templates/email-template.service';

const PENDING_LOGIN_TTL_MS = 15 * 60_000;
const EMAIL_CODE_TTL_MS = 10 * 60_000;
const EMAIL_RESEND_COOLDOWN_MS = 60_000;
const MAX_EMAIL_CODE_ATTEMPTS = 5;

type TempTokenPayload = {
  sub: string;
  pendingLoginId: string;
  tokenType: 'two_factor';
};

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly templates: EmailTemplateService,
    private readonly events: EventsGateway,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notifications: NotificationCreator,
  ) {}

  async begin(
    user: {
      id: string;
      role: Role;
      organizationId: string | null;
      settings?: {
        emailTwoFactorEnabled: boolean;
        deviceTwoFactorEnabled: boolean;
      } | null;
    },
    device: SessionDeviceInput,
    ip: string,
  ) {
    const settings = user.settings;
    const methods: TwoFactorMethod[] = [];
    if (settings?.emailTwoFactorEnabled) methods.push(TwoFactorMethod.EMAIL);
    if (settings?.deviceTwoFactorEnabled) methods.push(TwoFactorMethod.DEVICE);
    if (methods.length === 0) return null;

    await this.prisma.pendingLogin.updateMany({
      where: {
        userId: user.id,
        status: PendingLoginStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: PendingLoginStatus.CANCELLED },
    });

    const pending = await this.prisma.pendingLogin.create({
      data: {
        userId: user.id,
        availableMethods: methods,
        deviceId: device.deviceId!,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        ip,
        rememberMe: device.rememberMe === true,
        expiresAt: new Date(Date.now() + PENDING_LOGIN_TTL_MS),
      },
    });
    const temporaryToken = await this.jwt.signAsync(
      {
        sub: user.id,
        pendingLoginId: pending.id,
        tokenType: 'two_factor',
      } satisfies TempTokenPayload,
      { expiresIn: '15m' },
    );
    return {
      requiresTwoFactor: true as const,
      temporaryToken,
      pendingLoginId: pending.id,
      methods: methods.map((method) => method.toLowerCase()),
      expiresAt: pending.expiresAt.toISOString(),
    };
  }

  async getChallenge(temporaryToken: string) {
    const pending = await this.getPending(temporaryToken);
    return this.serialize(pending);
  }

  async selectMethod(temporaryToken: string, methodInput: string) {
    const pending = await this.getPending(temporaryToken);
    const method = this.parseAvailableMethod(
      methodInput,
      pending.availableMethods,
    );
    if (pending.selectedMethod) {
      if (pending.selectedMethod !== method) {
        throw new BadRequestException(
          'A verification option was already selected for this sign-in.',
        );
      }
      return this.serialize(pending);
    }
    const selected = await this.prisma.pendingLogin.updateMany({
      where: {
        id: pending.id,
        status: PendingLoginStatus.PENDING,
        selectedMethod: null,
      },
      data: { selectedMethod: method },
    });
    if (selected.count !== 1) {
      throw new BadRequestException('This verification option is not available.');
    }
    try {
      if (method === TwoFactorMethod.EMAIL) {
        await this.sendEmailCode(pending.id);
      } else {
        await this.startDeviceApproval(pending.id);
      }
    } catch (error) {
      await this.prisma.pendingLogin.updateMany({
        where: {
          id: pending.id,
          status: PendingLoginStatus.PENDING,
          selectedMethod: method,
        },
        data: {
          selectedMethod: null,
          emailCodeHash: null,
          emailCodeAttempts: 0,
          emailCodeSentAt: null,
        },
      });
      throw error;
    }
    return this.getChallenge(temporaryToken);
  }

  async verifyEmail(temporaryToken: string, code: string) {
    const pending = await this.getPending(temporaryToken);
    if (pending.selectedMethod !== TwoFactorMethod.EMAIL) {
      throw new BadRequestException('Choose email verification first.');
    }
    if (!pending.emailCodeHash || !pending.emailCodeSentAt) {
      throw new BadRequestException('Request a verification code first.');
    }
    if (Date.now() - pending.emailCodeSentAt.getTime() > EMAIL_CODE_TTL_MS) {
      throw new BadRequestException('This code expired. Request a new one.');
    }
    if (pending.emailCodeAttempts >= MAX_EMAIL_CODE_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (hashSecret(code) !== pending.emailCodeHash) {
      await this.prisma.pendingLogin.update({
        where: { id: pending.id },
        data: { emailCodeAttempts: { increment: 1 } },
      });
      throw new BadRequestException('That code is not correct.');
    }
    await this.markVerified(pending.id);
    return { verified: true };
  }

  async resendEmail(temporaryToken: string) {
    const pending = await this.getPending(temporaryToken);
    if (pending.selectedMethod !== TwoFactorMethod.EMAIL) {
      throw new BadRequestException('Choose email verification first.');
    }
    if (
      pending.emailCodeSentAt &&
      Date.now() - pending.emailCodeSentAt.getTime() <
        EMAIL_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Please wait before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.sendEmailCode(pending.id);
    return { message: 'A new code was sent.' };
  }

  async cancel(temporaryToken: string) {
    const pending = await this.getPending(temporaryToken);
    await this.prisma.pendingLogin.update({
      where: { id: pending.id },
      data: { status: PendingLoginStatus.CANCELLED },
    });
    return { message: 'Sign-in cancelled.' };
  }

  async approveDevice(
    approverUserId: string,
    pendingLoginId: string,
    approverClientDeviceId: string,
  ) {
    const pending = await this.prisma.pendingLogin.findUnique({
      where: { id: pendingLoginId },
    });
    if (
      !pending ||
      pending.userId !== approverUserId ||
      pending.status !== PendingLoginStatus.PENDING ||
      pending.expiresAt <= new Date() ||
      pending.selectedMethod !== TwoFactorMethod.DEVICE
    ) {
      throw new BadRequestException('This sign-in request is no longer active.');
    }
    const trusted = await this.prisma.trustedEncryptionDevice.findFirst({
      where: {
        userId: approverUserId,
        clientDeviceId: approverClientDeviceId,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
      },
    });
    if (!trusted) {
      throw new ForbiddenException(
        'Open this request on a browser you already trust.',
      );
    }
    await this.markVerified(pending.id);
    return { message: 'Sign-in approved.' };
  }

  async consume(temporaryToken: string) {
    const payload = await this.verifyTemporaryToken(temporaryToken);
    const pending = await this.prisma.pendingLogin.findUnique({
      where: { id: payload.pendingLoginId },
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
    if (
      !pending ||
      pending.userId !== payload.sub ||
      pending.status !== PendingLoginStatus.VERIFIED ||
      pending.expiresAt <= new Date() ||
      pending.consumedAt
    ) {
      throw new UnauthorizedException('Complete verification before continuing.');
    }
    const consumed = await this.prisma.pendingLogin.updateMany({
      where: {
        id: pending.id,
        userId: payload.sub,
        status: PendingLoginStatus.VERIFIED,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: PendingLoginStatus.CONSUMED,
        consumedAt: new Date(),
      },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('This sign-in was already completed.');
    }
    return {
      user: pending.user,
      rememberMe: pending.rememberMe,
      device: {
        rememberMe: pending.rememberMe,
        deviceId: pending.deviceId,
        deviceName: pending.deviceName || undefined,
        deviceType: pending.deviceType || undefined,
        browser: pending.browser || undefined,
        os: pending.os || undefined,
      },
      ip: pending.ip || 'unknown',
    };
  }

  private async startDeviceApproval(pendingLoginId: string) {
    const pending = await this.prisma.pendingLogin.findUniqueOrThrow({
      where: { id: pendingLoginId },
      include: { user: true },
    });
    const currentTrusted = await this.prisma.trustedEncryptionDevice.findFirst({
      where: {
        userId: pending.userId,
        clientDeviceId: pending.deviceId,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
      },
    });
    if (currentTrusted) {
      await this.markVerified(pending.id);
      return;
    }
    const targetClientDeviceIds = (
      await this.prisma.trustedEncryptionDevice.findMany({
        where: {
          userId: pending.userId,
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
          clientDeviceId: { not: pending.deviceId },
        },
        select: { clientDeviceId: true },
      })
    ).map((device) => device.clientDeviceId);
    if (targetClientDeviceIds.length === 0) {
      throw new BadRequestException('No trusted browser is available.');
    }
    await this.notifications.createNotification({
      userId: pending.userId,
      title: 'Approve this sign-in?',
      body: `${pending.deviceName || 'A browser'} is waiting for your approval.`,
      type: 'TWO_FACTOR_DEVICE_APPROVAL',
      actionUrl: this.getSecurityApprovalUrl(
        pending.user.role,
        pending.userId,
        pending.id,
      ),
      metadata: {
        pendingLoginId: pending.id,
        targetClientDeviceIds,
      },
    });
  }

  private async sendEmailCode(pendingLoginId: string) {
    const pending = await this.prisma.pendingLogin.findUniqueOrThrow({
      where: { id: pendingLoginId },
      include: { user: { include: { organization: true } } },
    });
    const isOrgAdmin =
      pending.user.role === Role.ORG_ADMIN && pending.user.organization;
    const address = isOrgAdmin
      ? pending.user.organization!.contactEmailVerifiedAt &&
        pending.user.organization!.contactEmail
      : pending.user.contactEmailVerifiedAt && pending.user.contactEmail;
    if (!address) {
      throw new BadRequestException('No verified contact email is available.');
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.pendingLogin.update({
      where: { id: pending.id },
      data: {
        emailCodeHash: hashSecret(code),
        emailCodeAttempts: 0,
        emailCodeSentAt: new Date(),
      },
    });
    const appBaseUrl = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')[0]
      .replace(/\/+$/, '');
    const verificationEmail = this.templates.buildTwoFactorCodeEmail({
      appBaseUrl,
      code,
      accountName:
        pending.user.organization?.name || pending.user.name || 'EduVerse',
      organizationLogoUrl: this.templates.getSafeAssetUrl(
        pending.user.organization?.logoUrl,
        appBaseUrl,
      ),
      expiresInMinutes: EMAIL_CODE_TTL_MS / 60_000,
    });
    await this.email.send({
      to: address,
      ...verificationEmail,
    });
  }

  private getSecurityApprovalUrl(
    role: Role,
    userId: string,
    pendingLoginId: string,
  ) {
    const query = `approveLoginId=${encodeURIComponent(pendingLoginId)}`;
    switch (role) {
      case Role.SUPER_ADMIN:
      case Role.PLATFORM_ADMIN:
        return `/admin/settings?tab=security&${query}`;
      case Role.TEACHER:
      case Role.ORG_MANAGER:
        return `/teacher/${userId}/profile?${query}`;
      case Role.SUB_ADMIN:
        return `/sub-admin/${userId}/profile?${query}`;
      case Role.FINANCE_MANAGER:
        return `/finance-manager/${userId}/profile?${query}`;
      case Role.STUDENT:
        return `/student/${userId}?tab=profile&${query}`;
      case Role.GUARDIAN:
        return `/guardian?view=profile&${query}`;
      case Role.ORG_ADMIN:
      default:
        return `/settings?tab=security&${query}`;
    }
  }

  private async markVerified(pendingLoginId: string) {
    const verified = await this.prisma.pendingLogin.updateMany({
      where: {
        id: pendingLoginId,
        status: PendingLoginStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: PendingLoginStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });
    if (verified.count !== 1) return;
    this.events.emitToRoom(`pending-login:${pendingLoginId}`, 'two-factor:verified', {
      pendingLoginId,
    });
  }

  private async getPending(temporaryToken: string) {
    const payload = await this.verifyTemporaryToken(temporaryToken);
    const pending = await this.prisma.pendingLogin.findUnique({
      where: { id: payload.pendingLoginId },
    });
    if (
      !pending ||
      pending.userId !== payload.sub ||
      pending.expiresAt <= new Date() ||
      (pending.status === PendingLoginStatus.CONSUMED ||
        pending.status === PendingLoginStatus.CANCELLED)
    ) {
      throw new UnauthorizedException('This sign-in request expired.');
    }
    return pending;
  }

  private async verifyTemporaryToken(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<TempTokenPayload>(token);
      if (
        payload.tokenType !== 'two_factor' ||
        !payload.pendingLoginId ||
        !payload.sub
      ) {
        throw new Error();
      }
      return payload;
    } catch {
      throw new UnauthorizedException('This sign-in request expired.');
    }
  }

  private serialize(pending: {
    id: string;
    status: PendingLoginStatus;
    selectedMethod: TwoFactorMethod | null;
    availableMethods: TwoFactorMethod[];
    expiresAt: Date;
  }) {
    return {
      pendingLoginId: pending.id,
      status: pending.status.toLowerCase(),
      selectedMethod: pending.selectedMethod?.toLowerCase() || null,
      methods: pending.availableMethods.map((method) => method.toLowerCase()),
      expiresAt: pending.expiresAt.toISOString(),
    };
  }

  private parseAvailableMethod(
    input: string,
    availableMethods: TwoFactorMethod[],
  ) {
    const normalized = input?.trim().toUpperCase();
    const method =
      normalized === TwoFactorMethod.EMAIL
        ? TwoFactorMethod.EMAIL
        : normalized === TwoFactorMethod.DEVICE
          ? TwoFactorMethod.DEVICE
          : null;
    if (!method || !availableMethods.includes(method)) {
      throw new BadRequestException(
        'This verification option is not available.',
      );
    }
    return method;
  }
}
