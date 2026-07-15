import type {
    ChatHistoryKeyDeviceEnvelope,
    PendingDeviceApprovalContext,
} from '@/types';
import { E2EEError } from './errors';
import { getLocalTrustedDeviceKeys } from './localDeviceKeys';
import type { JsonValue } from './sodium';
import {
    unwrapChatHistoryKeyFromDeviceEnvelope,
    wrapChatHistoryKeyForDevice,
} from './chatHistoryKeys';

export async function prepareHistoryKeyTransferForApproval(
    context: PendingDeviceApprovalContext,
): Promise<ChatHistoryKeyDeviceEnvelope[]> {
    const localKeys = await getLocalTrustedDeviceKeys(context.approverDevice.userId, context.approverDevice.clientDeviceId);
    if (!localKeys) {
        throw new E2EEError(
            'NO_TRUSTED_DEVICE',
            'Approval must be completed from a browser that can still open secure Chat and Mail.',
        );
    }

    const transfers: ChatHistoryKeyDeviceEnvelope[] = [];

    for (const historyKey of context.historyKeys) {
        const approverEnvelope = historyKey.deviceEnvelopes?.find((envelope) => (
            envelope.trustedDeviceId === context.approverDevice.id &&
            envelope.recipientUserId === context.approverDevice.userId &&
            envelope.senderDevice?.keyAgreementPublicKey
        ));

        if (!approverEnvelope?.senderDevice?.keyAgreementPublicKey) {
            throw new E2EEError(
                'NO_KEY_ENVELOPE',
                'This browser could not copy all existing secure Chat history. Refresh and try again.',
            );
        }

        const plaintextHistoryKey = await unwrapChatHistoryKeyFromDeviceEnvelope({
            envelope: {
                algorithm: approverEnvelope.algorithm,
                wrappedKey: approverEnvelope.wrappedKey,
                nonce: approverEnvelope.nonce || '',
                associatedData: approverEnvelope.associatedData as JsonValue | undefined,
                deviceKeyVersion: approverEnvelope.deviceKeyVersion,
            },
            recipientPrivateKey: localKeys.keyAgreementPrivateKey,
            senderPublicKey: approverEnvelope.senderDevice.keyAgreementPublicKey,
        });

        const envelope = await wrapChatHistoryKeyForDevice({
            historyKey: plaintextHistoryKey,
            recipientPublicKey: context.pendingDevice.keyAgreementPublicKey,
            senderPrivateKey: localKeys.keyAgreementPrivateKey,
            deviceKeyVersion: context.pendingDevice.keyVersion,
            associatedData: {
                scope: 'CHAT_HISTORY_KEY_TRANSFER',
                historyKeyId: historyKey.id,
                pendingDeviceId: context.pendingDevice.id,
                approverDeviceId: context.approverDevice.id,
            },
        });

        transfers.push({
            historyKeyId: historyKey.id,
            recipientUserId: context.pendingDevice.userId,
            trustedDeviceId: context.pendingDevice.id,
            senderDeviceId: context.approverDevice.id,
            deviceKeyVersion: context.pendingDevice.keyVersion,
            algorithm: envelope.algorithm,
            wrappedKey: envelope.wrappedKey,
            nonce: envelope.nonce,
            associatedData: envelope.associatedData as Record<string, unknown> | undefined,
        });
    }

    if (transfers.length !== context.historyKeys.length) {
        throw new E2EEError(
            'NO_KEY_ENVELOPE',
            'This browser could not copy all existing secure Chat history. Refresh and try again.',
        );
    }

    return transfers;
}
