'use client';

import { ClipboardPlus } from 'lucide-react';
import { AdmissionFormEditor } from '@/components/admissions/AdmissionFormEditor';
import { PageHeader, PageShell } from '@/components/ui/PageShell';

export default function NewAdmissionFormPage() {
    return <PageShell className="overflow-y-auto custom-scrollbar">
        <PageHeader title="New Admission Form" description="Create the first immutable version of an application form." icon={ClipboardPlus} breadcrumbs={[{ label: 'Admission Forms', href: '/admission-forms' }, { label: 'New' }]} />
        <div className="p-1"><AdmissionFormEditor /></div>
    </PageShell>;
}
