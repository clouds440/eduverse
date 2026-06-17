'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { AcademicCycle, ApiError, GpaPolicy, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, Column } from '@/components/ui/DataTable';
import { DocsLink } from '@/components/ui/DocsLink';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { PageControls } from '@/components/ui/FilterDrawerToolbar';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TableActions } from '@/components/ui/TableActions';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

export default function AcademicCyclesPage() {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const router = useRouter();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const isProcessing = state.ui.processing['cycle-edit'];

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'startDate');
    const sortOrder = (getStringParam('sortOrder', 'desc') as 'asc' | 'desc');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-cycles-limit', 10);

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

    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingCycle, setEditingCycle] = useState<AcademicCycle | null>(null);
    const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', gpaPolicyId: '' });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCycle, setDeletingCycle] = useState<AcademicCycle | null>(null);
    const [activateDialogOpen, setActivateDialogOpen] = useState(false);
    const [activatingCycle, setActivatingCycle] = useState<AcademicCycle | null>(null);

    const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const { data: gpaPolicies = [] } = useSWR<GpaPolicy[]>(
        token && isAdmin ? ['gpaPolicies', 'cycle-edit', token] : null,
        () => api.org.getGpaPolicies(token!),
    );

    useEffect(() => {
        if (user?.role === Role.STUDENT) {
            router.replace(`/students/${user.id}`);
        }
    }, [router, user]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const openEditModal = (cycle: AcademicCycle) => {
        setIsEditing(true);
        setEditingCycle(cycle);
        setFormData({
            name: cycle.name,
            startDate: cycle.startDate ? new Date(cycle.startDate).toISOString().split('T')[0] : '',
            endDate: cycle.endDate ? new Date(cycle.endDate).toISOString().split('T')[0] : '',
            gpaPolicyId: cycle.gpaPolicyId || '',
        });
        setModalOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'cycle-edit' });
        try {
            const payload = {
                name: formData.name,
                startDate: formData.startDate,
                endDate: formData.endDate,
                ...(!editingCycle?.hasFinalizedGrades && formData.gpaPolicyId && formData.gpaPolicyId !== editingCycle?.gpaPolicyId
                    ? { gpaPolicyId: formData.gpaPolicyId }
                    : {}),
            };
            if (isEditing && editingCycle) {
                await api.academicCycles.updateCycle(editingCycle.id, payload, token);
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

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{
            key: 'search',
            label: 'Search',
            value: searchTerm,
            onRemove: () => updateQueryParams({ search: undefined, page: 1 }),
        }] : []),
    ];

    const columns = useMemo<Column<AcademicCycle>[]>(() => [
        {
            header: 'Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-black text-foreground">{row.name}</p>
                            {row.isActive && <Badge variant="primary" size="sm">Active</Badge>}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            header: 'Start Date',
            sortable: true,
            sortKey: 'startDate',
            accessor: (row) => new Date(row.startDate).toLocaleDateString(),
        },
        {
            header: 'End Date',
            sortable: true,
            sortKey: 'endDate',
            accessor: (row) => new Date(row.endDate).toLocaleDateString(),
        },
        {
            header: 'Cohorts',
            accessor: (row) => (
                <span className="inline-flex min-w-12 items-center justify-center rounded-md bg-muted px-2 py-1 text-xs font-black text-foreground">
                    {row._count?.cohorts || 0}
                </span>
            ),
        },
        {
            header: 'Sections',
            accessor: (row) => (
                <span className="inline-flex min-w-12 items-center justify-center rounded-md bg-muted px-2 py-1 text-xs font-black text-foreground">
                    {row._count?.sections || 0}
                </span>
            ),
        },
        {
            header: 'Actions',
            width: 250,
            accessor: (row) => (
                <div className="flex items-center gap-2">
                    {isAdmin && !row.isActive && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={(event) => {
                                event.stopPropagation();
                                setActivatingCycle(row);
                                setActivateDialogOpen(true);
                            }}
                        >
                            Activate
                        </Button>
                    )}
                    <TableActions
                        onEdit={isAdmin ? () => openEditModal(row) : undefined}
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
            ),
        },
    ], [isAdmin]);

    if (cyclesError) {
        return <ErrorState error={cyclesError} onRetry={() => mutateCycles()} />;
    }

    return (
        <PageShell>
            <PageHeader
                title="Academic Cycles"
                description={<>Manage academic terms and enrollment periods. <DocsLink href="/docs/academic-cycles#cycle-purpose">Read cycle docs</DocsLink></>}
                icon={Calendar}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Academic Cycles' },
                ]}
                actions={(
                    <PageControls
                        activeFilters={activeFilters}
                        showDrawer={false}
                        leading={(
                            <SearchBar
                                value={searchTerm}
                                onChange={(value) => updateQueryParams({ search: value, page: 1 })}
                                placeholder="Search academic cycles..."
                                mobileMode="expandable"
                            />
                        )}
                        actions={isAdmin ? (
                            <Button
                                onClick={() => router.push('/academic-cycles/create')}
                                icon={Plus}
                                className="shrink-0"
                            >
                                New Cycle
                            </Button>
                        ) : undefined}
                        renderFilters={() => null}
                    />
                )}
            />
            <ResourcePanel>
                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle="No academic cycles found"
                        emptyDescription={searchTerm ? 'Adjust the search to broaden the result set.' : 'Create an academic cycle to organize cohorts and sections.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>

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
                            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                            placeholder="e.g. Fall 2026"
                            icon={Calendar}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date *</Label>
                            <Input
                                id="startDate"
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date *</Label>
                            <Input
                                id="endDate"
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-3 rounded-lg border border-warning/35 bg-warning/10 p-3">
                        <StatusBanner
                            variant="warning"
                            title="GPA policy can lock"
                            description={<>After finalized grades exist, this cycle&apos;s GPA policy cannot be changed. <DocsLink href="/docs/gpa-policies#policy-locking">Learn why</DocsLink></>}
                            className="shadow-none"
                        />
                        <div className="space-y-2">
                            <Label>GPA Policy</Label>
                            <CustomSelect
                                value={formData.gpaPolicyId}
                                onChange={(value) => setFormData({ ...formData, gpaPolicyId: value })}
                                options={gpaPolicies.map((policy) => ({
                                    value: policy.id,
                                    label: `${policy.name}${policy.isDefault ? ' (Default)' : ''}`,
                                }))}
                                placeholder="Select GPA policy"
                                disabled={Boolean(editingCycle?.hasFinalizedGrades)}
                                required
                            />
                            {editingCycle?.hasFinalizedGrades && (
                                <p className="text-xs font-bold text-warning">
                                    GPA policy is locked for this cycle. <DocsLink href="/docs/gpa-policies#policy-locking">Details</DocsLink>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Delete Cycle <strong>{deletingCycle?.name}</strong></>}
                description="Are you sure you want to delete this cycle? This action cannot be undone and will affect associated cohorts."
                confirmText="Yes, Delete"
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={activateDialogOpen}
                onClose={() => setActivateDialogOpen(false)}
                onConfirm={handleActivateConfirm}
                title={<>Activate Cycle <strong>{activatingCycle?.name}</strong></>}
                description="Are you sure you want to mark this cycle as active? Doing so will deactivate the currently active cycle."
                confirmText="Yes, Activate"
            />
        </PageShell>
    );
}
