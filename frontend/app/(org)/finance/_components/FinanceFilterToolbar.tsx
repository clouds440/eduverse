'use client';

import React, { useMemo } from 'react';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePageActionsHost } from '@/components/ui/PageActionsHost';
import type { ActiveFilter } from '@/components/ui/PageShell';

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
    const controls = useMemo(() => (
        <PageControls
            drawerLabel={drawerLabel}
            leading={leading}
            actions={actions}
            activeFilters={activeFilters}
            renderFilters={() => renderFilters('mobile')}
        />
    ), [actions, activeFilters, drawerLabel, leading, renderFilters]);
    const controlsHosted = usePageActionsHost(controls);

    if (controlsHosted) return null;

    return (
        <div className="shrink-0 border-b border-border/60 bg-card/95 p-2.5 sm:p-3">
            {controls}
        </div>
    );
}

export function FinanceFilterGrid({ children, mode }: { children: React.ReactNode; mode: 'desktop' | 'mobile' }) {
    void mode;
    return <FilterDrawerGrid>{children}</FilterDrawerGrid>;
}
