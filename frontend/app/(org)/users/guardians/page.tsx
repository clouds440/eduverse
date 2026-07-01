'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { FileUp, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { GuardianProfile, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { BrandIcon } from '@/components/ui/Brand';
import { TableActions } from '@/components/ui/TableActions';
import { CsvImportModal } from '@/components/imports/CsvImportModal';

export default function GuardiansPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const [importOpen, setImportOpen] = useState(false);
    const canAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const routeBase = '/users/guardians';
    const { data = [], isLoading, error, mutate } = useSWR<GuardianProfile[]>(
        token && canAccess ? ['guardians', token] as const : null,
        ([, t]) => api.org.getGuardians(t as string)
    );

    const columns: Column<GuardianProfile>[] = [
        {
            header: 'Guardian',
            accessor: (guardian) => (
                <div className="flex min-w-0 items-center gap-3">
                    <BrandIcon variant="user" user={guardian.user} size="sm" className="h-10 w-10" />
                    <div className="min-w-0">
                        <p className="truncate font-black text-foreground">{guardian.user?.name || 'Guardian'}</p>
                        <p className="truncate text-sm font-semibold text-muted-foreground">{guardian.user?.email}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Linked Students',
            accessor: (guardian) => (
                <div className="flex flex-wrap gap-1">
                    {(guardian.students || []).slice(0, 3).map((student) => (
                        <Badge key={student.id} variant="neutral" size="sm">{student.user?.name || student.rollNumber}</Badge>
                    ))}
                    {(guardian.students?.length || 0) > 3 && <Badge variant="neutral" size="sm">+{(guardian.students?.length || 0) - 3}</Badge>}
                    {(!guardian.students || guardian.students.length === 0) && <span className="text-sm font-semibold text-muted-foreground">None</span>}
                </div>
            ),
        },
        {
            header: 'Phone',
            accessor: (guardian) => guardian.phone || guardian.user?.phone || <span className="text-muted-foreground/50">-</span>,
        },
        {
            header: 'Actions',
            width: 190,
            accessor: (guardian) => (
                <TableActions
                    onView={() => router.push(`/profiles/${guardian.user.id}`)}
                    onEdit={() => router.push(`${routeBase}/edit/${guardian.id}`)}
                    variant="user"
                    extraActions={[
                        {
                            variant: 'link',
                            title: 'Link Students',
                            onClick: () => router.push(`${routeBase}/link/${guardian.id}`),
                        },
                    ]}
                />
            ),
        },
    ];

    if (!canAccess) {
        return (
            <PageShell>
                <EmptyState icon={Users} title="Access restricted" description="Guardian management is available to Admin and Sub Admin accounts." />
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

    return (
        <PageShell>
            <PageHeader
                title="Guardians"
                description="Create guardian login accounts and link them from student records."
                icon={Users}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Users', href: '/users' },
                    { label: 'Guardians' },
                ]}
                meta={<Badge variant="neutral" size="sm">{data.length} guardians</Badge>}
            />

            <ResourcePanel>
                <div className="flex shrink-0 justify-end gap-2 border-b border-border/60 bg-card/80 p-3 sm:p-4">
                    <Button type="button" variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>Import CSV</Button>
                    <Link href={`${routeBase}/add`}>
                        <Button type="button" icon={UserPlus}>Add Guardian</Button>
                    </Link>
                </div>
                <DataTable
                    data={data}
                    columns={columns}
                    keyExtractor={(guardian) => guardian.id}
                    isLoading={isLoading}
                    onRowClick={(guardian) => router.push(`/profiles/${guardian.user.id}`)}
                    currentPage={1}
                    totalPages={1}
                    totalResults={data.length}
                    pageSize={data.length || 10}
                    onPageChange={() => undefined}
                    showSerialNumber
                    emptyTitle="No guardians found"
                    emptyDescription="Create a guardian account, then use Link Students from the actions menu."
                />
            </ResourcePanel>
            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="guardians"
                title="Guardians"
                cachePrefix="guardians"
            />
        </PageShell>
    );
}
