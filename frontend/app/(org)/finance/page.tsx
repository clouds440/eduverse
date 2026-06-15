'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { getInsightRangePreview, InsightRangeControl } from '@/components/dashboard/InsightRangeControl';
import { useFinanceHeaderActions } from './FinanceHeaderActionsContext';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { FinanceInsights, InsightTimeRange } from '@/types';

function FinanceOverviewSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-36 rounded-lg" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-36 rounded-lg" />
                ))}
            </div>
            <Skeleton className="h-56 rounded-lg" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-64 rounded-lg" />
                ))}
            </div>
        </div>
    );
}

export default function FinanceOverviewPage() {
    const { token } = useAuth();
    const [range, setRange] = useState<InsightTimeRange>('1M');
    const setFinanceHeaderActions = useFinanceHeaderActions();

    const { data: insights, error, isLoading, mutate } = useSWR<FinanceInsights>(
        token ? ['finance/insights', token, range] : null,
        ([, t]) => api.finance.getInsights(t as string, { range })
    );

    const headerAction = useMemo(() => (
        <InsightRangeControl
            value={range}
            onChange={setRange}
            preview={getInsightRangePreview(insights?.filters)}
        />
    ), [insights?.filters, range]);

    useEffect(() => {
        setFinanceHeaderActions(headerAction);
        return () => setFinanceHeaderActions(null);
    }, [headerAction, setFinanceHeaderActions]);

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Finance overview could not load"
                description="The finance insight summary is temporarily unavailable."
            />
        );
    }

    if (isLoading || !insights) {
        return <FinanceOverviewSkeleton />;
    }

    return <InsightsOverview insights={insights} />;
}
