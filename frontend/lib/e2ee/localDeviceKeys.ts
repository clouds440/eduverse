import { get, set } from 'idb-keyval';
import { getDeviceId } from '@/lib/deviceUtils';

const PRIVATE_KEY_STORE_PREFIX = 'e2ee:trusted-device';

export interface LocalTrustedDeviceKeys {
    algorithm: string;
    userId?: string;
    clientDeviceId: string;
    identityPublicKey?: string;
    identityPrivateKey: string;
    identitySigningPublicKey?: string;
    identitySigningPrivateKey: string;
    keyAgreementPublicKey?: string;
    keyAgreementPrivateKey: string;
    signingPublicKey?: string;
    signingPrivateKey: string;
    createdAt: string;
}

export function getUserIdFromToken(token: string): string | null {
    try {
        const [, payload] = token.split('.');
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const decoded = JSON.parse(atob(padded)) as { sub?: string; id?: string };
        return decoded.sub || decoded.id || null;
    } catch {
        return null;
    }
}

export function privateKeyStoreKey(userId: string, clientDeviceId: string) {
    return `${PRIVATE_KEY_STORE_PREFIX}:${userId}:${clientDeviceId}`;
}

function legacyPrivateKeyStoreKey(clientDeviceId: string) {
    return `${PRIVATE_KEY_STORE_PREFIX}:${clientDeviceId}`;
}

export async function hasLocalTrustedDeviceKeys(userId: string | null | undefined, clientDeviceId = getDeviceId()) {
    if (!userId || !clientDeviceId) return false;
    return Boolean(await get<LocalTrustedDeviceKeys>(privateKeyStoreKey(userId, clientDeviceId)));
}

export async function getLocalTrustedDeviceKeys(userId: string | null | undefined, clientDeviceId = getDeviceId()) {
    if (!userId || !clientDeviceId) return null;
    return get<LocalTrustedDeviceKeys>(privateKeyStoreKey(userId, clientDeviceId));
}

export async function getLegacyLocalTrustedDeviceKeys(clientDeviceId = getDeviceId()) {
    if (!clientDeviceId) return null;
    return get<LocalTrustedDeviceKeys>(legacyPrivateKeyStoreKey(clientDeviceId));
}

export async function saveLocalTrustedDeviceKeys(userId: string, keys: LocalTrustedDeviceKeys) {
    await set(privateKeyStoreKey(userId, keys.clientDeviceId), { ...keys, userId });
}
