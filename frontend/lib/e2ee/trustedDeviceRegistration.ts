import { api } from '@/lib/api';
import { getDeviceId, getDeviceInfo } from '@/lib/deviceUtils';
import type { RegisterTrustedDevicePayload, TrustedDeviceRegistrationResponse } from '@/types';
import {
    getLegacyLocalTrustedDeviceKeys,
    getLocalTrustedDeviceKeys,
    getUserIdFromToken,
    saveLocalTrustedDeviceKeys,
    type LocalTrustedDeviceKeys,
} from './localDeviceKeys';
import {
    decodeBase64,
    encodeBase64,
    fingerprintBytes,
    loadSodium,
} from './sodium';

const ALGORITHM = 'libsodium:x25519+ed25519';

export async function registerCurrentTrustedDevice(
    token: string,
    options: { requestApprovalNotification?: boolean } = {},
): Promise<TrustedDeviceRegistrationResponse> {
    const clientDeviceId = getDeviceId();
    if (!clientDeviceId) throw new Error('Unable to identify this browser device.');
    const userId = getUserIdFromToken(token);
    if (!userId) throw new Error('Unable to identify the current account.');

    const sodium = await loadSodium();
    const deviceInfo = getDeviceInfo();
    const remoteState = await api.e2ee.getMyDevices(token).catch(() => null);
    const remoteDevice = remoteState?.devices.find((device) => device.clientDeviceId === clientDeviceId && !device.revokedAt);
    const scopedKeys = await getLocalTrustedDeviceKeys(userId, clientDeviceId);
    const legacyKeys = scopedKeys ? null : await getLegacyLocalTrustedDeviceKeys(clientDeviceId);
    const legacyKeysMatchRemoteDevice = Boolean(
        legacyKeys &&
        remoteDevice?.keyAgreementPublicKey &&
        legacyKeys.keyAgreementPublicKey === remoteDevice.keyAgreementPublicKey,
    );
    const existingKeys = scopedKeys || (legacyKeysMatchRemoteDevice ? legacyKeys : null);

    const identityBox = existingKeys
        ? null
        : sodium.crypto_box_keypair();
    const identitySign = existingKeys
        ? null
        : sodium.crypto_sign_keypair();
    const deviceBox = existingKeys
        ? null
        : sodium.crypto_box_keypair();
    const deviceSign = existingKeys
        ? null
        : sodium.crypto_sign_keypair();
    const fallbackIdentitySign = !identitySign && existingKeys && !(existingKeys.identitySigningPublicKey || remoteState?.identity?.signingPublicKey)
        ? sodium.crypto_sign_keypair()
        : null;
    const fallbackDeviceSign = !deviceSign && existingKeys && !(existingKeys.signingPublicKey || remoteDevice?.signingPublicKey)
        ? sodium.crypto_sign_keypair()
        : null;

    const identityPublicKey = remoteState?.identity?.identityPublicKey
        ? decodeBase64(sodium, remoteState.identity.identityPublicKey)
        : identityBox?.publicKey ?? decodeBase64(
            sodium,
            existingKeys?.identityPublicKey || encodeBase64(sodium, sodium.crypto_scalarmult_base(decodeBase64(sodium, existingKeys!.identityPrivateKey))),
        );
    const identitySigningPublicKey = identitySign?.publicKey
        ?? fallbackIdentitySign?.publicKey
        ?? decodeBase64(sodium, remoteState?.identity?.signingPublicKey || existingKeys!.identitySigningPublicKey!);
    const keyAgreementPublicKey = deviceBox?.publicKey ?? decodeBase64(
        sodium,
        existingKeys?.keyAgreementPublicKey || remoteDevice?.keyAgreementPublicKey || encodeBase64(sodium, sodium.crypto_scalarmult_base(decodeBase64(sodium, existingKeys!.keyAgreementPrivateKey))),
    );
    const signingPublicKey = deviceSign?.publicKey
        ?? fallbackDeviceSign?.publicKey
        ?? decodeBase64(sodium, existingKeys?.signingPublicKey || remoteDevice!.signingPublicKey!);

    const localKeys: LocalTrustedDeviceKeys = {
        algorithm: ALGORITHM,
        userId,
        clientDeviceId,
        identityPublicKey: existingKeys?.identityPublicKey ?? encodeBase64(sodium, identityPublicKey),
        identityPrivateKey: existingKeys?.identityPrivateKey ?? encodeBase64(sodium, identityBox!.privateKey),
        identitySigningPublicKey: existingKeys?.identitySigningPublicKey ?? encodeBase64(sodium, identitySigningPublicKey),
        identitySigningPrivateKey: fallbackIdentitySign
            ? encodeBase64(sodium, fallbackIdentitySign.privateKey)
            : existingKeys?.identitySigningPrivateKey ?? encodeBase64(sodium, identitySign!.privateKey),
        keyAgreementPublicKey: existingKeys?.keyAgreementPublicKey ?? encodeBase64(sodium, keyAgreementPublicKey),
        keyAgreementPrivateKey: existingKeys?.keyAgreementPrivateKey ?? encodeBase64(sodium, deviceBox!.privateKey),
        signingPublicKey: existingKeys?.signingPublicKey ?? encodeBase64(sodium, signingPublicKey),
        signingPrivateKey: fallbackDeviceSign
            ? encodeBase64(sodium, fallbackDeviceSign.privateKey)
            : existingKeys?.signingPrivateKey ?? encodeBase64(sodium, deviceSign!.privateKey),
        createdAt: existingKeys?.createdAt ?? new Date().toISOString(),
    };

    await saveLocalTrustedDeviceKeys(userId, localKeys);

    const payload: RegisterTrustedDevicePayload = {
        clientDeviceId,
        displayName: deviceInfo?.deviceName,
        deviceType: deviceInfo?.deviceType,
        browser: deviceInfo?.browser,
        os: deviceInfo?.os,
        identityPublicKey: encodeBase64(sodium, identityPublicKey),
        identityPublicKeyFingerprint: fingerprintBytes(sodium, identityPublicKey),
        identitySigningPublicKey: encodeBase64(sodium, identitySigningPublicKey),
        identitySigningPublicKeyFingerprint: fingerprintBytes(sodium, identitySigningPublicKey),
        keyAgreementPublicKey: encodeBase64(sodium, keyAgreementPublicKey),
        keyAgreementPublicKeyFingerprint: fingerprintBytes(sodium, keyAgreementPublicKey),
        signingPublicKey: encodeBase64(sodium, signingPublicKey),
        signingPublicKeyFingerprint: fingerprintBytes(sodium, signingPublicKey),
        algorithm: ALGORITHM,
        requestApprovalNotification: options.requestApprovalNotification,
    };

    return api.e2ee.registerCurrentDevice(payload, token);
}
