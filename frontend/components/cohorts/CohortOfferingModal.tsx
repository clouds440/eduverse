'use client';

import { FormEvent, useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { formatSectionWithComponentType } from '@/lib/sectionRelationships';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { CohortOffering, CohortOfferingStatus, CohortSectionExpansionPreview, ProgramDeliveryOption, Section } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionExpansionPreviewSummary } from '@/components/sections/SectionExpansionPreviewSummary';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { cohortOfferingStatusOptions } from '@/lib/offeringLifecycle';

interface CohortOfferingModalProps {
    offering: CohortOffering | null;
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

export function CohortOfferingModal({ offering, onClose, onSaved }: CohortOfferingModalProps) {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [status, setStatus] = useState(CohortOfferingStatus.PLANNED);
    const [capacity, setCapacity] = useState('');
    const [programStageOfferingId, setProgramStageOfferingId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [sectionPreview, setSectionPreview] = useState<CohortSectionExpansionPreview | null>(null);
    const [sectionConfirmOpen, setSectionConfirmOpen] = useState(false);
    const [error, setError] = useState('');
    const { data: deliveryOptions = [] } = useSWR<ProgramDeliveryOption[]>(
        token && offering ? ['program-delivery-options', offering.academicCycleId] : null,
        () => api.programs.getDeliveryOptions(token!, offering!.academicCycleId),
    );
    const { data: sections } = useSWR<{ data: Section[] }>(
        token && offering ? ['sections', { academicCycleId: offering.academicCycleId, limit: 1000 }] as const : null,
    );

    useEffect(() => {
        if (!offering) return;
        setStatus(offering.status);
        setCapacity(offering.capacity ? String(offering.capacity) : '');
        setProgramStageOfferingId(offering.programStageOfferingId || '');
        setSectionId('');
        setSectionPreview(null);
        setSectionConfirmOpen(false);
        setError('');
    }, [offering]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token || !offering) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'cohort-offering-save' });
        setError('');
        try {
            await api.cohorts.updateOffering(offering.id, {
                status,
                capacity: capacity ? Number(capacity) : undefined,
                programStageOfferingId: programStageOfferingId || null,
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort offering updated', type: 'success' } });
            await onSaved();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to update cohort offering');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cohort-offering-save' });
        }
    };

    const previewSectionAssignment = async () => {
        if (!token || !offering || !sectionId) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'cohort-section-assign' });
        setError('');
        try {
            const result = await api.cohorts.previewAssignSection(offering.id, sectionId, token, { isDefault: true });
            setSectionPreview(result);
            setSectionConfirmOpen(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to preview section assignment');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cohort-section-assign' });
        }
    };

    const assignSection = async () => {
        if (!token || !offering || !sectionId) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'cohort-section-assign' });
        setError('');
        try {
            await api.cohorts.assignSection(offering.id, sectionId, token, { isDefault: true });
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section assigned to cohort offering', type: 'success' } });
            setSectionId('');
            setSectionConfirmOpen(false);
            await onSaved();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to assign section');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'cohort-section-assign' });
        }
    };

    return <>
    <ModalForm isOpen={Boolean(offering)} onClose={onClose} title="Edit Cohort Offering" submitText="Save offering" loadingId="cohort-offering-save" onSubmit={submit}>
        <div className="rounded-md border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium text-muted-foreground">Changes apply only to this cohort placement in {offering?.academicCycle.name}. The durable cohort remains unchanged.</div>
        {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
        <div className="space-y-2"><Label>Status</Label><CustomSelect value={status} onChange={setStatus} options={offering ? cohortOfferingStatusOptions(offering.status) : []} /></div>
        <div className="space-y-2"><Label>Program stage offering</Label><CustomSelect searchable value={programStageOfferingId} onChange={setProgramStageOfferingId} options={[{ value: '', label: 'Standalone / no program' }, ...deliveryOptions.map((option) => ({ value: option.id, label: `${option.programOffering.program.code} - ${option.programStage.name}` }))]} /></div>
        <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" /></div>
        <div className="space-y-3 rounded-md border border-border/70 p-3">
            <div><p className="text-sm font-black">Add default section</p><p className="mt-1 text-xs font-semibold text-muted-foreground">Related sections are included automatically after preview.</p></div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <CustomSelect
                    searchable
                    value={sectionId}
                    onChange={setSectionId}
                    options={(sections?.data || [])
                        .filter((section) => !offering?.sections?.some((assignment) => assignment.sectionId === section.id))
                        .map((section) => ({ value: section.id, label: formatSectionWithComponentType(section) }))}
                    placeholder="Select section"
                />
                <Button type="button" variant="secondary" onClick={previewSectionAssignment} loadingId="cohort-section-assign" disabled={!sectionId}>Preview</Button>
            </div>
        </div>
    </ModalForm>
    <ConfirmDialog
        isOpen={sectionConfirmOpen}
        onClose={() => setSectionConfirmOpen(false)}
        onConfirm={assignSection}
        title="Confirm Section Assignment"
        description={(
            <span className="block space-y-3 text-sm">
                <span className="block">This will assign the selected section and any related sections to the cohort offering.</span>
                <SectionExpansionPreviewSummary preview={sectionPreview} mode="cohort-assign" />
            </span>
        )}
        confirmText="Assign Sections"
        loadingId="cohort-section-assign"
    />
    </>;
}
