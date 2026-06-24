'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ExternalLink, Filter, ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePageActionsHost } from '@/components/ui/PageActionsHost';
import { PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { AuditLogItem, PaginatedResponse, Role } from '@/types';

const actionOptions = [
    { value: '', label: 'All actions' },
    { value: 'CREATE_STRUCTURE', label: 'Structure created' },
    { value: 'UPDATE_STRUCTURE', label: 'Structure updated' },
    { value: 'GENERATE_ENTRY', label: 'Entry generated' },
    { value: 'CREATE_MANUAL_ENTRY', label: 'Manual entry' },
    { value: 'CLAIM_PAYMENT', label: 'Claim submitted' },
    { value: 'CONFIRM_PAYMENT', label: 'Payment confirmed' },
    { value: 'REJECT_CLAIM', label: 'Claim rejected' },
    { value: 'CANCEL_ENTRY', label: 'Entry cancelled' },
    { value: 'REVERSE_TRANSACTION', label: 'Transaction reversed' },
];

const resourceOptions = [
    { value: '', label: 'All resources' },
    { value: 'FinancialStructure', label: 'Structures' },
    { value: 'FinancialEntry', label: 'Entries' },
    { value: 'PaymentClaim', label: 'Claims' },
    { value: 'Transaction', label: 'Transactions' },
];

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function labelize(value?: string | null) {
    if (!value) return 'N/A';
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function linkedObject(log: AuditLogItem) {
    if (log.financeEntryId) return { label: `Entry ${log.financeEntryId.slice(0, 8)}`, href: `/finance/entries?entryId=${log.financeEntryId}` };
    if (log.transactionId) return { label: `Transaction ${log.transactionId.slice(0, 8)}`, href: `/finance/transactions?transactionId=${log.transactionId}` };
    if (log.paymentClaimId) return { label: `Claim ${log.paymentClaimId.slice(0, 8)}`, href: `/finance/entries?claimId=${log.paymentClaimId}` };
    if (log.financeStructureId) return { label: `Structure ${log.financeStructureId.slice(0, 8)}`, href: `/finance/structures?structureId=${log.financeStructureId}` };
    if (log.resourceId) return { label: `${labelize(log.resourceType)} ${log.resourceId.slice(0, 8)}`, href: '#' };
    return null;
}

function detailValue(value: unknown) {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

export default function FinanceAuditLogsPage() {
    const { token, user } = useAuth();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-audit-limit', 10);
    const [search, setSearch] = useState('');
    const [action, setAction] = useState('');
    const [resourceType, setResourceType] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<AuditLogItem> & { counts?: Record<string, number> }>(
        token ? ['finance/audit-logs', token, page, pageSize, search, action, resourceType] : null,
        ([, t]) => api.finance.getAuditLogs(t as string, {
            page,
            limit: pageSize,
            search: search || undefined,
            action: action || undefined,
            resourceType: resourceType || undefined,
        })
    );

    const columns = useMemo<Column<AuditLogItem>[]>(() => [
        {
            header: 'Time',
            accessor: (log) => formatDate(log.createdAt),
            width: 180,
        },
        {
            header: 'Actor',
            accessor: (log) => (
                <div className="min-w-0">
                    <p className="truncate font-black text-foreground">{log.actor?.name || log.actor?.email || 'System'}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">{labelize(log.actor?.role)}</p>
                </div>
            ),
            width: 220,
        },
        {
            header: 'Action',
            accessor: (log) => <Badge variant="primary">{labelize(log.action)}</Badge>,
            badge: true,
            width: 180,
        },
        {
            header: 'Target',
            accessor: (log) => (
                <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{labelize(log.resourceType)}</p>
                    <p className="truncate text-xs text-muted-foreground">{log.resourceId || 'N/A'}</p>
                </div>
            ),
            width: 230,
        },
        {
            header: 'Amount / Status Delta',
            accessor: (log) => {
                const details = log.details || {};
                const amount = details.amountDelta ?? details.amount ?? details.claimedAmount ?? details.confirmedAmount;
                const status = details.statusDelta ?? details.status ?? details.newStatus ?? details.oldStatus;
                return (
                    <div className="min-w-0 text-xs font-semibold">
                        <p className="truncate">Amount: {detailValue(amount)}</p>
                        <p className="truncate text-muted-foreground">Status: {detailValue(status)}</p>
                    </div>
                );
            },
            width: 220,
        },
        {
            header: 'IP / Device',
            accessor: (log) => (
                <div className="min-w-0 text-xs font-semibold">
                    <p className="truncate">{log.ip || 'N/A'}</p>
                    <p className="truncate text-muted-foreground">{log.userAgent || 'Unknown device'}</p>
                </div>
            ),
            width: 240,
        },
        {
            header: 'Linked Object',
            accessor: (log) => {
                const linked = linkedObject(log);
                return linked ? (
                    <Link href={linked.href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" onClick={(event) => event.stopPropagation()}>
                        {linked.label}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                ) : 'N/A';
            },
            width: 180,
        },
    ], []);

    const activeFilters = useMemo<ActiveFilter[]>(() => {
        const filters: ActiveFilter[] = [];
        if (action) {
            filters.push({
                key: 'action',
                label: 'Action',
                value: actionOptions.find((option) => option.value === action)?.label || labelize(action),
                onRemove: () => { setAction(''); setPage(1); },
            });
        }
        if (resourceType) {
            filters.push({
                key: 'resourceType',
                label: 'Resource',
                value: resourceOptions.find((option) => option.value === resourceType)?.label || labelize(resourceType),
                onRemove: () => { setResourceType(''); setPage(1); },
            });
        }
        return filters;
    }, [action, resourceType]);

    const resetControls = () => {
        setSearch('');
        setAction('');
        setResourceType('');
        setPage(1);
    };

    const pageControls = useMemo(() => (
        <PageControls
            drawerLabel="Audit filters"
            activeFilters={activeFilters}
            leading={(
                <SearchBar
                    value={search}
                    onChange={(value) => { setSearch(value); setPage(1); }}
                    placeholder="Search actor, message, action, or resource"
                    delay={300}
                    mobileMode="expandable"
                />
            )}
            actions={(
                <Button variant="secondary" onClick={resetControls}>
                    Reset
                </Button>
            )}
            renderFilters={() => (
                <FilterDrawerGrid>
                    <CustomSelect value={action} onChange={(value) => { setAction(value); setPage(1); }} options={actionOptions} icon={Filter} />
                    <CustomSelect value={resourceType} onChange={(value) => { setResourceType(value); setPage(1); }} options={resourceOptions} icon={ScrollText} />
                </FilterDrawerGrid>
            )}
        />
    ), [action, activeFilters, resourceType, search]);
    const controlsHosted = usePageActionsHost(pageControls);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    const canView = user?.role === Role.ORG_ADMIN || user?.role === Role.FINANCE_MANAGER || user?.role === Role.SUB_ADMIN;
    const logs = data?.data || [];

    return (
        <PageShell className="p-2 sm:p-3">
            <ResourcePanel>
                {!controlsHosted && <div className="shrink-0 border-b border-border/60 bg-card/95 p-2.5 sm:p-3">{pageControls}</div>}

                <div className="min-h-0 flex-1 p-3">
                    {!canView ? (
                        <EmptyState icon={ScrollText} title="Audit logs are not available" description="Your role does not have finance audit access." />
                    ) : error ? (
                        <ErrorState error={error} onRetry={() => mutate()} title="Audit logs could not load" />
                    ) : (
                        <DataTable
                            data={logs}
                            columns={columns}
                            keyExtractor={(log) => log.id}
                            currentPage={data?.currentPage || page}
                            totalPages={data?.totalPages || 1}
                            totalResults={data?.totalRecords || logs.length}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                            isLoading={isLoading}
                            onRowClick={setSelectedLog}
                            showSerialNumber
                            emptyTitle="No audit events"
                            emptyDescription="Finance mutation history will appear here."
                        />
                    )}
                </div>
            </ResourcePanel>

            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Audit Event"
                maxWidth="max-w-3xl"
            >
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                                <p className="text-xs font-black uppercase text-muted-foreground">Action</p>
                                <p className="mt-1 font-semibold text-foreground">{labelize(selectedLog.action)}</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                                <p className="text-xs font-black uppercase text-muted-foreground">Time</p>
                                <p className="mt-1 font-semibold text-foreground">{formatDate(selectedLog.createdAt)}</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                                <p className="text-xs font-black uppercase text-muted-foreground">Actor</p>
                                <p className="mt-1 font-semibold text-foreground">{selectedLog.actor?.name || selectedLog.actor?.email || 'System'}</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                                <p className="text-xs font-black uppercase text-muted-foreground">Request</p>
                                <p className="mt-1 truncate font-semibold text-foreground">{selectedLog.ip || 'N/A'}</p>
                                <p className="truncate text-xs text-muted-foreground">{selectedLog.userAgent || 'Unknown device'}</p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                            <p className="text-xs font-black uppercase text-muted-foreground">Message</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{selectedLog.message || 'N/A'}</p>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            {[
                                ['Structure', selectedLog.financeStructureId, '/finance/structures'],
                                ['Entry', selectedLog.financeEntryId, '/finance/entries'],
                                ['Claim', selectedLog.paymentClaimId, '/finance/entries'],
                                ['Transaction', selectedLog.transactionId, '/finance/transactions'],
                            ].map(([label, id, href]) => id ? (
                                <Link key={label} href={`${href}?id=${id}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 p-3 text-sm font-semibold text-primary hover:bg-primary/5">
                                    <span>{label}: {String(id).slice(0, 12)}</span>
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            ) : null)}
                        </div>

                        <div className="rounded-lg border border-border/70 bg-background p-3">
                            <p className="mb-2 text-xs font-black uppercase text-muted-foreground">Details</p>
                            <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-foreground custom-scrollbar">
                                {JSON.stringify(selectedLog.details || {}, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </Modal>
        </PageShell>
    );
}
