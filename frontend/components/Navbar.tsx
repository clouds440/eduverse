'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, UserPlus, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useGlobal } from '@/context/GlobalContext';
import { Brand } from './ui/Brand';
import { NotificationDropdown } from './notifications/NotificationDropdown';
import { AnnouncementDropdown } from './announcements/AnnouncementDropdown';
import { ThemeDropdown } from './ui/ThemeDropdown';
import { useTheme } from '@/context/ThemeContext';
import { DASHBOARD_MODULES } from '@/lib/constants';

const PUBLIC_NAV_LINKS = [
    { name: 'Documentation', href: '/docs' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Contact', href: '/contact' },
    { name: 'About Us', href: '/about' },
];

const NAV_HIDE_ENTER_SCROLL = 104;
const NAV_HIDE_EXIT_SCROLL = 28;
const NAV_MIN_SCROLL_RANGE = 128;
const NAV_HIDE_DELTA = 12;
const NAV_SHOW_DELTA = -12;

export default function Navbar() {
    const { token, user } = useAuth();
    const { toggleMobileSidebar, toggleSidebar, isMobileOpen, isExpanded, isDesktop, mounted } = useUI();
    const { state } = useGlobal();
    const pathname = usePathname();
    const { themeMode, setThemeMode } = useTheme();
    const navRef = useRef<HTMLElement>(null);
    const lastScrollTopRef = useRef(0);
    const activeScrollTargetRef = useRef<HTMLElement | null>(null);
    const lastScrollTargetRef = useRef<HTMLElement | null>(null);
    const navHiddenRef = useRef(false);
    const [isNavHidden, setIsNavHidden] = useState(false);
    const [hasFocusWithin, setHasFocusWithin] = useState(false);
    const chatUnread = state.stats.chat?.unread || 0;
    const mailUnread = state.stats.mail?.unread || 0;

    const isDashboard = user && new RegExp(`^/(${DASHBOARD_MODULES.join('|')})(/|$)`).test(pathname);
    const totalUnread = chatUnread + mailUnread;
    const keepNavVisible = isMobileOpen || hasFocusWithin;

    const isScrollableElement = (element?: HTMLElement | null) => {
        if (!element || element === document.documentElement || element === document.body) return false;
        return element.scrollHeight - element.clientHeight > 2;
    };

    const getPrimaryScrollState = (preferredTarget?: HTMLElement | null) => {
        if (typeof window === 'undefined') return { scrollTop: 0, scrollRange: 0 };

        const preferredScrollable = isScrollableElement(preferredTarget) ? preferredTarget : null;
        if (preferredScrollable) {
            return {
                scrollTop: preferredScrollable.scrollTop,
                scrollRange: Math.max(0, preferredScrollable.scrollHeight - preferredScrollable.clientHeight),
            };
        }

        const candidates = [
            document.querySelector<HTMLElement>('[data-dashboard-scroll-container="true"]'),
            document.querySelector<HTMLElement>('.app-shell-main'),
            document.scrollingElement as HTMLElement | null,
            document.documentElement,
            document.body,
        ].filter(Boolean) as HTMLElement[];

        const scrollableCandidate = candidates.find(isScrollableElement);
        const documentScrollRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const candidateScrollRange = scrollableCandidate
            ? Math.max(0, scrollableCandidate.scrollHeight - scrollableCandidate.clientHeight)
            : 0;

        return {
            scrollTop: Math.max(
                window.scrollY || 0,
                scrollableCandidate?.scrollTop || 0,
                document.documentElement.scrollTop || 0,
                document.body.scrollTop || 0,
            ),
            scrollRange: Math.max(documentScrollRange, candidateScrollRange),
        };
    };

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--dashboard-nav-offset', 'var(--app-nav-height)');
        setIsNavHidden(false);
        navHiddenRef.current = false;
        lastScrollTopRef.current = 0;

        return () => {
            root.style.setProperty('--dashboard-nav-offset', 'var(--app-nav-height)');
        };
    }, [pathname]);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--dashboard-nav-offset', isNavHidden ? '0px' : 'var(--app-nav-height)');
    }, [isNavHidden]);

    useEffect(() => {
        if (keepNavVisible) {
            setIsNavHidden(false);
            navHiddenRef.current = false;
            return;
        }

        let frameId: number | null = null;

        const updateNavVisibility = () => {
            frameId = null;
            const { scrollTop: currentScrollTop, scrollRange } = getPrimaryScrollState(activeScrollTargetRef.current);
            const delta = currentScrollTop - lastScrollTopRef.current;
            lastScrollTopRef.current = currentScrollTop;

            if (window.innerWidth >= 1024) {
                setIsNavHidden(false);
                navHiddenRef.current = false;
                return;
            }

            if (scrollRange < NAV_MIN_SCROLL_RANGE) {
                setIsNavHidden(false);
                navHiddenRef.current = false;
                return;
            }

            if (navHiddenRef.current) {
                if (currentScrollTop <= NAV_HIDE_EXIT_SCROLL || delta <= NAV_SHOW_DELTA) {
                    navHiddenRef.current = false;
                    setIsNavHidden(false);
                }
                return;
            }

            if (delta >= NAV_HIDE_DELTA && currentScrollTop > NAV_HIDE_ENTER_SCROLL) {
                navHiddenRef.current = true;
                setIsNavHidden(true);
            }
        };

        const scheduleUpdate = (event?: Event) => {
            const target = event?.target;
            const nextTarget = target instanceof HTMLElement ? target : null;
            if (nextTarget !== lastScrollTargetRef.current) {
                lastScrollTargetRef.current = nextTarget;
                lastScrollTopRef.current = getPrimaryScrollState(nextTarget).scrollTop;
            }
            activeScrollTargetRef.current = nextTarget;
            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(updateNavVisibility);
        };

        lastScrollTopRef.current = getPrimaryScrollState().scrollTop;
        lastScrollTargetRef.current = null;
        activeScrollTargetRef.current = null;
        document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate, { passive: true });
        scheduleUpdate();

        return () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            document.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, [keepNavVisible, pathname]);

    return (
        <nav
            ref={navRef}
            onFocusCapture={() => setHasFocusWithin(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setHasFocusWithin(false);
                }
            }}
            className={`fixed top-0 left-0 right-0 z-100 h-16 border-b border-border/70 bg-background/85 text-navbar-foreground shadow-sm backdrop-blur-md transition-transform duration-200 ease-out ${isNavHidden ? '-translate-y-full' : 'translate-y-0'}`}
        >
            <div className="mx-auto flex h-full w-full items-center justify-between gap-2 px-3 sm:px-4 lg:pr-8">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isDashboard && (
                        <button
                            type="button"
                            onClick={() => {
                                if (isDesktop) {
                                    toggleSidebar();
                                } else {
                                    toggleMobileSidebar();
                                }
                            }}
                            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            title={mounted ? (isDesktop ? (isExpanded ? "Collapse Sidebar" : "Expand Sidebar") : (isMobileOpen ? "Close Menu" : "Open Menu")) : "Menu"}
                            aria-label={mounted ? (isDesktop ? (isExpanded ? "Collapse Sidebar" : "Expand Sidebar") : (isMobileOpen ? "Close Menu" : "Open Menu")) : "Menu"}
                        >
                            {isDesktop ? (<Menu className="h-5.5 w-5.5" />) : (isMobileOpen ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />)}
                            {!isDesktop && !isMobileOpen && totalUnread > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-background">
                                    {totalUnread > 99 ? '99+' : totalUnread}
                                </span>
                            )}
                        </button>
                    )}
                    <div className="min-w-0 mt-1.25">
                        <Brand
                            size="md"
                            showName={isDesktop}
                            className="max-w-[52vw] sm:max-w-none overflow-hidden"
                        />
                    </div>
                </div>

                {!isDashboard && (
                    <div className="hidden lg:flex items-center justify-center gap-1 rounded-full border border-border/60 bg-card/45 p-1">
                        {PUBLIC_NAV_LINKS.map((item) => {
                            const isActive = item.href === '/docs'
                                ? pathname === '/docs' || pathname.startsWith('/docs/')
                                : pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                                        }`}
                                >
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}

                <div className="flex min-w-auto flex-1 items-center justify-end gap-1 sm:gap-2">
                    <ThemeDropdown
                        currentMode={themeMode}
                        onModeChange={(mode) => setThemeMode(mode)}
                        variant="compact"
                        className="shrink-0"
                    />

                    {token && user ? (
                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            <AnnouncementDropdown />
                            <NotificationDropdown />
                        </div>
                    ) : (
                        <div className="ml-1 flex min-w-0 overflow-hidden items-center rounded-full border border-border/70 bg-card/55 p-1 shadow-sm">
                            <Link
                                href="/login"
                                className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 sm:px-4 text-xs sm:text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${pathname === '/login'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-foreground hover:bg-background/75 hover:text-primary'
                                    }`}
                            >
                                <LogIn className="h-4 w-4 shrink-0" />
                                <span className="hidden min-[360px]:inline">Login</span>
                            </Link>
                            <Link
                                href="/register"
                                className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 sm:px-4 text-xs sm:text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${pathname === '/register'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-foreground hover:bg-background/75 hover:text-primary'
                                    }`}
                            >
                                <UserPlus className="h-4 w-4 shrink-0" />
                                <span className="hidden min-[360px]:inline">Register</span>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
