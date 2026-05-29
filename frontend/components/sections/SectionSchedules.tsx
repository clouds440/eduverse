'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { CalendarDays, Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError, SectionSchedule, Section, Role } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { ModalForm } from '@/components/ui/ModalForm';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';

const DAY_OPTIONS = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
];

interface SectionSchedulesProps {
    section: Section;
    role: Role;
}

function getDayLabel(day: number) {
    return DAY_OPTIONS.find((option) => option.value === String(day))?.label || 'Unknown';
}

export default memo(function SectionSchedules({ section, role }: SectionSchedulesProps) {
    const { token } = useAuth();
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
        startTime: '09:00',
        endTime: '10:00',
        room: section.room || '',
    });

    const isManagerOrAdmin = role === Role.ORG_ADMIN || role === Role.ORG_MANAGER;

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

    const openCreateModal = () => {
        setEditingSchedule(null);
        setFormData({
            day: '1',
            startTime: '09:00',
            endTime: '10:00',
            room: section.room || '',
        });
        setIsModalOpen(true);
    };

    const openEditModal = (schedule: SectionSchedule) => {
        setEditingSchedule(schedule);
        setFormData({
            day: String(schedule.day),
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            room: schedule.room || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;

        const target = editingSchedule;
        const processingId = target ? `schedule-edit-${target.id}` : 'schedule-create';

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: processingId });
            const payload = {
                day: parseInt(formData.day, 10),
                startTime: formData.startTime,
                endTime: formData.endTime,
                room: formData.room || undefined,
            };

            if (target) {
                await api.org.updateSchedule(section.id, target.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Schedule updated successfully', type: 'success' } });
            } else {
                await api.org.createSchedule(section.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Schedule added successfully', type: 'success' } });
            }

            setIsModalOpen(false);
            setEditingSchedule(null);
            setFormData({
                day: '1',
                startTime: '09:00',
                endTime: '10:00',
                room: section.room || '',
            });
            fetchSchedules();
        } catch (err: unknown) {
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: (err as ApiError)?.message || 'Error saving schedule', type: 'error' },
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
                    <p className="break-words text-xs font-semibold text-muted-foreground">Weekly meeting times for this section.</p>
                </div>
                {isManagerOrAdmin && (
                    <Button onClick={openCreateModal} icon={Plus} className="w-full sm:w-auto">
                        Add Schedule
                    </Button>
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
                        <article key={schedule.id} className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Badge variant="primary" size="sm" icon={CalendarDays}>
                                        {getDayLabel(schedule.day)}
                                    </Badge>
                                    <p className="mt-3 text-lg font-black leading-tight text-foreground">
                                        {schedule.startTime} - {schedule.endTime}
                                    </p>
                                </div>
                                {isManagerOrAdmin && (
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
                                    <span className="min-w-0 truncate">{schedule.room || section.room || 'Room TBD'}</span>
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
                }}
                title={editingSchedule ? 'Edit Section Schedule' : 'Add Section Schedule'}
                onSubmit={handleSubmit}
                isSubmitting={state.ui.processing[editingSchedule ? `schedule-edit-${editingSchedule.id}` : 'schedule-create']}
                loadingId={editingSchedule ? `schedule-edit-${editingSchedule.id}` : 'schedule-create'}
                submitText={editingSchedule ? 'Update Schedule' : 'Save Schedule'}
                showSubmit
            >
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Day of Week</Label>
                        <CustomSelect
                            options={DAY_OPTIONS}
                            value={formData.day}
                            onChange={(value) => setFormData({ ...formData, day: value })}
                            placeholder="Select Day"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input
                                id="startTime"
                                type="time"
                                required
                                value={formData.startTime}
                                onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endTime">End Time</Label>
                            <Input
                                id="endTime"
                                type="time"
                                required
                                value={formData.endTime}
                                onChange={(event) => setFormData({ ...formData, endTime: event.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="room">Room (Optional)</Label>
                        <Input
                            id="room"
                            type="text"
                            placeholder="Override section room"
                            value={formData.room}
                            onChange={(event) => setFormData({ ...formData, room: event.target.value })}
                            icon={MapPin}
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
