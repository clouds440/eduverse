'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
    ProgramOfferingAction,
    ProgramOfferingAttendanceMode,
    ProgramOfferingDeliveryMode,
    ProgramOfferingStatus,
    ProviderLocation,
    ProgramStageOfferingStatus,
} from '@/types';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
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
    const [code, setCode] = useState('');
    const [intakeName, setIntakeName] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [deliveryMode, setDeliveryMode] = useState(ProgramOfferingDeliveryMode.ON_CAMPUS);
    const [attendanceMode, setAttendanceMode] = useState(ProgramOfferingAttendanceMode.FULL_TIME);
    const [capacity, setCapacity] = useState('');
    const [waitlistEnabled, setWaitlistEnabled] = useState(false);
    const [scheduleSummary, setScheduleSummary] = useState('');
    const [publicSummary, setPublicSummary] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationLabel, setNewLocationLabel] = useState('');
    const [notes, setNotes] = useState('');
    const [opensAt, setOpensAt] = useState('');
    const [closesAt, setClosesAt] = useState('');
    const [teachingStartsAt, setTeachingStartsAt] = useState('');
    const [teachingEndsAt, setTeachingEndsAt] = useState('');
    const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
    const [stageStatuses, setStageStatuses] = useState<Record<string, ProgramStageOfferingStatus>>({});
    const [error, setError] = useState('');
    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(
        token && isOpen ? ['academic-cycles', { limit: 100 }] : null,
        () => api.academicCycles.getCycles(token!, { limit: 100 }),
    );
    const { data: providerLocations = [], mutate: mutateLocations } = useSWR<ProviderLocation[]>(
        token && isOpen ? ['program-offering-provider-locations', token] : null,
        () => api.programOfferings.listProviderLocations(token!),
    );
    const curriculum = curricula.find((item) => item.id === curriculumVersionId);

    useEffect(() => {
        if (!isOpen) return;
        const initial = offering?.campusBinding?.curriculumVersion || offering?.curriculumVersion
            || curricula.find((item) => item.isDefaultForAdmissions)
            || curricula.find((item) => item.status === CurriculumStatus.ACTIVE)
            || curricula[0];
        setCurriculumVersionId(initial?.id || '');
        setSelectedStageIds(offering ? offering.stageOfferings.map((stage) => stage.programStageId) : (initial?.stages || []).map((stage) => stage.id));
        setStageStatuses(Object.fromEntries((offering?.stageOfferings || []).map((stage) => [stage.programStageId, stage.status])));
        setAcademicCycleId(offering?.campusBinding?.academicCycleId || offering?.academicCycle?.id || '');
        setStatus(offering?.status || ProgramOfferingStatus.DRAFT);
        setCode(offering?.code || `${program.code}-${new Date().getFullYear()}`);
        setIntakeName(offering?.intakeName || '');
        setTimezone(offering?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        setDeliveryMode(offering?.deliveryMode || ProgramOfferingDeliveryMode.ON_CAMPUS);
        setAttendanceMode(offering?.attendanceMode || ProgramOfferingAttendanceMode.FULL_TIME);
        setCapacity(offering?.capacity ? String(offering.capacity) : '');
        setWaitlistEnabled(Boolean(offering?.waitlistEnabled));
        setScheduleSummary(offering?.scheduleSummary || '');
        setPublicSummary(offering?.publicSummary || '');
        setContactEmail(offering?.contactEmail || '');
        setSelectedLocationIds(offering?.locations?.map((location) => location.providerLocationId) || []);
        setNewLocationName('');
        setNewLocationLabel('');
        setNotes(offering?.notes || '');
        setOpensAt(localDateTime(offering?.applicationOpensAt));
        setClosesAt(localDateTime(offering?.applicationClosesAt));
        setTeachingStartsAt(localDateTime(offering?.teachingStartsAt));
        setTeachingEndsAt(localDateTime(offering?.teachingEndsAt));
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
        if (!code.trim() || !intakeName.trim() || !timezone.trim() || !curriculumVersionId || !academicCycleId || selectedStageIds.length === 0) {
            setError('Code, intake, timezone, curriculum, academic cycle, and at least one stage are required.');
            return;
        }
        dispatch({ type: 'UI_START_PROCESSING', payload: 'program-offering-save' });
        setError('');
        try {
            const mutable = {
                status: offering ? status : ProgramOfferingStatus.DRAFT,
                intakeName: intakeName.trim(),
                timezone: timezone.trim(),
                deliveryMode,
                attendanceMode,
                supportedActions: [ProgramOfferingAction.APPLY],
                applicationOpensAt: opensAt ? new Date(opensAt).toISOString() : offering ? null : undefined,
                applicationClosesAt: closesAt ? new Date(closesAt).toISOString() : offering ? null : undefined,
                teachingStartsAt: teachingStartsAt ? new Date(teachingStartsAt).toISOString() : offering ? null : undefined,
                teachingEndsAt: teachingEndsAt ? new Date(teachingEndsAt).toISOString() : offering ? null : undefined,
                capacity: capacity ? Number(capacity) : undefined,
                waitlistEnabled,
                scheduleSummary: scheduleSummary || null,
                publicSummary: publicSummary || null,
                contactEmail: contactEmail || null,
                locationIds: selectedLocationIds,
                notes: notes || undefined,
                stages: selectedStageIds.map((programStageId) => ({
                    programStageId,
                    status: offering ? (stageStatuses[programStageId] || ProgramStageOfferingStatus.PLANNED) : ProgramStageOfferingStatus.PLANNED,
                })),
            };
            if (offering) {
                await api.programOfferings.update(offering.id, mutable, token);
            } else {
                const { stages, ...generic } = mutable;
                await api.programOfferings.create({
                    programId: program.id,
                    code: code.trim(),
                    ...generic,
                    campusBinding: {
                        curriculumVersionId,
                        academicCycleId,
                        stages,
                    },
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

    const addLocation = async () => {
        if (!token || !newLocationName.trim() || !newLocationLabel.trim()) return;
        try {
            const location = await api.programOfferings.createProviderLocation({
                name: newLocationName.trim(),
                displayLabel: newLocationLabel.trim(),
            }, token);
            await mutateLocations((current = []) => [...current, location], { revalidate: false });
            setSelectedLocationIds((current) => [...new Set([...current, location.id])]);
            setNewLocationName('');
            setNewLocationLabel('');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to create location');
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
            <div className="rounded-md border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium text-muted-foreground">Offering details describe this intake publicly. The Campus binding below connects it to the curriculum and academic cycle used for delivery.</div>
            {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Offering code</Label><Input value={code} onChange={(event) => setCode(event.target.value)} disabled={Boolean(offering)} /></div>
                <div className="space-y-2"><Label>Intake name</Label><Input value={intakeName} onChange={(event) => setIntakeName(event.target.value)} placeholder="Fall 2026" /></div>
                <div className="space-y-2"><Label>Delivery mode</Label><CustomSelect value={deliveryMode} onChange={(value) => setDeliveryMode(value as ProgramOfferingDeliveryMode)} options={Object.values(ProgramOfferingDeliveryMode).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></div>
                <div className="space-y-2"><Label>Attendance mode</Label><CustomSelect value={attendanceMode} onChange={(value) => setAttendanceMode(value as ProgramOfferingAttendanceMode)} options={Object.values(ProgramOfferingAttendanceMode).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></div>
                <div className="space-y-2"><Label>Timezone</Label><Input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Karachi" /></div>
                <div className="space-y-2"><Label>Contact email</Label><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Public summary</Label><Textarea rows={3} value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} /></div>
            <div className="space-y-2"><Label>Schedule summary</Label><Textarea rows={2} value={scheduleSummary} onChange={(event) => setScheduleSummary(event.target.value)} placeholder="Weekdays, 9:00 AM to 1:00 PM" /></div>
            {deliveryMode !== ProgramOfferingDeliveryMode.ONLINE && (
                <div className="space-y-3">
                    <Label>Teaching locations</Label>
                    <CustomMultiSelect values={selectedLocationIds} onChange={setSelectedLocationIds} options={providerLocations.map((location) => ({ value: location.id, label: location.name, description: location.displayLabel }))} placeholder="Select one or more locations" />
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                        <Input value={newLocationName} onChange={(event) => setNewLocationName(event.target.value)} placeholder="Location name" />
                        <Input value={newLocationLabel} onChange={(event) => setNewLocationLabel(event.target.value)} placeholder="Full address or display label" />
                        <button type="button" onClick={addLocation} disabled={!newLocationName.trim() || !newLocationLabel.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary/30 px-3 text-sm font-bold text-primary disabled:opacity-50"><Plus className="h-4 w-4" />Add</button>
                    </div>
                </div>
            )}
            <div className="space-y-2"><Label>Curriculum</Label><CustomSelect value={curriculumVersionId} onChange={chooseCurriculum} disabled={Boolean(offering)} options={curricula.map((item) => ({ value: item.id, label: `${item.code} - ${item.name} (${item.status})` }))} placeholder="Select curriculum" /></div>
            <div className="space-y-2"><Label>Academic cycle</Label><CustomSelect value={academicCycleId} onChange={setAcademicCycleId} disabled={Boolean(offering)} searchable options={(cycles?.data || []).filter((cycle) => cycle.status === AcademicCycleStatus.DRAFT || cycle.status === AcademicCycleStatus.ACTIVE).map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` }))} placeholder="Select institute cycle" /></div>
            {offering && <div className="space-y-2"><Label>Offering status</Label><CustomSelect value={status} onChange={setStatus} options={programOfferingStatusOptions(offering.status)} /></div>}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Applications open</Label><Input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} /></div>
                <div className="space-y-2"><Label>Applications close</Label><Input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></div>
                <div className="space-y-2"><Label>Teaching starts</Label><Input type="datetime-local" value={teachingStartsAt} onChange={(event) => setTeachingStartsAt(event.target.value)} /></div>
                <div className="space-y-2"><Label>Teaching ends</Label><Input type="datetime-local" value={teachingEndsAt} onChange={(event) => setTeachingEndsAt(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" /></div>
            <Toggle checked={waitlistEnabled} onCheckedChange={setWaitlistEnabled} label="Enable waitlist" />
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
