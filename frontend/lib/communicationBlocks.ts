import { api } from "@/lib/api";
import { Chat, ChatType, User } from "@/types";
import {
  canUseDirectMessageBlock,
  getDirectChatTarget,
} from "@/lib/communicationOptions";
import { invalidateChats } from "@/lib/chatStore";

export const DM_BLOCK_CONFIRMATION_TEXT =
  "Blocking only stops one-on-one direct messages. This is not a user block, and group chats will continue to work normally.";

export type DmBlockAction = {
  targetUser: User;
  isBlockedByMe: boolean;
  canBlock: boolean;
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmText: string;
};

export function getDmBlockAction(
  chat: Chat,
  currentUser: User,
): DmBlockAction | null {
  if (chat.type !== ChatType.DIRECT) return null;

  const targetUser = getDirectChatTarget(chat, currentUser.id);
  if (!targetUser) return null;

  const isBlockedByMe = Boolean(chat.directMessageBlock?.blockedByMe);
  const canBlock = canUseDirectMessageBlock(currentUser, targetUser);
  if (!canBlock && !isBlockedByMe) return null;

  const targetName = targetUser.name || targetUser.email || "this person";

  return {
    targetUser,
    isBlockedByMe,
    canBlock,
    label: isBlockedByMe ? "Unblock DMs" : "Block DMs",
    confirmTitle: isBlockedByMe
      ? `Unblock DMs from ${targetName}?`
      : `Block DMs from ${targetName}?`,
    confirmDescription: isBlockedByMe
      ? `You will be able to exchange direct messages with ${targetName} again.`
      : `${DM_BLOCK_CONFIRMATION_TEXT} ${targetName} will not be able to DM you while blocked.`,
    confirmText: isBlockedByMe ? "Unblock" : "Block DMs",
  };
}

export async function blockDirectMessages(targetUserId: string, token: string) {
  const result = await api.chat.blockCommunicationTarget(targetUserId, token);
  invalidateChats();
  return result;
}

export async function unblockDirectMessages(
  targetUserId: string,
  token: string,
) {
  const result = await api.chat.unblockCommunicationTarget(targetUserId, token);
  invalidateChats();
  return result;
}
