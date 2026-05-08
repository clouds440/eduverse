// app/contact/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Send,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ArrowRight,
  MessageSquare,
  ShieldHalf,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { BackButton } from '@/components/ui/BackButton';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PLATFORM_NAME } from '@/lib/constants';
import { MailCategory, Role } from '@/types';
import { Reveal } from '@/components/ui/Reveal';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to send message. Please try again.';
}

export default function ContactPage() {
  const { user, token } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<{ subject?: string; message?: string; general?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const newErrors: typeof formErrors = {};
      let hasError = false;

      if (!subject.trim()) {
        newErrors.subject = 'Subject is required';
        hasError = true;
      }
      if (!message.trim()) {
        newErrors.message = 'Message cannot be empty.';
        hasError = true;
      }

      if (hasError) {
        setFormErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      await api.mail.createMail({
        subject: subject,
        message: message,
        category: MailCategory.PLATFORM_SUPPORT,
        priority: 'NORMAL',
        targetRole: Role.PLATFORM_ADMIN,
      }, token);

      setIsSuccess(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to send message. Please try again.';
      const newErrors: typeof formErrors = {};

      if (Array.isArray(message)) {
        message.forEach((m: string) => {
          const msg = m.toLowerCase();
          if (msg.includes('subject')) newErrors.subject = m;
          else if (msg.includes('message')) newErrors.message = m;
          else newErrors.general = m;
        });
      } else {
        const msgStr = message;
        if (msgStr.toLowerCase().includes('subject')) newErrors.subject = msgStr;
        else if (msgStr.toLowerCase().includes('message')) newErrors.message = msgStr;
        else newErrors.general = msgStr;
      }
      setFormErrors(newErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-18 md:py-10 overflow-hidden">
        <div className="absolute inset-0 bg-background">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-pulse animation-delay-2000" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-size-[64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-size-[64px_64px]" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-1 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase">
                <BackButton
                  showHome
                  className='bg-transparent hover:bg-primary/40 rounded-full'
                  homeClasses='rounded-full'
                />
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">
                Get in &nbsp;
                <span className="bg-linear-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent">
                  Touch
                </span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-xl text-muted-foreground font-medium leading-relaxed max-w-2xl mt-6">
                Have a question about the platform or need technical assistance?
                Our administrative team is here to help.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-18">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-12">

            {/* Left Side: Info */}
            <div className="lg:col-span-2 space-y-6 md:space-y-8">
              <Reveal>
                <div className="space-y-6">
                  <InfoCard
                    icon={<ShieldHalf className="w-5 h-5 text-primary" />}
                    title="Identity Verified"
                    description="Your message will be tied to your official account for faster resolution."
                  />
                  <InfoCard
                    icon={<MessageSquare className="w-5 h-5 text-primary" />}
                    title="Direct Message"
                    description="This message goes directly to our platform support team."
                  />
                  <InfoCard
                    icon={<Zap className="w-5 h-5 text-warning" />}
                    title="Fast Response"
                    description="Our team typically responds within 24 hours on business days."
                  />
                </div>
              </Reveal>

              <Reveal delay={200}>
                <Link
                  href="/docs"
                  className="group flex items-center p-4 md:p-6 bg-linear-to-br from-card/50 to-card/30 backdrop-blur-xl rounded-2xl shadow-lg border border-border/50 hover:border-primary/30 hover:shadow-xl transition-all"
                >
                  <div className="w-12 h-12 bg-linear-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-primary/20">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Documentation</h4>
                    <p className="text-sm text-muted-foreground mt-1">Self-service guides and FAQs</p>
                  </div>
                  <ArrowRight className="ml-auto w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </Reveal>
            </div>

            {/* Right Side: Form */}
            <div className="lg:col-span-3">
              <Reveal delay={300}>
                <div className="bg-linear-to-br from-card/80 via-card/60 to-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-6 md:p-10 relative overflow-hidden">
                  {!user ? (
                    <div className="text-center py-12 space-y-6">
                      <div className="relative mx-auto w-16 h-16 mb-6">
                        <div className="absolute inset-0 bg-danger/20 rounded-full animate-pulse" />
                        <div className="relative w-full h-full bg-danger/10 rounded-full flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-danger" />
                        </div>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground">Login Required</h2>
                      <p className="text-muted-foreground text-base md:text-lg">
                        To ensure the security and tracking of your support requests,
                        you must be logged in to contact our team.
                      </p>
                      <div className="pt-4">
                        <Link
                          href="/login"
                          className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:brightness-95 shadow-lg hover:shadow-xl transition-all"
                        >
                          Login to Continue
                        </Link>
                      </div>
                    </div>
                  ) : isSuccess ? (
                    <div className="text-center py-12 space-y-6 animate-scale-in">
                      <div className="relative mx-auto w-20 h-20 mb-6">
                        <div className="absolute inset-0 bg-success/20 rounded-full animate-pulse" />
                        <div className="relative w-full h-full bg-success/5 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-10 h-10 text-success" />
                        </div>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-foreground">Message Sent!</h2>
                      <p className="text-muted-foreground text-base md:text-lg font-medium">
                        Thank you for reaching out. Your mail has been logged and assigned to
                        our administrative team. You will receive a notification when they reply.
                      </p>
                      <button
                        onClick={() => setIsSuccess(false)}
                        className="text-primary font-semibold hover:text-primary/80 underline underline-offset-4 py-2"
                      >
                        Send another message
                      </button>
                      <div className="pt-6">
                        <Link
                          href={user.role === Role.SUPER_ADMIN ? '/admin/organizations' : '/mail'}
                          className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:brightness-95 shadow-lg hover:shadow-xl transition-all"
                        >
                          Go to Your Mailbox
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up" noValidate>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Subject</label>
                        <Input
                          type="text"
                          required
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Brief summary of your inquiry"
                          error={!!formErrors.subject}
                          className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                        />
                        {formErrors.subject && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.subject}</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold tracking-wider text-foreground ml-1 opacity-70">Message</label>
                        <MarkdownEditor
                          value={message}
                          onChange={setMessage}
                          placeholder="How can we help you today? Please provide as much detail as possible. Markdown is supported."
                          rows={8}
                          orgData={{
                            userName: user?.name || '',
                            role: user?.role || '',
                            orgName: user?.orgName || PLATFORM_NAME
                          }}
                        />
                      </div>

                      {formErrors.message && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.message}</p>}

                      {formErrors.general && (
                        <div className="p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl flex items-center text-sm font-medium animate-shake">
                          <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                          {formErrors.general}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        icon={Send}
                        variant="primary"
                        loadingText="Sending..."
                        className="w-full text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                      >
                        Send Message
                      </Button>
                      <p className="text-center text-xs text-muted-foreground font-medium">
                        By submitting this form, you agree to our <Link href="/terms" className="text-primary hover:text-primary/80 underline underline-offset-4">Terms of Service</Link> and <Link href="/privacy" className="text-primary hover:text-primary/80 underline underline-offset-4">Privacy Policy</Link>.
                      </p>
                    </form>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex items-start space-x-4 p-4 bg-card border border-border rounded-xl hover:border-primary/20 hover:shadow-lg transition-all">
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 border border-primary/20">
        {icon}
      </div>
      <div>
        <h4 className="font-black text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
}
