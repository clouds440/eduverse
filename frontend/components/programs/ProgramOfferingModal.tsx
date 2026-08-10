'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import {
    AcademicCycle,
    AcademicCycleStatus,
    CurriculumStatus,
    PaginatedResponse,
    Program,
    ProgramOffering,
    ProgramOfferingStatus,
    ProgramStageOfferingStatus,
} from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { Textarea } from '@/components/ui/Textarea';
import { programOfferingStatusOptions, programStageOfferingStatusOptions } from '@/lib/offeringLifecycle';

interface ProgramOfferingModalProps {
    isOpen: boolean;
    program: Program;
    offering?: ProgramOffering | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

function localDateTime(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ProgramOfferingModal({ isOpen, program, offering, onClose, onSaved }: ProgramOfferingModalProps) {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const curricula = useMemo(
        () => (program.curriculumVersions || []).filter((item) => item.status !== CurriculumStatus.RETIRED && item.status !== CurriculumStatus.ARCHIVED),
        [program.curriculumVersions],
    );
    const [curriculumVersionId, setCurriculumVersionId] = useState('');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [status, setStatus] = useState(ProgramOfferingStatus.DRAFT);
    const [capacity, setCapacity] = useState('');
    const [notes, setNotes] = useState('');
    const [opensAt, setOpensAt] = useState('');
    const [closesAt, setClosesAt] = useState('');
    const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
    const [stageStatuses, setStageStatuses] = useState<Record<string, ProgramStageOfferingStatus>>({});
    const [error, setError] = useState('');
    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(
        token && isOpen ? ['academic-cycles', { limit: 100 }] : null,
        () => api.academicCycles.getCycles(token!, { limit: 100 }),
    );
    const curriculum = curricula.find((item) => item.id === curriculumVersionId);

    useEffect(() => {
        if (!isOpen) return;
        const initial = offering?.curriculumVersion
            || curricula.find((item) => item.isDefaultForAdmissions)
            || curricula.find((item) => item.status === CurriculumStatus.ACTIVE)
            || curricula[0];
        setCurriculumVersionId(initial?.id || '');
        setSelectedStageIds(offering ? offering.stageOfferings.map((stage) => stage.programStageId) : (initial?.stages || []).map((stage) => stage.id));
        setStageStatuses(Object.fromEntries((offering?.stageOfferings || []).map((stage) => [stage.programStageId, stage.status])));
        setAcademicCycleId(offering?.academicCycleId || '');
        setStatus(offering?.status || ProgramOfferingStatus.DRAFT);
        setCapacity(offering?.capacity ? String(offering.capacity) : '');
        setNotes(offering?.notes || '');
        setOpensAt(localDateTime(offering?.opensAt));
        setClosesAt(localDateTime(offering?.closesAt));
        setError('');
    }, [curricula, isOpen, offering]);

    const chooseCurriculum = (id: string) => {
        const next = curricula.find((item) => item.id === id);
        setCurriculumVersionId(id);
        setSelectedStageIds((next?.stages || []).map((stage) => stage.id));
        setStageStatuses({});
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        if (!curriculumVersionId || !academicCycleId || selectedStageIds.length === 0) {
            setError('Select a curriculum, an academic cycle, and at least one stage.');
            return;
        }
        dispatch({ type: 'UI_START_PROCESSING', payload: 'program-offering-save' });
        setError('');
        try {
            const mutable = {
                status: offering ? status : ProgramOfferingStatus.DRAFT,
                opensAt: opensAt ? new Date(opensAt).toISOString() : offering ? null : undefined,
                closesAt: closesAt ? new Date(closesAt).toISOString() : offering ? null : undefined,
                capacity: capacity ? Number(capacity) : undefined,
                notes: notes || undefined,
                stages: selectedStageIds.map((programStageId) => ({
                    programStageId,
                    status: offering ? (stageStatuses[programStageId] || ProgramStageOfferingStatus.PLANNED) : ProgramStageOfferingStatus.PLANNED,
                })),
            };
            if (offering) {
                await api.programOfferings.update(offering.id, mutable, token);
            } else {
                await api.programOfferings.create({
                    programId: program.id,
                    curriculumVersionId,
                    academicCycleId,
                    ...mutable,
                }, token);
            }
            dispatch({ type: 'TOAST_ADD', payload: { message: `Program offering ${offering ? 'updated' : 'created'}`, type: 'success' } });
            await onSaved();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to save program offering');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'program-offering-save' });
        }
    };

    return (
        <ModalForm
            isOpen={isOpen}
            onClose={onClose}
            title={offering ? 'Edit Program Offering' : 'Create Program Offering'}
            submitText={offering ? 'Save offering' : 'Create offering'}
            loadingId="program-offering-save"
            onSubmit={submit}
        >
            <div className="rounded-md border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium text-muted-foreground">An offering connects this program and curriculum to one institute-wide academic cycle. The program structure remains unchanged.</div>
            {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
            <div className="space-y-2"><Label>Curriculum</Label><CustomSelect value={curriculumVersionId} onChange={chooseCurriculum} disabled={Boolean(offering)} options={curricula.map((item) => ({ value: item.id, label: `${item.code} - ${item.name} (${item.status})` }))} placeholder="Select curriculum" /></div>
            <div className="space-y-2"><Label>Academic cycle</Label><CustomSelect value={academicCycleId} onChange={setAcademicCycleId} disabled={Boolean(offering)} searchable options={(cycles?.data || []).filter((cycle) => cycle.status === AcademicCycleStatus.DRAFT || cycle.status === AcademicCycleStatus.ACTIVE).map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` }))} placeholder="Select institute cycle" /></div>
            {offering && <div className="space-y-2"><Label>Offering status</Label><CustomSelect value={status} onChange={setStatus} options={programOfferingStatusOptions(offering.status)} /></div>}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Opens at</Label><Input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} /></div>
                <div className="space-y-2"><Label>Closes at</Label><Input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" /></div>
            <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Stages available in this cycle</legend>
                <div className="divide-y divide-border/60 rounded-md border border-border/70">
                    {(curriculum?.stages || []).map((stage) => (
                        <div key={stage.id} className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_9rem] items-center gap-3 px-3 py-2">
                            <input aria-label={`Offer ${stage.name}`} type="checkbox" checked={selectedStageIds.includes(stage.id)} onChange={(event) => setSelectedStageIds((current) => event.target.checked ? [...current, stage.id] : current.filter((id) => id !== stage.id))} className="h-4 w-4 accent-primary" />
                            <span className="min-w-0"><span className="block truncate text-sm font-bold">{stage.name}</span><span className="block text-xs text-muted-foreground">{stage.code} - {stage.courseRequirements.length} requirements</span></span>
                            {offering ? <CustomSelect value={stageStatuses[stage.id] || ProgramStageOfferingStatus.PLANNED} onChange={(value) => setStageStatuses((current) => ({ ...current, [stage.id]: value }))} disabled={!selectedStageIds.includes(stage.id)} options={programStageOfferingStatusOptions(offering.stageOfferings.find((item) => item.programStageId === stage.id)?.status || ProgramStageOfferingStatus.PLANNED)} /> : <span className="text-xs font-bold text-muted-foreground">PLANNED</span>}
                        </div>
                    ))}
                </div>
            </fieldset>
            <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional internal notes" /></div>
        </ModalForm>
    );
}
