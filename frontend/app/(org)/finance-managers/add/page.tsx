'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WalletCards } from 'lucide-react';
import { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import FinanceManagerForm from '@/components/forms/FinanceManagerForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function AddFinanceManagerPage() {
    const { user } = useAuth();
    const router = useRouter();
    const hasAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    useEffect(() => {
        if (user && !hasAccess) {
            router.replace('/overview');
        }
    }, [hasAccess, router, user]);

    if (!hasAccess) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Add Finance Manager"
                description="Create a finance-only operator account for this organization."
                icon={WalletCards}
            />
            <FinanceManagerForm />
        </FormPageShell>
    );
}
