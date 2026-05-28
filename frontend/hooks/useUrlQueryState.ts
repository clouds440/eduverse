'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type QueryValue = string | number | boolean | null | undefined;

export function useUrlQueryState() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const getStringParam = useCallback((key: string, fallback = '') => (
        searchParams.get(key) || fallback
    ), [searchParams]);

    const getNumberParam = useCallback((key: string, fallback: number) => {
        const value = Number.parseInt(searchParams.get(key) || '', 10);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }, [searchParams]);

    const getBooleanParam = useCallback((key: string) => (
        searchParams.get(key) === 'true'
    ), [searchParams]);

    const updateQueryParams = useCallback((updates: Record<string, QueryValue>) => {
        const params = new URLSearchParams(searchParams.toString());

        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '' || value === false) {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });

        const nextQuery = params.toString();
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    return {
        searchParams,
        getStringParam,
        getNumberParam,
        getBooleanParam,
        updateQueryParams,
    };
}
