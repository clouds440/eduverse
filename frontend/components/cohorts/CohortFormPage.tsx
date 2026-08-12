'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { CalendarRange, Hash, Save, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { formatSectionWithComponentType } from '@/lib/sectionRelationships';
import { AcademicCycle, Cohort, CohortOfferingStatus, CohortSectionExpansionPreview, PaginatedResponse, ProgramDeliveryOption, Role, Section, Student } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionExpansionPreviewSummary } from '@/components/sections/SectionExpansionPreviewSummary';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { PageHeader } from '@/components/ui/PageShell';

type CohortFormMode = 'create' | 'edit';

interface CohortFormPageProps {
    mode: CohortFormMode;
    cohort?: Cohort;
    returnTo?: string;
}

function Introduction({ title, description }: { title: string; description: string }) {
    return <div className="mb-3 px-1"><h2 className="text-base font-black">{title}</h2><p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">{description}</p></div>;
}

export function CohortFormPage({ mode, cohort, returnTo }: CohortFormPageProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = mode === 'edit';
    const [name, setName] = useState(cohort?.name || '');
    const [code, setCode] = useState(cohort?.code || '');
    const [academicCycleId, setAcademicCycleId] = useState('');
    const [programStageOfferingId, setProgramStageOfferingId] = useState('');
    const [capacity, setCapacity] = useState('');
    const [studentIds, setStudentIds] = useState<string[]>([]);
    const [sectionIds, setSectionIds] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<CohortSectionExpansionPreview | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const processingId = isEdit ? 'cohort-update' : 'cohort-create';
    const resolvedReturnTo = returnTo || searchParams.get('returnTo') || undefined;

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) router.replace('/cohorts');
    }, [router, user]);

    const { data: cycles } = useSWR<PaginatedResponse<AcademicCycle>>(token ? ['academicCycles', { limit: 100 }] : null);
    const { data: students } = useSWR<PaginatedResponse<Student>>(token ? ['students', { limit: 1000 }] : null);
    const { data: sections } = useSWR<PaginatedResponse<Section>>(token ? ['sections', { limit: 1000 }] : null);
    const { data: stageOfferings = [] } = useSWR<ProgramDeliveryOption[]>(token && academicCycleId ? ['program-delivery-options', academicCycleId] : null, () => api.programs.getDeliveryOptions(token!, academicCycleId));
    const eligibleSections = useMemo(() => (sections?.data || []).filter((section) => section.academicCycleId === academicCycleId), [academicCycleId, sections?.data]);

    useEffect(() => {
        const cycleId = searchParams.get('academicCycleId');
        const stageOfferingId = searchParams.get('programStageOfferingId');
        if (cycleId) setAcademicCycleId(cycleId);
        if (stageOfferingId) setProgramStageOfferingId(stageOfferingId);
    }, [searchParams]);

    const changeCycle = (id: string) => {
        setAcademicCycleId(id);
        setProgramStageOfferingId('');
        setStudentIds([]);
        setSectionIds([]);
    };

    const offeringPayload = () => ({
        academicCycleId,
        programStageOfferingId: programStageOfferingId || undefined,
        status: CohortOfferingStatus.PLANNED,
        capacity: capacity ? Number(capacity) : undefined,
        studentIds,
        sectionIds,
    });

    const save = async () => {
        if (!token) return;
        if (!name.trim() || !code.trim()) {
            setError('Cohort name and code are required.');
            return;
        }
        dispatch({ type: 'UI_START_PROCESSING', payload: processingId });
        setError('');
        try {
            const saved = cohort
                ? await api.cohorts.updateCohort(cohort.id, { name, code }, token)
                : await api.cohorts.createCohort({ name, code }, token);
            if (academicCycleId) {
                await api.cohorts.createOffering(saved.id, offeringPayload(), token);
            }
            mutate(matchesCacheKeyPrefix('cohorts'));
            dispatch({ type: 'TOAST_ADD', payload: { message: cohort ? 'Cohort updated' : 'Cohort created', type: 'success' } });
            router.push(resolvedReturnTo || `/cohorts/${saved.id}`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to save cohort');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: processingId });
        }
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;
        if (!academicCycleId) {
            await save();
            return;
        }
        if (!name.trim() || !code.trim()) {
            setError('Cohort name and code are required.');
            return;
        }
        dispatch({ type: 'UI_START_PROCESSING', payload: processingId });
        setError('');
        try {
            const result = await api.cohorts.previewOffering(offeringPayload(), token, cohort?.id);
            setPreview(result);
            setConfirmOpen(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to preview cohort offering');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: processingId });
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl overflow-y-auto px-4 py-8">
            <PageHeader title={isEdit ? 'Edit Cohort' : 'Create Cohort'} description="Create a reusable student group, then optionally place it in an academic cycle." icon={Users} breadcrumbs={[{ label: 'Cohorts', href: '/cohorts' }, { label: isEdit ? 'Edit' : 'Create' }]} className="mb-7" />
            <form onSubmit={submit} className="space-y-8" noValidate>
                {error && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
                <section>
                    <Introduction title="Cohort identity" description="A cohort is a durable named group. Its identity does not belong to one cycle, program, section, or set of students." />
                    <div className="grid gap-5 rounded-lg border border-border/70 bg-card/75 p-5 md:grid-cols-2">
                        <div className="space-y-2"><Label>Cohort name</Label><Input icon={Users} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Computer Science 2026" /></div>
                        <div className="space-y-2"><Label>Cohort code</Label><Input icon={Hash} value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. CS-2026" /></div>
                    </div>
                </section>
                <section>
                    <Introduction title={cohort ? 'Add a cycle offering' : 'Initial cycle offering'} description="Optional. An offering places this cohort into one institute cycle. It may stand alone or target a specific program stage offering, and it owns the selected students and sections for that cycle." />
                    <div className="space-y-5 rounded-lg border border-border/70 bg-card/75 p-5">
                        <div className="space-y-2"><Label>Academic cycle</Label><CustomSelect icon={CalendarRange} value={academicCycleId} onChange={changeCycle} searchable options={[{ value: '', label: 'Do not create an offering yet' }, ...(cycles?.data || []).map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` }))]} /></div>
                        {academicCycleId && <>
                            <div className="space-y-2"><Label>Program stage offering</Label><CustomSelect value={programStageOfferingId} onChange={setProgramStageOfferingId} searchable options={[{ value: '', label: 'Standalone / no program' }, ...stageOfferings.map((offering) => ({ value: offering.id, label: `${offering.programOffering.program.code} - ${offering.programStage.name}` }))]} /></div>
                            <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" /></div>
                            <div className="space-y-2"><Label>Students</Label><CustomMultiSelect values={studentIds} onChange={setStudentIds} searchable options={(students?.data || []).map((student) => ({ value: student.id, label: `${student.user.name || student.user.email}${student.academicIdentity?.label ? ` - ${student.academicIdentity.label}` : student.registrationNumber ? ` - ${student.registrationNumber}` : ''}` }))} placeholder="Select students" /></div>
                            <div className="space-y-2"><Label>Sections in this cycle</Label><CustomMultiSelect values={sectionIds} onChange={setSectionIds} searchable options={eligibleSections.map((section) => ({ value: section.id, label: formatSectionWithComponentType(section) }))} placeholder="Select sections" /><p className="text-xs font-semibold text-muted-foreground">If a selected section belongs to a result relationship, EduVerse also adds the related sections and enrolls cohort students into them.</p></div>
                        </>}
                    </div>
                </section>
                <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => router.push(resolvedReturnTo || (cohort ? `/cohorts/${cohort.id}` : '/cohorts'))}>Cancel</Button><Button type="submit" icon={Save} loadingId={processingId}>{academicCycleId ? 'Preview and save' : isEdit ? 'Save cohort' : 'Create cohort'}</Button></div>
            </form>
            <ConfirmDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={save}
                title="Confirm Cohort Offering"
                description={(
                    <span className="block space-y-3 text-sm">
                        <span className="block">This will create the cohort offering and apply related-section expansion before enrolling students.</span>
                        <SectionExpansionPreviewSummary preview={preview} mode="cohort-create" />
                    </span>
                )}
                confirmText="Create Offering"
                loadingId={processingId}
            />
        </div>
    );
}
