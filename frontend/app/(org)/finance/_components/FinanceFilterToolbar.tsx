'use client';

import React from 'react';
import { FilterDrawerGrid, FilterDrawerToolbar } from '@/components/ui/FilterDrawerToolbar';
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
    return (
        <FilterDrawerToolbar
            drawerLabel={drawerLabel}
            leading={leading}
            actions={actions}
            activeFilters={activeFilters}
            renderFilters={() => renderFilters('mobile')}
        />
    );
}

export function FinanceFilterGrid({ children, mode }: { children: React.ReactNode; mode: 'desktop' | 'mobile' }) {
    void mode;
    return <FilterDrawerGrid>{children}</FilterDrawerGrid>;
}
