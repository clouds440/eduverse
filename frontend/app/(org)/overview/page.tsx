'use client';

import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { DashboardInsights } from '@/types';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import InsightsOverview from '@/components/dashboard/InsightsOverview';

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

    return <InsightsOverview insights={insights} />;
}
