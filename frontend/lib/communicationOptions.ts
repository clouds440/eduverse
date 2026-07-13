import { Chat, ChatType, Role, User } from '@/types';

export function isDirectMessageBlockExemptRole(role?: Role | null) {
    return role === Role.ORG_ADMIN;
}

export function canUseDirectMessageBlock(currentUser?: User | null, targetUser?: User | null) {
    if (!currentUser?.role || !targetUser?.role) return false;
    return !isDirectMessageBlockExemptRole(currentUser.role) && !isDirectMessageBlockExemptRole(targetUser.role);
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
