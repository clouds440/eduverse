'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { AIOrgDashboard } from '@/components/ai/AIOrgDashboard';
import { AIPersonalDashboard } from '@/components/ai/AIPersonalDashboard';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { AIUsageSourceType, Role, type AIEntitlementResponse } from '@/types';

export default function AIDashboardPage() {
    const { user, loading, token } = useAuth();
    const isOrgAdmin = user?.role === Role.ORG_ADMIN;
    const { data: entitlement, isLoading: entitlementLoading } = useSWR<AIEntitlementResponse>(
        token ? ['ai-entitlement-usage', token] : null,
        ([, authToken]) => api.ai.getEntitlement(authToken as string),
        { refreshInterval: 30000 },
    );

    if (loading || entitlementLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <PageShell className="gap-0 overflow-y-auto pb-8 custom-scrollbar">
            <PageHeader
                title="EduVerse Copilot"
                description="Track AI Credits, usage trends, feature activity, and estimated provider cost."
                icon={Sparkles}
                meta={<Badge variant="purple" size="sm" icon={Sparkles}>Premium addon</Badge>}
                actions={(
                    <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70" href="/ai/subscription">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        View/change subscriptions
                    </Link>
                )}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'EduVerse Copilot' },
                ]}
                className="mb-2"
            />

            {entitlement?.allowed ? (
                <div className="grid gap-6">
                    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-foreground">Active AI access</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                    {entitlement.source.sourceType === AIUsageSourceType.ORGANIZATION ? 'Organization-funded Copilot' : 'Personal Copilot'} - {entitlement.source.balance.remainingCredits.toLocaleString()} credits remaining
                                </p>
                            </div>
                            <Badge variant="success" size="md">{entitlement.source.subscription.plan}</Badge>
                        </div>
                    </section>
                    {isOrgAdmin && entitlement.source.sourceType === AIUsageSourceType.ORGANIZATION && <AIOrgDashboard />}
                    {entitlement.source.sourceType === AIUsageSourceType.PERSONAL && <AIPersonalDashboard />}
                </div>
            ) : (
                <section className="rounded-lg border border-warning/30 bg-warning/10 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-background text-warning">
                                <AlertCircle className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-black text-warning">EduVerse Copilot is ready to unlock</h2>
                                <p className="mt-1 text-sm font-semibold leading-6 text-warning/85">
                                    {entitlement?.message ?? 'Choose an EduVerse Copilot plan to activate role-aware assistance and usage insights.'}
                                </p>
                            </div>
                        </div>
                        <Button type="button" variant="primary" icon={Sparkles} onClick={() => window.location.assign('/ai/subscription')} className="text-xs" px="px-4" py="py-2.5">
                            Explore AI plans
                        </Button>
                    </div>
                </section>
            )}
        </PageShell>
    );
}
