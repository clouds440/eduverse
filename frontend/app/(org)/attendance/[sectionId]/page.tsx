'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefixStartsWith } from '@/lib/swr';
import { api } from '@/lib/api';
import { ApiError, SectionAttendanceResponse, AttendanceStatus, Role, Section, RangeAttendanceResponse, SectionSchedule } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Loading } from '@/components/ui/Loading';
import { Badge } from '@/components/ui/Badge';
import AttendanceSheet from '@/components/sections/AttendanceSheet';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CalendarDays, BarChart3, Edit3, ChevronLeft, ChevronRight, Clock, Table2, FileUp } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { PageHeader } from '@/components/ui/PageShell';
import { cn, getSectionTintStyle } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { AttendanceMonthlyImportModal } from '@/components/imports/AttendanceMonthlyImportModal';

function parseDateInput(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatDateInput(dateValue: Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDayOfWeek(dateStr: string) {
    return parseDateInput(dateStr).getDay();
}

export default function SectionAttendancePage() {
    const { sectionId } = useParams() as { sectionId: string };
    const searchParams = useSearchParams();
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const paramDate = searchParams.get('date');
    const paramScheduleId = searchParams.get('scheduleId');

    const [date, setDate] = useState<string>(paramDate || new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [saving, setSaving] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(paramScheduleId);
    const [adhocTime, setAdhocTime] = useState({ start: '09:00', end: '10:00' });
    const [importOpen, setImportOpen] = useState(false);

    const isStudent = user?.role === Role.STUDENT;
    const isReadOnly = isStudent;
    const canImportAttendance = !isStudent && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER || user?.role === Role.ORG_ADMIN);
    const selectedDayLabel = useMemo(
        () => parseDateInput(date).toLocaleDateString('en-US', { weekday: 'long' }),
        [date]
    );
    const selectedDateLabel = useMemo(
        () => parseDateInput(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        [date]
    );

    useEffect(() => {
        if (isStudent && viewMode !== 'monthly') {
            setViewMode('monthly');
        }
    }, [isStudent, viewMode]);

    const sectionKey = token ? ['attendance-section', sectionId] as const : null;
    const { data: section, error: sectionError } = useSWR<Section>(sectionKey);

    useEffect(() => {
        if (section && !paramScheduleId && section.schedules) {
            const matched = section.schedules.find((schedule: SectionSchedule) => schedule.day === getDayOfWeek(date));
            if (matched) setSelectedScheduleId(matched.id);
        }
    }, [section, paramScheduleId, date]);

    useEffect(() => {
        if (sectionError) {
            console.error('Failed to fetch section', sectionError);
            router.push('/attendance');
        }
    }, [sectionError, router]);

    const dailyKey = token && viewMode === 'daily' ? ['attendance-daily', sectionId, date, selectedScheduleId || undefined] as const : null;
    const { data: dailyData, isLoading: dailyLoading } = useSWR<SectionAttendanceResponse>(dailyKey);

    const monthlyStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    const monthlyEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
    const monthlyKey = token && viewMode === 'monthly' ? ['attendance-monthly', sectionId, monthlyStart, monthlyEnd] as const : null;
    const { data: rangeData, isLoading: monthlyLoading } = useSWR<RangeAttendanceResponse>(monthlyKey);

    const fetching = viewMode === 'daily' ? dailyLoading : monthlyLoading;

    const scheduleOptions = useMemo(() => [
        ...(section?.schedules?.filter((schedule: SectionSchedule) => schedule.day === getDayOfWeek(date)) || []).map((schedule: SectionSchedule) => ({
            value: schedule.id,
            label: `${schedule.startTime} - ${schedule.endTime} (${schedule.room || 'Main Room'})`,
        })),
        { value: 'adhoc', label: 'Ad-hoc Session' },
    ], [date, section?.schedules]);

    const syncScheduleForDate = useCallback((nextDate: string) => {
        if (!section?.schedules) return;
        const matches = section.schedules.filter((schedule: SectionSchedule) => schedule.day === getDayOfWeek(nextDate));
        setSelectedScheduleId(matches.length > 0 ? matches[0].id : null);
    }, [section?.schedules]);

    const handleDateChange = useCallback((nextDate: string) => {
        setDate(nextDate);
        syncScheduleForDate(nextDate);
    }, [syncScheduleForDate]);

    const handleDateStep = useCallback((direction: 'prev' | 'next') => {
        const nextDate = parseDateInput(date);
        nextDate.setDate(nextDate.getDate() + (direction === 'next' ? 1 : -1));
        handleDateChange(formatDateInput(nextDate));
    }, [date, handleDateChange]);

    const handleSaveRecords = async (records: { studentId: string; status: AttendanceStatus }[]) => {
        if (!token || !dailyData) return;
        setSaving(true);
        try {
            let sessionId = dailyData.sessionId;
            if (!sessionId) {
                const sessionResponse = await api.org.createAttendanceSession(
                    sectionId,
                    date,
                    token,
                    selectedScheduleId || undefined,
                    !selectedScheduleId ? adhocTime.start : undefined,
                    !selectedScheduleId ? adhocTime.end : undefined
                );
                sessionId = sessionResponse.id;
            }
            await api.org.markAttendance(sessionId as string, records, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Attendance saved successfully', type: 'success' } });
            mutate(matchesCacheKeyPrefixStartsWith('attendance-'));
        } catch (error: unknown) {
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: (error as ApiError)?.message || 'Failed to save attendance', type: 'error' },
            });
        } finally {
            setSaving(false);
        }
    };

    const handleMonthChange = (dir: 'prev' | 'next') => {
        if (dir === 'prev') {
            if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(prev => prev - 1);
            } else {
                setCurrentMonth(prev => prev - 1);
            }
        } else if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    if (!user || (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER && user.role !== Role.ORG_ADMIN && user.role !== Role.STUDENT)) return null;

    const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });
    const studentCount = dailyData?.students.length || rangeData?.students.length || section?.studentsCount || section?.students?.length || 0;
    const sessionCount = rangeData?.sessions.length || 0;

    return (
        <div className="mx-auto flex w-full flex-1 flex-col gap-4 pb-8">
            <div className="flex flex-col gap-3 p-2 lg:p-0">
                <PageHeader
                    title={<CourseSectionLabel section={section} courseName={section?.course?.name} sectionName={section?.name} />}
                    description="Attendance workbook with daily marking and monthly review."
                    icon={CalendarDays}
                    meta={(
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral" dot size="md" style={getSectionTintStyle(section)}>
                                {section?.course?.name || 'Course'}
                            </Badge>
                            <Badge variant="secondary" size="md" icon={Table2}>
                                {studentCount} students
                            </Badge>
                            {viewMode === 'monthly' && (
                                <Badge variant="info" size="md">
                                    {sessionCount} sessions
                                </Badge>
                            )}
                        </div>
                    )}
                    actions={(
                        <div className="flex flex-wrap items-center gap-2">
                            {canImportAttendance && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon={FileUp}
                                    onClick={() => setImportOpen(true)}
                                    className="h-10"
                                >
                                    Import CSV
                                </Button>
                            )}
                            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-background p-1">
                                {!isStudent && (
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('daily')}
                                        className={cn(
                                            'flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition-colors',
                                            viewMode === 'daily' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card'
                                        )}
                                    >
                                        <Edit3 className="h-4 w-4" />
                                        Mark
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setViewMode('monthly')}
                                    className={cn(
                                        'flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition-colors',
                                        viewMode === 'monthly' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card',
                                        isStudent && 'col-span-2'
                                    )}
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    Overview
                                </button>
                            </div>
                        </div>
                    )}
                />

                <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">

                    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(300px,360px)_minmax(280px,1fr)] xl:grid-cols-[minmax(330px,380px)_minmax(320px,1fr)_minmax(300px,360px)] xl:items-start">
                        {viewMode === 'daily' ? (
                            <>
                                <div className="min-w-0 space-y-2">
                                    <Label htmlFor="datePicker" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        <CalendarDays className="h-4 w-4 text-primary" />
                                        Date
                                    </Label>
                                    <div className="space-y-1.5">
                                        <div className="flex min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border/70 bg-background p-1">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                icon={ChevronLeft}
                                                onClick={() => handleDateStep('prev')}
                                                className="h-9 w-9 shrink-0 rounded-lg px-0 py-0 shadow-none"
                                                title="Previous day"
                                            />
                                            <Input
                                                id="datePicker"
                                                type="date"
                                                value={date}
                                                onChange={(event) => handleDateChange(event.target.value)}
                                                className="h-9 min-w-55 flex-1 rounded-lg border-border/60 bg-card/80 px-3 text-sm font-bold shadow-none"
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                icon={ChevronRight}
                                                onClick={() => handleDateStep('next')}
                                                className="h-9 w-9 shrink-0 rounded-lg px-0 py-0 shadow-none"
                                                title="Next day"
                                            />
                                        </div>
                                        <p className="px-1 text-xs font-black text-primary">
                                            {selectedDayLabel}
                                            <span className="ml-2 font-semibold text-muted-foreground">{selectedDateLabel}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="min-w-0 space-y-2">
                                    <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        <Clock className="h-4 w-4 text-primary" />
                                        Time Slot
                                    </Label>
                                    <CustomSelect
                                        value={selectedScheduleId || 'adhoc'}
                                        onChange={(value) => setSelectedScheduleId(value === 'adhoc' ? null : value)}
                                        options={scheduleOptions}
                                        className="min-w-0 max-h-11.5"
                                    />
                                </div>

                                {!selectedScheduleId && (
                                    <div className="min-w-0 space-y-2 lg:col-span-2 xl:col-span-1">
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ad-hoc</Label>
                                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                                            <div className="min-w-0">
                                                <Input
                                                    type="time"
                                                    value={adhocTime.start}
                                                    onChange={(event) => setAdhocTime(prev => ({ ...prev, start: event.target.value }))}
                                                    className="h-10 w-full min-w-0 border-border/60 bg-background/70 text-sm font-bold"
                                                />
                                            </div>
                                            <span className="hidden text-center text-[10px] font-black text-muted-foreground sm:block">to</span>
                                            <div className="min-w-0">
                                                <Input
                                                    type="time"
                                                    value={adhocTime.end}
                                                    onChange={(event) => setAdhocTime(prev => ({ ...prev, end: event.target.value }))}
                                                    className="h-10 w-full min-w-0 border-border/60 bg-background/70 text-sm font-bold"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex w-full flex-col sm:flex-row gap-2">
                                <Label className="flex min-w-fit items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    <CalendarDays className="h-4 w-4 text-primary" />
                                    Display Month
                                </Label>
                                <div className="flex items-center gap-2 rounded-xl justify-between w-full sm:w-fit border border-border/70 bg-background p-1">
                                    <Button variant="secondary" icon={ChevronLeft} className="h-9 w-9 px-0 py-0" onClick={() => handleMonthChange('prev')} />
                                    <span className="min-w-32 text-center text-xs font-black text-foreground">
                                        {monthName} {currentYear}
                                    </span>
                                    <Button variant="secondary" icon={ChevronRight} className="h-9 w-9 px-0 py-0" onClick={() => handleMonthChange('next')} />
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {(fetching && (viewMode === 'daily' ? !dailyData : !rangeData)) ? (
                <div className="flex justify-center rounded-2xl border border-border/70 bg-card/80 p-20 shadow-sm">
                    <Loading size="lg" />
                </div>
            ) : viewMode === 'daily' ? (
                dailyData && <AttendanceSheet students={dailyData.students} date={dailyData.date} onSave={handleSaveRecords} isSaving={saving} mode="daily" readOnly={isReadOnly} />
            ) : (
                rangeData && <AttendanceSheet students={[]} mode="monthly" rangeData={rangeData} readOnly={isReadOnly} />
            )}
            <AttendanceMonthlyImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                sectionId={sectionId}
                initialYear={currentYear}
                initialMonth={currentMonth + 1}
            />
        </div>
    );
}
