'use client';
// app/page.tsx
import { HeroButtons } from '@/components/HeroButtons';
import Link from 'next/link';
import {
  Twitter,
  Facebook,
  Linkedin,
  Instagram,
  Users,
  MessageSquare,
  Megaphone,
  GraduationCap,
  ShieldCheck,
  LayoutDashboard,
  BookOpen,
  ArrowRight,
  Zap,
  Globe,
  Check,
  BellDot,
  GraduationCapIcon,
  UsersIcon
} from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { Brand } from '@/components/ui/Brand';
import { PLATFORM_NAME } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-auto bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Modern gradient background */}
        <div className="absolute inset-0 bg-background">
          {/* Animated gradient orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
          <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-primary/10 rounded-full blur-[80px] animate-pulse animation-delay-4000" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-fit mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left content */}
              <div className="space-y-8 text-center lg:text-left">
                <Reveal delay={100}>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Next-Gen School Management</span>
                  </div>
                </Reveal>

                <Reveal delay={200}>
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-foreground leading-[1.05] lg:leading-[1.1]">
                    Transform Your
                    <span className="block bg-linear-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent mt-2">
                      Institution's Future
                    </span>
                  </h1>
                </Reveal>

                <Reveal delay={300}>
                  <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    A unified cloud ecosystem that bridges administration, teachers, and students. Experience seamless school management with modern tools designed for today's educational landscape.
                  </p>
                </Reveal>

                <Reveal delay={400}>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                    <HeroButtons />
                  </div>
                </Reveal>

                <Reveal delay={500}>
                  <div className="flex flex-wrap justify-center lg:justify-start items-center gap-6 pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <ShieldCheck className="w-4 h-4 text-success" />
                      <span>Enterprise Security</span>
                    </div>
                    <div className="w-1 h-1 bg-border rounded-full" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Zap className="w-4 h-4 text-warning" />
                      <span>14-Day Free Trial</span>
                    </div>
                    <div className="w-1 h-1 bg-border rounded-full" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Users className="w-4 h-4 text-info" />
                      <span>100+ Schools</span>
                    </div>
                  </div>
                </Reveal>
              </div>

              {/* Right - Dashboard Preview */}
              <div className="relative hidden lg:block">
                <Reveal delay={600}>
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute -inset-4 bg-linear-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl" />

                    {/* Dashboard card */}
                    <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-hidden">
                      {/* Header */}
                      <div className="h-12 bg-muted/30 border-b border-border flex items-center px-4 gap-2">
                        <div className="w-3 h-3 rounded-full bg-danger" />
                        <div className="w-3 h-3 rounded-full bg-warning" />
                        <div className="w-3 h-3 rounded-full bg-success" />
                      </div>

                      {/* Content */}
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                            <div className="flex items-center gap-2 mb-1">
                              <GraduationCapIcon className='w-5 h-5 text-primary' />
                              <p className="text-2xl font-black text-primary">10k+</p>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">Students</p>
                          </div>
                          <div className="bg-warning/5 rounded-xl p-4 border border-secondary/10">
                            <div className="flex items-center gap-2 mb-1">
                              <UsersIcon className='w-5 h-5 text-warning' />
                              <p className="text-2xl font-black text-warning">500+</p>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">Teachers</p>
                          </div>
                          <div className="bg-success/5 rounded-xl p-4 border border-success/10">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className='w-5 h-5 text-success' />
                              <p className="text-2xl font-black text-success">99.9%</p>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">Uptime</p>
                          </div>
                        </div>

                        <div className="h-32 bg-muted/30 rounded-xl border border-border flex items-center justify-center">
                          <div className="text-center">
                            <LayoutDashboard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground font-medium">Analytics Dashboard</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div className="h-full w-3/4 bg-primary rounded-full" />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Progress</span>
                            <span>75%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Floating elements */}
                    <div className="absolute -top-4 -right-4 bg-card rounded-xl border border-border shadow-lg p-3 animate-pulse animation-duration-3000">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="absolute -bottom-5 -left-4 bg-card rounded-xl border border-border shadow-lg p-3 animate-pulse animation-duration-4000 animation-delay-1000">
                      <GraduationCap className="w-5 h-5 text-success" />
                    </div>
                  </div>
                </Reveal>
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

      {/* How It Works - Transitional Section */}
      <section className="py-20 md:py-24 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Get Started in Minutes</h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                Three simple steps to transform your institution's operations.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up and set up your organization profile in under 2 minutes.', icon: <Users className="w-6 h-6 text-primary" /> },
              { step: '02', title: 'Add Members', desc: 'Invite teachers and students with bulk import or individual invites.', icon: <GraduationCap className="w-6 h-6 text-primary" /> },
              { step: '03', title: 'Start Managing', desc: 'Begin using all modules - chat, assessments, notices, and more.', icon: <LayoutDashboard className="w-6 h-6 text-primary" /> }
            ].map((item, i) => (
              <Reveal key={i} delay={i * 150}>
                <div className="relative group">
                  <div className="text-6xl font-black text-muted-foreground/10 absolute -top-4 -left-2 select-none">{item.step}</div>
                  <div className="relative z-10 space-y-4 pt-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/40 group-hover:text-primary-foreground transition-all">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground text-sm font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Product Highlight */}
      <section id="product-highlight" className="py-24 md:py-32 overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-primary/5 rounded-full blur-[150px]" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 space-y-10 text-left order-2 lg:order-1">
              <div className="space-y-4">
                <Reveal>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                    <Zap className="w-3 h-3" />
                    <span>Centralized Intelligence</span>
                  </div>
                </Reveal>
                <Reveal delay={100}>
                  <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                    One Platform to
                    <span className="block bg-linear-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent mt-2">
                      Manage Everything
                    </span>
                  </h2>
                </Reveal>
                <Reveal delay={200}>
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
                    Break down silos and unify your school operation. From financial forecasting
                    to student grading, everything is available at your fingertips.
                  </p>
                </Reveal>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-2">
                {[
                  { icon: <Zap className="w-4 h-4 text-primary" />, text: 'Live Data Syncing', color: 'bg-primary/10 border-primary/20' },
                  { icon: <ShieldCheck className="w-4 h-4 text-success" />, text: 'Instant Smart Alerts', color: 'bg-success/10 border-success/20' },
                  { icon: <LayoutDashboard className="w-4 h-4 text-warning" />, text: 'One-Click Analytics', color: 'bg-warning/10 border-warning/20' },
                  { icon: <MessageSquare className="w-4 h-4 text-info" />, text: 'Unified Comms', color: 'bg-info/10 border-info/20' }
                ].map((item, i) => (
                  <Reveal key={i} delay={300 + (i * 100)}>
                    <li className="flex items-center text-foreground font-bold text-sm p-3 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-lg transition-all">
                      <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center mr-3 shrink-0`}>
                        {item.icon}
                      </div>
                      {item.text}
                    </li>
                  </Reveal>
                ))}
              </ul>

              <Reveal delay={700}>
                <Link href="/docs" className="group inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm tracking-wider hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all hover:scale-105">
                  Read Documentation <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Reveal>
            </div>

            <div className="flex-1 relative order-1 lg:order-2 w-full">
              <Reveal delay={400}>
                <div className="relative">
                  {/* Animated background blobs */}
                  <div className="absolute -inset-8 bg-linear-to-r from-primary/10 to-secondary/10 rounded-[40px] blur-3xl animate-pulse" />
                  <div className="absolute top-0 right-0 w-40 h-40 bg-success/10 rounded-full blur-2xl" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-warning/10 rounded-full blur-2xl" />

                  {/* Main card */}
                  <div className="relative bg-card/90 backdrop-blur-xl rounded-3xl border border-border shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="h-14 bg-muted/30 border-b border-border flex items-center justify-between px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-danger" />
                        <div className="w-3 h-3 rounded-full bg-warning" />
                        <div className="w-3 h-3 rounded-full bg-success" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span>Live</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-linear-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/10">
                          <div className="flex items-center gap-2 mb-1">
                            <BellDot className="hidden md:flex w-5 h-5 text-primary" />
                            <p className="text-xl md:text-2xl font-black text-primary">Instant</p>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">Notification Delivery</p>
                        </div>
                        <div className="bg-linear-to-br from-warning/10 to-warning/5 rounded-xl p-4 border border-warning/10">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="hidden md:flex w-5 h-5 text-warning" />
                            <p className="text-xl md:text-2xl font-black text-warning">Live Chat</p>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">Built-in Comms Module</p>
                        </div>
                        <div className="bg-linear-to-br from-success/10 to-success/5 rounded-xl p-4 border border-success/10">
                          <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="hidden md:flex w-5 h-5 text-success" />
                            <p className="text-xl md:text-2xl font-black text-success">100%</p>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">Assessment Tracking</p>
                        </div>
                      </div>

                      {/* Chart placeholder */}
                      <div className="h-36 bg-linear-to-br from-muted/30 to-muted/10 rounded-xl border border-border flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[20px_20px]" />
                        <div className="text-center relative z-10">
                          <LayoutDashboard className="w-10 h-10 text-primary mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground font-medium">Real-time Analytics</p>
                        </div>

                        {/* Floating badges */}
                        <div className="hidden md:flex absolute bottom-1 right-1 bg-card rounded-2xl border border-border shadow-xl p-4 animate-bounce animation-duration-3000">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                              <Check className="w-5 h-5 text-success" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">Today</p>
                              <p className="text-sm font-black text-foreground">+127 Tasks</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress bars */}
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-muted-foreground">Student Progress</span>
                            <span className="text-primary">75%</span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div className="h-full w-3/4 bg-linear-to-r from-primary to-success rounded-full" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-muted-foreground">Teacher Performance</span>
                            <span className="text-warning">82%</span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div className="h-full w-[82%] bg-linear-to-r from-warning to-success rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Features Grid */}
      <section id="features" className="py-24 md:py-32 bg-muted/20 relative">
        <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-background to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase mb-4">
                <Zap className="w-3 h-3" />
                <span>Powerful Features</span>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter">Everything You Need</h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                A complete suite of tools designed to automate your institution, scaling from
                small academies to massive university complexes.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6 text-info" />}
              title="Global Chat"
              description="Real-time localized and global messaging channels for seamless student-teacher interaction."
              color="from-info/10 to-info/5 border-info/20"
              index={0}
            />
            <FeatureCard
              icon={<Megaphone className="w-6 h-6 text-primary" />}
              title="Smart Notices"
              description="Automated broadcasting system with priority levels and read-receipt tracking for admins."
              color="from-primary/10 to-primary/5 border-primary/20"
              index={1}
            />
            <FeatureCard
              icon={<BookOpen className="w-6 h-6 text-primary" />}
              title="Assessments"
              description="Professional grading engine with support for multimedia submissions and peer feedback loops."
              color="from-primary/10 to-primary/5 border-primary/20"
              index={2}
            />
            <FeatureCard
              icon={<Users className="w-6 h-6 text-info" />}
              title="Permissions"
              description="High-security access controls for administrators, managers, educators, and guard-controlled students."
              color="from-info/10 to-info/5 border-info/20"
              index={3}
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6 text-warning" />}
              title="Scalability"
              description="Robust multi-tenant architecture designed to handle thousands of concurrent organizations."
              color="from-warning/10 to-warning/5 border-warning/20"
              index={4}
            />
            <FeatureCard
              icon={<LayoutDashboard className="w-6 h-6 text-success" />}
              title="Analytics"
              description="Deep-dive reporting with exportable data visualizations for financial and academic metrics."
              color="from-success/10 to-success/5 border-success/20"
              index={5}
            />
          </div>
        </div>
      </section>

      {/* Value Prop */}
      <section className="py-24 md:py-40 bg-background relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[150px]" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                <ShieldCheck className="w-3 h-3" />
                <span>Why Choose Us</span>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Built for Excellence</h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                We've engineered every detail to provide the best possible experience for your institution.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <ShieldCheck className="w-10 h-10 text-success" />, title: 'Enterprise Security', desc: 'Financial-level encryption with daily redundant backups and SOC-2 compliance standards.', color: 'from-success/10 to-success/5 border-success/20' },
              { icon: <Zap className="w-10 h-10 text-warning" />, title: 'Ultra Low Latency', desc: 'Edge-optimized delivery ensuring real-time features work anywhere in the world, instantly.', color: 'from-warning/10 to-warning/5 border-warning/20' },
              { icon: <GraduationCap className="w-10 h-10 text-primary" />, title: 'Human-First UX', desc: 'Minimal learning curve with an interface designed after studying thousands of school workflows.', color: 'from-primary/10 to-primary/5 border-primary/20' }
            ].map((item, i) => (
              <Reveal key={i} delay={i * 200}>
                <div className="group p-8 rounded-2xl bg-card border border-border hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-linear-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10 space-y-6">
                    <div className="w-16 h-16 bg-linear-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-border">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-foreground mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
                      <p className="text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Ultimate CTA */}
      <section className="py-24 md:py-32 bg-card relative overflow-hidden border-y border-border">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary/30 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/30 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="container mx-auto px-6 text-center max-w-4xl relative z-10 space-y-10">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>Get Started Today</span>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-4xl md:text-6xl font-black text-foreground leading-tight tracking-tighter">
              Ready to Transform Your
              <span className="block bg-linear-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent mt-2">
                Institution's Future?
              </span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              Start modernizing your administrative workflow today.
              Join 100+ schools and universities scaling with {PLATFORM_NAME}.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-5 justify-center pt-6">
              <Link
                href="/register"
                className="group px-10 py-5 bg-primary text-primary-foreground rounded-2xl font-black text-lg hover:bg-primary-hover shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="px-10 py-5 bg-muted/60 text-foreground backdrop-blur-md rounded-2xl font-black text-lg hover:bg-muted border border-border transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
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

      {/* Footer */}
      <footer className="bg-background border-t border-border relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        <div className="container mx-auto px-6 py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="space-y-6">
              <Brand size="lg" />
              <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                The most comprehensive school management system designed for the modern era.
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

function FeatureCard({ icon, title, description, color, index }: { icon: React.ReactNode, title: string, description: string, color: string, index: number }) {
  return (
    <Reveal delay={index * 100}>
      <div className="group p-8 rounded-2xl border border-border bg-card hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full relative overflow-hidden">
        <div className={`absolute inset-0 bg-linear-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        <div className="relative z-10">
          <div className="w-14 h-14 bg-linear-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-border">
            {icon}
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </Reveal>
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
