'use client';

import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Send, Clock, Paperclip, X, FileText, ImageIcon, Download, MessageSquare } from 'lucide-react';
import { MailDetail, MailMessage as MailMessageType, MailActionLog, Attachment, Role } from '@/types';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { MarkdownEditor, MarkdownEditorHandle } from '@/components/ui/MarkdownEditor';
import { getPublicUrl, downloadFile, formatBytes } from '@/lib/utils';
import Image from 'next/image';
import { BrandIcon } from '@/components/ui/Brand';
import { ADMIN_REPLY_TEMPLATES } from './MailTemplates';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface MailThreadProps {
    mail: MailDetail;
    currentUserId: string;
    currentUserRole?: string;
    onReply: (content: string, files?: File[]) => Promise<void>;
    isClosed?: boolean;
}

export interface MailThreadHandle {
    scrollToReply: () => void;
}

function AttachmentPreview({ file }: { file: Attachment }) {
    const isImage = file.mimeType.startsWith('image/');
    const url = getPublicUrl(file.path);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            await downloadFile(url, file.filename);
        } catch (error) {
            console.error('Failed to download file:', error);
        }
    };

    return (
        <button
            onClick={handleDownload}
            className="flex items-center gap-2 p-2 bg-card/50 border border-border/5 rounded-full hover:bg-card/60 hover:shadow-sm transition-all group max-w-sm cursor-pointer"
        >
            {isImage ? (
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-border/10 relative shadow-sm hover:scale-105 transition-transform duration-300">
                    <Image src={url} alt={file.filename} fill className="object-cover" sizes="(max-width: 768px) 100vw, 300px" />
                </div>
            ) : (
                <div className="w-10 h-10 bg-card/5 rounded-full flex items-center justify-center shrink-0 border border-border/10 shadow-sm">
                    <FileText className="w-5 h-5 text-primary" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-foreground truncate">{file.filename}</p>
                <p className="text-[9px] font-bold text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Download className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
    );
}

function MessageBubble({ message, isOwn }: { message: MailMessageType; isOwn: boolean }) {
    return (
        <div className="flex gap-3">
            <BrandIcon variant="user" size="sm" user={message.sender} className={`w-8 h-8 ${isOwn ? 'ring-2 ring-primary/20' : ''}`} />
            <div className="flex-1 max-w-[90%]">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-black text-foreground">
                        {message.sender?.name || message.sender?.email}
                    </span>
                    {message.sender?.role && (
                        <span className="text-[9px] font-bold text-muted-foreground tracking-widest">
                            {message.sender.role.replace('_', ' ')}
                        </span>
                    )}
                    {isOwn && (
                        <Badge variant="primary" size="sm" className="tracking-tighter py-0 h-4">You</Badge>
                    )}
                </div>
                <div className={`inline-block text-foreground! p-4 rounded-lg shadow-sm ${isOwn ? 'bg-primary/10 border border-border/50' : 'bg-card border border-border'} text-left w-full`}>
                    <MarkdownRenderer content={message.content} className="text-sm text-foreground!" />

                    {message.files && message.files.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
                            {message.files.map(file => (
                                <AttachmentPreview key={file.id} file={file} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-bold tracking-tighter">
                        {new Date(message.createdAt).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
}

function ActionLogItem({ log }: { log: MailActionLog }) {
    const getActionLabel = (action: string) => {
        switch (action) {
            case 'CREATED': return 'sent this mail';
            case 'STATUS_CHANGED': {
                const from = (log.details as Record<string, string>)?.statusFrom || '';
                const to = (log.details as Record<string, string>)?.statusTo || '';
                return `changed status from ${from.replace('_', ' ')} to ${to.replace('_', ' ')}`;
            }
            case 'ASSIGNED': return 'assigned this mail';
            case 'MESSAGE_SENT': return 'sent a message';
            case 'UPDATED': return 'updated this mail';
            default: return action.toLowerCase().replace('_', ' ');
        }
    };

    return (
        <div className="flex items-center gap-2 py-2 px-4 bg-card/50 rounded-lg border border-border/50 mx-8">
            <div className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
            <span className="text-[10px] text-muted-foreground font-medium">
                <span className="font-black text-foreground">{log.performer?.name || 'System'}</span>
                {' '}{getActionLabel(log.action)}
            </span>
            <span className="text-[9px] text-muted-foreground ml-auto font-bold">
                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
}

export const MailThread = forwardRef<MailThreadHandle, MailThreadProps>(
    ({ mail, currentUserId, currentUserRole, onReply, isClosed }, ref) => {
        const [replyContent, setReplyContent] = useState('');
        const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
        const [sending, setSending] = useState(false);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const replyAreaRef = useRef<HTMLDivElement>(null);
        const editorRef = useRef<MarkdownEditorHandle>(null);

        useImperativeHandle(ref, () => ({
            scrollToReply: () => {
                replyAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => editorRef.current?.focus(), 500); // Wait for scroll
            }
        }));

        const isPlatformAdmin = currentUserRole === Role.PLATFORM_ADMIN || currentUserRole === Role.SUPER_ADMIN;

        const orgData = isPlatformAdmin ? {
            name: mail.organization?.name || mail.creator.name || 'User',
            id: mail.organization?.id || mail.creator.id,
            admin: 'Platform Support Team',
            role: currentUserRole || 'Administrator',
            date: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
            signature: 'EduVerse @ Support Team'
        } : {};

        const handleSend = async () => {
            if ((!replyContent.trim() && selectedFiles.length === 0) || sending) return;
            try {
                setSending(true);
                await onReply(replyContent, selectedFiles);
                setReplyContent('');
                setSelectedFiles([]);
            } finally {
                setSending(false);
            }
        };

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
                const filesArray = Array.from(e.target.files);
                const validFiles = filesArray.filter(file =>
                    file.type.startsWith('image/') || file.type === 'application/pdf'
                );
                setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 3));
            }
        };

        const removeFile = (index: number) => {
            setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        };

        type TimelineItem =
            | { type: 'message'; data: MailMessageType; time: string }
            | { type: 'action'; data: MailActionLog; time: string };

        const timeline: TimelineItem[] = [
            ...mail.messages.map((m): TimelineItem => ({ type: 'message', data: m, time: m.createdAt })),
            ...mail.actionLogs
                .filter(l => l.action !== 'MESSAGE_SENT')
                .map((l): TimelineItem => ({ type: 'action', data: l, time: l.createdAt })),
        ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        return (
            <div className="flex flex-col h-full">
                <div className="px-6 py-2 bg-card/5 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            <BrandIcon variant="user" size="sm" user={mail.creator} className="border-2 border-border shadow-sm" />
                            {mail.assignees.length > 0 ? (
                                mail.assignees.slice(0, 2).map((a) => (
                                    <BrandIcon key={a.id} variant="user" size="sm" user={a} className="border-2 border-border shadow-sm" />
                                ))
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-border flex items-center justify-center text-primary text-[10px] font-black shadow-sm font-mono">
                                    {mail.targetRole ? 'GRP' : 'ALL'}
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground tracking-widest leading-none mb-1">Conversation Between</p>
                            <p className="text-sm font-bold text-foreground">
                                {mail.creator.name || mail.creator.email}
                                <span className="mx-2 text-muted-foreground">→</span>
                                {mail.assignees.length > 0 ? (
                                    mail.assignees.length > 3
                                        ? `${mail.assignees.slice(0, 2).map(a => a.name || a.email).join(', ')} and ${mail.assignees.length - 2} others`
                                        : mail.assignees.map(a => a.name || a.email).join(', ')
                                ) : mail.targetRole === 'ORG_STAFF' ? 'All Employees' :
                                    mail.targetRole === Role.PLATFORM_ADMIN || mail.targetRole === Role.SUPER_ADMIN ? 'Platform Administrative Team' :
                                        (mail.targetRole?.replace('_', ' ') || 'Platform Support Team')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground tracking-widest leading-none mb-1">Priority</p>
                        <Badge
                            variant={mail.priority === 'URGENT' ? 'error' : mail.priority === 'HIGH' ? 'warning' : 'info'}
                            size="sm"
                            className="uppercase"
                        >
                            {mail.priority}
                        </Badge>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 py-6 px-4 custom-scrollbar min-h-75">
                    {timeline.length === 0 && (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <MessageSquare className="w-12 h-12 opacity-10 mb-2" />
                            <p className="text-sm font-medium">No messages yet</p>
                        </div>
                    )}
                    {timeline.map((item, i) =>
                        item.type === 'message' ? (
                            <MessageBubble
                                key={`msg-${item.data.id}`}
                                message={item.data}
                                isOwn={item.data.senderId === currentUserId}
                            />
                        ) : (
                            <ActionLogItem key={`log-${i}`} log={item.data} />
                        )
                    )}

                    {!isClosed && <div ref={replyAreaRef} className="pt-4 mt-8 border-t border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-muted-foreground tracking-widest">Post a Reply</h3>

                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors p-1"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    <span className="text-[10px] font-black tracking-widest">Attach Files</span>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    multiple
                                />
                            </div>
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4 animate-in fade-in slide-in-from-top-1">
                                {selectedFiles.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-card/5 border border-border px-3 py-1.5 rounded-lg">
                                        {file.type.startsWith('image/') ? <ImageIcon className="w-3 h-3 text-primary/80" /> : <FileText className="w-3 h-3 text-primary/80" />}
                                        <span className="text-[10px] font-bold text-foreground truncate max-w-37.5">{file.name}</span>
                                        <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-card/10 rounded-full text-primary/80 transition-colors">
                                            <X className="w-3 h-3" />
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
                            rows={5}
                            templates={isPlatformAdmin ? ADMIN_REPLY_TEMPLATES.map((t: { name: string; content: string }) => ({ label: t.name, content: t.content })) : []}
                            orgData={orgData as Record<string, string>}
                        />

                        <div className="flex items-center justify-end mt-3">
                            <Button
                                onClick={handleSend}
                                isLoading={sending}
                                loadingId="reply-submit"
                                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-foreground rounded-lg font-black text-xs tracking-widest hover:bg-primary/80 transition-all border-none shadow-lg shadow-primary/20"
                                icon={Send}
                            >
                                SEND REPLY
                            </Button>
                        </div>
                    </div>}

                    {isClosed && (
                        <div className="border-t border-border py-6 text-center bg-card/5 rounded-b-lg font-black text-muted-foreground text-[10px] tracking-widest">
                            This mail is closed — no further replies
                        </div>
                    )}
                </div>
            </div>
        );
    }
);

MailThread.displayName = 'MailThread';
