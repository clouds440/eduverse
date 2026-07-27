import {
  E2EEDeviceTrustStatus,
  Role,
  ThemeMode,
  TwoFactorMethod,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from './security.service';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  const prisma = {
    user: { update: jest.fn(), findFirst: jest.fn() },
    userSettings: {
      upsert: jest.fn(),
    },
    trustedEncryptionDevice: { findFirst: jest.fn() },
    pendingLogin: { updateMany: jest.fn() },
  };
  const security = { recordEvent: jest.fn() };
  const service = new UserPreferencesService(
    prisma as unknown as PrismaService,
    security as unknown as SecurityService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates default settings lazily for users created outside the migration', async () => {
    prisma.userSettings.upsert.mockResolvedValue({
      userId: 'user-1',
      twoFactorEnabled: false,
      twoFactorMethod: TwoFactorMethod.DEVICE,
      themeMode: ThemeMode.SYSTEM,
      loginNotificationEmail: true,
      loginNotificationPush: true,
      marketingEmails: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getSettings('user-1');

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1' },
      update: {},
    });
    expect(result.themeMode).toBe(ThemeMode.SYSTEM);
    expect(result.twoFactorMethod).toBe(TwoFactorMethod.DEVICE);
  });

  it('updates one setting without requiring callers to send the whole record', async () => {
    prisma.userSettings.upsert.mockResolvedValue({
      userId: 'user-1',
      twoFactorEnabled: false,
      twoFactorMethod: TwoFactorMethod.DEVICE,
      themeMode: ThemeMode.DARK,
      loginNotificationEmail: true,
      loginNotificationPush: true,
      marketingEmails: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.updateSettings('user-1', { themeMode: ThemeMode.DARK });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', themeMode: ThemeMode.DARK },
      update: { themeMode: ThemeMode.DARK },
    });
  });

  it('keeps the profile response shape while storing theme in UserSettings', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.test',
      name: 'Updated User',
      organization: null,
      teacherProfile: null,
      settings: {
        userId: 'user-1',
        twoFactorEnabled: false,
        twoFactorMethod: TwoFactorMethod.DEVICE,
        themeMode: ThemeMode.LIGHT,
        loginNotificationEmail: true,
        loginNotificationPush: true,
        marketingEmails: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await service.updateProfile('user-1', {
      name: 'Updated User',
      themeMode: ThemeMode.LIGHT,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        name: 'Updated User',
        themeMode: ThemeMode.LIGHT,
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: {
            upsert: {
              create: { themeMode: ThemeMode.LIGHT },
              update: { themeMode: ThemeMode.LIGHT },
            },
          },
        }),
      }),
    );
  });

  it('prevents a sub-admin from changing another sub-admin security', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-sub-admin',
      role: Role.SUB_ADMIN,
      organization: {},
      settings: { twoFactorEnabled: true },
    });

    await expect(
      service.toggleManagedTwoFactor(
        {
          id: 'actor',
          role: Role.SUB_ADMIN,
          organizationId: 'org-1',
        },
        'target-sub-admin',
        {},
      ),
    ).rejects.toThrow('not allowed');
    expect(prisma.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('lets an org admin enable all verified options for an org user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-user',
      role: Role.STUDENT,
      contactEmailVerifiedAt: new Date(),
      organization: {},
      settings: { twoFactorEnabled: false },
    });
    prisma.trustedEncryptionDevice.findFirst.mockResolvedValue({
      id: 'trusted-device',
      trustStatus: E2EEDeviceTrustStatus.TRUSTED,
    });
    prisma.userSettings.upsert.mockResolvedValue({
      twoFactorEnabled: true,
      emailTwoFactorEnabled: true,
      deviceTwoFactorEnabled: true,
    });

    const result = await service.toggleManagedTwoFactor(
      {
        id: 'actor',
        role: Role.ORG_ADMIN,
        organizationId: 'org-1',
      },
      'target-user',
      {},
    );

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          twoFactorEnabled: true,
          emailTwoFactorEnabled: true,
          deviceTwoFactorEnabled: true,
          twoFactorMethod: TwoFactorMethod.BOTH,
        }),
      }),
    );
    expect(result.enabled).toBe(true);
    expect(security.recordEvent).toHaveBeenCalled();
  });
});
