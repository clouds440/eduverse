'use client';

import { useMemo, useState, type Dispatch } from 'react';
import useSWR from 'swr';
import { AcademicCycle, ApiError, Cohort, CopyForwardPreview, Role, Section, Student } from '@/types';
import { api } from '@/lib/api';
import { searchFilterLookup } from '@/lib/filterLookups';
import { useAuth } from '@/context/AuthContext';
import { useGlobal, type GlobalAction } from '@/context/GlobalContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { RemoteFilterSelect } from '@/components/ui/RemoteFilterSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, PageTabs, ResourcePanel } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Toggle } from '@/components/ui/Toggle';
import { ArrowRight, ArrowLeftRight, BookOpen, CheckCircle2, Copy, GitBranch, UserMinus, Users } from 'lucide-react';

const REASSIGNMENT_TABS = [
    { value: 'copy-forward', label: 'Copy Forward', icon: Copy },
    { value: 'reassign', label: 'Cohort Reassignment', icon: Users },
] as const;

type ReassignmentTab = typeof REASSIGNMENT_TABS[number]['value'];

export default function ReassignmentPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [activeTab, setActiveTab] = useState<ReassignmentTab>('copy-forward');

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData, isLoading, error, mutate } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;
    if (isLoading && !cyclesData) return <Loading className="h-full" text="Loading academic transitions..." />;
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;

    if (user?.role !== Role.ORG_ADMIN && user?.role !== Role.SUB_ADMIN) {
        return (
            <div className="flex h-full items-center justify-center">
                <StatusBanner
                    title="Access restricted"
                    description="Only organization admins and sub admins can run academic transitions."
                    variant="warning"
                />
            </div>
        );
    }

    const cycles = cyclesData?.data || [];
    return (
        <PageShell className="gap-0.5">
            <PageHeader
                title="Academic Transitions"
                description={<>Copy setup or reassign students across cohorts and sections after review. <DocsLink href="/docs/cohorts-reassignment#reassignment">Read transition docs</DocsLink></>}
                icon={ArrowRight}
                meta={<Badge variant="neutral" size="sm">{cycles.length} cycles</Badge>}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Reassignment' },
                ]}
            />

            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 rounded-t-lg bg-card/80">
                    <PageTabs
                        ariaLabel="Academic transition navigation"
                        items={REASSIGNMENT_TABS}
                        activeValue={activeTab}
                        onValueChange={setActiveTab}
                        tone="panel"
                        hideOnScroll
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                    {activeTab === 'copy-forward' ? (
                        <CopyForwardView cycles={cycles} token={token} dispatch={dispatch} />
                    ) : (
                        <ReassignmentView cycles={cycles} token={token} dispatch={dispatch} />
                    )}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}

function StepBlock({
    step,
    title,
    description,
    children,
}: {
    step: number;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground">
                    {step}
                </div>
                <div className="min-w-0">
                    <h2 className="text-base font-black text-foreground">{title}</h2>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function getApiErrorMessage(err: unknown, fallback: string) {
    const apiError = err as ApiError;
    const rawMessage = apiError?.response?.data?.message || apiError?.message || fallback;
    return Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function CopyForwardView({ cycles, token, dispatch }: { cycles: AcademicCycle[]; token: string; dispatch: Dispatch<GlobalAction> }) {
    const [fromCycleId, setFromCycleId] = useState('');
    const [toCycleId, setToCycleId] = useState('');
    const [options, setOptions] = useState({ copySchedules: false, copyMaterials: false });
    const [isExecuting, setIsExecuting] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [copyPreview, setCopyPreview] = useState<CopyForwardPreview | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const fromCycle = cycles.find((cycle) => cycle.id === fromCycleId);
    const toCycle = cycles.find((cycle) => cycle.id === toCycleId);
    const copyForwardPayload = useMemo(() => ({
        fromCycleId,
        toCycleId,
        copySchedules: options.copySchedules,
        copyMaterials: options.copyMaterials,
    }), [fromCycleId, options.copyMaterials, options.copySchedules, toCycleId]);
    const previewItems = copyPreview ? [
        formatCount(copyPreview.sections, 'section'),
        ...(options.copySchedules ? [formatCount(copyPreview.schedules, 'schedule')] : []),
        ...(options.copyMaterials ? [formatCount(copyPreview.materials, 'material')] : []),
    ] : [];
    const previewTotal = copyPreview
        ? copyPreview.sections
        + (options.copySchedules ? copyPreview.schedules : 0)
        + (options.copyMaterials ? copyPreview.materials : 0)
        : 0;

    const openCopyForwardConfirm = async () => {
        if (!fromCycleId || !toCycleId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select both source and target cycles.', type: 'error' } });
            return;
        }
        if (fromCycleId === toCycleId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Source and target cycles must be different.', type: 'error' } });
            return;
        }

        setIsPreviewLoading(true);
        try {
            const preview = await api.copyForward.preview(copyForwardPayload, token);
            setCopyPreview(preview);
            setIsConfirmOpen(true);
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err, 'Could not prepare copy preview'), type: 'error' } });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const executeCopyForward = async () => {
        setIsExecuting(true);
        dispatch({ type: 'UI_START_PROCESSING', payload: 'copy-forward' });
        try {
            const res = await api.copyForward.execute(copyForwardPayload, token);
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: `Copy forward successful. Copied ${formatCount(res.sectionsCopied, 'section')}, ${formatCount(res.schedulesCopied, 'schedule')}, and ${formatCount(res.materialsCopied, 'material')}. Assessments were not copied.`,
                    type: 'success',
                },
            });
            setFromCycleId('');
            setToCycleId('');
            setCopyPreview(null);
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err, 'Error processing request'), type: 'error' } });
        } finally {
            setIsExecuting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'copy-forward' });
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative space-y-4">
                <StatusBanner
                    title="Review before copying"
                    description={<>Copy-forward creates new section records in the target cycle. Assessments, grades, submissions, and attendance are not copied. <DocsLink href="/docs/cohorts-reassignment#copy-forward">Read copy-forward docs</DocsLink></>}
                    variant="warning"
                    dismissible={true}
                    icon={GitBranch}
                />

                <StepBlock step={1} title="Choose source and target cycles" description="Copy from the completed or current cycle into the new cycle.">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Source Cycle</label>
                            <CustomSelect
                                options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                                value={fromCycleId}
                                onChange={setFromCycleId}
                                placeholder="Select Source Cycle"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Target Cycle</label>
                            <CustomSelect
                                options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                                value={toCycleId}
                                onChange={setToCycleId}
                                placeholder="Select Target Cycle"
                            />
                        </div>
                    </div>
                </StepBlock>

                <StepBlock step={2} title="Select what travels forward" description="Sections and teacher assignments are copied; optional setup records can follow if useful.">
                    <div className="grid gap-3">
                        <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/55 p-3">
                            <span className="text-sm font-bold">Sections</span>
                            <Badge variant="success" size="sm" icon={CheckCircle2}>Always copied</Badge>
                        </div>
                        <ToggleRow label="Official weekly schedules" description="Copies teacher, room, day, and time only when no target-cycle conflict is found." checked={options.copySchedules} onChange={(value) => setOptions({ ...options, copySchedules: value })} />
                        <ToggleRow label="Course materials and links" checked={options.copyMaterials} onChange={(value) => setOptions({ ...options, copyMaterials: value })} />
                        <div className="rounded-md border border-border/70 bg-background/55 p-3">
                            <span className="text-sm font-bold">Assessments, grades, submissions, and attendance</span>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">Not copied forward. Create new assessments in the new cycle.</p>
                        </div>
                    </div>
                </StepBlock>

                <div className="flex justify-end">
                    <Button onClick={openCopyForwardConfirm} disabled={isExecuting || isPreviewLoading} isLoading={isPreviewLoading} icon={Copy}>
                        Review Copy Forward
                    </Button>
                </div>
            </div>

            <SummaryPanel
                title="Copy Summary"
                items={[
                    ['Source', fromCycle?.name || 'Not selected'],
                    ['Target', toCycle?.name || 'Not selected'],
                    ['Schedules', options.copySchedules ? 'Included with conflict checks' : 'Skipped'],
                    ['Materials', options.copyMaterials ? 'Included' : 'Skipped'],
                    ['Assessments', 'Never copied'],
                ]}
            />

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={executeCopyForward}
                title="Confirm copy forward"
                description={`Copy selected setup from ${fromCycle?.name || 'the source cycle'} into ${toCycle?.name || 'the target cycle'}. This creates new records and cannot be reversed automatically.`}
                confirmText="Confirm Copy"
                loadingId="copy-forward"
            >
                <div className="rounded-md border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Selected for copy</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-foreground">
                        {previewItems.length > 0 ? `${previewItems.slice(0, -1).join(', ')}${previewItems.length > 1 ? ', and ' : ''}${previewItems.at(-1)} ${previewTotal === 1 ? 'is' : 'are'} selected for copy forward.` : 'No preview is available.'}
                    </p>
                </div>
            </ConfirmDialog>
        </div>
    );
}

type ReassignmentMode = 'cohort' | 'section';
type SectionWithEnrollments = Section & { enrollments?: Array<{ student: Student }> };

function studentLabel(student: Student) {
    return student.user?.name || student.user?.email || student.registrationNumber || 'Unnamed student';
}

function ReassignmentView({ cycles, token, dispatch }: { cycles: AcademicCycle[]; token: string; dispatch: Dispatch<GlobalAction> }) {
    const [mode, setMode] = useState<ReassignmentMode>('cohort');
    const [sourceCohortId, setSourceCohortId] = useState('');
    const [sourceSectionId, setSourceSectionId] = useState('');
    const [targetCycleId, setTargetCycleId] = useState('');
    const [targetCohortId, setTargetCohortId] = useState('');
    const [targetSectionId, setTargetSectionId] = useState('');
    const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);

    const {
        data: sourceCohortDetail,
        isLoading: isSourceCohortLoading,
        error: sourceCohortError,
    } = useSWR<Cohort>(mode === 'cohort' && sourceCohortId ? ['cohort', sourceCohortId] as const : null);
    const {
        data: sourceSectionDetail,
        isLoading: isSourceSectionLoading,
        error: sourceSectionError,
    } = useSWR<SectionWithEnrollments>(mode === 'section' && sourceSectionId ? ['section-detail', sourceSectionId] as const : null);

    const targetCycle = cycles.find((cycle) => cycle.id === targetCycleId);
    const sourceStudents = mode === 'cohort'
        ? sourceCohortDetail?.students || []
        : sourceSectionDetail?.students || sourceSectionDetail?.enrollments?.map((enrollment) => enrollment.student) || [];
    const sourceError = mode === 'cohort' ? sourceCohortError : sourceSectionError;
    const isSourceLoading = mode === 'cohort' ? isSourceCohortLoading : isSourceSectionLoading;
    const sourceSelected = mode === 'cohort' ? Boolean(sourceCohortId) : Boolean(sourceSectionId);
    const studentCount = sourceStudents.length;
    const reassignmentCount = Math.max(studentCount - excludedStudentIds.length, 0);
    const studentCountLabel = sourceSelected && isSourceLoading ? 'Loading roster...' : `${reassignmentCount} of ${studentCount}`;

    const resetSource = (nextMode: ReassignmentMode) => {
        setMode(nextMode);
        setSourceCohortId('');
        setSourceSectionId('');
        setTargetCohortId('');
        setTargetSectionId('');
        setExcludedStudentIds([]);
    };

    const handleReassign = async () => {
        if (mode === 'cohort' && (!sourceCohortId || !targetCycleId || !targetCohortId)) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select source cohort, destination cycle, and destination cohort.', type: 'error' } });
            return;
        }
        if (mode === 'section' && (!sourceSectionId || !targetCycleId || !targetSectionId)) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select source section, destination cycle, and destination section.', type: 'error' } });
            return;
        }
        if (sourceError) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(sourceError, 'Could not load the source roster.'), type: 'error' } });
            return;
        }
        if (isSourceLoading) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Still loading the source roster. Please try again in a moment.', type: 'error' } });
            return;
        }
        if (studentCount === 0) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'The selected source has no students to reassign.', type: 'error' } });
            return;
        }
        if (reassignmentCount === 0) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'All source students are excluded.', type: 'error' } });
            return;
        }

        setIsExecuting(true);
        dispatch({ type: 'UI_START_PROCESSING', payload: 'reassign' });
        try {
            const res = await api.reassignment.reassignStudents({
                sourceType: mode,
                fromCycleId: mode === 'cohort' ? sourceCohortDetail?.academicCycleId : sourceSectionDetail?.academicCycleId,
                toCycleId: targetCycleId,
                fromCohortId: mode === 'cohort' ? sourceCohortId : undefined,
                fromSectionId: mode === 'section' ? sourceSectionId : undefined,
                toCohortId: mode === 'cohort' ? targetCohortId : undefined,
                toSectionId: mode === 'section' ? targetSectionId : undefined,
                excludedStudentIds,
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: res.message, type: 'success' } });
            setExcludedStudentIds([]);
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err, 'Error processing request'), type: 'error' } });
        } finally {
            setIsExecuting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'reassign' });
        }
    };

    const exclusionOptions = sourceStudents.map((student) => ({
        value: student.id,
        label: studentLabel(student),
        description: student.user?.email,
        meta: student.rollNumber ? `Roll ${student.rollNumber}` : student.registrationNumber,
    }));

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative space-y-4">
                <StatusBanner
                    title="Review before reassigning"
                    description={<>Reassignment changes current placement while preserving previous-cycle academic history. <DocsLink href="/docs/cohorts-reassignment#reassignment">Read reassignment docs</DocsLink></>}
                    variant="warning"
                    dismissible={true}
                    icon={ArrowLeftRight}
                />

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-card p-2">
                    <Button variant={mode === 'cohort' ? 'primary' : 'secondary'} icon={Users} onClick={() => resetSource('cohort')}>Cohort</Button>
                    <Button variant={mode === 'section' ? 'primary' : 'secondary'} icon={BookOpen} onClick={() => resetSource('section')}>Section</Button>
                </div>

                <StepBlock step={1} title={`Select the source ${mode}`} description="Everyone in the source is included unless you exclude individual students.">
                    <div className="space-y-3">
                        {mode === 'cohort' ? (
                            <RemoteFilterSelect
                                cacheKey="reassignment-source-cohort"
                                value={sourceCohortId}
                                onChange={(value) => {
                                    setSourceCohortId(value);
                                    setExcludedStudentIds([]);
                                }}
                                placeholder="Select source cohort"
                                allLabel="Select source cohort"
                                selectedLabel="Selected cohort"
                                loadOptions={(search) => searchFilterLookup({ token, entity: 'cohorts', search, includeAllCycles: true })}
                            />
                        ) : (
                            <RemoteFilterSelect
                                cacheKey="reassignment-source-section"
                                value={sourceSectionId}
                                onChange={(value) => {
                                    setSourceSectionId(value);
                                    setExcludedStudentIds([]);
                                }}
                                placeholder="Select source section"
                                allLabel="Select source section"
                                selectedLabel="Selected section"
                                loadOptions={(search) => searchFilterLookup({ token, entity: 'sections', search })}
                            />
                        )}
                        {sourceSelected && (
                            <div className="space-y-3 rounded-md border border-border/70 bg-background/55 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={sourceError ? 'error' : 'neutral'} size="sm" className="whitespace-normal text-left leading-tight">
                                        {sourceError ? 'Roster unavailable' : studentCountLabel}
                                    </Badge>
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        {isSourceLoading ? 'Fetching roster.' : 'Students selected for reassignment.'}
                                    </span>
                                </div>
                                <CustomMultiSelect
                                    values={excludedStudentIds}
                                    onChange={setExcludedStudentIds}
                                    icon={UserMinus}
                                    options={exclusionOptions}
                                    placeholder="Exclude individual students..."
                                    disabled={isSourceLoading || studentCount === 0}
                                />
                            </div>
                        )}
                    </div>
                </StepBlock>

                <StepBlock step={2} title="Choose the destination" description={mode === 'cohort' ? 'Pick the destination cycle, then the cohort inside that cycle.' : 'Pick the destination cycle, then the section inside that cycle.'}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Destination Cycle</label>
                            <CustomSelect
                                options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                                value={targetCycleId}
                                onChange={(value) => {
                                    setTargetCycleId(value);
                                    setTargetCohortId('');
                                    setTargetSectionId('');
                                }}
                                placeholder="Select destination cycle"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">{mode === 'cohort' ? 'Destination Cohort' : 'Destination Section'}</label>
                            {mode === 'cohort' ? (
                                <RemoteFilterSelect
                                    cacheKey={`reassignment-target-cohort-${targetCycleId || 'none'}`}
                                    value={targetCohortId}
                                    onChange={setTargetCohortId}
                                    placeholder={targetCycleId ? 'Select destination cohort' : 'Select cycle first'}
                                    allLabel={targetCycleId ? 'Select destination cohort' : 'Select cycle first'}
                                    selectedLabel="Selected cohort"
                                    disabled={!targetCycleId}
                                    loadOptions={(search) => searchFilterLookup({ token, entity: 'cohorts', search, academicCycleId: targetCycleId })}
                                />
                            ) : (
                                <RemoteFilterSelect
                                    cacheKey={`reassignment-target-section-${targetCycleId || 'none'}`}
                                    value={targetSectionId}
                                    onChange={setTargetSectionId}
                                    placeholder={targetCycleId ? 'Select destination section' : 'Select cycle first'}
                                    allLabel={targetCycleId ? 'Select destination section' : 'Select cycle first'}
                                    selectedLabel="Selected section"
                                    disabled={!targetCycleId}
                                    loadOptions={(search) => searchFilterLookup({ token, entity: 'sections', search, academicCycleId: targetCycleId })}
                                />
                            )}
                        </div>
                    </div>
                </StepBlock>

                <div className="flex justify-end">
                    <Button onClick={handleReassign} disabled={isExecuting || isSourceLoading} isLoading={isExecuting} icon={ArrowLeftRight}>
                        Reassign Students
                    </Button>
                </div>
            </div>

            <SummaryPanel
                title="Reassignment Summary"
                items={[
                    ['Mode', mode === 'cohort' ? 'Cohort' : 'Section'],
                    ['Source', mode === 'cohort' ? (sourceCohortDetail?.name || (sourceCohortId ? 'Selected cohort' : 'Not selected')) : (sourceSectionDetail?.name || (sourceSectionId ? 'Selected section' : 'Not selected'))],
                    ['Students', studentCountLabel],
                    ['Excluded', `${excludedStudentIds.length}`],
                    ['Destination cycle', targetCycle?.name || 'Not selected'],
                    ['Destination', mode === 'cohort' ? (targetCohortId ? 'Selected cohort' : 'Not selected') : (targetSectionId ? 'Selected section' : 'Not selected')],
                ]}
            />
        </div>
    );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/55 p-3">
            <div className="min-w-0 pr-3">
                <span className="text-sm font-bold">{label}</span>
                {description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{description}</p>}
            </div>
            <Toggle checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

function SummaryPanel({ title, items }: { title: string; items: [string, string][] }) {
    return (
        <aside className="h-fit rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-muted-foreground">{title}</h2>
            <div className="mt-4 space-y-3">
                {items.map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border/60 bg-background/55 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
                    </div>
                ))}
            </div>
        </aside>
    );
}

