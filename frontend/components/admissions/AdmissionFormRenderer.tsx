'use client';

import type { AdmissionFormDefinition, AdmissionFormField } from '@/types';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

type Props = {
    definition: AdmissionFormDefinition;
    answers: Record<string, unknown>;
    onChange?: (key: string, value: unknown) => void;
    disabled?: boolean;
    preview?: boolean;
};

function isVisible(field: AdmissionFormField, answers: Record<string, unknown>) {
    if (!field.visibility) return true;
    const matches = answers[field.visibility.fieldKey] === field.visibility.value;
    return field.visibility.operator === 'EQUALS' ? matches : !matches;
}

function stringValue(value: unknown) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function AdmissionFormRenderer({ definition, answers, onChange, disabled = false, preview = false }: Props) {
    const setValue = (field: AdmissionFormField, value: unknown) => onChange?.(field.key, value);

    const renderField = (field: AdmissionFormField) => {
        const value = answers[field.key];
        if (field.type === 'LONG_TEXT') {
            return <Textarea value={stringValue(value)} placeholder={field.placeholder} required={field.required} disabled={disabled} onChange={(event) => setValue(field, event.target.value)} />;
        }
        if (field.type === 'SELECT') {
            return <CustomSelect options={field.options || []} value={stringValue(value)} placeholder={field.placeholder || 'Select an option'} required={field.required} disabled={disabled} onChange={(next) => setValue(field, next)} />;
        }
        if (field.type === 'MULTI_SELECT') {
            return <CustomMultiSelect options={field.options || []} values={Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []} placeholder={field.placeholder || 'Select options'} disabled={disabled} onChange={(next) => setValue(field, next)} />;
        }
        if (field.type === 'RADIO') {
            return <div className="flex flex-wrap gap-3">{(field.options || []).map((option) => (
                <label key={option.value} className="inline-flex items-center gap-2 text-sm font-semibold">
                    <input type="radio" name={field.key} value={option.value} checked={value === option.value} required={field.required} disabled={disabled} onChange={() => setValue(field, option.value)} />
                    {option.label}
                </label>
            ))}</div>;
        }
        if (field.type === 'CHECKBOX' || field.type === 'CONSENT') {
            return <label className="inline-flex items-start gap-2 text-sm font-semibold text-card-foreground/90">
                <input className="mt-0.5 h-4 w-4 accent-primary" type="checkbox" checked={value === true} required={field.required} disabled={disabled} onChange={(event) => setValue(field, event.target.checked)} />
                <span>{field.placeholder || field.label}</span>
            </label>;
        }
        if (field.type === 'ADDRESS') {
            const address = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
            const updateAddress = (key: string, next: string) => setValue(field, { ...address, [key]: next });
            return <div className="grid gap-3 sm:grid-cols-2">
                <Input className="sm:col-span-2" placeholder="Address line" value={stringValue(address.line1)} required={field.required} disabled={disabled} onChange={(event) => updateAddress('line1', event.target.value)} />
                <Input placeholder="City" value={stringValue(address.city)} disabled={disabled} onChange={(event) => updateAddress('city', event.target.value)} />
                <Input placeholder="Region / state" value={stringValue(address.region)} disabled={disabled} onChange={(event) => updateAddress('region', event.target.value)} />
                <Input placeholder="Postal code" value={stringValue(address.postalCode)} disabled={disabled} onChange={(event) => updateAddress('postalCode', event.target.value)} />
                <Input placeholder="Country" value={stringValue(address.country)} disabled={disabled} onChange={(event) => updateAddress('country', event.target.value)} />
            </div>;
        }
        if (field.type === 'DOCUMENT_UPLOAD') {
            return <p className="text-sm font-semibold text-muted-foreground">Document uploads are configured in this form&apos;s document requirements.</p>;
        }
        const type = field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : field.type === 'DATE' ? 'date' : field.type === 'NUMBER' ? 'number' : 'text';
        return <Input type={type} value={stringValue(value)} placeholder={field.placeholder} required={field.required} disabled={disabled} min={field.validation?.min} max={field.validation?.max} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} onChange={(event) => setValue(field, field.type === 'NUMBER' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} />;
    };

    return <div className="space-y-7">
        {definition.sections.map((section, index) => (
            <section key={section.key} className={index ? 'border-t border-border/70 pt-6' : ''}>
                <h2 className="text-base font-black text-card-foreground">{section.title}</h2>
                {section.description && <p className="mt-1 text-sm font-semibold text-muted-foreground">{section.description}</p>}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {section.fields.filter((field) => isVisible(field, answers)).map((field) => (
                        <label key={field.key} className={`space-y-2 text-sm font-bold ${(field.type === 'LONG_TEXT' || field.type === 'ADDRESS' || field.type === 'CONSENT' || field.type === 'DOCUMENT_UPLOAD') ? 'md:col-span-2' : ''}`}>
                            {field.type !== 'CONSENT' && <span>{field.label}{field.required ? ' *' : ''}{preview && field.canonicalTarget ? <span className="ml-2 text-xs font-semibold text-muted-foreground">{field.canonicalTarget}</span> : null}</span>}
                            {renderField(field)}
                            {field.helpText && <span className="block text-xs font-semibold text-muted-foreground">{field.helpText}</span>}
                        </label>
                    ))}
                </div>
            </section>
        ))}
    </div>;
}
