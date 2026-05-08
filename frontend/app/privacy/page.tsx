import { Reveal } from '@/components/ui/Reveal';
import { Shield, Clock, ArrowLeft, Lock, Database, Globe } from 'lucide-react';
import Link from 'next/link';
import { PLATFORM_NAME } from '@/lib/constants';

export default function PrivacyPage() {
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
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">Privacy Policy</h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
              Your trust is our most valuable asset. We treat your data with the highest level of security and transparency.
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
                    <Database className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground">Data Storage & Multi-Tenancy</h2>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  {PLATFORM_NAME} architecture is built upon a high-performance multi-tenant system. This means your institution&apos;s data is logically isolated in its own dedicated workspace. We use AES-256 encryption at rest and TLS 1.3 for data in transit, ensuring that student and administrative information remains private and secure at all times.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="p-8 bg-card border border-border rounded-2xl space-y-4 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <Globe className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground">Collection of Information</h2>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  We collect information necessary to provide and improve the educational experience, including account details, organizational metadata, and interaction logs. We never sell your data to third parties. Our business model is based on subscriptions, not your personal information.
                </p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="p-8 bg-card border border-border rounded-2xl space-y-4 shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center border border-success/20">
                    <Lock className="w-7 h-7 text-success" />
                  </div>
                  <h2 className="text-3xl font-black text-foreground">Security Standards</h2>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  We maintain SOC-2 and GDPR compliance standards. Our engineers perform daily redundant backups across geographically distributed edge locations to ensure zero data loss and persistent availability, even in the event of local infrastructure failures.
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
