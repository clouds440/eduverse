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


export default function Navbar() {
    const { token, user } = useAuth();
    const { toggleMobileSidebar, toggleSidebar, isMobileOpen, isExpanded, isDesktop, mounted } = useUI();
    const { state } = useGlobal();
    const pathname = usePathname();
    const { themeMode, setThemeMode } = useTheme();
    const chatUnread = state.stats.chat?.unread || 0;
    const mailUnread = state.stats.mail?.unread || 0;

    const isDashboard = user && new RegExp(`^/(${DASHBOARD_MODULES.join('|')})(/|$)`).test(pathname);

    return (
        <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between pl-2 pr-4 py-3 md:pr-10 backdrop-blur-xl bg-background/50 border-b border-border shadow-sm h-16 transition-all duration-300 text-navbar-foreground">
            <div className="flex space-x-2">
                {isDashboard && (
                    <button
                        onClick={() => {
                            if (isDesktop) {
                                toggleSidebar();
                            } else {
                                toggleMobileSidebar();
                            }
                        }}
                        className="relative p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground outline-none focus-visible:ring-2 ring-primary"
                        title={mounted ? (isDesktop ? (isExpanded ? "Collapse Sidebar" : "Expand Sidebar") : (isMobileOpen ? "Close Menu" : "Open Menu")) : "Menu"}
                    >
                        {isDesktop ? (<Menu className="w-6 h-6" />) : (isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />)}
                        {!isDesktop && !isMobileOpen && (chatUnread + mailUnread) > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-black shadow-sm">
                                {chatUnread + mailUnread > 99 ? '99+' : chatUnread + mailUnread}
                            </span>
                        )}
                    </button>
                )}
                <Brand size="md" showName={isDesktop} />
            </div>

            {!isDashboard && (
                <div className="hidden md:flex items-center space-x-8">
                    {[
                        { name: 'Documentation', href: '/docs' },
                        { name: 'Pricing', href: '/pricing' },
                        { name: 'Contact', href: '/contact' },
                        { name: 'About Us', href: '/about' },
                    ].map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300  group ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <span>{item.name}</span>
                                <span className={`absolute -bottom-1.5 left-0 h-0.5 bg-primary transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                            </Link>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center space-x-1 md:space-x-3 pr-2">
                <ThemeDropdown
                    currentMode={themeMode}
                    onModeChange={(mode) => setThemeMode(mode)}
                    variant="compact"
                />

                {token && user ? (
                    <div className="flex items-center space-x-1 md:space-x-3">
                        <AnnouncementDropdown />
                        <NotificationDropdown />
                    </div>
                ) : (
                    <div className="flex items-center p-1 rounded-lg bg-secondary/20 shadow-inner border border-secondary/10 ml-2">
                        <Link
                            href="/login"
                            className={`flex items-center mr-1 md:mr-2 space-x-2 px-3 py-2 md:px-5 md:py-2.5 rounded-lg transition-all duration-300 font-medium text-xs md:text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${pathname === '/login'
                                ? 'bg-primary text-primary-foreground shadow-lg'
                                : 'text-foreground hover:text-primary hover:bg-card'
                                }`}
                        >
                            <LogIn className="w-4 h-4" />
                            <span>Login</span>
                        </Link>
                        <Link
                            href="/register"
                            className={`flex items-center space-x-2 px-3 py-2 md:px-5 md:py-2.5 rounded-lg transition-all duration-300 font-medium text-xs md:text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary ${pathname === '/register'
                                ? 'bg-primary text-primary-foreground shadow-lg'
                                : 'text-foreground hover:text-primary hover:bg-card'
                                }`}
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Register</span>
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
}
