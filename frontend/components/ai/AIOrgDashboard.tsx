'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { AIOrgUsageResponse } from '@/types';
import { Loading } from '@/components/ui/Loading';
import { AIUsageDashboard } from './AIUsageDashboard';

export function AIOrgDashboard() {
    const { token } = useAuth();
    const { data, isLoading } = useSWR<AIOrgUsageResponse>(
        token ? ['ai-org-usage', token] : null,
        ([, authToken]) => api.ai.getOrgUsage(authToken as string),
        { refreshInterval: 30000 },
    );

    if (isLoading || !data) {
        return (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-border/70 bg-card">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <AIUsageDashboard
            title="Organization AI Usage"
            subtitle="Credits, top users, feature usage, trends, and estimated provider cost for this billing period."
            subscription={data.subscription}
            usage={data.usage}
            estimatedCost={data.estimatedCost}
            topUsers={data.topUsers}
            roleUsage={data.roleUsage}
            featureUsage={data.featureUsage}
            trends={data.trends}
        />
    );
}
