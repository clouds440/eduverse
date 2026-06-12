'use client';

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import useSWR from 'swr';
import {
    Bell,
    CalendarClock,
    CheckCircle2,
    Clock,
    CreditCard,
    FileText,
    GraduationCap,
    Rows3,
    Search,
    UserRoundCheck,
    Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AttendanceStatus, GuardianOverview, GuardianStudentInsight, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { BrandIcon } from '@/components/ui/Brand';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function attendanceVariant(status?: AttendanceStatus | null) {
    if (status === AttendanceStatus.PRESENT) return 'success';
    if (status === AttendanceStatus.ABSENT) return 'error';
    if (status === AttendanceStatus.LATE) return 'warning';
    return 'neutral';
}

function formatDate(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
}

function formatPercent(value?: number | null) {
    return value === null || value === undefined ? '-' : `${value}%`;
}

function getStudentDisplayId(student: GuardianStudentInsight) {
    return student.rollNumber || student.registrationNumber || 'No roll number';
}

function DetailCard({ label, value, helper }: { label: string; value: ReactNode; helper?: ReactNode }) {
    return (
        <div className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="mt-1 min-w-0 break-words text-lg font-black text-foreground">{value}</div>
            {helper && <div className="mt-1 min-w-0 break-words text-xs font-semibold text-muted-foreground">{helper}</div>}
        </div>
    );
}

function StudentInsightCard({
    insight,
    selected,
    onSelect,
}: {
    insight: GuardianStudentInsight;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`min-w-0 rounded-lg border p-4 text-left shadow-sm transition-colors ${
                selected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                    : 'border-border/70 bg-card hover:border-primary/40 hover:bg-primary/5'
            }`}
        >
            <div className="flex min-w-0 items-start gap-3">
                <BrandIcon
                    variant="user"
                    user={{
                        id: insight.studentId,
                        name: insight.studentName,
                        userName: '',
                        role: Role.STUDENT,
                        avatarUrl: insight.avatarUrl,
                        avatarUpdatedAt: insight.avatarUpdatedAt,
                    }}
                    size="sm"
                    className="h-11 w-11 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 break-words text-base font-black text-foreground">{insight.studentName}</h3>
                        {insight.relationship && <Badge variant="neutral" size="sm">{insight.relationship}</Badge>}
                    </div>
                    <p className="mt-1 min-w-0 break-words text-xs font-semibold text-muted-foreground">{getStudentDisplayId(insight)}</p>
                </div>
            </div>

            <div className="mt-4 grid min-w-0 grid-cols-2 gap-2">
                <DetailCard label="Attendance" value={formatPercent(insight.attendance.rate)} helper={`${insight.attendance.present}/${insight.attendance.total} present`} />
                <DetailCard label="Grade Avg" value={formatPercent(insight.grades.averagePercentage)} helper={`${insight.grades.count} visible grades`} />
                <DetailCard label="Today" value={insight.timetable.todayCount} helper="classes scheduled" />
                <DetailCard label="Balance" value={<FinancialAmount amount={insight.finance.balance} />} helper={insight.finance.overdueCount > 0 ? `${insight.finance.overdueCount} overdue` : 'No overdue flag'} />
            </div>
        </button>
    );
}

export default function GuardianPortalPage() {
    const { token } = useAuth();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const selectedStudentId = getStringParam('studentId', '');
    const view = getStringParam('view', 'overview');

    const { data, isLoading, error, mutate } = useSWR<GuardianOverview>(
        token ? ['guardian-overview', selectedStudentId] as const : null,
        () => api.org.getGuardianOverview(token!, selectedStudentId || undefined)
    );

    const linkedStudents = data?.linkedStudents || [];
    const selectedStudent = data?.selectedStudent;
    const studentInsights = data?.studentInsights || [];
    const selectedInsight = data?.selectedInsight || studentInsights.find((insight) => insight.studentId === selectedStudent?.id) || null;
    const selectedStudentName = selectedInsight?.studentName || selectedStudent?.user?.name || 'Selected student';

    const studentOptions = useMemo(() => studentInsights.map((insight) => ({
        value: insight.studentId,
        label: `${insight.studentName} (${getStudentDisplayId(insight)})`,
    })), [studentInsights]);

    const selectStudent = (studentId: string) => updateQueryParams({ studentId, view: view === 'overview' ? undefined : view });

    useEffect(() => {
        if (!view || view === 'overview') return;
        window.setTimeout(() => {
            document.getElementById(view)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    }, [selectedStudent?.id, view]);

    if (error) {
        return (
            <PageShell>
                <ErrorState error={error} onRetry={() => mutate()} />
            </PageShell>
        );
    }

    if (isLoading && !data) {
        return (
            <PageShell>
                <Skeleton className="h-28 rounded-lg" />
                <div className="grid gap-3 md:grid-cols-3">
                    <Skeleton className="h-36 rounded-lg" />
                    <Skeleton className="h-36 rounded-lg" />
                    <Skeleton className="h-36 rounded-lg" />
                </div>
                <Skeleton className="h-96 rounded-lg" />
            </PageShell>
        );
    }

    if (!selectedStudent || !selectedInsight) {
        return (
            <PageShell>
                <PageHeader
                    title="Guardian Portal"
                    description="Student updates will appear here after your account is linked to a student."
                    icon={UserRoundCheck}
                    breadcrumbs={[{ label: 'Guardian' }, { label: 'Overview' }]}
                />
                <EmptyState
                    icon={Users}
                    title="No linked students"
                    description="Ask the school office to link your guardian account to a student record."
                />
            </PageShell>
        );
    }

    return (
        <PageShell className="overflow-visible">
            <PageHeader
                title="Guardian Portal"
                description="Choose a linked student, then review attendance, grades, timetable, fees, and school updates with that student clearly in focus."
                icon={UserRoundCheck}
                breadcrumbs={[{ label: 'Guardian' }, { label: selectedStudentName }]}
                meta={<Badge variant="primary" size="sm">{linkedStudents.length} linked</Badge>}
            />

            <StatusBanner
                variant="info"
                icon={Search}
                title="Student selector"
                description="Every section below uses the selected student. Switch here before opening attendance, grades, timetable, or fees."
            >
                <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                        {studentInsights.map((insight) => (
                            <StudentInsightCard
                                key={insight.studentId}
                                insight={insight}
                                selected={insight.studentId === selectedInsight.studentId}
                                onSelect={() => selectStudent(insight.studentId)}
                            />
                        ))}
                    </div>
                    <div className="min-w-0 rounded-lg border border-border/70 bg-card p-3">
                        <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Currently viewing</p>
                        <CustomSelect
                            value={selectedInsight.studentId}
                            onChange={selectStudent}
                            options={studentOptions}
                            searchable
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="neutral" size="sm">{selectedInsight.sections.length} sections</Badge>
                            <Badge variant={selectedInsight.finance.overdueCount > 0 ? 'warning' : 'success'} size="sm">
                                {selectedInsight.finance.overdueCount > 0 ? `${selectedInsight.finance.overdueCount} overdue` : 'Fees ok'}
                            </Badge>
                            <Badge variant={attendanceVariant(selectedInsight.attendance.latestStatus)} size="sm">
                                {selectedInsight.attendance.latestStatus || 'No attendance yet'}
                            </Badge>
                        </div>
                    </div>
                </div>
            </StatusBanner>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Linked Students" value={data?.overviewTotals.linkedStudents ?? studentInsights.length} helper="guardian account scope" />
                </ResourcePanel>
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Average Attendance" value={formatPercent(data?.overviewTotals.averageAttendanceRate)} helper="across linked students" />
                </ResourcePanel>
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Upcoming Assessments" value={data?.overviewTotals.upcomingAssessments ?? 0} helper="all linked students" />
                </ResourcePanel>
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Total Balance" value={<FinancialAmount amount={data?.overviewTotals.totalBalance || 0} />} helper={`${data?.overviewTotals.overdueEntries || 0} overdue entries`} />
                </ResourcePanel>
            </div>

            <div className="grid min-w-0 gap-3 xl:grid-cols-2">
                <ResourcePanel id="students" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <Users className="h-5 w-5 shrink-0 text-primary" />
                        Linked Students
                    </h2>
                    <div className="mt-3 grid min-w-0 gap-3">
                        {studentInsights.map((insight) => (
                            <div key={insight.studentId} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-black text-foreground">{insight.studentName}</p>
                                        <p className="mt-1 break-words text-xs font-semibold text-muted-foreground">
                                            {getStudentDisplayId(insight)}{insight.cohortName ? ` - ${insight.cohortName}` : ''}
                                        </p>
                                    </div>
                                    <Badge variant={insight.studentId === selectedInsight.studentId ? 'primary' : 'neutral'} size="sm">
                                        {insight.studentId === selectedInsight.studentId ? 'Viewing' : 'Linked'}
                                    </Badge>
                                </div>
                                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                                    {insight.sections.map((section) => (
                                        <Badge key={section.id} variant="neutral" size="sm">
                                            {section.courseName}
                                        </Badge>
                                    ))}
                                    {insight.sections.length === 0 && <Badge variant="warning" size="sm">No active sections</Badge>}
                                </div>
                            </div>
                        ))}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="attendance" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <Rows3 className="h-5 w-5 shrink-0 text-primary" />
                        Attendance for {selectedStudentName}
                    </h2>
                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                        {(['present', 'absent', 'late', 'excused'] as const).map((key) => (
                            <DetailCard key={key} label={key} value={data?.attendanceSummary?.[key] || 0} />
                        ))}
                    </div>
                    <div className="mt-4 space-y-2">
                        {(data?.recentAttendance || []).slice(0, 8).map((record) => (
                            <div key={record.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-bold">{record.session?.section?.course?.name || record.session?.section?.name}</p>
                                    <p className="text-xs font-semibold text-muted-foreground">{formatDate(record.session?.date)}</p>
                                </div>
                                <Badge variant={attendanceVariant(record.status)} size="sm">{record.status}</Badge>
                            </div>
                        ))}
                        {(!data?.recentAttendance || data.recentAttendance.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No attendance records yet.</p>
                        )}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="grades" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
                        Grades for {selectedStudentName}
                    </h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <DetailCard label="Average" value={formatPercent(selectedInsight.grades.averagePercentage)} helper="visible grades" />
                        <DetailCard label="Grade Count" value={selectedInsight.grades.count} helper="published/finalized" />
                        <DetailCard label="Latest" value={formatPercent(selectedInsight.grades.latestPercentage)} helper={selectedInsight.grades.latestTitle || 'No latest grade'} />
                    </div>
                    <div className="mt-3 space-y-2">
                        {data?.recentGrades.map((grade) => (
                            <div key={grade.id} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-black">{grade.assessment?.title || 'Assessment'}</p>
                                        <p className="break-words text-xs font-semibold text-muted-foreground">
                                            {grade.assessment?.section?.course?.name || grade.assessment?.section?.name}
                                        </p>
                                    </div>
                                    <Badge variant={grade.status === 'FINALIZED' ? 'success' : 'info'} size="sm">{grade.status}</Badge>
                                </div>
                                <p className="mt-2 break-words text-sm font-bold">
                                    {grade.marksObtained}/{grade.assessment?.totalMarks || '-'} marks
                                </p>
                            </div>
                        ))}
                        {(!data?.recentGrades || data.recentGrades.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No published grades yet.</p>
                        )}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="timetable" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <Clock className="h-5 w-5 shrink-0 text-primary" />
                        Timetable for {selectedStudentName}
                    </h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <DetailCard label="Today" value={selectedInsight.timetable.todayCount} helper="classes" />
                        <DetailCard label="Weekly" value={selectedInsight.timetable.scheduledClasses} helper="scheduled classes" />
                        <DetailCard label="Next" value={selectedInsight.timetable.nextClassName || '-'} helper={selectedInsight.timetable.nextClassTime || 'No class'} />
                    </div>
                    <div className="mt-3 space-y-2">
                        {data?.upcomingSchedule.map((schedule) => (
                            <div key={schedule.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-black">{schedule.section?.course?.name || schedule.section?.name}</p>
                                    <p className="break-words text-xs font-semibold text-muted-foreground">{dayNames[schedule.day]} - {schedule.startTime} to {schedule.endTime}</p>
                                </div>
                                <Badge variant="neutral" size="sm">{schedule.room || schedule.section?.room || 'Room TBA'}</Badge>
                            </div>
                        ))}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="assessments" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
                        Upcoming Assessments for {selectedStudentName}
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data?.upcomingAssessments.map((assessment) => (
                            <div key={assessment.id} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                                <p className="break-words text-sm font-black">{assessment.title}</p>
                                <p className="break-words text-xs font-semibold text-muted-foreground">
                                    {assessment.section?.course?.name || assessment.section?.name} - Due {formatDate(assessment.dueDate)}
                                </p>
                            </div>
                        ))}
                        {(!data?.upcomingAssessments || data.upcomingAssessments.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No upcoming assessments.</p>
                        )}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="fees" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <CreditCard className="h-5 w-5 shrink-0 text-primary" />
                        Fees & Payments for {selectedStudentName}
                    </h2>
                    <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
                        <DetailCard label="Due" value={<FinancialAmount amount={data?.financeSummary?.totalDue || 0} />} />
                        <DetailCard label="Paid" value={<FinancialAmount amount={data?.financeSummary?.totalPaid || 0} />} />
                        <DetailCard label="Balance" value={<FinancialAmount amount={data?.financeSummary?.balance || 0} />} />
                    </div>
                    <div className="mt-3 space-y-2">
                        {data?.recentFinanceEntries.slice(0, 6).map((entry) => (
                            <div key={entry.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-black">{entry.title}</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Due {formatDate(entry.dueDate)}</p>
                                </div>
                                <Badge variant={entry.status === 'PAID' ? 'success' : entry.status === 'OVERDUE' ? 'error' : 'warning'} size="sm">{entry.status}</Badge>
                            </div>
                        ))}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="announcements" className="overflow-visible p-4">
                    <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                        <Bell className="h-5 w-5 shrink-0 text-primary" />
                        Announcements
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data?.recentAnnouncements.map((announcement) => (
                            <div key={announcement.id} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                                    <p className="break-words text-sm font-black">{announcement.title}</p>
                                    <Badge variant={announcement.priority === 'URGENT' ? 'error' : announcement.priority === 'HIGH' ? 'warning' : 'neutral'} size="sm">{announcement.priority}</Badge>
                                </div>
                                <p className="mt-1 break-words text-sm font-semibold text-muted-foreground">{announcement.body}</p>
                            </div>
                        ))}
                        {(!data?.recentAnnouncements || data.recentAnnouncements.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No announcements yet.</p>
                        )}
                    </div>
                </ResourcePanel>
            </div>

            <ResourcePanel id="transcript" className="overflow-visible p-4">
                <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    Academic Record for {selectedStudentName}
                </h2>
                <p className="mt-2 break-words text-sm font-semibold text-muted-foreground">
                    This section summarizes the guardian-visible academic record from published and finalized grades. Official transcript generation remains with the school office.
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <DetailCard label="Visible Grades" value={selectedInsight.grades.count} />
                    <DetailCard label="Grade Average" value={formatPercent(selectedInsight.grades.averagePercentage)} />
                    <DetailCard label="Enrolled Sections" value={selectedInsight.sections.length} />
                </div>
            </ResourcePanel>

            <ResourcePanel id="profile" className="overflow-visible p-0">
                <div className="grid min-w-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="border-b border-border/60 bg-background/35 p-5 lg:border-b-0 lg:border-r">
                        <div className="flex min-w-0 flex-col items-center gap-4 rounded-lg border border-border/70 bg-card/80 p-4 text-center">
                            <BrandIcon variant="user" user={data?.guardian.user} size="lg" className="h-20 w-20" />
                            <div className="min-w-0">
                                <p className="break-words text-sm font-black text-foreground">{data?.guardian.user?.name || 'Guardian'}</p>
                                <p className="mt-1 break-words text-xs font-semibold text-muted-foreground">Guardian Portal</p>
                            </div>
                        </div>
                    </aside>
                    <div className="min-w-0 space-y-4 p-4 sm:p-5">
                        <h2 className="flex min-w-0 items-center gap-2 break-words text-base font-black">
                            <UserRoundCheck className="h-5 w-5 shrink-0 text-primary" />
                            Guardian Profile
                        </h2>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <DetailCard label="Name" value={data?.guardian.user?.name || 'Guardian'} />
                            <DetailCard label="Email" value={data?.guardian.user?.email || '-'} />
                            <DetailCard label="Phone" value={data?.guardian.phone || data?.guardian.user?.phone || '-'} />
                            <DetailCard label="Address" value={data?.guardian.address || '-'} />
                            <DetailCard label="Linked Students" value={linkedStudents.length} />
                            <DetailCard label="Account" value={data?.guardian.user?.status || 'Active'} />
                        </div>
                        <p className="break-words text-sm font-semibold text-muted-foreground">
                            Contact the school office if profile details need to be updated.
                        </p>
                    </div>
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
