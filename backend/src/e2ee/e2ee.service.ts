import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { E2EEApprovalStatus, E2EEDeviceTrustStatus, Prisma, Role } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterTrustedDeviceDto } from './dto/register-trusted-device.dto';
import { UpdateTrustedDeviceDto } from './dto/update-trusted-device.dto';
import { ApproveTrustedDeviceDto } from './dto/approve-trusted-device.dto';

type CurrentUser = {
  id: string;
  role: Role | string;
  organizationId?: string | null;
};

const DEFAULT_LIBSODIUM_ALGORITHM = 'libsodium:x25519+ed25519';

@Injectable()
export class E2eeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async registerCurrentDevice(user: CurrentUser, dto: RegisterTrustedDeviceDto) {
    const algorithm = dto.algorithm || DEFAULT_LIBSODIUM_ALGORITHM;
    const now = new Date();

    const existingIdentity = await this.prisma.userEncryptionIdentity.findUnique({
      where: { userId: user.id },
    });

    const identity = existingIdentity || await this.prisma.userEncryptionIdentity.create({
      data: {
        userId: user.id,
        identityPublicKey: dto.identityPublicKey,
        publicKeyFingerprint: dto.identityPublicKeyFingerprint,
        signingPublicKey: dto.identitySigningPublicKey,
        signingPublicKeyFingerprint: dto.identitySigningPublicKeyFingerprint,
        algorithm,
      },
    });

    const existingDevice = await this.prisma.trustedEncryptionDevice.findUnique({
      where: {
        userId_clientDeviceId: {
          userId: user.id,
          clientDeviceId: dto.clientDeviceId,
        },
      },
    });

    const keysChanged = Boolean(existingDevice && (
      existingDevice.keyAgreementPublicKey !== dto.keyAgreementPublicKey ||
      existingDevice.signingPublicKey !== (dto.signingPublicKey || null)
    ));

    const [otherTrustedDeviceCount, historicalTrustedDeviceCount] = await Promise.all([
      this.prisma.trustedEncryptionDevice.count({
        where: {
          userId: user.id,
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
          trustedAt: { not: null },
          ...(existingDevice ? { id: { not: existingDevice.id } } : {}),
        },
      }),
      this.prisma.trustedEncryptionDevice.count({
        where: {
          userId: user.id,
          trustedAt: { not: null },
        },
      }),
    ]);
    const existingCanRemainTrusted = Boolean(
      existingDevice &&
      !keysChanged &&
      existingDevice.trustStatus === E2EEDeviceTrustStatus.TRUSTED &&
      !existingDevice.revokedAt &&
      existingDevice.trustedAt,
    );
    const isFirstTrustedBrowserRegistration = !existingDevice && historicalTrustedDeviceCount === 0 && otherTrustedDeviceCount === 0;
    const shouldTrustNow = existingCanRemainTrusted || isFirstTrustedBrowserRegistration;
    const trustStatus = shouldTrustNow
      ? E2EEDeviceTrustStatus.TRUSTED
      : E2EEDeviceTrustStatus.PENDING;

    const device = existingDevice
      ? await this.prisma.trustedEncryptionDevice.update({
        where: { id: existingDevice.id },
        data: {
          identityId: identity.id,
          displayName: dto.displayName,
          deviceType: dto.deviceType,
          browser: dto.browser,
          os: dto.os,
          keyAgreementPublicKey: dto.keyAgreementPublicKey,
          keyAgreementPublicKeyFingerprint: dto.keyAgreementPublicKeyFingerprint,
          signingPublicKey: dto.signingPublicKey,
          signingPublicKeyFingerprint: dto.signingPublicKeyFingerprint,
          algorithm,
          keyVersion: keysChanged ? existingDevice.keyVersion + 1 : existingDevice.keyVersion,
          lastSeenAt: now,
          trustStatus,
          approvalRequestedAt: trustStatus === E2EEDeviceTrustStatus.PENDING
            ? existingDevice.approvalRequestedAt || now
            : null,
          trustedAt: trustStatus === E2EEDeviceTrustStatus.TRUSTED
            ? existingDevice.trustedAt || now
            : null,
          approvedByDeviceId: trustStatus === E2EEDeviceTrustStatus.TRUSTED
            ? existingDevice.approvedByDeviceId
            : null,
          revokedAt: null,
          revokedById: null,
        },
      })
      : await this.prisma.trustedEncryptionDevice.create({
        data: {
          userId: user.id,
          identityId: identity.id,
          clientDeviceId: dto.clientDeviceId,
          displayName: dto.displayName,
          deviceType: dto.deviceType,
          browser: dto.browser,
          os: dto.os,
          keyAgreementPublicKey: dto.keyAgreementPublicKey,
          keyAgreementPublicKeyFingerprint: dto.keyAgreementPublicKeyFingerprint,
          signingPublicKey: dto.signingPublicKey,
          signingPublicKeyFingerprint: dto.signingPublicKeyFingerprint,
          algorithm,
          lastSeenAt: now,
          trustStatus,
          approvalRequestedAt: trustStatus === E2EEDeviceTrustStatus.PENDING ? now : null,
          trustedAt: trustStatus === E2EEDeviceTrustStatus.TRUSTED ? now : null,
        },
      });

    if (device.trustStatus === E2EEDeviceTrustStatus.PENDING) {
      const approvalRequest = await this.ensurePendingDeviceApprovalRequest(user.id, device.id);

      if (dto.requestApprovalNotification) {
        await this.notifyDeviceApprovalRequest(user.id, device.id, device.clientDeviceId, approvalRequest.id);
      }
    }

    return {
      identity: this.serializeIdentity(identity),
      device: this.serializeDevice(device),
    };
  }

  async requestPendingDeviceApproval(user: CurrentUser, pendingDeviceId: string) {
    const pendingDevice = await this.prisma.trustedEncryptionDevice.findFirst({
      where: {
        id: pendingDeviceId,
        userId: user.id,
        trustStatus: E2EEDeviceTrustStatus.PENDING,
        revokedAt: null,
      },
    });
    if (!pendingDevice) throw new NotFoundException('Pending browser not found.');

    const trustedDeviceCount = await this.prisma.trustedEncryptionDevice.count({
      where: {
        userId: user.id,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
        trustedAt: { not: null },
        id: { not: pendingDevice.id },
      },
    });
    if (trustedDeviceCount === 0) {
      throw new BadRequestException('No trusted browser is available to approve this one.');
    }

    const approvalRequest = await this.ensurePendingDeviceApprovalRequest(user.id, pendingDevice.id);
    await this.notifyDeviceApprovalRequest(user.id, pendingDevice.id, pendingDevice.clientDeviceId, approvalRequest.id);

    return this.serializeDevice(pendingDevice);
  }

  async listMyDevices(userId: string) {
    const [identity, devices] = await Promise.all([
      this.prisma.userEncryptionIdentity.findUnique({ where: { userId } }),
      this.prisma.trustedEncryptionDevice.findMany({
        where: { userId },
        orderBy: [{ revokedAt: 'asc' }, { trustStatus: 'asc' }, { trustedAt: 'desc' }, { approvalRequestedAt: 'desc' }],
      }),
    ]);

    return {
      identity: identity ? this.serializeIdentity(identity) : null,
      devices: devices.map((device) => this.serializeDevice(device)),
    };
  }

  async updateMyDevice(userId: string, deviceId: string, dto: UpdateTrustedDeviceDto) {
    const device = await this.prisma.trustedEncryptionDevice.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new NotFoundException('Trusted browser not found.');

    const updated = await this.prisma.trustedEncryptionDevice.update({
      where: { id: device.id },
      data: { displayName: dto.displayName },
    });

    return this.serializeDevice(updated);
  }

  async revokeMyDevice(user: CurrentUser, deviceId: string, currentToken?: string) {
    await this.ensureCurrentSessionTrustedDevice(user.id, currentToken);

    const device = await this.prisma.trustedEncryptionDevice.findFirst({
      where: { id: deviceId, userId: user.id },
    });
    if (!device) throw new NotFoundException('Trusted browser not found.');

    if (device.trustStatus === E2EEDeviceTrustStatus.TRUSTED && !device.revokedAt && device.trustedAt) {
      const trustedDeviceCount = await this.prisma.trustedEncryptionDevice.count({
        where: {
          userId: user.id,
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
          trustedAt: { not: null },
        },
      });

      if (trustedDeviceCount <= 1) {
        throw new BadRequestException('Keep at least one trusted browser on your account.');
      }
    }

    const updated = await this.prisma.trustedEncryptionDevice.update({
      where: { id: device.id },
      data: {
        trustStatus: E2EEDeviceTrustStatus.REVOKED,
        revokedAt: device.revokedAt || new Date(),
        revokedById: user.id,
      },
    });

    return this.serializeDevice(updated);
  }

  async approveMyPendingDevice(user: CurrentUser, pendingDeviceId: string, dto: ApproveTrustedDeviceDto, currentToken?: string) {
    if (pendingDeviceId === dto.approverDeviceId) {
      throw new ForbiddenException('A browser cannot approve itself.');
    }

    await this.ensureCurrentSessionTrustedDevice(user.id, currentToken, dto.approverDeviceId);

    const [pendingDevice, approverDevice] = await Promise.all([
      this.prisma.trustedEncryptionDevice.findFirst({
        where: {
          id: pendingDeviceId,
          userId: user.id,
          trustStatus: E2EEDeviceTrustStatus.PENDING,
          revokedAt: null,
        },
      }),
      this.prisma.trustedEncryptionDevice.findFirst({
        where: {
          id: dto.approverDeviceId,
          userId: user.id,
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
          trustedAt: { not: null },
        },
      }),
    ]);

    if (!pendingDevice) throw new NotFoundException('Pending browser not found.');
    if (!approverDevice) throw new ForbiddenException('Approval requires a browser you already trust.');

    await this.validateApprovalHistoryKeyTransfer({
      userId: user.id,
      pendingDeviceId: pendingDevice.id,
      pendingDeviceKeyVersion: pendingDevice.keyVersion,
      approverDeviceId: approverDevice.id,
      historyKeyEnvelopes: dto.historyKeyEnvelopes || [],
    });

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const envelope of dto.historyKeyEnvelopes || []) {
        await tx.e2EEHistoryKeyDeviceEnvelope.upsert({
          where: {
            historyKeyId_trustedDeviceId: {
              historyKeyId: envelope.historyKeyId,
              trustedDeviceId: pendingDevice.id,
            },
          },
          update: {
            recipientUserId: user.id,
            senderDeviceId: approverDevice.id,
            deviceKeyVersion: pendingDevice.keyVersion,
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce,
            associatedData: envelope.associatedData === undefined
              ? undefined
              : envelope.associatedData as Prisma.InputJsonValue,
          },
          create: {
            historyKeyId: envelope.historyKeyId,
            recipientUserId: user.id,
            trustedDeviceId: pendingDevice.id,
            senderDeviceId: approverDevice.id,
            deviceKeyVersion: pendingDevice.keyVersion,
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce,
            associatedData: envelope.associatedData === undefined
              ? undefined
              : envelope.associatedData as Prisma.InputJsonValue,
          },
        });
      }

      await tx.e2EEDeviceApprovalRequest.updateMany({
        where: {
          userId: user.id,
          pendingDeviceId: pendingDevice.id,
          status: E2EEApprovalStatus.PENDING,
        },
        data: {
          status: E2EEApprovalStatus.APPROVED,
          approverDeviceId: approverDevice.id,
          respondedAt: now,
        },
      });

      return tx.trustedEncryptionDevice.update({
        where: { id: pendingDevice.id },
        data: {
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          trustedAt: now,
          approvedByDeviceId: approverDevice.id,
          approvalRequestedAt: null,
        },
      });
    });

    return this.serializeDevice(updated);
  }

  async getPendingDeviceApprovalContext(user: CurrentUser, pendingDeviceId: string, approverDeviceId: string, currentToken?: string) {
    if (pendingDeviceId === approverDeviceId) {
      throw new ForbiddenException('A browser cannot approve itself.');
    }

    await this.ensureCurrentSessionTrustedDevice(user.id, currentToken, approverDeviceId);

    const [pendingDevice, approverDevice] = await Promise.all([
      this.prisma.trustedEncryptionDevice.findFirst({
        where: {
          id: pendingDeviceId,
          userId: user.id,
          trustStatus: E2EEDeviceTrustStatus.PENDING,
          revokedAt: null,
        },
      }),
      this.prisma.trustedEncryptionDevice.findFirst({
        where: {
          id: approverDeviceId,
          userId: user.id,
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
          trustedAt: { not: null },
        },
      }),
    ]);

    if (!pendingDevice) throw new NotFoundException('Pending browser not found.');
    if (!approverDevice) throw new ForbiddenException('Approval requires a browser you already trust.');

    const historyKeys = await this.prisma.chatHistoryKey.findMany({
      where: {
        deviceEnvelopes: {
          some: {
            recipientUserId: user.id,
            trustedDeviceId: approverDevice.id,
          },
        },
      },
      orderBy: [{ chatId: 'asc' }, { epoch: 'asc' }, { createdAt: 'asc' }],
      include: {
        deviceEnvelopes: {
          where: {
            recipientUserId: user.id,
            trustedDeviceId: approverDevice.id,
          },
          include: {
            senderDevice: {
              select: {
                id: true,
                userId: true,
                keyAgreementPublicKey: true,
                keyAgreementPublicKeyFingerprint: true,
                keyVersion: true,
                trustStatus: true,
                revokedAt: true,
              },
            },
            trustedDevice: {
              select: {
                id: true,
                userId: true,
                clientDeviceId: true,
                keyVersion: true,
                trustStatus: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });

    return {
      pendingDevice: this.serializeDevice(pendingDevice),
      approverDevice: this.serializeDevice(approverDevice),
      historyKeys,
    };
  }

  async getRecipientDevices(user: CurrentUser, userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) return [];

    const visibleUsers = await this.getVisibleRecipientUsers(user, uniqueUserIds);
    const visibleUserIds = visibleUsers.map((candidate) => candidate.id);

    if (visibleUserIds.length !== uniqueUserIds.length) {
      throw new ForbiddenException('You cannot check secure message access for one or more users.');
    }

    const devices = await this.prisma.trustedEncryptionDevice.findMany({
      where: {
        userId: { in: visibleUserIds },
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
        trustedAt: { not: null },
      },
      orderBy: [{ userId: 'asc' }, { trustedAt: 'desc' }],
    });

    return visibleUsers.map((recipient) => ({
      userId: recipient.id,
      identity: recipient.encryptionIdentity
        ? this.serializeIdentity(recipient.encryptionIdentity)
        : null,
      devices: devices
        .filter((device) => device.userId === recipient.id)
        .map((device) => this.serializePublicDevice(device)),
    }));
  }

  private async getVisibleRecipientUsers(user: CurrentUser, userIds: string[]) {
    if (this.isPlatformUser(user.role)) {
      return this.prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { encryptionIdentity: true },
      });
    }

    const visibility: Array<{ id: string } | { organizationId: string }> = [{ id: user.id }];
    if (user.organizationId) visibility.push({ organizationId: user.organizationId });

    return this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        OR: visibility,
      },
      include: { encryptionIdentity: true },
    });
  }

  private isPlatformUser(role: Role | string) {
    return role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN;
  }

  private async ensureCurrentSessionTrustedDevice(userId: string, currentToken?: string, expectedDeviceId?: string) {
    if (!currentToken) {
      throw new ForbiddenException('Use a trusted browser to manage trusted browsers.');
    }

    const currentSession = await this.prisma.session.findFirst({
      where: {
        userId,
        token: currentToken,
        isActive: true,
      },
      select: { deviceId: true },
    });

    if (!currentSession?.deviceId) {
      throw new ForbiddenException('Use a trusted browser to manage trusted browsers.');
    }

    const trustedDevice = await this.prisma.trustedEncryptionDevice.findFirst({
      where: {
        userId,
        clientDeviceId: currentSession.deviceId,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
        trustedAt: { not: null },
      },
      select: { id: true },
    });

    if (!trustedDevice) {
      throw new ForbiddenException('Use a trusted browser to manage trusted browsers.');
    }

    if (expectedDeviceId && trustedDevice.id !== expectedDeviceId) {
      throw new ForbiddenException('Approval must be completed from the selected trusted browser.');
    }

    return trustedDevice;
  }

  private async validateApprovalHistoryKeyTransfer(options: {
    userId: string;
    pendingDeviceId: string;
    pendingDeviceKeyVersion: number;
    approverDeviceId: string;
    historyKeyEnvelopes: NonNullable<ApproveTrustedDeviceDto['historyKeyEnvelopes']>;
  }) {
    const accessibleHistoryKeys = await this.prisma.chatHistoryKey.findMany({
      where: {
        deviceEnvelopes: {
          some: {
            recipientUserId: options.userId,
            trustedDeviceId: options.approverDeviceId,
          },
        },
      },
      select: { id: true },
    });
    const accessibleHistoryKeyIds = new Set(accessibleHistoryKeys.map((historyKey) => historyKey.id));
    const transferHistoryKeyIds = new Set(options.historyKeyEnvelopes.map((envelope) => envelope.historyKeyId));

    for (const historyKeyId of accessibleHistoryKeyIds) {
      if (!transferHistoryKeyIds.has(historyKeyId)) {
        throw new BadRequestException('This browser could not copy all existing secure Chat history. Refresh and try again.');
      }
    }

    for (const envelope of options.historyKeyEnvelopes) {
      if (envelope.recipientUserId !== options.userId) {
        throw new BadRequestException('Transferred history-key envelope recipient is invalid.');
      }
      if (envelope.trustedDeviceId !== options.pendingDeviceId) {
        throw new BadRequestException('Transferred history-key envelope target device is invalid.');
      }
      if (envelope.senderDeviceId && envelope.senderDeviceId !== options.approverDeviceId) {
        throw new BadRequestException('Transferred history-key envelope sender device is invalid.');
      }
      if (envelope.deviceKeyVersion !== options.pendingDeviceKeyVersion) {
        throw new BadRequestException('Transferred history-key envelope device key version is stale.');
      }
      if (!accessibleHistoryKeyIds.has(envelope.historyKeyId)) {
        throw new ForbiddenException('This browser cannot copy one or more secure Chat records.');
      }
    }
  }

  private async ensurePendingDeviceApprovalRequest(userId: string, pendingDeviceId: string) {
    const pendingRequest = await this.prisma.e2EEDeviceApprovalRequest.findFirst({
      where: {
        userId,
        pendingDeviceId,
        status: E2EEApprovalStatus.PENDING,
      },
    });

    if (pendingRequest) return pendingRequest;

    return this.prisma.e2EEDeviceApprovalRequest.create({
      data: {
        userId,
        pendingDeviceId,
      },
    });
  }

  private async notifyDeviceApprovalRequest(userId: string, pendingDeviceId: string, pendingClientDeviceId: string, approvalRequestId: string) {
    const targetClientDeviceIds = (await this.prisma.trustedEncryptionDevice.findMany({
      where: {
        userId,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
        trustedAt: { not: null },
        clientDeviceId: { not: pendingClientDeviceId },
      },
      select: { clientDeviceId: true },
    })).map((device) => device.clientDeviceId);

    if (targetClientDeviceIds.length === 0) return;

    await this.notifications.createNotification({
      userId,
      title: 'Approve this browser?',
      body: 'A browser just signed in to your account. Review it before it can open secure Chat and Mail.',
      type: 'E2EE_DEVICE_APPROVAL',
      actionUrl: `/settings?tab=security&approveDeviceId=${encodeURIComponent(pendingDeviceId)}`,
      metadata: {
        pendingDeviceId,
        pendingClientDeviceId,
        approvalRequestId,
        targetClientDeviceIds,
      },
    });
  }

  private serializeIdentity(identity: {
    id: string;
    userId: string;
    keyVersion: number;
    identityPublicKey: string;
    publicKeyFingerprint: string | null;
    signingPublicKey: string | null;
    signingPublicKeyFingerprint: string | null;
    algorithm: string;
    createdAt: Date;
    rotatedAt: Date | null;
    disabledAt: Date | null;
  }) {
    return {
      id: identity.id,
      userId: identity.userId,
      keyVersion: identity.keyVersion,
      identityPublicKey: identity.identityPublicKey,
      publicKeyFingerprint: identity.publicKeyFingerprint,
      signingPublicKey: identity.signingPublicKey,
      signingPublicKeyFingerprint: identity.signingPublicKeyFingerprint,
      algorithm: identity.algorithm,
      createdAt: identity.createdAt,
      rotatedAt: identity.rotatedAt,
      disabledAt: identity.disabledAt,
    };
  }

  private serializeDevice(device: {
    id: string;
    userId: string;
    clientDeviceId: string;
    displayName: string | null;
    deviceType: string | null;
    browser: string | null;
    os: string | null;
    keyVersion: number;
    keyAgreementPublicKey: string;
    keyAgreementPublicKeyFingerprint: string | null;
    signingPublicKey: string | null;
    signingPublicKeyFingerprint: string | null;
    algorithm: string;
    trustStatus: E2EEDeviceTrustStatus | string;
    approvalRequestedAt: Date | null;
    trustedAt: Date | null;
    approvedByDeviceId: string | null;
    lastSeenAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: device.id,
      userId: device.userId,
      clientDeviceId: device.clientDeviceId,
      displayName: device.displayName,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      keyVersion: device.keyVersion,
      keyAgreementPublicKey: device.keyAgreementPublicKey,
      keyAgreementPublicKeyFingerprint: device.keyAgreementPublicKeyFingerprint,
      signingPublicKey: device.signingPublicKey,
      signingPublicKeyFingerprint: device.signingPublicKeyFingerprint,
      algorithm: device.algorithm,
      trustStatus: device.trustStatus,
      approvalRequestedAt: device.approvalRequestedAt,
      trustedAt: device.trustedAt,
      approvedByDeviceId: device.approvedByDeviceId,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  private serializePublicDevice(device: Parameters<E2eeService['serializeDevice']>[0]) {
    return this.serializeDevice(device);
  }
}
