import { Role, ThemeMode, TwoFactorMethod } from '@/prisma/prisma-client';
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
      service.resetManagedTwoFactor(
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

  it('lets an org admin reset all two-step verification options', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-user',
      role: Role.STUDENT,
      organization: {},
      organizationId: 'org-1',
      settings: {
        twoFactorEnabled: true,
        emailTwoFactorEnabled: true,
        deviceTwoFactorEnabled: true,
      },
    });
    prisma.userSettings.upsert.mockResolvedValue({
      twoFactorEnabled: false,
      emailTwoFactorEnabled: false,
      deviceTwoFactorEnabled: false,
    });
    prisma.pendingLogin.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resetManagedTwoFactor(
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
          twoFactorEnabled: false,
          emailTwoFactorEnabled: false,
          deviceTwoFactorEnabled: false,
          twoFactorMethod: TwoFactorMethod.DEVICE,
        }),
      }),
    );
    expect(result.enabled).toBe(false);
    expect(prisma.pendingLogin.updateMany).toHaveBeenCalled();
    expect(security.recordEvent).toHaveBeenCalled();
  });

  it('cannot turn two-step verification on when it is already off', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-user',
      role: Role.STUDENT,
      organization: {},
      organizationId: 'org-1',
      settings: {
        twoFactorEnabled: false,
        emailTwoFactorEnabled: false,
        deviceTwoFactorEnabled: false,
      },
    });

    const result = await service.resetManagedTwoFactor(
      {
        id: 'actor',
        role: Role.ORG_ADMIN,
        organizationId: 'org-1',
      },
      'target-user',
      {},
    );

    expect(result.enabled).toBe(false);
    expect(result.message).toContain('already off');
    expect(prisma.userSettings.upsert).not.toHaveBeenCalled();
    expect(prisma.pendingLogin.updateMany).not.toHaveBeenCalled();
  });
});
