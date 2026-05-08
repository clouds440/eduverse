import { Chat, ChatMessage, ChatType, User } from '@/types';
import { RefObject } from 'react';
import { isToday, isYesterday, format } from 'date-fns';

export type ChatMessageWithMeta = ChatMessage & {
    readBy?: string[];
    clientStatus?: 'sending' | 'failed' | 'sent';
    retryPayload?: {
        draftText: string;
        stagedFiles: File[];
        replyToMessage: ChatMessage | null;
        mentionedUsers: User[];
    };
};

export type ChatComposerState = {
    messageDraft: string;
    stagedFiles: File[];
    replyToMessage: ChatMessage | null;
    editingMessage: ChatMessage | null;
    mentionedUsers: User[];
};

export type ChatComposerStateMap = Record<string, ChatComposerState>;
export type OnlineUserState = Record<string, boolean>;
export type TypingUser = {
    userId: string;
    name: string | null;
};
export type ChatTypingStateMap = Record<string, TypingUser[]>;
export type PresenceStateEvent = {
    chatId: string;
    userIds: string[];
};
export type PresenceUpdateEvent = {
    userId: string;
    isOnline: boolean;
    lastSeenAt: string | null;
};
export type ChatTypingEvent = {
    chatId: string;
    userId: string;
    name: string | null;
    isTyping: boolean;
};

export function createEmptyChatComposerState(): ChatComposerState {
    return {
        messageDraft: '',
        stagedFiles: [],
        replyToMessage: null,
        editingMessage: null,
        mentionedUsers: [],
    };
}

export function getChatComposerState(
    composerStates: ChatComposerStateMap,
    chatId: string | null | undefined
): ChatComposerState {
    if (!chatId) return createEmptyChatComposerState();
    return composerStates[chatId] ?? createEmptyChatComposerState();
}

export function updateChatComposerState(
    composerStates: ChatComposerStateMap,
    chatId: string | null | undefined,
    patch: Partial<ChatComposerState>
): ChatComposerStateMap {
    if (!chatId) return composerStates;

    return {
        ...composerStates,
        [chatId]: {
            ...getChatComposerState(composerStates, chatId),
            ...patch,
        },
    };
}

export function mergeUniqueMessages<T extends { id: string }>(
    current: T[],
    incoming: T[],
    position: 'prepend' | 'append'
): T[] {
    const existingIds = new Set(current.map(message => message.id));
    const uniqueIncoming = incoming.filter(message => !existingIds.has(message.id));

    return position === 'prepend'
        ? [...uniqueIncoming, ...current]
        : [...current, ...uniqueIncoming];
}

export function reconcileIncomingMessage(
    prev: ChatMessageWithMeta[],
    incoming: ChatMessage,
    currentUserId?: string,
    pendingId: string | null = null
): ChatMessageWithMeta[] {
    const normalizedIncoming: ChatMessageWithMeta =
        incoming.senderId === currentUserId ? { ...incoming, clientStatus: 'sent' } : incoming;
    let next = prev;

    if (pendingId) {
        const pendingIndex = next.findIndex(message => message.id === pendingId);
        if (pendingIndex > -1) {
            next = [...next];
            next[pendingIndex] = normalizedIncoming;
        }
    }

    if (!next.some(message => message.id === incoming.id)) {
        next = [...next, normalizedIncoming];
    }

    const seen = new Set<string>();
    return next.filter(message => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
    });
}

export function formatChatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatChatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';

    return format(date, 'EEE, MMM d');
}

export function getTruncatedMessagePreview(content: string | undefined, max: number): string {
    if (!content) return '';

    const cleaned = content.replace(/!\[.*?\]\(.*?\)/g, '[Image]').trim();
    return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}

type FileUploadResult = {
    url?: string;
    path?: string;
};

const OFFICE_FILE_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

export function buildAttachmentMarkdown(files: File[], uploadResults: FileUploadResult[]): string {
    return uploadResults.map((result, index) => {
        const file = files[index];
        const url = result.url || result.path || '';
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        const isOffice = OFFICE_FILE_TYPES.has(file.type);

        if (isImage) return `\n![${(file.name || '').replace(/[\\`()\[\]{}]/g, '\\$&')}](${url})`;
        if (isPdf) return `\n[PDF: ${(file.name || '').replace(/[\\`()\[\]{}]/g, '\\$&')}](${url})`;
        if (isOffice) return `\n[Doc: ${(file.name || '').replace(/[\\`()\[\]{}]/g, '\\$&')}](${url})`;
        return `\n[Attachment: ${(file.name || '').replace(/[\\`()\[\]{}]/g, '\\$&')}](${url})`;
    }).join('');
}

export function updateOnlineUsersFromPresenceState(
    onlineUsers: OnlineUserState,
    event: PresenceStateEvent
): OnlineUserState {
    const next = { ...onlineUsers };

    for (const userId of event.userIds) {
        next[userId] = true;
    }

    return next;
}

export function updateOnlineUsersFromPresenceEvent(
    onlineUsers: OnlineUserState,
    event: PresenceUpdateEvent
): OnlineUserState {
    return {
        ...onlineUsers,
        [event.userId]: event.isOnline,
    };
}

export function updateChatTypingState(
    typingState: ChatTypingStateMap,
    event: ChatTypingEvent
): ChatTypingStateMap {
    const currentUsers = typingState[event.chatId] || [];
    const nextUsers = event.isTyping
        ? currentUsers.some(user => user.userId === event.userId)
            ? currentUsers
            : [...currentUsers, { userId: event.userId, name: event.name }]
        : currentUsers.filter(user => user.userId !== event.userId);

    return {
        ...typingState,
        [event.chatId]: nextUsers,
    };
}

export function removeTypingUserFromAllChats(
    typingState: ChatTypingStateMap,
    userId: string
): ChatTypingStateMap {
    const next: ChatTypingStateMap = {};

    for (const [chatId, users] of Object.entries(typingState)) {
        next[chatId] = users.filter(user => user.userId !== userId);
    }

    return next;
}

export function getTypingUsersForChat(
    typingState: ChatTypingStateMap,
    chatId: string | null | undefined,
    currentUserId: string | undefined
): TypingUser[] {
    if (!chatId) return [];

    return (typingState[chatId] || []).filter(user => user.userId !== currentUserId);
}

export function getDirectChatTarget(chat: Chat | undefined, currentUserId: string | undefined) {
    if (!chat || chat.type !== ChatType.DIRECT) return null;

    return chat.participants?.find(participant => participant.userId !== currentUserId)?.user || null;
}

export function getTypingIndicatorLabel(chat: Chat | undefined, typingUsers: TypingUser[]): string | null {
    if (!chat || typingUsers.length === 0) return null;

    if (chat.type === ChatType.DIRECT) {
        return 'typing';
    }

    if (typingUsers.length === 1) {
        return `${(typingUsers[0].name || 'Someone').replace(/[()`]/g, '\\$&')} is typing`;
    }

    if (typingUsers.length === 2) {
        return `${(typingUsers[0].name || 'Someone').replace(/[()`]/g, '\\$&')} and ${(typingUsers[1].name || 'someone').replace(/[()`]/g, '\\$&')} are typing`;
    }

    return 'Several people are typing';
}

export interface LongPressHandlersResult {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
}

export interface LongPressHandlersOptions {
    isDesktop: boolean;
    itemId: string;
    onLongPress: (itemId: string) => void;
    delay?: number;
    movementThreshold?: number;
}

/**
 * Modernized Long Press Handler
 * Triggers DURING the hold (after delay), which is the standard mobile expectation.
 * Automatically cancels if movement exceeds threshold (scrolling).
 */
export function getLongPressHandlers(
    options: LongPressHandlersOptions,
    timerRef: RefObject<ReturnType<typeof setTimeout> | null>,
    startPosRef: RefObject<{ x: number; y: number } | null>,
    hasTriggeredRef: RefObject<boolean>
): LongPressHandlersResult {
    const { isDesktop, itemId, onLongPress, delay = 500, movementThreshold = 10 } = options;

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const onTouchStart = (e: React.TouchEvent) => {
        if (isDesktop) return;

        // Reset state
        clearTimer();
        hasTriggeredRef.current = false;
        const touch = e.touches[0];
        startPosRef.current = { x: touch.clientX, y: touch.clientY };

        timerRef.current = setTimeout(() => {
            // Success! We reached the long press threshold
            hasTriggeredRef.current = true;
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                try { window.navigator.vibrate(40); } catch (e) { /* ignore */ }
            }
            onLongPress(itemId);
            timerRef.current = null;
        }, delay);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!timerRef.current || !startPosRef.current) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startPosRef.current.x;
        const dy = touch.clientY - startPosRef.current.y;
        
        // Use Manhattan distance for cheaper cancellation check on move
        if (Math.abs(dx) > movementThreshold || Math.abs(dy) > movementThreshold) {
            clearTimer();
        }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (hasTriggeredRef.current) {
            // Prevent the subsequent click event from firing if we already handled the long press
            e.preventDefault();
            e.stopPropagation();
        }
        clearTimer();
        startPosRef.current = null;
    };

    const onTouchCancel = () => {
        clearTimer();
        startPosRef.current = null;
        hasTriggeredRef.current = false;
    };

    return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
