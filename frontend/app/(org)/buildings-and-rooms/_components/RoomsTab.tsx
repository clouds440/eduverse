'use client';

import { FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import useSWR, { mutate } from 'swr';
import { DoorOpen, FileUp, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { formatBuildingLabel, formatDepartmentLabel, formatRoomLabel, getPublicUrl } from '@/lib/utils';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { ApiError, Building, Department, PaginatedResponse, Role, Room, RoomType } from '@/types';
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
import { usePageActionsHost } from '@/components/ui/PageActionsHost';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { Textarea } from '@/components/ui/Textarea';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { CsvImportModal } from '@/components/imports/CsvImportModal';

const roomTypeOptions = [
    { value: '', label: 'Any Type' },
    { value: RoomType.CLASSROOM, label: 'Classroom' },
    { value: RoomType.LAB, label: 'Lab' },
    { value: RoomType.AUDITORIUM, label: 'Auditorium' },
    { value: RoomType.OFFICE, label: 'Office' },
    { value: RoomType.LIBRARY, label: 'Library' },
    { value: RoomType.HALL, label: 'Hall' },
    { value: RoomType.OTHER, label: 'Other' },
];

const emptyForm = {
    buildingId: '',
    name: '',
    code: '',
    floor: '',
    type: '' as RoomType | '',
    capacity: '',
    description: '',
    isActive: true,
};

function formatRoomType(type?: RoomType | null) {
    if (!type) return 'General';
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RoomsTab() {
    const { token, user } = useAuth();
    const { dispatch, state } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-rooms-limit', 10);
    const [modalOpen, setModalOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [pendingImage, setPendingImage] = useState<File | null>(null);
    const [activeTarget, setActiveTarget] = useState<Room | null>(null);

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = getStringParam('sortOrder', 'asc') as 'asc' | 'desc';
    const status = getStringParam('status');
    const buildingId = getStringParam('buildingId');
    const departmentId = getStringParam('departmentId');
    const type = getStringParam('type') as RoomType | '';
    const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const isProcessing = state.ui.processing['room-form'];

    const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
        buildingId: buildingId || undefined,
        departmentId: departmentId || undefined,
        type: type || undefined,
    };
    const { data, isLoading, error, mutate: mutateRooms } = useSWR<PaginatedResponse<Room>>(
        token ? ['rooms', params] as const : null,
    );
    const { data: buildingsData } = useSWR<PaginatedResponse<Building>>(
        token ? ['buildings', { limit: 500, sortBy: 'name', sortOrder: 'asc' }] as const : null,
    );
    const { data: departmentsData } = useSWR<PaginatedResponse<Department>>(
        token ? ['departments', { limit: 500, sortBy: 'name', sortOrder: 'asc' }] as const : null,
    );

    const buildingOptions = useMemo(() => (
        buildingsData?.data?.map((building) => ({
            value: building.id,
            label: formatBuildingLabel(building),
        })) || []
    ), [buildingsData]);
    const departmentOptions = useMemo(() => (
        departmentsData?.data?.map((department) => ({
            value: department.id,
            label: formatDepartmentLabel(department),
        })) || []
    ), [departmentsData]);

    const openCreate = () => {
        setEditingRoom(null);
        setFormData(emptyForm);
        setPendingImage(null);
        setModalOpen(true);
    };

    const openEdit = (room: Room) => {
        setEditingRoom(room);
        setFormData({
            buildingId: room.buildingId,
            name: room.name,
            code: room.code || '',
            floor: room.floor || '',
            type: room.type || '',
            capacity: room.capacity ? String(room.capacity) : '',
            description: room.description || '',
            isActive: room.isActive,
        });
        setPendingImage(null);
        setModalOpen(true);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'room-form' });
        try {
            const payload = {
                buildingId: formData.buildingId,
                name: formData.name,
                code: formData.code,
                floor: formData.floor || null,
                type: formData.type || null,
                capacity: formData.capacity ? Number(formData.capacity) : null,
                description: formData.description || null,
                isActive: formData.isActive,
            };
            let savedRoom: Room;
            if (editingRoom) {
                savedRoom = await api.org.updateRoom(editingRoom.id, payload, token);
                if (pendingImage) {
                    savedRoom = await api.org.uploadRoomImage(savedRoom.id, pendingImage, token);
                }
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Room updated', type: 'success' } });
            } else {
                savedRoom = await api.org.createRoom(payload, token);
                if (pendingImage) {
                    savedRoom = await api.org.uploadRoomImage(savedRoom.id, pendingImage, token);
                }
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Room created', type: 'success' } });
            }
            setModalOpen(false);
            setPendingImage(null);
            mutate(matchesCacheKeyPrefix('rooms'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to save room', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'room-form' });
        }
    };

    const confirmActiveChange = async () => {
        if (!token || !activeTarget) return;
        try {
            await api.org.setRoomActive(activeTarget.id, !activeTarget.isActive, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: activeTarget.isActive ? 'Room deactivated' : 'Room activated', type: 'success' } });
            setActiveTarget(null);
            mutate(matchesCacheKeyPrefix('rooms'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to update room status', type: 'error' } });
        }
    };

    const activeFilters = useMemo<ActiveFilter[]>(() => [
        ...(searchTerm ? [{ key: 'search', label: 'Search', value: searchTerm, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(status ? [{ key: 'status', label: 'Status', value: status === 'active' ? 'Active' : 'Inactive', onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
        ...(buildingId ? [{ key: 'buildingId', label: 'Building', value: buildingsData?.data?.find((building) => building.id === buildingId)?.name || 'Selected building', onRemove: () => updateQueryParams({ buildingId: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: departmentsData?.data?.find((department) => department.id === departmentId)?.name || 'Selected department', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
        ...(type ? [{ key: 'type', label: 'Type', value: formatRoomType(type), onRemove: () => updateQueryParams({ type: undefined, page: 1 }) }] : []),
    ], [buildingId, buildingsData?.data, departmentId, departmentsData?.data, searchTerm, status, type, updateQueryParams]);

    const pageControls = useMemo(() => (
        <PageControls
            activeFilters={activeFilters}
            leading={<SearchBar value={searchTerm} onChange={(value) => updateQueryParams({ search: value, page: 1 })} placeholder="Search rooms..." mobileMode="expandable" />}
            actions={isAdmin ? (
                <>
                    <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>Import CSV</Button>
                    <Button icon={Plus} onClick={openCreate}>New Room</Button>
                </>
            ) : undefined}
            renderFilters={() => (
                <FilterDrawerGrid>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                        <CustomSelect
                            options={[{ label: 'All Rooms', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
                            value={status}
                            onChange={(value) => updateQueryParams({ status: value, page: 1 })}
                            placeholder="All Rooms"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Building</Label>
                        <CustomSelect
                            options={[{ label: 'All Buildings', value: '' }, ...buildingOptions]}
                            value={buildingId}
                            onChange={(value) => updateQueryParams({ buildingId: value, page: 1 })}
                            placeholder="All Buildings"
                            searchable
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
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Room Type</Label>
                        <CustomSelect
                            options={roomTypeOptions}
                            value={type}
                            onChange={(value) => updateQueryParams({ type: value, page: 1 })}
                            placeholder="Any Type"
                        />
                    </div>
                </FilterDrawerGrid>
            )}
        />
    ), [activeFilters, buildingId, buildingOptions, departmentId, departmentOptions, isAdmin, searchTerm, status, type, updateQueryParams]);
    const controlsHosted = usePageActionsHost(pageControls);

    const columns = useMemo<Column<Room>[]>(() => [
        {
            header: 'Room',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-primary/10 text-primary">
                        {row.imageUrl ? (
                            <Image src={getPublicUrl(row.imageUrl, row.imageUpdatedAt)} alt={formatRoomLabel(row)} fill className="object-cover" sizes="44px" />
                        ) : (
                            <DoorOpen className="h-5 w-5" aria-hidden="true" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{formatRoomLabel(row)}</p>
                        <p className="truncate text-xs text-muted-foreground">{formatRoomType(row.type)}{row.floor ? ` - ${row.floor}` : ''}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Departments',
            accessor: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.building?.departments?.length ? row.building.departments.map((department) => (
                        <Badge key={department.id} variant="primary" size="sm" style={department.color ? { borderColor: `${department.color}55`, backgroundColor: `${department.color}18`, color: department.color } : undefined}>
                            {formatDepartmentLabel(department)}
                        </Badge>
                    )) : <span className="text-sm italic text-muted-foreground/60">No departments</span>}
                </div>
            ),
        },
        {
            header: 'Capacity',
            accessor: (row) => row.capacity ? `${row.capacity} seats` : <span className="text-sm italic text-muted-foreground/60">Not set</span>,
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
                    editTitle="Edit Room"
                    extraActions={isAdmin ? [{
                        variant: row.isActive ? 'suspend' : 'restore',
                        title: row.isActive ? 'Deactivate' : 'Activate',
                        onClick: () => setActiveTarget(row),
                    }] : []}
                />
            ),
        },
    ], [isAdmin]);

    if (error) return <ErrorState error={error} onRetry={() => mutateRooms()} />;

    return (
        <>
            <ResourcePanel>
                {!controlsHosted && (
                    <div className="shrink-0 border-b border-border/60 bg-card/95 p-2.5 sm:p-3">
                        {pageControls}
                    </div>
                )}
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
                        emptyTitle="No rooms found"
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingRoom ? 'Edit Room' : 'Create Room'}
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="room-form"
                submitText={editingRoom ? 'Save Changes' : 'Create Room'}
            >
                <div className="space-y-4 py-2">
                    <PhotoUploadPicker
                        currentImageUrl={editingRoom?.imageUrl}
                        updatedAt={editingRoom?.imageUpdatedAt}
                        onFileReady={setPendingImage}
                        type="org"
                        sizeClassName="w-28 h-28"
                        hint="Optional room picture. Crop a square image for tables and setup views."
                    />
                    <div className="space-y-2">
                        <Label>Building *</Label>
                        <CustomSelect
                            options={buildingOptions}
                            value={formData.buildingId}
                            onChange={(nextBuildingId) => setFormData({ ...formData, buildingId: nextBuildingId })}
                            placeholder="Select Building"
                            required
                            searchable
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="room-name">Room Name *</Label>
                            <Input id="room-name" required value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Lab 2" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="room-code">Code *</Label>
                            <Input id="room-code" required value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="ROOM-101" />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="room-floor">Floor</Label>
                            <Input id="room-floor" value={formData.floor} onChange={(event) => setFormData({ ...formData, floor: event.target.value })} placeholder="Ground" />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <CustomSelect
                                options={roomTypeOptions}
                                value={formData.type}
                                onChange={(nextType) => setFormData({ ...formData, type: nextType as RoomType | '' })}
                                placeholder="General"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="room-capacity">Capacity</Label>
                        <Input id="room-capacity" type="number" min={1} value={formData.capacity} onChange={(event) => setFormData({ ...formData, capacity: event.target.value })} placeholder="40" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="room-description">Description</Label>
                        <Textarea id="room-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Optional room notes" />
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={!!activeTarget}
                onClose={() => setActiveTarget(null)}
                onConfirm={confirmActiveChange}
                title={`${activeTarget?.isActive ? 'Deactivate' : 'Activate'} Room`}
                description={`This will ${activeTarget?.isActive ? 'hide this room from active setup filters and future schedule selectors' : 'make this room available again'}.`}
                confirmText={activeTarget?.isActive ? 'Deactivate' : 'Activate'}
                isDestructive={activeTarget?.isActive}
            />
            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="rooms"
                title="Rooms"
                cachePrefix="rooms"
            />
        </>
    );
}



