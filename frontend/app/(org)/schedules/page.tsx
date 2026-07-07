'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BookOpen, Building2, CalendarDays, ChevronRight, Clock, FileUp, GraduationCap, Layers, MapPin, Users } from 'lucide-react';
import { Role, Section, SectionSchedule, ScheduleType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { RemoteFilterSelect } from '@/components/ui/RemoteFilterSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { SearchBar } from '@/components/ui/SearchBar';
import { DocsLink } from '@/components/ui/DocsLink';
import { Skeleton } from '@/components/ui/Skeleton';
import { fuzzySearchScore } from '@/lib/fuzzySearch';
import { searchFilterLookup } from '@/lib/filterLookups';
import { formatCourseSectionLabel, formatRoomLabel, getSectionColor, getSectionSurfaceStyle, getSectionTintStyle } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { CsvImportModal } from '@/components/imports/CsvImportModal';

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

function getScheduleDayLabel(schedule: SectionSchedule) {
    if (schedule.date) {
        return new Date(schedule.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return DAY_NAMES[schedule.day];
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

function sectionMatchesRoomFilter(section: Section, roomFilter: string) {
    if (!roomFilter) return true;
    const keys = getRoomKeysForSection(section);
    return keys.has(roomFilter) || keys.has(`room:${roomFilter}`);
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
            (a.date || '').localeCompare(b.date || '') || a.day - b.day || timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
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
                            <Badge variant="neutral" size="sm" color={section.color}>{section.course?.name || 'Generic Course'}</Badge>
                            {section.cohort?.name && <Badge variant="neutral" size="sm" color={section.color}>{section.cohort.name}</Badge>}
                            <Badge variant="neutral" size="sm" color={section.color}>
                                {schedules.length} slot{schedules.length === 1 ? '' : 's'}
                            </Badge>
                        </div>
                    </div>
                </div>
                <Link
                    href={`/sections/${section.id}?tab=schedule`}
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
                                        {getScheduleDayLabel(schedule)}
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
                                    {schedule.type === ScheduleType.AD_HOC && (
                                        <Badge variant="warning" size="sm">
                                            Ad-hoc
                                        </Badge>
                                    )}
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
    const { token, user } = useAuth();
    const { getStringParam, updateQueryParams } = useUrlQueryState();
    const [importOpen, setImportOpen] = useState(false);

    const searchTerm = getStringParam('search', '');
    const dayFilter = getStringParam('day', 'ALL');
    const courseId = getStringParam('courseId', '');
    const departmentId = getStringParam('departmentId', '');
    const cohortId = getStringParam('cohortId', '');
    const teacherId = getStringParam('teacherId', '');
    const roomKey = getStringParam('room', '');
    const scheduleStatus = (getStringParam('status', 'ALL') as ScheduleStatusFilter);
    const canImportSchedules = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const sectionsKey = token ? ['sections-for-schedules', { limit: 100 }] as const : null;
    const { data: sectionsData, isLoading, error, mutate } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);

    const filteredSections = useMemo(() => {
        const term = searchTerm.trim();
        return sections.filter((section) => (
            (!term || fuzzySearchScore(term, [
                section.name,
                section.code,
                section.course?.name,
                section.course?.code,
                section.course?.department?.name,
                section.course?.department?.code,
                section.cohort?.name,
                getSectionRoomLabel(section),
                ...(section.teachers?.map((teacher) => teacher.user?.name || teacher.user?.email || teacher.subject) || []),
                ...(section.schedules?.flatMap((schedule) => [
                    getScheduleDayLabel(schedule),
                    schedule.type === ScheduleType.AD_HOC ? 'ad-hoc' : 'official',
                    schedule.startTime,
                    schedule.endTime,
                    getScheduleRoomLabel(schedule),
                ]) || []),
            ]) > 0) &&
            (!courseId || section.course?.id === courseId) &&
            (!departmentId || section.course?.department?.id === departmentId) &&
            (!cohortId || section.cohort?.id === cohortId) &&
            (!teacherId || section.teachers?.some((teacher) => teacher.id === teacherId)) &&
            sectionMatchesRoomFilter(section, roomKey) &&
            (scheduleStatus === 'ALL' ||
                (scheduleStatus === 'SCHEDULED' && Boolean(section.schedules?.length)) ||
                (scheduleStatus === 'UNSCHEDULED' && !section.schedules?.length)) &&
            (dayFilter === 'ALL' || section.schedules?.some((schedule) => String(schedule.day) === dayFilter))
        ));
    }, [cohortId, courseId, dayFilter, departmentId, roomKey, scheduleStatus, searchTerm, sections, teacherId]);

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{ key: 'search', label: 'Search', value: searchTerm, onRemove: () => updateQueryParams({ search: undefined }) }] : []),
        ...(dayFilter !== 'ALL' ? [{ key: 'day', label: 'Day', value: DAY_NAMES[Number(dayFilter)] || 'Selected day', onRemove: () => updateQueryParams({ day: undefined }) }] : []),
        ...(courseId ? [{ key: 'courseId', label: 'Course', value: 'Selected course', onRemove: () => updateQueryParams({ courseId: undefined }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: 'Selected department', onRemove: () => updateQueryParams({ departmentId: undefined }) }] : []),
        ...(cohortId ? [{ key: 'cohortId', label: 'Cohort', value: 'Selected cohort', onRemove: () => updateQueryParams({ cohortId: undefined }) }] : []),
        ...(teacherId ? [{ key: 'teacherId', label: 'Teacher', value: 'Selected teacher', onRemove: () => updateQueryParams({ teacherId: undefined }) }] : []),
        ...(roomKey ? [{ key: 'room', label: 'Room', value: 'Selected room', onRemove: () => updateQueryParams({ room: undefined }) }] : []),
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
            <RemoteFilterSelect
                cacheKey="schedules-course-filter"
                value={courseId}
                onChange={(value) => updateQueryParams({ courseId: value || undefined })}
                placeholder="All courses"
                allLabel="All courses"
                icon={BookOpen}
                selectedLabel="Selected course"
                loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'courses', search })}
            />
            <RemoteFilterSelect
                cacheKey="schedules-department-filter"
                value={departmentId}
                onChange={(value) => updateQueryParams({ departmentId: value || undefined })}
                placeholder="All departments"
                allLabel="All departments"
                icon={Layers}
                selectedLabel="Selected department"
                loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'departments', search, isActive: true })}
            />
            <RemoteFilterSelect
                cacheKey="schedules-cohort-filter"
                value={cohortId}
                onChange={(value) => updateQueryParams({ cohortId: value || undefined })}
                placeholder="All cohorts"
                allLabel="All cohorts"
                icon={GraduationCap}
                selectedLabel="Selected cohort"
                loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'cohorts', search })}
            />
            <RemoteFilterSelect
                cacheKey="schedules-teacher-filter"
                value={teacherId}
                onChange={(value) => updateQueryParams({ teacherId: value || undefined })}
                placeholder="All teachers"
                allLabel="All teachers"
                icon={Users}
                selectedLabel="Selected teacher"
                loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'teachers', search })}
            />
            <RemoteFilterSelect
                cacheKey="schedules-room-filter"
                value={roomKey}
                onChange={(value) => updateQueryParams({ room: value || undefined })}
                placeholder="All rooms"
                allLabel="All rooms"
                icon={Building2}
                selectedLabel="Selected room"
                loadOptions={(search) => searchFilterLookup({ token: token!, entity: 'rooms', search, isActive: true })}
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
                            <div className="flex items-center gap-2">
                                {canImportSchedules && (
                                    <Button type="button" variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>
                                        Import CSV
                                    </Button>
                                )}
                                <div className="flex min-h-10 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-3 text-xs font-black text-muted-foreground">
                                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                    <span>{filteredSections.length} sections - {visibleSlotCount} slots</span>
                                </div>
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
            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="schedules"
                title="Schedules"
                cachePrefix={['sections-for-schedules', 'schedules', 'timetable']}
            />
        </PageShell>
    );
}
