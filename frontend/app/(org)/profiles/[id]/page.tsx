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

function formatDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
}

function DetailItem({ label, value }: { label: string; value?: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-md border border-border/60 bg-background/55 p-3">
            <p className="text-[11px] font-black uppercase text-muted-foreground">{label}</p>
            <div className="mt-1 min-w-0 text-sm font-semibold text-foreground">{value || <span className="text-muted-foreground">-</span>}</div>
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
        <div className="flex flex-wrap gap-2">
            {departments.map((department) => (
                <Badge
                    key={department.id}
                    variant="primary"
                    size="md"
                    style={department.color ? { borderColor: `${department.color}55`, backgroundColor: `${department.color}18`, color: department.color } : undefined}
                >
                    {formatDepartmentLabel(department)}
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
        <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
                <Badge
                    key={section.id}
                    variant="neutral"
                    size="md"
                    className="max-w-72 truncate"
                    title={formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name })}
                    style={getSectionSurfaceStyle(section, '18', '55')}
                >
                    {formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name })}
                </Badge>
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
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailItem label="Registration" value={profile.profile.registrationNumber} />
                <DetailItem label="Roll Number" value={profile.profile.rollNumber} />
                <DetailItem label="Program" value={profile.profile.major} />
                <DetailItem label="Cohort" value={profile.profile.cohort?.name} />
            </div>
            <ProfileSection title="Departments" icon={GraduationCap}>
                <DepartmentBadges departments={departments} />
            </ProfileSection>
            <ProfileSection title="Enrolled Sections" icon={BookOpen}>
                <SectionBadges sections={sections} />
            </ProfileSection>
            <div className="grid gap-3 md:grid-cols-2">
                <DetailItem label="Admitted" value={formatDate(profile.profile.admissionDate)} />
                <DetailItem label="Graduation" value={formatDate(profile.profile.graduationDate)} />
            </div>
        </div>
    );
}

function StaffLayout({ profile }: { profile: Extract<PublicProfile, { kind: 'teacher' | 'manager' }> }) {
    const departments = profile.kind === 'manager'
        ? (profile.profile.managerDepartments || []).map((entry) => entry.department)
        : (profile.profile.teacherDepartments || []).map((entry) => entry.department);

    return (
        <div className="space-y-4">
            <StaffRating profile={profile} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailItem label="Designation" value={profile.profile.designation} />
                <DetailItem label="Subject" value={profile.profile.subject} />
                <DetailItem label="Education" value={profile.profile.education} />
                <DetailItem label="Joined" value={formatDate(profile.profile.joiningDate)} />
            </div>
            <ProfileSection title={profile.kind === 'manager' ? 'Manager Scope' : 'Departments'} icon={ShieldCheck}>
                <DepartmentBadges departments={departments} />
            </ProfileSection>
            <ProfileSection title="Teaching Sections" icon={BookOpen}>
                <SectionBadges sections={profile.profile.sections || []} />
            </ProfileSection>
        </div>
    );
}

function GuardianLayout({ profile }: { profile: Extract<PublicProfile, { kind: 'guardian' }> }) {
    const links = profile.profile.studentLinks || [];

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <DetailItem label="Linked Students" value={links.length} />
                <DetailItem label="Joined" value={formatDate(profile.profile.createdAt)} />
            </div>
            <ProfileSection title="Linked Students" icon={Users}>
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
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <DetailItem label="Role" value={getRoleLabel(profile.user.role)} />
                <DetailItem label="Joined" value={formatDate(profile.user.createdAt)} />
            </div>
            {profile.kind === 'subAdmin' && (
                <ProfileSection title="Department Scope" icon={ShieldCheck}>
                    {profile.profile.departmentScopeType === 'SELECTED'
                        ? <DepartmentBadges departments={departments} />
                        : <Badge variant="primary" size="md">All Departments</Badge>}
                </ProfileSection>
            )}
        </div>
    );
}

function ProfileSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <section className="rounded-md border border-border/60 bg-background/45 p-4">
            <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-black text-foreground">{title}</h2>
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

function profileStatus(profile: PublicProfile) {
    const status = (profile.kind === 'student' || profile.kind === 'teacher' || profile.kind === 'manager')
        ? profile.profile.status || profile.user.status
        : profile.user.status;
    return status ? String(status).replace('_', ' ') : getRoleLabel(profile.user.role);
}

export default function PublicProfilePage() {
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

    return (
        <PageShell>
            <PageHeader
                title={profile.user.name || getRoleLabel(profile.user.role)}
                description={`${getRoleLabel(profile.user.role)} public profile`}
                icon={Icon}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'People' },
                    { label: 'Profile' },
                ]}
                meta={<Badge variant="neutral" size="sm">{profileStatus(profile)}</Badge>}
                actions={profile.canEdit && profile.editHref ? (
                    <Link href={profile.editHref}>
                        <Button type="button" icon={Pencil} variant="secondary">Edit Profile</Button>
                    </Link>
                ) : undefined}
            />

            <ResourcePanel className="overflow-auto">
                <div className="grid gap-5 p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="min-w-0">
                        <div className="rounded-md border border-border/70 bg-background/55 p-5 text-center">
                            <div className="flex justify-center">
                                <BrandIcon variant="user" size="hero" user={profile.user} initialsFallback imageLoading="eager" />
                            </div>
                            <h1 className="mt-4 truncate text-xl font-black text-foreground">{profile.user.name || getRoleLabel(profile.user.role)}</h1>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{getRoleLabel(profile.user.role)}</p>
                        </div>
                    </aside>
                    <main className="min-w-0">
                        {profile.kind === 'student' && <StudentLayout profile={profile} />}
                        {(profile.kind === 'teacher' || profile.kind === 'manager') && <StaffLayout profile={profile} />}
                        {profile.kind === 'guardian' && <GuardianLayout profile={profile} />}
                        {(profile.kind === 'subAdmin' || profile.kind === 'financeManager') && <RoleAccountLayout profile={profile} />}
                    </main>
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
