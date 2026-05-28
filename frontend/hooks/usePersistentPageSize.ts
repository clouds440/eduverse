'use client';

import { useCallback, useState } from 'react';

function readStoredPageSize(storageKey: string, fallback: number) {
    if (typeof window === 'undefined') return fallback;

    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? Number.parseInt(saved, 10) : fallback;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function usePersistentPageSize(storageKey: string, fallback = 10) {
    const [pageSize, setPageSize] = useState<number>(() => readStoredPageSize(storageKey, fallback));

    const setPersistentPageSize = useCallback((nextPageSize: number) => {
        const normalized = Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : fallback;
        setPageSize(normalized);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(storageKey, String(normalized));
        }
    }, [fallback, storageKey]);

    return [pageSize, setPersistentPageSize] as const;
}
