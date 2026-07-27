import {
  E2EEDeviceTrustStatus,
  E2EEHistoryProvisioningStatus,
} from '@/prisma/prisma-client';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  E2eeService,
  RECENT_CHAT_HISTORY_MESSAGE_LIMIT,
} from './e2ee.service';
import type { ChatDeviceHistoryGrantDto } from './dto/approve-trusted-device.dto';

const userId = 'user-1';
const chatId = 'chat-1';

function device(
  id: string,
  clientDeviceId: string,
  trustStatus: E2EEDeviceTrustStatus,
) {
  return {
    id,
    userId,
    identityId: 'identity-1',
    clientDeviceId,
    displayName: clientDeviceId,
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    keyVersion: 1,
    keyAgreementPublicKey: `${id}-public`,
    keyAgreementPublicKeyFingerprint: null,
    signingPublicKey: null,
    signingPublicKeyFingerprint: null,
    algorithm: 'libsodium:x25519+ed25519',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
    trustStatus,
    approvalRequestedAt: null,
    trustedAt:
      trustStatus === E2EEDeviceTrustStatus.TRUSTED ? new Date() : null,
    approvedByDeviceId: null,
    revokedAt: null,
    revokedById: null,
    historyProvisioningStatus: E2EEHistoryProvisioningStatus.PENDING,
  };
}

function grant(messageNumbers: number[]): ChatDeviceHistoryGrantDto {
  return {
    chatId,
    deviceKeyVersion: 1,
    algorithm: 'box',
    wrappedKey: 'wrapped-grant',
    nonce: 'grant-nonce',
    contentEnvelopes: messageNumbers.map((number) => ({
      messageId: `message-${number}`,
      encryptedContentId: `content-${number}`,
      algorithm: 'symmetric',
      wrappedKey: `wrapped-${number}`,
      nonce: `nonce-${number}`,
    })),
  };
}

describe('E2eeService recent Chat history provisioning', () => {
  const pendingDevice = device(
    'pending-device',
    'new-browser',
    E2EEDeviceTrustStatus.PENDING,
  );
  const approverDevice = device(
    'approver-device',
    'trusted-browser',
    E2EEDeviceTrustStatus.TRUSTED,
  );
  type TransactionMock = {
    chatDeviceHistoryGrant: { upsert: jest.Mock };
    e2EEContentDeviceGrantEnvelope: {
      deleteMany: jest.Mock;
      upsert: jest.Mock;
    };
    e2EEDeviceApprovalRequest: { updateMany: jest.Mock };
    trustedEncryptionDevice: { update: jest.Mock };
  };
  type PrismaMock = {
    trustedEncryptionDevice: {
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    chatParticipant: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    chatMessage: { findMany: jest.Mock };
    e2EEContentDeviceGrantEnvelope: { count: jest.Mock };
    e2EEDeviceApprovalRequest: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
    e2EEHistoryKeyDeviceEnvelope?: never;
  };
  let prisma: PrismaMock;
  let tx: TransactionMock;
  let service: E2eeService;

  beforeEach(() => {
    tx = {
      chatDeviceHistoryGrant: {
        upsert: jest.fn().mockResolvedValue({ id: 'grant-1' }),
      },
      e2EEContentDeviceGrantEnvelope: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({ id: 'envelope-1' }),
      },
      e2EEDeviceApprovalRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      trustedEncryptionDevice: {
        update: jest.fn().mockResolvedValue({
          ...pendingDevice,
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          historyProvisioningStatus: E2EEHistoryProvisioningStatus.READY,
          trustedAt: new Date(),
        }),
      },
    };
    prisma = {
      trustedEncryptionDevice: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.clientDeviceId === approverDevice.clientDeviceId
              ? approverDevice
              : pendingDevice,
          ),
        ),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatParticipant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'participant-1',
          chatId,
          userId,
          clearedAt: null,
          membershipHistory: [],
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue(
          Array.from(
            { length: RECENT_CHAT_HISTORY_MESSAGE_LIMIT },
            (_, index) => ({
              id: `message-${index + 1}`,
              encryptedContent: { id: `content-${index + 1}` },
            }),
          ),
        ),
      },
      e2EEContentDeviceGrantEnvelope: {
        count: jest.fn().mockResolvedValue(
          RECENT_CHAT_HISTORY_MESSAGE_LIMIT,
        ),
      },
      e2EEDeviceApprovalRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'approval-1' }),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    service = new E2eeService(
      prisma as unknown as PrismaService,
      {
        createNotification: jest.fn(),
      } as unknown as NotificationsService,
    );
  });

  it('stores exactly the latest 35 visible messages and never message 36', async () => {
    await service.provisionPendingLoginDevice(
      userId,
      pendingDevice.id,
      approverDevice.clientDeviceId,
      {
        chatGrants: [
          grant(
            Array.from(
              { length: RECENT_CHAT_HISTORY_MESSAGE_LIMIT },
              (_, index) => index + 1,
            ),
          ),
        ],
        complete: false,
      },
    );

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: RECENT_CHAT_HISTORY_MESSAGE_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(
      tx.e2EEContentDeviceGrantEnvelope.upsert,
    ).toHaveBeenCalledTimes(RECENT_CHAT_HISTORY_MESSAGE_LIMIT);
    expect(
      tx.e2EEContentDeviceGrantEnvelope.upsert,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          encryptedContentId_grantId: expect.objectContaining({
            encryptedContentId: 'content-36',
          }),
        }),
      }),
    );
  });

  it('rejects arbitrary or out-of-window message IDs', async () => {
    const submitted = Array.from(
      { length: RECENT_CHAT_HISTORY_MESSAGE_LIMIT },
      (_, index) => index + 1,
    );
    submitted[submitted.length - 1] = 36;

    await expect(
      service.provisionPendingLoginDevice(
        userId,
        pendingDevice.id,
        approverDevice.clientDeviceId,
        { chatGrants: [grant(submitted)], complete: false },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.chatDeviceHistoryGrant.upsert).not.toHaveBeenCalled();
  });

  it('uses upserts and safely repeats an interrupted batch', async () => {
    const payload = {
      chatGrants: [
        grant(
          Array.from(
            { length: RECENT_CHAT_HISTORY_MESSAGE_LIMIT },
            (_, index) => index + 1,
          ),
        ),
      ],
      complete: false,
    };

    await service.provisionPendingLoginDevice(
      userId,
      pendingDevice.id,
      approverDevice.clientDeviceId,
      payload,
    );
    await service.provisionPendingLoginDevice(
      userId,
      pendingDevice.id,
      approverDevice.clientDeviceId,
      payload,
    );

    expect(tx.chatDeviceHistoryGrant.upsert).toHaveBeenCalledTimes(2);
    expect(
      tx.e2EEContentDeviceGrantEnvelope.upsert,
    ).toHaveBeenCalledTimes(RECENT_CHAT_HISTORY_MESSAGE_LIMIT * 2);
    expect(tx.trustedEncryptionDevice.update).not.toHaveBeenCalled();
  });

  it('marks the browser trusted and history ready only after final validation', async () => {
    prisma.chatParticipant.findMany.mockResolvedValue([
      {
        id: 'participant-1',
        chatId,
        userId,
        clearedAt: null,
        membershipHistory: [],
      },
    ]);

    const result = await service.provisionPendingLoginDevice(
      userId,
      pendingDevice.id,
      approverDevice.clientDeviceId,
      {
        chatGrants: [
          grant(
            Array.from(
              { length: RECENT_CHAT_HISTORY_MESSAGE_LIMIT },
              (_, index) => index + 1,
            ),
          ),
        ],
        complete: true,
      },
    );

    expect(result.complete).toBe(true);
    expect(tx.trustedEncryptionDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          historyProvisioningStatus: E2EEHistoryProvisioningStatus.READY,
        }),
      }),
    );
  });

  it('email vouch trusts future messages while leaving recent history pending', async () => {
    prisma.trustedEncryptionDevice.update.mockResolvedValue({
      ...pendingDevice,
      trustStatus: E2EEDeviceTrustStatus.TRUSTED,
      trustedAt: new Date(),
    });

    await service.trustPendingLoginDeviceWithoutHistory(
      userId,
      pendingDevice.id,
    );

    expect(prisma.trustedEncryptionDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          historyProvisioningStatus: E2EEHistoryProvisioningStatus.PENDING,
        }),
      }),
    );
    expect(tx.e2EEContentDeviceGrantEnvelope.upsert).not.toHaveBeenCalled();
  });

  it('leaves legacy history-key envelopes untouched', async () => {
    await service.provisionPendingLoginDevice(
      userId,
      pendingDevice.id,
      approverDevice.clientDeviceId,
      {
        chatGrants: [
          grant(
            Array.from(
              { length: RECENT_CHAT_HISTORY_MESSAGE_LIMIT },
              (_, index) => index + 1,
            ),
          ),
        ],
        complete: false,
      },
    );

    expect(prisma.e2EEHistoryKeyDeviceEnvelope).toBeUndefined();
  });
});
