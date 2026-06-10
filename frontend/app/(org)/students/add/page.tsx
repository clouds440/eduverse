'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Role } from '@/types';
import StudentForm from '@/components/forms/StudentForm';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function AddStudentPage() {
    const { user } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (!user) return;
        if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
            router.push(user.role === Role.STUDENT ? `/students/${user.id}` : '/students');
        }
    }, [user, router]);

    return (
        <FormPageShell>
            <FormPageHeader
                title="Admit Student"
                description="Register a new learner account."
                icon={UserPlus}
            />
            <StudentForm />
        </FormPageShell>
    );
}
