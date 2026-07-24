import { ThemeMode, TwoFactorMethod } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  const prisma = {
    user: { update: jest.fn() },
    userSettings: {
      upsert: jest.fn(),
    },
  };
  const service = new UserPreferencesService(
    prisma as unknown as PrismaService,
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
});
