'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, MoreHorizontal, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRouteOrientation } from '@/lib/routeOrientation';

interface PageShellProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: LucideIcon;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    breadcrumbs?: PageBreadcrumb[];
    className?: string;
}

export interface PageBreadcrumb {
    label: string;
    href?: string;
}

export interface ActiveFilter {
    key: string;
    label: string;
    value?: string;
    onRemove: () => void;
}

interface ResourceToolbarProps {
    search?: React.ReactNode;
    filters?: React.ReactNode;
    actions?: React.ReactNode;
    activeFilters?: ActiveFilter[];
    className?: string;
}

interface RouteBreadcrumbsProps {
    breadcrumbs?: PageBreadcrumb[];
    className?: string;
}

export function PageShell({ children, className, style }: PageShellProps) {
    return (
        <div className={cn('flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden', className)} style={style}>
            {children}
        </div>
    );
}

export function RouteBreadcrumbs({ breadcrumbs, className }: RouteBreadcrumbsProps) {
    const pathname = usePathname();
    const resolvedBreadcrumbs = breadcrumbs ?? getRouteOrientation(pathname || '/').breadcrumbs;

    if (resolvedBreadcrumbs.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
            <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-muted-foreground">
                {resolvedBreadcrumbs.map((item, index) => {
                    const isLast = index === resolvedBreadcrumbs.length - 1;
                    return (
                        <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
                            {item.href && !isLast ? (
                                <Link href={item.href} className="truncate transition-colors hover:text-foreground">
                                    {item.label}
                                </Link>
                            ) : (
                                <span className={cn('truncate', isLast && 'text-foreground')}>
                                    {item.label}
                                </span>
                            )}
                            {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

const PAGE_HEADER_COMPACT_ENTER_SCROLL = 72;
const PAGE_HEADER_COMPACT_EXIT_SCROLL = 24;
const PAGE_HEADER_MIN_SCROLL_RANGE = 96;

function getScrollableRange(element: HTMLElement) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
}

function hasVerticalScrollBehavior(element: HTMLElement) {
    const style = window.getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(style.overflowY);
}

function getPageScrollElement(header: HTMLElement): HTMLElement | null {
    const dashboardScrollContainer = header.closest<HTMLElement>('[data-dashboard-scroll-container="true"]');
    if (dashboardScrollContainer && hasVerticalScrollBehavior(dashboardScrollContainer)) {
        return dashboardScrollContainer;
    }

    let ancestor: HTMLElement | null = header.parentElement;
    while (ancestor && ancestor !== document.body) {
        if (hasVerticalScrollBehavior(ancestor)) {
            return ancestor;
        }
        ancestor = ancestor.parentElement;
    }

    return null;
}

function getPageScrollState(header: HTMLElement) {
    const root = getPageScrollElement(header);
    let maxScrollTop = window.scrollY;
    let maxScrollRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    if (root) {
        maxScrollTop = Math.max(maxScrollTop, root.scrollTop);
        maxScrollRange = Math.max(maxScrollRange, getScrollableRange(root));

        root.querySelectorAll<HTMLElement>('*').forEach((element) => {
            if (!hasVerticalScrollBehavior(element)) return;
            const scrollRange = getScrollableRange(element);
            if (scrollRange <= 1) return;

            maxScrollTop = Math.max(maxScrollTop, element.scrollTop);
            maxScrollRange = Math.max(maxScrollRange, scrollRange);
        });
    }

    return { scrollTop: maxScrollTop, scrollRange: maxScrollRange };
}

export function PageHeader({ title, description, icon: Icon, meta, actions, breadcrumbs, className }: PageHeaderProps) {
    const pathname = usePathname();
    const headerRef = useRef<HTMLElement>(null);
    const compactAllowedRef = useRef(false);
    const isScrolledRef = useRef(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(true);
    const isCompact = isMobile || isScrolled;
    const hasActions = Boolean(actions);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const updateMobile = () => setIsMobile(mediaQuery.matches);

        updateMobile();
        mediaQuery.addEventListener('change', updateMobile);
        return () => mediaQuery.removeEventListener('change', updateMobile);
    }, []);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        let frameId: number | null = null;
        let resizeObserver: ResizeObserver | null = null;
        const scrollElement = getPageScrollElement(header);

        const setStableScrolled = (next: boolean) => {
            isScrolledRef.current = next;
            setIsScrolled(next);
        };

        const measureCompactEligibility = () => {
            const { scrollRange } = getPageScrollState(header);
            if (!isScrolledRef.current) {
                compactAllowedRef.current = scrollRange >= PAGE_HEADER_MIN_SCROLL_RANGE;
            }
        };

        const updateScrolledState = () => {
            frameId = null;
            const { scrollTop } = getPageScrollState(header);
            setIsScrolled((current) => {
                if (!compactAllowedRef.current) {
                    isScrolledRef.current = false;
                    return false;
                }

                const next = current
                    ? scrollTop > PAGE_HEADER_COMPACT_EXIT_SCROLL
                    : scrollTop > PAGE_HEADER_COMPACT_ENTER_SCROLL;
                isScrolledRef.current = next;
                return next;
            });
        };

        const scheduleUpdate = () => {
            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(() => {
                measureCompactEligibility();
                updateScrolledState();
            });
        };

        const resetAndMeasure = () => {
            compactAllowedRef.current = false;
            setStableScrolled(false);
            scheduleUpdate();
        };

        resetAndMeasure();
        scrollElement?.addEventListener('scroll', scheduleUpdate, { passive: true });
        document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
        window.addEventListener('resize', resetAndMeasure, { passive: true });

        if (typeof ResizeObserver !== 'undefined' && scrollElement) {
            resizeObserver = new ResizeObserver(() => {
                if (!isScrolledRef.current) scheduleUpdate();
            });
            resizeObserver.observe(scrollElement);
        }

        return () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            resizeObserver?.disconnect();
            scrollElement?.removeEventListener('scroll', scheduleUpdate);
            document.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('resize', resetAndMeasure);
        };
    }, [pathname]);

    return (
        <header
            ref={headerRef}
            className={cn(
                'shrink-0 rounded-lg border border-border bg-card/80 shadow-xl backdrop-blur-2xl print:hidden',
                isCompact ? 'p-2' : 'p-2 md:p-3',
                className,
            )}
        >
            <div className={cn(
                'flex min-w-0 flex-row justify-between gap-3',
                isCompact ? 'items-center' : 'items-start',
            )}>
                <div className={cn('flex min-w-0 flex-1 items-start gap-3', isCompact && 'items-center gap-2')}>
                    {Icon && (
                        <div className={cn(
                            'flex shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary shadow-inner',
                            isCompact ? 'h-7 w-7' : 'h-12 w-12',
                        )}>
                            <Icon className={cn(isCompact ? 'h-4 w-4' : 'h-6 w-6')} aria-hidden="true" />
                        </div>
                    )}
                    <div className={cn('min-w-0', isCompact && 'flex min-h-7 items-center')}>
                        <RouteBreadcrumbs breadcrumbs={breadcrumbs} className={cn(!isCompact && 'mb-1.5')} />
                        {!isCompact && (
                            <>
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <h1 className="min-w-0 text-2xl font-bold leading-tight tracking-tight text-foreground">
                                        {title}
                                    </h1>
                                    {meta}
                                </div>
                                {description && (
                                    <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
                                        {description}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
                {hasActions && (
                    <button
                        type="button"
                        onClick={() => setActionsOpen((open) => !open)}
                        className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        aria-expanded={actionsOpen}
                        aria-label={actionsOpen ? 'Collapse page actions' : 'Expand page actions'}
                        title={actionsOpen ? 'Collapse actions' : 'Expand actions'}
                    >
                        {actionsOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
                    </button>
                )}
            </div>
            {hasActions && actionsOpen && (
                <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end md:items-center md:justify-end">
                        {actions}
                    </div>
                </div>
            )}
        </header>
    );
}

export function ResourcePanel({ children, className, style }: PageShellProps) {
    return (
        <section className={cn('flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm', className)} style={style}>
            {children}
        </section>
    );
}

export function ResourceToolbar({ search, filters, actions, activeFilters = [], className }: ResourceToolbarProps) {
    const hasControls = search || filters || actions;

    if (!hasControls && activeFilters.length === 0) return null;

    return (
        <div className={cn('shrink-0 border-b border-border/60 bg-card/80 p-3 sm:p-4', className)}>
            {hasControls && (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {search && <div className="min-w-0 flex-1">{search}</div>}
                    {(filters || actions) && (
                        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end">
                            {filters}
                            {actions}
                        </div>
                    )}
                </div>
            )}

            {activeFilters.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {activeFilters.map((filter) => (
                        <span
                            key={filter.key}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
                        >
                            <span className="shrink-0 text-muted-foreground">{filter.label}</span>
                            {filter.value && <span className="min-w-0 truncate">{filter.value}</span>}
                            <button
                                type="button"
                                onClick={filter.onRemove}
                                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                aria-label={`Remove ${filter.label} filter`}
                            >
                                <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
