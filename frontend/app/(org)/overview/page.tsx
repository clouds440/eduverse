'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { DashboardInsights, type InsightTimeRange } from '@/types';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { getInsightRangePreview, InsightRangeControl } from '@/components/dashboard/InsightRangeControl';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { LayoutDashboard } from 'lucide-react';

export default function AdminPage() {
    const { token, loading } = useAuth();
    const [range, setRange] = useState<InsightTimeRange>('1M');

    // SWR for insights with refreshInterval for live dashboard feel
    const insightsKey = token ? ['insights', token, { range }] as const : null;
    const { data: insights, isLoading: insightsLoading } = useSWR<DashboardInsights>(insightsKey, ([, t]) => api.org.getInsights(t as string, { range }), {
        refreshInterval: 30000, // 30 seconds for live dashboard feel
    });

    if (loading || (!insights && insightsLoading)) {
        return <DashboardSkeleton />;
    }

    if (!insights) return null;

    return (
        <PageShell>
            <PageHeader
                title="Overview"
                description="A live snapshot of academics, attendance, finance, communication, and operational activity."
                icon={LayoutDashboard}
                meta={<Badge variant="neutral" size="sm">Live dashboard</Badge>}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Overview' },
                ]}
                actions={<InsightRangeControl value={range} onChange={setRange} preview={getInsightRangePreview(insights.filters)} />}
            />
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                <InsightsOverview insights={insights} />
            </div>
        </PageShell>
    );
}
