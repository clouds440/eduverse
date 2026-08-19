'use client';

import { FileCheck2, Mail } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Toggle } from '@/components/ui/Toggle';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { OrganizationSettingsFormData } from './types';

export function AdmissionsSettingsTab({
    formData,
    onToggleOnlineAdmissions,
    setFormData,
}: {
    formData: OrganizationSettingsFormData;
    onToggleOnlineAdmissions: (enabled: boolean) => void;
    setFormData: Dispatch<SetStateAction<OrganizationSettingsFormData>>;
}) {
    const updateTemplate = (key: keyof OrganizationSettingsFormData['onlineAdmissionEmailTemplates'], value: string) => {
        setFormData((current) => ({
            ...current,
            onlineAdmissionEmailTemplates: {
                ...current.onlineAdmissionEmailTemplates,
                [key]: value,
            },
        }));
    };

    return (
        <div className="grid gap-4">
            <SettingsSection
                icon={FileCheck2}
                title="Online Admissions"
                description="Control whether this organization appears in the public online admissions browser. Program offerings still need to be opened for online applications separately."
            >
                <Toggle
                    checked={formData.onlineAdmissionsEnabled}
                    onCheckedChange={onToggleOnlineAdmissions}
                    label="Show this organization for online admissions"
                    description="When enabled, eligible online-enabled program offerings can receive public applications."
                />
            </SettingsSection>
            <SettingsSection
                icon={Mail}
                title="Applicant Emails"
                description="Customize applicant email copy. Empty fields use the platform defaults."
            >
                <div className="grid gap-4">
                    <div className="grid gap-3 lg:grid-cols-2">
                        <label className="space-y-2 text-sm font-bold">
                            Submission subject
                            <Input value={formData.onlineAdmissionEmailTemplates.submissionSubject || ''} maxLength={160} onChange={(event) => updateTemplate('submissionSubject', event.target.value)} placeholder="{organizationName} received your application" />
                        </label>
                        <label className="space-y-2 text-sm font-bold">
                            Status subject
                            <Input value={formData.onlineAdmissionEmailTemplates.statusSubject || ''} maxLength={160} onChange={(event) => updateTemplate('statusSubject', event.target.value)} placeholder="{organizationName} application update: {status}" />
                        </label>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                        <label className="space-y-2 text-sm font-bold">
                            Submission message
                            <Textarea value={formData.onlineAdmissionEmailTemplates.submissionBody || ''} maxLength={4000} onChange={(event) => updateTemplate('submissionBody', event.target.value)} placeholder="Hi {applicantName}, your application for {programName} has been received. Reference: {reference}" />
                        </label>
                        <label className="space-y-2 text-sm font-bold">
                            Status message
                            <Textarea value={formData.onlineAdmissionEmailTemplates.statusBody || ''} maxLength={4000} onChange={(event) => updateTemplate('statusBody', event.target.value)} placeholder="Hi {applicantName}, your application is now {status}. {note} {updateUrl}" />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5" aria-label="Available email placeholders">
                        {['applicantName', 'reference', 'organizationName', 'programName', 'status', 'note', 'updateUrl', 'portalUrl'].map((key) => (
                            <code key={key} className="rounded border border-border bg-muted/40 px-2 py-1 text-xs font-semibold">{`{${key}}`}</code>
                        ))}
                    </div>
                </div>
            </SettingsSection>
        </div>
    );
}
