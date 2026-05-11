import { api } from './api';
import { Chat, ChatMessage } from '@/types';
import { ChatComposerStateMap, ChatMessageWithMeta } from '@/components/chat/chatLayoutHelpers';

type ChatCache = {
    data: Chat[] | null;
    promise: Promise<Chat[]> | null;
    lastFetched: number | null;
    isFetching: boolean;
};

const CHAT_CACHE_TTL_MS = 3 * 1000; // 3 seconds - keep UI responsive to new messages

const STORAGE_KEY = 'chat_session_store';

type ChatSessionStore = {
    messagesByChat: Record<string, ChatMessageWithMeta[]>;
    composerStates: ChatComposerStateMap;
    lastReadByChat: Record<string, string | number>;
};

const cache: { chats: ChatCache; session: ChatSessionStore } = {
    chats: { data: null, promise: null, lastFetched: null, isFetching: false },
    session: {
        messagesByChat: {},
        composerStates: {},
        lastReadByChat: {}
    }
};

// Load from localStorage on module init
function loadFromStorage(): ChatSessionStore {
    if (typeof window === 'undefined') {
        return { messagesByChat: {}, composerStates: {}, lastReadByChat: {} };
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                messagesByChat: parsed.messagesByChat || {},
                composerStates: parsed.composerStates || {},
                lastReadByChat: parsed.lastReadByChat || {}
            };
        }
    } catch (err) {
        console.warn('Failed to load chat session from storage', err);
    }
    return { messagesByChat: {}, composerStates: {}, lastReadByChat: {} };
}

// Save to localStorage
function saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache.session));
    } catch (err) {
        console.warn('Failed to save chat session to storage', err);
    }
}

// Initialize session from storage
cache.session = loadFromStorage();

export async function getUserChatsCached(token: string): Promise<Chat[]> {
    if (!token) return [];
    // Return cached if available and fresh
    if (cache.chats.data && cache.chats.lastFetched) {
        const age = Date.now() - cache.chats.lastFetched;
        if (age < CHAT_CACHE_TTL_MS) return cache.chats.data;
    }

    // If a fetch is already in-flight, return its promise
    if (cache.chats.promise) return cache.chats.promise;

    cache.chats.isFetching = true;
    const p = (async () => {
        try {
            const res = await api.chat.getUserChats(token);
            cache.chats.data = res;
            cache.chats.lastFetched = Date.now();
            return res;
        } finally {
            cache.chats.isFetching = false;
            cache.chats.promise = null;
        }
    })();

    cache.chats.promise = p;
    return p;
}

export function invalidateChats() {
    cache.chats.data = null;
    cache.chats.lastFetched = null;
}

export function insertOrUpdateChatFromMessage(message: ChatMessage) {
    if (!cache.chats.data) {
        // create a minimal placeholder list
        const placeholder: Chat = {
            id: message.chatId,
            messages: [message],
            unreadCount: 1,
            updatedAt: message.createdAt,
            ...(message.chat || {})
        } as Chat;
        cache.chats.data = [placeholder];
        return cache.chats.data;
    }

    const idx = cache.chats.data.findIndex((c: Chat) => c.id === message.chatId);
    if (idx > -1) {
        const updated: Chat = { ...cache.chats.data[idx] } as Chat;
        updated.messages = [message];
        updated.updatedAt = message.createdAt;
        updated.unreadCount = (updated.unreadCount || 0) + 1;
        // Merge chat info if available
        if (message.chat) {
            Object.assign(updated, message.chat);
        }
        const arr = [...cache.chats.data];
        arr.splice(idx, 1);
        arr.unshift(updated);
        cache.chats.data = arr;
        return arr;
    }

    const newChat: Chat = {
        id: message.chatId,
        messages: [message],
        unreadCount: 1,
        updatedAt: message.createdAt,
        ...(message.chat || {})
    } as Chat;
    cache.chats.data = [newChat, ...cache.chats.data];
    return cache.chats.data;
}

export function getCachedChats() {
    return cache.chats.data;
}

export function getLastReadMessageId(chatId: string) {
    return cache.session.lastReadByChat[chatId];
}

export function setLastReadMessageId(chatId: string, messageId: string | number) {
    cache.session.lastReadByChat[chatId] = messageId;
    saveToStorage();
}

export async function markAsReadGuard(chatId: string, messageId: string | number | '', token: string) {
    if (!token) return;
    // If messageId is empty, we treat it as "mark latest"; skip if we already recorded the latest
    const last = cache.session.lastReadByChat[chatId];
    if (messageId && last !== undefined) {
        try {
            const numLast = typeof last === 'number' ? last : Number(last);
            const numMsg = typeof messageId === 'number' ? messageId : Number(messageId);
            if (!Number.isNaN(numLast) && !Number.isNaN(numMsg) && numMsg <= numLast) return;
        } catch { }
        if (String(last) === String(messageId)) return;
    }

    try {
        await api.chat.markAsRead(chatId, messageId === '' ? '' : String(messageId), token);
        cache.session.lastReadByChat[chatId] = messageId || '';
        saveToStorage();
    } catch (err) {
        // don't throw — just log; callers already handle UI
        console.error('markAsReadGuard failed', err);
    }
}

// Chat message management
export function getCachedMessages(chatId: string): ChatMessageWithMeta[] {
    return cache.session.messagesByChat[chatId] || [];
}

export function setCachedMessages(chatId: string, messages: ChatMessageWithMeta[]) {
    cache.session.messagesByChat[chatId] = messages;
    saveToStorage();
}

export function updateCachedMessages(chatId: string, messages: ChatMessageWithMeta[]) {
    cache.session.messagesByChat[chatId] = messages;
    saveToStorage();
}

// Composer state management
export function getCachedComposerState(chatId: string) {
    return cache.session.composerStates[chatId];
}

export function setCachedComposerState(chatId: string, state: ChatComposerStateMap[string]) {
    cache.session.composerStates[chatId] = state;
    saveToStorage();
}

export function getCachedComposerStates(): ChatComposerStateMap {
    return cache.session.composerStates;
}

export function setCachedComposerStates(states: ChatComposerStateMap) {
    cache.session.composerStates = states;
    saveToStorage();
}

// Clear all session data (for logout)
export function clearChatSession() {
    cache.session = {
        messagesByChat: {},
        composerStates: {},
        lastReadByChat: {}
    };
    saveToStorage();
}
