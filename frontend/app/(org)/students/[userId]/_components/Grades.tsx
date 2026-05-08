'use client';

import { useState } from 'react';
import { Trophy, Calendar, Award, TrendingUp } from 'lucide-react';
import { FinalGradeResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';

export default function Grades({ grades }: { grades: FinalGradeResponse[] }) {
    const [search, setSearch] = useState('');

    const filteredGrades = grades.filter(grade =>
        grade.courseName.toLowerCase().includes(search.toLowerCase()) ||
        grade.sectionName.toLowerCase().includes(search.toLowerCase())
    );

    const averageGrade = grades.length > 0
        ? (grades.reduce((acc, g) => acc + (Number(g.finalPercentage) || 0), 0) / grades.length).toFixed(1)
        : '0.0';

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-16 px-4 sm:px-6">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tighter leading-none">
                        Academic Transcript
                    </h1>
                    <p className="text-muted-foreground mt-3 font-bold max-w-md tracking-tight">Your verified semester performance and official grade audit.</p>
                </div>

                <div className="w-full md:w-80">
                    <SearchBar
                        placeholder="Search records..."
                        value={search}
                        onChange={setSearch}
                    />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Achievement Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card padding="lg" accentColor="bg-primary" className="bg-card border-border shadow-2xl relative overflow-hidden group" delay={0}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <div className="relative z-10 text-left">
                            <p className="text-[10px] font-black text-primary tracking-[0.2em] mb-4">Cumulative Average</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-foreground leading-none">{averageGrade}</span>
                                <span className="text-xl font-black text-primary">%</span>
                            </div>
                            <div className="mt-8 pt-6 border-t border-border">
                                <p className="text-[10px] font-black text-muted-foreground/60 tracking-widest mb-1 font-sans">Institutional Rank</p>
                                <p className="text-sm font-black text-foreground flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-warning" />
                                    Dean&apos;s Distinction List
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card padding="md" className="border-border bg-success/5" delay={100}>
                        <div className="flex items-center gap-4 text-left">
                            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center border border-success/20">
                                <Award className="w-6 h-6 text-success" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-foreground">Honor Roll</h3>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-widest mt-0.5">Verified Status</p>
                            </div>
                        </div>
                    </Card>

                    <button className="w-full py-4 bg-card border border-border text-foreground rounded-2xl font-black text-[10px] tracking-[0.2em] hover:bg-muted/30 hover:border-primary/50 transition-all shadow-sm active:scale-95 group flex items-center justify-center gap-2">
                        Download Report
                        <span className="text-muted-foreground/40 group-hover:text-primary transition-colors">↓</span>
                    </button>
                </div>

                {/* Grade List Area */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredGrades.map((grade, index) => (
                            <Card
                                key={`${grade.sectionId}-${index}`}
                                accentColor="bg-primary"
                                padding="md"
                                className="group hover:border-primary/50 transition-all duration-300 h-auto"
                                delay={200 + (index * 50)}
                            >
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-4 flex-1 text-left">
                                        <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-border flex items-center justify-center font-black text-foreground text-xl shadow-xs group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                                            {grade.letterGrade || 'A'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground/60 tracking-[0.2em] mb-1">{grade.courseName}</p>
                                            <h3 className="text-lg font-black text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors line-clamp-1">{grade.sectionName}</h3>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-2xl font-black text-foreground leading-none">{grade.finalPercentage}</span>
                                            <span className="text-[10px] font-black text-muted-foreground/60">%</span>
                                        </div>
                                        <div className="w-16 h-1 bg-muted rounded-full mt-2 overflow-hidden ml-auto">
                                            <div className="h-full bg-primary" style={{ width: `${grade.finalPercentage}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {filteredGrades.length === 0 && (
                        <div className="p-20 bg-muted/10 rounded-3xl border-2 border-dashed border-border text-center">
                            <TrendingUp className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-xs font-black text-muted-foreground/40 tracking-widest italic">No matching records found</p>
                        </div>
                    )}

                    {/* Footer Info Card */}
                    <Card padding="lg" className="bg-primary/5 border-primary/20" delay={400}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-left">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-card rounded-xl border border-primary/20 shadow-sm text-primary">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div className="max-w-md">
                                    <h4 className="text-sm font-black text-foreground tracking-tight">Performance Summary</h4>
                                    <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-2">
                                        Your academic trajectory is currently <span className="text-primary font-bold tracking-widest">Positive</span>. Maintain consistent presence in all sections to secure final honors.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/60 tracking-widest">
                                <Calendar className="w-4 h-4 text-primary/40" />
                                Authentic Transcript v2.0
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
