import { E2EEError } from './errors';
import {
    E2EE_KEY_ENVELOPE_ALGORITHM,
    type KeyEnvelopePayload,
    unwrapContentKeyFromDeviceEnvelope,
    wrapContentKeyForDevice,
} from './keyEnvelopeCrypto';
import {
    decodeBase64,
    encodeAssociatedData,
    encodeBase64,
    type JsonValue,
    loadSodium,
} from './sodium';

export const E2EE_CHAT_HISTORY_KEY_ALGORITHM = 'libsodium:xchacha20poly1305-ietf';

export interface ChatHistoryKeyEnvelopePayload {
    algorithm: typeof E2EE_CHAT_HISTORY_KEY_ALGORITHM;
    wrappedKey: string;
    nonce: string;
    associatedData?: JsonValue;
}

export interface WrapChatHistoryKeyForDeviceOptions {
    historyKey: Uint8Array;
    recipientPublicKey: string;
    senderPrivateKey: string;
    deviceKeyVersion: number;
    associatedData?: JsonValue;
}

export interface UnwrapChatHistoryKeyFromDeviceOptions {
    envelope: KeyEnvelopePayload;
    recipientPrivateKey: string;
    senderPublicKey: string;
}

export interface WrapContentKeyWithChatHistoryKeyOptions {
    contentKey: string | Uint8Array;
    historyKey: Uint8Array;
    associatedData?: JsonValue;
}

export async function generateChatHistoryKey(): Promise<Uint8Array> {
    const sodium = await loadSodium();
    return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

export async function wrapChatHistoryKeyForDevice({
    historyKey,
    recipientPublicKey,
    senderPrivateKey,
    deviceKeyVersion,
    associatedData,
}: WrapChatHistoryKeyForDeviceOptions): Promise<KeyEnvelopePayload> {
    return wrapContentKeyForDevice({
        contentKey: historyKey,
        recipientPublicKey,
        senderPrivateKey,
        deviceKeyVersion,
        associatedData,
    });
}

export async function unwrapChatHistoryKeyFromDeviceEnvelope({
    envelope,
    recipientPrivateKey,
    senderPublicKey,
}: UnwrapChatHistoryKeyFromDeviceOptions): Promise<Uint8Array> {
    if (envelope.algorithm !== E2EE_KEY_ENVELOPE_ALGORITHM) {
        throw new E2EEError('UNSUPPORTED_ENCRYPTION_VERSION', 'Unsupported chat history key envelope algorithm.');
    }

    const unwrappedKey = await unwrapContentKeyFromDeviceEnvelope({
        envelope,
        recipientPrivateKey,
        senderPublicKey,
    });
    const sodium = await loadSodium();
    return decodeBase64(sodium, unwrappedKey);
}

export async function wrapContentKeyWithChatHistoryKey({
    contentKey,
    historyKey,
    associatedData,
}: WrapContentKeyWithChatHistoryKeyOptions): Promise<ChatHistoryKeyEnvelopePayload> {
    const sodium = await loadSodium();
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const additionalData = encodeAssociatedData(associatedData);
    const contentKeyBytes = typeof contentKey === 'string'
        ? decodeBase64(sodium, contentKey)
        : contentKey;

    const wrapped = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        contentKeyBytes,
        additionalData,
        null,
        nonce,
        historyKey,
    );

    return {
        algorithm: E2EE_CHAT_HISTORY_KEY_ALGORITHM,
        wrappedKey: encodeBase64(sodium, wrapped),
        nonce: encodeBase64(sodium, nonce),
        associatedData,
    };
}

export async function unwrapContentKeyWithChatHistoryKey(
    envelope: ChatHistoryKeyEnvelopePayload,
    historyKey: Uint8Array,
): Promise<Uint8Array> {
    if (envelope.algorithm !== E2EE_CHAT_HISTORY_KEY_ALGORITHM) {
        throw new E2EEError('UNSUPPORTED_ENCRYPTION_VERSION', 'Unsupported chat content history-key envelope algorithm.');
    }

    const sodium = await loadSodium();
    const additionalData = encodeAssociatedData(envelope.associatedData);

    try {
        return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            null,
            decodeBase64(sodium, envelope.wrappedKey),
            additionalData,
            decodeBase64(sodium, envelope.nonce),
            historyKey,
        );
    } catch {
        throw new E2EEError('CORRUPT_CIPHERTEXT', 'Unable to unwrap chat content key with history key.');
    }
}
