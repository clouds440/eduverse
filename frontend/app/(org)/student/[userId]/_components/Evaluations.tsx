'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, ClipboardList, Lock, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { EvaluationPendingTask, EvaluationType } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { EvaluationFormModal } from '@/components/evaluations/EvaluationFormModal';
import { StarRatingInput } from '@/components/evaluations/StarRatingInput';

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to save evaluation';
}

function taskTitle(task: EvaluationPendingTask) {
    if (task.type === EvaluationType.TEACHER) {
        return task.teacher?.user?.name || task.teacher?.user?.email || 'Teacher feedback';
    }
    return task.course?.name || 'Course feedback';
}

function taskSubtitle(task: EvaluationPendingTask) {
    return [task.course?.name, task.section?.name, task.academicCycle?.name].filter(Boolean).join(' · ');
}

function TaskCard({ task, onOpen }: { task: EvaluationPendingTask; onOpen: (task: EvaluationPendingTask) => void }) {
    const completed = Boolean(task.evaluation);
    return (
        <Card padding="md" variant={completed ? 'muted' : 'default'} hoverable>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={task.type === EvaluationType.TEACHER ? 'info' : 'primary'} size="sm">
                            {task.type === EvaluationType.TEACHER ? 'Teacher' : 'Course'}
                        </Badge>
                        {completed && <Badge variant="success" size="sm" icon={CheckCircle}>Completed</Badge>}
                    </div>
                    <h3 className="text-base font-black text-foreground">{taskTitle(task)}</h3>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{taskSubtitle(task)}</p>
                </div>
                {completed && <StarRatingInput value={task.evaluation?.rating || 0} readOnly />}
            </div>
            <div className="mt-4 flex justify-end">
                <Button
                    type="button"
                    size="sm"
                    variant={completed ? 'outline' : 'primary'}
                    icon={completed ? Pencil : ClipboardList}
                    onClick={() => onOpen(task)}
                >
                    {completed ? 'Edit' : 'Evaluate'}
                </Button>
            </div>
        </Card>
    );
}

export default function Evaluations() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [activeTask, setActiveTask] = useState<EvaluationPendingTask | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const key = token ? ['student-evaluations', token] as const : null;
    const { data, error, isLoading, mutate } = useSWR(key, ([, t]) => api.org.getEvaluationPending(t as string));

    const submit = async ({ rating, feedback }: { rating: number; feedback?: string }) => {
        if (!token || !activeTask) return;
        setSubmitting(true);
        try {
            if (activeTask.evaluation) {
                await api.org.updateEvaluation(activeTask.evaluation.id, { rating, feedback }, token);
            } else {
                await api.org.createEvaluation({
                    type: activeTask.type,
                    sectionId: activeTask.section.id,
                    teacherId: activeTask.teacher?.id,
                    rating,
                    feedback,
                }, token);
            }
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Evaluation saved', type: 'success' } });
            setActiveTask(null);
            await mutate();
        } catch (submitError) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getErrorMessage(submitError), type: 'error' } });
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-lg" />)}
            </div>
        );
    }
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;

    const pending = data?.pending || [];
    const completed = data?.completed || [];
    const locked = data?.locked || [];

    return (
        <div className="space-y-6">
            {pending.length === 0 && completed.length === 0 ? (
                <EmptyState
                    icon={ClipboardList}
                    title="No evaluations are ready"
                    description="Evaluations unlock after a finalized grade is recorded and an active evaluation window is open."
                    className="min-h-80"
                />
            ) : (
                <>
                    {pending.length > 0 && (
                        <section>
                            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Pending</h2>
                            <div className="grid gap-3 md:grid-cols-2">
                                {pending.map((task) => <TaskCard key={task.key} task={task} onOpen={setActiveTask} />)}
                            </div>
                        </section>
                    )}
                    {completed.length > 0 && (
                        <section>
                            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Completed</h2>
                            <div className="grid gap-3 md:grid-cols-2">
                                {completed.map((task) => <TaskCard key={task.key} task={task} onOpen={setActiveTask} />)}
                            </div>
                        </section>
                    )}
                </>
            )}
            {locked.length > 0 && (
                <section>
                    <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Locked</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                        {locked.slice(0, 6).map((task) => (
                            <Card key={task.key} padding="sm" variant="muted" hoverable={false}>
                                <div className="flex items-center gap-3">
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-foreground">{taskTitle(task)}</p>
                                        <p className="truncate text-xs font-medium text-muted-foreground">
                                            {task.reason === 'FINALIZED_GRADE_REQUIRED' ? 'Waiting for finalized grade' : 'Waiting for evaluation window'}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            )}
            <EvaluationFormModal
                task={activeTask}
                isOpen={Boolean(activeTask)}
                isSubmitting={submitting}
                onClose={() => setActiveTask(null)}
                onSubmit={submit}
            />
        </div>
    );
}
