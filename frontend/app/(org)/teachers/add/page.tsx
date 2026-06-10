'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Role } from '@/types';
import TeacherForm from '@/components/forms/TeacherForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function AddTeacherPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.push(user.role === Role.TEACHER || user.role === Role.ORG_MANAGER ? `/teachers/${user.id}` : '/');
        }
    }, [user, router]);

    return (
        <FormPageShell>
            <FormPageHeader
                title="Add Faculty Member"
                description="Create a new teacher account for your organization."
                icon={UserPlus}
            />
            <TeacherForm />
        </FormPageShell>
    );
}
