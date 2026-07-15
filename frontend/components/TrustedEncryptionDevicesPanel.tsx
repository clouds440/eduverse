'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    CheckCircle2,
    Globe,
    KeyRound,
    Laptop,
    LogOut,
    MapPin,
    Monitor,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceUtils';
import {
    prepareHistoryKeyTransferForApproval,
    requestCurrentDeviceTrust,
    trustedDeviceSetupErrorMessage,
} from '@/lib/e2ee';
import type { TrustedEncryptionDevice, TrustedDevicesResponse } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface AccountSession {
    id: string;
    deviceId: string;
    deviceName: string;
    os: string;
    lastSeenAt: string;
    ip?: string | null;
    location?: string | null;
    isCurrent?: boolean;
}

export function TrustedEncryptionDevicesPanel() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [data, setData] = useState<TrustedDevicesResponse | null>(null);
    const [sessions, setSessions] = useState<AccountSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [currentClientDeviceId, setCurrentClientDeviceId] = useState<string | null>(null);
    const [trustedDeviceToApprove, setTrustedDeviceToApprove] = useState<TrustedEncryptionDevice | null>(null);
    const [trustedDeviceToRemove, setTrustedDeviceToRemove] = useState<TrustedEncryptionDevice | null>(null);
    const [showRevokeAllSessionsDialog, setShowRevokeAllSessionsDialog] = useState(false);
    const promptedApprovalIdRef = useRef<string | null>(null);

    const fetchSecurityDevices = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const [deviceData, sessionData] = await Promise.all([
                api.e2ee.getMyDevices(token),
                api.auth.getSessions(token),
            ]);
            setData(deviceData);
            setSessions(sessionData);
        } catch (error) {
            console.error('Failed to fetch account devices', error);
            setError(error as Error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        setCurrentClientDeviceId(getDeviceId());
        void fetchSecurityDevices();
    }, [fetchSecurityDevices]);

    const clearApprovalDeepLink = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (!params.has('approveDeviceId')) return;
        params.delete('approveDeviceId');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    const handleSetupCurrentDevice = async () => {
        if (!token) return;
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'e2ee-device-register' });
            const response = await requestCurrentDeviceTrust(token, { sendApprovalNotification: true });
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: response.status === 'PENDING'
                        ? 'Approval request sent to your trusted browsers'
                        : 'This browser is ready for secure Chat and Mail',
                    type: 'success',
                },
            });
            await fetchSecurityDevices();
        } catch (error) {
            console.error('Failed to prepare secure messages on this browser', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: trustedDeviceSetupErrorMessage(error), type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'e2ee-device-register' });
        }
    };

    const handleRevoke = async (device: TrustedEncryptionDevice) => {
        if (!token) return;
        if (!currentDeviceIsTrusted) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Use a browser you already trust to manage trusted browsers.', type: 'error' } });
            setTrustedDeviceToRemove(null);
            return;
        }

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `e2ee-device-revoke-${device.id}` });
            await api.e2ee.revokeDevice(device.id, token);
            setTrustedDeviceToRemove(null);
            await fetchSecurityDevices();
        } catch (error) {
            console.error('Failed to remove trusted browser', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to remove trusted browser', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `e2ee-device-revoke-${device.id}` });
        }
    };

    const handleApprove = async (device: TrustedEncryptionDevice) => {
        if (!token) return;
        const approverDevice = data?.devices.find((candidate) => (
            candidate.clientDeviceId === currentClientDeviceId &&
            candidate.trustStatus === 'TRUSTED' &&
            !candidate.revokedAt
        ));

        if (!approverDevice) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Use a browser you already trust to approve this one.', type: 'error' } });
            return;
        }

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `e2ee-device-approve-${device.id}` });
            const approvalContext = await api.e2ee.getDeviceApprovalContext(device.id, approverDevice.id, token);
            const historyKeyEnvelopes = await prepareHistoryKeyTransferForApproval(approvalContext);
            await api.e2ee.approveDevice(device.id, { approverDeviceId: approverDevice.id, historyKeyEnvelopes }, token);
            await fetchSecurityDevices();
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: 'Browser trusted for secure Chat and Mail.',
                    type: 'success',
                },
            });
        } catch (error) {
            console.error('Failed to approve trusted browser', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: trustedDeviceSetupErrorMessage(error), type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `e2ee-device-approve-${device.id}` });
        }
    };

    const handleRevokeSession = async (session: AccountSession) => {
        if (!token) return;
        if (!currentDeviceIsTrusted) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Use a trusted browser to revoke sessions.', type: 'error' } });
            return;
        }

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `revoke-session-${session.id}` });
            await api.auth.revokeSession(session.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Session revoked successfully', type: 'success' } });
            await fetchSecurityDevices();
        } catch (error) {
            console.error('Failed to revoke session', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to revoke session', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `revoke-session-${session.id}` });
        }
    };

    const handleConfirmRevokeAllSessions = async () => {
        if (!token) return;
        if (!currentDeviceIsTrusted) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Use a trusted browser to revoke sessions.', type: 'error' } });
            setShowRevokeAllSessionsDialog(false);
            return;
        }

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'revoke-all-sessions' });
            await api.auth.revokeAllSessions(token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'All other sessions revoked successfully', type: 'success' } });
            await fetchSecurityDevices();
        } catch (error) {
            console.error('Failed to revoke all sessions', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to revoke sessions', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'revoke-all-sessions' });
            setShowRevokeAllSessionsDialog(false);
        }
    };

    const getDeviceIcon = (os?: string | null) => {
        const osLower = (os || '').toLowerCase();
        if (osLower.includes('android') || osLower.includes('ios')) return <Smartphone className="h-5 w-5" />;
        if (osLower.includes('windows') || osLower.includes('mac') || osLower.includes('linux')) return <Laptop className="h-5 w-5" />;
        return <Monitor className="h-5 w-5" />;
    };

    const devices = data?.devices ?? [];
    const activeDevices = devices.filter((device) => device.trustStatus === 'TRUSTED' && !device.revokedAt);
    const currentDeviceIsTrusted = activeDevices.some((device) => device.clientDeviceId === currentClientDeviceId);
    const otherSessions = sessions.filter((session) => !session.isCurrent);
    const sessionByDeviceId = new Map(sessions.map((session) => [session.deviceId, session]));
    const rows = [
        ...sessions.map((session) => ({
            key: `session:${session.id}`,
            session,
            trustedDevice: devices.find((device) => device.clientDeviceId === session.deviceId && !device.revokedAt),
        })),
        ...devices
            .filter((device) => !device.revokedAt && !sessionByDeviceId.has(device.clientDeviceId))
            .map((device) => ({
                key: `trusted:${device.id}`,
                session: null,
                trustedDevice: device,
            })),
    ];

    useEffect(() => {
        const approveDeviceId = searchParams.get('approveDeviceId');
        if (!approveDeviceId || loading || promptedApprovalIdRef.current === approveDeviceId) return;

        const device = devices.find((candidate) => (
            candidate.id === approveDeviceId &&
            candidate.trustStatus === 'PENDING' &&
            !candidate.revokedAt
        ));
        if (!device) return;

        promptedApprovalIdRef.current = approveDeviceId;
        setTrustedDeviceToApprove(device);
    }, [devices, loading, searchParams]);

    const closeApproveDialog = useCallback(() => {
        setTrustedDeviceToApprove(null);
        clearApprovalDeepLink();
    }, [clearApprovalDeepLink]);

    return (
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
            <div className="border-b border-border/60 bg-background/45 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black text-foreground">Account Devices</h2>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">Manage signed-in browsers and which ones can open secure Chat and Mail.</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            onClick={fetchSecurityDevices}
                            variant="secondary"
                            icon={RefreshCw}
                            disabled={loading}
                            px="px-4"
                            py="py-2.5"
                            className="w-full text-xs sm:w-auto"
                        >
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {loading ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loading size="md" />
                    </div>
                ) : error ? (
                    <ErrorState error={error} onRetry={fetchSecurityDevices} />
                ) : rows.length === 0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/45 p-8 text-center">
                        <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm font-black text-foreground">No account devices found</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">No browser sessions are attached to this account.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-background/45">
                            {rows.map(({ key, session, trustedDevice }) => {
                                const isCurrent = session?.isCurrent || trustedDevice?.clientDeviceId === currentClientDeviceId;
                                const deviceName = session?.deviceName || trustedDevice?.displayName || (trustedDevice?.trustStatus === 'PENDING' ? 'Pending browser' : 'Browser device');
                                const os = session?.os || trustedDevice?.os || 'Unknown OS';
                                const browser = trustedDevice?.browser;
                                const isPending = trustedDevice?.trustStatus === 'PENDING';
                                const isTrusted = trustedDevice?.trustStatus === 'TRUSTED';
                                const isUntrusted = !isTrusted;

                                return (
                                    <div key={key} className={`p-4 transition-colors ${isCurrent ? 'bg-primary/5' : 'hover:bg-card/60'}`}>
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                                                    isCurrent
                                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                                        : 'border-border/70 bg-card text-muted-foreground'
                                                }`}>
                                                    {getDeviceIcon(os)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-black text-foreground sm:text-base">
                                                            {deviceName}
                                                        </p>
                                                        {isCurrent && <Badge variant="primary" size="sm" dot>This device</Badge>}
                                                        {isTrusted && <Badge variant="success" size="sm" dot>Trusted</Badge>}
                                                        {isUntrusted && <Badge variant="warning" size="sm" dot>Untrusted</Badge>}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                                                        <span>{browser ? `${browser} on ${os}` : os}</span>
                                                        {session?.lastSeenAt && (
                                                            <span>Last active {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}</span>
                                                        )}
                                                        {trustedDevice?.trustedAt && (
                                                            <span>Trusted {formatDistanceToNow(new Date(trustedDevice.trustedAt), { addSuffix: true })}</span>
                                                        )}
                                                        {trustedDevice?.approvalRequestedAt && (
                                                            <span>Requested {formatDistanceToNow(new Date(trustedDevice.approvalRequestedAt), { addSuffix: true })}</span>
                                                        )}
                                                        {(session?.ip || session?.location) && (
                                                            <span className="inline-flex items-center gap-1">
                                                                <MapPin className="h-3.5 w-3.5" />
                                                                {session.location || 'Unknown location'}{session.ip ? ` - ${session.ip}` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                {isPending && trustedDevice && (
                                                    <Button
                                                        onClick={() => setTrustedDeviceToApprove(trustedDevice)}
                                                        variant="primary"
                                                        icon={CheckCircle2}
                                                        loadingId={`e2ee-device-approve-${trustedDevice.id}`}
                                                        disabled={isCurrent || !currentDeviceIsTrusted}
                                                        px="px-4"
                                                        py="py-2.5"
                                                        className="w-full text-xs sm:w-auto"
                                                    >
                                                        Trust Browser
                                                    </Button>
                                                )}
                                                {isCurrent && !trustedDevice && (
                                                    <Button
                                                        onClick={handleSetupCurrentDevice}
                                                        variant="primary"
                                                        icon={ShieldCheck}
                                                        loadingId="e2ee-device-register"
                                                        px="px-4"
                                                        py="py-2.5"
                                                        className="w-full text-xs sm:w-auto"
                                                    >
                                                        Trust Browser
                                                    </Button>
                                                )}
                                                {session && !session.isCurrent && (
                                                    <Button
                                                        onClick={() => handleRevokeSession(session)}
                                                        variant="danger"
                                                        icon={LogOut}
                                                        loadingId={`revoke-session-${session.id}`}
                                                        disabled={!currentDeviceIsTrusted}
                                                        px="px-4"
                                                        py="py-2.5"
                                                        className="w-full text-xs sm:w-auto"
                                                    >
                                                        Revoke
                                                    </Button>
                                                )}
                                                {trustedDevice && (
                                                    <Button
                                                        onClick={() => setTrustedDeviceToRemove(trustedDevice)}
                                                        variant="danger"
                                                        icon={Trash2}
                                                        loadingId={`e2ee-device-revoke-${trustedDevice.id}`}
                                                        disabled={!currentDeviceIsTrusted}
                                                        px="px-4"
                                                        py="py-2.5"
                                                        className="w-full text-xs sm:w-auto"
                                                    >
                                                        {isTrusted ? 'Remove Trust' : 'Remove Request'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm font-semibold text-muted-foreground">
                                {otherSessions.length} other session{otherSessions.length !== 1 ? 's' : ''} active
                            </div>
                            <Button
                                onClick={() => setShowRevokeAllSessionsDialog(true)}
                                variant="danger"
                                icon={LogOut}
                                loadingId="revoke-all-sessions"
                                disabled={otherSessions.length === 0 || !currentDeviceIsTrusted}
                                px="px-4"
                                py="py-2.5"
                                className="w-full text-xs sm:w-auto"
                            >
                                Revoke All Other Sessions
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={Boolean(trustedDeviceToApprove)}
                onClose={closeApproveDialog}
                onConfirm={() => trustedDeviceToApprove && handleApprove(trustedDeviceToApprove)}
                title="Trust this browser?"
                description="Only continue if you recognize this sign-in. Once trusted, this browser can open your secure Chat and Mail."
                confirmText="Trust Browser"
                loadingId={trustedDeviceToApprove ? `e2ee-device-approve-${trustedDeviceToApprove.id}` : undefined}
            />

            <ConfirmDialog
                isOpen={Boolean(trustedDeviceToRemove)}
                onClose={() => setTrustedDeviceToRemove(null)}
                onConfirm={() => trustedDeviceToRemove && handleRevoke(trustedDeviceToRemove)}
                title={trustedDeviceToRemove?.trustStatus === 'TRUSTED' ? 'Remove trusted device?' : 'Remove trust request?'}
                description={trustedDeviceToRemove?.trustStatus === 'TRUSTED'
                    ? 'This browser will no longer be able to open new secure Chat and Mail. It may stay signed in unless you also revoke its session.'
                    : 'This browser will no longer be waiting for approval. It may stay signed in unless you also revoke its session.'}
                confirmText={trustedDeviceToRemove?.trustStatus === 'TRUSTED' ? 'Remove Trust' : 'Remove Request'}
                isDestructive
                loadingId={trustedDeviceToRemove ? `e2ee-device-revoke-${trustedDeviceToRemove.id}` : undefined}
            />

            <ConfirmDialog
                isOpen={showRevokeAllSessionsDialog}
                onClose={() => setShowRevokeAllSessionsDialog(false)}
                onConfirm={handleConfirmRevokeAllSessions}
                title="Revoke all other sessions?"
                description="This signs your account out everywhere except this browser. Trusted browser access is managed separately."
                confirmText="Revoke All"
                isDestructive
                loadingId="revoke-all-sessions"
            />
        </section>
    );
}
