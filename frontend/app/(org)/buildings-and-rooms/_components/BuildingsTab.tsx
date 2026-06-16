'use client';

import { FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import { Building2, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { formatBuildingLabel, formatDepartmentLabel, getPublicUrl } from '@/lib/utils';
import { matchesAnyCacheKeyPrefix, matchesCacheKeyPrefix } from '@/lib/swr';
import { ApiError, Building, Department, PaginatedResponse, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, FilterDrawerToolbar } from '@/components/ui/FilterDrawerToolbar';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { Textarea } from '@/components/ui/Textarea';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

const emptyForm = { name: '', code: '', address: '', description: '', isActive: true, departmentIds: [] as string[] };

export default function BuildingsTab() {
    const { token, user } = useAuth();
    const { dispatch, state } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-buildings-limit', 10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [pendingImage, setPendingImage] = useState<File | null>(null);
    const [activeTarget, setActiveTarget] = useState<Building | null>(null);

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = getStringParam('sortOrder', 'asc') as 'asc' | 'desc';
    const status = getStringParam('status');
    const departmentId = getStringParam('departmentId');
    const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const isProcessing = state.ui.processing['building-form'];

    const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
        departmentId: departmentId || undefined,
    };
    const { data, isLoading, error, mutate: mutateBuildings } = useSWR<PaginatedResponse<Building>>(
        token ? ['buildings', params] as const : null,
    );
    const { data: departmentsData } = useSWR<PaginatedResponse<Department>>(
        token ? ['departments', { limit: 500, sortBy: 'name', sortOrder: 'asc' }] as const : null,
    );

    const departmentOptions = useMemo(() => (
        departmentsData?.data?.map((department) => ({
            value: department.id,
            label: formatDepartmentLabel(department),
        })) || []
    ), [departmentsData]);

    const openCreate = () => {
        setEditingBuilding(null);
        setFormData(emptyForm);
        setPendingImage(null);
        setModalOpen(true);
    };

    const openEdit = (building: Building) => {
        setEditingBuilding(building);
        setFormData({
            name: building.name,
            code: building.code || '',
            address: building.address || '',
            description: building.description || '',
            isActive: building.isActive,
            departmentIds: building.departments?.map((department) => department.id) || [],
        });
        setPendingImage(null);
        setModalOpen(true);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'building-form' });
        try {
            const payload = {
                name: formData.name,
                code: formData.code || null,
                address: formData.address || null,
                description: formData.description || null,
                isActive: formData.isActive,
                departmentIds: formData.departmentIds,
            };
            let savedBuilding: Building;
            if (editingBuilding) {
                savedBuilding = await api.org.updateBuilding(editingBuilding.id, payload, token);
                if (pendingImage) {
                    savedBuilding = await api.org.uploadBuildingImage(savedBuilding.id, pendingImage, token);
                }
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Building updated', type: 'success' } });
            } else {
                savedBuilding = await api.org.createBuilding(payload, token);
                if (pendingImage) {
                    savedBuilding = await api.org.uploadBuildingImage(savedBuilding.id, pendingImage, token);
                }
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Building created', type: 'success' } });
            }
            setModalOpen(false);
            setPendingImage(null);
            mutate(matchesAnyCacheKeyPrefix(['buildings', 'rooms']));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to save building', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'building-form' });
        }
    };

    const confirmActiveChange = async () => {
        if (!token || !activeTarget) return;
        try {
            await api.org.setBuildingActive(activeTarget.id, !activeTarget.isActive, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: activeTarget.isActive ? 'Building deactivated' : 'Building activated', type: 'success' } });
            setActiveTarget(null);
            mutate(matchesCacheKeyPrefix('buildings'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to update building status', type: 'error' } });
        }
    };

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{ key: 'search', label: 'Search', value: searchTerm, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(status ? [{ key: 'status', label: 'Status', value: status === 'active' ? 'Active' : 'Inactive', onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{
            key: 'departmentId',
            label: 'Department',
            value: departmentsData?.data?.find((department) => department.id === departmentId)?.name || 'Selected department',
            onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }),
        }] : []),
    ];

    const columns = useMemo<Column<Building>[]>(() => [
        {
            header: 'Building',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-primary/10 text-primary">
                        {row.imageUrl ? (
                            <Image src={getPublicUrl(row.imageUrl, row.imageUpdatedAt)} alt={row.name} fill className="object-cover" sizes="44px" />
                        ) : (
                            <Building2 className="h-5 w-5" aria-hidden="true" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{formatBuildingLabel(row)}</p>
                        {row.address && <p className="truncate text-xs text-muted-foreground">{row.address}</p>}
                    </div>
                </div>
            ),
        },
        {
            header: 'Departments',
            accessor: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.departments?.length ? row.departments.map((department) => (
                        <Badge key={department.id} variant="primary" size="sm" style={department.color ? { borderColor: `${department.color}55`, backgroundColor: `${department.color}18`, color: department.color } : undefined}>
                            {formatDepartmentLabel(department)}
                        </Badge>
                    )) : <span className="text-sm italic text-muted-foreground/60">Optional</span>}
                </div>
            ),
        },
        {
            header: 'Rooms',
            accessor: (row) => row._count?.rooms ?? row.rooms?.length ?? 0,
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
                    onEdit={isAdmin ? () => openEdit(row) : undefined}
                    editTitle="Edit Building"
                    extraActions={isAdmin ? [{
                        variant: row.isActive ? 'suspend' : 'restore',
                        title: row.isActive ? 'Deactivate' : 'Activate',
                        onClick: () => setActiveTarget(row),
                    }] : []}
                />
            ),
        },
    ], [isAdmin]);

    if (error) return <ErrorState error={error} onRetry={() => mutateBuildings()} />;

    return (
        <>
            <ResourcePanel>
                <FilterDrawerToolbar
                    activeFilters={activeFilters}
                    leading={<SearchBar value={searchTerm} onChange={(value) => updateQueryParams({ search: value, page: 1 })} placeholder="Search buildings..." />}
                    actions={isAdmin ? <Button icon={Plus} onClick={openCreate}>New Building</Button> : undefined}
                    renderFilters={() => (
                        <FilterDrawerGrid>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                                <CustomSelect
                                    options={[{ label: 'All Buildings', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
                                    value={status}
                                    onChange={(value) => updateQueryParams({ status: value, page: 1 })}
                                    placeholder="All Buildings"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</Label>
                                <CustomSelect
                                    options={[{ label: 'All Departments', value: '' }, ...departmentOptions]}
                                    value={departmentId}
                                    onChange={(value) => updateQueryParams({ departmentId: value, page: 1 })}
                                    placeholder="All Departments"
                                    searchable
                                />
                            </div>
                        </FilterDrawerGrid>
                    )}
                />
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
                        emptyTitle="No buildings found"
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingBuilding ? 'Edit Building' : 'Create Building'}
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="building-form"
                submitText={editingBuilding ? 'Save Changes' : 'Create Building'}
            >
                <div className="space-y-4 py-2">
                    <PhotoUploadPicker
                        currentImageUrl={editingBuilding?.imageUrl}
                        updatedAt={editingBuilding?.imageUpdatedAt}
                        onFileReady={setPendingImage}
                        type="org"
                        sizeClassName="w-28 h-28"
                        hint="Optional building picture. Crop a square image for tables and setup views."
                    />
                    <div className="space-y-2">
                        <Label htmlFor="building-name">Name *</Label>
                        <Input id="building-name" required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Science Block" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="building-code">Code</Label>
                        <Input id="building-code" value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="SCI" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="building-address">Address</Label>
                        <Input id="building-address" value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} placeholder="North campus" />
                    </div>
                    <div className="space-y-2">
                        <Label>Departments</Label>
                        <CustomMultiSelect
                            options={departmentOptions}
                            values={formData.departmentIds}
                            onChange={(departmentIds) => setFormData({ ...formData, departmentIds })}
                            placeholder="Select departments..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="building-description">Description</Label>
                        <Textarea id="building-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Optional building notes" />
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={!!activeTarget}
                onClose={() => setActiveTarget(null)}
                onConfirm={confirmActiveChange}
                title={`${activeTarget?.isActive ? 'Deactivate' : 'Activate'} Building`}
                description={`This will ${activeTarget?.isActive ? 'hide this building from active setup filters' : 'make this building available again'}.`}
                confirmText={activeTarget?.isActive ? 'Deactivate' : 'Activate'}
                isDestructive={activeTarget?.isActive}
            />
        </>
    );
}
