'use client';

import React from 'react';
import useSWR from 'swr';
import { Section, SectionSchedule } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Skeleton } from '@/components/ui/Skeleton';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SectionScheduleSkeleton() {
    return (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-lg animate-in fade-in duration-500">
            <div className="p-4 md:p-6 bg-linear-to-br from-primary/5 via-transparent to-transparent border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                    <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
                <Skeleton className="w-10 h-10 rounded-lg" />
            </div>
            <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex flex-col gap-3 p-3 md:p-4 bg-muted/20 rounded-xl border border-border/50">
                        <div className="flex justify-between">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="w-1.5 h-1.5 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-2 w-24" />
                            <Skeleton className="h-2 w-20" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import { CalendarDays, Clock, MapPin, ChevronRight, Layers } from 'lucide-react';
import Link from 'next/link';

// Individual section card with its own schedule fetch
// This pattern avoids React hooks violation by calling useSWR at component level
function SectionScheduleCard({ section }: { section: Section; token: string }) {
    const { data: schedulesData, isLoading: schedulesLoading } = useSWR<{ data: SectionSchedule[] }>(
        ['schedules', section.id] as const
    );
    const schedules = schedulesData?.data || [];

    return (
        <div className="group bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-primary/5">
            <div className="p-4 md:p-6 bg-linear-to-br from-primary/5 via-transparent to-transparent border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg md:text-xl font-black tracking-tighter">{section.name}</h3>
                        <p className="text-[10px] font-black text-muted-foreground tracking-widest">{section.course?.name}</p>
                    </div>
                </div>
                <Link
                    href={`/sections/${section.id}`}
                    className="p-2 md:p-3 rounded-lg bg-muted/50 hover:bg-primary hover:text-primary-foreground transition-all group/btn"
                >
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
            </div>

            <div className="p-4 md:p-6 space-y-3 md:space-y-4">
                {schedulesLoading ? (
                    <div className="flex items-center justify-center p-4">
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="text-[10px] font-black tracking-[0.2em] text-muted-foreground/40 italic p-3 md:p-4 border border-dashed border-border/50 rounded-xl text-center">
                        No time-slots allocated for this section
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                        {schedules.map((schedule: SectionSchedule, idx: number) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 md:p-4 bg-muted/20 rounded-xl border border-border/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black tracking-widest text-primary">{DAY_NAMES[schedule.day]}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30"></div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-foreground">
                                        <Clock className="w-3.5 h-3.5 text-primary/60" />
                                        {schedule.startTime} - {schedule.endTime}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                                        <MapPin className="w-3.5 h-3.5 text-primary/60" />
                                        {schedule.room || section.room || 'Venue TBD'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SchedulesPage() {
    const { token } = useAuth();
    const { dispatch } = useGlobal();

    // Fetch all sections first
    const sectionsKey = token ? ['sections-for-schedules', { limit: 100 }] as const : null;
    const { data: sectionsData, isLoading: sectionsLoading, error: sectionsError } = useSWR<{ data: Section[] }>(sectionsKey);

    const sections = sectionsData?.data || [];

    // Show error toast
    React.useEffect(() => {
        if (sectionsError) {
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Failed to load schedules', type: 'error' }
            });
        }
    }, [sectionsError, dispatch]);

    if (sectionsLoading) {
        return (
            <div className="flex flex-col h-full w-full space-y-6 pb-6">
                <div className="bg-card/80 backdrop-blur-2xl rounded-xl shadow-xl border border-border p-4 md:p-6 overflow-hidden">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg w-fit">
                            <CalendarDays className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {[...Array(4)].map((_, i) => (
                            <SectionScheduleSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full space-y-6 pb-6">
            <div className="bg-card/80 backdrop-blur-2xl rounded-xl shadow-xl border border-border p-4 md:p-6 overflow-hidden">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg w-fit">
                        <CalendarDays className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-foreground">Global Schedules</h1>
                        <p className="text-muted-foreground mt-1 text-sm font-bold tracking-widest">Unified overview of all instructional timelines across the institution.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {sections.length === 0 ? (
                        <div className="col-span-full text-center py-16 bg-muted/10 border border-border/30 rounded-xl border-dashed">
                            <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Layers className="w-6 h-6 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm font-black tracking-widest opacity-40">No active academic sections detected.</p>
                        </div>
                    ) : (
                        sections.map((section) => (
                            <SectionScheduleCard key={section.id} section={section} token={token!} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
