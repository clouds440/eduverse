'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Filter, Plus, ReceiptText, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { BillingCycle, FinanceAssignmentSource, FinanceCategory, FinancialStructure, FinanceTargetType, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { useGlobal } from '@/context/GlobalContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { BillingCycleBadge } from '@/components/finance/BillingCycleBadge';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { StructureModal } from './StructureModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { FinanceFilterGrid, FinanceFilterToolbar } from '../_components/FinanceFilterToolbar';

function labelize(value: string) {
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAssignmentSummary(structure: FinancialStructure) {
    const count = structure._count?.assignments ?? structure.assignments?.length ?? 0;
    const sources = [...new Set((structure.assignments || []).map((assignment) => assignment.sourceType))];
    const sourceLabel = sources.length === 0 ? 'No assignments' : sources.map(labelize).join(', ');
    return `${count} ${count === 1 ? 'target' : 'targets'} • ${sourceLabel}`;
}

export default function StructuresPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FinancialStructure | null>(null);

    const page = getNumberParam('page', 1);
    const sortBy = getStringParam('sortBy', 'title');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const targetType = getStringParam('targetType', '');
    const category = getStringParam('category', '');
    const billingCycle = getStringParam('billingCycle', '');
    const assignmentSource = getStringParam('assignmentSource', '');
    const isActive = getStringParam('isActive', '');
    const search = getStringParam('search', '');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-structures-limit', 10);

    const { data: structures, error, mutate, isLoading } = useSWR(
        token ? ['finance/structures', token, targetType, category, billingCycle, assignmentSource, isActive, search] : null,
        ([, t]) => api.finance.getStructures(t as string, {
            targetType: targetType || undefined,
            category: category || undefined,
            billingCycle: billingCycle || undefined,
            assignmentSource: assignmentSource || undefined,
            isActive: isActive || undefined,
            search: search || undefined,
        })
    );

    const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.FINANCE_MANAGER;

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
                            {getAssignmentSummary(structure)}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Target',
            sortable: true,
            sortKey: 'targetType',
            badge: true,
            accessor: (structure) => <Badge variant="neutral" size="sm">{labelize(structure.targetType)}</Badge>,
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

    const activeFilters: ActiveFilter[] = [
        ...(targetType ? [{ key: 'targetType', label: 'Target', value: labelize(targetType), onRemove: () => updateQueryParams({ targetType: undefined, page: 1 }) }] : []),
        ...(category ? [{ key: 'category', label: 'Category', value: labelize(category), onRemove: () => updateQueryParams({ category: undefined, page: 1 }) }] : []),
        ...(billingCycle ? [{ key: 'billingCycle', label: 'Cycle', value: labelize(billingCycle), onRemove: () => updateQueryParams({ billingCycle: undefined, page: 1 }) }] : []),
        ...(assignmentSource ? [{ key: 'assignmentSource', label: 'Source', value: labelize(assignmentSource), onRemove: () => updateQueryParams({ assignmentSource: undefined, page: 1 }) }] : []),
        ...(isActive ? [{ key: 'isActive', label: 'Status', value: isActive === 'true' ? 'Active' : 'Inactive', onRemove: () => updateQueryParams({ isActive: undefined, page: 1 }) }] : []),
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
    ];

    const renderFilters = (mode: 'desktop' | 'mobile') => (
        <FinanceFilterGrid mode={mode}>
            <Input
                icon={Search}
                value={search}
                onChange={(event) => updateQueryParams({ search: event.target.value || undefined, page: 1 })}
                placeholder="Search structures"
            />
            <CustomSelect
                value={targetType}
                onChange={(value) => updateQueryParams({ targetType: value || undefined, page: 1 })}
                options={[
                    { value: '', label: 'All targets', icon: Filter },
                    ...Object.values(FinanceTargetType).map((value) => ({ value, label: labelize(value) })),
                ]}
            />
            <CustomSelect
                value={category}
                onChange={(value) => updateQueryParams({ category: value || undefined, page: 1 })}
                options={[
                    { value: '', label: 'All categories' },
                    ...Object.values(FinanceCategory).map((value) => ({ value, label: labelize(value) })),
                ]}
            />
            <CustomSelect
                value={billingCycle}
                onChange={(value) => updateQueryParams({ billingCycle: value || undefined, page: 1 })}
                options={[
                    { value: '', label: 'All cycles' },
                    ...Object.values(BillingCycle).map((value) => ({ value, label: labelize(value) })),
                ]}
            />
            <CustomSelect
                value={assignmentSource}
                onChange={(value) => updateQueryParams({ assignmentSource: value || undefined, page: 1 })}
                options={[
                    { value: '', label: 'All sources' },
                    ...Object.values(FinanceAssignmentSource).map((value) => ({ value, label: labelize(value) })),
                ]}
            />
            <CustomSelect
                value={isActive}
                onChange={(value) => updateQueryParams({ isActive: value || undefined, page: 1 })}
                options={[
                    { value: '', label: 'Any status' },
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                ]}
            />
        </FinanceFilterGrid>
    );

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
            <FinanceFilterToolbar
                drawerLabel="Structure filters"
                renderFilters={renderFilters}
                activeFilters={activeFilters}
                actions={isManagement && (
                    <Button
                        onClick={() => openStructureModal(null)}
                        icon={Plus}
                        className="min-h-10 w-full shrink-0 sm:w-auto"
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
