'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LogOut, Key, Mail, MessageCircleQuestionMark, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { useGlobal } from '@/context/GlobalContext';
import { Role } from '@/types';
import { BackButton } from './BackButton';
import { DataViewModal } from './DataViewModal';
import { BrandIcon } from './Brand';
import { Badge } from './Badge';
import { getRoleLabel } from '@/lib/roles';

export interface SidebarLink {
    id: string;
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string | number;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    links: SidebarLink[];
    bottomLinks?: SidebarLink[];
    showPadding?: boolean;
}

interface SidebarNavLinkProps {
    link: SidebarLink;
    href: string;
    isActive: boolean;
    isSidebarCompact: boolean;
    showSidebarText: boolean;
    onClick: () => void;
}

const SIDEBAR_TEXT_DELAY_MS = 280;

const SidebarNavLink = React.memo(function SidebarNavLink({
    link,
    href,
    isActive,
    isSidebarCompact,
    showSidebarText,
    onClick,
}: SidebarNavLinkProps) {
    const Icon = link.icon;

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`
                flex items-center rounded-lg transition-colors group relative hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35
                ${isActive
                    ? 'bg-primary/20 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-sidebar-text/70 hover:text-foreground/70 hover:text-sidebar-text'
                }
                ${isSidebarCompact ? 'lg:justify-center p-3' : 'px-4 py-3'}
            `}
            title={isSidebarCompact ? link.label : undefined}
        >
            {isActive && (
                <div className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-primary rounded-full z-10 shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" />
            )}
            <Icon className={`w-5 h-5 shrink-0 text-primary/80 transition-transform ${isActive ? 'scale-110 text-primary' : 'group-hover:scale-110'}`} />
            {showSidebarText && (
                <span className="font-bold text-sm tracking-wide ml-2">
                    {link.label}
                </span>
            )}
            {link.badge !== undefined && (
                <span className={`
                    flex items-center justify-center shrink-0
                    ${isSidebarCompact
                        ? 'absolute -top-0.5 -right-1.5'
                        : 'ml-auto'
                    }
                    animate-in zoom-in duration-300
                `}>
                    <Badge
                        variant={link.badge === 0 ? 'neutral' : link.label === 'Messages' ? 'error' : 'primary'}
                        size="sm"
                    >
                        {link.badge}
                    </Badge>
                </span>
            )}
        </Link>
    );
});

const ReadOnlyBanner = () => (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-500">
        <Eye className="w-4 h-4 text-warning" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-warning/90">
            Read-Only Mode: Your account has restricted write access.
        </span>
    </div>
);

const USER_MANAGEMENT_PREFIXES = [
    '/users',
];

function isUserManagementPath(pathname: string) {
    return USER_MANAGEMENT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function DashboardLayout({ children, links, bottomLinks = [], showPadding = false }: DashboardLayoutProps) {
    const { logout, user } = useAuth();
    const { state } = useGlobal();
    const { isExpanded, isMobileOpen, isDesktop, mounted, setIsMobileOpen, modalConfig, closeViewModal } = useUI();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isBottomSectionCollapsed, setIsBottomSectionCollapsed] = useState(true);

    const mailCount = state.stats.mail || { unread: 0, total: 0 };
    const changePasswordHref = user?.role === Role.SUPER_ADMIN || user?.role === Role.PLATFORM_ADMIN ? '/admin/change-password' : '/change-password';
    const closeMobileSidebar = React.useCallback(() => setIsMobileOpen(false), [setIsMobileOpen]);
    const effectiveExpanded = !mounted || (isDesktop ? isExpanded : true);
    const [showSidebarText, setShowSidebarText] = useState(effectiveExpanded);
    const [isSidebarCompact, setIsSidebarCompact] = useState(!effectiveExpanded);

    React.useEffect(() => {
        if (!mounted || !isDesktop) {
            setShowSidebarText(true);
            return;
        }

        if (!effectiveExpanded) {
            setShowSidebarText(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setShowSidebarText(true);
        }, SIDEBAR_TEXT_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [effectiveExpanded, isDesktop, mounted]);

    React.useEffect(() => {
        if (!mounted || !isDesktop || effectiveExpanded) {
            setIsSidebarCompact(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setIsSidebarCompact(true);
        }, SIDEBAR_TEXT_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [effectiveExpanded, isDesktop, mounted]);

    const activeLink = React.useMemo(() => {
        const allLinks = [...links, ...bottomLinks];
        const query = searchParams.toString();
        const fullPath = query ? `${pathname}?${query}` : pathname;
        const getHrefPath = (href: string) => href.split('?')[0];
        const usersLink = allLinks.find((link) => link.id === 'USERS');
        if (usersLink && isUserManagementPath(pathname)) return usersLink;

        if (user?.role === Role.GUARDIAN && pathname === '/guardian') {
            const currentView = searchParams.get('view') || 'overview';
            const guardianMatch = allLinks.find((link) => {
                if (!link.href.startsWith('/guardian')) return false;
                const linkView = new URLSearchParams(link.href.split('?')[1] || '').get('view') || 'overview';
                return linkView === currentView;
            });
            if (guardianMatch) return guardianMatch;
        }

        // 1. Try exact match first
        const exactMatch = allLinks.find(l => l.href === fullPath);
        if (exactMatch) return exactMatch;

        // 1b. Match parent routes when the current URL only differs by query params.
        const pathOnlyMatch = allLinks.find(l => getHrefPath(l.href) === pathname && !l.href.includes('?'));
        if (pathOnlyMatch) return pathOnlyMatch;

        // 2. Intelligent Tab/Query Match (ignores extra params like sectionId)
        const currentTab = searchParams.get('tab') || 'overview';
        const tabMatch = allLinks.find(l => {
            const isTabLink = l.href.includes('tab=');
            if (isTabLink) {
                const linkUrlPart = l.href.split('?')[1] || '';
                const linkTab = new URLSearchParams(linkUrlPart).get('tab');
                return linkTab === currentTab && getHrefPath(l.href) === pathname;
            }
            return currentTab === 'overview' && l.href === pathname;
        });

        if (tabMatch) return tabMatch;

        // 4. Try sub-path matches
        // Exclude query-based links here to avoid false positive subpath matches
        return allLinks
            .filter(l => !l.href.endsWith('/dashboard') && !l.href.endsWith('/admin') && !l.href.includes('?'))
            .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0))
            .find(l => pathname === l.href || pathname.startsWith(`${l.href}/`));
    }, [pathname, searchParams, links, bottomLinks, user?.role]);

    const handleLogout = () => {
        logout();
    };

    const getLinkHref = React.useCallback((href: string) => {
        if (user?.role !== Role.GUARDIAN || !href.startsWith('/guardian')) return href;
        const studentId = searchParams.get('studentId');
        if (!studentId) return href;

        const [path, query = ''] = href.split('?');
        const params = new URLSearchParams(query);
        params.set('studentId', studentId);
        const nextQuery = params.toString();
        return nextQuery ? `${path}?${nextQuery}` : path;
    }, [searchParams, user?.role]);

    return (
        <div className="flex w-full bg-theme-bg h-full overflow-hidden relative select-none">
            {/* Global View Modal */}
            <DataViewModal
                isOpen={modalConfig.isOpen}
                onClose={closeViewModal}
                title={modalConfig.title}
                subtitle={modalConfig.subtitle}
                fields={modalConfig.fields}
                body={modalConfig.body}
                bodyClassName={modalConfig.bodyClassName}
                actions={modalConfig.actions}
            />

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-card/50 backdrop-blur-sm z-80 lg:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Branded Sidebar */}
            <aside
                className={`
                    fixed lg:relative inset-y-0 left-0 z-90 transform
                    flex flex-col bg-background text-sidebar-text border-r border-border shadow-[4px_0_24px_var(--shadow-color)]
                    ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
                    ${effectiveExpanded ? 'lg:w-64' : 'lg:w-18'}
                    h-full shrink-0 overflow-hidden
                    transition-[width,transform] duration-300 ease-in-out
                `}
            >
                {/* Sidebar Header - Branded */}
                <div className={`h-16 mt-14 lg:mt-0 flex items-center px-4 border-b border-border shrink-0 ${isSidebarCompact ? 'justify-center' : 'justify-between'} gap-2 overflow-hidden relative group`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="ml-auto opacity-40 hover:opacity-100 transition-opacity">
                            <BackButton
                                {...(showSidebarText ? { label: activeLink?.label } : { label: "" })}
                                className="bg-transparent! border-none! rounded-md! shadow-none! text-foreground! py-1.5! px-3.5! outline-none! focus:outline-none!"
                            />
                        </div>
                    </div>
                </div>

                {/* Branded Sidebar Links */}
                <div className="flex-1 overflow-y-auto scrollbar-none py-6 px-3 space-y-1.5">
                    {links.map((link) => {
                        const isActive = activeLink?.id === link.id;
                        return (
                            <SidebarNavLink
                                key={link.id}
                                link={link}
                                href={getLinkHref(link.href)}
                                isActive={isActive}
                                isSidebarCompact={isSidebarCompact}
                                showSidebarText={showSidebarText}
                                onClick={closeMobileSidebar}
                            />
                        );
                    })}
                </div>

                {/* Branded Sidebar Footer */}
                <div className={`px-3 pb-[env(safe-area-inset-bottom,0px)] border-t ${isBottomSectionCollapsed ? '' : 'bg-card'} border-border shrink-0 relative`}>
                    {/* Toggle button sitting on top of border */}
                    <button
                        type="button"
                        onClick={() => setIsBottomSectionCollapsed(!isBottomSectionCollapsed)}
                        className={`absolute -top-2 left-1/2 -translate-x-1/2 px-5 py-0 rounded-md border border-border/40 text-sidebar-text/60 bg-background hover:bg-card transition-all shadow-sm`}
                        title={isBottomSectionCollapsed ? "Show more" : "Show less"}
                    >
                        {isBottomSectionCollapsed ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronUp className="w-4 h-4 shrink-0" />}
                        {isBottomSectionCollapsed && mailCount.unread > 0 && (
                            <span className="absolute -top-2 -right-2">
                                <Badge variant="error" size="xs">
                                    {mailCount.unread > 9 ? '9+' : mailCount.unread}
                                </Badge>
                            </span>
                        )}
                    </button>

                    {/* Collapsible bottom links */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isBottomSectionCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'}`}>
                        <div className="space-y-2 pb-3 pt-4">
                            {user?.role !== Role.SUPER_ADMIN && user?.role !== Role.PLATFORM_ADMIN && (
                                <>
                                    <Link
                                        href="/mail"
                                        onClick={closeMobileSidebar}
                                        className={`flex items-center hover:bg-primary/10 ${isSidebarCompact ? 'justify-center' : 'justify-start px-3'} rounded-lg text-sidebar-text/60 transition-colors py-3 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${pathname.includes('/mail') ? 'bg-primary/20 text-primary ring-1 ring-primary/20' : 'bg-background hover:text-foreground/70'}`}
                                        title="Mail"
                                    >
                                        {pathname.includes('/mail') && (
                                            <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-primary rounded-full z-10" />
                                        )}
                                        <Mail className="w-4 h-4 shrink-0 text-primary/80" />
                                        {showSidebarText && <span className="ml-2 font-bold text-[10px] tracking-wider">Mail</span>}
                                        {/* Mail Count */}
                                        {mailCount.unread > 0 && (
                                            <span className={`ml-auto ${isSidebarCompact ? 'absolute top-0 -right-0.5' : ''}`}>
                                                <Badge variant='error' size="sm">
                                                    {mailCount.unread > 99 ? '99+' : mailCount.unread}
                                                </Badge>
                                            </span>
                                        )}
                                    </Link>

                                    {user?.role !== Role.STUDENT && user?.role !== Role.GUARDIAN &&
                                        <Link
                                            href="/contact"
                                            onClick={closeMobileSidebar}
                                            className={`flex items-center hover:bg-primary/10 ${isSidebarCompact ? 'justify-center' : 'justify-start px-3'} rounded-lg text-sidebar-text/60 transition-colors py-3 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${pathname === '/contact' ? 'bg-primary/20 text-primary ring-1 ring-primary/20' : 'bg-background hover:text-foreground/70'}`}
                                            title="Contact Us"
                                        >
                                            {pathname === '/contact' && (
                                                <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-primary rounded-full z-10" />
                                            )}
                                            <MessageCircleQuestionMark className="w-4 h-4 shrink-0 text-primary/80" />
                                            {showSidebarText && <span className="ml-2 font-bold text-[10px] tracking-wider">Contact Us</span>}
                                        </Link>}
                                </>
                            )}

                            <Link
                                href={changePasswordHref}
                                onClick={closeMobileSidebar}
                                className={`flex items-center hover:bg-primary/10 ${isSidebarCompact ? 'justify-center' : 'justify-start px-3'} rounded-lg text-sidebar-text/60 transition-colors py-3 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${pathname.includes('/change-password') ? 'bg-primary/20 text-primary ring-1 ring-primary/20' : 'bg-background hover:text-foreground/70'}`}
                                title="Change Password"
                            >
                                {pathname.includes('/change-password') && (
                                    <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-primary rounded-full z-10" />
                                )}
                                <Key className="w-4 h-4 shrink-0 text-primary/80" />
                                {showSidebarText && <span className="ml-2 font-bold text-[10px] tracking-wider">Change Password</span>}
                            </Link>

                            {/* log out button separater */}
                            <div className="border-t-2 my-2 border-border"></div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className={`flex items-center cursor-pointer ${isSidebarCompact ? 'justify-center' : 'justify-start px-3'} w-full rounded-md text-danger bg-danger/10 hover:bg-danger/30 transition-all py-3`}
                                title="Log out"
                            >
                                <LogOut className="w-4 h-4 shrink-0 text-danger" />
                                {showSidebarText && <span className="ml-2 font-bold text-[10px] tracking-wider">Log out</span>}
                            </button>
                        </div>
                    </div>

                    {user && (
                        <div className={`flex items-center mt-2 cursor-pointer ${isSidebarCompact ? 'lg:justify-center' : 'space-x-3 px-1'} mb-4`}
                            onClick={() => setIsBottomSectionCollapsed(!isBottomSectionCollapsed)}
                        >
                            <div className={`w-9 h-9 flex items-center justify-center shrink-0 shadow-inner relative`}>
                                <BrandIcon variant="user" user={user} size="sm" className="w-9 h-9" imageLoading="eager" />
                            </div>
                            <div className={`overflow-hidden transition-all ml-2 ${!showSidebarText ? 'lg:hidden lg:w-0' : 'w-auto'}`}>
                                <div className="text-xs font-black text-sidebar-text truncate max-w-30">{user.name || user.email}</div>
                                <div className="text-[9px] font-bold text-sidebar-text/60 tracking-tighter leading-none mt-0.5">{user.designation || getRoleLabel(user.role, '')}</div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex min-w-0 h-full relative overflow-hidden">
                {/* Universal Content Wrapper - This is the ONLY scrollable area (unless in app-like routes) */}
                <div
                    data-dashboard-scroll-container="true"
                    className={`flex-1 min-h-0 w-full ${showPadding ? 'px-0.75 md:px-2 py-1 md:py-2 bg-background' : 'p-0 bg-card'} ${pathname.includes('/chat') || pathname.includes('/mail') ? 'overflow-hidden' : 'overflow-y-auto p-2'} custom-scrollbar flex flex-col`}
                >
                    {user?.accessLevel === 1 && <ReadOnlyBanner />}
                    {children}
                </div>
                <div
                    id="eduverse-ai-copilot-dock-host"
                    className="relative hidden h-full shrink-0 overflow-hidden lg:block"
                />
            </main>
        </div>
    );
}
