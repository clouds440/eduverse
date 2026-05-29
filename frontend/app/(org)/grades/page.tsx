'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BookOpen, ChevronRight, GraduationCap, Search } from 'lucide-react';
import { Section, Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';

function SectionCardSkeleton() {
    return (
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-md" />
            </div>
            <div className="mt-4 space-y-3">
                <Skeleton className="h-6 w-full rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <Skeleton className="h-3 w-32 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
            </div>
        </div>
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredSections.map((section) => (
                                    <Link
                                        key={section.id}
                                        href={`/sections/${section.id}`}
                                        className="group flex min-h-44 flex-col justify-between rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-background/45 md:p-5"
                                    >
                                        <div>
                                            <div className="mb-4 flex items-start justify-between gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                    <GraduationCap className="h-5 w-5" />
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                            </div>
                                            <h3 className="text-base font-black leading-tight text-foreground transition-colors group-hover:text-primary md:text-lg">
                                                {section.name}
                                            </h3>
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                {section.course?.name || 'Generic Course'}
                                            </p>
                                        </div>
                                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs font-black text-muted-foreground">
                                            <span className="min-w-0 truncate">
                                                {section.cohort ? `${section.cohort.name} (${section.academicCycle?.name || 'Academic Cycle'})` : 'No cohort assigned'}
                                            </span>
                                            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                Open
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </ResourcePanel>
            )}
        </PageShell>
    );
}
