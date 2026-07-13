import { ChatType, CommunicationChannel } from '@/prisma/prisma-client';

export const DIRECT_MESSAGE_BLOCK_CHANNEL = CommunicationChannel.DIRECT_MESSAGE;

type ParticipantWithUser = {
  userId: string;
  user?: {
    id: string;
    role?: unknown;
  } | null;
};

type DirectMessageBlockRecord = {
  id: string;
  userId: string;
  targetUserId: string;
  chatId?: string | null;
  channel: CommunicationChannel;
};

export function getDirectChatOtherParticipant<T extends ParticipantWithUser>(
  chat: { type: ChatType; participants?: T[] | null },
  currentUserId: string,
) {
  if (chat.type !== ChatType.DIRECT) return null;
  return chat.participants?.find((participant) => participant.userId !== currentUserId) || null;
}

export function getDirectMessageBlockState(
  blocks: DirectMessageBlockRecord[],
  currentUserId: string,
  targetUserId: string,
  chatId?: string | null,
) {
  const chatBlocks = chatId
    ? blocks.filter(
      (block) =>
        block.channel === DIRECT_MESSAGE_BLOCK_CHANNEL &&
        block.chatId === chatId,
    )
    : [];

  const findBlock = (
    candidates: DirectMessageBlockRecord[],
    userId: string,
    blockedUserId: string,
  ) => candidates.find(
    (block) =>
      block.channel === DIRECT_MESSAGE_BLOCK_CHANNEL &&
      block.userId === userId &&
      block.targetUserId === blockedUserId,
  );

  const blockedByMe = findBlock(chatBlocks, currentUserId, targetUserId) ?? findBlock(
    blocks,
    currentUserId,
    targetUserId,
  );
  const blockedByOther = findBlock(chatBlocks, targetUserId, currentUserId) ?? findBlock(
    blocks,
    targetUserId,
    currentUserId,
  );

  return {
    isBlocked: Boolean(blockedByMe || blockedByOther),
    blockedByMe: Boolean(blockedByMe),
    blockedByOther: Boolean(blockedByOther),
    blockId: blockedByMe?.id ?? null,
  };
}
