'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import notificationsStore from '@/lib/notificationsStore';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { PushNotificationBanner } from '@/components/ui/PushNotificationPrompt';
import { useBackStackEntry } from '@/context/BackNavigationContext';

interface NotificationDropdownProps {
    onOpenChange?: (open: boolean) => void;
}

export function NotificationDropdown({ onOpenChange }: NotificationDropdownProps = {}) {
    const { token, user } = useAuth();
    const { subscribe } = useSocket({ token, userId: user?.id, enabled: !!token });

    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
    const [readPage, setReadPage] = useState(1);
    const [hasMoreRead, setHasMoreRead] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useBackStackEntry({
        enabled: isOpen,
        label: 'Notifications',
        priority: 30,
        onBack: () => setIsOpen(false),
    });

    useEffect(() => {
        onOpenChange?.(isOpen);
        return () => {
            if (isOpen) onOpenChange?.(false);
        };
    }, [isOpen, onOpenChange]);

    // Fetch notifications initially via notificationsStore
    useEffect(() => {
        if (!token) return;
        let mounted = true;
        notificationsStore.fetchAll(token).then(cache => {
            if (!mounted) return;
            setNotifications(cache.items);
            setUnreadCount(cache.unreadCount || 0);
            setReadPage(cache.readPage || 1);
            setHasMoreRead(cache.hasMoreRead || false);
        }).catch(err => console.error('Failed to load notifications from store', err))
            .finally(() => {
                if (mounted) {
                    setIsLoading(false);
                }
            });

        const unsub = notificationsStore.subscribe(() => {
            const c = notificationsStore.getAll();
            setNotifications(c.items);
            setUnreadCount(c.unreadCount || 0);
            setReadPage(c.readPage || 1);
            setHasMoreRead(c.hasMoreRead || false);
        });
        return () => { mounted = false; unsub(); };
    }, [token]);

    // Setup socket listeners
    useEffect(() => {
        if (!subscribe) return;

        const unsubNew = subscribe('notification:new', (newNotification: unknown) => {
            const notif = newNotification as Notification;
            notificationsStore.applyNew(notif);
        });

        const unsubRead = subscribe('notification:read', (data: unknown) => {
            const { notificationId } = data as { notificationId: string };
            notificationsStore.applyRead(notificationId);
        });

        const unsubReadAll = subscribe('notification:read_all', () => {
            notificationsStore.applyReadAll();
        });

        const unsubDeleted = subscribe('notification:deleted', (data: unknown) => {
            const { notificationId, wasUnread } = data as { notificationId: string; wasUnread?: boolean };
            notificationsStore.applyDelete(notificationId, wasUnread);
        });

        return () => {
            unsubNew();
            unsubRead();
            unsubReadAll();
            unsubDeleted();
        };
    }, [subscribe]);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        if (!token) return;
        await notificationsStore.markAsReadGuard(id, token);
    };

    const markAllAsRead = async () => {
        if (!token || unreadCount === 0) return;
        await notificationsStore.markAllAsReadGuard(token);
    };

    const deleteNotification = async (id: string) => {
        if (!token) return;
        await notificationsStore.deleteGuard(id, token);
    };

    const showEarlier = async () => {
        if (!token || isLoadingEarlier || !hasMoreRead) return;
        setIsLoadingEarlier(true);
        try {
            await notificationsStore.fetchDropdown(token, { readPage: readPage + 1, append: true });
        } finally {
            setIsLoadingEarlier(false);
        }
    };

    if (!token || !user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
                className="relative p-2 text-primary/80 hover:text-primary hover:bg-primary/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-5.5 h-5.5 text-[12px] font-bold text-white bg-danger rounded-full border border-white shadow-sm animate-in zoom-in">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden transform origin-top-right animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="flex items-center justify-between px-4 py-3 bg-card/5 border-b border-border backdrop-blur-sm">
                        <h3 className="font-semibold text-foreground">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs font-medium text-primary hover:text-primary-dark hover:underline flex items-center space-x-1 transition-colors"
                            >
                                <Check className="w-3 h-3" />
                                <span>Mark all as read</span>
                            </button>
                        )}
                    </div>

                    <PushNotificationBanner />

                    <div className="max-h-100 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                            </div>
                        ) : notifications.length > 0 ? (
                            <div className="divide-y divide-border">
                                {notifications.map((notif) => {
                                    const content = (
                                        <>
                                            <div className={`mt-1 mr-3 w-2 h-2 rounded-full shrink-0 ${!notif.isRead ? 'bg-primary shadow-[0_0_8px_rgba(var(--color-primary),0.5)]' : 'bg-transparent'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm tracking-tight ${!notif.isRead ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                                                    {notif.title}
                                                </p>
                                                {notif.body && (
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                        {notif.body}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-muted-foreground mt-2 font-medium tracking-wider">
                                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </>
                                    );

                                    const className = `flex items-start p-4 pr-11 hover:bg-card/10 transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`;
                                    const handleClick = () => {
                                        if (!notif.isRead) markAsRead(notif.id);
                                        setIsOpen(false);
                                    };
                                    const safeActionUrl = normalizeSafeUrl(notif.actionUrl, { allowRelative: true });
                                    const deleteButton = (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                deleteNotification(notif.id);
                                            }}
                                            className="absolute right-2 top-3 rounded-md p-1.5 text-muted-foreground opacity-70 transition-colors hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                                            aria-label="Delete notification"
                                            title="Delete notification"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    );

                                    if (safeActionUrl) {
                                        return (
                                            <div key={notif.id} className="group relative">
                                                <Link href={safeActionUrl} onClick={handleClick} className={className}>
                                                    {content}
                                                </Link>
                                                {deleteButton}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={notif.id} onClick={handleClick} className={`${className} group relative`}>
                                            {content}
                                            {deleteButton}
                                        </div>
                                    );
                                })}
                                {hasMoreRead && (
                                    <div className="p-3">
                                        <button
                                            type="button"
                                            onClick={showEarlier}
                                            disabled={isLoadingEarlier}
                                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isLoadingEarlier && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                            <span>Show earlier</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <Bell className="w-10 h-10 text-muted-foreground mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">No new notifications</p>
                                <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
