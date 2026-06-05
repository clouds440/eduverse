'use client';

import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { DashboardInsights } from '@/types';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { LayoutDashboard } from 'lucide-react';

export default function AdminPage() {
    const { token, loading } = useAuth();

    // SWR for insights with refreshInterval for live dashboard feel
    const insightsKey = token ? ['insights'] as const : null;
    const { data: insights, isLoading: insightsLoading } = useSWR<DashboardInsights>(insightsKey, {
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
            />
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                <InsightsOverview insights={insights} />
            </div>
        </PageShell>
    );
}
