'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BookOpen, ChevronRight, GraduationCap, Layers, Search, Users } from 'lucide-react';
import { Section, Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';

function SectionCardSkeleton() {
    return (
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-2/3 rounded-md" />
                        <Skeleton className="h-3 w-1/2 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-16 rounded-md" />
            </div>
        </div>
    );
}

function SectionGradeCard({ section }: { section: Section }) {
    return (
        <Link
            href={`/sections/${section.id}`}
            className="group block overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm transition-colors hover:border-primary/45 hover:bg-background/40"
        >
            <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/60 bg-card/80 p-4">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-black text-foreground md:text-lg">{section.name}</h2>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="neutral" size="sm">{section.course?.name || 'Generic Course'}</Badge>
                            {section.cohort?.name && <Badge variant="secondary" size="sm">{section.cohort.name}</Badge>}
                            {section.academicCycle?.name && <Badge variant="primary" size="sm">{section.academicCycle.name}</Badge>}
                        </div>
                    </div>
                </div>
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                <div className="rounded-md border border-border/60 bg-background/55 p-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                        Grade Workspace
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">Open assessments and grade records</p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/55 p-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                        <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                        Section Context
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-foreground">
                        {section.cohort ? `${section.cohort.name} cohort` : 'No cohort assigned'}
                    </p>
                </div>
            </div>
        </Link>
    );
}

export default function GradesPage() {
    const { token, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const sectionsKey = token && user
        ? ['sections-for-grades', { my: user.role === Role.TEACHER }] as const
        : null;
    const { data: sectionsData, isLoading } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);

    const filteredSections = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return sections;

        return sections.filter((section) => (
            section.name.toLowerCase().includes(term) ||
            (section.course?.name || '').toLowerCase().includes(term)
        ));
    }, [searchTerm, sections]);

    return (
        <PageShell>
            <PageHeader
                title="Grades"
                description="Choose a section to open its grade and assessment workspace."
                icon={GraduationCap}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Grades' },
                ]}
                meta={<Badge variant="neutral" size="sm">{sections.length} sections</Badge>}
            />

            {isLoading ? (
                <>
                    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
                        <Skeleton className="h-10 w-full max-w-md rounded-md" />
                        <div className="hidden items-center gap-2 sm:flex">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-3 w-24 rounded-md" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {[...Array(6)].map((_, index) => (
                            <SectionCardSkeleton key={index} />
                        ))}
                    </div>
                </>
            ) : (
                <ResourcePanel className="overflow-y-auto">
                    <div className="shrink-0 border-b border-border/60 bg-card/80 p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full max-w-md">
                                <Input
                                    placeholder="Search sections or courses..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    icon={Search}
                                    className="h-11 border-border/60 bg-background/70"
                                />
                            </div>
                            <div className="hidden items-center gap-2 text-xs font-black text-muted-foreground sm:flex">
                                <GraduationCap className="h-4 w-4" />
                                <span>Total Sections: {sections.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                        {filteredSections.length === 0 ? (
                            <EmptyState
                                icon={BookOpen}
                                title="No sections found"
                                description={searchTerm ? 'Try a different section or course search.' : 'Sections will appear here when they are available for grading.'}
                                className="min-h-72"
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {filteredSections.map((section) => (
                                    <SectionGradeCard key={section.id} section={section} />
                                ))}
                            </div>
                        )}
                    </div>
                </ResourcePanel>
            )}
        </PageShell>
    );
}
