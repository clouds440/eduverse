'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const BACK_SENTINEL_KEY = '__eduverseInPageBack';
const MOBILE_BREAKPOINT = 1024;

export function isInPageBackSentinelState(state: unknown) {
    return !!state && typeof state === 'object' && Boolean((state as Record<string, unknown>)[BACK_SENTINEL_KEY]);
}

interface BackStackEntry {
    id: string;
    label?: string;
    priority: number;
    order: number;
    onBack: () => void;
}

interface RegisterBackEntryOptions {
    id: string;
    label?: string;
    priority?: number;
    onBack: () => void;
}

interface BackNavigationContextType {
    hasInPageBack: boolean;
    isMobileBackEnabled: boolean;
    registerBackEntry: (entry: RegisterBackEntryOptions) => () => void;
    goBack: () => void;
}

const BackNavigationContext = createContext<BackNavigationContextType | undefined>(undefined);

function getTopEntry(entries: Iterable<BackStackEntry>) {
    let top: BackStackEntry | null = null;
    for (const entry of entries) {
        if (!top || entry.priority > top.priority || (entry.priority === top.priority && entry.order > top.order)) {
            top = entry;
        }
    }
    return top;
}

export function BackNavigationProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const routeKey = `${pathname}?${searchParams.toString()}`;
    const [entryCount, setEntryCount] = useState(0);
    const [isMobileBackEnabled, setIsMobileBackEnabled] = useState(false);

    const entriesRef = useRef<Map<string, BackStackEntry>>(new Map());
    const orderRef = useRef(0);
    const armedRef = useRef(false);
    const sentinelRouteKeyRef = useRef<string | null>(null);
    const suppressNextPopRef = useRef(false);
    const routeKeyRef = useRef(routeKey);

    useEffect(() => {
        const update = () => setIsMobileBackEnabled(window.innerWidth < MOBILE_BREAKPOINT);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const syncEntryCount = useCallback(() => setEntryCount(entriesRef.current.size), []);

    const consumeTopEntry = useCallback(() => {
        const top = getTopEntry(entriesRef.current.values());
        if (!top) return false;
        top.onBack();
        return true;
    }, []);

    const armHistorySentinel = useCallback(() => {
        if (armedRef.current || !isMobileBackEnabled || entriesRef.current.size === 0) return;
        const currentState = window.history.state && typeof window.history.state === 'object'
            ? window.history.state
            : {};

        window.history.pushState(
            { ...currentState, [BACK_SENTINEL_KEY]: true },
            '',
            window.location.href,
        );
        armedRef.current = true;
        sentinelRouteKeyRef.current = routeKeyRef.current;
    }, [isMobileBackEnabled]);

    const registerBackEntry = useCallback((entry: RegisterBackEntryOptions) => {
        const order = orderRef.current + 1;
        orderRef.current = order;

        entriesRef.current.set(entry.id, {
            id: entry.id,
            label: entry.label,
            priority: entry.priority ?? 0,
            order,
            onBack: entry.onBack,
        });
        syncEntryCount();

        return () => {
            if (entriesRef.current.delete(entry.id)) {
                syncEntryCount();
            }
        };
    }, [syncEntryCount]);

    const goBack = useCallback(() => {
        if (entriesRef.current.size > 0) {
            if (isMobileBackEnabled && armedRef.current) {
                window.history.back();
                return;
            }

            consumeTopEntry();
            return;
        }

        router.back();
    }, [consumeTopEntry, isMobileBackEnabled, router]);

    useEffect(() => {
        routeKeyRef.current = routeKey;
        armedRef.current = isInPageBackSentinelState(window.history.state);
        if (!armedRef.current) {
            sentinelRouteKeyRef.current = null;
        }
    }, [routeKey]);

    useEffect(() => {
        const handlePopState = () => {
            if (suppressNextPopRef.current) {
                suppressNextPopRef.current = false;
                return;
            }

            if (!isMobileBackEnabled || entriesRef.current.size === 0) {
                armedRef.current = false;
                return;
            }

            // The same-URL sentinel has been consumed. Close the top transient UI
            // instead of letting the first back action leave the current route.
            armedRef.current = false;
            sentinelRouteKeyRef.current = null;
            consumeTopEntry();

            window.setTimeout(() => {
                if (routeKeyRef.current === routeKey && entriesRef.current.size > 0) {
                    armHistorySentinel();
                }
            }, 0);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [armHistorySentinel, consumeTopEntry, isMobileBackEnabled, routeKey]);

    useEffect(() => {
        if (!isMobileBackEnabled) return;

        if (entriesRef.current.size > 0) {
            armHistorySentinel();
            return;
        }

        if (armedRef.current) {
            if (routeKeyRef.current !== sentinelRouteKeyRef.current || !isInPageBackSentinelState(window.history.state)) {
                armedRef.current = false;
                sentinelRouteKeyRef.current = null;
                return;
            }

            armedRef.current = false;
            sentinelRouteKeyRef.current = null;
            suppressNextPopRef.current = true;
            window.history.back();
        }
    }, [armHistorySentinel, entryCount, isMobileBackEnabled]);

    const value = useMemo<BackNavigationContextType>(() => ({
        hasInPageBack: entryCount > 0,
        isMobileBackEnabled,
        registerBackEntry,
        goBack,
    }), [entryCount, goBack, isMobileBackEnabled, registerBackEntry]);

    return (
        <BackNavigationContext.Provider value={value}>
            {children}
        </BackNavigationContext.Provider>
    );
}

export function useBackNavigation() {
    const context = useContext(BackNavigationContext);
    if (!context) throw new Error('useBackNavigation must be used within a BackNavigationProvider');
    return context;
}

export function useBackStackEntry({
    enabled,
    label,
    onBack,
    priority = 0,
}: {
    enabled: boolean;
    label?: string;
    onBack: () => void;
    priority?: number;
}) {
    const { registerBackEntry } = useBackNavigation();
    const id = React.useId();
    const onBackRef = useRef(onBack);

    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    useEffect(() => {
        if (!enabled) return;

        return registerBackEntry({
            id,
            label,
            priority,
            onBack: () => onBackRef.current(),
        });
    }, [enabled, id, label, priority, registerBackEntry]);
}
