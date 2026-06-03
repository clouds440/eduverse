'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import AttendanceSheet from '@/components/sections/AttendanceSheet';
import { AttendanceRecord, Role, RangeAttendanceResponse, AttendanceStatus } from '@/types';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

export default function Attendance() {
    const { token, user } = useAuth();

    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    // SWR: Primary fetch for overall student attendance records (overview cards)
    const attendanceKey = token && user?.role === Role.STUDENT
        ? ['student-attendance', user.id] as const
        : null;
    const { data: records = [], isLoading: fetching, error: attendanceError, mutate: mutateAttendance } = useSWR<AttendanceRecord[]>(attendanceKey);

    // SWR: Dependent fetch for monthly range data (drill-down when section selected)
    const rangeKey = token && selectedSectionId
        ? ['section-attendance-range', selectedSectionId] as const
        : null;
    const { data: rangeData, isLoading: fetchingDetail, error: rangeError, mutate: mutateRange } = useSWR<RangeAttendanceResponse>(rangeKey);

    // Group records by section for overview cards
    const sectionSummaries = useMemo(() => {
        const groups: Record<string, {
            id: string;
            sectionName: string;
            sectionColor?: string | null;
            courseName: string;
            present: number;
            absent: number;
            late: number;
            excused: number;
            total: number;
            percentage: number;
        }> = {};

        records.forEach(record => {
            const sectionId = record.session?.sectionId || 'unknown';
            const isOfficial = !record.session?.isAdhoc;

            if (!groups[sectionId]) {
                groups[sectionId] = {
                    id: sectionId,
                    sectionName: record.session?.section?.name || 'Unknown Section',
                    sectionColor: record.session?.section?.color || null,
                    courseName: record.session?.section?.course?.name || 'Unknown Course',
                    present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0
                };
            }

            if (isOfficial) {
                groups[sectionId].total++;
                if (record.status === AttendanceStatus.PRESENT) groups[sectionId].present++;
                else if (record.status === AttendanceStatus.ABSENT) groups[sectionId].absent++;
                else if (record.status === AttendanceStatus.LATE) groups[sectionId].late++;
                else if (record.status === AttendanceStatus.EXCUSED) groups[sectionId].excused++;
            }
        });

        Object.values(groups).forEach(g => {
            g.percentage = g.total > 0 ? Math.round(((g.present + g.late) / g.total) * 100) : 100;
        });

        return Object.values(groups);
    }, [records]);

    const overallPercentage = useMemo(() => {
        const officialRecords = records.filter(r => !r.session?.isAdhoc);
        const total = officialRecords.length;
        const present = officialRecords.filter(r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length;
        return total > 0 ? Math.round((present / total) * 100) : 100;
    }, [records]);

    if (fetching || fetchingDetail) {
        return <SkeletonTable rows={4} columns={4} />;
    }

    if (attendanceError) {
        return <ErrorState error={attendanceError} onRetry={() => mutateAttendance()} />;
    }

    // --- Detailed Monthly View ---
    if (selectedSectionId && rangeData) {
        const summary = sectionSummaries.find(s => s.id === selectedSectionId);
        return (
            <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 sm:px-6">
                <div className="flex items-center gap-4 pt-4">
                    <Button
                        variant="secondary"
                        onClick={() => setSelectedSectionId(null)}
                        icon={ChevronLeft}
                        className="bg-card shadow-sm border-border"
                    >
                        Back to Overview
                    </Button>
                </div>

                <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                        <CheckCircle className="w-64 h-64" />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="text-[10px] font-black tracking-widest text-primary">{summary?.courseName}</span>
                            </div>
                            <h1 className="text-4xl font-black text-foreground tracking-tighter leading-none">
                                <CourseSectionLabel
                                    courseName={summary?.courseName}
                                    sectionName={summary?.sectionName}
                                    color={summary?.sectionColor}
                                /> Ledger
                            </h1>
                            <p className="text-muted-foreground mt-3 font-bold max-w-md tracking-tight text-[10px] opacity-60">Full monthly presence history for this course.</p>
                        </div>
                        <div className="bg-background/50 border border-border p-4 rounded-2xl flex items-center gap-6 shadow-sm">
                            <div>
                                <p className="text-[9px] font-black text-muted-foreground/60 tracking-[0.2em] mb-1 text-center">Section Rate</p>
                                <p className={`text-2xl font-black italic text-center ${summary && summary.percentage >= 85 ? 'text-success' : 'text-warning'}`}>{summary?.percentage}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {fetchingDetail ? (
                    <div className="py-20 flex justify-center"><Loading size="md" /></div>
                ) : rangeError ? (
                    <ErrorState error={rangeError} onRetry={() => mutateRange()} />
                ) : (
                    <AttendanceSheet mode="monthly" rangeData={rangeData} students={[]} readOnly={true} />
                )}
            </div>
        );
    }

    // --- Overview Cards View ---
    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-16 px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
                <div>
                    <h1 className="text-5xl font-black text-foreground tracking-tighter leading-none">Presence Audit</h1>
                    <p className="text-muted-foreground mt-4 font-bold max-w-md tracking-tight text-[11px] opacity-70">
                        Unified visualization of your academic commitment and log presence.
                    </p>
                </div>
                <div className="bg-card border border-border p-8 rounded-3xl shadow-xl flex items-center gap-8 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 rotate-12 group-hover:rotate-45 transition-transform duration-1000">
                        <CheckCircle className="w-24 h-24" />
                    </div>
                    <div className="relative z-10 text-center">
                        <p className="text-[10px] font-black text-muted-foreground/60 tracking-[0.3em] mb-2 leading-none">Global Accuracy</p>
                        <p className={`text-4xl font-black italic tracking-tighter ${overallPercentage >= 85 ? 'text-success' : 'text-warning'}`}>{overallPercentage}%</p>
                    </div>
                    {overallPercentage < 85 && (
                        <div className="relative z-10 flex items-center gap-2 text-warning bg-warning/10 px-4 py-2.5 rounded-xl text-xs font-black italic border border-warning/20">
                            <AlertCircle className="w-4 h-4 animate-pulse" /> Attendance Risk
                        </div>
                    )}
                </div>
            </div>

            {sectionSummaries.length === 0 ? (
                <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl shadow-sm">
                    <CheckCircle className="w-16 h-16 text-muted-foreground/20 mx-auto mb-6" />
                    <p className="text-muted-foreground font-black tracking-widest text-xs">No attendance footprint detected</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sectionSummaries.map((group, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedSectionId(group.id)}
                            className="group bg-card border border-border rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer flex flex-col p-8 relative hover:border-primary/30"
                        >
                            <div className="absolute -right-8 -top-8 p-16 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 pointer-events-none group-hover:rotate-12 duration-700">
                                <BookOpen className="w-48 h-48" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                        <span className="text-[9px] font-black tracking-widest text-primary">{group.courseName}</span>
                                    </div>
                                    <div className={`text-lg font-black tracking-tighter ${group.percentage >= 85 ? 'text-success' : 'text-warning'}`}>{group.percentage}%</div>
                                </div>

                                <h3 className="text-2xl font-black tracking-tighter mb-2 text-foreground group-hover:text-primary transition-colors leading-none">
                                    <CourseSectionLabel
                                        courseName={group.courseName}
                                        sectionName={group.sectionName}
                                        color={group.sectionColor}
                                    />
                                </h3>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-widest mb-10">Historical Ledger Summary</p>

                                <div className="space-y-6 bg-muted/20 p-6 rounded-2xl border border-border/50">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground/60 tracking-widest mb-1 leading-none">Total Logs</p>
                                            <p className="text-xl font-black text-foreground">{group.total}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-success/60 tracking-widest mb-1 leading-none">Present</p>
                                            <p className="text-xl font-black text-success">{group.present + group.late}</p>
                                        </div>
                                    </div>

                                    <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-border/50 p-px">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${group.percentage >= 85 ? 'bg-success' : 'bg-warning'}`}
                                            style={{ width: `${group.percentage}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex items-center justify-between text-[8px] font-black tracking-[0.2em]">
                                        <span className="text-danger/70">Absent: {group.absent}</span>
                                        <span className="text-info/70">Excused: {group.excused}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between relative z-10 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                                <span className="text-[10px] font-black text-primary tracking-widest">Audit Full Ledger</span>
                                <ChevronRight className="w-5 h-5 text-primary" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
