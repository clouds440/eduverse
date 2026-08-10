'use client';

import { FormEvent, useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { CohortOffering, CohortOfferingStatus, ProgramDeliveryOption } from '@/types';
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
    const [error, setError] = useState('');
    const { data: deliveryOptions = [] } = useSWR<ProgramDeliveryOption[]>(
        token && offering ? ['program-delivery-options', offering.academicCycleId] : null,
        () => api.programs.getDeliveryOptions(token!, offering!.academicCycleId),
    );

    useEffect(() => {
        if (!offering) return;
        setStatus(offering.status);
        setCapacity(offering.capacity ? String(offering.capacity) : '');
        setProgramStageOfferingId(offering.programStageOfferingId || '');
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

    return <ModalForm isOpen={Boolean(offering)} onClose={onClose} title="Edit Cohort Offering" submitText="Save offering" loadingId="cohort-offering-save" onSubmit={submit}>
        <div className="rounded-md border border-border/70 bg-muted/25 px-4 py-3 text-sm font-medium text-muted-foreground">Changes apply only to this cohort placement in {offering?.academicCycle.name}. The durable cohort remains unchanged.</div>
        {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
        <div className="space-y-2"><Label>Status</Label><CustomSelect value={status} onChange={setStatus} options={offering ? cohortOfferingStatusOptions(offering.status) : []} /></div>
        <div className="space-y-2"><Label>Program stage offering</Label><CustomSelect searchable value={programStageOfferingId} onChange={setProgramStageOfferingId} options={[{ value: '', label: 'Standalone / no program' }, ...deliveryOptions.map((option) => ({ value: option.id, label: `${option.programOffering.program.code} - ${option.programStage.name}` }))]} /></div>
        <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" /></div>
    </ModalForm>;
}
