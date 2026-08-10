import { del as idbDel, keys as idbKeys } from 'idb-keyval';
import { clearChatSession } from './chatStore';
import {
    clearDecryptedChatMessageMemoryCache,
    DECRYPTED_CHAT_MESSAGE_CACHE_PREFIX,
} from './e2ee/chatMessageCrypto';
import {
    clearDecryptedMailContentMemoryCache,
    DECRYPTED_MAIL_CONTENT_CACHE_PREFIX,
} from './e2ee/mailMessageCrypto';
import { clearTrustedDeviceMemoryCache } from './e2ee/currentDeviceTrust';
import { removeLocalTrustedDeviceKeys } from './e2ee/localDeviceKeys';

const API_CACHE_PREFIX = 'eduverse-cache:';
const SENSITIVE_API_CACHE_PATH_PREFIXES = [
    '/chat',
    '/mail',
];

function isSensitiveIdbKey(key: IDBValidKey) {
    if (typeof key !== 'string') return false;

    if (
        key.startsWith(DECRYPTED_CHAT_MESSAGE_CACHE_PREFIX) ||
        key.startsWith(DECRYPTED_MAIL_CONTENT_CACHE_PREFIX)
    ) {
        return true;
    }

    if (!key.startsWith(API_CACHE_PREFIX)) return false;
    const endpoint = key.slice(API_CACHE_PREFIX.length);
    return SENSITIVE_API_CACHE_PATH_PREFIXES.some((prefix) => (
        endpoint === prefix || endpoint.startsWith(`${prefix}/`) || endpoint.startsWith(`${prefix}?`)
    ));
}

export async function clearSensitiveBrowserCaches(options: {
    userId?: string | null;
    clientDeviceId?: string | null;
    removeTrustedDeviceKeys?: boolean;
} = {}) {
    clearChatSession();
    clearDecryptedChatMessageMemoryCache();
    clearDecryptedMailContentMemoryCache();
    clearTrustedDeviceMemoryCache();

    if (options.removeTrustedDeviceKeys) {
        await removeLocalTrustedDeviceKeys(options.userId, options.clientDeviceId);
    }

    if (typeof indexedDB === 'undefined') return;

    try {
        const keys = await idbKeys();
        await Promise.all(keys.filter(isSensitiveIdbKey).map((key) => idbDel(key)));
    } catch (error) {
        console.warn('Failed to clear sensitive browser caches:', error);
    }
}
