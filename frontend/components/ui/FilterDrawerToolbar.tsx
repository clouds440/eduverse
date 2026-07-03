'use client';

import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { cn } from '@/lib/utils';

interface FilterDrawerToolbarProps {
    activeFilters?: ActiveFilter[];
    actions?: React.ReactNode;
    drawerLabel?: string;
    leading?: React.ReactNode;
    renderFilters: (mode: 'drawer') => React.ReactNode;
    showDrawer?: boolean;
}

export function FilterDrawerToolbar({
    activeFilters = [],
    actions,
    drawerLabel = 'Filters',
    leading,
    renderFilters,
    showDrawer = true,
}: FilterDrawerToolbarProps) {
    const drawer = showDrawer ? (
        <Drawer
            icon={SlidersHorizontal}
            label={activeFilters.length > 0 ? `${drawerLabel} (${activeFilters.length})` : drawerLabel}
            position="left"
            triggerClassName="min-h-10 shrink-0 justify-center px-3"
            drawerClassName="w-[calc(100vw-1.5rem)] max-w-md p-3"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <h2 className="text-sm font-black text-foreground">{drawerLabel}</h2>
                    {activeFilters.length > 0 && (
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                            {activeFilters.length} active
                        </span>
                    )}
                </div>
                {renderFilters('drawer')}
            </div>
        </Drawer>
    ) : null;

    return (
        <ResourceToolbar
            className="bg-card/95"
            search={leading}
            filters={drawer}
            actions={actions}
            activeFilters={activeFilters}
        />
    );
}

export function PageControls({
    activeFilters = [],
    actions,
    drawerLabel = 'Filters',
    leading,
    renderFilters,
    showDrawer = true,
}: FilterDrawerToolbarProps) {
    const drawer = showDrawer ? (
        <Drawer
            icon={SlidersHorizontal}
            label={activeFilters.length > 0 ? `${drawerLabel} (${activeFilters.length})` : drawerLabel}
            position="left"
            triggerClassName="min-h-10 shrink-0 justify-center px-3"
            drawerClassName="w-[calc(100vw-1.5rem)] max-w-md p-3"
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <h2 className="text-sm font-black text-foreground">{drawerLabel}</h2>
                    {activeFilters.length > 0 && (
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                            {activeFilters.length} active
                        </span>
                    )}
                </div>
                {renderFilters('drawer')}
            </div>
        </Drawer>
    ) : null;

    const hasTopControls = leading || drawer || actions;

    if (!hasTopControls && activeFilters.length === 0) return null;

    return (
        <div className="flex w-full min-w-0 flex-col gap-2">
            {hasTopControls && (
                <div className="flex w-full min-w-0 flex-col md:flex-row flex-wrap items-center justify-end gap-2">
                    {leading && (
                        <div className="w-full min-w-full md:min-w-72 flex-1 sm:w-72 sm:flex-none lg:w-84">
                            {leading}
                        </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center justify-end gap-2 sm:flex-none">
                        <div className='flex flex-wrap items-center justify-end gap-2'>
                            {drawer}
                        </div>
                        <div className='flex flex-wrap items-center justify-end gap-2'>
                            {actions}
                        </div>
                    </div>
                </div>
            )}

            {activeFilters.length > 0 && (
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none sm:justify-end">
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
                                className={cn(
                                    'rounded-sm p-0.5 text-muted-foreground transition-colors',
                                    'hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                                )}
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

export function FilterDrawerGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid w-full grid-cols-1 gap-3">
            {children}
        </div>
    );
}
