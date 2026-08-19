'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, BadgeDollarSign, CheckCircle2, FileText, Gift, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import type { PublicOnlineAdmissionOffering } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { CapVerification } from '@/components/ui/CapVerification';
import { AdmissionFormRenderer } from '@/components/admissions/AdmissionFormRenderer';

export default function AdmissionApplicationPage() {
    const params = useParams<{ slug: string; offeringId: string }>();
    const slug = decodeURIComponent(params.slug);
    const offeringId = decodeURIComponent(params.offeringId);
    const { data: offering, error, isLoading } = useSWR<PublicOnlineAdmissionOffering>(
        ['public-online-admissions-offering', offeringId],
        () => api.publicOnlineAdmissions.getOffering(offeringId),
    );
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [reference, setReference] = useState('');
    const [documents, setDocuments] = useState<Record<string, File[]>>({});
    const [documentExpiryDates, setDocumentExpiryDates] = useState<Record<string, string>>({});
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [verificationResetKey, setVerificationResetKey] = useState(0);
    const requirements = useMemo(() => offering?.applicationForm?.documentRequirements || [], [offering]);
    const applicantEmail = useMemo(() => {
        const field = offering?.applicationForm.definition.sections.flatMap((section) => section.fields).find((item) => item.canonicalTarget === 'applicant.email');
        return field && typeof answers[field.key] === 'string' ? answers[field.key] as string : '';
    }, [answers, offering]);

    const handleVerificationChange = useCallback((value: string | null) => setCaptchaToken(value), []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!offering || !captchaToken) return;
        setSubmitError('');
        setIsSubmitting(true);
        try {
            const result = await api.publicOnlineAdmissions.submit(offering.id, {
                answers,
                documents,
                documentExpiryDates,
                consentAccepted,
                captchaToken,
            });
            setReference(result.reference);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
            setVerificationResetKey((current) => current + 1);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                <Link href={`/admissions/${slug}`} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Programs
                </Link>

                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Program could not be loaded" />
                ) : !offering ? (
                    <EmptyState title="Program not found" description="This application page is unavailable." />
                ) : reference ? (
                    <div className="rounded-lg border border-success/35 bg-success/10 p-6">
                        <CheckCircle2 className="h-9 w-9 text-success" aria-hidden="true" />
                        <h1 className="mt-4 text-2xl font-black">Application submitted</h1>
                        <p className="mt-2 text-sm font-semibold text-muted-foreground">Your reference number is <span className="text-foreground">{reference}</span>. Updates will be sent to {applicantEmail}.</p>
                    </div>
                ) : (
                    <>
                        <header className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="primary" size="sm">{offering.program.code}</Badge>
                                <Badge variant="neutral" size="sm">{offering.academicCycle?.code || offering.intakeName}</Badge>
                            </div>
                            <h1 className="mt-3 text-3xl font-black tracking-tight">{offering.program.name}</h1>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{offering.organization?.name || offering.provider.displayName}</p>
                            {offering.publicSummary && <p className="mt-4 max-w-3xl text-sm text-card-foreground/80">{offering.publicSummary}</p>}
                            {offering.onlineAdmissionInstructions && <p className="mt-4 max-w-3xl text-sm text-card-foreground/80">{offering.onlineAdmissionInstructions}</p>}
                        </header>

                        {(offering.fees?.length || offering.admissionRequirements?.length || offering.fundingOptions?.length || offering.detailedInstructions) && (
                            <section className="grid gap-3 md:grid-cols-3">
                                {Boolean(offering.fees?.length) && (
                                    <DisclosurePanel icon={BadgeDollarSign} title="Fees">
                                        {offering.fees!.map((fee) => (
                                            <div key={fee.id || fee.label} className="border-b border-border/60 py-2 last:border-0">
                                                <p className="text-sm font-black">{fee.label}</p>
                                                <p className="text-sm font-semibold text-muted-foreground">{fee.amount ? `${fee.currencyCode} ${fee.amount}` : fee.currencyCode}{fee.frequency ? ` - ${fee.frequency}` : ''}</p>
                                                {fee.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{fee.description}</p>}
                                            </div>
                                        ))}
                                    </DisclosurePanel>
                                )}
                                {Boolean(offering.admissionRequirements?.length) && (
                                    <DisclosurePanel icon={ShieldCheck} title="Eligibility">
                                        {offering.admissionRequirements!.map((requirement) => (
                                            <div key={requirement.id || requirement.label} className="border-b border-border/60 py-2 last:border-0">
                                                <p className="text-sm font-black">{requirement.label}{requirement.isRequired ? ' *' : ''}</p>
                                                {requirement.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{requirement.description}</p>}
                                            </div>
                                        ))}
                                    </DisclosurePanel>
                                )}
                                {Boolean(offering.fundingOptions?.length) && (
                                    <DisclosurePanel icon={Gift} title="Funding">
                                        {offering.fundingOptions!.map((option) => (
                                            <div key={option.id || option.title} className="border-b border-border/60 py-2 last:border-0">
                                                <p className="text-sm font-black">{option.title}</p>
                                                {(option.amountSummary || option.fundingType) && <p className="text-sm font-semibold text-muted-foreground">{[option.amountSummary, option.fundingType].filter(Boolean).join(' - ')}</p>}
                                                {option.eligibilitySummary && <p className="mt-1 text-xs font-semibold text-muted-foreground">{option.eligibilitySummary}</p>}
                                            </div>
                                        ))}
                                    </DisclosurePanel>
                                )}
                                {offering.detailedInstructions && <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:col-span-3"><p className="whitespace-pre-wrap text-sm font-semibold text-muted-foreground">{offering.detailedInstructions}</p></div>}
                            </section>
                        )}

                        {requirements.length > 0 && (
                            <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                                    <h2 className="text-base font-black">Required documents</h2>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {requirements.map((item) => (
                                        <div key={item.id} className="rounded-md border border-border/70 bg-muted/25 p-3">
                                            <p className="text-sm font-black">{item.label}{item.isRequired ? ' *' : ''}</p>
                                            {item.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {submitError && <StatusBanner title="Submission failed" description={submitError} variant="danger" />}

                        <form onSubmit={handleSubmit} className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <AdmissionFormRenderer definition={offering.applicationForm.definition} answers={answers} onChange={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))} />
                            {requirements.length > 0 && (
                                <div className="mt-5 border-t border-border/70 pt-5">
                                    <div className="flex items-center gap-2">
                                        <Paperclip className="h-5 w-5 text-primary" aria-hidden="true" />
                                        <h2 className="text-base font-black">Upload documents</h2>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        {requirements.map((item) => (
                                            <label key={item.id} className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-sm font-bold">
                                                <span>{item.label}{item.isRequired ? ' *' : ''}</span>
                                                <input
                                                    type="file"
                                                    required={item.isRequired}
                                                    multiple={item.maxFileCount > 1}
                                                    accept={[...item.acceptedMimeTypes, ...item.acceptedExtensions].join(',') || undefined}
                                                    onChange={(event) => setDocuments((current) => ({ ...current, [item.id]: Array.from(event.target.files || []).slice(0, item.maxFileCount) }))}
                                                    className="block w-full text-sm font-semibold text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-bold file:text-primary-foreground"
                                                />
                                                {item.requiresExpiryDate && <input
                                                    type="date"
                                                    required
                                                    value={documentExpiryDates[item.id] || ''}
                                                    onChange={(event) => setDocumentExpiryDates((current) => ({ ...current, [item.id]: event.target.value }))}
                                                    className="block h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                                                />}
                                                {item.description && <span className="block text-xs font-semibold text-muted-foreground">{item.description}</span>}
                                                {item.maxFileCount > 1 && <span className="block text-xs font-semibold text-muted-foreground">Up to {item.maxFileCount} files</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {offering.applicationForm.consentText && <label className="mt-5 flex items-start gap-3 border-t border-border/70 pt-5 text-sm font-semibold">
                                <input type="checkbox" required checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                                <span>{offering.applicationForm.consentText}</span>
                            </label>}
                            <div className="mt-5">
                                <CapVerification purpose="ONLINE_ADMISSION" onChange={handleVerificationChange} resetKey={verificationResetKey} disabled={isSubmitting} />
                            </div>
                            <div className="mt-5 flex justify-end">
                                <Button type="submit" icon={Send} isLoading={isSubmitting} loadingText="Submitting" disabled={!captchaToken}>Submit application</Button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

function DisclosurePanel({ icon: Icon, title, children }: { icon: React.ElementType<{ className?: string }>; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-base font-black">{title}</h2>
            </div>
            <div className="mt-2 divide-y divide-border/60">{children}</div>
        </div>
    );
}
