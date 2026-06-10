'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Role, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import SubAdminForm from '@/components/forms/SubAdminForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';
import { NotFound } from '@/components/NotFound';

export default function EditSubAdminPage() {
    const { user, token, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { dispatch } = useGlobal();
    const subAdminId = params.id as string;

    useEffect(() => {
        if (!authLoading && user && user.role !== Role.ORG_ADMIN) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to edit sub admins.', type: 'error' } });
            router.replace('/overview');
        }
    }, [authLoading, dispatch, router, user]);

    const subAdminKey = token && subAdminId && user?.role === Role.ORG_ADMIN ? ['sub-admin', subAdminId] as const : null;
    const { data: subAdminData, isLoading: dataLoading, error } = useSWR<User>(subAdminKey);

    const subAdminExists = error ? false : (subAdminData ? true : null);

    if (authLoading || dataLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary-foreground/60">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-bold tracking-widest">Loading Sub Admin Data...</p>
                </div>
            </div>
        );
    }

    if (user?.role !== Role.ORG_ADMIN) return null;

    if (subAdminExists === false) {
        return <NotFound page="Sub Admin" />;
    }

    if (!subAdminData) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Edit Sub Admin"
                description="Update sub admin credentials and account status."
                icon={ShieldCheck}
            />
            <SubAdminForm subAdminId={subAdminId} initialData={subAdminData} />
        </FormPageShell>
    );
}
