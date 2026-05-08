'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Tag, Hash, User, MessageSquare, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';
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

export function MailDetailsModal({ mailId, isOpen, onClose, onUpdate }: MailDetailsModalProps) {
    const { user, token } = useAuth();
    const { dispatch } = useGlobal();
    const [mail, setMail] = useState<MailDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const threadRef = useRef<MailThreadHandle>(null);

    const { subscribe, joinRoom, leaveRoom } = useSocket({
        token: token,
        userId: user?.id || undefined,
        userRole: user?.role || undefined,
        orgId: user?.orgId || undefined
    });

    const fetchMailDetails = useCallback(async () => {
        if (!mailId || !token) return;
        try {
            setLoading(true);
            const detail = await api.mail.getMail(mailId, token);
            setMail(detail);
        } catch (error: unknown) {
            console.error(error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load mail details', type: 'error' } });
        } finally {
            setLoading(false);
        }
    }, [mailId, token, dispatch]);

    useEffect(() => {
        if (isOpen && mailId) {
            fetchMailDetails();
        } else {
            setMail(null);
        }
    }, [isOpen, mailId, fetchMailDetails]);

    useEffect(() => {
        if (!mailId || !isOpen) return;

        joinRoom(`mail:${mailId}`);
        const unsubs = [
            subscribe('mail:message', async (data: unknown) => {
                const payload = data as { mailId: string };
                if (payload.mailId === mailId && token) {
                    const updated = await api.mail.getMail(mailId, token);
                    setMail(updated);
                    onUpdate?.(); // Notify parent to refresh list (unread counts etc)
                }
            }),
            subscribe('mail:update', (data: unknown) => {
                const updated = data as MailDetail;
                if (updated.id === mailId) {
                    setMail(updated);
                    onUpdate?.();
                }
            })
        ];

        return () => {
            unsubs.forEach(u => u());
            leaveRoom(`mail:${mailId}`);
        };
    }, [mailId, isOpen, subscribe, joinRoom, leaveRoom, token, onUpdate]);

    const handleStatusUpdate = async (newStatus: MailStatus) => {
        if (!mail || !token || loading) return;
        const idMap = {
            [MailStatus.IN_PROGRESS]: 'status-progress',
            [MailStatus.RESOLVED]: 'status-resolve',
            [MailStatus.CLOSED]: 'status-close',
        };
        const lid = idMap[newStatus as keyof typeof idMap] || 'status-update';

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: lid });
            await api.mail.updateMail(mail.id, { status: newStatus }, token);
            const updated = await api.mail.getMail(mail.id, token);
            setMail(updated);
            onUpdate?.();
            dispatch({ type: 'TOAST_ADD', payload: { message: `Status updated to ${newStatus.replace('_', ' ')}`, type: 'success' } });
        } catch (error: unknown) {
            console.error(error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to update status', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: lid });
        }
    };

    const handleReply = async (content: string, files?: File[]) => {
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
    };

    const handleScrollToReply = () => {
        threadRef.current?.scrollToReply();
    };

    const isClosed = mail?.status === MailStatus.CLOSED || mail?.status === MailStatus.RESOLVED;
    const isNoReply = mail?.status === MailStatus.NO_REPLY;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                mail ? mail.subject : undefined
            }
            subtitle={
                mail ? (
                    <div className="block md:flex items-center justify-between w-full pr-12 text-sm sm:text-base md:text-xl">
                        <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground font-bold tracking-widest">
                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{mail.category.replace('_', ' ')}</span>
                            <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{mail.id.slice(0, 8)}</span>
                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{mail.creator.name}</span>
                        </div>
                        <div className="block md:flex md:ml-5">
                            {!isClosed && !isNoReply && (
                                <div className="flex items-center mt-3 md:mt-0 gap-2 md:ml-4">
                                    {mail.status === MailStatus.OPEN && (
                                        <Button
                                            onClick={() => handleStatusUpdate(MailStatus.IN_PROGRESS)}
                                            icon={ArrowUpRight}
                                            variant="warning"
                                            loadingId="status-progress"
                                            px='px-3'
                                            py='py-1.5'
                                            className="text-[9px]"
                                        >
                                            Start Progress
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => handleStatusUpdate(MailStatus.RESOLVED)}
                                        icon={CheckCircle2}
                                        variant="success"
                                        loadingId="status-resolve"
                                        px='px-3'
                                        py='py-1.5'
                                        className="text-[9px]"
                                    >
                                        Resolve
                                    </Button>
                                    <Button
                                        onClick={() => handleStatusUpdate(MailStatus.CLOSED)}
                                        icon={XCircle}
                                        variant="danger"
                                        loadingId="status-close"
                                        px='px-3'
                                        py='py-1.5'
                                        className="text-[9px]"
                                    >
                                        Close Thread
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : undefined
            }
            maxWidth="max-w-5xl"
            footer={
                mail ? (
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            {!isClosed ? (
                                <Button
                                    onClick={handleScrollToReply}
                                    icon={MessageSquare}
                                    variant="primary"
                                    px='px-6'
                                    py='py-2.5'
                                    className="text-[10px]"
                                >
                                    Reply to Thread
                                </Button>
                            ) : (
                                <div className="text-[10px] font-black text-muted-foreground tracking-widest">
                                    Thread is {mail.status}
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={onClose}
                            variant='secondary'
                            px='px-6'
                            py='py-2.5'
                            className="text-[10px]"
                        >
                            Close Window
                        </Button>
                    </div>
                ) : undefined
            }
        >
            {mail && (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex items-center gap-3 mb-6 shrink-0 flex-wrap">
                        <MailStatusBadge status={mail.status} />
                        <MailPriorityBadge priority={mail.priority} />
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <MailThread
                            ref={threadRef}
                            mail={mail}
                            currentUserId={user?.id || ''}
                            currentUserRole={user?.role}
                            onReply={handleReply}
                            isClosed={isClosed}
                        />
                    </div>
                </div>
            )}
        </Modal>
    );
}
