'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, MoreHorizontal, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRouteOrientation } from '@/lib/routeOrientation';

interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export interface PageTabItem<T extends string = string> {
    value: T;
    label: React.ReactNode;
    icon?: LucideIcon;
    count?: React.ReactNode;
    href?: string;
    hidden?: boolean;
}

interface PageTabsProps<T extends string = string> {
    items: readonly PageTabItem<T>[];
    activeValue: T;
    ariaLabel: string;
    onValueChange?: (value: T) => void;
    hideOnScroll?: boolean;
    size?: 'sm' | 'md';
    tone?: 'page' | 'panel';
    className?: string;
    itemClassName?: string;
}

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: LucideIcon;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    actionsDefaultOpen?: boolean;
    showDateTime?: boolean;
    breadcrumbs?: PageBreadcrumb[];
    className?: string;
}

export interface PageBreadcrumb {
    label: React.ReactNode;
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
    activeFiltersLayout?: 'scroll' | 'wrap';
    className?: string;
}

interface RouteBreadcrumbsProps {
    breadcrumbs?: PageBreadcrumb[];
    className?: string;
}

export function PageShell({ children, className, style }: PageShellProps) {
    return (
        <div className={cn('flex h-full w-full min-w-0 flex-col gap-2 overflow-hidden sm:gap-3', className)} style={style}>
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
const PAGE_TABS_HIDE_SCROLL_DELTA = 40;
const PAGE_TABS_SHOW_SCROLL_DELTA = 80;
const PAGE_TABS_HIDE_SCROLL_TOP = 96;
const PAGE_TABS_SHOW_SCROLL_TOP = 28;
const PAGE_TABS_MIN_SCROLL_RANGE = 180;

function getScrollableRange(element: HTMLElement) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
}

function hasVerticalScrollBehavior(element: HTMLElement) {
    const style = window.getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(style.overflowY);
}

function getPageScrollElement(header: HTMLElement): HTMLElement | null {
    let ancestor: HTMLElement | null = header.parentElement;
    while (ancestor && ancestor !== document.body) {
        if (hasVerticalScrollBehavior(ancestor)) {
            return ancestor;
        }
        ancestor = ancestor.parentElement;
    }

    const dashboardScrollContainer = header.closest<HTMLElement>('[data-dashboard-scroll-container="true"]');
    if (dashboardScrollContainer && hasVerticalScrollBehavior(dashboardScrollContainer)) {
        return dashboardScrollContainer;
    }

    return null;
}

function isPageScrollTarget(header: HTMLElement, element: HTMLElement | null) {
    if (!element || header.contains(element)) return false;
    const dashboardScrollContainer = header.closest<HTMLElement>('[data-dashboard-scroll-container="true"]');
    if (dashboardScrollContainer && !dashboardScrollContainer.contains(element)) return false;
    return hasVerticalScrollBehavior(element) && getScrollableRange(element) > 0;
}

function getPageScrollState(header: HTMLElement, preferredTarget?: HTMLElement | null) {
    const root = getPageScrollElement(header);
    let maxScrollTop = window.scrollY;
    let maxScrollRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    if (isPageScrollTarget(header, preferredTarget || null)) {
        maxScrollTop = Math.max(maxScrollTop, preferredTarget?.scrollTop || 0);
        maxScrollRange = Math.max(maxScrollRange, getScrollableRange(preferredTarget as HTMLElement));
    }

    if (root) {
        maxScrollTop = Math.max(maxScrollTop, root.scrollTop);
        maxScrollRange = Math.max(maxScrollRange, getScrollableRange(root));
    }

    return { scrollTop: maxScrollTop, scrollRange: maxScrollRange };
}

function usePageScrollVisibility(elementRef: React.RefObject<HTMLElement | null>, enabled = false) {
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollTopRef = useRef(0);
    const isVisibleRef = useRef(true);

    useEffect(() => {
        if (!enabled) {
            isVisibleRef.current = true;
            setIsVisible(true);
            return;
        }

        const element = elementRef.current;
        if (!element) return;

        let frameId: number | null = null;
        const scrollElement = getPageScrollElement(element);
        let activeScrollTarget: HTMLElement | null = null;

        const readScrollState = () => getPageScrollState(element, activeScrollTarget);
        const readScrollTop = () => readScrollState().scrollTop;

        const setVisible = (nextVisible: boolean) => {
            isVisibleRef.current = nextVisible;
            setIsVisible(nextVisible);
        };

        const updateVisibility = () => {
            frameId = null;
            const { scrollTop, scrollRange } = readScrollState();
            const previousScrollTop = lastScrollTopRef.current;
            const delta = scrollTop - previousScrollTop;

            if (scrollRange < PAGE_TABS_MIN_SCROLL_RANGE || scrollTop <= PAGE_TABS_SHOW_SCROLL_TOP) {
                if (!isVisibleRef.current) setVisible(true);
            } else if (isVisibleRef.current && scrollTop > PAGE_TABS_HIDE_SCROLL_TOP && delta > PAGE_TABS_HIDE_SCROLL_DELTA) {
                setVisible(false);
            } else if (!isVisibleRef.current && delta < -PAGE_TABS_SHOW_SCROLL_DELTA) {
                setVisible(true);
            }

            lastScrollTopRef.current = scrollTop;
        };

        const scheduleUpdate = (event?: Event) => {
            const target = event?.target;
            if (target instanceof HTMLElement && isPageScrollTarget(element, target) && activeScrollTarget !== target) {
                activeScrollTarget = target;
                lastScrollTopRef.current = readScrollTop();
            }

            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(updateVisibility);
        };

        const reset = () => {
            activeScrollTarget = null;
            lastScrollTopRef.current = readScrollTop();
            setVisible(true);
        };

        reset();
        scrollElement?.addEventListener('scroll', scheduleUpdate, { passive: true });
        document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
        window.addEventListener('resize', reset, { passive: true });

        return () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            scrollElement?.removeEventListener('scroll', scheduleUpdate);
            document.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('resize', reset);
        };
    }, [elementRef, enabled]);

    return isVisible;
}

export function PageTabs<T extends string = string>({
    items,
    activeValue,
    ariaLabel,
    onValueChange,
    hideOnScroll = false,
    size = 'md',
    tone = 'page',
    className,
    itemClassName,
}: PageTabsProps<T>) {
    const tabsRef = useRef<HTMLElement>(null);
    const tabsScrollerRef = useRef<HTMLDivElement>(null);
    const isVisible = usePageScrollVisibility(tabsRef, hideOnScroll);
    const [tabScrollState, setTabScrollState] = useState({ canScroll: false, atStart: true, atEnd: true });
    const visibleItems = items.filter((item) => !item.hidden);

    useEffect(() => {
        const scroller = tabsScrollerRef.current;
        if (!scroller) return;

        const updateScrollState = () => {
            const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
            setTabScrollState({
                canScroll: maxScrollLeft > 2,
                atStart: scroller.scrollLeft <= 2,
                atEnd: scroller.scrollLeft >= maxScrollLeft - 2,
            });
        };

        updateScrollState();
        scroller.addEventListener('scroll', updateScrollState, { passive: true });
        window.addEventListener('resize', updateScrollState, { passive: true });

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateScrollState);
            resizeObserver.observe(scroller);
        }

        return () => {
            scroller.removeEventListener('scroll', updateScrollState);
            window.removeEventListener('resize', updateScrollState);
            resizeObserver?.disconnect();
        };
    }, [visibleItems.length]);

    if (visibleItems.length === 0) return null;

    return (
        <nav
            ref={tabsRef}
            aria-label={ariaLabel}
            className={cn(
                'shrink-0 overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out print:hidden',
                hideOnScroll ? (isVisible ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0 pointer-events-none') : 'max-h-none opacity-100',
                className,
            )}
        >
            <div className="relative">
                <div
                    ref={tabsScrollerRef}
                    className={cn(
                        'flex gap-0.5 overflow-x-auto border border-border/70 p-0.5 scrollbar-none',
                        tone === 'page'
                            ? 'rounded-lg bg-card/95 shadow-sm'
                            : 'rounded-lg bg-muted/45',
                    )}
                >
                    {visibleItems.map(({ value, label, icon: Icon, count, href }) => {
                    const isActive = activeValue === value;
                    const content = (
                        <>
                            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                            <span>{label}</span>
                            {count !== undefined && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">
                                    {count}
                                </span>
                            )}
                        </>
                    );
                    const tabClassName = cn(
                        'flex shrink-0 items-center justify-center gap-2 rounded-md font-black transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                        size === 'sm'
                            ? 'min-h-9 px-2.5 py-1.5 text-xs sm:min-w-28 sm:px-3'
                            : 'min-h-10 px-3 py-2 text-sm sm:min-w-32',
                        isActive
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        tone === 'panel' && (isActive
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'),
                        itemClassName,
                    );

                    if (href) {
                        return (
                            <Link
                                key={value}
                                href={href}
                                className={tabClassName}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {content}
                            </Link>
                        );
                    }

                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => onValueChange?.(value)}
                            className={tabClassName}
                            aria-current={isActive ? 'page' : undefined}
                            aria-pressed={isActive}
                        >
                            {content}
                        </button>
                    );
                    })}
                </div>
                {tabScrollState.canScroll && !tabScrollState.atStart && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 block w-8 rounded-l-lg bg-linear-to-r from-card via-card/85 to-transparent md:hidden"
                    />
                )}
                {tabScrollState.canScroll && !tabScrollState.atEnd && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 right-0 block w-10 rounded-r-lg bg-linear-to-l from-card via-card/85 to-transparent md:hidden"
                    />
                )}
            </div>
        </nav>
    );
}
export function PageHeader({ title, description, icon: Icon, meta, actions, actionsDefaultOpen, showDateTime = true, breadcrumbs, className }: PageHeaderProps) {
    const pathname = usePathname();
    const headerRef = useRef<HTMLElement>(null);
    const compactAllowedRef = useRef(false);
    const isScrolledRef = useRef(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isCompactViewport, setIsCompactViewport] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(true);
    const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
    const isCompact = isCompactViewport || isScrolled;
    const hasActions = Boolean(actions);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const updateCompactViewport = () => {
            setIsCompactViewport(mediaQuery.matches);
            setActionsOpen(actionsDefaultOpen ?? !mediaQuery.matches);
        };

        updateCompactViewport();
        mediaQuery.addEventListener('change', updateCompactViewport);
        return () => mediaQuery.removeEventListener('change', updateCompactViewport);
    }, [actionsDefaultOpen]);

    useEffect(() => {
        if (!showDateTime) return;

        const interval = window.setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => window.clearInterval(interval);
    }, [showDateTime]);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        let frameId: number | null = null;
        let resizeObserver: ResizeObserver | null = null;
        const scrollElement = getPageScrollElement(header);
        let activeScrollTarget: HTMLElement | null = null;

        const setStableScrolled = (next: boolean) => {
            isScrolledRef.current = next;
            setIsScrolled(next);
        };

        const measureCompactEligibility = () => {
            const { scrollRange } = getPageScrollState(header, activeScrollTarget);
            if (!isScrolledRef.current && !compactAllowedRef.current) {
                compactAllowedRef.current = scrollRange >= PAGE_HEADER_MIN_SCROLL_RANGE;
            }
        };

        const updateScrolledState = () => {
            frameId = null;
            const { scrollTop } = getPageScrollState(header, activeScrollTarget);
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

        const scheduleUpdate = (event?: Event) => {
            const target = event?.target;
            if (target instanceof HTMLElement && isPageScrollTarget(header, target)) {
                activeScrollTarget = target;
            }

            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(() => {
                measureCompactEligibility();
                updateScrolledState();
            });
        };

        const resetAndMeasure = () => {
            activeScrollTarget = null;
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
                'sticky top-0 z-30 shrink-0 rounded-lg border border-border bg-card/85 shadow-sm backdrop-blur-xl print:hidden',
                isCompact ? 'p-2' : 'p-2.5 md:p-3',
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
                            'flex shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary shadow-inner',
                            isCompact ? 'h-7 w-7' : 'h-10 w-10',
                        )}>
                            <Icon className={cn(isCompact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
                        </div>
                    )}
                    <div className={cn('min-w-0', isCompact && 'flex min-h-7 flex-1 items-center')}>
                        {!isCompact && <RouteBreadcrumbs breadcrumbs={breadcrumbs} className="mb-1.5" />}
                        {isCompact ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <h1 className="min-w-0 truncate text-base font-black leading-tight text-foreground">
                                    {title}
                                </h1>
                                {meta && <div className="hidden shrink-0 min-[420px]:block">{meta}</div>}
                            </div>
                        ) : (
                            <>
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <h1 className="min-w-0 text-xl font-black leading-tight text-foreground xl:text-2xl">
                                        {title}
                                    </h1>
                                    {meta}
                                </div>
                                {description && (
                                    <p className="mt-1 max-w-3xl text-sm font-medium leading-5 text-muted-foreground">
                                        {description}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
                    {showDateTime && !isCompactViewport && (
                        <time
                            dateTime={currentDateTime.toISOString()}
                            className={cn(
                                'min-w-0 rounded-md border border-border/70 bg-background/70 px-2.5 py-1.5 text-right font-black text-foreground shadow-xs',
                                isCompact
                                    ? 'max-w-36 truncate text-[11px] sm:max-w-52'
                                    : 'hidden max-w-64 text-xs sm:block',
                            )}
                            title={currentDateTime.toLocaleString()}
                        >
                            {currentDateTime.toLocaleString()}
                        </time>
                    )}
                    {hasActions && (
                        <button
                            type="button"
                            onClick={() => setActionsOpen((open) => !open)}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            aria-expanded={actionsOpen}
                            aria-label={actionsOpen ? 'Collapse page actions' : 'Expand page actions'}
                            title={actionsOpen ? 'Collapse actions' : 'Expand actions'}
                        >
                            {actionsOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
                        </button>
                    )}
                </div>
            </div>
            {hasActions && actionsOpen && (
                <div className="mt-2 border-t border-border/60 pt-2">
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end md:items-center md:justify-end">
                        {actions}
                    </div>
                </div>
            )}
        </header>
    );
}

export function ResourcePanel({ children, className, style, ...props }: PageShellProps) {
    return (
        <section {...props} className={cn('flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm', className)} style={style}>
            {children}
        </section>
    );
}

export function ResourceToolbar({ search, filters, actions, activeFilters = [], activeFiltersLayout = 'scroll', className }: ResourceToolbarProps) {
    const hasControls = search || filters || actions;

    if (!hasControls && activeFilters.length === 0) return null;

    return (
        <div className={cn('shrink-0 border-b border-border/60 bg-card/85 p-2.5 sm:p-3', className)}>
            {hasControls && (
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    {search && <div className="min-w-0 flex-1">{search}</div>}
                    {(filters || actions) && (
                        <div className="flex w-full min-w-0 items-center justify-end gap-2 overflow-x-auto scrollbar-none lg:w-auto lg:overflow-visible">
                            {filters}
                            {actions}
                        </div>
                    )}
                </div>
            )}

            {activeFilters.length > 0 && (
                <div className={cn(
                    'mt-2 flex items-center gap-2',
                    activeFiltersLayout === 'scroll'
                        ? 'overflow-x-auto pb-0.5 scrollbar-none'
                        : 'flex-wrap',
                )}>
                    {activeFilters.map((filter) => (
                        <span
                            key={filter.key}
                            className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
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
