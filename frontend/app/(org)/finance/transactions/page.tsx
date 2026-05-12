'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Transaction, TransactionType } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { Badge } from '@/components/ui/Badge';

export default function TransactionsPage() {
    const { token } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // URL State
    const page = parseInt(searchParams.get('page') || '1', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const [pageSize, setPageSize] = useState(10);

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

    const { data: transactions, error, isLoading } = useSWR<Transaction[]>(
        token ? ['finance/transactions', token] : null,
        ([, t]) => api.finance.getTransactions(t as string)
    );

    const sortedData = React.useMemo(() => {
        if (!transactions) return [];
        let result = [...transactions];
        result.sort((a: Transaction, b: Transaction) => {
            const valA = a[sortBy as keyof Transaction];
            const valB = b[sortBy as keyof Transaction];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [transactions, sortBy, sortOrder]);

    const paginatedData = React.useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, page, pageSize]);

    const columns = [
        {
            header: 'Date',
            sortable: true,
            sortKey: 'date',
            accessor: (t: Transaction) => (
                <div className="font-medium">{new Date(t.createdAt).toLocaleString()}</div>
            )
        },
        {
            header: 'Description',
            accessor: (t: Transaction) => <div className="font-bold">{t.description || 'System generated'}</div>
        },
        {
            header: 'Category',
            accessor: (t: Transaction) => <span className="text-xs uppercase opacity-70 font-bold">{t.category}</span>
        },
        {
            header: 'Type',
            accessor: (t: Transaction) => (
                <Badge variant={t.type === TransactionType.INCOME ? 'success' : 'error'}>
                    {t.type}
                </Badge>
            )
        },
        {
            header: 'Amount',
            accessor: (t: Transaction) => (
                <FinancialAmount
                    amount={t.amount}
                    currency={t.currency}
                    className={t.type === TransactionType.INCOME ? 'text-success' : 'text-danger'}
                />
            )
        },
        {
            header: 'Method',
            accessor: (t: Transaction) => <span className="text-xs font-semibold">{t.paymentMethod || 'SYSTEM'}</span>
        }
    ];

    if (error) return <div className="text-danger p-6 font-bold">Failed to load transactions.</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
                <h2 className="text-xl font-black">Transaction Audit Trail</h2>
                <p className="text-sm text-muted-foreground mt-1">Immutable ledger of all confirmed payments and expenses.</p>

                <div className="mt-4 p-3 bg-info/10 text-info rounded-lg text-xs font-semibold border border-info/20">
                    🔒 Records in this table are append-only and cannot be modified or deleted.
                </div>
            </div>

            <div className="relative overflow-x-hidden">
                <DataTable
                    data={paginatedData}
                    columns={columns}
                    keyExtractor={(t) => t.id}
                    isLoading={isLoading}
                    showSerialNumber
                    currentPage={page}
                    totalPages={Math.ceil((transactions?.length || 0) / pageSize) || 1}
                    totalResults={transactions?.length || 0}
                    pageSize={pageSize}
                    onPageChange={(p) => updateQueryParams({ page: p })}
                    onPageSizeChange={handlePageSizeChange}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, dir) => updateQueryParams({ sortBy: key, sortOrder: dir })}
                />
            </div>
        </div>
    );
}
