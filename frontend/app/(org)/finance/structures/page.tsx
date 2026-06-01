'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Plus, ReceiptText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { FinancialStructure, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResourcePanel, ResourceToolbar } from '@/components/ui/PageShell';
import { useGlobal } from '@/context/GlobalContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { BillingCycleBadge } from '@/components/finance/BillingCycleBadge';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { StructureModal } from './StructureModal';

export default function StructuresPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FinancialStructure | null>(null);

    const page = getNumberParam('page', 1);
    const sortBy = getStringParam('sortBy', 'title');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-structures-limit', 10);

    const { data: structures, error, mutate, isLoading } = useSWR(
        token ? ['finance/structures', token] : null,
        ([, t]) => api.finance.getStructures(t as string)
    );

    const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const openStructureModal = (structure: FinancialStructure | null) => {
        setEditingStructure(structure);
        setIsModalOpen(true);
    };

    const handleSave = async (data: Partial<FinancialStructure>) => {
        if (!token) return;
        try {
            if (editingStructure) {
                await api.finance.updateStructure(editingStructure.id, data, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Structure updated successfully', type: 'success' } });
            } else {
                await api.finance.createStructure(data, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Structure created successfully', type: 'success' } });
            }
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            throw error;
        }
    };

    const columns = useMemo<Column<FinancialStructure>[]>(() => [
        {
            header: 'Structure',
            sortable: true,
            sortKey: 'title',
            accessor: (structure) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <ReceiptText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{structure.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {structure.studentId ? 'Student agreement' : 'Teacher agreement'}
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
            accessor: (structure) => <Badge variant="neutral" size="sm">{structure.category}</Badge>,
        },
        {
            header: 'Amount',
            sortable: true,
            sortKey: 'amount',
            accessor: (structure) => <FinancialAmount amount={structure.amount} currency={structure.currency} />,
        },
        {
            header: 'Billing Cycle',
            sortable: true,
            sortKey: 'billingCycle',
            badge: true,
            accessor: (structure) => <BillingCycleBadge cycle={structure.billingCycle} />,
        },
        {
            header: 'Dates',
            accessor: (structure) => (
                <div className="text-xs font-semibold text-muted-foreground">
                    <span>{new Date(structure.startDate).toLocaleDateString()}</span>
                    <span> - </span>
                    <span>{structure.endDate ? new Date(structure.endDate).toLocaleDateString() : 'Open'}</span>
                </div>
            ),
        },
        {
            header: 'Status',
            badge: true,
            accessor: (structure) => (
                <Badge variant={structure.isActive ? 'success' : 'neutral'} size="sm" dot>
                    {structure.isActive ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
    ], []);

    const sortedData = useMemo(() => {
        if (!structures) return [];
        const result = [...structures];
        result.sort((a, b) => {
            const valA = a[sortBy as keyof FinancialStructure];
            const valB = b[sortBy as keyof FinancialStructure];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [structures, sortBy, sortOrder]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [page, pageSize, sortedData]);

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Financial structures could not load"
                description="Recurring agreements are unavailable right now."
            />
        );
    }

    return (
        <ResourcePanel>
            <ResourceToolbar
                actions={isManagement && (
                    <Button
                        onClick={() => openStructureModal(null)}
                        icon={Plus}
                        className="shrink-0"
                    >
                        Create Structure
                    </Button>
                )}
            />

            <div className="relative min-h-0 flex-1 overflow-x-hidden">
                <DataTable
                    data={paginatedData}
                    columns={columns}
                    keyExtractor={(structure) => structure.id}
                    isLoading={isLoading}
                    showSerialNumber
                    onRowClick={isManagement ? openStructureModal : undefined}
                    currentPage={page}
                    totalPages={Math.ceil((structures?.length || 0) / pageSize) || 1}
                    totalResults={structures?.length || 0}
                    pageSize={pageSize}
                    onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                    onPageSizeChange={handlePageSizeChange}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                    maxHeight="100%"
                    emptyTitle="No financial structures found"
                    emptyDescription={isManagement ? 'Create a structure to start generating fees, salaries, or billing agreements.' : 'No billing structures are assigned yet.'}
                    mobileDetailLimit={3}
                />
            </div>

            {isModalOpen && (
                <StructureModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    initialData={editingStructure}
                    onSave={handleSave}
                />
            )}
        </ResourcePanel>
    );
}
