'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FinancialEntry, Role, EntryStatus, FinanceTab } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { useGlobal } from '@/context/GlobalContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { TableActions } from '@/components/ui/TableActions';
import { FinanceStatusBadge } from '@/components/finance/FinanceStatusBadge';
import { CheckCircle } from 'lucide-react';
import { ClaimPaidModal } from './ClaimPaidModal';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';

export default function EntriesPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // URL State
    const activeTab = (searchParams.get('tab') as FinanceTab) || FinanceTab.ALL;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const sortBy = searchParams.get('sortBy') || 'dueDate';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const [pageSize, setPageSize] = useState(10);

    const [claimingEntry, setClaimingEntry] = useState<FinancialEntry | null>(null);
    const [confirmingEntry, setConfirmingEntry] = useState<FinancialEntry | null>(null);

    const updateQueryParams = (updates: Record<string, string | number | undefined | boolean>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '' || value === false) {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const { data: entries, error, mutate, isLoading } = useSWR(
        token ? ['finance/entries', token] : null,
        ([, t]) => api.finance.getEntries(t as string)
    );

    const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

    const filteredEntries = useMemo(() => {
        if (!entries) return [];
        if (activeTab === FinanceTab.ALL) return entries;
        if (activeTab === FinanceTab.PENDING) return entries.filter(e => e.status === EntryStatus.PENDING || e.status === EntryStatus.PARTIAL);
        if (activeTab === FinanceTab.OVERDUE) return entries.filter(e => e.status === EntryStatus.OVERDUE);
        if (activeTab === FinanceTab.UNVERIFIED) return entries.filter(e => e.status === EntryStatus.UNVERIFIED);
        if (activeTab === FinanceTab.PAID) return entries.filter(e => e.status === EntryStatus.PAID);
        return entries;
    }, [entries, activeTab]);

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

    const columns = [
        {
            header: 'Title',
            sortable: true,
            sortKey: 'title',
            accessor: (e: FinancialEntry) => (
                <div>
                    <div className="font-bold">{e.title}</div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Due: {new Date(e.dueDate).toLocaleDateString()}</div>
                </div>
            )
        },
        {
            header: 'Amount',
            accessor: (e: FinancialEntry) => <FinancialAmount amount={e.amount} currency={e.currency} />
        },
        {
            header: 'Status',
            accessor: (e: FinancialEntry) => <FinanceStatusBadge status={e.status} />
        },
        {
            header: 'Actions',
            accessor: (e: FinancialEntry) => {
                if (e.status === EntryStatus.PAID) {
                    return <span className="text-xs text-success font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Fully Paid</span>;
                }

                return (
                    <TableActions
                        isViewAndEdit={false}
                        extraActions={[
                            ...(!isManagement && e.status !== EntryStatus.UNVERIFIED ? [{
                                variant: 'pay' as const,
                                title: 'Mark as Paid',
                                onClick: () => setClaimingEntry(e)
                            }] : []),
                            ...(isManagement ? [{
                                variant: 'confirm' as const,
                                title: 'Confirm Payment',
                                onClick: () => setConfirmingEntry(e)
                            }] : [])
                        ]}
                    />
                );
            }
        }
    ];

    const sortedAndFilteredEntries = useMemo(() => {
        const result = [...filteredEntries];
        result.sort((a: FinancialEntry, b: FinancialEntry) => {
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
    }, [sortedAndFilteredEntries, page, pageSize]);


    if (error) return <div className="text-danger p-6 font-bold">Failed to load entries.</div>;


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-card p-6 rounded-2xl shadow-sm border border-border gap-4">
                <div>
                    <h2 className="text-xl font-black">Financial Entries</h2>
                    <p className="text-sm text-muted-foreground">Manage invoices, salaries, and due payments.</p>
                </div>

                <div className="flex bg-muted p-1 rounded-lg">
                    {Object.values(FinanceTab).map(tab => (
                        <button
                            key={tab}
                            onClick={() => updateQueryParams({ tab, page: 1 })}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative overflow-x-hidden">
                <DataTable
                    data={paginatedEntries}
                    columns={columns}
                    keyExtractor={(e) => e.id}
                    onRowClick={(e) => isManagement && setConfirmingEntry(e)}
                    isLoading={isLoading}
                    showSerialNumber
                    currentPage={page}
                    totalPages={Math.ceil(filteredEntries.length / pageSize) || 1}
                    totalResults={filteredEntries.length}
                    pageSize={pageSize}
                    onPageChange={(p) => updateQueryParams({ page: p })}
                    onPageSizeChange={handlePageSizeChange}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, dir) => updateQueryParams({ sortBy: key, sortOrder: dir })}
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
        </div>
    );
}
