'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Activity, BarChart3, Building2, ClipboardCheck, GitBranch, GraduationCap, Landmark, LayoutDashboard, ListChecks, PieChart, Repeat2, Sparkles, Users, WalletCards } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { DashboardInsights, Role, type InsightTimeRange } from '@/types';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import InsightModulePanel from '@/components/dashboard/InsightModulePanel';
import InsightShellSummary from '@/components/dashboard/InsightShellSummary';
import { insightSWRConfig } from '@/lib/swr';

const defaultRange: InsightTimeRange = '1M';

function moduleDefinitions(role?: string) {
    if (role === Role.ORG_ADMIN || role === Role.SUB_ADMIN) {
        return [
            { id: 'cycles', title: 'Cycle Comparison', description: 'Current cycle compared with up to five previous cycles.', icon: <Repeat2 className="h-5 w-5" /> },
            { id: 'programs', title: 'Program Coverage', description: 'Program offerings, curricula, enrollment, and section delivery coverage.', icon: <GraduationCap className="h-5 w-5" /> },
            { id: 'relationships', title: 'Section Relationships', description: 'Related theory, lab, practical, and component section coverage.', icon: <GitBranch className="h-5 w-5" /> },
            { id: 'attendance', title: 'Attendance', description: 'Official attendance trend and hotspots.', icon: <ClipboardCheck className="h-5 w-5" /> },
            { id: 'structure', title: 'Academic Structure', description: 'Sections, teaching load, and department performance.', icon: <Users className="h-5 w-5" /> },
            { id: 'campus', title: 'Campus Usage', description: 'Building schedules, room usage, and capacity warnings.', icon: <Building2 className="h-5 w-5" /> },
            { id: 'activity', title: 'Recent Activity', description: 'Announcements, mail distribution, and recent operational movement.', icon: <Activity className="h-5 w-5" /> },
        ];
    }

    if (role === Role.TEACHER || role === Role.ORG_MANAGER) {
        return [
            { id: 'charts', title: 'Teaching Trends', description: 'Attendance, grade distribution, and assessment completion.', icon: <BarChart3 className="h-5 w-5" /> },
            { id: 'actions', title: 'Teaching Follow-up', description: 'Grading, attendance gaps, learner risk, and deadlines.', icon: <ListChecks className="h-5 w-5" /> },
            { id: 'activity', title: 'Teaching Activity', description: 'Recent submissions, assessments, and attendance updates.', icon: <Activity className="h-5 w-5" /> },
        ];
    }

    if (role === Role.STUDENT || role === Role.GUARDIAN) {
        return [
            { id: 'charts', title: 'Learning Trends', description: 'Attendance, grade distribution, and subject performance.', icon: <BarChart3 className="h-5 w-5" /> },
            { id: 'actions', title: 'Learning Follow-up', description: 'Pending work, low-attendance signals, fee follow-up, and deadlines.', icon: <ListChecks className="h-5 w-5" /> },
            { id: 'activity', title: 'Learning Activity', description: 'Recent submissions, attendance updates, and fee activity.', icon: <Activity className="h-5 w-5" /> },
        ];
    }

    if (role === Role.FINANCE_MANAGER) {
        return [
            { id: 'cash-flow', title: 'Cash Flow', description: 'Income, expenses, net flow, and top months.', icon: <WalletCards className="h-5 w-5" /> },
            { id: 'sources', title: 'Finance Sources', description: 'Income and expense concentration by source.', icon: <PieChart className="h-5 w-5" /> },
            { id: 'collections', title: 'Collections', description: 'Pending, overdue, and collected finance health.', icon: <ListChecks className="h-5 w-5" /> },
            { id: 'departments', title: 'Departments', description: 'Expected, collected, pending, and overdue amounts by department.', icon: <Landmark className="h-5 w-5" /> },
            { id: 'activity', title: 'Finance Activity', description: 'Recently confirmed income and expense entries.', icon: <Activity className="h-5 w-5" /> },
        ];
    }

    return [];
}

function OverviewEmptyState() {
    return (
        <section className="rounded-lg border border-dashed border-border/80 bg-card/70 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-black text-foreground">Your overview will build up here</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-muted-foreground">
                As you keep operating inside Eduverse, this page will fill with useful cards, charts, and follow-up signals.
            </p>
        </section>
    );
}

export default function AdminPage() {
    const { token, loading } = useAuth();
    const [moduleRanges, setModuleRanges] = useState<Record<string, InsightTimeRange>>({});

    const insightsKey = token ? ['insights-shell', token, defaultRange] as const : null;
    const { data: insights, isLoading: insightsLoading } = useSWR<DashboardInsights>(
        insightsKey,
        ([, t]) => api.org.getInsights(t as string, { range: defaultRange }),
        insightSWRConfig,
    );

    const modules = useMemo(() => moduleDefinitions(insights?.role), [insights?.role]);
    const hasShellContent = Boolean(
        insights?.summaryCards?.length ||
        insights?.spotlight ||
        insights?.groups?.some((group) => group.items.length > 0),
    );

    return (
        <PageShell>
            <PageHeader
                title="Overview"
                description="A lightweight dashboard that loads role-based insight modules independently."
                icon={LayoutDashboard}
                meta={<Badge variant="neutral" size="sm">Progressive dashboard</Badge>}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Overview' },
                ]}
            />
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                {loading || insightsLoading || !insights ? (
                    <DashboardSkeleton />
                ) : (
                    <div className="space-y-5 pb-6">
                        <InsightShellSummary insights={insights} />

                        {!hasShellContent && modules.length === 0 && <OverviewEmptyState />}

                        {token && modules.map((module) => (
                            <InsightModulePanel
                                key={module.id}
                                token={token}
                                moduleName={module.id}
                                title={module.title}
                                description={module.description}
                                icon={module.icon}
                                range={moduleRanges[module.id] || defaultRange}
                                onRangeChange={(range) => setModuleRanges((current) => ({ ...current, [module.id]: range }))}
                            />
                        ))}
                    </div>
                )}
            </div>
        </PageShell>
    );
}
