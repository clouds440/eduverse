'use client';
import { Reveal } from '@/components/ui/Reveal';
import { Briefcase, MapPin, Search, ArrowRight, Zap, Shield, Globe } from 'lucide-react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';
import { Badge } from '@/components/ui/Badge';

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-background">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-size-[64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-size-[64px_64px]" />
        <div className="container mx-auto px-6 text-center max-w-4xl space-y-6 relative z-10">
          <Reveal>
            <Badge variant="primary" className="mb-4">
              Join the Mission
            </Badge>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">
              Help Us Build the
              <span className="block bg-linear-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent mt-2">
                Future of Education
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
              We&apos;re a distributed team of dreamers and doers building the tools
              that empower thousands of educational institutions.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Perks */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <Reveal>
              <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter">Why {PLATFORM_NAME}?</h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-muted-foreground text-lg font-medium">Life is better when you build something that matters.</p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left max-w-6xl mx-auto">
            {[
              { icon: <Globe className="w-8 h-8 text-primary" />, title: 'Full Remote', desc: 'Work from anywhere in the world. We value outcomes over hours at a desk.', color: 'from-primary/10 to-primary/5 border-primary/20' },
              { icon: <Shield className="w-8 h-8 text-success" />, title: 'Ownership', desc: 'Every team member has a voice and the autonomy to drive their own initiatives.', color: 'from-success/10 to-success/5 border-success/20' },
              { icon: <Zap className="w-8 h-8 text-warning" />, title: 'Fast Scale', desc: 'Experience the thrill of a rapidly scaling platform with new challenges every day.', color: 'from-warning/10 to-warning/5 border-warning/20' }
            ].map((v, i) => (
              <Reveal key={i} delay={i * 200}>
                <div className="relative p-8 bg-card border border-border rounded-2xl hover:shadow-xl transition-all overflow-hidden group">
                  <div className={`absolute inset-0 bg-linear-to-br ${v.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10 space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      {v.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">{v.title}</h3>
                      <p className="text-muted-foreground font-medium leading-relaxed">{v.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Jobs */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="space-y-4 max-w-xl">
              <Reveal>
                <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter">Open Roles</h2>
              </Reveal>
              <Reveal delay={200}>
                <p className="text-muted-foreground text-lg font-medium">Join us in our mission to revolutionize academic management.</p>
              </Reveal>
            </div>
            <Reveal delay={400}>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search positions..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 ring-primary/20 font-medium"
                />
              </div>
            </Reveal>
          </div>

          <div className="space-y-6">
            {[
              { title: 'Senior Full-Stack Engineer', dept: 'Engineering', type: 'Full-time', location: 'Remote (Global)' },
              { title: 'Product Designer', dept: 'Product', type: 'Full-time', location: 'Remote (EMEA)' },
              { title: 'Customer Success Manager', dept: 'Growth', type: 'Full-time', location: 'Remote (US/Americas)' },
            ].map((job, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="group bg-card p-6 md:p-8 rounded-3xl border border-border hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 text-xs font-black text-primary tracking-widest">
                      <Briefcase className="w-3 h-3" />
                      <span>{job.dept}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{job.type}</span>
                    </div>
                    <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">{job.title}</h3>
                    <div className="flex items-center space-x-2 text-muted-foreground text-sm font-medium">
                      <MapPin className="w-4 h-4" />
                      <span>{job.location}</span>
                    </div>
                  </div>
                  <Link href="/contact" className="w-full md:w-auto px-8 py-4 bg-card text-foreground rounded-xl font-black hover:bg-primary hover:text-primary-foreground transition-all text-center border border-border">
                    Apply Now
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-20 text-center">
            <Reveal delay={500}>
              <p className="text-muted-foreground font-medium mb-8">Don&apos;t see a role that fits? We&apos;re always looking for talent.</p>
              <Link href="/contact" className="inline-flex items-center text-primary font-black text-sm tracking-widest hover:translate-x-2 transition-transform">
                Send an Open Application <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
