'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Archive, CheckCircle2, GraduationCap, Pause, Pencil, Play, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { CurriculumStatus, Program, ProgramStatus, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Loading } from '@/components/ui/Loading';
import { ModalForm } from '@/components/ui/ModalForm';
import { PageHeader, PageShell } from '@/components/ui/PageShell';

export default function ProgramDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { data: program, isLoading, error, mutate } = useSWR<Program>(token ? ['program', id] : null, () => api.programs.getProgram(id, token!));
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archiveReason, setArchiveReason] = useState('');
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    if (isLoading || !program) return <Loading className="h-full" text="Loading program..." />;
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
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
                    {curriculum?.status === CurriculumStatus.DRAFT && <Button variant="secondary" icon={ShieldCheck} onClick={activateCurriculum}>Activate curriculum</Button>}
                    {(program.status === ProgramStatus.DRAFT || program.status === ProgramStatus.PAUSED) && curriculum?.status === CurriculumStatus.ACTIVE && <Button icon={Play} onClick={() => transition(ProgramStatus.ACTIVE)}>Activate</Button>}
                    {program.status === ProgramStatus.ACTIVE && <Button variant="warning" icon={Pause} onClick={() => transition(ProgramStatus.PAUSED)}>Pause</Button>}
                    {program.status !== ProgramStatus.ARCHIVED && <Button variant="danger" icon={Archive} onClick={() => setArchiveOpen(true)}>Archive</Button>}
                </div> : undefined}
            />

            <div className="grid gap-4 md:grid-cols-4">
                {[['Required cycles', program.requiredCycleCount], ['Curricula', program._count?.curriculumVersions || 0], ['Students', program._count?.studentEnrollments || 0], ['Admissions', program.isVisibleForAdmissions ? 'Visible' : 'Hidden']].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border border-border/70 bg-card/65 px-4 py-3"><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>
                ))}
            </div>

            <section className="border-t border-border/70 pt-5">
                <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><h2 className="text-base font-black">Ordered cycle plan</h2></div>
                <div className="divide-y divide-border/60 rounded-md border border-border/70 bg-card/45">
                    {program.academicCycles.filter((item) => item.status === 'ACTIVE').map((association) => {
                        const stage = curriculum?.stages.find((item) => item.programAcademicCycleId === association.id);
                        return <div key={association.id} className="grid gap-3 px-4 py-3 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                            <span className="text-sm font-black tabular-nums">{association.sequence}</span>
                            <div><p className="text-sm font-black">{association.academicCycle.name}</p><p className="text-xs text-muted-foreground">{association.academicCycle.code}</p></div>
                            <div><p className="text-sm font-bold">{stage?.name || 'Stage not configured'}</p><p className="text-xs text-muted-foreground">{stage?.courseRequirements.length || 0} requirements</p></div>
                            <Badge variant="neutral" size="sm">{association.academicCycle.status}</Badge>
                        </div>;
                    })}
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
        </PageShell>
    );
}
