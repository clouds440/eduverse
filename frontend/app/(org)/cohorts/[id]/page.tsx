'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Cohort, Student, Section, Role } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Users, BookOpen, GraduationCap } from 'lucide-react';
import { useGlobal } from '@/context/GlobalContext';
import { BrandIcon } from '@/components/ui/Brand';
import { Badge } from '@/components/ui/Badge';

export default function CohortDetailPage() {
    const { token, user } = useAuth();
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { dispatch } = useGlobal();

    const cohortKey = token ? ['cohort', id] as const : null;
    const { data: cohort, isLoading, error } = useSWR<Cohort>(cohortKey, async () => {
        if (!token) return null as any;
        return api.cohorts.getCohort(id, token);
    });

    const [activeTab, setActiveTab] = useState<'students' | 'sections'>('students');

    if (!token || isLoading || !cohort) {
        return <Loading className="h-full" text="Loading Cohort Details..." />;
    }

    if (error) {
        return <ErrorState error={error} onRetry={() => mutate(cohortKey)} />;
    }

    return (
        <div className="flex flex-col h-full w-full overflow-y-auto space-y-4">
            <div className="bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-4 md:p-6 shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/20 p-3 rounded-full">
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">{cohort.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                    <GraduationCap className="w-4 h-4" />
                                    <span>{cohort.academicCycle?.name || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-8 border-b border-border">
                    <button
                        className={`pb-3 px-6 flex items-center gap-2 font-semibold transition-all relative ${activeTab === 'students' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setActiveTab('students')}
                    >
                        <Users className="w-4 h-4" />
                        <span>Students</span>
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[20px] justify-center">{cohort._count?.students || 0}</Badge>
                        {activeTab === 'students' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(var(--primary-rgb),0.5)]" />}
                    </button>
                    <button
                        className={`pb-3 px-6 flex items-center gap-2 font-semibold transition-all relative ${activeTab === 'sections' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setActiveTab('sections')}
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>Sections</span>
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[20px] justify-center">{cohort._count?.sections || 0}</Badge>
                        {activeTab === 'sections' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(var(--primary-rgb),0.5)]" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-6 overflow-y-auto min-h-0">
                {activeTab === 'students' ? (
                    <CohortStudentsTab cohortId={id} students={cohort.students || []} token={token} />
                ) : (
                    <CohortSectionsTab cohortId={id} sections={cohort.sections || []} token={token} />
                )}
            </div>
        </div>
    );
}

function CohortStudentsTab({ cohortId, students, token }: { cohortId: string; students: Student[]; token: string }) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Enrolled Students</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {students.map(s => (
                    <div key={s.id} className="p-4 bg-muted/20 border border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl flex items-center gap-4 transition-all group shadow-sm">
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
                    </div>
                ))}
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

function CohortSectionsTab({ cohortId, sections, token }: { cohortId: string; sections: Section[]; token: string }) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Assigned Sections</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sections.map(s => (
                    <div key={s.id} className="p-4 bg-muted/20 border border-border hover:border-primary/50 hover:bg-muted/30 rounded-xl flex items-center gap-4 transition-all group shadow-sm">
                        <div className="bg-primary/10 p-3 rounded-xl group-hover:scale-105 transition-transform">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground font-medium truncate">{s.course?.name}</p>
                            <p className="text-[10px] mt-1 font-bold text-primary uppercase tracking-wider">
                                SECTION CODE: {s.id.split('-')[0]}
                            </p>
                        </div>
                    </div>
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
