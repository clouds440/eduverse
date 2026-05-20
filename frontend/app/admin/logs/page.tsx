'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Building2, Clipboard, Clock, Filter, Monitor, ScrollText, ShieldAlert, UserRound } from 'lucide-react';
import { AuditLogItem, PaginatedResponse, Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SearchBar } from '@/components/ui/SearchBar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Loading } from '@/components/ui/Loading';
import { Badge } from '@/components/ui/Badge';
import { OrgLogoOrIcon } from '@/components/ui/OrgLogoOrIcon';
import { ErrorState } from '@/components/ui/ErrorState';

type AuditLogsResponse = PaginatedResponse<AuditLogItem> & { counts?: Record<string, number> };

function humanizeAction(action: string) {
    return action
        .split('_')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatLogForCopy(log: AuditLogItem) {
    return [
        `Time: ${new Date(log.createdAt).toLocaleString()}`,
        `Action: ${log.action}`,
        `Message: ${log.message}`,
        `Organization: ${log.organization?.name || 'N/A'}`,
        `Actor: ${log.actor?.name || log.actor?.email || 'N/A'}`,
        `Target: ${log.target?.name || log.target?.email || 'N/A'}`,
        `IP: ${log.ip || 'N/A'}`,
        `Session: ${log.sessionId || 'N/A'}`,
        `Details: ${log.details ? JSON.stringify(log.details) : 'N/A'}`,
    ].join('\n');
}

export default function AdminAuditLogsPage() {
    const { token, user, loading } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window === 'undefined') return 10;
        return parseInt(localStorage.getItem('edu-admin-audit-limit') || '10', 10);
    });

    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || '';
    const action = searchParams.get('action') || 'ALL';

    const updateQueryParams = (updates: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '') params.delete(key);
            else params.set(key, String(value));
        });
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const logsKey = token ? ['admin-audit-logs', { page, limit: pageSize, search, action: action === 'ALL' ? undefined : action }] as const : null;
    const { data, error: fetchError, isLoading, mutate: retryLogs } = useSWR<AuditLogsResponse>(logsKey);

    const actionOptions = useMemo(() => {
        const counts = data?.counts || {};
        return [
            { value: 'ALL', label: 'All Events', icon: Filter },
            ...Object.keys(counts).map((key) => ({
                value: key,
                label: `${humanizeAction(key)} (${counts[key]})`,
                icon: ShieldAlert,
            })),
        ];
    }, [data?.counts]);

    const copyLog = useCallback(async (log: AuditLogItem) => {
        try {
            await navigator.clipboard.writeText(formatLogForCopy(log));
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Audit log copied', type: 'success' } });
        } catch {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Unable to copy log', type: 'error' } });
        }
    }, [dispatch]);

    const columns: Column<AuditLogItem>[] = useMemo(() => [
        {
            header: 'Event',
            width: 380,
            accessor: (row) => (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge variant={row.action.includes('failed') || row.action.includes('excessive') ? 'error' : row.action.includes('completed') || row.action.includes('verified') ? 'success' : 'warning'} size="sm">
                            {humanizeAction(row.action)}
                        </Badge>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">{row.message}</p>
                </div>
            ),
        },
        {
            header: 'Organization',
            width: 280,
            accessor: (row) => (
                <div className="flex w-full min-w-0 items-center gap-3">
                    {row.organization ? (
                        <OrgLogoOrIcon
                            logoUrl={row.organization.logoUrl}
                            updatedAt={row.organization.avatarUpdatedAt}
                            orgName={row.organization.name}
                            className="w-10 h-10 rounded-full ring-1 ring-border"
                        />
                    ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Building2 className="h-5 w-5" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground">{row.organization?.name || 'Platform-wide event'}</p>
                        <p className="truncate text-[11px] font-semibold text-muted-foreground">{row.organization?.id || 'No organization id'}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'People',
            width: 260,
            accessor: (row) => (
                <div className="w-full min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <UserRound className="w-3.5 h-3.5 text-primary" />
                        <span className="min-w-0 truncate">Actor: {row.actor?.name || row.actor?.email || 'System'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                        <span className="min-w-0 truncate">Target: {row.target?.name || row.target?.email || 'N/A'}</span>
                    </div>
                </div>
            ),
        },
        {
            header: 'Source',
            width: 190,
            accessor: (row) => (
                <div className="w-full min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Monitor className="w-3.5 h-3.5 text-primary" />
                        <span className="min-w-0 truncate">{row.ip || 'Unknown IP'}</span>
                    </div>
                    <p className="w-full truncate text-[11px] text-muted-foreground/70 font-medium">{row.userAgent || 'Unknown device'}</p>
                </div>
            ),
        },
        {
            header: 'Time',
            width: 220,
            accessor: (row) => (
                <div className="flex w-full min-w-0 items-center gap-2 whitespace-nowrap text-xs font-bold text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="truncate">{new Date(row.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
            ),
        },
        {
            header: 'Actions',
            width: 120,
            accessor: (row) => (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        copyLog(row);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 text-xs font-black transition-colors"
                >
                    <Clipboard className="w-3.5 h-3.5" />
                    Copy
                </button>
            ),
        },
    ], [copyLog]);

    if (loading || (!user && !loading)) {
        return <Loading className="h-full" text="Loading audit logs..." size="lg" icon={ScrollText} />;
    }

    if (fetchError && !data) {
        return (
            <ErrorState
                error={fetchError}
                onRetry={() => retryLogs()}
                className="min-h-80"
                title="Unable to load audit logs"
                description="The audit log list could not be fetched."
            />
        );
    }

    if (user?.role !== Role.SUPER_ADMIN) {
        return (
            <div className="flex h-full items-center justify-center p-6">
                <div className="max-w-md rounded-2xl border border-danger/20 bg-danger/10 p-8 text-center">
                    <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-danger" />
                    <h1 className="text-2xl font-black text-danger">Super Admin Only</h1>
                    <p className="mt-2 text-sm font-semibold text-muted-foreground">Audit logs are restricted to super admins.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col">
            <div className="bg-card/80 backdrop-blur-2xl rounded-xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-border/40 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                <ScrollText className="w-7 h-7 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Audit Logs</h1>
                                <p className="text-xs md:text-sm text-muted-foreground font-semibold">Security and account events translated into readable activity.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="w-full sm:w-80">
                            <CustomSelect
                                value={action}
                                onChange={(value) => updateQueryParams({ action: value, page: 1 })}
                                options={actionOptions}
                                placeholder="Filter action"
                            />
                        </div>
                        <div className="flex-1">
                            <SearchBar
                                value={search}
                                onChange={(value) => updateQueryParams({ search: value, page: 1 })}
                                placeholder="Search org name, org ID, actor, or target..."
                                className="max-w-full"
                            />
                        </div>
                    </div>
                </div>

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
                            localStorage.setItem('edu-admin-audit-limit', String(nextSize));
                            updateQueryParams({ page: 1 });
                        }}
                        maxHeight="100%"
                        tableLayout="fixed"
                    />
                </div>
            </div>
        </div>
    );
}
