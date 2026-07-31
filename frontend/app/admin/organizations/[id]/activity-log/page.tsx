'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Activity, Building2, Clock, Filter, Monitor, ShieldAlert, UserRound } from 'lucide-react';
import { ActivityLogType, AuditLogItem, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SearchBar } from '@/components/ui/SearchBar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Loading } from '@/components/ui/Loading';
import { Badge } from '@/components/ui/Badge';
import { OrgLogoOrIcon } from '@/components/ui/OrgLogoOrIcon';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

type ActivityResponse = PaginatedResponse<AuditLogItem> & { counts?: Record<string, number>; typeCounts?: Record<string, number> };

function humanizeAction(action: string) {
    return action.split('_').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function OrgActivityLogPage() {
    const params = useParams<{ id: string }>();
    const orgId = params.id;
    const { token, loading } = useAuth();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-admin-org-activity-limit', 10);

    const page = getNumberParam('page', 1);
    const search = getStringParam('search');
    const action = getStringParam('action', 'ALL');
    const type = getStringParam('type', 'ALL');

    const key = token && orgId ? ['admin-org-activity-logs', orgId, { page, limit: pageSize, search, action: action === 'ALL' ? undefined : action, type: type === 'ALL' ? undefined : type }] as const : null;
    const { data, error: fetchError, isLoading, mutate: retryLogs } = useSWR<ActivityResponse>(key);

    const actionOptions = useMemo(() => {
        const counts = data?.counts || {};
        return [
            { value: 'ALL', label: 'All Activity', icon: Filter },
            ...Object.keys(counts).map((key) => ({ value: key, label: `${humanizeAction(key)} (${counts[key]})`, icon: ShieldAlert })),
        ];
    }, [data?.counts]);

    const typeOptions = useMemo(() => {
        const counts = data?.typeCounts || {};
        return [
            { value: 'ALL', label: 'All Types', icon: Filter },
            ...Object.values(ActivityLogType).map((key) => ({ value: key, label: `${humanizeAction(key)}${counts[key] ? ` (${counts[key]})` : ''}`, icon: ShieldAlert })),
        ];
    }, [data?.typeCounts]);

    const activeFilters: ActiveFilter[] = [
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(action !== 'ALL' ? [{ key: 'action', label: 'Action', value: humanizeAction(action), onRemove: () => updateQueryParams({ action: undefined, page: 1 }) }] : []),
        ...(type !== 'ALL' ? [{ key: 'type', label: 'Type', value: humanizeAction(type), onRemove: () => updateQueryParams({ type: undefined, page: 1 }) }] : []),
    ];

    const columns: Column<AuditLogItem>[] = useMemo(() => [
        {
            header: 'Activity',
            width: 380,
            accessor: (row) => (
                <div className="space-y-2">
                    <Badge variant={row.action.includes('failed') || row.action.includes('delete') ? 'error' : row.action.includes('success') || row.action.includes('verified') ? 'success' : 'warning'} size="sm">
                        {humanizeAction(row.action)}
                    </Badge>
                    <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">{row.message}</p>
                    {(row.module || row.resourceType) && <p className="text-[11px] font-semibold text-muted-foreground">{[row.module, row.resourceType].filter(Boolean).join(' / ')}</p>}
                </div>
            ),
        },
        {
            header: 'Organization',
            width: 260,
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    {row.organization ? (
                        <OrgLogoOrIcon logoUrl={row.organization.logoUrl} updatedAt={row.organization.avatarUpdatedAt} orgName={row.organization.name} className="w-10 h-10 rounded-full ring-1 ring-border" />
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Building2 className="h-5 w-5" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{row.organization?.name || 'Organization'}</p>
                        <p className="truncate text-[11px] font-semibold text-muted-foreground">{row.organization?.id || orgId}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Admin',
            width: 260,
            accessor: (row) => (
                <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                    <div className="flex min-w-0 items-center gap-2">
                        <UserRound className="w-3.5 h-3.5 text-primary" />
                        <span className="truncate">{row.actor?.name || row.actor?.email || 'System'}</span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground/70">{row.actor?.role || 'No actor role'}</p>
                </div>
            ),
        },
        {
            header: 'Source',
            width: 240,
            accessor: (row) => (
                <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                    <div className="flex min-w-0 items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-primary" />
                        <span className="truncate">{row.device?.name || row.userAgent || 'Unknown device'}</span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground/70">{[row.device?.browser, row.device?.os, row.location || row.ip].filter(Boolean).join(' | ') || 'Unknown source'}</p>
                </div>
            ),
        },
        {
            header: 'Time',
            width: 220,
            accessor: (row) => (
                <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="truncate">{new Date(row.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
            ),
        },
    ], [orgId]);

    if (loading || (isLoading && !data)) {
        return <Loading className="h-full" text="Loading org activity..." size="lg" icon={Activity} />;
    }

    if (fetchError && !data) {
        return <ErrorState error={fetchError} onRetry={() => retryLogs()} className="min-h-80" title="Unable to load org activity" description="The organization activity log could not be fetched." />;
    }

    return (
        <PageShell>
            <PageHeader
                title="Org Activity Log"
                description="Recent organization admin activity and security-relevant events without confidential tenant data."
                icon={Activity}
                breadcrumbs={[{ label: 'Admin' }, { label: 'Organizations', href: '/admin/organizations' }, { label: 'Org Activity Log' }]}
                meta={data?.totalRecords !== undefined ? <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-1 text-xs font-black text-muted-foreground">{data.totalRecords} events</span> : undefined}
                actions={(
                    <PageControls
                        drawerLabel="Activity filters"
                        leading={<SearchBar value={search} onChange={(value) => updateQueryParams({ search: value, page: 1 })} placeholder="Search action, actor, source..." mobileMode="expandable" />}
                        renderFilters={() => (
                            <FilterDrawerGrid>
                                <CustomSelect value={type} onChange={(value) => updateQueryParams({ type: value === 'ALL' ? undefined : value, page: 1 })} options={typeOptions} placeholder="Filter type" />
                                <CustomSelect value={action} onChange={(value) => updateQueryParams({ action: value, page: 1 })} options={actionOptions} placeholder="Filter action" />
                            </FilterDrawerGrid>
                        )}
                        activeFilters={activeFilters}
                    />
                )}
            />
            <ResourcePanel>
                <div className="flex-1 min-h-0 overflow-x-auto">
                    <DataTable
                        columns={columns}
                        data={data?.data || []}
                        keyExtractor={(row) => row.id}
                        isLoading={isLoading}
                        currentPage={page}
                        totalPages={data?.totalPages || 1}
                        totalResults={data?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={(nextSize) => {
                            setPageSize(nextSize);
                            updateQueryParams({ page: 1 });
                        }}
                        maxHeight="100%"
                        tableLayout="fixed"
                        emptyTitle="No organization activity found"
                        emptyDescription={search || activeFilters.length > 0 ? 'Adjust the filters to broaden the result set.' : 'Security, login, verification, and finance activity will appear here as it is recorded.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
