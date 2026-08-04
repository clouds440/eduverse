'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ClipboardList, GraduationCap } from 'lucide-react';
import { DashboardInsights, Student, StudentProgramCycleStatus } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { Loading } from '@/components/ui/Loading';
import { Card } from '@/components/ui/Card';

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
    const completedCycles = major?.cycles.filter((cycle) => [
        StudentProgramCycleStatus.COMPLETED,
        StudentProgramCycleStatus.SKIPPED,
    ].includes(cycle.status)).length || 0;
    const currentCycle = major?.cycles.find((cycle) => cycle.status === StudentProgramCycleStatus.IN_PROGRESS);
    return (
        <div className="space-y-4">
            {major && (
                <Card padding="md" variant="raised" hoverable={false}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-md bg-primary/10 p-2 text-primary">
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black text-foreground">
                                    {major.program.code || major.program.name}
                                </p>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">
                                    {currentCycle ? `${currentCycle.stageNameSnapshot} - ${currentCycle.cycleNameSnapshot}` : 'No cycle currently in progress'}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                            <p className="text-sm font-black text-foreground">{completedCycles} of {major.requiredCycleCountSnapshot}</p>
                            <p className="text-xs font-semibold text-muted-foreground">required cycles completed</p>
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
