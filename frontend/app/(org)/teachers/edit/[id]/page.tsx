'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { UserPlus, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import TeacherForm from '@/components/forms/TeacherForm';
import { useGlobal } from '@/context/GlobalContext';
import { Teacher, Role } from '@/types';
import { NotFound } from '@/components/NotFound';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function EditTeacherPage() {
    const { user, token, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { dispatch } = useGlobal();
    const teacherId = params.id as string;

    // Role guard check
    useEffect(() => {
        if (!authLoading && user) {
            if (user.role !== Role.ORG_ADMIN && user.role !== Role.ORG_MANAGER) {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to edit this teacher.', type: 'error' } });
                router.replace('/teachers');
            }
        }
    }, [authLoading, user, router, dispatch]);

    // SWR for teacher data
    const teacherKey = token && teacherId ? ['teacher', teacherId] as const : null;
    const { data: teacherData, isLoading: dataLoading, error } = useSWR<Teacher>(teacherKey);

    const teacherExists = error ? false : (teacherData ? true : null);

    if (authLoading || dataLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4 text-primary-foreground/60">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="font-bold text-sm tracking-widest">Loading Teacher Data...</p>
                </div>
            </div>
        );
    }

    if (teacherExists === false) {
        return <NotFound page="Teacher" />;
    }

    if (!teacherData) return null;

    return (
        <FormPageShell>
            <FormPageHeader
                title="Edit Teacher"
                description="Update faculty records."
                icon={UserPlus}
            />
            <TeacherForm teacherId={teacherId} initialData={teacherData} />
        </FormPageShell>
    );
}
