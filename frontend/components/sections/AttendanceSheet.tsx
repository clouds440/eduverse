'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SectionAttendanceStudent, AttendanceStatus, RangeAttendanceResponse, Role } from '@/types';
import { Button } from '@/components/ui/Button';
import { Check, X, Clock, FileWarning, Save, CheckSquare, Calendar, User, Activity, Search } from 'lucide-react';
import { BrandIcon } from '../ui/Brand';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';

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

export default function AttendanceSheet({
    students: initialStudents,
    date,
    readOnly: forcedReadOnly,
    onSave,
    isSaving,
    mode = 'daily',
    rangeData
}: AttendanceSheetProps) {
    const { user } = useAuth();
    const isStudent = user?.role === Role.STUDENT;
    const readOnly = forcedReadOnly || isStudent;

    const [searchTerm, setSearchTerm] = useState('');

    const students = useMemo(() => {
        if (!searchTerm) return initialStudents;
        const lowSearch = searchTerm.toLowerCase();
        return initialStudents.filter(s =>
            s.name.toLowerCase().includes(lowSearch) ||
            (s.rollNumber || s.registrationNumber || '').toLowerCase().includes(lowSearch)
        );
    }, [initialStudents, searchTerm]);

    const displayRangeStudents = useMemo(() => {
        const base = (mode === 'monthly' && rangeData) ? rangeData.students : [];
        if (!searchTerm) return base;
        const lowSearch = searchTerm.toLowerCase();
        return base.filter(s =>
            s.name.toLowerCase().includes(lowSearch) ||
            (s.rollNumber || s.registrationNumber || '').toLowerCase().includes(lowSearch)
        );
    }, [mode, rangeData, searchTerm]);

    const dailySeedKey = useMemo(
        () => students.map((student) => `${student.studentId}:${student.status ?? 'null'}`).join('|'),
        [students],
    );

    const dailyInitialRecords = useMemo(() => {
        const init: Record<string, AttendanceStatus | null> = {};
        students.forEach((student) => {
            init[student.studentId] = student.status;
        });
        return init;
    }, [students]);

    const [draft, setDraft] = useState<{
        seedKey: string;
        values: Record<string, AttendanceStatus | null>;
        dirty: boolean;
    }>({
        seedKey: '',
        values: {},
        dirty: false,
    });

    const localRecords = mode === 'daily' && draft.seedKey === dailySeedKey
        ? { ...dailyInitialRecords, ...draft.values }
        : dailyInitialRecords;
    const hasChanges = mode === 'daily' && draft.seedKey === dailySeedKey && draft.dirty;

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        if (readOnly) return;
        setDraft((prev) => ({
            seedKey: dailySeedKey,
            values: {
                ...(prev.seedKey === dailySeedKey ? prev.values : {}),
                [studentId]: status,
            },
            dirty: true,
        }));
    };

    const handleMarkAllPresent = () => {
        if (readOnly) return;
        const out: Record<string, AttendanceStatus | null> = {};
        students.forEach(s => {
            out[s.studentId] = AttendanceStatus.PRESENT;
        });
        setDraft({
            seedKey: dailySeedKey,
            values: out,
            dirty: true,
        });
    };

    const handleSave = () => {
        if (!onSave) return;
        const recordsToSave = students.map(s => ({
            studentId: s.studentId,
            status: localRecords[s.studentId] || AttendanceStatus.PRESENT
        }));
        onSave(recordsToSave);
        setDraft((prev) => ({
            ...prev,
            seedKey: dailySeedKey,
            dirty: false,
        }));
    };

    const getStatusIcon = (status: AttendanceStatus | null, size = "w-3.5 h-3.5") => {
        switch (status) {
            case AttendanceStatus.PRESENT: return <Check className={`${size} text-success`} />;
            case AttendanceStatus.ABSENT: return <X className={`${size} text-danger`} />;
            case AttendanceStatus.LATE: return <Clock className={`${size} text-warning`} />;
            case AttendanceStatus.EXCUSED: return <FileWarning className={`${size} text-info`} />;
            default: return <span className="text-muted-foreground/40 text-xs">-</span>;
        }
    };

    const getStatusButtonClass = (isActive: boolean, type: AttendanceStatus) => {
        if (!isActive) return "bg-background hover:bg-muted/50 text-muted-foreground border-border shadow-sm";
        switch (type) {
            case AttendanceStatus.PRESENT: return "bg-success/15 text-success border-success shadow-sm ring-1 ring-success";
            case AttendanceStatus.ABSENT: return "bg-danger/15 text-danger border-danger shadow-sm ring-1 ring-danger";
            case AttendanceStatus.LATE: return "bg-warning/15 text-warning border-warning shadow-sm ring-1 ring-warning";
            case AttendanceStatus.EXCUSED: return "bg-info/15 text-info border-info shadow-sm ring-1 ring-info";
            default: return "";
        }
    };

    const attendanceColumns = useMemo(() => [
        {
            header: 'Student',
            accessor: (student: SectionAttendanceStudent) => (
                <div className="flex items-center gap-3">
                    <BrandIcon
                        variant="user"
                        size="sm"
                        user={{ avatarUrl: student.avatarUrl, name: student.name }}
                        className="w-8 h-8 shadow-sm"
                    />
                    <div>
                        <div className="font-bold text-foreground">{student.name}</div>
                        <div className="text-[10px] text-muted-foreground tracking-wide font-mono mt-0.5">
                            Roll: {student.rollNumber || student.registrationNumber}
                        </div>
                    </div>
                </div>
            ),
            width: 280,
        },
        {
            header: 'Status',
            accessor: (student: SectionAttendanceStudent) => {
                const status = localRecords[student.studentId];
                return (
                    <div className="inline-flex flex-wrap justify-center gap-2">
                        <button
                            disabled={readOnly}
                            onClick={() => handleStatusChange(student.studentId, AttendanceStatus.PRESENT)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${getStatusButtonClass(status === AttendanceStatus.PRESENT, AttendanceStatus.PRESENT)}`}
                            title="Present"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">P</span>
                        </button>
                        <button
                            disabled={readOnly}
                            onClick={() => handleStatusChange(student.studentId, AttendanceStatus.ABSENT)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${getStatusButtonClass(status === AttendanceStatus.ABSENT, AttendanceStatus.ABSENT)}`}
                            title="Absent"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">A</span>
                        </button>
                        <button
                            disabled={readOnly}
                            onClick={() => handleStatusChange(student.studentId, AttendanceStatus.LATE)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${getStatusButtonClass(status === AttendanceStatus.LATE, AttendanceStatus.LATE)}`}
                            title="Late"
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">L</span>
                        </button>
                        <button
                            disabled={readOnly}
                            onClick={() => handleStatusChange(student.studentId, AttendanceStatus.EXCUSED)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${getStatusButtonClass(status === AttendanceStatus.EXCUSED, AttendanceStatus.EXCUSED)}`}
                            title="Excused"
                        >
                            <FileWarning className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">E</span>
                        </button>
                    </div>
                );
            },
            width: 300,
        },
    ], [localRecords, readOnly, handleStatusChange, getStatusButtonClass]);

    const sessionById = useMemo(
        () => new Map((rangeData?.sessions || []).map((session) => [session.id, session] as const)),
        [rangeData],
    );

    const groupedSessionDates = useMemo(() => {
        if (!rangeData) return [];

        const groups = new Map<string, typeof rangeData.sessions>();
        rangeData.sessions.forEach((session) => {
            const dateKey = String(session.date).slice(0, 10);
            const existing = groups.get(dateKey) || [];
            existing.push(session);
            groups.set(dateKey, existing);
        });

        return Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, sessions]) => ({
                dateKey,
                sessions: sessions.sort((a, b) => {
                    const aTime = a.startTime || a.schedule?.startTime || '99:99';
                    const bTime = b.startTime || b.schedule?.startTime || '99:99';
                    return aTime.localeCompare(bTime);
                }),
            }));
    }, [rangeData]);
    
    const monthlyStudentsAnalytics = useMemo(() => {
        const analytics = new Map<string, {
            recordsBySessionId: Map<string, AttendanceRangeRecord>;
            officialTotal: number;
            present: number;
            absent: number;
            late: number;
            excused: number;
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
                    }

                    overallTotal++;
                    if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
                        overallPresent++;
                    }
                }
            });

            const officialPresent = present + late;
            const officialPercentage = officialTotal > 0 ? Math.round((officialPresent / officialTotal) * 100) : 100;
            const overallPercentage = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 100;

            analytics.set(student.studentId, {
                recordsBySessionId,
                officialTotal,
                present,
                absent,
                late,
                excused,
                officialPercentage,
                overallTotal,
                overallPercentage,
            });
        });

        return analytics;
    }, [displayRangeStudents, sessionById]);

    const getSessionLabel = (session: NonNullable<RangeAttendanceResponse['sessions']>[number]) => {
        const start = session.startTime || session.schedule?.startTime;
        const end = session.endTime || session.schedule?.endTime;
        if (start && end) {
            // Format to show cleaner time
            const formatTime = (t: string) => t.slice(0, 5);
            return `${formatTime(start)} - ${formatTime(end)}`;
        }
        if (session.isAdhoc) return 'Ad-hoc';
        return 'Session';
    };

    // Helper to get readable session type badge
    const getSessionTypeBadge = (isAdhoc: boolean) => {
        return (
            <Badge variant={isAdhoc ? 'warning' : 'secondary'} size="sm" className="uppercase tracking-wider">
                {isAdhoc ? 'adhoc' : 'scheduled'}
            </Badge>
        );
    };

    if (mode === 'monthly' && rangeData) {
        return (
            <div className="flex flex-col border border-border rounded-2xl overflow-hidden bg-card shadow-lg">
                <div className="p-4 bg-muted/5 border-b border-border flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-20 text-muted-foreground" />
                        <Input
                            placeholder="Search students..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all text-sm font-medium"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto scrollbar-thin scrollbar-track-muted/20 scrollbar-thumb-primary/30">
                    <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-primary/5 border-b border-border">
                                <th className="sticky left-0 z-30 px-3 py-4 font-black tracking-widest text-[10px] text-primary/80 bg-primary/5 w-12 text-center rounded-tl-xl">
                                    #
                                </th>
                                <th className="sticky left-12 z-30 px-4 py-4 font-black tracking-widest text-[10px] text-primary/80 bg-primary/5 border-l border-primary/10 min-w-55 rounded-tr-xl">
                                    <div className="flex items-center gap-2">
                                        <User className="w-3 h-3" />
                                        <span>Student</span>
                                    </div>
                                </th>
                                {groupedSessionDates.map(({ dateKey, sessions }) => (
                                    <th key={dateKey} className="px-3 py-4 font-black tracking-widest text-[10px] text-primary/80 text-center bg-primary/5 border-l border-primary/10 min-w-40 align-top">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1 text-sm font-bold text-primary">
                                                <Calendar className="w-3 h-3" />
                                                <span>{new Date(dateKey).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</span>
                                            </div>
                                            <span className="text-[9px] opacity-70 font-mono">{new Date(dateKey).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                            <div className="mt-1 flex flex-wrap justify-center gap-1">
                                                {sessions.map((session) => (
                                                    <Badge
                                                        key={session.id}
                                                        variant={session.isAdhoc ? 'warning' : 'secondary'}
                                                        size="sm"
                                                        className="uppercase"
                                                    >
                                                        {getSessionLabel(session).replace(/[—–]/g, '-')}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-4 font-black tracking-widest text-[10px] text-primary/80 bg-primary/5 border-l border-primary/20 text-center min-w-35">
                                    <div className="flex items-center justify-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        <span>Analysis</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {displayRangeStudents.map((student, sIdx) => {
                                const stats = monthlyStudentsAnalytics.get(student.studentId) || {
                                    recordsBySessionId: new Map<string, AttendanceRangeRecord>(),
                                    officialTotal: 0,
                                    present: 0,
                                    absent: 0,
                                    late: 0,
                                    excused: 0,
                                    officialPercentage: 100,
                                    overallTotal: 0,
                                    overallPercentage: 100,
                                };
                                const {
                                    recordsBySessionId,
                                    officialTotal,
                                    present,
                                    absent,
                                    late,
                                    excused,
                                    officialPercentage,
                                    overallTotal,
                                    overallPercentage,
                                } = stats;

                                return (
                                    <tr key={student.studentId} className="group hover:bg-muted/5 transition-all duration-150">
                                        <td className="sticky left-0 z-10 px-3 py-4 text-center font-bold text-muted-foreground/60 bg-card group-hover:bg-muted/5 border-r border-border/30">
                                            {sIdx + 1}
                                        </td>
                                        <td className="sticky left-12 z-10 px-4 py-4 border-l border-border/50 bg-card group-hover:bg-muted/5">
                                            <div className="flex items-center gap-3">
                                                <BrandIcon
                                                    variant="user"
                                                    size="sm"
                                                    user={{ avatarUrl: student.avatarUrl, name: student.name }}
                                                    className="w-8 h-8 shadow-sm"
                                                />
                                                <div>
                                                    <div className="font-bold text-foreground line-clamp-1">{student.name}</div>
                                                    <div className="text-[10px] text-muted-foreground tracking-wider font-mono mt-0.5">Roll: {student.rollNumber || student.registrationNumber}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {groupedSessionDates.map(({ dateKey, sessions }) => (
                                            <td key={dateKey} className="px-3 py-3 border-l border-border/30 align-top bg-card">
                                                {/* STACKED SESSIONS VERTICALLY */}
                                                <div className="flex flex-col gap-2 w-full min-w-32.5">
                                                    {sessions.map((session) => {
                                                        const record = recordsBySessionId.get(session.id);
                                                        const sessionStatus = record?.status || null;
                                                        const isAdhoc = session.isAdhoc;

                                                        return (
                                                            <div
                                                                key={session.id}
                                                                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-all ${isAdhoc
                                                                    ? 'border-warning/30 bg-warning/5 hover:bg-warning/10'
                                                                    : 'border-border/70 bg-muted/10 hover:bg-muted/20'
                                                                    }`}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-bold leading-tight font-mono">
                                                                        {getSessionLabel(session)}
                                                                    </span>
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        {getSessionTypeBadge(isAdhoc!)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-center min-w-8">
                                                                    {getStatusIcon(sessionStatus, "w-4 h-4")}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {sessions.length === 0 && (
                                                        <div className="text-center text-muted-foreground/40 text-[10px] py-2">No sessions</div>
                                                    )}
                                                </div>
                                            </td>
                                        ))}
                                        <td className="px-3 py-3 border-l border-primary/20 bg-primary/5">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="shadown-md" title='Total Scheduled Sessions'>{officialTotal} Official</Badge>
                                                    <Badge variant="primary" size="md" className="shadow-md">
                                                        {officialPercentage}%
                                                    </Badge>
                                                </div>
                                                {overallTotal > officialTotal && (
                                                    <div className="text-[9px] font-black opacity-50 flex items-center gap-1" title="Total including ad-hoc sessions">
                                                        <span>total</span>
                                                        <span className="font-mono">{overallPercentage}%</span>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-4 gap-2 w-full max-w-30 mt-1">
                                                    <div className="flex flex-col items-center bg-success/10 rounded-lg py-1">
                                                        <span className="text-[8px] font-black text-success">P</span>
                                                        <span className="text-xs font-bold">{present}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center bg-danger/10 rounded-lg py-1">
                                                        <span className="text-[8px] font-black text-danger">A</span>
                                                        <span className="text-xs font-bold">{absent}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center bg-warning/10 rounded-lg py-1">
                                                        <span className="text-[8px] font-black text-warning">L</span>
                                                        <span className="text-xs font-bold">{late}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center bg-info/10 rounded-lg py-1">
                                                        <span className="text-[8px] font-black text-info">E</span>
                                                        <span className="text-xs font-bold">{excused}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {rangeData.students.length === 0 && (
                                <tr>
                                    <td colSpan={groupedSessionDates.length + 3} className="px-6 py-16 text-center text-muted-foreground bg-muted/10">
                                        <div className="flex flex-col items-center gap-2">
                                            <User className="w-8 h-8 opacity-20" />
                                            <span>No enrollment data available for this period.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Daily mode with responsive improvements
    return (
        <div className="flex flex-col border border-border rounded-2xl overflow-hidden bg-card shadow-lg">
            <div className="p-4 bg-muted/5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all text-sm font-medium"
                    />
                </div>
            </div>
            {!readOnly && (
                <div className="p-4 bg-muted/10 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-primary" />
                            Mark Attendance
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-medium tracking-wider mt-0.5">
                            {date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            variant="secondary"
                            onClick={handleMarkAllPresent}
                            icon={CheckSquare}
                            className="text-xs font-bold shadow-sm hover:shadow-md hover:bg-success transition-all"
                        >
                            Mark All Present
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            isLoading={isSaving}
                            icon={Save}
                            className="text-xs font-bold shadow-sm"
                        >
                            Save Attendance
                        </Button>
                    </div>
                </div>
            )}

            <DataTable
                data={students}
                columns={attendanceColumns}
                keyExtractor={(student) => student.studentId}
                currentPage={1}
                totalPages={1}
                totalResults={students.length}
                pageSize={students.length || 10}
                onPageChange={() => { }}
                disableZebra={true}
                showSerialNumber
            />
        </div>
    );
}
