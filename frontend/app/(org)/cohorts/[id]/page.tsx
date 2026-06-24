'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Cohort, Student, Section, Role } from '@/types';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { Users, BookOpen, Pencil } from 'lucide-react';
import { BrandIcon } from '@/components/ui/Brand';
import { Badge } from '@/components/ui/Badge';
import { PageHeader, PageShell, PageTabs } from '@/components/ui/PageShell';

const COHORT_TABS = [
    { value: 'students', label: 'Students', icon: Users },
    { value: 'sections', label: 'Sections', icon: BookOpen },
] as const;

type CohortTab = typeof COHORT_TABS[number]['value'];

export default function CohortDetailPage() {
    const { token, user } = useAuth();
    const { id } = useParams() as { id: string };
    const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const cohortKey = token ? ['cohort', id] as const : null;
    const { data: cohort, isLoading, error } = useSWR<Cohort>(cohortKey, async () => {
        if (!token) throw new Error('Authentication required');
        return api.cohorts.getCohort(id, token);
    });

    const [activeTab, setActiveTab] = useState<CohortTab>('students');

    if (!token || isLoading || !cohort) {
        return <Loading className="h-full" text="Loading Cohort Details..." />;
    }

    if (error) {
        return <ErrorState error={error} onRetry={() => mutate(cohortKey)} />;
    }

    return (
        <PageShell className="gap-0 overflow-y-auto">
            <PageHeader
                className="mb-0"
                title={cohort.name}
                description={cohort.academicCycle ? (cohort.academicCycle.code ? `${cohort.academicCycle.code} - ${cohort.academicCycle.name}` : cohort.academicCycle.name) : 'Academic cycle unavailable'}
                icon={Users}
                meta={(
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" size="sm">Cohort</Badge>
                        <Badge variant="primary" size="sm">{cohort.code}</Badge>
                    </div>
                )}
                actions={isAdmin ? (
                    <Link
                        href={`/cohorts/edit/${cohort.id}?returnTo=/cohorts/${cohort.id}`}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold leading-tight text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 text-center">
                            Edit Cohort
                        </span>
                    </Link>
                ) : undefined}
            />

            <PageTabs
                ariaLabel="Cohort navigation"
                items={COHORT_TABS.map((tab) => ({
                    ...tab,
                    count: tab.value === 'students' ? cohort._count?.students || 0 : cohort._count?.sections || 0,
                }))}
                activeValue={activeTab}
                onValueChange={setActiveTab}
                hideOnScroll
            />

            <div className="flex-1 bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-5 overflow-y-auto min-h-0">
                {activeTab === 'students' ? (
                    <CohortStudentsTab students={cohort.students || []} />
                ) : (
                    <CohortSectionsTab sections={cohort.sections || []} />
                )}
            </div>
        </PageShell>
    );
}

function CohortStudentsTab({ students }: { students: Student[] }) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Enrolled Students</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {students.map((s, index) => {
                    const card = (
                        <>
                            <BrandIcon variant="user" size="md" user={s.user} className="shadow-sm group-hover:scale-105 transition-transform" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground truncate">{s.user?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground font-medium truncate">{s.user?.email}</p>
                                {s.registrationNumber && (
                                    <p className="text-[10px] mt-1 font-mono bg-primary/10 text-primary w-fit px-1.5 py-0.5 rounded uppercase tracking-tighter font-bold">
                                        {s.registrationNumber}
                                    </p>
                                )}
                            </div>
                        </>
                    );
                    const className = "p-4 bg-muted/20 border border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl flex items-center gap-4 transition-all group shadow-sm";

                    return s.user?.id ? (
                        <Link key={`${s.id}-${index}`} href={`/profiles/${s.user.id}`} className={className}>
                            {card}
                        </Link>
                    ) : (
                        <div key={`${s.id}-${index}`} className={className}>
                            {card}
                        </div>
                    );
                })}
                {students.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                        <Users className="w-12 h-12 opacity-20 mb-3" />
                        <p className="font-medium">No students enrolled in this cohort yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function CohortSectionsTab({ sections }: { sections: Section[] }) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Assigned Sections</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sections.map((s, index) => (
                    <Link key={`${s.id}-${index}`} href={`/sections/${s.id}`} className="p-4 bg-muted/20 border border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl flex items-center gap-4 transition-all group shadow-sm">
                        <div className="bg-primary/10 p-3 rounded-xl group-hover:scale-105 transition-transform">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground font-medium truncate">{s.course?.name}</p>
                            <p className="text-[10px] mt-1 font-bold text-primary uppercase tracking-wider">
                                SECTION CODE: {s.code}
                            </p>
                        </div>
                    </Link>
                ))}
                {sections.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                        <BookOpen className="w-12 h-12 opacity-20 mb-3" />
                        <p className="font-medium">No sections assigned to this cohort yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


