'use client';

import { useMemo, useState, type Dispatch } from 'react';
import useSWR from 'swr';
import { AcademicCycle, ApiError, Cohort, CopyForwardPreview, Role } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal, type GlobalAction } from '@/context/GlobalContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, PageTabs, ResourcePanel } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Toggle } from '@/components/ui/Toggle';
import { ArrowRight, CheckCircle2, Copy, GitBranch, Users } from 'lucide-react';

const PROMOTION_TABS = [
    { value: 'copy-forward', label: 'Copy Forward', icon: Copy },
    { value: 'promote', label: 'Cohort Promotion', icon: Users },
] as const;

type PromotionTab = typeof PROMOTION_TABS[number]['value'];

export default function PromotionsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [activeTab, setActiveTab] = useState<PromotionTab>('copy-forward');

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData, isLoading, error, mutate } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const cohortsKey = token ? ['cohorts', { limit: 500 }] as const : null;
    const { data: cohortsData } = useSWR<{ data: Cohort[] }>(cohortsKey);

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
    const cohorts = cohortsData?.data || [];

    return (
        <PageShell className="gap-0.5">
            <PageHeader
                title="Academic Transitions"
                description={<>Copy setup or promote cohorts after review. <DocsLink href="/docs/cohorts-promotions#promotions">Read transition docs</DocsLink></>}
                icon={ArrowRight}
                meta={<Badge variant="neutral" size="sm">{cycles.length} cycles</Badge>}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Promotions' },
                ]}
            />

            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 rounded-t-lg bg-card/80">
                    <PageTabs
                        ariaLabel="Academic transition navigation"
                        items={PROMOTION_TABS}
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
                        <PromotionView cycles={cycles} cohorts={cohorts} token={token} dispatch={dispatch} />
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
    const [options, setOptions] = useState({ copySchedules: true, copyAssessments: false, copyMaterials: false });
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
        copyAssessments: options.copyAssessments,
        copyMaterials: options.copyMaterials,
    }), [fromCycleId, options.copyAssessments, options.copyMaterials, options.copySchedules, toCycleId]);
    const previewItems = copyPreview ? [
        formatCount(copyPreview.sections, 'section'),
        ...(options.copySchedules ? [formatCount(copyPreview.schedules, 'schedule')] : []),
        ...(options.copyAssessments ? [formatCount(copyPreview.assessments, 'assessment')] : []),
        ...(options.copyMaterials ? [formatCount(copyPreview.materials, 'material')] : []),
    ] : [];
    const previewTotal = copyPreview
        ? copyPreview.sections
        + (options.copySchedules ? copyPreview.schedules : 0)
        + (options.copyAssessments ? copyPreview.assessments : 0)
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
                    message: `Copy forward successful. Copied ${formatCount(res.sectionsCopied, 'section')}, ${formatCount(res.schedulesCopied, 'schedule')}, ${formatCount(res.assessmentsCopied, 'assessment')}, and ${formatCount(res.materialsCopied, 'material')}.`,
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
                    description={<>Copy-forward creates new records in the target cycle. <DocsLink href="/docs/cohorts-promotions#copy-forward">Read copy-forward docs</DocsLink></>}
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

                <StepBlock step={2} title="Select what travels forward" description="Sections are always copied; optional records can follow if useful.">
                    <div className="grid gap-3">
                        <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/55 p-3">
                            <span className="text-sm font-bold">Sections</span>
                            <Badge variant="success" size="sm" icon={CheckCircle2}>Always copied</Badge>
                        </div>
                        <ToggleRow label="Timetables and schedules" checked={options.copySchedules} onChange={(value) => setOptions({ ...options, copySchedules: value })} />
                        <ToggleRow label="Course materials and links" checked={options.copyMaterials} onChange={(value) => setOptions({ ...options, copyMaterials: value })} />
                        <ToggleRow label="Assessments" checked={options.copyAssessments} onChange={(value) => setOptions({ ...options, copyAssessments: value })} />
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
                    ['Schedules', options.copySchedules ? 'Included' : 'Skipped'],
                    ['Materials', options.copyMaterials ? 'Included' : 'Skipped'],
                    ['Assessments', options.copyAssessments ? 'Included' : 'Skipped'],
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

function PromotionView({ cycles, cohorts, token, dispatch }: { cycles: AcademicCycle[]; cohorts: Cohort[]; token: string; dispatch: Dispatch<GlobalAction> }) {
    const [originCohortId, setOriginCohortId] = useState('');
    const [targetCycleId, setTargetCycleId] = useState('');
    const [targetCohortId, setTargetCohortId] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    const originCohort = cohorts.find((cohort) => cohort.id === originCohortId);
    const {
        data: originCohortDetail,
        isLoading: isOriginCohortLoading,
        error: originCohortError,
    } = useSWR<Cohort>(originCohortId ? ['cohort', originCohortId] as const : null);
    const targetCycle = cycles.find((cycle) => cycle.id === targetCycleId);
    const targetCohorts = useMemo(() => (
        cohorts.filter((cohort) => cohort.academicCycleId === targetCycleId)
    ), [cohorts, targetCycleId]);
    const targetCohort = cohorts.find((cohort) => cohort.id === targetCohortId);
    const originStudents = originCohortDetail?.students || [];
    const listedStudentCount = originCohort?._count?.students ?? originCohort?.students?.length ?? 0;
    const studentCount = originCohortDetail ? originStudents.length : listedStudentCount;
    const studentCountLabel = originCohortId && isOriginCohortLoading ? `${listedStudentCount} listed, loading roster...` : `${studentCount}`;

    const handlePromote = async () => {
        if (!originCohortId || !targetCycleId || !targetCohortId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Please select origin cohort, target cycle, and target cohort.', type: 'error' } });
            return;
        }
        if (originCohortError) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(originCohortError, 'Could not load the cohort roster.'), type: 'error' } });
            return;
        }
        if (!originCohortDetail || isOriginCohortLoading) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Still loading the cohort roster. Please try again in a moment.', type: 'error' } });
            return;
        }
        if (originStudents.length === 0) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Origin cohort has no students to promote.', type: 'error' } });
            return;
        }

        setIsExecuting(true);
        dispatch({ type: 'UI_START_PROCESSING', payload: 'promote' });
        try {
            const studentIds = originStudents.map((student) => student.id);
            const res = await api.promotions.promoteStudents({
                studentIds,
                fromCycleId: originCohortDetail.academicCycleId,
                toCycleId: targetCycleId,
                toCohortId: targetCohortId,
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: res.message, type: 'success' } });
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getApiErrorMessage(err, 'Error processing request'), type: 'error' } });
        } finally {
            setIsExecuting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'promote' });
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative space-y-4">
                <StatusBanner
                    title="Review before promoting"
                    description={<>Promotion changes student placement. <DocsLink href="/docs/cohorts-promotions#promotions">Read promotion docs</DocsLink></>}
                    variant="warning"
                    dismissible={true}
                    icon={Users}
                />

                <StepBlock step={1} title="Select the origin cohort" description="This is the cohort whose students will be promoted.">
                    <div className="space-y-3">
                        <CustomSelect
                            options={cohorts.map((cohort) => ({ value: cohort.id, label: `${cohort.name} (${cohort.academicCycle?.name || 'No Cycle'})` }))}
                            value={originCohortId}
                            onChange={setOriginCohortId}
                            placeholder="Select Cohort to Promote"
                        />
                        {originCohortId && (
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background/55 p-3">
                                <Badge variant={originCohortError ? 'error' : 'neutral'} size="sm" className="whitespace-normal text-left leading-tight">
                                    {originCohortError ? 'Roster unavailable' : studentCountLabel}
                                </Badge>
                                <span className="text-xs font-semibold text-muted-foreground">
                                    {isOriginCohortLoading ? 'Fetching student IDs for promotion.' : 'Students in selected origin cohort.'}
                                </span>
                            </div>
                        )}
                    </div>
                </StepBlock>

                <StepBlock step={2} title="Choose the destination" description="Pick the target cycle first, then the cohort inside that cycle.">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Target Cycle</label>
                            <CustomSelect
                                options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                                value={targetCycleId}
                                onChange={(value) => {
                                    setTargetCycleId(value);
                                    setTargetCohortId('');
                                }}
                                placeholder="Select Target Cycle"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Target Cohort</label>
                            <CustomSelect
                                options={targetCohorts.map((cohort) => ({ value: cohort.id, label: cohort.name }))}
                                value={targetCohortId}
                                onChange={setTargetCohortId}
                                placeholder={targetCycleId ? 'Select Target Cohort' : 'Select cycle first'}
                                disabled={!targetCycleId}
                            />
                        </div>
                    </div>
                </StepBlock>

                <div className="flex justify-end">
                    <Button onClick={handlePromote} disabled={isExecuting || isOriginCohortLoading} isLoading={isExecuting} icon={Users}>
                        Promote Cohort
                    </Button>
                </div>
            </div>

            <SummaryPanel
                title="Promotion Summary"
                items={[
                    ['Origin', originCohort?.name || 'Not selected'],
                    ['Students', studentCountLabel],
                    ['Target cycle', targetCycle?.name || 'Not selected'],
                    ['Target cohort', targetCohort?.name || 'Not selected'],
                ]}
            />
        </div>
    );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <div className="flex items-center justify-between rounded-md border border-border/70 bg-background/55 p-3">
            <span className="text-sm font-bold">{label}</span>
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

