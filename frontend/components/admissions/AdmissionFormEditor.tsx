'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Eye, FileCheck2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Role, type AdmissionApplicationTemplate, type AdmissionCanonicalTarget, type AdmissionDocumentRequirementInput, type AdmissionFieldType, type AdmissionFormDefinition } from '@/types';
import { AdmissionFormRenderer } from './AdmissionFormRenderer';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';

const fieldTypes: AdmissionFieldType[] = ['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'DATE', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'ADDRESS', 'CONSENT'];
const canonicalTargets: AdmissionCanonicalTarget[] = ['applicant.name', 'applicant.email', 'applicant.phone', 'student.fatherName', 'student.gender', 'student.dateOfBirth', 'student.address', 'student.emergencyContact', 'student.bloodGroup', 'student.previousSchool', 'student.notes', 'guardian.name', 'guardian.email', 'guardian.phone', 'guardian.relationship'];
const starterDefinition: AdmissionFormDefinition = { sections: [{ key: 'applicant', title: 'Applicant details', fields: [
    { key: 'fullName', type: 'SHORT_TEXT', label: 'Full name', required: true, canonicalTarget: 'applicant.name' },
    { key: 'email', type: 'EMAIL', label: 'Email', required: true, canonicalTarget: 'applicant.email' },
] }] };

function slugKey(value: string, fallback: string) {
    const key = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).map((part, index) => index ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part.toLowerCase()).join('');
    return /^[a-z][a-zA-Z0-9_]{1,63}$/.test(key) ? key : fallback;
}

export function AdmissionFormEditor({ template }: { template?: AdmissionApplicationTemplate }) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const source = template?.versions.find((version) => version.status === 'DRAFT') || template?.versions[0];
    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [definition, setDefinition] = useState<AdmissionFormDefinition>(source?.definition || starterDefinition);
    const [requirements, setRequirements] = useState<AdmissionDocumentRequirementInput[]>((source?.documentRequirements || []).map((item) => ({ ...item })));
    const [consentText, setConsentText] = useState(source?.consentText || 'I confirm that the information provided is accurate and may be used to process this application.');
    const [consentVersion, setConsentVersion] = useState(source?.consentVersion || 'v1');
    const [tab, setTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');
    const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
    const [error, setError] = useState('');
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const editable = canManage && (!template || source?.status === 'DRAFT');
    const processId = `admission-form-${template?.id || 'new'}`;

    const updateSection = (index: number, patch: Partial<AdmissionFormDefinition['sections'][number]>) => setDefinition((current) => ({ sections: current.sections.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section) }));
    const removeSection = (index: number) => setDefinition((current) => ({ sections: current.sections.filter((_, itemIndex) => itemIndex !== index) }));
    const addSection = () => setDefinition((current) => ({ sections: [...current.sections, { key: `section${current.sections.length + 1}`, title: 'New section', fields: [] }] }));
    const updateField = (sectionIndex: number, fieldIndex: number, patch: Record<string, unknown>) => setDefinition((current) => ({ sections: current.sections.map((section, itemIndex) => itemIndex === sectionIndex ? { ...section, fields: section.fields.map((field, index) => index === fieldIndex ? { ...field, ...patch } : field) } : section) }));
    const removeField = (sectionIndex: number, fieldIndex: number) => setDefinition((current) => ({ sections: current.sections.map((section, itemIndex) => itemIndex === sectionIndex ? { ...section, fields: section.fields.filter((_, index) => index !== fieldIndex) } : section) }));
    const addField = (sectionIndex: number) => setDefinition((current) => ({ sections: current.sections.map((section, itemIndex) => itemIndex === sectionIndex ? { ...section, fields: [...section.fields, { key: `field${section.fields.length + 1}`, label: 'New field', type: 'SHORT_TEXT' as const }] } : section) }));

    const payload = useMemo(() => ({ definition, consentText: consentText.trim() || undefined, consentVersion: consentVersion.trim() || undefined, documentRequirements: requirements.map((item, index) => ({ ...item, key: slugKey(item.key || item.label, `document${index + 1}`), sortOrder: index })) }), [consentText, consentVersion, definition, requirements]);

    const save = async (event?: FormEvent) => {
        event?.preventDefault();
        if (!token) return false;
        setError('');
        dispatch({ type: 'UI_START_PROCESSING', payload: processId });
        try {
            if (template && source) {
                await api.admissionForms.updateVersion(source.id, payload, token);
                dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: 'Admission form draft saved' } });
                router.refresh();
            } else {
                const created = await api.admissionForms.create({ name: name.trim(), description: description.trim() || undefined, ...payload }, token);
                router.replace(`/admission-forms/${created.id}`);
            }
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save admission form');
            return false;
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: processId });
        }
    };

    const publish = async () => {
        if (!token || !source || source.status !== 'DRAFT') return;
        if (!await save()) return;
        try {
            await api.admissionForms.publishVersion(source.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { type: 'success', message: `Version ${source.version} published` } });
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not publish admission form');
        }
    };

    return <form onSubmit={save} className="space-y-5">
        {error && <StatusBanner title="Admission form could not be saved" description={error} variant="danger" />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
                <button type="button" onClick={() => setTab('EDIT')} className={`rounded px-3 py-2 text-sm font-bold ${tab === 'EDIT' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Edit</button>
                <button type="button" onClick={() => setTab('PREVIEW')} className={`rounded px-3 py-2 text-sm font-bold ${tab === 'PREVIEW' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><Eye className="mr-1.5 inline h-4 w-4" />Preview</button>
            </div>
            {editable && <div className="flex gap-2"><Button type="submit" icon={Save} variant="secondary">Save draft</Button>{source?.status === 'DRAFT' && <Button type="button" icon={Send} onClick={publish}>Publish</Button>}</div>}
        </div>

        {tab === 'PREVIEW' ? <div className="rounded-lg border border-border/70 bg-card p-5"><AdmissionFormRenderer definition={definition} answers={previewAnswers} onChange={(key, value) => setPreviewAnswers((current) => ({ ...current, [key]: value }))} preview /></div> : <>
            {!template && <section className="grid gap-4 rounded-lg border border-border/70 bg-card p-5 md:grid-cols-2">
                <div className="space-y-2"><Label>Form name</Label><Input required value={name} onChange={(event) => setName(event.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            </section>}
            <section className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-black">Application fields</h2><p className="text-sm font-semibold text-muted-foreground">Map fields to Campus data where applicable.</p></div>{editable && <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addSection}>Section</Button>}</div>
                {definition.sections.map((section, sectionIndex) => <div key={`${section.key}-${sectionIndex}`} className="space-y-3 border-t border-border/70 pt-4 first:border-0 first:pt-0">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]">
                        <Input value={section.key} disabled={!editable} onChange={(event) => updateSection(sectionIndex, { key: event.target.value })} placeholder="sectionKey" />
                        <Input value={section.title} disabled={!editable} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} placeholder="Section title" />
                        {editable && definition.sections.length > 1 && <Button type="button" icon={Trash2} variant="danger" onClick={() => removeSection(sectionIndex)} aria-label="Remove section" />}
                    </div>
                    {section.fields.map((field, fieldIndex) => <div key={`${field.key}-${fieldIndex}`} className="grid gap-2 rounded-md border border-border/60 bg-muted/15 p-3 md:grid-cols-2">
                        <Input value={field.key} disabled={!editable} onChange={(event) => updateField(sectionIndex, fieldIndex, { key: event.target.value })} placeholder="fieldKey" />
                        <Input value={field.label} disabled={!editable} onChange={(event) => updateField(sectionIndex, fieldIndex, { label: event.target.value })} placeholder="Field label" />
                        <CustomSelect value={field.type} disabled={!editable} options={fieldTypes.map((value) => ({ value, label: value.replaceAll('_', ' ') }))} onChange={(type) => updateField(sectionIndex, fieldIndex, { type })} />
                        <CustomSelect value={field.canonicalTarget || ''} disabled={!editable} clearable options={canonicalTargets.map((value) => ({ value, label: value }))} placeholder="No Campus mapping" onChange={(canonicalTarget) => updateField(sectionIndex, fieldIndex, { canonicalTarget: canonicalTarget || undefined })} />
                        {['SELECT', 'MULTI_SELECT', 'RADIO'].includes(field.type) && <Textarea className="md:col-span-2" disabled={!editable} value={(field.options || []).map((option) => `${option.value}|${option.label}`).join('\n')} placeholder={'value|Label\none|Option one'} onChange={(event) => updateField(sectionIndex, fieldIndex, { options: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const [value, label] = line.split('|'); return { value, label: label || value }; }) })} />}
                        <div className="flex items-center justify-between gap-3 md:col-span-2"><Toggle checked={Boolean(field.required)} disabled={!editable} onCheckedChange={(required) => updateField(sectionIndex, fieldIndex, { required })} label="Required" size="sm" />{editable && <Button type="button" icon={Trash2} variant="danger" size="sm" onClick={() => removeField(sectionIndex, fieldIndex)}>Remove</Button>}</div>
                    </div>)}
                    {editable && <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => addField(sectionIndex)}>Field</Button>}
                </div>)}
            </section>

            <section className="space-y-4 rounded-lg border border-border/70 bg-card p-5">
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-black">Document requirements</h2><p className="text-sm font-semibold text-muted-foreground">These policies are frozen into each published version and submission.</p></div>{editable && <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => setRequirements((current) => [...current, { key: `document${current.length + 1}`, label: 'New document', isRequired: true, maxFileCount: 1 }])}>Document</Button>}</div>
                {requirements.length === 0 && <p className="rounded-md border border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground">No documents required.</p>}
                {requirements.map((requirement, index) => <div key={index} className="grid gap-2 rounded-md border border-border/60 bg-muted/15 p-3 md:grid-cols-2">
                    <Input value={requirement.key} disabled={!editable} onChange={(event) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, key: event.target.value } : item))} placeholder="documentKey" />
                    <Input value={requirement.label} disabled={!editable} onChange={(event) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Document label" />
                    <Input value={(requirement.acceptedExtensions || []).join(', ')} disabled={!editable} onChange={(event) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, acceptedExtensions: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) } : item))} placeholder="Extensions: .pdf, .jpg" />
                    <Input type="number" min={1} max={10} value={requirement.maxFileCount || 1} disabled={!editable} onChange={(event) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, maxFileCount: Number(event.target.value) } : item))} />
                    <Textarea className="md:col-span-2" value={requirement.description || ''} disabled={!editable} onChange={(event) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="Applicant-facing instructions" />
                    <div className="flex flex-wrap items-center gap-4 md:col-span-2"><Toggle checked={requirement.isRequired ?? true} disabled={!editable} onCheckedChange={(isRequired) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, isRequired } : item))} label="Required" size="sm" /><Toggle checked={requirement.requiresExpiryDate ?? false} disabled={!editable} onCheckedChange={(requiresExpiryDate) => setRequirements((current) => current.map((item, i) => i === index ? { ...item, requiresExpiryDate } : item))} label="Expiry date" size="sm" />{editable && <Button className="ml-auto" type="button" size="sm" variant="danger" icon={Trash2} onClick={() => setRequirements((current) => current.filter((_, i) => i !== index))}>Remove</Button>}</div>
                </div>)}
            </section>
            <section className="grid gap-4 rounded-lg border border-border/70 bg-card p-5 md:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="space-y-2"><Label>Consent statement</Label><Textarea value={consentText} disabled={!editable} onChange={(event) => setConsentText(event.target.value)} /></div>
                <div className="space-y-2"><Label>Consent version</Label><Input value={consentVersion} disabled={!editable} onChange={(event) => setConsentVersion(event.target.value)} /></div>
            </section>
        </>}
        {!editable && <StatusBanner icon={FileCheck2} title="Published version" description="Published versions are immutable. Create a new draft version to make changes." variant="info" />}
    </form>;
}
