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
    // Redirect if not authorized
    useEffect(() => {
        if (user && user.role === Role.STUDENT) {
            router.push(`/students/${user.id}`);
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
