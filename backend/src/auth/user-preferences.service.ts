import { Injectable } from '@nestjs/common';
import {
  ThemeMode,
  TwoFactorMethod,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Injectable()
export class UserPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    userId: string,
    data: Partial<{ themeMode: ThemeMode; name?: string }>,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        settings: data.themeMode
          ? {
              upsert: {
                create: { themeMode: data.themeMode },
                update: { themeMode: data.themeMode },
              },
            }
          : undefined,
      },
      include: {
        organization: true,
        teacherProfile: true,
        settings: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      organization: updated.organization,
      teacherProfile: updated.teacherProfile,
      themeMode: updated.settings?.themeMode ?? ThemeMode.SYSTEM,
      settings: this.withDefaults(updated.settings),
    };
  }

  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.withDefaults(settings);
  }

  async updateSettings(userId: string, data: UpdateUserSettingsDto) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.withDefaults(settings);
  }

  private withDefaults(
    settings:
      | {
          userId: string;
          twoFactorEnabled: boolean;
          twoFactorMethod: TwoFactorMethod;
          themeMode: ThemeMode;
          loginNotificationEmail: boolean;
          loginNotificationPush: boolean;
          marketingEmails: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      | null,
  ) {
    return (
      settings ?? {
        twoFactorEnabled: false,
        twoFactorMethod: TwoFactorMethod.DEVICE,
        themeMode: ThemeMode.SYSTEM,
        loginNotificationEmail: true,
        loginNotificationPush: true,
        marketingEmails: false,
      }
    );
  }
}
