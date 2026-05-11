'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, GraduationCap, ChevronRight, Search } from 'lucide-react';
import useSWR from 'swr';
import { Section, Role } from '@/types';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

export default function GradesPage() {
    const { token, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    // SWR for sections data - replaces useCallback + useEffect
    const sectionsKey = token && user
        ? ['sections-for-grades', { my: user.role === Role.TEACHER }] as const
        : null;
    const { data: sectionsData, isLoading } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = sectionsData?.data || [];

    const filteredSections = sections.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.course?.name && s.course.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="flex flex-col h-full w-full space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-card/50 p-4 md:p-6 rounded-lg border border-border shadow-inner">
                    <Skeleton className="h-10 w-full max-w-md rounded-md" />
                    <div className="hidden sm:flex items-center gap-2">
                        <Skeleton className="w-4 h-4 rounded-full" />
                        <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-lg p-4 md:p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <Skeleton className="w-12 h-12 rounded-lg" />
                                <Skeleton className="w-5 h-5 rounded-md" />
                            </div>
                            <div className="space-y-3">
                                <Skeleton className="h-7 w-full rounded-md" />
                                <Skeleton className="h-3 w-2/3 rounded-md" />
                            </div>
                            <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                                <Skeleton className="h-3 w-32 rounded-md" />
                                <Skeleton className="h-6 w-20 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full space-y-6">
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-card/50 p-4 md:p-6 rounded-lg border border-border shadow-inner">
                    <div className="flex-1 max-w-md w-full">
                        <Input
                            placeholder="Search sections or courses..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={Search}
                        />
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-card-text/30 tracking-widest">
                        <GraduationCap className="w-4 h-4" />
                        <span>Total Sections: {sections.length}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {filteredSections.length === 0 ? (
                        <div className="col-span-full bg-primary/5 border border-dashed border-border rounded-lg p-12 md:p-20 text-center">
                            <BookOpen className="w-12 h-12 md:w-16 md:h-16 text-card-text/20 mx-auto mb-4" />
                            <p className="text-card-text/40 font-bold italic tracking-widest">No matching sections found.</p>
                        </div>
                    ) : (
                        filteredSections.map(section => (
                            <Link
                                key={section.id}
                                href={`/sections/${section.id}`}
                                className="bg-card border border-border rounded-lg p-4 md:p-6 space-y-4 hover:border-primary/50 transition-all group shadow-sm flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 md:p-3 bg-primary/35 rounded-lg border border-primary/10 group-hover:bg-primary group-hover:text-foreground transition-all duration-300">
                                            <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-card-text/10 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                    </div>
                                    <h3 className="text-lg md:text-xl font-black tracking-tighter text-card-text leading-tight group-hover:text-primary transition-colors">{section.name}</h3>
                                    <p className="text-[10px] font-black text-card-text/40 tracking-widest mt-2">{section.course?.name || 'Generic Course'}</p>
                                </div>
                                <div className="mt-4 md:mt-8 pt-4 md:pt-6 border-t border-border flex items-center justify-between text-[10px] font-black tracking-widest text-card-text/30">
                                    <span>{section.cohort && `${section.cohort.name} (${section.academicCycle?.name || 'Academic Cycle'})`}</span>
                                    <span className="bg-primary/5 px-2 py-1 rounded-lg text-primary group-hover:bg-primary group-hover:text-foreground transition-all">Manage Grades</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
