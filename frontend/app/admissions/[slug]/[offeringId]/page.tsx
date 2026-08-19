'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, FileText, Mail, Paperclip, Phone, Send, User } from 'lucide-react';
import { api } from '@/lib/api';
import type { HumanVerificationValue, PublicOnlineAdmissionOffering } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/Textarea';
import { HumanVerification } from '@/components/ui/HumanVerification';

const initialForm = {
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    fatherName: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    bloodGroup: '',
    previousSchool: '',
    notes: '',
};

export default function AdmissionApplicationPage() {
    const params = useParams<{ slug: string; offeringId: string }>();
    const slug = decodeURIComponent(params.slug);
    const offeringId = decodeURIComponent(params.offeringId);
    const { data: offering, error, isLoading } = useSWR<PublicOnlineAdmissionOffering>(
        ['public-online-admissions-offering', offeringId],
        () => api.publicOnlineAdmissions.getOffering(offeringId),
    );
    const [form, setForm] = useState(initialForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [reference, setReference] = useState('');
    const [documents, setDocuments] = useState<Record<string, File | null>>({});
    const [humanVerification, setHumanVerification] = useState<HumanVerificationValue | null>(null);
    const [verificationResetKey, setVerificationResetKey] = useState(0);
    const requirements = useMemo(() => offering?.onlineAdmissionDocumentRequirements || [], [offering]);

    const updateField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
    const handleVerificationChange = useCallback((value: HumanVerificationValue | null) => setHumanVerification(value), []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!offering || !humanVerification) return;
        setSubmitError('');
        setIsSubmitting(true);
        try {
            const result = await api.publicOnlineAdmissions.submit(offering.id, {
                applicantName: form.applicantName.trim(),
                applicantEmail: form.applicantEmail.trim(),
                applicantPhone: form.applicantPhone.trim() || undefined,
                formData: {
                    fatherName: form.fatherName,
                    gender: form.gender,
                    dateOfBirth: form.dateOfBirth,
                    address: form.address,
                    emergencyContact: form.emergencyContact,
                    bloodGroup: form.bloodGroup,
                    previousSchool: form.previousSchool,
                    notes: form.notes,
                },
                documents,
                ...humanVerification,
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
                        <p className="mt-2 text-sm font-semibold text-muted-foreground">Your reference number is <span className="text-foreground">{reference}</span>. Updates will be sent to {form.applicantEmail}.</p>
                    </div>
                ) : (
                    <>
                        <header className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="primary" size="sm">{offering.program.code}</Badge>
                                <Badge variant="neutral" size="sm">{offering.academicCycle.code}</Badge>
                            </div>
                            <h1 className="mt-3 text-3xl font-black tracking-tight">{offering.program.name}</h1>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{offering.organization.name}</p>
                            {offering.onlineAdmissionInstructions && <p className="mt-4 max-w-3xl text-sm text-card-foreground/80">{offering.onlineAdmissionInstructions}</p>}
                        </header>

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
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2 text-sm font-bold">Full name<Input icon={User} required value={form.applicantName} onChange={(event) => updateField('applicantName', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Email<Input icon={Mail} type="email" required value={form.applicantEmail} onChange={(event) => updateField('applicantEmail', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Phone<Input icon={Phone} value={form.applicantPhone} onChange={(event) => updateField('applicantPhone', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Father name<Input value={form.fatherName} onChange={(event) => updateField('fatherName', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Gender<Input value={form.gender} onChange={(event) => updateField('gender', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Date of birth<Input type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Emergency contact<Input value={form.emergencyContact} onChange={(event) => updateField('emergencyContact', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold">Blood group<Input value={form.bloodGroup} onChange={(event) => updateField('bloodGroup', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold md:col-span-2">Address<Textarea value={form.address} onChange={(event) => updateField('address', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold md:col-span-2">Previous school<Input value={form.previousSchool} onChange={(event) => updateField('previousSchool', event.target.value)} /></label>
                                <label className="space-y-2 text-sm font-bold md:col-span-2">Notes<Textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} /></label>
                            </div>
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
                                                    accept={item.acceptedMimeTypes?.join(',') || undefined}
                                                    onChange={(event) => setDocuments((current) => ({ ...current, [item.id]: event.target.files?.[0] || null }))}
                                                    className="block w-full text-sm font-semibold text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-bold file:text-primary-foreground"
                                                />
                                                {item.description && <span className="block text-xs font-semibold text-muted-foreground">{item.description}</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mt-5">
                                <HumanVerification purpose="ONLINE_ADMISSION" onChange={handleVerificationChange} resetKey={verificationResetKey} disabled={isSubmitting} />
                            </div>
                            <div className="mt-5 flex justify-end">
                                <Button type="submit" icon={Send} isLoading={isSubmitting} loadingText="Submitting" disabled={!humanVerification}>Submit application</Button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
