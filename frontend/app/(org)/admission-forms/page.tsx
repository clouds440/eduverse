'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ClipboardList, FilePlus2, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Role, type AdmissionApplicationTemplate } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell } from '@/components/ui/PageShell';

export default function AdmissionFormsPage() {
    const { token, user } = useAuth();
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const { data, error, isLoading } = useSWR<AdmissionApplicationTemplate[]>(token ? 'admission-forms' : null, () => api.admissionForms.list(token!));
    return <PageShell className="overflow-y-auto custom-scrollbar">
        <PageHeader title="Admission Forms" description="Build, publish, and assign versioned application forms." icon={ClipboardList} actions={canManage ? <Link href="/admission-forms/new"><Button icon={Plus}>New form</Button></Link> : undefined} />
        <div className="p-1">
            {isLoading ? <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div> : error ? <ErrorState error={error} title="Admission forms could not be loaded" /> : !data?.length ? <EmptyState icon={FilePlus2} title="No admission forms" description="Create a form to collect applications for program offerings." action={canManage ? <Link href="/admission-forms/new"><Button icon={Plus}>Create form</Button></Link> : undefined} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.map((template) => {
                const latest = template.versions[0];
                return <Link key={template.id} href={`/admission-forms/${template.id}`} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-black">{template.name}</h2><p className="mt-1 line-clamp-2 text-sm font-semibold text-muted-foreground">{template.description || 'Versioned online application form'}</p></div><Pencil className="h-4 w-4 shrink-0 text-primary" /></div>
                    <div className="mt-4 flex flex-wrap gap-2">{template.isDefaultCampus && <Badge variant="info" size="sm">Campus default</Badge>}{latest && <Badge variant={latest.status === 'PUBLISHED' ? 'success' : 'warning'} size="sm">v{latest.version} {latest.status}</Badge>}<Badge variant="neutral" size="sm">{latest?.documentRequirements.length || 0} documents</Badge></div>
                </Link>;
            })}</div>}
        </div>
    </PageShell>;
}
