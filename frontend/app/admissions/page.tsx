'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Building2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { PublicOnlineAdmissionOrganization } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { OrgLogoOrIcon } from '@/components/ui/OrgLogoOrIcon';

export default function AdmissionsPage() {
    const [search, setSearch] = useState('');
    const query = search.trim();
    const { data = [], error, isLoading } = useSWR<PublicOnlineAdmissionOrganization[]>(
        ['public-online-admissions-organizations', query],
        () => api.publicOnlineAdmissions.listOrganizations({ search: query || undefined }),
    );
    const countLabel = useMemo(() => `${data.length} ${data.length === 1 ? 'organization' : 'organizations'}`, [data.length]);

    return (
        <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Online Admissions</h1>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">Browse organizations currently accepting public applications.</p>
                    </div>
                    <Badge variant="neutral" size="md">{countLabel}</Badge>
                </header>

                <div className="max-w-xl">
                    <Input icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by organization, location, or program code" />
                </div>

                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Admissions could not be loaded" />
                ) : data.length === 0 ? (
                    <EmptyState title="No online admissions open" description="There are no organizations accepting online applications right now." />
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {data.map((organization) => (
                            <Link
                                key={organization.id}
                                href={`/admissions/${organization.slug}`}
                                className="group rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/5"
                            >
                                <div className="flex items-start gap-3">
                                    <OrgLogoOrIcon logoUrl={organization.logoUrl} orgName={organization.name} className="h-12 w-12 rounded-full ring-2 ring-primary/20" />
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-base font-black text-foreground">{organization.name}</h2>
                                        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{organization.location}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                    {organization.programTags.slice(0, 8).map((tag) => (
                                        <Badge key={tag.id} variant="primary" size="sm">{tag.code}</Badge>
                                    ))}
                                    {organization.programTags.length > 8 && <Badge variant="neutral" size="sm">+{organization.programTags.length - 8}</Badge>}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <span className="inline-flex min-h-9 items-center justify-center rounded-md border border-border/80 bg-card px-3 py-2 text-sm font-semibold leading-tight text-foreground shadow-xs transition-colors group-hover:border-primary/35 group-hover:bg-primary/5">
                                        View programs
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
