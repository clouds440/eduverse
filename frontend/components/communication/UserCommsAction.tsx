'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, MessageSquareText, Send } from 'lucide-react';
import { NewMailModal } from '@/components/mail/NewMailModal';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useAccess } from '@/hooks/useAccess';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Role } from '@/types';

type UserCommsActionDisplay = 'table' | 'button';

interface UserCommsActionProps {
    targetUserId: string;
    targetName?: string | null;
    targetEmail?: string | null;
    initialSubject?: string;
    display?: UserCommsActionDisplay;
    showLabel?: boolean;
    className?: string;
    mailEnabled?: boolean;
    requireWriteAccess?: boolean;
}

function getChatPath(role: string | undefined, chatId: string) {
    const base = role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN ? '/admin/chat' : '/chat';
    return `${base}?id=${encodeURIComponent(chatId)}`;
}

export function UserCommsAction({
    targetUserId,
    targetName,
    targetEmail,
    initialSubject,
    display = 'table',
    showLabel = false,
    className,
    mailEnabled,
    requireWriteAccess = display === 'table',
}: UserCommsActionProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { canWrite } = useAccess();
    const router = useRouter();
    const [choiceOpen, setChoiceOpen] = useState(false);
    const [mailOpen, setMailOpen] = useState(false);
    const [mailAllowed, setMailAllowed] = useState(mailEnabled ?? false);
    const [checkingMail, setCheckingMail] = useState(mailEnabled === undefined);
    const [creatingChat, setCreatingChat] = useState(false);

    const disabledByAccess = requireWriteAccess && !canWrite;
    const targetLabel = targetName || targetEmail || 'this user';
    const subject = initialSubject || `Inquiry regarding ${targetLabel}`;
    const canRender = Boolean(token && user && targetUserId && user.id !== targetUserId);

    const mailSearch = useMemo(() => (
        targetEmail || targetName || undefined
    ), [targetEmail, targetName]);

    useEffect(() => {
        if (mailEnabled !== undefined) {
            setMailAllowed(mailEnabled);
            setCheckingMail(false);
            return;
        }
        if (!canRender || !token) {
            setMailAllowed(false);
            setCheckingMail(false);
            return;
        }

        let cancelled = false;
        setCheckingMail(true);
        api.mail.getContactableUsers(token, mailSearch)
            .then((targets) => {
                if (cancelled) return;
                setMailAllowed(targets.some((target) => target.type === 'USER' && target.id === targetUserId));
            })
            .catch(() => {
                if (!cancelled) setMailAllowed(false);
            })
            .finally(() => {
                if (!cancelled) setCheckingMail(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canRender, mailEnabled, mailSearch, targetUserId, token]);

    if (!canRender) return null;

    const openChoice = () => {
        if (disabledByAccess) return;
        setChoiceOpen(true);
    };

    const openMail = () => {
        setChoiceOpen(false);
        setMailOpen(true);
    };

    const startDirectChat = async () => {
        if (!token || !user) return;

        try {
            setCreatingChat(true);
            const chat = await api.chat.createDirectChat(targetUserId, token);
            setChoiceOpen(false);
            router.push(getChatPath(user.role, chat.id));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to start a direct message.';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setCreatingChat(false);
        }
    };

    const tableButton = (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                openChoice();
            }}
            disabled={disabledByAccess}
            className={cn(
                'inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-primary/20 p-2 text-sm text-primary shadow-xs transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
                'hover:bg-primary/10',
                className,
            )}
            title={disabledByAccess ? 'Contact user (Permission Denied)' : 'Contact user'}
            aria-label={disabledByAccess ? 'Contact user (Permission Denied)' : 'Contact user'}
        >
            <Send className="h-4 w-4" aria-hidden="true" />
            {showLabel && <span className="text-[10px] font-black tracking-wider">Contact</span>}
        </button>
    );

    const fullButton = (
        <Button
            type="button"
            variant="secondary"
            icon={Send}
            onClick={openChoice}
            disabled={disabledByAccess}
            className={className}
            title={disabledByAccess ? 'Contact user (Permission Denied)' : 'Contact user'}
        >
            Contact
        </Button>
    );

    return (
        <>
            {display === 'button' ? fullButton : tableButton}

            <Modal
                isOpen={choiceOpen}
                onClose={() => setChoiceOpen(false)}
                title={`Contact ${targetLabel}`}
                subtitle="Choose how you want to reach this person."
                maxWidth="max-w-md"
                mobileMode="sheet"
                bodyClassName="p-4 sm:p-5"
            >
                <div className="grid gap-3">
                    <button
                        type="button"
                        onClick={openMail}
                        disabled={!mailAllowed || checkingMail}
                        className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/55 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {checkingMail ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-black text-foreground">Send Mail</span>
                            <span className="mt-1 block text-xs font-semibold leading-relaxed text-muted-foreground">
                                Open the mail composer with {targetLabel} selected.
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={startDirectChat}
                        disabled={creatingChat}
                        className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/55 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                            {creatingChat ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquareText className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-black text-foreground">Direct Message</span>
                            <span className="mt-1 block text-xs font-semibold leading-relaxed text-muted-foreground">
                                Start or open a 1-to-1 chat with {targetLabel}.
                            </span>
                        </span>
                    </button>
                </div>
            </Modal>

            <NewMailModal
                isOpen={mailOpen}
                onClose={() => setMailOpen(false)}
                initialTargetId={targetUserId}
                initialSubject={subject}
                onSuccess={() => {
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Mail sent successfully', type: 'success' } });
                }}
            />
        </>
    );
}
