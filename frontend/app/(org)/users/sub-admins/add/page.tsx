'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import SubAdminForm from '@/components/forms/SubAdminForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function AddSubAdminPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN) {
            router.replace('/overview');
        }
    }, [router, user]);

    if (user?.role !== Role.ORG_ADMIN) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Add Sub Admin"
                description="Create an operational administrator account for this organization."
                icon={ShieldCheck}
            />
            <SubAdminForm />
        </FormPageShell>
    );
}
