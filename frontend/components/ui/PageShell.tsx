'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRouteOrientation } from '@/lib/routeOrientation';

interface PageShellProps {
    children: React.ReactNode;
    className?: string;
}

interface PageHeaderProps {
    title: string;
    description?: string;
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

export function PageShell({ children, className }: PageShellProps) {
    return (
        <div className={cn('flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden', className)}>
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

export function PageHeader({ title, description, icon: Icon, meta, actions, breadcrumbs, className }: PageHeaderProps) {
    return (
        <header className={cn('shrink-0 rounded-lg border border-border bg-card/80 p-2 shadow-xl backdrop-blur-2xl md:p-3 print:hidden', className)}>
            <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    {Icon && (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary shadow-inner">
                            <Icon className="h-6 w-6" aria-hidden="true" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <RouteBreadcrumbs breadcrumbs={breadcrumbs} className="mb-1.5" />
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
                    </div>
                </div>
                {actions && (
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end md:w-auto md:items-center md:justify-end">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}

export function ResourcePanel({ children, className }: PageShellProps) {
    return (
        <section className={cn('flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm', className)}>
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
