'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BadgeDollarSign, ClipboardList, Eye, FileCheck2, Lock, PauseCircle, Play, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import {
    AdmissionApplicationTemplate,
    ProgramAdmissionRequirement,
    ProgramOffering,
    ProgramOfferingAction,
    ProgramOfferingAttendanceMode,
    ProgramOfferingDeliveryMode,
    ProgramOfferingFee,
    ProgramOfferingFundingOption,
    ProgramOfferingReadiness,
    ProgramOfferingStatus,
    Role,
} from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';

type FeeDraft = Omit<ProgramOfferingFee, 'id' | 'sortOrder'>;
type FundingDraft = Omit<ProgramOfferingFundingOption, 'id' | 'sortOrder'>;
type RequirementDraft = Omit<ProgramAdmissionRequirement, 'id' | 'sortOrder'>;

function localDateTime(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string) {
    return value ? new Date(value).toISOString() : null;
}

function moneyValue(value: ProgramOfferingFee['amount']) {
    if (value === null || value === undefined || value === '') return '';
    return String(value);
}

function publishedFormOptions(forms: AdmissionApplicationTemplate[] = []) {
    return forms.flatMap((form) => form.versions
        .filter((version) => version.status === 'PUBLISHED')
        .map((version) => ({
            value: version.id,
            label: `${form.name} v${version.version}`,
            description: `${version.documentRequirements?.length || 0} documents`,
        })));
}

const statusTone: Record<ProgramOfferingStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'error'> = {
    DRAFT: 'neutral',
    PUBLISHED: 'primary',
    OPEN: 'success',
    CLOSED: 'warning',
    CANCELLED: 'error',
    ARCHIVED: 'neutral',
};

export default function AdmissionsSetupPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const { data: offerings, error, isLoading, mutate } = useSWR<ProgramOffering[]>(token ? 'admissions-setup-offerings' : null, () => api.programOfferings.list(token!));
    const { data: forms } = useSWR<AdmissionApplicationTemplate[]>(token ? 'admissions-setup-forms' : null, () => api.admissionForms.list(token!));
    const [selectedId, setSelectedId] = useState('');
    const selected = useMemo(() => offerings?.find((offering) => offering.id === selectedId) || offerings?.[0], [offerings, selectedId]);
    const { data: readiness, mutate: mutateReadiness } = useSWR<ProgramOfferingReadiness>(
        token && selected ? ['admissions-setup-readiness', selected.id] : null,
        () => api.programOfferings.readiness(selected!.id, token!),
    );

    const [intakeName, setIntakeName] = useState('');
    const [publicSummary, setPublicSummary] = useState('');
    const [detailedInstructions, setDetailedInstructions] = useState('');
    const [onlineInstructions, setOnlineInstructions] = useState('');
    const [scheduleSummary, setScheduleSummary] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [deliveryMode, setDeliveryMode] = useState(ProgramOfferingDeliveryMode.ON_CAMPUS);
    const [attendanceMode, setAttendanceMode] = useState(ProgramOfferingAttendanceMode.FULL_TIME);
    const [opensAt, setOpensAt] = useState('');
    const [closesAt, setClosesAt] = useState('');
    const [teachingStartsAt, setTeachingStartsAt] = useState('');
    const [teachingEndsAt, setTeachingEndsAt] = useState('');
    const [capacity, setCapacity] = useState('');
    const [waitlistEnabled, setWaitlistEnabled] = useState(false);
    const [locationIds, setLocationIds] = useState<string[]>([]);
    const [onlineEnabled, setOnlineEnabled] = useState(false);
    const [applicationVersionId, setApplicationVersionId] = useState('');
    const [allowApplicantUpdates, setAllowApplicantUpdates] = useState(true);
    const [requireEmailVerification, setRequireEmailVerification] = useState(false);
    const [fees, setFees] = useState<FeeDraft[]>([]);
    const [fundingOptions, setFundingOptions] = useState<FundingDraft[]>([]);
    const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!selected) return;
        setSelectedId(selected.id);
        setIntakeName(selected.intakeName || '');
        setPublicSummary(selected.publicSummary || '');
        setDetailedInstructions(selected.detailedInstructions || '');
        setOnlineInstructions(selected.onlineAdmissionInstructions || '');
        setScheduleSummary(selected.scheduleSummary || '');
        setContactEmail(selected.contactEmail || '');
        setTimezone(selected.timezone || 'UTC');
        setDeliveryMode(selected.deliveryMode);
        setAttendanceMode(selected.attendanceMode);
        setOpensAt(localDateTime(selected.applicationOpensAt));
        setClosesAt(localDateTime(selected.applicationClosesAt));
        setTeachingStartsAt(localDateTime(selected.teachingStartsAt));
        setTeachingEndsAt(localDateTime(selected.teachingEndsAt));
        setCapacity(selected.capacity ? String(selected.capacity) : '');
        setWaitlistEnabled(Boolean(selected.waitlistEnabled));
        setLocationIds(selected.locations?.map((location) => location.providerLocationId) || []);
        setOnlineEnabled(Boolean(selected.onlineAdmissionEnabled));
        setApplicationVersionId(selected.applicationConfig?.applicationVersionId || '');
        setAllowApplicantUpdates(selected.applicationConfig?.allowApplicantUpdates ?? true);
        setRequireEmailVerification(selected.applicationConfig?.requireEmailVerification ?? false);
        setFees((selected.fees || []).map((fee) => ({ label: fee.label, description: fee.description || '', amount: moneyValue(fee.amount), currencyCode: fee.currencyCode || 'USD', frequency: fee.frequency || '', isMandatory: fee.isMandatory, isApplicationFee: fee.isApplicationFee, refundable: fee.refundable ?? null })));
        setFundingOptions((selected.fundingOptions || []).map((option) => ({ title: option.title, description: option.description || '', fundingType: option.fundingType || '', amountSummary: option.amountSummary || '', eligibilitySummary: option.eligibilitySummary || '', applicationUrl: option.applicationUrl || '' })));
        setRequirements((selected.admissionRequirements || []).map((requirement) => ({ label: requirement.label, description: requirement.description || '', requirementType: requirement.requirementType || '', isRequired: requirement.isRequired })));
        setErrorMessage('');
    }, [selected]);

    const formOptions = publishedFormOptions(forms);
    const providerLocations = useMemo(() => [...new Map((offerings || []).flatMap((offering) => offering.locations || []).map((location) => [location.providerLocationId, location.providerLocation])).values()], [offerings]);

    const save = async (event?: FormEvent, nextStatus?: ProgramOfferingStatus) => {
        event?.preventDefault();
        if (!token || !selected) return;
        if (onlineEnabled && !applicationVersionId) {
            setErrorMessage('Select a published admission form before enabling online applications.');
            return;
        }
        dispatch({ type: 'UI_START_PROCESSING', payload: 'admissions-setup-save' });
        setErrorMessage('');
        try {
            await api.programOfferings.update(selected.id, {
                status: nextStatus || selected.status,
                intakeName: intakeName.trim(),
                timezone: timezone.trim(),
                deliveryMode,
                attendanceMode,
                supportedActions: [ProgramOfferingAction.APPLY],
                applicationOpensAt: toIso(opensAt),
                applicationClosesAt: toIso(closesAt),
                teachingStartsAt: toIso(teachingStartsAt),
                teachingEndsAt: toIso(teachingEndsAt),
                capacity: capacity ? Number(capacity) : undefined,
                waitlistEnabled,
                scheduleSummary: scheduleSummary || null,
                publicSummary: publicSummary || null,
                detailedInstructions: detailedInstructions || null,
                contactEmail: contactEmail || null,
                locationIds,
                onlineAdmissionEnabled: onlineEnabled,
                onlineAdmissionInstructions: onlineInstructions || null,
                fees: fees.filter((fee) => fee.label.trim()).map((fee) => ({ ...fee, amount: fee.amount === '' || fee.amount === null || fee.amount === undefined ? null : Number(fee.amount), currencyCode: (fee.currencyCode || 'USD').toUpperCase() })),
                fundingOptions: fundingOptions.filter((option) => option.title.trim()),
                admissionRequirements: requirements.filter((requirement) => requirement.label.trim()),
            }, token);
            if (applicationVersionId) {
                await api.admissionForms.bindOffering(selected.id, {
                    applicationVersionId,
                    onlineAdmissionEnabled: onlineEnabled,
                    onlineAdmissionInstructions: onlineInstructions || undefined,
                    allowApplicantUpdates,
                    requireEmailVerification,
                }, token);
            }
            dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: nextStatus ? `Offering moved to ${nextStatus.replaceAll('_', ' ').toLowerCase()}` : 'Admissions setup saved' } });
            await mutate();
            await mutateReadiness();
        } catch (cause) {
            setErrorMessage(cause instanceof Error ? cause.message : 'Unable to save admissions setup');
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'admissions-setup-save' });
        }
    };

    const cloneListing = (sourceId: string) => {
        const source = offerings?.find((offering) => offering.id === sourceId);
        if (!source) return;
        setPublicSummary(source.publicSummary || '');
        setDetailedInstructions(source.detailedInstructions || '');
        setOnlineInstructions(source.onlineAdmissionInstructions || '');
        setScheduleSummary(source.scheduleSummary || '');
        setContactEmail(source.contactEmail || '');
        setDeliveryMode(source.deliveryMode);
        setAttendanceMode(source.attendanceMode);
        setLocationIds(source.locations?.map((location) => location.providerLocationId) || []);
        setFees((source.fees || []).map((fee) => ({ label: fee.label, description: fee.description || '', amount: moneyValue(fee.amount), currencyCode: fee.currencyCode || 'USD', frequency: fee.frequency || '', isMandatory: fee.isMandatory, isApplicationFee: fee.isApplicationFee, refundable: fee.refundable ?? null })));
        setFundingOptions((source.fundingOptions || []).map((option) => ({ title: option.title, description: option.description || '', fundingType: option.fundingType || '', amountSummary: option.amountSummary || '', eligibilitySummary: option.eligibilitySummary || '', applicationUrl: option.applicationUrl || '' })));
        setRequirements((source.admissionRequirements || []).map((requirement) => ({ label: requirement.label, description: requirement.description || '', requirementType: requirement.requirementType || '', isRequired: requirement.isRequired })));
    };

    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    if (isLoading) return <Loading className="h-full" text="Loading admissions setup..." />;

    return (
        <PageShell>
            <PageHeader
                title="Admissions Setup"
                description="Configure the public listing, fees, eligibility, application form, and lifecycle for each intake."
                icon={FileCheck2}
                actions={<Link href="/admission-forms"><Button variant="secondary" icon={ClipboardList}>Forms</Button></Link>}
            />

            {!offerings?.length ? (
                <EmptyState icon={FileCheck2} title="No offerings yet" description="Create a program offering first, then configure its admissions listing here." />
            ) : (
                <form onSubmit={(event) => save(event)} className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
                    <aside className="space-y-3">
                        <CustomSelect
                            searchable
                            value={selected?.id || ''}
                            onChange={setSelectedId}
                            options={offerings.map((offering) => ({ value: offering.id, label: `${offering.program.code} - ${offering.intakeName}`, description: offering.status }))}
                        />
                        <div className="divide-y divide-border/60 rounded-md border border-border/70 bg-card/60">
                            {offerings.map((offering) => (
                                <button key={offering.id} type="button" onClick={() => setSelectedId(offering.id)} className={`block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selected?.id === offering.id ? 'bg-primary/5' : ''}`}>
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-black">{offering.program.name}</span>
                                            <span className="block truncate text-xs font-semibold text-muted-foreground">{offering.code} - {offering.intakeName}</span>
                                        </span>
                                        <Badge variant={statusTone[offering.status]} size="sm">{offering.status}</Badge>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    {selected && (
                        <main className="space-y-5">
                            <section className="rounded-md border border-border/70 bg-card/70 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-black">{selected.program.name}</h2>
                                        <p className="text-sm font-semibold text-muted-foreground">{selected.code} - {selected.intakeName}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant={statusTone[selected.status]} size="sm">{selected.status}</Badge>
                                        {readiness && <Badge variant={readiness.readyForPublicListing ? 'success' : 'error'} size="sm">{readiness.readyForPublicListing ? 'Ready' : `${readiness.publicListingBlockers.length} blockers`}</Badge>}
                                    </div>
                                </div>
                                {readiness && readiness.publicListingBlockers.length > 0 && (
                                    <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm font-semibold text-warning">
                                        {readiness.publicListingBlockers.map((blocker) => blocker.message).join(' ')}
                                    </div>
                                )}
                            </section>

                            {errorMessage && <div role="alert" className="rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{errorMessage}</div>}

                            <section className="space-y-4 border-t border-border/70 pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h2 className="text-base font-black">Listing</h2>
                                    <CustomSelect value="" onChange={cloneListing} placeholder="Clone setup from..." options={offerings.filter((offering) => offering.id !== selected.id).map((offering) => ({ value: offering.id, label: `${offering.program.code} - ${offering.intakeName}` }))} />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2"><Label>Intake name</Label><Input value={intakeName} onChange={(event) => setIntakeName(event.target.value)} /></div>
                                    <div className="space-y-2"><Label>Timezone</Label><Input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></div>
                                    <div className="space-y-2"><Label>Delivery mode</Label><CustomSelect value={deliveryMode} onChange={(value) => setDeliveryMode(value as ProgramOfferingDeliveryMode)} options={Object.values(ProgramOfferingDeliveryMode).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></div>
                                    <div className="space-y-2"><Label>Attendance mode</Label><CustomSelect value={attendanceMode} onChange={(value) => setAttendanceMode(value as ProgramOfferingAttendanceMode)} options={Object.values(ProgramOfferingAttendanceMode).map((value) => ({ value, label: value.replaceAll('_', ' ') }))} /></div>
                                    <div className="space-y-2"><Label>Contact email</Label><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div>
                                    <div className="space-y-2"><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="No limit" /></div>
                                </div>
                                {providerLocations.length > 0 && <div className="space-y-2"><Label>Locations</Label><CustomMultiSelect values={locationIds} onChange={setLocationIds} options={providerLocations.map((location) => ({ value: location.id, label: location.name, description: location.displayLabel }))} /></div>}
                                <Toggle checked={waitlistEnabled} onCheckedChange={setWaitlistEnabled} label="Enable waitlist" />
                                <div className="space-y-2"><Label>Public summary</Label><Textarea rows={3} value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} /></div>
                                <div className="space-y-2"><Label>Detailed instructions</Label><Textarea rows={5} value={detailedInstructions} onChange={(event) => setDetailedInstructions(event.target.value)} /></div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2"><Label>Applications open</Label><Input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} /></div>
                                    <div className="space-y-2"><Label>Applications close</Label><Input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></div>
                                    <div className="space-y-2"><Label>Teaching starts</Label><Input type="datetime-local" value={teachingStartsAt} onChange={(event) => setTeachingStartsAt(event.target.value)} /></div>
                                    <div className="space-y-2"><Label>Teaching ends</Label><Input type="datetime-local" value={teachingEndsAt} onChange={(event) => setTeachingEndsAt(event.target.value)} /></div>
                                </div>
                            </section>

                            <EditableList title="Fees" icon={BadgeDollarSign} items={fees} onAdd={() => setFees((current) => [...current, { label: '', description: '', amount: '', currencyCode: 'USD', frequency: '', isMandatory: true, isApplicationFee: false, refundable: null }])}>
                                {fees.map((fee, index) => (
                                    <div key={index} className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-4">
                                        <Input value={fee.label} onChange={(event) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, label: event.target.value } : item))} placeholder="Tuition, application fee, no fee" />
                                        <Input type="number" min={0} value={moneyValue(fee.amount)} onChange={(event) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, amount: event.target.value } : item))} placeholder="Amount" />
                                        <Input value={fee.currencyCode} onChange={(event) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, currencyCode: event.target.value } : item))} placeholder="USD" />
                                        <Input value={fee.frequency || ''} onChange={(event) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, frequency: event.target.value } : item))} placeholder="per semester" />
                                        <Textarea rows={2} className="md:col-span-4" value={fee.description || ''} onChange={(event) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, description: event.target.value } : item))} placeholder="Disclosure notes" />
                                        <div className="flex flex-wrap gap-4 md:col-span-4">
                                            <Toggle checked={fee.isMandatory} onCheckedChange={(checked) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, isMandatory: checked } : item))} label="Mandatory" />
                                            <Toggle checked={fee.isApplicationFee} onCheckedChange={(checked) => setFees((current) => current.map((item, idx) => idx === index ? { ...item, isApplicationFee: checked } : item))} label="Application fee" />
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setFees((current) => current.filter((_, idx) => idx !== index))}>Remove</Button>
                                        </div>
                                    </div>
                                ))}
                            </EditableList>

                            <EditableList title="Eligibility" icon={ShieldCheck} items={requirements} onAdd={() => setRequirements((current) => [...current, { label: '', description: '', requirementType: '', isRequired: true }])}>
                                {requirements.map((requirement, index) => (
                                    <div key={index} className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
                                        <Input value={requirement.label} onChange={(event) => setRequirements((current) => current.map((item, idx) => idx === index ? { ...item, label: event.target.value } : item))} placeholder="Minimum qualification" />
                                        <Input value={requirement.requirementType || ''} onChange={(event) => setRequirements((current) => current.map((item, idx) => idx === index ? { ...item, requirementType: event.target.value } : item))} placeholder="Academic" />
                                        <Toggle checked={requirement.isRequired} onCheckedChange={(checked) => setRequirements((current) => current.map((item, idx) => idx === index ? { ...item, isRequired: checked } : item))} label="Required" />
                                        <Textarea rows={2} className="md:col-span-3" value={requirement.description || ''} onChange={(event) => setRequirements((current) => current.map((item, idx) => idx === index ? { ...item, description: event.target.value } : item))} />
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setRequirements((current) => current.filter((_, idx) => idx !== index))}>Remove</Button>
                                    </div>
                                ))}
                            </EditableList>

                            <EditableList title="Funding" icon={BadgeDollarSign} items={fundingOptions} onAdd={() => setFundingOptions((current) => [...current, { title: '', description: '', fundingType: '', amountSummary: '', eligibilitySummary: '', applicationUrl: '' }])}>
                                {fundingOptions.map((option, index) => (
                                    <div key={index} className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-2">
                                        <Input value={option.title} onChange={(event) => setFundingOptions((current) => current.map((item, idx) => idx === index ? { ...item, title: event.target.value } : item))} placeholder="Scholarship or installment plan" />
                                        <Input value={option.fundingType || ''} onChange={(event) => setFundingOptions((current) => current.map((item, idx) => idx === index ? { ...item, fundingType: event.target.value } : item))} placeholder="Scholarship" />
                                        <Input value={option.amountSummary || ''} onChange={(event) => setFundingOptions((current) => current.map((item, idx) => idx === index ? { ...item, amountSummary: event.target.value } : item))} placeholder="Up to 50%" />
                                        <Input value={option.applicationUrl || ''} onChange={(event) => setFundingOptions((current) => current.map((item, idx) => idx === index ? { ...item, applicationUrl: event.target.value } : item))} placeholder="Application URL" />
                                        <Textarea rows={2} value={option.eligibilitySummary || ''} onChange={(event) => setFundingOptions((current) => current.map((item, idx) => idx === index ? { ...item, eligibilitySummary: event.target.value } : item))} placeholder="Eligibility summary" />
                                        <Textarea rows={2} value={option.description || ''} onChange={(event) => setFundingOptions((current) => current.map((item, idx) => idx === index ? { ...item, description: event.target.value } : item))} placeholder="Details" />
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setFundingOptions((current) => current.filter((_, idx) => idx !== index))}>Remove</Button>
                                    </div>
                                ))}
                            </EditableList>

                            <section className="space-y-4 border-t border-border/70 pt-5">
                                <h2 className="text-base font-black">Application</h2>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2"><Label>Published form</Label><CustomSelect searchable value={applicationVersionId} onChange={setApplicationVersionId} options={formOptions} placeholder="Select form version" /></div>
                                    <div className="space-y-2"><Label>Online instructions</Label><Input value={onlineInstructions} onChange={(event) => setOnlineInstructions(event.target.value)} /></div>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <Toggle checked={onlineEnabled} onCheckedChange={setOnlineEnabled} label="Enable online applications" />
                                    <Toggle checked={allowApplicantUpdates} onCheckedChange={setAllowApplicantUpdates} label="Allow applicant updates" />
                                    <Toggle checked={requireEmailVerification} onCheckedChange={setRequireEmailVerification} label="Require email verification" />
                                </div>
                            </section>

                            <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-md border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur">
                                <Button type="submit" icon={Save} loadingId="admissions-setup-save" disabled={!canManage}>Save draft</Button>
                                <Button type="button" variant="secondary" icon={Eye} onClick={(event) => save(event, ProgramOfferingStatus.PUBLISHED)} disabled={!canManage || selected.status === ProgramOfferingStatus.ARCHIVED}>Publish</Button>
                                <Button type="button" variant="success" icon={Play} onClick={(event) => save(event, ProgramOfferingStatus.OPEN)} disabled={!canManage || selected.status === ProgramOfferingStatus.ARCHIVED}>Open</Button>
                                <Button type="button" variant="warning" icon={PauseCircle} onClick={(event) => save(event, ProgramOfferingStatus.CLOSED)} disabled={!canManage || selected.status !== ProgramOfferingStatus.OPEN}>Close</Button>
                                <Button type="button" variant="secondary" icon={Lock} onClick={(event) => save(event, ProgramOfferingStatus.ARCHIVED)} disabled={!canManage || selected.status === ProgramOfferingStatus.OPEN}>Archive</Button>
                            </div>
                        </main>
                    )}
                </form>
            )}
        </PageShell>
    );
}

function EditableList<T>({ title, icon: Icon, items, onAdd, children }: { title: string; icon: React.ElementType<{ className?: string }>; items: T[]; onAdd: () => void; children: React.ReactNode }) {
    return (
        <section className="space-y-3 border-t border-border/70 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="text-base font-black">{title}</h2><Badge variant="neutral" size="sm">{items.length}</Badge></div>
                <Button type="button" variant="secondary" size="sm" onClick={onAdd}>Add</Button>
            </div>
            {items.length ? <div className="space-y-3">{children}</div> : <div className="rounded-md border border-dashed border-border px-4 py-5 text-sm font-semibold text-muted-foreground">None added.</div>}
        </section>
    );
}
