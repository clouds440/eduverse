'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
    Activity,
    ArrowLeft,
    BookOpen,
    Building2,
    Calendar,
    Coins,
    GraduationCap,
    Library,
    Mail,
    MapPin,
    Phone,
    School,
    ShieldAlert,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { AuditLogItem, OrganizationOverview, OrgStatus, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Loading } from '@/components/ui/Loading';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { OrgLogoOrIcon } from '@/components/ui/OrgLogoOrIcon';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

type ActivityResponse = PaginatedResponse<AuditLogItem> & { counts?: Record<string, number>; typeCounts?: Record<string, number> };

function humanizeAction(action: string) {
    return action.split('_').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function statusVariant(status?: OrgStatus): 'success' | 'warning' | 'error' | 'neutral' {
    if (status === OrgStatus.APPROVED) return 'success';
    if (status === OrgStatus.REJECTED) return 'error';
    if (status === OrgStatus.SUSPENDED) return 'neutral';
    return 'warning';
}

function formatMoney(amount: string | undefined, currency?: string | null) {
    const value = Number(amount || 0);
    if (!Number.isFinite(value)) return amount || '0';
    return value.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD' });
}

function MetricCard({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: typeof Users;
    label: string;
    value: string | number;
    detail?: string;
}) {
    return (
        <div className="rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
                    {detail && <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

export default function AdminOrganizationDetailsPage() {
    const params = useParams<{ id: string }>();
    const orgId = params.id;
    const { token, loading } = useAuth();
    const { getNumberParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-admin-org-details-activity-limit', 8);

    const page = getNumberParam('page', 1);

    const overviewKey = token && orgId ? ['admin-org-overview', orgId] as const : null;
    const activityKey = token && orgId
        ? ['admin-org-activity-logs', orgId, { page, limit: pageSize }] as const
        : null;

    const { data: overview, error: overviewError, isLoading: overviewLoading, mutate: retryOverview } = useSWR<OrganizationOverview>(overviewKey);
    const { data: activity, error: activityError, isLoading: activityLoading } = useSWR<ActivityResponse>(activityKey);

    const org = overview?.organization;
    const reversedStatusHistory = useMemo(() => [...(org?.statusHistory ?? [])].reverse(), [org?.statusHistory]);

    const columns: Column<AuditLogItem>[] = useMemo(() => [
        {
            header: 'Event',
            width: 380,
            accessor: (row) => (
                <div className="space-y-2">
                    <Badge variant={row.action.includes('failed') || row.action.includes('delete') ? 'error' : row.action.includes('success') || row.action.includes('verified') ? 'success' : 'warning'} size="sm">
                        {humanizeAction(row.action)}
                    </Badge>
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{row.message}</p>
                    {(row.module || row.resourceType) && <p className="text-[11px] font-semibold text-muted-foreground">{[row.module, row.resourceType].filter(Boolean).join(' / ')}</p>}
                </div>
            ),
        },
        {
            header: 'Actor / Target',
            width: 280,
            accessor: (row) => (
                <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                    <p className="truncate">Actor: {row.actor?.name || row.actor?.email || 'System'}</p>
                    <p className="truncate">Target: {row.target?.name || row.target?.email || row.resourceTitle || row.resourceId || 'N/A'}</p>
                </div>
            ),
        },
        {
            header: 'Time',
            width: 220,
            accessor: (row) => (
                <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{new Date(row.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
            ),
        },
    ], []);

    if (loading || (overviewLoading && !overview)) {
        return <Loading className="h-full" text="Loading organization overview..." size="lg" icon={Building2} />;
    }

    if (overviewError && !overview) {
        return (
            <ErrorState
                error={overviewError}
                onRetry={() => retryOverview()}
                className="min-h-80"
                title="Unable to load organization"
                description="The organization overview could not be fetched."
            />
        );
    }

    return (
        <PageShell>
            <PageHeader
                title={org?.name || 'Organization'}
                description="Full platform overview, current status, status messages, and recent security activity."
                icon={Building2}
                breadcrumbs={[{ label: 'Admin' }, { label: 'Organizations', href: '/admin/organizations' }, { label: org?.name || 'Organization' }]}
                meta={org?.status ? <Badge variant={statusVariant(org.status)} size="md" dot>{org.status.replace('_', ' ')}</Badge> : undefined}
                actions={(
                    <Link
                        href="/admin/organizations"
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                )}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                    <div className="border-b border-border/60 bg-linear-to-br from-primary/10 via-card to-info/10 p-5 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <OrgLogoOrIcon logoUrl={org?.logoUrl} updatedAt={org?.avatarUpdatedAt} orgName={org?.name} className="h-16 w-16 rounded-2xl border border-border bg-card shadow-sm" />
                            <div className="min-w-0 flex-1">
                                <h2 className="truncate text-2xl font-black text-foreground">{org?.name}</h2>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {org?.type && <Badge variant="neutral" size="sm">{org.type.replace('_', ' ')}</Badge>}
                                    <Badge variant={org?.contactEmailVerifiedAt ? 'success' : 'warning'} size="sm" icon={org?.contactEmailVerifiedAt ? ShieldCheck : ShieldAlert}>
                                        {org?.contactEmailVerifiedAt ? 'Contact verified' : 'Contact unverified'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                        <InfoLine icon={MapPin} label="Location" value={org?.location || 'N/A'} />
                        <InfoLine icon={Mail} label="Login email" value={org?.email || 'N/A'} />
                        <InfoLine icon={Mail} label="Contact email" value={org?.contactEmail || 'N/A'} />
                        <InfoLine icon={Phone} label="Phone" value={org?.phone || 'N/A'} />
                        <InfoLine icon={Calendar} label="Created" value={org?.createdAt ? new Date(org.createdAt).toLocaleString() : 'N/A'} />
                        <InfoLine icon={Building2} label="Organization ID" value={org?.id || orgId} />
                    </div>
                </section>

                <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status messages</p>
                            <h3 className="mt-1 text-lg font-black text-foreground">Admin decisions</h3>
                        </div>
                        <Link
                            href={`/admin/organizations/${orgId}/activity-log`}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-black text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                            <Activity className="h-4 w-4" />
                            Activity log
                        </Link>
                    </div>
                    {reversedStatusHistory.length > 0 ? (
                        <div className="max-h-96 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                            {reversedStatusHistory.map((entry, index) => (
                                <div key={`${entry.status}-${entry.createdAt}-${index}`} className="rounded-lg border border-border/70 bg-background/55 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <Badge variant={statusVariant(entry.status)} size="sm">{entry.status.replace('_', ' ')}</Badge>
                                        <span className="text-xs font-bold text-muted-foreground">{new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                    <MarkdownRenderer content={entry.message} className="mt-3 text-sm leading-relaxed" />
                                    <p className="mt-3 text-[11px] font-semibold text-muted-foreground">By {entry.adminName} ({entry.adminRole})</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-border/70 bg-background/55 p-8 text-center">
                            <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/50" />
                            <p className="mt-3 text-sm font-bold text-muted-foreground">No status messages recorded.</p>
                        </div>
                    )}
                </section>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Users} label="Users" value={overview?.counts.users ?? 0} />
                <MetricCard icon={GraduationCap} label="Students" value={overview?.counts.students ?? 0} />
                <MetricCard icon={BookOpen} label="Teachers" value={overview?.counts.teachers ?? 0} />
                <MetricCard icon={ShieldCheck} label="Active sessions" value={overview?.counts.activeSessions ?? 0} />
                <MetricCard icon={Library} label="Courses" value={overview?.counts.courses ?? 0} />
                <MetricCard icon={School} label="Sections" value={overview?.counts.sections ?? 0} />
                <MetricCard icon={Building2} label="Departments" value={overview?.counts.departments ?? 0} />
                <MetricCard icon={ShieldAlert} label="Critical events" value={overview?.counts.recentCriticalEvents ?? 0} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard icon={Coins} label="Income" value={formatMoney(overview?.finance.income, org?.currency)} />
                <MetricCard icon={Coins} label="Expenses" value={formatMoney(overview?.finance.expenses, org?.currency)} />
                <MetricCard icon={Coins} label="Net cashflow" value={formatMoney(overview?.finance.netCashflow, org?.currency)} />
            </div>

            <ResourcePanel>
                <div className="border-b border-border/60 bg-card/85 p-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recent activity</p>
                        <h3 className="mt-1 text-lg font-black text-foreground">Latest organization events</h3>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-x-auto">
                    <DataTable
                        columns={columns}
                        data={activity?.data || []}
                        keyExtractor={(row) => row.id}
                        isLoading={activityLoading}
                        currentPage={page}
                        totalPages={activity?.totalPages || 1}
                        totalResults={activity?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={(nextSize) => {
                            setPageSize(nextSize);
                            updateQueryParams({ page: 1 });
                        }}
                        maxHeight="100%"
                        tableLayout="fixed"
                        emptyTitle="No organization activity found"
                        emptyDescription={activityError ? 'Unable to load activity. Try refreshing this section.' : 'Security, login, verification, and finance activity will appear here.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>
        </PageShell>
    );
}

function InfoLine({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Mail;
    label: string;
    value: string;
}) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-background/55 p-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}
