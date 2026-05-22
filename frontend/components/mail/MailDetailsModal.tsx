'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
    ArrowUpRight,
    CheckCircle2,
    Hash,
    Loader2,
    MessageSquare,
    Tag,
    User,
    X,
    XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MailDetail, MailStatus } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MailStatusBadge, MailPriorityBadge } from '@/components/mail/MailStatusBadge';
import { MailThread, MailThreadHandle } from '@/components/mail/MailThread';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useSocket } from '@/hooks/useSocket';

interface MailDetailsModalProps {
    mailId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

function formatLabel(value: string) {
    return value.replace(/_/g, ' ');
}

function DetailChip({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{children}</span>
        </span>
    );
}

export function MailDetailsModal({ mailId, isOpen, onClose, onUpdate }: MailDetailsModalProps) {
    const { user, token } = useAuth();
    const { dispatch } = useGlobal();
    const [mail, setMail] = useState<MailDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const requestRef = useRef(0);
    const threadRef = useRef<MailThreadHandle>(null);

    const { subscribe, joinRoom, leaveRoom } = useSocket({
        token,
        userId: user?.id || undefined,
        userRole: user?.role || undefined,
        orgId: user?.orgId || undefined,
    });

    const fetchMailDetails = useCallback(async (showLoading = true) => {
        if (!mailId || !token) return;

        const requestId = requestRef.current + 1;
        requestRef.current = requestId;

        try {
            if (showLoading) setLoading(true);
            const detail = await api.mail.getMail(mailId, token);
            if (requestRef.current === requestId) {
                setMail(detail);
            }
        } catch (error: unknown) {
            console.error(error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load mail details', type: 'error' } });
        } finally {
            if (requestRef.current === requestId && showLoading) {
                setLoading(false);
            }
        }
    }, [dispatch, mailId, token]);

    useEffect(() => {
        if (isOpen && mailId) {
            void fetchMailDetails(true);
            return;
        }

        requestRef.current += 1;
        setMail(null);
        setLoading(false);
    }, [fetchMailDetails, isOpen, mailId]);

    useEffect(() => {
        if (!mailId || !isOpen) return;

        joinRoom(`mail:${mailId}`);
        const unsubs = [
            subscribe('mail:message', (data: unknown) => {
                const payload = data as { mailId: string };
                if (payload.mailId === mailId) {
                    void fetchMailDetails(false);
                    onUpdate?.();
                }
            }),
            subscribe('mail:update', (data: unknown) => {
                const updated = data as MailDetail;
                if (updated.id === mailId) {
                    setMail(updated);
                    onUpdate?.();
                }
            }),
        ];

        return () => {
            unsubs.forEach((unsubscribe) => unsubscribe());
            leaveRoom(`mail:${mailId}`);
        };
    }, [fetchMailDetails, isOpen, joinRoom, leaveRoom, mailId, onUpdate, subscribe]);

    const handleStatusUpdate = useCallback(async (newStatus: MailStatus) => {
        if (!mail || !token || loading) return;
        const idMap = {
            [MailStatus.IN_PROGRESS]: 'status-progress',
            [MailStatus.RESOLVED]: 'status-resolve',
            [MailStatus.CLOSED]: 'status-close',
        };
        const loadingId = idMap[newStatus as keyof typeof idMap] || 'status-update';

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: loadingId });
            await api.mail.updateMail(mail.id, { status: newStatus }, token);
            const updated = await api.mail.getMail(mail.id, token);
            setMail(updated);
            onUpdate?.();
            dispatch({ type: 'TOAST_ADD', payload: { message: `Status updated to ${formatLabel(newStatus)}`, type: 'success' } });
        } catch (error: unknown) {
            console.error(error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to update status', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: loadingId });
        }
    }, [dispatch, loading, mail, onUpdate, token]);

    const handleReply = useCallback(async (content: string, files?: File[]) => {
        if (!mail || !token) return;

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'reply-submit' });
            await api.mail.addMessage(mail.id, { content }, token, files);
            const updated = await api.mail.getMail(mail.id, token);
            setMail(updated);
            onUpdate?.();
        } catch (error: unknown) {
            console.error(error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to send reply', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'reply-submit' });
        }
    }, [dispatch, mail, onUpdate, token]);

    const handleScrollToReply = useCallback(() => {
        threadRef.current?.scrollToReply();
    }, []);

    const isClosed = mail?.status === MailStatus.CLOSED || mail?.status === MailStatus.RESOLVED;
    const isNoReply = mail?.status === MailStatus.NO_REPLY;
    const replyLocked = isClosed || isNoReply;
    const canManageStatus = mail && !isClosed && !isNoReply;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-6xl"
            className="h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] sm:h-[88vh] sm:max-h-[88vh] mb-0"
            bodyClassName="p-0! overflow-hidden"
            customHeader={
                <div className="shrink-0 border-b border-border/70 bg-card/90 px-4 py-4 backdrop-blur-xl sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                {mail ? (
                                    <>
                                        <MailStatusBadge status={mail.status} />
                                        <MailPriorityBadge priority={mail.priority} />
                                    </>
                                ) : (
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Mail details</span>
                                )}
                            </div>

                            <h2 className="line-clamp-2 text-xl font-black leading-tight tracking-tight text-foreground sm:text-2xl">
                                {mail?.subject || 'Loading mail'}
                            </h2>

                            {mail && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <DetailChip icon={Tag}>{formatLabel(mail.category)}</DetailChip>
                                    <DetailChip icon={Hash}>{mail.id.slice(0, 8)}</DetailChip>
                                    <DetailChip icon={User}>{mail.creator.name || mail.creator.email}</DetailChip>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {mail && (
                        <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-row gap-2 w-full sm:w-auto">
                                {!replyLocked && (
                                    <Button
                                        type="button"
                                        onClick={handleScrollToReply}
                                        icon={MessageSquare}
                                        variant="primary"
                                        px="px-4"
                                        py="py-2"
                                        className="text-xs w-full sm:w-auto"
                                    >
                                        Reply
                                    </Button>
                                )}

                                {canManageStatus && mail.status === MailStatus.OPEN && (
                                    <Button
                                        type="button"
                                        onClick={() => handleStatusUpdate(MailStatus.IN_PROGRESS)}
                                        icon={ArrowUpRight}
                                        variant="warning"
                                        loadingId="status-progress"
                                        px="px-4"
                                        py="py-2"
                                        className="text-xs w-full sm:w-auto"
                                    >
                                        In Progress
                                    </Button>
                                )}
                            </div>

                            {canManageStatus && (
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                                    <Button
                                        type="button"
                                        onClick={() => handleStatusUpdate(MailStatus.RESOLVED)}
                                        icon={CheckCircle2}
                                        variant="success"
                                        loadingId="status-resolve"
                                        px="px-4"
                                        py="py-2"
                                        className="text-xs"
                                    >
                                        Resolve
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleStatusUpdate(MailStatus.CLOSED)}
                                        icon={XCircle}
                                        variant="danger"
                                        loadingId="status-close"
                                        px="px-4"
                                        py="py-2"
                                        className="text-xs"
                                    >
                                        Close
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            }
        >
            <div className="h-full min-h-0 bg-background/50">
                {loading && !mail ? (
                    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-black uppercase tracking-widest">Loading mail</p>
                    </div>
                ) : mail ? (
                    <MailThread
                        ref={threadRef}
                        mail={mail}
                        currentUserId={user?.id || ''}
                        currentUserRole={user?.role}
                        onReply={handleReply}
                        isClosed={replyLocked}
                        closedMessage={
                            isNoReply
                                ? 'This is a no-reply mail. Replies are disabled.'
                                : 'This thread is closed. No further replies can be sent.'
                        }
                    />
                ) : (
                    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                        <MessageSquare className="h-10 w-10 opacity-30" />
                        <p className="text-sm font-black">Select a mail to view the thread.</p>
                    </div>
                )}
            </div>
        </Modal>
    );
}
