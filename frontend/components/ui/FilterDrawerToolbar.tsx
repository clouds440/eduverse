'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';

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
            triggerClassName="min-h-10 w-full justify-center sm:w-auto"
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
            className="bg-card/95 p-3 sm:p-4"
            search={leading}
            filters={drawer}
            actions={actions}
            activeFilters={activeFilters}
        />
    );
}

export function FilterDrawerGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid w-full grid-cols-1 gap-3">
            {children}
        </div>
    );
}
