'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { TimetableEntry, Role } from '@/types';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { getSectionColor } from '@/lib/utils';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

interface TimetableSlotGroup {
    day: number;
    startTime: string;
    endTime: string;
    entries: TimetableEntry[];
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

function getTimetableCardStyle(entry: TimetableEntry): React.CSSProperties {
    const hex = getSectionColor(entry);
    return {
        backgroundColor: `${hex}18`,
        borderColor: `${hex}66`,
        color: hex,
    };
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

export default function TimetablePage() {
    const router = useRouter();
    const { token, user } = useAuth();

    const timetableKey = token && user ? ['timetable', user.id, user.role] as const : null;
    const { data: entries = [], isLoading, error, mutate } = useSWR<TimetableEntry[]>(timetableKey);

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
    const gridRows = `repeat(${rowCount}, 44px)`;

    return (
        <PageShell>
            <PageHeader
                title="Weekly Timetable"
                description="A clear week view with time blocks sized by their real start and end times."
                icon={Clock}
                meta={<Badge variant="neutral" size="sm">{entries.length} slots</Badge>}
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
                        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 custom-scrollbar">
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
                                        className="sticky left-0 z-10 grid overflow-hidden rounded-md border border-border/70 bg-card shadow-sm"
                                        style={{ gridTemplateRows: gridRows }}
                                    >
                                        {timeSlots.slice(0, -1).map((hour) => (
                                            <div key={hour} className="row-span-2 flex items-start justify-center border-b-2 border-border/80 px-2 py-2 last:border-b-0">
                                                <span className="text-xs font-black text-muted-foreground">{formatHour(hour)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {WEEK_DAYS.map((day) => (
                                        <div
                                            key={day}
                                            className="relative grid overflow-hidden rounded-md border border-border/70 bg-background shadow-sm"
                                            style={{ gridTemplateRows: gridRows }}
                                        >
                                            {Array.from({ length: rowCount }).map((_, index) => (
                                                <div
                                                    key={index}
                                                    className={`last:border-b-0 ${index % 2 === 1 ? 'border-b-2 border-border/80 bg-background' : 'border-b border-border/30 bg-muted/20'}`}
                                                />
                                            ))}

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
                                                                {slot.entries.map((entry) => {
                                                                    return (
                                                                        <button
                                                                            key={entry.scheduleId}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (!canOpenAttendance) return;
                                                                                const closestDate = getClosestDateForWeekday(entry.day);
                                                                                router.push(`/attendance/${entry.sectionId}?scheduleId=${entry.scheduleId}&date=${closestDate}`);
                                                                            }}
                                                                            className={`flex h-full w-full items-center cursor-pointer gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${canOpenAttendance ? 'hover:brightness-105' : 'cursor-default'}`}
                                                                            style={getTimetableCardStyle(entry)}
                                                                        >
                                                                            <div className="min-w-0 flex-1">
                                                                                <CourseSectionLabel
                                                                                    section={{
                                                                                        name: entry.sectionName,
                                                                                        color: entry.color,
                                                                                        course: { name: entry.courseName },
                                                                                    }}
                                                                                    as="p"
                                                                                    className="text-xs font-black leading-tight"
                                                                                />
                                                                                <p className="mt-0.5 flex truncate text-[10px] font-bold opacity-75">{slot.startTime} - {slot.endTime}
                                                                                    <MapPin className="h-3 w-3 ml-1 shrink-0" aria-hidden="true" />
                                                                                    <span className="truncate">{entry.room || 'Room TBD'}</span>
                                                                                </p>

                                                                            </div>
                                                                            <Badge variant="neutral" size="xs" className="shrink-0 bg-white/70 text-foreground dark:bg-black/25">
                                                                                {durationLabel}
                                                                            </Badge>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/45 px-2.5 py-1.5">
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
                                                                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto border-l-4 border-primary/45 p-1.5 custom-scrollbar">
                                                                    {slot.entries.map((entry) => {
                                                                        return (
                                                                            <button
                                                                                key={entry.scheduleId}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (!canOpenAttendance) return;
                                                                                    const closestDate = getClosestDateForWeekday(entry.day);
                                                                                    router.push(`/attendance/${entry.sectionId}?scheduleId=${entry.scheduleId}&date=${closestDate}`);
                                                                                }}
                                                                                className={`w-full h-full rounded-md cursor-pointer border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${canOpenAttendance ? 'hover:brightness-105' : 'cursor-default'}`}
                                                                                style={getTimetableCardStyle(entry)}
                                                                            >
                                                                                <CourseSectionLabel
                                                                                    section={{
                                                                                        name: entry.sectionName,
                                                                                        color: entry.color,
                                                                                        course: { name: entry.courseName },
                                                                                    }}
                                                                                    as="p"
                                                                                    className="line-clamp-2 text-xs font-black leading-tight"
                                                                                />
                                                                                <p className="mt-0.5 truncate text-[11px] font-semibold opacity-80">{entry.courseName}</p>
                                                                                <div className="mt-1.5 flex min-w-0 items-center gap-1.5 border-t border-current/15 pt-1.5 text-[10px] font-bold opacity-80">
                                                                                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                                                    <span className="truncate">{entry.room || 'Room TBD'}</span>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </ResourcePanel>
            )}
        </PageShell>
    );
}
