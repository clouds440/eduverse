'use client';

import React, { useMemo } from 'react';
import useSWR from 'swr';
import { FileText, LockKeyhole, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { BillingCycle, FinanceCategory, FinanceTargetType, Transaction, TransactionType } from '@/types';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { Badge } from '@/components/ui/Badge';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { BillingCycleBadge } from '@/components/finance/BillingCycleBadge';
import { FinanceFilterGrid, FinanceFilterToolbar } from '../_components/FinanceFilterToolbar';
import { FinanceAttachments } from '@/components/finance/FinanceAttachments';
import { compareMoney } from '@/lib/money';

function labelize(value: string) {
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTransactionTarget(transaction: Transaction) {
    const entry = transaction.relatedEntry;
    if (entry?.student?.user) return entry.student.user.name || entry.student.user.email;
    if (entry?.teacher?.user) return entry.teacher.user.name || entry.teacher.user.email;
    if (entry?.assignment?.student?.user) return entry.assignment.student.user.name || entry.assignment.student.user.email;
    if (entry?.assignment?.teacher?.user) return entry.assignment.teacher.user.name || entry.assignment.teacher.user.email;
    if (entry?.assignment?.entityName) return entry.assignment.entityName;
    return 'Ledger entity';
}

export default function TransactionsPage() {
    const { token } = useAuth();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const page = getNumberParam('page', 1);
    const sortBy = getStringParam('sortBy', 'createdAt');
    const sortOrder = (getStringParam('sortOrder', 'desc') as 'asc' | 'desc');
    const targetType = getStringParam('targetType', '');
    const category = getStringParam('category', '');
    const billingCycle = getStringParam('billingCycle', '');
    const type = getStringParam('type', '');
    const paymentMethod = getStringParam('paymentMethod', '');
    const search = getStringParam('search', '');
    const dateFrom = getStringParam('dateFrom', '');
    const dateTo = getStringParam('dateTo', '');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-transactions-limit', 10);

    const { data: transactionsRes, error, isLoading, mutate } = useSWR(
        token ? ['finance/transactions', token, page, pageSize, targetType, category, billingCycle, type, paymentMethod, search, dateFrom, dateTo] : null,
        ([, t]) => api.finance.getTransactionsPage(t as string, {
            page,
            limit: pageSize,
            targetType: targetType || undefined,
            category: category || undefined,
            billingCycle: billingCycle || undefined,
            type: type || undefined,
            paymentMethod: paymentMethod || undefined,
            search: search || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
        })
    );
    const transactions = transactionsRes?.data || [];

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
                            {getTransactionTarget(transaction)}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Target',
            accessor: (transaction) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{getTransactionTarget(transaction)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {transaction.relatedEntry?.title || 'Ledger entry'}
                    </p>
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
            header: 'Cycle',
            badge: true,
            accessor: (transaction) => transaction.relatedEntry?.structure?.billingCycle
                ? <BillingCycleBadge cycle={transaction.relatedEntry.structure.billingCycle} />
                : <Badge variant="neutral" size="sm">Manual</Badge>,
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
                    {transaction.paymentMethod || 'System'}{transaction.createdBy ? ` • ${transaction.createdBy.name || transaction.createdBy.email}` : ''}
                </span>
            ),
        },
        {
            header: 'Attachments',
            accessor: (transaction) => {
                const attachments = [
                    ...(transaction.attachments || []),
                    ...(transaction.relatedEntry?.claims?.flatMap((claim) => claim.attachments || []) || []),
                ];
                return attachments.length
                    ? <FinanceAttachments attachments={attachments} compact />
                    : <span className="text-xs font-semibold text-muted-foreground">None</span>;
            },
        },
    ], []);

    const sortedData = useMemo(() => {
        const result = [...transactions];
        result.sort((a, b) => {
            const valA = a[sortBy as keyof Transaction];
            const valB = b[sortBy as keyof Transaction];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (sortBy === 'amount') return sortOrder === 'asc' ? compareMoney(valA as string, valB as string) : compareMoney(valB as string, valA as string);
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [sortBy, sortOrder, transactions]);

    const paginatedData = useMemo(() => {
        return sortedData;
    }, [sortedData]);

    const activeFilters: ActiveFilter[] = [
        ...(targetType ? [{ key: 'targetType', label: 'Target', value: labelize(targetType), onRemove: () => updateQueryParams({ targetType: undefined, page: 1 }) }] : []),
        ...(category ? [{ key: 'category', label: 'Category', value: labelize(category), onRemove: () => updateQueryParams({ category: undefined, page: 1 }) }] : []),
        ...(billingCycle ? [{ key: 'billingCycle', label: 'Cycle', value: labelize(billingCycle), onRemove: () => updateQueryParams({ billingCycle: undefined, page: 1 }) }] : []),
        ...(type ? [{ key: 'type', label: 'Type', value: labelize(type), onRemove: () => updateQueryParams({ type: undefined, page: 1 }) }] : []),
        ...(paymentMethod ? [{ key: 'paymentMethod', label: 'Method', value: paymentMethod, onRemove: () => updateQueryParams({ paymentMethod: undefined, page: 1 }) }] : []),
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(dateFrom ? [{ key: 'dateFrom', label: 'From', value: dateFrom, onRemove: () => updateQueryParams({ dateFrom: undefined, page: 1 }) }] : []),
        ...(dateTo ? [{ key: 'dateTo', label: 'To', value: dateTo, onRemove: () => updateQueryParams({ dateTo: undefined, page: 1 }) }] : []),
    ];

    const renderFilters = (mode: 'desktop' | 'mobile') => (
        <FinanceFilterGrid mode={mode}>
            <Input icon={Search} value={search} onChange={(event) => updateQueryParams({ search: event.target.value || undefined, page: 1 })} placeholder="Search transaction" />
            <CustomSelect value={type} onChange={(value) => updateQueryParams({ type: value || undefined, page: 1 })} options={[{ value: '', label: 'All types' }, ...Object.values(TransactionType).map((value) => ({ value, label: labelize(value) }))]} />
            <CustomSelect value={targetType} onChange={(value) => updateQueryParams({ targetType: value || undefined, page: 1 })} options={[{ value: '', label: 'All targets' }, ...Object.values(FinanceTargetType).map((value) => ({ value, label: labelize(value) }))]} />
            <CustomSelect value={category} onChange={(value) => updateQueryParams({ category: value || undefined, page: 1 })} options={[{ value: '', label: 'All categories' }, ...Object.values(FinanceCategory).map((value) => ({ value, label: labelize(value) }))]} searchable />
            <CustomSelect value={billingCycle} onChange={(value) => updateQueryParams({ billingCycle: value || undefined, page: 1 })} options={[{ value: '', label: 'All cycles' }, ...Object.values(BillingCycle).map((value) => ({ value, label: labelize(value) }))]} />
            <Input value={paymentMethod} onChange={(event) => updateQueryParams({ paymentMethod: event.target.value || undefined, page: 1 })} placeholder="Payment method" />
            <div className="space-y-1">
                <span className="block text-xs font-black uppercase text-muted-foreground">Start date</span>
                <Input type="date" value={dateFrom} onChange={(event) => updateQueryParams({ dateFrom: event.target.value || undefined, page: 1 })} />
            </div>
            <div className="space-y-1">
                <span className="block text-xs font-black uppercase text-muted-foreground">End date</span>
                <Input type="date" value={dateTo} onChange={(event) => updateQueryParams({ dateTo: event.target.value || undefined, page: 1 })} />
            </div>
        </FinanceFilterGrid>
    );

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Transactions could not load"
                description="Ledger is unavailable right now."
            />
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <ResourcePanel>
                <FinanceFilterToolbar
                    drawerLabel="Transaction filters"
                    renderFilters={renderFilters}
                    activeFilters={activeFilters}
                />
                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    <DataTable
                        data={paginatedData}
                        columns={columns}
                        keyExtractor={(transaction) => transaction.id}
                        isLoading={isLoading}
                        showSerialNumber
                        currentPage={page}
                        totalPages={transactionsRes?.totalPages || 1}
                        totalResults={transactionsRes?.totalRecords || 0}
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
