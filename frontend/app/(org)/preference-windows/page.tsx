'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate as mutateGlobal } from 'swr';
import { CalendarDays, CheckCircle2, ListChecks, Network, Plus, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import {
    AnnouncementPriority,
    AcademicCycle,
    Cohort,
    Course,
    PaginatedResponse,
    PreferenceResults,
    PreferenceWindow,
    PreferenceWindowKind,
    PreferenceWindowStatus,
    Role,
    Section,
} from '@/types';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

function asIso(value: string) {
    return value ? new Date(value).toISOString() : '';
}

function optionLabel(option: { course?: Course | null; section?: Section | null }) {
    if (option.section) return `${option.section.course?.name || 'Course'} - ${option.section.name}`;
    if (option.course) return option.course.code ? `${option.course.code} - ${option.course.name}` : option.course.name;
    return 'Option';
}

function WindowResults({ id, window, onEnrollmentUpdated }: { id: string; window: PreferenceWindow; onEnrollmentUpdated: () => void }) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [enrolling, setEnrolling] = useState('');
    const { data, error, isLoading, mutate } = useSWR<PreferenceResults>(
        token ? ['preference-window-results', id, token] as const : null,
        ([, windowId, t]) => api.org.getPreferenceWindowResults(windowId as string, t as string),
    );

    const sectionOptions = useMemo(() => (window.options || [])
        .filter((option) => option.section)
        .map((option) => ({
            value: option.section!.id,
            label: optionLabel(option),
        })), [window.options]);

    const canEnroll = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const enrollStudent = async (studentId: string, sectionId: string, currentSectionIds: string[]) => {
        if (!token || !sectionId) return;
        if (currentSectionIds.includes(sectionId)) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Student already enrolled in this section', type: 'error' } });
            return;
        }
        setEnrolling(`${studentId}:${sectionId}`);
        try {
            const result = await api.org.enrollStudentInSection(studentId, sectionId, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Student enrolled', type: 'success' } });
            result.warnings?.forEach((warning) => {
                dispatch({ type: 'TOAST_ADD', payload: { message: warning.message, type: 'info' } });
            });
            await mutate();
            onEnrollmentUpdated();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to enroll student', type: 'error' } });
        } finally {
            setEnrolling('');
        }
    };

    if (isLoading) return <Skeleton className="h-48 rounded-lg" />;
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    if (!data) return null;

    return (
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-background/50 p-4">
            <div className="grid gap-3 md:grid-cols-3">
                <Card padding="sm" hoverable={false}><p className="text-xs font-bold text-muted-foreground">Audience</p><p className="text-2xl font-black">{data.audienceCount}</p></Card>
                <Card padding="sm" hoverable={false}><p className="text-xs font-bold text-muted-foreground">Submitted</p><p className="text-2xl font-black">{data.submittedCount}</p></Card>
                <Card padding="sm" hoverable={false}><p className="text-xs font-bold text-muted-foreground">Pending</p><p className="text-2xl font-black">{data.pendingCount}</p></Card>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {(window.options || []).map((option) => {
                    const stat = data.optionStats.find((item) => item.optionId === option.id);
                    return (
                        <Card key={option.id} padding="sm" hoverable={false}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black">{optionLabel(option)}</p>
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                        {stat?.firstChoices || 0} first choice votes
                                        {stat?.averageRank ? ` - Avg rank ${stat.averageRank.toFixed(1)}` : ''}
                                    </p>
                                </div>
                                <Badge variant="primary" size="sm">{stat?.responses || 0} ranks</Badge>
                            </div>
                            {(stat?.capacityWarnings || []).map((warning) => (
                                <p key={warning} className="mt-2 text-xs font-bold text-warning">{warning}</p>
                            ))}
                        </Card>
                    );
                })}
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Student Preferences</h3>
                <div className="divide-y divide-border rounded-lg border border-border">
                    {data.students.map((row) => (
                        <div key={row.student.id} className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(220px,0.7fr)] lg:items-center">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-black">{row.student.user?.name || row.student.user?.email}</p>
                                <p className="truncate text-xs font-semibold text-muted-foreground">{row.student.registrationNumber || row.student.rollNumber || 'Student'}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {row.ranks.length ? row.ranks.map((rank) => (
                                    <Badge key={rank.id} variant={rank.rank === 1 ? 'success' : 'neutral'} size="sm">
                                        {rank.rank}. {optionLabel(rank.option || {})}
                                    </Badge>
                                )) : <Badge variant="warning" size="sm">Not submitted</Badge>}
                            </div>
                            {canEnroll && window.kind === PreferenceWindowKind.SECTION_CHOICE && sectionOptions.length > 0 && (
                                <div className="flex gap-2">
                                    <CustomSelect
                                        value=""
                                        onChange={(sectionId) => enrollStudent(row.student.id, sectionId, row.currentSectionIds)}
                                        options={[{ value: '', label: 'Enroll to section' }, ...sectionOptions]}
                                        disabled={Boolean(enrolling)}
                                        searchable
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function PreferenceWindowsPage() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [selectedId, setSelectedId] = useState('');
    const [kind, setKind] = useState<PreferenceWindowKind>(PreferenceWindowKind.SECTION_CHOICE);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [optionCourseIds, setOptionCourseIds] = useState<string[]>([]);
    const [optionSectionIds, setOptionSectionIds] = useState<string[]>([]);
    const [audienceCourseIds, setAudienceCourseIds] = useState<string[]>([]);
    const [audienceCohortIds, setAudienceCohortIds] = useState<string[]>([]);
    const [audienceSectionIds, setAudienceSectionIds] = useState<string[]>([]);

    const windowsKey = token ? ['preference-windows', token] as const : null;
    const { data: windows, error, isLoading, mutate } = useSWR<PaginatedResponse<PreferenceWindow>>(
        windowsKey,
        ([, t]) => api.org.getPreferenceWindows(t as string, { limit: 50 }),
    );
    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(token ? ['preference-cycles', token] as const : null, ([, t]) => api.academicCycles.getCycles(t as string, { limit: 100 }));
    const { data: courses } = useSWR<PaginatedResponse<Course>>(token ? ['preference-courses', token] as const : null, ([, t]) => api.org.getCourses(t as string, { limit: 1000 }));
    const { data: cohorts } = useSWR<PaginatedResponse<Cohort>>(token ? ['preference-cohorts', token] as const : null, ([, t]) => api.cohorts.getCohorts(t as string, { limit: 500, includeAllCycles: true }));
    const { data: sections } = useSWR<PaginatedResponse<Section>>(token && academicCycleId ? ['preference-sections', token, academicCycleId] as const : null, ([, t, cycleId]) => api.org.getSections(t as string, { limit: 1000, academicCycleId: cycleId as string }));

    const allCourses = courses?.data || [];
    const allSections = sections?.data || [];
    const blockedAudienceSectionIds = new Set(allSections.filter((section) => audienceCourseIds.includes(section.courseId || '')).map((section) => section.id));
    const selectedWindow = windows?.data.find((item) => item.id === selectedId);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setAcademicCycleId('');
        setStartAt('');
        setEndAt('');
        setOptionCourseIds([]);
        setOptionSectionIds([]);
        setAudienceCourseIds([]);
        setAudienceCohortIds([]);
        setAudienceSectionIds([]);
        setKind(PreferenceWindowKind.SECTION_CHOICE);
    };

    const createWindow = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;
        try {
            await api.org.createPreferenceWindow({
                kind,
                title,
                description,
                academicCycleId,
                startAt: asIso(startAt),
                endAt: asIso(endAt),
                optionCourseIds: kind === PreferenceWindowKind.COURSE_CHOICE ? optionCourseIds : undefined,
                optionSectionIds: kind === PreferenceWindowKind.SECTION_CHOICE ? optionSectionIds : undefined,
                audienceCourseIds,
                audienceCohortIds,
                audienceSectionIds: audienceSectionIds.filter((id) => !blockedAudienceSectionIds.has(id)),
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Preference window created', type: 'success' } });
            resetForm();
            await mutate();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to create window', type: 'error' } });
        }
    };

    const activate = async (id: string, urgent = false) => {
        if (!token) return;
        try {
            await api.org.activatePreferenceWindow(id, token, urgent ? AnnouncementPriority.URGENT : AnnouncementPriority.HIGH);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Preference window activated', type: 'success' } });
            await mutate();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to activate window', type: 'error' } });
        }
    };

    const close = async (id: string) => {
        if (!token) return;
        try {
            await api.org.closePreferenceWindow(id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Preference window closed', type: 'success' } });
            await mutate();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to close window', type: 'error' } });
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="Section/Course Polls"
                description="Open ranked preference polls from existing courses, sections, cohorts, and schedules."
                icon={ListChecks}
                breadcrumbs={[{ label: 'Academics' }, { label: 'Section/Course Polls' }]}
            />
            <ResourcePanel>
                <div className="grid min-h-0 flex-1 items-start gap-4 overflow-y-auto p-3 custom-scrollbar xl:grid-cols-[420px_minmax(0,1fr)]">
                    <Card padding="md" hoverable={false} className="h-auto overflow-visible">
                        <form onSubmit={createWindow} className="space-y-4">
                            <h2 className="text-base font-black">Create Draft</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Window Type</Label>
                                    <CustomSelect value={kind} onChange={(value) => setKind(value as PreferenceWindowKind)} options={[
                                        { value: PreferenceWindowKind.SECTION_CHOICE, label: 'Section choice' },
                                        { value: PreferenceWindowKind.COURSE_CHOICE, label: 'Course choice' },
                                    ]} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Academic Cycle</Label>
                                    <CustomSelect value={academicCycleId} onChange={(value) => { setAcademicCycleId(value); setOptionSectionIds([]); setAudienceSectionIds([]); }} options={[
                                        { value: '', label: 'Select cycle' },
                                        ...(cycles?.data || []).map((cycle) => ({ value: cycle.id, label: cycle.code ? `${cycle.code} - ${cycle.name}` : cycle.name })),
                                    ]} searchable />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={title} onChange={(event) => setTitle(event.target.value)} required icon={ListChecks} />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Starts</Label>
                                    <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required icon={CalendarDays} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Deadline</Label>
                                    <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required icon={CalendarDays} />
                                </div>
                            </div>

                            {kind === PreferenceWindowKind.COURSE_CHOICE ? (
                                <div className="space-y-2">
                                    <Label>Course Options</Label>
                                    <CustomMultiSelect values={optionCourseIds} onChange={setOptionCourseIds} options={allCourses.map((course) => ({ value: course.id, label: course.code ? `${course.code} - ${course.name}` : course.name }))} placeholder="Choose course options" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Section Options</Label>
                                    <CustomMultiSelect values={optionSectionIds} onChange={setOptionSectionIds} disabled={!academicCycleId} options={allSections.map((section) => ({ value: section.id, label: `${section.course?.name || 'Course'} - ${section.name}` }))} placeholder={academicCycleId ? 'Choose section options' : 'Select cycle first'} />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Audience Courses</Label>
                                <CustomMultiSelect values={audienceCourseIds} onChange={(values) => {
                                    setAudienceCourseIds(values);
                                    setAudienceSectionIds((current) => current.filter((id) => !allSections.some((section) => section.id === id && values.includes(section.courseId || ''))));
                                }} options={allCourses.map((course) => ({ value: course.id, label: course.code ? `${course.code} - ${course.name}` : course.name }))} placeholder="Optional course audiences" />
                            </div>
                            <div className="space-y-2">
                                <Label>Audience Cohorts</Label>
                                <CustomMultiSelect values={audienceCohortIds} onChange={setAudienceCohortIds} options={(cohorts?.data || []).map((cohort) => ({ value: cohort.id, label: cohort.code ? `${cohort.code} - ${cohort.name}` : cohort.name, icon: Network }))} placeholder="Optional cohort audiences" />
                            </div>
                            <div className="space-y-2">
                                <Label>Audience Sections</Label>
                                <CustomMultiSelect values={audienceSectionIds} onChange={(values) => setAudienceSectionIds(values.filter((id) => !blockedAudienceSectionIds.has(id)))} disabled={!academicCycleId} options={allSections.filter((section) => !blockedAudienceSectionIds.has(section.id)).map((section) => ({ value: section.id, label: `${section.course?.name || 'Course'} - ${section.name}` }))} placeholder={academicCycleId ? 'Optional section audiences' : 'Select cycle first'} />
                                {blockedAudienceSectionIds.size > 0 && <p className="text-xs font-bold text-muted-foreground">Sections under selected audience courses are already included.</p>}
                            </div>
                            <Button type="submit" icon={Plus} className="w-full" requireWrite>Create Draft</Button>
                        </form>
                    </Card>

                    <div className="space-y-3">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)
                        ) : error ? (
                            <ErrorState error={error} onRetry={() => mutate()} />
                        ) : (windows?.data || []).length === 0 ? (
                            <EmptyState icon={ListChecks} title="No preference windows yet" className="min-h-80" />
                        ) : (
                            windows?.data.map((window) => (
                                <Card key={window.id} padding="md" hoverable={false}>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                <Badge variant={window.status === PreferenceWindowStatus.ACTIVE ? 'success' : window.status === PreferenceWindowStatus.CLOSED ? 'neutral' : 'warning'} size="sm">{window.status}</Badge>
                                                <Badge variant="primary" size="sm">{window.kind === PreferenceWindowKind.SECTION_CHOICE ? 'Sections' : 'Courses'}</Badge>
                                            </div>
                                            <h2 className="text-base font-black">{window.title}</h2>
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                {(window.options?.length || window._count?.options || 0)} options - {(window.audiences?.length || window._count?.audiences || 0)} audience targets - Deadline {new Date(window.endAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {window.status === PreferenceWindowStatus.DRAFT && (
                                                <>
                                                    <Button size="sm" icon={CheckCircle2} onClick={() => activate(window.id)} requireWrite>Activate</Button>
                                                    <Button size="sm" variant="warning" onClick={() => activate(window.id, true)} requireWrite>Urgent</Button>
                                                </>
                                            )}
                                            {window.status === PreferenceWindowStatus.ACTIVE && (
                                                <Button size="sm" variant="secondary" icon={XCircle} onClick={() => close(window.id)} requireWrite>Close</Button>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => setSelectedId(selectedId === window.id ? '' : window.id)}>
                                                {selectedId === window.id ? 'Hide Results' : 'Results'}
                                            </Button>
                                        </div>
                                    </div>
                                    {selectedId === window.id && (
                                        <WindowResults
                                            id={window.id}
                                            window={window}
                                            onEnrollmentUpdated={() => {
                                                mutate();
                                                mutateGlobal((key) => Array.isArray(key) && key[0] === 'students');
                                            }}
                                        />
                                    )}
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
