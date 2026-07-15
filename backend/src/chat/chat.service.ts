import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { TeacherService } from '../teacher/teacher.service';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateGroupChatDto } from './dto/create-group.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { RegisterChatHistoryKeyDto } from './dto/register-chat-history-key.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Role,
  ChatType,
  ChatParticipantRole,
  ChatMessageType,
  CommunicationChannel,
  E2EEContentType,
  E2EEDeviceTrustStatus,
  Prisma,
} from '@/prisma/prisma-client';
import { fuzzyFilterAndRank } from '../common/utils';
import {
  DIRECT_MESSAGE_BLOCK_CHANNEL,
  getDirectChatOtherParticipant,
  getDirectMessageBlockState,
} from './chat-communication.utils';
import {
  addScopeCount,
  getMentionOptionRoles,
  getMentionRecipientIdsFromTargets,
  type ChatMentionOptions,
} from './chat-mentions.utils';
import {
  CHAT_MENTION_NOTIFICATION_BODY,
  CHAT_MESSAGE_NOTIFICATION_BODY,
  getChatPushTitle,
} from './chat-notification.utils';

interface CurrentUser {
  id: string;
  role: Role;
  organizationId: string | null;
  name?: string;
}

type ChatPresetFilters = {
  cohortId?: string;
  departmentId?: string;
};

const ENCRYPTED_CHAT_MESSAGE_PLACEHOLDER = '[Encrypted message]';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly notifications: NotificationsService,
    private readonly teacherService: TeacherService,
  ) { }

  private isPlatformUser(role: Role) {
    return role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN;
  }

  private getChatUserSelect() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      avatarUpdatedAt: true,
      phone: true,
      studentProfile: {
        select: {
          registrationNumber: true,
          rollNumber: true,
        },
      },
      teacherProfile: {
        select: {
          designation: true,
        },
      },
      guardianProfile: {
        select: {
          phone: true,
          studentLinks: {
            select: {
              relationshipLabel: true,
              student: {
                select: {
                  registrationNumber: true,
                  rollNumber: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            take: 5,
          },
        },
      },
    } satisfies Prisma.UserSelect;
  }

  private getCommunicationBlockTargetSelect() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      avatarUpdatedAt: true,
      organizationId: true,
    } satisfies Prisma.UserSelect;
  }

  private async withDirectMessageBlockStates<
    T extends {
      id: string;
      type: ChatType;
      participants?: Array<{
        userId: string;
        user?: { id: string; role: Role } | null;
      }> | null;
    },
  >(chats: T[], user: CurrentUser) {
    const directTargets = chats
      .map((chat) => getDirectChatOtherParticipant(chat, user.id))
      .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant?.userId));
    const targetIds = Array.from(new Set(directTargets.map((participant) => participant.userId)));
    const directChatIds = chats
      .filter((chat) => chat.type === ChatType.DIRECT)
      .map((chat) => chat.id);

    const blocks = targetIds.length || directChatIds.length
      ? await this.prisma.userCommunicationBlock.findMany({
        where: {
          channel: DIRECT_MESSAGE_BLOCK_CHANNEL,
          OR: [
            ...(directChatIds.length ? [{ chatId: { in: directChatIds } }] : []),
            ...(targetIds.length
              ? [
                { userId: user.id, targetUserId: { in: targetIds } },
                { userId: { in: targetIds }, targetUserId: user.id },
              ]
              : []),
          ],
        },
        select: {
          id: true,
          userId: true,
          targetUserId: true,
          chatId: true,
          channel: true,
        },
      })
      : [];

    return chats.map((chat) => {
      const otherParticipant = getDirectChatOtherParticipant(chat, user.id);
      if (!otherParticipant?.user) {
        return { ...chat, directMessageBlock: null };
      }

      const state = getDirectMessageBlockState(blocks, user.id, otherParticipant.userId, chat.id);

      return {
        ...chat,
        directMessageBlock: {
          ...state,
          canBlock: true,
          reason: null,
        },
      };
    });
  }

  private async assertDirectMessagesAvailable(userId: string, targetUserId: string, chatId?: string | null) {
    const block = await this.prisma.userCommunicationBlock.findFirst({
      where: {
        channel: DIRECT_MESSAGE_BLOCK_CHANNEL,
        OR: [
          ...(chatId ? [{ chatId }] : []),
          { userId, targetUserId },
          { userId: targetUserId, targetUserId: userId },
        ],
      },
      select: { id: true },
    });

    if (block) {
      throw new ForbiddenException('Direct messages are blocked between these users. Unblock DMs to continue.');
    }
  }

  private async getActiveChatParticipantIds(chatId: string) {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
      select: { userId: true },
    });

    return participants.map((participant) => participant.userId);
  }

  private getEncryptedContentInclude(recipientUserId?: string) {
    return {
      keyEnvelopes: {
        ...(recipientUserId ? { where: { recipientUserId } } : {}),
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
      historyKeyEnvelopes: {
        include: {
          historyKey: {
            select: {
              id: true,
              chatId: true,
              epoch: true,
              keyVersion: true,
              revokedAt: true,
              deviceEnvelopes: {
                ...(recipientUserId ? { where: { recipientUserId } } : {}),
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
          },
        },
      },
    } satisfies Prisma.EncryptedContentInclude;
  }

  private getChatMessageInclude(recipientUserId?: string) {
    return {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
      deletedBy: { select: { id: true, name: true } },
      chat: { select: { id: true, name: true, type: true } },
      encryptedContent: {
        include: this.getEncryptedContentInclude(recipientUserId),
      },
      replyTo: {
        include: {
          sender: { select: { id: true, name: true } },
          encryptedContent: {
            include: this.getEncryptedContentInclude(recipientUserId),
          },
        },
      },
    } satisfies Prisma.ChatMessageInclude;
  }

  private async validateEncryptedChatContent(options: {
    chatId: string;
    chatType?: ChatType;
    senderId: string;
    activeParticipantIds: string[];
    encryptedContent?: SendMessageDto['encryptedContent'];
  }) {
    const encryptedContent = options.encryptedContent;
    if (!encryptedContent) {
      throw new BadRequestException('Encrypted chat content is required.');
    }

    if (!encryptedContent.keyEnvelopes?.length) {
      throw new BadRequestException('Encrypted chat messages require at least one key envelope.');
    }

    const activeParticipantIds = new Set(options.activeParticipantIds);
    const trustedDeviceIds = Array.from(new Set(encryptedContent.keyEnvelopes.map((envelope) => envelope.trustedDeviceId)));
    const senderDeviceIds = Array.from(new Set(encryptedContent.keyEnvelopes.map((envelope) => envelope.senderDeviceId).filter(Boolean) as string[]));
    const historyKeyIds = Array.from(new Set((encryptedContent.historyKeyEnvelopes || []).map((envelope) => envelope.historyKeyId)));
    const directEnvelopeRecipientIds = new Set(encryptedContent.keyEnvelopes.map((envelope) => envelope.recipientUserId));
    const missingParticipantIds = options.activeParticipantIds.filter((participantId) => !directEnvelopeRecipientIds.has(participantId));
    if (options.chatType !== ChatType.GROUP && missingParticipantIds.length > 0) {
      throw new BadRequestException('Encrypted message is missing key envelopes for one or more active chat participants.');
    }

    const [trustedDevices, expectedTrustedDevices] = await Promise.all([
      this.prisma.trustedEncryptionDevice.findMany({
        where: { id: { in: trustedDeviceIds } },
        select: { id: true, userId: true, keyVersion: true, trustStatus: true, revokedAt: true, trustedAt: true },
      }),
      this.prisma.trustedEncryptionDevice.findMany({
        where: {
          userId: { in: options.activeParticipantIds },
          trustStatus: E2EEDeviceTrustStatus.TRUSTED,
          revokedAt: null,
          trustedAt: { not: null },
        },
        select: { id: true },
      }),
    ]);
    const missingTrustedDeviceIds = expectedTrustedDevices.filter((device) => !trustedDeviceIds.includes(device.id));
    if (missingTrustedDeviceIds.length > 0) {
      throw new BadRequestException('Encrypted message is missing key envelopes for one or more trusted participant devices. Refresh and try again.');
    }
    const senderDevices = senderDeviceIds.length
      ? await this.prisma.trustedEncryptionDevice.findMany({
        where: { id: { in: senderDeviceIds } },
        select: { id: true, userId: true, trustStatus: true, revokedAt: true, trustedAt: true },
      })
      : [];
    const historyKeys = historyKeyIds.length
      ? await this.prisma.chatHistoryKey.findMany({
        where: { id: { in: historyKeyIds } },
        select: { id: true, chatId: true, userId: true, revokedAt: true },
      })
      : [];

    const trustedDeviceById = new Map(trustedDevices.map((device) => [device.id, device]));
    for (const envelope of encryptedContent.keyEnvelopes) {
      if (!activeParticipantIds.has(envelope.recipientUserId)) {
        throw new BadRequestException('Encrypted message envelope recipient is not an active chat participant.');
      }

      const device = trustedDeviceById.get(envelope.trustedDeviceId);
      if (!device || device.userId !== envelope.recipientUserId) {
        throw new BadRequestException('Encrypted message envelope target device does not belong to the recipient.');
      }

      if (device.trustStatus !== E2EEDeviceTrustStatus.TRUSTED || device.revokedAt || !device.trustedAt) {
        throw new BadRequestException('Encrypted message envelope targets a pending or revoked device.');
      }

      if (envelope.deviceKeyVersion !== device.keyVersion) {
        throw new BadRequestException('Encrypted message envelope device key version is stale.');
      }
    }

    const senderDeviceById = new Map(senderDevices.map((device) => [device.id, device]));
    for (const senderDeviceId of senderDeviceIds) {
      const device = senderDeviceById.get(senderDeviceId);
      if (!device || device.userId !== options.senderId) {
        throw new BadRequestException('Encrypted message sender device does not belong to the sender.');
      }
      if (device.trustStatus !== E2EEDeviceTrustStatus.TRUSTED || device.revokedAt || !device.trustedAt) {
        throw new BadRequestException('Encrypted message sender device is not trusted.');
      }
    }

    const historyKeyById = new Map(historyKeys.map((historyKey) => [historyKey.id, historyKey]));
    for (const envelope of encryptedContent.historyKeyEnvelopes || []) {
      if (!activeParticipantIds.has(envelope.recipientUserId)) {
        throw new BadRequestException('Encrypted history-key envelope recipient is not an active chat participant.');
      }

      const historyKey = historyKeyById.get(envelope.historyKeyId);
      if (!historyKey || historyKey.chatId !== options.chatId || historyKey.revokedAt) {
        throw new BadRequestException('Encrypted history-key envelope target is invalid for this chat.');
      }
    }
  }

  private buildEncryptedContentCreate(encryptedContent: NonNullable<SendMessageDto['encryptedContent']>) {
    return {
      contentType: E2EEContentType.CHAT_MESSAGE,
      encryptionVersion: encryptedContent.encryptionVersion,
      algorithm: encryptedContent.algorithm,
      ciphertext: encryptedContent.ciphertext,
      nonce: encryptedContent.nonce,
      authTag: encryptedContent.authTag,
      associatedData: encryptedContent.associatedData === undefined
        ? undefined
        : encryptedContent.associatedData as Prisma.InputJsonValue,
      contentKeyVersion: encryptedContent.contentKeyVersion ?? 1,
      keyEnvelopes: {
        create: encryptedContent.keyEnvelopes.map((envelope) => ({
          recipientUserId: envelope.recipientUserId,
          trustedDeviceId: envelope.trustedDeviceId,
          senderDeviceId: envelope.senderDeviceId,
          deviceKeyVersion: envelope.deviceKeyVersion,
          algorithm: envelope.algorithm,
          wrappedKey: envelope.wrappedKey,
          nonce: envelope.nonce,
          associatedData: envelope.associatedData === undefined
            ? undefined
            : envelope.associatedData as Prisma.InputJsonValue,
        })),
      },
      historyKeyEnvelopes: encryptedContent.historyKeyEnvelopes?.length
        ? {
          create: encryptedContent.historyKeyEnvelopes.map((envelope) => ({
            historyKeyId: envelope.historyKeyId,
            recipientUserId: envelope.recipientUserId,
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce,
            associatedData: envelope.associatedData === undefined
              ? undefined
              : envelope.associatedData as Prisma.InputJsonValue,
          })),
        }
        : undefined,
    } satisfies Prisma.EncryptedContentCreateWithoutChatMessageInput;
  }

  private async validateChatHistoryKeyDeviceEnvelopes(options: {
    chatId: string;
    senderId: string;
    activeParticipantIds: string[];
    deviceEnvelopes: RegisterChatHistoryKeyDto['deviceEnvelopes'];
  }) {
    if (!options.deviceEnvelopes.length) {
      throw new BadRequestException('Chat history keys require at least one device envelope.');
    }

    const activeParticipantIds = new Set(options.activeParticipantIds);
    const trustedDeviceIds = Array.from(new Set(options.deviceEnvelopes.map((envelope) => envelope.trustedDeviceId)));
    const senderDeviceIds = Array.from(new Set(options.deviceEnvelopes.map((envelope) => envelope.senderDeviceId).filter(Boolean) as string[]));

    const trustedDevices = await this.prisma.trustedEncryptionDevice.findMany({
      where: { id: { in: trustedDeviceIds } },
      select: { id: true, userId: true, keyVersion: true, trustStatus: true, revokedAt: true, trustedAt: true },
    });
    const senderDevices = senderDeviceIds.length
      ? await this.prisma.trustedEncryptionDevice.findMany({
        where: { id: { in: senderDeviceIds } },
        select: { id: true, userId: true, trustStatus: true, revokedAt: true, trustedAt: true },
      })
      : [];

    const trustedDeviceById = new Map(trustedDevices.map((device) => [device.id, device]));
    for (const envelope of options.deviceEnvelopes) {
      if (!activeParticipantIds.has(envelope.recipientUserId)) {
        throw new BadRequestException('Chat history-key envelope recipient is not an active chat participant.');
      }

      const device = trustedDeviceById.get(envelope.trustedDeviceId);
      if (!device || device.userId !== envelope.recipientUserId) {
        throw new BadRequestException('Chat history-key envelope target device does not belong to the recipient.');
      }
      if (device.trustStatus !== E2EEDeviceTrustStatus.TRUSTED || device.revokedAt || !device.trustedAt) {
        throw new BadRequestException('Chat history-key envelope targets a pending or revoked device.');
      }
      if (envelope.deviceKeyVersion !== device.keyVersion) {
        throw new BadRequestException('Chat history-key envelope device key version is stale.');
      }
    }

    const senderDeviceById = new Map(senderDevices.map((device) => [device.id, device]));
    for (const senderDeviceId of senderDeviceIds) {
      const device = senderDeviceById.get(senderDeviceId);
      if (!device || device.userId !== options.senderId) {
        throw new BadRequestException('Chat history-key sender device does not belong to the sender.');
      }
      if (device.trustStatus !== E2EEDeviceTrustStatus.TRUSTED || device.revokedAt || !device.trustedAt) {
        throw new BadRequestException('Chat history-key sender device is not trusted.');
      }
    }
  }

  private serializeHistoryKey(historyKey: Prisma.ChatHistoryKeyGetPayload<{
    include: {
      deviceEnvelopes: {
        include: {
          senderDevice: {
            select: {
              id: true;
              userId: true;
              keyAgreementPublicKey: true;
              keyAgreementPublicKeyFingerprint: true;
              keyVersion: true;
              trustStatus: true;
              revokedAt: true;
            };
          };
          trustedDevice: {
            select: {
              id: true;
              userId: true;
              clientDeviceId: true;
              keyVersion: true;
              trustStatus: true;
              revokedAt: true;
            };
          };
        };
      };
    };
  }>) {
    return historyKey;
  }

  private async retireChatHistoryKeysForMembershipChange(chatId: string) {
    const now = new Date();
    await this.prisma.chatHistoryKey.updateMany({
      where: { chatId, revokedAt: null },
      data: { rotatedAt: now, revokedAt: now },
    });
  }

  private async getDirectChatId(userId: string, targetUserId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      select: { id: true },
    });

    return chat?.id ?? null;
  }

  private async emitCommunicationBlockUpdate(userId: string, targetUserId: string, chatId?: string | null) {
    const payload = { chatId: chatId ?? await this.getDirectChatId(userId, targetUserId), userId, targetUserId };
    this.events.emitToRoom(`user:${userId}`, 'chat:communication-block:update', payload);
    this.events.emitToRoom(`user:${targetUserId}`, 'chat:communication-block:update', payload);
  }

  private async getMentionProfileUsers(userIds: string[]) {
    if (userIds.length === 0) return [];

    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        role: true,
        studentProfile: {
          select: {
            cohortId: true,
            primaryDepartmentId: true,
            enrollments: {
              select: {
                sectionId: true,
                isExcludedFromCohort: true,
                section: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    cohort: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
            studentDepartments: {
              select: {
                departmentId: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
            primaryDepartment: { select: { id: true, name: true, code: true } },
            cohort: { select: { id: true, name: true, code: true } },
          },
        },
        teacherProfile: {
          select: {
            sections: {
              select: {
                id: true,
                name: true,
                code: true,
                cohortId: true,
                cohort: { select: { id: true, name: true, code: true } },
              },
            },
            teacherDepartments: {
              select: {
                departmentId: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });
  }

  private async notifyMentionRecipients(options: {
    chatId: string;
    messageId: string;
    senderId: string;
    senderName: string;
    chatName: string;
    recipientIds: string[];
  }) {
    for (const userId of options.recipientIds) {
      if (userId === options.senderId) continue;
      await this.notifications.createNotification({
        userId,
        title: `${options.senderName} mentioned you in ${options.chatName}.`,
        body: CHAT_MENTION_NOTIFICATION_BODY,
        type: 'CHAT_MENTION',
        actionUrl: `/chat?id=${options.chatId}&msgId=${options.messageId}`,
      });
    }
  }

  private async getAssignedStudentUserIds(userId: string, role: Role) {
    if (role !== Role.TEACHER && role !== Role.ORG_MANAGER) return [];

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: { sections: { select: { id: true } } },
    });
    const sectionIds = teacher?.sections.map((section) => section.id) || [];
    if (sectionIds.length === 0) return [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: { in: sectionIds }, isExcludedFromCohort: false },
      select: { student: { select: { userId: true } } },
    });

    return enrollments.map((enrollment) => enrollment.student.userId);
  }

  private async getAssignedTeacherUserIdsForStudent(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: {
          where: { isExcludedFromCohort: false },
          select: {
            section: {
              select: {
                teachers: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    return [
      ...new Set(
        student?.enrollments.flatMap((enrollment) =>
          enrollment.section.teachers.map((teacher) => teacher.userId),
        ) || [],
      ),
    ];
  }

  private async getAssignedTeacherUserIdsForManager(userId: string) {
    const manager = await this.prisma.teacher.findUnique({
      where: { userId },
      include: {
        sections: { select: { teachers: { select: { userId: true } } } },
      },
    });

    return [
      ...new Set(
        manager?.sections.flatMap((section) =>
          section.teachers.map((teacher) => teacher.userId),
        ) || [],
      ),
    ];
  }

  private async canCreateDirectChatWith(
    user: CurrentUser,
    targetUser: { id: string; role: Role; organizationId: string | null },
  ) {
    if (user.id === targetUser.id) return false;

    const userIsPlatform = this.isPlatformUser(user.role);
    const targetIsPlatform = this.isPlatformUser(targetUser.role);
    if (userIsPlatform || targetIsPlatform) {
      return userIsPlatform && targetIsPlatform;
    }

    if (targetUser.organizationId !== user.organizationId) return false;

    if (user.role === Role.STUDENT) {
      const teacherUserIds = await this.getAssignedTeacherUserIdsForStudent(user.id);
      return targetUser.role === Role.TEACHER && teacherUserIds.includes(targetUser.id);
    }

    if (user.role === Role.GUARDIAN) {
      return ([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER] as Role[]).includes(targetUser.role);
    }

    if (user.role === Role.FINANCE_MANAGER) {
      return ([Role.ORG_ADMIN, Role.SUB_ADMIN] as Role[]).includes(targetUser.role);
    }

    if (user.role === Role.TEACHER) {
      if (([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER] as Role[]).includes(targetUser.role)) {
        return true;
      }
      const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
      return targetUser.role === Role.STUDENT && studentUserIds.includes(targetUser.id);
    }

    if (user.role === Role.ORG_MANAGER) {
      if (([Role.ORG_ADMIN, Role.SUB_ADMIN] as Role[]).includes(targetUser.role)) return true;
      const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
      if (targetUser.role === Role.STUDENT) return studentUserIds.includes(targetUser.id);
      if (targetUser.role === Role.TEACHER) {
        const manager = await this.prisma.teacher.findUnique({
          where: { userId: user.id },
          include: { sections: { select: { teachers: { select: { userId: true } } } } },
        });
        const teacherUserIds = manager?.sections.flatMap((section) =>
          section.teachers.map((teacher) => teacher.userId),
        ) || [];
        return teacherUserIds.includes(targetUser.id);
      }
      return false;
    }

    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return targetUser.organizationId === user.organizationId;
    }

    return false;
  }

  private getChatSearchTerms(query: string) {
    const normalized = query.trim().replace(/\s+/g, ' ');
    if (!normalized) return [];

    const terms = new Set([normalized]);
    const lower = normalized.toLowerCase();
    const phoneticPairs: Array<[RegExp, string]> = [
      [/ahmed/g, 'ahmad'],
      [/ahmad/g, 'ahmed'],
      [/mohammed/g, 'muhammad'],
      [/muhammad/g, 'mohammed'],
      [/mohammad/g, 'muhammad'],
      [/fatima/g, 'fatma'],
      [/fatma/g, 'fatima'],
    ];

    for (const [pattern, replacement] of phoneticPairs) {
      const variant = lower.replace(pattern, replacement);
      if (variant !== lower) terms.add(variant);
    }

    const compact = lower.replace(/[aeiou]/g, '');
    if (compact.length >= 3) terms.add(compact);

    return Array.from(terms);
  }

  private getRoleSearchWhere(searchTerms: string[], targetRole?: Role): Prisma.UserWhereInput {
    const userTextSearch = searchTerms.flatMap((term) => [
      { name: { contains: term, mode: 'insensitive' as const } },
      { email: { contains: term, mode: 'insensitive' as const } },
      { phone: { contains: term, mode: 'insensitive' as const } },
    ]);

    const studentSearch = searchTerms.flatMap((term) => [
      { studentProfile: { is: { registrationNumber: { contains: term, mode: 'insensitive' as const } } } },
      { studentProfile: { is: { rollNumber: { contains: term, mode: 'insensitive' as const } } } },
    ]);

    const teacherSearch = searchTerms.map((term) => ({
      teacherProfile: { is: { designation: { contains: term, mode: 'insensitive' as const } } },
    }));

    const guardianSearch = searchTerms.flatMap((term) => [
      { guardianProfile: { is: { phone: { contains: term, mode: 'insensitive' as const } } } },
      {
        guardianProfile: {
          is: {
            studentLinks: {
              some: {
                OR: [
                  { relationshipLabel: { contains: term, mode: 'insensitive' as const } },
                  { student: { registrationNumber: { contains: term, mode: 'insensitive' as const } } },
                  { student: { rollNumber: { contains: term, mode: 'insensitive' as const } } },
                  { student: { user: { name: { contains: term, mode: 'insensitive' as const } } } },
                  { student: { user: { email: { contains: term, mode: 'insensitive' as const } } } },
                ],
              },
            },
          },
        },
      },
    ]);

    if (targetRole === Role.STUDENT) return { OR: [...userTextSearch, ...studentSearch] };
    if (targetRole === Role.TEACHER || targetRole === Role.ORG_MANAGER) return { OR: [...userTextSearch, ...teacherSearch] };
    if (targetRole === Role.GUARDIAN) return { OR: [...userTextSearch, ...guardianSearch] };

    return { OR: [...userTextSearch, ...studentSearch, ...teacherSearch, ...guardianSearch] };
  }

  private getContactableUsersWhere(user: CurrentUser, assignedStudentUserIds: string[], teacherUserIds: string[]): Prisma.UserWhereInput {
    if (user.role === Role.TEACHER) {
      return {
        OR: [
          { role: Role.ORG_ADMIN },
          { role: Role.SUB_ADMIN },
          { role: Role.ORG_MANAGER },
          { role: Role.STUDENT, id: { in: assignedStudentUserIds } },
        ],
      };
    }

    if (user.role === Role.STUDENT) {
      return { role: Role.TEACHER, id: { in: teacherUserIds } };
    }

    if (user.role === Role.GUARDIAN) {
      return { role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER] } };
    }

    if (user.role === Role.FINANCE_MANAGER) {
      return { role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN] } };
    }

    if (user.role === Role.ORG_MANAGER) {
      return {
        OR: [
          { role: { in: [Role.ORG_ADMIN, Role.SUB_ADMIN] } },
          { role: Role.TEACHER, id: { in: teacherUserIds } },
          { role: Role.STUDENT, id: { in: assignedStudentUserIds } },
        ],
      };
    }

    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return {
        role: {
          in: [
            Role.ORG_ADMIN,
            Role.SUB_ADMIN,
            Role.ORG_MANAGER,
            Role.FINANCE_MANAGER,
            Role.TEACHER,
            Role.STUDENT,
            Role.GUARDIAN,
          ],
        },
      };
    }

    if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
      return { role: { in: [Role.SUPER_ADMIN, Role.PLATFORM_ADMIN] } };
    }

    return { role: { not: Role.STUDENT } };
  }

  async searchUsers(query: string, user: CurrentUser, selectedRole?: Role) {
    const searchQuery = query.trim();
    if (!searchQuery) return [];

    const roleValues = Object.values(Role) as Role[];
    const targetRole = selectedRole && roleValues.includes(selectedRole) ? selectedRole : undefined;
    if (!targetRole) return [];
    const searchTerms = this.getChatSearchTerms(searchQuery);

    let assignedStudentUserIds: string[] = [];
    let teacherUserIds: string[] = [];

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      assignedStudentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
    }

    if (user.role === Role.STUDENT) {
      teacherUserIds = await this.getAssignedTeacherUserIdsForStudent(user.id);
    } else if (user.role === Role.ORG_MANAGER) {
      teacherUserIds = await this.getAssignedTeacherUserIdsForManager(user.id);
    }

    const baseAnd: Prisma.UserWhereInput[] = [
      this.getContactableUsersWhere(user, assignedStudentUserIds, teacherUserIds),
      ...(targetRole ? [{ role: targetRole }] : []),
    ];
    const whereClause: Prisma.UserWhereInput = {
      id: { not: user.id }, // don't return self
      ...(this.isPlatformUser(user.role) ? {} : { organizationId: user.organizationId }),
      AND: [...baseAnd, this.getRoleSearchWhere(searchTerms, targetRole)],
    };
    const fallbackWhereClause: Prisma.UserWhereInput = {
      id: { not: user.id },
      ...(this.isPlatformUser(user.role) ? {} : { organizationId: user.organizationId }),
      AND: baseAnd,
    };
    const userSelect = this.getChatUserSelect();

    const usersList = await this.prisma.user.findMany({
      where: whereClause,
      select: userSelect,
      take: 20,
    });

    if (usersList.length === 0) {
      const candidates = await this.prisma.user.findMany({
        where: fallbackWhereClause,
        select: userSelect,
        take: 500,
      });
      return fuzzyFilterAndRank(candidates, searchQuery, (candidate) => [
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.studentProfile?.registrationNumber,
        candidate.studentProfile?.rollNumber,
        candidate.teacherProfile?.designation,
        candidate.guardianProfile?.phone,
        ...(candidate.guardianProfile?.studentLinks || []).flatMap((link) => [
          link.relationshipLabel,
          link.student?.registrationNumber,
          link.student?.rollNumber,
          link.student?.user?.name,
        ]),
      ]).slice(0, 20);
    }

    return usersList;
  }

  async getPresetUsers(preset: string, user: CurrentUser, filters: ChatPresetFilters) {
    const presetKey = preset.trim().toUpperCase();
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    const isTeacherOrManager = user.role === Role.TEACHER || user.role === Role.ORG_MANAGER;
    const isPlatformUser = this.isPlatformUser(user.role);
    const select = this.getChatUserSelect();
    const baseAnd: Prisma.UserWhereInput[] = [
      { id: { not: user.id } },
      ...(isPlatformUser ? [] : [{ organizationId: user.organizationId }]),
    ];
    const whereWith = (...clauses: Prisma.UserWhereInput[]): Prisma.UserWhereInput => ({
      AND: [...baseAnd, ...clauses],
    });
    const requireCohort = () => {
      if (!filters.cohortId) throw new BadRequestException('Choose a cohort for this shortcut.');
      return filters.cohortId;
    };
    const requireDepartment = () => {
      if (!filters.departmentId) throw new BadRequestException('Choose a department for this shortcut.');
      return filters.departmentId;
    };
    const requireOrgAdminPreset = () => {
      if (!isOrgAdmin) throw new ForbiddenException('You cannot use this group shortcut.');
    };
    const requireStudentPreset = () => {
      if (!isOrgAdmin && !isTeacherOrManager) throw new ForbiddenException('You cannot use this group shortcut.');
    };

    let where: Prisma.UserWhereInput;

    if (presetKey === 'PLATFORM_ADMINS') {
      if (!isPlatformUser) throw new ForbiddenException('You cannot use this group shortcut.');
      where = whereWith({ role: { in: [Role.SUPER_ADMIN, Role.PLATFORM_ADMIN] } });
    } else if (presetKey === 'ALL_TEACHERS') {
      if (isOrgAdmin) {
        where = whereWith({ role: Role.TEACHER });
      } else if (user.role === Role.ORG_MANAGER) {
        const teacherUserIds = await this.getAssignedTeacherUserIdsForManager(user.id);
        where = whereWith({ role: Role.TEACHER }, { id: { in: teacherUserIds } });
      } else {
        throw new ForbiddenException('You cannot use this group shortcut.');
      }
    } else if (presetKey === 'ALL_MANAGERS') {
      requireOrgAdminPreset();
      where = whereWith({ role: Role.ORG_MANAGER });
    } else if (presetKey === 'ALL_SUB_ADMINS') {
      requireOrgAdminPreset();
      where = whereWith({ role: Role.SUB_ADMIN });
    } else if (presetKey === 'ALL_FINANCE_MANAGERS') {
      requireOrgAdminPreset();
      where = whereWith({ role: Role.FINANCE_MANAGER });
    } else if (presetKey === 'ALL_GUARDIANS') {
      requireOrgAdminPreset();
      where = whereWith({ role: Role.GUARDIAN });
    } else if (presetKey === 'GUARDIANS_BY_COHORT') {
      requireOrgAdminPreset();
      const cohortId = requireCohort();
      where = whereWith({
        role: Role.GUARDIAN,
        guardianProfile: {
          is: {
            studentLinks: {
              some: {
                student: { cohortId },
              },
            },
          },
        },
      });
    } else if (presetKey === 'ALL_STUDENTS') {
      requireStudentPreset();
      if (isOrgAdmin) {
        where = whereWith({ role: Role.STUDENT });
      } else {
        const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
        where = whereWith({ role: Role.STUDENT }, { id: { in: studentUserIds } });
      }
    } else if (presetKey === 'STUDENTS_BY_COHORT') {
      requireStudentPreset();
      const cohortId = requireCohort();
      if (isOrgAdmin) {
        where = whereWith({ role: Role.STUDENT }, { studentProfile: { is: { cohortId } } });
      } else {
        const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
        where = whereWith(
          { role: Role.STUDENT },
          { id: { in: studentUserIds } },
          { studentProfile: { is: { cohortId } } },
        );
      }
    } else if (presetKey === 'STUDENTS_BY_DEPARTMENT') {
      requireStudentPreset();
      const departmentId = requireDepartment();
      const departmentFilter: Prisma.UserWhereInput = {
        studentProfile: {
          is: {
            OR: [
              { primaryDepartmentId: departmentId },
              { studentDepartments: { some: { departmentId } } },
            ],
          },
        },
      };

      if (isOrgAdmin) {
        where = whereWith({ role: Role.STUDENT }, departmentFilter);
      } else {
        const studentUserIds = await this.getAssignedStudentUserIds(user.id, user.role);
        where = whereWith(
          { role: Role.STUDENT },
          { id: { in: studentUserIds } },
          departmentFilter,
        );
      }
    } else if (presetKey === 'TEACHERS_BY_DEPARTMENT') {
      const departmentId = requireDepartment();
      const departmentFilter: Prisma.UserWhereInput = {
        teacherProfile: {
          is: {
            teacherDepartments: { some: { departmentId } },
          },
        },
      };

      if (isOrgAdmin) {
        where = whereWith({ role: Role.TEACHER }, departmentFilter);
      } else if (user.role === Role.ORG_MANAGER) {
        const teacherUserIds = await this.getAssignedTeacherUserIdsForManager(user.id);
        where = whereWith({ role: Role.TEACHER }, { id: { in: teacherUserIds } }, departmentFilter);
      } else {
        throw new ForbiddenException('You cannot use this group shortcut.');
      }
    } else {
      throw new BadRequestException('Unknown group shortcut.');
    }

    return this.prisma.user.findMany({
      where,
      select,
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 1000,
    });
  }

  async getCommunicationBlocks(
    user: CurrentUser,
    channel: CommunicationChannel = DIRECT_MESSAGE_BLOCK_CHANNEL,
  ) {
    if (channel !== DIRECT_MESSAGE_BLOCK_CHANNEL) {
      throw new BadRequestException('Unsupported communication channel.');
    }

    return this.prisma.userCommunicationBlock.findMany({
      where: {
        userId: user.id,
        channel,
      },
      include: {
        targetUser: {
          select: this.getCommunicationBlockTargetSelect(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMentionOptions(chatId: string, user: CurrentUser): Promise<ChatMentionOptions> {
    const participant = await this.verifyChatAccess(chatId, user.id);
    if (!participant.isActive) {
      throw new ForbiddenException('You are no longer an active participant of this chat.');
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        type: true,
        participants: {
          where: { isActive: true },
          select: {
            userId: true,
            isActive: true,
            user: { select: { role: true } },
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type !== ChatType.GROUP) {
      return { roles: [], scopes: [] };
    }

    const activeUserIds = chat.participants.map((p) => p.userId);
    const users = await this.getMentionProfileUsers(activeUserIds);
    const scopeMap = new Map<string, ChatMentionOptions['scopes'][number]>();
    const seenScopeUsers = new Set<string>();

    for (const candidate of users) {
      if (candidate.role === Role.STUDENT && candidate.studentProfile) {
        const student = candidate.studentProfile;

        for (const enrollment of student.enrollments || []) {
          if (enrollment.isExcludedFromCohort) continue;
          addScopeCount(
            scopeMap,
            {
              type: 'SECTION',
              audienceRole: Role.STUDENT,
              id: enrollment.section.id,
              name: enrollment.section.name,
              code: enrollment.section.code,
            },
            candidate.id,
            seenScopeUsers,
          );
          addScopeCount(
            scopeMap,
            {
              type: 'SECTION',
              audienceRole: 'EVERYONE',
              id: enrollment.section.id,
              name: enrollment.section.name,
              code: enrollment.section.code,
            },
            candidate.id,
            seenScopeUsers,
          );

          if (enrollment.section.cohort) {
            addScopeCount(
              scopeMap,
              {
                type: 'COHORT',
                audienceRole: Role.STUDENT,
                id: enrollment.section.cohort.id,
                name: enrollment.section.cohort.name,
                code: enrollment.section.cohort.code,
              },
              candidate.id,
              seenScopeUsers,
            );
            addScopeCount(
              scopeMap,
              {
                type: 'COHORT',
                audienceRole: 'EVERYONE',
                id: enrollment.section.cohort.id,
                name: enrollment.section.cohort.name,
                code: enrollment.section.cohort.code,
              },
              candidate.id,
              seenScopeUsers,
            );
          }
        }

        if (student.primaryDepartment) {
          addScopeCount(
            scopeMap,
            {
              type: 'DEPARTMENT',
              audienceRole: Role.STUDENT,
              id: student.primaryDepartment.id,
              name: student.primaryDepartment.name,
              code: student.primaryDepartment.code,
            },
            candidate.id,
            seenScopeUsers,
          );
          addScopeCount(
            scopeMap,
            {
              type: 'DEPARTMENT',
              audienceRole: 'EVERYONE',
              id: student.primaryDepartment.id,
              name: student.primaryDepartment.name,
              code: student.primaryDepartment.code,
            },
            candidate.id,
            seenScopeUsers,
          );
        }

        for (const departmentLink of student.studentDepartments || []) {
          addScopeCount(
            scopeMap,
            {
              type: 'DEPARTMENT',
              audienceRole: Role.STUDENT,
              id: departmentLink.department.id,
              name: departmentLink.department.name,
              code: departmentLink.department.code,
            },
            candidate.id,
            seenScopeUsers,
          );
          addScopeCount(
            scopeMap,
            {
              type: 'DEPARTMENT',
              audienceRole: 'EVERYONE',
              id: departmentLink.department.id,
              name: departmentLink.department.name,
              code: departmentLink.department.code,
            },
            candidate.id,
            seenScopeUsers,
          );
        }

        if (student.cohort) {
          addScopeCount(
            scopeMap,
            {
              type: 'COHORT',
              audienceRole: Role.STUDENT,
              id: student.cohort.id,
              name: student.cohort.name,
              code: student.cohort.code,
            },
            candidate.id,
            seenScopeUsers,
          );
          addScopeCount(
            scopeMap,
            {
              type: 'COHORT',
              audienceRole: 'EVERYONE',
              id: student.cohort.id,
              name: student.cohort.name,
              code: student.cohort.code,
            },
            candidate.id,
            seenScopeUsers,
          );
        }
      }

      if (candidate.role === Role.TEACHER && candidate.teacherProfile) {
        const teacher = candidate.teacherProfile;

        for (const section of teacher.sections || []) {
          addScopeCount(
            scopeMap,
            {
              type: 'SECTION',
              audienceRole: Role.TEACHER,
              id: section.id,
              name: section.name,
              code: section.code,
            },
            candidate.id,
            seenScopeUsers,
          );
          addScopeCount(
            scopeMap,
            {
              type: 'SECTION',
              audienceRole: 'EVERYONE',
              id: section.id,
              name: section.name,
              code: section.code,
            },
            candidate.id,
            seenScopeUsers,
          );

          if (section.cohort) {
            addScopeCount(
              scopeMap,
              {
                type: 'COHORT',
                audienceRole: Role.TEACHER,
                id: section.cohort.id,
                name: section.cohort.name,
                code: section.cohort.code,
              },
              candidate.id,
              seenScopeUsers,
            );
            addScopeCount(
              scopeMap,
              {
                type: 'COHORT',
                audienceRole: 'EVERYONE',
                id: section.cohort.id,
                name: section.cohort.name,
                code: section.cohort.code,
              },
              candidate.id,
              seenScopeUsers,
            );
          }
        }

        for (const departmentLink of teacher.teacherDepartments || []) {
          addScopeCount(
            scopeMap,
            {
              type: 'DEPARTMENT',
              audienceRole: Role.TEACHER,
              id: departmentLink.department.id,
              name: departmentLink.department.name,
              code: departmentLink.department.code,
            },
            candidate.id,
            seenScopeUsers,
          );
          addScopeCount(
            scopeMap,
            {
              type: 'DEPARTMENT',
              audienceRole: 'EVERYONE',
              id: departmentLink.department.id,
              name: departmentLink.department.name,
              code: departmentLink.department.code,
            },
            candidate.id,
            seenScopeUsers,
          );
        }
      }
    }

    return {
      roles: getMentionOptionRoles(chat.participants),
      scopes: Array.from(scopeMap.values()).sort((a, b) => {
        const byAudience = a.audienceRole.localeCompare(b.audienceRole);
        if (byAudience !== 0) return byAudience;
        const byType = a.type.localeCompare(b.type);
        if (byType !== 0) return byType;
        return a.name.localeCompare(b.name);
      }),
    };
  }

  async blockCommunicationTarget(
    dto: { targetUserId?: string; channel?: CommunicationChannel },
    user: CurrentUser,
  ) {
    const targetUserId = dto.targetUserId?.trim();
    const channel = dto.channel || DIRECT_MESSAGE_BLOCK_CHANNEL;
    if (channel !== DIRECT_MESSAGE_BLOCK_CHANNEL) {
      throw new BadRequestException('Unsupported communication channel.');
    }
    if (!targetUserId) {
      throw new BadRequestException('Choose a user to block.');
    }
    if (targetUserId === user.id) {
      throw new BadRequestException('You cannot block DMs from yourself.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: this.getCommunicationBlockTargetSelect(),
    });
    if (!targetUser) throw new NotFoundException('User not found.');

    const userCanContactTarget = await this.canCreateDirectChatWith(user, {
      id: targetUser.id,
      role: targetUser.role as Role,
      organizationId: targetUser.organizationId,
    });
    const targetCanContactUser = await this.canCreateDirectChatWith(
      {
        id: targetUser.id,
        role: targetUser.role as Role,
        organizationId: targetUser.organizationId,
      },
      {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
      },
    );

    if (!userCanContactTarget && !targetCanContactUser) {
      throw new ForbiddenException('You cannot block DMs from this user.');
    }

    const chatId = await this.getDirectChatId(user.id, targetUserId);

    const block = await this.prisma.userCommunicationBlock.upsert({
      where: {
        userId_targetUserId_channel: {
          userId: user.id,
          targetUserId,
          channel,
        },
      },
      create: {
        userId: user.id,
        targetUserId,
        chatId,
        organizationId: user.organizationId,
        channel,
      },
      update: chatId ? { chatId } : {},
      include: {
        targetUser: {
          select: this.getCommunicationBlockTargetSelect(),
        },
      },
    });

    await this.emitCommunicationBlockUpdate(user.id, targetUserId, chatId);
    return block;
  }

  async unblockCommunicationTarget(
    targetUserId: string,
    user: CurrentUser,
    channel: CommunicationChannel = DIRECT_MESSAGE_BLOCK_CHANNEL,
  ) {
    if (channel !== DIRECT_MESSAGE_BLOCK_CHANNEL) {
      throw new BadRequestException('Unsupported communication channel.');
    }
    if (!targetUserId) {
      throw new BadRequestException('Choose a user to unblock.');
    }

    await this.prisma.userCommunicationBlock.deleteMany({
      where: {
        userId: user.id,
        targetUserId,
        channel,
      },
    });

    await this.emitCommunicationBlockUpdate(user.id, targetUserId);
    return { message: 'DM block removed.' };
  }

  async createDirectChat(dto: CreateDirectChatDto, user: CurrentUser) {
    if (user.id === dto.participantId) {
      throw new BadRequestException('Cannot chat with yourself.');
    }

    // Verify target exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.participantId },
    });
    if (!targetUser) throw new NotFoundException('User not found.');

    const allowed = await this.canCreateDirectChatWith(user, {
      id: targetUser.id,
      role: targetUser.role as Role,
      organizationId: targetUser.organizationId,
    });
    if (!allowed) {
      throw new ForbiddenException('You cannot start a direct chat with this user.');
    }

    await this.assertDirectMessagesAvailable(user.id, targetUser.id);

    // Check if chat already exists
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: dto.participantId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    // Create new direct chat
    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        organizationId: user.organizationId,
        creatorId: user.id,
        participants: {
          create: [
            {
              userId: user.id,
              role: ChatParticipantRole.ADMIN,
              membershipHistory: { create: { activatedAt: new Date() } },
            },
            {
              userId: dto.participantId,
              role: ChatParticipantRole.ADMIN,
              membershipHistory: { create: { activatedAt: new Date() } },
            },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Emit chat update event so frontend receives full chat data with participants
    this.events.emitToRoom(`chat:${chat.id}`, 'chat:update', chat);
    this.events.emitToRoom(`user:${user.id}`, 'chat:update', chat);
    this.events.emitToRoom(`user:${dto.participantId}`, 'chat:update', chat);

    return chat;
  }

  async createGroupChat(dto: CreateGroupChatDto, user: CurrentUser) {
    if (
      user.role === Role.STUDENT ||
      user.role === Role.GUARDIAN ||
      user.role === Role.FINANCE_MANAGER
    ) {
      throw new ForbiddenException('Your role cannot create group chats.');
    }

    const participants = Array.from(new Set([...dto.participantIds, user.id]));
    if (participants.length < 2) {
      throw new BadRequestException('Group must have at least 2 participants.');
    }

    // Check organization scoping
    const usersList = await this.prisma.user.findMany({
      where: { id: { in: participants } },
    });

    if (usersList.length !== participants.length) {
      throw new NotFoundException('One or more users not found.');
    }

    const isPlatformUser = (role: Role) =>
      role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN;
    const curUserIsPlatform = isPlatformUser(user.role);

    if (curUserIsPlatform) {
      const orgUsers = usersList.filter((u) => !isPlatformUser(u.role));
      if (orgUsers.length > 0) {
        throw new ForbiddenException(
          'Platform Administrators can only include other Platform Administrators in group chats.',
        );
      }
    } else {
      const externalUsers = usersList.filter(
        (u) =>
          u.organizationId !== user.organizationId || isPlatformUser(u.role),
      );
      if (externalUsers.length > 0) {
        throw new ForbiddenException(
          'Cannot include users outside your organization or Platform Administrators in organization group chats.',
        );
      }

      // Organization Policy: Students can only participate in section-based chats initiated by THEIR teachers.
      const studentsInGroup = usersList.filter((u) => u.role === Role.STUDENT);
      if (studentsInGroup.length > 0) {
        if (
          user.role !== Role.TEACHER &&
          user.role !== Role.ORG_MANAGER &&
          user.role !== Role.ORG_ADMIN &&
          user.role !== Role.SUB_ADMIN
        ) {
          throw new ForbiddenException(
            'Only academic staff or administrators can create group chats involving students.',
          );
        }
      }
    }

    // If Teacher, enforce they only add students from their sections (and ONLY students)
    if (user.role === Role.TEACHER) {
      const externalStaff = usersList.filter(
        (u) => u.id !== user.id && u.role !== Role.STUDENT,
      );
      if (externalStaff.length > 0) {
        throw new ForbiddenException(
          'Teachers can only create group chats with students. They cannot add other staff members.',
        );
      }

      // Find teacher sections
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        include: { sections: true },
      });
      const teacherSectionIds = teacher?.sections.map((s) => s.id) || [];

      // Get students they are trying to add
      const targetStudentUserIds = usersList
        .filter((u) => u.role === Role.STUDENT)
        .map((u) => u.id);

      if (targetStudentUserIds.length > 0) {
        const enrolledStudentsCount = await this.prisma.enrollment.groupBy({
          by: ['studentId'],
          where: {
            student: { userId: { in: targetStudentUserIds } },
            sectionId: { in: teacherSectionIds },
          },
        });

        // Comparing unique students enrolled in teacher's sections vs unique students they're adding
        if (enrolledStudentsCount.length < targetStudentUserIds.length) {
          throw new ForbiddenException(
            'Teachers can only add students from their assigned sections.',
          );
        }
      } else if (participants.length > 1) {
        // If there are participants but no students (and we already excluded other staff),
        // this case shouldn't be reachable but good for safety.
        throw new BadRequestException('Group must contain students.');
      }
    }

    if (user.role === Role.ORG_MANAGER) {
      const assignedStudentUserIds = await this.getAssignedStudentUserIds(
        user.id,
        user.role,
      );
      const manager = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        include: {
          sections: { select: { teachers: { select: { userId: true } } } },
        },
      });
      const assignedTeacherUserIds = manager?.sections.flatMap((section) =>
        section.teachers.map((teacher) => teacher.userId),
      ) || [];

      const disallowed = usersList.filter((participant) => {
        if (participant.id === user.id) return false;
        if (([Role.ORG_ADMIN, Role.SUB_ADMIN] as Role[]).includes(participant.role)) return false;
        if (participant.role === Role.STUDENT) {
          return !assignedStudentUserIds.includes(participant.id);
        }
        if (participant.role === Role.TEACHER) {
          return !assignedTeacherUserIds.includes(participant.id);
        }
        return true;
      });

      if (disallowed.length > 0) {
        throw new ForbiddenException(
          'Managers can only create groups for assigned academic sections.',
        );
      }
    }

    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name: dto.name,
        organizationId: user.organizationId,
        creatorId: user.id,
        participants: {
          create: participants.map((userId) => ({
            userId,
            role:
              userId === user.id
                ? ChatParticipantRole.ADMIN
                : ChatParticipantRole.MEMBER,
            membershipHistory: { create: { activatedAt: new Date() } },
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Create initial system message
    const userRec = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const systemMsg = await this.prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId: user.id,
        organizationId: user.organizationId,
        content: `${userRec?.name || 'Someone'} created the group "${dto.name}"`,
        type: ChatMessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    // Broadcast to all participants
    for (const p of participants) {
      this.events.emitToRoom(`user:${p}`, 'chat:message', systemMsg);
    }

    // Emit chat update event so frontend receives full chat data with participants
    this.events.emitToRoom(`chat:${chat.id}`, 'chat:update', chat);
    for (const p of participants) {
      this.events.emitToRoom(`user:${p}`, 'chat:update', chat);
    }

    return chat;
  }

  async addParticipants(
    chatId: string,
    dto: AddParticipantsDto,
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type === ChatType.DIRECT)
      throw new BadRequestException(
        'Cannot add participants to a direct chat.',
      );

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can add participants.',
      );
    }

    const newUsersList = await this.prisma.user.findMany({
      where: {
        id: { in: dto.participantIds },
        organizationId: user.organizationId,
      },
    });

    if (newUsersList.length !== dto.participantIds.length) {
      throw new BadRequestException(
        'One or more users not found or outside organization.',
      );
    }

    // Organization Policy: Only teachers can add students to groups
    const studentsToAdd = newUsersList.filter((u) => u.role === Role.STUDENT);
    if (studentsToAdd.length > 0) {
      if (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER) {
        throw new ForbiddenException(
          'Only teachers or managers can add students to group chats.',
        );
      }

      const targetStudentUserIds = studentsToAdd.map((u) => u.id);
      const assignedStudentUserIds = await this.getAssignedStudentUserIds(
        user.id,
        user.role,
      );

      if (
        targetStudentUserIds.some(
          (studentUserId) => !assignedStudentUserIds.includes(studentUserId),
        )
      ) {
        throw new ForbiddenException(
          'You can only add students from your assigned sections.',
        );
      }
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const systemMessages: string[] = [];

    for (const targetUser of newUsersList) {
      const existing = chat.participants.find(
        (p) => p.userId === targetUser.id,
      );
      if (existing) {
        if (existing.isActive) continue; // Already active
        await this.prisma.$transaction([
          this.prisma.chatParticipant.update({
            where: { id: existing.id },
            data: { isActive: true },
          }),
          this.prisma.chatMembershipHistory.create({
            data: { chatParticipantId: existing.id, activatedAt: new Date() },
          }),
        ]);
      } else {
        await this.prisma.chatParticipant.create({
          data: {
            chatId,
            userId: targetUser.id,
            membershipHistory: { create: { activatedAt: new Date() } },
          },
        });
      }
      systemMessages.push(
        `${adminUser?.name || 'Admin'} added ${targetUser.name || targetUser.email} to the group`,
      );
    }

    if (systemMessages.length > 0) {
      await this.retireChatHistoryKeysForMembershipChange(chatId);
    }

    // Log system messages
    for (const content of systemMessages) {
      const msg = await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: user.id,
          organizationId: user.organizationId,
          content,
          type: ChatMessageType.SYSTEM,
        },
        include: { sender: { select: { id: true, name: true } } },
      });
      this.events.emitToRoom(`chat:${chatId}`, 'chat:message', msg);
      // Notify participants individually
      const currentParticipants = await this.prisma.chatParticipant.findMany({
        where: { chatId, isActive: true },
      });
      for (const p of currentParticipants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:message', msg);
      }
    }

    // Emit chat update event so frontend can refresh with full participant data
    const updatedChat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (updatedChat) {
      this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
      for (const p of updatedChat.participants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
      }
    }

    return { message: 'Participants added successfully.' };
  }

  async updateChatLocalState(chatId: string, userId: string, options: { hide?: boolean; clear?: boolean }) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    const now = new Date();
    const data: Prisma.ChatParticipantUpdateInput = {};

    if (options.hide) {
      data.hiddenAt = now;
    }
    if (options.clear) {
      data.clearedAt = now;

      // Find the latest message to mark it as read when clearing
      const latestMsg = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
      });
      data.lastReadMessageId = latestMsg?.id || participant.lastReadMessageId;
    }

    const updated = await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data,
    });

    // Notify user of the change so frontend can refresh
    this.events.emitToRoom(`user:${userId}`, 'chat:update', {
      id: chatId,
      ...data,
    });

    return { message: 'Chat local state updated successfully.' };
  }

  async getChatE2eeContext(chatId: string, user: CurrentUser) {
    const participant = await this.verifyChatAccess(chatId, user.id);
    if (!participant.isActive) {
      throw new ForbiddenException('You are no longer an active participant of this chat.');
    }

    const activeParticipantIds = await this.getActiveChatParticipantIds(chatId);
    const historyKeys = await this.prisma.chatHistoryKey.findMany({
      where: { chatId, revokedAt: null },
      orderBy: [{ epoch: 'desc' }, { createdAt: 'desc' }],
      include: {
        deviceEnvelopes: {
          where: { recipientUserId: user.id },
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
      chatId,
      activeParticipantIds,
      historyKeys,
    };
  }

  async registerChatHistoryKey(
    chatId: string,
    dto: RegisterChatHistoryKeyDto,
    user: CurrentUser,
  ) {
    const participant = await this.verifyChatAccess(chatId, user.id);
    if (!participant.isActive) {
      throw new ForbiddenException('You are no longer an active participant of this chat.');
    }

    const activeParticipantIds = await this.getActiveChatParticipantIds(chatId);
    await this.validateChatHistoryKeyDeviceEnvelopes({
      chatId,
      senderId: user.id,
      activeParticipantIds,
      deviceEnvelopes: dto.deviceEnvelopes,
    });

    const latest = await this.prisma.chatHistoryKey.findFirst({
      where: { chatId },
      orderBy: { epoch: 'desc' },
      select: { epoch: true },
    });
    const epoch = (latest?.epoch ?? 0) + 1;

    const historyKey = await this.prisma.chatHistoryKey.create({
      data: {
        chatId,
        userId: user.id,
        epoch,
        algorithm: dto.algorithm,
        deviceEnvelopes: {
          create: dto.deviceEnvelopes.map((envelope) => ({
            recipientUserId: envelope.recipientUserId,
            trustedDeviceId: envelope.trustedDeviceId,
            senderDeviceId: envelope.senderDeviceId,
            deviceKeyVersion: envelope.deviceKeyVersion,
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce,
            associatedData: envelope.associatedData === undefined
              ? undefined
              : envelope.associatedData as Prisma.InputJsonValue,
          })),
        },
      },
      include: {
        deviceEnvelopes: {
          where: { recipientUserId: user.id },
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

    return this.serializeHistoryKey(historyKey);
  }

  async removeParticipant(
    chatId: string,
    targetUserId: string,
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type === ChatType.DIRECT)
      throw new BadRequestException(
        'Cannot remove participants from a direct chat.',
      );

    // Creator cannot be removed
    if (targetUserId === chat.creatorId) {
      throw new ForbiddenException(
        'The group creator cannot be removed from the chat.',
      );
    }

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can remove participants.',
      );
    }

    const participant = chat.participants.find(
      (p) => p.userId === targetUserId,
    );
    if (!participant || !participant.isActive) {
      throw new BadRequestException(
        'User is not an active participant of this chat.',
      );
    }

    const adminUserRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const targetUserRecord = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    const lastHistory = await this.prisma.chatMembershipHistory.findFirst({
      where: { chatParticipantId: participant.id, deactivatedAt: null },
      orderBy: { activatedAt: 'desc' },
    });

    // Log system message FIRST while user is still active so they can see it
    const content = `${adminUserRecord?.name || 'Admin'} removed ${targetUserRecord?.name || targetUserRecord?.email || 'someone'} from the group`;
    const msg = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: user.id,
        organizationId: user.organizationId,
        content,
        type: ChatMessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message', msg);
    const activeParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:message', msg);
    }
    // Explicitly notify the removed user if they weren't in the list
    if (!activeParticipants.some((p) => p.userId === targetUserId)) {
      this.events.emitToRoom(`user:${targetUserId}`, 'chat:message', msg);
    }

    // NOW deactivate the participant
    await this.prisma.$transaction([
      this.prisma.chatParticipant.update({
        where: { id: participant.id },
        data: { isActive: false },
      }),
      ...(lastHistory
        ? [
          this.prisma.chatMembershipHistory.update({
            where: { id: lastHistory.id },
            data: { deactivatedAt: new Date() },
          }),
        ]
        : []),
    ]);
    await this.retireChatHistoryKeysForMembershipChange(chatId);

    // Terminate WebSocket subscription immediately
    await this.events.forceLeaveRoom(targetUserId, `chat:${chatId}`);

    // Emit chat:update to refresh participant list for all users
    const updatedChat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (updatedChat) {
      this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
      for (const p of updatedChat.participants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
      }
    }

    return { message: 'Participant removed successfully.' };
  }

  async updateParticipantRole(
    chatId: string,
    targetUserId: string,
    role: ChatParticipantRole,
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: { include: { user: true } } },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type === ChatType.DIRECT)
      throw new BadRequestException(
        'Cannot update roles in a direct chat.',
      );

    // Creator cannot be demoted from ADMIN
    if (targetUserId === chat.creatorId && role !== ChatParticipantRole.ADMIN) {
      throw new ForbiddenException(
        'The group creator must remain as ADMIN.',
      );
    }

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can update participant roles.',
      );
    }

    const participant = chat.participants.find(
      (p) => p.userId === targetUserId,
    );
    if (!participant || !participant.isActive) {
      throw new BadRequestException(
        'User is not an active participant of this chat.',
      );
    }

    const oldRole = participant.role;
    const updatedParticipant = await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { role },
    });

    // Log system message for role change
    const actorName = user.name || 'Admin';
    const targetName = participant.user?.name || 'User';
    let roleChangeMessage: string;

    if (oldRole === role) {
      roleChangeMessage = `${actorName} set ${targetName}'s role to ${role}`;
    } else if (role === ChatParticipantRole.ADMIN) {
      roleChangeMessage = `${actorName} promoted ${targetName} to Admin`;
    } else if (role === ChatParticipantRole.MOD) {
      roleChangeMessage = `${actorName} promoted ${targetName} to Moderator`;
    } else if (role === ChatParticipantRole.MEMBER) {
      roleChangeMessage = `${actorName} demoted ${targetName} to Member`;
    } else {
      roleChangeMessage = `${actorName} changed ${targetName}'s role to ${role}`;
    }

    const systemMessage = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: user.id,
        organizationId: user.organizationId,
        content: roleChangeMessage,
        type: ChatMessageType.SYSTEM,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message', systemMessage);
    const activeParticipants = chat.participants.filter((p) => p.isActive);
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:message', systemMessage);
    }

    // Emit chat:update to refresh participant roles for all users
    const updatedChat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });
    if (updatedChat) {
      this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
      for (const p of activeParticipants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
      }
    }

    return { message: 'Participant role updated successfully.', participant: updatedParticipant };
  }

  async updateChat(
    chatId: string,
    dto: { name?: string; avatarUrl?: string; readOnly?: boolean },
    user: CurrentUser,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) throw new NotFoundException('Chat not found.');
    if (chat.type !== ChatType.GROUP)
      throw new BadRequestException('Only group chats can be updated.');

    // Permission check: Creator or Org Admin
    const isCreator = chat.creatorId === user.id;
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    if (!isCreator && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only the group creator or an org admin can update chat settings.',
      );
    }

    const data: Prisma.ChatUpdateInput = {};
    const systemMessages: string[] = [];
    const userRec = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    const actorName = userRec?.name || 'Admin';

    if (dto.name && dto.name !== chat.name) {
      data.name = dto.name;
      systemMessages.push(
        `${actorName} changed the group name to "${dto.name}"`,
      );
    }
    if (dto.avatarUrl !== undefined && dto.avatarUrl !== chat.avatarUrl && dto.avatarUrl !== '') {
      data.avatarUrl = dto.avatarUrl;
      data.avatarUpdatedAt = new Date();
      systemMessages.push(`${actorName} updated the group picture`);
    }
    if (dto.readOnly !== undefined && dto.readOnly !== chat.readOnly) {
      data.readOnly = dto.readOnly;
      systemMessages.push(
        `${actorName} ${dto.readOnly ? 'enabled' : 'disabled'} read-only mode`,
      );
    }

    if (Object.keys(data).length === 0) return chat;

    const updatedChat = await this.prisma.chat.update({
      where: { id: chatId },
      data,
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    // Log system messages & Emit
    for (const content of systemMessages) {
      const msg = await this.prisma.chatMessage.create({
        data: {
          chatId,
          senderId: user.id,
          organizationId: user.organizationId,
          content,
          type: ChatMessageType.SYSTEM,
        },
        include: { sender: { select: { id: true, name: true } } },
      });

      this.events.emitToRoom(`chat:${chatId}`, 'chat:message', msg);
      const activeParticipants = updatedChat.participants.filter(
        (p) => p.isActive,
      );
      for (const p of activeParticipants) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:message', msg);
      }
    }

    // Emit chat update event
    this.events.emitToRoom(`chat:${chatId}`, 'chat:update', updatedChat);
    const activeParticipants = updatedChat.participants.filter(
      (p) => p.isActive,
    );
    for (const p of activeParticipants) {
      this.events.emitToRoom(`user:${p.userId}`, 'chat:update', updatedChat);
    }

    return updatedChat;
  }

  async deleteMessage(chatId: string, messageId: string, user: CurrentUser) {
    await this.verifyChatAccess(chatId, user.id, true);

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        encryptedContent: {
          include: {
            keyEnvelopes: { select: { recipientUserId: true } },
          },
        },
      },
    });

    if (!message || message.chatId !== chatId)
      throw new NotFoundException('Message not found.');

    // Permission: Org Admin can delete anything, others only own
    const isOrgAdmin = user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN;
    const isOwnMessage = message.senderId === user.id;
    if (!isOrgAdmin && !isOwnMessage) {
      throw new ForbiddenException('You can only delete your own messages.');
    }

    if (message.deletedAt) return message;

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        deletedById: user.id,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
        deletedBy: { select: { id: true, name: true } },
      },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:message:delete', updated);
    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });
    for (const p of participants) {
      this.events.emitToRoom(
        `user:${p.userId}`,
        'chat:message:delete',
        updated,
      );
    }

    return updated;
  }

  async editMessage(
    chatId: string,
    messageId: string,
    dto: EditMessageDto,
    user: CurrentUser,
  ) {
    await this.verifyChatAccess(chatId, user.id, true);

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        encryptedContent: {
          include: {
            keyEnvelopes: { select: { recipientUserId: true } },
          },
        },
      },
    });

    if (!message || message.chatId !== chatId)
      throw new NotFoundException('Message not found.');

    // Only the sender can edit their message
    if (message.senderId !== user.id) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    if (message.deletedAt)
      throw new BadRequestException('Cannot edit a deleted message.');
    if (message.type === ChatMessageType.SYSTEM)
      throw new BadRequestException('Cannot edit system messages.');

    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
      select: { userId: true },
    });
    const originalRecipientIds = Array.from(
      new Set(message.encryptedContent?.keyEnvelopes.map((envelope) => envelope.recipientUserId) || []),
    );

    await this.validateEncryptedChatContent({
      chatId,
      senderId: user.id,
      activeParticipantIds: originalRecipientIds.length
        ? originalRecipientIds
        : participants.map((participant) => participant.userId),
      encryptedContent: dto.encryptedContent,
    });

    const fallbackContent = dto.encryptedContent
      ? ENCRYPTED_CHAT_MESSAGE_PLACEHOLDER
      : dto.content?.trim();

    if (!fallbackContent) {
      throw new BadRequestException('Message content is required.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.encryptedContent) {
        const encryptedContentData = this.buildEncryptedContentCreate(dto.encryptedContent);
        const existingEncryptedContent = await tx.encryptedContent.findUnique({
          where: { chatMessageId: messageId },
          select: { id: true },
        });

        if (existingEncryptedContent) {
          await tx.e2EEKeyEnvelope.deleteMany({
            where: { encryptedContentId: existingEncryptedContent.id },
          });
          await tx.e2EEContentHistoryKeyEnvelope.deleteMany({
            where: { encryptedContentId: existingEncryptedContent.id },
          });
          await tx.encryptedContent.update({
            where: { id: existingEncryptedContent.id },
            data: {
              encryptionVersion: encryptedContentData.encryptionVersion,
              algorithm: encryptedContentData.algorithm,
              ciphertext: encryptedContentData.ciphertext,
              nonce: encryptedContentData.nonce,
              authTag: encryptedContentData.authTag,
              associatedData: encryptedContentData.associatedData,
              contentKeyVersion: encryptedContentData.contentKeyVersion,
              keyEnvelopes: encryptedContentData.keyEnvelopes,
              historyKeyEnvelopes: encryptedContentData.historyKeyEnvelopes,
            },
          });
        } else {
          await tx.encryptedContent.create({
            data: {
              ...encryptedContentData,
              chatMessageId: messageId,
            },
          });
        }
      }

      return tx.chatMessage.update({
        where: { id: messageId },
        data: { content: fallbackContent },
        include: this.getChatMessageInclude(user.id),
      });
    });

    for (const p of participants) {
      if (p.userId === user.id) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:message:edit', updated);
        continue;
      }

      const participantMessage = dto.encryptedContent
        ? await this.prisma.chatMessage.findUnique({
          where: { id: updated.id },
          include: this.getChatMessageInclude(p.userId),
        })
        : updated;

      this.events.emitToRoom(`user:${p.userId}`, 'chat:message:edit', participantMessage || updated);
    }

    return updated;
  }
  async getUserChats(user: CurrentUser) {
    const chats = await this.prisma.chat.findMany({
      where: {
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true } },
            encryptedContent: { select: { id: true, encryptionVersion: true, algorithm: true } },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Filter chats based on hiddenAt and latest message (revival logic)
    const visibleChats = chats.filter((chat) => {
      const myParticipant = chat.participants.find((p) => p.userId === user.id);
      if (!myParticipant?.hiddenAt) return true;

      const latestMsg = chat.messages[0];
      if (!latestMsg) return false;

      // Revive if there's a message newer than hiddenAt
      return latestMsg.createdAt > myParticipant.hiddenAt;
    });

    // Add unread count for each chat based on user's lastReadMessageId
    const chatsWithUnread = await Promise.all(
      visibleChats.map(async (chat) => {
        const myParticipant = chat.participants.find(
          (p) => p.userId === user.id,
        );

        let lastReadAt: Date | undefined;
        if (myParticipant?.lastReadMessageId) {
          const lastMsg = await this.prisma.chatMessage.findUnique({
            where: { id: myParticipant.lastReadMessageId },
            select: { createdAt: true },
          });
          lastReadAt = lastMsg?.createdAt;
        }

        const history = await this.prisma.chatMembershipHistory.findMany({
          where: { chatParticipantId: myParticipant!.id },
        });

        const visibilityOR = history.map((h) => ({
          createdAt: {
            gte: h.activatedAt,
            ...(h.deactivatedAt ? { lte: h.deactivatedAt } : {}),
          },
        }));

        // Get last message visible to this user
        const lastMessage = await this.prisma.chatMessage.findFirst({
          where: {
            chatId: chat.id,
            ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true, email: true } },
            encryptedContent: { select: { id: true, encryptionVersion: true, algorithm: true } },
          },
        });

        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            chatId: chat.id,
            createdAt: lastReadAt
              ? { gt: lastReadAt }
              : myParticipant?.clearedAt
                ? { gt: myParticipant.clearedAt }
                : undefined,
            senderId: { not: user.id },
            deletedAt: null,
            type: { not: ChatMessageType.SYSTEM },
            ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
            ...(myParticipant?.clearedAt
              ? { createdAt: { gt: myParticipant.clearedAt } }
              : {}),
          },
        });
        return {
          ...chat,
          messages: lastMessage ? [lastMessage] : [],
          unreadCount,
        };
      }),
    );

    return this.withDirectMessageBlockStates(chatsWithUnread, user);
  }

  async getChat(chatId: string, user: CurrentUser) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, name: true, email: true } },
            encryptedContent: { select: { id: true, encryptionVersion: true, algorithm: true } },
          },
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');

    const myParticipant = chat.participants.find((p) => p.userId === user.id);
    if (!myParticipant) throw new ForbiddenException('Not a participant');

    const lastReadAt = myParticipant.lastReadMessageId
      ? (
        await this.prisma.chatMessage.findUnique({
          where: { id: myParticipant.lastReadMessageId },
          select: { createdAt: true },
        })
      )?.createdAt
      : null;

    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        chatId: chat.id,
        createdAt: lastReadAt
          ? { gt: lastReadAt }
          : myParticipant?.clearedAt
            ? { gt: myParticipant.clearedAt }
            : undefined,
        senderId: { not: user.id },
        deletedAt: null,
        type: { not: ChatMessageType.SYSTEM },
        ...(myParticipant?.clearedAt
          ? { createdAt: { gt: myParticipant.clearedAt } }
          : {}),
      },
    });

    const [chatWithBlockState] = await this.withDirectMessageBlockStates([{
      ...chat,
      unreadCount,
    }], user);

    return chatWithBlockState;
  }

  async getChatMessages(
    chatId: string,
    user: CurrentUser,
    options: { page?: number; limit?: number; aroundId?: string },
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const aroundId = options.aroundId;

    const participant = await this.verifyChatAccess(chatId, user.id, true);
    const history = await this.prisma.chatMembershipHistory.findMany({
      where: { chatParticipantId: participant.id },
    });

    const visibilityOR = history.map((h) => ({
      createdAt: {
        gte: h.activatedAt,
        ...(h.deactivatedAt ? { lte: h.deactivatedAt } : {}),
      },
    }));

    // Local history clearing logic
    const clearedAtFilter: Prisma.DateTimeFilter<'ChatMessage'> = participant.clearedAt
      ? { gt: participant.clearedAt }
      : {};
    const baseWhere: Prisma.ChatMessageWhereInput = {
      chatId,
      ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
      ...(participant.clearedAt ? { createdAt: clearedAtFilter } : {}),
    };

    const include = this.getChatMessageInclude(user.id);

    type MessageWithRelations = Prisma.ChatMessageGetPayload<{
      include: typeof include;
    }>;
    let messagesList: MessageWithRelations[] = [];
    let hasMoreBefore = false;
    let hasMoreAfter = false;

    if (aroundId) {
      const target = await this.prisma.chatMessage.findUnique({
        where: { id: aroundId },
      });
      if (!target) throw new NotFoundException('Target message not found.');

      const halfLimit = Math.floor(limit / 2);

      // Messages before and including target
      const before = await this.prisma.chatMessage.findMany({
        where: {
          ...baseWhere,
          createdAt: { ...clearedAtFilter, lte: target.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        take: halfLimit + 1,
        include,
      });

      // Messages after target
      const after = await this.prisma.chatMessage.findMany({
        where: {
          ...baseWhere,
          createdAt: { ...clearedAtFilter, gt: target.createdAt },
        },
        orderBy: { createdAt: 'asc' },
        take: halfLimit,
        include,
      });

      messagesList = [...before.reverse(), ...after];

      // Simple flags for context-mode
      hasMoreBefore = before.length > halfLimit;
      hasMoreAfter = after.length >= halfLimit;
    } else {
      const list = await this.prisma.chatMessage.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include,
      });
      messagesList = list.reverse();
      hasMoreBefore =
        page * limit <
        (await this.prisma.chatMessage.count({
          where: {
            chatId,
            ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
          },
        }));
      hasMoreAfter = page > 1;
    }

    const totalCount = await this.prisma.chatMessage.count({
      where: baseWhere,
    });

    // Include read receipts
    const activeParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true, lastReadMessageId: { not: null } },
      select: { userId: true, lastReadMessageId: true },
    });

    const lastReadMsgIds = Array.from(
      new Set(activeParticipants.map((p) => p.lastReadMessageId!)),
    );
    const readMessages = await this.prisma.chatMessage.findMany({
      where: { id: { in: lastReadMsgIds } },
      select: { id: true, createdAt: true },
    });
    const readMap = new Map(
      readMessages.map((m) => [m.id, m.createdAt.getTime()]),
    );

    return {
      data: messagesList.map((m: MessageWithRelations) => ({
        ...m,
        readBy: activeParticipants
          .filter((p) => {
            const readTime = readMap.get(p.lastReadMessageId!);
            // Use getTime() for comparison safety
            return (
              p.userId !== m.senderId &&
              readTime !== undefined &&
              readTime >= new Date(m.createdAt).getTime()
            );
          })
          .map((p) => p.userId),
      })),
      totalRecords: totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      hasMoreBefore,
      hasMoreAfter,
    };
  }

  async sendMessage(chatId: string, dto: SendMessageDto, user: CurrentUser) {
    const participant = await this.verifyChatAccess(chatId, user.id);
    if (!participant.isActive) {
      throw new ForbiddenException(
        'You have been removed from this chat and can no longer send messages.',
      );
    }

    // Check if chat is in readOnly mode (direct chats should never be read-only)
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        readOnly: true,
        type: true,
        name: true,
        participants: {
          where: { isActive: true },
          select: { userId: true },
        },
      },
    });

    if (chat?.type === ChatType.DIRECT) {
      const targetParticipant = chat.participants.find((p) => p.userId !== user.id);
      if (targetParticipant) {
        await this.assertDirectMessagesAvailable(user.id, targetParticipant.userId, chatId);
      }
    }

    if (chat?.type === ChatType.GROUP && chat?.readOnly && participant.role !== ChatParticipantRole.ADMIN && participant.role !== ChatParticipantRole.MOD) {
      throw new ForbiddenException(
        'This chat is in read-only mode. Only admins and moderators can send messages.',
      );
    }

    const activeParticipantIds = chat?.participants.map((p) => p.userId) || [];
    await this.validateEncryptedChatContent({
      chatId,
      chatType: chat?.type,
      senderId: user.id,
      activeParticipantIds,
      encryptedContent: dto.encryptedContent,
    });

    const fallbackContent = dto.encryptedContent
      ? ENCRYPTED_CHAT_MESSAGE_PLACEHOLDER
      : dto.content?.trim();

    if (!fallbackContent) {
      throw new BadRequestException('Message content is required.');
    }

    const newMessage = await this.prisma.chatMessage.create({
      data: {
        chatId,
        senderId: user.id,
        organizationId: user.organizationId,
        content: fallbackContent,
        type: ChatMessageType.TEXT,
        replyToId: dto.replyToId,
        encryptedContent: dto.encryptedContent
          ? { create: this.buildEncryptedContentCreate(dto.encryptedContent) }
          : undefined,
      },
      include: this.getChatMessageInclude(user.id),
    });

    // Update chat's updatedAt field
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    // Broadcast to ACTIVE participants
    const activeParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
    });

    // Mark as read for the sender automatically
    await this.markAsRead(chatId, newMessage.id, user);

    // Notify all participants via WebSocket for real-time UI/badge updates
    for (const p of activeParticipants) {
      if (p.userId === user.id) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:message', newMessage);
        continue;
      }

      const participantMessage = dto.encryptedContent
        ? await this.prisma.chatMessage.findUnique({
          where: { id: newMessage.id },
          include: this.getChatMessageInclude(p.userId),
        })
        : newMessage;

      this.events.emitToRoom(`user:${p.userId}`, 'chat:message', participantMessage || newMessage);
    }

    if (
      newMessage.chat?.type === ChatType.GROUP &&
      ((dto.mentionedUserIds && dto.mentionedUserIds.length > 0) ||
        (dto.mentionTargets && dto.mentionTargets.length > 0))
    ) {
      const senderName = newMessage.sender?.name || 'Someone';
      const chatName = newMessage.chat?.name || 'a group';
      const mentionUsers = await this.getMentionProfileUsers(
        activeParticipants.map((participant) => participant.userId),
      );
      const recipientIds = getMentionRecipientIdsFromTargets({
        targets: dto.mentionTargets,
        legacyUserIds: dto.mentionedUserIds,
        senderId: user.id,
        participants: activeParticipants,
        users: mentionUsers,
      });

      await this.notifyMentionRecipients({
        chatId,
        messageId: newMessage.id,
        senderId: user.id,
        senderName,
        chatName,
        recipientIds,
      });
    }

    this.events.emitToRoom(`chat:${chatId}`, 'chat:typing', {
      chatId,
      userId: user.id,
      name: newMessage.sender?.name || null,
      isTyping: false,
    });

    // Send push-only notifications to offline participants (no DB Notification record).
    // Chat messages are real-time via WebSocket; push is just a fallback for background/offline users.
    const senderName = newMessage.sender?.name || 'Someone';
    const pushTitle = getChatPushTitle({
      senderName,
      chatName: newMessage.chat?.name,
      chatType: newMessage.chat?.type,
    });

    for (const p of activeParticipants) {
      if (p.userId === user.id) continue; // Don't push to sender
      this.notifications.sendPushOnly(p.userId, {
        title: pushTitle,
        body: CHAT_MESSAGE_NOTIFICATION_BODY,
        url: `/chat?id=${chatId}`,
      }).catch(e => console.error('Chat push failed:', e));
    }

    return newMessage;
  }

  async markAsRead(
    chatId: string,
    messageId: string | undefined,
    user: CurrentUser,
  ) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId: user.id } },
    });

    // Suppress "Not an active participant" error by returning early
    if (!participant || !participant.isActive)
      return { message: 'Ignored for inactive participant' };

    let finalReadMessageId = messageId;

    if (!finalReadMessageId) {
      const lastMsg = await this.prisma.chatMessage.findFirst({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (lastMsg) {
        finalReadMessageId = lastMsg.id;
      }
    }

    if (!finalReadMessageId) {
      return participant;
    }

    const updatedParticipant = await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { lastReadMessageId: finalReadMessageId },
    });

    this.events.emitToRoom(`chat:${chatId}`, 'chat:read', {
      chatId,
      userId: user.id,
      messageId: finalReadMessageId,
    });
    this.events.emitToRoom(`user:${user.id}`, 'chat:read', {
      chatId,
      userId: user.id,
      messageId: finalReadMessageId,
    });

    // Also emit to all other participants in the chat so senders can see read receipts
    const allParticipants = await this.prisma.chatParticipant.findMany({
      where: { chatId, isActive: true },
      select: { userId: true },
    });
    for (const p of allParticipants) {
      if (p.userId !== user.id) {
        this.events.emitToRoom(`user:${p.userId}`, 'chat:read', {
          chatId,
          userId: user.id,
          messageId: finalReadMessageId,
        });
      }
    }

    return updatedParticipant;
  }

  async getUnreadCount(user: CurrentUser) {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Filter to only count unread from visible chats (not hidden OR revived)
    const visibleParticipants = participants.filter((p) => {
      if (!p.hiddenAt) return true;
      const latestMsg = p.chat.messages[0];
      if (!latestMsg) return false;
      return latestMsg.createdAt > p.hiddenAt;
    });

    let totalUnread = 0;
    for (const p of visibleParticipants) {
      let lastReadAt: Date | undefined;
      if (p.lastReadMessageId) {
        const lastMsg = await this.prisma.chatMessage.findUnique({
          where: { id: p.lastReadMessageId },
          select: { createdAt: true },
        });
        lastReadAt = lastMsg?.createdAt;
      }

      const history = await this.prisma.chatMembershipHistory.findMany({
        where: { chatParticipantId: p.id },
      });

      const visibilityOR = history.map((h) => ({
        createdAt: {
          gte: h.activatedAt,
          ...(h.deactivatedAt ? { lte: h.deactivatedAt } : {}),
        },
      }));

      const count = await this.prisma.chatMessage.count({
        where: {
          chatId: p.chatId,
          createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
          senderId: { not: user.id },
          deletedAt: null,
          type: { not: ChatMessageType.SYSTEM },
          ...(visibilityOR.length > 0 ? { OR: visibilityOR } : {}),
        },
      });
      totalUnread += count;
    }

    return { unread: totalUnread };
  }

  private async verifyChatAccess(
    chatId: string,
    userId: string,
    allowInactive = false,
  ) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant)
      throw new ForbiddenException('You do not have access to this chat.');
    if (!participant.isActive && !allowInactive) {
      throw new ForbiddenException(
        'You are no longer an active participant of this chat.',
      );
    }
    return participant;
  }
}
