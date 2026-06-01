'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { FinancialEntry, Role, EntryStatus, FinanceTab } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResourcePanel, ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { useGlobal } from '@/context/GlobalContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { TableActions } from '@/components/ui/TableActions';
import { FinanceStatusBadge } from '@/components/finance/FinanceStatusBadge';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { ClaimPaidModal } from './ClaimPaidModal';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';

const tabLabels: Record<FinanceTab, string> = {
    [FinanceTab.ALL]: 'All',
    [FinanceTab.PENDING]: 'Pending',
    [FinanceTab.OVERDUE]: 'Overdue',
    [FinanceTab.UNVERIFIED]: 'Unverified',
    [FinanceTab.PAID]: 'Paid',
};

export default function EntriesPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const activeTab = (getStringParam('tab', FinanceTab.ALL) as FinanceTab);
    const page = getNumberParam('page', 1);
    const sortBy = getStringParam('sortBy', 'dueDate');
    const sortOrder = (getStringParam('sortOrder', 'desc') as 'asc' | 'desc');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-entries-limit', 10);

    const [claimingEntry, setClaimingEntry] = useState<FinancialEntry | null>(null);
    const [confirmingEntry, setConfirmingEntry] = useState<FinancialEntry | null>(null);

    const { data: entries, error, mutate, isLoading } = useSWR(
        token ? ['finance/entries', token] : null,
        ([, t]) => api.finance.getEntries(t as string)
    );

    const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const filteredEntries = useMemo(() => {
        if (!entries) return [];
        if (activeTab === FinanceTab.ALL) return entries;
        if (activeTab === FinanceTab.PENDING) return entries.filter(entry => entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL);
        if (activeTab === FinanceTab.OVERDUE) return entries.filter(entry => entry.status === EntryStatus.OVERDUE);
        if (activeTab === FinanceTab.UNVERIFIED) return entries.filter(entry => entry.status === EntryStatus.UNVERIFIED);
        if (activeTab === FinanceTab.PAID) return entries.filter(entry => entry.status === EntryStatus.PAID);
        return entries;
    }, [activeTab, entries]);

    const tabCounts = useMemo(() => {
        const source = entries || [];
        return {
            [FinanceTab.ALL]: source.length,
            [FinanceTab.PENDING]: source.filter(entry => entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL).length,
            [FinanceTab.OVERDUE]: source.filter(entry => entry.status === EntryStatus.OVERDUE).length,
            [FinanceTab.UNVERIFIED]: source.filter(entry => entry.status === EntryStatus.UNVERIFIED).length,
            [FinanceTab.PAID]: source.filter(entry => entry.status === EntryStatus.PAID).length,
        };
    }, [entries]);

    const handleClaim = async (data: { paymentMethod?: string; receiptUrl?: string }) => {
        if (!token || !claimingEntry) return;
        try {
            await api.finance.markEntryPaid(claimingEntry.id, data, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Payment claim submitted', type: 'success' } });
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to submit claim';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            throw error;
        }
    };

    const handleConfirm = async (data: { paidAmount?: number }) => {
        if (!token || !confirmingEntry) return;
        try {
            await api.finance.confirmEntry(confirmingEntry.id, data, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Payment confirmed securely', type: 'success' } });
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to confirm payment';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            throw error;
        }
    };

    const columns = useMemo<Column<FinancialEntry>[]>(() => [
        {
            header: 'Entry',
            sortable: true,
            sortKey: 'title',
            accessor: (entry) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <Receipt className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{entry.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            Due {new Date(entry.dueDate).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Amount',
            sortable: true,
            sortKey: 'amount',
            accessor: (entry) => <FinancialAmount amount={entry.amount} currency={entry.currency} />,
        },
        {
            header: 'Paid',
            sortable: true,
            sortKey: 'paidAmount',
            accessor: (entry) => <FinancialAmount amount={entry.paidAmount} currency={entry.currency} className="text-muted-foreground" />,
        },
        {
            header: 'Status',
            badge: true,
            accessor: (entry) => <FinanceStatusBadge status={entry.status} />,
        },
        {
            header: 'Source',
            badge: true,
            accessor: (entry) => <Badge variant="neutral" size="sm">{entry.source}</Badge>,
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (entry) => {
                if (entry.status === EntryStatus.PAID) {
                    return (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Fully paid
                        </span>
                    );
                }

                return (
                    <TableActions
                        isViewAndEdit={false}
                        extraActions={[
                            ...(!isManagement && entry.status !== EntryStatus.UNVERIFIED ? [{
                                variant: 'pay' as const,
                                title: 'Mark as Paid',
                                onClick: () => setClaimingEntry(entry),
                            }] : []),
                            ...(isManagement ? [{
                                variant: 'confirm' as const,
                                title: 'Confirm Payment',
                                onClick: () => setConfirmingEntry(entry),
                            }] : []),
                        ]}
                    />
                );
            },
        },
    ], [isManagement]);

    const sortedAndFilteredEntries = useMemo(() => {
        const result = [...filteredEntries];
        result.sort((a, b) => {
            const valA = a[sortBy as keyof FinancialEntry];
            const valB = b[sortBy as keyof FinancialEntry];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [filteredEntries, sortBy, sortOrder]);

    const paginatedEntries = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedAndFilteredEntries.slice(start, start + pageSize);
    }, [page, pageSize, sortedAndFilteredEntries]);

    const activeFilters: ActiveFilter[] = activeTab !== FinanceTab.ALL
        ? [{
            key: 'tab',
            label: 'Status',
            value: tabLabels[activeTab] || activeTab,
            onRemove: () => updateQueryParams({ tab: undefined, page: 1 }),
        }]
        : [];

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Financial entries could not load"
                description="Invoices, salary entries, and payment claims are unavailable right now."
            />
        );
    }

    return (
        <ResourcePanel>
            <ResourceToolbar
                filters={(
                    <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/45 p-1 scrollbar-none md:w-auto">
                        {Object.values(FinanceTab).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => updateQueryParams({ tab: tab === FinanceTab.ALL ? undefined : tab, page: 1 })}
                                className={`flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${activeTab === tab
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                                    }`}
                                aria-pressed={activeTab === tab}
                            >
                                <span>{tabLabels[tab]}</span>
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">
                                    {tabCounts[tab]}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                activeFilters={activeFilters}
            />

            <div className="relative min-h-0 flex-1 overflow-x-hidden">
                <DataTable
                    data={paginatedEntries}
                    columns={columns}
                    keyExtractor={(entry) => entry.id}
                    onRowClick={(entry) => isManagement && entry.status !== EntryStatus.PAID ? setConfirmingEntry(entry) : undefined}
                    isLoading={isLoading}
                    showSerialNumber
                    currentPage={page}
                    totalPages={Math.ceil(filteredEntries.length / pageSize) || 1}
                    totalResults={filteredEntries.length}
                    pageSize={pageSize}
                    onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                    onPageSizeChange={handlePageSizeChange}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                    maxHeight="100%"
                    emptyTitle="No financial entries found"
                    emptyDescription={activeTab !== FinanceTab.ALL ? 'Try another status tab to review additional entries.' : 'Entries will appear when structures generate billing or salary records.'}
                    mobileDetailLimit={3}
                />
            </div>

            {claimingEntry && (
                <ClaimPaidModal
                    isOpen={!!claimingEntry}
                    onClose={() => setClaimingEntry(null)}
                    entry={claimingEntry}
                    onSubmit={handleClaim}
                />
            )}

            {confirmingEntry && (
                <ConfirmPaymentModal
                    isOpen={!!confirmingEntry}
                    onClose={() => setConfirmingEntry(null)}
                    entry={confirmingEntry}
                    onConfirm={handleConfirm}
                />
            )}
        </ResourcePanel>
    );
}
