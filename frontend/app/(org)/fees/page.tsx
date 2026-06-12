'use client';

import useSWR from 'swr';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Role, Student } from '@/types';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Skeleton } from '@/components/ui/Skeleton';
import { DocsLink } from '@/components/ui/DocsLink';
import { StudentFeesView } from '@/components/student/StudentFeesView';

export default function StudentFeesPage() {
    const { token, user } = useAuth();
    const profileKey = token && user?.role === Role.STUDENT ? ['student-profile', user.id] as const : null;
    const { data: profile, isLoading, error, mutate } = useSWR<Student>(profileKey);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    if (user && user.role !== Role.STUDENT) {
        return (
            <PageShell>
                <PageHeader
                    title="Fees & Payments"
                    description="Student fee books are available from student accounts."
                    icon={Wallet}
                    breadcrumbs={[{ label: 'Student Portal' }, { label: 'Fees & Payments' }]}
                />
                <ResourcePanel>
                    <EmptyState
                        icon={Wallet}
                        title="Student-only page"
                        description="Use the main finance workspace to manage organizational finance records."
                        className="min-h-96"
                    />
                </ResourcePanel>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <PageHeader
                title="Fees & Payments"
                description={<>View fee plans, payment requests, and fee history. <DocsLink href="/docs/finance#payment-claims">Read payment guide</DocsLink></>}
                icon={Wallet}
                breadcrumbs={[{ label: 'Student Portal' }, { label: 'Fees & Payments' }]}
            />

            <ResourcePanel>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    {error ? (
                        <ErrorState error={error} onRetry={() => mutate()} />
                    ) : isLoading || !profile?.id ? (
                        <div className="space-y-3">
                            <Skeleton className="h-28 rounded-lg" />
                            <Skeleton className="h-64 rounded-lg" />
                        </div>
                    ) : (
                        <StudentFeesView studentId={profile.id} viewerRole={Role.STUDENT} />
                    )}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
