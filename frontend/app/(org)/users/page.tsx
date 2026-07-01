'use client';

import Link from 'next/link';
import useSWR from 'swr';
import {
    BriefcaseBusiness,
    GraduationCap,
    ShieldCheck,
    UserCog,
    UserPlus,
    Users,
    WalletCards,
    type LucideIcon,
} from 'lucide-react';
import { BadgeVariant, OrgUserCounts, Role } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';

type UserAreaTone = 'primary' | 'info' | 'success' | 'warning' | 'purple' | 'teal' | 'rose';

interface UserArea {
    id: string;
    label: string;
    eyebrow: string;
    description: string;
    href: string;
    createHref: string;
    countKey: keyof OrgUserCounts;
    icon: LucideIcon;
    roles: Role[];
    tone: UserAreaTone;
}

interface UserAreaGroup {
    title: string;
    description: string;
    areas: UserArea[];
}

const toneClasses: Record<UserAreaTone, { icon: string; strip: string; badge: BadgeVariant }> = {
    primary: { 
        icon: 'border-primary/20 bg-primary/10 text-primary',
        strip: 'bg-primary',
        badge: 'primary'
    },
    info: { 
        icon: 'border-info/20 bg-info/10 text-info',
        strip: 'bg-info',
        badge: 'info' 
    },
    success: { 
        icon: 'border-success/20 bg-success/10 text-success',
        strip: 'bg-success',
        badge: 'success'
    },
    warning: { 
        icon: 'border-warning/25 bg-warning/10 text-warning',
        strip: 'bg-warning',
        badge: 'warning'
    },
    purple: {
        icon: 'border-purple/20 bg-purple/10 text-purple',
        strip: 'bg-purple',
        badge: 'purple',
    },
    teal: {
        icon: 'border-teal/20 bg-teal/10 text-teal',
        strip: 'bg-teal',
        badge: 'teal',
    },
    rose: {
        icon: 'border-rose/20 bg-rose/10 text-rose',
        strip: 'bg-rose',
        badge: 'rose',
    },
};

const userGroups: UserAreaGroup[] = [
    {
        title: 'Administration',
        description: 'Accounts that operate the organization workspace and finance controls.',
        areas: [
            {
                id: 'sub-admins',
                label: 'Sub Admins',
                eyebrow: 'Main admin only',
                description: 'Delegated organization operators for daily setup and management work.',
                href: '/users/sub-admins',
                createHref: '/users/sub-admins/add',
                countKey: 'subAdmins',
                icon: ShieldCheck,
                roles: [Role.ORG_ADMIN],
                tone: 'primary',
            },
            {
                id: 'finance-managers',
                label: 'Finance Managers',
                eyebrow: 'Finance workspace',
                description: 'Finance-only operators for ledgers, entries, claims, and transactions.',
                href: '/users/finance-managers',
                createHref: '/users/finance-managers/add',
                countKey: 'financeManagers',
                icon: WalletCards,
                roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
                tone: 'warning',
            },
        ],
    },
    {
        title: 'Academic Staff',
        description: 'Teaching and academic supervision accounts.',
        areas: [
            {
                id: 'managers',
                label: 'Managers',
                eyebrow: 'Academic scope',
                description: 'Academic managers with section-based supervision and finalization access.',
                href: '/users/teachers?role=managers',
                createHref: '/users/teachers/add?role=manager',
                countKey: 'managers',
                icon: BriefcaseBusiness,
                roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
                tone: 'info',
            },
            {
                id: 'teachers',
                label: 'Teachers',
                eyebrow: 'Teaching staff',
                description: 'Teacher profiles, status, subject details, and section assignments.',
                href: '/users/teachers',
                createHref: '/users/teachers/add',
                countKey: 'teachers',
                icon: UserCog,
                roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
                tone: 'rose',
            },
        ],
    },
    {
        title: 'Learners and Families',
        description: 'Student records and family access accounts.',
        areas: [
            {
                id: 'students',
                label: 'Students',
                eyebrow: 'Student records',
                description: 'Student accounts, enrollment data, cohorts, guardian link, and status.',
                href: '/users/students',
                createHref: '/users/students/add',
                countKey: 'students',
                icon: GraduationCap,
                roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
                tone: 'teal',
            },
            {
                id: 'guardians',
                label: 'Guardians',
                eyebrow: 'Linked access',
                description: 'Guardian login accounts linked to one or more student records.',
                href: '/users/guardians',
                createHref: '/users/guardians/add',
                countKey: 'guardians',
                icon: Users,
                roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
                tone: 'purple',
            },
        ],
    },
];

export default function UsersPage() {
    const { token, user } = useAuth();
    const canAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const { data: userCounts } = useSWR<OrgUserCounts>(
        token && canAccess ? ['org-user-counts'] as const : null,
        () => api.org.getUserCounts(token!)
    );
    const visibleGroups = userGroups
        .map((group) => ({
            ...group,
            areas: group.areas.filter((area) => user?.role && area.roles.includes(user.role)),
        }))
        .filter((group) => group.areas.length > 0);
    const visibleCount = visibleGroups.reduce((total, group) => total + group.areas.length, 0);
    const visibleUserTotal = userCounts
        ? visibleGroups.reduce((total, group) => (
            total + group.areas.reduce((groupTotal, area) => groupTotal + (userCounts[area.countKey] ?? 0), 0)
        ), 0)
        : null;

    if (!canAccess) {
        return (
            <PageShell>
                <EmptyState icon={Users} title="Access restricted" description="User management is available to Admin and Sub Admin accounts." />
            </PageShell>
        );
    }

    return (
        <PageShell>
            <PageHeader
                title="Users"
                description="Manage organization accounts by responsibility area."
                icon={Users}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Users' },
                ]}
                meta={(
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" size="sm">{visibleCount} account types</Badge>
                        {visibleUserTotal !== null && (
                            <Badge variant="primary" size="sm">{visibleUserTotal} users</Badge>
                        )}
                    </div>
                )}
            />

            <ResourcePanel className="overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                <div className="space-y-4">
                    {visibleGroups.map((group) => (
                        <section key={group.title} className="space-y-3">
                            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div className="min-w-0">
                                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{group.title}</h2>
                                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{group.description}</p>
                                </div>
                                <div className="hidden md:block">
                                    <Badge variant="neutral" size="sm">{group.areas.length} types</Badge>
                                </div>
                            </div>

                            <div className="grid gap-3 xl:grid-cols-2">
                                {group.areas.map((area) => {
                                    const Icon = area.icon;
                                    const tone = toneClasses[area.tone];
                                    const userCount = userCounts?.[area.countKey];
                                    return (
                                        <article key={area.id} className="relative overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                                            <div className={`absolute inset-y-0 left-0 w-1 ${tone.strip}`} aria-hidden="true" />
                                            <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:pl-5">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${tone.icon}`}>
                                                        <Icon className="h-5 w-5" aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className="text-base font-black text-foreground">{area.label}</h3>
                                                            <Badge variant={tone.badge} size="sm">{area.eyebrow}</Badge>
                                                            <Badge variant="neutral" size="sm">
                                                                {userCount === undefined ? 'Loading' : `${userCount} users`}
                                                            </Badge>
                                                        </div>
                                                        <p className="mt-1 text-sm font-semibold leading-relaxed text-muted-foreground">{area.description}</p>
                                                    </div>
                                                </div>

                                                <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-48">
                                                    <Link href={area.href} className="min-w-0">
                                                        <Button type="button" variant="secondary" className="w-full cursor-pointer">
                                                            View
                                                        </Button>
                                                    </Link>
                                                    <Link href={area.createHref} className="min-w-0">
                                                        <Button type="button" icon={UserPlus} className="w-full cursor-pointer">
                                                            Add
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
