'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Sparkles, TrendingUp, BarChart3, ChevronDown, ChevronUp, Activity, Users, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DashboardInsights, DashboardInsightItem, Tone, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { RouteBreadcrumbs } from '@/components/ui/PageShell';
import {
  InsightLineChart,
  InsightBarChart,
  InsightPieChart,
  CompletionBarChart,
  PerformanceChart,
  COLORS,
} from '@/components/charts/ChartComponents';

interface InsightsOverviewProps {
  insights: DashboardInsights;
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
    <div className={`rounded-2xl hover:scale-102 border p-4 transition-all hover:shadow-xl group ${getToneClass(item.tone)}`}>
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
    <div className={`rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg group ${getToneClass(card.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${card.tone === Tone.SUCCESS ? 'bg-success/10 text-success' : card.tone === Tone.DANGER ? 'bg-danger/10 text-danger' : card.tone === Tone.WARNING ? 'bg-warning/10 text-warning' : card.tone === Tone.INFO ? 'bg-info/10 text-info' : 'bg-muted/10 text-muted-foreground'}`}>
          {getCardIcon(card.label)}
        </div>
        {card.href && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all duration-200 shrink-0" />}
      </div>
      <p className="mt-4 text-[10px] font-bold tracking-[0.22em] uppercase text-muted-foreground">
        {card.label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tighter text-foreground">
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

export default function InsightsOverview({ insights }: InsightsOverviewProps) {
  const { charts } = insights;
  const [showCharts, setShowCharts] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  // Org Admin Charts
  const orgAdminCharts = insights.role === Role.ORG_ADMIN || insights.role === Role.ORG_MANAGER ? (
    <>
      {charts?.enrollmentTrend && charts.enrollmentTrend.length > 0 && (
        <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
          <InsightLineChart data={charts.enrollmentTrend} title="Student Enrollment Trend (30 Days)" color={COLORS.info} />
        </section>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {charts?.attendanceTrend && charts.attendanceTrend.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightLineChart data={charts.attendanceTrend} title="Attendance Coverage Trend (30 Days)" color={COLORS.success} />
          </section>
        )}
        {charts?.mailStatus && charts.mailStatus.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightPieChart data={charts.mailStatus.map(item => ({ name: item.status, value: item.count }))} title="Mail Status Distribution" />
          </section>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {charts?.sectionCapacity && charts.sectionCapacity.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightBarChart data={charts.sectionCapacity} dataKey="enrolled" nameKey="name" title="Section Capacity" color={COLORS.purple} disableHover />
          </section>
        )}
        {charts?.teacherWorkload && charts.teacherWorkload.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightBarChart data={charts.teacherWorkload} dataKey="sections" nameKey="name" title="Teacher Workload" color={COLORS.warning} horizontal disableHover />
          </section>
        )}
      </div>
    </>
  ) : null;

  // Teacher Charts
  const teacherCharts = insights.role === Role.TEACHER ? (
    <>
      {charts?.attendanceTrend && charts.attendanceTrend.length > 0 && (
        <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
          <InsightLineChart data={charts.attendanceTrend} title="Attendance Follow-Through Trend (30 Days)" color={COLORS.success} />
        </section>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {charts?.gradeDistribution && charts.gradeDistribution.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightPieChart data={charts.gradeDistribution.map(item => ({ name: item.range, value: item.count }))} title="Grade Distribution" />
          </section>
        )}
        {charts?.assessmentCompletion && charts.assessmentCompletion.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <CompletionBarChart data={charts.assessmentCompletion} title="Assessment Completion Rates" />
          </section>
        )}
      </div>
    </>
  ) : null;

  // Student Charts
  const studentCharts = insights.role === Role.STUDENT ? (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {charts?.attendanceTrend && charts.attendanceTrend.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightLineChart data={charts.attendanceTrend} title="Attendance Trend (30 Days)" color={COLORS.success} />
          </section>
        )}
        {charts?.gradeDistribution && charts.gradeDistribution.length > 0 && (
          <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
            <InsightPieChart data={charts.gradeDistribution.map(item => ({ name: item.range, value: item.count }))} title="Grade Distribution" />
          </section>
        )}
      </div>
      {charts?.studentPerformance && charts.studentPerformance.length > 0 && (
        <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
          <PerformanceChart data={charts.studentPerformance} title="Performance by Subject" />
        </section>
      )}
    </>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-8 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <RouteBreadcrumbs className="mb-3" />
            {insights.headline.eyebrow && (
              <Badge variant="primary" icon={Sparkles} className="mb-3 tracking-[0.25em] uppercase">
                {insights.headline.eyebrow}
              </Badge>
            )}
            <h1 className="text-4xl font-black tracking-tighter text-foreground">
              {insights.headline.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-bold text-muted-foreground">
              {insights.headline.subtitle}
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-[10px] font-black tracking-[0.25em] text-muted-foreground">Live snapshot</p>
              <p className="text-sm font-black text-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {insights.summaryCards.map((card, index) => (
          <SummaryCard key={card.id || `summary-${index}`} card={card} index={index} />
        ))}
      </section>

      {/* Spotlight Section */}
      {insights.spotlight && (
        <section className="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 via-card to-card p-6 shadow-xl">
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
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black tracking-[0.18em] text-primary-foreground shadow-lg transition hover:bg-primary/90"
              >
                Take Action
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Charts Section with Toggle */}
      {charts && (orgAdminCharts || teacherCharts || studentCharts) && (
        <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tight text-foreground">Data Visualizations</h2>
            </div>
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {showCharts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showCharts ? 'Hide Charts' : 'Show Charts'}
            </button>
          </div>
          {showCharts && (
            <div className="space-y-6">
              {orgAdminCharts || teacherCharts || studentCharts}
            </div>
          )}
        </section>
      )}

      {/* Groups Section with Toggle */}
      {insights.groups.length > 0 && (
        <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tight text-foreground">Action Items</h2>
            </div>
            <button
              onClick={() => setShowGroups(!showGroups)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {showGroups ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showGroups ? 'Hide Items' : 'Show Items'}
            </button>
          </div>
          {showGroups && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {insights.groups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-border bg-card/50 p-5 shadow-lg">
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
                      <div className="rounded-xl border border-dashed border-border bg-background/50 p-4 text-center text-xs font-bold tracking-[0.22em] text-muted-foreground">
                        Nothing pressing here
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent Activity Section with Toggle */}
      {insights.recentActivity.length > 0 && (
        <section className="rounded-3xl border border-border bg-linear-to-br from-card/80 to-card/50 p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tight text-foreground">Recent Activity</h2>
            </div>
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {showActivity ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showActivity ? 'Hide Activity' : 'Show Activity'}
            </button>
          </div>
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
        </section>
      )}
    </div>
  );
}
