import { Chat, ChatMentionTarget, ChatMessage, ChatType, User } from '@/types';
import { RefObject } from 'react';
import { isToday, isYesterday, format } from 'date-fns';
import { registerOptimisticImageFallbacks } from '@/lib/optimisticMedia';
import {
    ALLOWED_UPLOAD_TYPES,
    ARCHIVE_FILE_TYPES,
    getFileTypeInfo as getSharedFileTypeInfo,
    OFFICE_FILE_TYPES,
    PRESENTATION_FILE_TYPES,
    SPREADSHEET_FILE_TYPES,
    WORD_FILE_TYPES
} from '@/lib/attachmentUtils';
import { isGenericUploadAllowed } from '@/lib/uploadPolicy';

export type ChatMessageWithMeta = ChatMessage & {
    readBy?: string[];
    clientStatus?: 'sending' | 'failed' | 'sent';
    decryptedContent?: string;
    retryPayload?: {
        draftText: string;
        stagedFiles: File[];
        replyToMessage: ChatMessage | null;
        mentionTargets: ChatMentionTarget[];
    };
};

export type ChatComposerState = {
    messageDraft: string;
    stagedFiles: File[];
    replyToMessage: ChatMessage | null;
    editingMessage: ChatMessage | null;
    mentionTargets: ChatMentionTarget[];
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
    participantUserIds?: string[];
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
        mentionTargets: [],
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
    incoming: ChatMessage | ChatMessageWithMeta,
    currentUserId?: string,
    pendingId: string | null = null
): ChatMessageWithMeta[] {
    const normalizedIncoming: ChatMessageWithMeta =
        incoming.senderId === currentUserId ? { ...incoming, clientStatus: 'sent' } : incoming;
    let next = prev;

    if (pendingId) {
        const pendingIndex = next.findIndex(message => message.id === pendingId);
        if (pendingIndex > -1) {
            registerOptimisticImageFallbacks(next[pendingIndex].content, incoming.content);
            const existingDecryptedContent = next[pendingIndex].decryptedContent;
            next = [...next];
            next[pendingIndex] = existingDecryptedContent && !normalizedIncoming.decryptedContent
                ? { ...normalizedIncoming, decryptedContent: existingDecryptedContent }
                : normalizedIncoming;
        }
    }

    const existingIndex = next.findIndex(message => message.id === incoming.id);
    if (existingIndex > -1) {
        const existing = next[existingIndex];
        const merged = existing.decryptedContent && !normalizedIncoming.decryptedContent
            ? { ...normalizedIncoming, decryptedContent: existing.decryptedContent }
            : { ...existing, ...normalizedIncoming };
        next = [...next];
        next[existingIndex] = merged;
    } else {
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

    // Extract all attachment links so they don't get truncated and broken in half
    const markdownLinkRegex = /\[(?:📄|📝|📊|📽️|📦|📎)?\s*(?:PDF:|DOC:|Doc:|XLS:|PPT:|ARCHIVE:|ZIP:|Attachment:)\s*[^\]]+\]\([^)]+\)/gi;
    const attachmentLinks: string[] = [];
    
    // Replace all document attachments with empty space in the text portion, but keep links intact
    const textWithoutAttachments = content.replace(markdownLinkRegex, (match) => {
        attachmentLinks.push(match);
        return '';
    });

    // Clean inline images and standard formatting
    const cleanedText = textWithoutAttachments.replace(/!\[.*?\]\(.*?\)/g, '[Image]').trim();
    
    // Truncate only the text portion
    const truncatedText = cleanedText.length > max ? `${cleanedText.slice(0, max)}...` : cleanedText;

    // Return the truncated text followed by the intact attachment links.
    return [truncatedText, ...attachmentLinks].filter(Boolean).join(' ');
}

type FileUploadResult = {
    url?: string;
    path?: string;
};

/**
 * Filter an array of Files to only those matching allowed chat upload types.
 * Uses MIME type first, then falls back to extension if MIME is missing.
 */
export function filterValidFiles(files: File[]): File[] {
    return files.filter(file => {
        if (ALLOWED_UPLOAD_TYPES.has(file.type)) return true;
        return isGenericUploadAllowed(file);
    });
}

/** Escape special markdown characters in a filename */
export function escapeFileName(name: string): string {
    return (name || '').replace(/[\\`()\[\]{}]/g, '\\$&');
}

/**
 * Get display info for a file (icon color, background, and type label)
 */
export function getFileTypeInfo(fileType: string) {
    const isPdf = fileType === 'application/pdf';
    const isWord = WORD_FILE_TYPES.has(fileType);
    const isSpreadsheet = SPREADSHEET_FILE_TYPES.has(fileType);
    const isPresentation = PRESENTATION_FILE_TYPES.has(fileType);
    const isArchive = ARCHIVE_FILE_TYPES.has(fileType);

    if (isPdf) return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        label: 'PDF',
        tag: '📄 PDF:'
    };
    if (isWord) return {
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        label: 'DOC',
        tag: '📝 DOC:'
    };
    if (isSpreadsheet) return {
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.1)',
        label: 'XLS',
        tag: '📊 XLS:'
    };
    if (isPresentation) return {
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.1)',
        label: 'PPT',
        tag: '📽️ PPT:'
    };
    if (isArchive) return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        label: 'ARCHIVE',
        tag: '📦 ARCHIVE:'
    };
    return {
        color: '#64748b',
        bg: 'rgba(100, 116, 139, 0.1)',
        label: 'FILE',
        tag: '📎 Attachment:'
    };
}

export function buildAttachmentMarkdown(files: File[], uploadResults: FileUploadResult[]): string {
    return uploadResults.map((result, index) => {
        const file = files[index];
        const url = result.url || result.path || '';
        const safeName = escapeFileName(file.name);
        const isImage = file.type.startsWith('image/') && file.type !== 'image/svg+xml';
        const isPdf = file.type === 'application/pdf';
        const isArchive = ARCHIVE_FILE_TYPES.has(file.type);
        const fileInfo = getSharedFileTypeInfo(file.type);

        if (isImage) return `\n![${safeName}](${url})`;
        if (isPdf) return `\n[📄 PDF: ${safeName}](${url})`;
        if (OFFICE_FILE_TYPES.has(file.type)) return `\n[${fileInfo.tag} ${safeName}](${url})`;
        if (isArchive) return `\n[📦 ARCHIVE: ${safeName}](${url})`;
        return `\n[📎 Attachment: ${safeName}](${url})`;
    }).join('');
}

export function updateOnlineUsersFromPresenceState(
    onlineUsers: OnlineUserState,
    event: PresenceStateEvent
): OnlineUserState {
    const next = { ...onlineUsers };

    for (const userId of event.participantUserIds || []) {
        next[userId] = false;
    }

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
    shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
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
    const { isDesktop, itemId, onLongPress, delay = 500, movementThreshold = 10, shouldIgnoreTarget } = options;

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const onTouchStart = (e: React.TouchEvent) => {
        if (isDesktop) return;
        if (shouldIgnoreTarget?.(e.target)) return;

        // Reset state
        clearTimer();
        hasTriggeredRef.current = false;
        const touch = e.touches[0];
        startPosRef.current = { x: touch.clientX, y: touch.clientY };

        timerRef.current = setTimeout(() => {
            // Success! We reached the long press threshold
            hasTriggeredRef.current = true;
            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                try { window.navigator.vibrate(40); } catch { /* ignore */ }
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

// ── Clipboard paste support ──────────────────────────────────────────────

/** MIME types allowed for clipboard paste in chat */
const PASTEABLE_MIME_TYPES = new Set([
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg',
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'application/zip', 'application/x-zip-compressed',
]);

/**
 * Extract supported files from a ClipboardEvent.
 * Returns an array of File objects that match PASTEABLE_MIME_TYPES.
 * If nothing matches (e.g. plain text paste), returns empty array.
 */
export function extractFilesFromClipboard(event: ClipboardEvent): File[] {
    const items = event.clipboardData?.items;
    if (!items) return [];

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file && PASTEABLE_MIME_TYPES.has(file.type)) {
                files.push(file);
            }
        }
    }
    return files;
}

/**
 * Build optimistic attachment markdown using local blob URLs.
 * Tags match the server-side tags so the transition is seamless.
 */
export function buildOptimisticAttachmentMarkdown(files: File[]): string {
    return files.map(file => {
        const localUrl = URL.createObjectURL(file);
        const safeName = escapeFileName(file.name);
        const fileInfo = getSharedFileTypeInfo(file.type);
        if (file.type.startsWith('image/')) return `\n![${safeName}](${localUrl})`;
        if (file.type === 'application/pdf') return `\n[📄 PDF: ${safeName}](${localUrl})`;
        if (OFFICE_FILE_TYPES.has(file.type)) return `\n[${fileInfo.tag} ${safeName}](${localUrl})`;
        if (ARCHIVE_FILE_TYPES.has(file.type)) return `\n[📦 ARCHIVE: ${safeName}](${localUrl})`;
        return `\n[📎 Attachment: ${safeName}](${localUrl})`;
    }).join('');
}
