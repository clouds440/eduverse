'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
    getCurrentDeviceTrustState,
    requestCurrentDeviceTrust,
    trustedDeviceSetupErrorMessage,
} from '@/lib/e2ee';

type PromptState =
    | { open: false }
    | { open: true; mode: 'UNREGISTERED' | 'PENDING'; storageKey: string };

function promptStorageKey(userId: string, clientDeviceId: string | null) {
    return `e2ee-device-login-prompt:${userId}:${clientDeviceId || 'unknown'}`;
}

export function EncryptionDeviceLoginPrompt() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [prompt, setPrompt] = useState<PromptState>({ open: false });
    const checkedSessionRef = useRef<string | null>(null);

    useEffect(() => {
        if (!token || !user?.id) return;
        let cancelled = false;

        const run = async () => {
            try {
                const state = await getCurrentDeviceTrustState(token);
                const exactStorageKey = promptStorageKey(user.id, state.clientDeviceId);
                if (checkedSessionRef.current === exactStorageKey) return;
                checkedSessionRef.current = exactStorageKey;

                if (state.currentDevice?.trustStatus === 'TRUSTED') return;

                if (state.trustedDevices.length === 0) {
                    await requestCurrentDeviceTrust(token, { sendApprovalNotification: false });
                    return;
                }

                if (typeof window !== 'undefined' && window.sessionStorage.getItem(exactStorageKey) === 'dismissed') {
                    return;
                }

                if (!cancelled) {
                    setPrompt({
                        open: true,
                        mode: state.currentDevice?.trustStatus === 'PENDING' ? 'PENDING' : 'UNREGISTERED',
                        storageKey: exactStorageKey,
                    });
                }
            } catch (error) {
                console.error('Failed to check trusted browser state', error);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [dispatch, token, user?.id]);

    const closePrompt = () => {
        if (prompt.open && typeof window !== 'undefined') {
            window.sessionStorage.setItem(prompt.storageKey, 'dismissed');
        }
        setPrompt({ open: false });
    };

    const sendApprovalRequest = async () => {
        if (!token) return;
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'e2ee-login-device-approval' });
            const response = await requestCurrentDeviceTrust(token, { sendApprovalNotification: true });
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: response.status === 'PENDING'
                        ? 'Approval request sent to your trusted browsers.'
                        : 'This browser is ready for secure Chat and Mail.',
                    type: 'success',
                },
            });
            closePrompt();
        } catch (error) {
            console.error('Failed to request browser approval', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: trustedDeviceSetupErrorMessage(error), type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'e2ee-login-device-approval' });
        }
    };

    return (
        <Modal
            isOpen={prompt.open}
            onClose={closePrompt}
            title="Trust this browser?"
            subtitle="Secure Chat and Mail can only be opened from browsers you trust."
            maxWidth="max-w-md"
            mobileMode="dialog"
            closeOnBackdrop={false}
            footer={(
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={closePrompt} className="w-full sm:w-auto">
                        Not Now
                    </Button>
                    <Button
                        variant="primary"
                        icon={ShieldCheck}
                        loadingId="e2ee-login-device-approval"
                        loadingText="Sending..."
                        onClick={sendApprovalRequest}
                        className="w-full sm:w-auto"
                    >
                        Send Approval Request
                    </Button>
                </div>
            )}
        >
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                    <p className="text-sm font-black text-foreground">
                        {prompt.open && prompt.mode === 'PENDING'
                            ? 'This browser is waiting for approval.'
                            : 'This browser is not trusted yet.'}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                        Send an approval notification to a browser you already trust. Until this browser is approved, you can browse the app but cannot send secure Chat or Mail from here.
                    </p>
                </div>
            </div>
        </Modal>
    );
}
