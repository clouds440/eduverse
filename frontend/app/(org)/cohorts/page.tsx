'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Users } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api';
import { ModalForm } from '@/components/ui/ModalForm';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Cohort, Role, ApiError, AcademicCycle, Student, Section } from '@/types';
import { TableActions } from '@/components/ui/TableActions';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { useGlobal } from '@/context/GlobalContext';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { ErrorState } from '@/components/ui/ErrorState';
import { Drawer } from '@/components/ui/Drawer';

export default function CohortsPage() {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const isProcessing = state.ui.processing['cohort-edit'];

    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const page = parseInt(searchParams.get('page') || '1', 10);
    const searchTerm = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const academicCycleId = searchParams.get('academicCycleId') || '';
    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('edu-cohorts-limit');
            return saved ? parseInt(saved, 10) : 10;
        }
        return 10;
    });

    const cohortParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        academicCycleId: academicCycleId || undefined,
    };

    const cohortsKey = token ? ['cohorts', cohortParams] as const : null;
    const { data: fetchedData, isLoading: isFetching, error: cohortsError, mutate: mutateCohorts } = useSWR<
        { data: Cohort[]; totalPages: number; totalRecords: number }
    >(cohortsKey);

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    useEffect(() => {
        if (user && user.role === Role.STUDENT) {
            router.replace(`/students/${user.id}`);
        }
    }, [user, router, pathname]);

    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
    const [formData, setFormData] = useState({ name: '', academicCycleId: '', studentIds: [] as string[], sectionIds: [] as string[] });

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCohort, setDeletingCohort] = useState<Cohort | null>(null);

    // Fetch students and sections for the modal
    const { data: studentsData } = useSWR<{ data: Student[] }>(token ? ['students', { limit: 1000 }] : null);
    const { data: sectionsData } = useSWR<{ data: Section[] }>(token ? ['sections', { limit: 1000 }] : null);

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
        localStorage.setItem('edu-cohorts-limit', String(newSize));
        updateQueryParams({ page: 1 });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'cohort-edit' });
        try {
            if (isEditing && editingCohort) {
                await api.cohorts.updateCohort(editingCohort.id, formData, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort updated successfully', type: 'success' } });
            } else {
                await api.cohorts.createCohort(formData, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort created successfully', type: 'success' } });
            }
            setModalOpen(false);
            mutate(matchesCacheKeyPrefix('cohorts'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error processing request';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cohort-edit' });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingCohort || !token) return;
        try {
            await api.cohorts.deleteCohort(deletingCohort.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort deleted successfully', type: 'success' } });
            setDeleteDialogOpen(false);
            mutate(matchesCacheKeyPrefix('cohorts'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error deleting cohort';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        }
    };

    const columns = [
        {
            header: 'Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row: Cohort) => <span className="font-semibold text-card-foreground">{row.name}</span>
        },
        {
            header: 'Academic Cycle',
            accessor: (row: Cohort) => row.academicCycle?.name || 'N/A'
        },
        {
            header: 'Students',
            accessor: (row: Cohort) => row._count?.students || 0
        },
        {
            header: 'Sections',
            accessor: (row: Cohort) => row._count?.sections || 0
        },
        {
            header: 'Actions',
            width: 210,
            accessor: (row: Cohort) => {
                const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;

                return (
                    <TableActions
                        onEdit={isAdmin ? () => {
                            setIsEditing(true);
                            setEditingCohort(row);
                            setFormData({
                                name: row.name,
                                academicCycleId: row.academicCycleId,
                                studentIds: row.students?.map(s => s.id) || [],
                                sectionIds: row.sections?.map(s => s.id) || []
                            });
                            setModalOpen(true);
                        } : undefined}
                        onView={() => router.push(`/cohorts/${row.id}`)}
                        onDelete={isAdmin ? () => {
                            setDeletingCohort(row);
                            setDeleteDialogOpen(true);
                        } : undefined}
                        editTitle="Edit Cohort"
                        deleteTitle="Delete Cohort"
                        variant="default"
                        isViewAndEdit={false}
                    />
                );
            }
        }
    ];


    if (cohortsError) {
        return <ErrorState error={cohortsError} onRetry={() => mutateCohorts()} />;
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-1 md:p-2 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="mb-2 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                        <div className="flex-1 min-w-48">
                            <SearchBar value={searchTerm} onChange={(val) => updateQueryParams({ search: val, page: 1 })} placeholder="Search cohorts..." />
                        </div>
                    </div>

                    <div className='flex w-full md:w-auto gap-2 justify-between'>
                        <Drawer position='left'>
                            <div className="flex flex-col gap-8">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground mb-1 block">
                                        Academic Cycle
                                    </label>
                                    <CustomSelect
                                        options={[
                                            { label: 'All Academic Cycles', value: '' },
                                            ...(cyclesData?.data?.map(cycle => ({ value: cycle.id, label: cycle.name })) || [])
                                        ]}
                                        value={academicCycleId}
                                        onChange={(val) => updateQueryParams({ academicCycleId: val, page: 1 })}
                                        placeholder="Filter Cycle"
                                    />
                                </div>
                            </div>
                        </Drawer>

                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
                            <Button
                                onClick={() => router.push('/cohorts/create')}
                                icon={Plus}
                                className="shrink-0"
                            >
                                New Cohort
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
                        onRowClick={(row) => router.push(`/cohorts/${row.id}`)}
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
                title="Update Cohort"
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="cohort-edit"
                submitText="Save Changes"
            >
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Cohort Name *</Label>
                        <Input
                            id="name"
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. CS Batch 2026"
                            icon={Users}
                        />
                    </div>
                    {!isEditing && (
                        <div className="space-y-2">
                            <Label>Academic Cycle *</Label>
                            <CustomSelect
                                options={cyclesData?.data?.map((cycle: AcademicCycle) => ({ value: cycle.id, label: cycle.name })) || []}
                                value={formData.academicCycleId}
                                onChange={(val) => setFormData({ ...formData, academicCycleId: val })}
                                placeholder="Select Academic Cycle"
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Assigned Students</Label>
                        <CustomMultiSelect
                            options={studentsData?.data?.map((s: Student) => ({
                                value: s.id,
                                label: `${s.user?.name} (${s.registrationNumber || 'N/A'})`
                            })) || []}
                            values={formData.studentIds}
                            onChange={(vals: string[]) => setFormData({ ...formData, studentIds: vals })}
                            placeholder="Add students to cohort..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Assigned Sections</Label>
                        <CustomMultiSelect
                            options={sectionsData?.data?.filter((s: Section) => !formData.academicCycleId || s.academicCycleId === formData.academicCycleId).map((s: Section) => ({
                                value: s.id,
                                label: `${s.name} (${s.course?.name || 'No Course'})`
                            })) || []}
                            values={formData.sectionIds}
                            onChange={(vals: string[]) => setFormData({ ...formData, sectionIds: vals })}
                            placeholder="Add sections to cohort..."
                        />
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Delete Cohort <strong>{deletingCohort?.name}</strong></>}
                description={<>Are you sure you want to delete this cohort? This action cannot be undone.</>}
                confirmText="Yes, Delete"
                isDestructive={true}
            />
        </div>
    );
}
