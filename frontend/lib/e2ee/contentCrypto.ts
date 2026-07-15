import { E2EEError } from './errors';
import {
    decodeBase64,
    encodeAssociatedData,
    encodeBase64,
    JsonValue,
    loadSodium,
} from './sodium';

export const E2EE_ENCRYPTION_VERSION = 1;
export const E2EE_CONTENT_KEY_VERSION = 1;
export const E2EE_CONTENT_ALGORITHM = 'libsodium:xchacha20poly1305-ietf';

export interface EncryptedContentPayload {
    encryptionVersion: number;
    algorithm: string;
    ciphertext: string;
    nonce: string;
    authTag?: string | null;
    associatedData?: JsonValue;
    contentKeyVersion: number;
}

export interface EncryptContentOptions {
    contentKey?: string | Uint8Array;
    associatedData?: JsonValue;
}

export interface EncryptContentResult {
    payload: EncryptedContentPayload;
    contentKey: string;
}

export async function generateContentKey() {
    const sodium = await loadSodium();
    return encodeBase64(
        sodium,
        sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES),
    );
}

export async function encryptStringContent(
    plaintext: string,
    options: EncryptContentOptions = {},
): Promise<EncryptContentResult> {
    const sodium = await loadSodium();
    const key = typeof options.contentKey === 'string'
        ? decodeBase64(sodium, options.contentKey)
        : options.contentKey ?? sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
    validateContentKey(sodium, key);

    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const additionalData = encodeAssociatedData(options.associatedData);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        plaintext,
        additionalData,
        null,
        nonce,
        key,
    );

    const payload: EncryptedContentPayload = {
        encryptionVersion: E2EE_ENCRYPTION_VERSION,
        algorithm: E2EE_CONTENT_ALGORITHM,
        ciphertext: encodeBase64(sodium, ciphertext),
        nonce: encodeBase64(sodium, nonce),
        authTag: null,
        associatedData: options.associatedData,
        contentKeyVersion: E2EE_CONTENT_KEY_VERSION,
    };

    return {
        payload,
        contentKey: encodeBase64(sodium, key),
    };
}

export async function decryptStringContent(
    payload: EncryptedContentPayload,
    contentKey: string | Uint8Array,
) {
    const sodium = await loadSodium();
    validateEncryptedPayload(payload);
    const key = typeof contentKey === 'string' ? decodeBase64(sodium, contentKey) : contentKey;
    validateContentKey(sodium, key);

    try {
        return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            null,
            decodeBase64(sodium, payload.ciphertext),
            encodeAssociatedData(payload.associatedData),
            decodeBase64(sodium, payload.nonce),
            key,
            'text',
        );
    } catch {
        throw new E2EEError('CORRUPT_CIPHERTEXT', 'Encrypted content could not be decrypted.');
    }
}

export function validateEncryptedPayload(payload: EncryptedContentPayload) {
    if (payload.encryptionVersion !== E2EE_ENCRYPTION_VERSION) {
        throw new E2EEError(
            'UNSUPPORTED_ENCRYPTION_VERSION',
            `Unsupported encrypted content version: ${payload.encryptionVersion}.`,
        );
    }
    if (payload.algorithm !== E2EE_CONTENT_ALGORITHM) {
        throw new E2EEError(
            'UNSUPPORTED_ENCRYPTION_VERSION',
            `Unsupported encrypted content algorithm: ${payload.algorithm}.`,
        );
    }
}

function validateContentKey(
    sodium: Awaited<ReturnType<typeof loadSodium>>,
    key: Uint8Array,
) {
    if (key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
        throw new E2EEError('INVALID_KEY_MATERIAL', 'Invalid content key length.');
    }
}
