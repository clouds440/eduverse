'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { SearchBar } from '@/components/ui/SearchBar';
import { cn } from '@/lib/utils';
import { buildRouteSearchItems, searchRouteItems, type ScoredRouteSearchItem } from './searchIndex';

const RESULT_LIMIT = 10;

function ResultIcon({ item }: { item: ScoredRouteSearchItem }) {
    const Icon = item.icon || Search;
    return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
    );
}

interface GlobalSearchProps {
    onOpenChange?: (open: boolean) => void;
}

export function GlobalSearch({ onOpenChange }: GlobalSearchProps) {
    const { user, token } = useAuth();
    const { state } = useGlobal();
    const router = useRouter();
    const pathname = usePathname();
    const rootRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [prevPathname, setPrevPathname] = useState(pathname);
    const [prevQuery, setPrevQuery] = useState(query);
    const isApproved = (user?.accessLevel ?? 2) >= 1;

    const items = useMemo(() => buildRouteSearchItems({
        user,
        isApproved,
        unreadChats: state.stats.chat?.unread,
    }), [isApproved, state.stats.chat?.unread, user]);

    const results = useMemo(() => searchRouteItems(query, items, RESULT_LIMIT), [items, query]);
    const visibleResults = isOpen ? results : [];

    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setQuery('');
        setIsOpen(false);
        setActiveIndex(0);
    }

    if (query !== prevQuery) {
        setPrevQuery(query);
        setActiveIndex(0);
    }

    useEffect(() => {
        onOpenChange?.(isOpen);
        return () => {
            if (isOpen) onOpenChange?.(false);
        };
    }, [isOpen, onOpenChange]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (rootRef.current?.contains(target)) return;
            setIsOpen(false);
            if (!query) setActiveIndex(0);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen, query]);

    if (!token || !user || items.length === 0) return null;

    const navigateTo = (href: string) => {
        setIsOpen(false);
        setQuery('');
        router.push(href);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            setIsOpen(false);
            setQuery('');
            return;
        }

        if (!visibleResults.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % visibleResults.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + visibleResults.length) % visibleResults.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            navigateTo(visibleResults[activeIndex]?.href || visibleResults[0].href);
        }
    };

    return (
        <div
            ref={rootRef}
            className="relative shrink-0"
            onFocusCapture={() => setIsOpen(true)}
            onPointerDownCapture={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
        >
            <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search routes..."
                ariaLabel="Search routes and actions"
                delay={80}
                mobileMode="expandable"
                expandOn="all"
                size="compact"
                appearance="nav"
                expandedClassName="w-[min(16rem,calc(100vw-12rem))] sm:w-80"
            />

            {isOpen && (
                <div className="fixed left-3 right-3 top-18 z-9999 overflow-hidden rounded-lg border border-border/80 bg-card shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-96">
                    <div className="max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto p-1.5">
                        {visibleResults.length > 0 ? (
                            visibleResults.map((item, index) => (
                                <Link
                                    key={`${item.id}-${item.href}`}
                                    href={item.href}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => {
                                        setIsOpen(false);
                                        setQuery('');
                                    }}
                                    className={cn(
                                        'flex min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                                        index === activeIndex ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-muted',
                                    )}
                                >
                                    <ResultIcon item={item} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-black">{item.title}</span>
                                        <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                                            {item.description || item.group}
                                        </span>
                                    </span>
                                    <span className="hidden shrink-0 rounded-md border border-border/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground sm:inline">
                                        {item.group}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm font-black text-foreground">No route matches</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Try a page name, action, or shorthand.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
