'use client';

import React, {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Clock,
    Download,
    FileText,
    ImageIcon,
    MessageSquare,
    Paperclip,
    Send,
    X,
} from 'lucide-react';
import Image from 'next/image';
import { MailDetail, MailMessage as MailMessageType, MailActionLog, Attachment, Role } from '@/types';
import { MarkdownEditor, MarkdownEditorHandle } from '@/components/ui/MarkdownEditor';
import { getPublicUrl, downloadFile, formatBytes } from '@/lib/utils';
import { BrandIcon } from '@/components/ui/Brand';
import { ADMIN_REPLY_TEMPLATES } from './MailTemplates';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getRoleLabel } from '@/lib/roles';
import { GENERIC_UPLOAD_ACCEPT, isGenericUploadAllowed } from '@/lib/uploadPolicy';
import { ProtectedMailMessage } from './ProtectedMailContent';
import { useAuth } from '@/context/AuthContext';

interface MailThreadProps {
    mail: MailDetail;
    currentUserId: string;
    currentUserRole?: string;
    token?: string | null;
    onReply: (content: string, files?: File[]) => Promise<void>;
    isClosed?: boolean;
    closedMessage?: string;
    onComposerOpenChange?: (open: boolean) => void;
}

export interface MailThreadHandle {
    scrollToReply: () => void;
    toggleReplyComposer: () => void;
    closeReplyComposer: () => void;
}

type TimelineItem =
    | { type: 'message'; data: MailMessageType; time: string }
    | { type: 'action'; data: MailActionLog; time: string };

interface ReplyComposerHandle {
    scrollToReply: () => void;
}

const ADMIN_TEMPLATE_OPTIONS = ADMIN_REPLY_TEMPLATES.map((template: { name: string; content: string }) => ({
    label: template.name,
    content: template.content,
}));

function formatDateTime(value: string) {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRole(role?: string | null) {
    return getRoleLabel(role, '');
}

function getRecipientLabel(mail: MailDetail) {
    if (mail.assignees.length > 0) {
        if (mail.assignees.length > 3) {
            return `${mail.assignees.slice(0, 2).map((assignee) => assignee.name || assignee.email).join(', ')} and ${mail.assignees.length - 2} others`;
        }

        return mail.assignees.map((assignee) => assignee.name || assignee.email).join(', ');
    }

    if (mail.targetRole === 'ORG_STAFF') return 'All employees';
    if (mail.targetRole === Role.PLATFORM_ADMIN || mail.targetRole === Role.SUPER_ADMIN) return 'Platform administrative team';

    return formatRole(mail.targetRole) || 'Platform support team';
}

const AttachmentPreview = memo(function AttachmentPreview({ file }: { file: Attachment }) {
    const { token } = useAuth();
    const isImage = file.mimeType.startsWith('image/') && !file.path.startsWith('/files/');
    const url = getPublicUrl(file.path);

    const handleDownload = async (event: React.MouseEvent) => {
        event.preventDefault();
        try {
            await downloadFile(url, file.filename, token);
        } catch (error) {
            console.error('Failed to download file:', error);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDownload}
            className="group flex w-full max-w-sm items-center gap-3 rounded-xl border border-border/60 bg-background/70 p-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
            {isImage ? (
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                    <Image src={url} alt={file.filename} fill className="object-cover" sizes="44px" />
                </div>
            ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{file.filename}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Download className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </button>
    );
});

const MessageBubble = memo(function MessageBubble({ message, isOwn, token }: { message: MailMessageType; isOwn: boolean; token?: string | null }) {
    const senderName = message.sender?.name || message.sender?.email || 'Unknown sender';

    return (
        <article className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <BrandIcon
                variant="user"
                size="sm"
                user={message.sender}
                className={`mt-1 h-9 w-9 shrink-0 border border-border/70 shadow-sm ${isOwn ? 'ring-2 ring-primary/20' : ''}`}
            />

            <div className={`min-w-0 max-w-[calc(100%-3rem)] sm:max-w-[82%] lg:max-w-[72%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`mb-1.5 flex max-w-full flex-wrap items-center gap-2 ${isOwn ? 'justify-end text-right' : ''}`}>
                    <span className="truncate text-xs font-black text-foreground">{senderName}</span>
                    {message.sender?.role && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {formatRole(message.sender.role)}
                        </span>
                    )}
                    {isOwn && (
                        <Badge variant="primary" size="sm" className="h-5">You</Badge>
                    )}
                </div>

                <div
                    className={`w-full rounded-2xl border p-4 shadow-sm ${
                        isOwn
                            ? 'rounded-tr-md border-primary/20 bg-primary/10'
                            : 'rounded-tl-md border-border/70 bg-card/90'
                    }`}
                >
                    <ProtectedMailMessage
                        encryptedContent={message.encryptedContent}
                        fallback={message.content}
                        token={token}
                        className="text-sm font-medium text-foreground"
                        attachmentAlign={isOwn ? 'right' : 'left'}
                    />

                    {message.files && message.files.length > 0 && (
                        <div className={`mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 ${isOwn ? 'items-end' : 'items-start'}`}>
                            {message.files.map((file) => (
                                <AttachmentPreview key={file.id} file={file} />
                            ))}
                        </div>
                    )}
                </div>

                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground ${isOwn ? 'justify-end' : ''}`}>
                    <Clock className="h-3 w-3" />
                    <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                </div>
            </div>
        </article>
    );
});

const ActionLogItem = memo(function ActionLogItem({ log }: { log: MailActionLog }) {
    const actionLabel = useMemo(() => {
        switch (log.action) {
            case 'CREATED':
                return 'created this mail';
            case 'STATUS_CHANGED': {
                const details = log.details as Record<string, unknown> | null | undefined;
                const from = String(details?.statusFrom || '').replace(/_/g, ' ');
                const to = String(details?.statusTo || '').replace(/_/g, ' ');
                return from && to ? `changed status from ${from} to ${to}` : 'changed the status';
            }
            case 'ASSIGNED':
                return 'assigned this mail';
            case 'UPDATED':
                return 'updated this mail';
            default:
                return log.action.toLowerCase().replace(/_/g, ' ');
        }
    }, [log.action, log.details]);

    return (
        <div className="flex justify-center px-2">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <span className="truncate">
                    <span className="font-black text-foreground">{log.performer?.name || 'System'}</span> {actionLabel}
                </span>
                <time className="hidden shrink-0 font-bold sm:inline" dateTime={log.createdAt}>
                    {formatDateTime(log.createdAt)}
                </time>
            </div>
        </div>
    );
});

const ThreadTimeline = memo(function ThreadTimeline({
    timeline,
    currentUserId,
    token,
}: {
    timeline: TimelineItem[];
    currentUserId: string;
    token?: string | null;
}) {
    if (timeline.length === 0) {
        return (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-muted-foreground">
                <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-black">No messages yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {timeline.map((item) =>
                item.type === 'message' ? (
                    <MessageBubble
                        key={`msg-${item.data.id}`}
                        message={item.data}
                        isOwn={item.data.senderId === currentUserId}
                        token={token}
                    />
                ) : (
                    <ActionLogItem key={`log-${item.data.id}`} log={item.data} />
                )
            )}
        </div>
    );
});

const ReplyComposer = forwardRef<ReplyComposerHandle, {
    isPlatformAdmin: boolean;
    orgData: Record<string, string>;
    onReply: (content: string, files?: File[]) => Promise<void>;
    className?: string;
    onCancel?: () => void;
    onSent?: () => void;
}>(function ReplyComposer({ isPlatformAdmin, orgData, onReply, className = '', onCancel, onSent }, ref) {
    const [replyContent, setReplyContent] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const replyAreaRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<MarkdownEditorHandle>(null);

    useImperativeHandle(ref, () => ({
        scrollToReply: () => {
            replyAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            window.setTimeout(() => editorRef.current?.focus(), 250);
        },
    }));

    const handleSend = useCallback(async () => {
        if ((!replyContent.trim() && selectedFiles.length === 0) || sending) return;

        try {
            setSending(true);
            await onReply(replyContent, selectedFiles);
            setReplyContent('');
            setSelectedFiles([]);
            onSent?.();
        } finally {
            setSending(false);
        }
    }, [onReply, onSent, replyContent, selectedFiles, sending]);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        const validFiles = files.filter(isGenericUploadAllowed);
        setSelectedFiles((current) => [...current, ...validFiles].slice(0, 3));
        event.target.value = '';
    }, []);

    const removeFile = useCallback((index: number) => {
        setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    }, []);

    return (
        <div ref={replyAreaRef} className={`border-t border-border/70 bg-background/90 px-3 py-3 backdrop-blur sm:px-5 sm:py-4 ${className}`}>
            <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
                <div className="min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Reply</h3>
                    <p className="hidden text-[11px] font-semibold text-muted-foreground sm:block">Up to 3 attachments.</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-xs font-black text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                        <Paperclip className="h-4 w-4" />
                        Attach
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger"
                            title="Hide reply composer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept={GENERIC_UPLOAD_ACCEPT}
                    multiple
                />
            </div>

            {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2">
                            {file.type.startsWith('image/') && file.type !== 'image/svg+xml' ? <ImageIcon className="h-4 w-4 shrink-0 text-primary" /> : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                            <span className="max-w-48 truncate text-xs font-bold text-foreground">{file.name}</span>
                            <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                                title="Remove file"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <MarkdownEditor
                ref={editorRef}
                value={replyContent}
                onChange={setReplyContent}
                placeholder="Write a reply..."
                rows={4}
                templates={isPlatformAdmin ? ADMIN_TEMPLATE_OPTIONS : []}
                orgData={orgData}
            />

            <div className="mt-3 flex justify-end">
                <Button
                    type="button"
                    onClick={handleSend}
                    isLoading={sending}
                    loadingId="reply-submit"
                    icon={Send}
                    px="px-5"
                    py="py-2.5"
                    className="w-full text-xs sm:w-auto"
                    disabled={!replyContent.trim() && selectedFiles.length === 0}
                >
                    Send Reply
                </Button>
            </div>
        </div>
    );
});

ReplyComposer.displayName = 'ReplyComposer';

export const MailThread = forwardRef<MailThreadHandle, MailThreadProps>(
    ({ mail, currentUserId, currentUserRole, token, onReply, isClosed, closedMessage = 'This thread is closed. No further replies can be sent.', onComposerOpenChange }, ref) => {
        const composerRef = useRef<ReplyComposerHandle>(null);
        const [composerOpen, setComposerOpen] = useState(false);
        const isPlatformAdmin = currentUserRole === Role.PLATFORM_ADMIN || currentUserRole === Role.SUPER_ADMIN;

        useEffect(() => {
            // Switching threads intentionally closes any draft composer from the prior thread.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setComposerOpen(false);
            onComposerOpenChange?.(false);
        }, [mail.id, onComposerOpenChange]);

        const updateComposerOpen = useCallback((open: boolean) => {
            setComposerOpen(open);
            onComposerOpenChange?.(open);
        }, [onComposerOpenChange]);

        const scrollToReplyComposer = useCallback(() => {
            updateComposerOpen(true);
            window.setTimeout(() => composerRef.current?.scrollToReply(), 50);
        }, [updateComposerOpen]);

        const closeReplyComposer = useCallback(() => {
            updateComposerOpen(false);
        }, [updateComposerOpen]);

        const toggleReplyComposer = useCallback(() => {
            const nextOpen = !composerOpen;
            updateComposerOpen(nextOpen);
            if (nextOpen) {
                window.setTimeout(() => composerRef.current?.scrollToReply(), 50);
            }
        }, [composerOpen, updateComposerOpen]);

        useImperativeHandle(ref, () => ({
            scrollToReply: scrollToReplyComposer,
            toggleReplyComposer,
            closeReplyComposer,
        }), [closeReplyComposer, scrollToReplyComposer, toggleReplyComposer]);

        const timeline = useMemo<TimelineItem[]>(() => {
            return [
                ...mail.messages.map((message): TimelineItem => ({ type: 'message', data: message, time: message.createdAt })),
                ...mail.actionLogs
                    .filter((log) => log.action !== 'MESSAGE_SENT')
                    .map((log): TimelineItem => ({ type: 'action', data: log, time: log.createdAt })),
            ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        }, [mail.actionLogs, mail.messages]);

        const recipientLabel = useMemo(() => getRecipientLabel(mail), [mail]);
        const orgData = useMemo<Record<string, string>>(() => {
            if (!isPlatformAdmin) return {} as Record<string, string>;

            return {
                name: mail.organization?.name || mail.creator.name || 'User',
                id: mail.organization?.id || mail.creator.id,
                admin: 'Platform Support Team',
                role: currentUserRole || 'Administrator',
                date: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
                signature: 'EduVerse Support Team',
            } satisfies Record<string, string>;
        }, [currentUserRole, isPlatformAdmin, mail.creator.id, mail.creator.name, mail.organization?.id, mail.organization?.name]);

        return (
            <div className="flex h-full min-h-0 flex-col bg-background/40">
                <div className="shrink-0 border-b border-border/70 bg-card/75 px-3 py-2 backdrop-blur sm:px-5 sm:py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="hidden shrink-0 -space-x-2 sm:flex">
                                <BrandIcon variant="user" size="sm" user={mail.creator} className="h-9 w-9 border-2 border-background shadow-sm" />
                                {mail.assignees.length > 0 ? (
                                    mail.assignees.slice(0, 2).map((assignee) => (
                                        <BrandIcon key={assignee.id} variant="user" size="sm" user={assignee} className="h-9 w-9 border-2 border-background shadow-sm" />
                                    ))
                                ) : (
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-warning/10 text-[10px] font-black text-warning shadow-sm">
                                        GRP
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0">
                                <p className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground sm:block">Conversation</p>
                                <p className="truncate text-xs font-black text-foreground sm:text-sm">
                                    {mail.creator.name || mail.creator.email}
                                    <span className="mx-2 text-muted-foreground">to</span>
                                    {recipientLabel}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar sm:px-5 sm:py-5">
                    <ThreadTimeline timeline={timeline} currentUserId={currentUserId} token={token} />

                    {isClosed && (
                        <div className="mt-6 rounded-2xl border border-border/70 bg-muted/30 px-4 py-5 text-center text-xs font-black uppercase tracking-widest text-muted-foreground">
                            {closedMessage}
                        </div>
                    )}
                </div>

                {!isClosed && (
                    <div className={`${composerOpen ? 'block' : 'hidden'} shrink-0`}>
                        <ReplyComposer
                            ref={composerRef}
                            isPlatformAdmin={isPlatformAdmin}
                            orgData={orgData}
                            onReply={onReply}
                            className="max-h-[52vh] overflow-y-auto custom-scrollbar sm:max-h-none sm:overflow-visible"
                            onCancel={closeReplyComposer}
                            onSent={closeReplyComposer}
                        />
                    </div>
                )}
            </div>
        );
    }
);

MailThread.displayName = 'MailThread';
