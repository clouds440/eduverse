import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceUtils';
import type { TrustedEncryptionDevice, TrustedDevicesResponse } from '@/types';
import { getLocalTrustedDeviceKeys, getUserIdFromToken } from './localDeviceKeys';
import { registerCurrentTrustedDevice } from './trustedDeviceRegistration';

export type CurrentDeviceTrustState = {
    clientDeviceId: string | null;
    data: TrustedDevicesResponse;
    currentDevice?: TrustedEncryptionDevice;
    trustedDevices: TrustedEncryptionDevice[];
    pendingDevices: TrustedEncryptionDevice[];
};

export async function getCurrentDeviceTrustState(token: string): Promise<CurrentDeviceTrustState> {
    const clientDeviceId = getDeviceId();
    const data = await api.e2ee.getMyDevices(token);
    const devices = data.devices || [];

    return {
        clientDeviceId,
        data,
        currentDevice: clientDeviceId
            ? devices.find((device) => device.clientDeviceId === clientDeviceId && !device.revokedAt)
            : undefined,
        trustedDevices: devices.filter((device) => (
            device.trustStatus === 'TRUSTED' &&
            !device.revokedAt &&
            Boolean(device.trustedAt)
        )),
        pendingDevices: devices.filter((device) => device.trustStatus === 'PENDING' && !device.revokedAt),
    };
}

export async function requestCurrentDeviceTrust(
    token: string,
    options: { sendApprovalNotification?: boolean } = {},
) {
    const state = await getCurrentDeviceTrustState(token);
    if (!state.clientDeviceId) throw new Error('Unable to identify this browser device.');

    if (state.currentDevice?.trustStatus === 'TRUSTED') {
        const tokenUserId = getUserIdFromToken(token);
        const localKeys = await getLocalTrustedDeviceKeys(tokenUserId, state.clientDeviceId);
        if (localKeys) {
            return { device: state.currentDevice, status: 'TRUSTED' as const };
        }

        const response = await registerCurrentTrustedDevice(token, {
            requestApprovalNotification: options.sendApprovalNotification === true,
        });
        return { device: response.device, status: response.device.trustStatus };
    }

    if (state.trustedDevices.length === 0) {
        const response = await registerCurrentTrustedDevice(token, { requestApprovalNotification: false });
        return { device: response.device, status: response.device.trustStatus };
    }

    if (state.currentDevice?.trustStatus === 'PENDING') {
        if (options.sendApprovalNotification !== false) {
            await api.e2ee.requestDeviceApproval(state.currentDevice.id, token);
        }
        return { device: state.currentDevice, status: 'PENDING' as const };
    }

    const response = await registerCurrentTrustedDevice(token, {
        requestApprovalNotification: options.sendApprovalNotification !== false,
    });
    return { device: response.device, status: response.device.trustStatus };
}

export function trustedDeviceSetupErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Unable to identify this browser device')) {
        return message;
    }
    if (message.includes('could not copy all existing secure Chat history')) {
        return 'This browser could not copy all existing secure Chat history. Refresh and try again.';
    }
    if (message.includes('Use a trusted browser') || message.includes('browser you already trust')) {
        return 'Use a browser you already trust to manage secure Chat and Mail.';
    }
    if (message.includes('Keep at least one trusted browser')) {
        return 'Keep at least one trusted browser on your account.';
    }

    return 'This browser could not be prepared for secure Chat and Mail. Please refresh and try again.';
}
