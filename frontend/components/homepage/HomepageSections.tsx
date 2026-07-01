'use client';

import Link from 'next/link';
import {
    Activity,
    ArrowRight,
    BarChart3,
    BookOpen,
    CalendarCheck,
    CheckCircle2,
    ClipboardList,
    Database,
    FileText,
    GraduationCap,
    Landmark,
    Layers,
    Lock,
    MessageSquare,
    ShieldCheck,
    Sparkles,
    Users,
    WalletCards,
    Zap,
} from 'lucide-react';

import { Reveal } from '@/components/ui/Reveal';

const TRUST_METRICS = [
    { value: 'One', label: 'connected workspace', icon: Layers },
    { value: 'Live', label: 'updates and alerts', icon: Zap },
    { value: 'Role-aware', label: 'portals for every user', icon: ShieldCheck },
    { value: 'Multi-org', label: 'ready for growth', icon: Landmark },
    { value: 'Secure', label: 'scoped access', icon: Lock },
];

export function TrustBar() {
    return (
        <section className="border-y border-border bg-muted/20 py-6 md:py-8">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-12 lg:gap-x-16">
                    {TRUST_METRICS.map((metric, i) => (
                        <Reveal
                            key={metric.label}
                            delay={i * 70}
                            className={`w-full sm:w-auto ${i === TRUST_METRICS.length - 1 ? 'hidden sm:block' : ''}`}
                        >
                            <div className="group mx-auto flex w-full max-w-40 items-center gap-3 sm:max-w-none">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/12 bg-primary/8 transition-colors group-hover:bg-primary/15">
                                    <metric.icon className="h-4 w-4 text-primary/75" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black leading-none text-foreground md:text-base">
                                        {metric.value}
                                    </p>
                                    <p className="truncate text-[10px] font-semibold text-muted-foreground md:text-xs">
                                        {metric.label}
                                    </p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

const HIGHLIGHTS = [
    {
        icon: Users,
        title: 'Every role gets its own workspace',
        desc: 'Admins, sub admins, managers, finance teams, teachers, students, and guardians see the tools meant for them.',
    },
    {
        icon: CalendarCheck,
        title: 'Schedules, attendance, and daily work stay synced',
        desc: 'Timetables, attendance, materials, assessments, and notifications move together without scattered spreadsheets.',
    },
    {
        icon: FileText,
        title: 'Academic records stay clean over time',
        desc: 'Cycles, transcripts, GPA policies, promotions, and history are built for long-term institutional records.',
    },
    {
        icon: WalletCards,
        title: 'Finance gets a dedicated lane',
        desc: 'Fees, claims, ledgers, salaries, and reports can be handled without mixing money work into academic roles.',
    },
];

export function PlatformHighlights() {
    return (
        <section className="relative overflow-hidden bg-background py-24 md:py-32">
            <div className="absolute left-1/2 top-1/2 h-200 w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/3 blur-[200px]" />

            <div className="container relative z-10 mx-auto px-6">
                <div className="mx-auto mb-14 max-w-3xl space-y-4 text-center">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
                            <Sparkles className="h-3 w-3" />
                            Less admin mess
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <h2 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                            All the moving parts, finally speaking the same language
                        </h2>
                    </Reveal>

                    <Reveal delay={200}>
                        <p className="text-lg font-medium leading-relaxed text-muted-foreground">
                            EduVerse replaces disconnected tools with one polished system for the full academic lifecycle.
                        </p>
                    </Reveal>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {HIGHLIGHTS.map((item, i) => (
                        <Reveal key={item.title} delay={i * 80}>
                            <div className="group h-full rounded-3xl border border-border bg-card/80 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/5">
                                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 transition-transform group-hover:scale-110">
                                    <item.icon className="h-6 w-6 text-primary" />
                                </div>

                                <h3 className="mb-2 text-base font-black text-foreground">
                                    {item.title}
                                </h3>

                                <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                                    {item.desc}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

const ROLE_CARDS = [
    {
        role: 'Management',
        icon: ShieldCheck,
        title: 'Control the institute without drowning in menus',
        points: ['Users and departments', 'Schedules and sections', 'Cycles and transcripts'],
    },
    {
        role: 'Academics',
        icon: GraduationCap,
        title: 'Give teachers and managers a focused academic flow',
        points: ['Assigned sections', 'Materials and assessments', 'Grades and attendance'],
    },
    {
        role: 'Students & Guardians',
        icon: BookOpen,
        title: 'Keep learners and families informed without extra calls',
        points: ['Timetable and grades', 'Attendance and fees', 'Announcements and updates'],
    },
];

export function RolePreview() {
    return (
        <section className="relative bg-muted/20 py-24 md:py-32">
            <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-background to-transparent" />

            <div className="container relative z-10 mx-auto px-6">
                <div className="mx-auto mb-14 max-w-3xl space-y-4 text-center">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
                            <Users className="h-3 w-3" />
                            Role-aware by design
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <h2 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                            Nobody gets the wrong dashboard
                        </h2>
                    </Reveal>

                    <Reveal delay={200}>
                        <p className="text-lg font-medium leading-relaxed text-muted-foreground">
                            Each portal is shaped around the work that role actually does. Less clutter, fewer wrong clicks, cleaner days.
                        </p>
                    </Reveal>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {ROLE_CARDS.map((card, i) => (
                        <Reveal key={card.role} delay={i * 120}>
                            <div className="group h-full rounded-3xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/5">
                                <div className="mb-6 flex items-center gap-4">
                                    <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 transition-transform group-hover:scale-110">
                                        <card.icon className="h-6 w-6 text-primary" />
                                    </div>

                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                                            {card.role}
                                        </p>
                                        <h3 className="mt-1 text-lg font-black leading-tight text-foreground">
                                            {card.title}
                                        </h3>
                                    </div>
                                </div>

                                <ul className="space-y-3">
                                    {card.points.map((point) => (
                                        <li key={point} className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

const SHOWCASE_ITEMS = [
    {
        icon: ClipboardList,
        title: 'Academic lifecycle',
        desc: 'From admissions to promotions to transcripts, every step stays connected.',
    },
    {
        icon: MessageSquare,
        title: 'Built-in communication',
        desc: 'Announcements, mail, chat, and notifications live beside the work they support.',
    },
    {
        icon: BarChart3,
        title: 'Operational insight',
        desc: 'Dashboards surface the signals your staff needs before small issues become messes.',
    },
    {
        icon: Database,
        title: 'Structured records',
        desc: 'Clean history for grades, cycles, finance, attendance, and student progress.',
    },
];

export function ProductShowcase() {
    return (
        <section className="relative overflow-hidden bg-background py-24 md:py-32">
            <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-primary/5 blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-primary/5 blur-[150px]" />

            <div className="container relative z-10 mx-auto px-6">
                <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-5">
                        <Reveal>
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
                                <Activity className="h-3 w-3" />
                                Built for busy institutes
                            </div>
                        </Reveal>

                        <Reveal delay={100}>
                            <h2 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                                Powerful underneath. Simple where people touch it.
                            </h2>
                        </Reveal>

                        <Reveal delay={200}>
                            <p className="text-lg font-medium leading-relaxed text-muted-foreground">
                                The platform handles the messy relationships between people, courses, sections,
                                finance, communication, and records, while the interface stays clean and obvious.
                            </p>
                        </Reveal>

                        <Reveal delay={300}>
                            <div className="pt-2">
                                <Link
                                    href="/docs"
                                    className="group inline-flex items-center gap-2 text-sm font-black text-primary"
                                >
                                    See how it works in the docs
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>
                        </Reveal>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {SHOWCASE_ITEMS.map((item, i) => (
                            <Reveal key={item.title} delay={i * 90}>
                                <div className="group rounded-3xl border border-border bg-card/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5">
                                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/60 transition-transform group-hover:rotate-2 group-hover:scale-110">
                                        <item.icon className="h-6 w-6 text-primary" />
                                    </div>

                                    <h3 className="mb-2 text-base font-black text-foreground">
                                        {item.title}
                                    </h3>

                                    <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                                        {item.desc}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

const SECURITY_POINTS = [
    'Tenant-aware data boundaries',
    'Role and scope based access',
    'Secure sessions and guarded APIs',
    'Designed for growth, not rewrites',
];

export function SecurityStrip() {
    return (
        <section className="relative overflow-hidden bg-muted/20 py-20 md:py-24">
            <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background to-transparent" />

            <div className="container relative z-10 mx-auto px-6">
                <div className="rounded-4xl border border-border bg-card/80 p-6 shadow-2xl shadow-primary/5 md:p-10">
                    <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
                                <Lock className="h-3 w-3" />
                                Secure foundation
                            </div>

                            <h2 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">
                                Security that stays mostly invisible
                            </h2>

                            <p className="text-base font-medium leading-relaxed text-muted-foreground">
                                Users get a smooth experience. Your institution gets scoped access,
                                protected records, and clean separation between organizations and roles.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {SECURITY_POINTS.map((point) => (
                                <div key={point} className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
                                    <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                                    <span className="text-sm font-bold text-foreground">{point}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
