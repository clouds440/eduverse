'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Loader2, Users } from 'lucide-react';
import { GuardianProfile, Role } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import GuardianForm from '@/components/forms/GuardianForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';
import { NotFound } from '@/components/NotFound';

export default function EditGuardianPage() {
    const { user, token, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { dispatch } = useGlobal();
    const guardianId = params.id as string;
    const hasAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    useEffect(() => {
        if (!authLoading && user && !hasAccess) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to edit guardians.', type: 'error' } });
            router.replace('/overview');
        }
    }, [authLoading, dispatch, hasAccess, router, user]);

    const guardianKey = token && guardianId && hasAccess ? ['guardian', guardianId] as const : null;
    const { data: guardianData, isLoading, error } = useSWR<GuardianProfile>(guardianKey, ([, id]) => api.org.getGuardian(id as string, token!));

    if (authLoading || isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary-foreground/60">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-bold tracking-widest">Loading Guardian Data...</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) return null;
    if (error) return <NotFound page="Guardian" />;
    if (!guardianData) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Edit Guardian"
                description="Update guardian account details, status, photo, and contact information."
                icon={Users}
            />
            <GuardianForm guardianId={guardianId} initialData={guardianData} />
        </FormPageShell>
    );
}
