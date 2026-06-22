'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarDays, ClipboardList, Eye, EyeOff, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { EvaluationType } from '@/types';
import type { Evaluation, EvaluationWindow, PaginatedResponse } from '@/types';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { PageHeader, PageShell, PageTabs, ResourcePanel } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StarRatingInput } from '@/components/evaluations/StarRatingInput';

type Tab = 'evaluations' | 'windows';
type EvaluationFilters = Parameters<typeof api.org.getEvaluations>[1];

const TABS = [
    { key: 'evaluations', label: 'Evaluations', icon: ClipboardList },
    { key: 'windows', label: 'Windows', icon: CalendarDays },
] as const;

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to save changes';
}

export default function EvaluationsManagementPage() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const tabParam = getStringParam('tab', 'evaluations') as Tab;
    const activeTab = TABS.some((item) => item.key === tabParam) ? tabParam : 'evaluations';
    const [type, setType] = useState<EvaluationType | ''>('');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [rating, setRating] = useState('');
    const [hasFeedback, setHasFeedback] = useState('');
    const [isHidden, setIsHidden] = useState('');

    const evaluationParams = useMemo(() => ({
        type: type ? type : undefined,
        academicCycleId: academicCycleId || undefined,
        courseId: courseId || undefined,
        sectionId: sectionId || undefined,
        teacherId: teacherId || undefined,
        rating: rating ? Number(rating) : undefined,
        hasFeedback: hasFeedback === '' ? undefined : hasFeedback === 'true',
        isHidden: isHidden === '' ? undefined : isHidden === 'true',
        limit: 50,
    }), [type, academicCycleId, courseId, sectionId, teacherId, rating, hasFeedback, isHidden]);

    const evaluationsKey = token ? ['evaluations-admin', token, evaluationParams] as const : null;
    const { data: evaluations, error: evaluationsError, isLoading: evaluationsLoading, mutate: mutateEvaluations } = useSWR<PaginatedResponse<Evaluation>>(
        evaluationsKey,
        ([, t, params]) => api.org.getEvaluations(t as string, params as EvaluationFilters),
    );
    const windowsKey = token ? ['evaluation-windows', token] as const : null;
    const { data: windows, error: windowsError, isLoading: windowsLoading, mutate: mutateWindows } = useSWR<EvaluationWindow[]>(
        windowsKey,
        ([, t]) => api.org.getEvaluationWindows(t as string),
    );
    const { data: cycles } = useSWR(token ? ['cycles-for-evaluation-windows', token] as const : null, ([, t]) => api.academicCycles.getCycles(t as string, { limit: 100 }));
    const { data: courses } = useSWR(token ? ['courses-for-evaluations', token] as const : null, ([, t]) => api.org.getCourses(t as string, { limit: 100 }));
    const { data: sections } = useSWR(token ? ['sections-for-evaluations', token] as const : null, ([, t]) => api.org.getSections(t as string, { limit: 100 }));
    const { data: teachers } = useSWR(token ? ['teachers-for-evaluations', token] as const : null, ([, t]) => api.org.getTeachers(t as string, { limit: 100 }));

    const handleTabChange = (nextTab: Tab) => {
        updateQueryParams({ tab: nextTab === 'evaluations' ? undefined : nextTab });
    };

    const toggleVisibility = async (evaluation: Evaluation) => {
        if (!token) return;
        try {
            await api.org.setEvaluationVisibility(evaluation.id, {
                isHidden: !evaluation.isHidden,
                hiddenReason: evaluation.isHidden ? undefined : 'Hidden during feedback moderation',
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: evaluation.isHidden ? 'Feedback shown' : 'Feedback hidden', type: 'success' } });
            await mutateEvaluations();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getErrorMessage(error), type: 'error' } });
        }
    };

    return (
        <PageShell className="gap-0.5">
            <PageHeader
                title="Evaluations"
                description="Review teacher and course feedback, moderate written comments, and manage evaluation windows."
                icon={ClipboardList}
                breadcrumbs={[{ label: 'Academics' }, { label: 'Evaluations' }]}
                actions={activeTab === 'windows' ? (
                    <Link href="/evaluations/windows/create">
                        <Button icon={Plus} requireWrite>Open windows</Button>
                    </Link>
                ) : null}
            />
            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 rounded-t-lg bg-card/80">
                    <PageTabs
                        ariaLabel="Evaluations navigation"
                        items={TABS.map(({ key, label, icon }) => ({ value: key, label, icon }))}
                        activeValue={activeTab}
                        onValueChange={handleTabChange}
                        tone="panel"
                        hideOnScroll
                    />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    {activeTab === 'evaluations' ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-4">
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={type} onChange={(event) => setType(event.target.value as EvaluationType | '')}>
                                    <option value="">All types</option>
                                    <option value={EvaluationType.TEACHER}>Teacher</option>
                                    <option value={EvaluationType.COURSE}>Course</option>
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={academicCycleId} onChange={(event) => setAcademicCycleId(event.target.value)}>
                                    <option value="">All cycles</option>
                                    {(cycles?.data || []).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                                    <option value="">All courses</option>
                                    {(courses?.data || []).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                                    <option value="">All sections</option>
                                    {(sections?.data || []).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
                                    <option value="">All teachers</option>
                                    {(teachers?.data || []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.user?.name || teacher.user?.email || 'Teacher'}</option>)}
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={rating} onChange={(event) => setRating(event.target.value)}>
                                    <option value="">All ratings</option>
                                    {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={hasFeedback} onChange={(event) => setHasFeedback(event.target.value)}>
                                    <option value="">Any feedback</option>
                                    <option value="true">Has feedback</option>
                                    <option value="false">No feedback</option>
                                </select>
                                <select className="min-h-10 rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground" value={isHidden} onChange={(event) => setIsHidden(event.target.value)}>
                                    <option value="">Any visibility</option>
                                    <option value="false">Visible</option>
                                    <option value="true">Hidden</option>
                                </select>
                            </div>
                            {evaluationsLoading ? (
                                <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)}</div>
                            ) : evaluationsError ? (
                                <ErrorState error={evaluationsError} onRetry={() => mutateEvaluations()} />
                            ) : (evaluations?.data || []).length === 0 ? (
                                <EmptyState icon={ClipboardList} title="No evaluations found" description="Submitted feedback will appear here." className="min-h-64" />
                            ) : (
                                <div className="space-y-3">
                                    {evaluations?.data.map((evaluation) => (
                                        <Card key={evaluation.id} padding="md" hoverable={false}>
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="mb-2 flex flex-wrap gap-2">
                                                        <Badge variant={evaluation.type === EvaluationType.TEACHER ? 'info' : 'primary'} size="sm">{evaluation.type === EvaluationType.TEACHER ? 'Teacher' : 'Course'}</Badge>
                                                        {evaluation.isHidden && <Badge variant="warning" size="sm">Hidden</Badge>}
                                                    </div>
                                                    <p className="text-sm font-black text-foreground">
                                                        {evaluation.type === EvaluationType.TEACHER
                                                            ? evaluation.teacher?.user?.name || evaluation.teacher?.user?.email || 'Teacher'
                                                            : evaluation.course?.name || 'Course'}
                                                    </p>
                                                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                                                        {[evaluation.course?.name, evaluation.section?.name, evaluation.academicCycle?.name].filter(Boolean).join(' Â· ')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <StarRatingInput value={evaluation.rating} readOnly />
                                                    {evaluation.feedback && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={evaluation.isHidden ? 'outline' : 'warning'}
                                                            icon={evaluation.isHidden ? Eye : EyeOff}
                                                            onClick={() => toggleVisibility(evaluation)}
                                                            requireWrite
                                                        >
                                                            {evaluation.isHidden ? 'Show' : 'Hide'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            {evaluation.feedback && (
                                                <p className={`mt-4 whitespace-pre-wrap text-sm font-medium leading-6 ${evaluation.isHidden ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                                    {evaluation.feedback}
                                                </p>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {windowsLoading ? (
                                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)
                            ) : windowsError ? (
                                <ErrorState error={windowsError} onRetry={() => mutateWindows()} />
                            ) : (windows || []).length === 0 ? (
                                <EmptyState icon={ClipboardList} title="No windows yet" description="Create a window to open evaluations for an academic cycle, course, or section." className="min-h-64" />
                            ) : (
                                windows?.map((window) => (
                                    <Card key={window.id} padding="md" hoverable={false}>
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="mb-2 flex gap-2">
                                                    <Badge variant={window.isActive ? 'success' : 'neutral'} size="sm">{window.isActive ? 'Active' : 'Inactive'}</Badge>
                                                    {window.section && <Badge variant="info" size="sm">Section</Badge>}
                                                    {!window.section && window.course && <Badge variant="primary" size="sm">Course</Badge>}
                                                </div>
                                                <p className="text-sm font-black text-foreground">{window.title}</p>
                                                <p className="mt-1 text-xs font-medium text-muted-foreground">
                                                    {[window.academicCycle?.name, window.course?.name, window.section?.name].filter(Boolean).join(' Â· ') || 'Cycle-wide'}
                                                </p>
                                            </div>
                                            <p className="text-sm font-bold text-muted-foreground">
                                                {new Date(window.startDate).toLocaleDateString()} - {new Date(window.endDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}

