'use client';

import type { ReactNode } from 'react';
import useSWR from 'swr';
import { BarChart3, CircleSlash, Loader2 } from 'lucide-react';
import { DashboardInsights, type InsightTimeRange } from '@/types';
import { api } from '@/lib/api';
import { insightSWRConfig } from '@/lib/swr';
import { InsightChartsGrid, hasInsightCharts } from './InsightChartsGrid';
import { getInsightRangePreview, InsightRangeControl } from './InsightRangeControl';

function hasGroups(data?: DashboardInsights | null) {
  return Boolean(data?.groups?.some((group) => group.items.length > 0));
}

function hasActivity(data?: DashboardInsights | null) {
  return Boolean(data?.recentActivity?.length);
}

function isMeaningful(data?: DashboardInsights | null) {
  return Boolean(data && (
    hasInsightCharts(data.role, data.charts) ||
    hasGroups(data) ||
    hasActivity(data)
  ));
}

function EmptyModule({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/15 p-5 text-center">
      <div>
        <CircleSlash className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-black text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-xs font-semibold text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ActivityList({ data }: { data: DashboardInsights }) {
  if (!data.recentActivity.length) return null;
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {data.recentActivity.map((item) => (
        <a key={item.id} href={item.href || '#'} className="rounded-lg border border-border/70 bg-background/70 p-3 transition hover:border-primary/40">
          <p className="text-sm font-black text-foreground">{item.title}</p>
          {item.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.description}</p>}
          <p className="mt-2 text-[11px] font-bold text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
        </a>
      ))}
    </div>
  );
}

function ActionGroups({ data }: { data: DashboardInsights }) {
  const groups = data.groups.filter((group) => group.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border border-border/70 bg-background/70 p-3">
          <h3 className="text-sm font-black text-foreground">{group.title}</h3>
          {group.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{group.description}</p>}
          <div className="mt-3 grid gap-2">
            {group.items.map((item) => (
              <a key={item.id} href={item.href || '#'} className="rounded-md border border-border/60 bg-card/70 p-3 transition hover:border-primary/35">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    {item.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.description}</p>}
                  </div>
                  {item.badge && <span className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-[10px] font-black text-muted-foreground">{item.badge}</span>}
                </div>
                {item.meta && <p className="mt-2 text-[11px] font-bold text-muted-foreground">{item.meta}</p>}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface InsightModulePanelProps {
  token: string;
  moduleName: string;
  title: string;
  description: string;
  range: InsightTimeRange;
  onRangeChange: (range: InsightTimeRange) => void;
  icon?: ReactNode;
  fetchModule?: (token: string, moduleName: string, params: { range: InsightTimeRange }) => Promise<DashboardInsights>;
}

export default function InsightModulePanel({
  token,
  moduleName,
  title,
  description,
  range,
  onRangeChange,
  icon,
  fetchModule = api.org.getInsightModule,
}: InsightModulePanelProps) {
  const { data, isLoading } = useSWR<DashboardInsights>(
    ['insights-module-panel', token, moduleName, range, fetchModule === api.org.getInsightModule ? 'org' : 'custom'] as const,
    ([, t, name]) => fetchModule(t as string, name as string, { range }),
    insightSWRConfig,
  );

  return (
    <section className="rounded-lg border border-border/70 bg-card/80 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            {icon || <BarChart3 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-foreground">{title}</h2>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{description}</p>
          </div>
        </div>
        <InsightRangeControl value={range} onChange={onRangeChange} preview={getInsightRangePreview(data?.filters)} />
      </div>
      <div className="p-4">
        {isLoading && (
          <div className="flex min-h-32 items-center justify-center text-sm font-bold text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading {title.toLowerCase()}...
          </div>
        )}
        {!isLoading && !isMeaningful(data) && (
          <EmptyModule
            title={`${title} will build up here`}
            description="There is not enough activity in this range yet. As Eduverse is used, this module will fill with cards, charts, and follow-up signals."
          />
        )}
        {!isLoading && data && isMeaningful(data) && (
          <div className="space-y-4">
            {hasInsightCharts(data.role, data.charts) && <InsightChartsGrid role={data.role} charts={data.charts} />}
            <ActionGroups data={data} />
            <ActivityList data={data} />
          </div>
        )}
      </div>
    </section>
  );
}
