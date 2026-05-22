import { api } from './api';
import { Chat, ChatMessage } from '@/types';
import { ChatComposerState, ChatComposerStateMap, ChatMessageWithMeta } from '@/components/chat/chatLayoutHelpers';

type ChatCache = {
    data: Chat[] | null;
    promise: Promise<Chat[]> | null;
    lastFetched: number | null;
    isFetching: boolean;
};

const CHAT_CACHE_TTL_MS = 3 * 1000; // 3 seconds - keep UI responsive to new messages
const COMPOSER_STORAGE_KEY = 'eduverse-chat-composer-v1';
const COMPOSER_DB_NAME = 'eduverse-chat-composer';
const COMPOSER_DB_VERSION = 1;
const COMPOSER_FILE_STORE = 'stagedFiles';
let lastComposerFileSignature = '';

type SerializedComposerState = Omit<ChatComposerState, 'stagedFiles'> & {
    stagedFileIds: string[];
};

type SerializedComposerStateMap = Record<string, SerializedComposerState>;

type StoredComposerFile = {
    id: string;
    chatId: string;
    name: string;
    type: string;
    size: number;
    lastModified: number;
    file: File;
};

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

function canUseBrowserStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getComposerFileId(chatId: string, file: File, index: number) {
    return [
        chatId,
        index,
        file.name,
        file.size,
        file.lastModified,
        file.type || 'application/octet-stream',
    ].join('::');
}

function openComposerDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);

    return new Promise((resolve) => {
        const request = window.indexedDB.open(COMPOSER_DB_NAME, COMPOSER_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(COMPOSER_FILE_STORE)) {
                const store = db.createObjectStore(COMPOSER_FILE_STORE, { keyPath: 'id' });
                store.createIndex('chatId', 'chatId', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.error('Failed to open chat composer IndexedDB:', request.error);
            resolve(null);
        };
    });
}

async function readComposerFiles(ids: string[]): Promise<File[]> {
    const db = await openComposerDb();
    if (!db || ids.length === 0) return [];

    return new Promise((resolve) => {
        const tx = db.transaction(COMPOSER_FILE_STORE, 'readonly');
        const store = tx.objectStore(COMPOSER_FILE_STORE);
        const filesById = new Map<string, File>();

        ids.forEach((id) => {
            const request = store.get(id);
            request.onsuccess = () => {
                const stored = request.result as StoredComposerFile | undefined;
                if (stored?.file) filesById.set(id, stored.file);
            };
        });

        tx.oncomplete = () => {
            db.close();
            resolve(ids.map((id) => filesById.get(id)).filter((file): file is File => !!file));
        };
        tx.onerror = () => {
            console.error('Failed to read staged composer files:', tx.error);
            db.close();
            resolve([]);
        };
    });
}

async function writeComposerFiles(states: ChatComposerStateMap, serialized: SerializedComposerStateMap) {
    const db = await openComposerDb();
    if (!db) return;

    return new Promise<void>((resolve) => {
        const tx = db.transaction(COMPOSER_FILE_STORE, 'readwrite');
        const store = tx.objectStore(COMPOSER_FILE_STORE);
        const activeIds = new Set<string>();

        Object.entries(states).forEach(([chatId, state]) => {
            state.stagedFiles.forEach((file, index) => {
                if (!(file instanceof File)) return;

                const id = getComposerFileId(chatId, file, index);
                activeIds.add(id);
                store.put({
                    id,
                    chatId,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                    file,
                } satisfies StoredComposerFile);
            });
        });

        Object.values(serialized).forEach((state) => {
            state.stagedFileIds.forEach((id) => activeIds.add(id));
        });

        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const value = cursor.value as StoredComposerFile;
            if (!activeIds.has(value.id)) cursor.delete();
            cursor.continue();
        };

        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            console.error('Failed to persist staged composer files:', tx.error);
            db.close();
            resolve();
        };
    });
}

function serializeComposerStates(states: ChatComposerStateMap): SerializedComposerStateMap {
    return Object.fromEntries(
        Object.entries(states)
            .map(([chatId, state]) => {
                const stagedFileIds = state.stagedFiles
                    .map((file, index) => file instanceof File ? getComposerFileId(chatId, file, index) : '')
                    .filter(Boolean);

                return [chatId, {
                    messageDraft: state.messageDraft,
                    replyToMessage: state.replyToMessage,
                    editingMessage: state.editingMessage,
                    mentionedUsers: state.mentionedUsers,
                    stagedFileIds,
                } satisfies SerializedComposerState];
            })
            .filter(([, state]) => {
                const composerState = state as SerializedComposerState;
                return Boolean(
                    composerState.messageDraft ||
                    composerState.replyToMessage ||
                    composerState.editingMessage ||
                    composerState.mentionedUsers.length > 0 ||
                    composerState.stagedFileIds.length > 0
                );
            })
    );
}

function saveComposerStatesToStorage(states: ChatComposerStateMap) {
    if (!canUseBrowserStorage()) return;

    try {
        const serialized = serializeComposerStates(states);
        const fileSignature = Object.values(serialized)
            .flatMap((state) => state.stagedFileIds)
            .sort()
            .join('|');

        window.localStorage.setItem(COMPOSER_STORAGE_KEY, JSON.stringify(serialized));
        if (fileSignature !== lastComposerFileSignature) {
            lastComposerFileSignature = fileSignature;
            void writeComposerFiles(states, serialized);
        }
    } catch (error) {
        console.error('Failed to persist chat composer state:', error);
    }
}

// Load initial session state (messages stay in-memory only)
function loadFromStorage(): ChatSessionStore {
    return { messagesByChat: {}, composerStates: {}, lastReadByChat: {} };
}

// Save to storage (disabled per requirements to avoid caching issues)
function saveToStorage() {
    // No-op: we only keep messages in memory for the current session
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
    saveComposerStatesToStorage(cache.session.composerStates);
}

export function getCachedComposerStates(): ChatComposerStateMap {
    return cache.session.composerStates;
}

export function setCachedComposerStates(states: ChatComposerStateMap) {
    cache.session.composerStates = states;
    saveComposerStatesToStorage(states);
}

export async function hydrateCachedComposerStates(): Promise<ChatComposerStateMap> {
    if (!canUseBrowserStorage()) return cache.session.composerStates;

    try {
        const raw = window.localStorage.getItem(COMPOSER_STORAGE_KEY);
        if (!raw) return cache.session.composerStates;

        const serialized = JSON.parse(raw) as SerializedComposerStateMap;
        const hydratedEntries = await Promise.all(
            Object.entries(serialized).map(async ([chatId, state]) => {
                const stagedFiles = await readComposerFiles(state.stagedFileIds || []);
                return [chatId, {
                    messageDraft: state.messageDraft || '',
                    stagedFiles,
                    replyToMessage: state.replyToMessage || null,
                    editingMessage: state.editingMessage || null,
                    mentionedUsers: state.mentionedUsers || [],
                } satisfies ChatComposerState] as const;
            })
        );

        cache.session.composerStates = Object.fromEntries(hydratedEntries);
        lastComposerFileSignature = Object.values(serialized)
            .flatMap((state) => state.stagedFileIds || [])
            .sort()
            .join('|');
        return cache.session.composerStates;
    } catch (error) {
        console.error('Failed to hydrate chat composer state:', error);
        return cache.session.composerStates;
    }
}

// Clear all session data (for logout)
export function clearChatSession() {
    cache.session = {
        messagesByChat: {},
        composerStates: {},
        lastReadByChat: {}
    };
    saveToStorage();
    if (canUseBrowserStorage()) {
        lastComposerFileSignature = '';
        window.localStorage.removeItem(COMPOSER_STORAGE_KEY);
        void openComposerDb().then((db) => {
            if (!db) return;
            const tx = db.transaction(COMPOSER_FILE_STORE, 'readwrite');
            tx.objectStore(COMPOSER_FILE_STORE).clear();
            tx.oncomplete = () => db.close();
            tx.onerror = () => db.close();
        });
    }
}
