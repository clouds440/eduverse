import { Injectable } from '@nestjs/common';
import {
  Role,
  ThemeMode,
  TwoFactorMethod,
  UserSettings,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedUserSettings = Omit<
  UserSettings,
  'userId' | 'createdAt' | 'updatedAt'
>;

export const DEFAULT_USER_SETTINGS: ResolvedUserSettings = {
  twoFactorEnabled: false,
  twoFactorMethod: TwoFactorMethod.DEVICE,
  emailTwoFactorEnabled: false,
  deviceTwoFactorEnabled: false,
  themeMode: ThemeMode.SYSTEM,
  loginNotificationEmail: true,
  loginNotificationPush: true,
  marketingEmails: false,
};

export interface UserSettingsContext {
  user: {
    id: string;
    email: string;
    role: Role;
    organizationId: string | null;
  };
  settings: ResolvedUserSettings;
}

export function resolveUserSettings(
  settings: UserSettings | null | undefined,
): ResolvedUserSettings {
  if (!settings) return { ...DEFAULT_USER_SETTINGS };
  return {
    twoFactorEnabled: settings.twoFactorEnabled,
    twoFactorMethod: settings.twoFactorMethod,
    emailTwoFactorEnabled: settings.emailTwoFactorEnabled,
    deviceTwoFactorEnabled: settings.deviceTwoFactorEnabled,
    themeMode: settings.themeMode,
    loginNotificationEmail: settings.loginNotificationEmail,
    loginNotificationPush: settings.loginNotificationPush,
    marketingEmails: settings.marketingEmails,
  };
}

/**
 * The single backend entry point for a user's complete settings context.
 * It keeps persistence and defaults out of feature services as settings grow.
 */
@Injectable()
export class UserSettingsContextService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserSettingsContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        settings: true,
      },
    });
    if (!user) return null;
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      settings: resolveUserSettings(user.settings),
    };
  }
}
