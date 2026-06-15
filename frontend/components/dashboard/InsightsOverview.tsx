'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Sparkles, TrendingUp, BarChart3, ChevronDown, ChevronUp, Activity, Users, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DashboardInsights, DashboardInsightItem, Tone } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { hasInsightCharts, InsightChartsGrid } from './InsightChartsGrid';

interface InsightsOverviewProps {
  insights: DashboardInsights;
  actions?: ReactNode;
}

const toneClasses: Record<Tone, string> = {
  DEFAULT: 'border-border bg-linear-to-br from-card to-card/50 text-foreground',
  INFO: 'border-info/30 bg-linear-to-br from-info/10 to-info/5 text-foreground',
  SUCCESS: 'border-success/30 bg-linear-to-br from-success/10 to-success/5 text-foreground',
  WARNING: 'border-warning/30 bg-linear-to-br from-warning/10 to-warning/5 text-foreground',
  DANGER: 'border-danger/30 bg-linear-to-br from-danger/10 to-danger/5 text-foreground',
};

function getToneClass(tone?: Tone): string {
  if (!tone) return toneClasses.DEFAULT;
  return toneClasses[tone] || toneClasses.DEFAULT;
}

function SectionFrame({
  title,
  icon,
  children,
  action,
  className = '',
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm ${className}`}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
          <h2 className="min-w-0 truncate text-base font-black tracking-tight text-foreground sm:text-lg">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function ToggleButton({
  isOpen,
  onClick,
  openLabel,
  closedLabel,
}: {
  isOpen: boolean;
  onClick: () => void;
  openLabel: string;
  closedLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-3 text-xs font-black text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      <span className="hidden sm:inline">{isOpen ? openLabel : closedLabel}</span>
    </button>
  );
}

function getCardIcon(label: string) {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('staff') || lowerLabel.includes('teacher')) return <Users className="h-5 w-5" />;
  if (lowerLabel.includes('student')) return <Users className="h-5 w-5" />;
  if (lowerLabel.includes('course') || lowerLabel.includes('section') || lowerLabel.includes('learning')) return <BookOpen className="h-5 w-5" />;
  if (lowerLabel.includes('attendance')) return <Activity className="h-5 w-5" />;
  if (lowerLabel.includes('mail') || lowerLabel.includes('deadline')) return <AlertTriangle className="h-5 w-5" />;
  if (lowerLabel.includes('grade') || lowerLabel.includes('assessment')) return <CheckCircle2 className="h-5 w-5" />;
  return <Activity className="h-5 w-5" />;
}

function InsightLinkCard({
  item,
  compact = false,
}: {
  item: DashboardInsightItem;
  compact?: boolean;
}) {
  const content = (
    <div className={`rounded-lg border p-4 transition-colors hover:border-primary/35 hover:shadow-sm group ${getToneClass(item.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className={`font-bold tracking-tight ${compact ? 'text-sm' : 'text-base'} text-foreground`}>
            {item.title}
          </p>
          {item.description && (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
        {item.badge && (
          <Badge variant="warning" size="sm" className="bg-background/90 shrink-0">
            {item.badge}
          </Badge>
        )}
      </div>
      {(item.meta || item.href) && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
          <span className="text-xs font-medium text-muted-foreground">{item.meta}</span>
          {item.href && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all duration-200 shrink-0" />}
        </div>
      )}
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  return content;
}

function SummaryCard({ card, index }: { card: DashboardInsights['summaryCards'][number]; index: number }) {
  const content = (
    <div className={`rounded-lg border p-4 shadow-sm transition-transform hover:-translate-y-px hover:border-primary/35 group ${getToneClass(card.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-md p-2.5 ${card.tone === Tone.SUCCESS ? 'bg-success/10 text-success' : card.tone === Tone.DANGER ? 'bg-danger/10 text-danger' : card.tone === Tone.WARNING ? 'bg-warning/10 text-warning' : card.tone === Tone.INFO ? 'bg-info/10 text-info' : 'bg-muted/10 text-muted-foreground'}`}>
          {getCardIcon(card.label)}
        </div>
        {card.href && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all duration-200 shrink-0" />}
      </div>
      <p className="mt-4 text-[10px] font-bold tracking-[0.22em] uppercase text-muted-foreground">
        {card.label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
        {card.value}
      </p>
      {card.detail && (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {card.detail}
        </p>
      )}
    </div>
  );

  const uniqueKey = card.id || `summary-${index}`;
  return card.href ? <Link key={uniqueKey} href={card.href}>{content}</Link> : <div key={uniqueKey}>{content}</div>;
}

export default function InsightsOverview({ insights, actions }: InsightsOverviewProps) {
  const { charts } = insights;
  const [showCharts, setShowCharts] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const hasCharts = hasInsightCharts(insights.role, charts);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="relative p-4 sm:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-primary/10 to-transparent" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative">
            {insights.headline.eyebrow && (
              <Badge variant="primary" icon={Sparkles} className="mb-3 uppercase">
                {insights.headline.eyebrow}
              </Badge>
            )}
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {insights.headline.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-bold text-muted-foreground">
              {insights.headline.subtitle}
            </p>
          </div>
          <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {actions}
            <div className="inline-flex items-center gap-3 rounded-md border border-border bg-background/80 px-3 py-2 shadow-xs">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[10px] font-black tracking-[0.25em] text-muted-foreground">
                  {insights.filters?.selectedRange ? `${insights.filters.selectedRange} window` : 'Live snapshot'}
                </p>
                <p className="text-sm font-black text-foreground">
                  {insights.filters?.from && insights.filters?.to
                    ? `${new Date(insights.filters.from).toLocaleDateString()} - ${new Date(insights.filters.to).toLocaleDateString()}`
                    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {insights.summaryCards.map((card, index) => (
          <SummaryCard key={card.id || `summary-${index}`} card={card} index={index} />
        ))}
      </section>

      {/* Spotlight Section */}
      {insights.spotlight && (
        <section className="rounded-lg border border-primary/25 bg-linear-to-br from-primary/10 to-primary/5 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge variant="primary" icon={TrendingUp} className="mb-3 tracking-[0.22em] uppercase bg-background/70">
                Spotlight
              </Badge>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                {insights.spotlight.title}
              </h2>
              {insights.spotlight.description && (
                <p className="mt-2 text-sm font-bold text-muted-foreground">
                  {insights.spotlight.description}
                </p>
              )}
              {insights.spotlight.meta && (
                <p className="mt-3 text-xs font-black tracking-[0.22em] text-primary/80">
                  {insights.spotlight.meta}
                </p>
              )}
            </div>
            {insights.spotlight.href && (
              <Link
                href={insights.spotlight.href}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Take Action
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Charts Section with Toggle */}
      {charts && hasCharts && (
        <SectionFrame
          title="Data Visualizations"
          icon={<BarChart3 className="h-5 w-5" />}
          action={<ToggleButton isOpen={showCharts} onClick={() => setShowCharts(!showCharts)} openLabel="Hide charts" closedLabel="Show charts" />}
        >
          {showCharts && (
            <InsightChartsGrid role={insights.role} charts={charts} />
          )}
        </SectionFrame>
      )}

      {/* Groups Section with Toggle */}
      {insights.groups.length > 0 && (
        <SectionFrame
          title="Action Items"
          icon={<Activity className="h-5 w-5" />}
          action={<ToggleButton isOpen={showGroups} onClick={() => setShowGroups(!showGroups)} openLabel="Hide items" closedLabel="Show items" />}
        >
          {showGroups && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {insights.groups.map((group) => (
                <div key={group.id} className="rounded-lg border border-border/70 bg-background/60 p-4 shadow-xs">
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {group.title}
                  </h3>
                  {group.description && (
                    <p className="mt-2 text-xs font-bold text-muted-foreground">
                      {group.description}
                    </p>
                  )}
                  <div className="flex flex-col mt-4 gap-2">
                    {group.items.length > 0 ? (
                      group.items.map((item) => (
                        <InsightLinkCard key={item.id} item={item} />
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-border bg-background/50 p-4 text-center text-xs font-bold text-muted-foreground">
                        Nothing pressing here
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionFrame>
      )}

      {/* Recent Activity Section with Toggle */}
      {insights.recentActivity.length > 0 && (
        <SectionFrame
          title="Recent Activity"
          icon={<TrendingUp className="h-5 w-5" />}
          action={<ToggleButton isOpen={showActivity} onClick={() => setShowActivity(!showActivity)} openLabel="Hide activity" closedLabel="Show activity" />}
        >
          {showActivity && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {insights.recentActivity.map((activity) => (
                <InsightLinkCard
                  key={activity.id}
                  item={{
                    id: activity.id,
                    title: activity.title,
                    description: activity.description,
                    meta: new Date(activity.createdAt).toLocaleString(),
                    href: activity.href,
                    tone: activity.tone,
                  }}
                />
              ))}
            </div>
          )}
        </SectionFrame>
      )}
    </div>
  );
}
