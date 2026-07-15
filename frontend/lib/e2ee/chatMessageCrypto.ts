import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceUtils';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { ChatType } from '@/types';
import type {
    Chat,
    ChatE2EEContext,
    ChatHistoryKeyContext,
    ChatMessage,
    ChatParticipant,
    EncryptedChatContent,
    RecipientEncryptionDevicesResponse,
    SendChatMessagePayload,
    TrustedEncryptionDevice,
} from '@/types';
import {
    E2EE_CONTENT_ALGORITHM,
    E2EE_CONTENT_KEY_VERSION,
    E2EE_ENCRYPTION_VERSION,
    encryptStringContent,
    decryptStringContent,
} from './contentCrypto';
import { E2EEError } from './errors';
import { getLocalTrustedDeviceKeys, getUserIdFromToken } from './localDeviceKeys';
import { wrapContentKeyForDevice } from './keyEnvelopeCrypto';
import { unwrapContentKeyFromDeviceEnvelope } from './keyEnvelopeCrypto';
import {
    assertRecipientDeviceCoverage,
    findCurrentTrustedDevice,
    flattenTrustedRecipientDevices,
} from './recipientDevices';
import type { JsonValue } from './sodium';
import {
    E2EE_CHAT_HISTORY_KEY_ALGORITHM,
    generateChatHistoryKey,
    unwrapChatHistoryKeyFromDeviceEnvelope,
    unwrapContentKeyWithChatHistoryKey,
    wrapChatHistoryKeyForDevice,
    wrapContentKeyWithChatHistoryKey,
} from './chatHistoryKeys';

const ENCRYPTED_CHAT_MESSAGE_PLACEHOLDER = '[Encrypted message]';

type DeviceCacheEntry = {
    expiresAt: number;
    data: RecipientEncryptionDevicesResponse[];
};
type HistoryKeyCacheEntry = {
    expiresAt: number;
    historyKeyId: string;
    historyKey: Uint8Array;
};
type CurrentTrustedDeviceCacheEntry = {
    expiresAt: number;
    device?: TrustedEncryptionDevice;
};

const recipientDeviceCache = new Map<string, DeviceCacheEntry>();
const chatHistoryKeyCache = new Map<string, HistoryKeyCacheEntry>();
const currentTrustedDeviceCache = new Map<string, CurrentTrustedDeviceCacheEntry>();
const decryptedChatMessageCache = new Map<string, Promise<string>>();
const decryptedChatMessageValueCache = new Map<string, string>();
const RECIPIENT_DEVICE_CACHE_TTL_MS = 30_000;
const HISTORY_KEY_CACHE_TTL_MS = 5 * 60_000;
const CURRENT_DEVICE_CACHE_TTL_MS = 60_000;
const DECRYPTED_CHAT_CACHE_PREFIX = 'eduverse:e2ee:chat-message:v1';
const DECRYPTED_CHAT_WARMUP_PREFIX = 'eduverse:e2ee:chat-message-warmup:v1';

export interface PrepareEncryptedChatMessageOptions {
    chat: Chat;
    plaintext: string;
    token: string;
    currentUserId: string;
    recipientDevices?: RecipientEncryptionDevicesResponse[];
    replyToId?: string;
    mentionTargets?: SendChatMessagePayload['mentionTargets'];
    mentionedUserIds?: string[];
    purpose?: 'SEND' | 'EDIT';
    messageId?: string;
}

export function getActiveChatParticipantUserIds(chat: Chat): string[] {
    return Array.from(new Set(
        (chat.participants || [])
            .filter((participant: ChatParticipant) => participant.isActive)
            .map((participant) => participant.userId),
    ));
}

export function isEncryptedChatMessage(message?: Pick<ChatMessage, 'encryptedContent'> | null) {
    return Boolean(message?.encryptedContent?.ciphertext && message.encryptedContent.keyEnvelopes?.length);
}

function getDecryptedChatMessageCacheKey(message: ChatMessage, token: string) {
    if (!message.encryptedContent) return null;
    const tokenUserId = getUserIdFromToken(token);
    const clientDeviceId = getDeviceId();
    if (!tokenUserId || !clientDeviceId) return null;

    const encryptedRevision = [
        message.id,
        message.updatedAt || message.createdAt,
        message.encryptedContent.id || '',
        message.encryptedContent.ciphertext,
    ].join(':');

    return `${DECRYPTED_CHAT_CACHE_PREFIX}:${tokenUserId}:${clientDeviceId}:${encryptedRevision}`;
}

function getDecryptedChatWarmupCacheKey(token: string) {
    const tokenUserId = getUserIdFromToken(token);
    const clientDeviceId = getDeviceId();
    if (!tokenUserId || !clientDeviceId) return null;
    return `${DECRYPTED_CHAT_WARMUP_PREFIX}:${tokenUserId}:${clientDeviceId}`;
}

export async function getDecryptedChatWarmupCompleted(token: string) {
    const cacheKey = getDecryptedChatWarmupCacheKey(token);
    if (!cacheKey) return false;

    try {
        return (await idbGet<string>(cacheKey)) === '1';
    } catch {
        return false;
    }
}

export async function markDecryptedChatWarmupCompleted(token: string) {
    const cacheKey = getDecryptedChatWarmupCacheKey(token);
    if (!cacheKey) return;

    try {
        await idbSet(cacheKey, '1');
    } catch {
        // The marker only controls UX. Missing IndexedDB support should not block secure messages.
    }
}

export async function getCachedDecryptedChatMessageContent(message: ChatMessage, token: string) {
    const cacheKey = getDecryptedChatMessageCacheKey(message, token);
    if (!cacheKey) return null;

    const memoryValue = decryptedChatMessageValueCache.get(cacheKey);
    if (memoryValue !== undefined) return memoryValue;

    try {
        const stored = await idbGet<string>(cacheKey);
        if (typeof stored !== 'string') return null;
        decryptedChatMessageValueCache.set(cacheKey, stored);
        return stored;
    } catch {
        return null;
    }
}

export async function cacheDecryptedChatMessageContent(message: ChatMessage, token: string, plaintext: string) {
    const cacheKey = getDecryptedChatMessageCacheKey(message, token);
    if (!cacheKey) return;

    decryptedChatMessageValueCache.set(cacheKey, plaintext);
    try {
        await idbSet(cacheKey, plaintext);
    } catch {
        // Decrypted message cache is SWR-only. If IndexedDB is unavailable, in-memory cache still helps.
    }
}

async function getRecipientDevices(userIds: string[], token: string) {
    const normalizedUserIds = [...new Set(userIds)].sort();
    const cacheKey = `${token.slice(0, 12)}:${normalizedUserIds.join(',')}`;
    const cached = recipientDeviceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = await api.e2ee.getRecipientDevices(normalizedUserIds, token);
    recipientDeviceCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + RECIPIENT_DEVICE_CACHE_TTL_MS,
    });
    return data;
}

async function unwrapHistoryKeyForCurrentDevice(
    historyKey: ChatHistoryKeyContext,
    currentDevice: TrustedEncryptionDevice,
    recipientPrivateKey: string,
) {
    const envelope = historyKey.deviceEnvelopes?.find((candidate) => (
        candidate.trustedDeviceId === currentDevice.id ||
        candidate.trustedDevice?.clientDeviceId === currentDevice.clientDeviceId
    ));
    const senderPublicKey = envelope?.senderDevice?.keyAgreementPublicKey;
    if (!envelope || !senderPublicKey) return null;

    return unwrapChatHistoryKeyFromDeviceEnvelope({
        envelope: {
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce || '',
            associatedData: (envelope.associatedData || undefined) as JsonValue | undefined,
            deviceKeyVersion: envelope.deviceKeyVersion,
        },
        recipientPrivateKey,
        senderPublicKey,
    });
}

async function getOrCreateChatHistoryKey(options: {
    chat: Chat;
    token: string;
    currentUserId: string;
    senderDevice: TrustedEncryptionDevice;
    senderPrivateKey: string;
    deviceRecipients: Array<{ userId: string; device: TrustedEncryptionDevice }>;
}) {
    const cacheKey = `${options.chat.id}:${options.senderDevice.id}`;
    const cached = chatHistoryKeyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const context = await api.chat.getE2EEContext(options.chat.id, options.token);
    const existing = await getUsableHistoryKeyFromContext(context, options.senderDevice, options.senderPrivateKey);
    if (existing) {
        chatHistoryKeyCache.set(cacheKey, {
            ...existing,
            expiresAt: Date.now() + HISTORY_KEY_CACHE_TTL_MS,
        });
        return {
            ...existing,
            expiresAt: Date.now() + HISTORY_KEY_CACHE_TTL_MS,
        };
    }

    const historyKey = await generateChatHistoryKey();
    const associatedData = {
        scope: 'CHAT_HISTORY_KEY',
        chatId: options.chat.id,
        chatType: options.chat.type,
        creatorUserId: options.currentUserId,
    };
    const deviceEnvelopes = await Promise.all(options.deviceRecipients.map(async ({ userId, device }) => {
        const envelope = await wrapChatHistoryKeyForDevice({
            historyKey,
            recipientPublicKey: device.keyAgreementPublicKey,
            senderPrivateKey: options.senderPrivateKey,
            deviceKeyVersion: device.keyVersion,
            associatedData: {
                ...associatedData,
                recipientUserId: userId,
                trustedDeviceId: device.id,
                senderDeviceId: options.senderDevice.id,
            },
        });

        return {
            recipientUserId: userId,
            trustedDeviceId: device.id,
            senderDeviceId: options.senderDevice.id,
            deviceKeyVersion: envelope.deviceKeyVersion,
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce,
            associatedData: envelope.associatedData as Record<string, unknown>,
        };
    }));

    const registered = await api.chat.registerHistoryKey(options.chat.id, {
        algorithm: E2EE_CHAT_HISTORY_KEY_ALGORITHM,
        deviceEnvelopes,
    }, options.token);

    const entry = {
        historyKeyId: registered.id,
        historyKey,
        expiresAt: Date.now() + HISTORY_KEY_CACHE_TTL_MS,
    };
    chatHistoryKeyCache.set(cacheKey, entry);
    return entry;
}

async function getUsableHistoryKeyFromContext(
    context: ChatE2EEContext,
    currentDevice: TrustedEncryptionDevice,
    recipientPrivateKey: string,
) {
    for (const candidate of context.historyKeys) {
        try {
            const historyKey = await unwrapHistoryKeyForCurrentDevice(candidate, currentDevice, recipientPrivateKey);
            if (historyKey) {
                return {
                    historyKeyId: candidate.id,
                    historyKey,
                };
            }
        } catch {
            // Try the next epoch key available to this device.
        }
    }
    return null;
}

export async function prepareEncryptedChatMessagePayload({
    chat,
    plaintext,
    token,
    currentUserId,
    recipientDevices: providedRecipientDevices,
    replyToId,
    mentionTargets,
    mentionedUserIds,
    purpose = 'SEND',
    messageId,
}: PrepareEncryptedChatMessageOptions): Promise<SendChatMessagePayload> {
    const activeUserIds = getActiveChatParticipantUserIds(chat);
    if (!activeUserIds.includes(currentUserId)) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'You are not an active participant in this chat.');
    }

    const clientDeviceId = getDeviceId();
    if (!clientDeviceId) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is not ready for secure Chat.');
    }

    const tokenUserId = getUserIdFromToken(token);
    const localKeys = await getLocalTrustedDeviceKeys(tokenUserId, clientDeviceId);
    if (!localKeys) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'Trust this browser before sending secure Chat messages.');
    }

    const recipientDevices = providedRecipientDevices || await getRecipientDevices(activeUserIds, token);
    if (chat.type !== ChatType.GROUP) {
        assertRecipientDeviceCoverage(recipientDevices, activeUserIds, 'Chat');
    }
    const senderDevice = findCurrentTrustedDevice(recipientDevices, currentUserId, clientDeviceId);
    if (!senderDevice) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is still waiting for approval.');
    }

    const deviceRecipients = flattenTrustedRecipientDevices(recipientDevices);

    if (deviceRecipients.length === 0) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'No approved browsers are available for this chat.');
    }

    const associatedData = {
        scope: 'CHAT_MESSAGE',
        purpose,
        chatId: chat.id,
        chatType: chat.type,
        senderId: currentUserId,
        replyToId: replyToId || null,
        messageId: messageId || null,
        encryptionVersion: E2EE_ENCRYPTION_VERSION,
    };

    const encrypted = await encryptStringContent(plaintext, { associatedData });
    const historyKey = await getOrCreateChatHistoryKey({
        chat,
        token,
        currentUserId,
        senderDevice,
        senderPrivateKey: localKeys.keyAgreementPrivateKey,
        deviceRecipients,
    });
    const historyKeyEnvelope = await wrapContentKeyWithChatHistoryKey({
        contentKey: encrypted.contentKey,
        historyKey: historyKey.historyKey,
        associatedData: {
            ...associatedData,
            historyKeyId: historyKey.historyKeyId,
        },
    });
    const keyEnvelopes = await Promise.all(
        deviceRecipients.map(async ({ userId, device }) => {
            const envelope = await wrapContentKeyForDevice({
                contentKey: encrypted.contentKey,
                recipientPublicKey: device.keyAgreementPublicKey,
                senderPrivateKey: localKeys.keyAgreementPrivateKey,
                deviceKeyVersion: device.keyVersion,
                associatedData: {
                    ...associatedData,
                    recipientUserId: userId,
                    trustedDeviceId: device.id,
                    senderDeviceId: senderDevice.id,
                },
            });

            return {
                recipientUserId: userId,
                trustedDeviceId: device.id,
                senderDeviceId: senderDevice.id,
                deviceKeyVersion: envelope.deviceKeyVersion,
                algorithm: envelope.algorithm,
                wrappedKey: envelope.wrappedKey,
                nonce: envelope.nonce,
                associatedData: envelope.associatedData as Record<string, unknown>,
            };
        }),
    );

    const encryptedContent: EncryptedChatContent = {
        encryptionVersion: E2EE_ENCRYPTION_VERSION,
        algorithm: E2EE_CONTENT_ALGORITHM,
        ciphertext: encrypted.payload.ciphertext,
        nonce: encrypted.payload.nonce,
        authTag: encrypted.payload.authTag,
        associatedData: encrypted.payload.associatedData as Record<string, unknown>,
        contentKeyVersion: E2EE_CONTENT_KEY_VERSION,
        keyEnvelopes,
        historyKeyEnvelopes: [{
            historyKeyId: historyKey.historyKeyId,
            recipientUserId: currentUserId,
            algorithm: historyKeyEnvelope.algorithm,
            wrappedKey: historyKeyEnvelope.wrappedKey,
            nonce: historyKeyEnvelope.nonce,
            associatedData: historyKeyEnvelope.associatedData as Record<string, unknown>,
        }],
    };

    return {
        content: ENCRYPTED_CHAT_MESSAGE_PLACEHOLDER,
        encryptedContent,
        replyToId,
        mentionTargets,
        mentionedUserIds,
    };
}

async function getCurrentTrustedDevice(token: string, clientDeviceId: string) {
    const tokenUserId = getUserIdFromToken(token) || 'unknown';
    const cacheKey = `${tokenUserId}:${clientDeviceId}`;
    const cached = currentTrustedDeviceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.device;

    const devices = await api.e2ee.getMyDevices(token);
    const device = devices.devices.find((device) => (
        device.clientDeviceId === clientDeviceId &&
        device.trustStatus === 'TRUSTED' &&
        !device.revokedAt &&
        device.trustedAt
    ));
    currentTrustedDeviceCache.set(cacheKey, {
        device,
        expiresAt: Date.now() + (device ? CURRENT_DEVICE_CACHE_TTL_MS : 5_000),
    });
    return device;
}

export async function decryptChatMessageContent(message: ChatMessage, token: string): Promise<string> {
    if (!message.encryptedContent) return message.content;
    const cacheKey = `${message.id}:${message.updatedAt}:${message.encryptedContent.id || message.encryptedContent.ciphertext}`;
    const cached = decryptedChatMessageCache.get(cacheKey);
    if (cached) return cached;

    const persistentCached = await getCachedDecryptedChatMessageContent(message, token);
    if (persistentCached !== null) return persistentCached;

    const decryptPromise = decryptChatMessageContentUncached(message, token)
        .then(async (plaintext) => {
            await cacheDecryptedChatMessageContent(message, token, plaintext);
            return plaintext;
        });
    decryptedChatMessageCache.set(cacheKey, decryptPromise);
    decryptPromise.catch(() => {
        decryptedChatMessageCache.delete(cacheKey);
    });
    return decryptPromise;
}

async function decryptChatMessageContentUncached(message: ChatMessage, token: string): Promise<string> {
    const encryptedContent = message.encryptedContent;
    if (!encryptedContent) return message.content;

    const clientDeviceId = getDeviceId();
    if (!clientDeviceId) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is not ready for secure Chat.');
    }
    const tokenUserId = getUserIdFromToken(token);

    const [localKeys, currentDevice] = await Promise.all([
        getLocalTrustedDeviceKeys(tokenUserId, clientDeviceId),
        getCurrentTrustedDevice(token, clientDeviceId),
    ]);

    if (!localKeys || !currentDevice) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is not approved for secure Chat.');
    }

    const envelope = encryptedContent.keyEnvelopes?.find((candidate) => (
        candidate.trustedDeviceId === currentDevice.id ||
        candidate.trustedDevice?.clientDeviceId === clientDeviceId
    ));

    const contentKey = envelope
        ? await unwrapDirectContentKey(envelope, localKeys.keyAgreementPrivateKey)
        : await unwrapContentKeyFromHistoryEnvelope(message, currentDevice, localKeys.keyAgreementPrivateKey);

    return decryptStringContent({
        encryptionVersion: encryptedContent.encryptionVersion,
        algorithm: encryptedContent.algorithm,
        ciphertext: encryptedContent.ciphertext,
        nonce: encryptedContent.nonce,
        authTag: encryptedContent.authTag || null,
        associatedData: (encryptedContent.associatedData || undefined) as JsonValue | undefined,
        contentKeyVersion: encryptedContent.contentKeyVersion || E2EE_CONTENT_KEY_VERSION,
    }, contentKey);
}

async function unwrapDirectContentKey(
    envelope: NonNullable<NonNullable<ChatMessage['encryptedContent']>['keyEnvelopes']>[number],
    recipientPrivateKey: string,
) {
    const senderPublicKey = envelope.senderDevice?.keyAgreementPublicKey;
    if (!senderPublicKey) {
        throw new E2EEError('NO_KEY_ENVELOPE', "This message can't be opened here.");
    }

    return unwrapContentKeyFromDeviceEnvelope({
        envelope: {
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce || '',
            associatedData: (envelope.associatedData || undefined) as JsonValue | undefined,
            deviceKeyVersion: envelope.deviceKeyVersion,
        },
        senderPublicKey,
        recipientPrivateKey,
    });
}

async function unwrapContentKeyFromHistoryEnvelope(
    message: ChatMessage,
    currentDevice: TrustedEncryptionDevice,
    recipientPrivateKey: string,
) {
    for (const envelope of message.encryptedContent?.historyKeyEnvelopes || []) {
        const historyContext = envelope.historyKey;
        if (!historyContext) continue;

        const historyKey = await unwrapHistoryKeyForCurrentDevice(historyContext, currentDevice, recipientPrivateKey);
        if (!historyKey) continue;

        return unwrapContentKeyWithChatHistoryKey({
            algorithm: envelope.algorithm as typeof E2EE_CHAT_HISTORY_KEY_ALGORITHM,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce || '',
            associatedData: (envelope.associatedData || undefined) as JsonValue | undefined,
        }, historyKey);
    }

    throw new E2EEError('NO_KEY_ENVELOPE', 'This message is not available on this device.');
}
