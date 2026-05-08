// app/docs/page.tsx
'use client';

import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import {
  ChevronDown,
  MessageCircle,
  Shield,
  Settings,
  Users,
  CheckCircle2,
  GraduationCap,
  Info,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PLATFORM_NAME } from '@/lib/constants';

export default function DocsPage() {
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wider uppercase mb-6">
                <BookOpen className="w-3 h-3" />
                <span>Documentation</span>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-[1.1]">
                Learn About
                <span className="block bg-linear-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent mt-2">
                  EduVerse
                </span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mt-6">
                Everything you need to configure, manage, and scale your educational institution on {PLATFORM_NAME}.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                <QuickLink
                  icon={<Shield className="w-5 h-5 text-success" />}
                  title="Safety & Security"
                  description="Learn how we protect student data and enforce role-based access control."
                  href="#roles"
                />
                <QuickLink
                  icon={<Settings className="w-5 h-5 text-primary" />}
                  title="Platform Settings"
                  description="Configure global institution settings, branding, and billing."
                  href="#branding"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Account Setup */}
      <section id="setup" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Account Setup</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Every journey on {PLATFORM_NAME} starts with a Platform Admin account. From this central hub, you can launch
                multiple school branches, manage global staff, and oversee institution-wide analytics.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="bg-card border border-border p-8 rounded-2xl space-y-4 shadow-lg">
                <h4 className="font-bold text-foreground text-lg flex items-center">
                  <Info className="w-5 h-5 mr-3 text-primary" />
                  Multi-Tenant Architecture
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Our platform uses a high-performance multi-tenant architecture. This means each organization you create
                  is logically isolated with its own dedicated data space, while sharing the robust global infrastructure
                  of {PLATFORM_NAME}.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="overview" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <h3 className="text-3xl font-black text-foreground mb-6">Dashboard Overview</h3>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                The dashboard is divided into several key zones designed for maximum efficiency:
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[{ title: 'Global Sidebar', desc: 'Fast access to Mail, Chat, and User Management.', icon: <MessageCircle className="w-5 h-5 text-primary" /> },
                { title: 'Contextual Header', desc: 'Breadcrumbs and quick actions tailored to your current view.', icon: <ChevronDown className="w-5 h-5 text-primary" /> },
                { title: 'Analytics Hub', desc: 'Real-time data visualization of school performance.', icon: <GraduationCap className="w-5 h-5 text-primary" /> },
                { title: 'Notification Center', desc: 'Stay updated with alerts from across all modules.', icon: <Shield className="w-5 h-5 text-primary" /> }].map((item, i) => (
                  <div key={i} className="p-6 bg-card border border-border rounded-2xl hover:border-primary/20 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        {item.icon}
                      </div>
                      <strong className="text-primary font-black text-lg">{item.title}</strong>
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Organization */}
      <section id="org-creation" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <Settings className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Organization Management</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                As a Platform Admin, you can create new institutions (Organizations) by defining their name,
                unique URL slug, and primary administrative contact.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { step: '01', title: 'Identity', desc: 'Define name, logo, and institution type.' },
                  { step: '02', title: 'Network', desc: 'Configure custom domains and URL slugs.' },
                  { step: '03', title: 'Admin', desc: 'Assign the first master manager to the org.' }
                ].map((item, i) => (
                  <div key={i} className="relative p-6 bg-card border border-border rounded-2xl hover:shadow-lg transition-all">
                    <div className="text-4xl font-black text-muted-foreground/10 absolute -top-2 -left-2 select-none">{item.step}</div>
                    <div className="relative z-10">
                      <h4 className="font-black text-foreground mb-2">{item.title}</h4>
                      <p className="text-xs text-muted-foreground font-medium">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Role Management */}
      <section id="roles" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">User Roles & Permissions</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                {[
                  { title: 'Super Admin', role: 'Platform-wide access to all data, payments, and global system settings.', color: 'from-primary/10 to-primary/5' },
                  { title: 'Org Admin', role: 'Full control over their specific institution, branding, and staffing.', color: 'from-secondary/10 to-secondary/5' },
                  { title: 'Teacher', role: 'Manage assigned classes, assessments, and grade student performance.', color: 'from-warning/10 to-warning/5' },
                  { title: 'Student', role: 'Participate in courses, submit assessments, and engage in school chat.', color: 'from-success/10 to-success/5' }
                ].map((item, i) => (
                  <RoleItem key={i} title={item.title} role={item.role} color={item.color} />
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="branding" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <h3 className="text-3xl font-black text-foreground mb-6">Branding & White-labeling</h3>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Make the platform yours. Organization Admins can customize the interface to match their institution&apos;s
                visual identity. Upload high-resolution logos, set CSS color tokens for primary and secondary accents,
                and even customize the login background for a premium user experience.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Communication */}
      <section id="chat" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-info/10 rounded-2xl flex items-center justify-center border border-info/20">
                  <MessageCircle className="w-7 h-7 text-info" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Communication Suite</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="space-y-8">
                <div className="p-6 bg-card border border-border rounded-2xl">
                  <h4 className="text-xl font-black text-foreground mb-3">Real-time Messaging (Chat)</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Our chat system is powered by Socket.io, providing instantaneous communication across your entire school.
                    Teachers can create group chats for classes, while staff can maintain private channels for administrative
                    coordination. Features include markdown support, file attachments, and read receipts.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="announcements" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="p-6 bg-card border border-border rounded-2xl">
                <h4 className="text-xl font-black text-foreground mb-3">School Announcements</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Broadcast important updates to targeted audiences. Announcements can be pinned to the dashboard top-shelf
                  and sorted by priority. Platform Admins can send global notices, while Org Admins can target specific
                  branches or user roles.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Academic */}
      <section id="assessments" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-info/10 rounded-2xl flex items-center justify-center border border-info/20">
                  <GraduationCap className="w-7 h-7 text-info" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Academic Engine</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="space-y-6">
                <div className="p-6 bg-card border border-border rounded-2xl">
                  <h4 className="text-xl font-black text-foreground mb-3">Assessments & Quizzes</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Create robust evaluations using our Assessment Builder. Supports multiple question types, time limits,
                    and auto-grading for objective answers. Teachers can provide detailed qualitative feedback using
                    markdown and attachments.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="grading" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="p-6 bg-card border border-border rounded-2xl">
                <h4 className="text-xl font-black text-foreground mb-3">Grading & Progress Tracking</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Monitor student performance with our advanced gradebook. Automated calculations for weighted grades
                  ensure accuracy, while visual progress charts help identify students who may need additional support.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="timetables" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="p-6 bg-card border border-border rounded-2xl">
                <h4 className="text-xl font-black text-foreground mb-3">Academic Timetables</h4>
                <p className="text-muted-foreground leading-relaxed">
                  The Timetable module allows administrators to map out the entire academic week. Conflict-detection
                  algorithms ensure that teachers and rooms are never double-booked, while students receive instant
                  notifications if a class schedule changes.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* User Portals */}
      <section id="teachers" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center border border-success/20">
                  <Users className="w-7 h-7 text-success" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Teacher Portal</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Teachers have a dedicated environment for classroom management. View schedules, manage attendance,
                and interact with students without the administrative complexity of the full platform dashboard.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="students" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-info/10 rounded-2xl flex items-center justify-center border border-info/20">
                  <GraduationCap className="w-7 h-7 text-info" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Student Portal</h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A streamlined, focus-oriented interface for students. Easily track assignments, view study materials,
                and join class discussions. The mobile-responsive design ensures students can stay connected on any device.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 py-20 ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="text-center space-y-4 mb-12">
                <h2 className="text-3xl md:text-4xl font-black text-foreground">Frequently Asked Questions</h2>
                <p className="text-muted-foreground text-lg">Common questions about using the {PLATFORM_NAME} platform.</p>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="space-y-4">
                <Accordion
                  title="How do I create a new assessment?"
                  content="Navigate to the Academic module, click 'Assessments', then 'Create New'. Choose between Assignment or Quiz mode and follow the wizard to add questions."
                />
                <Accordion
                  title="Can I use custom domains?"
                  content="Yes. Platform Admins can configure CNAME records to point your custom URL to our servers, providing a seamless white-label experience."
                />
                <Accordion
                  title="Is student data encrypted?"
                  content="We use AES-256 encryption for data at rest and TLS 1.3 for data in transit, ensuring maximum security for your institution's sensitive information."
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section id="troubleshoot" className="scroll-mt-24 py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="p-6 bg-card border border-border rounded-2xl">
                <h3 className="text-2xl font-black text-foreground mb-3">Troubleshooting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If you encounter issues with real-time features like chat, ensure that your network allows WebSocket
                  connections (WSS). Clear your browser cache and refresh if you experience styling inconsistencies after
                  a platform update.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer Support */}
      <section className="py-20 border-t border-border ">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <Reveal>
              <div className="text-center md:text-left space-y-2">
                <h3 className="text-xl font-black text-foreground">Need direct assistance?</h3>
                <p className="text-muted-foreground">Our support engineers are ready to help you optimize your school.</p>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="flex gap-4">
                <Link href="/contact">
                  <Button variant="primary">Submit a Ticket</Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ icon, title, description, href }: { icon: React.ReactNode, title: string, description: string, href: string }) {
  return (
    <a
      href={href}
      className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
    >
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform border border-primary/20">
        {icon}
      </div>
      <h3 className="font-black text-foreground group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-sm text-muted-foreground font-medium mt-2">{description}</p>
    </a>
  );
}

function RoleItem({ title, role, color }: { title: string, role: string, color: string }) {
  return (
    <div className={`p-6 bg-card rounded-2xl space-y-3 border border-border hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all relative overflow-hidden group h-full`}>
      <div className={`absolute inset-0 h-full bg-linear-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="relative z-10">
        <h4 className="font-black text-foreground group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">{role}</p>
      </div>
    </div>
  );
}

function Accordion({ title, content }: { title: string, content: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm transition-all hover:border-primary/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left font-bold text-foreground hover:text-primary transition-colors focus:outline-none"
      >
        <span>{title}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
      </button>
      <div
        className={`px-5 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-muted-foreground text-sm leading-relaxed border-t border-border pt-4">
          {content}
        </p>
      </div>
    </div>
  );
}
