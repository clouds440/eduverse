'use client';

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

export default function Navbar() {
    const { token, user } = useAuth();
    const { toggleMobileSidebar, toggleSidebar, isMobileOpen, isExpanded, isDesktop, mounted } = useUI();
    const { state } = useGlobal();
    const pathname = usePathname();
    const { themeMode, setThemeMode } = useTheme();
    const chatUnread = state.stats.chat?.unread || 0;
    const mailUnread = state.stats.mail?.unread || 0;

    const isDashboard = user && new RegExp(`^/(${DASHBOARD_MODULES.join('|')})(/|$)`).test(pathname);
    const totalUnread = chatUnread + mailUnread;

    return (
        <nav className="fixed top-0 left-0 right-0 z-100 h-16 border-b border-border/70 bg-background/85 backdrop-blur-md shadow-sm text-navbar-foreground">
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
