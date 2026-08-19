'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, FileText, Mail, Plus, RefreshCcw, UserPlus, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { OnlineAdmissionSubmissionStatus, Role, type BadgeVariant, type OnlineAdmissionSubmission } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/Textarea';
import { AttachmentPreviewCard, getAttachmentPreviewKind } from '@/components/ui/AttachmentPreviewCard';
import { AdmissionFormRenderer } from '@/components/admissions/AdmissionFormRenderer';
import { Input } from '@/components/ui/Input';

const statusConfig: Record<OnlineAdmissionSubmissionStatus, { label: string; variant: BadgeVariant }> = {
    SUBMITTED: { label: 'Submitted', variant: 'primary' },
    UNDER_REVIEW: { label: 'Under review', variant: 'info' },
    NEEDS_UPDATE: { label: 'Needs update', variant: 'warning' },
    ACCEPTED: { label: 'Accepted', variant: 'success' },
    ADMITTED: { label: 'Admitted', variant: 'success' },
    REJECTED: { label: 'Rejected', variant: 'error' },
    WITHDRAWN: { label: 'Withdrawn', variant: 'neutral' },
};

const decisions = [
    { status: OnlineAdmissionSubmissionStatus.UNDER_REVIEW, label: 'Mark review', icon: RefreshCcw, variant: 'secondary' as const },
    { status: OnlineAdmissionSubmissionStatus.NEEDS_UPDATE, label: 'Needs update', icon: Mail, variant: 'warning' as const },
    { status: OnlineAdmissionSubmissionStatus.ACCEPTED, label: 'Accept', icon: CheckCircle2, variant: 'success' as const },
    { status: OnlineAdmissionSubmissionStatus.REJECTED, label: 'Reject', icon: XCircle, variant: 'danger' as const },
];

function FieldValue({ label, value }: { label: string; value?: unknown }) {
    return (
        <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-card-foreground">{value ? String(value) : '-'}</p>
        </div>
    );
}

function statusBadge(status: OnlineAdmissionSubmissionStatus) {
    const config = statusConfig[status] || { label: status, variant: 'neutral' as BadgeVariant };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function OnlineAdmissionDetailPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = decodeURIComponent(params.id);
    const { data, error, isLoading, mutate } = useSWR<OnlineAdmissionSubmission>(
        token ? ['online-admission', id] : null,
        () => api.onlineAdmissions.get(id, token!),
    );
    const [note, setNote] = useState('');
    const [busyStatus, setBusyStatus] = useState<OnlineAdmissionSubmissionStatus | null>(null);
    const [actionError, setActionError] = useState('');
    const [pendingStatus, setPendingStatus] = useState<OnlineAdmissionSubmissionStatus | null>(null);
    const [isAdmitConfirmOpen, setIsAdmitConfirmOpen] = useState(false);
    const [requestLabel, setRequestLabel] = useState('');
    const [requestDescription, setRequestDescription] = useState('');
    const [requestDueAt, setRequestDueAt] = useState('');
    const terminal = data?.status === OnlineAdmissionSubmissionStatus.ADMITTED || data?.status === OnlineAdmissionSubmissionStatus.REJECTED;
    const canDecide = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const updateStatus = async (status: OnlineAdmissionSubmissionStatus) => {
        if (!token || !data) return;
        setActionError('');
        setBusyStatus(status);
        try {
            await api.onlineAdmissions.updateStatus(data.id, { status, note: note.trim() || undefined }, token);
            setNote('');
            await mutate();
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Status update failed.');
        } finally {
            setBusyStatus(null);
        }
    };
    const pendingDecision = decisions.find((decision) => decision.status === pendingStatus);

    const requestDocument = async () => {
        if (!token || !data || !requestLabel.trim()) return;
        setActionError('');
        try {
            const base = requestLabel.trim().replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).map((part, index) => index ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part.toLowerCase()).join('');
            await api.onlineAdmissions.requestDocument(data.id, { key: `${base || 'document'}${Date.now().toString().slice(-6)}`, label: requestLabel.trim(), description: requestDescription.trim() || undefined, dueAt: requestDueAt || undefined }, token);
            setRequestLabel(''); setRequestDescription(''); setRequestDueAt('');
            await mutate();
        } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not request document'); }
    };

    return (
        <PageShell className="overflow-y-auto custom-scrollbar">
            <PageHeader
                title="Admission Detail"
                description={data ? `${data.publicReference} - ${data.applicantName}` : 'Review submitted application details.'}
                icon={FileText}
                breadcrumbs={[{ label: 'Online Admissions', href: '/online-admissions' }, { label: 'Detail' }]}
            />
            <div className="space-y-4 p-1">
                <Link href="/online-admissions" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Admissions list
                </Link>
                {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center"><Loading size="md" /></div>
                ) : error ? (
                    <ErrorState error={error} title="Admission could not be loaded" />
                ) : !data ? (
                    <EmptyState title="Admission not found" description="This submission is unavailable." />
                ) : (
                    <>
                        {actionError && <StatusBanner title="Could not update status" description={actionError} variant="danger" />}
                        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {statusBadge(data.status)}
                                        <Badge variant="neutral">{data.publicReference}</Badge>
                                    </div>
                                    <h1 className="mt-3 text-2xl font-black">{data.applicantName}</h1>
                                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{data.program?.code} - {data.program?.name}</p>
                                </div>
                                <div className="text-right text-sm font-semibold text-muted-foreground">
                                    Submitted {new Date(data.submittedAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-3">
                                <FieldValue label="Email" value={data.applicantEmail} />
                                <FieldValue label="Phone" value={data.applicantPhone} />
                                <FieldValue label="Department" value={data.department?.name} />
                            </div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <h2 className="text-base font-black">Submitted form</h2>
                            <div className="mt-4"><AdmissionFormRenderer definition={data.formDefinitionSnapshot} answers={data.formData || {}} disabled /></div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <h2 className="text-base font-black">Documents</h2>
                            {data.documentRequirementsSnapshot?.length ? (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    {data.documentRequirementsSnapshot.map((requirement) => {
                                        const uploads = data.documentUploads?.filter((item) => item.requirementId === requirement.id) || [];
                                        return (
                                            <div key={requirement.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                                                <div className="mb-2 flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-black">{requirement.label}{requirement.isRequired ? ' *' : ''}</p>
                                                        {requirement.description && <p className="mt-1 text-xs font-semibold text-muted-foreground">{requirement.description}</p>}
                                                    </div>
                                                    <Badge variant={uploads.length ? 'success' : requirement.isRequired ? 'warning' : 'neutral'} size="sm">{uploads.length ? `${uploads.length} uploaded` : 'Missing'}</Badge>
                                                </div>
                                                {uploads.length ? <div className="space-y-2">{uploads.map((upload) => (
                                                    <AttachmentPreviewCard
                                                        key={upload.id}
                                                        fileName={upload.file.filename}
                                                        href={`/org/online-admissions/${data.id}/documents/${upload.file.id}/download`}
                                                        kind={getAttachmentPreviewKind(upload.file.mimeType, upload.file.filename)}
                                                        fileSize={upload.file.size}
                                                        compact
                                                        compactDownload
                                                    />
                                                ))}</div> : (
                                                    <p className="text-xs font-semibold text-muted-foreground">No file uploaded for this requirement.</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="mt-2 text-sm font-semibold text-muted-foreground">No document requirements are configured for this offering.</p>
                            )}
                            {(data.additionalDocumentRequests || []).length > 0 && <div className="mt-4 space-y-2 border-t border-border/70 pt-4">{data.additionalDocumentRequests?.map((request) => <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/70 bg-muted/20 p-3"><div><p className="text-sm font-black">{request.label}</p><p className="text-xs font-semibold text-muted-foreground">{request.description || 'Additional document request'}{request.dueAt ? ` - due ${new Date(request.dueAt).toLocaleDateString()}` : ''}</p></div><Badge variant={request.status === 'SUBMITTED' || request.status === 'ACCEPTED' ? 'success' : 'warning'} size="sm">{request.status}</Badge></div>)}</div>}
                            {canDecide && !terminal && <div className="mt-4 grid gap-2 border-t border-border/70 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_10rem_auto]">
                                <Input value={requestLabel} onChange={(event) => setRequestLabel(event.target.value)} placeholder="Document label" />
                                <Input value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} placeholder="Instructions" />
                                <Input type="date" value={requestDueAt} onChange={(event) => setRequestDueAt(event.target.value)} />
                                <Button icon={Plus} variant="secondary" disabled={!requestLabel.trim()} onClick={requestDocument}>Request</Button>
                            </div>}
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <h2 className="text-base font-black">Decision</h2>
                            {terminal && <StatusBanner className="mt-3" title="Final status" description="Rejected and admitted submissions are retained as final records." variant="info" />}
                            {canDecide ? (
                                <>
                                    <Textarea className="mt-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note sent to the applicant by email" disabled={terminal} />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <Button icon={UserPlus} size="sm" disabled={terminal || data.status === OnlineAdmissionSubmissionStatus.REJECTED} onClick={() => setIsAdmitConfirmOpen(true)}>
                                            Admit student
                                        </Button>
                                        {decisions.map((decision) => (
                                            <Button
                                                key={decision.status}
                                                icon={decision.icon}
                                                variant={decision.variant}
                                                size="sm"
                                                disabled={terminal || data.status === decision.status}
                                                isLoading={busyStatus === decision.status}
                                                onClick={() => setPendingStatus(decision.status)}
                                            >
                                                {decision.label}
                                            </Button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <StatusBanner className="mt-3" title="Review access" description="You can review this department's application and documents. Admission decisions are handled by an Org Admin or Sub Admin." variant="info" />
                            )}
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
                            <h2 className="text-base font-black">Timeline</h2>
                            <div className="mt-3 space-y-2">
                                {(data.statusEvents || []).map((event) => (
                                    <div key={event.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                                        <p className="text-sm font-black">{event.fromStatus || 'Created'} {'->'} {event.toStatus}</p>
                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{new Date(event.createdAt).toLocaleString()} by {event.actor?.name || event.actorType}</p>
                                        {event.note && <p className="mt-2 text-sm text-card-foreground/80">{event.note}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                        {canDecide && <ConfirmDialog
                            isOpen={Boolean(pendingStatus)}
                            onClose={() => setPendingStatus(null)}
                            onConfirm={() => pendingStatus ? updateStatus(pendingStatus) : null}
                            title={pendingDecision?.label || 'Update status'}
                            description={pendingStatus === OnlineAdmissionSubmissionStatus.NEEDS_UPDATE
                                ? 'The applicant will receive an email link to upload requested documents. Include a clear note before confirming.'
                                : pendingStatus === OnlineAdmissionSubmissionStatus.REJECTED
                                    ? 'This will move the submission to the rejected tab and keep it as final history.'
                                    : 'This will update the application status and notify the applicant by email.'}
                            confirmText={pendingDecision?.label || 'Update'}
                            isDestructive={pendingStatus === OnlineAdmissionSubmissionStatus.REJECTED}
                        />}
                        {canDecide && <ConfirmDialog
                            isOpen={isAdmitConfirmOpen}
                            onClose={() => setIsAdmitConfirmOpen(false)}
                            onConfirm={() => router.push(`/users/students/add/online-admission/${data.id}`)}
                            title="Admit this applicant?"
                            description="The student admission form will open with submitted details prefilled. You can still set the final login email, password, and registration numbers before creating the student."
                            confirmText="Open admission form"
                        />}
                    </>
                )}
            </div>
        </PageShell>
    );
}
