'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useRateLimitedRevalidation(
    revalidate: () => void | Promise<void>,
    intervalMs = 5_000,
) {
    const revalidateRef = useRef(revalidate);
    const lastRunAtRef = useRef<number | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        revalidateRef.current = revalidate;
    }, [revalidate]);

    useEffect(() => () => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }
    }, []);

    return useCallback(() => {
        if (timerRef.current !== null) return;

        const now = Date.now();
        if (lastRunAtRef.current === null) {
            lastRunAtRef.current = now;
        }
        const elapsed = now - lastRunAtRef.current;
        const delay = Math.max(0, intervalMs - elapsed);
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            lastRunAtRef.current = Date.now();
            void revalidateRef.current();
        }, delay);
    }, [intervalMs]);
}
