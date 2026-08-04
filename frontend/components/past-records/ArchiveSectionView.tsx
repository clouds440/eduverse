'use client';

import { useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle, ClipboardList, FileText, GraduationCap, Users } from 'lucide-react';
import { PastRecordSectionDetail } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTabs } from '@/components/ui/PageShell';

type ArchiveTab = 'students' | 'assessments' | 'attendance' | 'schedule' | 'materials';

export function ArchiveSectionView({ record }: { record: PastRecordSectionDetail }) {
    const [tab, setTab] = useState<ArchiveTab>('students');
    const payload = record.payload;
    const section = payload.section;
    const studentColumns: Column<(typeof payload.enrollments)[number]>[] = [
        { header: 'Student', accessor: (row) => row.student?.user?.name || row.student?.user?.email || 'Student' },
        { header: 'Registration', accessor: (row) => row.student?.registrationNumber || '-' },
        { header: 'Roll Number', accessor: (row) => row.student?.rollNumber || '-' },
        { header: 'Source', accessor: (row) => <Badge variant="neutral" size="sm">{row.source || 'MANUAL'}</Badge> },
    ];
    const assessmentColumns: Column<(typeof payload.assessments)[number]>[] = [
        { header: 'Assessment', accessor: (row) => row.title },
        { header: 'Type', accessor: (row) => <Badge variant="secondary" size="sm">{row.type}</Badge> },
        { header: 'Total', accessor: (row) => row.totalMarks },
        { header: 'Weight', accessor: (row) => `${row.weightage}%` },
        { header: 'Grades', accessor: (row) => row.grades.length },
        { header: 'Submissions', accessor: (row) => row.submissions.length },
    ];
    const attendanceRows = payload.attendanceSessions.flatMap((session) => session.records.map((attendance) => ({ ...attendance, session })));
    const attendanceColumns: Column<(typeof attendanceRows)[number]>[] = [
        { header: 'Date', accessor: (row) => new Date(row.session.date).toLocaleDateString() },
        { header: 'Student', accessor: (row) => row.student?.user?.name || row.student?.user?.email || row.studentId },
        { header: 'Status', accessor: (row) => <Badge variant={row.status === 'PRESENT' ? 'success' : row.status === 'ABSENT' ? 'error' : 'neutral'} size="sm">{row.status}</Badge> },
    ];
    const scheduleColumns: Column<(typeof payload.schedules)[number]>[] = [
        { header: 'Day', accessor: (row) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][row.day] || row.day },
        { header: 'Time', accessor: (row) => `${row.startTime} - ${row.endTime}` },
        { header: 'Room', accessor: (row) => row.room || row.roomRef?.name || '-' },
        { header: 'Type', accessor: (row) => row.type },
    ];
    const materialColumns: Column<(typeof payload.courseMaterials)[number]>[] = [
        { header: 'Material', accessor: (row) => row.title },
        { header: 'Description', accessor: (row) => row.description || '-' },
        { header: 'Links', accessor: (row) => row.links?.length || 0 },
        { header: 'Created', accessor: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-' },
    ];
    const staticPage = { currentPage: 1, totalPages: 1, totalResults: 0, pageSize: 1000, onPageChange: () => undefined };

    return (
        <div className="space-y-4">
            <section className="grid gap-3 border-b border-border pb-4 sm:grid-cols-2 xl:grid-cols-4">
                <div><p className="text-xs font-bold text-muted-foreground">Course</p><p className="mt-1 font-black">{section.course?.code ? `${section.course.code} - ${section.course.name}` : section.course?.name}</p></div>
                <div><p className="text-xs font-bold text-muted-foreground">Cohort</p><p className="mt-1 font-black">{section.cohort?.name || 'Independent'}</p></div>
                <div><p className="text-xs font-bold text-muted-foreground">Teachers</p><p className="mt-1 font-black">{section.teachers?.map((teacher) => teacher.user?.name).filter(Boolean).join(', ') || '-'}</p></div>
                <div><p className="text-xs font-bold text-muted-foreground">Archive</p><p className="mt-1 font-black">Revision {record.archiveRevision}, schema {record.schemaVersion}</p></div>
            </section>

            <PageTabs
                activeValue={tab}
                onValueChange={setTab}
                ariaLabel="Archived section records"
                tone="panel"
                items={[
                    { value: 'students', label: 'Students', icon: Users, count: payload.enrollments.length },
                    { value: 'assessments', label: 'Assessments & Exams', icon: ClipboardList, count: payload.assessments.length },
                    { value: 'attendance', label: 'Attendance', icon: CheckCircle, count: attendanceRows.length },
                    { value: 'schedule', label: 'Schedule', icon: CalendarDays, count: payload.schedules.length },
                    { value: 'materials', label: 'Materials', icon: FileText, count: payload.courseMaterials.length },
                ]}
            />

            {tab === 'students' && <DataTable {...staticPage} totalResults={payload.enrollments.length} data={payload.enrollments} columns={studentColumns} keyExtractor={(row) => row.id} emptyTitle="No archived students" />}
            {tab === 'assessments' && <DataTable {...staticPage} totalResults={payload.assessments.length} data={payload.assessments} columns={assessmentColumns} keyExtractor={(row) => row.id} emptyTitle="No archived assessments" />}
            {tab === 'attendance' && <DataTable {...staticPage} totalResults={attendanceRows.length} data={attendanceRows} columns={attendanceColumns} keyExtractor={(row) => row.id} emptyTitle="No archived attendance" />}
            {tab === 'schedule' && <DataTable {...staticPage} totalResults={payload.schedules.length} data={payload.schedules} columns={scheduleColumns} keyExtractor={(row) => row.id} emptyTitle="No archived schedules" />}
            {tab === 'materials' && (
                payload.courseMaterials.length
                    ? <DataTable {...staticPage} totalResults={payload.courseMaterials.length} data={payload.courseMaterials} columns={materialColumns} keyExtractor={(row) => row.id} emptyTitle="No archived materials" />
                    : <EmptyState icon={BookOpen} title="No archived materials" description="This section had no course materials at the archive cutoff." />
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Badge variant="neutral" size="sm"><GraduationCap className="mr-1 h-3.5 w-3.5" />Read only</Badge>
                <Badge variant="neutral" size="sm">Checksum {record.checksum.slice(0, 12)}</Badge>
            </div>
        </div>
    );
}
