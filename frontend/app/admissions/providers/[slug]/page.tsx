'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, BadgeDollarSign, BookOpen, CalendarRange, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import type { PublicOnlineAdmissionProviderDetail } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { OrgLogoOrIcon } from '@/components/ui/OrgLogoOrIcon';

export default function PublicAdmissionsProviderPage() {
    const { slug } = useParams<{ slug: string }>();
    const { data, error, isLoading } = useSWR<PublicOnlineAdmissionProviderDetail>(
        ['public-online-admissions-provider', slug],
        () => api.publicOnlineAdmissions.getProvider(decodeURIComponent(slug)),
    );

    return (
        <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                <Link href="/admissions" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Admissions
                </Link>

                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Provider could not be loaded" />
                ) : !data ? (
                    <EmptyState title="Provider not found" description="This admissions page is unavailable." />
                ) : (
                    <>
                        <header className="flex flex-col gap-4 rounded-lg border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-center">
                            <OrgLogoOrIcon logoUrl={data.campusOrganization?.logoUrl} orgName={data.displayName} className="h-16 w-16 rounded-full ring-2 ring-primary/20" />
                            <div className="min-w-0 flex-1">
                                <h1 className="text-3xl font-black tracking-tight">{data.displayName}</h1>
                                <p className="mt-1 text-sm font-semibold text-muted-foreground">{data.campusOrganization?.location || data.kind.replaceAll('_', ' ')}</p>
                            </div>
                            <Badge variant="primary" size="md">{data.programOfferings.length} open offerings</Badge>
                        </header>

                        {data.programOfferings.length === 0 ? (
                            <EmptyState title="No offerings open" description="This provider is not accepting applications right now." />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {data.programOfferings.map((offering) => (
                                    <article key={offering.id} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="primary" size="sm">{offering.program.code}</Badge>
                                                    <Badge variant="neutral" size="sm">{offering.deliveryMode.replaceAll('_', ' ')}</Badge>
                                                </div>
                                                <h2 className="mt-2 text-lg font-black text-foreground">{offering.program.name}</h2>
                                                <p className="mt-1 text-sm font-semibold text-muted-foreground">{offering.publicSummary || offering.program.summary || 'Open for admission'}</p>
                                            </div>
                                            <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                        </div>
                                        <div className="mt-4 grid gap-2 text-sm font-semibold text-muted-foreground sm:grid-cols-2">
                                            <span className="inline-flex items-center gap-2"><CalendarRange className="h-4 w-4" />{offering.intakeName}</span>
                                            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{offering.locations?.[0]?.providerLocation.displayLabel || data.campusOrganization?.location || 'Location varies'}</span>
                                            <span className="inline-flex items-center gap-2 sm:col-span-2"><BadgeDollarSign className="h-4 w-4" />{offering.fees?.[0]?.label || 'Fee details listed in application'}</span>
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <Link href={`/admissions/apply/${offering.id}`}><Button size="sm">Apply</Button></Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
