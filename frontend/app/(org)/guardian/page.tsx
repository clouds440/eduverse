'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import useSWR from 'swr';
import {
    Bell,
    CalendarClock,
    Clock,
    CreditCard,
    FileText,
    GraduationCap,
    Rows3,
    UserRoundCheck,
    Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AttendanceStatus, DashboardInsights, FinalGradeResponse, GuardianOverview, GuardianStudentInsight, Role, type InsightTimeRange } from '@/types';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { getInsightRangePreview, InsightRangeControl } from '@/components/dashboard/InsightRangeControl';
import { Badge } from '@/components/ui/Badge';
import { BrandIcon } from '@/components/ui/Brand';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { PageActionsHostProvider } from '@/components/ui/PageActionsHost';
import { Skeleton } from '@/components/ui/Skeleton';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import Attendance from '@/app/(org)/student/[userId]/_components/Attendance';
import Grades from '@/app/(org)/student/[userId]/_components/Grades';
import { StudentTimetableView } from '@/app/(org)/timetable/page';
import { StudentTranscriptView } from '@/app/(org)/transcripts/page';
import { StudentFeesView } from '@/components/student/StudentFeesView';

type GuardianView = 'overview' | 'students' | 'attendance' | 'grades' | 'timetable' | 'transcript' | 'fees' | 'announcements' | 'profile' | 'assessments';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const viewLabels: Record<GuardianView, string> = {
    overview: 'Overview',
    students: 'Linked Students',
    attendance: 'Attendance',
    grades: 'Grades',
    timetable: 'Timetable',
    transcript: 'Academic Record',
    fees: 'Fees & Payments',
    announcements: 'Announcements',
    profile: 'Profile',
    assessments: 'Assessments',
};

function normalizeView(value: string): GuardianView {
    return value in viewLabels ? value as GuardianView : 'overview';
}

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
            <p className="wrap-break-word text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="mt-1 min-w-0 wrap-break-word text-lg font-black text-foreground">{value}</div>
            {helper && <div className="mt-1 min-w-0 wrap-break-word text-xs font-semibold text-muted-foreground">{helper}</div>}
        </div>
    );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: ReactNode }) {
    return (
        <h2 className="flex min-w-0 items-center gap-2 wrap-break-word text-base font-black">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            {title}
        </h2>
    );
}

function StudentInsightCard({
    insight,
    selected,
    onSelect,
    compact = false,
}: {
    insight: GuardianStudentInsight;
    selected: boolean;
    onSelect: () => void;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`min-w-0 rounded-lg border text-left shadow-sm transition-colors ${
                compact ? 'w-64 shrink-0 p-3' : 'p-4'
            } ${
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
                    className="h-10 w-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 wrap-break-word text-sm font-black text-foreground">{insight.studentName}</h3>
                        {insight.relationship && <Badge variant="neutral" size="sm">{insight.relationship}</Badge>}
                    </div>
                    <p className="mt-1 min-w-0 wrap-break-word text-xs font-semibold text-muted-foreground">{getStudentDisplayId(insight)}</p>
                </div>
            </div>

            {!compact && (
                <div className="mt-4 grid min-w-0 grid-cols-2 gap-2">
                    <DetailCard label="Attendance" value={formatPercent(insight.attendance.rate)} helper={`${insight.attendance.present}/${insight.attendance.total} present`} />
                    <DetailCard label="Grade Avg" value={formatPercent(insight.grades.averagePercentage)} helper={`${insight.grades.count} visible grades`} />
                    <DetailCard label="Today" value={insight.timetable.todayCount} helper="classes scheduled" />
                    <DetailCard label="Balance" value={<FinancialAmount amount={insight.finance.balance} />} helper={insight.finance.overdueCount > 0 ? `${insight.finance.overdueCount} overdue` : 'No overdue flag'} />
                </div>
            )}
        </button>
    );
}

function GuardianStudentHeaderAction({
    selectedInsight,
    studentOptions,
    onSelect,
}: {
    selectedInsight: GuardianStudentInsight;
    studentOptions: { value: string; label: string }[];
    onSelect: (studentId: string) => void;
}) {
    return (
        <div className="flex flex-row items-center justify-center space-x-2 w-full sm:w-72 mr-7">
            <p className="mb-1 text-xs font-black min-w-fit uppercase tracking-widest text-muted-foreground">Viewing student</p>
            <CustomSelect
                value={selectedInsight.studentId}
                onChange={onSelect}
                options={studentOptions}
                className="w-full min-w-50"
                searchable
            />
        </div>
    );
}

interface TabProps {
    data: GuardianOverview;
    selectedInsight: GuardianStudentInsight;
    studentInsights: GuardianStudentInsight[];
    selectedStudentName: string;
    insights?: DashboardInsights | null;
    insightsLoading?: boolean;
}

function OverviewTab({ data, selectedInsight, studentInsights, insights, insightsLoading }: TabProps) {
    const otherStudents = studentInsights.filter((insight) => insight.studentId !== selectedInsight.studentId);

    return (
        <div className="space-y-3">
            <StudentInsightCard
                insight={selectedInsight}
                selected
                onSelect={() => undefined}
            />

            {insights ? (
                <InsightsOverview insights={insights} />
            ) : insightsLoading ? (
                <Skeleton className="h-96 rounded-lg" />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Linked Students" value={data.overviewTotals.linkedStudents ?? studentInsights.length} helper="guardian account scope" />
                </ResourcePanel>
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Average Attendance" value={formatPercent(data.overviewTotals.averageAttendanceRate)} helper="across linked students" />
                </ResourcePanel>
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Upcoming Assessments" value={data.overviewTotals.upcomingAssessments ?? 0} helper="all linked students" />
                </ResourcePanel>
                <ResourcePanel className="overflow-visible p-4">
                    <DetailCard label="Total Balance" value={<FinancialAmount amount={data.overviewTotals.totalBalance || 0} />} helper={`${data.overviewTotals.overdueEntries || 0} overdue entries`} />
                </ResourcePanel>
            </div>

            {otherStudents.length > 0 && (
            <div className="grid min-w-0 gap-3 xl:grid-cols-3">
                {otherStudents.map((insight) => (
                    <StudentInsightCard
                        key={insight.studentId}
                        insight={insight}
                        selected={false}
                        onSelect={() => undefined}
                    />
                ))}
            </div>
            )}
        </div>
    );
}

function StudentsTab({ selectedInsight, studentInsights }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={Users} title="Linked Students" />
            <div className="mt-3 grid min-w-0 gap-3">
                {studentInsights.map((insight) => (
                    <div key={insight.studentId} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="wrap-break-word text-sm font-black text-foreground">{insight.studentName}</p>
                                <p className="mt-1 wrap-break-word text-xs font-semibold text-muted-foreground">
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
    );
}

function AttendanceTab({ data, selectedStudentName }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={Rows3} title={`Attendance for ${selectedStudentName}`} />
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                {(['present', 'absent', 'late', 'excused'] as const).map((key) => (
                    <DetailCard key={key} label={key} value={data.attendanceSummary?.[key] || 0} />
                ))}
            </div>
            <div className="mt-4 space-y-2">
                {(data.recentAttendance || []).slice(0, 12).map((record) => (
                    <div key={record.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="min-w-0">
                            <p className="wrap-break-word text-sm font-bold">{record.session?.section?.course?.name || record.session?.section?.name}</p>
                            <p className="text-xs font-semibold text-muted-foreground">{formatDate(record.session?.date)}</p>
                        </div>
                        <Badge variant={attendanceVariant(record.status)} size="sm">{record.status}</Badge>
                    </div>
                ))}
                {(!data.recentAttendance || data.recentAttendance.length === 0) && (
                    <p className="text-sm font-semibold text-muted-foreground">No attendance records yet.</p>
                )}
            </div>
        </ResourcePanel>
    );
}

function GradesTab({ data, selectedInsight, selectedStudentName }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={GraduationCap} title={`Grades for ${selectedStudentName}`} />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <DetailCard label="Average" value={formatPercent(selectedInsight.grades.averagePercentage)} helper="visible grades" />
                <DetailCard label="Grade Count" value={selectedInsight.grades.count} helper="published/finalized" />
                <DetailCard label="Latest" value={formatPercent(selectedInsight.grades.latestPercentage)} helper={selectedInsight.grades.latestTitle || 'No latest grade'} />
            </div>
            <div className="mt-3 space-y-2">
                {data.recentGrades.map((grade) => (
                    <div key={grade.id} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="wrap-break-word text-sm font-black">{grade.assessment?.title || 'Assessment'}</p>
                                <p className="wrap-break-word text-xs font-semibold text-muted-foreground">
                                    {grade.assessment?.section?.course?.name || grade.assessment?.section?.name}
                                </p>
                            </div>
                            <Badge variant={grade.status === 'FINALIZED' ? 'success' : 'info'} size="sm">{grade.status}</Badge>
                        </div>
                        <p className="mt-2 wrap-break-word text-sm font-bold">
                            {grade.marksObtained}/{grade.assessment?.totalMarks || '-'} marks
                        </p>
                    </div>
                ))}
                {data.recentGrades.length === 0 && (
                    <p className="text-sm font-semibold text-muted-foreground">No published grades yet.</p>
                )}
            </div>
        </ResourcePanel>
    );
}

function TimetableTab({ data, selectedInsight, selectedStudentName }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={Clock} title={`Timetable for ${selectedStudentName}`} />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <DetailCard label="Today" value={selectedInsight.timetable.todayCount} helper="classes" />
                <DetailCard label="Weekly" value={selectedInsight.timetable.scheduledClasses} helper="scheduled classes" />
                <DetailCard label="Next" value={selectedInsight.timetable.nextClassName || '-'} helper={selectedInsight.timetable.nextClassTime || 'No class'} />
            </div>
            <div className="mt-3 space-y-2">
                {data.upcomingSchedule.map((schedule) => (
                    <div key={schedule.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="min-w-0">
                            <p className="wrap-break-word text-sm font-black">{schedule.section?.course?.name || schedule.section?.name}</p>
                            <p className="wrap-break-word text-xs font-semibold text-muted-foreground">{dayNames[schedule.day]} - {schedule.startTime} to {schedule.endTime}</p>
                        </div>
                        <Badge variant="neutral" size="sm">{schedule.room || schedule.section?.room || 'Room TBA'}</Badge>
                    </div>
                ))}
                {data.upcomingSchedule.length === 0 && (
                    <p className="text-sm font-semibold text-muted-foreground">No timetable entries yet.</p>
                )}
            </div>
        </ResourcePanel>
    );
}

function AssessmentsTab({ data, selectedStudentName }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={CalendarClock} title={`Upcoming Assessments for ${selectedStudentName}`} />
            <div className="mt-3 space-y-2">
                {data.upcomingAssessments.map((assessment) => (
                    <div key={assessment.id} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                        <p className="wrap-break-word text-sm font-black">{assessment.title}</p>
                        <p className="wrap-break-word text-xs font-semibold text-muted-foreground">
                            {assessment.section?.course?.name || assessment.section?.name} - Due {formatDate(assessment.dueDate)}
                        </p>
                    </div>
                ))}
                {data.upcomingAssessments.length === 0 && (
                    <p className="text-sm font-semibold text-muted-foreground">No upcoming assessments.</p>
                )}
            </div>
        </ResourcePanel>
    );
}

function FeesTab({ data, selectedStudentName }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={CreditCard} title={`Fees & Payments for ${selectedStudentName}`} />
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
                <DetailCard label="Due" value={<FinancialAmount amount={data.financeSummary?.totalDue || 0} />} />
                <DetailCard label="Paid" value={<FinancialAmount amount={data.financeSummary?.totalPaid || 0} />} />
                <DetailCard label="Balance" value={<FinancialAmount amount={data.financeSummary?.balance || 0} />} />
            </div>
            <div className="mt-3 space-y-2">
                {data.recentFinanceEntries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="min-w-0">
                            <p className="wrap-break-word text-sm font-black">{entry.title}</p>
                            <p className="text-xs font-semibold text-muted-foreground">Due {formatDate(entry.dueDate)}</p>
                        </div>
                        <Badge variant={entry.status === 'PAID' ? 'success' : entry.status === 'OVERDUE' ? 'error' : 'warning'} size="sm">{entry.status}</Badge>
                    </div>
                ))}
                {data.recentFinanceEntries.length === 0 && (
                    <p className="text-sm font-semibold text-muted-foreground">No fee records yet.</p>
                )}
            </div>
        </ResourcePanel>
    );
}

function GuardianAttendanceTab({ studentId }: { studentId: string }) {
    return (
        <ResourcePanel className="p-3 sm:p-4">
            <Attendance studentId={studentId} />
        </ResourcePanel>
    );
}

function GuardianGradesTab({ studentId }: { studentId: string }) {
    const { data: grades = [], isLoading, error, mutate } = useSWR<FinalGradeResponse[]>(
        studentId ? ['student-grades', studentId] as const : null
    );

    return (
        <ResourcePanel className="p-3 sm:p-4">
            {isLoading ? (
                <Skeleton className="h-80 rounded-lg" />
            ) : error ? (
                <ErrorState error={error} onRetry={() => mutate()} />
            ) : (
                <Grades
                    grades={grades}
                    showSectionSelector
                    transcriptHref={`/guardian?view=transcript&studentId=${studentId}`}
                />
            )}
        </ResourcePanel>
    );
}

function GuardianFeesTab({ studentId }: { studentId: string }) {
    return (
        <ResourcePanel className="p-3 sm:p-4">
            <StudentFeesView studentId={studentId} viewerRole={Role.GUARDIAN} />
        </ResourcePanel>
    );
}

function AnnouncementsTab({ data }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={Bell} title="Announcements" />
            <div className="mt-3 space-y-2">
                {data.recentAnnouncements.map((announcement) => (
                    <div key={announcement.id} className="min-w-0 rounded-md border border-border/70 bg-background/60 p-3">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                            <p className="wrap-break-word text-sm font-black">{announcement.title}</p>
                            <Badge variant={announcement.priority === 'URGENT' ? 'error' : announcement.priority === 'HIGH' ? 'warning' : 'neutral'} size="sm">{announcement.priority}</Badge>
                        </div>
                        <p className="mt-1 wrap-break-word text-sm font-semibold text-muted-foreground">{announcement.body}</p>
                    </div>
                ))}
                {data.recentAnnouncements.length === 0 && (
                    <p className="text-sm font-semibold text-muted-foreground">No announcements yet.</p>
                )}
            </div>
        </ResourcePanel>
    );
}

function TranscriptTab({ selectedInsight, selectedStudentName }: TabProps) {
    return (
        <ResourcePanel className="overflow-visible p-4">
            <SectionTitle icon={FileText} title={`Academic Record for ${selectedStudentName}`} />
            <p className="mt-2 wrap-break-word text-sm font-semibold text-muted-foreground">
                This section summarizes the guardian-visible academic record from published and finalized grades. Official transcript generation remains with the school office.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
                <DetailCard label="Visible Grades" value={selectedInsight.grades.count} />
                <DetailCard label="Grade Average" value={formatPercent(selectedInsight.grades.averagePercentage)} />
                <DetailCard label="Enrolled Sections" value={selectedInsight.sections.length} />
            </div>
        </ResourcePanel>
    );
}

function ProfileTab({ data, linkedStudents }: TabProps & { linkedStudents: GuardianOverview['linkedStudents'] }) {
    return (
        <ResourcePanel className="overflow-visible p-0">
            <div className="grid min-w-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="border-b border-border/60 bg-background/35 p-5 lg:border-b-0 lg:border-r">
                    <div className="flex min-w-0 flex-col items-center gap-4 rounded-lg border border-border/70 bg-card/80 p-4 text-center">
                        <BrandIcon variant="user" user={data.guardian.user} size="lg" className="h-20 w-20" />
                        <div className="min-w-0">
                            <p className="wrap-break-word text-sm font-black text-foreground">{data.guardian.user?.name || 'Guardian'}</p>
                            <p className="mt-1 wrap-break-word text-xs font-semibold text-muted-foreground">Guardian Portal</p>
                        </div>
                    </div>
                </aside>
                <div className="min-w-0 space-y-4 p-4 sm:p-5">
                    <SectionTitle icon={UserRoundCheck} title="Guardian Profile" />
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <DetailCard label="Name" value={data.guardian.user?.name || 'Guardian'} />
                        <DetailCard label="Email" value={data.guardian.user?.email || '-'} />
                        <DetailCard label="Phone" value={data.guardian.phone || data.guardian.user?.phone || '-'} />
                        <DetailCard label="Address" value={data.guardian.address || '-'} />
                        <DetailCard label="Linked Students" value={linkedStudents.length} />
                        <DetailCard label="Account" value={data.guardian.user?.status || 'Active'} />
                    </div>
                    <p className="wrap-break-word text-sm font-semibold text-muted-foreground">
                        Contact the school office if profile details need to be updated.
                    </p>
                </div>
            </div>
        </ResourcePanel>
    );
}

function renderGuardianTab(view: GuardianView, props: TabProps & { linkedStudents: GuardianOverview['linkedStudents'] }) {
    switch (view) {
        case 'students':
            return <StudentsTab {...props} />;
        case 'attendance':
            return <GuardianAttendanceTab studentId={props.selectedInsight.studentId} />;
        case 'grades':
            return <GuardianGradesTab studentId={props.selectedInsight.studentId} />;
        case 'timetable':
            return <TimetableTab {...props} />;
        case 'assessments':
            return <AssessmentsTab {...props} />;
        case 'fees':
            return <GuardianFeesTab studentId={props.selectedInsight.studentId} />;
        case 'announcements':
            return <AnnouncementsTab {...props} />;
        case 'transcript':
            return <TranscriptTab {...props} />;
        case 'profile':
            return <ProfileTab {...props} />;
        case 'overview':
        default:
            return <OverviewTab {...props} />;
    }
}

export default function GuardianPortalPage() {
    const { token } = useAuth();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const selectedStudentId = getStringParam('studentId', '');
    const view = normalizeView(getStringParam('view', 'overview'));
    const [insightRange, setInsightRange] = useState<InsightTimeRange>('1M');
    const [tabHeaderActions, setTabHeaderActions] = useState<ReactNode>(null);

    const { data, isLoading, error, mutate } = useSWR<GuardianOverview>(
        token ? ['guardian-overview', selectedStudentId] as const : null,
        () => api.org.getGuardianOverview(token!, selectedStudentId || undefined)
    );

    const linkedStudents = data?.linkedStudents || [];
    const selectedStudent = data?.selectedStudent;
    const studentInsights = data?.studentInsights || [];
    const selectedInsight = data?.selectedInsight || studentInsights.find((insight) => insight.studentId === selectedStudent?.id) || null;
    const selectedStudentName = selectedInsight?.studentName || selectedStudent?.user?.name || 'Selected student';
    const selectedInsightStudentId = selectedInsight?.studentId || selectedStudentId || undefined;

    const { data: guardianInsights, isLoading: guardianInsightsLoading } = useSWR<DashboardInsights>(
        token && selectedInsightStudentId && view === 'overview'
            ? ['guardian-insights', token, selectedInsightStudentId, insightRange] as const
            : null,
        ([, t, studentId]) => api.org.getInsights(t as string, {
            studentId: studentId as string,
            range: insightRange,
        })
    );

    const studentOptions = useMemo(() => studentInsights.map((insight) => ({
        value: insight.studentId,
        label: `${insight.studentName} (${getStudentDisplayId(insight)})`,
    })), [studentInsights]);

    const selectStudent = useCallback((studentId: string) => {
        updateQueryParams({ studentId, view: view === 'overview' ? undefined : view });
    }, [updateQueryParams, view]);

    useEffect(() => {
        if (!selectedStudentId && studentInsights[0]?.studentId && view !== 'profile') {
            selectStudent(studentInsights[0].studentId);
        }
    }, [selectedStudentId, selectStudent, studentInsights, view]);

    useEffect(() => {
        setTabHeaderActions(null);
    }, [view, selectedStudentId]);

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
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-96 rounded-lg" />
            </PageShell>
        );
    }

    if (!data || !selectedStudent || !selectedInsight) {
        return (
            <PageShell>
                <PageHeader
                    title="Guardian Portal"
                    description="Student updates will appear here after your account is linked to a student."
                    icon={UserRoundCheck}
                    breadcrumbs={[{ label: 'Guardian' }, { label: 'Overview' }]}
                    showDateTime
                />
                <EmptyState
                    icon={Users}
                    title="No linked students"
                    description="Ask the school office to link your guardian account to a student record."
                />
            </PageShell>
        );
    }

    const tabProps = {
        data,
        selectedInsight,
        studentInsights,
        selectedStudentName,
        linkedStudents,
        insights: guardianInsights,
        insightsLoading: guardianInsightsLoading,
    };

    const studentHeaderAction = view === 'profile' ? null : (
        <GuardianStudentHeaderAction
            selectedInsight={selectedInsight}
            studentOptions={studentOptions}
            onSelect={selectStudent}
        />
    );
    const rangeHeaderAction = view === 'overview' ? (
        <InsightRangeControl
            value={insightRange}
            onChange={setInsightRange}
            preview={getInsightRangePreview(guardianInsights?.filters)}
        />
    ) : null;
    const headerActions = studentHeaderAction || rangeHeaderAction || tabHeaderActions ? (
        <>
            {studentHeaderAction}
            {rangeHeaderAction}
            {tabHeaderActions}
        </>
    ) : null;

    if (view === 'timetable') {
        return (
            <StudentTimetableView
                studentId={selectedInsight.studentId}
                batchName={selectedInsight.cohortName}
                title="Timetable"
                description="Weekly class schedule for the selected student."
                headerActions={studentHeaderAction}
                breadcrumbs={[{ label: 'Guardian' }, { label: 'Timetable' }, { label: selectedStudentName }]}
            />
        );
    }

    if (view === 'transcript') {
        return (
            <StudentTranscriptView
                studentId={selectedInsight.studentId}
                title="Transcript"
                description="Academic transcript for the selected student."
                headerActions={studentHeaderAction}
                breadcrumbs={[{ label: 'Guardian' }, { label: 'Transcript' }, { label: selectedStudentName }]}
            />
        );
    }

    return (
        <PageActionsHostProvider setActions={setTabHeaderActions}>
            <PageShell>
                <PageHeader
                    title={viewLabels[view]}
                    description={view === 'profile' ? 'Guardian account details and linked-student summary.' : 'Use the student switcher, then open a guardian section from the sidebar.'}
                    icon={UserRoundCheck}
                    breadcrumbs={view === 'profile'
                        ? [{ label: 'Guardian' }, { label: 'Profile Settings' }]
                        : [{ label: 'Guardian' }, { label: viewLabels[view] }, { label: selectedStudentName }]
                    }
                    meta={<Badge variant="primary" size="sm">{linkedStudents.length} linked</Badge>}
                    actions={headerActions}
                    showDateTime
                />

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto custom-scrollbar">
                    {renderGuardianTab(view, tabProps)}
                </div>
            </PageShell>
        </PageActionsHostProvider>
    );
}
