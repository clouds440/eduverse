'use client';

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Mail, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
    getCurrentDeviceTrustState,
    requestCurrentDeviceTrust,
    trustedDeviceSetupErrorMessage,
} from '@/lib/e2ee';
import { api } from '@/lib/api';
import type { TwoFactorChallenge, TwoFactorLoginMethod } from '@/types';
import { Input } from '@/components/ui/Input';
import { useSocket } from '@/hooks/useSocket';

type PromptState =
    | { open: false }
    | { open: true; mode: 'UNREGISTERED' | 'PENDING'; storageKey: string };

function promptStorageKey(userId: string, clientDeviceId: string | null) {
    return `e2ee-device-login-prompt:${userId}:${clientDeviceId || 'unknown'}`;
}

function EncryptionTrustPrompt() {
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

export function TrustedDevicePrompt(props:
    | { flow?: 'encryption' }
    | {
        flow: 'two-factor';
        temporaryToken: string;
        onComplete: (accessToken: string) => Promise<void>;
        onCancel: () => void;
    }
) {
    if (props.flow === 'two-factor') {
        return <TwoFactorPrompt {...props} />;
    }
    return <EncryptionTrustPrompt />;
}

function TwoFactorPrompt({
    temporaryToken,
    onComplete,
    onCancel,
}: {
    temporaryToken: string;
    onComplete: (accessToken: string) => Promise<void>;
    onCancel: () => void;
}) {
    const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const completingRef = useRef(false);
    const { subscribe } = useSocket({ token: temporaryToken, enabled: true });

    const finish = async () => {
        if (completingRef.current) return;
        completingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const result = await api.auth.completeTwoFactorLogin(temporaryToken);
            if (!result.access_token) throw new Error('Unable to finish signing in.');
            await onComplete(result.access_token);
        } catch (err) {
            completingRef.current = false;
            setError(err instanceof Error ? err.message : 'Unable to finish signing in.');
            setBusy(false);
        }
    };

    useEffect(() => {
        api.auth.getTwoFactorChallenge(temporaryToken)
            .then((next) => {
                setChallenge(next);
                if (next.status === 'verified') void finish();
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'This sign-in request expired.'));
        // The token identifies one immutable pending login.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [temporaryToken]);

    useEffect(() => subscribe('two-factor:verified', () => void finish()), [subscribe]);

    const choose = async (method: TwoFactorLoginMethod) => {
        setBusy(true);
        setError(null);
        try {
            const next = await api.auth.selectTwoFactorMethod(temporaryToken, method);
            setChallenge(next);
            if (next.status === 'verified') await finish();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to start verification.');
        } finally {
            setBusy(false);
        }
    };

    const verifyEmail = async () => {
        setBusy(true);
        setError(null);
        try {
            await api.auth.verifyTwoFactorEmail(temporaryToken, code);
            await finish();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to verify this code.');
            setBusy(false);
        }
    };

    const methods = challenge?.methods || [];
    const selected = challenge?.selectedMethod;

    return (
        <div className="relative z-20 flex min-h-screen w-full items-center justify-center bg-background p-4">
            <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 shadow-2xl sm:p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-black text-foreground">One more step</h1>
                <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                    Confirm it is you before opening your account.
                </p>

                {!challenge ? (
                    <p className="mt-6 text-sm font-semibold text-muted-foreground">Preparing verification…</p>
                ) : !selected && methods.length > 1 ? (
                    <div className="mt-6 space-y-3">
                        <p className="text-sm font-bold text-foreground">How would you like to continue?</p>
                        {methods.includes('email') && (
                            <Button className="w-full justify-start" variant="secondary" icon={Mail} disabled={busy} onClick={() => void choose('email')}>
                                Send a code by email
                            </Button>
                        )}
                        {methods.includes('device') && (
                            <Button className="w-full justify-start" variant="secondary" icon={MonitorSmartphone} disabled={busy} onClick={() => void choose('device')}>
                                Approve from a trusted browser
                            </Button>
                        )}
                    </div>
                ) : !selected && methods.length === 1 ? (
                    <div className="mt-6">
                        <Button className="w-full" disabled={busy} onClick={() => void choose(methods[0])}>
                            Continue
                        </Button>
                    </div>
                ) : selected === 'email' ? (
                    <div className="mt-6 space-y-4">
                        <p className="text-sm font-medium leading-6 text-muted-foreground">
                            We sent a six-digit code to your verified contact email. Enter it below.
                        </p>
                        <Input
                            aria-label="Sign-in verification code"
                            inputMode="numeric"
                            maxLength={6}
                            value={code}
                            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                            placeholder="6-digit code"
                        />
                        <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => void verifyEmail()}>
                            Verify and sign in
                        </Button>
                        <Button
                            className="w-full"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => api.auth.resendTwoFactorEmail(temporaryToken).catch((err) => setError(err instanceof Error ? err.message : 'Unable to resend code.'))}
                        >
                            Send another code
                        </Button>
                    </div>
                ) : (
                    <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <p className="text-sm font-black text-foreground">Check a browser you already trust</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                            Open the approval notification there and choose “Approve sign-in.” This screen will continue automatically.
                        </p>
                    </div>
                )}

                {error && <p className="mt-4 text-sm font-bold text-danger">{error}</p>}
                <Button className="mt-6 w-full" variant="secondary" onClick={onCancel}>
                    Not now — sign out
                </Button>
            </div>
        </div>
    );
}
