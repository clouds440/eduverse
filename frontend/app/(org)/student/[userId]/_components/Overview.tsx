'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { BookOpenCheck, CalendarClock, ClipboardList, Clock3, GraduationCap, Layers3 } from 'lucide-react';
import { DashboardInsights, Student, StudentStageEnrollmentStatus } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { Loading } from '@/components/ui/Loading';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function Overview({
    insights,
    student,
}: {
    insights: DashboardInsights | null;
    student: Student;
}) {
    const { token, user } = useAuth();
    const { data } = useSWR(token ? ['student-evaluation-overview', token] as const : null, ([, t]) => api.org.getEvaluationPending(t as string));

    if (!insights) {
        return <Loading size="lg" />;
    }
    const major = student.majorProgramEnrollment;
    const programOverview = student.programOverview;
    const completedStages = major?.stageEnrollments.filter((stage) => [
        StudentStageEnrollmentStatus.COMPLETED,
        StudentStageEnrollmentStatus.SKIPPED,
    ].includes(stage.status)).length || 0;
    const currentStage = major?.stageEnrollments.find((stage) => stage.status === StudentStageEnrollmentStatus.IN_PROGRESS);
    return (
        <div className="space-y-4">
            {major && (
                <Card padding="md" variant="raised" hoverable={false}>
                    <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-md bg-primary/10 p-2 text-primary">
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-foreground">
                                    {major.program.code} - {major.program.name}
                                </p>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">
                                    {major.program.department?.name || 'Department not assigned'}
                                </p>
                            </div>
                        </div>
                        <Badge variant={major.status === 'ACTIVE' ? 'success' : 'neutral'}>{major.status}</Badge>
                    </div>
                    <div className="grid gap-x-6 gap-y-4 border-y border-border/60 py-4 sm:grid-cols-2 xl:grid-cols-4">
                        <ProgramFact icon={Layers3} label="Current stage" value={currentStage ? `${currentStage.stageNameSnapshot} · ${currentStage.cycleNameSnapshot}` : 'Awaiting placement'} />
                        <ProgramFact icon={BookOpenCheck} label="Curriculum" value={programOverview?.curriculum?.name || major.curriculumVersion?.name || 'Not available'} />
                        <ProgramFact icon={Clock3} label="Program duration" value={programOverview?.duration || 'Not specified'} />
                        <ProgramFact icon={CalendarClock} label="Expected graduation" value={formatProgramDate(programOverview?.expectedGraduationDate)} detail={programOverview?.graduationDateSource === 'PROGRAM_DURATION_ESTIMATE' ? 'Estimated from program duration' : programOverview?.graduationDateSource === 'RECORDED' ? 'Recorded graduation date' : undefined} />
                        <ProgramFact icon={GraduationCap} label="Stage progress" value={`${programOverview?.resolvedStageCount ?? completedStages} of ${programOverview?.requiredStageCount ?? major.requiredStageCountSnapshot}`} detail={`${programOverview?.remainingStageCount ?? Math.max(0, major.requiredStageCountSnapshot - completedStages)} remaining`} />
                        <ProgramFact icon={BookOpenCheck} label="Credit progress" value={programOverview?.totalCredits ? `${programOverview.completedCredits} of ${programOverview.totalCredits}` : 'Not credit-defined'} />
                        <ProgramFact icon={Layers3} label="Next stage" value={programOverview?.nextStage?.name || (programOverview?.remainingStageCount === 0 ? 'Program requirements resolved' : 'Not yet determined')} />
                        <ProgramFact icon={Clock3} label="Progression policy" value={(programOverview?.progressionMode || major.program.progressionMode).replaceAll('_', ' ')} detail={(programOverview?.completionMode || major.program.completionMode).replaceAll('_', ' ')} />
                    </div>
                    <div>
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground"><span>Program completion</span><span>{programOverview?.progressPercentage ?? Math.round((completedStages / Math.max(1, major.requiredStageCountSnapshot)) * 100)}%</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${programOverview?.progressPercentage ?? Math.round((completedStages / Math.max(1, major.requiredStageCountSnapshot)) * 100)}%` }} /></div>
                    </div>
                    </div>
                </Card>
            )}
            {data && data.pending.length > 0 && user?.id && (
                <Card padding="md" variant="raised" hoverable={false}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="rounded-md bg-primary/10 p-2 text-primary">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">{data.pending.length} evaluation{data.pending.length === 1 ? '' : 's'} pending</p>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">Feedback is open for courses or teachers you are eligible to review.</p>
                            </div>
                        </div>
                        <Link
                            href={`/student/${user.id}?tab=evaluations`}
                            className="inline-flex min-h-10 items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-center"
                        >
                            Review now
                        </Link>
                    </div>
                </Card>
            )}
            <InsightsOverview insights={insights} />
        </div>
    );
}

function ProgramFact({ icon: Icon, label, value, detail }: { icon: typeof GraduationCap; label: string; value: string; detail?: string }) {
    return <div className="flex min-w-0 items-start gap-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-black text-foreground">{value}</p>{detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}</div></div>;
}

function formatProgramDate(value?: string | null) {
    if (!value) return 'Not yet available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not yet available' : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
