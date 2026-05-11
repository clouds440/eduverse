'use client';

import {
    Users, GraduationCap, BookOpen, CalendarCheck, BarChart3, MessageSquare,
    Bell, Search, ChevronRight, Clock, TrendingUp, CheckCircle2,
    LayoutDashboard, Settings, Megaphone, ClipboardList, FileText
} from 'lucide-react';

const SIDEBAR_ITEMS = [
    { icon: LayoutDashboard, label: 'Overview', active: true },
    { icon: Users, label: 'Students' },
    { icon: GraduationCap, label: 'Teachers' },
    { icon: BookOpen, label: 'Courses' },
    { icon: ClipboardList, label: 'Assessments' },
    { icon: CalendarCheck, label: 'Attendance' },
    { icon: MessageSquare, label: 'Chat' },
    { icon: FileText, label: 'Transcripts' },
    { icon: Settings, label: 'Settings' },
];

const STATS = [
    { label: 'Total Students', value: '2,847', change: '+12%', icon: GraduationCap, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    { label: 'Faculty Members', value: '186', change: '+3%', icon: Users, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
    { label: 'Attendance Rate', value: '94.2%', change: '+1.8%', icon: CalendarCheck, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
    { label: 'Active Courses', value: '47', change: '+5', icon: BookOpen, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
];

const CHART_BARS = [
    { day: 'Mon', height: 85, color: 'bg-primary' },
    { day: 'Tue', height: 92, color: 'bg-primary' },
    { day: 'Wed', height: 78, color: 'bg-primary' },
    { day: 'Thu', height: 95, color: 'bg-primary' },
    { day: 'Fri', height: 88, color: 'bg-primary' },
];

const ACTIVITY = [
    { avatar: 'SK', name: 'Sarah Khan', action: 'submitted Assignment 3 — Calculus II', time: '2m ago', color: 'bg-primary' },
    { avatar: 'DR', name: 'Dr. Rahman', action: 'marked attendance for Physics 101-A', time: '8m ago', color: 'bg-success' },
    { avatar: 'AH', name: 'Admin', action: 'promoted 34 students to Spring 2026 cohort', time: '15m ago', color: 'bg-warning' },
];

const SCHEDULE = [
    { time: '09:00', subject: 'Mathematics 201', room: 'Room 4B', color: 'bg-primary' },
    { time: '10:30', subject: 'Physics Lab', room: 'Lab 2', color: 'bg-success' },
    { time: '13:00', subject: 'English Literature', room: 'Room 7A', color: 'bg-info' },
];
export function DashboardMockup({ className = '' }: { className?: string }) {
    return (
        <div className={`relative select-none pointer-events-none ${className}`}>
            {/* Glow effect behind */}
            <div className="absolute -inset-6 bg-linear-to-r from-primary/20 via-primary/5 to-primary/20 rounded-3xl blur-3xl opacity-50" />

            {/* Notification card — moved OUTSIDE overflow-hidden container to prevent clipping */}
            <div className="absolute -bottom-4 -right-4 bg-card rounded-xl border border-border shadow-2xl p-2.5 w-44 z-50 hidden xl:block animate-in fade-in zoom-in duration-700 delay-700">
                <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-success" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-foreground">Grades Published</p>
                        <p className="text-[8px] text-muted-foreground mt-0.5">Physics 101 — Section A</p>
                        <p className="text-[7px] text-primary/60 font-bold mt-0.5 uppercase tracking-wider">Just now</p>
                    </div>
                </div>
            </div>

            <div className="relative bg-card/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* ═══ TOP BAR ═══ */}
                <div className="h-11 bg-muted/40 border-b border-border/50 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-danger/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-warning/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-success/80" />
                        <span className="ml-3 text-[10px] font-black text-muted-foreground/60 tracking-[0.15em] uppercase">Eduverse</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-background/50 rounded-lg px-2.5 py-1 border border-border/50">
                            <Search className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-[9px] text-muted-foreground/40 font-medium">Global Search...</span>
                        </div>
                        <div className="relative">
                            <Bell className="w-3.5 h-3.5 text-muted-foreground/60" />
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full flex items-center justify-center">
                                <span className="text-[6px] font-bold text-primary-foreground">3</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex">
                    {/* ═══ SIDEBAR ═══ */}
                    <div className="hidden lg:flex w-36 xl:w-40 bg-muted/20 border-r border-border/30 flex-col py-3 shrink-0">
                        <div className="px-3 space-y-0.5">
                            {SIDEBAR_ITEMS.map((item) => (
                                <div
                                    key={item.label}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-tight transition-all duration-200
                                        ${item.active
                                            ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
                                        }`}
                                >
                                    <item.icon className={`w-3.5 h-3.5 shrink-0 ${item.active ? 'text-primary' : 'opacity-40'}`} />
                                    <span className="truncate">{item.label}</span>
                                </div>
                            ))}

                            <div className="absolute flex items-center gap-2 bottom-10">
                                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                                    <span className="text-[8px] font-bold text-primary">EV</span>
                                </div>
                                <div>
                                    EduVerse
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ MAIN CONTENT ═══ */}
                    <div className="flex-1 p-3 xl:p-4 space-y-3 xl:space-y-4 min-w-0 bg-background/30">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-[11px] xl:text-xs font-black text-foreground tracking-tight">Institutional Overview</h3>
                                <p className="text-[8px] xl:text-[9px] text-muted-foreground font-semibold">Spring 2026 · Cycle Active</p>
                            </div>
                            <div className="flex items-center gap-1 bg-success/10 border border-success/20 rounded-md px-2 py-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                <span className="text-[8px] font-black text-success uppercase tracking-widest">Live</span>
                            </div>
                        </div>

                        {/* ═══ STAT CARDS ═══ */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                            {STATS.map((stat) => (
                                <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-xl p-2.5 xl:p-3 hover:scale-[1.02] hover:brightness-110 transition-all duration-300 group/stat`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <stat.icon className={`w-3.5 h-3.5 ${stat.color} group-hover/stat:rotate-12 transition-transform`} />
                                        <div className="flex items-center gap-0.5">
                                            <TrendingUp className="w-2.5 h-2.5 text-success" />
                                            <span className="text-[7px] font-bold text-success">{stat.change}</span>
                                        </div>
                                    </div>
                                    <p className={`text-sm xl:text-base font-black ${stat.color}`}>{stat.value}</p>
                                    <p className="text-[8px] text-muted-foreground font-semibold mt-0.5">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* ═══ CHARTS + ACTIVITY ═══ */}
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-2 xl:gap-3">
                            {/* Attendance Chart */}
                            <div className="xl:col-span-3 bg-muted/20 border border-border/50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-[10px] font-black text-foreground">Weekly Attendance</p>
                                        <p className="text-[8px] text-muted-foreground font-medium">Core Campus Metrics</p>
                                    </div>
                                    <BarChart3 className="w-3.5 h-3.5 text-primary/60" />
                                </div>
                                <div className="flex items-end justify-between gap-2 h-16 xl:h-20 px-1">
                                    {CHART_BARS.map((bar) => (
                                        <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 h-full">
                                            <div className="w-full relative rounded-t-sm overflow-hidden bg-muted/40 h-full">
                                                <div
                                                    className={`absolute bottom-0 w-full ${bar.color} rounded-t-sm transition-all duration-500`}
                                                    style={{ height: `${bar.height}%` }}
                                                />
                                            </div>
                                            <span className="text-[7px] text-muted-foreground font-bold">{bar.day}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Activity Feed */}
                            <div className="xl:col-span-2 bg-muted/20 border border-border/50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2.5">
                                    <p className="text-[10px] font-black text-foreground">Live Feed</p>
                                    <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                                </div>
                                <div className="space-y-2.5">
                                    {ACTIVITY.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className={`w-5 h-5 rounded-full ${item.color.replace('bg-', 'bg-')}/20 flex items-center justify-center shrink-0 mt-0.5`}>
                                                <span className={`text-[6px] font-black ${item.color.replace('bg-', 'text-')}`}>
                                                    {item.avatar}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] text-foreground/80 leading-tight">
                                                    <span className="font-black text-foreground">{item.name}</span> <span className="text-muted-foreground">{item.action}</span>
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-2 h-2 text-muted-foreground/30" />
                                                    <span className="text-[7px] text-muted-foreground/40 font-semibold">{item.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ═══ SCHEDULE + QUICK ACTIONS ═══ */}
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-2 xl:gap-3">
                            {/* Upcoming Schedule */}
                            <div className="xl:col-span-3 bg-muted/20 border border-border/50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2.5">
                                    <p className="text-[10px] font-black text-foreground">Operational Schedule</p>
                                    <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground/20" />
                                </div>
                                <div className="space-y-1.5">
                                    {SCHEDULE.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2.5 bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/30">
                                            <div className={`w-1 h-6 ${item.color} rounded-full shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-black text-foreground/80 truncate">{item.subject}</p>
                                                <p className="text-[7px] text-muted-foreground font-semibold">{item.room}</p>
                                            </div>
                                            <span className="text-[8px] font-black text-primary/70 shrink-0">{item.time}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="xl:col-span-2 bg-muted/20 border border-border/50 rounded-xl p-3">
                                <p className="text-[10px] font-black text-foreground mb-2.5">Quick Orchestration</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {[
                                        { icon: Users, label: 'Add User', color: 'text-primary bg-primary/10' },
                                        { icon: CalendarCheck, label: 'Attendance', color: 'text-success bg-success/10' },
                                        { icon: ClipboardList, label: 'Assessment', color: 'text-purple-400 bg-purple-500/10' },
                                        { icon: Megaphone, label: 'Announce', color: 'text-warning bg-warning/10' },
                                    ].map((action) => (
                                        <div key={action.label} className={`flex flex-col items-center gap-1 py-2 rounded-lg border border-border/30 ${action.color.split(' ')[1]} group/action cursor-pointer`}>
                                            <action.icon className={`w-3.5 h-3.5 ${action.color.split(' ')[0]} group-hover/action:scale-110 transition-transform`} />
                                            <span className="text-[7px] font-black text-muted-foreground/60 uppercase tracking-tighter">{action.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
