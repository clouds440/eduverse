'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import useSWR from 'swr';
import StudentForm from '@/components/forms/StudentForm';
import { useGlobal } from '@/context/GlobalContext';
import { Student, Role } from '@/types';
import { NotFound } from '@/components/NotFound';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function EditStudentPage() {
    const { user, token, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { dispatch } = useGlobal();
    const studentId = params.id as string;

    // Role guard check
    useEffect(() => {
        if (!authLoading && user) {
            if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN) {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to edit students.', type: 'error' } });
                router.replace('/users/students');
            }
        }
    }, [authLoading, dispatch, user, router]);

    // SWR for student data
    const studentKey = token && studentId ? ['student', studentId] as const : null;
    const { data: studentData, isLoading: dataLoading, error } = useSWR<Student>(studentKey);

    const studentExists = error ? false : (studentData ? true : null);

    if (authLoading || dataLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4 text-primary-foreground/60">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-bold text-sm tracking-widest">Loading Student Data...</p>
                </div>
            </div>
        );
    }

    if (studentExists === false) {
        return <NotFound page="Student" />;
    }

    if (!studentData) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Edit Student"
                description="Update learner records."
                icon={UserPlus}
            />
            <StudentForm studentId={studentId} initialData={studentData} />
        </FormPageShell>
    );
}
