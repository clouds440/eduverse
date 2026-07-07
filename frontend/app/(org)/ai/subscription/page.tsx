'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Building2, Coins, ExternalLink, Sparkles, UserRound } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import {
    AISubscriptionOwnerType,
    AISubscriptionPlan,
    Role,
    type AIOrgSettingsResponse,
    type AIPersonalSettingsResponse,
    type AIPlanOption,
} from '@/types';

function formatCredits(value: number) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function PlanGrid({
    title,
    subtitle,
    plans,
    activePlan,
    loadingPrefix,
    onSelect,
}: {
    title: string;
    subtitle: string;
    plans: AIPlanOption[];
    activePlan?: AISubscriptionPlan;
    loadingPrefix: string;
    onSelect: (plan: AISubscriptionPlan) => void;
}) {
    const paidPlans = plans.filter((plan) => plan.plan !== AISubscriptionPlan.NONE);

    return (
        <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-base font-black text-foreground">{title}</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{subtitle}</p>
                </div>
                {activePlan && (
                    <Badge variant={activePlan === AISubscriptionPlan.NONE ? 'secondary' : 'success'} size="md">
                        {activePlan}
                    </Badge>
                )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
                {paidPlans.map((plan) => (
                    <div key={plan.plan} className="flex min-h-52 flex-col rounded-lg border border-border/70 bg-background/65 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-foreground">{plan.label}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{plan.limitMode} limit</p>
                            </div>
                            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                        </div>
                        <p className="mt-4 text-3xl font-black text-foreground">{formatCredits(plan.monthlyCredits)}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-widest text-muted-foreground">monthly AI Credits</p>
                        <p className="mt-3 flex-1 text-sm font-semibold leading-6 text-muted-foreground">{plan.description}</p>
                        <Button
                            type="button"
                            variant={activePlan === plan.plan ? 'secondary' : 'primary'}
                            loadingId={`${loadingPrefix}-${plan.plan}`}
                            onClick={() => onSelect(plan.plan)}
                            className="mt-4 w-full text-xs"
                            px="px-3"
                            py="py-2.5"
                        >
                            {activePlan === plan.plan ? 'Current plan' : 'Choose plan'}
                        </Button>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function AISubscriptionPage() {
    const { token, user, loading } = useAuth();
    const { dispatch } = useGlobal();
    const isOrgAdmin = user?.role === Role.ORG_ADMIN;

    const { data: orgSettings, isLoading: orgLoading } = useSWR<AIOrgSettingsResponse>(
        token && isOrgAdmin ? ['ai-org-settings-subscription', token] : null,
        ([, authToken]) => api.ai.getOrgSettings(authToken as string),
    );
    const { data: personalSettings, isLoading: personalLoading } = useSWR<AIPersonalSettingsResponse>(
        token ? ['ai-personal-settings-subscription', token] : null,
        ([, authToken]) => api.ai.getPersonalSubscription(authToken as string),
    );

    const plans = useMemo(() => personalSettings?.plans ?? orgSettings?.plans ?? [], [orgSettings?.plans, personalSettings?.plans]);

    const startOrgCheckout = async (plan: AISubscriptionPlan) => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: `ai-org-checkout-${plan}` });
        try {
            const checkout = await api.ai.createOrgBillingCheckout(plan, token);
            if (!checkout.checkoutUrl) throw new Error('Lemon Squeezy checkout did not return a redirect URL.');
            window.location.assign(checkout.checkoutUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start organization AI checkout';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `ai-org-checkout-${plan}` });
        }
    };

    const startPersonalCheckout = async (plan: AISubscriptionPlan) => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: `ai-personal-checkout-${plan}` });
        try {
            const checkout = await api.ai.createPersonalBillingCheckout(plan, token);
            if (!checkout.checkoutUrl) throw new Error('Lemon Squeezy checkout did not return a redirect URL.');
            window.location.assign(checkout.checkoutUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start personal AI checkout';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `ai-personal-checkout-${plan}` });
        }
    };

    const openPortal = async (ownerType: AISubscriptionOwnerType) => {
        if (!token) return;
        const loadingId = ownerType === AISubscriptionOwnerType.ORGANIZATION ? 'ai-org-portal' : 'ai-personal-portal';
        dispatch({ type: 'UI_START_PROCESSING', payload: loadingId });
        try {
            const portal = await api.ai.createBillingPortal(ownerType, token, '/ai/subscription');
            window.location.assign(portal.portalUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to open AI billing portal';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: loadingId });
        }
    };

    if (loading || personalLoading || (isOrgAdmin && orgLoading)) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loading size="md" />
            </div>
        );
    }

    return (
        <PageShell className="gap-6 overflow-y-auto pb-8 custom-scrollbar">
            <PageHeader
                title="AI Subscription"
                description="Choose and manage EduVerse AI Copilot plans. Usage and org settings are separate."
                icon={Sparkles}
                meta={<Badge variant="purple" size="sm" icon={Sparkles}>Premium addon</Badge>}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70" href="/ai">
                            <Coins className="h-4 w-4" aria-hidden="true" />
                            Usage
                        </Link>
                        {isOrgAdmin && (
                            <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70" href="/settings?tab=ai">
                                <Building2 className="h-4 w-4" aria-hidden="true" />
                                AI Settings
                            </Link>
                        )}
                    </div>
                )}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'AI Copilot', href: '/ai' },
                    { label: 'Subscription' },
                ]}
            />

            <div className="grid gap-5">
                {isOrgAdmin && orgSettings && (
                    <div className="grid gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-foreground">Organization subscription</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Current plan: {orgSettings.subscription.plan} - {orgSettings.subscription.status}</p>
                            </div>
                            {orgSettings.subscription.lemonSqueezySubscriptionId && (
                                <Button type="button" variant="secondary" icon={ExternalLink} loadingId="ai-org-portal" onClick={() => openPortal(AISubscriptionOwnerType.ORGANIZATION)} className="text-xs" px="px-3" py="py-2">
                                    Billing portal
                                </Button>
                            )}
                        </div>
                        <PlanGrid
                            title="Organization AI Plans"
                            subtitle="Org plans fund Copilot for enabled roles and use organization credits first."
                            plans={orgSettings.plans}
                            activePlan={orgSettings.subscription.plan}
                            loadingPrefix="ai-org-checkout"
                            onSelect={startOrgCheckout}
                        />
                    </div>
                )}

                {personalSettings && (
                    <div className="grid gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-foreground">Personal subscription</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Current plan: {personalSettings.subscription.plan} - {personalSettings.subscription.status}</p>
                            </div>
                            {personalSettings.subscription.lemonSqueezySubscriptionId && (
                                <Button type="button" variant="secondary" icon={ExternalLink} loadingId="ai-personal-portal" onClick={() => openPortal(AISubscriptionOwnerType.USER)} className="text-xs" px="px-3" py="py-2">
                                    Billing portal
                                </Button>
                            )}
                        </div>
                        <PlanGrid
                            title="Personal AI Plans"
                            subtitle="Personal credits unlock Copilot for you only. They do not change what data you are allowed to access."
                            plans={plans}
                            activePlan={personalSettings.subscription.plan}
                            loadingPrefix="ai-personal-checkout"
                            onSelect={startPersonalCheckout}
                        />
                    </div>
                )}

                <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <p className="text-sm font-semibold leading-6 text-muted-foreground">
                            Organization subscriptions can enable Copilot by role. Personal subscriptions only unlock Copilot for the purchasing user and never expand permissions.
                        </p>
                    </div>
                </section>
            </div>
        </PageShell>
    );
}
