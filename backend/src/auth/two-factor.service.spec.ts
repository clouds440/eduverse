import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  E2EEDeviceTrustStatus,
  PendingLoginStatus,
  Role,
  TwoFactorMethod,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
import { EventsGateway } from '../events/events.gateway';
import type { NotificationCreator } from '../notifications/notifications.tokens';
import { E2eeService } from '../e2ee/e2ee.service';
import { hashSecret } from './auth-internal.utils';
import { TwoFactorService } from './two-factor.service';

const temporaryToken = 'temporary-token';
const userId = 'user-1';
const pendingLoginId = 'pending-login-1';
const pendingDeviceId = 'pending-device-1';

function pendingLogin(
  overrides: Partial<{
    userId: string;
    status: PendingLoginStatus;
    selectedMethod: TwoFactorMethod;
    consumedAt: Date | null;
    emailCodeHash: string | null;
    emailCodeSentAt: Date | null;
  }> = {},
) {
  return {
    id: pendingLoginId,
    userId,
    status: PendingLoginStatus.PENDING,
    selectedMethod: TwoFactorMethod.DEVICE,
    availableMethods: [TwoFactorMethod.DEVICE],
    emailCodeHash: null,
    emailCodeAttempts: 0,
    emailCodeSentAt: null,
    deviceId: 'new-browser',
    deviceName: 'New browser',
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    ip: '127.0.0.1',
    rememberMe: false,
    expiresAt: new Date(Date.now() + 60_000),
    verifiedAt: null,
    consumedAt: null,
    pendingDeviceId,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: userId,
      role: Role.STUDENT,
      organizationId: 'org-1',
      organization: null,
      teacherProfile: null,
      settings: null,
      contactEmail: 'security@example.test',
      name: 'Test User',
    },
    ...overrides,
  };
}

describe('TwoFactorService device vouch binding', () => {
  let pending: ReturnType<typeof pendingLogin>;
  let prisma: {
    pendingLogin: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    trustedEncryptionDevice: {
      findFirst: jest.Mock;
    };
  };
  let e2ee: {
    registerPendingLoginDevice: jest.Mock;
    provisionPendingLoginDevice: jest.Mock;
    getPendingLoginDeviceApprovalContext: jest.Mock;
    trustPendingLoginDeviceWithoutHistory: jest.Mock;
  };
  let jwt: {
    verifyAsync: jest.Mock;
    signAsync: jest.Mock;
  };
  let events: { emitToRoom: jest.Mock };
  let service: TwoFactorService;

  beforeEach(() => {
    pending = pendingLogin();
    prisma = {
      pendingLogin: {
        create: jest.fn(),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(pending)),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(pending)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(pending),
      },
      trustedEncryptionDevice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'approver-device',
          userId,
          clientDeviceId: 'trusted-browser',
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
        }),
      },
    };
    e2ee = {
      registerPendingLoginDevice: jest.fn().mockResolvedValue({
        device: { id: pendingDeviceId },
      }),
      provisionPendingLoginDevice: jest
        .fn()
        .mockResolvedValue({ complete: true }),
      getPendingLoginDeviceApprovalContext: jest.fn(),
      trustPendingLoginDeviceWithoutHistory: jest.fn().mockResolvedValue({}),
    };
    jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: userId,
        pendingLoginId,
        tokenType: 'two_factor',
      }),
      signAsync: jest.fn(),
    };
    events = { emitToRoom: jest.fn() };
    service = new TwoFactorService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      {} as EmailService,
      {} as ConfigService,
      {} as EmailTemplateService,
      events as unknown as EventsGateway,
      { createNotification: jest.fn() } as NotificationCreator,
      e2ee as unknown as E2eeService,
    );
  });

  it('binds temporary-token registration to its user, login, and deviceId', async () => {
    const registration = {
      clientDeviceId: 'new-browser',
      identityPublicKey: 'identity-public',
      keyAgreementPublicKey: 'device-public',
    };

    await service.registerPendingDevice(temporaryToken, registration);

    expect(e2ee.registerPendingLoginDevice).toHaveBeenCalledWith(
      userId,
      pendingLoginId,
      'new-browser',
      registration,
    );
  });

  it('rejects a vouch from a different user', async () => {
    await expect(
      service.approveDevice(
        'other-user',
        pendingLoginId,
        'trusted-browser',
        { complete: true },
      ),
    ).rejects.toThrow('no longer active');
    expect(e2ee.provisionPendingLoginDevice).not.toHaveBeenCalled();
  });

  it('uses the same device approval to provision history and verify login', async () => {
    await service.approveDevice(
      userId,
      pendingLoginId,
      'trusted-browser',
      { chatGrants: [], complete: true },
    );

    expect(e2ee.provisionPendingLoginDevice).toHaveBeenCalledWith(
      userId,
      pendingDeviceId,
      'trusted-browser',
      { chatGrants: [], complete: true },
    );
    expect(prisma.pendingLogin.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: pendingLoginId,
          status: PendingLoginStatus.PENDING,
        }),
        data: expect.objectContaining({
          status: PendingLoginStatus.VERIFIED,
        }),
      }),
    );
  });

  it('email verification vouches once without a second identity approval', async () => {
    const code = '123456';
    pending = pendingLogin({
      selectedMethod: TwoFactorMethod.EMAIL,
      emailCodeHash: hashSecret(code),
      emailCodeSentAt: new Date(),
    });

    await service.verifyEmail(temporaryToken, code);

    expect(e2ee.trustPendingLoginDeviceWithoutHistory).toHaveBeenCalledWith(
      userId,
      pendingDeviceId,
    );
    expect(e2ee.provisionPendingLoginDevice).not.toHaveBeenCalled();
    expect(events.emitToRoom).toHaveBeenCalledWith(
      `pending-login:${pendingLoginId}`,
      'two-factor:verified',
      { pendingLoginId },
    );
  });

  it('consumes the verified vouch only once', async () => {
    pending = pendingLogin({
      status: PendingLoginStatus.VERIFIED,
      selectedMethod: TwoFactorMethod.EMAIL,
    });
    prisma.pendingLogin.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await service.consume(temporaryToken);
    await expect(service.consume(temporaryToken)).rejects.toThrow(
      'already completed',
    );
  });

  it('offers verified organization email as recovery for device-only org admins', async () => {
    prisma.pendingLogin.create.mockResolvedValue({
      id: pendingLoginId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    jwt.signAsync.mockResolvedValue(temporaryToken);

    const result = await service.begin(
      {
        id: userId,
        role: Role.ORG_ADMIN,
        organizationId: 'org-1',
        organization: {
          contactEmail: 'recovery@example.test',
          contactEmailVerifiedAt: new Date(),
        },
        settings: {
          emailTwoFactorEnabled: false,
          deviceTwoFactorEnabled: true,
        },
      },
      {
        deviceId: 'new-browser',
        deviceName: 'New browser',
      },
      '127.0.0.1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        methods: [TwoFactorMethod.DEVICE, TwoFactorMethod.EMAIL],
        emailIsRecoveryFallback: true,
      }),
    );
  });
});
