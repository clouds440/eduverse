'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { GitBranch, Play, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { AcademicCycle, BulkProgressionAction, BulkProgressionItem, PaginatedResponse, ProgramDeliveryOption, ProgramStageOfferingStatus, ProgressionWorkbenchPreview } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell } from '@/components/ui/PageShell';

type RowDraft = { selected: boolean; action: BulkProgressionAction; reason: string; overrideReason: string; targetProgramStageOfferingId: string };

export default function ProgressionWorkbenchPage() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [programStageOfferingId, setProgramStageOfferingId] = useState('');
    const [preview, setPreview] = useState<ProgressionWorkbenchPreview | null>(null);
    const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
    const [error, setError] = useState('');
    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(token ? ['academicCycles', { limit: 100 }] : null);
    const { data: offerings = [] } = useSWR<ProgramDeliveryOption[]>(token && academicCycleId ? ['program-delivery-options', academicCycleId] : null, () => api.programs.getDeliveryOptions(token!, academicCycleId));
    const openOfferings = offerings.filter((offering) => offering.status === ProgramStageOfferingStatus.OPEN);
    const selectedCount = Object.values(drafts).filter((draft) => draft.selected).length;

    const loadPreview = async () => {
        if (!token || !programStageOfferingId) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'progression-preview' });
        setError('');
        try {
            const result = await api.progressionWorkbench.preview({ programStageOfferingId }, token);
            setPreview(result);
            setDrafts(Object.fromEntries(result.rows.map((row) => [row.stageEnrollmentId, { selected: true, action: row.recommendation, reason: '', overrideReason: '', targetProgramStageOfferingId: '' }])));
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load progression preview'); }
        finally { dispatch({ type: 'UI_STOP_PROCESSING', payload: 'progression-preview' }); }
    };

    const apply = async () => {
        if (!token || !preview) return;
        const items: BulkProgressionItem[] = preview.rows.flatMap((row) => {
            const draft = drafts[row.stageEnrollmentId];
            if (!draft?.selected) return [];
            return [{ stageEnrollmentId: row.stageEnrollmentId, action: draft.action, reason: draft.reason, overrideReason: draft.overrideReason || undefined, targetProgramStageOfferingId: draft.targetProgramStageOfferingId || undefined }];
        });
        if (!items.length || items.some((item) => !item.reason.trim())) { setError('Select at least one student and provide a reason for every selected action.'); return; }
        if (items.some((item) => [BulkProgressionAction.ADVANCE, BulkProgressionAction.REPEAT].includes(item.action) && !item.targetProgramStageOfferingId)) { setError('Choose a target offering for every advance or repeat action.'); return; }
        dispatch({ type: 'UI_START_PROCESSING', payload: 'progression-apply' });
        setError('');
        try {
            const result = await api.progressionWorkbench.apply({ programStageOfferingId, idempotencyKey: crypto.randomUUID(), items }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: `${result.succeeded} progression actions completed; ${result.failed} failed`, type: result.failed ? 'info' : 'success' } });
            if (result.failed) setError(result.results.filter((row) => !row.success).map((row) => row.error).join(' '));
            await loadPreview();
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to apply bulk progression'); }
        finally { dispatch({ type: 'UI_STOP_PROCESSING', payload: 'progression-apply' }); }
    };

    const updateDraft = (id: string, patch: Partial<RowDraft>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    const rows = useMemo(() => preview?.rows || [], [preview?.rows]);

    return <PageShell className="overflow-y-auto"><PageHeader title="Progression Workbench" description="Review evidence and apply auditable student progression decisions in bulk." icon={GitBranch} breadcrumbs={[{ label: 'Academics' }, { label: 'Progression' }]} />
        {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
        <section className="space-y-4"><div className="grid gap-4 border-y border-border py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Field label="Academic cycle"><CustomSelect searchable value={academicCycleId} onChange={(value) => { setAcademicCycleId(value); setProgramStageOfferingId(''); setPreview(null); }} options={(cycles?.data || []).map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` }))} /></Field><Field label="Source stage offering"><CustomSelect searchable value={programStageOfferingId} onChange={(value) => { setProgramStageOfferingId(value); setPreview(null); }} options={openOfferings.map((offering) => ({ value: offering.id, label: `${offering.programOffering.program.code} - ${offering.programStage.name}` }))} disabled={!academicCycleId} /></Field><div className="flex items-end"><Button icon={RefreshCw} loadingId="progression-preview" disabled={!programStageOfferingId} onClick={loadPreview}>Preview</Button></div></div></section>
        {preview && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-black">{preview.offering.programStage.name}</h2><p className="text-sm text-muted-foreground">{rows.length} in-progress students, {selectedCount} selected</p></div><Button icon={Play} loadingId="progression-apply" disabled={!selectedCount} onClick={apply}>Apply selected</Button></div><div className="overflow-x-auto border-y border-border"><div className="min-w-[980px] divide-y divide-border">{rows.map((row) => { const draft = drafts[row.stageEnrollmentId]; const needsOverride = [BulkProgressionAction.ADVANCE, BulkProgressionAction.COMPLETE_PROGRAM].includes(draft?.action) && !row.evidence?.eligibleToComplete; const targetOptions = draft?.action === BulkProgressionAction.REPEAT ? openOfferings.filter((offering) => offering.programStageId === preview.offering.programStageId) : row.nextOfferings; return <div key={row.stageEnrollmentId} className="grid grid-cols-[2rem_minmax(12rem,1fr)_8rem_10rem_minmax(12rem,1fr)_minmax(12rem,1fr)] items-start gap-3 py-4"><input type="checkbox" className="mt-2 h-4 w-4 accent-primary" checked={draft?.selected || false} onChange={(event) => updateDraft(row.stageEnrollmentId, { selected: event.target.checked })} aria-label={`Select ${row.student.user.name || row.student.user.email}`} /><div><p className="text-sm font-black">{row.student.user.name || row.student.user.email}</p><p className="text-xs text-muted-foreground">{row.student.registrationNumber}</p>{row.evidence?.blockers.map((blocker) => <p key={blocker.code} className="mt-1 text-xs text-danger">{blocker.message}</p>)}</div><div><Badge variant={row.evidence?.eligibleToComplete ? 'success' : 'neutral'}>{row.recommendation}</Badge><p className="mt-2 text-xs text-muted-foreground">Credits {row.evidence?.earnedCredits ?? 0}/{row.evidence?.requiredCredits ?? 0}</p><p className="text-xs text-muted-foreground">Attendance {row.evidence?.attendancePercentage ?? 'N/A'}%</p></div><CustomSelect value={draft?.action || row.recommendation} onChange={(action) => updateDraft(row.stageEnrollmentId, { action, targetProgramStageOfferingId: '' })} options={Object.values(BulkProgressionAction).filter((action) => action !== BulkProgressionAction.TRANSFER).map((action) => ({ value: action, label: action.replaceAll('_', ' ') }))} /><div className="space-y-2"><Input value={draft?.reason || ''} onChange={(event) => updateDraft(row.stageEnrollmentId, { reason: event.target.value })} placeholder="Decision reason" />{needsOverride && <Input value={draft?.overrideReason || ''} onChange={(event) => updateDraft(row.stageEnrollmentId, { overrideReason: event.target.value })} placeholder="Required override reason" />}</div>{draft?.action === BulkProgressionAction.REPEAT || draft?.action === BulkProgressionAction.ADVANCE ? <CustomSelect searchable value={draft.targetProgramStageOfferingId} onChange={(targetProgramStageOfferingId) => updateDraft(row.stageEnrollmentId, { targetProgramStageOfferingId })} options={targetOptions.map((offering) => ({ value: offering.id, label: `${offering.programOffering.academicCycle.code} - ${offering.programStage.name}` }))} placeholder={draft.action === BulkProgressionAction.REPEAT ? 'Repeat offering' : 'Next stage offering'} /> : <span className="text-xs text-muted-foreground">Evidence is saved with the decision.</span>}</div>; })}{!rows.length && <p className="py-12 text-center text-sm text-muted-foreground">No in-progress students in this stage offering.</p>}</div></div></section>}
    </PageShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
