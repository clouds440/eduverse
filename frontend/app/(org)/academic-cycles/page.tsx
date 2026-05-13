'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Calendar } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api';
import { ModalForm } from '@/components/ui/ModalForm';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AcademicCycle, Role, ApiError } from '@/types';
import { TableActions } from '@/components/ui/TableActions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useGlobal } from '@/context/GlobalContext';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { ErrorState } from '@/components/ui/ErrorState';

export default function AcademicCyclesPage() {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const isProcessing = state.ui.processing['cycle-edit'];

    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const page = parseInt(searchParams.get('page') || '1', 10);
    const searchTerm = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'startDate';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('edu-cycles-limit');
            return saved ? parseInt(saved, 10) : 10;
        }
        return 10;
    });

    const cycleParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
    };

    const cyclesKey = token ? ['academicCycles', cycleParams] as const : null;
    const { data: fetchedData, isLoading: isFetching, error: cyclesError, mutate: mutateCycles } = useSWR<
        { data: AcademicCycle[]; totalPages: number; totalRecords: number }
    >(cyclesKey);

    useEffect(() => {
        if (user && user.role === Role.STUDENT) {
            router.replace(`/students/${user.id}`);
        }
    }, [user, router, pathname]);

    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingCycle, setEditingCycle] = useState<AcademicCycle | null>(null);
    const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '' });

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCycle, setDeletingCycle] = useState<AcademicCycle | null>(null);

    const [activateDialogOpen, setActivateDialogOpen] = useState(false);
    const [activatingCycle, setActivatingCycle] = useState<AcademicCycle | null>(null);

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
        localStorage.setItem('edu-cycles-limit', String(newSize));
        updateQueryParams({ page: 1 });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'cycle-edit' });
        try {
            if (isEditing && editingCycle) {
                await api.academicCycles.updateCycle(editingCycle.id, formData, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Academic Cycle updated successfully', type: 'success' } });
            } else {
                await api.academicCycles.createCycle(formData, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Academic Cycle created successfully', type: 'success' } });
            }
            setModalOpen(false);
            mutate(matchesCacheKeyPrefix('academicCycles'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error processing request';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cycle-edit' });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingCycle || !token) return;
        try {
            await api.academicCycles.deleteCycle(deletingCycle.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Academic Cycle deleted successfully', type: 'success' } });
            setDeleteDialogOpen(false);
            mutate(matchesCacheKeyPrefix('academicCycles'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error deleting cycle';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        }
    };

    const handleActivateConfirm = async () => {
        if (!activatingCycle || !token) return;
        try {
            await api.academicCycles.activateCycle(activatingCycle.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Academic Cycle activated successfully', type: 'success' } });
            setActivateDialogOpen(false);
            mutate(matchesCacheKeyPrefix('academicCycles'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error activating cycle';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        }
    };

    const columns = [
        {
            header: 'Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row: AcademicCycle) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-card-foreground">{row.name}</span>
                    {row.isActive && (
                        <span className="bg-primary/20 text-primary text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                            Active
                        </span>
                    )}
                </div>
            )
        },
        {
            header: 'Start Date',
            sortable: true,
            sortKey: 'startDate',
            accessor: (row: AcademicCycle) => new Date(row.startDate).toLocaleDateString()
        },
        {
            header: 'End Date',
            sortable: true,
            sortKey: 'endDate',
            accessor: (row: AcademicCycle) => new Date(row.endDate).toLocaleDateString()
        },
        {
            header: 'Cohorts',
            accessor: (row: AcademicCycle) => row._count?.cohorts || 0
        },
        {
            header: 'Sections',
            accessor: (row: AcademicCycle) => row._count?.sections || 0
        },
        {
            header: 'Actions',
            width: 250,
            accessor: (row: AcademicCycle) => {
                const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

                return (
                    <div className="flex items-center gap-2">
                        {isAdmin && !row.isActive && (
                            <Button
                                variant="secondary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActivatingCycle(row);
                                    setActivateDialogOpen(true);
                                }}
                            >
                                Activate
                            </Button>
                        )}
                        <TableActions
                            onEdit={isAdmin ? () => {
                                setIsEditing(true);
                                setEditingCycle(row);
                                setFormData({
                                    name: row.name,
                                    startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
                                    endDate: row.endDate ? new Date(row.endDate).toISOString().split('T')[0] : ''
                                });
                                setModalOpen(true);
                            } : undefined}
                            onView={() => router.push(`/academic-cycles/${row.id}`)}
                            onDelete={isAdmin && !row.isActive ? () => {
                                setDeletingCycle(row);
                                setDeleteDialogOpen(true);
                            } : undefined}
                            editTitle="Edit Cycle"
                            deleteTitle="Delete Cycle"
                            variant="default"
                            isViewAndEdit={false}
                        />
                    </div>
                );
            }
        }
    ];


    if (cyclesError) {
        return <ErrorState error={cyclesError} onRetry={() => mutateCycles()} />;
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-1 md:p-2 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="mb-2 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex-1">
                        <SearchBar value={searchTerm} onChange={(val) => updateQueryParams({ search: val, page: 1 })} placeholder="Search academic cycles..." />
                    </div>

                    <div className="shrink-0">
                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
                            <Button
                                onClick={() => router.push('/academic-cycles/create')}
                                icon={Plus}
                                className="w-auto shadow-lg shadow-primary/10"
                            >
                                New Cycle
                            </Button>
                        )}
                    </div>
                </div>

                <div className="relative overflow-x-hidden flex-1 min-h-0">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={(row) => router.push(`/academic-cycles/${row.id}`)}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(p) => updateQueryParams({ page: p })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                    />
                </div>
            </div>

            <ModalForm
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Update Academic Cycle"
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="cycle-edit"
                submitText="Save Changes"
            >
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Cycle Name *</Label>
                        <Input
                            id="name"
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Fall 2026"
                            icon={Calendar}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date *</Label>
                            <Input
                                id="startDate"
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date *</Label>
                            <Input
                                id="endDate"
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Delete Cycle <strong>{deletingCycle?.name}</strong></>}
                description={<>Are you sure you want to delete this cycle? This action cannot be undone and will affect associated cohorts.</>}
                confirmText="Yes, Delete"
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={activateDialogOpen}
                onClose={() => setActivateDialogOpen(false)}
                onConfirm={handleActivateConfirm}
                title={<>Activate Cycle <strong>{activatingCycle?.name}</strong></>}
                description={<>Are you sure you want to mark this cycle as active? Doing so will deactivate the currently active cycle.</>}
                confirmText="Yes, Activate"
            />
        </div>
    );
}
