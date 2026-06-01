'use client';

import React, { useMemo } from 'react';
import useSWR from 'swr';
import { FileText, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Transaction, TransactionType } from '@/types';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResourcePanel } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { Badge } from '@/components/ui/Badge';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

export default function TransactionsPage() {
    const { token } = useAuth();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const page = getNumberParam('page', 1);
    const sortBy = getStringParam('sortBy', 'createdAt');
    const sortOrder = (getStringParam('sortOrder', 'desc') as 'asc' | 'desc');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-transactions-limit', 10);

    const { data: transactions, error, isLoading, mutate } = useSWR<Transaction[]>(
        token ? ['finance/transactions', token] : null,
        ([, t]) => api.finance.getTransactions(t as string)
    );

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const columns = useMemo<Column<Transaction>[]>(() => [
        {
            header: 'Date',
            sortable: true,
            sortKey: 'createdAt',
            accessor: (transaction) => (
                <div className="font-semibold text-foreground/85">
                    {new Date(transaction.createdAt).toLocaleString()}
                </div>
            ),
        },
        {
            header: 'Description',
            accessor: (transaction) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{transaction.description || 'System generated'}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {transaction.relatedEntryId ? 'Linked entry' : 'Ledger entry'}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Category',
            sortable: true,
            sortKey: 'category',
            badge: true,
            accessor: (transaction) => <Badge variant="neutral" size="sm">{transaction.category}</Badge>,
        },
        {
            header: 'Type',
            sortable: true,
            sortKey: 'type',
            badge: true,
            accessor: (transaction) => (
                <Badge variant={transaction.type === TransactionType.INCOME ? 'success' : 'error'} size="sm" dot>
                    {transaction.type === TransactionType.INCOME ? 'Income' : 'Expense'}
                </Badge>
            ),
        },
        {
            header: 'Amount',
            sortable: true,
            sortKey: 'amount',
            accessor: (transaction) => (
                <FinancialAmount
                    amount={transaction.amount}
                    currency={transaction.currency}
                    className={transaction.type === TransactionType.INCOME ? 'text-success' : 'text-danger'}
                />
            ),
        },
        {
            header: 'Method',
            accessor: (transaction) => (
                <span className="text-xs font-semibold text-muted-foreground">
                    {transaction.paymentMethod || 'System'}
                </span>
            ),
        },
    ], []);

    const sortedData = useMemo(() => {
        if (!transactions) return [];
        const result = [...transactions];
        result.sort((a, b) => {
            const valA = a[sortBy as keyof Transaction];
            const valB = b[sortBy as keyof Transaction];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [sortBy, sortOrder, transactions]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [page, pageSize, sortedData]);

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Transactions could not load"
                description="The append-only ledger is unavailable right now."
            />
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <StatusBanner
                title="Append-only audit trail"
                description="Confirmed records in this table cannot be edited or deleted."
                variant="info"
                icon={LockKeyhole}
            />

            <ResourcePanel>
                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    <DataTable
                        data={paginatedData}
                        columns={columns}
                        keyExtractor={(transaction) => transaction.id}
                        isLoading={isLoading}
                        showSerialNumber
                        currentPage={page}
                        totalPages={Math.ceil((transactions?.length || 0) / pageSize) || 1}
                        totalResults={transactions?.length || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={handlePageSizeChange}
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        maxHeight="100%"
                        emptyTitle="No transactions recorded"
                        emptyDescription="Confirmed payments and expenses will appear in this immutable ledger."
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>
        </div>
    );
}
