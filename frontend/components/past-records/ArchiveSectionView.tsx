'use client';

import { useMemo, useState } from 'react';
import { Award, BookOpen, CalendarDays, CheckCircle, ClipboardList, FileText, GraduationCap, Users } from 'lucide-react';
import type { BadgeVariant, PastRecordSectionDetail } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Label } from '@/components/ui/Label';
import { PageTabs } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';

type ArchiveTab = 'students' | 'assessments' | 'grades' | 'attendance' | 'schedule' | 'materials';

type GradeRow = {
    id: string;
    assessmentTitle: string;
    assessmentType: string;
    totalMarks: number;
    grade: PastRecordSectionDetail['payload']['assessments'][number]['grades'][number];
};

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const includesText = (values: Array<string | number | null | undefined>, search: string) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return values.some((value) => String(value ?? '').toLowerCase().includes(query));
};

const studentName = (student?: { user?: { name?: string | null; email?: string | null } | null } | null) => (
    student?.user?.name || student?.user?.email || 'Student'
);

const uniqueOptions = (values: Array<string | null | undefined>) => (
    [...new Set(values.filter(Boolean) as string[])].sort().map((value) => ({ value, label: value }))
);

function gradeVariant(status?: string): BadgeVariant {
    if (status === 'FINALIZED') return 'success';
    if (status === 'PUBLISHED') return 'primary';
    if (status === 'DRAFT') return 'warning';
    return 'neutral';
}

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
            <p className="text-xs font-bold text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-black text-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function ArchiveSectionView({ record }: { record: PastRecordSectionDetail }) {
    const [tab, setTab] = useState<ArchiveTab>('students');
    const [search, setSearch] = useState('');
    const [assessmentType, setAssessmentType] = useState('');
    const [gradeStatus, setGradeStatus] = useState('');
    const [attendanceStatus, setAttendanceStatus] = useState('');
    const [scheduleType, setScheduleType] = useState('');
    const payload = record.payload;
    const section = payload.section;
    const attendanceRows = useMemo(() => payload.attendanceSessions.flatMap((session) => session.records.map((attendance) => ({ ...attendance, session }))), [payload.attendanceSessions]);
    const gradeRows = useMemo<GradeRow[]>(() => payload.assessments.flatMap((assessment) => assessment.grades.map((grade) => ({
        id: `${assessment.id}-${grade.id}`,
        assessmentTitle: assessment.title,
        assessmentType: String(assessment.type),
        totalMarks: assessment.totalMarks,
        grade,
    }))), [payload.assessments]);
    const filteredEnrollments = useMemo(() => payload.enrollments.filter((row) => includesText([
        studentName(row.student),
        row.student?.registrationNumber,
        row.student?.rollNumber,
        row.source,
    ], search)), [payload.enrollments, search]);
    const filteredAssessments = useMemo(() => payload.assessments.filter((row) => (
        (!assessmentType || row.type === assessmentType) &&
        includesText([row.title, row.type, row.totalMarks, row.weightage], search)
    )), [assessmentType, payload.assessments, search]);
    const filteredGrades = useMemo(() => gradeRows.filter((row) => (
        (!assessmentType || row.assessmentType === assessmentType) &&
        (!gradeStatus || row.grade.status === gradeStatus) &&
        includesText([
            row.assessmentTitle,
            row.assessmentType,
            row.grade.status,
            row.grade.marksObtained,
            row.totalMarks,
            row.grade.answerbookReferenceNumber,
            studentName(row.grade.student),
        ], search)
    )), [assessmentType, gradeRows, gradeStatus, search]);
    const filteredAttendance = useMemo(() => attendanceRows.filter((row) => (
        (!attendanceStatus || row.status === attendanceStatus) &&
        includesText([
            new Date(row.session.date).toLocaleDateString(),
            row.status,
            studentName(row.student),
        ], search)
    )), [attendanceRows, attendanceStatus, search]);
    const filteredSchedules = useMemo(() => payload.schedules.filter((row) => (
        (!scheduleType || row.type === scheduleType) &&
        includesText([
            dayLabels[row.day],
            row.startTime,
            row.endTime,
            row.room,
            row.roomRef?.name,
            row.type,
        ], search)
    )), [payload.schedules, scheduleType, search]);
    const filteredMaterials = useMemo(() => payload.courseMaterials.filter((row) => includesText([
        row.title,
        row.description,
        row.createdAt ? new Date(row.createdAt).toLocaleDateString() : undefined,
    ], search)), [payload.courseMaterials, search]);
    const presentCount = attendanceRows.filter((row) => row.status === 'PRESENT').length;
    const attendanceRate = attendanceRows.length ? `${Math.round((presentCount / attendanceRows.length) * 100)}%` : '-';
    const assessmentTypeOptions = uniqueOptions(payload.assessments.map((assessment) => String(assessment.type)));
    const gradeStatusOptions = uniqueOptions(gradeRows.map((row) => String(row.grade.status)));
    const attendanceStatusOptions = uniqueOptions(attendanceRows.map((row) => String(row.status)));
    const scheduleTypeOptions = uniqueOptions(payload.schedules.map((schedule) => String(schedule.type)));
    const studentColumns: Column<(typeof payload.enrollments)[number]>[] = [
        { header: 'Student', accessor: (row) => studentName(row.student) },
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
    const gradeColumns: Column<GradeRow>[] = [
        { header: 'Student', accessor: (row) => studentName(row.grade.student) },
        { header: 'Assessment', accessor: (row) => <div><p className="font-bold">{row.assessmentTitle}</p><p className="text-xs text-muted-foreground">{row.assessmentType}</p></div> },
        { header: 'Marks', accessor: (row) => `${row.grade.marksObtained} / ${row.totalMarks}` },
        { header: 'Status', accessor: (row) => <Badge variant={gradeVariant(String(row.grade.status))} size="sm">{row.grade.status}</Badge>, badge: true },
        { header: 'Answerbook', accessor: (row) => row.grade.answerbookReferenceNumber || '-' },
        { header: 'Attachments', accessor: (row) => row.grade.answerbookAttachments?.length ? (
            <div className="flex flex-wrap gap-1">
                {row.grade.answerbookAttachments.map((attachment, index) => (
                    <a key={attachment.id} href={attachment.file.path || '#'} className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-bold text-primary hover:bg-primary/5">
                        File {index + 1}
                    </a>
                ))}
            </div>
        ) : '-' },
    ];
    const attendanceColumns: Column<(typeof attendanceRows)[number]>[] = [
        { header: 'Date', accessor: (row) => new Date(row.session.date).toLocaleDateString() },
        { header: 'Student', accessor: (row) => studentName(row.student) || row.studentId },
        { header: 'Status', accessor: (row) => <Badge variant={row.status === 'PRESENT' ? 'success' : row.status === 'ABSENT' ? 'error' : 'neutral'} size="sm">{row.status}</Badge> },
    ];
    const scheduleColumns: Column<(typeof payload.schedules)[number]>[] = [
        { header: 'Day', accessor: (row) => dayLabels[row.day] || row.day },
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
    const activeSecondaryFilter = tab === 'assessments' || tab === 'grades'
        ? 'assessmentType'
        : tab === 'attendance'
            ? 'attendanceStatus'
            : tab === 'schedule'
                ? 'scheduleType'
                : '';

    return (
        <div className="space-y-4">
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Archived section summary">
                <StatTile label="Students" value={payload.enrollments.length} hint={`${payload.enrollmentHistories.length} history rows`} />
                <StatTile label="Assessments" value={payload.assessments.length} hint={`${gradeRows.length} grade rows`} />
                <StatTile label="Attendance" value={attendanceRate} hint={`${attendanceRows.length} records`} />
                <StatTile label="Schedules" value={payload.schedules.length} hint={`${payload.courseMaterials.length} materials`} />
                <StatTile label="Archive" value={`Rev ${record.archiveRevision}`} hint={`Schema ${record.schemaVersion}`} />
            </section>

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
                    { value: 'grades', label: 'Grades', icon: Award, count: gradeRows.length },
                    { value: 'attendance', label: 'Attendance', icon: CheckCircle, count: attendanceRows.length },
                    { value: 'schedule', label: 'Schedule', icon: CalendarDays, count: payload.schedules.length },
                    { value: 'materials', label: 'Materials', icon: FileText, count: payload.courseMaterials.length },
                ]}
            />

            <section className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
                <SearchBar value={search} onChange={setSearch} placeholder={`Search ${tab}...`} size="compact" />
                {activeSecondaryFilter === 'assessmentType' && <div><Label>Assessment Type</Label><CustomSelect value={assessmentType} onChange={setAssessmentType} options={[{ value: '', label: 'All assessment types' }, ...assessmentTypeOptions]} /></div>}
                {tab === 'grades' && <div><Label>Grade Status</Label><CustomSelect value={gradeStatus} onChange={setGradeStatus} options={[{ value: '', label: 'All grade statuses' }, ...gradeStatusOptions]} /></div>}
                {activeSecondaryFilter === 'attendanceStatus' && <div><Label>Attendance Status</Label><CustomSelect value={attendanceStatus} onChange={setAttendanceStatus} options={[{ value: '', label: 'All attendance statuses' }, ...attendanceStatusOptions]} /></div>}
                {activeSecondaryFilter === 'scheduleType' && <div><Label>Schedule Type</Label><CustomSelect value={scheduleType} onChange={setScheduleType} options={[{ value: '', label: 'All schedule types' }, ...scheduleTypeOptions]} /></div>}
            </section>

            {tab === 'students' && <DataTable {...staticPage} totalResults={filteredEnrollments.length} data={filteredEnrollments} columns={studentColumns} keyExtractor={(row) => row.id} emptyTitle="No archived students" />}
            {tab === 'assessments' && <DataTable {...staticPage} totalResults={filteredAssessments.length} data={filteredAssessments} columns={assessmentColumns} keyExtractor={(row) => row.id} emptyTitle="No archived assessments" />}
            {tab === 'grades' && <DataTable {...staticPage} totalResults={filteredGrades.length} data={filteredGrades} columns={gradeColumns} keyExtractor={(row) => row.id} emptyTitle="No archived grades" />}
            {tab === 'attendance' && <DataTable {...staticPage} totalResults={filteredAttendance.length} data={filteredAttendance} columns={attendanceColumns} keyExtractor={(row) => row.id} emptyTitle="No archived attendance" />}
            {tab === 'schedule' && <DataTable {...staticPage} totalResults={filteredSchedules.length} data={filteredSchedules} columns={scheduleColumns} keyExtractor={(row) => row.id} emptyTitle="No archived schedules" />}
            {tab === 'materials' && (
                payload.courseMaterials.length
                    ? <DataTable {...staticPage} totalResults={filteredMaterials.length} data={filteredMaterials} columns={materialColumns} keyExtractor={(row) => row.id} emptyTitle="No matching materials" emptyDescription="Adjust the search to see more archived materials." />
                    : <EmptyState icon={BookOpen} title="No archived materials" description="This section had no course materials at the archive cutoff." />
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Badge variant="neutral" size="sm"><GraduationCap className="mr-1 h-3.5 w-3.5" />Read only</Badge>
                <Badge variant="neutral" size="sm">Checksum {record.checksum.slice(0, 12)}</Badge>
            </div>
        </div>
    );
}
