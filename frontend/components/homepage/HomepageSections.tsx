'use client';

import { Reveal } from '@/components/ui/Reveal';
import { PLATFORM_NAME } from '@/lib/constants';
import {
    Users, GraduationCap, BookOpen, CalendarCheck, BarChart3, MessageSquare,
    ShieldCheck, Zap, Globe, ArrowRight, Lock, Server, FileText,
    ClipboardList, RefreshCw, Layers, Network,
    Fingerprint, Eye, Activity, Database
} from 'lucide-react';

/* ═══════════════════════════════════════════
   TRUST BAR — Operational metrics strip
   ═══════════════════════════════════════════ */

const TRUST_METRICS = [
    { value: '99.9%', label: 'Uptime SLA', icon: Activity },
    { value: '6', label: 'Role Tiers', icon: ShieldCheck },
    { value: '12+', label: 'Core Modules', icon: Layers },
    { value: 'Real-Time', label: 'WebSocket Engine', icon: Zap },
    { value: 'Multi-Tenant', label: 'Architecture', icon: Globe },
];

export function TrustBar() {
    return (
        <section className="py-6 md:py-8 border-y border-border bg-muted/20 overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:justify-center sm:items-center sm:gap-x-12 lg:gap-x-16 justify-items-center">
                    {TRUST_METRICS.map((metric, i) => (
                        <Reveal
                            key={i}
                            delay={i * 80}
                            className={`w-full sm:w-auto ${i === TRUST_METRICS.length - 1 ? "hidden sm:block" : ""}`}
                        >
                            <div className="flex items-center gap-3 group w-full max-w-[145px] sm:max-w-none mx-auto">
                                <div className="w-9 h-9 rounded-lg bg-primary/8 border border-primary/12 flex items-center justify-center group-hover:bg-primary/15 transition-colors shrink-0">
                                    <metric.icon className="w-4 h-4 text-primary/70" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm md:text-base font-black text-foreground leading-none truncate">{metric.value}</p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium truncate">{metric.label}</p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════
   ECOSYSTEM OVERVIEW — Unified platform map
   ═══════════════════════════════════════════ */

const ECOSYSTEM_MODULES = [
    { icon: Users, name: 'User Management', desc: 'Students, teachers, admins — role-based access across 6 tiers', color: 'from-primary/15 to-primary/5 border-primary/20', iconColor: 'text-primary' },
    { icon: BookOpen, name: 'Academic Engine', desc: 'Courses, sections, enrollments with cohort-based auto-enrollment', color: 'from-secondary/15 to-secondary/20 border-secondary/20', iconColor: 'text-foreground' },
    { icon: RefreshCw, name: 'Academic Lifecycle', desc: 'Cycles, cohorts, promotions — track students across academic periods', color: 'from-success/15 to-success/5 border-success/20', iconColor: 'text-success' },
    { icon: ClipboardList, name: 'Assessment & Grading', desc: 'Weighted assessments, grade lifecycle (Draft → Published → Finalized)', color: 'from-warning/15 to-warning/5 border-warning/20', iconColor: 'text-warning' },
    { icon: CalendarCheck, name: 'Attendance Operations', desc: 'Schedule-driven sessions, ad-hoc marking, bulk operations, analytics', color: 'from-info/10 to-info/5 border-info/20', iconColor: 'text-info' },
    { icon: MessageSquare, name: 'Communication Hub', desc: 'Real-time chat, internal mail, announcements, instant notifications', color: 'from-danger/15 to-danger/5 border-danger/20', iconColor: 'text-danger' },
    { icon: FileText, name: 'Transcripts & Reports', desc: 'Cross-cycle transcripts, cycle reports, enrollment & grade history', color: 'from-violet-500/15 to-violet-500/5 border-violet-500/20', iconColor: 'text-violet-400' },
    { icon: Network, name: 'Multi-Org Platform', desc: 'Organization hierarchy, approval workflows, platform-level governance', color: 'from-teal-600/15 to-teal-600/5 border-teal-600/20', iconColor: 'text-teal-400' },
];

export function EcosystemOverview() {
    return (
        <section className="py-24 md:py-32 bg-background relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-[200px]" />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                            <Layers className="w-3 h-3" />
                            <span>Unified Ecosystem</span>
                        </div>
                    </Reveal>
                    <Reveal delay={100}>
                        <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                            12+ Integrated Systems,{' '}
                            <span className="bg-linear-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                                One Platform
                            </span>
                        </h2>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                            Every module in {PLATFORM_NAME} is deeply interconnected. Academic cycles flow into cohorts,
                            cohorts auto-enroll students into sections, assessments produce grades that feed transcripts —
                            all tracked with immutable audit trails.
                        </p>
                    </Reveal>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                    {ECOSYSTEM_MODULES.map((mod, i) => (
                        <Reveal key={i} delay={i * 80}>
                            <div className={`group p-5 md:p-6 rounded-2xl border bg-linear-to-br ${mod.color} hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 h-full`}>
                                <div className={`w-10 h-10 rounded-xl bg-background/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <mod.icon className={`w-5 h-5 ${mod.iconColor}`} />
                                </div>
                                <h3 className="text-sm font-black text-foreground mb-1.5">{mod.name}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed font-medium">{mod.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════
   ROLE WORKFLOWS — Admin, Teacher, Student
   ═══════════════════════════════════════════ */

const ROLES = [
    {
        role: 'Administration',
        subtitle: 'Complete institutional command center',
        icon: ShieldCheck,
        color: 'text-blue-400',
        border: 'border-blue-500/20',
        bg: 'bg-blue-500/8',
        capabilities: [
            'Manage academic cycles with one-click activation and data isolation',
            'Create cohorts and auto-enroll students across linked sections',
            'Promote students between cycles with full audit trail preservation',
            'Monitor institution-wide analytics, attendance rates, and grade distributions',
            'Control 6-tier role-based access — from Platform Admin to Student',
            'Broadcast announcements with organization-wide or role-targeted delivery',
        ]
    },
    {
        role: 'Faculty',
        subtitle: 'Streamlined teaching operations',
        icon: GraduationCap,
        color: 'text-emerald-400',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/8',
        capabilities: [
            'View assigned sections with full rosters, schedules, and materials',
            'Create weighted assessments with submission tracking and due dates',
            'Grade with a 3-stage lifecycle: Draft → Published → Finalized',
            'Mark attendance in bulk via schedule-driven or ad-hoc sessions',
            'Upload course materials with resource links and video support',
            'Communicate via real-time chat with students, groups, and staff',
        ]
    },
    {
        role: 'Students',
        subtitle: 'Self-service academic portal',
        icon: Users,
        color: 'text-purple-400',
        border: 'border-purple-500/20',
        bg: 'bg-purple-500/8',
        capabilities: [
            'View enrolled sections, schedules, and upcoming assessments',
            'Submit assignments with file uploads to cloud storage',
            'Track grades and academic progress across all enrolled courses',
            'Access personal transcripts with cross-cycle history',
            'Receive real-time notifications for grades, announcements, and deadlines',
            'Chat directly with teachers or participate in group discussions',
        ]
    },
];

export function RoleWorkflows() {
    return (
        <section className="py-24 md:py-32 bg-muted/20 relative">
            <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-background to-transparent" />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                            <Users className="w-3 h-3" />
                            <span>Role-Based Workflows</span>
                        </div>
                    </Reveal>
                    <Reveal delay={100}>
                        <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
                            Tailored Experiences for{' '}
                            <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">Every Role</span>
                        </h2>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                            Each user sees exactly what they need. Six permission tiers ensure data security
                            while maximizing operational efficiency across your entire institution.
                        </p>
                    </Reveal>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    {ROLES.map((role, i) => (
                        <Reveal key={i} delay={i * 150}>
                            <div className={`group p-6 md:p-8 rounded-2xl bg-card border ${role.border} hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 h-full`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-12 h-12 rounded-xl ${role.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <role.icon className={`w-6 h-6 ${role.color}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-foreground">{role.role}</h3>
                                        <p className="text-xs text-muted-foreground font-medium">{role.subtitle}</p>
                                    </div>
                                </div>
                                <ul className="space-y-3">
                                    {role.capabilities.map((cap, j) => (
                                        <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium leading-relaxed">
                                            <ArrowRight className={`w-3.5 h-3.5 ${role.color} shrink-0 mt-1`} />
                                            <span>{cap}</span>
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

/* ═══════════════════════════════════════════
   CORE SYSTEMS — Detailed feature showcase
   ═══════════════════════════════════════════ */

const CORE_SYSTEMS = [
    {
        icon: RefreshCw,
        title: 'Academic Lifecycle Engine',
        desc: 'Define academic cycles, create time-bound cohorts, and orchestrate student progression across periods with automated enrollment and immutable audit trails.',
        bullets: ['Cycle isolation for sections, grades, and attendance', 'Cohort-based auto-enrollment with exclusion controls', 'Cross-cycle student promotions with data preservation'],
        color: 'from-success/10 to-success/5 border-success/20',
        iconColor: 'text-success',
    },
    {
        icon: ClipboardList,
        title: 'Assessment & Grading',
        desc: 'A professional-grade assessment engine supporting weighted evaluations, multimedia submissions, and a controlled grade publication workflow.',
        bullets: ['Weighted assessments with configurable total marks', 'Grade lifecycle: Draft → Published → Finalized', 'File-based submissions with cloud storage integration'],
        color: 'from-warning/10 to-warning/5 border-warning/20',
        iconColor: 'text-warning',
    },
    {
        icon: CalendarCheck,
        title: 'Attendance Operations',
        desc: 'Schedule-driven attendance with support for ad-hoc sessions, bulk marking, and per-section analytics — tied to academic cycles for historical tracking.',
        bullets: ['Day-time schedule management per section', 'Bulk mark: Present, Absent, Late, Excused', 'Date-range queries and attendance rate calculations'],
        color: 'from-info/10 to-info/5 border-info/20',
        iconColor: 'text-info',
    },
    {
        icon: MessageSquare,
        title: 'Communication Hub',
        desc: 'WebSocket-powered real-time messaging with direct chats, group channels, internal mail, announcements, and push notifications — all built in.',
        bullets: ['Chat with typing indicators, read receipts, @mentions', 'Threaded internal mail with status tracking', 'Organization-wide announcements and notifications'],
        color: 'from-danger/10 to-danger/5 border-danger/20',
        iconColor: 'text-danger',
    },
    {
        icon: FileText,
        title: 'Transcripts & Promotions',
        desc: 'Generate comprehensive academic transcripts spanning multiple cycles, and seamlessly promote students between cohorts with full historical preservation.',
        bullets: ['Cross-cycle transcripts with grade & attendance summaries', 'Cycle-level reports with cohort performance analysis', 'Atomic batch promotions with rollback safety'],
        color: 'from-violet-500/10 to-violet-500/5 border-violet-500/20',
        iconColor: 'text-violet-400',
    },
    {
        icon: BarChart3,
        title: 'Analytics & Insights',
        desc: 'Organization-wide and platform-level statistics with dedicated insight modules for data-driven institutional decisions.',
        bullets: ['Student, teacher, course, and enrollment analytics', 'Attendance trends and grade distribution reports', 'Platform admin dashboards with multi-org oversight'],
        color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
        iconColor: 'text-blue-400',
    },
];

export function CoreSystems() {
    return (
        <section className="py-24 md:py-32 bg-background relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                            <Zap className="w-3 h-3" />
                            <span>Core Operations</span>
                        </div>
                    </Reveal>
                    <Reveal delay={100}>
                        <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
                            Institutional Systems,{' '}
                            <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">Production-Ready</span>
                        </h2>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                            Each system is purpose-built for institutional operations —
                            not generic CRUD tools, but domain-specific engines with real workflow logic.
                        </p>
                    </Reveal>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {CORE_SYSTEMS.map((system, i) => (
                        <Reveal key={i} delay={i * 80}>
                            <div className={`group p-6 md:p-7 rounded-2xl border bg-linear-to-br ${system.color} hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 h-full`}>
                                <div className={`w-12 h-12 rounded-xl bg-background/50 border border-border flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-2 transition-all duration-300`}>
                                    <system.icon className={`w-6 h-6 ${system.iconColor}`} />
                                </div>
                                <h3 className="text-lg font-black text-foreground mb-2 group-hover:text-primary transition-colors">{system.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4 font-medium">{system.desc}</p>
                                <ul className="space-y-2">
                                    {system.bullets.map((bullet, j) => (
                                        <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground font-medium">
                                            <div className={`w-1 h-1 rounded-full ${system.iconColor.replace('text-', 'bg-')} mt-1.5 shrink-0`} />
                                            <span>{bullet}</span>
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

/* ═══════════════════════════════════════════
   SECURITY & SCALABILITY
   ═══════════════════════════════════════════ */

const SECURITY_FEATURES = [
    { icon: Lock, title: 'JWT Authentication', desc: 'Signed tokens with configurable expiration, device-scoped sessions, and automatic cleanup of stale sessions after 90 days.' },
    { icon: ShieldCheck, title: '6-Tier RBAC', desc: 'From Super Admin to Student — granular route-level guards with service-layer authorization checks and organization isolation.' },
    { icon: Fingerprint, title: 'Device Forensics', desc: 'Browser fingerprinting, IP geolocation, new device detection with security alerts, and suspicious country-change monitoring.' },
    { icon: Database, title: 'Tenant Isolation', desc: 'Complete data isolation per organization with ActiveOrgGuard preventing cross-tenant access. Parent-child org hierarchies supported.' },
    { icon: Eye, title: 'Audit Trails', desc: 'Immutable EnrollmentHistory and CohortMembershipHistory records. Status change logs, grade lifecycle tracking, and file upload auditing.' },
    { icon: Server, title: 'Production-Ready Infra', desc: 'PostgreSQL with Prisma ORM, NestJS modular architecture, rate limiting via Throttler, CORS enforcement, and class-validator DTOs on all endpoints.' },
];

export function SecurityScalability() {
    return (
        <section className="py-24 md:py-32 bg-muted/20 relative">
            <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-background to-transparent" />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                            <Lock className="w-3 h-3" />
                            <span>Enterprise Infrastructure</span>
                        </div>
                    </Reveal>
                    <Reveal delay={100}>
                        <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
                            Security and Scalability{' '}
                            <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">by Design</span>
                        </h2>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                            Built from the ground up for institutional-grade security requirements.
                            Every layer — from authentication to data storage — is designed for trust.
                        </p>
                    </Reveal>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {SECURITY_FEATURES.map((feat, i) => (
                        <Reveal key={i} delay={i * 100}>
                            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/8 border border-primary/12 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                                        <feat.icon className="w-5 h-5 text-primary/80" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-foreground mb-1.5 group-hover:text-primary transition-colors">{feat.title}</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">{feat.desc}</p>
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
