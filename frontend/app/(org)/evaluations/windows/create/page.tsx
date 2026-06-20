'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as mutateGlobal } from 'swr';
import { ArrowLeft, BookOpen, Building2, CalendarDays, CheckCircle2, ClipboardList, Layers, Network, Plus, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Role } from '@/types';
import type { AcademicCycle, Cohort, Course, Department, Section } from '@/types';
import { PageHeader } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatDepartmentLabel } from '@/lib/utils';

type TargetType = 'SECTION' | 'COURSE';

interface PreviewTarget {
    id: string;
    title: string;
    meta: string;
}

function generatedTitle(prefix: string, parts: string[]) {
    const normalizedPrefix = prefix.trim() || 'Evaluation Window';
    const title = [normalizedPrefix, ...parts.map((part) => part.trim()).filter(Boolean)].join(' - ');
    return title.length > 160 ? `${title.slice(0, 157).trimEnd()}...` : title;
}

function getSectionLabel(section: Section) {
    const courseName = section.course?.name || 'Course';
    return `${courseName} - ${section.name}`;
}

export default function CreateEvaluationWindowsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const [targetType, setTargetType] = useState<TargetType>('SECTION');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [cohortIds, setCohortIds] = useState<string[]>([]);
    const [departmentIds, setDepartmentIds] = useState<string[]>([]);
    const [courseIds, setCourseIds] = useState<string[]>([]);
    const [sectionIds, setSectionIds] = useState<string[]>([]);
    const [titlePrefix, setTitlePrefix] = useState('Evaluation Window');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [skipExisting, setSkipExisting] = useState(true);

    useEffect(() => {
        if (!token || !user) return;
        if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.replace('/evaluations');
        }
    }, [router, token, user]);

    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(
        token ? ['cycles-for-evaluation-window-create', token] as const : null,
        ([, t]) => api.academicCycles.getCycles(t as string, { limit: 100 }),
    );
    const { data: departmentsData } = useSWR<{ data: Department[] }>(
        token ? ['departments-for-evaluation-window-create', token] as const : null,
        ([, t]) => api.org.getDepartments(t as string, { limit: 500, isActive: true }),
    );
    const { data: coursesData } = useSWR<{ data: Course[] }>(
        token ? ['courses-for-evaluation-window-create', token] as const : null,
        ([, t]) => api.org.getCourses(t as string, { limit: 1000 }),
    );
    const { data: cohortsData } = useSWR<{ data: Cohort[] }>(
        token && academicCycleId ? ['cohorts-for-evaluation-window-create', token, academicCycleId] as const : null,
        ([, t, cycleId]) => api.cohorts.getCohorts(t as string, { limit: 500, academicCycleId: cycleId as string }),
    );
    const { data: sectionsData, isLoading: sectionsLoading } = useSWR<{ data: Section[] }>(
        token && academicCycleId ? ['sections-for-evaluation-window-create', token, academicCycleId] as const : null,
        ([, t, cycleId]) => api.org.getSections(t as string, { limit: 1000, academicCycleId: cycleId as string }),
    );

    const cycles = useMemo(() => cyclesData?.data ?? [], [cyclesData?.data]);
    const departments = useMemo(() => departmentsData?.data ?? [], [departmentsData?.data]);
    const courses = useMemo(() => coursesData?.data ?? [], [coursesData?.data]);
    const cohorts = useMemo(() => cohortsData?.data ?? [], [cohortsData?.data]);
    const sections = useMemo(() => sectionsData?.data ?? [], [sectionsData?.data]);

    const scopedSections = useMemo(() => sections.filter((section) => {
        if (cohortIds.length && !cohortIds.includes(section.cohortId || '')) return false;
        if (departmentIds.length && !departmentIds.includes(section.course?.departmentId || '')) return false;
        if (courseIds.length && !courseIds.includes(section.courseId || '')) return false;
        return true;
    }), [cohortIds, courseIds, departmentIds, sections]);

    const filteredSections = useMemo(() => {
        if (targetType === 'SECTION' && sectionIds.length) {
            return scopedSections.filter((section) => sectionIds.includes(section.id));
        }
        return scopedSections;
    }, [scopedSections, sectionIds, targetType]);

    const previewTargets = useMemo<PreviewTarget[]>(() => {
        if (!academicCycleId) return [];

        if (targetType === 'COURSE') {
            const courseMap = new Map<string, PreviewTarget>();
            filteredSections.forEach((section) => {
                const courseId = section.courseId || section.course?.id;
                if (!courseId || courseMap.has(courseId)) return;
                const courseName = section.course?.name || 'Course';
                courseMap.set(courseId, {
                    id: courseId,
                    title: generatedTitle(titlePrefix, [courseName]),
                    meta: courseName,
                });
            });
            return Array.from(courseMap.values());
        }

        return filteredSections.map((section) => ({
            id: section.id,
            title: generatedTitle(titlePrefix, [section.course?.name || 'Course', section.name]),
            meta: [
                section.course?.name,
                section.name,
                section.cohort?.name,
            ].filter(Boolean).join(' - '),
        }));
    }, [academicCycleId, filteredSections, targetType, titlePrefix]);

    const selectedCycle = cycles.find((cycle) => cycle.id === academicCycleId);
    const dateInvalid = Boolean(startDate && endDate && new Date(endDate) < new Date(startDate));
    const tooManyTargets = previewTargets.length > 500;
    const canSubmit = Boolean(token && academicCycleId && startDate && endDate && !dateInvalid && previewTargets.length > 0 && !tooManyTargets);

    const sectionCourseIds = useMemo(() => new Set(sections.map((section) => section.courseId).filter(Boolean)), [sections]);
    const availableCourses = academicCycleId && sections.length
        ? courses.filter((course) => sectionCourseIds.has(course.id))
        : courses;

    const handleCycleChange = (value: string) => {
        setAcademicCycleId(value);
        setCohortIds([]);
        setCourseIds([]);
        setSectionIds([]);
    };

    const handleTargetTypeChange = (nextTargetType: TargetType) => {
        setTargetType(nextTargetType);
        if (nextTargetType === 'COURSE') {
            setSectionIds([]);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token || !canSubmit) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'evaluation-windows-bulk-create' });
        try {
            const response = await api.org.createEvaluationWindowsBulk({
                academicCycleId,
                startDate,
                endDate,
                targetType,
                titlePrefix: titlePrefix.trim() || undefined,
                cohortIds: cohortIds.length ? cohortIds : undefined,
                departmentIds: departmentIds.length ? departmentIds : undefined,
                courseIds: courseIds.length ? courseIds : undefined,
                sectionIds: targetType === 'SECTION' && sectionIds.length ? sectionIds : undefined,
                isActive,
                skipExisting,
            }, token);

            await mutateGlobal((key) => Array.isArray(key) && key[0] === 'evaluation-windows');
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: `Created ${response.created} evaluation window${response.created === 1 ? '' : 's'}${response.skipped ? `, skipped ${response.skipped} existing` : ''}.`,
                    type: 'success',
                },
            });
            router.push('/evaluations?tab=windows');
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to open evaluation windows', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'evaluation-windows-bulk-create' });
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col py-8 animate-in fade-in duration-700">
            <PageHeader
                title="Open Evaluation Windows"
                description={<>Create one or many feedback windows from academic groups. <DocsLink href="/docs/evaluations-feedback#management">Read evaluation docs</DocsLink></>}
                icon={ClipboardList}
                className="mb-8"
                actions={(
                    <Link href="/evaluations?tab=windows">
                        <Button type="button" variant="secondary" icon={ArrowLeft}>Back to windows</Button>
                    </Link>
                )}
            />

            <div className="grid gap-8 lg:grid-cols-[minmax(280px,0.36fr)_minmax(0,1fr)]">
                <aside className="space-y-4">
                    <section className="rounded-2xl border border-primary/10 bg-primary/5 p-6 shadow-sm">
                        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-black text-foreground">Bulk window opening</h2>
                        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                            Pick a cycle, choose the target style, then narrow the scope with cohort, department, course, or section filters. Matching filters combine together.
                        </p>
                        <div className="mt-5 space-y-3">
                            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Target style</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">Section creates one window per class section. Course creates one window per course represented in the selected cycle.</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Generated titles</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">Titles use the prefix plus each selected course or section name.</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">Bulk-created windows intentionally skip descriptions to keep every generated record consistent.</p>
                            </div>
                        </div>
                    </section>
                </aside>

                <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-xl" noValidate>
                    <div className="border-b border-border/60 bg-background/50 p-5 sm:p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-base font-black text-foreground">Window setup</h2>
                                <p className="mt-1 text-sm font-medium text-muted-foreground">Review the generated preview before creating the windows.</p>
                            </div>
                            <Badge variant={isActive ? 'success' : 'neutral'} size="md">{isActive ? 'Active on creation' : 'Created inactive'}</Badge>
                        </div>
                    </div>

                    <div className="space-y-8 p-5 sm:p-6 lg:p-8">
                        <section className="space-y-4">
                            <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Scope</Label>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Academic cycle <span className="text-primary">*</span></Label>
                                    <CustomSelect
                                        value={academicCycleId}
                                        onChange={handleCycleChange}
                                        icon={CalendarDays}
                                        options={[
                                            { value: '', label: 'Select cycle' },
                                            ...cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name}${cycle.isActive ? ' (active)' : ''}` })),
                                        ]}
                                        searchable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Window title prefix</Label>
                                    <Input value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} icon={Sparkles} placeholder="Evaluation Window" className="h-11 font-medium" />
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => handleTargetTypeChange('SECTION')}
                                    className={cn(
                                        'flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                                        targetType === 'SECTION' ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background/55 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )}
                                >
                                    <Layers className="h-5 w-5 shrink-0" />
                                    <span>
                                        <span className="block text-sm font-black">One per section</span>
                                        <span className="block text-xs font-semibold">Best for section-specific teacher and course feedback.</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTargetTypeChange('COURSE')}
                                    className={cn(
                                        'flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                                        targetType === 'COURSE' ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background/55 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )}
                                >
                                    <BookOpen className="h-5 w-5 shrink-0" />
                                    <span>
                                        <span className="block text-sm font-black">One per course</span>
                                        <span className="block text-xs font-semibold">Best for broad course feedback across matching sections.</span>
                                    </span>
                                </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Cohorts</Label>
                                    <CustomMultiSelect
                                        values={cohortIds}
                                        onChange={setCohortIds}
                                        icon={Network}
                                        disabled={!academicCycleId}
                                        placeholder={!academicCycleId ? 'Select cycle first' : 'All cohorts in cycle'}
                                        options={cohorts.map((cohort) => ({ value: cohort.id, label: cohort.name }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Departments</Label>
                                    <CustomMultiSelect
                                        values={departmentIds}
                                        onChange={setDepartmentIds}
                                        icon={Building2}
                                        placeholder="All departments"
                                        options={departments.map((department) => ({ value: department.id, label: formatDepartmentLabel(department) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Courses</Label>
                                    <CustomMultiSelect
                                        values={courseIds}
                                        onChange={setCourseIds}
                                        icon={BookOpen}
                                        disabled={!academicCycleId}
                                        placeholder={!academicCycleId ? 'Select cycle first' : 'All courses in scope'}
                                        options={availableCourses.map((course) => ({ value: course.id, label: course.name }))}
                                    />
                                </div>
                                {targetType === 'SECTION' && (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold">Exact sections</Label>
                                        <CustomMultiSelect
                                            values={sectionIds}
                                            onChange={setSectionIds}
                                            icon={Layers}
                                            disabled={!academicCycleId}
                                            placeholder={!academicCycleId ? 'Select cycle first' : 'All matching sections'}
                                            options={scopedSections.map((section) => ({ value: section.id, label: getSectionLabel(section) }))}
                                        />
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Time period</Label>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Starts <span className="text-primary">*</span></Label>
                                    <Input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} icon={CalendarDays} className="h-11 font-medium" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Ends <span className="text-primary">*</span></Label>
                                    <Input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} icon={CalendarDays} className="h-11 font-medium" />
                                    {dateInvalid && <p className="text-xs font-bold text-danger">End date must be after the start date.</p>}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setIsActive((current) => !current)}
                                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-background/55 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                                >
                                    <span>
                                        <span className="block text-sm font-black text-foreground">Create as active</span>
                                        <span className="block text-xs font-semibold text-muted-foreground">Inactive windows stay hidden from eligibility until enabled.</span>
                                    </span>
                                    <Badge variant={isActive ? 'success' : 'neutral'} size="sm">{isActive ? 'On' : 'Off'}</Badge>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSkipExisting((current) => !current)}
                                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-background/55 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                                >
                                    <span>
                                        <span className="block text-sm font-black text-foreground">Skip existing matches</span>
                                        <span className="block text-xs font-semibold text-muted-foreground">Avoid duplicates for the same target and exact time period.</span>
                                    </span>
                                    <Badge variant={skipExisting ? 'success' : 'warning'} size="sm">{skipExisting ? 'On' : 'Off'}</Badge>
                                </button>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Generated preview</Label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedCycle && <Badge variant="info" size="sm">{selectedCycle.name}</Badge>}
                                    <Badge variant={tooManyTargets ? 'warning' : 'neutral'} size="sm">{previewTargets.length} target{previewTargets.length === 1 ? '' : 's'}</Badge>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border/60 bg-background/45">
                                {sectionsLoading ? (
                                    <div className="space-y-2 p-4">
                                        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-xl" />)}
                                    </div>
                                ) : !academicCycleId ? (
                                    <div className="p-6 text-sm font-semibold text-muted-foreground">Select an academic cycle to preview generated windows.</div>
                                ) : previewTargets.length === 0 ? (
                                    <div className="p-6 text-sm font-semibold text-muted-foreground">No matching targets yet. Loosen one of the group filters or choose another cycle.</div>
                                ) : (
                                    <div className="max-h-80 divide-y divide-border/60 overflow-y-auto custom-scrollbar">
                                        {previewTargets.slice(0, 20).map((target) => (
                                            <div key={target.id} className="flex items-start gap-3 p-4">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-foreground">{target.title}</p>
                                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{target.meta}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {previewTargets.length > 20 && (
                                            <div className="p-4 text-xs font-bold text-muted-foreground">
                                                {previewTargets.length - 20} more generated window{previewTargets.length - 20 === 1 ? '' : 's'} will be created.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {tooManyTargets && <p className="text-xs font-bold text-warning">Reduce the scope to 500 windows or fewer before creating.</p>}
                        </section>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/60 bg-background/50 p-5 sm:flex-row sm:items-center sm:justify-end sm:p-6">
                        <Link href="/evaluations?tab=windows" className="w-full sm:w-auto">
                            <Button type="button" variant="secondary" className="w-full sm:px-8">Cancel</Button>
                        </Link>
                        <Button
                            type="submit"
                            icon={Plus}
                            loadingId="evaluation-windows-bulk-create"
                            disabled={!canSubmit}
                            className="w-full sm:px-10"
                            requireWrite
                        >
                            Create {previewTargets.length || ''} Window{previewTargets.length === 1 ? '' : 's'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
