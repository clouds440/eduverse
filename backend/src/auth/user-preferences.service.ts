import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  E2EEDeviceTrustStatus,
  PendingLoginStatus,
  Role,
  ThemeMode,
  TwoFactorMethod,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { assertCanManageOrganizationUserSecurity } from './managed-security-access';
import { RequestMetadata } from './auth-internal.types';
import { SecurityService } from './security.service';

@Injectable()
export class UserPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

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

  async toggleManagedTwoFactor(
    actor: { id: string; role?: string; organizationId?: string | null },
    targetUserId: string,
    meta: RequestMetadata,
  ) {
    const target = await this.getManagedSecurityTarget(actor, targetUserId);

    const currentlyEnabled = target.settings?.twoFactorEnabled === true;
    let emailEnabled = false;
    let deviceEnabled = false;
    if (!currentlyEnabled) {
      emailEnabled = Boolean(
        target.role === Role.ORG_ADMIN
          ? target.organization?.contactEmailVerifiedAt
          : target.contactEmailVerifiedAt,
      );
      deviceEnabled = Boolean(
        await this.prisma.trustedEncryptionDevice.findFirst({
          where: {
            userId: target.id,
            trustStatus: E2EEDeviceTrustStatus.TRUSTED,
            revokedAt: null,
          },
          select: { id: true },
        }),
      );
      if (!emailEnabled && !deviceEnabled) {
        throw new BadRequestException(
          'This user needs a verified contact email or trusted browser before two-step verification can be enabled.',
        );
      }
    }

    const enabled = emailEnabled || deviceEnabled;
    const settings = await this.prisma.userSettings.upsert({
      where: { userId: target.id },
      create: {
        userId: target.id,
        twoFactorEnabled: enabled,
        emailTwoFactorEnabled: emailEnabled,
        deviceTwoFactorEnabled: deviceEnabled,
        twoFactorMethod: this.getTwoFactorMethod(
          emailEnabled,
          deviceEnabled,
        ),
      },
      update: {
        twoFactorEnabled: enabled,
        emailTwoFactorEnabled: emailEnabled,
        deviceTwoFactorEnabled: deviceEnabled,
        twoFactorMethod: this.getTwoFactorMethod(
          emailEnabled,
          deviceEnabled,
        ),
      },
    });
    if (!enabled) {
      await this.prisma.pendingLogin.updateMany({
        where: {
          userId: target.id,
          status: {
            in: [
              PendingLoginStatus.PENDING,
              PendingLoginStatus.VERIFIED,
            ],
          },
        },
        data: { status: PendingLoginStatus.CANCELLED },
      });
    }
    await this.securityService.recordEvent('managed_two_factor_toggled', {
      ...meta,
      actorUserId: actor.id,
      targetUserId: target.id,
      organizationId: target.organizationId ?? undefined,
      details: {
        enabled,
        emailEnabled,
        deviceEnabled,
      },
    });
    return {
      enabled: settings.twoFactorEnabled,
      emailEnabled: settings.emailTwoFactorEnabled,
      deviceEnabled: settings.deviceTwoFactorEnabled,
      message: enabled
        ? 'Two-step verification was enabled for this user.'
        : 'Two-step verification was disabled for this user.',
    };
  }

  async getManagedTwoFactorStatus(
    actor: { role?: string; organizationId?: string | null },
    targetUserId: string,
  ) {
    const target = await this.getManagedSecurityTarget(actor, targetUserId);
    return {
      enabled: target.settings?.twoFactorEnabled ?? false,
      emailEnabled: target.settings?.emailTwoFactorEnabled ?? false,
      deviceEnabled: target.settings?.deviceTwoFactorEnabled ?? false,
    };
  }

  private getTwoFactorMethod(
    emailEnabled: boolean,
    deviceEnabled: boolean,
  ) {
    if (emailEnabled && deviceEnabled) return TwoFactorMethod.BOTH;
    return emailEnabled ? TwoFactorMethod.EMAIL : TwoFactorMethod.DEVICE;
  }

  private async getManagedSecurityTarget(
    actor: { role?: string; organizationId?: string | null },
    targetUserId: string,
  ) {
    if (!actor.organizationId) {
      throw new BadRequestException('Organization context is required.');
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: actor.organizationId },
      include: { organization: true, settings: true },
    });
    if (!target) throw new NotFoundException('User not found.');
    assertCanManageOrganizationUserSecurity(
      actor.role,
      target.role,
    );
    return target;
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
