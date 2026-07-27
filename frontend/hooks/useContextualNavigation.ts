'use client';

import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { withReturnTo } from '@/lib/returnNavigation';

export function useContextualNavigation() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return useCallback((destination: string) => {
        const query = searchParams.toString();
        const currentPath = `${pathname}${query ? `?${query}` : ''}`;
        return withReturnTo(destination, currentPath);
    }, [pathname, searchParams]);
}

