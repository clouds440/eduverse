'use client';

import { FormEvent, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Calendar, CalendarDays, Image as ImageIcon, Layers, Plus, Search, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { searchFilterLookup } from '@/lib/filterLookups';
import { matchesAnyCacheKeyPrefix } from '@/lib/swr';
import { formatDepartmentLabel } from '@/lib/utils';
import {
    AnnouncementPriority,
    ApiError,
    CreateAcademicEventRequest,
    Department,
    DepartmentScopeType,
    AcademicEvent,
    AcademicEventMatchMode,
    AcademicEventType,
    PaginatedResponse,
    Role,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { RemoteFilterSelect } from '@/components/ui/RemoteFilterSelect';
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
import { Toggle } from '@/components/ui/Toggle';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ACADEMIC_EVENT_TYPE_OPTIONS = [
    { value: AcademicEventType.HOLIDAY, label: 'Holiday' },
    { value: AcademicEventType.EXAM_BREAK, label: 'Exam break' },
    { value: AcademicEventType.EVENT, label: 'Event' },
    { value: AcademicEventType.CLOSURE, label: 'Closure' },
];

const MATCH_MODE_OPTIONS = [
    { value: AcademicEventMatchMode.SINGLE_DAY, label: 'Single day' },
    { value: AcademicEventMatchMode.DATE_RANGE, label: 'Date range' },
    { value: AcademicEventMatchMode.WEEKDAYS_IN_RANGE, label: 'Selected weekdays in range' },
    { value: AcademicEventMatchMode.DAILY_IN_RANGE, label: 'Every day in range' },
];

type AcademicEventFormState = {
    title: string;
    description: string;
    bannerFileId?: string;
    bannerUrl?: string;
    bannerFilename?: string;
    bannerMimeType?: string;
    type: AcademicEventType;
    matchMode: AcademicEventMatchMode;
    departmentScopeType: DepartmentScopeType;
    departmentIds: string[];
    startDate: string;
    endDate: string;
    isFullDay: boolean;
    startTime: string;
    endTime: string;
    daysOfWeek: string[];
    isActive: boolean;
    announce: boolean;
    announcementPriority: AnnouncementPriority;
};

const emptyForm: AcademicEventFormState = {
    title: '',
    description: '',
    bannerFileId: undefined,
    bannerUrl: undefined,
    bannerFilename: undefined,
    bannerMimeType: undefined,
    type: AcademicEventType.HOLIDAY,
    matchMode: AcademicEventMatchMode.SINGLE_DAY,
    departmentScopeType: DepartmentScopeType.ALL,
    departmentIds: [],
    startDate: '',
    endDate: '',
    isFullDay: true,
    startTime: '08:00',
    endTime: '17:00',
    daysOfWeek: [],
    isActive: true,
    announce: false,
    announcementPriority: AnnouncementPriority.NORMAL,
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(event: AcademicEvent) {
    const start = formatDate(event.startDate);
    const end = formatDate(event.endDate);
    return start === end ? start : `${start} - ${end}`;
}

function getTypeLabel(type: AcademicEventType) {
    return ACADEMIC_EVENT_TYPE_OPTIONS.find((option) => option.value === type)?.label || 'Event';
}

function getMatchModeLabel(mode: AcademicEventMatchMode) {
    return MATCH_MODE_OPTIONS.find((option) => option.value === mode)?.label || 'Single day';
}

function getDepartmentSummary(event: AcademicEvent) {
    if (event.departmentScopeType === DepartmentScopeType.ALL) return 'All departments';
    const departments = event.departmentLinks?.map((link) => link.department).filter(Boolean) as Department[] | undefined;
    if (!departments?.length) return 'Selected departments';
    const labels = departments.map((department) => department.code || department.name || 'Dept');
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

export default function AcademicEventsPage() {
    const { token, user } = useAuth();
    const { dispatch, state } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-academic-events-limit', 10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<AcademicEvent | null>(null);
    const [formData, setFormData] = useState<AcademicEventFormState>(emptyForm);
    const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
    const [statusTarget, setStatusTarget] = useState<AcademicEvent | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AcademicEvent | null>(null);

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const typeFilter = getStringParam('type');
    const statusFilter = getStringParam('status');
    const departmentId = getStringParam('departmentId');
    const startDate = getStringParam('startDate');
    const endDate = getStringParam('endDate');
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const isProcessing = state.ui.processing['academic-event-form'];

    const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        type: typeFilter ? typeFilter as AcademicEventType : undefined,
        isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        departmentId: departmentId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    };
    const { data, isLoading, error, mutate: mutateAcademicEvents } = useSWR<PaginatedResponse<AcademicEvent>>(
        token ? ['academic-events', params] as const : null,
    );
    const { data: departmentsData } = useSWR<PaginatedResponse<Department>>(
        token && modalOpen ? ['departments', { limit: 1000, isActive: true, sortBy: 'name', sortOrder: 'asc' }] as const : null,
    );
    const departments = departmentsData?.data || [];
    const departmentOptions = departments.map((department) => ({ value: department.id, label: formatDepartmentLabel(department), icon: Layers }));

    const openCreate = () => {
        setEditingEvent(null);
        setFormData(emptyForm);
        setPendingBannerFile(null);
        setModalOpen(true);
    };

    const openEdit = (event: AcademicEvent) => {
        setEditingEvent(event);
        setFormData({
            title: event.title,
            description: event.description || '',
            bannerFileId: event.bannerFileId || undefined,
            bannerUrl: event.bannerUrl || undefined,
            bannerFilename: event.bannerFilename || undefined,
            bannerMimeType: event.bannerMimeType || undefined,
            type: event.type,
            matchMode: event.matchMode,
            departmentScopeType: event.departmentScopeType,
            departmentIds: event.departmentLinks?.map((link) => link.departmentId) || [],
            startDate: event.startDate.slice(0, 10),
            endDate: event.endDate.slice(0, 10),
            isFullDay: event.isFullDay,
            startTime: event.startTime || '08:00',
            endTime: event.endTime || '17:00',
            daysOfWeek: event.daysOfWeek.map(String),
            isActive: event.isActive,
            announce: false,
            announcementPriority: AnnouncementPriority.NORMAL,
        });
        setPendingBannerFile(null);
        setModalOpen(true);
    };

    const refreshCalendarData = () => {
        mutate(matchesAnyCacheKeyPrefix(['academic-events', 'timetable']));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'academic-event-form' });
        try {
            let bannerPayload: Pick<CreateAcademicEventRequest, 'bannerFileId' | 'bannerUrl' | 'bannerFilename' | 'bannerMimeType'> = {
                bannerFileId: formData.bannerFileId,
                bannerUrl: formData.bannerUrl,
                bannerFilename: formData.bannerFilename,
                bannerMimeType: formData.bannerMimeType,
            };
            if (pendingBannerFile) {
                const orgId = editingEvent?.organizationId || user?.organizationId;
                if (!orgId) throw new Error('Organization context is required to upload an event banner');
                const uploaded = await api.files.uploadFile(orgId, 'ACADEMIC_EVENT_BANNER', editingEvent?.id || 'temp', pendingBannerFile, token);
                bannerPayload = {
                    bannerFileId: uploaded.id,
                    bannerUrl: uploaded.path || uploaded.url,
                    bannerFilename: uploaded.filename || pendingBannerFile.name,
                    bannerMimeType: uploaded.mimeType || pendingBannerFile.type,
                };
            }

            const payload: CreateAcademicEventRequest = {
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                ...bannerPayload,
                type: formData.type,
                matchMode: formData.matchMode,
                departmentScopeType: formData.departmentScopeType,
                departmentIds: formData.departmentScopeType === DepartmentScopeType.SELECTED ? formData.departmentIds : [],
                startDate: formData.startDate,
                endDate: formData.matchMode === AcademicEventMatchMode.SINGLE_DAY ? formData.startDate : (formData.endDate || formData.startDate),
                isFullDay: formData.isFullDay,
                startTime: formData.isFullDay ? undefined : formData.startTime,
                endTime: formData.isFullDay ? undefined : formData.endTime,
                daysOfWeek: formData.matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE ? formData.daysOfWeek.map(Number) : [],
                isActive: formData.isActive,
                announce: formData.announce,
                announcementPriority: formData.announcementPriority,
            };

            if (editingEvent) {
                await api.org.updateAcademicEvent(editingEvent.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Calendar item updated', type: 'success' } });
            } else {
                await api.org.createAcademicEvent(payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Calendar item created', type: 'success' } });
            }
            setModalOpen(false);
            refreshCalendarData();
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to save calendar item', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'academic-event-form' });
        }
    };

    const confirmStatusChange = async () => {
        if (!token || !statusTarget) return;
        try {
            await api.org.setAcademicEventActive(statusTarget.id, !statusTarget.isActive, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: statusTarget.isActive ? 'Calendar item deactivated' : 'Calendar item activated', type: 'success' } });
            setStatusTarget(null);
            refreshCalendarData();
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to update calendar item', type: 'error' } });
        }
    };

    const confirmDelete = async () => {
        if (!token || !deleteTarget) return;
        try {
            await api.org.deleteAcademicEvent(deleteTarget.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Calendar item deleted', type: 'success' } });
            setDeleteTarget(null);
            refreshCalendarData();
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to delete calendar item', type: 'error' } });
        }
    };

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{ key: 'search', label: 'Search', value: searchTerm, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(typeFilter ? [{ key: 'type', label: 'Type', value: getTypeLabel(typeFilter as AcademicEventType), onRemove: () => updateQueryParams({ type: undefined, page: 1 }) }] : []),
        ...(statusFilter ? [{ key: 'status', label: 'Status', value: statusFilter === 'active' ? 'Active' : 'Inactive', onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: 'Selected department', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
        ...(startDate ? [{ key: 'startDate', label: 'From', value: startDate, onRemove: () => updateQueryParams({ startDate: undefined, page: 1 }) }] : []),
        ...(endDate ? [{ key: 'endDate', label: 'To', value: endDate, onRemove: () => updateQueryParams({ endDate: undefined, page: 1 }) }] : []),
    ];

    const columns = useMemo<Column<AcademicEvent>[]>(() => [
        {
            header: 'Calendar Item',
            accessor: (row) => (
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-black text-foreground">{row.title}</p>
                        <Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    {row.description && <p className="mt-1 truncate text-xs text-muted-foreground">{row.description}</p>}
                </div>
            ),
        },
        {
            header: 'Date',
            accessor: (row) => (
                <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">{formatDateRange(row)}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                        {row.isFullDay ? 'Full day' : `${row.startTime} - ${row.endTime}`}
                    </p>
                </div>
            ),
        },
        {
            header: 'Pattern',
            accessor: (row) => (
                <div className="space-y-1">
                    <Badge variant="neutral" size="sm">{getTypeLabel(row.type)}</Badge>
                    <p className="text-xs font-semibold text-muted-foreground">{getMatchModeLabel(row.matchMode)}</p>
                    {row.matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE && (
                        <p className="text-xs font-semibold text-muted-foreground">
                            {row.daysOfWeek.map((day) => DAY_NAMES[day]).join(', ')}
                        </p>
                    )}
                </div>
            ),
        },
        {
            header: 'Departments',
            accessor: (row) => <span className="text-sm font-bold text-foreground">{getDepartmentSummary(row)}</span>,
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (row) => canManage ? (
                <TableActions
                    onEdit={() => openEdit(row)}
                    editTitle="Edit Calendar Item"
                    onDelete={() => setDeleteTarget(row)}
                    extraActions={[{
                        variant: row.isActive ? 'suspend' : 'restore',
                        title: row.isActive ? 'Deactivate' : 'Activate',
                        onClick: () => setStatusTarget(row),
                    }]}
                />
            ) : null,
        },
    ], [canManage, user?.role]);

    const renderFilters = () => (
        <FilterDrawerGrid>
            <CustomSelect
                value={typeFilter}
                onChange={(value) => updateQueryParams({ type: value || undefined, page: 1 })}
                options={[{ value: '', label: 'All types', icon: Calendar }, ...ACADEMIC_EVENT_TYPE_OPTIONS]}
            />
            <CustomSelect
                value={statusFilter}
                onChange={(value) => updateQueryParams({ status: value || undefined, page: 1 })}
                options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            />
            <RemoteFilterSelect<Department>
                cacheKey="calendar-department-filter"
                value={departmentId}
                onChange={(value) => updateQueryParams({ departmentId: value || undefined, page: 1 })}
                placeholder="All departments"
                allLabel="All departments"
                icon={Layers}
                selectedLabel="Selected department"
                loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'departments', search, isActive: true })}
            />
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="academic-event-filter-start">From</Label>
                    <Input id="academic-event-filter-start" type="date" value={startDate} onChange={(event) => updateQueryParams({ startDate: event.target.value || undefined, page: 1 })} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="academic-event-filter-end">To</Label>
                    <Input id="academic-event-filter-end" type="date" value={endDate} onChange={(event) => updateQueryParams({ endDate: event.target.value || undefined, page: 1 })} />
                </div>
            </div>
        </FilterDrawerGrid>
    );

    if (error) return <ErrorState error={error} onRetry={() => mutateAcademicEvents()} />;

    return (
        <PageShell>
            <PageHeader
                title="Academic Calendar"
                description="Manage academic events, closures, and exam breaks that overlay timetable schedules."
                icon={CalendarDays}
                meta={<Badge variant="neutral" size="sm">{data?.totalRecords || 0} items</Badge>}
                breadcrumbs={[{ label: 'Organization' }, { label: 'Academics' }, { label: 'Academic Calendar' }]}
                actions={(
                    <PageControls
                        drawerLabel="Calendar filters"
                        activeFilters={activeFilters}
                        renderFilters={renderFilters}
                        leading={<SearchBar value={searchTerm} onChange={(value) => updateQueryParams({ search: value || undefined, page: 1 })} placeholder="Search calendar items..." mobileMode="expandable" />}
                        actions={canManage ? <Button icon={Plus} onClick={openCreate}>New Item</Button> : undefined}
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
                        maxHeight="100%"
                        emptyTitle="No calendar items found"
                        emptyDescription={activeFilters.length > 0 ? 'Adjust the filters to broaden the calendar view.' : 'Create academic events to overlay timetables.'}
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingEvent ? 'Edit Calendar Item' : 'Create Calendar Item'}
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="academic-event-form"
                submitText={editingEvent ? 'Save Changes' : 'Create Item'}
                maxWidth="max-w-2xl"
                bodyClassName="max-h-[75vh] overflow-y-auto custom-scrollbar"
            >
                <div className="space-y-4 py-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="academic-event-title">Title *</Label>
                            <Input id="academic-event-title" required value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} placeholder="Winter break" />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <CustomSelect value={formData.type} onChange={(value) => setFormData({ ...formData, type: value as AcademicEventType })} options={ACADEMIC_EVENT_TYPE_OPTIONS} />
                        </div>
                        <div className="space-y-2">
                            <Label>Pattern</Label>
                            <CustomSelect value={formData.matchMode} onChange={(value) => setFormData({ ...formData, matchMode: value as AcademicEventMatchMode })} options={MATCH_MODE_OPTIONS} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="academic-event-start">Start date *</Label>
                            <Input id="academic-event-start" type="date" required value={formData.startDate} onChange={(event) => setFormData({ ...formData, startDate: event.target.value, endDate: formData.endDate || event.target.value })} />
                        </div>
                        {formData.matchMode !== AcademicEventMatchMode.SINGLE_DAY && (
                            <div className="space-y-2">
                                <Label htmlFor="academic-event-end">End date *</Label>
                                <Input id="academic-event-end" type="date" required value={formData.endDate} onChange={(event) => setFormData({ ...formData, endDate: event.target.value })} />
                            </div>
                        )}
                    </div>

                    {formData.matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE && (
                        <div className="space-y-2">
                            <Label>Weekdays</Label>
                            <CustomMultiSelect
                                values={formData.daysOfWeek}
                                onChange={(values) => setFormData({ ...formData, daysOfWeek: values })}
                                options={DAY_NAMES.map((label, day) => ({ value: String(day), label }))}
                                placeholder="Select weekdays"
                            />
                        </div>
                    )}

                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <Toggle
                            checked={formData.isFullDay}
                            onCheckedChange={(checked) => setFormData({ ...formData, isFullDay: checked })}
                            label="Full day"
                            description="Turn this off for partial-day closures or events."
                        />
                        {!formData.isFullDay && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="academic-event-start-time">Start time</Label>
                                    <Input id="academic-event-start-time" type="time" value={formData.startTime} onChange={(event) => setFormData({ ...formData, startTime: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="academic-event-end-time">End time</Label>
                                    <Input id="academic-event-end-time" type="time" value={formData.endTime} onChange={(event) => setFormData({ ...formData, endTime: event.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Departments</Label>
                        <CustomSelect
                            value={formData.departmentScopeType}
                            onChange={(value) => setFormData({ ...formData, departmentScopeType: value as DepartmentScopeType, departmentIds: value === DepartmentScopeType.ALL ? [] : formData.departmentIds })}
                            options={[
                                { value: DepartmentScopeType.ALL, label: 'All departments', icon: Layers },
                                { value: DepartmentScopeType.SELECTED, label: 'Selected departments', icon: Search },
                            ]}
                        />
                    </div>

                    {formData.departmentScopeType === DepartmentScopeType.SELECTED && (
                        <div className="space-y-2">
                            <Label>Select departments *</Label>
                            <CustomMultiSelect
                                values={formData.departmentIds}
                                onChange={(values) => setFormData({ ...formData, departmentIds: values })}
                                options={departmentOptions}
                                placeholder="Choose one or more departments"
                                icon={Layers}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="academic-event-description">Description</Label>
                        <Textarea id="academic-event-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Optional notes shown in calendar management and announcements" />
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                        <Label htmlFor="academic-event-banner">Banner image</Label>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">
                                        {pendingBannerFile?.name || formData.bannerFilename || 'No banner selected'}
                                    </p>
                                    <p className="text-xs font-semibold text-muted-foreground">PNG, JPG, GIF, or WebP.</p>
                                </div>
                            </div>
                            <Input
                                id="academic-event-banner"
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp"
                                className="sm:max-w-64"
                                onChange={(event) => setPendingBannerFile(event.target.files?.[0] || null)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
                        <Toggle checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} label="Active" description="Active items appear on timetables." />
                        <Toggle checked={formData.announce} onCheckedChange={(checked) => setFormData({ ...formData, announce: checked })} label="Announce" description="Create an organization announcement." />
                        {formData.announce && (
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Announcement priority</Label>
                                <CustomSelect
                                    value={formData.announcementPriority}
                                    onChange={(value) => setFormData({ ...formData, announcementPriority: value as AnnouncementPriority })}
                                    options={[
                                        { value: AnnouncementPriority.LOW, label: 'Low', icon: Send },
                                        { value: AnnouncementPriority.NORMAL, label: 'Normal', icon: Send },
                                        { value: AnnouncementPriority.HIGH, label: 'High', icon: Send },
                                        { value: AnnouncementPriority.URGENT, label: 'Urgent', icon: Send },
                                    ]}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={!!statusTarget}
                onClose={() => setStatusTarget(null)}
                onConfirm={confirmStatusChange}
                title={`${statusTarget?.isActive ? 'Deactivate' : 'Activate'} Calendar Item`}
                description={`This will ${statusTarget?.isActive ? 'remove this item from timetable overlays' : 'show this item on matching timetables again'}.`}
                confirmText={statusTarget?.isActive ? 'Deactivate' : 'Activate'}
                isDestructive={statusTarget?.isActive}
            />
            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title="Delete Calendar Item"
                description="This permanently removes the calendar item and its timetable overlays."
                confirmText="Delete"
                isDestructive
            />
        </PageShell>
    );
}
