// app/page.tsx — EduVerse Homepage
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Facebook,
    Instagram,
    Linkedin,
    Lock,
    MessageSquare,
    Sparkles,
    Twitter,
    Users,
    WalletCards,
    Zap,
    GraduationCap,
    CalendarCheck,
    FileText,
    ShieldCheck,
    Layers,
} from 'lucide-react';

import { HeroButtons } from '@/components/HeroButtons';
import { DashboardMockup } from '@/components/homepage/DashboardMockup';
import { Brand } from '@/components/ui/Brand';
import { Reveal } from '@/components/ui/Reveal';
import { PLATFORM_NAME } from '@/lib/constants';

const PLATFORM_POINTS = [
    {
        icon: Users,
        title: 'Role-first portals',
        text: 'Every role gets a focused workspace instead of one giant permission soup.',
    },
    {
        icon: CalendarCheck,
        title: 'Daily operations connected',
        text: 'Schedules, sections, attendance, materials, grades, and notices move together.',
    },
    {
        icon: WalletCards,
        title: 'Finance has its own lane',
        text: 'Fees, claims, ledgers, and payment records stay cleanly separated from academics.',
    },
    {
        icon: FileText,
        title: 'Records that survive semesters',
        text: 'Cycles, transcripts, GPA policies, promotions, and history stay structured.',
    },
];

const FLOW_ITEMS = [
    'Departments',
    'Courses',
    'Sections',
    'Schedules',
    'Attendance',
    'Assessments',
    'Grades',
    'Transcripts',
    'Finance',
    'Guardians',
];

export default function HomePage() {
    return (
        <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
            {/* HERO */}
            <section className="relative isolate overflow-hidden border-b border-border/60">
                <HeroBackground />

                <div className="container relative z-10 mx-auto px-5 py-12 sm:px-6 md:py-14 lg:py-16">
                    <div className="grid min-h-[calc(100svh-6rem)] items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] xl:gap-12">
                        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
                            <Reveal>
                                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary shadow-lg shadow-primary/5">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Built for modern institutes
                                </div>
                            </Reveal>

                            <Reveal delay={100}>
                                <h1 className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.06em] text-foreground sm:text-5xl md:text-6xl xl:text-7xl">
                                    Your institute, organized into one{' '}
                                    <span className="relative inline-block">
                                        <span className="bg-linear-to-r bg-primary bg-clip-text text-transparent">
                                            beautiful system
                                        </span>
                                        <span className="absolute -bottom-1 left-1 right-1 h-2 rounded-full bg-primary/20 blur-md" />
                                    </span>
                                </h1>
                            </Reveal>

                            <Reveal delay={200}>
                                <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                                    EduVerse connects academics, finance, communication, schedules, transcripts, 
                                    and role-based portals into a modern workspace your team can actually enjoy using.
                                </p>
                            </Reveal>

                            <Reveal delay={300}>
                                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                                    <HeroButtons />
                                </div>
                            </Reveal>

                            <Reveal delay={400}>
                                <div className="mt-6 flex flex-wrap justify-center gap-2.5 lg:justify-start">
                                    <MiniPill>Multi-role portals</MiniPill>
                                    <MiniPill>Real-time updates</MiniPill>
                                    <MiniPill>Scoped access</MiniPill>
                                </div>
                            </Reveal>
                        </div>

                        {/* Desktop hero mockup only */}
                        <Reveal delay={250} className="hidden lg:block">
                            <div className="relative ml-auto w-full max-w-180">
                                <div className="absolute -inset-5 rounded-4xl bg-primary/12 blur-3xl" />

                                <FloatingSignal
                                    className="right-10 bottom-3 hidden xl:flex animate-pulse ring-2 ring-primary/40"
                                    icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                                    title="Grades finalized"
                                    text="Physics · Morning A"
                                />

                                <div className="relative origin-center scale-[0.72] xl:scale-[0.82] 2xl:scale-90">
                                    <div className="rounded-[1.75rem] border border-primary/15 bg-background/50 p-2 shadow-2xl shadow-primary/10 backdrop-blur">
                                        <DashboardMockup />
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* Mobile mockup only */}
            <section className="block border-b border-border/60 bg-muted/10 px-4 py-7 lg:hidden">
                <Reveal>
                    <div className="mx-auto max-w-130 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-primary/10">
                        <div className="origin-top scale-[0.78] sm:scale-[0.9]">
                            <DashboardMockup />
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* COMPACT TRUST STRIP */}
            <section className="border-b border-border/60 bg-background">
                <div className="container mx-auto px-5 py-5 sm:px-6">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Metric value="7+" label="Role portals" />
                        <Metric value="Live" label="Updates" />
                        <Metric value="Scoped" label="Permissions" />
                        <Metric value="Unified" label="Records" />
                    </div>
                </div>
            </section>

            {/* VALUE SECTION */}
            <section className="relative overflow-hidden py-14 md:py-18">
                <SoftGlow />

                <div className="container relative z-10 mx-auto px-5 sm:px-6">
                    <div className="grid items-end gap-6 md:grid-cols-[0.8fr_1.2fr]">
                        <Reveal>
                            <div>
                                <SectionBadge icon={<Layers className="h-3 w-3" />}>
                                    Operating layer
                                </SectionBadge>

                                <h2 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-[-0.045em] text-foreground sm:text-4xl lg:text-5xl">
                                    Not another dashboard maze.
                                </h2>
                            </div>
                        </Reveal>

                        <Reveal delay={120}>
                            <p className="max-w-2xl text-base font-medium leading-relaxed text-muted-foreground md:ml-auto md:text-right">
                                EduVerse is designed around how institutes actually work: many roles,
                                messy daily operations, sensitive records, and zero patience for ugly admin panels.
                            </p>
                        </Reveal>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {PLATFORM_POINTS.map((item, index) => (
                            <Reveal key={item.title} delay={index * 70}>
                                <div className="group h-full rounded-[1.6rem] border border-border bg-card/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:bg-primary/5 hover:shadow-xl hover:shadow-primary/5">
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 transition-transform group-hover:scale-105">
                                        <item.icon className="h-5 w-5 text-primary" />
                                    </div>

                                    <h3 className="text-base font-black tracking-tight text-foreground">
                                        {item.title}
                                    </h3>

                                    <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                                        {item.text}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* UNIQUE FLOW SECTION */}
            <section className="relative overflow-hidden border-y border-border/60 bg-card py-14 md:py-18">
                <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_35%,rgba(255,255,255,0.035)_35%,rgba(255,255,255,0.035)_36%,transparent_36%,transparent_100%)]" />

                <div className="container relative z-10 mx-auto px-5 sm:px-6">
                    <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                        <Reveal>
                            <div className="max-w-xl">
                                <SectionBadge icon={<Zap className="h-3 w-3" />}>
                                    Connected by design
                                </SectionBadge>

                                <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.045em] text-foreground sm:text-4xl lg:text-5xl">
                                    The system feels simple because the chaos is already mapped.
                                </h2>

                                <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                                    Departments, sections, schedules, GPA rules, finance entries, guardians,
                                    and transcripts stay linked behind the scenes. Users just see the next thing they need.
                                </p>

                                <Link
                                    href="/docs"
                                    className="group mt-5 inline-flex items-center gap-2 text-sm font-black text-primary"
                                >
                                    See the full system
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>
                        </Reveal>

                        <Reveal delay={150}>
                            <div className="relative">
                                <div className="absolute inset-4 rounded-4xl bg-primary/10 blur-3xl" />

                                <div className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
                                    {FLOW_ITEMS.map((item, index) => (
                                        <div
                                            key={item}
                                            className={[
                                                'rounded-2xl border border-border bg-background/70 p-3.5 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5',
                                                index % 3 === 1 ? 'lg:translate-y-3' : '',
                                                index % 4 === 0 ? 'xl:-translate-y-2' : '',
                                            ].join(' ')}
                                        >
                                            <div className="mb-2 h-1.5 w-8 rounded-full bg-primary/50" />
                                            <p className="text-sm font-black text-foreground">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* SECURITY + CTA COMBO */}
            <section className="relative overflow-hidden py-14 md:py-18">
                <SoftGlow />

                <div className="container relative z-10 mx-auto px-5 sm:px-6">
                    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                        <Reveal>
                            <div className="h-full rounded-[1.75rem] border border-border bg-card/80 p-6 shadow-sm">
                                <SectionBadge icon={<Lock className="h-3 w-3" />}>
                                    Serious underneath
                                </SectionBadge>

                                <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-foreground sm:text-3xl">
                                    Pretty outside. Guarded inside.
                                </h2>

                                <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
                                    Role scopes, org boundaries, protected records, and clean backend guards keep
                                    the platform safe without making the interface feel like airport security.
                                </p>

                                <div className="mt-5 grid gap-2">
                                    <SecurityPoint>Tenant-aware data isolation</SecurityPoint>
                                    <SecurityPoint>Role and department scopes</SecurityPoint>
                                    <SecurityPoint>Protected academic records</SecurityPoint>
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={120}>
                            <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6 shadow-2xl shadow-primary/10">
                                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />

                                <div className="relative max-w-xl">
                                    <SectionBadge icon={<Sparkles className="h-3 w-3" />}>
                                        Ready when you are
                                    </SectionBadge>

                                    <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.045em] text-foreground sm:text-4xl lg:text-5xl">
                                        Make your institute feel ten years newer.
                                    </h2>

                                    <p className="mt-4 text-base font-medium leading-relaxed text-muted-foreground">
                                        Start with your core workflows, then grow into the full education operating system.
                                    </p>

                                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                        <Link
                                            href="/register"
                                            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3 text-base font-black text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.03] hover:bg-primary-hover active:scale-95"
                                        >
                                            Start Free Trial
                                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        </Link>

                                        <Link
                                            href="/docs"
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background/70 px-7 py-3 text-base font-black text-foreground backdrop-blur transition-all hover:scale-[1.03] hover:bg-background active:scale-95"
                                        >
                                            <BookOpen className="h-5 w-5" />
                                            Read Docs
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}

function HeroBackground() {
    return (
        <>
            <div className="absolute inset-0 bg-background" />
            <div className="absolute -left-32 -top-32 h-112 w-md rounded-full bg-primary/15 blur-[120px]" />
            <div className="absolute -bottom-40 right-0 h-120 w-120 rounded-full bg-primary/10 blur-[130px]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[68px_68px]" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent" />
        </>
    );
}

function SoftGlow() {
    return (
        <>
            <div className="absolute left-1/2 top-1/2 h-120 w-120 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-[140px]" />
            <div className="absolute right-0 top-0 h-72 w-[18rem] translate-x-1/2 rounded-full bg-primary/6 blur-[120px]" />
        </>
    );
}

function SectionBadge({ children, icon }: { children: ReactNode; icon: ReactNode }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
            {icon}
            {children}
        </div>
    );
}

function MiniPill({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {children}
        </span>
    );
}

function Metric({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-center shadow-sm backdrop-blur">
            <p className="text-lg font-black tracking-tight text-foreground sm:text-xl">{value}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
    );
}

function FloatingSignal({
    className,
    icon,
    title,
    text,
}: {
    className: string;
    icon: ReactNode;
    title: string;
    text: string;
}) {
    return (
        <div className={`absolute z-30 items-center gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-2xl shadow-primary/10 backdrop-blur-xl ${className}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                {icon}
            </div>
            <div>
                <p className="text-xs font-black text-foreground">{title}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">{text}</p>
            </div>
        </div>
    );
}

function SecurityPoint({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            <span className="text-sm font-bold text-foreground">{children}</span>
        </div>
    );
}

function Footer() {
    return (
        <footer className="relative overflow-hidden border-t border-border bg-background">
            <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-linear-to-r from-transparent via-primary/20 to-transparent" />

            <div className="container mx-auto px-5 py-10 sm:px-6 md:py-12">
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-4">
                        <Brand size="lg" />

                        <p className="max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">
                            {PLATFORM_NAME} is a modern education operating system for institutes that want cleaner workflows,
                            sharper visibility, and calmer teams.
                        </p>

                        <div className="flex gap-3">
                            <SocialButton href="#" icon={<Twitter className="h-4 w-4" />} label="Twitter" />
                            <SocialButton href="#" icon={<Facebook className="h-4 w-4" />} label="Facebook" />
                            <SocialButton href="#" icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" />
                            <SocialButton href="#" icon={<Instagram className="h-4 w-4" />} label="Instagram" />
                        </div>
                    </div>

                    <FooterColumn
                        title="Product"
                        links={[
                            { href: '/docs', label: 'Documentation' },
                            { href: '/pricing', label: 'Pricing' },
                            { href: '/contact', label: 'Contact' },
                        ]}
                    />

                    <FooterColumn
                        title="Company"
                        links={[
                            { href: '/about', label: 'About Us' },
                            { href: '/blog', label: 'Blog' },
                            { href: '/careers', label: 'Careers' },
                        ]}
                    />

                    <FooterColumn
                        title="Legal"
                        links={[
                            { href: '/privacy', label: 'Privacy Policy' },
                            { href: '/terms', label: 'Terms of Service' },
                        ]}
                    />
                </div>

                <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({
    title,
    links,
}: {
    title: string;
    links: { href: string; label: string }[];
}) {
    return (
        <div>
            <h4 className="mb-4 text-sm font-black tracking-wider text-foreground">{title}</h4>

            <ul className="space-y-2.5">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SocialButton({
    href,
    icon,
    label,
}: {
    href: string;
    icon: ReactNode;
    label: string;
}) {
    return (
        <Link
            href={href}
            aria-label={label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
        >
            {icon}
        </Link>
    );
}