import { Role, ThemeMode, TwoFactorMethod } from '@/prisma/prisma-client';
import type { NotificationCreator } from '../notifications/notifications.tokens';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../security/email.service';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
import { SecurityService } from './security.service';
import { UserSettingsContextService } from './user-settings-context.service';

describe('SecurityService login notification preferences', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const notifications = {
    createNotification: jest.fn().mockResolvedValue(undefined),
  };
  const email = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const settingsContext = new UserSettingsContextService(
    prisma as unknown as PrismaService,
  );
  const service = new SecurityService(
    prisma as unknown as PrismaService,
    notifications as NotificationCreator,
    email as unknown as EmailService,
    { get: jest.fn().mockReturnValue('https://app.example.com') } as never,
    new EmailTemplateService(),
    settingsContext,
  );

  const userWithPreferences = (loginNotificationEmail: boolean, loginNotificationPush: boolean) => ({
    id: 'admin-1',
    email: 'admin@example.com',
    role: Role.PLATFORM_ADMIN,
    organizationId: null,
    settings: {
      userId: 'admin-1',
      twoFactorEnabled: false,
      twoFactorMethod: TwoFactorMethod.DEVICE,
      emailTwoFactorEnabled: false,
      deviceTwoFactorEnabled: false,
      themeMode: ThemeMode.SYSTEM,
      loginNotificationEmail,
      loginNotificationPush,
      marketingEmails: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the full settings context once and skips both disabled channels', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPreferences(false, false));

    await service.notifyNewDevice({
      userId: 'admin-1',
      role: Role.PLATFORM_ADMIN,
      deviceId: 'device-1',
      deviceName: 'Chrome on Windows',
      ip: '127.0.0.1',
      location: 'Pakistan',
      targetClientDeviceIds: ['trusted-device-1'],
    });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sends only push when only login push alerts are enabled', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPreferences(false, true));

    await service.notifySuspiciousLocation({
      userId: 'admin-1',
      role: Role.PLATFORM_ADMIN,
      deviceId: 'device-1',
      deviceName: 'Chrome',
      previousLocation: 'Pakistan',
      newLocation: 'United Kingdom',
    });

    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: 'SECURITY',
        actionUrl: '/admin/settings#sessions',
      }),
    );
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sends only email when only login email alerts are enabled', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithPreferences(true, false));

    await service.notifyNewDevice({
      userId: 'admin-1',
      role: Role.PLATFORM_ADMIN,
      deviceName: 'Chrome on Windows',
      ip: '127.0.0.1',
      location: 'Pakistan',
      targetClientDeviceIds: [],
    });

    expect(notifications.createNotification).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'New device sign-in',
        html: expect.any(String),
      }),
    );
  });

  it('defaults both login alert channels to enabled when no settings row exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...userWithPreferences(true, true),
      settings: null,
    });

    await service.notifySuspiciousLocation({
      userId: 'admin-1',
      role: Role.PLATFORM_ADMIN,
      previousLocation: 'Pakistan',
      newLocation: 'United Kingdom',
    });

    expect(notifications.createNotification).toHaveBeenCalled();
    expect(email.send).toHaveBeenCalled();
  });
});
