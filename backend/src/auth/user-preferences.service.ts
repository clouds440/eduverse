import { BadRequestException, Injectable } from '@nestjs/common';
import {
  E2EEDeviceTrustStatus,
  Role,
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
    const updateData: UpdateUserSettingsDto & {
      twoFactorEnabled?: boolean;
      twoFactorMethod?: TwoFactorMethod;
    } = { ...data };
    if (
      data.emailTwoFactorEnabled !== undefined ||
      data.deviceTwoFactorEnabled !== undefined
    ) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true, settings: true },
      });
      if (!user) throw new BadRequestException('User not found');
      if (data.emailTwoFactorEnabled) {
        const verifiedEmail =
          user.role === Role.ORG_ADMIN
            ? user.organization?.contactEmailVerifiedAt
            : user.contactEmailVerifiedAt;
        if (!verifiedEmail) {
          throw new BadRequestException(
            'Verify a contact email before enabling email verification.',
          );
        }
      }
      if (data.deviceTwoFactorEnabled) {
        const trustedDevice = await this.prisma.trustedEncryptionDevice.findFirst({
          where: {
            userId,
            trustStatus: E2EEDeviceTrustStatus.TRUSTED,
            revokedAt: null,
          },
          select: { id: true },
        });
        if (!trustedDevice) {
          throw new BadRequestException(
            'Trust at least one browser before enabling trusted-browser verification.',
          );
        }
      }
      const emailEnabled =
        data.emailTwoFactorEnabled ??
        user.settings?.emailTwoFactorEnabled ??
        false;
      const deviceEnabled =
        data.deviceTwoFactorEnabled ??
        user.settings?.deviceTwoFactorEnabled ??
        false;
      updateData.twoFactorEnabled = emailEnabled || deviceEnabled;
      updateData.twoFactorMethod =
        emailEnabled && deviceEnabled
          ? TwoFactorMethod.BOTH
          : emailEnabled
            ? TwoFactorMethod.EMAIL
            : TwoFactorMethod.DEVICE;
    }
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...updateData },
      update: updateData,
    });
    return this.withDefaults(settings);
  }

  private withDefaults(
    settings:
      | {
          userId: string;
          twoFactorEnabled: boolean;
          twoFactorMethod: TwoFactorMethod;
          emailTwoFactorEnabled: boolean;
          deviceTwoFactorEnabled: boolean;
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
        emailTwoFactorEnabled: false,
        deviceTwoFactorEnabled: false,
        themeMode: ThemeMode.SYSTEM,
        loginNotificationEmail: true,
        loginNotificationPush: true,
        marketingEmails: false,
      }
    );
  }
}
