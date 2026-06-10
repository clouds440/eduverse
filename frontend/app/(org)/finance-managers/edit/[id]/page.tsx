'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Loader2, WalletCards } from 'lucide-react';
import { Role, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import FinanceManagerForm from '@/components/forms/FinanceManagerForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';
import { NotFound } from '@/components/NotFound';

export default function EditFinanceManagerPage() {
    const { user, token, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { dispatch } = useGlobal();
    const financeManagerId = params.id as string;
    const hasAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    useEffect(() => {
        if (!authLoading && user && !hasAccess) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to edit finance managers.', type: 'error' } });
            router.replace('/overview');
        }
    }, [authLoading, dispatch, hasAccess, router, user]);

    const financeManagerKey = token && financeManagerId && hasAccess ? ['finance-manager', financeManagerId] as const : null;
    const { data: financeManagerData, isLoading: dataLoading, error } = useSWR<User>(financeManagerKey);

    const financeManagerExists = error ? false : (financeManagerData ? true : null);

    if (authLoading || dataLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary-foreground/60">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-bold tracking-widest">Loading Finance Manager Data...</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) return null;

    if (financeManagerExists === false) {
        return <NotFound page="Finance Manager" />;
    }

    if (!financeManagerData) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Edit Finance Manager"
                description="Update finance manager credentials and account status."
                icon={WalletCards}
            />
            <FinanceManagerForm financeManagerId={financeManagerId} initialData={financeManagerData} />
        </FormPageShell>
    );
}
