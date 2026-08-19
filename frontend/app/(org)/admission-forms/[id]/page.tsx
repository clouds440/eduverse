'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ClipboardList, CopyPlus, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Role, type AdmissionApplicationTemplate, type ProgramOffering } from '@/types';
import { AdmissionFormEditor } from '@/components/admissions/AdmissionFormEditor';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';

export default function AdmissionFormDetailPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const params = useParams<{ id: string }>();
    const id = decodeURIComponent(params.id);
    const { data, error, isLoading, mutate } = useSWR<AdmissionApplicationTemplate>(token ? ['admission-form', id] : null, () => api.admissionForms.get(id, token!));
    const { data: offerings = [], mutate: mutateOfferings } = useSWR<ProgramOffering[]>(token ? 'admission-form-offerings' : null, () => api.programOfferings.list(token!));
    const published = useMemo(() => data?.versions.filter((version) => version.status === 'PUBLISHED') || [], [data]);
    const [offeringId, setOfferingId] = useState('');
    const [versionId, setVersionId] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [instructions, setInstructions] = useState('');
    const [actionError, setActionError] = useState('');
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const createVersion = async () => {
        if (!token || !data) return;
        setActionError('');
        try { await api.admissionForms.createVersion(data.id, token); await mutate(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not create draft version'); }
    };
    const bind = async () => {
        if (!token || !offeringId || !(versionId || published[0]?.id)) return;
        setActionError('');
        try {
            await api.admissionForms.bindOffering(offeringId, { applicationVersionId: versionId || published[0].id, onlineAdmissionEnabled: enabled, onlineAdmissionInstructions: instructions || undefined }, token);
            dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: 'Admission form assigned to offering' } });
            await mutateOfferings();
        } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not assign admission form'); }
    };

    return <PageShell className="overflow-y-auto custom-scrollbar">
        <PageHeader title={data?.name || 'Admission Form'} description={data?.description || 'Manage application fields, documents, and published versions.'} icon={ClipboardList} breadcrumbs={[{ label: 'Admission Forms', href: '/admission-forms' }, { label: data?.name || 'Form' }]} actions={canManage && data && !data.versions.some((version) => version.status === 'DRAFT') ? <Button icon={CopyPlus} variant="secondary" onClick={createVersion}>New draft version</Button> : undefined} />
        <div className="space-y-5 p-1">
            {actionError && <StatusBanner title="Action failed" description={actionError} variant="danger" />}
            {isLoading ? <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div> : error ? <ErrorState error={error} title="Admission form could not be loaded" /> : data ? <AdmissionFormEditor key={`${data.id}-${data.versions[0]?.id}`} template={data} /> : null}
            {canManage && data && <section className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                <div><h2 className="font-black">Assign to offering</h2><p className="text-sm font-semibold text-muted-foreground">Online admissions are enabled here, separately from program creation.</p></div>
                {!published.length ? <StatusBanner title="Publish a version first" description="Only immutable published versions can accept applications." variant="warning" /> : <div className="grid gap-3 md:grid-cols-2">
                    <CustomSelect searchable value={offeringId} onChange={(value) => { setOfferingId(value); const offering = offerings.find((item) => item.id === value); setEnabled(offering?.onlineAdmissionEnabled ?? true); setInstructions(offering?.onlineAdmissionInstructions || ''); }} options={offerings.map((offering) => ({ value: offering.id, label: `${offering.program.code} - ${offering.intakeName}`, description: offering.code }))} placeholder="Select program offering" />
                    <CustomSelect value={versionId || published[0]?.id || ''} onChange={setVersionId} options={published.map((version) => ({ value: version.id, label: `Version ${version.version}` }))} />
                    <Textarea className="md:col-span-2" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Applicant-facing instructions for this offering" />
                    <Toggle checked={enabled} onCheckedChange={setEnabled} label="Accept online applications" />
                    <div className="flex justify-end"><Button icon={Link2} disabled={!offeringId} onClick={bind}>Assign form</Button></div>
                </div>}
            </section>}
        </div>
    </PageShell>;
}
