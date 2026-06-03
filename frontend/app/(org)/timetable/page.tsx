'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Section, Student, Teacher, TimetableEntry, Role } from '@/types';
import { CalendarDays, Clock, Download, Maximize2, MapPin, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ModalOverlay } from '@/components/ui/Modal';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { PLATFORM_NAME } from '@/lib/constants';
import { downloadPdfBlob, sanitizePdfFilename } from '@/lib/pdf/core';
import { createTimetablePdf, type TimetablePdfSectionSummary } from '@/lib/pdf/timetable';
import { cn, formatCourseSectionLabel, getPublicUrl, getSectionColor } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;
const TIMETABLE_HALF_HOUR_ROW_HEIGHT = 52;

interface TimetableSlotGroup {
    day: number;
    startTime: string;
    endTime: string;
    entries: TimetableEntry[];
}

type TimetableProfile = Student | Teacher;

interface TimetableGridProps {
    entriesByDay: Map<number, TimetableEntry[]>;
    slotGroupsByDay: Map<number, TimetableSlotGroup[]>;
    timeSlots: number[];
    startHour: number;
    rowCount: number;
    gridRows: string;
    gridHeight: number;
    canOpenAttendance: boolean;
    onOpenEntry: (entry: TimetableEntry) => void;
    className?: string;
}

interface TimetableContextHeaderProps {
    orgName: string;
    userName: string;
    roleLabel: string;
    cohortName?: string | null;
    sections: TimetablePdfSectionSummary[];
    slotsCount: number;
    actions?: React.ReactNode;
}

const toLocalDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getClosestDateForWeekday = (targetDay: number) => {
    const today = new Date();
    const todayDay = today.getDay();
    let bestOffset = 0;

    for (let offset = -6; offset <= 6; offset++) {
        const candidateDay = (todayDay + offset + 7) % 7;
        if (candidateDay !== targetDay) continue;
        if (Math.abs(offset) < Math.abs(bestOffset) || (Math.abs(offset) === Math.abs(bestOffset) && offset >= 0)) {
            bestOffset = offset;
        }
    }

    const closestDate = new Date(today);
    closestDate.setDate(today.getDate() + bestOffset);
    return toLocalDateInputValue(closestDate);
};

function timeToMinutes(time: string) {
    const [hours = '0', minutes = '0'] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
}

function formatHour(hour: number) {
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatDuration(startTime: string, endTime: string) {
    const duration = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
}

function isGridRowCoveredByEntry(dayEntries: TimetableEntry[], startHour: number, rowIndex: number) {
    const rowStartMinutes = startHour * 60 + rowIndex * 30;
    const rowEndMinutes = rowStartMinutes + 30;

    return dayEntries.some((entry) => {
        const entryStartMinutes = timeToMinutes(entry.startTime);
        const entryEndMinutes = timeToMinutes(entry.endTime);
        return entryStartMinutes < rowEndMinutes && entryEndMinutes > rowStartMinutes;
    });
}

function shouldDrawDayGridBorder(dayEntries: TimetableEntry[], startHour: number, rowIndex: number, rowCount: number) {
    if (rowIndex >= rowCount - 1) return false;
    if (isGridRowCoveredByEntry(dayEntries, startHour, rowIndex)) return false;
    return true;
}

function getTimetableCardStyle(entry: TimetableEntry): React.CSSProperties {
    const hex = getSectionColor(entry);
    return {
        backgroundColor: `${hex}18`,
        borderColor: `${hex}66`,
        color: hex,
    };
}

function getRoleLabel(role?: Role) {
    switch (role) {
        case Role.STUDENT:
            return 'Student';
        case Role.TEACHER:
            return 'Teacher';
        case Role.ORG_MANAGER:
            return 'Manager';
        case Role.ORG_ADMIN:
            return 'Administrator';
        default:
            return 'User';
    }
}

function getProfileCohortName(profile?: TimetableProfile) {
    if (!profile || !('cohort' in profile)) return null;
    return profile.cohort?.name || null;
}

function addSectionSummary(map: Map<string, TimetablePdfSectionSummary>, section: Pick<Section, 'id' | 'name' | 'color' | 'course'> & { courseName?: string }) {
    if (!section.id || map.has(section.id)) return;
    map.set(section.id, {
        id: section.id,
        name: section.name,
        courseName: section.course?.name || section.courseName || 'Course',
        color: section.color,
    });
}

function getTimetableSections(entries: TimetableEntry[], profile?: TimetableProfile) {
    const sections = new Map<string, TimetablePdfSectionSummary>();

    entries.forEach((entry) => {
        addSectionSummary(sections, {
            id: entry.sectionId,
            name: entry.sectionName,
            color: entry.color,
            courseName: entry.courseName,
        });
    });

    if (profile && 'sections' in profile) {
        profile.sections?.forEach((section) => addSectionSummary(sections, section));
    }

    if (profile && 'enrollments' in profile) {
        profile.enrollments?.forEach((enrollment) => addSectionSummary(sections, enrollment.section));
    }

    return Array.from(sections.values()).sort((a, b) => formatCourseSectionLabel({ courseName: a.courseName, sectionName: a.name }).localeCompare(formatCourseSectionLabel({ courseName: b.courseName, sectionName: b.name })));
}

function TimetableSkeleton() {
    return (
        <ResourcePanel>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
                <div className="min-w-240 space-y-2">
                    <Skeleton className="h-12 rounded-lg" />
                    {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-18 rounded-lg" />
                    ))}
                </div>
            </div>
        </ResourcePanel>
    );
}

function TimetableContextHeader({
    orgName,
    userName,
    roleLabel,
    cohortName,
    sections,
    slotsCount,
    actions,
}: TimetableContextHeaderProps) {
    return (
        <div className="shrink-0 border-b border-border/70 bg-card/95 p-3 shadow-sm sm:p-4">
            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{orgName}</p>
                    <h2 className="mt-1 truncate text-xl font-black text-foreground">{userName}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" size="sm">{roleLabel} Timetable</Badge>
                        <Badge variant="neutral" size="sm">{cohortName || 'No cohort'}</Badge>
                        <Badge variant="neutral" size="sm">{sections.length} {sections.length === 1 ? 'section' : 'sections'}</Badge>
                        <Badge variant="neutral" size="sm">{slotsCount} {slotsCount === 1 ? 'slot' : 'slots'}</Badge>
                    </div>
                    {sections.length > 0 && (
                        <div className="mt-3 flex max-w-5xl flex-wrap gap-1.5">
                            {sections.slice(0, 12).map((section) => {
                                const color = getSectionColor(section);
                                return (
                                    <span
                                        key={section.id}
                                        className="inline-flex max-w-60 items-center gap-1.5 truncate rounded-md border px-2 py-1 text-xs font-bold"
                                        style={{
                                            color,
                                            borderColor: `${color}55`,
                                            backgroundColor: `${color}12`,
                                        }}
                                    >
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="truncate">{formatCourseSectionLabel({ courseName: section.courseName, sectionName: section.name })}</span>
                                    </span>
                                );
                            })}
                            {sections.length > 12 && (
                                <span className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-bold text-muted-foreground">
                                    +{sections.length - 12} more
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </div>
    );
}

function TimetableGrid({
    entriesByDay,
    slotGroupsByDay,
    timeSlots,
    startHour,
    rowCount,
    gridRows,
    gridHeight,
    canOpenAttendance,
    onOpenEntry,
    className,
}: TimetableGridProps) {
    return (
        <div className={cn('min-h-0 flex-1 overflow-auto p-3 sm:p-4 custom-scrollbar', className)}>
            <div className="min-w-345">
                <div className="grid grid-cols-[96px_repeat(7,minmax(176px,1fr))] gap-2">
                    <div className="sticky left-0 z-20 rounded-md border border-border/70 bg-card p-3 text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground shadow-sm">
                        Time
                    </div>
                    {WEEK_DAYS.map((day) => (
                        <div key={day} className="rounded-md border border-border/70 bg-card p-3 text-center shadow-sm">
                            <p className="text-sm font-black text-foreground">{DAY_NAMES[day]}</p>
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {entriesByDay.get(day)?.length || 0} slots
                            </p>
                        </div>
                    ))}

                    <div
                        className="sticky left-0 z-10 grid overflow-hidden rounded-md border-x border-t border-border/70 bg-card shadow-sm"
                        style={{ gridTemplateRows: gridRows }}
                    >
                        {timeSlots.slice(0, -1).map((hour) => (
                            <div key={hour} className="row-span-2 flex items-start justify-center border-b-2 border-border/80 px-2 py-2 last:border-b-0">
                                <span className="text-xs font-black text-muted-foreground">{formatHour(hour)}</span>
                            </div>
                        ))}
                    </div>

                    {WEEK_DAYS.map((day) => {
                        const dayEntries = entriesByDay.get(day) || [];

                        return (
                            <div
                                key={day}
                                className="relative overflow-hidden rounded-md border-x border-t border-border/70 bg-background shadow-sm"
                                style={{ height: gridHeight }}
                            >
                                <div
                                    className="absolute inset-0 grid"
                                    style={{ gridTemplateRows: gridRows }}
                                    aria-hidden="true"
                                >
                                    {Array.from({ length: rowCount }).map((_, index) => {
                                        const shouldDrawBorder = shouldDrawDayGridBorder(dayEntries, startHour, index, rowCount);
                                        return (
                                            <div
                                                key={index}
                                                className={
                                                    shouldDrawBorder
                                                        ? index % 2 === 1
                                                            ? 'border-b-2 border-border/80 bg-background'
                                                            : 'border-b border-border/30 bg-muted/20'
                                                        : 'bg-background'
                                                }
                                            />
                                        );
                                    })}
                                </div>

                                <div className="relative z-10 grid h-full" style={{ gridTemplateRows: gridRows }}>
                                    {(slotGroupsByDay.get(day) || []).map((slot) => {
                                        const startOffset = Math.max(0, timeToMinutes(slot.startTime) - startHour * 60);
                                        const duration = Math.max(30, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
                                        const rowStart = Math.floor(startOffset / 30) + 1;
                                        const rowSpan = Math.max(1, Math.ceil(duration / 30));
                                        const isCompactSlot = duration <= 60;
                                        const isLongSlot = duration >= 120;
                                        const durationLabel = formatDuration(slot.startTime, slot.endTime);

                                        return (
                                            <div
                                                key={`${day}-${slot.startTime}-${slot.endTime}`}
                                                className={`z-10 m-1 flex min-h-0 flex-col overflow-hidden rounded-md border border-border/70 bg-card shadow-md ring-1 ring-black/5 dark:ring-white/10 ${isLongSlot ? 'ring-2 ring-primary/20' : ''}`}
                                                style={{ gridRow: `${rowStart} / span ${rowSpan}` }}
                                            >
                                                {isCompactSlot ? (
                                                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1 custom-scrollbar">
                                                        {slot.entries.map((entry) => (
                                                            <button
                                                                key={entry.scheduleId}
                                                                type="button"
                                                                onClick={() => onOpenEntry(entry)}
                                                                className={`flex h-full w-full items-start cursor-pointer gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${canOpenAttendance ? 'hover:brightness-105' : 'cursor-default'}`}
                                                                style={getTimetableCardStyle(entry)}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <CourseSectionLabel
                                                                        section={{
                                                                            name: entry.sectionName,
                                                                            color: entry.color,
                                                                            course: { name: entry.courseName },
                                                                        }}
                                                                        variant="stacked"
                                                                        as="p"
                                                                        className="text-xs"
                                                                    />
                                                                    <p className="mt-0.5 flex truncate text-[10px] font-bold opacity-75">{slot.startTime} - {slot.endTime}
                                                                        <MapPin className="h-3 w-3 ml-1 shrink-0" aria-hidden="true" />
                                                                        <span className="truncate">{entry.room || 'Room TBD'}</span>
                                                                    </p>
                                                                </div>
                                                                <Badge variant="neutral" size="xs" className="shrink-0 bg-white/70 h-fit text-foreground dark:bg-black/25">
                                                                    {durationLabel}
                                                                </Badge>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-muted/45 px-2.5 py-1.5">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-[11px] font-black uppercase tracking-wide text-foreground">
                                                                    {slot.startTime} - {slot.endTime}
                                                                </p>
                                                                <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                                                                    {slot.entries.length} {slot.entries.length === 1 ? 'section' : 'sections'}
                                                                </p>
                                                            </div>
                                                            <Badge variant={isLongSlot ? 'primary' : 'neutral'} size="xs" className="shrink-0">
                                                                {durationLabel}
                                                            </Badge>
                                                        </div>
                                                        <div className="h-full flex-1 space-y-1 overflow-y-auto border-l-4 border-primary/45 p-1.5 custom-scrollbar">
                                                            {slot.entries.map((entry) => (
                                                                <button
                                                                    key={entry.scheduleId}
                                                                    type="button"
                                                                    onClick={() => onOpenEntry(entry)}
                                                                    className={`w-full h-full items-start rounded-md cursor-pointer border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${canOpenAttendance ? 'hover:brightness-105' : 'cursor-default'}`}
                                                                    style={getTimetableCardStyle(entry)}
                                                                >
                                                                    <div className="grid grid-row-2 min-h-full">
                                                                        <CourseSectionLabel
                                                                            section={{
                                                                                name: entry.sectionName,
                                                                                color: entry.color,
                                                                                course: { name: entry.courseName },
                                                                            }}
                                                                            variant="stacked"
                                                                            as="p"
                                                                            className="text-xs"
                                                                        />
                                                                        <div className="mt-1.5 flex min-w-0 items-end gap-1.5 border-t border-current/15 pt-1.5 text-[10px] font-bold opacity-80">
                                                                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                            <span className="truncate">{entry.room || 'Room TBD'}</span>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function TimetablePage() {
    const router = useRouter();
    const { token, user } = useAuth();
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const timetableKey = token && user ? ['timetable', user.id, user.role] as const : null;
    const { data: entries = [], isLoading, error, mutate } = useSWR<TimetableEntry[]>(timetableKey);
    const profileKey = token && user?.role === Role.STUDENT
        ? ['student-profile'] as const
        : token && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER)
            ? ['teacher-profile'] as const
            : null;
    const { data: profile } = useSWR<TimetableProfile>(profileKey);

    const entriesByDay = useMemo(() => {
        const grouped = new Map<number, TimetableEntry[]>();
        WEEK_DAYS.forEach((day) => grouped.set(day, []));
        entries.forEach((entry) => {
            if (!grouped.has(entry.day)) grouped.set(entry.day, []);
            grouped.get(entry.day)?.push(entry);
        });
        grouped.forEach((dayEntries) => dayEntries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)));
        return grouped;
    }, [entries]);

    const slotGroupsByDay = useMemo(() => {
        const grouped = new Map<number, TimetableSlotGroup[]>();
        entriesByDay.forEach((dayEntries, day) => {
            const slotMap = new Map<string, TimetableSlotGroup>();
            dayEntries.forEach((entry) => {
                const key = `${entry.startTime}-${entry.endTime}`;
                const group = slotMap.get(key);
                if (group) {
                    group.entries.push(entry);
                } else {
                    slotMap.set(key, {
                        day,
                        startTime: entry.startTime,
                        endTime: entry.endTime,
                        entries: [entry],
                    });
                }
            });
            grouped.set(day, Array.from(slotMap.values()).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)));
        });
        return grouped;
    }, [entriesByDay]);

    const { startHour, endHour, timeSlots } = useMemo(() => {
        if (entries.length === 0) {
            return {
                startHour: DEFAULT_START_HOUR,
                endHour: DEFAULT_END_HOUR,
                timeSlots: Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR + 1 }, (_, index) => DEFAULT_START_HOUR + index),
            };
        }

        const startMinutes = Math.min(...entries.map((entry) => timeToMinutes(entry.startTime)));
        const endMinutes = Math.max(...entries.map((entry) => timeToMinutes(entry.endTime)));
        const firstHour = Math.max(0, Math.floor(startMinutes / 60));
        const lastHour = Math.min(24, Math.ceil(endMinutes / 60));
        return {
            startHour: firstHour,
            endHour: lastHour,
            timeSlots: Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index),
        };
    }, [entries]);

    const canOpenAttendance = user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER || user?.role === Role.ORG_ADMIN;
    const rowCount = Math.max(1, (endHour - startHour) * 2);
    const gridRows = `repeat(${rowCount}, ${TIMETABLE_HALF_HOUR_ROW_HEIGHT}px)`;
    const gridHeight = rowCount * TIMETABLE_HALF_HOUR_ROW_HEIGHT;
    const orgName = user?.orgName || PLATFORM_NAME;
    const logoUrl = getPublicUrl(user?.orgLogoUrl);
    const userName = user?.name || user?.email || 'Current user';
    const roleLabel = getRoleLabel(user?.role);
    const cohortName = getProfileCohortName(profile);
    const timetableSections = useMemo(() => getTimetableSections(entries, profile), [entries, profile]);

    const openAttendanceForEntry = (entry: TimetableEntry) => {
        if (!canOpenAttendance) return;
        const closestDate = getClosestDateForWeekday(entry.day);
        router.push(`/attendance/${entry.sectionId}?scheduleId=${entry.scheduleId}&date=${closestDate}`);
    };

    const handleDownloadTimetablePdf = async () => {
        if (entries.length === 0 || isGeneratingPdf) return;
        setIsGeneratingPdf(true);
        try {
            const blob = await createTimetablePdf({
                orgName,
                logoUrl,
                userName,
                roleLabel,
                cohortName,
                sections: timetableSections,
                entries,
                startHour,
                endHour,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            });
            downloadPdfBlob(blob, `${sanitizePdfFilename(userName, 'timetable')}-timetable.pdf`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="Weekly Timetable"
                description="A clear week view with time blocks sized by their real start and end times."
                icon={Clock}
                meta={<Badge variant="neutral" size="sm">{entries.length} slots</Badge>}
                actions={(
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            icon={Maximize2}
                            onClick={() => setIsFullscreenOpen(true)}
                            disabled={isLoading || Boolean(error) || entries.length === 0}
                        >
                            Fullscreen
                        </Button>
                        <Button
                            type="button"
                            icon={Download}
                            onClick={handleDownloadTimetablePdf}
                            isLoading={isGeneratingPdf}
                            loadingText="PDF"
                            disabled={isLoading || Boolean(error) || entries.length === 0}
                        >
                            PDF
                        </Button>
                    </>
                )}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Timetable' },
                ]}
            />

            {isLoading && entries.length === 0 ? (
                <TimetableSkeleton />
            ) : error ? (
                <ErrorState
                    error={error}
                    onRetry={() => mutate()}
                    title="Timetable could not load"
                    description="Weekly schedule data is unavailable right now."
                />
            ) : (
                <ResourcePanel>
                    {entries.length === 0 ? (
                        <EmptyState
                            icon={CalendarDays}
                            title="No timetable slots found"
                            description="Section schedules will appear here after they are configured."
                            className="min-h-96"
                        />
                    ) : (
                        <TimetableGrid
                            entriesByDay={entriesByDay}
                            slotGroupsByDay={slotGroupsByDay}
                            timeSlots={timeSlots}
                            startHour={startHour}
                            rowCount={rowCount}
                            gridRows={gridRows}
                            gridHeight={gridHeight}
                            canOpenAttendance={canOpenAttendance}
                            onOpenEntry={openAttendanceForEntry}
                        />
                    )}
                </ResourcePanel>
            )}

            {isFullscreenOpen && entries.length > 0 && (
                <ModalOverlay
                    isOpen={isFullscreenOpen}
                    onBack={() => setIsFullscreenOpen(false)}
                    maxWidth="max-w-none"
                    className="relative h-dvh max-h-dvh rounded-none border-0 bg-background text-foreground shadow-none"
                    overlayClassName="!items-stretch !justify-start !p-0 !backdrop-blur-none"
                    closeOnBackdrop={false}
                    mobileMode="full"
                    ariaLabel="Fullscreen timetable"
                >
                    <button
                        type="button"
                        onClick={() => setIsFullscreenOpen(false)}
                        className="absolute right-3 top-3 z-30 rounded-md border border-border/70 bg-card/95 p-2 text-muted-foreground shadow-lg transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        aria-label="Exit fullscreen timetable"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <TimetableContextHeader
                        orgName={orgName}
                        userName={userName}
                        roleLabel={roleLabel}
                        cohortName={cohortName}
                        sections={timetableSections}
                        slotsCount={entries.length}
                        actions={(
                            <div className="pr-12">
                                <Button
                                    type="button"
                                    icon={Download}
                                    onClick={handleDownloadTimetablePdf}
                                    isLoading={isGeneratingPdf}
                                    loadingText="PDF"
                                >
                                    PDF
                                </Button>
                            </div>
                        )}
                    />
                    <TimetableGrid
                        entriesByDay={entriesByDay}
                        slotGroupsByDay={slotGroupsByDay}
                        timeSlots={timeSlots}
                        startHour={startHour}
                        rowCount={rowCount}
                        gridRows={gridRows}
                        gridHeight={gridHeight}
                        canOpenAttendance={canOpenAttendance}
                        onOpenEntry={openAttendanceForEntry}
                        className="bg-background"
                    />
                </ModalOverlay>
            )}
        </PageShell>
    );
}
