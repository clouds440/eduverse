'use client';
import { Reveal } from '@/components/ui/Reveal';
import { Check, ArrowRight, Zap, Shield, Globe } from 'lucide-react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-18 md:py-10 overflow-hidden">
        <div className="absolute inset-0 bg-background">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-size-[64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-size-[64px_64px]" />
        <div className="container mx-auto px-6 text-center max-w-4xl relative z-10">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase mb-6">
              <Zap className="w-3 h-3" />
              <span>Pricing</span>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">
              Simple,
              <span className="block bg-linear-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent mt-2">
                Transparent Pricing
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto mt-6">
              Choose the plan that fits your institution&apos;s size. No hidden fees, no complex contracts.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <PricingCard
              tier="Starter"
              price="$99"
              description="Perfect for small academies and private tutoring centers."
              features={['Up to 50 Students', 'Core Academic Modules', 'Global Chat Support', 'Standard Analytics']}
              delay={0}
            />
            <PricingCard
              tier="Professional"
              price="$299"
              description="Designed for growing schools needing advanced automation."
              features={['Unlimited Students', 'Full Module Suite', 'Priority Admin Support', 'Advanced Financials', 'Custom Branding']}
              highlighted={true}
              delay={200}
            />
            <PricingCard
              tier="Enterprise"
              price="Custom"
              description="Tailored solutions for massive university complexes and school chains."
              features={['Multi-Tenant Management', 'Dedicated Account Manager', 'SLA Guarantees', 'On-Premise Options', 'API Access']}
              delay={400}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-6 text-center space-y-8 max-w-4xl">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-black text-foreground">Still have questions?</h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-muted-foreground max-w-2xl mx-auto font-medium text-lg">
              Our team is ready to help you find the perfect fit for your institution.
              Join 100+ schools scaling with {PLATFORM_NAME}.
            </p>
          </Reveal>
          <Reveal delay={400}>
            <Link href="/contact" className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground rounded-xl font-black hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all hover:scale-105">
              Contact Sales <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function PricingCard({ tier, price, description, features, highlighted = false, delay }: { tier: string, price: string, description: string, features: string[], highlighted?: boolean, delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className={`p-8 rounded-3xl border space-y-8 h-full flex flex-col relative overflow-hidden group ${highlighted
        ? 'border-primary ring-4 ring-primary/5 bg-primary/60 shadow-2xl'
        : 'border-border bg-card hover:border-primary/20 hover:shadow-xl'
        }`}>
        {highlighted && (
          <div className="absolute top-0 right-0 bg-linear-to-l from-primary/20 to-transparent w-32 h-32 blur-2xl" />
        )}
        <div className="relative z-10 space-y-4">
          <h3 className="text-sm font-black text-primary tracking-widest uppercase">{tier}</h3>
          <div className="flex items-baseline space-x-1">
            <span className="text-5xl font-black text-foreground">{price}</span>
            {price !== 'Custom' && <span className="text-muted-foreground font-bold">/mo</span>}
          </div>
          <p className="text-muted-foreground font-medium leading-relaxed">{description}</p>
        </div>

        <ul className="space-y-4 flex-1 relative z-10">
          {features.map((f, i) => (
            <li key={i} className="flex items-center text-muted-foreground font-bold text-sm">
              <Check className="w-5 h-5 text-success mr-3 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href="/register"
          className={`relative z-10 w-full py-4 rounded-xl font-bold text-center transition-all flex items-center justify-center gap-2 ${highlighted
            ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xl shadow-primary/20'
            : 'bg-card text-foreground hover:bg-muted border border-border'
            }`}
        >
          {price === 'Custom' ? 'Contact Sales' : 'Get Started'}
          {price !== 'Custom' && <ArrowRight className="w-4 h-4" />}
        </Link>
      </div>
    </Reveal>
  );
}
