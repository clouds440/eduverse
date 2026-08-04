'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Archive } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PastRecordSectionDetail } from '@/types';
import { ArchiveSectionView } from '@/components/past-records/ArchiveSectionView';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';

export default function PastRecordSectionPage() {
    const { token } = useAuth();
    const params = useParams();
    const id = params.id as string;
    const { data, error, isLoading, mutate } = useSWR<PastRecordSectionDetail>(
        token && id ? ['past-record-section', id, token] as const : null,
        ([, archiveSectionId, authToken]) => api.pastRecords.section(authToken as string, archiveSectionId as string),
    );

    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    if (isLoading || !data) return <Loading size="lg" />;

    return (
        <PageShell>
            <PageHeader
                title={data.payload.section.name}
                description={`${data.cycle.code} - ${data.cycle.name}`}
                icon={Archive}
                breadcrumbs={[{ label: 'Academics' }, { label: 'Past Records', href: '/past-records' }, { label: data.payload.section.name }]}
            />
            <ResourcePanel className="p-4">
                <ArchiveSectionView record={data} />
            </ResourcePanel>
        </PageShell>
    );
}
