'use client';

import Link from 'next/link';
import type React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
    BadgeCheck,
    BookOpen,
    CalendarDays,
    GraduationCap,
    Loader2,
    Pencil,
    ShieldCheck,
    Star,
    Users,
    WalletCards,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { BrandIcon } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { StarRatingInput } from '@/components/evaluations/StarRatingInput';
import { PublicProfile, PublicProfileDepartment, PublicProfileSection } from '@/types';
import { formatCourseSectionLabel, formatDepartmentLabel, getSectionSurfaceStyle } from '@/lib/utils';
import { getRoleLabel } from '@/lib/roles';
import { UserCommsAction } from '@/components/communication/UserCommsAction';
import { useAuth } from '@/context/AuthContext';

function formatDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
}

function DetailItem({ label, value }: { label: string; value?: React.ReactNode }) {
    return (
        <div className="min-w-0 border-l-2 border-primary/30 bg-background/35 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="mt-1 min-w-0 text-sm font-bold leading-5 text-foreground">{value || <span className="text-muted-foreground">-</span>}</div>
        </div>
    );
}

function uniqueById<T extends { id: string }>(items: T[]) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function DepartmentBadges({ departments }: { departments: PublicProfileDepartment[] }) {
    if (departments.length === 0) {
        return <span className="text-sm font-semibold text-muted-foreground">No departments assigned</span>;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {departments.map((department) => (
                <Badge
                    key={department.id}
                    variant="primary"
                    size="sm"
                    title={formatDepartmentLabel(department)}
                    color={department.color}
                >
                    {department.code || department.name}
                </Badge>
            ))}
        </div>
    );
}

function SectionBadges({ sections }: { sections: PublicProfileSection[] }) {
    if (sections.length === 0) {
        return <span className="text-sm font-semibold text-muted-foreground">No active sections</span>;
    }

    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
                <div
                    key={section.id}
                    className="min-w-0 rounded-md border border-border/60 bg-background/45 px-3 py-2"
                    title={formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name })}
                    style={getSectionSurfaceStyle(section, '18', '55')}
                >
                    <p className="truncate text-sm font-black text-foreground">{section.name}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-muted-foreground">{section.course?.code || section.course?.name || 'Course'}</p>
                </div>
            ))}
        </div>
    );
}

function StaffRating({ profile }: { profile: Extract<PublicProfile, { kind: 'teacher' | 'manager' }> }) {
    const average = profile.rating.averageRating;
    const rounded = Math.round(average || 0);

    return (
        <div className="rounded-md border border-warning/25 bg-warning/10 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-warning/20 text-warning">
                    <Star className="h-5 w-5 fill-warning" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-warning">Evaluation Rating</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-2xl font-black text-foreground">{average?.toFixed(1) ?? '-'}</span>
                        <StarRatingInput value={rounded} readOnly size="sm" />
                        <span className="text-xs font-bold text-muted-foreground">
                            {profile.rating.totalRatings} rating{profile.rating.totalRatings === 1 ? '' : 's'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StudentLayout({ profile }: { profile: Extract<PublicProfile, { kind: 'student' }> }) {
    const departments = uniqueById([
        ...(profile.profile.primaryDepartment ? [profile.profile.primaryDepartment] : []),
        ...(profile.profile.studentDepartments || []).map((entry) => entry.department),
    ]);
    const sections = uniqueById(
        (profile.profile.enrollments || [])
            .map((enrollment) => enrollment.section)
            .filter((section): section is PublicProfileSection => Boolean(section)),
    );

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
            <ProfileSection title="Academic Snapshot" icon={GraduationCap}>
                <div className="grid gap-2 sm:grid-cols-2">
                    <DetailItem label="Registration" value={profile.profile.registrationNumber} />
                    <DetailItem label="Roll Number" value={profile.profile.rollNumber} />
                    <DetailItem label="Program" value={profile.profile.major} />
                    <DetailItem label="Cohort" value={profile.profile.cohort?.code ? `${profile.profile.cohort.code} - ${profile.profile.cohort.name}` : profile.profile.cohort?.name} />
                </div>
            </ProfileSection>
            <ProfileSection title="Timeline" icon={CalendarDays}>
                <div className="grid gap-2">
                    <DetailItem label="Admitted" value={formatDate(profile.profile.admissionDate)} />
                    <DetailItem label="Graduation" value={formatDate(profile.profile.graduationDate)} />
                </div>
            </ProfileSection>
            <ProfileSection title="Departments" icon={GraduationCap}>
                <DepartmentBadges departments={departments} />
            </ProfileSection>
            <ProfileSection title="Enrolled Sections" icon={BookOpen} className="xl:col-span-2">
                <SectionBadges sections={sections} />
            </ProfileSection>
        </div>
    );
}

function StaffLayout({ profile }: { profile: Extract<PublicProfile, { kind: 'teacher' | 'manager' }> }) {
    const departments = profile.kind === 'manager'
        ? (profile.profile.managerDepartments || []).map((entry) => entry.department)
        : (profile.profile.teacherDepartments || []).map((entry) => entry.department);

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
            <ProfileSection title="Professional Snapshot" icon={BadgeCheck}>
                <div className="grid gap-2 sm:grid-cols-2">
                    <DetailItem label="Designation" value={profile.profile.designation} />
                    <DetailItem label="Subject" value={profile.profile.subject} />
                    <DetailItem label="Education" value={profile.profile.education} />
                    <DetailItem label="Joined" value={formatDate(profile.profile.joiningDate)} />
                </div>
            </ProfileSection>
            <StaffRating profile={profile} />
            <ProfileSection title={profile.kind === 'manager' ? 'Manager Scope' : 'Departments'} icon={ShieldCheck}>
                <DepartmentBadges departments={departments} />
            </ProfileSection>
            <ProfileSection title="Teaching Sections" icon={BookOpen} className="xl:col-span-2">
                <SectionBadges sections={profile.profile.sections || []} />
            </ProfileSection>
        </div>
    );
}

function GuardianLayout({ profile }: { profile: Extract<PublicProfile, { kind: 'guardian' }> }) {
    const links = profile.profile.studentLinks || [];

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
            <ProfileSection title="Guardian Snapshot" icon={Users}>
                <div className="grid gap-2 sm:grid-cols-2">
                    <DetailItem label="Linked Students" value={links.length} />
                    <DetailItem label="Joined" value={formatDate(profile.profile.createdAt)} />
                </div>
            </ProfileSection>
            <ProfileSection title="Linked Students" icon={Users} className="xl:col-span-2">
                {links.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                        {links.map((link) => (
                            <div key={link.student.id} className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 bg-background/55 p-3">
                                <BrandIcon variant="user" size="sm" user={link.student.user} initialsFallback />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-foreground">{link.student.user?.name || link.student.rollNumber || 'Student'}</p>
                                    <p className="text-xs font-semibold text-muted-foreground">{link.relationshipLabel}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-sm font-semibold text-muted-foreground">No linked students</span>
                )}
            </ProfileSection>
        </div>
    );
}

function RoleAccountLayout({ profile }: { profile: Extract<PublicProfile, { kind: 'subAdmin' | 'financeManager' }> }) {
    const departments = (profile.profile.subAdminDepartments || []).map((entry) => entry.department);

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
            <ProfileSection title="Account Snapshot" icon={ShieldCheck}>
                <div className="grid gap-2 sm:grid-cols-2">
                    <DetailItem label="Role" value={getRoleLabel(profile.user.role)} />
                    <DetailItem label="Joined" value={formatDate(profile.user.createdAt)} />
                </div>
            </ProfileSection>
            {profile.kind === 'subAdmin' && (
                <ProfileSection title="Department Scope" icon={ShieldCheck} className="xl:col-span-2">
                    {profile.profile.departmentScopeType === 'SELECTED'
                        ? <DepartmentBadges departments={departments} />
                        : <Badge variant="primary" size="md">All Departments</Badge>}
                </ProfileSection>
            )}
        </div>
    );
}

function ProfileSection({ title, icon: Icon, children, className }: { title: string; icon: React.ElementType<{ className?: string }>; children: React.ReactNode; className?: string }) {
    return (
        <section className={`min-w-0 rounded-md border border-border/60 bg-background/45 p-4 ${className || ''}`}>
            <div className="mb-3 flex min-w-0 items-center gap-2 border-b border-border/50 pb-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 className="min-w-0 truncate text-sm font-black text-foreground">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function profileIcon(profile?: PublicProfile) {
    if (!profile) return Users;
    if (profile.kind === 'student') return GraduationCap;
    if (profile.kind === 'teacher' || profile.kind === 'manager') return BadgeCheck;
    if (profile.kind === 'financeManager') return WalletCards;
    if (profile.kind === 'subAdmin') return ShieldCheck;
    return Users;
}

function ProfileKindIcon({ profile }: { profile: PublicProfile }) {
    if (profile.kind === 'student') return <GraduationCap className="h-4 w-4" aria-hidden="true" />;
    if (profile.kind === 'teacher' || profile.kind === 'manager') return <BadgeCheck className="h-4 w-4" aria-hidden="true" />;
    if (profile.kind === 'financeManager') return <WalletCards className="h-4 w-4" aria-hidden="true" />;
    if (profile.kind === 'subAdmin') return <ShieldCheck className="h-4 w-4" aria-hidden="true" />;
    return <Users className="h-4 w-4" aria-hidden="true" />;
}

function profileStatus(profile: PublicProfile) {
    const status = (profile.kind === 'student' || profile.kind === 'teacher' || profile.kind === 'manager')
        ? profile.profile.status || profile.user.status
        : profile.user.status;
    return status ? String(status).replace('_', ' ') : getRoleLabel(profile.user.role);
}

function ProfileHero({ profile }: { profile: PublicProfile }) {
    const joinedAt = formatDate(profile.user.createdAt);

    return (
        <section className="overflow-hidden rounded-lg border border-border/70 bg-background/55">
            <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                    <div className="relative shrink-0">
                        <BrandIcon
                            variant="user"
                            size="hero"
                            user={profile.user}
                            initialsFallback
                            imageLoading="eager"
                            className="ring-4 ring-background shadow-md"
                        />
                        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-primary shadow-sm">
                            <ProfileKindIcon profile={profile} />
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <Badge variant="primary" size="sm">{getRoleLabel(profile.user.role)}</Badge>
                            <Badge variant="neutral" size="sm">{profileStatus(profile)}</Badge>
                        </div>
                        <h1 className="min-w-0 text-xl font-black leading-tight text-foreground sm:text-2xl">
                            {profile.user.name || getRoleLabel(profile.user.role)}
                        </h1>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">
                            {profile.kind === 'student'
                                ? profile.profile.major || profile.profile.registrationNumber || 'Student profile'
                                : profile.kind === 'teacher' || profile.kind === 'manager'
                                    ? profile.profile.designation || profile.profile.subject || 'Staff profile'
                                    : 'Organization account'}
                        </p>
                    </div>
                </div>

                <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-72">
                    <div className="rounded-md border border-border/60 bg-card/70 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account</p>
                        <p className="mt-1 truncate text-sm font-bold text-foreground">{getRoleLabel(profile.user.role)}</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-card/70 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Joined</p>
                        <p className="mt-1 truncate text-sm font-bold text-foreground">{joinedAt || '-'}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function PublicProfilePage() {
    const { user } = useAuth();
    const params = useParams();
    const userId = params.id as string;
    const { data: profile, isLoading, error, mutate } = useSWR<PublicProfile>(
        userId ? ['public-profile', userId] as const : null,
    );
    const Icon = profileIcon(profile);

    if (isLoading) {
        return (
            <PageShell>
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-bold tracking-widest">Loading Profile...</p>
                    </div>
                </div>
            </PageShell>
        );
    }

    if (error) {
        return (
            <PageShell>
                <ErrorState error={error} onRetry={() => mutate()} />
            </PageShell>
        );
    }

    if (!profile) {
        return (
            <PageShell>
                <EmptyState icon={Users} title="Profile not found" description="This profile is unavailable or no longer active." />
            </PageShell>
        );
    }

    const canContactProfile = user?.id !== profile.user.id;
    const hasHeaderActions = canContactProfile || (profile.canEdit && profile.editHref);

    return (
        <PageShell>
            <PageHeader
                title="Profile"
                description={`${profile.user.name || getRoleLabel(profile.user.role)} · ${getRoleLabel(profile.user.role)}`}
                icon={Icon}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'People' },
                    { label: 'Profile' },
                ]}
                meta={<Badge variant="neutral" size="sm">{profileStatus(profile)}</Badge>}
                actions={hasHeaderActions ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {canContactProfile && (
                            <UserCommsAction
                                targetUserId={profile.user.id}
                                targetName={profile.user.name}
                                initialSubject={`Inquiry regarding ${profile.user.name || getRoleLabel(profile.user.role)}`}
                                display="button"
                                className="max-w-fit"
                            />
                        )}
                        {profile.canEdit && profile.editHref && (
                            <Link href={profile.editHref}>
                                <Button type="button" icon={Pencil} variant="secondary">Edit Profile</Button>
                            </Link>
                        )}
                    </div>
                ) : undefined}
            />

            <ResourcePanel className="overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
                        <ProfileHero profile={profile} />
                        <main className="min-w-0">
                        {profile.kind === 'student' && <StudentLayout profile={profile} />}
                        {(profile.kind === 'teacher' || profile.kind === 'manager') && <StaffLayout profile={profile} />}
                        {profile.kind === 'guardian' && <GuardianLayout profile={profile} />}
                        {(profile.kind === 'subAdmin' || profile.kind === 'financeManager') && <RoleAccountLayout profile={profile} />}
                        </main>
                    </div>
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
