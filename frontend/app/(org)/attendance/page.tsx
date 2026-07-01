'use client';

import useSWR from 'swr';
import { Section, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle, Users, ChevronRight, BookOpen, Rows3, Search } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageShell';
import { DocsLink } from '@/components/ui/DocsLink';
import { useMemo, useState } from 'react';
import { getSectionSurfaceStyle } from '@/lib/utils';
import { fuzzyFilterAndRank } from '@/lib/fuzzySearch';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

function SectionRowsSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
            <div className="grid grid-cols-[48px_minmax(220px,1.3fr)_minmax(180px,1fr)_120px_120px] border-b border-border/70 bg-background text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {[...Array(5)].map((_, index) => (
                    <div key={index} className="border-r border-border/70 px-3 py-2 last:border-r-0">
                        <Skeleton className="h-3 w-full" />
                    </div>
                ))}
            </div>
            {[...Array(8)].map((_, index) => (
                <div key={index} className="grid grid-cols-[48px_minmax(220px,1.3fr)_minmax(180px,1fr)_120px_120px] border-b border-border/50 last:border-b-0">
                    <div className="border-r border-border/50 px-3 py-3"><Skeleton className="h-4 w-5" /></div>
                    <div className="border-r border-border/50 px-3 py-3"><Skeleton className="h-4 w-42" /></div>
                    <div className="border-r border-border/50 px-3 py-3"><Skeleton className="h-4 w-32" /></div>
                    <div className="border-r border-border/50 px-3 py-3"><Skeleton className="h-4 w-16" /></div>
                    <div className="px-3 py-3"><Skeleton className="h-4 w-20" /></div>
                </div>
            ))}
        </div>
    );
}

export default function AttendanceLandingPage() {
    const { token, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const sectionsKey = token ? ['sections', { my: true, limit: 100 }] as const : null;
    const { data: sectionsData, isLoading: fetching } = useSWR<PaginatedResponse<Section>>(sectionsKey);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);

    const filteredSections = useMemo(() => {
        return fuzzyFilterAndRank(sections, searchTerm, (section) => [
            section.name,
            section.code,
            section.course?.name,
            section.course?.code,
        ]);
    }, [sections, searchTerm]);

    if (!user) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/80 p-2 text-center shadow-sm">
                <p className="text-sm font-semibold text-muted-foreground">Attendance portal is restricted to authorized academic personnel.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full flex-1 flex-col gap-1 pb-5">
            <PageHeader
                title="Attendance Portal"
                description={<>Open a section workbook to mark attendance or review trends. <DocsLink href="/docs/attendance#attendance-workflow">Read attendance guide</DocsLink></>}
                icon={CheckCircle}
                actions={(
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search sections..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-11 border-border/60 bg-input pl-10 text-sm font-medium"
                        />
                    </div>
                )}
            />

            {fetching && sections.length === 0 ? (
                <SectionRowsSkeleton />
            ) : filteredSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/80 px-6 py-16 text-center shadow-sm">
                    <Rows3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-3 text-sm font-black text-foreground">No sections found or schedules available</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Try a different search or check your assigned sections.</p>
                </div>
            ) : (
                <>
                    <section className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm md:block">
                        <div className="grid grid-cols-[48px_minmax(240px,1.3fr)_minmax(180px,1fr)_120px_140px] border-b border-border/70 bg-background text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <div className="border-r border-border/70 px-3 py-2 text-center">#</div>
                            <div className="border-r border-border/70 px-3 py-2">Section</div>
                            <div className="border-r border-border/70 px-3 py-2">Course</div>
                            <div className="border-r border-border/70 px-3 py-2 text-center">Students</div>
                            <div className="px-3 py-2 text-center">Workbook</div>
                        </div>

                        {filteredSections.map((section, index) => {
                            const studentCount = section.studentsCount || section.students?.length || 0;
                            return (
                                <Link
                                    key={section.id}
                                    href={`/attendance/${section.id}`}
                                    className="group grid grid-cols-[48px_minmax(240px,1.3fr)_minmax(180px,1fr)_120px_140px] border-b border-border/50 bg-card transition-colors last:border-b-0 hover:bg-background/60"
                                    style={getSectionSurfaceStyle(section, '08', '30')}
                                >
                                    <div className="border-r border-border/50 px-3 py-3 text-center font-mono text-xs font-bold text-muted-foreground">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 border-r border-border/50 px-3 py-3">
                                        <CourseSectionLabel section={section} as="p" className="truncate text-sm font-black group-hover:brightness-90" />
                                        <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground">Section workbook</p>
                                    </div>
                                    <div className="min-w-0 border-r border-border/50 px-3 py-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                                            <span className="truncate text-sm font-semibold text-foreground">{section.course?.name || 'Course'}</span>
                                        </div>
                                    </div>
                                    <div className="border-r border-border/50 px-3 py-3 text-center">
                                        <span className="inline-flex min-w-12 items-center justify-center gap-1 rounded-md bg-background px-2 py-1 font-mono text-xs font-black text-foreground">
                                            <Users className="h-3 w-3 text-primary" />
                                            {studentCount}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-center px-3 py-3">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                                            Open
                                            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </section>

                    <div className="grid gap-3 md:hidden">
                        {filteredSections.map((section) => {
                            const studentCount = section.studentsCount || section.students?.length || 0;
                            return (
                                <Link
                                    key={section.id}
                                    href={`/attendance/${section.id}`}
                                    className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm transition-colors active:bg-background/60"
                                    style={getSectionSurfaceStyle(section, '0F', '38')}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <CourseSectionLabel section={section} as="p" className="truncate text-base font-black" />
                                            <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{section.course?.name || 'Course'}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
                                    </div>
                                    <div className="mt-3 flex items-center gap-2 text-xs font-black text-muted-foreground">
                                        <Users className="h-4 w-4 text-primary" />
                                        {studentCount} students
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
