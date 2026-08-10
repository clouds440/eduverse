'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { BookOpen, CalendarRange, Pencil, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Cohort, CohortOffering, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { BrandIcon } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, PageTabs } from '@/components/ui/PageShell';
import { CohortOfferingModal } from '@/components/cohorts/CohortOfferingModal';

type CohortTab = 'students' | 'sections';

export default function CohortDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { token, user } = useAuth();
    const { data: cohort, isLoading, error, mutate } = useSWR<Cohort>(token ? ['cohort', id] : null, () => api.cohorts.getCohort(id, token!));
    const [offeringId, setOfferingId] = useState('');
    const [tab, setTab] = useState<CohortTab>('students');
    const [offeringToEdit, setOfferingToEdit] = useState<CohortOffering | null>(null);
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    useEffect(() => {
        if (cohort?.offerings?.length && !cohort.offerings.some((item) => item.id === offeringId)) setOfferingId(cohort.offerings[0].id);
    }, [cohort?.offerings, offeringId]);
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    if (isLoading || !cohort) return <Loading className="h-full" text="Loading cohort..." />;
    const offering = cohort.offerings?.find((item) => item.id === offeringId);

    return (
        <PageShell className="overflow-y-auto">
            <PageHeader title={cohort.name} description="Durable cohort with cycle-specific offerings" icon={Users} breadcrumbs={[{ label: 'Cohorts', href: '/cohorts' }, { label: cohort.code }]} meta={<div className="flex gap-2"><Badge variant="primary" size="sm">{cohort.code}</Badge><Badge variant={cohort.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">{cohort.status}</Badge></div>} actions={canManage ? <Link href={`/cohorts/edit/${cohort.id}?returnTo=/cohorts/${cohort.id}`}><Button variant="secondary" icon={Pencil}>Edit or add offering</Button></Link> : undefined} />
            <section className="space-y-3 border-t border-border pt-5">
                <div><h2 className="text-base font-black">Cycle offering</h2><p className="mt-1 text-sm text-muted-foreground">Choose a cycle to inspect the students and sections assigned at that time.</p></div>
                {cohort.offerings?.length ? <CustomSelect icon={CalendarRange} value={offeringId} onChange={setOfferingId} options={cohort.offerings.map((item) => ({ value: item.id, label: `${item.academicCycle.code} - ${item.academicCycle.name}${item.programStageOffering ? ` · ${item.programStageOffering.programStage.name}` : ' · Standalone'}` }))} /> : <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No academic cycle offerings yet.</div>}
            </section>
            {offering && <OfferingView offering={offering} tab={tab} onTabChange={setTab} canManage={canManage} onEdit={() => setOfferingToEdit(offering)} />}
            <CohortOfferingModal offering={offeringToEdit} onClose={() => setOfferingToEdit(null)} onSaved={async () => { await mutate(); }} />
        </PageShell>
    );
}

function OfferingView({ offering, tab, onTabChange, canManage, onEdit }: { offering: CohortOffering; tab: CohortTab; onTabChange: (tab: CohortTab) => void; canManage: boolean; onEdit: () => void }) {
    const memberships = offering.memberships || [];
    const sections = offering.sections || [];
    return <div className="space-y-4">
        {canManage && <div className="flex justify-end"><Button size="sm" variant="secondary" icon={Pencil} onClick={onEdit}>Edit cycle offering</Button></div>}
        <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/70 p-3"><p className="text-xs font-bold text-muted-foreground">Delivery</p><p className="mt-1 text-sm font-black">{offering.programStageOffering ? `${offering.programStageOffering.programOffering.program.code} · ${offering.programStageOffering.programStage.name}` : 'Standalone'}</p></div>
            <div className="rounded-md border border-border/70 p-3"><p className="text-xs font-bold text-muted-foreground">Students</p><p className="mt-1 text-lg font-black">{offering._count?.memberships || memberships.length}</p></div>
            <div className="rounded-md border border-border/70 p-3"><p className="text-xs font-bold text-muted-foreground">Sections</p><p className="mt-1 text-lg font-black">{offering._count?.sections || sections.length}</p></div>
        </div>
        <PageTabs ariaLabel="Cohort offering records" activeValue={tab} onValueChange={onTabChange} items={[{ value: 'students', label: 'Students', icon: Users, count: memberships.length }, { value: 'sections', label: 'Sections', icon: BookOpen, count: sections.length }]} />
        {tab === 'students' ? <div className="grid gap-3 md:grid-cols-2">{memberships.map((membership) => <Link key={membership.id} href={membership.student?.user?.id ? `/profiles/${membership.student.user.id}` : '#'} className="flex items-center gap-3 rounded-md border border-border/70 p-3"><BrandIcon variant="user" size="sm" user={membership.student?.user} /><div className="min-w-0"><p className="truncate text-sm font-black">{membership.student?.user?.name || membership.student?.user?.email || 'Student'}</p><p className="truncate text-xs text-muted-foreground">{membership.student?.registrationNumber || 'No registration number'}</p></div></Link>)}{!memberships.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No students in this offering.</p>}</div> : <div className="grid gap-3 md:grid-cols-2">{sections.map((assignment) => <Link key={assignment.id} href={`/sections/${assignment.section.id}`} className="rounded-md border border-border/70 p-3"><p className="text-sm font-black">{assignment.section.name}</p><p className="text-xs text-muted-foreground">{assignment.section.course?.code} · {assignment.section.code}</p></Link>)}{!sections.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No sections in this offering.</p>}</div>}
    </div>;
}
