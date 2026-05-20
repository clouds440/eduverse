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
import { formatDistanceToNow } from "date-fns";

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
            return <Smartphone className="w-5 h-5" />;
        }
        if (osLower.includes('windows') || osLower.includes('mac') || osLower.includes('linux')) {
            return <Laptop className="w-5 h-5" />;
        }
        return <Monitor className="w-5 h-5" />;
    };

    const isCurrentSession = (session: Session) => {
        return session.isCurrent === true;
    };

    return (
        <div className="w-full">
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                {/* Header */}
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                <div className="relative p-3 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg">
                                    <Shield className="w-7 h-7 text-primary" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                                    Active Sessions
                                </h2>
                                <p className="text-sm md:text-base text-muted-foreground font-medium mt-1">
                                    Manage your active devices and login sessions
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={fetchSessions}
                            variant="secondary"
                            icon={RefreshCw}
                            disabled={loading}
                            className="shrink-0 w-full sm:w-auto"
                        >
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8">
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loading size="md" />
                        </div>
                    ) : error ? (
                        <ErrorState error={error} onRetry={fetchSessions} />
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="relative inline-block mb-6">
                                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
                                <Globe className="w-20 h-20 text-muted-foreground/30 relative" />
                            </div>
                            <p className="text-lg font-semibold text-muted-foreground">No active sessions found</p>
                            <p className="text-sm text-muted-foreground/60 mt-2">You&apos;re not currently logged in on any device</p>
                        </div>
                    ) : (
                        <>
                            {/* Sessions List */}
                            <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                                {sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                                            isCurrentSession(session)
                                                ? 'bg-linear-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/30 shadow-lg shadow-primary/5'
                                                : 'bg-card/50 border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5'
                                        }`}
                                    >
                                        <div className="p-4 md:p-5">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                {/* Device Info */}
                                                <div className="flex items-start sm:items-center gap-4 flex-1">
                                                    <div className={`relative shrink-0 p-3 rounded-xl transition-all ${
                                                        isCurrentSession(session)
                                                            ? 'bg-linear-to-br from-primary/20 to-primary/10 text-primary shadow-lg shadow-primary/10'
                                                            : 'bg-linear-to-br from-muted/50 to-muted/30 text-muted-foreground group-hover:from-primary/10 group-hover:to-primary/5 group-hover:text-primary'
                                                    }`}>
                                                        {getDeviceIcon(session.os)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                                            <p className="font-bold text-foreground text-lg truncate">
                                                                {session.deviceName || 'Unknown Device'}
                                                            </p>
                                                            {isCurrentSession(session) && (
                                                                <Badge variant="primary" dot className="animate-pulse">
                                                                    Current
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm text-muted-foreground">
                                                            <span className="font-medium">{session.os}</span>
                                                            <span className="text-muted-foreground/40">•</span>
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="w-1 h-1 bg-muted-foreground/40 rounded-full" />
                                                                Last active: {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}
                                                            </span>
                                                            {(session.ip || session.location) && (
                                                                <>
                                                                    <span className="text-muted-foreground/40">•</span>
                                                                    <span className="flex items-center gap-1.5">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {session.location ? session.location : "Unknown"}
                                                                    </span>
                                                                    <span>IP: {session.ip ? session.ip : "Unknown"}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Revoke Button */}
                                                {!isCurrentSession(session) && (
                                                    <div className="flex sm:block shrink-0">
                                                        <Button
                                                            onClick={() => handleRevokeSession(session.id)}
                                                            variant="danger"
                                                            icon={Trash2}
                                                            loadingId={`revoke-session-${session.id}`}
                                                            className="w-full sm:w-auto"
                                                        >
                                                            Revoke
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Revoke All Button */}
                            <div className="pt-6 border-t border-border/50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                                            <span className="font-medium">
                                                {sessions.filter(s => !isCurrentSession(s)).length} other session{sessions.filter(s => !isCurrentSession(s)).length !== 1 ? 's' : ''} active
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleRevokeAll}
                                        variant="danger"
                                        icon={LogOut}
                                        loadingId="revoke-all-sessions"
                                        disabled={sessions.filter(s => !isCurrentSession(s)).length === 0}
                                        className="w-full sm:w-auto"
                                    >
                                        Revoke All Other Sessions
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={showRevokeAllDialog}
                onClose={() => setShowRevokeAllDialog(false)}
                onConfirm={handleConfirmRevokeAll}
                title="Revoke All Other Sessions"
                description="Are you sure you want to revoke all other sessions? This will sign you out from all devices except this one. You&apos;ll need to log in again on those devices."
                confirmText="Revoke All"
                isDestructive={true}
            />
        </div>
    );
}
