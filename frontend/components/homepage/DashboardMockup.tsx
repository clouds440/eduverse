'use client';

import {
    BarChart3,
    Bell,
    BookOpen,
    CalendarCheck,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    FileText,
    GraduationCap,
    LayoutDashboard,
    Megaphone,
    MessageSquare,
    Search,
    Settings,
    TrendingUp,
    Users,
    WalletCards,
} from 'lucide-react';

const SIDEBAR_ITEMS = [
    { icon: LayoutDashboard, label: 'Overview', active: true },
    { icon: Users, label: 'Students' },
    { icon: GraduationCap, label: 'Teachers' },
    { icon: BookOpen, label: 'Courses' },
    { icon: CalendarCheck, label: 'Schedules' },
    { icon: ClipboardList, label: 'Grades' },
    { icon: WalletCards, label: 'Finance' },
    { icon: MessageSquare, label: 'Messages' },
    { icon: FileText, label: 'Reports' },
    { icon: Settings, label: 'Settings' },
];

const STATS = [
    {
        label: 'Active Students',
        value: '2,847',
        change: '+12%',
        icon: GraduationCap,
        color: 'text-primary',
        bg: 'bg-primary/10',
        border: 'border-primary/20',
    },
    {
        label: 'Faculty',
        value: '186',
        change: '+3%',
        icon: Users,
        color: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/20',
    },
    {
        label: 'Attendance',
        value: '94.2%',
        change: '+1.8%',
        icon: CalendarCheck,
        color: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/20',
    },
    {
        label: 'Courses',
        value: '47',
        change: '+5',
        icon: BookOpen,
        color: 'text-info',
        bg: 'bg-info/10',
        border: 'border-info/20',
    },
];

const CHART_BARS = [
    { day: 'Mon', height: 85 },
    { day: 'Tue', height: 92 },
    { day: 'Wed', height: 78 },
    { day: 'Thu', height: 95 },
    { day: 'Fri', height: 88 },
];

const ACTIVITY = [
    {
        avatar: 'SK',
        name: 'Sarah Khan',
        action: 'submitted Assignment 3',
        meta: 'Calculus II',
        time: '2m ago',
        color: 'bg-primary',
    },
    {
        avatar: 'DR',
        name: 'Dr. Rahman',
        action: 'marked attendance',
        meta: 'Physics · Morning A',
        time: '8m ago',
        color: 'bg-success',
    },
    {
        avatar: 'AD',
        name: 'Admin',
        action: 'promoted 34 students',
        meta: 'Spring 2026',
        time: '15m ago',
        color: 'bg-warning',
    },
];

const SCHEDULE = [
    { time: '09:00', subject: 'Mathematics 201', room: 'Room 4B', color: 'bg-primary' },
    { time: '10:30', subject: 'Physics Lab', room: 'Lab 2', color: 'bg-success' },
    { time: '13:00', subject: 'English Literature', room: 'Room 7A', color: 'bg-info' },
];

export function DashboardMockup({ className = '' }: { className?: string }) {
    return (
        <div className={`relative select-none pointer-events-none ${className}`}>
            <div className="absolute -inset-6 rounded-3xl bg-linear-to-r from-primary/20 via-primary/5 to-primary/20 opacity-50 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl">
                <div className="flex h-11 items-center justify-between border-b border-border/50 bg-muted/40 px-4">
                    <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-danger/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-success/80" />
                        <span className="ml-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">
                            EduVerse
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/50 px-2.5 py-1">
                            <Search className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-[9px] font-medium text-muted-foreground/40">
                                Search...
                            </span>
                        </div>

                        <div className="relative">
                            <Bell className="h-3.5 w-3.5 text-muted-foreground/60" />
                            <div className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary">
                                <span className="text-[6px] font-bold text-primary-foreground">3</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex">
                    <div className="hidden w-36 shrink-0 flex-col border-r border-border/30 bg-muted/20 py-3 lg:flex xl:w-40">
                        <div className="relative h-full px-3">
                            <div className="space-y-0.5">
                                {SIDEBAR_ITEMS.map((item) => (
                                    <div
                                        key={item.label}
                                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-black tracking-tight transition-all duration-200 ${
                                            item.active
                                                ? 'border border-primary/20 bg-primary/10 text-primary shadow-sm shadow-primary/5'
                                                : 'text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground'
                                        }`}
                                    >
                                        <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.active ? 'text-primary' : 'opacity-40'}`} />
                                        <span className="truncate">{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="absolute bottom-1 left-3 right-3 flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 p-2">
                                <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/20">
                                    <span className="text-[8px] font-bold text-primary">EV</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-[9px] font-black text-foreground">EduVerse</p>
                                    <p className="truncate text-[7px] font-semibold text-muted-foreground">Workspace</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-3 bg-background/30 p-3 xl:space-y-4 xl:p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-[11px] font-black tracking-tight text-foreground xl:text-xs">
                                    Institutional Overview
                                </h3>
                                <p className="text-[8px] font-semibold text-muted-foreground xl:text-[9px]">
                                    Spring 2026 · Live workspace
                                </p>
                            </div>

                            <div className="flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2 py-0.5">
                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-success">
                                    Live
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                            {STATS.map((stat) => (
                                <div
                                    key={stat.label}
                                    className={`${stat.bg} ${stat.border} group/stat rounded-xl border p-2.5 transition-all duration-300 hover:scale-[1.02] hover:brightness-110 xl:p-3`}
                                >
                                    <div className="mb-1 flex items-center justify-between">
                                        <stat.icon className={`h-3.5 w-3.5 ${stat.color} transition-transform group-hover/stat:rotate-12`} />
                                        <div className="flex items-center gap-0.5">
                                            <TrendingUp className="h-2.5 w-2.5 text-success" />
                                            <span className="text-[7px] font-bold text-success">{stat.change}</span>
                                        </div>
                                    </div>
                                    <p className={`text-sm font-black xl:text-base ${stat.color}`}>{stat.value}</p>
                                    <p className="mt-0.5 text-[8px] font-semibold text-muted-foreground">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 gap-2 xl:grid-cols-5 xl:gap-3">
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 xl:col-span-3">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-foreground">Weekly Attendance</p>
                                        <p className="text-[8px] font-medium text-muted-foreground">Campus pulse</p>
                                    </div>
                                    <BarChart3 className="h-3.5 w-3.5 text-primary/60" />
                                </div>

                                <div className="flex h-16 items-end justify-between gap-2 px-1 xl:h-20">
                                    {CHART_BARS.map((bar) => (
                                        <div key={bar.day} className="flex h-full flex-1 flex-col items-center gap-1">
                                            <div className="relative h-full w-full overflow-hidden rounded-t-sm bg-muted/40">
                                                <div
                                                    className="absolute bottom-0 w-full rounded-t-sm bg-primary transition-all duration-500"
                                                    style={{ height: `${bar.height}%` }}
                                                />
                                            </div>
                                            <span className="text-[7px] font-bold text-muted-foreground">{bar.day}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 xl:col-span-2">
                                <div className="mb-2.5 flex items-center justify-between">
                                    <p className="text-[10px] font-black text-foreground">Live Feed</p>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                                </div>

                                <div className="space-y-2.5">
                                    {ACTIVITY.map((item) => (
                                        <div key={`${item.name}-${item.time}`} className="flex items-start gap-2">
                                            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.color}/20`}>
                                                <span className={`text-[6px] font-black ${item.color.replace('bg-', 'text-')}`}>
                                                    {item.avatar}
                                                </span>
                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-[8px] leading-tight text-foreground/80">
                                                    <span className="font-black text-foreground">{item.name}</span>{' '}
                                                    <span className="text-muted-foreground">{item.action}</span>
                                                </p>
                                                <p className="mt-0.5 truncate text-[7px] font-semibold text-muted-foreground/50">
                                                    {item.meta}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-1">
                                                    <Clock className="h-2 w-2 text-muted-foreground/30" />
                                                    <span className="text-[7px] font-semibold text-muted-foreground/40">{item.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 xl:grid-cols-5 xl:gap-3">
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 xl:col-span-3">
                                <div className="mb-2.5 flex items-center justify-between">
                                    <p className="text-[10px] font-black text-foreground">Today’s Schedule</p>
                                    <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground/20" />
                                </div>

                                <div className="space-y-1.5">
                                    {SCHEDULE.map((item) => (
                                        <div
                                            key={`${item.time}-${item.subject}`}
                                            className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-background/40 px-2.5 py-1.5"
                                        >
                                            <div className={`h-6 w-1 shrink-0 rounded-full ${item.color}`} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[9px] font-black text-foreground/80">{item.subject}</p>
                                                <p className="text-[7px] font-semibold text-muted-foreground">{item.room}</p>
                                            </div>
                                            <span className="shrink-0 text-[8px] font-black text-primary/70">{item.time}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 xl:col-span-2">
                                <p className="mb-2.5 text-[10px] font-black text-foreground">Quick Actions</p>

                                <div className="grid grid-cols-2 gap-1.5">
                                    {[
                                        { icon: Users, label: 'Add User', color: 'text-primary bg-primary/10' },
                                        { icon: CalendarCheck, label: 'Schedule', color: 'text-success bg-success/10' },
                                        { icon: ClipboardList, label: 'Grades', color: 'text-purple-400 bg-purple-500/10' },
                                        { icon: Megaphone, label: 'Announce', color: 'text-warning bg-warning/10' },
                                    ].map((action) => {
                                        const [textColor, bgColor] = action.color.split(' ');

                                        return (
                                            <div
                                                key={action.label}
                                                className={`group/action flex flex-col items-center gap-1 rounded-lg border border-border/30 py-2 ${bgColor}`}
                                            >
                                                <action.icon className={`h-3.5 w-3.5 ${textColor} transition-transform group-hover/action:scale-110`} />
                                                <span className="text-[7px] font-black uppercase tracking-tighter text-muted-foreground/60">
                                                    {action.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}