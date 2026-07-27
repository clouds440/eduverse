'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceUtils';
import {
    provisionRecentChatHistory,
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
    const [pendingLoginToApprove, setPendingLoginToApprove] = useState<string | null>(null);
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
            await provisionRecentChatHistory({
                loadContext: (cursor) => api.e2ee.getDeviceApprovalContext(
                    device.id,
                    approverDevice.id,
                    token,
                    cursor,
                ),
                saveBatch: (chatGrants, complete) => api.e2ee.approveDevice(
                    device.id,
                    { approverDeviceId: approverDevice.id, chatGrants, complete },
                    token,
                ),
            });
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

    const devices = useMemo(() => data?.devices ?? [], [data?.devices]);
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
            (
                candidate.trustStatus === 'PENDING' ||
                candidate.historyProvisioningStatus === 'PENDING'
            ) &&
            !candidate.revokedAt
        ));
        if (!device) return;

        promptedApprovalIdRef.current = approveDeviceId;
        setTrustedDeviceToApprove(device);
    }, [devices, loading, searchParams]);

    useEffect(() => {
        const pendingLoginId = searchParams.get('approveLoginId');
        if (pendingLoginId) setPendingLoginToApprove(pendingLoginId);
    }, [searchParams]);

    const handleApproveLogin = async () => {
        if (!token || !pendingLoginToApprove || !currentClientDeviceId) return;
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'two-factor-device-approve' });
            await provisionRecentChatHistory({
                loadContext: (cursor) => api.auth.getTwoFactorDeviceApprovalContext(
                    pendingLoginToApprove,
                    currentClientDeviceId,
                    token,
                    cursor,
                ),
                saveBatch: (chatGrants, complete) => api.auth.approveTwoFactorDevice(
                    pendingLoginToApprove,
                    currentClientDeviceId,
                    token,
                    { chatGrants, complete },
                ),
            });
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Sign-in approved.', type: 'success' } });
            setPendingLoginToApprove(null);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('approveLoginId');
            router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to approve sign-in.', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'two-factor-device-approve' });
        }
    };

    const closeApproveDialog = useCallback(() => {
        setTrustedDeviceToApprove(null);
        clearApprovalDeepLink();
    }, [clearApprovalDeepLink]);

    return (
        <section className="overflow-hidden rounded-lg border border-border/70 bg-card/80 shadow-sm">
            <div className="border-b border-border/60 bg-background/45 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black text-foreground">Devices &amp; sessions</h2>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">See where you are signed in and which browsers you trust.</p>
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
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                                <p className="text-xl font-black text-foreground">{sessions.length}</p>
                                <p className="text-xs text-muted-foreground">Active sessions</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                                <p className="text-xl font-black text-foreground">{activeDevices.length}</p>
                                <p className="text-xs text-muted-foreground">Trusted browsers</p>
                            </div>
                            <div className="col-span-2 rounded-lg border border-border/70 bg-background/45 p-3 sm:col-span-1">
                                <p className="text-xl font-black text-foreground">{devices.filter((device) => device.trustStatus === 'PENDING' && !device.revokedAt).length}</p>
                                <p className="text-xs text-muted-foreground">Waiting for approval</p>
                            </div>
                        </div>
                        <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-background/45">
                            {rows.map(({ key, session, trustedDevice }) => {
                                const isCurrent = session?.isCurrent || trustedDevice?.clientDeviceId === currentClientDeviceId;
                                const deviceName = session?.deviceName || trustedDevice?.displayName || (trustedDevice?.trustStatus === 'PENDING' ? 'Pending browser' : 'Browser device');
                                const os = session?.os || trustedDevice?.os || 'Unknown OS';
                                const browser = trustedDevice?.browser;
                                const isPending = trustedDevice?.trustStatus === 'PENDING';
                                const isTrusted = trustedDevice?.trustStatus === 'TRUSTED';
                                const historyPending = trustedDevice?.historyProvisioningStatus === 'PENDING';
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
                                                        {historyPending && <Badge variant="warning" size="sm" dot>Recent history pending</Badge>}
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

                                            <div className="grid w-full gap-3 border-t border-border/60 pt-3 sm:grid-cols-2 lg:w-auto lg:min-w-72 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                                                <div className="space-y-1.5">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Signed-in session</p>
                                                    {session?.isCurrent ? (
                                                        <p className="py-2 text-xs font-semibold text-muted-foreground">You are using this session</p>
                                                    ) : session ? (
                                                        <Button
                                                            onClick={() => handleRevokeSession(session)}
                                                            variant="danger"
                                                            icon={LogOut}
                                                            loadingId={`revoke-session-${session.id}`}
                                                            disabled={!currentDeviceIsTrusted}
                                                            px="px-4"
                                                            py="py-2.5"
                                                            className="w-full text-xs"
                                                        >
                                                            Sign out
                                                        </Button>
                                                    ) : (
                                                        <p className="py-2 text-xs font-semibold text-muted-foreground">Not signed in</p>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Browser trust</p>
                                                    {historyPending && trustedDevice && isTrusted ? (
                                                        <div className="space-y-2">
                                                            <Button
                                                                onClick={() => setTrustedDeviceToApprove(trustedDevice)}
                                                                variant="primary"
                                                                icon={CheckCircle2}
                                                                loadingId={`e2ee-device-approve-${trustedDevice.id}`}
                                                                disabled={isCurrent || !currentDeviceIsTrusted}
                                                                px="px-4"
                                                                py="py-2.5"
                                                                className="w-full text-xs"
                                                            >
                                                                Share recent Chat history
                                                            </Button>
                                                            {isCurrent && (
                                                                <p className="text-xs font-semibold text-muted-foreground">
                                                                    Recent history will appear after another trusted browser shares it.
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : isPending && trustedDevice ? (
                                                        <div className="flex flex-col gap-2">
                                                            <Button
                                                                onClick={() => setTrustedDeviceToApprove(trustedDevice)}
                                                                variant="primary"
                                                                icon={CheckCircle2}
                                                                loadingId={`e2ee-device-approve-${trustedDevice.id}`}
                                                                disabled={isCurrent || !currentDeviceIsTrusted}
                                                                px="px-4"
                                                                py="py-2.5"
                                                                className="w-full text-xs"
                                                            >
                                                                Approve browser
                                                            </Button>
                                                            <Button
                                                                onClick={() => setTrustedDeviceToRemove(trustedDevice)}
                                                                variant="ghost"
                                                                loadingId={`e2ee-device-revoke-${trustedDevice.id}`}
                                                                disabled={!currentDeviceIsTrusted}
                                                                px="px-3"
                                                                py="py-2"
                                                                className="w-full text-xs text-muted-foreground"
                                                            >
                                                                Cancel request
                                                            </Button>
                                                        </div>
                                                    ) : isCurrent && !trustedDevice ? (
                                                        <Button
                                                            onClick={handleSetupCurrentDevice}
                                                            variant="primary"
                                                            icon={ShieldCheck}
                                                            loadingId="e2ee-device-register"
                                                            px="px-4"
                                                            py="py-2.5"
                                                            className="w-full text-xs"
                                                        >
                                                            Trust browser
                                                        </Button>
                                                    ) : trustedDevice ? (
                                                        <Button
                                                            onClick={() => setTrustedDeviceToRemove(trustedDevice)}
                                                            variant="secondary"
                                                            icon={ShieldAlert}
                                                            loadingId={`e2ee-device-revoke-${trustedDevice.id}`}
                                                            disabled={!currentDeviceIsTrusted}
                                                            px="px-4"
                                                            py="py-2.5"
                                                            className="w-full text-xs"
                                                        >
                                                            Remove trust
                                                        </Button>
                                                    ) : (
                                                        <p className="py-2 text-xs font-semibold text-muted-foreground">Not trusted</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                                Sign out all other sessions
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={Boolean(pendingLoginToApprove)}
                onClose={() => setPendingLoginToApprove(null)}
                onConfirm={handleApproveLogin}
                title="Approve this sign-in?"
                description="Only approve if you just tried to sign in on another browser. That browser will immediately gain access to your account."
                confirmText="Approve Sign-in"
                loadingId="two-factor-device-approve"
            />

            <ConfirmDialog
                isOpen={Boolean(trustedDeviceToApprove)}
                onClose={closeApproveDialog}
                onConfirm={() => trustedDeviceToApprove && handleApprove(trustedDeviceToApprove)}
                title={trustedDeviceToApprove?.trustStatus === 'TRUSTED'
                    ? 'Share recent Chat history?'
                    : 'Trust this browser?'}
                description={trustedDeviceToApprove?.trustStatus === 'TRUSTED'
                    ? 'This securely shares only the latest 35 visible messages from each Chat. Older messages will stay unavailable on that browser.'
                    : 'Only continue if you recognize this sign-in. Approval also securely shares only the latest 35 visible messages from each Chat.'}
                confirmText={trustedDeviceToApprove?.trustStatus === 'TRUSTED'
                    ? 'Share Recent History'
                    : 'Trust Browser'}
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
                title="Sign out all other sessions?"
                description="This signs your account out everywhere except this browser. Trusted browser access is managed separately."
                confirmText="Sign Out All"
                isDestructive
                loadingId="revoke-all-sessions"
            />
        </section>
    );
}
