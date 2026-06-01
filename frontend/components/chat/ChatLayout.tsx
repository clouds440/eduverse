'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useUI } from '@/context/UIContext';
import { useSocket } from '@/hooks/useSocket';
import Image from 'next/image';
import { api } from '@/lib/api';
import { getUserColor, downloadFile, formatBytes } from '@/lib/utils';
import {
    getUserChatsCached,
    insertOrUpdateChatFromMessage,
    markAsReadGuard,
    getCachedChats,
    getCachedMessages,
    setCachedMessages,
    getCachedComposerStates,
    setCachedComposerStates,
    hydrateCachedComposerStates
} from '@/lib/chatStore';
import { Chat, ChatMessage, ChatParticipant, ChatType, ChatMessageType, PaginatedResponse, Role, User, ChatParticipantRole } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import {
    Search, Paperclip, MessageSquarePlus, MessageSquareDashed, SendHorizonal as Send, MoreVertical, X, Loader2,
    UserMinus, Trash2, Info, SlidersHorizontal, ChevronLeft, Check, CheckCheck, ArrowDown, ArrowUp, RotateCcw,
    Lock as LockIcon, FileText, Archive, FileSpreadsheet, Presentation
} from 'lucide-react';
import { isInPageBackSentinelState, useBackNavigation, useBackStackEntry } from '@/context/BackNavigationContext';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NewChatModal } from './NewChatModal';
import { ChatSettingsModal } from './ChatSettingsModal';
import { MessageContextMenu } from './MessageActionsDropdown';
import { ChatAvatar } from './ChatAvatar';
import { ImagePreviewModal } from './ImagePreviewModal';
import {
    type ChatTypingEvent,
    type ChatTypingStateMap,
    formatChatDateLabel,
    formatChatTimestamp,
    getDirectChatTarget,
    getChatComposerState,
    getTypingIndicatorLabel,
    getTypingUsersForChat,
    getTruncatedMessagePreview,
    mergeUniqueMessages,
    removeTypingUserFromAllChats,
    reconcileIncomingMessage,
    type PresenceStateEvent,
    type PresenceUpdateEvent,
    type OnlineUserState,
    updateChatTypingState,
    updateChatComposerState,
    updateOnlineUsersFromPresenceEvent,
    updateOnlineUsersFromPresenceState,
    type ChatComposerStateMap,
    type ChatMessageWithMeta,
    getLongPressHandlers,
    extractFilesFromClipboard,
    buildOptimisticAttachmentMarkdown,
    filterValidFiles,
    buildAttachmentMarkdown,
    getFileTypeInfo
} from './chatLayoutHelpers';

function shouldRefreshCachedMessages(cachedMessages: ChatMessageWithMeta[], chat?: Chat) {
    if (cachedMessages.length === 0) return true;
    if (!chat) return true;
    if ((chat.unreadCount || 0) > 0) return true;

    const previewMessage = chat.messages?.[0];
    const latestCachedMessage = cachedMessages[cachedMessages.length - 1];
    if (!previewMessage || !latestCachedMessage) return false;

    if (previewMessage.id !== latestCachedMessage.id) return true;

    const previewUpdatedAt = new Date(previewMessage.updatedAt || previewMessage.createdAt).getTime();
    const cachedUpdatedAt = new Date(latestCachedMessage.updatedAt || latestCachedMessage.createdAt).getTime();
    return previewUpdatedAt > cachedUpdatedAt;
}

export function ChatLayout() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const dispatchRef = useRef(dispatch);
    useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);
    const { isDesktop, mounted } = useUI();
    const { goBack } = useBackNavigation();
    const { subscribe, joinRoom, leaveRoom, emit } = useSocket({ token, userId: user?.id, enabled: !!token });
    const searchParams = useSearchParams();
    const initialChatId = searchParams.get('id');
    const msgIdParam = searchParams.get('msgId');

    const [chats, setChats] = useState<Chat[]>([]);
    const activeChatPreviewRef = useRef<Chat | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
    const [targetMessageId, setTargetMessageId] = useState<string | null>(msgIdParam);
    const [activeGroupFilter, setActiveGroupFilter] = useState<'all' | 'groups' | 'dms'>('all');
    const [chatMenuOpenId, setChatMenuOpenId] = useState<string | null>(null);
    const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
        isOpen: boolean;
        chatId: string | null;
        chatName: string;
    }>({
        isOpen: false,
        chatId: null,
        chatName: '',
    });

    useEffect(() => {
        if (initialChatId) {
            setActiveChatId(initialChatId);
        }
        if (msgIdParam) {
            setTargetMessageId(msgIdParam);
        }
    }, [initialChatId, msgIdParam]);
    // Initialize from persistent store
    const [messages, setMessages] = useState<ChatMessageWithMeta[]>(() => {
        if (initialChatId) {
            return getCachedMessages(initialChatId);
        }
        return [];
    });
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [chatComposerStates, setChatComposerStates] = useState<ChatComposerStateMap>(() => getCachedComposerStates());
    const [isComposerStateHydrated, setIsComposerStateHydrated] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUserState>({});
    const [typingByChatId, setTypingByChatId] = useState<ChatTypingStateMap>({});
    const [mentionSearchQuery, setMentionSearchQuery] = useState('');
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionCursorIndex, setMentionCursorIndex] = useState(0);
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

    // Modal state for image preview
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Context menu for message actions
    const [contextMenu, setContextMenu] = useState<{ msg: ChatMessageWithMeta, x: number, y: number } | null>(null);

    // Touch refs for message long press
    const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const touchHasTriggeredRef = useRef<boolean>(false);

    // Touch refs for chat list long press
    const touchChatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchChatStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const touchChatHasTriggeredRef = useRef<boolean>(false);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => { },
    });

    // Pagination & Smart Scroll States
    const [messagesPage, setMessagesPage] = useState(1);
    const [hasMoreMessages, setHasMoreMessages] = useState<boolean | null>(null);
    const [hasMoreAfter, setHasMoreAfter] = useState(false);
    const [unreadSinceScroll, setUnreadSinceScroll] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingNewer, setIsLoadingNewer] = useState(false);
    const [isViewingHistory, setIsViewingHistory] = useState(false);

    // Refs
    const participantsRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const mentionDropdownRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const readOnlyBannerObserverRef = useRef<ResizeObserver | null>(null);
    const scrollFrameRef = useRef<number | null>(null);
    const unreadSinceScrollRef = useRef(unreadSinceScroll);
    const activeChatIdRef = useRef(activeChatId);
    const tokenRef = useRef(token);

    const [composerHeight, setComposerHeight] = useState(0);
    const [readOnlyBannerHeight, setReadOnlyBannerHeight] = useState(0);
    const pendingMessageIdRef = useRef<string | null>(null);
    const sendLockRef = useRef(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingChatIdRef = useRef<string | null>(null);
    const activeChatHistoryRef = useRef<string | null>(null);
    const mobileBottomInset = 'env(safe-area-inset-bottom, 0px)';

    const closeActiveChat = useCallback((options?: { fromHistory?: boolean }) => {
        if (!options?.fromHistory && !isDesktop && isInPageBackSentinelState(window.history.state)) {
            window.history.back();
            return;
        }

        activeChatHistoryRef.current = null;
        setActiveChatId(null);
        setTargetMessageId(null);
        setShowParticipants(false);
        setContextMenu(null);

        const url = new URL(window.location.href);
        url.searchParams.delete('id');
        url.searchParams.delete('msgId');
        window.history.replaceState({}, '', url.toString());
    }, [isDesktop]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
        setUnreadSinceScroll(0);
        setShowScrollToBottom(false);
        if (activeChatId && token) {
            markAsReadGuard(activeChatId, '', token);
        }
    }, [activeChatId, token]);

    // Helper to update messages with read status
    const updateMessagesWithReadStatus = useCallback((messages: ChatMessage[], readData: { messageId: string; userId: string }): ChatMessage[] => {
        const readMessage = messages.find(candidate => candidate.id === readData.messageId);
        const readAt = readMessage ? new Date(readMessage.createdAt).getTime() : null;
        return messages.map(m => {
            const messageAt = new Date(m.createdAt).getTime();
            if (m.senderId !== readData.userId && readAt !== null && readAt >= messageAt) {
                const readBy = Array.from(new Set([...(m.readBy || []), readData.userId]));
                return { ...m, readBy };
            }
            return m;
        });
    }, []);

    const scrollToMessage = useCallback(async (messageId: string) => {
        const element = document.getElementById(`msg-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(messageId);
            setTimeout(() => setHighlightedMessageId(null), 1000);
        } else {
            // Jump to history context
            if (!token || !activeChatId) return;
            setIsLoadingMessages(true);
            try {
                const res = await api.chat.getChatMessages(activeChatId, token, { aroundId: messageId, limit: 30 });
                setMessages(res.data);
                setHasMoreMessages(res.hasMoreBefore ?? false);
                setHasMoreAfter(res.hasMoreAfter ?? false);
                setIsViewingHistory(res.hasMoreAfter ?? false);

                // Wait for render, then scroll to the specific item
                setTimeout(() => {
                    const el = document.getElementById(`msg-${messageId}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'instant', block: 'center' });
                        setHighlightedMessageId(messageId);
                        setTimeout(() => setHighlightedMessageId(null), 2500);
                    }
                }, 100);
            } catch (err) {
                console.error(err);
                dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Message not found in history', type: 'error' } });
            } finally {
                setIsLoadingMessages(false);
            }
        }
    }, [token, activeChatId]);

    useEffect(() => {
        unreadSinceScrollRef.current = unreadSinceScroll;
    }, [unreadSinceScroll]);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    const handleScroll = useCallback(() => {
        if (scrollFrameRef.current !== null) return;

        scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            if (!messagesContainerRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const atBottom = distanceFromBottom < 50;
            const shouldShowScrollToBottom = distanceFromBottom > clientHeight * 2;

            setIsAtBottom(prev => prev === atBottom ? prev : atBottom);
            setShowScrollToBottom(prev => prev === shouldShowScrollToBottom ? prev : shouldShowScrollToBottom);

            if (atBottom && unreadSinceScrollRef.current > 0) {
                setUnreadSinceScroll(0);
                const chatId = activeChatIdRef.current;
                const authToken = tokenRef.current;
                if (chatId && authToken) {
                    markAsReadGuard(chatId, '', authToken);
                }
            }
        });
    }, []);

    // Click outside to close participants
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (showParticipants && participantsRef.current && !participantsRef.current.contains(event.target as Node)) {
                const toggleBtn = document.getElementById('participants-toggle');
                if (toggleBtn && !toggleBtn.contains(event.target as Node)) {
                    setShowParticipants(false);
                }
            }
            // Close chat menu when clicking outside
            if (chatMenuOpenId) {
                const target = event.target as Node;
                const menuContainer = document.querySelector(`[data-chat-menu="${chatMenuOpenId}"]`);
                if (menuContainer && !menuContainer.contains(target)) {
                    setChatMenuOpenId(null);
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showParticipants, chatMenuOpenId]);

    // Track input composer height to adjust FAB and scroll padding dynamically
    const composerRef = useCallback((node: HTMLDivElement | null) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (node) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setComposerHeight((entry.target as HTMLElement).offsetHeight);
                }
            });
            observer.observe(node);
            observerRef.current = observer;
        }
    }, []);

    const readOnlyBannerRefCallback = useCallback((node: HTMLDivElement | null) => {
        if (readOnlyBannerObserverRef.current) {
            readOnlyBannerObserverRef.current.disconnect();
            readOnlyBannerObserverRef.current = null;
        }

        if (node) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setReadOnlyBannerHeight((entry.target as HTMLElement).offsetHeight);
                }
            });
            observer.observe(node);
            readOnlyBannerObserverRef.current = observer;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
            }
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
            if (readOnlyBannerObserverRef.current) {
                readOnlyBannerObserverRef.current.disconnect();
            }
        };
    }, []);


    // 1. Fetch Chat List
    const fetchChats = useCallback(async () => {
        if (!token) return;
        try {
            const data = await getUserChatsCached(token);
            setChats(data);
            setIsLoadingChats(false);
        } catch (err) {
            console.error(err);
            setIsLoadingChats(false);
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to load chats', type: 'error' } });
        }
    }, [token]);

    useEffect(() => {
        fetchChats();
    }, [token, fetchChats]);

    useEffect(() => {
        activeChatPreviewRef.current = activeChatId
            ? chats.find(chat => chat.id === activeChatId)
            : undefined;
    }, [activeChatId, chats]);

    // 2. Fetch Messages for Active Chat (Initial)
    const fetchInitialMessages = useCallback(async (chatId: string, targetMsgId?: string | null) => {
        if (!token) return;
        setIsLoadingMessages(true);
        setMessagesPage(1);
        setHasMoreMessages(true);
        setHasMoreAfter(false);
        setUnreadSinceScroll(0);
        setIsViewingHistory(false);

        try {
            let res: PaginatedResponse<ChatMessage>;
            if (targetMsgId) {
                res = await api.chat.getChatMessages(chatId, token, { limit: 35, aroundId: targetMsgId });
            } else {
                res = await api.chat.getChatMessages(chatId, token, { limit: 35, page: 1 });
            }

            const messagesData = res.data;
            setMessages(messagesData);
            setCachedMessages(chatId, messagesData);
            setHasMoreMessages(res.hasMoreBefore ?? (res.currentPage < res.totalPages));
            setHasMoreAfter(res.hasMoreAfter ?? false);
            setIsViewingHistory(res.hasMoreAfter ?? false);

            if (targetMsgId) {
                // When deep-linking, scroll to message and highlight
                setTimeout(() => {
                    scrollToMessage(targetMsgId);
                    setHighlightedMessageId(targetMsgId);
                    setTimeout(() => setHighlightedMessageId(null), 3000);
                    // Clear the target so subsequent loads of this chat don't jump
                    setTargetMessageId(null);
                }, 200);
            } else {
                setTimeout(() => scrollToBottom('instant'), 100);
            }

            markAsReadGuard(chatId, '', token);
            setChats(prev => prev.map(chat => chat.id === chatId ? { ...chat, unreadCount: 0 } : chat));
        } catch (err) {
            console.error(err);
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to load messages', type: 'error' } });
        } finally {
            setIsLoadingMessages(false);
        }
    }, [token, scrollToBottom, scrollToMessage]);

    useEffect(() => {
        if (!activeChatId) return;
        // Load cached messages if available, otherwise fetch
        const cachedMessages = getCachedMessages(activeChatId);
        const activeChatPreview = activeChatPreviewRef.current;
        if (!targetMessageId && !shouldRefreshCachedMessages(cachedMessages, activeChatPreview)) {
            setMessages(cachedMessages);
            setIsLoadingMessages(false);
            setTimeout(() => scrollToBottom('instant'), 100);
        } else {
            fetchInitialMessages(activeChatId, targetMessageId);
        }
    }, [activeChatId, fetchInitialMessages, targetMessageId, scrollToBottom]);

    useEffect(() => {
        let cancelled = false;

        hydrateCachedComposerStates().then((hydratedStates) => {
            if (cancelled) return;
            setChatComposerStates((currentStates) => ({
                ...hydratedStates,
                ...currentStates,
            }));
            setIsComposerStateHydrated(true);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    // Sync chatComposerStates to persistent composer cache whenever it changes.
    // Message/chat lists intentionally stay out of durable storage.
    useEffect(() => {
        if (!isComposerStateHydrated) return;
        setCachedComposerStates(chatComposerStates);
    }, [chatComposerStates, isComposerStateHydrated]);

    // Sync messages state to cache whenever it changes
    useEffect(() => {
        if (activeChatId && messages.length > 0) {
            setCachedMessages(activeChatId, messages);
        }
    }, [messages, activeChatId]);

    useEffect(() => {
        const unread = chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
        dispatchRef.current({ type: 'STATS_SET_CHAT', payload: { unread } });
    }, [chats]);

    // Presence: subscribe to presence:update (global — doesn't depend on active chat)
    useEffect(() => {
        if (!subscribe) return;

        const unsubscribePresenceUpdate = subscribe('presence:update', (payload: unknown) => {
            const event = payload as PresenceUpdateEvent;
            setOnlineUsers(prev => updateOnlineUsersFromPresenceEvent(prev, event));
            if (!event.isOnline) {
                setTypingByChatId(prev => removeTypingUserFromAllChats(prev, event.userId));
            }
            // Update participant lastSeenAt in all chats
            if (event.lastSeenAt) {
                setChats(prev => prev.map(chat => ({
                    ...chat,
                    participants: chat.participants?.map(p =>
                        p.userId === event.userId ? { ...p, lastSeenAt: event.lastSeenAt } : p
                    )
                })));
            }
        });

        return () => unsubscribePresenceUpdate();
    }, [subscribe]);

    // Presence: subscribe to presence:state (response to our request)
    useEffect(() => {
        if (!subscribe) return;

        const unsubscribePresenceState = subscribe('presence:state', (payload: unknown) => {
            const event = payload as PresenceStateEvent;
            setOnlineUsers(prev => updateOnlineUsersFromPresenceState(prev, event));
        });

        return () => unsubscribePresenceState();
    }, [subscribe]);

    // Typing: subscribe to typing events (global — doesn't depend on active chat)
    useEffect(() => {
        if (!subscribe) return;

        const unsubscribeTyping = subscribe('chat:typing', (payload: unknown) => {
            const event = payload as ChatTypingEvent;
            setTypingByChatId(prev => updateChatTypingState(prev, event));
        });

        return () => unsubscribeTyping();
    }, [subscribe]);

    // Typing: stop typing on unmount or chat switch
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
            if (typingChatIdRef.current && emit) {
                emit('chat:typing', { chatId: typingChatIdRef.current, isTyping: false });
                typingChatIdRef.current = null;
            }
        };
    }, [activeChatId, emit]);

    const loadEarlierMessages = async () => {
        if (!token || !activeChatId || isLoadingMore || !hasMoreMessages) return;

        const container = messagesContainerRef.current;
        const previousScrollHeight = container?.scrollHeight || 0;

        setIsLoadingMore(true);

        try {
            let res: PaginatedResponse<ChatMessage>;
            if (isViewingHistory && messages.length > 0) {
                // Fetch context before the first message
                res = await api.chat.getChatMessages(activeChatId, token, {
                    limit: 35,
                    aroundId: messages[0].id
                });
                setMessages(prev => mergeUniqueMessages(prev, res.data, 'prepend'));
                setHasMoreMessages(res.hasMoreBefore ?? false);
            } else {
                const nextPage = messagesPage + 1;
                res = await api.chat.getChatMessages(activeChatId, token, { limit: 35, page: nextPage });
                setMessages(prev => mergeUniqueMessages(prev, res.data, 'prepend'));
                setMessagesPage(nextPage);
                setHasMoreMessages(res.hasMoreBefore ?? (res.currentPage < res.totalPages));
            }

            // Preserve scroll position
            setTimeout(() => {
                if (container) {
                    container.scrollTop = container.scrollHeight - previousScrollHeight;
                }
            }, 0);
        } catch (err) {
            console.error('Failed to load more messages', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const loadNewerMessages = async () => {
        if (!token || !activeChatId || isLoadingNewer || !hasMoreAfter || messages.length === 0) return;

        setIsLoadingNewer(true);
        try {
            const res = await api.chat.getChatMessages(activeChatId, token, {
                limit: 35,
                aroundId: messages[messages.length - 1].id
            });
            setMessages(prev => mergeUniqueMessages(prev, res.data, 'append'));
            setHasMoreAfter(res.hasMoreAfter ?? false);
            setIsViewingHistory(res.hasMoreAfter ?? false);
        } catch (err) {
            console.error('Failed to load newer messages', err);
        } finally {
            setIsLoadingNewer(false);
        }
    };

    // 3. Setup socket listen
    useEffect(() => {
        if (!subscribe || !token || !user) return;

        const unsubMessage = subscribe('chat:message', (newMsg: unknown) => {
            const message = newMsg as ChatMessage & { sender?: User };

            // Always update cached messages for the chat, regardless of active chat
            // This ensures messages are available when switching to that chat later
            const cachedMessages = getCachedMessages(message.chatId);
            const updatedCached = reconcileIncomingMessage(cachedMessages, message, user.id, null);
            setCachedMessages(message.chatId, updatedCached);

            if (message.chatId === activeChatId) {
                setMessages(prev => {
                    const pendingId = message.senderId === user.id ? pendingMessageIdRef.current : null;
                    const next = reconcileIncomingMessage(prev, message, user.id, pendingId);
                    if (pendingId && next !== prev) {
                        pendingMessageIdRef.current = null;
                    }
                    return next;
                });

                // Smart scroll: only scroll if user is already at the bottom
                // Also track unread messages if user is scrolled up
                if (isAtBottom || message.senderId === user.id) {
                    setTimeout(() => scrollToBottom(message.senderId === user.id ? 'instant' : 'smooth'), 50);
                } else {
                    setUnreadSinceScroll(prev => prev + 1);
                }

                if (message.senderId !== user.id) {
                    // Recipient marks the message as read immediately
                    markAsReadGuard(activeChatId, message.id, token);
                }
            }

            setChats(prevChats => {
                const chatIndex = prevChats.findIndex(c => c.id === message.chatId);
                if (chatIndex > -1) {
                    const updatedChat = {
                        ...prevChats[chatIndex],
                        updatedAt: new Date().toISOString(),
                        messages: [message],
                        unreadCount: (message.chatId !== activeChatId && message.senderId !== user.id)
                            ? (prevChats[chatIndex].unreadCount || 0) + 1
                            : 0
                    };
                    const newChats = [...prevChats];
                    newChats.splice(chatIndex, 1);
                    return [updatedChat, ...newChats];
                }

                // Chat not in list — fetch full chat data from API to avoid stale/missing fields
                if (token) {
                    api.chat.getChat(message.chatId, token).then((fullChat: Chat) => {
                        setChats(prev => {
                            if (prev.some(c => c.id === fullChat.id)) return prev;
                            return [{ ...fullChat, messages: [message], unreadCount: message.senderId !== user.id ? 1 : 0 }, ...prev];
                        });
                    }).catch(() => {
                        // Fallback: insert lightweight placeholder
                        insertOrUpdateChatFromMessage(message);
                        const cached = getCachedChats();
                        if (cached) setChats(cached);
                    });
                }
                return prevChats;
            });
        });

        const unsubRead = subscribe('chat:read', (data: unknown) => {
            const readData = data as { chatId: string; userId: string; messageId: string };
            // Update messages if chat is active
            if (readData.chatId === activeChatId) {
                setMessages(prev => updateMessagesWithReadStatus(prev, readData));
            }
            // Update unread count for the current user
            if (readData.userId === user.id) {
                setChats(prev => prev.map(c => {
                    if (c.id === readData.chatId) {
                        return { ...c, unreadCount: 0 };
                    }
                    return c;
                }));
            }
            // Update chat list messages for read status (for sender to see double ticks)
            setChats(prev => prev.map(c => {
                if (c.id === readData.chatId && c.messages?.[0]) {
                    if (c.messages[0].senderId === user.id && readData.userId !== user.id) {
                        // This is the sender's message being read by someone else
                        const readBy = Array.from(new Set([...(c.messages[0].readBy || []), readData.userId]));
                        return { ...c, messages: [{ ...c.messages[0], readBy }] };
                    }
                }
                return c;
            }));
            // Update cached messages for the chat so read status persists
            const cachedMessages = getCachedMessages(readData.chatId);
            if (cachedMessages.length > 0) {
                const updatedMessages = updateMessagesWithReadStatus(cachedMessages, readData);
                setCachedMessages(readData.chatId, updatedMessages);
            }
        });

        const unsubDelete = subscribe('chat:message:delete', (deletedMsg: unknown) => {
            const message = deletedMsg as ChatMessage;
            if (message.chatId === activeChatId) {
                setMessages(prev => prev.map(m => m.id === message.id ? { ...m, ...message } : m));
            }
            setChats(prev => prev.map(c => {
                if (c.id === message.chatId && c.messages?.[0]?.id === message.id) {
                    return { ...c, messages: [{ ...c.messages[0], ...message }] };
                }
                return c;
            }));
        });

        const unsubEdit = subscribe('chat:message:edit', (editedMsg: unknown) => {
            const message = editedMsg as ChatMessage;
            if (message.chatId === activeChatId) {
                setMessages(prev => prev.map(m => m.id === message.id ? { ...m, ...message } : m));
            }
            setChats(prev => prev.map(c => {
                if (c.id === message.chatId && c.messages?.[0]?.id === message.id) {
                    return { ...c, messages: [{ ...c.messages[0], ...message }] };
                }
                return c;
            }));
        });

        const unsubUpdate = subscribe('chat:update', (updatedChat: unknown) => {
            const chat = updatedChat as Chat;
            setChats(prev => {
                const existingIndex = prev.findIndex(c => c.id === chat.id);
                if (existingIndex !== -1) {
                    // Update existing chat
                    const newChats = [...prev];
                    newChats[existingIndex] = { ...newChats[existingIndex], ...chat };
                    return newChats;
                } else {
                    // Add new chat to the list
                    return [chat, ...prev];
                }
            });
        });

        const unsubRoomLeft = subscribe('roomLeft', (data: unknown) => {
            const leftData = data as { roomId: string; forced?: boolean };
            if (leftData.forced && leftData.roomId === `chat:${activeChatId}`) {
                dispatchRef.current({
                    type: 'TOAST_ADD',
                    payload: { message: 'You have been removed from this group.', type: 'info' }
                });
                closeActiveChat();
                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, isActive: false } : c));
            }
        });

        return () => {
            unsubMessage();
            unsubRead();
            unsubDelete();
            unsubEdit();
            unsubUpdate();
            unsubRoomLeft();
        };
    }, [subscribe, activeChatId, token, user, closeActiveChat, isAtBottom, scrollToBottom, updateMessagesWithReadStatus]);

    // 4. Join/Leave rooms, Sync URL, and request presence
    useEffect(() => {
        if (!activeChatId) return;

        // Join the room
        if (joinRoom && leaveRoom) {
            joinRoom(`chat:${activeChatId}`);

            // Request online presence AFTER joining the room
            if (emit) {
                // Small delay to ensure join is processed server-side first
                const presenceTimer = setTimeout(() => {
                    emit('presence:request', { chatId: activeChatId });
                }, 300);
                // Update URL without full page reload, clear msgId
                const url = new URL(window.location.href);
                url.searchParams.set('id', activeChatId);
                url.searchParams.delete('msgId');
                if (!isDesktop && activeChatHistoryRef.current !== activeChatId) {
                    window.history.pushState({ eduverseChatId: activeChatId }, '', url.toString());
                    activeChatHistoryRef.current = activeChatId;
                } else {
                    window.history.replaceState({ eduverseChatId: activeChatId }, '', url.toString());
                }

                return () => {
                    clearTimeout(presenceTimer);
                    leaveRoom(`chat:${activeChatId}`);
                };
            }

            // Update URL without full page reload, clear msgId
            const url = new URL(window.location.href);
            url.searchParams.set('id', activeChatId);
            url.searchParams.delete('msgId');
            if (!isDesktop && activeChatHistoryRef.current !== activeChatId) {
                window.history.pushState({ eduverseChatId: activeChatId }, '', url.toString());
                activeChatHistoryRef.current = activeChatId;
            } else {
                window.history.replaceState({ eduverseChatId: activeChatId }, '', url.toString());
            }

            return () => leaveRoom(`chat:${activeChatId}`);
        }
    }, [activeChatId, isDesktop, joinRoom, leaveRoom, emit]);

    useBackStackEntry({
        enabled: mounted && !isDesktop && !!activeChatId,
        label: 'Active chat',
        priority: 40,
        onBack: () => closeActiveChat({ fromHistory: true }),
    });

    useBackStackEntry({
        enabled: mounted && !isDesktop && !!chatMenuOpenId,
        label: 'Chat menu',
        priority: 70,
        onBack: () => setChatMenuOpenId(null),
    });

    useBackStackEntry({
        enabled: mounted && !isDesktop && showParticipants,
        label: 'Participants panel',
        priority: 80,
        onBack: () => setShowParticipants(false),
    });

    useBackStackEntry({
        enabled: mounted && !isDesktop && showMentionDropdown,
        label: 'Mention picker',
        priority: 90,
        onBack: () => setShowMentionDropdown(false),
    });

    useBackStackEntry({
        enabled: mounted && !isDesktop && !!contextMenu,
        label: 'Message actions',
        priority: 120,
        onBack: () => setContextMenu(null),
    });

    // 5. Image click handler for thumbnails
    useEffect(() => {
        // Attach a document-level click handler and filter clicks that originate from images
        const handleImageClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            // Find the nearest <img> element from the event target (covers clicks on children)
            const imgEl = (target.closest && (target.closest('img') as HTMLImageElement | null)) || (target.tagName === 'IMG' ? (target as HTMLImageElement) : null);
            if (!imgEl) return;

            // Ensure the image is inside the messages container and is a markdown image
            if (messagesContainerRef.current && messagesContainerRef.current.contains(imgEl) && imgEl.classList.contains('markdown-image')) {
                const imgSrc = imgEl.src;
                if (imgSrc) setPreviewImageUrl(imgSrc);
            }
        };

        document.addEventListener('click', handleImageClick);
        return () => document.removeEventListener('click', handleImageClick);
    }, []);

    const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);
    const activeParticipants = useMemo(
        () => activeChat?.participants?.filter(p => p.isActive) || [],
        [activeChat?.participants]
    );
    const activeChatComposerState = useMemo(
        () => getChatComposerState(chatComposerStates, activeChatId),
        [chatComposerStates, activeChatId]
    );
    const directChatTarget = useMemo(
        () => getDirectChatTarget(activeChat, user?.id),
        [activeChat, user?.id]
    );
    const typingUsers = useMemo(
        () => getTypingUsersForChat(typingByChatId, activeChatId, user?.id),
        [typingByChatId, activeChatId, user?.id]
    );
    const typingIndicatorLabel = useMemo(
        () => getTypingIndicatorLabel(activeChat, typingUsers),
        [activeChat, typingUsers]
    );
    const { messageDraft, stagedFiles, replyToMessage, editingMessage, mentionedUsers } = activeChatComposerState;
    const [stagedFilePreviewUrls, setStagedFilePreviewUrls] = useState<Array<string | null>>([]);

    useEffect(() => {
        const urls = stagedFiles.map(file => file instanceof File && file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
        setStagedFilePreviewUrls(urls);

        return () => {
            urls.forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, [stagedFiles]);

    // Check if user can send messages (not read-only or has admin/mod role)
    const currentUserParticipant = useMemo(
        () => activeChat?.participants?.find(p => p.userId === user?.id),
        [activeChat, user?.id]
    );
    const canSendMessage = useMemo(() => {
        if (!activeChat || !currentUserParticipant) return false;
        // Direct chats should never be read-only
        if (activeChat.type === ChatType.DIRECT) return true;
        if (!activeChat.readOnly) return true;
        // In read-only mode, only ADMIN and MOD can send messages
        return currentUserParticipant.role === ChatParticipantRole.ADMIN || currentUserParticipant.role === ChatParticipantRole.MOD;
    }, [activeChat, currentUserParticipant]);

    // Typing: emit typing status with debounce
    const emitTypingStart = useCallback(() => {
        if (!emit || !activeChatId) return;

        // If switching chats, stop typing on old chat first
        if (typingChatIdRef.current && typingChatIdRef.current !== activeChatId) {
            emit('chat:typing', { chatId: typingChatIdRef.current, isTyping: false });
            typingChatIdRef.current = null;
        }

        // Emit start-typing if not already typing in this chat
        if (typingChatIdRef.current !== activeChatId) {
            emit('chat:typing', { chatId: activeChatId, isTyping: true });
            typingChatIdRef.current = activeChatId;
        }

        // Reset the inactivity timer — stop typing after 5s of no input
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (typingChatIdRef.current && emit) {
                emit('chat:typing', { chatId: typingChatIdRef.current, isTyping: false });
                typingChatIdRef.current = null;
            }
        }, 5000);
    }, [activeChatId, emit]);

    const emitTypingStop = useCallback(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        if (typingChatIdRef.current && emit) {
            emit('chat:typing', { chatId: typingChatIdRef.current, isTyping: false });
            typingChatIdRef.current = null;
        }
    }, [emit]);

    const handleDeleteChat = async (chatId: string) => {
        if (!token || !user?.id) return;

        try {
            await api.chat.updateLocalState(chatId, { hide: true }, token);
            // Remove the chat from the local state
            setChats(prev => prev.filter(c => c.id !== chatId));
            // If the deleted chat was active, clear it
            if (activeChatId === chatId) {
                closeActiveChat();
                setMessages([]);
            }
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Chat removed from view', type: 'success' } });
        } catch (err) {
            console.error('Failed to delete chat:', err);
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to delete chat', type: 'error' } });
        }
    };

    const performClearChatHistory = async (chatId: string) => {
        if (!token || !user?.id) return;

        try {
            await api.chat.updateLocalState(chatId, { clear: true }, token);

            // 1. Clear session cache regardless of active chat
            setCachedMessages(chatId, []);

            // 2. Clear messages in UI if active
            if (activeChatId === chatId) {
                setMessages([]);
            }

            // 3. Update optimistic clearedAt in chat list
            const now = new Date().toISOString();
            setChats(prev => prev.map(c => {
                if (c.id === chatId) {
                    return {
                        ...c,
                        unreadCount: 0,
                        participants: c.participants?.map(p =>
                            p.userId === user.id ? { ...p, clearedAt: now } : p
                        )
                    };
                }
                return c;
            }));
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Chat history cleared', type: 'success' } });
        } catch (err) {
            console.error('Failed to clear chat history:', err);
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to clear chat history', type: 'error' } });
        }
    };

    const handleClearChatHistory = (chatId: string, chatName?: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Clear Chat History',
            description: `Are you sure you want to clear all messages ${chatName ? `for "${chatName}"` : 'in this chat'}? This action cannot be undone.`,
            isDestructive: true,
            onConfirm: () => performClearChatHistory(chatId)
        });
    };

    const filteredChats = useMemo(() => {
        let result = chats;

        // Visibility / Revival logic
        result = result.filter(chat => {
            const myParticipant = chat.participants?.find(p => p.userId === user?.id);
            // Check both on participant and on chat (in case of partial updates)
            const hiddenAt = myParticipant?.hiddenAt || (chat as Chat & { hiddenAt?: string | Date | null }).hiddenAt;
            if (!hiddenAt) return true;

            const latestMsg = chat.messages?.[0];
            if (!latestMsg) return false;

            return new Date(latestMsg.createdAt) > new Date(hiddenAt);
        });

        // Filter by group type
        if (activeGroupFilter === 'groups') {
            result = result.filter(chat => chat.type === ChatType.GROUP);
        } else if (activeGroupFilter === 'dms') {
            result = result.filter(chat => chat.type === ChatType.DIRECT);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(chat => {
                if (chat.type === ChatType.GROUP) {
                    return (chat.name || '').toLowerCase().includes(lowerQuery);
                }
                const otherUser = chat.participants?.find(p => p.userId !== user?.id)?.user;
                return (otherUser?.name || '').toLowerCase().includes(lowerQuery) ||
                    (otherUser?.email || '').toLowerCase().includes(lowerQuery);
            });
        }

        return result;
    }, [chats, searchQuery, user?.id, activeGroupFilter]);

    const activeChatParticipantIds = useMemo(() => activeParticipants.map(p => p.userId), [activeParticipants]);

    const updateComposerStateForChat = useCallback((chatId: string | null, patch: Parameters<typeof updateChatComposerState>[2]) => {
        setChatComposerStates(prev => updateChatComposerState(prev, chatId, patch));
    }, []);

    const updateActiveComposerState = useCallback((patch: Parameters<typeof updateChatComposerState>[2]) => {
        updateComposerStateForChat(activeChatId, patch);
    }, [activeChatId, updateComposerStateForChat]);

    const filteredMembers = useMemo(() => {
        if (!activeChat || activeChat.type !== ChatType.GROUP) return [];
        const members = activeChat.participants?.filter(p => p.isActive && p.userId !== user?.id) || [];
        if (!mentionSearchQuery) return members;
        return members.filter(m =>
            m.user?.name?.toLowerCase().includes(mentionSearchQuery.toLowerCase())
        );
    }, [activeChat, mentionSearchQuery, user?.id]);

    const handleSelectMember = useCallback((member: ChatParticipant) => {
        if (!member.user || !member.user.name) return;
        const textBefore = messageDraft.slice(0, mentionCursorIndex);
        const textAfter = messageDraft.slice(textareaRef.current?.selectionStart || mentionCursorIndex + 1 + mentionSearchQuery.length);

        // Ensure exactly one trailing space
        const spaceSuffix = ' ';
        const safeName = (member.user.name || '').replace(/`/g, '\\`');
        const newText = `${textBefore}\`@${safeName}\`${spaceSuffix}${textAfter.trimStart()}`;

        updateActiveComposerState({
            messageDraft: newText,
            mentionedUsers: [...mentionedUsers.filter(u => u.id !== (member.user?.id || member.userId)), member.user]
        });
        setShowMentionDropdown(false);
        setMentionSearchQuery('');

        // Focus back
        setTimeout(() => {
            const el = textareaRef.current;
            if (el) {
                el.focus();
                const newPos = textBefore.length + member.user!.name!.length + 3; // +2 for backticks, +1 for @
                el.setSelectionRange(newPos + 1, newPos + 1); // +1 to put cursor AFTER the added space
            }
        }, 10);
    }, [messageDraft, mentionCursorIndex, mentionSearchQuery, mentionedUsers, updateActiveComposerState]);

    useEffect(() => {
        if (showMentionDropdown && mentionDropdownRef.current && mentionSelectedIndex >= 0) {
            const container = mentionDropdownRef.current;
            const children = container.querySelectorAll('.mention-item');
            const activeItem = children[mentionSelectedIndex] as HTMLElement | null;
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [mentionSelectedIndex, showMentionDropdown]);

    const renderMentionDropdown = (placement: 'desktop' | 'mobile') => {
        if (!showMentionDropdown || filteredMembers.length === 0) return null;

        const isMobile = placement === 'mobile';

        return (
            <div
                className={[
                    isMobile
                        ? 'fixed inset-x-3 mx-auto max-w-md'
                        : 'absolute bottom-full left-0 mb-2 w-64 max-w-[calc(100vw-2rem)]',
                    'bg-card border border-border rounded-xl shadow-2xl z-500 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200'
                ].join(' ')}
                style={isMobile ? { bottom: `calc(${composerHeight}px + 0.5rem)` } : undefined}
            >
                <div className="p-1.5 sm:p-2 border-b border-border">
                    <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground tracking-wider px-2">
                        Group Members
                    </p>
                </div>
                <div
                    ref={mentionDropdownRef}
                    className="max-h-56 sm:max-h-60 overflow-y-auto py-1 custom-scrollbar"
                >
                    {filteredMembers.map((member, idx) => (
                        <button
                            key={member.userId}
                            type="button"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                handleSelectMember(member);
                            }}
                            className={`mention-item w-full flex items-center space-x-2 sm:space-x-3 px-2.5 sm:px-3 py-2 transition-colors ${idx === mentionSelectedIndex ? 'bg-primary/10' : 'hover:bg-muted'}`}
                        >
                            <ChatAvatar targetUser={member.user} className="w-7 h-7" isOnline={!!onlineUsers[member.userId]} />
                            <div className="text-left min-w-0 flex-1">
                                <p className="text-[12px] sm:text-[13px] font-semibold text-foreground truncate">{member.user?.name}</p>
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground capitalize truncate">{member.user?.role?.toLowerCase().replace('_', ' ')}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const handleSendMessage = useCallback(async (retryMessage?: ChatMessageWithMeta) => {
        const chatId = activeChatId;
        const draftText = retryMessage?.retryPayload?.draftText ?? messageDraft.trim();
        const filesToSend = retryMessage?.retryPayload?.stagedFiles ?? stagedFiles;
        const replyTarget = retryMessage?.retryPayload?.replyToMessage ?? replyToMessage;

        if (!token || !user || !chatId || (!draftText && filesToSend.length === 0)) return;
        if (sendLockRef.current || isSending || isUploading) return;
        sendLockRef.current = true;
        emitTypingStop();
        try {
            setIsSending(true);
            let tempMessageId = retryMessage?.id;
            const isRetry = !!retryMessage;
            const organizationId = user?.organizationId ?? user?.orgId ?? null;

            if (!editingMessage) {
                if (!tempMessageId) {
                    tempMessageId = `temp-${Date.now()}`;
                    // OPTIMISTIC ATTACHMENTS: Use shared helper for identical local markdown
                    const optimisticAttachments = buildOptimisticAttachmentMarkdown(filesToSend);

                    const optimisticContent = (optimisticAttachments + (draftText ? `\n${draftText}` : '')).trim();
                    const optimisticMessage: ChatMessageWithMeta = {
                        id: tempMessageId,
                        chatId,
                        senderId: user.id,
                        organizationId,
                        content: optimisticContent || 'Sent an attachment',
                        type: ChatMessageType.TEXT,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        replyToId: replyTarget?.id || null,
                        replyTo: replyTarget || null,
                        clientStatus: 'sending',
                        retryPayload: {
                            draftText,
                            stagedFiles: [...filesToSend],
                            replyToMessage: replyTarget || null,
                            mentionedUsers: [...mentionedUsers]
                        }
                    };
                    setMessages(prev => [...prev, optimisticMessage]);
                    setTimeout(() => scrollToBottom('instant'), 0);
                } else if (isRetry) {
                    setMessages(prev => prev.map(msg => msg.id === tempMessageId ? {
                        ...msg,
                        clientStatus: 'sending',
                        retryPayload: {
                            draftText,
                            stagedFiles: [...filesToSend],
                            replyToMessage: replyTarget || null,
                            mentionedUsers: [...mentionedUsers]
                        }
                    } : msg));
                }
                pendingMessageIdRef.current = tempMessageId;
            }

            if (!isRetry) {
                updateComposerStateForChat(chatId, {
                    messageDraft: '',
                    replyToMessage: null,
                    stagedFiles: [],
                });
            }

            let finalContent = draftText;

            if (filesToSend.length > 0) {
                setIsUploading(true);
                // PLATFORM ADMIN FIX: Platform admins don't have an orgId. 
                // Fallback to active chat's orgId or 'platform' literal for global/system chats.
                const orgId = user?.organizationId ?? user?.orgId ?? activeChat?.organizationId ?? 'platform';

                const uploadResults = await Promise.all(
                    filesToSend.map(file => api.files.uploadFile(orgId, 'chat', chatId, file, token))
                );

                const attachmentLinks = buildAttachmentMarkdown(filesToSend, uploadResults);

                finalContent = (attachmentLinks + (draftText ? `\n${draftText}` : '')).trim();
                setIsUploading(false);
            }

            if (editingMessage) {
                await api.chat.editMessage(chatId, editingMessage.id, finalContent, token);
                updateComposerStateForChat(chatId, { editingMessage: null });
            } else {
                const mentionedUserIds = mentionedUsers.map(u => u.id);
                const sentMessage = await api.chat.sendMessage(chatId, finalContent || 'Sent an attachment', token, replyTarget?.id || undefined, mentionedUserIds);
                updateComposerStateForChat(chatId, { mentionedUsers: [] });
                if (tempMessageId) {
                    setMessages(prev => reconcileIncomingMessage(prev, sentMessage, user.id, tempMessageId));
                }
                pendingMessageIdRef.current = null;
                setChats(prev => prev.map(chat => chat.id === chatId ? {
                    ...chat,
                    updatedAt: sentMessage.createdAt,
                    messages: [sentMessage]
                } : chat));
            }

            // Reset textarea size back to single-line after sending
            setTimeout(() => {
                const ta = textareaRef.current as unknown as HTMLTextAreaElement | null;
                if (ta) {
                    ta.style.height = 'auto';
                    try { ta.setSelectionRange(0, 0); } catch { /* ignore */ }
                    ta.rows = 1;
                }
            }, 0);
            setTimeout(() => {
                const ta = textareaRef.current as unknown as HTMLTextAreaElement | null;
                ta?.focus();
            }, 0);
            // sender's own message — no need to call markAsRead here (guarded elsewhere)
        } catch (err) {
            console.error(err);
            const error = err as Error;
            const failedMessageId = retryMessage?.id ?? pendingMessageIdRef.current;
            pendingMessageIdRef.current = null;
            if (!editingMessage && failedMessageId) {
                setMessages(prev => prev.map(msg => msg.id === failedMessageId ? {
                    ...msg,
                    clientStatus: 'failed',
                    retryPayload: {
                        draftText,
                        stagedFiles: [...filesToSend],
                        replyToMessage: replyTarget || null,
                        mentionedUsers: [...mentionedUsers]
                    }
                } : msg));
            }
            setIsUploading(false);
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: error.message || 'Failed to send message', type: 'error' } });
        } finally {
            sendLockRef.current = false;
            setIsSending(false);
        }
    }, [messageDraft, stagedFiles, replyToMessage, mentionedUsers, token, user, activeChatId, activeChat?.organizationId, isSending, isUploading, editingMessage, scrollToBottom, updateComposerStateForChat, emitTypingStop]);

    const handleDeleteMessage = useCallback((messageId: string) => {
        if (!token || !activeChatId) return;

        // Check if this is a failed message (client-side only)
        const failedMessage = messages.find(m => m.id === messageId && m.clientStatus === 'failed');

        setConfirmConfig({
            isOpen: true,
            title: 'Delete Message?',
            description: 'Are you sure you want to delete this message? This action cannot be undone.',
            isDestructive: true,
            onConfirm: async () => {
                if (failedMessage) {
                    // For failed messages, just remove from local state
                    setMessages(prev => prev.filter(m => m.id !== messageId));
                } else {
                    // For normal messages, call the API
                    try {
                        await api.chat.deleteMessage(activeChatId, messageId, token);
                    } catch (err) {
                        console.error(err);
                        dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to delete message', type: 'error' } });
                    }
                }
            }
        });
    }, [token, activeChatId, messages]);

    const handleRemoveParticipant = (participantUserId: string) => {
        if (!token || !activeChatId) return;

        const participantName = activeChat?.participants?.find(p => p.userId === participantUserId)?.user?.name || 'this participant';

        setConfirmConfig({
            isOpen: true,
            title: 'Remove Participant?',
            description: `Are you sure you want to remove ${participantName} from the group?`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await api.chat.removeParticipant(activeChatId, participantUserId, token);
                    dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Participant removed', type: 'success' } });
                    fetchChats();
                } catch (err) {
                    console.error(err);
                    dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to remove participant', type: 'error' } });
                }
            }
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const chatId = activeChatId;
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        if (!chatId) return;

        const validFiles = filterValidFiles(files);

        if (validFiles.length < files.length) {
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Some attachments were skipped because the file type is not allowed.', type: 'info' } });
        }
        if (validFiles.length === 0) {
            e.target.value = '';
            return;
        }

        if (stagedFiles.length + validFiles.length > 5) {
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Maximum 5 attachments allowed', type: 'info' } });
            return;
        }

        updateComposerStateForChat(chatId, {
            stagedFiles: [...stagedFiles, ...validFiles]
        });
        e.target.value = '';
    };

    const removeStagedFile = (index: number) => {
        updateActiveComposerState({
            stagedFiles: stagedFiles.filter((_, i) => i !== index)
        });
    };

    const handleChatCreated = (newChatId: string) => {
        setActiveChatId(newChatId);
        fetchChats();
    };


    useEffect(() => {
        if (highlightedMessageId) {
            const timer = setTimeout(() => setHighlightedMessageId(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [highlightedMessageId]);

    const handleReply = useCallback((msg: ChatMessageWithMeta) => {
        if (msg.clientStatus === 'failed') return;
        updateActiveComposerState({
            replyToMessage: msg,
            editingMessage: null
        });
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 50);
    }, [updateActiveComposerState]);

    const handleEditMessage = useCallback((msg: ChatMessageWithMeta) => {
        if (msg.clientStatus === 'failed') return;
        updateActiveComposerState({
            editingMessage: msg,
            replyToMessage: null,
            messageDraft: msg.content
        });
        requestAnimationFrame(() => {
            const el = document.querySelector('textarea');
            if (el) {
                el.focus();
                const length = el.value.length;
                el.scrollTop = el.scrollHeight;
                el.setSelectionRange(length, length);
            }
        });

    }, [updateActiveComposerState]);


    const handleCopyText = useCallback((msg: ChatMessage) => {
        navigator.clipboard.writeText(msg.content).then(() => {
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Message text copied to clipboard', type: 'success' } });
        }).catch(err => {
            console.error('Failed to copy text', err);
            dispatchRef.current({ type: 'TOAST_ADD', payload: { message: 'Failed to copy text', type: 'error' } });
        });
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isDesktop && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (sendLockRef.current || isSending || isUploading) return;
            void handleSendMessage();
        }
    };


    const handleEditorFocus = () => {
        if (token && activeChatId) {
            markAsReadGuard(activeChatId, '', token);
            setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, unreadCount: 0 } : c));
        }
    };

    // Keep textarea height in sync when programmatically changing its value
    useEffect(() => {
        const ta = textareaRef.current as unknown as HTMLTextAreaElement | null;
        if (!ta) return;
        try {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 250) + 'px';
        } catch (err) {
            console.error(err);
        }
    }, [messageDraft]);

    const isGroupAdmin = useMemo(() => {
        if (!activeChat || !user) return false;
        if (user.role === Role.ORG_ADMIN) return true;
        return activeChat.creatorId === user.id;
    }, [activeChat, user]);

    const handleDownload = useCallback(async (e: React.MouseEvent, url: string, name: string) => {
        e.stopPropagation();
        try {
            await downloadFile(url, name || 'download');
        } catch (error) {
            console.error('Failed to download file:', error);
        }
    }, []);

    const activeParticipantsOnline = useMemo(() => {
        if (!activeChat?.participants) return {};
        const statuses: Record<string, boolean> = {};
        for (const p of activeChat.participants) {
            statuses[p.userId] = !!onlineUsers[p.userId];
        }
        return statuses;
    }, [activeChat?.participants, onlineUsers]);

    const renderedMessages = useMemo(() => {
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

        messages.forEach((msg, i) => {
            const dateLabel = formatChatDateLabel(msg.createdAt);
            if (dateLabel !== currentDateLabel) {
                flushCurrentDateSection();
                currentDateLabel = dateLabel;
            }

        if (msg.type === ChatMessageType.SYSTEM) {
            currentDateMessages.push(
                <div key={msg.id}>
                    <div className="flex justify-center py-2 px-3">
                        <div className="bg-muted/50 backdrop-blur-sm text-muted-foreground px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider border border-border/30 shadow-sm flex items-center gap-2">
                            <span>{msg.content}</span>
                            <span className="opacity-40 text-[10px]">{formatChatTimestamp(msg.createdAt)}</span>
                        </div>
                    </div>
                </div>
            );
            return;
        }

        const isMine = msg.senderId === user?.id;
        const showAvatar = !isMine && (i === 0 || messages[i - 1].senderId !== msg.senderId || messages[i - 1].type === ChatMessageType.SYSTEM);
        const isLastInGroup = i === messages.length - 1 || messages[i + 1].senderId !== msg.senderId || messages[i + 1].type === ChatMessageType.SYSTEM;
        const isDeleted = !!msg.deletedAt;
        const isSendingMessage = msg.clientStatus === 'sending';
        const isFailedMessage = msg.clientStatus === 'failed';
        const isMineRepliedTo = msg.replyTo?.senderId === user?.id;

        currentDateMessages.push(
            <div key={msg.id}>
                <div
                    id={`msg-${msg.id}`}
                    onContextMenu={(e) => {
                        if (!isDeleted) {
                            e.preventDefault();
                            setContextMenu({ msg, x: e.clientX, y: e.clientY });
                        }
                    }}
                    {...getLongPressHandlers({
                        isDesktop,
                        itemId: msg.id,
                        onLongPress: () => {
                            if (!isDeleted) {
                                setContextMenu({ msg, x: 0, y: 0 });
                            }
                        }
                    }, touchTimerRef, touchStartPosRef, touchHasTriggeredRef)}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} group/msg relative ${isLastInGroup ? 'mb-4' : 'mb-1'} px-3 md:px-5 -mx-3 md:-mx-5 transition-colors ${highlightedMessageId === msg.id || contextMenu?.msg.id === msg.id ? 'bg-primary/25 rounded-xl' : ''}`}
                >
                    {!isMine && (
                        <div className="w-7 shrink-0 mr-2 flex flex-col justify-end mb-1">
                            {isLastInGroup && <ChatAvatar targetUser={msg.sender} className="w-7 h-7 rounded-full" isOnline={!!(msg.sender?.id && activeParticipantsOnline[msg.sender.id])} />}
                        </div>
                    )}
                    <div className={`flex flex-col min-w-0 ${isMine ? 'items-end' : 'items-start'}`} style={{ maxWidth: isMine ? 'min(94%, calc(100% - 0.75rem))' : 'min(94%, calc(100% - 2.5rem))' }}>
                        <div className={`flex items-end space-x-1.5 relative max-w-full min-w-0 group/content ${isMine ? 'flex-row-reverse space-x-reverse justify-start' : 'flex-row justify-end'}`}>
                            <div className="flex flex-col items-inherit max-w-full min-w-0">
                                {activeChat?.type === ChatType.GROUP && !isMine && showAvatar && (
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
                                    // Chat Bubble
                                    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1.5 relative w-full rounded-xl`}>
                                        <div
                                            className={`
                                                relative pb-1 rounded-xl text-[14.5px] leading-relaxed max-w-full overflow-hidden backdrop-blur-sm transition-shadow duration-200
                                                ${isMine
                                                    ? 'bg-primary text-primary-foreground rounded-br-sm shadow-lg shadow-primary/20'
                                                    : 'bg-card text-foreground rounded-bl-sm shadow-md shadow-foreground/5'
                                                }
                                                ${isFailedMessage && isMine ? 'border-danger border shadow-danger/20' : ''}
                                            `}
                                        >
                                            {/* Reply Section inside Bubble */}
                                            {msg.replyTo && !isDeleted && (() => {
                                                return (
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); void scrollToMessage(msg.replyTo!.id); }}
                                                        className={`m-0.5 px-2.5 py-1.5 min-w-25 mb-1 rounded-xl border border-border text-sm bg-background/90 text-foreground/70! max-w-full overflow-hidden truncate cursor-pointer hover:opacity-90 transition-opacity shadow-inner`}
                                                    >
                                                        <div className={`border-b-3 mt-px ${isMineRepliedTo ? 'border-primary' : 'border-foreground/70'} max-w-[85%] -translate-y-1 mx-auto`}></div>
                                                        <p className="font-semibold mb-0.5 text-xs flex items-center opacity-70">
                                                            {msg.replyTo.sender?.id === user?.id ? 'You:' : msg.replyTo.sender?.name + ':' || 'Someone'}
                                                        </p>
                                                        <div className="truncate line-clamp-1 opacity-70">
                                                            <MarkdownRenderer
                                                                content={getTruncatedMessagePreview(msg.replyTo.deletedAt ? 'Message deleted' : msg.replyTo.content, isDesktop ? 400 : 200)}
                                                                className={`${msg.replyTo.deletedAt ? 'text-muted-foreground!' : 'text-foreground/80!'}`}
                                                                compactAttachments
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className={`prose prose-sm mx-2 max-w-full prose-p:mb-0 ${isMine && highlightedMessageId !== msg.id ? 'prose-invert' : 'prose-p:text-foreground!'}`}>
                                                <MarkdownRenderer content={msg.content} className={`${isMine ? 'text-primary-foreground!' : 'text-foreground!'} whitespace-pre-wrap wrap-break-word`} attachmentAlign={isMine ? 'right' : 'left'} attachmentsFirst />
                                            </div>

                                            {/* Messages Timestamp */}
                                            <div className={`flex items-center mx-2 pl-1.5 pb-0.5 justify-end space-x-1 mt-1 -mb-0.5 text-foreground`}>
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
                                                                onClick={() => { void handleSendMessage(msg); }}
                                                                disabled={sendLockRef.current || isSending || isUploading}
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
        });

        flushCurrentDateSection();
        return sections;
    }, [messages, user?.id, contextMenu?.msg.id, highlightedMessageId, isDesktop, activeChat?.type, scrollToMessage, isSending, isUploading, handleSendMessage, activeParticipantsOnline]);

    if (!user) return null;

    const isComposerExpanded =
        messageDraft.length > (isDesktop ? 150 : 30) ||
        messageDraft.includes('\n');

    return (
        <div className="flex h-full min-w-0 bg-background lg:shadow-xl lg:shadow-foreground/5 lg:border border-border overflow-hidden relative">
            {/* ===== SIDEBAR ===== */}
            <div className={`
            ${activeChatId && !isDesktop ? 'hidden' : 'flex'} 
            w-full lg:max-w-83 2xl:max-w-96 shrink-0 border-r border-border/60 flex-col bg-card/35 h-full transition-all duration-300 ease-in-out
        `}>
                <div className="px-4 sm:px-5 py-4 border-b border-border/60 bg-background/80 flex justify-between items-center">
                    <div>
                        <h2 className="text-[17px] sm:text-lg font-black text-foreground tracking-tight leading-tight">Messages</h2>
                        <p className="text-[11px] sm:text-[12px] text-muted-foreground font-semibold tracking-wide mt-1">{chats.length} conversation{chats.length !== 1 ? 's' : ''}</p>
                    </div>
                    {user.role !== Role.STUDENT && (
                        <button
                            type="button"
                            onClick={() => setIsNewChatModalOpen(true)}
                            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            title="New Chat"
                        >
                            <MessageSquarePlus size={18} />
                        </button>
                    )}
                </div>

                {/* Group Filters */}
                <div className="px-3 sm:px-4 pt-3 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveGroupFilter('all')}
                        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                        <Badge
                            variant={activeGroupFilter === 'all' ? 'primary' : 'neutral'}
                            size="sm"
                            className="hover:opacity-90 transition-opacity"
                        >
                            All
                        </Badge>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveGroupFilter('groups')}
                        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                        <Badge
                            variant={activeGroupFilter === 'groups' ? 'primary' : 'neutral'}
                            size="sm"
                            className="hover:opacity-90 transition-opacity"
                        >
                            Groups
                        </Badge>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveGroupFilter('dms')}
                        className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                        <Badge
                            variant={activeGroupFilter === 'dms' ? 'primary' : 'neutral'}
                            size="sm"
                            className="hover:opacity-90 transition-opacity"
                        >
                            DMs
                        </Badge>
                    </button>
                </div>

                {/* Search */}
                <div className="px-3 sm:px-4 py-3">
                    <div className="relative">
                        <Search size={isDesktop ? 16 : 14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-background/70 border border-border/60 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoadingChats ? (
                        <div className="p-4 space-y-1">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center p-3 space-x-3 rounded-xl">
                                    <div className="w-12 h-12 rounded-full skeleton-shimmer shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 w-2/3 rounded-md skeleton-shimmer" />
                                        <div className="h-3 w-full rounded-md skeleton-shimmer" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="w-16 h-16 bg-primary/30 rounded-2xl flex items-center justify-center mb-4">
                                <MessageSquareDashed size={28} className="text-primary/80" />
                            </div>
                            <p className="text-sm font-semibold text-foreground mb-1">No conversations yet</p>
                            <p className="text-xs text-muted-foreground">Start a new chat to begin messaging</p>
                        </div>
                    ) : (
                        filteredChats.map(chat => {
                            const otherUsers = chat.participants?.filter(p => (p.userId !== user.id) && p.isActive) || [];
                            const displayName = chat.type === ChatType.GROUP
                                ? chat.name || 'Unnamed Group'
                                : otherUsers[0]?.user?.name || 'Unknown User';

                            const myParticipant = chat.participants?.find(p => p.userId === user.id);
                            const lastMsgRaw = chat.messages?.[0];
                            const isCleared = lastMsgRaw && myParticipant?.clearedAt && new Date(lastMsgRaw.createdAt) <= new Date(myParticipant.clearedAt);
                            const lastMsg = isCleared ? null : lastMsgRaw;

                            const isActive = activeChatId === chat.id;
                            const hasUnread = chat.unreadCount !== undefined && chat.unreadCount > 0 && !isCleared;

                            return (
                                <div key={chat.id} className="relative group mx-2 mb-1 first:mt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setActiveChatId(chat.id); setTargetMessageId(null); }}
                                        {...getLongPressHandlers({
                                            isDesktop,
                                            itemId: chat.id,
                                            onLongPress: (itemId: string) => {
                                                if (itemId === chat.id) {
                                                    setChatMenuOpenId(chat.id);
                                                }
                                            }
                                        }, touchChatTimerRef, touchChatStartPosRef, touchChatHasTriggeredRef)}
                                        className={`w-full flex items-center px-3 py-3 rounded-2xl transition-colors duration-150 text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35
                                            ${isActive
                                                ? 'bg-primary/10 shadow-sm ring-1 ring-primary/25'
                                                : 'hover:bg-background/70'
                                            }
                                            ${chatMenuOpenId === chat.id ? 'bg-background/80' : ''}
                                            `}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full z-10" />
                                        )}
                                        <div className="relative mr-2.5 sm:mr-3 shrink-0">
                                            <ChatAvatar
                                                targetUser={chat.type === ChatType.GROUP
                                                    ? { name: displayName, avatarUrl: chat.avatarUrl, avatarUpdatedAt: chat.avatarUpdatedAt }
                                                    : otherUsers[0]?.user
                                                }
                                                className="w-10 h-10 sm:w-12 sm:h-12"
                                                isOnline={!!(chat.type === ChatType.DIRECT && otherUsers[0]?.user?.id && onlineUsers[otherUsers[0].user.id])}
                                            />
                                            {hasUnread && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-primary rounded-full border-2 border-background" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className={`text-[13px] font-black tracking-tight truncate pr-2 leading-tight ${isActive ? 'text-primary' : hasUnread ? 'text-foreground' : 'text-foreground/90'}`}>
                                                    {displayName}
                                                </h4>
                                                {lastMsg && (
                                                    <span className={`text-[10px] font-bold shrink-0 ml-2 uppercase tracking-tighter ${hasUnread ? 'text-primary' : 'text-muted-foreground/40'}`}>
                                                        {formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false })}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className={`text-[11px] sm:text-[13px] truncate flex-1 ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                    {(() => {
                                                        const chatTypingUsers = getTypingUsersForChat(typingByChatId, chat.id, user?.id);
                                                        if (chatTypingUsers.length > 0) {
                                                            const typingLabel = chat.type === ChatType.GROUP
                                                                ? `${(chatTypingUsers[0].name || 'Someone').replace(/[()`]/g, '\\$&')} ${chatTypingUsers.length === 1 ? 'is' : 'are'} typing...`
                                                                : 'typing...';
                                                            return <span className="text-primary text-[10px]">{typingLabel}</span>;
                                                        }
                                                        return lastMsg ? (
                                                            <>
                                                                <span className="text-muted-foreground">{lastMsg.senderId === user.id ? 'You: ' : <span>{lastMsg.sender?.name}: </span>}</span>
                                                                {lastMsg.deletedAt ? (
                                                                    <span className="text-muted-foreground">Message deleted</span>
                                                                ) : (
                                                                    (() => {
                                                                        const content = lastMsg.content || '';
                                                                        if (content.includes('![')) {
                                                                            const textPart = content.replace(/!\[.*?\]\(.*?\)/g, '').trim();
                                                                            return textPart ? `${textPart} 📷` : '📷 Photo';
                                                                        }
                                                                        return content;
                                                                    })()
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground">Tap to start chatting</span>
                                                        );
                                                    })()}
                                                </p>
                                                {hasUnread && (
                                                    <span className="ml-1.5 sm:ml-2">
                                                        <Badge variant="primary" size="sm">
                                                            {chat.unreadCount}
                                                        </Badge>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setChatMenuOpenId(chat.id);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg cursor-pointer bg-background/90 hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        title="Chat actions"
                                    >
                                        <MoreVertical size={16} className="text-muted-foreground" />
                                    </button>
                                    {chatMenuOpenId === chat.id && (
                                        <div data-chat-menu={chat.id} className="absolute right-2 top-full mt-1 bg-card border border-border rounded-xl shadow-xl py-1 z-50 min-w-40 overflow-hidden">
                                            <button
                                                type='button'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleClearChatHistory(chat.id, displayName);
                                                    setChatMenuOpenId(null);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                                            >
                                                <Trash2 size={14} />
                                                Clear History
                                            </button>
                                            {chat.type === ChatType.GROUP && (
                                                <button
                                                    type='button'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveChatId(chat.id);
                                                        setTargetMessageId(null);
                                                        setIsSettingsModalOpen(true);
                                                        setChatMenuOpenId(null);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                                                >
                                                    <SlidersHorizontal size={14} />
                                                    Settings
                                                </button>
                                            )}
                                            <button
                                                type='button'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteConfirmConfig({
                                                        isOpen: true,
                                                        chatId: chat.id,
                                                        chatName: displayName
                                                    });
                                                    setChatMenuOpenId(null);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger/10 dark:hover:bg-danger/20 transition-colors flex items-center gap-2"
                                            >
                                                <Trash2 size={14} />
                                                Delete Chat
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            {/* ===== CHAT PANEL ===== */}
            <div className={`
            ${!activeChatId && !isDesktop ? 'hidden' : 'flex'} 
            flex-1 min-w-0 flex-col h-full relative overflow-hidden chat-bg-pattern bg-background/65
            ${!isDesktop && activeChatId ? 'animate-in slide-in-from-right duration-300 ease-out' : ''}
        `}>
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div
                            className="relative w-full px-3 sm:px-4 py-3 border-b border-border/60 flex items-center justify-between z-20 bg-background/30 backdrop-blur-sm shadow-sm shadow-foreground/5"
                        >
                            <button
                                type="button"
                                id="participants-toggle"
                                className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0 cursor-pointer group/header rounded-2xl -ml-1 px-1.5 py-1 text-left hover:bg-card/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                onClick={() => setShowParticipants(!showParticipants)}
                            >
                                {!isDesktop && (
                                    <span
                                        title='Back'
                                        className="p-1.5 -ml-1 text-foreground/60 hover:text-primary hover:bg-muted rounded-xl transition-all active:scale-95"
                                        onClick={(e) => { e.stopPropagation(); goBack(); }}
                                    >
                                        <ChevronLeft size={22} className="text-primary/80 hover:text-primary" />
                                    </span>
                                )}
                                <ChatAvatar
                                    targetUser={activeChat.type === ChatType.GROUP
                                        ? { name: activeChat.name, avatarUrl: activeChat.avatarUrl, avatarUpdatedAt: activeChat.avatarUpdatedAt }
                                        : activeChat.participants?.find(p => p.userId !== user.id)?.user
                                    }
                                    className="w-9 h-9 sm:w-10 sm:h-10 transition-transform group-hover/header:scale-105"
                                    isOnline={!!(directChatTarget?.id && onlineUsers[directChatTarget.id])}
                                    imageLoading="eager"
                                />
                                <div className="flex min-w-0 flex-col items-start">
                                    <h3 className="font-black text-[14px] sm:text-[15px] text-foreground leading-tight truncate group-hover/header:text-primary transition-colors">
                                        {activeChat.type === ChatType.GROUP ? activeChat.name : activeChat.participants?.find(p => p.userId !== user.id)?.user?.name || 'Unknown'}
                                    </h3>

                                    {typingIndicatorLabel ? (
                                        <span className="inline-flex items-center gap-1.5 text-primary text-[11px] font-semibold">
                                            <span className="animate-pulse">{typingIndicatorLabel}</span>
                                            <span className="inline-flex items-center gap-0.5">
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.2s]" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.1s]" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                                            </span>
                                        </span>
                                    ) : activeChat.type === ChatType.GROUP
                                        ? `${activeParticipants.length} members`
                                        : (() => {
                                            const otherParticipant = activeChat.participants?.find(p => p.userId !== user.id);
                                            const isOnline = onlineUsers[directChatTarget?.id || ''];
                                            const role = otherParticipant?.user?.role?.replace('_', ' ').toLowerCase() || 'member';
                                            const status = isOnline ? 'Online' : otherParticipant?.lastSeenAt
                                                ? `Last seen ${formatDistanceToNow(new Date(otherParticipant.lastSeenAt), { addSuffix: true })}`
                                                : null;
                                            return (
                                                <span className="flex items-center gap-2 text-[10px]">
                                                    <span className={isOnline ? 'text-success' : ''}>{status}</span>
                                                    {status && <span className="opacity-40 hidden md:block">•</span>}
                                                    <span className={`capitalize ${status && 'hidden md:block'}`}>{role}</span>
                                                </span>
                                            );
                                        })()}
                                </div>
                            </button>
                            {activeChat.type === ChatType.GROUP && (
                                <div className="flex items-center space-x-1">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        px="px-2"
                                        py="py-2"
                                        onClick={() => setIsSettingsModalOpen(true)}
                                        className="text-muted-foreground hover:text-foreground rounded-xl bg-card/60 border border-border/50 shadow-none"
                                        title={'Chat Settings'}
                                        icon={MoreVertical}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 flex overflow-hidden relative bg-background/70">
                            <div
                                ref={messagesContainerRef}
                                onScroll={handleScroll}
                                className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-24 py-3 sm:py-4 space-y-0.5 custom-scrollbar"
                                style={{
                                    paddingBottom: !isDesktop
                                        ? `calc(${(canSendMessage ? composerHeight : readOnlyBannerHeight) + 16}px + env(safe-area-inset-bottom, 0px))`
                                        : (canSendMessage ? composerHeight : readOnlyBannerHeight) + 16
                                }}
                            >
                                {isLoadingMessages ? (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary/80" />
                                        <span className="text-xs text-muted-foreground font-medium">Loading messages...</span>
                                    </div>
                                ) : (
                                    <>
                                        {!hasMoreMessages && (
                                            <div className="flex justify-center py-3">
                                                <div className="bg-card/80 backdrop-blur-sm text-muted-foreground px-4 py-1.5 rounded-full text-[13px] font-medium flex items-center border border-border shadow-sm">
                                                    <Info size={12} className="mr-1.5 text-primary/80" />
                                                    This is the beginning of this chat
                                                </div>
                                            </div>
                                        )}
                                        {hasMoreMessages && (
                                            <div className="flex justify-center py-3">
                                                <Button
                                                    onClick={loadEarlierMessages}
                                                    disabled={isLoadingMore}
                                                    variant="secondary"
                                                    px="px-4"
                                                    py="py-1.5"
                                                    className="bg-card/90 backdrop-blur-sm border border-border rounded-full text-[13px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-sm active:scale-95 flex items-center"
                                                    icon={isLoadingMore ? Loader2 : ArrowUp}
                                                >
                                                    {isLoadingMore ? 'Loading...' : 'Load earlier'}
                                                </Button>
                                            </div>
                                        )}
                                        {renderedMessages}

                                        <div ref={messagesEndRef} />

                                        {hasMoreAfter && (
                                            <div className="flex justify-center py-3">
                                                <Button
                                                    onClick={loadNewerMessages}
                                                    disabled={isLoadingNewer}
                                                    variant="secondary"
                                                    px="px-4"
                                                    py="py-1.5"
                                                    className="bg-card/90 backdrop-blur-sm border border-border rounded-full text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-sm active:scale-95 flex items-center"
                                                    icon={isLoadingNewer ? Loader2 : ArrowDown}
                                                >
                                                    {isLoadingNewer ? 'Loading...' : 'Load newer'}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* History Mode Banner */}
                            {isViewingHistory && (
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-foreground text-background px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center space-x-3 text-[13px] font-semibold animate-in slide-in-from-top duration-300">
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    <span>Viewing history</span>
                                    <button
                                        onClick={() => activeChatId && fetchInitialMessages(activeChatId)}
                                        className="bg-background text-foreground px-3 py-1 rounded-full hover:bg-muted transition-colors font-bold text-[13px]"
                                    >
                                        Jump to present
                                    </button>
                                </div>
                            )}

                            {/* Scroll to Bottom FAB */}
                            {((showScrollToBottom && !isLoadingMessages) || isViewingHistory) && (
                                <button
                                    type="button"
                                    onClick={() => isViewingHistory ? (activeChatId && fetchInitialMessages(activeChatId)) : scrollToBottom()}
                                    className="absolute right-7 z-30 p-2.5 bg-card text-foreground/70 rounded-full shadow-lg border border-border hover:bg-card/95 hover:text-primary hover:border-primary transition-all active:scale-95 group"
                                    style={{
                                        bottom: !isDesktop
                                            ? `calc(${(canSendMessage ? composerHeight : readOnlyBannerHeight) + 30}px + env(safe-area-inset-bottom, 0px))`
                                            : (canSendMessage ? composerHeight : readOnlyBannerHeight) + 30
                                    }}
                                    title={isViewingHistory ? "Jump to Present" : "Scroll to bottom"}
                                >
                                    <ArrowDown size={18} className="group-hover:translate-y-0.5 transition-transform text-primary/80" />
                                    {!isViewingHistory && unreadSinceScroll > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-danger/60 text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-card shadow-sm">
                                            {unreadSinceScroll}
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Participants Drawer */}
                            <div
                                ref={participantsRef}
                                className={`absolute top-0 right-0 h-full w-72 sm:w-80 bg-background border-l border-border/70 shadow-2xl z-30 flex flex-col transition-[transform,opacity] duration-200 ease-out ${showParticipants ? 'translate-x-0 opacity-100 visible' : 'translate-x-full opacity-0 invisible pointer-events-none'}`}
                            >
                                <div className="px-4 py-3 border-b border-border/60 flex justify-between items-center bg-card/45">
                                    <div>
                                        <h4 className="font-black text-foreground text-[13px] sm:text-[14px]">Members</h4>
                                        <p className="text-[11px] text-muted-foreground font-semibold">{activeParticipants.length} active</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowParticipants(false)}
                                        className="text-muted-foreground hover:text-foreground p-2 hover:bg-muted rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        title="Close"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                                    {activeParticipants.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-card/80 transition-colors group/item">
                                            <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                                                <ChatAvatar targetUser={p.user} className="w-7 h-7 sm:w-8 sm:h-8" isOnline={!!onlineUsers[p.userId]} />
                                                <div className="min-w-0">
                                                    <p className="text-[12px] sm:text-[13px] font-bold truncate" style={{ color: getUserColor(p.user?.id) }}>{p.user?.name} {p.userId === user.id && <span className="text-muted-foreground font-normal">(You)</span>}</p>
                                                    <p className="text-[11px] text-muted-foreground font-medium capitalize truncate">{p.user?.role?.toLowerCase().replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                            {isGroupAdmin && p.userId !== user.id && p.userId !== activeChat.creatorId && (
                                                <Button
                                                    variant="danger"
                                                    px="p-1.5"
                                                    py="p-1.5"
                                                    onClick={() => handleRemoveParticipant(p.userId)}
                                                    className="text-muted-foreground! hover:text-white! rounded-lg transition-all bg-transparent border-none shadow-none"
                                                    title="Remove from group"
                                                    icon={UserMinus}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Input Composer - Only show if user can send messages */}
                            {canSendMessage ? (
                                <div
                                    ref={composerRef}
                                    className="absolute bottom-0 w-[98.5%] pl-1 sm:pl-5 pt-0.5 pb-3 z-50 chat-bg-pattern bg-background"
                                    style={!isDesktop ? { paddingBottom: mobileBottomInset } : undefined}
                                >
                                    <div className="absolute inset-0 -z-10 opacity-65 bg-background pointer-events-none" />
                                    {/* Reply / Edit Banner */}
                                    {(replyToMessage || editingMessage) && (
                                        <div className="mb-1 px-4 py-2.5 bg-card/90 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300 shadow-sm ring-1 ring-primary/50">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                                                    {editingMessage ? 'Editing Message' : `Replying to ${replyToMessage?.sender?.name == user.name ? 'Yourself' : (replyToMessage?.sender?.name || 'Message')}`}
                                                </p>
                                                <div
                                                    onClick={() => { if (replyToMessage) scrollToMessage(replyToMessage.id); else (scrollToMessage(editingMessage!.id)) }}
                                                    className="text-[12px] text-muted-foreground truncate cursor-pointer italic"
                                                >
                                                    <MarkdownRenderer
                                                        content={getTruncatedMessagePreview(editingMessage?.content || replyToMessage?.content, isDesktop ? 100 : 50)}
                                                        className='text-muted-foreground!'
                                                        compactAttachments
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                title='Cancel'
                                                type="button"
                                                onClick={() => {
                                                    updateActiveComposerState({ replyToMessage: null });
                                                    if (editingMessage) {
                                                        updateActiveComposerState({
                                                            editingMessage: null,
                                                            messageDraft: ''
                                                        });
                                                    }
                                                }}
                                                className="absolute top-2 right-2 p-1 text-muted-foreground border border-primary/40 hover:text-primary hover:bg-primary/40 rounded-full transition-colors"
                                            >
                                                <X size={14} className="text-primary/80 hover:text-primary" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Mention Banner */}
                                    {mentionedUsers.length > 0 && !editingMessage && (
                                        <div className="mb-1.5 sm:mb-1 px-2.5 sm:px-3 py-2 sm:py-2 mr-2 bg-muted border-l-4 border-primary rounded-lg flex items-center justify-between animate-in slide-in-from-bottom duration-200">
                                            <div className="flex-1 min-w-0 pr-2 sm:pr-3">
                                                <p className="text-[12px] sm:text-[13px] font-semibold text-primary mb-0.5">
                                                    Mentioning
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {mentionedUsers.map(u => (
                                                        <span key={u.id} className="text-[11px] sm:text-[12px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                                                            @{u.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                title='Clear Mentions'
                                                type="button"
                                                onClick={() => updateActiveComposerState({ mentionedUsers: [] })}
                                                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                            >
                                                <X size={14} className="text-primary/80 hover:text-primary" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Staged Files - Premium Card Previews */}
                                    {stagedFiles.length > 0 && (
                                        <div className="flex flex-row gap-1 mb-1 mr-2 scrollbar-thin overflow-x-auto scroll-x-auto">
                                            {stagedFiles.map((file, i) => {
                                                const fileInfo = getFileTypeInfo(file.type);
                                                const isImage = file instanceof File && file.type.startsWith('image/') && stagedFilePreviewUrls[i];

                                                return (
                                                    <div key={i} className="group relative flex items-center bg-card border border-border/50 p-2 rounded-xl hover:border-primary/50 hover:shadow-md transition-all duration-300 min-w-50 max-w-70">
                                                        {/* Preview Thumbnail */}
                                                        {isImage && stagedFilePreviewUrls[i] ? (
                                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted-foreground/10 mr-2.5 relative shadow-sm shrink-0">
                                                                <Image src={stagedFilePreviewUrls[i]!} alt="" fill className="object-cover" unoptimized />
                                                            </div>
                                                        ) : (
                                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mr-2.5 shadow-sm shrink-0"
                                                                style={{ background: fileInfo.bg, color: fileInfo.color }}>
                                                                {fileInfo.label === 'ARCHIVE' ? <Archive size={20} strokeWidth={2.5} /> :
                                                                    fileInfo.label === 'XLS' ? <FileSpreadsheet size={20} strokeWidth={2.5} /> :
                                                                        fileInfo.label === 'PPT' ? <Presentation size={20} strokeWidth={2.5} /> :
                                                                            <FileText size={20} strokeWidth={2.5} />}
                                                            </div>
                                                        )}

                                                        {/* File Info */}
                                                        <div className="flex-1 min-w-0 mr-1">
                                                            <p className="text-[11px] sm:text-[12px] font-bold text-foreground truncate tracking-tight">{file.name || 'Attachment'}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[9px] font-black uppercase px-1 py-0.5 rounded-sm text-white" style={{ background: fileInfo.color }}>
                                                                    {fileInfo.label}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground font-medium">{formatBytes(file.size)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Remove Button */}
                                                        <button
                                                            type="button"
                                                            title='Remove'
                                                            onClick={() => removeStagedFile(i)}
                                                            className="absolute -top-1 -right-1 p-2 bg-background border border-border text-muted-foreground hover:text-danger rounded-full shadow-md transition-all scale-90 group-hover:scale-100 z-30"
                                                        >
                                                            <X size={12} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Composer Row */}
                                    <div className={`flex flex-row items-end mb-1.5 sm:mb-2 min-w-0 max-w-full`}>
                                        <input
                                            title="Upload File"
                                            type="file"
                                            id="chat-file-upload"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.docx,.xlsx,.pptx,.zip"
                                            multiple
                                        />

                                        {/* Main composer container */}
                                        <div className="flex-1 min-w-0 max-w-full bg-card/95 border-2 border-border/70 rounded-3xl focus-within:bg-background/70 focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-lg shadow-foreground/5 backdrop-blur-sm">
                                            {/* Top row */}
                                            <div className={`flex items-end min-w-0 transition-all duration-500 ease-out ${isComposerExpanded ? 'px-3 pt-2' : 'px-2'}`}>
                                                {/* Left buttons only in compact mode */}
                                                {!isComposerExpanded && (
                                                    <div className="flex items-center gap-0.5 sm:gap-1 pb-2 sm:pb-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('chat-file-upload')?.click()}
                                                            className="text-primary/70 hover:text-primary hover:bg-primary/10 transition-all p-1.5 rounded-full"
                                                            title="Attach file"
                                                        >
                                                            <Paperclip size={20} className="cursor-pointer -rotate-45" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Textarea */}
                                                <div className="relative flex-1 min-w-0">
                                                    <textarea
                                                        ref={textareaRef}
                                                        rows={1}
                                                        value={messageDraft}
                                                        disabled={isUploading}
                                                        onChange={(e) => {
                                                            const el = e.target;
                                                            const newVal = el.value;
                                                            const cursorIdx = el.selectionStart || 0;

                                                            // Auto-deselect mentions if they are erased from text (check specifically for `@name`)
                                                            const remainingMentions = mentionedUsers.filter(u => newVal.includes(`@${u.name}`));
                                                            const wasMentionRemoved = remainingMentions.length !== mentionedUsers.length;

                                                            updateActiveComposerState({
                                                                messageDraft: newVal,
                                                                ...(wasMentionRemoved ? { mentionedUsers: remainingMentions } : {})
                                                            });

                                                            // Trigger typing indicator
                                                            if (newVal.trim().length > 0) {
                                                                emitTypingStart();
                                                            } else {
                                                                emitTypingStop();
                                                            }

                                                            el.style.height = 'auto';
                                                            el.style.height = el.scrollHeight + 'px';
                                                            el.style.height = Math.min(el.scrollHeight, 200) + 'px';

                                                            // @Mention Detection
                                                            const textBeforeCursor = newVal.slice(0, cursorIdx);
                                                            const lastAtIdx = textBeforeCursor.lastIndexOf('@');
                                                            if (lastAtIdx !== -1 && (lastAtIdx === 0 || textBeforeCursor[lastAtIdx - 1] === ' ')) {
                                                                const query = textBeforeCursor.slice(lastAtIdx + 1);
                                                                if (!query.includes(' ')) {
                                                                    setMentionSearchQuery(query);
                                                                    setShowMentionDropdown(true);
                                                                    setMentionCursorIndex(lastAtIdx);
                                                                    setMentionSelectedIndex(0); // Reset index
                                                                } else {
                                                                    setShowMentionDropdown(false);
                                                                }
                                                            } else {
                                                                setShowMentionDropdown(false);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (showMentionDropdown && filteredMembers.length > 0) {
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    setMentionSelectedIndex(prev => (prev + 1) % filteredMembers.length);
                                                                    return;
                                                                }
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    setMentionSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
                                                                    return;
                                                                }
                                                                if (e.key === 'Enter' || e.key === 'Tab') {
                                                                    e.preventDefault();
                                                                    handleSelectMember(filteredMembers[mentionSelectedIndex]);
                                                                    return;
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    setShowMentionDropdown(false);
                                                                    return;
                                                                }
                                                            }
                                                            handleKeyDown(e);
                                                        }}
                                                        onPaste={(e) => {
                                                            const rawFiles = extractFilesFromClipboard(e.nativeEvent);
                                                            if (rawFiles.length > 0) {
                                                                const validFiles = filterValidFiles(rawFiles);
                                                                if (validFiles.length > 0) {
                                                                    e.preventDefault();
                                                                    updateComposerStateForChat(activeChatId, {
                                                                        stagedFiles: [...stagedFiles, ...validFiles]
                                                                    });
                                                                }
                                                            }
                                                        }}
                                                        onFocus={handleEditorFocus}
                                                        onBlur={() => setTimeout(() => setShowMentionDropdown(false), 200)}
                                                        placeholder={stagedFiles.length > 0 ? "Add a caption..." : `Message...`}
                                                        className={`w-full bg-transparent px-2 sm:px-3 py-2.5 translate-y-0.5 border-none text-[14px] sm:text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 resize-none max-h-70 leading-relaxed transition-[height] duration-500 ease-out`}
                                                    />

                                                    {isDesktop && renderMentionDropdown('desktop')}
                                                </div>
                                            </div>

                                            {/* Bottom row actions in expanded mode */}
                                            {isComposerExpanded && (
                                                <div className="flex items-center justify-between px-2 py-1.5 sm:py-2">
                                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => document.getElementById('chat-file-upload')?.click()}
                                                            className="text-primary/70 hover:text-primary hover:bg-primary/10 transition-all p-1.5 rounded-full"
                                                            title="Attach file"
                                                        >
                                                            <Paperclip size={20} className="cursor-pointer -rotate-45" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* External Send Button (Animated Drop Style) */}
                                        <div className={`flex items-end justify-center transition-all duration-300 ease-out ${(messageDraft.trim() || stagedFiles.length > 0)
                                            ? 'w-12 opacity-100 scale-100 ml-2'
                                            : 'w-0 opacity-0 scale-50 ml-0 overflow-hidden'
                                            }`}>
                                            <button
                                                type="button"
                                                onClick={() => { void handleSendMessage(); }}
                                                disabled={isSending || isUploading}
                                                className="w-13 h-13.25 shrink-0 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 hover:scale-[1.03] hover:shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                                                title="Send message"
                                            >
                                                <Send size={18} className="cursor-pointer mx-auto" />
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div ref={readOnlyBannerRefCallback} className="absolute bottom-0 left-0 right-0 px-2 sm:px-3 py-2 sm:py-2.5 bg-warning/10 mr-2.5 mb-1 border-x-4 border-warning rounded-lg flex items-center justify-center gap-2 animate-in slide-in-from-bottom duration-200">
                                    <LockIcon size={14} className="text-warning shrink-0" />
                                    <p className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-warning text-center">
                                        Read-Only Mode - Only admins and moderators can send messages
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center chat-bg-pattern px-4">
                        <div className="flex flex-col items-center justify-center p-14 bg-card/60 rounded-xl shadow-lg backdrop-blur-sm">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-card rounded-2xl flex items-center justify-center shadow-sm border border-border mb-4 sm:mb-5">
                                <MessageSquarePlus size={36} className="text-primary/80" />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">Your Messages</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground max-w-xs sm:max-w-sm text-center">Select a conversation or start a new one to begin chatting</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {previewImageUrl && (
                <ImagePreviewModal
                    imageUrl={previewImageUrl}
                    onClose={() => setPreviewImageUrl(null)}
                />
            )}

            <NewChatModal
                isOpen={isNewChatModalOpen}
                onClose={() => setIsNewChatModalOpen(false)}
                onChatCreated={handleChatCreated}
            />

            {activeChat && (
                <ChatSettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    chat={activeChat}
                    currentUser={user as User}
                    token={token!}
                    onUpdate={fetchChats}
                    onAddParticipants={() => setIsAddUserModalOpen(true)}
                />
            )}
            {/* Add Participants Modal */}
            {isAddUserModalOpen && activeChatId && (
                <NewChatModal
                    isOpen={isAddUserModalOpen}
                    onClose={() => setIsAddUserModalOpen(false)}
                    onChatCreated={() => {
                        setIsAddUserModalOpen(false);
                        fetchChats();
                    }}
                    mode="ADD_PARTICIPANTS"
                    chatId={activeChatId}
                    existingParticipantIds={activeChatParticipantIds}
                />
            )}


            <ConfirmDialog
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                description={confirmConfig.description}
                isDestructive={confirmConfig.isDestructive}
                confirmText={confirmConfig.isDestructive ? 'Delete' : 'Confirm'}
            />

            <ConfirmDialog
                isOpen={deleteConfirmConfig.isOpen}
                onClose={() => setDeleteConfirmConfig({ isOpen: false, chatId: null, chatName: '' })}
                onConfirm={() => {
                    if (deleteConfirmConfig.chatId) {
                        handleDeleteChat(deleteConfirmConfig.chatId);
                    }
                }}
                title="Delete Chat"
                description={`This will hide "${deleteConfirmConfig.chatName}" from your sidebar. It will reappear if a new message is received. You remain a participant.`}
                confirmText="Delete"
                isDestructive
            />

            {contextMenu && (
                <MessageContextMenu
                    msg={contextMenu.msg}
                    user={user}
                    isMine={contextMenu.msg.senderId === user?.id}
                    isFailedMessage={contextMenu.msg.clientStatus === 'failed'}
                    position={{ x: contextMenu.x, y: contextMenu.y }}
                    isMobile={!isDesktop}
                    onClose={() => setContextMenu(null)}
                    onReply={handleReply}
                    onCopyText={handleCopyText}
                    onEditMessage={handleEditMessage}
                    onDownload={handleDownload}
                    onDeleteMessage={handleDeleteMessage}
                />
            )}

            {mounted && !isDesktop && createPortal(
                renderMentionDropdown('mobile'),
                document.body
            )}
        </div>
    );
}
