'use client';
import { Reveal } from '@/components/ui/Reveal';
import { Clock, ArrowLeft, CheckCircle, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-background">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-size-[64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-size-[64px_64px]" />
        <div className="container mx-auto px-6 text-center max-w-4xl space-y-6 relative z-10">
          <Reveal>
            <div className="w-20 h-20 bg-primary/10 rounded-3xl mx-auto mb-6 flex items-center justify-center border border-primary/20 shadow-lg">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">Terms of Service</h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
              Our commitment to providing a secure and professional educational ecosystem starts with clear, fair terms.
            </p>
          </Reveal>
          <Reveal delay={400}>
            <div className="flex items-center justify-center space-x-2 text-xs font-black text-muted-foreground tracking-widest">
              <Clock className="w-4 h-4" />
              <span>Last Updated: April 01, 2026</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="space-y-12">
            <Reveal>
              <div className="p-8 bg-card border border-border rounded-2xl space-y-4 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <FileText className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground">Acceptance of Terms</h2>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  By accessing or using the {PLATFORM_NAME} platform, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you must not use our services. These terms apply to all administrators, educators, students, and institutional managers who access our platform.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="p-8 bg-card border border-border rounded-2xl space-y-4 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <CreditCard className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground">Subscription & Payments</h2>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  Our services are provided on a subscription basis. Subscriptions automatically renew at the end of each billing cycle unless cancelled by the institutional administrator. We reserve the right to modify our pricing with a 30-day notice to current active organizations.
                </p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="p-8 bg-card border border-border rounded-2xl space-y-4 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-warning/10 rounded-2xl flex items-center justify-center border border-warning/20">
                    <AlertTriangle className="w-7 h-7 text-warning" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground">User Responsibility & Code of Conduct</h2>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  Organizations are responsible for the actions of their assigned users. {PLATFORM_NAME} is a professional educational tool; we prohibit the transmission of harmful code, harassment, or illegal content. We reserve the right to suspend any organization that violates our security standards or code of conduct.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="pt-12 text-center">
            <Reveal delay={400}>
              <Link href="/" className="inline-flex items-center text-primary font-black text-sm tracking-widest hover:translate-x-2 transition-transform">
                Return to Home <ArrowLeft className="ml-2 w-4 h-4" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
