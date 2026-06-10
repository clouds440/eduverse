'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';

interface FinanceFilterToolbarProps {
    activeFilters?: ActiveFilter[];
    actions?: React.ReactNode;
    drawerLabel?: string;
    leading?: React.ReactNode;
    renderFilters: (mode: 'desktop' | 'mobile') => React.ReactNode;
}

export function FinanceFilterToolbar({
    activeFilters = [],
    actions,
    drawerLabel = 'Filters',
    leading,
    renderFilters,
}: FinanceFilterToolbarProps) {
    return (
        <ResourceToolbar
            className="bg-card/95 p-3 sm:p-4"
            filters={(
                <div className="flex w-full min-w-0 flex-col gap-3">
                    {leading}
                    <div className="hidden w-full min-w-0 items-start gap-3 lg:flex">
                        <div className="min-w-0 flex-1">
                            {renderFilters('desktop')}
                        </div>
                        {actions && (
                            <div className="shrink-0">
                                {actions}
                            </div>
                        )}
                    </div>
                    <div className="flex w-full items-center gap-2 lg:hidden">
                        <Drawer
                            icon={SlidersHorizontal}
                            label={activeFilters.length > 0 ? `${drawerLabel} (${activeFilters.length})` : drawerLabel}
                            position="left"
                            triggerClassName="min-h-10 flex-1 justify-center"
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
                                {renderFilters('mobile')}
                            </div>
                        </Drawer>
                        {actions && (
                            <div className="shrink-0">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
            )}
            activeFilters={activeFilters}
        />
    );
}

export function FinanceFilterGrid({ children, mode }: { children: React.ReactNode; mode: 'desktop' | 'mobile' }) {
    return (
        <div className={mode === 'desktop'
            ? 'grid w-full grid-cols-2 gap-2 xl:grid-cols-6'
            : 'grid w-full grid-cols-1 gap-3'}
        >
            {children}
        </div>
    );
}
