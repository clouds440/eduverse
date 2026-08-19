'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, FileText, Paperclip, Send } from 'lucide-react';
import { api } from '@/lib/api';
import type { PublicOnlineAdmissionUpdateSubmission } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { StatusBanner } from '@/components/ui/StatusBanner';

export default function OnlineAdmissionDocumentUpdatePage() {
    const params = useParams<{ token: string }>();
    const token = decodeURIComponent(params.token);
    const { data, error, isLoading, mutate } = useSWR<PublicOnlineAdmissionUpdateSubmission>(
        ['online-admission-update', token],
        () => api.publicOnlineAdmissions.getUpdateSubmission(token),
    );
    const [documents, setDocuments] = useState<Record<string, File[]>>({});
    const [documentExpiryDates, setDocumentExpiryDates] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [success, setSuccess] = useState(false);
    const uploadedRequirementIds = useMemo(() => new Set((data?.documentUploads || []).map((upload) => upload.requirementId)), [data?.documentUploads]);
    const uploadedRequestIds = useMemo(() => new Set((data?.documentUploads || []).map((upload) => upload.additionalDocumentRequestId)), [data?.documentUploads]);
    const activeRequests = useMemo(() => (data?.additionalDocumentRequests || []).filter((request) => request.status === 'REQUESTED'), [data?.additionalDocumentRequests]);
    const uploadPolicies = useMemo(() => [
        ...(data?.documentRequirements || []),
        ...activeRequests.map((request) => ({ ...request, isRequired: true, sortOrder: 0 })),
    ], [activeRequests, data?.documentRequirements]);
    const missingRequired = useMemo(() => uploadPolicies.filter((requirement) => requirement.isRequired
        && !(uploadedRequirementIds.has(requirement.id) || uploadedRequestIds.has(requirement.id))), [uploadPolicies, uploadedRequirementIds, uploadedRequestIds]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitError('');
        setSuccess(false);
        setIsSubmitting(true);
        try {
            const updated = await api.publicOnlineAdmissions.uploadUpdateDocuments(token, documents, documentExpiryDates);
            setDocuments({});
            setDocumentExpiryDates({});
            setSuccess(true);
            await mutate(updated, { revalidate: false });
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Document upload failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                <Link href="/admissions" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Online admissions
                </Link>
                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Document update link could not be loaded" />
                ) : !data ? (
                    <EmptyState title="Update link unavailable" description="This document update link is invalid or expired." />
                ) : (
                    <>
                        <header className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="primary">{data.publicReference}</Badge>
                                <Badge variant={missingRequired.length ? 'warning' : 'success'}>{missingRequired.length ? `${missingRequired.length} missing` : 'Documents complete'}</Badge>
                            </div>
                            <h1 className="mt-3 text-3xl font-black tracking-tight">Update Documents</h1>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{data.organization?.name || data.provider?.displayName || 'Education provider'} - {data.program.code} {data.program.name}</p>
                        </header>

                        {success && <StatusBanner title="Documents uploaded" description="Your application has been returned to the admissions queue." variant="success" />}
                        {submitError && <StatusBanner title="Upload failed" description={submitError} variant="danger" />}

                        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h2 className="text-base font-black">Document checklist</h2>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {data.documentRequirements.map((requirement) => {
                                    const upload = data.documentUploads.find((item) => item.requirementId === requirement.id);
                                    return (
                                        <div key={requirement.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-black">{requirement.label}{requirement.isRequired ? ' *' : ''}</p>
                                                    {requirement.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{requirement.description}</p>}
                                                </div>
                                                {upload ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Badge variant={requirement.isRequired ? 'warning' : 'neutral'} size="sm">Missing</Badge>}
                                            </div>
                                            {upload?.file?.filename && <p className="mt-2 truncate text-xs font-bold text-muted-foreground">{upload.file.filename}</p>}
                                        </div>
                                    );
                                })}
                                {activeRequests.map((request) => {
                                    const upload = data.documentUploads.find((item) => item.additionalDocumentRequestId === request.id);
                                    return <div key={request.id} className="rounded-md border border-warning/50 bg-warning/10 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div><p className="text-sm font-black">{request.label} *</p>{request.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{request.description}</p>}</div>
                                            {upload ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Badge variant="warning" size="sm">Requested</Badge>}
                                        </div>
                                        {request.dueAt && <p className="mt-2 text-xs font-bold text-muted-foreground">Due {new Date(request.dueAt).toLocaleDateString()}</p>}
                                    </div>;
                                })}
                            </div>
                        </section>

                        <form onSubmit={handleSubmit} className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Paperclip className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h2 className="text-base font-black">Upload files</h2>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {uploadPolicies.map((requirement) => (
                                    <label key={requirement.id} className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-sm font-bold">
                                        <span>{requirement.label}{requirement.isRequired ? ' *' : ''}</span>
                                        <input
                                            type="file"
                                            required={requirement.isRequired && !(uploadedRequirementIds.has(requirement.id) || uploadedRequestIds.has(requirement.id))}
                                            multiple={requirement.maxFileCount > 1}
                                            accept={[...requirement.acceptedMimeTypes, ...requirement.acceptedExtensions].join(',') || undefined}
                                            onChange={(event) => setDocuments((current) => ({ ...current, [requirement.id]: Array.from(event.target.files || []).slice(0, requirement.maxFileCount) }))}
                                            className="block w-full text-sm font-semibold text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-bold file:text-primary-foreground"
                                        />
                                        {requirement.requiresExpiryDate && <input type="date" required value={documentExpiryDates[requirement.id] || ''} onChange={(event) => setDocumentExpiryDates((current) => ({ ...current, [requirement.id]: event.target.value }))} className="block h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-5 flex justify-end">
                                <Button type="submit" icon={Send} isLoading={isSubmitting} loadingText="Uploading">Upload documents</Button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
