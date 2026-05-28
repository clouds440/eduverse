'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SectionAttendanceStudent, AttendanceStatus, RangeAttendanceResponse, Role } from '@/types';
import { Button } from '@/components/ui/Button';
import { Check, X, Clock, FileWarning, Save, CheckSquare, Activity, Search, Rows3, Percent, Circle, RotateCcw } from 'lucide-react';
import { BrandIcon } from '../ui/Brand';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '@/lib/utils';

interface AttendanceSheetProps {
    students: SectionAttendanceStudent[];
    date?: string;
    readOnly?: boolean;
    onSave?: (records: { studentId: string; status: AttendanceStatus }[]) => void;
    isSaving?: boolean;
    mode?: 'daily' | 'monthly';
    rangeData?: RangeAttendanceResponse;
}

type AttendanceRangeRecord = RangeAttendanceResponse['students'][number]['records'][number];
type AttendanceSession = RangeAttendanceResponse['sessions'][number];

const STATUS_META: Record<AttendanceStatus, {
    short: string;
    label: string;
    icon: React.ElementType;
    chip: string;
    cell: string;
}> = {
    [AttendanceStatus.PRESENT]: {
        short: 'P',
        label: 'Present',
        icon: Check,
        chip: 'border-success/30 bg-success/10 text-success',
        cell: 'bg-success/10 text-success',
    },
    [AttendanceStatus.ABSENT]: {
        short: 'A',
        label: 'Absent',
        icon: X,
        chip: 'border-danger/30 bg-danger/10 text-danger',
        cell: 'bg-danger/10 text-danger',
    },
    [AttendanceStatus.LATE]: {
        short: 'L',
        label: 'Late',
        icon: Clock,
        chip: 'border-warning/30 bg-warning/10 text-warning',
        cell: 'bg-warning/10 text-warning',
    },
    [AttendanceStatus.EXCUSED]: {
        short: 'E',
        label: 'Excused',
        icon: FileWarning,
        chip: 'border-info/30 bg-info/10 text-info',
        cell: 'bg-info/10 text-info',
    },
};

const STATUS_ORDER = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.LATE,
    AttendanceStatus.EXCUSED,
];

function formatDateLabel(value: string) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatWeekday(value: string) {
    return new Date(value).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(value?: string | null) {
    return value ? value.slice(0, 5) : '';
}

function getSessionTime(session: AttendanceSession) {
    const start = session.startTime || session.schedule?.startTime;
    const end = session.endTime || session.schedule?.endTime;
    if (start && end) return `${formatTime(start)}-${formatTime(end)}`;
    return session.isAdhoc ? 'Ad-hoc' : 'Session';
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-card/70 px-6 py-16 text-center">
            <Rows3 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-black text-foreground">{label}</p>
            <p className="text-xs font-semibold text-muted-foreground">Try a different search or date range.</p>
        </div>
    );
}

export default function AttendanceSheet({
    students: initialStudents,
    date,
    readOnly: forcedReadOnly,
    onSave,
    isSaving,
    mode = 'daily',
    rangeData,
}: AttendanceSheetProps) {
    const { user } = useAuth();
    const isStudent = user?.role === Role.STUDENT;
    const readOnly = forcedReadOnly || isStudent;
    const [searchTerm, setSearchTerm] = useState('');
    const [isMonthlyStudentRail, setIsMonthlyStudentRail] = useState(false);
    const [breakdownVisible, setBreakdownVisible] = useState({ official: true, adhoc: false });
    const [isResetAllConfirmOpen, setIsResetAllConfirmOpen] = useState(false);
    const scrollFrameRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
            }
        };
    }, []);

    const students = useMemo(() => {
        if (!searchTerm) return initialStudents;
        const lowSearch = searchTerm.toLowerCase();
        return initialStudents.filter(student =>
            student.name.toLowerCase().includes(lowSearch) ||
            (student.rollNumber || student.registrationNumber || '').toLowerCase().includes(lowSearch)
        );
    }, [initialStudents, searchTerm]);

    const displayRangeStudents = useMemo(() => {
        const base = (mode === 'monthly' && rangeData) ? rangeData.students : [];
        if (!searchTerm) return base;
        const lowSearch = searchTerm.toLowerCase();
        return base.filter(student =>
            student.name.toLowerCase().includes(lowSearch) ||
            (student.rollNumber || student.registrationNumber || '').toLowerCase().includes(lowSearch)
        );
    }, [mode, rangeData, searchTerm]);

    const dailySeedKey = useMemo(
        () => initialStudents.map((student) => `${student.studentId}:${student.status ?? 'null'}`).join('|'),
        [initialStudents],
    );

    const dailyInitialRecords = useMemo(() => {
        const init: Record<string, AttendanceStatus | null> = {};
        initialStudents.forEach((student) => {
            init[student.studentId] = student.status;
        });
        return init;
    }, [initialStudents]);

    const [draft, setDraft] = useState<{
        seedKey: string;
        values: Record<string, AttendanceStatus | null>;
        dirty: boolean;
    }>({
        seedKey: '',
        values: {},
        dirty: false,
    });

    // Saved attendance stays in dailyInitialRecords; draftRecords only tracks the marks the user is about to save.
    const draftRecords = useMemo(() => (
        mode === 'daily' && draft.seedKey === dailySeedKey
            ? draft.values
            : {}
    ), [dailySeedKey, draft.seedKey, draft.values, mode]);

    const hasSaveableDraft = useMemo(
        () => Object.values(draftRecords).some((status) => status !== null && status !== undefined),
        [draftRecords],
    );

    const hasChanges = mode === 'daily' && draft.seedKey === dailySeedKey && draft.dirty && hasSaveableDraft;

    const dailySummary = useMemo(() => {
        const summary = {
            total: initialStudents.length,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            unmarked: 0,
        };

        initialStudents.forEach((student) => {
            const status = draftRecords[student.studentId] ?? null;
            if (status === AttendanceStatus.PRESENT) summary.present++;
            else if (status === AttendanceStatus.ABSENT) summary.absent++;
            else if (status === AttendanceStatus.LATE) summary.late++;
            else if (status === AttendanceStatus.EXCUSED) summary.excused++;
            else summary.unmarked++;
        });

        return summary;
    }, [draftRecords, initialStudents]);

    const handleStatusChange = useCallback((studentId: string, status: AttendanceStatus) => {
        if (readOnly) return;
        setDraft((prev) => ({
            seedKey: dailySeedKey,
            values: {
                ...(prev.seedKey === dailySeedKey ? prev.values : {}),
                [studentId]: status,
            },
            dirty: true,
        }));
    }, [dailySeedKey, readOnly]);

    const handleMarkAllPresent = useCallback(() => {
        if (readOnly) return;
        const out: Record<string, AttendanceStatus | null> = {};
        initialStudents.forEach(student => {
            out[student.studentId] = AttendanceStatus.PRESENT;
        });
        setDraft({
            seedKey: dailySeedKey,
            values: out,
            dirty: true,
        });
    }, [dailySeedKey, initialStudents, readOnly]);

    const handleResetAllSelections = useCallback(() => {
        if (readOnly) return;
        setDraft({
            seedKey: dailySeedKey,
            values: {},
            dirty: false,
        });
    }, [dailySeedKey, readOnly]);

    const handleResetStudentSelection = useCallback((studentId: string) => {
        if (readOnly) return;
        setDraft((prev) => {
            const base = prev.seedKey === dailySeedKey ? prev.values : {};
            const values = {
                ...base,
                [studentId]: null,
            };
            const dirty = Object.values(values).some((status) => status !== null && status !== undefined);
            return {
                seedKey: dailySeedKey,
                values,
                dirty,
            };
        });
    }, [dailySeedKey, readOnly]);

    const handleSave = useCallback(() => {
        if (!onSave) return;
        const recordsToSave = Object.entries(draftRecords)
            .filter((entry): entry is [string, AttendanceStatus] => entry[1] !== null && entry[1] !== undefined)
            .map(([studentId, status]) => ({ studentId, status }));
        if (recordsToSave.length === 0) return;
        onSave(recordsToSave);
        setDraft((prev) => ({
            ...prev,
            seedKey: dailySeedKey,
            dirty: false,
        }));
    }, [dailySeedKey, draftRecords, onSave]);

    const handleMonthlyScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        const scrollLeft = event.currentTarget.scrollLeft;
        if (scrollFrameRef.current !== null) {
            window.cancelAnimationFrame(scrollFrameRef.current);
        }
        scrollFrameRef.current = window.requestAnimationFrame(() => {
            setIsMonthlyStudentRail((current) => {
                const next = scrollLeft > 48;
                return current === next ? current : next;
            });
        });
    }, []);

    const handleBreakdownToggle = useCallback((key: 'official' | 'adhoc') => {
        setBreakdownVisible((current) => {
            const next = { ...current, [key]: !current[key] };
            return next.official || next.adhoc ? next : current;
        });
    }, []);

    const SearchControl = (
        <div className="relative w-full md:max-w-xs" role="search">
            <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-10 border-border/60 bg-background/70 pl-10 text-sm font-medium"
                aria-label="Search students"
            />
        </div>
    );

    if (mode === 'monthly' && rangeData) {
        const sessionById = new Map((rangeData.sessions || []).map((session) => [session.id, session] as const));
        const sortedSessions = [...rangeData.sessions].sort((a, b) => {
            const byDate = String(a.date).localeCompare(String(b.date));
            if (byDate !== 0) return byDate;
            return getSessionTime(a).localeCompare(getSessionTime(b));
        });

        const monthlyStudentsAnalytics = new Map<string, {
            recordsBySessionId: Map<string, AttendanceRangeRecord>;
            officialTotal: number;
            present: number;
            absent: number;
            late: number;
            excused: number;
            adhocTotal: number;
            adhocPresent: number;
            adhocAbsent: number;
            adhocLate: number;
            adhocExcused: number;
            adhocPercentage: number;
            officialPercentage: number;
            overallTotal: number;
            overallPercentage: number;
        }>();

        displayRangeStudents.forEach((student) => {
            const recordsBySessionId = new Map<string, AttendanceRangeRecord>();
            let officialTotal = 0;
            let present = 0;
            let absent = 0;
            let late = 0;
            let excused = 0;
            let adhocTotal = 0;
            let adhocPresent = 0;
            let adhocAbsent = 0;
            let adhocLate = 0;
            let adhocExcused = 0;
            let overallTotal = 0;
            let overallPresent = 0;

            student.records.forEach((record) => {
                recordsBySessionId.set(record.sessionId, record);
                if (record.status !== null) {
                    const session = sessionById.get(record.sessionId);
                    if (session && !session.isAdhoc) {
                        officialTotal++;
                        if (record.status === AttendanceStatus.PRESENT) present++;
                        else if (record.status === AttendanceStatus.ABSENT) absent++;
                        else if (record.status === AttendanceStatus.LATE) late++;
                        else if (record.status === AttendanceStatus.EXCUSED) excused++;
                    } else if (session?.isAdhoc) {
                        adhocTotal++;
                        if (record.status === AttendanceStatus.PRESENT) adhocPresent++;
                        else if (record.status === AttendanceStatus.ABSENT) adhocAbsent++;
                        else if (record.status === AttendanceStatus.LATE) adhocLate++;
                        else if (record.status === AttendanceStatus.EXCUSED) adhocExcused++;
                    }

                    overallTotal++;
                    if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
                        overallPresent++;
                    }
                }
            });

            const officialPresent = present + late;
            const adhocPresentCount = adhocPresent + adhocLate;
            monthlyStudentsAnalytics.set(student.studentId, {
                recordsBySessionId,
                officialTotal,
                present,
                absent,
                late,
                excused,
                adhocTotal,
                adhocPresent,
                adhocAbsent,
                adhocLate,
                adhocExcused,
                adhocPercentage: adhocTotal > 0 ? Math.round((adhocPresentCount / adhocTotal) * 100) : 100,
                officialPercentage: officialTotal > 0 ? Math.round((officialPresent / officialTotal) * 100) : 100,
                overallTotal,
                overallPercentage: overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 100,
            });
        });

        return (
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border/60 bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                            <Activity className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-black text-foreground">Monthly Attendance Grid</h2>
                            <p className="text-xs font-semibold text-muted-foreground">{sortedSessions.length} sessions across {displayRangeStudents.length} students</p>
                        </div>
                    </div>
                    {SearchControl}
                </div>

                {displayRangeStudents.length === 0 ? (
                    <div className="p-4">
                        <EmptyState label="No attendance rows found" />
                    </div>
                ) : (
                    <div className="overflow-x-auto" onScroll={handleMonthlyScroll}>
                        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-background text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <th className="w-12 border-b border-r border-border/70 bg-background px-2 py-2 text-center">#</th>
                                    <th className={cn(
                                        'sticky left-0 z-30 border-b border-r border-border/70 bg-background py-2 transition-[min-width,width,padding] duration-200',
                                        isMonthlyStudentRail ? 'w-14 min-w-14 px-2 text-center' : 'min-w-60 px-3'
                                    )}>
                                        {isMonthlyStudentRail ? 'ST' : 'Student'}
                                    </th>
                                    {sortedSessions.map((session) => (
                                        <th key={session.id} className="min-w-24 border-b border-r border-border/70 bg-background px-2 py-2 text-center align-bottom">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-foreground">{formatDateLabel(String(session.date))}</span>
                                                <span>{formatWeekday(String(session.date))}</span>
                                                <span className="font-mono text-[9px] normal-case tracking-normal text-muted-foreground">{getSessionTime(session)}</span>
                                                {session.isAdhoc && <span className="rounded bg-warning/10 px-1 text-[8px] text-warning">adhoc</span>}
                                            </div>
                                        </th>
                                    ))}
                                    <th className={cn(
                                        'border-b border-border/70 bg-background px-3 py-2 text-center',
                                        breakdownVisible.official && breakdownVisible.adhoc ? 'min-w-72' : 'min-w-60'
                                    )}>
                                        <div className="flex flex-col items-center gap-1">
                                            <span>Breakdown</span>
                                            <div className="flex items-center justify-center gap-2 normal-case tracking-normal">
                                                <label className="inline-flex items-center gap-1 text-[9px] font-black text-muted-foreground">
                                                    <input
                                                        type="checkbox"
                                                        checked={breakdownVisible.official}
                                                        onChange={() => handleBreakdownToggle('official')}
                                                        className="h-3 w-3 accent-primary"
                                                    />
                                                    Official
                                                </label>
                                                <label className="inline-flex items-center gap-1 text-[9px] font-black text-muted-foreground">
                                                    <input
                                                        type="checkbox"
                                                        checked={breakdownVisible.adhoc}
                                                        onChange={() => handleBreakdownToggle('adhoc')}
                                                        className="h-3 w-3 accent-primary"
                                                    />
                                                    Ad-hoc
                                                </label>
                                            </div>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRangeStudents.map((student, index) => {
                                    const stats = monthlyStudentsAnalytics.get(student.studentId);
                                    if (!stats) return null;
                                    const hasAdhoc = stats.adhocTotal > 0;

                                    return (
                                        <tr key={student.studentId} className="group">
                                            <td className="border-b border-r border-border/50 bg-card px-2 py-2 text-center font-mono text-xs font-bold text-muted-foreground group-hover:bg-background/60">
                                                {index + 1}
                                            </td>
                                            <td className={cn(
                                                'sticky left-0 z-10 border-b border-r border-border/50 bg-card py-2 transition-[min-width,width,padding] duration-200 group-hover:bg-background/60',
                                                isMonthlyStudentRail ? 'w-14 min-w-14 px-2' : 'min-w-60 px-3'
                                            )}>
                                                <div className={cn('flex min-w-0 items-center', isMonthlyStudentRail ? 'justify-center' : 'gap-2')}>
                                                    <BrandIcon
                                                        variant="user"
                                                        size="sm"
                                                        user={{ avatarUrl: student.avatarUrl, name: student.name }}
                                                        className="h-7 w-7 shadow-sm"
                                                    />
                                                    <div className={cn('min-w-0', isMonthlyStudentRail && 'sr-only')}>
                                                        <div className="truncate text-sm font-bold text-foreground">{student.name}</div>
                                                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                                                            {student.rollNumber || student.registrationNumber || 'No roll'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            {sortedSessions.map((session) => {
                                                const status = stats.recordsBySessionId.get(session.id)?.status || null;
                                                const meta = status ? STATUS_META[status] : null;
                                                const Icon = meta?.icon || Circle;
                                                return (
                                                    <td key={session.id} className="border-b border-r border-border/40 bg-card px-2 py-2 text-center group-hover:bg-background/60">
                                                        <span
                                                            title={meta?.label || 'Unmarked'}
                                                            className={cn(
                                                                'mx-auto flex h-7 w-9 items-center justify-center rounded-md border text-xs font-black',
                                                                meta ? meta.cell : 'border-border/50 bg-background/60 text-muted-foreground/50'
                                                            )}
                                                        >
                                                            {meta ? meta.short : <Icon className="h-3 w-3" />}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                            <td className="border-b border-border/50 bg-card px-2 py-1.5">
                                                <div className="space-y-1.5">
                                                    {breakdownVisible.official && (
                                                    <div className="grid grid-cols-[70px_44px_1fr] items-center gap-1.5">
                                                        <Badge variant={stats.officialPercentage >= 75 ? 'success' : 'warning'} size="sm">
                                                            Official
                                                        </Badge>
                                                        <span className="text-center font-mono text-xs font-black text-foreground">{stats.officialPercentage}%</span>
                                                        <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] font-black">
                                                            <span className="rounded bg-success/10 py-0.5 text-success">P {stats.present}</span>
                                                            <span className="rounded bg-danger/10 py-0.5 text-danger">A {stats.absent}</span>
                                                            <span className="rounded bg-warning/10 py-0.5 text-warning">L {stats.late}</span>
                                                            <span className="rounded bg-info/10 py-0.5 text-info">E {stats.excused}</span>
                                                        </div>
                                                    </div>
                                                    )}
                                                    {breakdownVisible.adhoc && (
                                                    <div className="grid grid-cols-[70px_44px_1fr] items-center gap-1.5">
                                                        <Badge variant={hasAdhoc ? 'info' : 'neutral'} size="sm">
                                                            Ad-hoc
                                                        </Badge>
                                                        <span className="text-center font-mono text-xs font-black text-foreground">{hasAdhoc ? `${stats.adhocPercentage}%` : '-'}</span>
                                                        <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] font-black">
                                                            <span className="rounded bg-success/10 py-0.5 text-success">P {stats.adhocPresent}</span>
                                                            <span className="rounded bg-danger/10 py-0.5 text-danger">A {stats.adhocAbsent}</span>
                                                            <span className="rounded bg-warning/10 py-0.5 text-warning">L {stats.adhocLate}</span>
                                                            <span className="rounded bg-info/10 py-0.5 text-info">E {stats.adhocExcused}</span>
                                                        </div>
                                                    </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        );
    }

    return (
        <>
        <section className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
            <div className="sticky top-3 z-30 flex flex-col gap-3 rounded-t-2xl border-b border-border/60 bg-background/90 p-3 shadow-sm backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                        <CheckSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-foreground">Daily Marking Sheet</h2>
                        <p className="text-xs font-semibold text-muted-foreground">
                            {date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row lg:items-center">
                    {SearchControl}
                    {!readOnly && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[max-content_max-content] xl:grid-cols-[max-content_max-content_max-content]">
                            <Button
                                variant="secondary"
                                onClick={handleMarkAllPresent}
                                icon={CheckSquare}
                                className="h-10 min-w-38 whitespace-nowrap px-4 text-xs font-bold"
                            >
                                Mark All Present
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setIsResetAllConfirmOpen(true)}
                                disabled={!hasSaveableDraft}
                                icon={RotateCcw}
                                className="h-10 min-w-24 whitespace-nowrap px-4 text-xs font-bold"
                            >
                                Reset All
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving}
                                isLoading={isSaving}
                                icon={Save}
                                className="h-10 min-w-24 whitespace-nowrap px-4 text-xs font-bold"
                            >
                                Save
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-px border-b border-border/60 bg-border/60 sm:grid-cols-3 lg:grid-cols-6">
                <div className="bg-card px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rows</p>
                    <p className="mt-0.5 font-mono text-lg font-black text-foreground">{dailySummary.total}</p>
                </div>
                {STATUS_ORDER.map((status) => {
                    const meta = STATUS_META[status];
                    const Icon = meta.icon;
                    const value = status === AttendanceStatus.PRESENT ? dailySummary.present :
                        status === AttendanceStatus.ABSENT ? dailySummary.absent :
                            status === AttendanceStatus.LATE ? dailySummary.late : dailySummary.excused;
                    return (
                        <div key={status} className="bg-card px-3 py-2">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <Icon className="h-3 w-3" />
                                {meta.label}
                            </p>
                            <p className="mt-0.5 font-mono text-lg font-black text-foreground">{value}</p>
                        </div>
                    );
                })}
                <div className="bg-card px-3 py-2">
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <Percent className="h-3 w-3" />
                        Unmarked
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-black text-foreground">{dailySummary.unmarked}</p>
                </div>
            </div>

            {students.length === 0 ? (
                <div className="p-4">
                    <EmptyState label="No students found" />
                </div>
            ) : (
                <>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-background text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <th className="w-12 border-b border-r border-border/70 px-2 py-2 text-center">#</th>
                                    <th className="min-w-72 border-b border-r border-border/70 px-3 py-2">Student</th>
                                    <th className="min-w-36 border-b border-r border-border/70 px-3 py-2">Roll / Reg.</th>
                                    <th className="min-w-md border-b border-r border-border/70 px-3 py-2">Mark Status</th>
                                    <th className="w-28 border-b border-border/70 px-3 py-2 text-center">Current</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, index) => {
                                    const draftStatus = draftRecords[student.studentId] ?? null;
                                    const savedStatus = dailyInitialRecords[student.studentId] ?? null;
                                    const savedMeta = savedStatus ? STATUS_META[savedStatus] : null;
                                    return (
                                        <tr key={student.studentId} className="group">
                                            <td className="border-b border-r border-border/50 bg-card px-2 py-2 text-center font-mono text-xs font-bold text-muted-foreground group-hover:bg-background/60">
                                                {index + 1}
                                            </td>
                                            <td className="border-b border-r border-border/50 bg-card px-3 py-2 group-hover:bg-background/60">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <BrandIcon
                                                        variant="user"
                                                        size="sm"
                                                        user={{ avatarUrl: student.avatarUrl, name: student.name }}
                                                        className="h-7 w-7 shadow-sm"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-bold text-foreground">{student.name}</div>
                                                        <div className="truncate text-[10px] font-semibold text-muted-foreground">{student.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border-b border-r border-border/50 bg-card px-3 py-2 font-mono text-xs font-bold text-muted-foreground group-hover:bg-background/60">
                                                {student.rollNumber || student.registrationNumber || '-'}
                                            </td>
                                            <td className="border-b border-r border-border/50 bg-card px-3 py-2 group-hover:bg-background/60">
                                                <div className="grid grid-cols-5 gap-1.5">
                                                    {STATUS_ORDER.map((option) => {
                                                        const optionMeta = STATUS_META[option];
                                                        const Icon = optionMeta.icon;
                                                        const isActive = draftStatus === option;
                                                        return (
                                                            <button
                                                                key={option}
                                                                type="button"
                                                                disabled={readOnly}
                                                                onClick={() => handleStatusChange(student.studentId, option)}
                                                                className={cn(
                                                                    'flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-xs font-black transition-colors',
                                                                    isActive ? optionMeta.chip : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/50',
                                                                    readOnly && 'cursor-not-allowed opacity-70'
                                                                )}
                                                                title={optionMeta.label}
                                                            >
                                                                <Icon className="h-3.5 w-3.5" />
                                                                {optionMeta.short}
                                                            </button>
                                                        );
                                                    })}
                                                    <button
                                                        type="button"
                                                        disabled={readOnly || !draftStatus}
                                                        onClick={() => handleResetStudentSelection(student.studentId)}
                                                        className={cn(
                                                            'flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-xs font-black transition-colors',
                                                            draftStatus
                                                                ? 'border-border/70 bg-background/80 text-muted-foreground hover:bg-muted/60'
                                                                : 'cursor-not-allowed border-border/40 bg-background/35 text-muted-foreground/35',
                                                            readOnly && 'cursor-not-allowed opacity-70'
                                                        )}
                                                        title="Reset selection"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="border-b border-border/50 bg-card px-3 py-2 text-center group-hover:bg-background/60">
                                                {savedMeta ? (
                                                    <Badge variant={savedStatus === AttendanceStatus.PRESENT ? 'success' : savedStatus === AttendanceStatus.ABSENT ? 'error' : savedStatus === AttendanceStatus.LATE ? 'warning' : 'info'} size="sm">
                                                        {savedMeta.label}
                                                    </Badge>
                                                ) : (
                                                    <span className="font-mono text-xs font-bold text-muted-foreground/60">None</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="divide-y divide-border/60 md:hidden">
                        {students.map((student, index) => {
                            const draftStatus = draftRecords[student.studentId] ?? null;
                            const savedStatus = dailyInitialRecords[student.studentId] ?? null;
                            const savedMeta = savedStatus ? STATUS_META[savedStatus] : null;
                            return (
                                <div key={student.studentId} className="bg-card p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background font-mono text-[10px] font-black text-muted-foreground">
                                                {index + 1}
                                            </span>
                                            <BrandIcon
                                                variant="user"
                                                size="sm"
                                                user={{ avatarUrl: student.avatarUrl, name: student.name }}
                                                className="h-8 w-8 shadow-sm"
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-black text-foreground">{student.name}</div>
                                                <div className="truncate font-mono text-[10px] font-semibold text-muted-foreground">
                                                    {student.rollNumber || student.registrationNumber || 'No roll'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Current</p>
                                            {savedMeta ? (
                                                <Badge variant={savedStatus === AttendanceStatus.PRESENT ? 'success' : savedStatus === AttendanceStatus.ABSENT ? 'error' : savedStatus === AttendanceStatus.LATE ? 'warning' : 'info'} size="sm">
                                                    {savedMeta.short}
                                                </Badge>
                                            ) : (
                                                <span className="font-mono text-xs font-bold text-muted-foreground/60">None</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                                        {STATUS_ORDER.map((option) => {
                                            const optionMeta = STATUS_META[option];
                                            const Icon = optionMeta.icon;
                                            const isActive = draftStatus === option;
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() => handleStatusChange(student.studentId, option)}
                                                    className={cn(
                                                        'flex h-9 items-center justify-center gap-1 rounded-md border px-2 text-xs font-black transition-colors',
                                                        isActive ? optionMeta.chip : 'border-border/60 bg-background/60 text-muted-foreground',
                                                        readOnly && 'cursor-not-allowed opacity-70'
                                                    )}
                                                    title={optionMeta.label}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {optionMeta.short}
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            disabled={readOnly || !draftStatus}
                                            onClick={() => handleResetStudentSelection(student.studentId)}
                                            className={cn(
                                                'flex h-9 items-center justify-center gap-1 rounded-md border px-2 text-xs font-black transition-colors',
                                                draftStatus
                                                    ? 'border-border/70 bg-background/80 text-muted-foreground'
                                                    : 'cursor-not-allowed border-border/40 bg-background/35 text-muted-foreground/35',
                                                readOnly && 'cursor-not-allowed opacity-70'
                                            )}
                                            title="Reset selection"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
        <ConfirmDialog
            isOpen={isResetAllConfirmOpen}
            onClose={() => setIsResetAllConfirmOpen(false)}
            onConfirm={handleResetAllSelections}
            title="Reset all selections?"
            description="This clears the unsaved marks currently selected on this sheet. Already saved Current statuses will stay unchanged."
            confirmText="Reset All"
            isDestructive
        />
        </>
    );
}
