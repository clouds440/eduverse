'use client';

import Link from 'next/link';
import { BriefcaseBusiness, GraduationCap, ShieldCheck, UserCog, UserPlus, Users, WalletCards } from 'lucide-react';
import { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';

const userAreas = [
    {
        id: 'sub-admins',
        label: 'Sub Admins',
        description: 'Operational administrators managed only by the main admin.',
        href: '/sub-admins',
        createHref: '/sub-admins/add',
        icon: ShieldCheck,
        roles: [Role.ORG_ADMIN],
    },
    {
        id: 'managers',
        label: 'Managers',
        description: 'Academic managers with section-based supervision and finalization participation.',
        href: '/teachers?role=managers',
        createHref: '/teachers/add?role=manager',
        icon: BriefcaseBusiness,
        roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
    },
    {
        id: 'finance-managers',
        label: 'Finance Managers',
        description: 'Finance-only operators for ledgers, entries, claims, and transactions.',
        href: '/finance-managers',
        createHref: '/finance-managers/add',
        icon: WalletCards,
        roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
    },
    {
        id: 'teachers',
        label: 'Teachers',
        description: 'Teaching staff accounts, profiles, status, and section assignments.',
        href: '/teachers',
        createHref: '/teachers/add',
        icon: UserCog,
        roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
    },
    {
        id: 'students',
        label: 'Students',
        description: 'Student records, enrollment, account status, and academic profile access.',
        href: '/students',
        createHref: '/students/add',
        icon: GraduationCap,
        roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
    },
    {
        id: 'guardians',
        label: 'Guardians',
        description: 'Guardian accounts linked to one or more student records.',
        href: '/guardians',
        createHref: '/guardians/add',
        icon: Users,
        roles: [Role.ORG_ADMIN, Role.SUB_ADMIN],
    },
];

export default function UsersPage() {
    const { user } = useAuth();
    const canAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const visibleAreas = userAreas.filter((area) => user?.role && area.roles.includes(user.role));

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
                description="Manage organization accounts from one role-aware area."
                icon={Users}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Users' },
                ]}
                meta={<Badge variant="neutral" size="sm">{visibleAreas.length} areas</Badge>}
            />

            <ResourcePanel className="overflow-y-auto p-3 sm:p-4">
                <div className="grid gap-3 lg:grid-cols-2">
                    {visibleAreas.map((area) => {
                        const Icon = area.icon;
                        return (
                            <div key={area.id} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                                            <Icon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-base font-black text-foreground">{area.label}</h2>
                                            </div>
                                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{area.description}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Link href={area.href}>
                                        <Button type="button" variant="secondary">
                                            View
                                        </Button>
                                    </Link>
                                    <Link href={area.createHref}>
                                        <Button type="button" icon={UserPlus}>
                                            Add
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
