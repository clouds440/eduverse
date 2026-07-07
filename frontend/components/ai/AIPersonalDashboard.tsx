'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { AIPersonalUsageResponse } from '@/types';
import { Loading } from '@/components/ui/Loading';
import { AIUsageDashboard } from './AIUsageDashboard';

export function AIPersonalDashboard() {
    const { token } = useAuth();
    const { data, isLoading } = useSWR<AIPersonalUsageResponse>(
        token ? ['ai-personal-usage', token] : null,
        ([, authToken]) => api.ai.getPersonalUsage(authToken as string),
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
            title="Personal AI Usage"
            subtitle="Your personal AI Credits and usage for this billing period."
            subscription={data.subscription}
            usage={data.usage}
            estimatedCost={data.estimatedCost}
            featureUsage={data.featureUsage}
            trends={data.trends}
        />
    );
}
