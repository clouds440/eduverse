'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { Monitor, Smartphone, Laptop, Globe, Shield, Trash2, LogOut, RefreshCw, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading } from '@/components/ui/Loading';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDistanceToNow } from 'date-fns';

interface Session {
    id: string;
    userId: string;
    deviceId: string;
    deviceName: string;
    os: string;
    lastSeenAt: string;
    expiresAt: string;
    createdAt: string;
    ip?: string | null;
    location?: string | null;
    isCurrent?: boolean;
}

interface SessionManagementProps {
    userId?: string;
    orgId?: string;
}

export default function SessionManagement({ userId }: SessionManagementProps) {
    const { token, user, logout } = useAuth();
    const { dispatch } = useGlobal();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);

    const targetUserId = userId || user?.id;

    const fetchSessions = useCallback(async () => {
        if (!token || !targetUserId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await api.auth.getSessions(token);
            setSessions(data);
        } catch (error) {
            console.error('Failed to fetch sessions', error);
            setError(error as Error);
        } finally {
            setLoading(false);
        }
    }, [targetUserId, token]);

    useEffect(() => {
        void fetchSessions();
    }, [fetchSessions]);

    const handleRevokeSession = async (sessionId: string) => {
        if (!token) return;
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `revoke-session-${sessionId}` });
            const result = await api.auth.revokeSession(sessionId, token);
            if (result.shouldLogout) {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Logging out...', type: 'success' } });
                logout();
                return;
            }
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Session revoked successfully', type: 'success' } });
            await fetchSessions();
        } catch (error) {
            console.error('Failed to revoke session', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to revoke session', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `revoke-session-${sessionId}` });
        }
    };

    const handleRevokeAll = async () => {
        if (!token) return;
        setShowRevokeAllDialog(true);
    };

    const handleConfirmRevokeAll = async () => {
        if (!token) return;
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'revoke-all-sessions' });
            await api.auth.revokeAllSessions(token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'All sessions revoked successfully', type: 'success' } });
            await fetchSessions();
        } catch (error) {
            console.error('Failed to revoke all sessions', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to revoke all sessions', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'revoke-all-sessions' });
            setShowRevokeAllDialog(false);
        }
    };

    const getDeviceIcon = (os: string) => {
        const osLower = os.toLowerCase();
        if (osLower.includes('android') || osLower.includes('ios')) {
            return <Smartphone className="h-5 w-5" />;
        }
        if (osLower.includes('windows') || osLower.includes('mac') || osLower.includes('linux')) {
            return <Laptop className="h-5 w-5" />;
        }
        return <Monitor className="h-5 w-5" />;
    };

    const isCurrentSession = (session: Session) => session.isCurrent === true;
    const otherSessions = sessions.filter((session) => !isCurrentSession(session));

    return (
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
            <div className="border-b border-border/60 bg-background/45 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black text-foreground">Active Sessions</h2>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-muted-foreground">Manage devices with access to this account.</p>
                        </div>
                    </div>
                    <Button
                        onClick={fetchSessions}
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

            <div className="p-4 sm:p-5">
                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loading size="md" />
                    </div>
                ) : error ? (
                    <ErrorState error={error} onRetry={fetchSessions} />
                ) : sessions.length === 0 ? (
                    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/45 p-8 text-center">
                        <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm font-black text-foreground">No active sessions found</p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">No devices are currently attached to this account.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-background/45">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={`p-4 transition-colors ${isCurrentSession(session) ? 'bg-primary/5' : 'hover:bg-card/60'}`}
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                                                isCurrentSession(session)
                                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                                    : 'border-border/70 bg-card text-muted-foreground'
                                            }`}>
                                                {getDeviceIcon(session.os)}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-sm font-black text-foreground sm:text-base">
                                                        {session.deviceName || 'Unknown Device'}
                                                    </p>
                                                    {isCurrentSession(session) && (
                                                        <Badge variant="primary" size="sm" dot>
                                                            Current
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                                                    <span>{session.os || 'Unknown OS'}</span>
                                                    <span>Last active {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}</span>
                                                    {(session.ip || session.location) && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <MapPin className="h-3.5 w-3.5" />
                                                            {session.location || 'Unknown location'}
                                                            {session.ip ? ` - ${session.ip}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {!isCurrentSession(session) && (
                                            <Button
                                                onClick={() => handleRevokeSession(session.id)}
                                                variant="danger"
                                                icon={Trash2}
                                                loadingId={`revoke-session-${session.id}`}
                                                px="px-4"
                                                py="py-2.5"
                                                className="w-full text-xs lg:w-auto"
                                            >
                                                Revoke
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <span className="h-2 w-2 rounded-full bg-success" />
                                <span>{otherSessions.length} other session{otherSessions.length !== 1 ? 's' : ''} active</span>
                            </div>
                            <Button
                                onClick={handleRevokeAll}
                                variant="danger"
                                icon={LogOut}
                                loadingId="revoke-all-sessions"
                                disabled={otherSessions.length === 0}
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
                isOpen={showRevokeAllDialog}
                onClose={() => setShowRevokeAllDialog(false)}
                onConfirm={handleConfirmRevokeAll}
                title="Revoke All Other Sessions"
                description="Are you sure you want to revoke all other sessions? This will sign you out from all devices except this one. You will need to log in again on those devices."
                confirmText="Revoke All"
                isDestructive={true}
            />
        </section>
    );
}
