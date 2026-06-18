'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ClipboardList, Eye, EyeOff, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { EvaluationType } from '@/types';
import type { Evaluation, EvaluationWindow, CreateEvaluationWindowRequest, PaginatedResponse } from '@/types';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StarRatingInput } from '@/components/evaluations/StarRatingInput';

type Tab = 'evaluations' | 'windows';
type EvaluationFilters = Parameters<typeof api.org.getEvaluations>[1];

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to save changes';
}

export default function EvaluationsManagementPage() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [tab, setTab] = useState<Tab>('evaluations');
    const [type, setType] = useState<EvaluationType | ''>('');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [courseId, setCourseId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [rating, setRating] = useState('');
    const [hasFeedback, setHasFeedback] = useState('');
    const [isHidden, setIsHidden] = useState('');
    const [windowModalOpen, setWindowModalOpen] = useState(false);
    const [windowDraft, setWindowDraft] = useState<CreateEvaluationWindowRequest>({
        academicCycleId: '',
        title: '',
        startDate: '',
        endDate: '',
        isActive: true,
    });

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

    const createWindow = async () => {
        if (!token) return;
        try {
            await api.org.createEvaluationWindow(windowDraft, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Evaluation window created', type: 'success' } });
            setWindowModalOpen(false);
            setWindowDraft({ academicCycleId: '', title: '', startDate: '', endDate: '', isActive: true });
            await mutateWindows();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getErrorMessage(error), type: 'error' } });
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="Evaluations"
                description="Review teacher and course feedback, moderate written comments, and manage evaluation windows."
                icon={ClipboardList}
                breadcrumbs={[{ label: 'Academics' }, { label: 'Evaluations' }]}
                actions={tab === 'windows' ? <Button icon={Plus} onClick={() => setWindowModalOpen(true)} requireWrite>New window</Button> : null}
            />
            <ResourcePanel>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    <div className="mb-4 flex flex-wrap gap-2">
                        {(['evaluations', 'windows'] as Tab[]).map((item) => (
                            <button
                                key={item}
                                type="button"
                                className={`rounded-md border px-3 py-2 text-sm font-bold capitalize transition-colors ${tab === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'}`}
                                onClick={() => setTab(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    {tab === 'evaluations' ? (
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
                                                        {[evaluation.course?.name, evaluation.section?.name, evaluation.academicCycle?.name].filter(Boolean).join(' · ')}
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
                                                    {[window.academicCycle?.name, window.course?.name, window.section?.name].filter(Boolean).join(' · ') || 'Cycle-wide'}
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
            <Modal
                isOpen={windowModalOpen}
                onClose={() => setWindowModalOpen(false)}
                title="New evaluation window"
                maxWidth="max-w-xl"
                footer={(
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setWindowModalOpen(false)}>Cancel</Button>
                        <Button icon={Plus} onClick={createWindow} disabled={!windowDraft.academicCycleId || !windowDraft.title || !windowDraft.startDate || !windowDraft.endDate} requireWrite>Create</Button>
                    </div>
                )}
            >
                <div className="space-y-4">
                    <select
                        className="min-h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground"
                        value={windowDraft.academicCycleId}
                        onChange={(event) => setWindowDraft((draft) => ({ ...draft, academicCycleId: event.target.value }))}
                    >
                        <option value="">Select academic cycle</option>
                        {(cycles?.data || []).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
                    </select>
                    <Input placeholder="Window title" value={windowDraft.title} onChange={(event) => setWindowDraft((draft) => ({ ...draft, title: event.target.value }))} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <select
                            className="min-h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground"
                            value={windowDraft.courseId || ''}
                            onChange={(event) => setWindowDraft((draft) => ({ ...draft, courseId: event.target.value || null, sectionId: null }))}
                        >
                            <option value="">Cycle-wide or section-only</option>
                            {(courses?.data || []).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                        </select>
                        <select
                            className="min-h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-medium text-foreground"
                            value={windowDraft.sectionId || ''}
                            onChange={(event) => {
                                const selected = (sections?.data || []).find((section) => section.id === event.target.value);
                                setWindowDraft((draft) => ({ ...draft, sectionId: event.target.value || null, courseId: selected?.courseId || draft.courseId || null }));
                            }}
                        >
                            <option value="">No section scope</option>
                            {(sections?.data || [])
                                .filter((section) => !windowDraft.courseId || section.courseId === windowDraft.courseId)
                                .map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                        </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input type="datetime-local" value={windowDraft.startDate} onChange={(event) => setWindowDraft((draft) => ({ ...draft, startDate: event.target.value }))} />
                        <Input type="datetime-local" value={windowDraft.endDate} onChange={(event) => setWindowDraft((draft) => ({ ...draft, endDate: event.target.value }))} />
                    </div>
                    <Textarea placeholder="Description" value={windowDraft.description || ''} onChange={(event) => setWindowDraft((draft) => ({ ...draft, description: event.target.value }))} />
                </div>
            </Modal>
        </PageShell>
    );
}
