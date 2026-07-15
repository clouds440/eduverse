'use client';

import { memo, useMemo, type ReactNode, type RefObject } from 'react';
import { ChatMessageType, ChatType } from '@/types';
import { ChatMessageRow } from './ChatMessageRow';
import { formatChatDateLabel, type ChatMessageWithMeta } from './chatLayoutHelpers';

interface ChatMessageListProps {
    messages: ChatMessageWithMeta[];
    activeChatType?: ChatType;
    highlightedMessageId: string | null;
    contextMessageId?: string;
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

export const ChatMessageList = memo(function ChatMessageList({
    messages,
    activeChatType,
    highlightedMessageId,
    contextMessageId,
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
}: ChatMessageListProps) {
    return useMemo(() => {
        const sections: ReactNode[] = [];
        let currentDateLabel: string | null = null;
        let currentDateMessages: ReactNode[] = [];

        const renderDateSeparator = (label: string) => (
            <div className="sticky top-0 z-20 flex items-center my-4 pointer-events-none">
                <span className="px-4 py-1 text-[11px] mx-auto font-black bg-card rounded-xl uppercase tracking-widest text-muted-foreground/60">{label}</span>
            </div>
        );

        const flushCurrentDateSection = () => {
            if (!currentDateLabel) return;

            sections.push(
                <section key={`date-section-${currentDateLabel}-${sections.length}`} className="relative">
                    {renderDateSeparator(currentDateLabel)}
                    {currentDateMessages}
                </section>
            );
            currentDateMessages = [];
        };

        messages.forEach((msg, index) => {
            const dateLabel = formatChatDateLabel(msg.createdAt);
            if (dateLabel !== currentDateLabel) {
                flushCurrentDateSection();
                currentDateLabel = dateLabel;
            }

            const isMine = msg.senderId === userId;
            const showAvatar = !isMine && (index === 0 || messages[index - 1].senderId !== msg.senderId || messages[index - 1].type === ChatMessageType.SYSTEM);
            const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== msg.senderId || messages[index + 1].type === ChatMessageType.SYSTEM;

            currentDateMessages.push(
                <ChatMessageRow
                    key={msg.id}
                    msg={msg}
                    isMine={isMine}
                    isGroupChat={activeChatType === ChatType.GROUP}
                    showAvatar={showAvatar}
                    isLastInGroup={isLastInGroup}
                    isHighlighted={highlightedMessageId === msg.id}
                    isContextSelected={contextMessageId === msg.id}
                    isDesktop={isDesktop}
                    userId={userId}
                    activeParticipantsOnline={activeParticipantsOnline}
                    retryDisabled={retryDisabled}
                    touchTimerRef={touchTimerRef}
                    touchStartPosRef={touchStartPosRef}
                    touchHasTriggeredRef={touchHasTriggeredRef}
                    onOpenContextMenu={onOpenContextMenu}
                    onScrollToMessage={onScrollToMessage}
                    onRetrySend={onRetrySend}
                    onMessageDecrypted={onMessageDecrypted}
                />
            );
        });

        flushCurrentDateSection();
        return <>{sections}</>;
    }, [
        activeChatType,
        activeParticipantsOnline,
        contextMessageId,
        highlightedMessageId,
        isDesktop,
        messages,
        onOpenContextMenu,
        onRetrySend,
        onMessageDecrypted,
        onScrollToMessage,
        retryDisabled,
        touchHasTriggeredRef,
        touchStartPosRef,
        touchTimerRef,
        userId
    ]);
});
