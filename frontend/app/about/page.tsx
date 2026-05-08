'use client';
import { Reveal } from '@/components/ui/Reveal';
import { Target, Eye, Heart, Shield, Users, Zap, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-18 overflow-hidden">
        <div className="absolute inset-0 bg-background">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-size-[64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-size-[64px_64px]" />
        <div className="container mx-auto px-6 text-center max-w-4xl space-y-6 relative z-10">
          <Reveal>
            <Badge variant="primary" className="mb-4">
              Our Identity
            </Badge>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">
              Revolutionizing
              <span className="block bg-linear-to-r pb-5 from-primary via-primary/80 to-success bg-clip-text text-transparent mt-2">
                Institutional Management
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
              We bridge the gap between complex administration and human-first education,
              building tools that empower the next generation of academic excellence.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="pb-18">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-6xl mx-auto">
            <Reveal>
              <div className="p-12 rounded-4xl bg-card text-foreground space-y-6 h-full border border-border shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <Target className="w-14 h-14 text-primary mb-6" />
                  <h2 className="text-3xl font-black">Our Mission</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed font-medium">
                    To provide a unified, accessible, and high-performance digital ecosystem for educational institutions worldwide,
                    automating repetitive tasks so educators can focus on what truly matters: teaching.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="p-12 rounded-4xl bg-card border border-border space-y-6 h-full shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <Eye className="w-14 h-14 text-primary mb-6" />
                  <h2 className="text-3xl font-black text-foreground">Our Vision</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed font-medium">
                    A future where school administration is seamless and invisible,
                    powered by technologies that foster transparency, accessibility, and excellence
                    across all academic borders.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-18">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <Reveal>
              <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter">Core Values</h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-muted-foreground text-lg font-medium">The principles that guide every feature we build.</p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left max-w-6xl mx-auto">
            {[
              { icon: <Heart className="w-8 h-8 text-danger" />, title: 'Human Centric', desc: 'We build for people, not just for databases. The user experience is our top priority.', color: 'from-danger/10 to-danger/5 border-danger/20' },
              { icon: <Shield className="w-8 h-8 text-primary" />, title: 'Radical Security', desc: 'Institutions trust us with sensitive data, and we treat that trust as our highest responsibility.', color: 'from-primary/10 to-primary/5 border-primary/20' },
              { icon: <Globe className="w-8 h-8 text-success" />, title: 'Educational Equity', desc: 'Our platform is designed to scale and serve schools regardless of their geographic location or size.', color: 'from-success/10 to-success/5 border-success/20' }
            ].map((v, i) => (
              <Reveal key={i} delay={i * 200}>
                <div className="relative p-8 bg-card border border-border rounded-2xl hover:shadow-xl transition-all overflow-hidden group">
                  <div className={`absolute inset-0 bg-linear-to-br ${v.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10 space-y-6">
                    <div className="w-16 h-16 bg-linear-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-border">
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
    </div>
  );
}
