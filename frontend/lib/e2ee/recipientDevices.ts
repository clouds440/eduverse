import type { RecipientEncryptionDevicesResponse, TrustedEncryptionDevice } from '@/types';
import { E2EEError } from './errors';

export function getTrustedRecipientDevices(response: RecipientEncryptionDevicesResponse) {
    return response.devices.filter((device) => (
        device.trustStatus === 'TRUSTED' &&
        !device.revokedAt &&
        Boolean(device.trustedAt)
    ));
}

export function flattenTrustedRecipientDevices(recipientDevices: RecipientEncryptionDevicesResponse[]) {
    return recipientDevices.flatMap((recipient) => (
        getTrustedRecipientDevices(recipient).map((device) => ({
            userId: recipient.userId,
            device,
        }))
    ));
}

export function findCurrentTrustedDevice(
    recipientDevices: RecipientEncryptionDevicesResponse[],
    currentUserId: string,
    clientDeviceId: string,
): TrustedEncryptionDevice | undefined {
    const currentUserDevices = recipientDevices.find((recipient) => recipient.userId === currentUserId);
    return getTrustedRecipientDevices(currentUserDevices || { userId: currentUserId, identity: null, devices: [] })
        .find((device) => device.clientDeviceId === clientDeviceId);
}

export function getUserIdsWithoutTrustedRecipientDevices(
    recipientDevices: RecipientEncryptionDevicesResponse[],
    requiredUserIds: string[],
) {
    const recipientByUserId = new Map(recipientDevices.map((recipient) => [recipient.userId, recipient]));

    return Array.from(new Set(requiredUserIds))
        .filter((userId) => getTrustedRecipientDevices(
            recipientByUserId.get(userId) || { userId, identity: null, devices: [] },
        ).length === 0);
}

export function assertRecipientDeviceCoverage(
    recipientDevices: RecipientEncryptionDevicesResponse[],
    requiredUserIds: string[],
    label: string,
) {
    const missingUserIds = getUserIdsWithoutTrustedRecipientDevices(recipientDevices, requiredUserIds);

    if (missingUserIds.length > 0) {
        throw new E2EEError(
            'RECIPIENT_NO_TRUSTED_DEVICE',
            `${label} cannot be sent because ${missingUserIds.length === 1 ? 'one recipient has' : 'some recipients have'} not approved a browser yet.`,
        );
    }
}
