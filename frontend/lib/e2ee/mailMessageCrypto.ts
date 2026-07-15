import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceUtils';
import type {
    CreateMailPayload,
    EncryptedMailContent,
    MailE2EEContextRequest,
    MailItem,
    MailMessage,
    RecipientEncryptionDevicesResponse,
    TrustedEncryptionDevice,
} from '@/types';
import {
    E2EE_CONTENT_ALGORITHM,
    E2EE_CONTENT_KEY_VERSION,
    E2EE_ENCRYPTION_VERSION,
    decryptStringContent,
    encryptStringContent,
} from './contentCrypto';
import { E2EEError } from './errors';
import { unwrapContentKeyFromDeviceEnvelope, wrapContentKeyForDevice } from './keyEnvelopeCrypto';
import { getLocalTrustedDeviceKeys, getUserIdFromToken } from './localDeviceKeys';
import {
    assertRecipientDeviceCoverage,
    findCurrentTrustedDevice,
    flattenTrustedRecipientDevices,
} from './recipientDevices';
import type { JsonValue } from './sodium';

const ENCRYPTED_MAIL_SUBJECT_PLACEHOLDER = 'Encrypted mail';
const ENCRYPTED_MAIL_MESSAGE_PLACEHOLDER = '[Encrypted mail message]';

async function getMailEncryptionState(
    recipientDevices: RecipientEncryptionDevicesResponse[],
    currentUserId: string,
) {
    assertRecipientDeviceCoverage(
        recipientDevices,
        recipientDevices.map((recipient) => recipient.userId),
        'Mail',
    );

    const clientDeviceId = getDeviceId();
    if (!clientDeviceId) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is not ready for secure Mail.');
    }

    const localKeys = await getLocalTrustedDeviceKeys(currentUserId, clientDeviceId);
    if (!localKeys) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'Trust this browser before sending secure Mail.');
    }

    const senderDevice = findCurrentTrustedDevice(recipientDevices, currentUserId, clientDeviceId);
    if (!senderDevice) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is still waiting for approval.');
    }

    const deviceRecipients = flattenTrustedRecipientDevices(recipientDevices);

    if (deviceRecipients.length === 0) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'No approved browsers are available for this Mail thread.');
    }

    return { localKeys, senderDevice, deviceRecipients };
}

async function encryptMailContent(options: {
    plaintext: string;
    scope: 'MAIL_SUBJECT' | 'MAIL_MESSAGE';
    purpose: 'CREATE' | 'REPLY';
    currentUserId: string;
    senderDevice: TrustedEncryptionDevice;
    senderPrivateKey: string;
    deviceRecipients: Array<{ userId: string; device: TrustedEncryptionDevice }>;
    mailId?: string;
}) {
    const associatedData = {
        scope: options.scope,
        purpose: options.purpose,
        mailId: options.mailId || null,
        senderId: options.currentUserId,
        encryptionVersion: E2EE_ENCRYPTION_VERSION,
    };

    const encrypted = await encryptStringContent(options.plaintext, { associatedData });
    const keyEnvelopes = await Promise.all(options.deviceRecipients.map(async ({ userId, device }) => {
        const envelope = await wrapContentKeyForDevice({
            contentKey: encrypted.contentKey,
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

    return {
        encryptionVersion: E2EE_ENCRYPTION_VERSION,
        algorithm: E2EE_CONTENT_ALGORITHM,
        ciphertext: encrypted.payload.ciphertext,
        nonce: encrypted.payload.nonce,
        authTag: encrypted.payload.authTag,
        associatedData: encrypted.payload.associatedData as Record<string, unknown>,
        contentKeyVersion: E2EE_CONTENT_KEY_VERSION,
        keyEnvelopes,
    } satisfies EncryptedMailContent;
}

export async function prepareEncryptedMailPayload(options: {
    payload: CreateMailPayload;
    context: MailE2EEContextRequest;
    token: string;
    currentUserId: string;
    recipientDevices?: RecipientEncryptionDevicesResponse[];
}) {
    const recipientDevices = options.recipientDevices || await api.mail.getComposeE2EEContext(options.context, options.token);
    const state = await getMailEncryptionState(recipientDevices, options.currentUserId);
    const [encryptedSubject, encryptedMessage] = await Promise.all([
        encryptMailContent({
            plaintext: options.payload.subject,
            scope: 'MAIL_SUBJECT',
            purpose: 'CREATE',
            currentUserId: options.currentUserId,
            senderDevice: state.senderDevice,
            senderPrivateKey: state.localKeys.keyAgreementPrivateKey,
            deviceRecipients: state.deviceRecipients,
        }),
        encryptMailContent({
            plaintext: options.payload.message,
            scope: 'MAIL_MESSAGE',
            purpose: 'CREATE',
            currentUserId: options.currentUserId,
            senderDevice: state.senderDevice,
            senderPrivateKey: state.localKeys.keyAgreementPrivateKey,
            deviceRecipients: state.deviceRecipients,
        }),
    ]);

    return {
        ...options.payload,
        subject: ENCRYPTED_MAIL_SUBJECT_PLACEHOLDER,
        message: ENCRYPTED_MAIL_MESSAGE_PLACEHOLDER,
        encryptedSubject,
        encryptedMessage,
    } satisfies CreateMailPayload;
}

export async function prepareEncryptedMailReplyPayload(options: {
    mailId: string;
    plaintext: string;
    token: string;
    currentUserId: string;
    recipientDevices?: RecipientEncryptionDevicesResponse[];
}) {
    const recipientDevices = options.recipientDevices || await api.mail.getE2EEContext(options.mailId, options.token);
    const state = await getMailEncryptionState(recipientDevices, options.currentUserId);
    const encryptedContent = await encryptMailContent({
        plaintext: options.plaintext,
        scope: 'MAIL_MESSAGE',
        purpose: 'REPLY',
        mailId: options.mailId,
        currentUserId: options.currentUserId,
        senderDevice: state.senderDevice,
        senderPrivateKey: state.localKeys.keyAgreementPrivateKey,
        deviceRecipients: state.deviceRecipients,
    });

    return {
        content: ENCRYPTED_MAIL_MESSAGE_PLACEHOLDER,
        encryptedContent,
    };
}

export function isEncryptedMailContent(value?: { encryptedContent?: EncryptedMailContent | null; subjectEncryptedContent?: EncryptedMailContent | null } | null) {
    return Boolean(value?.encryptedContent?.ciphertext || value?.subjectEncryptedContent?.ciphertext);
}

export async function decryptMailContent(
    encryptedContent: EncryptedMailContent | null | undefined,
    fallback: string,
    token: string,
) {
    if (!encryptedContent?.ciphertext) return fallback;

    const clientDeviceId = getDeviceId();
    if (!clientDeviceId) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is not ready for secure Mail.');
    }
    const tokenUserId = getUserIdFromToken(token);

    const [localKeys, devices] = await Promise.all([
        getLocalTrustedDeviceKeys(tokenUserId, clientDeviceId),
        api.e2ee.getMyDevices(token),
    ]);
    const currentDevice = devices.devices.find((device) => (
        device.clientDeviceId === clientDeviceId &&
        device.trustStatus === 'TRUSTED' &&
        !device.revokedAt &&
        device.trustedAt
    ));
    if (!localKeys || !currentDevice) {
        throw new E2EEError('NO_TRUSTED_DEVICE', 'This browser is not approved for secure Mail.');
    }

    const envelope = encryptedContent.keyEnvelopes?.find((candidate) => (
        candidate.trustedDeviceId === currentDevice.id ||
        candidate.trustedDevice?.clientDeviceId === clientDeviceId
    ));
    const senderPublicKey = envelope?.senderDevice?.keyAgreementPublicKey;
    if (!envelope || !senderPublicKey) {
        throw new E2EEError('NO_KEY_ENVELOPE', "This Mail content can't be opened here.");
    }

    const contentKey = await unwrapContentKeyFromDeviceEnvelope({
        envelope: {
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce || '',
            associatedData: (envelope.associatedData || undefined) as JsonValue | undefined,
            deviceKeyVersion: envelope.deviceKeyVersion,
        },
        senderPublicKey,
        recipientPrivateKey: localKeys.keyAgreementPrivateKey,
    });

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

export function getMailMessageEncryptedContent(message: MailMessage) {
    return message.encryptedContent;
}

export function getMailSubjectEncryptedContent(mail: MailItem) {
    return mail.subjectEncryptedContent || mail.encryptedContent || null;
}
