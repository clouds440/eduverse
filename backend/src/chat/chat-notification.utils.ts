import { ChatType } from '@/prisma/prisma-client';

export const CHAT_MESSAGE_NOTIFICATION_BODY = 'Open chat to view the message.';
export const CHAT_MENTION_NOTIFICATION_BODY = 'Open chat to view the mention.';

export function getChatPushTitle(options: {
  senderName: string;
  chatName?: string | null;
  chatType?: ChatType | string | null;
}) {
  if (options.chatType === ChatType.GROUP || options.chatType === 'GROUP') {
    return `${options.senderName} in ${options.chatName || 'a group'}`;
  }

  return options.senderName;
}
