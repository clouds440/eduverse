// app/page.tsx — Eduverse Homepage
import { HeroButtons } from '@/components/HeroButtons';
import { DashboardMockup } from '@/components/homepage/DashboardMockup';
import {
    TrustBar,
    EcosystemOverview,
    RoleWorkflows,
    CoreSystems,
    SecurityScalability,
} from '@/components/homepage/HomepageSections';
import Link from 'next/link';
import {
    Twitter,
    Facebook,
    Linkedin,
    Instagram,
    ShieldCheck,
    ArrowRight,
    Zap,
    Users,
    BookOpen,
    Layers,
} from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { Brand } from '@/components/ui/Brand';
import { PLATFORM_NAME } from '@/lib/constants';

export default function HomePage() {
    return (
        <div className="flex flex-col min-h-auto bg-background text-foreground">

            {/* ═══════════════════════════════════════
                HERO SECTION
            ═══════════════════════════════════════ */}
            <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-background">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/15 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-primary/8 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '4s' }} />
                </div>

                {/* Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                            {/* Left content */}
                            <div className="space-y-8 text-center lg:text-left">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                                        <Layers className="w-3.5 h-3.5" />
                                        <span>Education Operating System</span>
                                </div>

                                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-foreground leading-[1.05]">
                                        The Infrastructure for{' '}
                                        <span className="bg-linear-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                                            Modern Institutions
                                        </span>
                                </h1>

                                <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
                                        Centralize academic operations, real-time communication, and institutional intelligence
                                        across every role in your organization. From enrollment to transcripts — one platform, zero silos.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                                        <HeroButtons />
                                </div>

                                <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 lg:gap-6 pt-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <ShieldCheck className="w-4 h-4 text-success" />
                                            <span>Enterprise Security</span>
                                        </div>
                                        <div className="w-1 h-1 bg-border rounded-full" />
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <Zap className="w-4 h-4 text-warning" />
                                            <span>Real-Time Updates</span>
                                        </div>
                                        <div className="hidden lg:flex w-1 h-1 bg-border rounded-full" />
                                        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <Users className="w-4 h-4 text-info" />
                                            <span>6-Tier RBAC</span>
                                        </div>
                                </div>
                            </div>

                            {/* Right — Dashboard Mockup */}
                            <div className="relative hidden lg:block py-10 px-2">
                                <DashboardMockup />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <div className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-1">
                        <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full animate-pulse" />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                TRUST BAR
            ═══════════════════════════════════════ */}
            <TrustBar />

            {/* ═══════════════════════════════════════
                ECOSYSTEM OVERVIEW
            ═══════════════════════════════════════ */}
            <EcosystemOverview />

            {/* ═══════════════════════════════════════
                ROLE WORKFLOWS
            ═══════════════════════════════════════ */}
            <RoleWorkflows />

            {/* ═══════════════════════════════════════
                CORE SYSTEMS
            ═══════════════════════════════════════ */}
            <CoreSystems />

            {/* ═══════════════════════════════════════
                DASHBOARD SHOWCASE — Full width
            ═══════════════════════════════════════ */}
            <section className="py-24 md:py-32 bg-muted/10 relative overflow-hidden">
                <div className="absolute inset-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-225 h-125 bg-primary/5 rounded-full blur-[200px]" />
                </div>
                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
                        <Reveal>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                                <Zap className="w-3 h-3" />
                                <span>Platform Preview</span>
                            </div>
                        </Reveal>
                        <Reveal delay={100}>
                            <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
                                A Dashboard That{' '}
                                <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">Runs Your Institution</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={200}>
                            <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                                Everything your team needs — from real-time analytics to quick actions — accessible the moment they log in.
                                Designed for operational density without visual clutter.
                            </p>
                        </Reveal>
                    </div>

                    <Reveal delay={300}>
                        <div className="max-w-6xl mx-auto" style={{ perspective: '1200px' }}>
                            <div style={{ transform: 'rotateX(2deg)' }}>
                                <DashboardMockup />
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                SECURITY & SCALABILITY
            ═══════════════════════════════════════ */}
            <SecurityScalability />

            {/* ═══════════════════════════════════════
                CTA SECTION
            ═══════════════════════════════════════ */}
            <section className="py-24 md:py-32 bg-card relative overflow-hidden border-y border-border">
                <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-primary/30 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
                </div>
                <div className="container mx-auto px-6 text-center max-w-4xl relative z-10 space-y-10">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                            <Zap className="w-3.5 h-3.5" />
                            <span>Deploy Your Institution</span>
                        </div>
                    </Reveal>
                    <Reveal delay={100}>
                        <h2 className="text-4xl md:text-6xl font-black text-foreground leading-tight tracking-tighter">
                            Ready to Modernize Your{' '}
                            <span className="block bg-linear-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mt-2">
                                Institutional Operations?
                            </span>
                        </h2>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-xl text-muted-foreground font-medium leading-relaxed">
                            Join the institutions running on {PLATFORM_NAME}. Academic lifecycle management,
                            real-time communication, and institutional intelligence — operational in minutes.
                        </p>
                    </Reveal>
                    <Reveal delay={300}>
                        <div className="flex flex-col sm:flex-row gap-5 justify-center pt-6">
                            <Link
                                href="/register"
                                className="group px-10 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-lg hover:bg-primary-hover shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                            >
                                Start Free Trial
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                href="/login"
                                className="px-10 py-3 bg-muted/60 text-foreground backdrop-blur-md rounded-2xl font-black text-lg hover:bg-muted border border-border transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <BookOpen className="w-5 h-5" />
                                View Demo
                            </Link>
                        </div>
                    </Reveal>
                    <Reveal delay={400}>
                        <div className="flex flex-wrap justify-center items-center gap-8 pt-8">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ShieldCheck className="w-4 h-4 text-success" />
                                <span>No credit card required</span>
                            </div>
                            <div className="w-1 h-1 bg-border rounded-full" />
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Zap className="w-4 h-4 text-warning" />
                                <span>14-day free trial</span>
                            </div>
                            <div className="w-1 h-1 bg-border rounded-full" />
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="w-4 h-4 text-info" />
                                <span>Cancel anytime</span>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                FOOTER
            ═══════════════════════════════════════ */}
            <footer className="bg-background border-t border-border relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
                <div className="container mx-auto px-6 py-16 md:py-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                        {/* Brand */}
                        <div className="space-y-6">
                            <Brand size="lg" />
                            <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                                The unified education operating system for institutions that demand
                                operational excellence, real-time intelligence, and enterprise-grade security.
                            </p>
                            <div className="flex space-x-3">
                                <SocialButton href="#" icon={<Twitter className="w-4 h-4" />} label="Twitter" />
                                <SocialButton href="#" icon={<Facebook className="w-4 h-4" />} label="Facebook" />
                                <SocialButton href="#" icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" />
                                <SocialButton href="#" icon={<Instagram className="w-4 h-4" />} label="Instagram" />
                            </div>
                        </div>

                        {/* Links */}
                        <div>
                            <h4 className="text-sm font-bold text-foreground tracking-wider mb-6">Product</h4>
                            <ul className="space-y-4">
                                <li><Link href="/docs" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Documentation</Link></li>
                                <li><Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Pricing</Link></li>
                                <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Contact</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-foreground tracking-wider mb-6">Company</h4>
                            <ul className="space-y-4">
                                <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">About Us</Link></li>
                                <li><Link href="/blog" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Blog</Link></li>
                                <li><Link href="/careers" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Careers</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-foreground tracking-wider mb-6">Legal</h4>
                            <ul className="space-y-4">
                                <li><Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Privacy Policy</Link></li>
                                <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors text-sm font-medium">Terms of Service</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function SocialButton({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
    return (
        <Link
            href={href}
            aria-label={label}
            className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/20 hover:bg-primary/5 hover:-translate-y-1 transition-all duration-300"
        >
            {icon}
        </Link>
    );
}
