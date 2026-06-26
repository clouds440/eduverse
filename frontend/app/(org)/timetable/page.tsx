'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { HolidayOverlay, HolidayType, Section, Student, Teacher, TimetableEntry, TimetableResponse, Role, Room, PaginatedResponse, ScheduleType } from '@/types';
import { Building2, CalendarDays, Clock, Download, Maximize2, MapPin, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { ModalOverlay } from '@/components/ui/Modal';
import { PageHeader, PageShell, ResourcePanel, type PageBreadcrumb } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { PLATFORM_NAME } from '@/lib/constants';
import { downloadPdfBlob, sanitizePdfFilename } from '@/lib/pdf/core';
import { createTimetablePdf, type TimetablePdfSectionSummary } from '@/lib/pdf/timetable';
import { getRoleLabel } from '@/lib/roles';
import { cn, formatCourseSectionLabel, formatRoomLabel, getPublicUrl, getSectionColor } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;
const TIMETABLE_HALF_HOUR_ROW_HEIGHT = 76;

interface TimetableSlotGroup {
    day: number;
    startTime: string;
    endTime: string;
    entries: TimetableEntry[];
}

interface TimetableBreak {
    day: number;
    startTime: string;
    endTime: string;
}

type TimetableProfile = Student | Teacher;
type TimetableViewMode = 'default' | 'teacher' | 'student' | 'room' | 'teacherRoom';

interface TimetableGridProps {
    entriesByDay: Map<number, TimetableEntry[]>;
    slotGroupsByDay: Map<number, TimetableSlotGroup[]>;
    breaksByDay: Map<number, TimetableBreak[]>;
    overlaysByDay: Map<number, HolidayOverlay[]>;
    timeSlots: number[];
    startHour: number;
    rowCount: number;
    gridRows: string;
    gridHeight: number;
    canOpenAttendance: boolean;
    onOpenEntry: (entry: TimetableEntry) => void;
    onOpenRoom: (roomId: string) => void;
    onOpenTeacher: (userId: string) => void;
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

function getTeacherLabel(entry: TimetableEntry) {
    if (!entry.teacherName) return 'Teacher TBD';
    const additionalCount = entry.additionalTeachersCount || 0;
    return additionalCount > 0 ? `${entry.teacherName}, ${additionalCount} more` : entry.teacherName;
}

function TeacherProfileButton({
    entry,
    onOpenTeacher,
    className,
}: {
    entry: TimetableEntry;
    onOpenTeacher: (userId: string) => void;
    className?: string;
}) {
    const label = getTeacherLabel(entry);

    if (!entry.teacherUserId) {
        return (
            <div className={cn('flex min-w-0 items-center gap-1.5 text-[10px] font-bold opacity-80', className)}>
                <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onOpenTeacher(entry.teacherUserId!)}
            className={cn(
                'flex min-w-0 items-center gap-1.5 rounded-sm text-left text-[10px] font-bold opacity-80 transition-colors hover:text-primary hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                className,
            )}
            title="View teacher profile"
        >
            <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate underline-offset-2 hover:underline">{label}</span>
        </button>
    );
}

function RoomLinkButton({
    entry,
    onOpenRoom,
    className,
}: {
    entry: TimetableEntry;
    onOpenRoom: (roomId: string) => void;
    className?: string;
}) {
    const label = entry.room || 'Room TBD';

    if (!entry.roomId) {
        return (
            <div className={cn('flex min-w-0 items-center gap-1.5 text-[10px] font-bold opacity-80', className)}>
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onOpenRoom(entry.roomId!)}
            className={cn(
                'flex min-w-0 items-center gap-1.5 rounded-sm text-left text-[10px] font-bold opacity-80 transition-colors hover:text-primary hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                className,
            )}
            title="View room in Campus Navigation"
        >
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate underline-offset-2 hover:underline">{label}</span>
        </button>
    );
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

function getHolidayTypeLabel(type: HolidayType) {
    switch (type) {
        case HolidayType.EXAM_BREAK:
            return 'Exam break';
        case HolidayType.EVENT:
            return 'Event';
        case HolidayType.CLOSURE:
            return 'Closure';
        default:
            return 'Holiday';
    }
}

function getHolidayOverlayStyle(overlay: HolidayOverlay): React.CSSProperties {
    const palette: Record<HolidayType, { bg: string; border: string; text: string }> = {
        [HolidayType.HOLIDAY]: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.42)', text: 'rgb(5,150,105)' },
        [HolidayType.EXAM_BREAK]: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.42)', text: 'rgb(37,99,235)' },
        [HolidayType.EVENT]: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.42)', text: 'rgb(126,34,206)' },
        [HolidayType.CLOSURE]: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.42)', text: 'rgb(220,38,38)' },
    };
    const colors = palette[overlay.type] || palette[HolidayType.HOLIDAY];
    return {
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
    };
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
                        <Badge variant="neutral" size="sm">{cohortName ? `Batch: ${cohortName}` : 'No batch'}</Badge>
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
    breaksByDay,
    overlaysByDay,
    timeSlots,
    startHour,
    rowCount,
    gridRows,
    gridHeight,
    canOpenAttendance,
    onOpenEntry,
    onOpenRoom,
    onOpenTeacher,
    className,
}: TimetableGridProps) {
    return (
        <div className={cn('min-h-0 flex-1 overflow-auto p-3 sm:p-4 custom-scrollbar', className)}>
            <div className="min-w-345">
                <div className="grid grid-cols-[96px_repeat(7,minmax(176px,1fr))] gap-2">
                    <div className="rounded-md border border-border/70 bg-card p-3 text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground shadow-sm">
                        Time
                    </div>
                    {WEEK_DAYS.map((day) => (
                        <div key={day} className="rounded-md border border-border/70 bg-card p-3 text-center shadow-sm">
                            <p className="text-sm font-black text-foreground">{DAY_NAMES[day]}</p>
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {(entriesByDay.get(day)?.length || 0) > 0
                                    ? `${entriesByDay.get(day)?.length || 0} slots`
                                    : (overlaysByDay.get(day)?.length || 0) > 0
                                        ? `${overlaysByDay.get(day)?.length || 0} calendar ${(overlaysByDay.get(day)?.length || 0) === 1 ? 'item' : 'items'}`
                                        : 'Off day'}
                            </p>
                        </div>
                    ))}

                    <div
                        className="grid overflow-hidden rounded-md border-x border-t border-border/70 bg-card shadow-sm"
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
                        const dayBreaks = breaksByDay.get(day) || [];
                        const dayOverlays = overlaysByDay.get(day) || [];
                        const fullDayOverlays = dayOverlays.filter((overlay) => overlay.isFullDay);
                        const partialOverlays = dayOverlays.filter((overlay) => !overlay.isFullDay && overlay.startTime && overlay.endTime);

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
                                    {dayEntries.length === 0 && fullDayOverlays.length === 0 && partialOverlays.length === 0 && (
                                        <div className="absolute inset-0 z-0 flex items-center justify-center px-4 text-center">
                                            <div className="rounded-md border border-dashed border-border/80 bg-muted/35 px-3 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                                                Off day
                                            </div>
                                        </div>
                                    )}
                                    {fullDayOverlays.length > 0 && (
                                        <div className="absolute inset-2 z-20 flex flex-col justify-center gap-2 rounded-md border border-dashed p-3 text-center shadow-sm backdrop-blur-sm" style={getHolidayOverlayStyle(fullDayOverlays[0])}>
                                            <CalendarDays className="mx-auto h-6 w-6 opacity-80" aria-hidden="true" />
                                            {fullDayOverlays.map((overlay) => (
                                                <div key={overlay.id} className="min-w-0">
                                                    <p className="truncate text-sm font-black">{overlay.title}</p>
                                                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide opacity-75">
                                                        {getHolidayTypeLabel(overlay.type)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {dayBreaks.map((dayBreak) => {
                                        const startOffset = Math.max(0, timeToMinutes(dayBreak.startTime) - startHour * 60);
                                        const duration = Math.max(30, timeToMinutes(dayBreak.endTime) - timeToMinutes(dayBreak.startTime));
                                        const rowStart = Math.floor(startOffset / 30) + 1;
                                        const rowSpan = Math.max(1, Math.ceil(duration / 30));

                                        return (
                                            <div
                                                key={`${day}-break-${dayBreak.startTime}-${dayBreak.endTime}`}
                                                className="pointer-events-none z-0 m-1 flex items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/35 px-2 text-center"
                                                style={{ gridRow: `${rowStart} / span ${rowSpan}` }}
                                            >
                                                <span className="truncate text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                                                    Break {dayBreak.startTime} - {dayBreak.endTime}
                                                </span>
                                            </div>
                                        );
                                    })}
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
                                                    <div
                                                        className="grid min-h-0 flex-1 gap-1 p-1"
                                                        style={{ gridTemplateRows: `repeat(${Math.max(1, slot.entries.length)}, minmax(0, 1fr))` }}
                                                    >
                                                        {slot.entries.map((entry) => (
                                                            <div
                                                                key={entry.scheduleId}
                                                                className="flex min-h-0 w-full items-start gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-left"
                                                                style={getTimetableCardStyle(entry)}
                                                            >
                                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onOpenEntry(entry)}
                                                                        className={`min-w-0 w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${canOpenAttendance ? 'cursor-pointer hover:brightness-105' : 'cursor-default'}`}
                                                                    >
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
                                                                        {entry.type === ScheduleType.AD_HOC && (
                                                                            <Badge variant="warning" size="xs" className="mt-1 w-fit">Ad-hoc</Badge>
                                                                        )}
                                                                        <p className="mt-0.5 truncate text-[10px] font-bold opacity-75">{slot.startTime} - {slot.endTime}</p>
                                                                    </button>
                                                                    <RoomLinkButton entry={entry} onOpenRoom={onOpenRoom} className="mt-0.5 w-full" />
                                                                    <TeacherProfileButton entry={entry} onOpenTeacher={onOpenTeacher} className="mt-0.5 w-full" />
                                                                </div>
                                                                <div className="flex shrink-0 flex-col items-end gap-1">
                                                                    <Badge variant="neutral" size="xs" className="bg-white/70 h-fit text-foreground dark:bg-black/25">
                                                                        {durationLabel}
                                                                    </Badge>
                                                                </div>
                                                            </div>
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
                                                        <div
                                                            className="grid min-h-0 flex-1 gap-1 border-l-4 border-primary/45 p-1.5"
                                                            style={{ gridTemplateRows: `repeat(${Math.max(1, slot.entries.length)}, minmax(0, 1fr))` }}
                                                        >
                                                            {slot.entries.map((entry) => (
                                                                <div
                                                                    key={entry.scheduleId}
                                                                    className="flex min-h-0 w-full flex-col items-start overflow-hidden rounded-md border p-2 text-left"
                                                                    style={getTimetableCardStyle(entry)}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onOpenEntry(entry)}
                                                                        className={`grid min-h-0 w-full flex-1 grid-row-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${canOpenAttendance ? 'cursor-pointer hover:brightness-105' : 'cursor-default'}`}
                                                                    >
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
                                                                        {entry.type === ScheduleType.AD_HOC && (
                                                                            <Badge variant="warning" size="xs" className="mt-1 w-fit">Ad-hoc</Badge>
                                                                        )}
                                                                    </button>
                                                                    <RoomLinkButton entry={entry} onOpenRoom={onOpenRoom} className="mt-1.5 w-full border-t border-current/15 pt-1.5" />
                                                                    <TeacherProfileButton entry={entry} onOpenTeacher={onOpenTeacher} className="mt-1 w-full" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {partialOverlays.map((overlay) => {
                                        const startOffset = Math.max(0, timeToMinutes(overlay.startTime || '00:00') - startHour * 60);
                                        const duration = Math.max(30, timeToMinutes(overlay.endTime || '00:30') - timeToMinutes(overlay.startTime || '00:00'));
                                        const rowStart = Math.floor(startOffset / 30) + 1;
                                        const rowSpan = Math.max(1, Math.ceil(duration / 30));

                                        return (
                                            <div
                                                key={overlay.id}
                                                className="z-20 m-1 flex min-h-0 flex-col justify-center overflow-hidden rounded-md border border-dashed px-2.5 py-2 text-center shadow-sm backdrop-blur-sm"
                                                style={{ ...getHolidayOverlayStyle(overlay), gridRow: `${rowStart} / span ${rowSpan}` }}
                                            >
                                                <p className="truncate text-[11px] font-black">{overlay.title}</p>
                                                <p className="mt-0.5 truncate text-[10px] font-bold opacity-75">
                                                    {overlay.startTime} - {overlay.endTime} - {getHolidayTypeLabel(overlay.type)}
                                                </p>
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

interface StudentTimetableViewProps {
    studentId?: string;
    batchName?: string | null;
    headerActions?: React.ReactNode;
    breadcrumbs?: PageBreadcrumb[];
    title?: string;
    description?: React.ReactNode;
}

export function StudentTimetableView({
    studentId,
    batchName,
    headerActions,
    breadcrumbs = [
        { label: 'Organization' },
        { label: 'Academics' },
        { label: 'Timetable' },
    ],
    title = 'Weekly Timetable',
    description = 'A clear week view with time blocks sized by their real start and end times.',
}: StudentTimetableViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { token, user } = useAuth();
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const initialDate = searchParams.get('date') || toLocalDateInputValue(new Date());
    const initialTeacherId = searchParams.get('teacherId') || '';
    const initialRoomId = searchParams.get('roomId') || '';
    const initialStudentId = studentId || searchParams.get('studentId') || '';
    const initialView: TimetableViewMode = initialTeacherId && initialRoomId
        ? 'teacherRoom'
        : initialTeacherId
            ? 'teacher'
            : initialRoomId
                ? 'room'
                : initialStudentId && !studentId
                    ? 'student'
                    : 'default';
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [viewMode, setViewMode] = useState<TimetableViewMode>(initialView);
    const [selectedTeacherId, setSelectedTeacherId] = useState(initialTeacherId);
    const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
    const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);

    const { data: teachers = [] } = useSWR<Teacher[]>(token && user ? ['timetable-teachers', { limit: 250 }] as const : null);
    const { data: students = [] } = useSWR<Student[]>(token && user ? ['timetable-students', { limit: 250 }] as const : null);
    const { data: roomsData } = useSWR<PaginatedResponse<Room>>(token && user ? ['rooms', { limit: 1000, isActive: true }] as const : null);
    const teacherOptions = useMemo(() => [
        { value: '', label: 'Select teacher', icon: UserRound },
        ...teachers.map((teacher) => ({
            value: teacher.id,
            label: teacher.user?.name || teacher.user?.email || teacher.subject || 'Unnamed teacher',
            icon: UserRound,
        })),
    ], [teachers]);
    const studentOptions = useMemo(() => [
        { value: '', label: 'Select student', icon: Users },
        ...students.map((student) => ({
            value: student.id,
            label: student.user?.name || student.user?.email || student.rollNumber || 'Unnamed student',
            icon: Users,
        })),
    ], [students]);
    const roomOptions = useMemo(() => [
        { value: '', label: 'Select room', icon: Building2 },
        ...(roomsData?.data || []).map((room) => ({
            value: room.id,
            label: formatRoomLabel(room),
            icon: Building2,
        })),
    ], [roomsData?.data]);
    const selectedTeacherLabel = teacherOptions.find((option) => option.value === selectedTeacherId)?.label || 'Teacher timetable';
    const selectedStudentLabel = studentOptions.find((option) => option.value === selectedStudentId)?.label || 'Student timetable';
    const selectedRoomLabel = roomOptions.find((option) => option.value === selectedRoomId)?.label || 'Room timetable';
    const fixedStudentId = studentId || '';
    const timetableParams = useMemo(() => ({
        date: selectedDate,
        ...(fixedStudentId ? { studentId: fixedStudentId } : {}),
        ...(viewMode === 'student' && selectedStudentId ? { studentId: selectedStudentId } : {}),
        ...((viewMode === 'teacher' || viewMode === 'teacherRoom') && selectedTeacherId ? { teacherId: selectedTeacherId } : {}),
        ...((viewMode === 'room' || viewMode === 'teacherRoom') && selectedRoomId ? { roomId: selectedRoomId } : {}),
    }), [fixedStudentId, selectedDate, selectedRoomId, selectedStudentId, selectedTeacherId, viewMode]);
    const hasRequiredTarget = viewMode === 'default'
        || Boolean(fixedStudentId)
        || (viewMode === 'teacher' && selectedTeacherId)
        || (viewMode === 'student' && selectedStudentId)
        || (viewMode === 'room' && selectedRoomId)
        || (viewMode === 'teacherRoom' && selectedTeacherId && selectedRoomId);
    const timetableKey = token && user && hasRequiredTarget ? ['timetable', timetableParams] as const : null;
    const { data: timetableData, isLoading, error, mutate } = useSWR<TimetableResponse>(timetableKey);
    const profileKey = token && user?.role === Role.STUDENT
        ? ['student-profile', user.id] as const
        : token && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER)
            ? ['teacher-profile'] as const
            : null;
    const { data: profile } = useSWR<TimetableProfile>(profileKey);
    const entries = useMemo(() => timetableData?.schedules || [], [timetableData?.schedules]);
    const overlays = useMemo(() => timetableData?.overlays || [], [timetableData?.overlays]);
    const coveredScheduleIds = useMemo(() => new Set(overlays.flatMap((overlay) => overlay.coveredScheduleIds)), [overlays]);
    const visibleEntries = useMemo(() => entries.filter((entry) => !coveredScheduleIds.has(entry.scheduleId)), [coveredScheduleIds, entries]);

    const entriesByDay = useMemo(() => {
        const grouped = new Map<number, TimetableEntry[]>();
        WEEK_DAYS.forEach((day) => grouped.set(day, []));
        visibleEntries.forEach((entry) => {
            if (!grouped.has(entry.day)) grouped.set(entry.day, []);
            grouped.get(entry.day)?.push(entry);
        });
        grouped.forEach((dayEntries) => dayEntries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)));
        return grouped;
    }, [visibleEntries]);

    const overlaysByDay = useMemo(() => {
        const grouped = new Map<number, HolidayOverlay[]>();
        WEEK_DAYS.forEach((day) => grouped.set(day, []));
        overlays.forEach((overlay) => {
            if (!grouped.has(overlay.day)) grouped.set(overlay.day, []);
            grouped.get(overlay.day)?.push(overlay);
        });
        grouped.forEach((dayOverlays) => dayOverlays.sort((a, b) => {
            const aStart = a.startTime ? timeToMinutes(a.startTime) : -1;
            const bStart = b.startTime ? timeToMinutes(b.startTime) : -1;
            return aStart - bStart || a.title.localeCompare(b.title);
        }));
        return grouped;
    }, [overlays]);

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

    const breaksByDay = useMemo(() => {
        const grouped = new Map<number, TimetableBreak[]>();
        WEEK_DAYS.forEach((day) => {
            const slots = slotGroupsByDay.get(day) || [];
            const dayBreaks: TimetableBreak[] = [];

            for (let index = 0; index < slots.length - 1; index += 1) {
                const currentEnd = timeToMinutes(slots[index].endTime);
                const nextStart = timeToMinutes(slots[index + 1].startTime);
                if (nextStart > currentEnd) {
                    dayBreaks.push({
                        day,
                        startTime: slots[index].endTime,
                        endTime: slots[index + 1].startTime,
                    });
                }
            }

            grouped.set(day, dayBreaks);
        });
        return grouped;
    }, [slotGroupsByDay]);

    const { startHour, endHour, timeSlots } = useMemo(() => {
        const timeRanges = [
            ...visibleEntries.map((entry) => ({ startTime: entry.startTime, endTime: entry.endTime })),
            ...overlays
                .filter((overlay) => !overlay.isFullDay && overlay.startTime && overlay.endTime)
                .map((overlay) => ({ startTime: overlay.startTime as string, endTime: overlay.endTime as string })),
        ];

        if (timeRanges.length === 0) {
            return {
                startHour: DEFAULT_START_HOUR,
                endHour: DEFAULT_END_HOUR,
                timeSlots: Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR + 1 }, (_, index) => DEFAULT_START_HOUR + index),
            };
        }

        const startMinutes = Math.min(...timeRanges.map((range) => timeToMinutes(range.startTime)));
        const endMinutes = Math.max(...timeRanges.map((range) => timeToMinutes(range.endTime)));
        const firstHour = Math.max(0, Math.floor(startMinutes / 60));
        const lastHour = Math.min(24, Math.ceil(endMinutes / 60));
        return {
            startHour: firstHour,
            endHour: lastHour,
            timeSlots: Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index),
        };
    }, [overlays, visibleEntries]);

    const canOpenAttendance = user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER || user?.role === Role.ORG_ADMIN;
    const rowCount = Math.max(1, (endHour - startHour) * 2);
    const gridRows = `repeat(${rowCount}, ${TIMETABLE_HALF_HOUR_ROW_HEIGHT}px)`;
    const gridHeight = rowCount * TIMETABLE_HALF_HOUR_ROW_HEIGHT;
    const orgName = user?.orgName || PLATFORM_NAME;
    const logoUrl = getPublicUrl(user?.orgLogoUrl);
    const defaultContextName = user?.name || user?.email || 'Current user';
    const contextName = viewMode === 'teacher'
        ? selectedTeacherLabel
        : viewMode === 'student'
            ? selectedStudentLabel
            : viewMode === 'room'
                ? selectedRoomLabel
                : viewMode === 'teacherRoom'
                    ? `${selectedTeacherLabel} + ${selectedRoomLabel}`
                    : defaultContextName;
    const roleLabel = viewMode === 'teacher'
        ? 'Teacher'
        : viewMode === 'student'
            ? 'Student'
            : viewMode === 'room'
                ? 'Room'
                : viewMode === 'teacherRoom'
                    ? 'Teacher + Room'
                    : getRoleLabel(user?.role);
    const cohortName = batchName ?? getProfileCohortName(profile);
    const timetableSections = useMemo(() => getTimetableSections(entries, profile), [entries, profile]);

    const openAttendanceForEntry = (entry: TimetableEntry) => {
        if (!canOpenAttendance) return;
        const closestDate = entry.date || selectedDate || getClosestDateForWeekday(entry.day);
        router.push(`/attendance/${entry.sectionId}?scheduleId=${entry.scheduleId}&date=${closestDate}`);
    };

    const openCampusRoom = (roomId: string) => {
        router.push(`/campus-navigation?roomId=${encodeURIComponent(roomId)}`);
    };

    const openTeacherProfile = (userId: string) => {
        router.push(`/profiles/${userId}`);
    };

    const handleDownloadTimetablePdf = async () => {
        if (entries.length === 0 || isGeneratingPdf) return;
        setIsGeneratingPdf(true);
        try {
            const blob = await createTimetablePdf({
                orgName,
                logoUrl,
                userName: contextName,
                roleLabel,
                cohortName,
                sections: timetableSections,
                entries,
                startHour,
                endHour,
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            });
            downloadPdfBlob(blob, `${sanitizePdfFilename(contextName, 'timetable')}-timetable.pdf`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    const canSwitchViews = !fixedStudentId && (
        user?.role === Role.ORG_ADMIN ||
        user?.role === Role.SUB_ADMIN ||
        user?.role === Role.ORG_MANAGER ||
        user?.role === Role.TEACHER ||
        user?.role === Role.STUDENT
    );
    const viewOptions = [
        { value: 'default' as const, label: user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN ? 'Organization timetable' : 'My timetable', icon: Clock },
        { value: 'teacher' as const, label: 'Teacher timetable', icon: UserRound },
        { value: 'room' as const, label: 'Room timetable', icon: Building2 },
        { value: 'teacherRoom' as const, label: 'Teacher + room', icon: MapPin },
        { value: 'student' as const, label: 'Student timetable', icon: Users },
    ];

    return (
        <PageShell>
            <PageHeader
                title={title}
                description={description}
                icon={Clock}
                meta={<Badge variant="neutral" size="sm">{entries.length} slots{overlays.length > 0 ? ` · ${overlays.length} calendar` : ''}</Badge>}
                actions={(
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        {headerActions}
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            className="h-10 min-w-40"
                        />
                        {canSwitchViews && (
                            <CustomSelect<TimetableViewMode>
                                value={viewMode}
                                onChange={(value) => setViewMode(value)}
                                options={viewOptions}
                                className="min-w-52"
                            />
                        )}
                        {canSwitchViews && (viewMode === 'teacher' || viewMode === 'teacherRoom') && (
                            <CustomSelect
                                value={selectedTeacherId}
                                onChange={setSelectedTeacherId}
                                options={teacherOptions}
                                placeholder="Select teacher"
                                searchable
                                className="min-w-56"
                            />
                        )}
                        {canSwitchViews && (viewMode === 'room' || viewMode === 'teacherRoom') && (
                            <CustomSelect
                                value={selectedRoomId}
                                onChange={setSelectedRoomId}
                                options={roomOptions}
                                placeholder="Select room"
                                searchable
                                className="min-w-56"
                            />
                        )}
                        {canSwitchViews && viewMode === 'student' && (
                            <CustomSelect
                                value={selectedStudentId}
                                onChange={setSelectedStudentId}
                                options={studentOptions}
                                placeholder="Select student"
                                searchable
                                className="min-w-56"
                            />
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            icon={Maximize2}
                            onClick={() => setIsFullscreenOpen(true)}
                            disabled={isLoading || Boolean(error) || (entries.length === 0 && overlays.length === 0)}
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
                    </div>
                )}
                breadcrumbs={breadcrumbs}
            />

            {isLoading && entries.length === 0 && overlays.length === 0 ? (
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
                    {entries.length === 0 && overlays.length === 0 ? (
                        <EmptyState
                            icon={CalendarDays}
                            title="No timetable slots found"
                            description="Section schedules and academic calendar overlays will appear here after they are configured."
                            className="min-h-96"
                        />
                    ) : (
                        <TimetableGrid
                            entriesByDay={entriesByDay}
                            slotGroupsByDay={slotGroupsByDay}
                            breaksByDay={breaksByDay}
                            overlaysByDay={overlaysByDay}
                            timeSlots={timeSlots}
                            startHour={startHour}
                            rowCount={rowCount}
                            gridRows={gridRows}
                            gridHeight={gridHeight}
                            canOpenAttendance={canOpenAttendance}
                            onOpenEntry={openAttendanceForEntry}
                            onOpenRoom={openCampusRoom}
                            onOpenTeacher={openTeacherProfile}
                        />
                    )}
                </ResourcePanel>
            )}

            {isFullscreenOpen && (entries.length > 0 || overlays.length > 0) && (
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
                        userName={contextName}
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
                        breaksByDay={breaksByDay}
                        overlaysByDay={overlaysByDay}
                        timeSlots={timeSlots}
                        startHour={startHour}
                        rowCount={rowCount}
                        gridRows={gridRows}
                        gridHeight={gridHeight}
                        canOpenAttendance={canOpenAttendance}
                        onOpenEntry={openAttendanceForEntry}
                        onOpenRoom={openCampusRoom}
                        onOpenTeacher={openTeacherProfile}
                        className="bg-background"
                    />
                </ModalOverlay>
            )}
        </PageShell>
    );
}

export default function TimetablePage() {
    return <StudentTimetableView />;
}
