'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageShellProps {
    children: React.ReactNode;
    className?: string;
}

interface PageHeaderProps {
    title: string;
    description?: string;
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

export function PageShell({ children, className }: PageShellProps) {
    return (
        <div className={cn('flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden', className)}>
            {children}
        </div>
    );
}

export function PageHeader({ title, description, meta, actions, breadcrumbs = [], className }: PageHeaderProps) {
    return (
        <header className={cn('flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
            <div className="min-w-0">
                {breadcrumbs.length > 0 && (
                    <nav aria-label="Breadcrumb" className="mb-1.5 min-w-0">
                        <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-muted-foreground">
                            {breadcrumbs.map((item, index) => {
                                const isLast = index === breadcrumbs.length - 1;
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
                )}
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                        {title}
                    </h1>
                    {meta}
                </div>
                {description && (
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
        </header>
    );
}

export function ResourcePanel({ children, className }: PageShellProps) {
    return (
        <section className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm', className)}>
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
