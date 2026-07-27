import type {
    ChatDeviceHistoryGrantPayload,
    PendingDeviceApprovalContext,
} from '@/types';
import { E2EEError } from './errors';
import { getLocalTrustedDeviceKeys } from './localDeviceKeys';
import {
    generateChatHistoryKey,
    wrapChatHistoryKeyForDevice,
    wrapContentKeyWithChatHistoryKey,
} from './chatHistoryKeys';
import { unwrapChatMessageContentKeyForDevice } from './chatMessageCrypto';

export async function prepareRecentHistoryGrantBatch(
    context: PendingDeviceApprovalContext,
): Promise<ChatDeviceHistoryGrantPayload[]> {
    const localKeys = await getLocalTrustedDeviceKeys(
        context.approverDevice.userId,
        context.approverDevice.clientDeviceId,
    );
    if (!localKeys) {
        throw new E2EEError(
            'NO_TRUSTED_DEVICE',
            'Approval must be completed from a browser that can still open secure Chat.',
        );
    }

    const grants: ChatDeviceHistoryGrantPayload[] = [];
    for (const chat of context.chats) {
        const grantKey = await generateChatHistoryKey();
        const wrappedGrant = await wrapChatHistoryKeyForDevice({
            historyKey: grantKey,
            recipientPublicKey: context.pendingDevice.keyAgreementPublicKey,
            senderPrivateKey: localKeys.keyAgreementPrivateKey,
            deviceKeyVersion: context.pendingDevice.keyVersion,
            associatedData: {
                scope: 'RECENT_CHAT_HISTORY_GRANT',
                chatId: chat.chatId,
                pendingDeviceId: context.pendingDevice.id,
                approverDeviceId: context.approverDevice.id,
                messageLimit: context.messageLimit,
            },
        });
        const contentEnvelopes = await Promise.all(
            chat.messages.map(async (message) => {
                if (!message.encryptedContent.id) {
                    throw new E2EEError(
                        'NO_KEY_ENVELOPE',
                        'A recent Chat message is missing its secure content identifier.',
                    );
                }
                const contentKey = await unwrapChatMessageContentKeyForDevice(
                    message,
                    context.approverDevice,
                    localKeys.keyAgreementPrivateKey,
                );
                const wrappedContentKey = await wrapContentKeyWithChatHistoryKey({
                    contentKey,
                    historyKey: grantKey,
                    associatedData: {
                        scope: 'RECENT_CHAT_CONTENT_KEY',
                        chatId: chat.chatId,
                        messageId: message.id,
                        pendingDeviceId: context.pendingDevice.id,
                    },
                });
                return {
                    messageId: message.id,
                    encryptedContentId: message.encryptedContent.id!,
                    algorithm: wrappedContentKey.algorithm,
                    wrappedKey: wrappedContentKey.wrappedKey,
                    nonce: wrappedContentKey.nonce,
                    associatedData: wrappedContentKey.associatedData as
                        | Record<string, unknown>
                        | undefined,
                };
            }),
        );

        grants.push({
            chatId: chat.chatId,
            deviceKeyVersion: context.pendingDevice.keyVersion,
            algorithm: wrappedGrant.algorithm,
            wrappedKey: wrappedGrant.wrappedKey,
            nonce: wrappedGrant.nonce,
            associatedData: wrappedGrant.associatedData as
                | Record<string, unknown>
                | undefined,
            contentEnvelopes,
        });
    }

    return grants;
}

export async function provisionRecentChatHistory(options: {
    loadContext: (cursor?: string) => Promise<PendingDeviceApprovalContext>;
    saveBatch: (
        chatGrants: ChatDeviceHistoryGrantPayload[],
        complete: boolean,
    ) => Promise<unknown>;
}) {
    let cursor: string | undefined;
    do {
        const context = await options.loadContext(cursor);
        const chatGrants = await prepareRecentHistoryGrantBatch(context);
        const complete = !context.nextCursor;
        await options.saveBatch(chatGrants, complete);
        cursor = context.nextCursor || undefined;
    } while (cursor);
}
