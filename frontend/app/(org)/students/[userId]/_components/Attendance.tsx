'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import AttendanceSheet from '@/components/sections/AttendanceSheet';
import { AttendanceRecord, RangeAttendanceResponse, AttendanceStatus } from '@/types';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { getSectionColor, getSectionSurfaceStyle } from '@/lib/utils';

interface SectionSummary {
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
}

interface AttendanceProps {
    studentId: string;
}

export default function Attendance({ studentId }: AttendanceProps) {
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    const attendanceKey = studentId
        ? ['student-attendance', studentId] as const
        : null;
    const { data: records = [], isLoading: fetching, error: attendanceError, mutate: mutateAttendance } = useSWR<AttendanceRecord[]>(attendanceKey);

    const rangeKey = selectedSectionId
        ? ['section-attendance-range', selectedSectionId, studentId] as const
        : null;
    const { data: rangeData, isLoading: fetchingDetail, error: rangeError, mutate: mutateRange } = useSWR<RangeAttendanceResponse>(rangeKey);

    const sectionSummaries = useMemo<SectionSummary[]>(() => {
        const groups: Record<string, SectionSummary> = {};

        records.forEach((record) => {
            const sectionId = record.session?.sectionId || 'unknown';
            const isOfficial = !record.session?.isAdhoc;

            if (!groups[sectionId]) {
                groups[sectionId] = {
                    id: sectionId,
                    sectionName: record.session?.section?.name || 'Unknown Section',
                    sectionColor: record.session?.section?.color || null,
                    courseName: record.session?.section?.course?.name || 'Unknown Course',
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0,
                    total: 0,
                    percentage: 0,
                };
            }

            if (!isOfficial) return;

            groups[sectionId].total++;
            if (record.status === AttendanceStatus.PRESENT) groups[sectionId].present++;
            else if (record.status === AttendanceStatus.ABSENT) groups[sectionId].absent++;
            else if (record.status === AttendanceStatus.LATE) groups[sectionId].late++;
            else if (record.status === AttendanceStatus.EXCUSED) groups[sectionId].excused++;
        });

        return Object.values(groups).map((group) => ({
            ...group,
            percentage: group.total > 0 ? Math.round(((group.present + group.late) / group.total) * 100) : 100,
        }));
    }, [records]);

    const overall = useMemo(() => {
        const officialRecords = records.filter((record) => !record.session?.isAdhoc);
        const total = officialRecords.length;
        const attended = officialRecords.filter((record) => record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE).length;
        return {
            total,
            attended,
            absent: officialRecords.filter((record) => record.status === AttendanceStatus.ABSENT).length,
            percentage: total > 0 ? Math.round((attended / total) * 100) : 100,
        };
    }, [records]);

    if (fetching) {
        return <SkeletonTable rows={4} columns={4} />;
    }

    if (attendanceError) {
        return <ErrorState error={attendanceError} onRetry={() => mutateAttendance()} />;
    }

    if (selectedSectionId) {
        const summary = sectionSummaries.find((section) => section.id === selectedSectionId);
        return (
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        variant="secondary"
                        onClick={() => setSelectedSectionId(null)}
                        icon={ChevronLeft}
                    >
                        Back to Attendance
                    </Button>
                    {summary && (
                        <div className="rounded-md border border-border bg-muted/25 px-3 py-2 text-sm font-bold text-foreground">
                            {summary.percentage}% attendance
                        </div>
                    )}
                </div>

                {summary && (
                    <Card
                        padding="md"
                        hoverable={false}
                        className="border shadow-sm"
                        style={{
                            ...getSectionSurfaceStyle(summary.sectionColor, '10', '55'),
                            boxShadow: `inset 3px 0 0 ${getSectionColor(summary.sectionColor)}`,
                        }}
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CourseSectionLabel
                                    courseName={summary.courseName}
                                    sectionName={summary.sectionName}
                                    color={summary.sectionColor}
                                    variant="stacked"
                                    as="h2"
                                    className="text-lg font-black"
                                />
                                <p className="mt-1 text-sm font-medium opacity-80" style={{ color: getSectionColor(summary.sectionColor) }}>Monthly attendance records for this section.</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                                <div className="rounded-md border p-2" style={getSectionSurfaceStyle(summary.sectionColor, '0C', '38')}>
                                    <p className="opacity-80" style={{ color: getSectionColor(summary.sectionColor) }}>Present</p>
                                    <p className="mt-1" style={{ color: getSectionColor(summary.sectionColor) }}>{summary.present + summary.late}</p>
                                </div>
                                <div className="rounded-md border p-2" style={getSectionSurfaceStyle(summary.sectionColor, '0C', '38')}>
                                    <p className="opacity-80" style={{ color: getSectionColor(summary.sectionColor) }}>Absent</p>
                                    <p className="mt-1" style={{ color: getSectionColor(summary.sectionColor) }}>{summary.absent}</p>
                                </div>
                                <div className="rounded-md border p-2" style={getSectionSurfaceStyle(summary.sectionColor, '0C', '38')}>
                                    <p className="opacity-80" style={{ color: getSectionColor(summary.sectionColor) }}>Excused</p>
                                    <p className="mt-1" style={{ color: getSectionColor(summary.sectionColor) }}>{summary.excused}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {fetchingDetail ? (
                    <SkeletonTable rows={6} columns={7} />
                ) : rangeError ? (
                    <ErrorState error={rangeError} onRetry={() => mutateRange()} />
                ) : rangeData ? (
                    <AttendanceSheet mode="monthly" rangeData={rangeData} students={[]} readOnly={true} />
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Overall Attendance</p>
                            <p className={`mt-2 text-3xl font-black ${overall.percentage >= 85 ? 'text-success' : 'text-warning'}`}>{overall.percentage}%</p>
                        </div>
                        <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                </Card>
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Recorded Sessions</p>
                            <p className="mt-2 text-3xl font-black text-foreground">{overall.total}</p>
                        </div>
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                </Card>
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Absences</p>
                            <p className="mt-2 text-3xl font-black text-foreground">{overall.absent}</p>
                        </div>
                        <AlertCircle className="h-5 w-5 text-warning" />
                    </div>
                </Card>
            </div>

            {sectionSummaries.length === 0 ? (
                <EmptyState
                    icon={CheckCircle}
                    title="No attendance records"
                    description="Attendance records will appear after sessions are marked."
                    className="min-h-80"
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {sectionSummaries.map((summary) => {
                        const sectionColor = getSectionColor(summary.sectionColor);
                        const sectionPanelStyle = getSectionSurfaceStyle(summary.sectionColor, '0C', '38');
                        return (
                            <Card
                                key={summary.id}
                                onClick={() => setSelectedSectionId(summary.id)}
                                padding="md"
                                className="border shadow-sm"
                                style={{
                                    ...getSectionSurfaceStyle(summary.sectionColor, '10', '55'),
                                    color: sectionColor,
                                    boxShadow: `inset 3px 0 0 ${sectionColor}`,
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <CourseSectionLabel
                                            courseName={summary.courseName}
                                            sectionName={summary.sectionName}
                                            color={sectionColor}
                                            variant="stacked"
                                            as="h3"
                                            className="text-base font-black"
                                        />
                                        <p className="mt-1 text-xs font-semibold opacity-80" style={{ color: sectionColor }}>{summary.total} official sessions</p>
                                    </div>
                                    <div className="shrink-0 text-xl font-black" style={{ color: sectionColor }}>
                                        {summary.percentage}%
                                    </div>
                                </div>

                                <div className="mt-4 h-2 overflow-hidden rounded-full border" style={sectionPanelStyle}>
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${summary.percentage}%`, backgroundColor: sectionColor }}
                                    />
                                </div>

                                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                                    <div className="rounded-md border p-2" style={sectionPanelStyle}>{summary.present + summary.late} present</div>
                                    <div className="rounded-md border p-2" style={sectionPanelStyle}>{summary.absent} absent</div>
                                    <div className="rounded-md border p-2" style={sectionPanelStyle}>{summary.excused} excused</div>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs font-black" style={{ borderColor: `${sectionColor}38`, color: sectionColor }}>
                                    View monthly records
                                    <ChevronRight className="h-4 w-4" />
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
