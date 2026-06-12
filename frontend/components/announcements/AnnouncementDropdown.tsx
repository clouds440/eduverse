'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Megaphone, Loader2, Plus, Globe, Building2, Shield, Layout } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { Announcement, Role, TargetType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useGlobal } from '@/context/GlobalContext';
import Link from 'next/link';
import { CreateAnnouncementModal } from './CreateAnnouncementModal';
import { BrandIcon } from '@/components/ui/Brand';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { useBackStackEntry } from '@/context/BackNavigationContext';
import { getRoleLabel } from '@/lib/roles';

export function AnnouncementDropdown() {
    const { token, user } = useAuth();
    const { subscribe } = useSocket({ token, userId: user?.id, enabled: !!token });
    const { dispatch } = useGlobal();

    const [isOpen, setIsOpen] = useState(false);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [lastSeen, setLastSeen] = useState<number>(0);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const hasAutoOpened = useRef(false);

    useBackStackEntry({
        enabled: isOpen,
        label: 'Announcements',
        priority: 30,
        onBack: () => setIsOpen(false),
    });

    const markAllAsSeen = useCallback((currentAnnouncements: Announcement[]) => {
        setUnreadCount(0);
        const now = new Date().getTime();
        setLastSeen(now);
        if (currentAnnouncements.length > 0) {
            localStorage.setItem(`announcements_heard_${user?.id}`, now.toString());
        }
    }, [user?.id]);

    // Fetch announcements initially
    useEffect(() => {
        if (!token) return;
        const fetchAnnouncements = async () => {
            setIsLoading(true);
            try {
                const res = await api.announcements.getAnnouncements(token, { limit: 10 });
                setAnnouncements(res.data);

                // Compare with localStorage to see if there are new ones
                const ls = localStorage.getItem(`announcements_heard_${user?.id}`);
                const lsTime = ls ? parseInt(ls, 10) : 0;
                setLastSeen(lsTime);

                const count = res.data.filter(a => {
                    return lsTime === 0 || new Date(a.createdAt).getTime() > lsTime + 1000;
                }).length;

                setUnreadCount(count);

                // Auto-open for High/Urgent unread if not yet auto-opened this session
                if (!hasAutoOpened.current && count > 0) {
                    const unreadUrgent = res.data.filter(a => {
                        const isUnread = lsTime === 0 || new Date(a.createdAt).getTime() > lsTime + 1000;
                        return isUnread && (a.priority === 'URGENT' || a.priority === 'HIGH');
                    });

                    if (unreadUrgent.length > 0) {
                        setIsOpen(true);
                        hasAutoOpened.current = true;
                        // Mark as seen immediately so it doesn't re-open on refresh
                        markAllAsSeen(res.data);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch announcements', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnnouncements();
    }, [token, user?.id, markAllAsSeen]);

    // Setup socket listeners
    useEffect(() => {
        if (!subscribe) return;

        const unsubNew = subscribe('announcement:new', (newAnnouncement: unknown) => {
            const announcement = newAnnouncement as Announcement;
            setAnnouncements(prev => [announcement, ...prev].slice(0, 10)); // Keep top 10
            setUnreadCount(prev => prev + 1);
            dispatch({ type: 'TOAST_ADD', payload: { message: announcement.title, type: 'info' } });

            // Auto-open if Urgent
            if (announcement.priority === 'URGENT' && !isOpen) {
                setIsOpen(true);
                hasAutoOpened.current = true;
                // We'll update the "lastSeen" only if they interact or if we want to be aggressive.
                // For live ones, let's keep the badge so they notice.
            }
        });

        return () => {
            unsubNew();
        };
    }, [subscribe, dispatch, isOpen]);

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

    const toggleOpen = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState && unreadCount > 0) {
            markAllAsSeen(announcements);
        }
    };

    if (!token || !user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleOpen}
                title="Announcements"
                className="relative p-2 text-primary/80 hover:text-primary hover:bg-primary/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Announcements"
            >
                <Megaphone className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-5.5 h-5.5 text-[12px] font-bold text-white bg-info rounded-full border-2 border-white shadow-sm animate-in zoom-in">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden transform origin-top-right animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border backdrop-blur-sm">
                        <h3 className="font-semibold text-foreground">Announcements</h3>
                        {user.role !== Role.STUDENT && (
                            <button
                                onClick={() => { setIsOpen(false); setIsCreateModalOpen(true); }}
                                className="text-xs font-medium text-primary/80 hover:text-primary cursor-pointer hover:underline flex items-center space-x-1 transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Create</span>
                            </button>
                        )}
                    </div>

                    <div className="max-h-100 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-info opacity-50" />
                            </div>
                        ) : announcements.length > 0 ? (
                            <div className="divide-y divide-border">
                                {announcements.map((announcement) => {
                                    const priorityColors = {
                                        LOW: 'bg-muted/40 hover:bg-muted border-l-border',
                                        NORMAL: 'bg-card hover:bg-muted/40 border-l-info/80',
                                        HIGH: 'bg-warning/10 hover:bg-warning/80 border-l-warning',
                                        URGENT: 'bg-danger/10 hover:bg-danger/80 border-l-danger',
                                    };

                                    const targetIcons = {
                                        [TargetType.GLOBAL]: <Globe className="w-3 h-3" />,
                                        [TargetType.ORG]: <Building2 className="w-3 h-3" />,
                                        [TargetType.ROLE]: <Shield className="w-3 h-3" />,
                                        [TargetType.SECTION]: <Layout className="w-3 h-3" />,
                                    };

                                    const bgClass = priorityColors[announcement.priority || 'NORMAL'] || priorityColors.NORMAL;
                                    const creator = announcement.creator;
                                    const safeActionUrl = normalizeSafeUrl(announcement.actionUrl, { allowRelative: true });

                                    return (
                                        <div
                                            key={announcement.id}
                                            className={`p-4 transition-all border-l-4 ${bgClass} group`}
                                        >
                                            {/* Creator Info */}
                                            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border">
                                                <BrandIcon variant="user" size="sm" user={creator} className="w-8 h-8" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-xs font-black text-foreground truncate">{creator?.name || 'Unknown User'}</div>
                                                        {(lastSeen === 0 || new Date(announcement.createdAt).getTime() > lastSeen + 1000) && (
                                                            <span className="shrink-0 text-[8px] font-black bg-info text-white px-1.5 py-0.5 rounded-full animate-pulse tracking-[0.2em] shadow-sm">
                                                                New
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-[9px] font-black text-info/70 tracking-widest bg-info/10 border border-info/10 px-1.5 py-0.5 rounded-lg">
                                                            {getRoleLabel(creator?.role, 'SYSTEM')}
                                                        </span>
                                                        <div className="text-[9px] text-muted-foreground font-bold tracking-wider">
                                                            {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-start gap-2 pr-4">
                                                    {(lastSeen === 0 || new Date(announcement.createdAt).getTime() > lastSeen + 1000) && (
                                                        <div className="w-2 h-2 mt-1.5 rounded-full bg-info shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                    )}
                                                    <h4 className="text-sm font-black text-foreground leading-tight">
                                                        {announcement.title}
                                                    </h4>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5 text-[9px] font-black text-muted-foreground tracking-widest bg-card border border-border px-2 py-1 rounded-lg shadow-sm group-hover:border-info/10 group-hover:text-info transition-colors">
                                                    {targetIcons[announcement.targetType] || <Megaphone className="w-3 h-3" />}
                                                    <span>{announcement.targetType}</span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-medium">
                                                {announcement.body}
                                            </p>

                                            {safeActionUrl && (
                                                <div className="mt-4 pt-3 border-t border-border flex justify-end">
                                                    <Link
                                                        href={safeActionUrl}
                                                        className="text-[10px] font-black text-info hover:text-info tracking-widest flex items-center gap-1 group/link"
                                                    >
                                                        <span>View Full Details</span>
                                                        <Plus className="w-3 h-3 group-hover/link:rotate-90 transition-transform" />
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <Megaphone className="w-10 h-10 text-muted-foreground mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">No recent announcements</p>
                                <p className="text-xs text-muted-foreground mt-1">Check back later.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <CreateAnnouncementModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
}
