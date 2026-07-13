import { Chat, ChatType, User } from '@/types';

export function canUseDirectMessageBlock(currentUser?: User | null, targetUser?: User | null) {
    return Boolean(currentUser?.id && targetUser?.id);
}

export function getDirectChatTarget(chat?: Chat | null, currentUserId?: string | null) {
    if (!chat || chat.type !== ChatType.DIRECT || !currentUserId) return null;
    return chat.participants?.find(participant => participant.userId !== currentUserId)?.user || null;
}

export function getDirectMessageBlockLabel(chat?: Chat | null) {
    const block = chat?.directMessageBlock;
    if (!block?.isBlocked) return null;
    if (block.blockedByMe) return 'You blocked DMs from this person.';
    return 'This person has blocked DMs from you.';
}
