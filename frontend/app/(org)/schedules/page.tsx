'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { CalendarDays, ChevronRight, Clock, Layers, MapPin, Search } from 'lucide-react';
import { Section, SectionSchedule } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCourseSectionLabel, getSectionColor, getSectionSurfaceStyle, getSectionTintStyle } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function timeToMinutes(time: string) {
    const [hours = '0', minutes = '0'] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
}

function ScheduleSkeleton() {
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

function SectionScheduleCard({ section }: { section: Section }) {
    const sectionColor = getSectionColor(section);
    const sectionPanelStyle = getSectionSurfaceStyle(section, '0C', '38');
    const sectionBadgeStyle = getSectionTintStyle(section);
    const { data: schedulesData, isLoading, error, mutate } = useSWR<SectionSchedule[]>(
        ['schedules', section.id] as const
    );
    const schedules = useMemo(() => (
        [...(schedulesData || [])].sort((a, b) => (
            a.day - b.day || timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        ))
    ), [schedulesData]);

    return (
        <article className="overflow-hidden rounded-lg border shadow-sm" style={getSectionSurfaceStyle(section, '10', '55')}>
            <div className="flex min-w-0 items-start justify-between gap-3 border-b p-4" style={{ borderColor: `${sectionColor}38`, backgroundColor: `${sectionColor}08` }}>
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border" style={sectionBadgeStyle}>
                        <CalendarDays className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <CourseSectionLabel section={section} as="h2" className="truncate text-base font-black md:text-lg" />
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="neutral" size="sm" style={sectionBadgeStyle}>{section.course?.name || 'Generic Course'}</Badge>
                            {section.cohort?.name && <Badge variant="neutral" size="sm" style={sectionBadgeStyle}>{section.cohort.name}</Badge>}
                            <Badge variant="neutral" size="sm" style={sectionBadgeStyle}>
                                {schedules.length} slot{schedules.length === 1 ? '' : 's'}
                            </Badge>
                        </div>
                    </div>
                </div>
                <Link
                    href={`/sections/${section.id}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-transform hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={sectionBadgeStyle}
                    aria-label={`Open ${formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name })}`}
                >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </div>

            <div className="p-3 sm:p-4">
                {error ? (
                    <ErrorState
                        error={error}
                        onRetry={() => mutate()}
                        title="Schedules could not load"
                        description={`Try again for ${formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name })}.`}
                        className="max-w-none"
                    />
                ) : isLoading ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Skeleton className="h-16 rounded-md" />
                        <Skeleton className="h-16 rounded-md" />
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-5 text-center" style={getSectionSurfaceStyle(section, '0A', '55')}>
                        <Clock className="mx-auto h-8 w-8 opacity-70" style={{ color: sectionColor }} aria-hidden="true" />
                        <p className="mt-2 text-sm font-black" style={{ color: sectionColor }}>No time slots allocated</p>
                        <p className="mt-1 text-xs font-semibold opacity-80" style={{ color: sectionColor }}>
                            Add section schedules from the section detail page.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {schedules.map((schedule) => (
                            <div key={schedule.id} className="rounded-md border p-3" style={sectionPanelStyle}>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black uppercase tracking-wide" style={{ color: sectionColor }}>
                                        {DAY_NAMES[schedule.day]}
                                    </span>
                                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-black" style={sectionBadgeStyle}>
                                        {schedule.startTime}
                                    </span>
                                </div>
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-bold" style={{ color: sectionColor }}>
                                        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span>{schedule.startTime} - {schedule.endTime}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold opacity-80" style={{ color: sectionColor }}>
                                        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{schedule.room || section.room || 'Venue TBD'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}

export default function SchedulesPage() {
    const { token } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const sectionsKey = token ? ['sections-for-schedules', { limit: 100 }] as const : null;
    const { data: sectionsData, isLoading, error, mutate } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);

    const filteredSections = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sections;
        return sections.filter((section) => (
            section.name.toLowerCase().includes(term) ||
            (section.course?.name || '').toLowerCase().includes(term) ||
            (section.cohort?.name || '').toLowerCase().includes(term)
        ));
    }, [searchTerm, sections]);

    return (
        <PageShell>
            <PageHeader
                title="Schedules"
                description="Scan section time slots by section, course, cohort, day, and room."
                icon={CalendarDays}
                meta={<Badge variant="neutral" size="sm">{sections.length} sections</Badge>}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Schedules' },
                ]}
            />

            {error ? (
                <ErrorState
                    error={error}
                    onRetry={() => mutate()}
                    title="Schedules could not load"
                    description="Section records are unavailable right now."
                />
            ) : (
                <ResourcePanel>
                    <div className="shrink-0 border-b border-border/60 bg-card/80 p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full max-w-md">
                                <Input
                                    placeholder="Search sections, courses, or cohorts..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    icon={Search}
                                    className="h-11 border-border/60 bg-background/70"
                                />
                            </div>
                            <div className="hidden items-center gap-2 text-xs font-black text-muted-foreground sm:flex">
                                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                <span>{filteredSections.length} visible</span>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                        {isLoading ? (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <ScheduleSkeleton key={index} />
                                ))}
                            </div>
                        ) : filteredSections.length === 0 ? (
                            <EmptyState
                                icon={Layers}
                                title="No sections found"
                                description={searchTerm ? 'Try a different section, course, or cohort search.' : 'Sections will appear here when they are available.'}
                                className="min-h-80"
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {filteredSections.map((section) => (
                                    <SectionScheduleCard key={section.id} section={section} />
                                ))}
                            </div>
                        )}
                    </div>
                </ResourcePanel>
            )}
        </PageShell>
    );
}
