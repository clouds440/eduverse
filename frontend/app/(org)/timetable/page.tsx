'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { TimetableEntry, Role } from '@/types';
import { Clock, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageShell';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACADEMIC_DAYS = [1, 2, 3, 4, 5]; // Mon - Fri
const START_HOUR = 8;
const END_HOUR = 18;

const SECTION_COLORS = [
    'bg-primary/10 text-primary border-primary/20 dark:border-primary/40',
    'bg-success/10 text-success border-success/20 dark:border-success/40',
    'bg-warning/10 text-warning border-warning/20 dark:border-warning/40',
    'bg-danger/10 text-danger border-danger/20 dark:border-danger/40',
    'bg-info/10 text-info border-info/20 dark:border-info/40',
    'bg-secondary/10 text-secondary-foreground border-secondary/20 dark:border-secondary/40',
    'bg-primary/5 text-primary/80 border-primary/10 dark:border-primary/20',
    'bg-info/5 text-info/80 border-info/10 dark:border-info/20',
    'bg-neutral/10 text-neutral border-neutral/20 dark:border-neutral/40',
];

const getSectionColor = (id: string) => {
    if (!id) return SECTION_COLORS[0];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        // Use a more complex hash multiplier to avoid early collisions
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }

    // Use a secondary salt for better distribution
    const salt = (id.length * 31);
    const index = Math.abs(hash + salt) % SECTION_COLORS.length;
    return SECTION_COLORS[index];
};

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

        if (
            Math.abs(offset) < Math.abs(bestOffset) ||
            (Math.abs(offset) === Math.abs(bestOffset) && offset >= 0)
        ) {
            bestOffset = offset;
        }
    }

    const closestDate = new Date(today);
    closestDate.setDate(today.getDate() + bestOffset);
    return toLocalDateInputValue(closestDate);
};

export default function TimetablePage() {
    const router = useRouter();
    const { token, user } = useAuth();

    // SWR for timetable data
    const timetableKey = token && user ? ['timetable', user.id, user.role] as const : null;
    const { data: entries = [], isLoading: loading, error } = useSWR<TimetableEntry[]>(timetableKey);

    const timeSlots = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

    if (loading && entries.length === 0) return (
        <div className="flex flex-col h-full w-full space-y-6 pb-6">
            <PageHeader
                title="Weekly Timetable"
                description="Comprehensive visualization of instructional hours and room allocations."
                icon={Clock}
            />
            <div className="bg-card/80 backdrop-blur-2xl rounded-xl shadow-xl border border-border p-4 md:p-6 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-auto pr-2 scrollbar-hide border border-border/50 rounded-xl bg-muted/5 p-4">
                    <div className="min-w-200">
                        {/* Header Skeleton */}
                        <div className="grid grid-cols-[80px_repeat(5,1fr)] mb-4">
                            <div className="p-2 border-r border-border/50">
                                <Skeleton className="h-3 w-12" />
                            </div>
                            {ACADEMIC_DAYS.map((_, i) => (
                                <div key={i} className="p-3 flex flex-col items-center justify-center border-b-2 border-primary/20 bg-primary/5 rounded-t-lg mx-1">
                                    <Skeleton className="h-4 w-16 mb-1" />
                                    <Skeleton className="w-4 h-0.5 rounded-full" />
                                </div>
                            ))}
                        </div>

                        {/* Body Skeleton */}
                        {timeSlots.map((_, hourIdx) => (
                            <div key={hourIdx} className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-border/30 last:border-b-0 min-h-20">
                                {/* Time Cell Skeleton */}
                                <div className="flex flex-col items-center justify-center border-r border-border/50 pr-2 md:pr-4 bg-muted/5">
                                    <Skeleton className="h-6 w-8 mb-1" />
                                    <Skeleton className="h-2 w-8" />
                                </div>

                                {/* Day Cells Skeleton */}
                                {ACADEMIC_DAYS.map((_, dayIdx) => (
                                    <div key={`${hourIdx}-${dayIdx}`} className="p-2 h-full">
                                        <Skeleton className="h-full w-full rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    if (error) return (
        <div className="bg-destructive/10 border border-destructive/20 p-8 rounded-3xl text-destructive text-center">
            <h2 className="text-2xl font-black italic tracking-tighter mb-2">System Error</h2>
            <p className="font-bold opacity-70 tracking-widest text-sm">{error.message || 'Failed to load timetable'}</p>
        </div>
    );

    const getEntryForSlot = (day: number, hour: number) => {
        return entries.find(e => {
            if (e.day !== day) return false;
            const startH = parseInt(e.startTime.split(':')[0], 10);
            const endH = parseInt(e.endTime.split(':')[0], 10);
            return hour >= startH && hour < endH;
        });
    };

    return (
        <div className="flex flex-col h-full w-full space-y-6 pb-6">
            <PageHeader
                title="Weekly Timetable"
                description="Comprehensive visualization of instructional hours and room allocations."
                icon={Clock}
                meta={(
                    <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-black tracking-widest text-primary">
                        Academic Schedule
                    </span>
                )}
            />
            <div className="bg-card/80 backdrop-blur-2xl rounded-xl shadow-xl border border-border p-4 md:p-6 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-auto pr-2 scrollbar-hide border border-border/50 rounded-xl bg-muted/5 p-4">
                    <div className="min-w-200">
                        {/* Header */}
                        <div className="grid grid-cols-[80px_repeat(5,1fr)] mb-4">
                            <div className="p-2 border-r border-border/50 flex items-center justify-center">
                                <span className="text-[10px] font-black tracking-widest opacity-40">Time</span>
                            </div>
                            {ACADEMIC_DAYS.map(dayIdx => (
                                <div key={dayIdx} className="p-3 flex flex-col items-center justify-center border-b-2 border-primary/20 bg-primary/5 rounded-t-lg mx-1">
                                    <span className="text-xs md:text-sm font-black tracking-widest">{DAY_NAMES[dayIdx]}</span>
                                    <div className="mt-1 w-4 h-0.5 bg-primary/40 rounded-full"></div>
                                </div>
                            ))}
                        </div>

                        {/* Body */}
                        {timeSlots.map(hour => (
                            <div key={hour} className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-border/30 last:border-b-0 min-h-20">
                                {/* Time Cell */}
                                <div className="flex flex-col items-center justify-center border-r border-border/50 pr-2 md:pr-4 bg-muted/5">
                                    <span className="text-lg md:text-xl font-black tracking-tighter leading-none">{hour > 12 ? hour - 12 : hour}</span>
                                    <span className="text-[9px] font-black opacity-40 mt-1 tracking-widest">{hour >= 12 ? 'PM' : 'AM'}</span>
                                </div>

                                {/* Day Cells */}
                                {ACADEMIC_DAYS.map(dayIdx => {
                                    const entry = getEntryForSlot(dayIdx, hour);
                                    if (entry) {
                                        const colorClass = getSectionColor(entry.sectionId);
                                        return (
                                            <div key={`${hour}-${dayIdx}`} className="p-2 h-full flex flex-col">
                                                <div
                                                    onClick={() => {
                                                        if (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER || user?.role === Role.ORG_ADMIN) {
                                                            const closestDate = getClosestDateForWeekday(entry.day);
                                                            router.push(`/attendance/${entry.sectionId}?scheduleId=${entry.scheduleId}&date=${closestDate}`);
                                                        }
                                                    }}
                                                    className={`flex-1 p-2 md:p-3 rounded-lg border ${colorClass} shadow-sm group hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between overflow-hidden relative cursor-pointer`}
                                                >
                                                    <div className="absolute -right-2 -top-2 opacity-5 scale-150 rotate-12">
                                                        <Clock className="w-12 h-12 md:w-16 md:h-16" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black tracking-widest opacity-60 mb-1">{entry.sectionName}</div>
                                                        <div className="text-xs font-black tracking-tighter leading-tight wrap-break-word">{entry.courseName}</div>
                                                    </div>
                                                    <div className="mt-2 md:mt-3 flex items-center justify-between gap-2 border-t border-current/10 pt-2">
                                                        <div className="flex items-center gap-1 opacity-70">
                                                            <MapPin className="w-2.5 h-2.5" />
                                                            <span className="text-[9px] font-black tracking-widest truncate max-w-15">{entry.room || 'TBD'}</span>
                                                        </div>
                                                        <span className="text-[9px] font-black opacity-40">{entry.startTime}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={`${hour}-${dayIdx}`} className="p-2 h-full group">
                                            <div className="flex-1 rounded-lg border border-dashed border-border/30 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity bg-muted/2 shadow-inner">
                                                <span className="text-[10px] font-black tracking-[0.2em] italic">Unallotted slot</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
