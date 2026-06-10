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
            if (user.role !== Role.ORG_ADMIN && user.role !== Role.SUB_ADMIN && user.role !== Role.ORG_MANAGER && user.role !== Role.TEACHER) {
                router.replace('/');
            }
        }
    }, [authLoading, user, router]);

    // SWR for student data
    const studentKey = token && studentId ? ['student', studentId] as const : null;
    const { data: studentData, isLoading: dataLoading, error } = useSWR<Student>(studentKey);

    // Assigned academic staff permission check
    useEffect(() => {
        if ((user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) && studentData) {
            const isMyStudent = studentData.enrollments?.some(e =>
                e.section?.teachers?.some(t => t.userId === user.id)
            );
            if (!isMyStudent) {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to view this student record.', type: 'error' } });
                router.replace('/students');
            }
        }
    }, [user, studentData, router, dispatch]);

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

    const isWatchMode = user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER;

    return (
        <FormPageShell>
            <FormPageHeader
                title={isWatchMode ? 'View Student' : 'Edit Student'}
                description={isWatchMode ? 'Review learner records in read-only mode.' : 'Update learner records.'}
                icon={UserPlus}
            />
            <StudentForm studentId={studentId} initialData={studentData} />
        </FormPageShell>
    );
}
