'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate as mutateGlobal } from 'swr';
import { CalendarDays, CheckCircle2, ListChecks, Network, Plus, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
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
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect, type MultiSelectOption } from '@/components/ui/CustomMultiSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ModalForm } from '@/components/ui/ModalForm';
import { SearchBar } from '@/components/ui/SearchBar';

const MIN_SEARCH_LENGTH = 2;
const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All statuses' },
    { value: PreferenceWindowStatus.ACTIVE, label: 'Active' },
    { value: PreferenceWindowStatus.DRAFT, label: 'Draft' },
    { value: PreferenceWindowStatus.CLOSED, label: 'Closed' },
    { value: PreferenceWindowStatus.ARCHIVED, label: 'Archived' },
];

type SelectOption = MultiSelectOption & { courseId?: string };
type FormErrors = Partial<Record<
    'title' |
    'academicCycleId' |
    'startAt' |
    'endAt' |
    'options' |
    'audience',
    string
>>;

function asIso(value: string) {
    return value ? new Date(value).toISOString() : '';
}

function optionLabel(option: { course?: Course | null; section?: Section | null }) {
    if (option.section) return `${option.section.course?.name || 'Course'} - ${option.section.name}`;
    if (option.course) return option.course.code ? `${option.course.code} - ${option.course.name}` : option.course.name;
    return 'Option';
}

function courseLabel(course: Course) {
    return course.code ? `${course.code} - ${course.name}` : course.name;
}

function sectionLabel(section: Section) {
    return `${section.course?.code ? `${section.course.code} - ` : ''}${section.course?.name || 'Course'} / ${section.name}`;
}

function cohortLabel(cohort: Cohort) {
    return cohort.code ? `${cohort.code} - ${cohort.name}` : cohort.name;
}

function cycleLabel(cycle: AcademicCycle) {
    return cycle.code ? `${cycle.code} - ${cycle.name}` : cycle.name;
}

function mergeSelectedOptions(options: SelectOption[], selected: SelectOption[]) {
    const byId = new Map<string, SelectOption>();
    selected.forEach((option) => byId.set(option.value, option));
    options.forEach((option) => byId.set(option.value, option));
    return Array.from(byId.values());
}

function syncSelectedOptions(nextValues: string[], availableOptions: SelectOption[], previousOptions: SelectOption[]) {
    const byId = new Map<string, SelectOption>();
    previousOptions.forEach((option) => byId.set(option.value, option));
    availableOptions.forEach((option) => byId.set(option.value, option));
    return nextValues.map((value) => byId.get(value) || { value, label: 'Selected item' });
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-xs font-bold text-danger">{message}</p>;
}

function searchTooShortMessage(search: string, label: string) {
    return search.trim().length < MIN_SEARCH_LENGTH ? `Type at least ${MIN_SEARCH_LENGTH} characters to search ${label}.` : `No ${label} found.`;
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
    const { searchParams, getStringParam, updateQueryParams } = useUrlQueryState();
    const [selectedId, setSelectedId] = useState('');
    const [kind, setKind] = useState<PreferenceWindowKind>(PreferenceWindowKind.SECTION_CHOICE);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [selectedCycleOption, setSelectedCycleOption] = useState<SelectOption | null>(null);
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [optionCourseIds, setOptionCourseIds] = useState<string[]>([]);
    const [optionSectionIds, setOptionSectionIds] = useState<string[]>([]);
    const [audienceCourseIds, setAudienceCourseIds] = useState<string[]>([]);
    const [audienceCohortIds, setAudienceCohortIds] = useState<string[]>([]);
    const [audienceSectionIds, setAudienceSectionIds] = useState<string[]>([]);
    const [selectedOptionCourses, setSelectedOptionCourses] = useState<SelectOption[]>([]);
    const [selectedOptionSections, setSelectedOptionSections] = useState<SelectOption[]>([]);
    const [selectedAudienceCourses, setSelectedAudienceCourses] = useState<SelectOption[]>([]);
    const [selectedAudienceCohorts, setSelectedAudienceCohorts] = useState<SelectOption[]>([]);
    const [selectedAudienceSections, setSelectedAudienceSections] = useState<SelectOption[]>([]);
    const [cycleSearch, setCycleSearch] = useState('');
    const [optionCourseSearch, setOptionCourseSearch] = useState('');
    const [optionSectionSearch, setOptionSectionSearch] = useState('');
    const [audienceCourseSearch, setAudienceCourseSearch] = useState('');
    const [audienceCohortSearch, setAudienceCohortSearch] = useState('');
    const [audienceSectionSearch, setAudienceSectionSearch] = useState('');
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState<Error | string | null>(null);
    const [creating, setCreating] = useState(false);

    const statusFilter = getStringParam('status', PreferenceWindowStatus.ACTIVE);
    const kindFilter = getStringParam('kind', 'ALL');
    const searchTerm = getStringParam('search');
    const isCreateOpen = searchParams.get('create') === 'poll';

    const windowsKey = token ? ['preference-windows', token, statusFilter, kindFilter] as const : null;
    const { data: windows, error, isLoading, mutate } = useSWR<PaginatedResponse<PreferenceWindow>>(
        windowsKey,
        ([, t, status, filterKind]) => api.org.getPreferenceWindows(t as string, {
            limit: 100,
            status: status === 'ALL' ? undefined : status as string,
            kind: filterKind === 'ALL' ? undefined : filterKind as string,
        }),
    );

    const normalizedCycleSearch = cycleSearch.trim();
    const normalizedOptionCourseSearch = optionCourseSearch.trim();
    const normalizedOptionSectionSearch = optionSectionSearch.trim();
    const normalizedAudienceCourseSearch = audienceCourseSearch.trim();
    const normalizedAudienceCohortSearch = audienceCohortSearch.trim();
    const normalizedAudienceSectionSearch = audienceSectionSearch.trim();

    const { data: cycles, isLoading: cyclesLoading } = useSWR<PaginatedResponse<AcademicCycle>>(
        token && isCreateOpen && normalizedCycleSearch.length >= MIN_SEARCH_LENGTH
            ? ['preference-cycle-search', token, normalizedCycleSearch] as const
            : null,
        ([, t, search]) => api.academicCycles.getCycles(t as string, { limit: 25, search: search as string }),
    );
    const { data: optionCourses, isLoading: optionCoursesLoading } = useSWR<PaginatedResponse<Course>>(
        token && isCreateOpen && kind === PreferenceWindowKind.COURSE_CHOICE && normalizedOptionCourseSearch.length >= MIN_SEARCH_LENGTH
            ? ['preference-option-course-search', token, normalizedOptionCourseSearch] as const
            : null,
        ([, t, search]) => api.org.getCourses(t as string, { limit: 25, search: search as string }),
    );
    const { data: optionSections, isLoading: optionSectionsLoading } = useSWR<PaginatedResponse<Section>>(
        token && isCreateOpen && kind === PreferenceWindowKind.SECTION_CHOICE && academicCycleId && normalizedOptionSectionSearch.length >= MIN_SEARCH_LENGTH
            ? ['preference-option-section-search', token, academicCycleId, normalizedOptionSectionSearch] as const
            : null,
        ([, t, cycleId, search]) => api.org.getSections(t as string, { limit: 25, academicCycleId: cycleId as string, search: search as string }),
    );
    const { data: audienceCourses, isLoading: audienceCoursesLoading } = useSWR<PaginatedResponse<Course>>(
        token && isCreateOpen && normalizedAudienceCourseSearch.length >= MIN_SEARCH_LENGTH
            ? ['preference-audience-course-search', token, normalizedAudienceCourseSearch] as const
            : null,
        ([, t, search]) => api.org.getCourses(t as string, { limit: 25, search: search as string }),
    );
    const { data: audienceCohorts, isLoading: audienceCohortsLoading } = useSWR<PaginatedResponse<Cohort>>(
        token && isCreateOpen && academicCycleId && normalizedAudienceCohortSearch.length >= MIN_SEARCH_LENGTH
            ? ['preference-audience-cohort-search', token, academicCycleId, normalizedAudienceCohortSearch] as const
            : null,
        ([, t, cycleId, search]) => api.cohorts.getCohorts(t as string, { limit: 25, academicCycleId: cycleId as string, search: search as string }),
    );
    const { data: audienceSections, isLoading: audienceSectionsLoading } = useSWR<PaginatedResponse<Section>>(
        token && isCreateOpen && academicCycleId && normalizedAudienceSectionSearch.length >= MIN_SEARCH_LENGTH
            ? ['preference-audience-section-search', token, academicCycleId, normalizedAudienceSectionSearch] as const
            : null,
        ([, t, cycleId, search]) => api.org.getSections(t as string, { limit: 25, academicCycleId: cycleId as string, search: search as string }),
    );

    const cycleOptions = useMemo<SelectOption[]>(() => mergeSelectedOptions(
        (cycles?.data || []).map((cycle) => ({ value: cycle.id, label: cycleLabel(cycle), icon: CalendarDays })),
        selectedCycleOption ? [selectedCycleOption] : [],
    ), [cycles?.data, selectedCycleOption]);
    const optionCourseOptions = useMemo<SelectOption[]>(() => mergeSelectedOptions(
        (optionCourses?.data || []).map((course) => ({ value: course.id, label: courseLabel(course), description: course.department?.name })),
        selectedOptionCourses,
    ), [optionCourses?.data, selectedOptionCourses]);
    const optionSectionOptions = useMemo<SelectOption[]>(() => mergeSelectedOptions(
        (optionSections?.data || []).map((section) => ({ value: section.id, label: sectionLabel(section), courseId: section.courseId, description: section.academicCycle?.name, meta: section.cohort?.name })),
        selectedOptionSections,
    ), [optionSections?.data, selectedOptionSections]);
    const audienceCourseOptions = useMemo<SelectOption[]>(() => mergeSelectedOptions(
        (audienceCourses?.data || []).map((course) => ({ value: course.id, label: courseLabel(course), description: course.department?.name })),
        selectedAudienceCourses,
    ), [audienceCourses?.data, selectedAudienceCourses]);
    const audienceCohortOptions = useMemo<SelectOption[]>(() => mergeSelectedOptions(
        (audienceCohorts?.data || []).map((cohort) => ({ value: cohort.id, label: cohortLabel(cohort), icon: Network, description: cohort.academicCycle?.name })),
        selectedAudienceCohorts,
    ), [audienceCohorts?.data, selectedAudienceCohorts]);
    const selectedAudienceCourseSet = useMemo(() => new Set(audienceCourseIds), [audienceCourseIds]);
    const audienceSectionOptions = useMemo<SelectOption[]>(() => mergeSelectedOptions(
        (audienceSections?.data || [])
            .filter((section) => !selectedAudienceCourseSet.has(section.courseId || ''))
            .map((section) => ({ value: section.id, label: sectionLabel(section), courseId: section.courseId, description: section.academicCycle?.name, meta: section.cohort?.name })),
        selectedAudienceSections,
    ), [audienceSections?.data, selectedAudienceCourseSet, selectedAudienceSections]);

    const filteredWindows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return windows?.data || [];
        return (windows?.data || []).filter((window) => [
            window.title,
            window.description,
            window.kind,
            window.status,
            ...(window.options || []).map(optionLabel),
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
    }, [searchTerm, windows?.data]);

    const activeFilters: ActiveFilter[] = [
        ...(statusFilter ? [{
            key: 'status',
            label: 'Status',
            value: STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || statusFilter,
            onRemove: () => updateQueryParams({ status: 'ALL' }),
        }] : []),
        ...(kindFilter !== 'ALL' ? [{
            key: 'kind',
            label: 'Type',
            value: kindFilter === PreferenceWindowKind.SECTION_CHOICE ? 'Section choice' : 'Course choice',
            onRemove: () => updateQueryParams({ kind: 'ALL' }),
        }] : []),
        ...(searchTerm ? [{
            key: 'search',
            label: 'Search',
            value: searchTerm,
            onRemove: () => updateQueryParams({ search: undefined }),
        }] : []),
    ];

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setAcademicCycleId('');
        setSelectedCycleOption(null);
        setStartAt('');
        setEndAt('');
        setOptionCourseIds([]);
        setOptionSectionIds([]);
        setAudienceCourseIds([]);
        setAudienceCohortIds([]);
        setAudienceSectionIds([]);
        setSelectedOptionCourses([]);
        setSelectedOptionSections([]);
        setSelectedAudienceCourses([]);
        setSelectedAudienceCohorts([]);
        setSelectedAudienceSections([]);
        setCycleSearch('');
        setOptionCourseSearch('');
        setOptionSectionSearch('');
        setAudienceCourseSearch('');
        setAudienceCohortSearch('');
        setAudienceSectionSearch('');
        setKind(PreferenceWindowKind.SECTION_CHOICE);
        setFormErrors({});
        setSubmitError(null);
    };

    const closeCreateModal = () => {
        updateQueryParams({ create: undefined });
        resetForm();
    };

    const validateForm = () => {
        const nextErrors: FormErrors = {};
        const optionCount = kind === PreferenceWindowKind.COURSE_CHOICE ? optionCourseIds.length : optionSectionIds.length;
        const audienceCount = audienceCourseIds.length + audienceCohortIds.length + audienceSectionIds.length;
        const start = startAt ? new Date(startAt) : null;
        const end = endAt ? new Date(endAt) : null;

        if (!title.trim()) nextErrors.title = 'Title is required.';
        if (!academicCycleId) nextErrors.academicCycleId = 'Academic cycle is required.';
        if (!startAt || Number.isNaN(start?.getTime())) nextErrors.startAt = 'Start time is required.';
        if (!endAt || Number.isNaN(end?.getTime())) nextErrors.endAt = 'Deadline is required.';
        if (start && end && start >= end) nextErrors.endAt = 'Deadline must be after the start time.';
        if (optionCount < 2) nextErrors.options = 'Choose at least two poll options.';
        if (audienceCount < 1) nextErrors.audience = 'Choose at least one audience target.';

        setFormErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const createWindow = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitError(null);
        if (!token || !validateForm()) return;

        setCreating(true);
        try {
            await api.org.createPreferenceWindow({
                kind,
                title: title.trim(),
                description: description.trim(),
                academicCycleId,
                startAt: asIso(startAt),
                endAt: asIso(endAt),
                optionCourseIds: kind === PreferenceWindowKind.COURSE_CHOICE ? optionCourseIds : undefined,
                optionSectionIds: kind === PreferenceWindowKind.SECTION_CHOICE ? optionSectionIds : undefined,
                audienceCourseIds,
                audienceCohortIds,
                audienceSectionIds: audienceSectionIds.filter((sectionId) => {
                    const sectionOption = selectedAudienceSections.find((option) => option.value === sectionId);
                    return !sectionOption?.courseId || !selectedAudienceCourseSet.has(sectionOption.courseId);
                }),
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Poll window draft created', type: 'success' } });
            resetForm();
            updateQueryParams({ create: undefined, status: PreferenceWindowStatus.DRAFT });
            await mutate();
        } catch (error) {
            setSubmitError(error instanceof Error ? error : 'Unable to create poll window');
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to create poll window', type: 'error' } });
        } finally {
            setCreating(false);
        }
    };

    const activate = async (id: string, urgent = false) => {
        if (!token) return;
        try {
            await api.org.activatePreferenceWindow(id, token, urgent ? AnnouncementPriority.URGENT : AnnouncementPriority.HIGH);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Poll window activated', type: 'success' } });
            updateQueryParams({ status: PreferenceWindowStatus.ACTIVE });
            await mutate();
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Unable to activate window', type: 'error' } });
        }
    };

    const close = async (id: string) => {
        if (!token) return;
        try {
            await api.org.closePreferenceWindow(id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Poll window closed', type: 'success' } });
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
                actions={(
                    <PageControls
                        activeFilters={activeFilters}
                        leading={<SearchBar value={searchTerm} onChange={(value) => updateQueryParams({ search: value })} placeholder="Search polls..." mobileMode="expandable" />}
                        actions={<Button icon={Plus} onClick={() => updateQueryParams({ create: 'poll' })} requireWrite>New Poll</Button>}
                        renderFilters={() => (
                            <FilterDrawerGrid>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                                    <CustomSelect
                                        value={statusFilter}
                                        onChange={(value) => updateQueryParams({ status: value })}
                                        options={STATUS_OPTIONS}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Poll Type</Label>
                                    <CustomSelect
                                        value={kindFilter}
                                        onChange={(value) => updateQueryParams({ kind: value })}
                                        options={[
                                            { value: 'ALL', label: 'All types' },
                                            { value: PreferenceWindowKind.SECTION_CHOICE, label: 'Section choice' },
                                            { value: PreferenceWindowKind.COURSE_CHOICE, label: 'Course choice' },
                                        ]}
                                    />
                                </div>
                            </FilterDrawerGrid>
                        )}
                    />
                )}
            />
            <ResourcePanel>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)}
                        </div>
                    ) : error ? (
                        <ErrorState error={error} onRetry={() => mutate()} />
                    ) : filteredWindows.length === 0 ? (
                        <EmptyState
                            icon={ListChecks}
                            title={statusFilter === PreferenceWindowStatus.ACTIVE ? 'No active polls' : 'No poll windows found'}
                            description={activeFilters.length > 0 ? 'Adjust filters to broaden the poll list.' : 'Create a poll window when students need to rank course or section options.'}
                            className="min-h-96"
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredWindows.map((window) => (
                                <Card key={window.id} padding="md" hoverable={false} className="h-auto">
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
                            ))}
                        </div>
                    )}
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={isCreateOpen}
                onClose={closeCreateModal}
                title="Create Poll Window"
                onSubmit={createWindow}
                submitText="Create Draft"
                isSubmitting={creating}
                maxWidth="max-w-4xl"
                bodyClassName="max-h-[min(82vh,760px)] overflow-y-auto custom-scrollbar"
                feedback={submitError ? <ErrorState error={submitError} showRetry={false} className="max-w-none p-3 sm:p-4" /> : undefined}
            >
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Poll Type</Label>
                            <CustomSelect
                                value={kind}
                                onChange={(value) => {
                                    const nextKind = value as PreferenceWindowKind;
                                    setKind(nextKind);
                                    setOptionCourseIds([]);
                                    setOptionSectionIds([]);
                                    setSelectedOptionCourses([]);
                                    setSelectedOptionSections([]);
                                    setFormErrors((current) => ({ ...current, options: undefined }));
                                }}
                                options={[
                                    { value: PreferenceWindowKind.SECTION_CHOICE, label: 'Section choice' },
                                    { value: PreferenceWindowKind.COURSE_CHOICE, label: 'Course choice' },
                                ]}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Academic Cycle</Label>
                            <CustomSelect
                                value={academicCycleId}
                                onChange={(value) => {
                                    setAcademicCycleId(value);
                                    setSelectedCycleOption(value ? cycleOptions.find((option) => option.value === value) || null : null);
                                    setOptionSectionIds([]);
                                    setAudienceCohortIds([]);
                                    setAudienceSectionIds([]);
                                    setSelectedOptionSections([]);
                                    setSelectedAudienceCohorts([]);
                                    setSelectedAudienceSections([]);
                                    setFormErrors((current) => ({ ...current, academicCycleId: undefined, options: undefined, audience: undefined }));
                                }}
                                options={[{ value: '', label: 'Search cycle' }, ...cycleOptions]}
                                searchable
                                searchValue={cycleSearch}
                                onSearchChange={setCycleSearch}
                                searchPlaceholder="Type at least 2 characters..."
                                isSearching={cyclesLoading}
                                emptyMessage={searchTooShortMessage(cycleSearch, 'academic cycles')}
                                error={!!formErrors.academicCycleId}
                                clearable
                                clearLabel="Clear academic cycle"
                            />
                            <FieldError message={formErrors.academicCycleId} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={title} onChange={(event) => { setTitle(event.target.value); setFormErrors((current) => ({ ...current, title: undefined })); }} icon={ListChecks} error={!!formErrors.title} placeholder="Fall 2026 section choice" />
                        <FieldError message={formErrors.title} />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional context for students." />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Starts</Label>
                            <Input type="datetime-local" value={startAt} onChange={(event) => { setStartAt(event.target.value); setFormErrors((current) => ({ ...current, startAt: undefined, endAt: undefined })); }} icon={CalendarDays} error={!!formErrors.startAt} />
                            <FieldError message={formErrors.startAt} />
                        </div>
                        <div className="space-y-2">
                            <Label>Deadline</Label>
                            <Input type="datetime-local" value={endAt} onChange={(event) => { setEndAt(event.target.value); setFormErrors((current) => ({ ...current, endAt: undefined })); }} icon={CalendarDays} error={!!formErrors.endAt} />
                            <FieldError message={formErrors.endAt} />
                        </div>
                    </div>

                    {kind === PreferenceWindowKind.COURSE_CHOICE ? (
                        <div className="space-y-2">
                            <Label>Course Options</Label>
                            <CustomMultiSelect
                                values={optionCourseIds}
                                onChange={(values) => {
                                    setOptionCourseIds(values);
                                    setSelectedOptionCourses(syncSelectedOptions(values, optionCourseOptions, selectedOptionCourses));
                                    setFormErrors((current) => ({ ...current, options: undefined }));
                                }}
                                options={optionCourseOptions}
                                placeholder="Search course options"
                                searchable
                                searchValue={optionCourseSearch}
                                onSearchChange={setOptionCourseSearch}
                                searchPlaceholder="Type at least 2 characters..."
                                isSearching={optionCoursesLoading}
                                emptyMessage={searchTooShortMessage(optionCourseSearch, 'courses')}
                                error={!!formErrors.options}
                            />
                            <FieldError message={formErrors.options} />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>Section Options</Label>
                            <CustomMultiSelect
                                values={optionSectionIds}
                                onChange={(values) => {
                                    setOptionSectionIds(values);
                                    setSelectedOptionSections(syncSelectedOptions(values, optionSectionOptions, selectedOptionSections));
                                    setFormErrors((current) => ({ ...current, options: undefined }));
                                }}
                                disabled={!academicCycleId}
                                options={optionSectionOptions}
                                placeholder={academicCycleId ? 'Search section options' : 'Select cycle first'}
                                searchable
                                searchValue={optionSectionSearch}
                                onSearchChange={setOptionSectionSearch}
                                searchPlaceholder="Type at least 2 characters..."
                                isSearching={optionSectionsLoading}
                                emptyMessage={!academicCycleId ? 'Select an academic cycle before searching sections.' : searchTooShortMessage(optionSectionSearch, 'sections')}
                                error={!!formErrors.options}
                            />
                            <FieldError message={formErrors.options} />
                        </div>
                    )}

                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <h3 className="text-sm font-black text-foreground">Audience</h3>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">Students are resolved from selected courses, cohorts, and sections. When this draft is activated, the selected audience receives a high-priority announcement with the poll link. Course audiences already include sections under that course.</p>
                        <div className="mt-3 grid gap-3">
                            <div className="space-y-2">
                                <Label>Audience Courses</Label>
                                <CustomMultiSelect
                                    values={audienceCourseIds}
                                    onChange={(values) => {
                                        setAudienceCourseIds(values);
                                        const nextCourses = syncSelectedOptions(values, audienceCourseOptions, selectedAudienceCourses);
                                        setSelectedAudienceCourses(nextCourses);
                                        const courseSet = new Set(values);
                                        const keptSections = selectedAudienceSections.filter((option) => !option.courseId || !courseSet.has(option.courseId));
                                        setSelectedAudienceSections(keptSections);
                                        setAudienceSectionIds((current) => current.filter((sectionId) => keptSections.some((option) => option.value === sectionId)));
                                        setFormErrors((current) => ({ ...current, audience: undefined }));
                                    }}
                                    options={audienceCourseOptions}
                                    placeholder="Search course audiences"
                                    searchable
                                    searchValue={audienceCourseSearch}
                                    onSearchChange={setAudienceCourseSearch}
                                    searchPlaceholder="Type at least 2 characters..."
                                    isSearching={audienceCoursesLoading}
                                    emptyMessage={searchTooShortMessage(audienceCourseSearch, 'courses')}
                                    error={!!formErrors.audience}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Audience Cohorts</Label>
                                <CustomMultiSelect
                                    values={audienceCohortIds}
                                    onChange={(values) => {
                                        setAudienceCohortIds(values);
                                        setSelectedAudienceCohorts(syncSelectedOptions(values, audienceCohortOptions, selectedAudienceCohorts));
                                        setFormErrors((current) => ({ ...current, audience: undefined }));
                                    }}
                                    disabled={!academicCycleId}
                                    options={audienceCohortOptions}
                                    placeholder={academicCycleId ? 'Search cohort audiences' : 'Select cycle first'}
                                    searchable
                                    searchValue={audienceCohortSearch}
                                    onSearchChange={setAudienceCohortSearch}
                                    searchPlaceholder="Type at least 2 characters..."
                                    isSearching={audienceCohortsLoading}
                                    emptyMessage={!academicCycleId ? 'Select an academic cycle before searching cohorts.' : searchTooShortMessage(audienceCohortSearch, 'cohorts')}
                                    error={!!formErrors.audience}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Audience Sections</Label>
                                <CustomMultiSelect
                                    values={audienceSectionIds}
                                    onChange={(values) => {
                                        const filteredValues = values.filter((sectionId) => {
                                            const option = audienceSectionOptions.find((item) => item.value === sectionId);
                                            return !option?.courseId || !selectedAudienceCourseSet.has(option.courseId);
                                        });
                                        setAudienceSectionIds(filteredValues);
                                        setSelectedAudienceSections(syncSelectedOptions(filteredValues, audienceSectionOptions, selectedAudienceSections));
                                        setFormErrors((current) => ({ ...current, audience: undefined }));
                                    }}
                                    disabled={!academicCycleId}
                                    options={audienceSectionOptions}
                                    placeholder={academicCycleId ? 'Search section audiences' : 'Select cycle first'}
                                    searchable
                                    searchValue={audienceSectionSearch}
                                    onSearchChange={setAudienceSectionSearch}
                                    searchPlaceholder="Type at least 2 characters..."
                                    isSearching={audienceSectionsLoading}
                                    emptyMessage={!academicCycleId ? 'Select an academic cycle before searching sections.' : searchTooShortMessage(audienceSectionSearch, 'sections')}
                                    error={!!formErrors.audience}
                                />
                                {audienceCourseIds.length > 0 && <p className="text-xs font-bold text-muted-foreground">Sections under selected audience courses are already included and are hidden when detected.</p>}
                            </div>
                        </div>
                        <FieldError message={formErrors.audience} />
                    </div>
                </div>
            </ModalForm>
        </PageShell>
    );
}
