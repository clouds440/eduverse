'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BadgeDollarSign, CalendarRange, MapPin, Search, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { ProgramOfferingDeliveryMode, PublicOnlineAdmissionOffering } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';

function firstFeeLabel(offering: PublicOnlineAdmissionOffering) {
    const fee = offering.fees?.[0];
    if (!fee) return 'Fee details available';
    const amount = fee.amount === null || fee.amount === undefined || fee.amount === '' ? '' : `${fee.currencyCode} ${fee.amount}`;
    return [fee.label, amount].filter(Boolean).join(': ');
}

export default function AdmissionsPage() {
    const [search, setSearch] = useState('');
    const [programType, setProgramType] = useState('');
    const [subject, setSubject] = useState('');
    const [location, setLocation] = useState('');
    const [onlineOnly, setOnlineOnly] = useState(false);
    const [deadlineBefore, setDeadlineBefore] = useState('');
    const [maxFee, setMaxFee] = useState('');
    const params = useMemo(() => ({
        search: search.trim() || undefined,
        programType: programType || undefined,
        subject: subject.trim() || undefined,
        location: location.trim() || undefined,
        onlineOnly: onlineOnly || undefined,
        deadlineBefore: deadlineBefore || undefined,
        maxFee: maxFee ? Number(maxFee) : undefined,
    }), [deadlineBefore, location, maxFee, onlineOnly, programType, search]);
    const { data = [], error, isLoading } = useSWR<PublicOnlineAdmissionOffering[]>(
        ['public-online-admissions-offerings', params],
        () => api.publicOnlineAdmissions.listOfferings(params),
    );

    return (
        <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Online Admissions</h1>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">Find programs, courses, diplomas, and intakes accepting applications now.</p>
                    </div>
                    <Badge variant="neutral" size="md">{data.length} open {data.length === 1 ? 'offering' : 'offerings'}</Badge>
                </header>

                <section className="grid gap-3 rounded-lg border border-border/70 bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))]">
                    <Input icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search program, provider, subject, city" />
                    <CustomSelect value={programType} onChange={setProgramType} placeholder="Type" options={['DEGREE', 'DIPLOMA', 'CERTIFICATE', 'COURSE', 'TRAINING', 'WORKSHOP'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
                    <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
                    <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
                    <Input type="date" value={deadlineBefore} onChange={(event) => setDeadlineBefore(event.target.value)} title="Deadline before" />
                    <Input type="number" min={0} value={maxFee} onChange={(event) => setMaxFee(event.target.value)} placeholder="Max fee" />
                    <label className="flex min-h-10 items-center gap-2 text-sm font-bold text-muted-foreground md:col-span-6">
                        <input type="checkbox" checked={onlineOnly} onChange={(event) => setOnlineOnly(event.target.checked)} className="h-4 w-4 accent-primary" />
                        Online or hybrid only
                    </label>
                </section>

                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Admissions could not be loaded" />
                ) : data.length === 0 ? (
                    <EmptyState title="No open offerings" description="No public admissions match the current filters." />
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {data.map((offering) => (
                            <article key={offering.id} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="primary" size="sm">{offering.program.code}</Badge>
                                    <Badge variant="neutral" size="sm">{offering.program.programType?.replaceAll('_', ' ')}</Badge>
                                    <Badge variant={offering.deliveryMode === ProgramOfferingDeliveryMode.ONLINE ? 'success' : 'neutral'} size="sm">{offering.deliveryMode.replaceAll('_', ' ')}</Badge>
                                </div>
                                <h2 className="mt-3 text-lg font-black">{offering.program.name}</h2>
                                <Link href={`/admissions/providers/${offering.provider.slug}`} className="mt-1 block text-sm font-bold text-primary hover:underline">{offering.provider.displayName}</Link>
                                {offering.publicSummary && <p className="mt-2 line-clamp-3 text-sm font-semibold text-muted-foreground">{offering.publicSummary}</p>}
                                <div className="mt-4 grid gap-2 text-sm font-semibold text-muted-foreground">
                                    <span className="inline-flex items-center gap-2"><CalendarRange className="h-4 w-4" />{offering.intakeName}{offering.applicationClosesAt ? `, closes ${new Date(offering.applicationClosesAt).toLocaleDateString()}` : ''}</span>
                                    <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{offering.locations?.[0]?.providerLocation.displayLabel || offering.organization?.location || 'Location varies'}</span>
                                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{offering.admissionRequirements?.length || 0} eligibility items</span>
                                    <span className="inline-flex items-center gap-2"><BadgeDollarSign className="h-4 w-4" />{firstFeeLabel(offering)}</span>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Link href={`/admissions/apply/${offering.id}`}><Button size="sm">Apply</Button></Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
