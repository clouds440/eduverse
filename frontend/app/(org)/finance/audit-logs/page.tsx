'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ExternalLink, Filter, ScrollText, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { RemoteFilterSelect } from '@/components/ui/RemoteFilterSelect';
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
import { searchFilterLookup } from '@/lib/filterLookups';

const actionOptions = [
    { value: '', label: 'All actions' },
    { value: 'finance_structure_created', label: 'Structure created' },
    { value: 'finance_structure_updated', label: 'Structure updated' },
    { value: 'finance_entry_generated_now', label: 'Entry generated' },
    { value: 'finance_structure_entries_generated_now', label: 'Entries generated' },
    { value: 'finance_entry_manual_created', label: 'Manual entry' },
    { value: 'finance_payment_claimed', label: 'Claim submitted' },
    { value: 'finance_payment_confirmed', label: 'Payment confirmed' },
    { value: 'finance_payment_claim_rejected', label: 'Claim rejected' },
    { value: 'finance_entry_cancelled', label: 'Entry cancelled' },
    { value: 'finance_transaction_reversed', label: 'Transaction reversed' },
];

const resourceOptions = [
    { value: '', label: 'All resources' },
    { value: 'structure', label: 'Structures' },
    { value: 'entry', label: 'Entries' },
    { value: 'claim', label: 'Claims' },
    { value: 'transaction', label: 'Transactions' },
];

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function labelize(value?: string | null) {
    if (!value) return 'N/A';
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDeviceName(userAgent?: string | null) {
    if (!userAgent) return 'Unknown device';

    const browserChecks: Array<[string, RegExp]> = [
        ['Microsoft Edge', /Edg(?:e|A|iOS)?\//i],
        ['Opera', /OPR\/|Opera/i],
        ['Firefox', /Firefox\/|FxiOS\//i],
        ['Chrome', /Chrome\/|CriOS\//i],
        ['Safari', /Safari\//i],
    ];
    const osChecks: Array<[string, RegExp]> = [
        ['Windows', /Windows NT/i],
        ['macOS', /Mac OS X|Macintosh/i],
        ['iOS', /iPhone|iPad|iPod|CPU (?:iPhone )?OS/i],
        ['Android', /Android/i],
        ['ChromeOS', /CrOS/i],
        ['Linux', /Linux/i],
    ];

    const browser = browserChecks.find(([, pattern]) => pattern.test(userAgent))?.[0];
    const os = osChecks.find(([, pattern]) => pattern.test(userAgent))?.[0];

    if (browser && os) return `${browser} - ${os}`;
    if (browser) return browser;
    if (os) return os;

    const simpleDeviceName = userAgent
        .replace(/\s+/g, ' ')
        .replace(/\bon\b/gi, '-')
        .trim();

    return simpleDeviceName.length > 48 ? `${simpleDeviceName.slice(0, 45)}...` : simpleDeviceName || 'Unknown device';
}

function formatDetailLabel(value: string) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringField(source: unknown, key: string) {
    if (!isRecord(source)) return null;
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getLogResourceTitle(log: AuditLogItem) {
    const details = log.details || {};
    const after = isRecord(details) ? details.after : null;
    const before = isRecord(details) ? details.before : null;

    return log.resourceTitle
        || getStringField(details, 'title')
        || getStringField(details, 'entryTitle')
        || getStringField(details, 'structureTitle')
        || getStringField(details, 'transactionDescription')
        || getStringField(details, 'description')
        || getStringField(after, 'title')
        || getStringField(before, 'title')
        || getStringField(details, 'referenceNumber')
        || getStringField(details, 'paymentMethod')
        || getStringField(details, 'category')
        || getStringField(details, 'targetType')
        || `${labelize(log.resourceType)} record`;
}

function linkedObject(log: AuditLogItem) {
    const resourceTitle = getLogResourceTitle(log);
    if (log.financeEntryId) return { label: resourceTitle, href: `/finance/entries?entryId=${log.financeEntryId}` };
    if (log.transactionId) return { label: resourceTitle, href: `/finance/transactions?transactionId=${log.transactionId}` };
    if (log.paymentClaimId) return { label: resourceTitle, href: `/finance/entries?claimId=${log.paymentClaimId}` };
    if (log.financeStructureId) return { label: resourceTitle, href: `/finance/structures?structureId=${log.financeStructureId}` };
    if (log.resourceId) return { label: resourceTitle, href: '#' };
    return null;
}

function detailValue(value: unknown) {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

function DetailTable({ rows }: { rows: Array<[string, unknown]> }) {
    const visibleRows = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');

    if (visibleRows.length === 0) {
        return <p className="rounded-md bg-muted/40 p-3 text-sm font-semibold text-muted-foreground">No details available.</p>;
    }

    return (
        <div className="overflow-hidden rounded-lg border border-border/70">
            <table className="w-full border-collapse text-sm">
                <tbody className="divide-y divide-border/60">
                    {visibleRows.map(([label, value]) => (
                        <tr key={label} className="align-top">
                            <th className="w-36 bg-muted/35 px-3 py-2 text-left text-xs font-black uppercase text-muted-foreground sm:w-48">
                                {label}
                            </th>
                            <td className="min-w-0 px-3 py-2 font-semibold text-foreground">
                                {typeof value === 'object' ? (
                                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-muted/45 p-3 text-xs font-medium leading-relaxed text-foreground custom-scrollbar">
                                        {detailValue(value)}
                                    </pre>
                                ) : (
                                    <span className="wrap-break-word">{detailValue(value)}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function FinanceAuditLogsPage() {
    const { token, user } = useAuth();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-audit-limit', 10);
    const [search, setSearch] = useState('');
    const [action, setAction] = useState('');
    const [resourceType, setResourceType] = useState('');
    const [userId, setUserId] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<AuditLogItem> & { counts?: Record<string, number> }>(
        token ? ['finance/audit-logs', token, page, pageSize, search, action, resourceType, userId] : null,
        ([, t]) => api.finance.getAuditLogs(t as string, {
            page,
            limit: pageSize,
            search: search || undefined,
            action: action || undefined,
            resourceType: resourceType || undefined,
            userId: userId || undefined,
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
                    <p className="truncate font-semibold text-foreground">{getLogResourceTitle(log)}</p>
                    <p className="truncate text-xs text-muted-foreground">{labelize(log.resourceType)}</p>
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
            header: 'Device',
            accessor: (log) => (
                <div className="min-w-0 text-xs font-semibold">
                    <p className="truncate text-foreground">{formatDeviceName(log.userAgent)}</p>
                    <p className="truncate text-muted-foreground">Open for request details</p>
                </div>
            ),
            width: 190,
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
        if (userId) {
            filters.push({
                key: 'userId',
                label: 'User',
                value: 'Selected user',
                onRemove: () => { setUserId(''); setPage(1); },
            });
        }
        return filters;
    }, [action, resourceType, userId]);

    const resetControls = () => {
        setSearch('');
        setAction('');
        setResourceType('');
        setUserId('');
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
                    <RemoteFilterSelect
                        cacheKey="finance-audit-user-filter"
                        value={userId}
                        onChange={(value) => { setUserId(value); setPage(1); }}
                        placeholder="All users"
                        allLabel="All users"
                        icon={UserRound}
                        selectedLabel="Selected user"
                        loadOptions={(searchTerm) => searchFilterLookup({ token: token!, entity: 'mailUsers', search: searchTerm })}
                    />
                </FilterDrawerGrid>
            )}
        />
    ), [action, activeFilters, resourceType, search, token, userId]);
    const controlsHosted = usePageActionsHost(pageControls);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    const canView = user?.role === Role.ORG_ADMIN || user?.role === Role.FINANCE_MANAGER || user?.role === Role.SUB_ADMIN;
    const logs = data?.data || [];

    return (
        <PageShell className="">
            <ResourcePanel>
                {!controlsHosted && <div className="shrink-0 border-b border-border/60 bg-card/95">{pageControls}</div>}

                <div className="min-h-0 flex-1">
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
                                <p className="mt-1 truncate font-semibold text-foreground">{formatDeviceName(selectedLog.userAgent)}</p>
                                <p className="truncate text-xs text-muted-foreground">IP: {selectedLog.ip || 'N/A'}</p>
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

                        <div className="space-y-2">
                            <p className="text-xs font-black uppercase text-muted-foreground">Request Details</p>
                            <DetailTable rows={[
                                ['Device', formatDeviceName(selectedLog.userAgent)],
                                ['IP address', selectedLog.ip],
                                ['Raw user agent', selectedLog.userAgent],
                                ['Session ID', selectedLog.sessionId],
                            ]} />
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs font-black uppercase text-muted-foreground">Event Details</p>
                            <DetailTable rows={Object.entries(selectedLog.details || {}).map(([key, value]) => [formatDetailLabel(key), value])} />
                        </div>
                    </div>
                )}
            </Modal>
        </PageShell>
    );
}
