'use client';

import { usePathname } from 'next/navigation';
import { DASHBOARD_MODULES } from '@/lib/constants';

function isDashboardPath(pathname: string) {
    const firstSegment = pathname.split('/').filter(Boolean)[0] || '';
    return firstSegment === 'admin' || DASHBOARD_MODULES.includes(firstSegment);
}

export function AppBackground() {
    const pathname = usePathname() || '/';
    const variant = isDashboardPath(pathname) ? 'dashboard' : 'public';

    return (
        <div
            aria-hidden="true"
            className={`app-background app-background--${variant}`}
        />
    );
}
