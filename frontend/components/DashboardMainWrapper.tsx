'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { DASHBOARD_MODULES } from '@/lib/constants';

export default function DashboardMainWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const scrollContainerRef = useRef<HTMLElement>(null);
    
    // Pattern-based path detection
    const segments = pathname?.split('/').filter(Boolean) || [];
    
    // Public routes are: Home (/), Guests (/login, /register), or any root-level path not matching dashboard patterns
    const isDashboard = segments[0] === 'admin' || DASHBOARD_MODULES.includes(segments[0]);
    const isGuest = segments.length === 1 && (segments[0] === 'login' || segments[0] === 'register');
    const isHome = segments.length === 0;
    
    const isPublicPage = isHome || isGuest || !isDashboard;

    // Reset scroll position on route change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo(0, 0);
        }
    }, [pathname]);

    return (
        <main 
            ref={scrollContainerRef}
            data-shell-mode={isPublicPage ? 'public' : 'dashboard'}
            className={`app-shell-main grow relative z-10 w-full flex flex-col overflow-x-hidden pt-[var(--dashboard-nav-offset)] transition-[padding-top] duration-200 ease-out ${isPublicPage ? 'h-[var(--app-height)] overflow-y-auto' : 'h-full overflow-hidden'}`}
        >
            <div className="grow flex flex-col min-h-0">
                {children}
            </div>
        </main>
    );
}
