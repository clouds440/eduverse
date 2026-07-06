'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import useSWR from 'swr';
import { CalendarDays, CalendarRange, Clock, MapPin, Minus, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError, PaginatedResponse, Room, SectionSchedule, Section, Role, ScheduleType } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { ModalForm } from '@/components/ui/ModalForm';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Toggle } from '@/components/ui/Toggle';
import { DocsLink } from '@/components/ui/DocsLink';
import { formatRoomLabel, getSectionSurfaceStyle } from '@/lib/utils';

const DAY_OPTIONS = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
];

const WEEKDAY_VALUES = ['1', '2', '3', '4', '5'];
const DURATION_PRESETS = [
    { label: '45m', minutes: 45 },
    { label: '1h', minutes: 60 },
    { label: '90m', minutes: 90 },
    { label: '2h', minutes: 120 },
];

interface SectionSchedulesProps {
    section: Section;
    role: Role;
}

function getDayLabel(day: number) {
    return DAY_OPTIONS.find((option) => option.value === String(day))?.label || 'Unknown';
}

function getDateLabel(date?: string | null) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayInputValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(time: string) {
    const [hours = '0', minutes = '0'] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(totalMinutes: number) {
    const clamped = Math.min(23 * 60 + 59, Math.max(0, totalMinutes));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number) {
    return minutesToTime(timeToMinutes(time) + minutes);
}

function getDurationLabel(startTime: string, endTime: string) {
    const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
    if (duration <= 0) return 'Invalid range';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
}

export default memo(function SectionSchedules({ section, role }: SectionSchedulesProps) {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const dispatchRef = useRef(dispatch);

    const [schedules, setSchedules] = useState<SectionSchedule[]>([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<SectionSchedule | null>(null);
    const [deletingSchedule, setDeletingSchedule] = useState<SectionSchedule | null>(null);
    const [formData, setFormData] = useState({
        day: '1',
        date: '',
        type: ScheduleType.OFFICIAL,
        startTime: '09:00',
        endTime: '10:00',
        room: section.room || '',
        roomId: section.defaultRoomId || '',
        teacherId: section.teachers?.length === 1 ? section.teachers[0].id : '',
    });
    const [repeatWeekdays, setRepeatWeekdays] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const canManageOfficialSchedules = role === Role.ORG_ADMIN || role === Role.SUB_ADMIN;
    const canManageAdHocSchedules = (role === Role.TEACHER || role === Role.ORG_MANAGER) && section.teachers?.some((teacher) => teacher.userId === user?.id);
    const canManageSchedules = canManageOfficialSchedules || canManageAdHocSchedules;
    const { data: roomsData } = useSWR<PaginatedResponse<Room>>(token ? ['rooms', { limit: 1000, isActive: true }] as const : null);
    const roomOptions = [
        { value: '', label: 'Use Section Default' },
        ...(roomsData?.data?.map((room) => ({
            value: room.id,
            label: formatRoomLabel(room),
        })) || []),
    ];
    const teacherOptions = (section.teachers || []).map((teacher) => ({
        value: teacher.id,
        label: teacher.user?.name || teacher.user?.email || 'Unnamed teacher',
    }));
    const singleTeacher = section.teachers?.length === 1 ? section.teachers[0] : null;
    const getScheduleTeacherLabel = (schedule: SectionSchedule) => (
        schedule.teacher?.user?.name
        || schedule.teacher?.user?.email
        || section.teachers?.find((teacher) => teacher.id === schedule.teacherId)?.user?.name
        || section.teachers?.find((teacher) => teacher.id === schedule.teacherId)?.user?.email
        || 'Teacher TBD'
    );

    const canManageSchedule = useCallback((schedule: SectionSchedule) => (
        schedule.type === ScheduleType.AD_HOC ? canManageAdHocSchedules : canManageOfficialSchedules
    ), [canManageAdHocSchedules, canManageOfficialSchedules]);

    useEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    const fetchSchedules = useCallback(async () => {
        if (!token) return;
        setFetching(true);
        try {
            const data = await api.org.getSchedules(section.id, token);
            setSchedules(data || []);
            setError(null);
        } catch (err: unknown) {
            setError((err as ApiError)?.message || 'Failed to fetch schedules');
        } finally {
            setFetching(false);
        }
    }, [section.id, token]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const openCreateModal = (type: ScheduleType = ScheduleType.OFFICIAL) => {
        setEditingSchedule(null);
        setRepeatWeekdays(false);
        setFormError(null);
        setFormData({
            day: '1',
            date: type === ScheduleType.AD_HOC ? todayInputValue() : '',
            type,
            startTime: '09:00',
            endTime: '10:00',
            room: section.room || '',
            roomId: section.defaultRoomId || '',
            teacherId: section.teachers?.length === 1 ? section.teachers[0].id : '',
        });
        setIsModalOpen(true);
    };

    const openEditModal = (schedule: SectionSchedule) => {
        setEditingSchedule(schedule);
        setRepeatWeekdays(false);
        setFormError(null);
        setFormData({
            day: String(schedule.day),
            date: schedule.date ? schedule.date.slice(0, 10) : '',
            type: schedule.type || ScheduleType.OFFICIAL,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            room: schedule.room || '',
            roomId: schedule.roomId || section.defaultRoomId || '',
            teacherId: schedule.teacherId || (section.teachers?.length === 1 ? section.teachers[0].id : ''),
        });
        setIsModalOpen(true);
    };

    const adjustTime = (field: 'startTime' | 'endTime', minutes: number) => {
        setFormData((current) => ({
            ...current,
            [field]: addMinutesToTime(current[field], minutes),
        }));
    };

    const applyDurationPreset = (minutes: number) => {
        setFormData((current) => ({
            ...current,
            endTime: addMinutesToTime(current.startTime, minutes),
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;

        const target = editingSchedule;
        const processingId = target ? `schedule-edit-${target.id}` : 'schedule-create';
        const startMinutes = timeToMinutes(formData.startTime);
        const endMinutes = timeToMinutes(formData.endTime);

        if (endMinutes <= startMinutes) {
            setFormError('End time must be later than start time.');
            return;
        }
        if (formData.type === ScheduleType.AD_HOC && !formData.date) {
            setFormError('Ad-hoc schedules require a date.');
            return;
        }
        if (!formData.teacherId) {
            setFormError(section.teachers?.length ? 'Choose the teacher assigned to this schedule.' : 'Assign at least one teacher to this section before creating schedules.');
            return;
        }

        try {
            setFormError(null);
            dispatch({ type: 'UI_START_PROCESSING', payload: processingId });
            const payload = {
                ...(formData.date ? {} : { day: parseInt(formData.day, 10) }),
                date: formData.date || null,
                type: formData.type,
                startTime: formData.startTime,
                endTime: formData.endTime,
                room: undefined,
                roomId: formData.roomId || null,
                teacherId: formData.teacherId,
            };

            if (target) {
                await api.org.updateSchedule(section.id, target.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Schedule updated successfully', type: 'success' } });
            } else if (repeatWeekdays && !formData.date && formData.type === ScheduleType.OFFICIAL) {
                for (const day of WEEKDAY_VALUES) {
                    await api.org.createSchedule(section.id, { ...payload, day: parseInt(day, 10), date: null }, token);
                }
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Weekday schedule added successfully', type: 'success' } });
            } else {
                await api.org.createSchedule(section.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Schedule added successfully', type: 'success' } });
            }

            setIsModalOpen(false);
            setEditingSchedule(null);
            setRepeatWeekdays(false);
            setFormData({
                day: '1',
                date: '',
                type: ScheduleType.OFFICIAL,
                startTime: '09:00',
                endTime: '10:00',
                room: section.room || '',
                roomId: section.defaultRoomId || '',
                teacherId: section.teachers?.length === 1 ? section.teachers[0].id : '',
            });
            fetchSchedules();
        } catch (err: unknown) {
            const message = (err as ApiError)?.message || 'Error saving schedule';
            setFormError(message);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message, type: 'error' },
            });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: processingId });
        }
    };

    const handleDelete = async () => {
        if (!token || !deletingSchedule) return;
        const target = deletingSchedule;

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `schedule-delete-${target.id}` });
            await api.org.deleteSchedule(section.id, target.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Schedule removed successfully', type: 'success' } });
            setIsDeleteDialogOpen(false);
            setDeletingSchedule(null);
            fetchSchedules();
        } catch (err: unknown) {
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: (err as ApiError)?.message || 'Error deleting schedule', type: 'error' },
            });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `schedule-delete-${target.id}` });
        }
    };

    if (fetching && schedules.length === 0) {
        return (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                    <div key={index} className="h-32 min-w-0 animate-pulse rounded-lg border border-border/70 bg-muted/35" />
                ))}
            </div>
        );
    }

    if (error) {
        return <ErrorState error={error} onRetry={fetchSchedules} />;
    }

    return (
        <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-black text-foreground">{schedules.length} schedule slots</p>
                    <p className="wrap-break-word text-xs font-semibold text-muted-foreground">
                        Weekly meeting times for this section. <DocsLink href="/docs/timetable#schedule-teacher">Schedule guide</DocsLink>
                    </p>
                </div>
                {canManageSchedules && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        {canManageOfficialSchedules && (
                            <Button onClick={() => openCreateModal(ScheduleType.OFFICIAL)} icon={Plus} className="w-full sm:w-auto">
                                Add Official
                            </Button>
                        )}
                        {canManageAdHocSchedules && (
                            <Button onClick={() => openCreateModal(ScheduleType.AD_HOC)} icon={Plus} variant="secondary" className="w-full sm:w-auto">
                                Add Ad-hoc
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {schedules.length === 0 ? (
                <div className="min-w-0 rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center sm:px-6">
                    <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/45" />
                    <p className="mt-3 text-sm font-black text-foreground">No schedule slots defined</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Add recurring class times so attendance and timetable views stay aligned.</p>
                </div>
            ) : (
                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {schedules.map((schedule) => (
                        <article
                            key={schedule.id}
                            className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:p-4"
                            style={getSectionSurfaceStyle(section, '08', '38')}
                        >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Badge variant="neutral" size="sm" icon={CalendarDays} color={section.color}>
                                        {schedule.date ? getDateLabel(schedule.date) : getDayLabel(schedule.day)}
                                    </Badge>
                                    {schedule.type === ScheduleType.AD_HOC && (
                                        <Badge variant="warning" size="sm" className="mt-2">
                                            Ad-hoc
                                        </Badge>
                                    )}
                                    <p className="mt-3 text-lg font-black leading-tight text-foreground">
                                        {schedule.startTime} - {schedule.endTime}
                                    </p>
                                </div>
                                {canManageSchedule(schedule) && (
                                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(schedule)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                            aria-label={`Edit ${getDayLabel(schedule.day)} schedule`}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeletingSchedule(schedule);
                                                setIsDeleteDialogOpen(true);
                                            }}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-danger/25 text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                                            aria-label={`Delete ${getDayLabel(schedule.day)} schedule`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 grid min-w-0 gap-2">
                                <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground">
                                    <Clock className="h-4 w-4 shrink-0 text-primary" />
                                    <span className="min-w-0 truncate">{schedule.startTime} to {schedule.endTime}</span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground">
                                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                                    <span className="min-w-0 truncate">
                                        {schedule.roomRef
                                            ? formatRoomLabel(schedule.roomRef)
                                            : section.defaultRoom
                                                ? formatRoomLabel(section.defaultRoom)
                                                : schedule.room || section.room || 'Room TBD'}
                                    </span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground">
                                    <UserRound className="h-4 w-4 shrink-0 text-primary" />
                                    <span className="min-w-0 truncate">{getScheduleTeacherLabel(schedule)}</span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <ModalForm
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingSchedule(null);
                    setRepeatWeekdays(false);
                    setFormError(null);
                }}
                title={editingSchedule ? 'Edit Section Schedule' : formData.type === ScheduleType.AD_HOC ? 'Add Ad-hoc Schedule' : 'Add Official Schedule'}
                onSubmit={handleSubmit}
                isSubmitting={state.ui.processing[editingSchedule ? `schedule-edit-${editingSchedule.id}` : 'schedule-create']}
                loadingId={editingSchedule ? `schedule-edit-${editingSchedule.id}` : 'schedule-create'}
                submitText={editingSchedule ? 'Update Schedule' : repeatWeekdays ? 'Save 5 Weekday Slots' : formData.type === ScheduleType.AD_HOC ? 'Save Ad-hoc Schedule' : 'Save Schedule'}
                maxWidth="max-w-2xl"
                bodyClassName="p-0"
                showSubmit
                feedback={formError ? (
                    <StatusBanner
                        title="Schedule could not be saved"
                        description={formError}
                        variant="danger"
                    />
                ) : undefined}
            >
                <div className="space-y-4 p-1 sm:p-2">
                    <div className="rounded-lg border border-border/70 bg-muted/25 p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-foreground">Slot pattern</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                    {editingSchedule ? 'Editing updates this schedule slot only.' : 'Create one day or repeat the same slot Monday through Friday.'} <DocsLink href="/docs/timetable#weekday-repeat">Repeat guide</DocsLink>
                                </p>
                            </div>
                            {!editingSchedule && formData.type === ScheduleType.OFFICIAL && (
                                <Toggle
                                    checked={repeatWeekdays}
                                    onCheckedChange={setRepeatWeekdays}
                                    disabled={Boolean(formData.date)}
                                    label="All weekdays"
                                    description="Mon-Fri"
                                    size="md"
                                    className="rounded-md border border-border/70 bg-background/60 p-2"
                                />
                            )}
                        </div>

                        <div className="mt-3 space-y-2">
                            <Label htmlFor="scheduleDate">{formData.type === ScheduleType.AD_HOC ? 'Class Date' : 'Specific Date'}</Label>
                            <Input
                                id="scheduleDate"
                                type="date"
                                required={formData.type === ScheduleType.AD_HOC}
                                value={formData.date}
                                onChange={(event) => {
                                    const nextDate = event.target.value;
                                    setRepeatWeekdays(false);
                                    setFormData({ ...formData, date: nextDate });
                                }}
                            />
                        </div>

                        {repeatWeekdays && !formData.date ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {WEEKDAY_VALUES.map((day) => (
                                    <Badge key={day} variant="primary" size="sm" icon={CalendarRange}>
                                        {getDayLabel(Number(day)).slice(0, 3)}
                                    </Badge>
                                ))}
                            </div>
                        ) : !formData.date && formData.type === ScheduleType.OFFICIAL ? (
                            <div className="mt-3 space-y-2">
                                <Label>Day of Week</Label>
                                <CustomSelect
                                    options={DAY_OPTIONS}
                                    value={formData.day}
                                    onChange={(value) => setFormData({ ...formData, day: value })}
                                    placeholder="Select Day"
                                    required
                                />
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <Label htmlFor="startTime">Start Time</Label>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => adjustTime('startTime', -60)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        aria-label="Move start time back 1 hour"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => adjustTime('startTime', 60)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        aria-label="Move start time forward 1 hour"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <Input
                                id="startTime"
                                type="time"
                                required
                                value={formData.startTime}
                                onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
                            />
                        </div>
                        <div className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <Label htmlFor="endTime">End Time</Label>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => adjustTime('endTime', -60)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        aria-label="Move end time back 1 hour"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => adjustTime('endTime', 60)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        aria-label="Move end time forward 1 hour"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <Input
                                id="endTime"
                                type="time"
                                required
                                value={formData.endTime}
                                onChange={(event) => setFormData({ ...formData, endTime: event.target.value })}
                            />
                        </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                                <Clock className="h-4 w-4 shrink-0 text-primary" />
                                <span>{formData.startTime} to {formData.endTime}</span>
                                <Badge variant={timeToMinutes(formData.endTime) > timeToMinutes(formData.startTime) ? 'neutral' : 'error'} size="sm">
                                    {getDurationLabel(formData.startTime, formData.endTime)}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {DURATION_PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => applyDurationPreset(preset.minutes)}
                                        className="min-h-8 rounded-md border border-border/70 bg-card px-2.5 text-xs font-black text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                        <Label>Teacher</Label>
                        {singleTeacher ? (
                            <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm font-bold text-foreground">
                                <UserRound className="h-4 w-4 shrink-0 text-primary" />
                                <span className="min-w-0 truncate">{singleTeacher.user?.name || singleTeacher.user?.email || 'Unnamed teacher'}</span>
                            </div>
                        ) : (
                            <CustomSelect
                                options={teacherOptions}
                                value={formData.teacherId}
                                onChange={(value) => setFormData({ ...formData, teacherId: value })}
                                placeholder={teacherOptions.length ? 'Select teacher' : 'Assign teachers to this section first'}
                                searchable
                                required
                            />
                        )}
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="room">Room</Label>
                            {(section.defaultRoom || section.room) && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, roomId: section.defaultRoomId || '', room: section.room || '' })}
                                    className="rounded-md px-2 py-1 text-xs font-black text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                >
                                    Use section room
                                </button>
                            )}
                        </div>
                        <CustomSelect
                            options={roomOptions}
                            value={formData.roomId || ''}
                            onChange={(value) => setFormData({ ...formData, roomId: value })}
                            placeholder={section.defaultRoom ? `Default: ${formatRoomLabel(section.defaultRoom)}` : section.room ? `Legacy: ${section.room}` : 'Select room'}
                            searchable
                        />
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title="Remove Schedule Slot"
                description="Are you sure you want to remove this schedule slot? This action cannot be undone."
                confirmText="Remove Slot"
                isDestructive={true}
                loadingId={deletingSchedule ? `schedule-delete-${deletingSchedule.id}` : undefined}
            />
        </div>
    );
});
