import { E2EEError } from './errors';
import {
    decodeBase64,
    encodeAssociatedData,
    encodeBase64,
    JsonValue,
    loadSodium,
} from './sodium';

export const E2EE_KEY_ENVELOPE_ALGORITHM = 'libsodium:crypto_box_easy';

export interface KeyEnvelopePayload {
    algorithm: string;
    wrappedKey: string;
    nonce: string;
    associatedData?: JsonValue;
    deviceKeyVersion: number;
}

export interface WrapContentKeyOptions {
    contentKey: string | Uint8Array;
    recipientPublicKey: string | Uint8Array;
    senderPrivateKey: string | Uint8Array;
    deviceKeyVersion: number;
    associatedData?: JsonValue;
}

export interface UnwrapContentKeyOptions {
    envelope: KeyEnvelopePayload;
    senderPublicKey: string | Uint8Array;
    recipientPrivateKey: string | Uint8Array;
}

export async function wrapContentKeyForDevice(options: WrapContentKeyOptions): Promise<KeyEnvelopePayload> {
    const sodium = await loadSodium();
    const contentKey = toBytes(sodium, options.contentKey);
    const recipientPublicKey = toBytes(sodium, options.recipientPublicKey);
    const senderPrivateKey = toBytes(sodium, options.senderPrivateKey);
    validateBoxPublicKey(sodium, recipientPublicKey);
    validateBoxPrivateKey(sodium, senderPrivateKey);

    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const additionalData = encodeAssociatedData(options.associatedData);
    const message = additionalData
        ? new TextEncoder().encode(`${additionalData}.${encodeBase64(sodium, contentKey)}`)
        : contentKey;

    const wrappedKey = sodium.crypto_box_easy(
        message,
        nonce,
        recipientPublicKey,
        senderPrivateKey,
    );

    return {
        algorithm: E2EE_KEY_ENVELOPE_ALGORITHM,
        wrappedKey: encodeBase64(sodium, wrappedKey),
        nonce: encodeBase64(sodium, nonce),
        associatedData: options.associatedData,
        deviceKeyVersion: options.deviceKeyVersion,
    };
}

export async function unwrapContentKeyFromDeviceEnvelope(options: UnwrapContentKeyOptions) {
    const sodium = await loadSodium();
    validateKeyEnvelope(options.envelope);
    const senderPublicKey = toBytes(sodium, options.senderPublicKey);
    const recipientPrivateKey = toBytes(sodium, options.recipientPrivateKey);
    validateBoxPublicKey(sodium, senderPublicKey);
    validateBoxPrivateKey(sodium, recipientPrivateKey);

    try {
        const opened = sodium.crypto_box_open_easy(
            decodeBase64(sodium, options.envelope.wrappedKey),
            decodeBase64(sodium, options.envelope.nonce),
            senderPublicKey,
            recipientPrivateKey,
        );
        const additionalData = encodeAssociatedData(options.envelope.associatedData);
        if (!additionalData) return encodeBase64(sodium, opened);

        const decoded = new TextDecoder().decode(opened);
        const prefix = `${additionalData}.`;
        if (!decoded.startsWith(prefix)) {
            throw new E2EEError('CORRUPT_CIPHERTEXT', 'Key envelope associated data did not match.');
        }
        return decoded.slice(prefix.length);
    } catch (error) {
        if (error instanceof E2EEError) throw error;
        throw new E2EEError('NO_KEY_ENVELOPE', 'Content key envelope could not be opened on this device.');
    }
}

export function validateKeyEnvelope(envelope: KeyEnvelopePayload) {
    if (envelope.algorithm !== E2EE_KEY_ENVELOPE_ALGORITHM) {
        throw new E2EEError(
            'UNSUPPORTED_ENCRYPTION_VERSION',
            `Unsupported key envelope algorithm: ${envelope.algorithm}.`,
        );
    }
}

function toBytes(sodium: Awaited<ReturnType<typeof loadSodium>>, value: string | Uint8Array) {
    return typeof value === 'string' ? decodeBase64(sodium, value) : value;
}

function validateBoxPublicKey(
    sodium: Awaited<ReturnType<typeof loadSodium>>,
    key: Uint8Array,
) {
    if (key.length !== sodium.crypto_box_PUBLICKEYBYTES) {
        throw new E2EEError('INVALID_KEY_MATERIAL', 'Invalid public key length.');
    }
}

function validateBoxPrivateKey(
    sodium: Awaited<ReturnType<typeof loadSodium>>,
    key: Uint8Array,
) {
    if (key.length !== sodium.crypto_box_SECRETKEYBYTES) {
        throw new E2EEError('INVALID_KEY_MATERIAL', 'Invalid private key length.');
    }
}
