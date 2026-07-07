'use client';

import { FormEvent, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Calendar, CalendarDays, Layers, Plus, Search, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { searchFilterLookup } from '@/lib/filterLookups';
import { matchesAnyCacheKeyPrefix } from '@/lib/swr';
import { formatDepartmentLabel } from '@/lib/utils';
import {
    AnnouncementPriority,
    ApiError,
    CreateHolidayRequest,
    Department,
    DepartmentScopeType,
    Holiday,
    HolidayMatchMode,
    HolidayType,
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

const HOLIDAY_TYPE_OPTIONS = [
    { value: HolidayType.HOLIDAY, label: 'Holiday' },
    { value: HolidayType.EXAM_BREAK, label: 'Exam break' },
    { value: HolidayType.EVENT, label: 'Event' },
    { value: HolidayType.CLOSURE, label: 'Closure' },
];

const MATCH_MODE_OPTIONS = [
    { value: HolidayMatchMode.SINGLE_DAY, label: 'Single day' },
    { value: HolidayMatchMode.DATE_RANGE, label: 'Date range' },
    { value: HolidayMatchMode.WEEKDAYS_IN_RANGE, label: 'Selected weekdays in range' },
    { value: HolidayMatchMode.DAILY_IN_RANGE, label: 'Every day in range' },
];

type HolidayFormState = {
    title: string;
    description: string;
    type: HolidayType;
    matchMode: HolidayMatchMode;
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

const emptyForm: HolidayFormState = {
    title: '',
    description: '',
    type: HolidayType.HOLIDAY,
    matchMode: HolidayMatchMode.SINGLE_DAY,
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

function formatDateRange(holiday: Holiday) {
    const start = formatDate(holiday.startDate);
    const end = formatDate(holiday.endDate);
    return start === end ? start : `${start} - ${end}`;
}

function getTypeLabel(type: HolidayType) {
    return HOLIDAY_TYPE_OPTIONS.find((option) => option.value === type)?.label || 'Holiday';
}

function getMatchModeLabel(mode: HolidayMatchMode) {
    return MATCH_MODE_OPTIONS.find((option) => option.value === mode)?.label || 'Single day';
}

function getDepartmentSummary(holiday: Holiday) {
    if (holiday.departmentScopeType === DepartmentScopeType.ALL) return 'All departments';
    const departments = holiday.departmentLinks?.map((link) => link.department).filter(Boolean) as Department[] | undefined;
    if (!departments?.length) return 'Selected departments';
    const labels = departments.map((department) => department.code || department.name || 'Dept');
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

export default function HolidaysPage() {
    const { token, user } = useAuth();
    const { dispatch, state } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-holidays-limit', 10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
    const [formData, setFormData] = useState<HolidayFormState>(emptyForm);
    const [statusTarget, setStatusTarget] = useState<Holiday | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const typeFilter = getStringParam('type');
    const statusFilter = getStringParam('status');
    const departmentId = getStringParam('departmentId');
    const startDate = getStringParam('startDate');
    const endDate = getStringParam('endDate');
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const isProcessing = state.ui.processing['holiday-form'];

    const params = {
        page,
        limit: pageSize,
        search: searchTerm,
        type: typeFilter ? typeFilter as HolidayType : undefined,
        isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        departmentId: departmentId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
    };
    const { data, isLoading, error, mutate: mutateHolidays } = useSWR<PaginatedResponse<Holiday>>(
        token ? ['holidays', params] as const : null,
    );
    const { data: departmentsData } = useSWR<PaginatedResponse<Department>>(
        token && modalOpen ? ['departments', { limit: 1000, isActive: true, sortBy: 'name', sortOrder: 'asc' }] as const : null,
    );
    const departments = departmentsData?.data || [];
    const departmentOptions = departments.map((department) => ({ value: department.id, label: formatDepartmentLabel(department), icon: Layers }));

    const openCreate = () => {
        setEditingHoliday(null);
        setFormData(emptyForm);
        setModalOpen(true);
    };

    const openEdit = (holiday: Holiday) => {
        setEditingHoliday(holiday);
        setFormData({
            title: holiday.title,
            description: holiday.description || '',
            type: holiday.type,
            matchMode: holiday.matchMode,
            departmentScopeType: holiday.departmentScopeType,
            departmentIds: holiday.departmentLinks?.map((link) => link.departmentId) || [],
            startDate: holiday.startDate.slice(0, 10),
            endDate: holiday.endDate.slice(0, 10),
            isFullDay: holiday.isFullDay,
            startTime: holiday.startTime || '08:00',
            endTime: holiday.endTime || '17:00',
            daysOfWeek: holiday.daysOfWeek.map(String),
            isActive: holiday.isActive,
            announce: false,
            announcementPriority: AnnouncementPriority.NORMAL,
        });
        setModalOpen(true);
    };

    const refreshCalendarData = () => {
        mutate(matchesAnyCacheKeyPrefix(['holidays', 'timetable']));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'holiday-form' });
        try {
            const payload: CreateHolidayRequest = {
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                type: formData.type,
                matchMode: formData.matchMode,
                departmentScopeType: formData.departmentScopeType,
                departmentIds: formData.departmentScopeType === DepartmentScopeType.SELECTED ? formData.departmentIds : [],
                startDate: formData.startDate,
                endDate: formData.matchMode === HolidayMatchMode.SINGLE_DAY ? formData.startDate : (formData.endDate || formData.startDate),
                isFullDay: formData.isFullDay,
                startTime: formData.isFullDay ? undefined : formData.startTime,
                endTime: formData.isFullDay ? undefined : formData.endTime,
                daysOfWeek: formData.matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE ? formData.daysOfWeek.map(Number) : [],
                isActive: formData.isActive,
                announce: formData.announce,
                announcementPriority: formData.announcementPriority,
            };

            if (editingHoliday) {
                await api.org.updateHoliday(editingHoliday.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Calendar item updated', type: 'success' } });
            } else {
                await api.org.createHoliday(payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Calendar item created', type: 'success' } });
            }
            setModalOpen(false);
            refreshCalendarData();
        } catch (err: unknown) {
            const apiError = err as ApiError;
            dispatch({ type: 'TOAST_ADD', payload: { message: apiError.message || 'Unable to save calendar item', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'holiday-form' });
        }
    };

    const confirmStatusChange = async () => {
        if (!token || !statusTarget) return;
        try {
            await api.org.setHolidayActive(statusTarget.id, !statusTarget.isActive, token);
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
            await api.org.deleteHoliday(deleteTarget.id, token);
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
        ...(typeFilter ? [{ key: 'type', label: 'Type', value: getTypeLabel(typeFilter as HolidayType), onRemove: () => updateQueryParams({ type: undefined, page: 1 }) }] : []),
        ...(statusFilter ? [{ key: 'status', label: 'Status', value: statusFilter === 'active' ? 'Active' : 'Inactive', onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: 'Selected department', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
        ...(startDate ? [{ key: 'startDate', label: 'From', value: startDate, onRemove: () => updateQueryParams({ startDate: undefined, page: 1 }) }] : []),
        ...(endDate ? [{ key: 'endDate', label: 'To', value: endDate, onRemove: () => updateQueryParams({ endDate: undefined, page: 1 }) }] : []),
    ];

    const columns = useMemo<Column<Holiday>[]>(() => [
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
                    {row.matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE && (
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
                    onDelete={user?.role === Role.ORG_ADMIN ? () => setDeleteTarget(row) : undefined}
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
                options={[{ value: '', label: 'All types', icon: Calendar }, ...HOLIDAY_TYPE_OPTIONS]}
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
                    <Label htmlFor="holiday-filter-start">From</Label>
                    <Input id="holiday-filter-start" type="date" value={startDate} onChange={(event) => updateQueryParams({ startDate: event.target.value || undefined, page: 1 })} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="holiday-filter-end">To</Label>
                    <Input id="holiday-filter-end" type="date" value={endDate} onChange={(event) => updateQueryParams({ endDate: event.target.value || undefined, page: 1 })} />
                </div>
            </div>
        </FilterDrawerGrid>
    );

    if (error) return <ErrorState error={error} onRetry={() => mutateHolidays()} />;

    return (
        <PageShell>
            <PageHeader
                title="Academic Calendar"
                description="Manage holidays, closures, exam breaks, and events that overlay timetable schedules."
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
                        emptyDescription={activeFilters.length > 0 ? 'Adjust the filters to broaden the calendar view.' : 'Create holidays or academic events to overlay timetables.'}
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingHoliday ? 'Edit Calendar Item' : 'Create Calendar Item'}
                onSubmit={handleSubmit}
                isSubmitting={isProcessing}
                loadingId="holiday-form"
                submitText={editingHoliday ? 'Save Changes' : 'Create Item'}
                maxWidth="max-w-2xl"
                bodyClassName="max-h-[75vh] overflow-y-auto custom-scrollbar"
            >
                <div className="space-y-4 py-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="holiday-title">Title *</Label>
                            <Input id="holiday-title" required value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} placeholder="Winter break" />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <CustomSelect value={formData.type} onChange={(value) => setFormData({ ...formData, type: value as HolidayType })} options={HOLIDAY_TYPE_OPTIONS} />
                        </div>
                        <div className="space-y-2">
                            <Label>Pattern</Label>
                            <CustomSelect value={formData.matchMode} onChange={(value) => setFormData({ ...formData, matchMode: value as HolidayMatchMode })} options={MATCH_MODE_OPTIONS} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="holiday-start">Start date *</Label>
                            <Input id="holiday-start" type="date" required value={formData.startDate} onChange={(event) => setFormData({ ...formData, startDate: event.target.value, endDate: formData.endDate || event.target.value })} />
                        </div>
                        {formData.matchMode !== HolidayMatchMode.SINGLE_DAY && (
                            <div className="space-y-2">
                                <Label htmlFor="holiday-end">End date *</Label>
                                <Input id="holiday-end" type="date" required value={formData.endDate} onChange={(event) => setFormData({ ...formData, endDate: event.target.value })} />
                            </div>
                        )}
                    </div>

                    {formData.matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE && (
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
                                    <Label htmlFor="holiday-start-time">Start time</Label>
                                    <Input id="holiday-start-time" type="time" value={formData.startTime} onChange={(event) => setFormData({ ...formData, startTime: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="holiday-end-time">End time</Label>
                                    <Input id="holiday-end-time" type="time" value={formData.endTime} onChange={(event) => setFormData({ ...formData, endTime: event.target.value })} />
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
                        <Label htmlFor="holiday-description">Description</Label>
                        <Textarea id="holiday-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Optional notes shown in calendar management and announcements" />
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
