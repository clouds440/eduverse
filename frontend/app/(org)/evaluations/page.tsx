'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CalendarDays, ClipboardList, Eye, EyeOff, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { searchFilterLookup } from '@/lib/filterLookups';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { EvaluationType } from '@/types';
import type { Course, Section, Teacher } from '@/types';
import type { Evaluation, EvaluationWindow, PaginatedResponse } from '@/types';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { PageHeader, PageShell, PageTabs, ResourcePanel } from '@/components/ui/PageShell';
import type { ActiveFilter } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StarRatingInput } from '@/components/evaluations/StarRatingInput';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { RemoteFilterSelect } from '@/components/ui/RemoteFilterSelect';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Label } from '@/components/ui/Label';

type Tab = 'evaluations' | 'windows';
type EvaluationFilters = Parameters<typeof api.org.getEvaluations>[1];

const TABS = [
    { key: 'evaluations', label: 'Evaluations', icon: ClipboardList },
    { key: 'windows', label: 'Windows', icon: CalendarDays },
] as const;

const typeOptions = [
    { value: '', label: 'All types' },
    { value: EvaluationType.TEACHER, label: 'Teacher' },
    { value: EvaluationType.COURSE, label: 'Course' },
];

const ratingOptions = [
    { value: '', label: 'All ratings' },
    ...[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} stars` })),
];

const feedbackOptions = [
    { value: '', label: 'Any feedback' },
    { value: 'true', label: 'Has feedback' },
    { value: 'false', label: 'No feedback' },
];

const visibilityOptions = [
    { value: '', label: 'Any visibility' },
    { value: 'false', label: 'Visible' },
    { value: 'true', label: 'Hidden' },
];

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

    const cycleOptions = useMemo(() => [
        { value: '', label: 'All cycles' },
        ...(cycles?.data || []).map((cycle) => ({ value: cycle.id, label: cycle.name })),
    ], [cycles?.data]);

    const handleTabChange = (nextTab: Tab) => {
        updateQueryParams({ tab: nextTab === 'evaluations' ? undefined : nextTab });
    };

    const resetEvaluationFilters = () => {
        setType('');
        setAcademicCycleId('');
        setCourseId('');
        setSectionId('');
        setTeacherId('');
        setRating('');
        setHasFeedback('');
        setIsHidden('');
    };

    const activeFilters = useMemo<ActiveFilter[]>(() => [
        ...(type ? [{ key: 'type', label: 'Type', value: typeOptions.find((option) => option.value === type)?.label || type, onRemove: () => setType('') }] : []),
        ...(academicCycleId ? [{ key: 'academicCycleId', label: 'Cycle', value: cycleOptions.find((option) => option.value === academicCycleId)?.label || 'Selected cycle', onRemove: () => setAcademicCycleId('') }] : []),
        ...(courseId ? [{ key: 'courseId', label: 'Course', value: 'Selected course', onRemove: () => setCourseId('') }] : []),
        ...(sectionId ? [{ key: 'sectionId', label: 'Section', value: 'Selected section', onRemove: () => setSectionId('') }] : []),
        ...(teacherId ? [{ key: 'teacherId', label: 'Teacher', value: 'Selected teacher', onRemove: () => setTeacherId('') }] : []),
        ...(rating ? [{ key: 'rating', label: 'Rating', value: ratingOptions.find((option) => option.value === rating)?.label || `${rating} stars`, onRemove: () => setRating('') }] : []),
        ...(hasFeedback ? [{ key: 'hasFeedback', label: 'Feedback', value: feedbackOptions.find((option) => option.value === hasFeedback)?.label || hasFeedback, onRemove: () => setHasFeedback('') }] : []),
        ...(isHidden ? [{ key: 'isHidden', label: 'Visibility', value: visibilityOptions.find((option) => option.value === isHidden)?.label || isHidden, onRemove: () => setIsHidden('') }] : []),
    ], [academicCycleId, courseId, cycleOptions, hasFeedback, isHidden, rating, sectionId, teacherId, type]);

    const evaluationControls = useMemo(() => (
        <PageControls
            drawerLabel="Evaluation filters"
            activeFilters={activeFilters}
            actions={(
                <Button variant="secondary" onClick={resetEvaluationFilters}>Reset</Button>
            )}
            renderFilters={() => (
                <FilterDrawerGrid>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</Label>
                        <CustomSelect value={type} onChange={(value) => setType(value as EvaluationType | '')} options={typeOptions} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Academic Cycle</Label>
                        <CustomSelect value={academicCycleId} onChange={setAcademicCycleId} options={cycleOptions} searchable />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Course</Label>
                        <RemoteFilterSelect<Course>
                            cacheKey="evaluations-course-filter"
                            value={courseId}
                            onChange={setCourseId}
                            placeholder="All courses"
                            allLabel="All courses"
                            selectedLabel="Selected course"
                            loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'courses', search })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Section</Label>
                        <RemoteFilterSelect<Section>
                            cacheKey="evaluations-section-filter"
                            value={sectionId}
                            onChange={setSectionId}
                            placeholder="All sections"
                            allLabel="All sections"
                            selectedLabel="Selected section"
                            loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'sections', search })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Teacher</Label>
                        <RemoteFilterSelect<Teacher>
                            cacheKey="evaluations-teacher-filter"
                            value={teacherId}
                            onChange={setTeacherId}
                            placeholder="All teachers"
                            allLabel="All teachers"
                            selectedLabel="Selected teacher"
                            loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'teachers', search })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rating</Label>
                        <CustomSelect value={rating} onChange={setRating} options={ratingOptions} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Feedback</Label>
                        <CustomSelect value={hasFeedback} onChange={setHasFeedback} options={feedbackOptions} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visibility</Label>
                        <CustomSelect value={isHidden} onChange={setIsHidden} options={visibilityOptions} />
                    </div>
                </FilterDrawerGrid>
            )}
        />
    ), [academicCycleId, activeFilters, courseId, cycleOptions, hasFeedback, isHidden, rating, sectionId, teacherId, token, type]);

    const windowControls = useMemo(() => (
        <PageControls
            showDrawer={false}
            actions={(
                <Link href="/evaluations/windows/create">
                    <Button icon={Plus} requireWrite>Open windows</Button>
                </Link>
            )}
            renderFilters={() => null}
        />
    ), []);

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
                actions={activeTab === 'windows' ? windowControls : evaluationControls}
            />
            <ResourcePanel>
                <div className="shrink-0">
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

