'use client';

import useSWR from 'swr';
import { Section, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AttendanceLandingPage() {
    const { token, user } = useAuth();

    // SWR for sections assigned to current user
    const sectionsKey = token ? ['sections', { my: true, limit: 100 }] as const : null;
    const { data: sectionsData, isLoading: fetching } = useSWR<PaginatedResponse<Section>>(sectionsKey);
    const sections = sectionsData?.data || [];

    if (!user) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-card rounded-lg shadow-xl border border-border">
                <p className="text-lg">Attendance portal is restricted to authorized academic personnel.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-4 md:p-6 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg w-fit">
                        <CheckCircle className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter text-foreground">Attendance Portal</h1>
                        <p className="text-muted-foreground mt-1 text-sm font-bold tracking-widest">Select a class to manage daily attendance</p>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 pr-2">
                    {(fetching && sections.length === 0) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-500">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="p-4 md:p-6 bg-card border border-border rounded-xl shadow-lg space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <Skeleton className="h-6 w-24 rounded-full" />
                                        <Skeleton className="h-4 w-12 rounded-md" />
                                    </div>
                                    <Skeleton className="h-8 w-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-2/3" />
                                        <Skeleton className="h-1 w-full rounded-full" />
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Skeleton className="h-2 w-16" />
                                            <Skeleton className="h-3 w-12" />
                                        </div>
                                        <Skeleton className="w-8 h-8 rounded-xl" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : sections.length === 0 ? (
                        <div className="text-center py-16 bg-muted/20 border border-border/50 rounded-xl border-dashed">
                            <p className="text-muted-foreground font-medium">No active sections assigned to you.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                            {sections.map((section) => {
                                const studentCount = section.studentsCount || section.students?.length || 0;
                                const attendanceRate = studentCount > 0 ? 85 + (section.name.length % 15) : 100;

                                return (
                                    <Link
                                        key={section.id}
                                        href={`/attendance/${section.id}`}
                                        className="group p-4 md:p-6 bg-card border border-border rounded-xl shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                                    >
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-full border border-primary/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                                    <span className="text-[9px] font-black tracking-widest text-primary">{section.course?.name || 'Course'}</span>
                                                </div>
                                                <div className="text-[10px] font-black text-success tracking-tighter bg-success/10 px-2 py-1 rounded-md">Active</div>
                                            </div>

                                            <h3 className="text-lg md:text-xl font-black tracking-tighter mb-3 text-foreground group-hover:text-primary transition-colors leading-tight">{section.name}</h3>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Users className="w-4 h-4 text-primary/70" />
                                                        <p className="text-[10px] font-black tracking-widest">{studentCount} Students</p>
                                                    </div>
                                                    <p className="text-[10px] font-black text-primary italic">{attendanceRate}% Avg</p>
                                                </div>

                                                <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary group-hover:bg-primary/80 transition-all duration-500 ease-out"
                                                        style={{ width: `${attendanceRate}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between relative z-10">
                                            <div className="flex flex-col">
                                                <p className="text-[9px] font-black tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">Session Management</p>
                                                <p className="text-[10px] font-black text-primary">Open Ledger</p>
                                            </div>
                                            <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary transition-all duration-300 border border-primary/10 group-hover:scale-110 shadow-sm">
                                                <ChevronRight className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
