'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Activity, Landmark, ListChecks, PieChart, Sparkles, WalletCards } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import InsightModulePanel from '@/components/dashboard/InsightModulePanel';
import InsightShellSummary from '@/components/dashboard/InsightShellSummary';
import { useFinanceHeaderActions } from './FinanceHeaderActionsContext';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { insightSWRConfig } from '@/lib/swr';
import type { DashboardInsights, InsightTimeRange } from '@/types';

const financeModules = [
    { id: 'cash-flow', title: 'Cash Flow', description: 'Income, expenses, net flow, and top months.', icon: <WalletCards className="h-5 w-5" /> },
    { id: 'sources', title: 'Finance Sources', description: 'Income and expense concentration by source.', icon: <PieChart className="h-5 w-5" /> },
    { id: 'collections', title: 'Collections', description: 'Pending, overdue, and collected finance health.', icon: <ListChecks className="h-5 w-5" /> },
    { id: 'departments', title: 'Departments', description: 'Expected, collected, pending, and overdue amounts by department.', icon: <Landmark className="h-5 w-5" /> },
    { id: 'activity', title: 'Finance Activity', description: 'Recently confirmed income and expense entries.', icon: <Activity className="h-5 w-5" /> },
];

const defaultRange: InsightTimeRange = '1M';

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
    const [moduleRanges, setModuleRanges] = useState<Record<string, InsightTimeRange>>({});
    const setFinanceHeaderActions = useFinanceHeaderActions();

    const { data: insights, error, isLoading, mutate } = useSWR<DashboardInsights>(
        token ? ['finance/insights-shell', token, defaultRange] : null,
        ([, t]) => api.finance.getInsights(t as string, { range: defaultRange }),
        insightSWRConfig,
    );

    useEffect(() => {
        setFinanceHeaderActions(null);
        return () => setFinanceHeaderActions(null);
    }, [setFinanceHeaderActions]);

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

    const hasShellContent = Boolean(
        insights.summaryCards.length ||
        insights.spotlight ||
        insights.groups.some((group) => group.items.length > 0),
    );

    return (
        <div className="space-y-5 pb-6">
            <InsightShellSummary insights={insights} />

            {!hasShellContent && (
                <section className="rounded-lg border border-dashed border-border/80 bg-card/70 p-8 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-primary" />
                    <h2 className="mt-4 text-lg font-black text-foreground">Your finance overview will build up here</h2>
                    <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-muted-foreground">
                        As finance entries, confirmations, and transactions are added, this page will fill with useful cards, charts, and follow-up signals.
                    </p>
                </section>
            )}

            {token && financeModules.map((module) => (
                <InsightModulePanel
                    key={module.id}
                    token={token}
                    moduleName={module.id}
                    title={module.title}
                    description={module.description}
                    icon={module.icon}
                    range={moduleRanges[module.id] || defaultRange}
                    onRangeChange={(nextRange) => setModuleRanges((current) => ({ ...current, [module.id]: nextRange }))}
                    fetchModule={api.finance.getInsightModule}
                />
            ))}
        </div>
    );
}
