'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, ExternalLink, Gauge, RefreshCw, Sparkles, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import {
    AISubscriptionPlan,
    Role,
    type AIOrgSettingsResponse,
    type AIOrgUsageResponse,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { SettingsSection } from '../SettingsSection';

const AI_ROLE_LABELS: Partial<Record<Role, string>> = {
    [Role.ORG_ADMIN]: 'Org admins',
    [Role.SUB_ADMIN]: 'Sub admins',
    [Role.ORG_MANAGER]: 'Managers',
    [Role.FINANCE_MANAGER]: 'Finance managers',
    [Role.TEACHER]: 'Teachers',
    [Role.STUDENT]: 'Students',
    [Role.GUARDIAN]: 'Guardians',
};

type AIOrgAccessField = 'allowSubAdmins' | 'allowManagers' | 'allowFinanceManagers' | 'allowTeachers' | 'allowStudents' | 'allowGuardians';

const AI_ACCESS_FIELDS: Partial<Record<Role, AIOrgAccessField>> = {
    [Role.SUB_ADMIN]: 'allowSubAdmins',
    [Role.ORG_MANAGER]: 'allowManagers',
    [Role.FINANCE_MANAGER]: 'allowFinanceManagers',
    [Role.TEACHER]: 'allowTeachers',
    [Role.STUDENT]: 'allowStudents',
    [Role.GUARDIAN]: 'allowGuardians',
};

const AI_ACCESS_ROLE_ENTRIES = Object.entries(AI_ACCESS_FIELDS) as [Role, AIOrgAccessField][];

function formatAIQuantity(value?: number | null) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatAICost(value?: number | null, currency = 'USD') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value ?? 0);
}

export function AISettingsTab({
    aiLoading,
    aiSettings,
    activeAIPlan,
    activeAIPlanOption,
    aiBalance,
    aiUsagePercent,
    aiRoleCreditDrafts,
    setAiRoleCreditDrafts,
    aiUsage,
    aiCurrency,
    maxAITrendCredits,
    onPlanChange,
    onBillingPortal,
    onAccessToggle,
    onRoleCreditSave,
    onRefresh,
}: {
    aiLoading: boolean;
    aiSettings: AIOrgSettingsResponse | null;
    activeAIPlan: AISubscriptionPlan;
    activeAIPlanOption?: AIOrgSettingsResponse['plans'][number];
    aiBalance: AIOrgSettingsResponse['usage'] | null;
    aiUsagePercent: number;
    aiRoleCreditDrafts: Partial<Record<Role, string>>;
    setAiRoleCreditDrafts: Dispatch<SetStateAction<Partial<Record<Role, string>>>>;
    aiUsage: AIOrgUsageResponse | null;
    aiCurrency: string;
    maxAITrendCredits: number;
    onPlanChange: (plan: AISubscriptionPlan) => void;
    onBillingPortal: () => void;
    onAccessToggle: (field: AIOrgAccessField, enabled: boolean) => void;
    onRoleCreditSave: (role: Role) => void;
    onRefresh: () => void;
}) {
    const router = useRouter();

    return (<div className="grid gap-4">
                            {aiLoading && !aiSettings ? (
                                <div className="flex min-h-56 items-center justify-center rounded-lg border border-border/70 bg-card">
                                    <Loading size="md" />
                                </div>
                            ) : !aiSettings || activeAIPlan === AISubscriptionPlan.NONE || aiSettings.subscription.status !== 'ACTIVE' ? (
                                <SettingsSection
                                    icon={Sparkles}
                                    title="EduVerse Copilot Settings"
                                    description="Organization AI settings are available after an active organization AI subscription is started."
                                    action={(
                                        <Button
                                            type="button"
                                            variant="primary"
                                            icon={ExternalLink}
                                            onClick={() => router.push('/ai/subscription')}
                                            className="text-xs"
                                            px="px-3"
                                            py="py-2"
                                        >
                                            Subscribe
                                        </Button>
                                    )}
                                >
                                    <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                        <p className="text-sm font-black text-foreground">No active organization AI subscription</p>
                                        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                                            Use the dedicated subscription page to start or change the organization package. Usage dashboards live under EduVerse Copilot, separate from configuration.
                                        </p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Link
                                                href="/ai/subscription"
                                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary px-3 py-2 text-xs font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                                            >
                                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                                View AI Packages
                                            </Link>
                                            <Link
                                                href="/ai"
                                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70"
                                            >
                                                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                                Usage
                                            </Link>
                                        </div>
                                    </div>
                                </SettingsSection>
                            ) : (
                                <>
                                    <SettingsSection
                                        icon={Sparkles}
                                        title="EduVerse Copilot Settings"
                                        description="Configure who can use the active organization AI package and how monthly credits are allocated."
                                        action={(
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    href="/ai/subscription"
                                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70"
                                                >
                                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                                    View/change subscription
                                                </Link>
                                                <Link
                                                    href="/ai"
                                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70"
                                                >
                                                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                                    Usage
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    icon={RefreshCw}
                                                    onClick={onRefresh}
                                                    disabled={aiLoading}
                                                    className="text-xs"
                                                    px="px-3"
                                                    py="py-2"
                                                >
                                                    Refresh
                                                </Button>
                                            </div>
                                        )}
                                    >
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Plan</p>
                                                <p className="mt-2 text-2xl font-black text-foreground">{activeAIPlanOption?.label ?? activeAIPlan}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{aiSettings.subscription.status}</p>
                                            </div>
                                            <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monthly Credits</p>
                                                <p className="mt-2 text-2xl font-black text-foreground">{formatAIQuantity(aiSettings.subscription.monthlyCredits)}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{aiSettings.subscription.limitMode} limit</p>
                                            </div>
                                            <div className="rounded-lg border border-border/70 bg-background/60 p-4">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subscription</p>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">Plan changes and billing live in the dedicated subscription flow.</p>
                                            </div>
                                        </div>
                                    </SettingsSection>

                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <SettingsSection
                                            icon={Users}
                                            title="Role Access"
                                            description="Choose which organization roles can use organization-funded EduVerse Copilot."
                                        >
                                            <div className="space-y-3">
                                                {aiSettings?.warning && (
                                                    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-warning">
                                                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                                        <span>{aiSettings.warning}</span>
                                                    </div>
                                                )}
                                                <div className="grid gap-2">
                                                    {AI_ACCESS_ROLE_ENTRIES.map(([role, field]) => {
                                                        const checked = Boolean(aiSettings?.accessPolicy[field]);
                                                        return (
                                                            <label key={role} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5">
                                                                <span className="text-sm font-semibold text-foreground">{AI_ROLE_LABELS[role as Role] ?? role}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                                                                    checked={checked}
                                                                    disabled={!aiSettings}
                                                                    onChange={(event) => onAccessToggle(field, event.target.checked)}
                                                                />
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </SettingsSection>

                                        <SettingsSection
                                            icon={Gauge}
                                            title="Role Monthly Credits"
                                            description="Set monthly per-user credit caps for each role using the organization plan."
                                        >
                                            <div className="space-y-2">
                                                {(aiSettings?.roleCreditPolicies ?? []).map((policy) => (
                                                    <div key={policy.role} className="grid gap-2 rounded-md border border-border/70 bg-background/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.4fr)_auto] sm:items-center">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-foreground">{AI_ROLE_LABELS[policy.role] ?? policy.role}</p>
                                                            <p className="text-xs font-semibold text-muted-foreground">Per user each month</p>
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={aiRoleCreditDrafts[policy.role] ?? String(policy.monthlyCredits)}
                                                            onChange={(event) => setAiRoleCreditDrafts((current) => ({ ...current, [policy.role]: event.target.value }))}
                                                            className="h-10 border-border/60 bg-background/70 font-medium"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            loadingId={`ai-role-credit-${policy.role}`}
                                                            onClick={() => onRoleCreditSave(policy.role)}
                                                            className="text-xs"
                                                            px="px-3"
                                                            py="py-2"
                                                        >
                                                            Save
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </SettingsSection>
                                    </div>

                                    {false && (
                                    <SettingsSection
                                        icon={BarChart3}
                                        title="AI Usage Dashboard"
                                        description="Track credits, active users, feature usage, and rough cost estimates for the current billing period."
                                    >
                                        <div className="grid gap-4 xl:grid-cols-3">
                                            <div className="space-y-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Top Users</p>
                                                {(aiUsage?.topUsers ?? []).length === 0 ? (
                                                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-sm font-semibold text-muted-foreground">No AI usage recorded yet.</p>
                                                ) : aiUsage?.topUsers.map((row) => (
                                                    <div key={row.userId} className="rounded-md border border-border/70 bg-background/60 p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="min-w-0 truncate text-sm font-black text-foreground">{row.name}</p>
                                                            <Badge variant="secondary" size="sm">{formatAIQuantity(row.creditsUsed)}</Badge>
                                                        </div>
                                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{AI_ROLE_LABELS[row.role as Role] ?? row.role ?? 'User'} · {formatAICost(row.estimatedCost, aiCurrency)}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Feature Usage</p>
                                                {(aiUsage?.featureUsage ?? []).length === 0 ? (
                                                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-sm font-semibold text-muted-foreground">Tool usage appears here after Copilot tools run.</p>
                                                ) : aiUsage?.featureUsage.map((row) => (
                                                    <div key={row.toolName} className="rounded-md border border-border/70 bg-background/60 p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="min-w-0 truncate text-sm font-black text-foreground">{row.toolName}</p>
                                                            <Badge variant="primary" size="sm">{row.calls}</Badge>
                                                        </div>
                                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{row.allowed} allowed · {row.denied} denied</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Usage Trend</p>
                                                {(aiUsage?.trends ?? []).length === 0 ? (
                                                    <p className="rounded-md border border-border/70 bg-background/60 p-3 text-sm font-semibold text-muted-foreground">Daily credit trends appear after usage is recorded.</p>
                                                ) : aiUsage?.trends.map((point) => (
                                                    <div key={point.date} className="rounded-md border border-border/70 bg-background/60 p-3">
                                                        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            <span>{point.date}</span>
                                                            <span>{formatAIQuantity(point.creditsUsed)}</span>
                                                        </div>
                                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, Math.round((point.creditsUsed / maxAITrendCredits) * 100))}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </SettingsSection>
                                    )}
                                </>
                            )}
                        </div>    );
}
