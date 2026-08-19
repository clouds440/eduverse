'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, BadgeDollarSign, BookOpen, CalendarRange, FileText, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import type { PublicOnlineAdmissionOrganizationDetail } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { OrgLogoOrIcon } from '@/components/ui/OrgLogoOrIcon';

export default function AdmissionOrganizationPage() {
    const params = useParams<{ slug: string }>();
    const slug = decodeURIComponent(params.slug);
    const { data, error, isLoading } = useSWR<PublicOnlineAdmissionOrganizationDetail>(
        ['public-online-admissions-organization', slug],
        () => api.publicOnlineAdmissions.getOrganization(slug),
    );

    return (
        <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
                <Link href="/admissions" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Online admissions
                </Link>

                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Organization could not be loaded" />
                ) : !data ? (
                    <EmptyState title="Organization not found" description="This admissions page is unavailable." />
                ) : (
                    <>
                        <header className="flex flex-col gap-4 rounded-lg border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-center">
                            <OrgLogoOrIcon logoUrl={data.logoUrl} orgName={data.name} className="h-16 w-16 rounded-full ring-2 ring-primary/20" />
                            <div className="min-w-0 flex-1">
                                <h1 className="text-3xl font-black tracking-tight">{data.name}</h1>
                                <p className="mt-1 text-sm font-semibold text-muted-foreground">{data.location}</p>
                            </div>
                            <Badge variant="primary" size="md">{data.programOfferings.length} open programs</Badge>
                        </header>

                        {data.programOfferings.length === 0 ? (
                            <EmptyState title="No programs open" description="This organization is not accepting applications for any program right now." />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {data.programOfferings.map((offering) => {
                                    const requirements = offering.applicationForm.documentRequirements || [];
                                    const eligibility = offering.admissionRequirements || [];
                                    const fees = offering.fees || [];
                                    return (
                                        <Link
                                            key={offering.id}
                                            href={`/admissions/apply/${offering.id}`}
                                            className="group rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/5"
                                        >
                                            <div className="flex min-w-0 items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="primary" size="sm">{offering.program.code}</Badge>
                                                        <Badge variant="neutral" size="sm">{offering.status}</Badge>
                                                    </div>
                                                    <h2 className="mt-2 text-lg font-black text-foreground">{offering.program.name}</h2>
                                                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{offering.program.summary || offering.program.campusConfiguration?.department?.name || 'Program admission'}</p>
                                                </div>
                                                <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                                            </div>
                                            <div className="mt-4 grid gap-2 text-sm font-semibold text-muted-foreground sm:grid-cols-2">
                                                <span className="inline-flex items-center gap-2"><CalendarRange className="h-4 w-4" />{offering.academicCycle?.code || offering.intakeName}</span>
                                                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />{requirements.length} documents</span>
                                                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{eligibility.length} requirements</span>
                                                <span className="inline-flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" />{fees.length ? fees[0].label : 'Fees disclosed in details'}</span>
                                            </div>
                                            <div className="mt-4 flex justify-end">
                                                <span className="inline-flex min-h-9 items-center justify-center rounded-md border border-border/80 bg-card px-3 py-2 text-sm font-semibold leading-tight text-foreground shadow-xs transition-colors group-hover:border-primary/35 group-hover:bg-primary/5">
                                                    Apply
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
