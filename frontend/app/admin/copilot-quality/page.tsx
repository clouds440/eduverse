'use client';

import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import useSWR from 'swr';
import { Activity, AlertTriangle, Gauge, Sparkles, Timer, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AIPlatformQualityResponse, Role } from '@/types';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS = [7, 14, 30, 60, 90];

export default function CopilotQualityPage() {
  const { token, user, loading } = useAuth();
  const [days, setDays] = useState(30);
  const canView = user?.role === Role.SUPER_ADMIN;
  const qualityKey = token && canView ? ['ai-platform-quality', days] as const : null;
  const { data, error, isLoading, mutate } = useSWR<AIPlatformQualityResponse>(
    qualityKey,
    () => api.ai.getPlatformQuality(token!, days),
  );

  const topIntent = data?.mostCommonUserIntents[0];
  const failureRate = useMemo(() => {
    if (!data?.totals.toolCalls) return 0;
    return Math.round((data.totals.failedToolCalls / data.totals.toolCalls) * 100);
  }, [data]);

  if (loading || isLoading) {
    return <Loading className="h-full" text="Loading Copilot quality..." size="lg" icon={Sparkles} />;
  }

  if (!canView) {
    return (
      <PageShell>
        <ErrorState
          error="Copilot quality telemetry is restricted to super admins."
          title="Super admin only"
          description="Copilot quality telemetry is restricted to super admins."
          showRetry={false}
        />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <ErrorState
          error={error instanceof Error ? error : 'Unable to load Copilot quality.'}
          title="Unable to load Copilot quality"
          description="The platform quality dashboard could not be fetched."
          onRetry={() => mutate()}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="gap-3 overflow-y-auto pb-8 custom-scrollbar">
      <PageHeader
        title="Copilot Quality"
        description="Platform-level reliability, usage, latency, and failure signals for EduVerse Copilot."
        icon={Sparkles}
        breadcrumbs={[{ label: 'Admin' }, { label: 'Copilot Quality' }]}
        actions={(
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={cn(
                  'rounded-md border px-3 py-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                  days === option
                    ? 'border-primary/30 bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-primary/5 hover:text-foreground',
                )}
              >
                {option}d
              </button>
            ))}
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QualityMetric icon={Activity} label="Tool calls" value={formatNumber(data.totals.toolCalls)} detail={`${formatNumber(data.totals.deniedToolCalls)} denied`} />
        <QualityMetric icon={Timer} label="Average latency" value={`${formatNumber(data.totals.averageLatencyMs)} ms`} detail="Across audited tool calls" />
        <QualityMetric icon={TrendingUp} label="Credits used" value={formatNumber(data.totals.creditsUsed)} detail={`${data.creditUsageByAnswerType.length} answer types`} />
        <QualityMetric icon={AlertTriangle} label="Provider failures" value={formatNumber(data.totals.providerFailures)} detail={`${failureRate}% tool failure rate`} tone={data.totals.providerFailures || failureRate ? 'warning' : 'success'} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <ResourcePanel className="min-h-0 overflow-hidden p-4 sm:p-5">
          <SectionHeader title="Tool Health" subtitle="Calls, denied requests, average latency, and estimated credits." />
          <div className="mt-4 overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-2 py-2">Capability</th>
                  <th className="px-2 py-2 text-right">Calls</th>
                  <th className="px-2 py-2 text-right">Denied</th>
                  <th className="px-2 py-2 text-right">Avg latency</th>
                  <th className="px-2 py-2 text-right">Credits</th>
                </tr>
              </thead>
              <tbody>
                {data.toolHealth.map((tool) => (
                  <tr key={tool.toolName} className="border-b border-border/50 text-sm">
                    <td className="px-2 py-3">
                      <div className="font-black text-foreground">{friendlyToolName(tool.toolName)}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{tool.allowed} allowed</div>
                    </td>
                    <td className="px-2 py-3 text-right font-bold">{formatNumber(tool.calls)}</td>
                    <td className="px-2 py-3 text-right">
                      <Badge variant={tool.denied ? 'warning' : 'success'} size="sm">{formatNumber(tool.denied)}</Badge>
                    </td>
                    <td className="px-2 py-3 text-right font-bold">{formatNumber(tool.averageLatencyMs)} ms</td>
                    <td className="px-2 py-3 text-right font-bold">{formatNumber(tool.creditsUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResourcePanel>

        <div className="grid gap-3">
          <ResourcePanel className="p-4 sm:p-5">
            <SectionHeader title="Answer Types" subtitle="Credit usage grouped by request classification." />
            <div className="mt-4 space-y-3">
              {data.creditUsageByAnswerType.map((row) => (
                <BarRow
                  key={row.requestKind}
                  label={friendlyKind(row.requestKind)}
                  value={row.creditsUsed}
                  max={Math.max(...data.creditUsageByAnswerType.map((item) => item.creditsUsed), 1)}
                  detail={`${formatNumber(row.responses)} responses`}
                />
              ))}
            </div>
          </ResourcePanel>

          <ResourcePanel className="p-4 sm:p-5">
            <SectionHeader title="Common Intents" subtitle={topIntent ? `${friendlyKind(topIntent.requestKind)} is leading this range.` : 'No intent data yet.'} />
            <div className="mt-4 flex flex-wrap gap-2">
              {data.mostCommonUserIntents.map((intent) => (
                <span key={intent.requestKind} className="rounded-md border border-border bg-background px-3 py-2 text-xs font-black text-foreground">
                  {friendlyKind(intent.requestKind)}
                  <span className="ml-2 text-muted-foreground">{formatNumber(intent.responses)}</span>
                </span>
              ))}
            </div>
          </ResourcePanel>

          <ResourcePanel className="p-4 sm:p-5">
            <SectionHeader title="Provider Failures" subtitle="Stored assistant error replies by day." />
            <div className="mt-4 space-y-2">
              {data.providerFailuresByDay.length ? data.providerFailuresByDay.map((row) => (
                <div key={row.date} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                  <span className="text-xs font-bold text-muted-foreground">{new Date(row.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  <Badge variant="error" size="sm">{row.failures}</Badge>
                </div>
              )) : (
                <p className="text-sm font-semibold text-muted-foreground">No provider failures in this range.</p>
              )}
            </div>
          </ResourcePanel>
        </div>
      </div>

      <p className="px-1 text-xs font-semibold text-muted-foreground">{data.note}</p>
    </PageShell>
  );
}

function QualityMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'primary',
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: 'primary' | 'warning' | 'success';
}) {
  const toneClass = tone === 'warning'
    ? 'bg-warning/10 text-warning'
    : tone === 'success'
      ? 'bg-success/10 text-success'
      : 'bg-primary/10 text-primary';

  return (
    <ResourcePanel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', toneClass)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </ResourcePanel>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Gauge className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-black text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black text-foreground">{label}</span>
        <span className="text-xs font-bold text-muted-foreground">{formatNumber(value)} credits</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, Math.round((value / max) * 100))}%` }} />
      </div>
      <p className="text-[11px] font-semibold text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function friendlyKind(kind: string) {
  return kind
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown';
}

function friendlyToolName(name: string) {
  return name
    .replace(/^get/, '')
    .replace(/^search/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bAI\b/g, 'AI')
    .trim() || 'EduVerse capability';
}
