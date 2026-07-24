import { Role } from '../common/enums';
import type { NotificationCreator } from '../notifications/notifications.tokens';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from './security.service';

describe('SecurityService login notification preferences', () => {
  const prisma = {
    userSettings: {
      findUnique: jest.fn(),
    },
  };
  const notifications = {
    createNotification: jest.fn(),
  };
  const service = new SecurityService(
    prisma as unknown as PrismaService,
    notifications as NotificationCreator,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not create new-device push notifications when disabled', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({
      loginNotificationPush: false,
    });

    await service.notifyNewDevice({
      userId: 'admin-1',
      role: Role.PLATFORM_ADMIN,
      deviceId: 'device-1',
      deviceName: 'Chrome',
      ip: '127.0.0.1',
      location: 'Pakistan',
      targetClientDeviceIds: ['trusted-device-1'],
    });

    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('preserves notifications for users without an explicit settings row', async () => {
    prisma.userSettings.findUnique.mockResolvedValue(null);

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
  });
});
