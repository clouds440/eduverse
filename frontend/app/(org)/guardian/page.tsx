'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import useSWR from 'swr';
import { AlertCircle, Bell, CalendarClock, CheckCircle2, Clock, CreditCard, FileText, GraduationCap, Rows3, Search, UserRoundCheck, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AttendanceStatus, GuardianOverview } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function attendanceVariant(status: AttendanceStatus) {
    if (status === AttendanceStatus.PRESENT) return 'success';
    if (status === AttendanceStatus.ABSENT) return 'error';
    if (status === AttendanceStatus.LATE) return 'warning';
    return 'neutral';
}

function percent(value: number, total: number) {
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
}

export default function GuardianPortalPage() {
    const { token } = useAuth();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const selectedStudentId = getStringParam('studentId', '');
    const view = getStringParam('view', '');

    const { data, isLoading, error, mutate } = useSWR<GuardianOverview>(
        token ? ['guardian-overview', selectedStudentId] as const : null,
        () => api.org.getGuardianOverview(token!, selectedStudentId || undefined)
    );

    const linkedStudents = data?.linkedStudents || [];
    const selectedStudent = data?.selectedStudent;
    const selectedStudentName = selectedStudent?.user?.name || 'Selected student';

    useEffect(() => {
        if (!view) return;
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
                    <Skeleton className="h-32 rounded-lg" />
                    <Skeleton className="h-32 rounded-lg" />
                    <Skeleton className="h-32 rounded-lg" />
                </div>
                <Skeleton className="h-80 rounded-lg" />
            </PageShell>
        );
    }

    if (!selectedStudent) {
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
        <PageShell>
            <PageHeader
                title="Guardian Portal"
                description="Choose a student, then review their school updates in one place."
                icon={UserRoundCheck}
                breadcrumbs={[{ label: 'Guardian' }, { label: selectedStudentName }]}
                meta={<Badge variant="primary" size="sm">{linkedStudents.length} linked</Badge>}
            />

            <div id="students">
                <StatusBanner
                    variant="info"
                    icon={Search}
                    title="Choose student"
                    description="Everything below changes when you choose a different linked student."
                >
                    <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {linkedStudents.map((student) => {
                                const isSelected = student.id === selectedStudent.id;
                                return (
                                    <button
                                        key={student.id}
                                        type="button"
                                        onClick={() => updateQueryParams({ studentId: student.id })}
                                        className={`rounded-md border p-3 text-left transition-colors ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/40'}`}
                                    >
                                        <p className="truncate text-sm font-black">{student.user?.name || 'Student'}</p>
                                        <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                                            {student.rollNumber || student.registrationNumber || 'No roll number'}
                                        </p>
                                        {student.guardianRelationship && (
                                            <Badge variant="neutral" size="sm" className="mt-2">{student.guardianRelationship}</Badge>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <CustomSelect
                            value={selectedStudent.id}
                            onChange={(value) => updateQueryParams({ studentId: value })}
                            options={linkedStudents.map((student) => ({
                                value: student.id,
                                label: student.user?.name || student.registrationNumber || 'Student',
                            }))}
                            searchable
                        />
                    </div>
                </StatusBanner>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <ResourcePanel className="p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Attendance
                    </div>
                    <p className="mt-3 text-3xl font-black text-foreground">
                        {percent(data?.attendanceSummary?.present || 0, data?.attendanceSummary?.total || 0)}
                    </p>
                    <p className="text-sm font-semibold text-muted-foreground">
                        Present across recent records
                    </p>
                </ResourcePanel>
                <ResourcePanel className="p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-foreground">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        Recent Grades
                    </div>
                    <p className="mt-3 text-3xl font-black text-foreground">{data?.recentGrades.length || 0}</p>
                    <p className="text-sm font-semibold text-muted-foreground">Published or finalized grades</p>
                </ResourcePanel>
                <ResourcePanel className="p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-foreground">
                        <CreditCard className="h-4 w-4 text-warning" />
                        Balance
                    </div>
                    <p className="mt-3 text-3xl font-black text-foreground">
                        <FinancialAmount amount={data?.financeSummary?.balance || 0} />
                    </p>
                    <p className="text-sm font-semibold text-muted-foreground">Recent student fee balance</p>
                </ResourcePanel>
            </div>

            <div className="grid min-h-0 gap-3 xl:grid-cols-2">
                <ResourcePanel id="attendance" className="p-4">
                    <h2 className="flex items-center gap-2 text-base font-black">
                        <Rows3 className="h-5 w-5 text-primary" />
                        Attendance
                    </h2>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(['present', 'absent', 'late', 'excused'] as const).map((key) => (
                            <div key={key} className="rounded-md border border-border/70 bg-background p-3">
                                <p className="text-xs font-bold uppercase text-muted-foreground">{key}</p>
                                <p className="mt-1 text-xl font-black">{data?.attendanceSummary?.[key] || 0}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 space-y-2">
                        {(data?.recentAttendance || []).slice(0, 5).map((record) => (
                            <div key={record.id} className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold">{record.session?.section?.course?.name || record.session?.section?.name}</p>
                                    <p className="text-xs font-semibold text-muted-foreground">{record.session?.date ? new Date(record.session.date).toLocaleDateString() : '-'}</p>
                                </div>
                                <Badge variant={attendanceVariant(record.status)} size="sm">{record.status}</Badge>
                            </div>
                        ))}
                        {(!data?.recentAttendance || data.recentAttendance.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No attendance records yet.</p>
                        )}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="grades" className="p-4">
                    <h2 className="flex items-center gap-2 text-base font-black">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        Grades
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data?.recentGrades.map((grade) => (
                            <div key={grade.id} className="rounded-md border border-border/70 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black">{grade.assessment?.title || 'Assessment'}</p>
                                        <p className="text-xs font-semibold text-muted-foreground">
                                            {grade.assessment?.section?.course?.name || grade.assessment?.section?.name}
                                        </p>
                                    </div>
                                    <Badge variant={grade.status === 'FINALIZED' ? 'success' : 'info'} size="sm">{grade.status}</Badge>
                                </div>
                                <p className="mt-2 text-sm font-bold">
                                    {grade.marksObtained}/{grade.assessment?.totalMarks || '-'} marks
                                </p>
                            </div>
                        ))}
                        {(!data?.recentGrades || data.recentGrades.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No published grades yet.</p>
                        )}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="timetable" className="p-4">
                    <h2 className="flex items-center gap-2 text-base font-black">
                        <Clock className="h-5 w-5 text-primary" />
                        Timetable
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data?.upcomingSchedule.map((schedule) => (
                            <div key={schedule.id} className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{schedule.section?.course?.name || schedule.section?.name}</p>
                                    <p className="text-xs font-semibold text-muted-foreground">{dayNames[schedule.day]} - {schedule.startTime} to {schedule.endTime}</p>
                                </div>
                                <Badge variant="neutral" size="sm">{schedule.room || schedule.section?.room || 'Room TBA'}</Badge>
                            </div>
                        ))}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="assessments" className="p-4">
                    <h2 className="flex items-center gap-2 text-base font-black">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Upcoming Assessments
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data?.upcomingAssessments.map((assessment) => (
                            <div key={assessment.id} className="rounded-md border border-border/70 p-3">
                                <p className="truncate text-sm font-black">{assessment.title}</p>
                                <p className="text-xs font-semibold text-muted-foreground">
                                    {assessment.section?.course?.name || assessment.section?.name} - Due {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString() : 'soon'}
                                </p>
                            </div>
                        ))}
                        {(!data?.upcomingAssessments || data.upcomingAssessments.length === 0) && (
                            <p className="text-sm font-semibold text-muted-foreground">No upcoming assessments.</p>
                        )}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="fees" className="p-4">
                    <h2 className="flex items-center gap-2 text-base font-black">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Fees & Payments
                    </h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-md border border-border/70 p-3">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Due</p>
                            <FinancialAmount amount={data?.financeSummary?.totalDue || 0} />
                        </div>
                        <div className="rounded-md border border-border/70 p-3">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Paid</p>
                            <FinancialAmount amount={data?.financeSummary?.totalPaid || 0} />
                        </div>
                        <div className="rounded-md border border-border/70 p-3">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Balance</p>
                            <FinancialAmount amount={data?.financeSummary?.balance || 0} />
                        </div>
                    </div>
                    <div className="mt-3 space-y-2">
                        {data?.recentFinanceEntries.slice(0, 4).map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{entry.title}</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Due {new Date(entry.dueDate).toLocaleDateString()}</p>
                                </div>
                                <Badge variant={entry.status === 'PAID' ? 'success' : 'warning'} size="sm">{entry.status}</Badge>
                            </div>
                        ))}
                    </div>
                </ResourcePanel>

                <ResourcePanel id="announcements" className="p-4">
                    <h2 className="flex items-center gap-2 text-base font-black">
                        <Bell className="h-5 w-5 text-primary" />
                        Announcements
                    </h2>
                    <div className="mt-3 space-y-2">
                        {data?.recentAnnouncements.map((announcement) => (
                            <div key={announcement.id} className="rounded-md border border-border/70 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-black">{announcement.title}</p>
                                    <Badge variant={announcement.priority === 'URGENT' ? 'error' : announcement.priority === 'HIGH' ? 'warning' : 'neutral'} size="sm">{announcement.priority}</Badge>
                                </div>
                                <p className="mt-1 line-clamp-2 text-sm font-semibold text-muted-foreground">{announcement.body}</p>
                            </div>
                        ))}
                    </div>
                </ResourcePanel>
            </div>

            <ResourcePanel id="transcript" className="p-4">
                <h2 className="flex items-center gap-2 text-base font-black">
                    <FileText className="h-5 w-5 text-primary" />
                    Transcript
                </h2>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                    Transcript details are available from the school office. Published and finalized grades shown above are the guardian-facing academic record in this portal.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/contact">
                        <Button type="button" variant="secondary" icon={AlertCircle}>Contact School</Button>
                    </Link>
                </div>
            </ResourcePanel>

            <ResourcePanel id="profile" className="p-4">
                <h2 className="flex items-center gap-2 text-base font-black">
                    <UserRoundCheck className="h-5 w-5 text-primary" />
                    Profile
                </h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-border/70 p-3">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Name</p>
                        <p className="mt-1 font-black">{data?.guardian.user?.name || 'Guardian'}</p>
                    </div>
                    <div className="rounded-md border border-border/70 p-3">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Email</p>
                        <p className="mt-1 truncate font-black">{data?.guardian.user?.email}</p>
                    </div>
                    <div className="rounded-md border border-border/70 p-3">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Phone</p>
                        <p className="mt-1 font-black">{data?.guardian.phone || data?.guardian.user?.phone || '-'}</p>
                    </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                    Contact the school office if these details need to be updated.
                </p>
            </ResourcePanel>
        </PageShell>
    );
}
