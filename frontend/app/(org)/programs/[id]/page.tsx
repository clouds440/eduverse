'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Archive, CalendarRange, CheckCircle2, GraduationCap, Pause, Pencil, Play, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { CurriculumStatus, Program, ProgramOffering, ProgramOfferingReadiness, ProgramStatus, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Loading } from '@/components/ui/Loading';
import { ModalForm } from '@/components/ui/ModalForm';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { ProgramOfferingModal } from '@/components/programs/ProgramOfferingModal';

export default function ProgramDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { data: program, isLoading, error, mutate } = useSWR<Program>(token ? ['program', id] : null, () => api.programs.getProgram(id, token!));
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [offeringOpen, setOfferingOpen] = useState(false);
    const [offeringToEdit, setOfferingToEdit] = useState<ProgramOffering | null>(null);
    const [archiveReason, setArchiveReason] = useState('');
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    if (isLoading || !program) return <Loading className="h-full" text="Loading program..." />;
    const currentRevisionId = program.configurationRevisions?.[0]?.id;
    const curriculum = program.curriculumVersions?.find((item) => item.programConfigurationRevisionId === currentRevisionId) || program.curriculumVersions?.[0];

    const transition = async (status: ProgramStatus, reason?: string) => {
        if (!token) return;
        try {
            await api.programs.transitionProgram(program.id, status, token, reason);
            dispatch({ type: 'TOAST_ADD', payload: { message: `Program changed to ${status.replaceAll('_', ' ').toLowerCase()}`, type: 'success' } });
            setArchiveOpen(false);
            await mutate();
        } catch (err) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : 'Unable to change program status', type: 'error' } });
        }
    };

    const activateCurriculum = async () => {
        if (!token || !curriculum) return;
        try {
            await api.programs.transitionCurriculum(curriculum.id, CurriculumStatus.ACTIVE, token, true);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Curriculum activated', type: 'success' } });
            await mutate();
        } catch (err) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : 'Unable to activate curriculum', type: 'error' } });
        }
    };

    return (
        <PageShell>
            <PageHeader
                title={program.name}
                description={`${program.department.code} - ${program.department.name}`}
                icon={GraduationCap}
                breadcrumbs={[{ label: 'Programs', href: '/programs' }, { label: program.code }]}
                meta={<div className="flex flex-wrap gap-2"><Badge variant="primary" size="sm">{program.code}</Badge><Badge variant={program.status === ProgramStatus.ACTIVE ? 'success' : 'neutral'} size="sm">{program.status.replaceAll('_', ' ')}</Badge><Badge variant="neutral" size="sm">Revision {program.configurationVersion}</Badge></div>}
                actions={canManage ? <div className="flex flex-wrap gap-2">
                    {[ProgramStatus.DRAFT, ProgramStatus.PAUSED].includes(program.status) && <Link href={`/programs/${program.id}/edit`}><Button variant="secondary" icon={Pencil}>Edit</Button></Link>}
                    {program.status !== ProgramStatus.ARCHIVED && curriculum && <Button variant="secondary" icon={Plus} onClick={() => { setOfferingToEdit(null); setOfferingOpen(true); }}>New offering</Button>}
                    {curriculum?.status === CurriculumStatus.DRAFT && <Button variant="secondary" icon={ShieldCheck} onClick={activateCurriculum}>Activate curriculum</Button>}
                    {(program.status === ProgramStatus.DRAFT || program.status === ProgramStatus.PAUSED) && curriculum?.status === CurriculumStatus.ACTIVE && <Button icon={Play} onClick={() => transition(ProgramStatus.ACTIVE)}>Activate</Button>}
                    {program.status === ProgramStatus.ACTIVE && <Button variant="warning" icon={Pause} onClick={() => transition(ProgramStatus.PAUSED)}>Pause</Button>}
                    {program.status !== ProgramStatus.ARCHIVED && <Button variant="danger" icon={Archive} onClick={() => setArchiveOpen(true)}>Archive</Button>}
                </div> : undefined}
            />

            <div className="grid gap-4 md:grid-cols-4">
                {[['Stages', curriculum?.stages.length || 0], ['Offerings', program._count?.offerings || 0], ['Students', program._count?.studentEnrollments || 0], ['Admissions', program.isVisibleForAdmissions ? 'Visible' : 'Hidden']].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border border-border/70 bg-card/65 px-4 py-3"><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>
                ))}
            </div>

            <section className="border-t border-border/70 pt-5">
                <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><h2 className="text-base font-black">Ordered stage plan</h2></div>
                <div className="divide-y divide-border/60 rounded-md border border-border/70 bg-card/45">
                    {(curriculum?.stages || []).map((stage) => <div key={stage.id} className="grid gap-3 px-4 py-3 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                        <span className="text-sm font-black tabular-nums">{stage.sequence}</span>
                        <div><p className="text-sm font-black">{stage.name}</p><p className="text-xs text-muted-foreground">{stage.code}</p></div>
                        <p className="text-sm font-semibold text-muted-foreground">{stage.courseRequirements.length} course requirements</p>
                        {stage.isOptional && <Badge variant="neutral" size="sm">Optional</Badge>}
                    </div>)}
                    {!curriculum?.stages.length && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No stages configured.</p>}
                </div>
            </section>

            <section className="border-t border-border/70 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-primary" /><h2 className="text-base font-black">Academic cycle offerings</h2></div>{canManage && program.status !== ProgramStatus.ARCHIVED && <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setOfferingToEdit(null); setOfferingOpen(true); }}>Add</Button>}</div>
                <div className="divide-y divide-border/60 rounded-md border border-border/70 bg-card/45">
                    {(program.offerings || []).map((offering) => <OfferingRow key={offering.id} offering={offering} token={token!} canManage={canManage} onEdit={() => { setOfferingToEdit(offering); setOfferingOpen(true); }} />)}
                    {!program.offerings?.length && <p className="px-4 py-6 text-center text-sm text-muted-foreground">This program has not been offered in an academic cycle yet.</p>}
                </div>
            </section>

            <section className="border-t border-border/70 pt-5">
                <h2 className="mb-3 text-base font-black">Curricula</h2>
                <div className="divide-y divide-border/60 rounded-md border border-border/70 bg-card/45">
                    {(program.curriculumVersions || []).map((item) => <div key={item.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-black">{item.name}</p><p className="text-xs text-muted-foreground">{item.code} · {item.stages.length} stages</p></div><div className="flex gap-2"><Badge variant={item.status === CurriculumStatus.ACTIVE ? 'success' : 'neutral'} size="sm">{item.status}</Badge>{item.isDefaultForAdmissions && <Badge variant="primary" size="sm">Admissions</Badge>}</div></div>)}
                </div>
            </section>

            <ModalForm
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title="Archive Program"
                submitText="Archive"
                onSubmit={(event: FormEvent) => { event.preventDefault(); transition(ProgramStatus.ARCHIVED, archiveReason); }}
            >
                <div className="space-y-2"><Label>Reason</Label><Input required value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></div>
            </ModalForm>
            <ProgramOfferingModal isOpen={offeringOpen} program={program} offering={offeringToEdit} onClose={() => { setOfferingOpen(false); setOfferingToEdit(null); }} onSaved={async () => { await mutate(); }} />
        </PageShell>
    );
}

function OfferingRow({ offering, token, canManage, onEdit }: { offering: ProgramOffering; token: string; canManage: boolean; onEdit: () => void }) {
    const { data: readiness } = useSWR<ProgramOfferingReadiness>(['program-offering-readiness', offering.id], () => api.programOfferings.readiness(offering.id, token));
    return <div className="space-y-3 px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center">
            <div><p className="text-sm font-black">{offering.academicCycle.name}</p><p className="text-xs text-muted-foreground">{offering.academicCycle.code}</p></div>
            <p className="text-sm font-semibold text-muted-foreground">{offering.stageOfferings.length} stage {offering.stageOfferings.length === 1 ? 'offering' : 'offerings'}</p>
            <div className="flex flex-wrap gap-2"><Badge variant={offering.status === 'OPEN' ? 'success' : 'neutral'} size="sm">{offering.status}</Badge>{readiness && <Badge variant={readiness.readyForDelivery ? 'success' : readiness.readyForAdmissions ? 'warning' : 'error'} size="sm">{readiness.readyForDelivery ? 'Delivery ready' : readiness.readyForAdmissions ? 'Admissions ready' : `${readiness.blockers.length} blockers`}</Badge>}</div>
            {canManage && <Button size="icon" variant="ghost" icon={Pencil} title="Edit offering" onClick={onEdit} />}
        </div>
        {offering.stageOfferings.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
                {offering.stageOfferings.map((stage) => (
                    <div key={stage.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/15 px-3 py-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black">{stage.programStage.name}</p>
                            <p className="truncate text-xs font-semibold text-muted-foreground">{stage.programStage.code} - {stage.status}</p>
                        </div>
                        {canManage && (
                            <Link href={`/cohorts/create?academicCycleId=${offering.academicCycleId}&programStageOfferingId=${stage.id}&returnTo=${encodeURIComponent(`/programs/${offering.programId}`)}`}>
                                <Button size="sm" variant="secondary" icon={Plus}>Add cohort</Button>
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        )}
    </div>;
}
