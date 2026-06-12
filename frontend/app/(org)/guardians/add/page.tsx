'use client';

import { UserPlus } from 'lucide-react';
import { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';
import GuardianForm from '@/components/forms/GuardianForm';

export default function AddGuardianPage() {
    const { user } = useAuth();
    const canAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    if (!canAccess) {
        return (
            <FormPageShell>
                <EmptyState icon={UserPlus} title="Access restricted" description="Guardian creation is available to Admin and Sub Admin accounts." />
            </FormPageShell>
        );
    }

    return (
        <FormPageShell>
            <FormPageHeader
                title="Add Guardian"
                description="Create a guardian login account. Students can be linked from the guardian account or from the student form."
                icon={UserPlus}
            />
            <GuardianForm />
        </FormPageShell>
    );
}
