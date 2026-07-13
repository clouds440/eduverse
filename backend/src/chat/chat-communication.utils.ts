import { ChatType, CommunicationChannel, Role } from '@/prisma/prisma-client';

export const DIRECT_MESSAGE_BLOCK_CHANNEL = CommunicationChannel.DIRECT_MESSAGE;

type ParticipantWithUser = {
  userId: string;
  user?: {
    id: string;
    role: Role;
  } | null;
};

type DirectMessageBlockRecord = {
  id: string;
  userId: string;
  targetUserId: string;
  channel: CommunicationChannel;
};

export function isDirectMessageBlockExemptRole(role: Role) {
  return role === Role.ORG_ADMIN;
}

export function canUseDirectMessageBlock(
  blockerRole: Role,
  targetRole: Role,
) {
  return (
    !isDirectMessageBlockExemptRole(blockerRole) &&
    !isDirectMessageBlockExemptRole(targetRole)
  );
}

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
) {
  const blockedByMe = blocks.find(
    (block) =>
      block.channel === DIRECT_MESSAGE_BLOCK_CHANNEL &&
      block.userId === currentUserId &&
      block.targetUserId === targetUserId,
  );
  const blockedByOther = blocks.find(
    (block) =>
      block.channel === DIRECT_MESSAGE_BLOCK_CHANNEL &&
      block.userId === targetUserId &&
      block.targetUserId === currentUserId,
  );

  return {
    isBlocked: Boolean(blockedByMe || blockedByOther),
    blockedByMe: Boolean(blockedByMe),
    blockedByOther: Boolean(blockedByOther),
    blockId: blockedByMe?.id ?? null,
  };
}
