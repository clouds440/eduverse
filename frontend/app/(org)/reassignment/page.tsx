'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ArrowLeftRight, Copy, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { AcademicCycle, Cohort, CopyForwardPreview, PaginatedResponse, ProgramClassificationStatus, ProgramDeliveryOption, Role, Section } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, PageTabs } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Toggle } from '@/components/ui/Toggle';

type Tab = 'copy' | 'reassign';

export default function ReassignmentPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [tab, setTab] = useState<Tab>('copy');
    const { data: cycles, error, isLoading, mutate } = useSWR<PaginatedResponse<AcademicCycle>>(token ? ['academicCycles', { limit: 100 }] : null);
    if (!token || isLoading) return <Loading className="h-full" text="Loading academic transitions..." />;
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    if (user?.role !== Role.ORG_ADMIN && user?.role !== Role.SUB_ADMIN) return <div className="flex h-full items-center justify-center"><StatusBanner title="Access restricted" description="Only organization admins and sub admins can run academic transitions." variant="warning" /></div>;
    return <PageShell className="overflow-y-auto"><PageHeader title="Academic Transitions" description="Copy delivery setup or move students between cycle-specific sections and cohort offerings." icon={ArrowLeftRight} breadcrumbs={[{ label: 'Academics' }, { label: 'Transitions' }]} /><PageTabs ariaLabel="Transition workflow" activeValue={tab} onValueChange={setTab} items={[{ value: 'copy', label: 'Copy Forward', icon: Copy }, { value: 'reassign', label: 'Reassign Students', icon: Users }]} />{tab === 'copy' ? <CopyForward cycles={cycles?.data || []} token={token} dispatch={dispatch} /> : <Reassign cycles={cycles?.data || []} token={token} dispatch={dispatch} />}</PageShell>;
}

function CopyForward({ cycles, token, dispatch }: { cycles: AcademicCycle[]; token: string; dispatch: ReturnType<typeof useGlobal>['dispatch'] }) {
    const [fromCycleId, setFromCycleId] = useState('');
    const [toCycleId, setToCycleId] = useState('');
    const [classification, setClassification] = useState(ProgramClassificationStatus.STANDALONE);
    const [sourceId, setSourceId] = useState('');
    const [targetId, setTargetId] = useState('');
    const [options, setOptions] = useState({ copySchedules: false, copyMaterials: false });
    const [preview, setPreview] = useState<CopyForwardPreview | null>(null);
    const [error, setError] = useState('');
    const { data: sources = [] } = useSWR<ProgramDeliveryOption[]>(fromCycleId ? ['program-delivery-options', fromCycleId] : null, () => api.programs.getDeliveryOptions(token, fromCycleId));
    const { data: targets = [] } = useSWR<ProgramDeliveryOption[]>(toCycleId ? ['program-delivery-options', toCycleId] : null, () => api.programs.getDeliveryOptions(token, toCycleId));
    const source = sources.find((item) => item.id === sourceId);
    const eligibleTargets = targets.filter((item) => !source || item.programOffering.programId === source.programOffering.programId);
    const payload = { programClassificationStatus: classification, sourceProgramStageOfferingId: classification === ProgramClassificationStatus.PROGRAM_MAPPED ? sourceId : undefined, targetProgramStageOfferingId: classification === ProgramClassificationStatus.PROGRAM_MAPPED ? targetId : undefined, fromCycleId, toCycleId, ...options };
    const run = async (execute: boolean) => { setError(''); dispatch({ type: 'UI_START_PROCESSING', payload: execute ? 'copy-execute' : 'copy-preview' }); try { if (execute) { const result = await api.copyForward.execute(payload, token); dispatch({ type: 'TOAST_ADD', payload: { message: result.message, type: 'success' } }); setPreview(null); } else setPreview(await api.copyForward.preview(payload, token)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to copy setup'); } finally { dispatch({ type: 'UI_STOP_PROCESSING', payload: execute ? 'copy-execute' : 'copy-preview' }); } };
    const valid = fromCycleId && toCycleId && fromCycleId !== toCycleId && (classification === ProgramClassificationStatus.STANDALONE || (sourceId && targetId));
    return <Workflow title="Copy setup forward" text="Copies section setup between institute cycles. Program-mapped copies require matching source and destination stage offerings.">{error && <ErrorText text={error} />}<CyclePair cycles={cycles} from={fromCycleId} to={toCycleId} onFrom={(id) => { setFromCycleId(id); setSourceId(''); setPreview(null); }} onTo={(id) => { setToCycleId(id); setTargetId(''); setPreview(null); }} /><Field label="Delivery type"><CustomSelect value={classification} onChange={(value) => { setClassification(value); setSourceId(''); setTargetId(''); }} options={[{ value: ProgramClassificationStatus.STANDALONE, label: 'Standalone sections' }, { value: ProgramClassificationStatus.PROGRAM_MAPPED, label: 'Program-mapped sections' }]} /></Field>{classification === ProgramClassificationStatus.PROGRAM_MAPPED && <div className="grid gap-4 md:grid-cols-2"><Field label="Source stage offering"><CustomSelect searchable value={sourceId} onChange={(id) => { setSourceId(id); setTargetId(''); }} options={sources.map(stageOption)} /></Field><Field label="Destination stage offering"><CustomSelect searchable value={targetId} onChange={setTargetId} options={eligibleTargets.map(stageOption)} /></Field></div>}<div className="flex flex-wrap gap-5"><Toggle checked={options.copySchedules} onCheckedChange={(copySchedules) => setOptions({ ...options, copySchedules })} label="Copy schedules" /><Toggle checked={options.copyMaterials} onCheckedChange={(copyMaterials) => setOptions({ ...options, copyMaterials })} label="Copy materials" /></div>{preview && <div className="flex flex-wrap gap-2 rounded-md border border-border/70 p-3"><Badge variant="neutral">{preview.sections} sections</Badge><Badge variant="neutral">{preview.schedules} schedules</Badge><Badge variant="neutral">{preview.materials} materials</Badge></div>}<div className="flex justify-end gap-2"><Button variant="secondary" loadingId="copy-preview" disabled={!valid} onClick={() => run(false)}>Preview</Button><Button loadingId="copy-execute" disabled={!valid || !preview} onClick={() => run(true)}>Copy forward</Button></div></Workflow>;
}

function Reassign({ cycles, token, dispatch }: { cycles: AcademicCycle[]; token: string; dispatch: ReturnType<typeof useGlobal>['dispatch'] }) {
    const [sourceType, setSourceType] = useState<'cohort' | 'section'>('cohort');
    const [fromCycleId, setFromCycleId] = useState('');
    const [toCycleId, setToCycleId] = useState('');
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [error, setError] = useState('');
    const { data: fromSections } = useSWR<PaginatedResponse<Section>>(fromCycleId && sourceType === 'section' ? ['sections', { academicCycleId: fromCycleId, limit: 1000 }] : null, () => api.org.getSections(token, { academicCycleId: fromCycleId, limit: 1000 }));
    const { data: toSections } = useSWR<PaginatedResponse<Section>>(toCycleId && sourceType === 'section' ? ['sections', { academicCycleId: toCycleId, limit: 1000 }] : null, () => api.org.getSections(token, { academicCycleId: toCycleId, limit: 1000 }));
    const { data: fromCohorts } = useSWR<PaginatedResponse<Cohort>>(fromCycleId && sourceType === 'cohort' ? ['cohorts', { academicCycleId: fromCycleId, limit: 1000 }] : null, () => api.cohorts.getCohorts(token, { academicCycleId: fromCycleId, limit: 1000 }));
    const { data: toCohorts } = useSWR<PaginatedResponse<Cohort>>(toCycleId && sourceType === 'cohort' ? ['cohorts', { academicCycleId: toCycleId, limit: 1000 }] : null, () => api.cohorts.getCohorts(token, { academicCycleId: toCycleId, limit: 1000 }));
    const sourceCohortOfferings = useMemo(() => flattenCohorts(fromCohorts?.data || [], fromCycleId), [fromCohorts?.data, fromCycleId]);
    const targetCohortOfferings = useMemo(() => flattenCohorts(toCohorts?.data || [], toCycleId), [toCohorts?.data, toCycleId]);
    const submit = async () => { dispatch({ type: 'UI_START_PROCESSING', payload: 'reassign-students' }); setError(''); try { const result = await api.reassignment.reassignStudents({ sourceType, fromCycleId, toCycleId, fromCohortId: sourceType === 'cohort' ? fromId : undefined, toCohortId: sourceType === 'cohort' ? toId : undefined, fromSectionId: sourceType === 'section' ? fromId : undefined, toSectionId: sourceType === 'section' ? toId : undefined }, token); dispatch({ type: 'TOAST_ADD', payload: { message: `${result.reassigned} students reassigned; ${result.skipped} skipped`, type: 'success' } }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reassign students'); } finally { dispatch({ type: 'UI_STOP_PROCESSING', payload: 'reassign-students' }); } };
    return <Workflow title="Reassign students" text="Moves all active members of a cohort offering, or all enrolled students in a section, to a destination in another cycle.">{error && <ErrorText text={error} />}<Field label="Source type"><CustomSelect value={sourceType} onChange={(value) => { setSourceType(value); setFromId(''); setToId(''); }} options={[{ value: 'cohort', label: 'Cohort offering' }, { value: 'section', label: 'Section' }]} /></Field><CyclePair cycles={cycles} from={fromCycleId} to={toCycleId} onFrom={(id) => { setFromCycleId(id); setFromId(''); }} onTo={(id) => { setToCycleId(id); setToId(''); }} /><div className="grid gap-4 md:grid-cols-2"><Field label={`Source ${sourceType}`}><CustomSelect searchable value={fromId} onChange={setFromId} options={sourceType === 'section' ? (fromSections?.data || []).map(sectionOption) : sourceCohortOfferings} /></Field><Field label={`Destination ${sourceType}`}><CustomSelect searchable value={toId} onChange={setToId} options={sourceType === 'section' ? (toSections?.data || []).map(sectionOption) : targetCohortOfferings} /></Field></div><div className="flex justify-end"><Button loadingId="reassign-students" disabled={!fromCycleId || !toCycleId || !fromId || !toId} onClick={submit}>Reassign students</Button></div></Workflow>;
}

function Workflow({ title, text, children }: { title: string; text: string; children: React.ReactNode }) { return <section className="space-y-5 rounded-lg border border-border/70 bg-card/75 p-5"><div><h2 className="text-base font-black">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><label className="text-sm font-bold">{label}</label>{children}</div>; }
function CyclePair({ cycles, from, to, onFrom, onTo }: { cycles: AcademicCycle[]; from: string; to: string; onFrom: (id: string) => void; onTo: (id: string) => void }) { const options = cycles.map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` })); return <div className="grid gap-4 md:grid-cols-2"><Field label="Source cycle"><CustomSelect searchable value={from} onChange={onFrom} options={options} /></Field><Field label="Destination cycle"><CustomSelect searchable value={to} onChange={onTo} options={options.filter((item) => item.value !== from)} /></Field></div>; }
function stageOption(item: ProgramDeliveryOption) { return { value: item.id, label: `${item.programOffering.program.code} - ${item.programStage.name}` }; }
function sectionOption(item: Section) { return { value: item.id, label: `${item.course?.code || 'Course'} - ${item.name}` }; }
function flattenCohorts(cohorts: Cohort[], cycleId: string) { return cohorts.flatMap((cohort) => (cohort.offerings || []).filter((item) => item.academicCycleId === cycleId).map((item) => ({ value: item.id, label: `${cohort.code} - ${cohort.name}${item.programStageOffering ? ` · ${item.programStageOffering.programStage.name}` : ''}` }))); }
function ErrorText({ text }: { text: string }) { return <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{text}</div>; }
