'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FinancialStructure, Role } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { useGlobal } from '@/context/GlobalContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { BillingCycleBadge } from '@/components/finance/BillingCycleBadge';
import { StructureModal } from './StructureModal';

export default function StructuresPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FinancialStructure | null>(null);

    // URL State
    const page = parseInt(searchParams.get('page') || '1', 10);
    const sortBy = searchParams.get('sortBy') || 'title';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
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

    const { data: structures, error, mutate, isLoading } = useSWR(
        token ? ['finance/structures', token] : null,
        ([, t]) => api.finance.getStructures(t as string)
    );

    const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

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
            throw error; // Let modal handle loading state termination if needed
        }
    };

    const columns = [
        {
            header: 'Title',
            sortable: true,
            sortKey: 'title',
            accessor: (s: FinancialStructure) => <span className="font-bold">{s.title}</span>
        },
        {
            header: 'Target',
            accessor: (s: FinancialStructure) => s.studentId ? 'Student' : 'Teacher'
        },
        {
            header: 'Category',
            accessor: (s: FinancialStructure) => <span className="text-xs uppercase opacity-70 font-bold">{s.category}</span>
        },
        {
            header: 'Amount',
            accessor: (s: FinancialStructure) => <FinancialAmount amount={s.amount} currency={s.currency} />
        },
        {
            header: 'Billing Cycle',
            accessor: (s: FinancialStructure) => <BillingCycleBadge cycle={s.billingCycle} />
        },
        {
            header: 'Status',
            accessor: (s: FinancialStructure) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${s.isActive ? 'bg-success/10 text-success' : 'bg-neutral/10 text-muted-foreground'}`}>
                    {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
            )
        }
    ];

    const sortedData = React.useMemo(() => {
        if (!structures) return [];
        let result = [...structures];
        result.sort((a: FinancialStructure, b: FinancialStructure) => {
            const valA = a[sortBy as keyof FinancialStructure];
            const valB = b[sortBy as keyof FinancialStructure];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [structures, sortBy, sortOrder]);

    const paginatedData = React.useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, page, pageSize]);


    if (error) return <div className="text-danger p-6 font-bold">Failed to load structures.</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-2xl shadow-sm border border-border">
                <div>
                    <h2 className="text-xl font-black">Financial Structures</h2>
                    <p className="text-sm text-muted-foreground">Manage recurring fees, salaries, and billing contracts.</p>
                </div>
                {isManagement && (
                    <Button
                        onClick={() => { setEditingStructure(null); setIsModalOpen(true); }}
                        className="gap-2"
                        icon={Plus}
                    >
                        Create Structure
                    </Button>
                )}
            </div>

            <div className="relative overflow-x-hidden">
                <DataTable
                    data={paginatedData}
                    columns={columns}
                    keyExtractor={(s) => s.id}
                    isLoading={isLoading}
                    showSerialNumber
                    onRowClick={isManagement ? ((s: FinancialStructure) => {
                        setEditingStructure(s);
                        setIsModalOpen(true);
                    }) : undefined}
                    currentPage={page}
                    totalPages={Math.ceil((structures?.length || 0) / pageSize) || 1}
                    totalResults={structures?.length || 0}
                    pageSize={pageSize}
                    onPageChange={(p) => updateQueryParams({ page: p })}
                    onPageSizeChange={handlePageSizeChange}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, dir) => updateQueryParams({ sortBy: key, sortOrder: dir })}
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
        </div>
    );
}
