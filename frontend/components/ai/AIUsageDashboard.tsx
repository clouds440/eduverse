import { BarChart3, Coins, Gauge, Sparkles, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type {
    AICreditBalance,
    AIFeatureUsageSummary,
    AIRoleUsageSummary,
    AISubscription,
    AIUsageTopUser,
    AIUsageTrendPoint,
    Role,
} from '@/types';
import { getRoleLabel } from '@/lib/roles';

interface AIUsageDashboardProps {
    title: string;
    subtitle?: string;
    subscription: AISubscription;
    usage: AICreditBalance;
    estimatedCost?: number;
    topUsers?: AIUsageTopUser[];
    roleUsage?: AIRoleUsageSummary[];
    featureUsage?: AIFeatureUsageSummary[];
    trends?: AIUsageTrendPoint[];
}

function formatQuantity(value?: number | null) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatCost(value?: number | null) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value ?? 0);
}

function usagePercent(used: number, total: number) {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
}

export function AIUsageDashboard({
    title,
    subtitle,
    subscription,
    usage,
    estimatedCost = 0,
    topUsers = [],
    roleUsage = [],
    featureUsage = [],
    trends = [],
}: AIUsageDashboardProps) {
    const percent = usagePercent(usage.usedCredits, usage.monthlyCredits);
    const maxTrendCredits = Math.max(1, ...trends.map((point) => point.creditsUsed));
    const statItems = [
        { label: 'Plan', value: subscription.plan, detail: subscription.status, icon: Sparkles },
        { label: 'Credits used', value: formatQuantity(usage.usedCredits), detail: `${percent}% of monthly credits`, icon: Gauge },
        { label: 'Credits left', value: formatQuantity(usage.remainingCredits), detail: `${formatQuantity(usage.monthlyCredits)} monthly credits`, icon: Coins },
        { label: 'Estimated cost', value: formatCost(estimatedCost), detail: 'Provider estimate this period', icon: TrendingUp },
    ];

    return (
        <section className="grid gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-black text-foreground">{title}</h2>
                    {subtitle && <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p>}
                </div>
                <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'secondary'} size="md">
                    {subscription.limitMode} limit
                </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {statItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                            </div>
                            <p className="mt-3 text-2xl font-black text-foreground">{item.value}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.detail}</p>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monthly AI Credits</p>
                    {usage.overageCredits > 0 && <Badge variant="warning" size="sm">{formatQuantity(usage.overageCredits)} overage</Badge>}
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <span>{formatQuantity(usage.usedCredits)} used</span>
                    <span>{formatQuantity(usage.remainingCredits)} remaining</span>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        Feature Usage
                    </div>
                    {featureUsage.length === 0 ? (
                        <p className="rounded-md border border-border/70 bg-card p-3 text-sm font-semibold text-muted-foreground">No tool usage recorded yet.</p>
                    ) : featureUsage.map((row) => (
                        <div key={row.toolName} className="rounded-md border border-border/70 bg-card p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-black text-foreground">{row.toolName}</p>
                                <Badge variant="primary" size="sm">{row.calls}</Badge>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{row.allowed} allowed · {row.denied} denied</p>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                        <TrendingUp className="h-4 w-4" aria-hidden="true" />
                        Usage Trend
                    </div>
                    {trends.length === 0 ? (
                        <p className="rounded-md border border-border/70 bg-card p-3 text-sm font-semibold text-muted-foreground">Daily credit trends appear after usage is recorded.</p>
                    ) : trends.map((point) => (
                        <div key={point.date} className="rounded-md border border-border/70 bg-card p-3">
                            <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                <span>{point.date}</span>
                                <span>{formatQuantity(point.creditsUsed)}</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, Math.round((point.creditsUsed / maxTrendCredits) * 100))}%` }} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        {topUsers.length > 0 ? 'Top Users' : 'Role Usage'}
                    </div>
                    {topUsers.length > 0 ? topUsers.map((row) => (
                        <div key={row.userId} className="rounded-md border border-border/70 bg-card p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-black text-foreground">{row.name}</p>
                                <Badge variant="secondary" size="sm">{formatQuantity(row.creditsUsed)}</Badge>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{getRoleLabel(row.role as Role)} · {formatCost(row.estimatedCost)}</p>
                        </div>
                    )) : roleUsage.length > 0 ? roleUsage.map((row) => (
                        <div key={row.role ?? 'unknown'} className="rounded-md border border-border/70 bg-card p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-black text-foreground">{getRoleLabel(row.role as Role)}</p>
                                <Badge variant="secondary" size="sm">{formatQuantity(row.creditsUsed)}</Badge>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatCost(row.estimatedCost)} estimated</p>
                        </div>
                    )) : (
                        <p className="rounded-md border border-border/70 bg-card p-3 text-sm font-semibold text-muted-foreground">Usage distribution appears after Copilot activity is recorded.</p>
                    )}
                </div>
            </div>
        </section>
    );
}
