'use client';

import { memo, type RefObject } from 'react';
import { Check, CheckCheck, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { getUserColor } from '@/lib/utils';
import { ChatMessageType } from '@/types';
import { ChatAvatar } from './ChatAvatar';
import { ProtectedChatMessageContent } from './ProtectedChatMessageContent';
import {
    formatChatTimestamp,
    getLongPressHandlers,
    getTruncatedMessagePreview,
    type ChatMessageWithMeta
} from './chatLayoutHelpers';

function isChatInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('a[data-chat-link="true"], button, input, textarea, select, [role="button"], img.markdown-image, .doc-preview-card, .copy-code-btn'));
}

interface ChatMessageRowProps {
    msg: ChatMessageWithMeta;
    isMine: boolean;
    isGroupChat: boolean;
    showAvatar: boolean;
    isLastInGroup: boolean;
    isHighlighted: boolean;
    isContextSelected: boolean;
    isDesktop: boolean;
    userId?: string;
    activeParticipantsOnline: Record<string, boolean>;
    retryDisabled: boolean;
    touchTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
    touchStartPosRef: RefObject<{ x: number; y: number } | null>;
    touchHasTriggeredRef: RefObject<boolean>;
    onOpenContextMenu: (msg: ChatMessageWithMeta, x: number, y: number) => void;
    onScrollToMessage: (messageId: string) => void;
    onRetrySend: (msg: ChatMessageWithMeta) => void;
    onMessageDecrypted: (messageId: string, plaintext: string) => void;
}

export const ChatMessageRow = memo(function ChatMessageRow({
    msg,
    isMine,
    isGroupChat,
    showAvatar,
    isLastInGroup,
    isHighlighted,
    isContextSelected,
    isDesktop,
    userId,
    activeParticipantsOnline,
    retryDisabled,
    touchTimerRef,
    touchStartPosRef,
    touchHasTriggeredRef,
    onOpenContextMenu,
    onScrollToMessage,
    onRetrySend,
    onMessageDecrypted,
}: ChatMessageRowProps) {
    if (msg.type === ChatMessageType.SYSTEM) {
        return (
            <div>
                <div className="flex justify-center py-2 px-3">
                    <div className="bg-muted/50 text-muted-foreground px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider border border-border/30 shadow-sm flex items-center gap-2">
                        <span>{msg.content}</span>
                        <span className="opacity-40 text-[10px]">{formatChatTimestamp(msg.createdAt)}</span>
                    </div>
                </div>
            </div>
        );
    }

    const isDeleted = !!msg.deletedAt;
    const isSendingMessage = msg.clientStatus === 'sending';
    const isFailedMessage = msg.clientStatus === 'failed';
    const isMineRepliedTo = msg.replyTo?.senderId === userId;

    return (
        <div>
            <div
                id={`msg-${msg.id}`}
                onContextMenu={(event) => {
                    if (isChatInteractiveTarget(event.target)) return;
                    if (!isDeleted) {
                        event.preventDefault();
                        onOpenContextMenu(msg, event.clientX, event.clientY);
                    }
                }}
                {...getLongPressHandlers({
                    isDesktop,
                    itemId: msg.id,
                    onLongPress: () => {
                        if (!isDeleted) {
                            onOpenContextMenu(msg, 0, 0);
                        }
                    },
                    shouldIgnoreTarget: isChatInteractiveTarget
                }, touchTimerRef, touchStartPosRef, touchHasTriggeredRef)}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} group/msg relative ${isLastInGroup ? 'mb-4' : 'mb-1'} px-3 md:px-5 -mx-3 md:-mx-5 transition-colors ${isHighlighted || isContextSelected ? 'bg-primary/25 rounded-xl' : ''}`}
            >
                {!isMine && (
                    <div className="w-7 shrink-0 mr-2 flex flex-col justify-end mb-1">
                        {isLastInGroup && <ChatAvatar targetUser={msg.sender} className="w-7 h-7 rounded-full" isOnline={!!(msg.sender?.id && activeParticipantsOnline[msg.sender.id])} />}
                    </div>
                )}
                <div className={`flex flex-col min-w-0 ${isMine ? 'items-end' : 'items-start'}`} style={{ maxWidth: isMine ? 'min(94%, calc(100% - 0.75rem))' : 'min(94%, calc(100% - 2.5rem))' }}>
                    <div className={`flex items-end space-x-1.5 relative max-w-full min-w-0 group/content ${isMine ? 'flex-row-reverse space-x-reverse justify-start' : 'flex-row justify-end'}`}>
                        <div className="flex flex-col items-inherit max-w-full min-w-0">
                            {isGroupChat && !isMine && showAvatar && (
                                <span className="text-[11px] font-black tracking-widest mb-1.5 ml-1 opacity-80" style={{ color: getUserColor(msg.sender?.id) }}>
                                    {msg.sender?.name}
                                </span>
                            )}
                            {isDeleted ? (
                                <div className={`px-3 py-2 rounded-xl text-[13px] leading-relaxed bg-muted/65 text-muted-foreground border border-border/60 italic shadow-sm ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <Trash2 size={15} className="shrink-0" />
                                        <span className="min-w-0 wrap-break-word">Message deleted {msg.deletedBy?.name ? <span>by {msg.deletedBy.name}</span> : null}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-end">
                                        <span className="text-[11px] font-medium tracking-wider text-muted-foreground">
                                            {formatChatTimestamp(msg.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1.5 relative w-full rounded-xl`}>
                                    <div
                                        className={`
                                            relative pb-1 rounded-xl text-[14.5px] leading-relaxed max-w-full overflow-hidden transition-shadow duration-200
                                            ${isMine
                                                ? 'bg-primary text-primary-foreground rounded-br-sm shadow-lg shadow-primary/20'
                                                : 'bg-card text-foreground rounded-bl-sm shadow-md shadow-foreground/5'
                                            }
                                            ${isFailedMessage && isMine ? 'border-danger border shadow-danger/20' : ''}
                                        `}
                                    >
                                        {msg.replyTo && (() => (
                                            <div
                                                onClick={(event) => { event.stopPropagation(); onScrollToMessage(msg.replyTo!.id); }}
                                                className="m-0.5 px-2.5 py-1.5 min-w-25 mb-1 rounded-xl border border-border text-sm bg-background/90 text-foreground/70! max-w-full overflow-hidden truncate cursor-pointer hover:opacity-90 transition-opacity shadow-inner"
                                            >
                                                <div className={`border-b-3 mt-px ${isMineRepliedTo ? 'border-primary' : 'border-foreground/70'} max-w-[85%] -translate-y-1 mx-auto`}></div>
                                                <p className="font-semibold mb-0.5 text-xs flex items-center opacity-70">
                                                    {msg.replyTo.sender?.id === userId ? 'You:' : msg.replyTo.sender?.name + ':' || 'Someone'}
                                                </p>
                                                <div className="truncate line-clamp-1 opacity-70">
                                                    <ProtectedChatMessageContent
                                                        message={{
                                                            ...msg.replyTo,
                                                            content: getTruncatedMessagePreview(msg.replyTo.deletedAt ? 'Message deleted' : msg.replyTo.content, isDesktop ? 400 : 200),
                                                        }}
                                                        className={`${msg.replyTo.deletedAt ? 'text-muted-foreground!' : 'text-foreground/80!'}`}
                                                        compactAttachments
                                                    />
                                                </div>
                                            </div>
                                        ))()}

                                        <div className={`prose prose-sm mx-2 max-w-full prose-p:mb-0 ${isMine && !isHighlighted ? 'prose-invert' : 'prose-p:text-foreground!'}`}>
                                            <ProtectedChatMessageContent
                                                message={msg}
                                                className={`${isMine ? 'text-primary-foreground!' : 'text-foreground!'} whitespace-pre-wrap wrap-break-word`}
                                                unavailableClassName={`inline-flex items-center gap-1.5 text-xs font-semibold ${isMine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                                                attachmentAlign={isMine ? 'right' : 'left'}
                                                attachmentsFirst
                                                onDecrypted={onMessageDecrypted}
                                            />
                                        </div>

                                        <div className="flex items-center mx-2 pl-1.5 pb-0.5 justify-end space-x-1 mt-1 -mb-0.5 text-foreground">
                                            {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                                                <span className={`text-[11px] tracking-wide sm:text-[11px] rounded-md px-1 py-0 ${isMine ? 'bg-card/60 text-foreground!' : 'bg-foreground/70 text-background!'}`}>Edited</span>
                                            )}
                                            <span className={`text-[11px] tracking-wider sm:text-[11px] font-medium ${isMine ? 'text-primary-foreground/80!' : 'text-muted-foreground!'}`}>
                                                {formatChatTimestamp(msg.createdAt)}
                                            </span>
                                            {isMine && (
                                                isSendingMessage ? (
                                                    <Loader2 className="w-3 h-3 animate-spin opacity-80" strokeWidth={2.5} />
                                                ) : isFailedMessage ? (
                                                    <span className="ml-1 inline-flex items-center gap-1">
                                                        <span className="text-[11px] tracking-wide font-medium text-danger/70">Failed</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => { onRetrySend(msg); }}
                                                            disabled={retryDisabled}
                                                            className="inline-flex items-center gap-1 rounded-full border border-foreground/30 px-1 py-0.5 text-[9px] hover:bg-primary-foreground/10 disabled:opacity-50 transition-colors"
                                                            title="Retry send"
                                                        >
                                                            <RotateCcw className="w-2.5 h-2.5" strokeWidth={2.5} />
                                                        </button>
                                                    </span>
                                                ) : msg.readBy && msg.readBy.length > 0 ? (
                                                    <CheckCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-chat-tick transform translate-y-px" strokeWidth={2.5} />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-80 transform text-primary-foreground! translate-y-px" strokeWidth={2.5} />
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}, (prev, next) => (
    prev.msg === next.msg &&
    prev.isMine === next.isMine &&
    prev.isGroupChat === next.isGroupChat &&
    prev.showAvatar === next.showAvatar &&
    prev.isLastInGroup === next.isLastInGroup &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isContextSelected === next.isContextSelected &&
    prev.isDesktop === next.isDesktop &&
    prev.userId === next.userId &&
    prev.retryDisabled === next.retryDisabled &&
    prev.activeParticipantsOnline === next.activeParticipantsOnline
));
