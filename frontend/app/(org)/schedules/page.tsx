'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BookOpen, Building2, CalendarDays, ChevronRight, Clock, GraduationCap, Layers, MapPin, Users } from 'lucide-react';
import { Section, SectionSchedule } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { SearchBar } from '@/components/ui/SearchBar';
import { DocsLink } from '@/components/ui/DocsLink';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCourseSectionLabel, formatRoomLabel, getSectionColor, getSectionSurfaceStyle, getSectionTintStyle } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_STATUS_OPTIONS = [
    { value: 'ALL', label: 'All sections' },
    { value: 'SCHEDULED', label: 'With time slots' },
    { value: 'UNSCHEDULED', label: 'Without time slots' },
] as const;

type ScheduleStatusFilter = typeof SCHEDULE_STATUS_OPTIONS[number]['value'];

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

function addOption(map: Map<string, string>, value?: string | null, label?: string | null) {
    if (!value || !label || map.has(value)) return;
    map.set(value, label);
}

function getScheduleRoomKey(schedule: SectionSchedule) {
    if (schedule.roomRef?.id) return `room:${schedule.roomRef.id}`;
    if (schedule.roomId) return `room:${schedule.roomId}`;
    if (schedule.room) return `text:${schedule.room.toLowerCase()}`;
    return '';
}

function getScheduleRoomLabel(schedule: SectionSchedule) {
    if (schedule.roomRef) return formatRoomLabel(schedule.roomRef);
    return schedule.room || '';
}

function getSectionRoomKey(section: Section) {
    if (section.defaultRoom?.id) return `room:${section.defaultRoom.id}`;
    if (section.defaultRoomId) return `room:${section.defaultRoomId}`;
    if (section.room) return `text:${section.room.toLowerCase()}`;
    return '';
}

function getSectionRoomLabel(section: Section) {
    if (section.defaultRoom) return formatRoomLabel(section.defaultRoom);
    return section.room || '';
}

function getRoomKeysForSection(section: Section) {
    const keys = new Set<string>();
    const sectionRoomKey = getSectionRoomKey(section);
    if (sectionRoomKey) keys.add(sectionRoomKey);
    section.schedules?.forEach((schedule) => {
        const scheduleRoomKey = getScheduleRoomKey(schedule);
        if (scheduleRoomKey) keys.add(scheduleRoomKey);
    });
    return keys;
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
                                        <span className="truncate">
                                            {schedule.roomRef
                                                ? formatRoomLabel(schedule.roomRef)
                                                : section.defaultRoom
                                                    ? formatRoomLabel(section.defaultRoom)
                                                    : schedule.room || section.room || 'Venue TBD'}
                                        </span>
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
    const { getStringParam, updateQueryParams } = useUrlQueryState();

    const searchTerm = getStringParam('search', '');
    const dayFilter = getStringParam('day', 'ALL');
    const courseId = getStringParam('courseId', '');
    const departmentId = getStringParam('departmentId', '');
    const cohortId = getStringParam('cohortId', '');
    const teacherId = getStringParam('teacherId', '');
    const roomKey = getStringParam('room', '');
    const scheduleStatus = (getStringParam('status', 'ALL') as ScheduleStatusFilter);

    const sectionsKey = token ? ['sections-for-schedules', { limit: 100 }] as const : null;
    const { data: sectionsData, isLoading, error, mutate } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);

    const filterOptions = useMemo(() => {
        const courses = new Map<string, string>();
        const departments = new Map<string, string>();
        const cohorts = new Map<string, string>();
        const teachers = new Map<string, string>();
        const rooms = new Map<string, string>();

        sections.forEach((section) => {
            addOption(courses, section.course?.id, section.course?.name);
            addOption(departments, section.course?.department?.id, section.course?.department?.name || section.course?.department?.code);
            addOption(cohorts, section.cohort?.id, section.cohort?.name);
            section.teachers?.forEach((teacher) => {
                addOption(teachers, teacher.id, teacher.user?.name || teacher.user?.email || teacher.subject || 'Unnamed teacher');
            });

            const sectionRoomKey = getSectionRoomKey(section);
            addOption(rooms, sectionRoomKey, getSectionRoomLabel(section));
            section.schedules?.forEach((schedule) => {
                addOption(rooms, getScheduleRoomKey(schedule), getScheduleRoomLabel(schedule));
            });
        });

        const sortByLabel = ([, a]: [string, string], [, b]: [string, string]) => a.localeCompare(b);

        return {
            courses: Array.from(courses.entries()).sort(sortByLabel).map(([value, label]) => ({ value, label })),
            departments: Array.from(departments.entries()).sort(sortByLabel).map(([value, label]) => ({ value, label })),
            cohorts: Array.from(cohorts.entries()).sort(sortByLabel).map(([value, label]) => ({ value, label })),
            teachers: Array.from(teachers.entries()).sort(sortByLabel).map(([value, label]) => ({ value, label })),
            rooms: Array.from(rooms.entries()).sort(sortByLabel).map(([value, label]) => ({ value, label })),
        };
    }, [sections]);

    const filteredSections = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return sections.filter((section) => (
            (!term || [
                section.name,
                section.course?.name,
                section.course?.department?.name,
                section.course?.department?.code,
                section.cohort?.name,
                getSectionRoomLabel(section),
                ...(section.teachers?.map((teacher) => teacher.user?.name || teacher.user?.email || teacher.subject) || []),
                ...(section.schedules?.flatMap((schedule) => [
                    DAY_NAMES[schedule.day],
                    schedule.startTime,
                    schedule.endTime,
                    getScheduleRoomLabel(schedule),
                ]) || []),
            ].some((value) => String(value || '').toLowerCase().includes(term))) &&
            (!courseId || section.course?.id === courseId) &&
            (!departmentId || section.course?.department?.id === departmentId) &&
            (!cohortId || section.cohort?.id === cohortId) &&
            (!teacherId || section.teachers?.some((teacher) => teacher.id === teacherId)) &&
            (!roomKey || getRoomKeysForSection(section).has(roomKey)) &&
            (scheduleStatus === 'ALL' ||
                (scheduleStatus === 'SCHEDULED' && Boolean(section.schedules?.length)) ||
                (scheduleStatus === 'UNSCHEDULED' && !section.schedules?.length)) &&
            (dayFilter === 'ALL' || section.schedules?.some((schedule) => String(schedule.day) === dayFilter))
        ));
    }, [cohortId, courseId, dayFilter, departmentId, roomKey, scheduleStatus, searchTerm, sections, teacherId]);

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{ key: 'search', label: 'Search', value: searchTerm, onRemove: () => updateQueryParams({ search: undefined }) }] : []),
        ...(dayFilter !== 'ALL' ? [{ key: 'day', label: 'Day', value: DAY_NAMES[Number(dayFilter)] || 'Selected day', onRemove: () => updateQueryParams({ day: undefined }) }] : []),
        ...(courseId ? [{ key: 'courseId', label: 'Course', value: filterOptions.courses.find((course) => course.value === courseId)?.label || 'Selected course', onRemove: () => updateQueryParams({ courseId: undefined }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: filterOptions.departments.find((department) => department.value === departmentId)?.label || 'Selected department', onRemove: () => updateQueryParams({ departmentId: undefined }) }] : []),
        ...(cohortId ? [{ key: 'cohortId', label: 'Cohort', value: filterOptions.cohorts.find((cohort) => cohort.value === cohortId)?.label || 'Selected cohort', onRemove: () => updateQueryParams({ cohortId: undefined }) }] : []),
        ...(teacherId ? [{ key: 'teacherId', label: 'Teacher', value: filterOptions.teachers.find((teacher) => teacher.value === teacherId)?.label || 'Selected teacher', onRemove: () => updateQueryParams({ teacherId: undefined }) }] : []),
        ...(roomKey ? [{ key: 'room', label: 'Room', value: filterOptions.rooms.find((room) => room.value === roomKey)?.label || 'Selected room', onRemove: () => updateQueryParams({ room: undefined }) }] : []),
        ...(scheduleStatus !== 'ALL' ? [{ key: 'status', label: 'Status', value: SCHEDULE_STATUS_OPTIONS.find((option) => option.value === scheduleStatus)?.label || 'Selected status', onRemove: () => updateQueryParams({ status: undefined }) }] : []),
    ];

    const visibleSlotCount = useMemo(() => (
        filteredSections.reduce((total, section) => total + (section.schedules?.length || 0), 0)
    ), [filteredSections]);

    const renderFilters = () => (
        <FilterDrawerGrid>
            <CustomSelect
                value={dayFilter}
                onChange={(value) => updateQueryParams({ day: value === 'ALL' ? undefined : value })}
                options={[
                    { value: 'ALL', label: 'All days', icon: CalendarDays },
                    ...DAY_NAMES.map((label, day) => ({ value: String(day), label })),
                ]}
            />
            <CustomSelect
                value={courseId}
                onChange={(value) => updateQueryParams({ courseId: value || undefined })}
                options={[{ value: '', label: 'All courses', icon: BookOpen }, ...filterOptions.courses]}
                searchable
            />
            <CustomSelect
                value={departmentId}
                onChange={(value) => updateQueryParams({ departmentId: value || undefined })}
                options={[{ value: '', label: 'All departments', icon: Layers }, ...filterOptions.departments]}
                searchable
            />
            <CustomSelect
                value={cohortId}
                onChange={(value) => updateQueryParams({ cohortId: value || undefined })}
                options={[{ value: '', label: 'All cohorts', icon: GraduationCap }, ...filterOptions.cohorts]}
                searchable
            />
            <CustomSelect
                value={teacherId}
                onChange={(value) => updateQueryParams({ teacherId: value || undefined })}
                options={[{ value: '', label: 'All teachers', icon: Users }, ...filterOptions.teachers]}
                searchable
            />
            <CustomSelect
                value={roomKey}
                onChange={(value) => updateQueryParams({ room: value || undefined })}
                options={[{ value: '', label: 'All rooms', icon: Building2 }, ...filterOptions.rooms]}
                searchable
            />
            <CustomSelect<ScheduleStatusFilter>
                value={scheduleStatus}
                onChange={(value) => updateQueryParams({ status: value === 'ALL' ? undefined : value })}
                options={SCHEDULE_STATUS_OPTIONS.map((option) => ({ ...option }))}
            />
        </FilterDrawerGrid>
    );

    return (
        <PageShell>
            <PageHeader
                title="Schedules"
                description={<>Scan class time slots by section, teacher, day, and room. <DocsLink href="/docs/timetable#schedule-teacher">Read schedule rules</DocsLink></>}
                icon={CalendarDays}
                meta={<Badge variant="neutral" size="sm">{sections.length} sections</Badge>}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Schedules' },
                ]}
                actions={(
                    <PageControls
                        drawerLabel="Schedule filters"
                        renderFilters={renderFilters}
                        activeFilters={activeFilters}
                        leading={(
                            <SearchBar
                                placeholder="Search sections, courses, teachers, rooms..."
                                value={searchTerm}
                                onChange={(value) => updateQueryParams({ search: value || undefined })}
                                mobileMode="expandable"
                            />
                        )}
                        actions={(
                            <div className="flex min-h-10 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-3 text-xs font-black text-muted-foreground">
                                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                <span>{filteredSections.length} sections - {visibleSlotCount} slots</span>
                            </div>
                        )}
                    />
                )}
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
                                description={activeFilters.length > 0 ? 'Adjust the search or filters to broaden the schedule view.' : 'Sections will appear here when they are available.'}
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
