'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Role } from '@/types';
import TeacherForm from '@/components/forms/TeacherForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function AddTeacherPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const defaultManager = searchParams.get('role') === 'manager';

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.push(user.role === Role.TEACHER || user.role === Role.ORG_MANAGER ? `/teachers/${user.id}` : '/');
        }
    }, [user, router]);

    return (
        <FormPageShell>
            <FormPageHeader
                title={defaultManager ? 'Add Manager' : 'Add Faculty Member'}
                description={defaultManager ? 'Create an academic manager account for your organization.' : 'Create a new teacher account for your organization.'}
                icon={UserPlus}
            />
            <TeacherForm defaultManager={defaultManager} />
        </FormPageShell>
    );
}
