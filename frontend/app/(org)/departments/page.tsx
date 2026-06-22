'use client';

import { FormEvent, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { BookOpen, FileUp, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { formatBuildingLabel, formatDepartmentLabel } from '@/lib/utils';
import { ColorSelector } from '@/components/ui/ColorSelector';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { ApiError, Department, PaginatedResponse, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { Textarea } from '@/components/ui/Textarea';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { CsvImportModal } from '@/components/imports/CsvImportModal';

const emptyForm = { name: '', code: '', description: '', color: '#3B82F6', isActive: true };

export default function DepartmentsPage() {
    const { token, user } = useAuth();
    const { dispatch, state } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-departments-limit', 10);
    const [modalOpen, setModalOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [activeTarget, setActiveTarget] = useState<Department | null>(null);

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = getStringParam('sortOrder', 'asc') as 'asc' | 'desc';
    const status = getStringParam('status');
    const canCreateDepartments = user?.role === Role.ORG_ADMIN;
    const canEditDepartments = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const canChangeDepartmentStatus = user?.role === Role.ORG_ADMIN;
    const isProcessing = state.ui.processing['department-form'];

    const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
    };
    const { data, isLoading, error, mutate: mutateDepartments } = useSWR<PaginatedResponse<Department>>(
        token ? ['departments', params] as const : null,
    );

    const openCreate = () => {
        setEditingDepartment(null);
        setFormData(emptyForm);
        setModalOpen(true);
    };

    const openEdit = (department: Department) => {
        setEditingDepartment(department);
        setFormData({
            name: department.name,
            code: department.code || '',
            description: department.description || '',
            color: department.color || '#3B82F6',
            isActive: department.isActive,
        });
        setModalOpen(true);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'department-form' });
        try {
            const payload = {
                name: formData.name,
                code: formData.code,
                description: formData.description || null,
                color: formData.color || null,
            };
            if (editingDepartment) {
                await api.org.updateDepartment(editingDepartment.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Department updated', type: 'success' } });
            } else {
                await api.org.createDepartment(payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Department created', type: 'success' } });
            }
            setModalOpen(false);
            mutate(matchesCacheKeyPrefix('departments'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to save department', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'department-form' });
        }
    };

    const confirmActiveChange = async () => {
        if (!token || !activeTarget) return;
        try {
            await api.org.setDepartmentActive(activeTarget.id, !activeTarget.isActive, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: activeTarget.isActive ? 'Department deactivated' : 'Department activated', type: 'success' } });
            setActiveTarget(null);
            mutate(matchesCacheKeyPrefix('departments'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to update department status', type: 'error' } });
        }
    };

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{ key: 'search', label: 'Search', value: searchTerm, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(status ? [{ key: 'status', label: 'Status', value: status === 'active' ? 'Active' : 'Inactive', onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
    ];

    const columns = useMemo<Column<Department>[]>(() => [
        {
            header: 'Department',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: row.color || '#3B82F6' }} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{formatDepartmentLabel(row)}</p>
                        {row.description && <p className="truncate text-xs text-muted-foreground">{row.description}</p>}
                    </div>
                </div>
            ),
        },
        {
            header: 'Buildings',
            accessor: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.buildings?.length ? row.buildings.map((building) => (
                        <Badge key={building.id} variant="neutral" size="sm">{formatBuildingLabel(building)}</Badge>
                    )) : <span className="text-sm italic text-muted-foreground/60">Not linked</span>}
                </div>
            ),
        },
        {
            header: 'Status',
            badge: true,
            accessor: (row) => <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Active' : 'Inactive'}</Badge>,
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (row) => (
                <TableActions
                    onEdit={canEditDepartments ? () => openEdit(row) : undefined}
                    editTitle="Edit Department"
                    extraActions={canChangeDepartmentStatus ? [{
                        variant: row.isActive ? 'suspend' : 'restore',
                        title: row.isActive ? 'Deactivate' : 'Activate',
                        onClick: () => setActiveTarget(row),
                    }] : []}
                />
            ),
        },
    ], [canChangeDepartmentStatus, canEditDepartments]);

    if (error) return <ErrorState error={error} onRetry={() => mutateDepartments()} />;

    return (
        <PageShell>
            <PageHeader
                title="Departments"
                description="Create organization-defined academic and administrative groups for reporting, filtering, and future scoped access."
                icon={BookOpen}
                breadcrumbs={[{ label: 'Organization' }, { label: 'Setup' }, { label: 'Departments' }]}
                actions={(
                    <PageControls
                    activeFilters={activeFilters}
                    leading={<SearchBar value={searchTerm} onChange={(value) => updateQueryParams({ search: value, page: 1 })} placeholder="Search departments..." mobileMode="expandable" />}
                    actions={canCreateDepartments ? (
                        <>
                            <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>Import CSV</Button>
                            <Button icon={Plus} onClick={openCreate}>New Department</Button>
                        </>
                    ) : undefined}
                    renderFilters={() => (
                        <FilterDrawerGrid>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                                <CustomSelect
                                    options={[{ label: 'All Departments', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
                                    value={status}
                                    onChange={(value) => updateQueryParams({ status: value, page: 1 })}
                                    placeholder="All Departments"
                                />
                            </div>
                        </FilterDrawerGrid>
                    )}
                    />
                )}
            />
            <ResourcePanel>
                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    <DataTable
                        data={data?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isLoading}
                        currentPage={page}
                        totalPages={data?.totalPages || 1}
                        totalResults={data?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={(nextSize) => { setPageSize(nextSize); updateQueryParams({ page: 1 }); }}
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        maxHeight="100%"
                        emptyTitle="No departments found"
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingDepartment ? 'Edit Department' : 'Create Department'}
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="department-form"
                submitText={editingDepartment ? 'Save Changes' : 'Create Department'}
            >
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="department-name">Name *</Label>
                        <Input id="department-name" required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Computer Science" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-code">Code *</Label>
                        <Input id="department-code" required value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="CS" />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-sm font-bold">Department Color</Label>
                        <ColorSelector
                            value={formData.color}
                            onChange={(color) => setFormData({ ...formData, color })}
                            ariaLabelPrefix="department color"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="department-description">Description</Label>
                        <Textarea id="department-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Optional notes for this department" />
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={!!activeTarget}
                onClose={() => setActiveTarget(null)}
                onConfirm={confirmActiveChange}
                title={`${activeTarget?.isActive ? 'Deactivate' : 'Activate'} Department`}
                description={`This will ${activeTarget?.isActive ? 'hide this department from active setup filters' : 'make this department available again'}.`}
                confirmText={activeTarget?.isActive ? 'Deactivate' : 'Activate'}
                isDestructive={activeTarget?.isActive}
            />
            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="departments"
                title="Departments"
                cachePrefix="departments"
            />
        </PageShell>
    );
}


