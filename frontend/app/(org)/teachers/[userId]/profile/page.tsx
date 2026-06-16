'use client';

import { Role, Teacher } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { useAuth } from '@/context/AuthContext';
import TeacherForm from '@/components/forms/TeacherForm';
import SessionManagement from '@/components/SessionManagement';
import { UserCircle } from 'lucide-react';
import { Loading } from '@/components/ui/Loading';
import { useEffect } from 'react';
import useSWR from 'swr';
import { ErrorState } from '@/components/ui/ErrorState';
import { useParams } from 'next/navigation';
import { FormPageHeader, FormPageShell } from '@/components/ui/FormLayout';

export default function TeacherProfilePage() {
    const { state } = useGlobal();
    const { user, token } = useAuth();
    const params = useParams();
    const userId = params.userId as string;

    const teacherDataFromState = state.auth.userProfile as Teacher | null;
    const loading = state.auth.loading;

    // SWR: Validation fetch
    const validationKey = token && userId ? ['validate-teacher', userId] as const : null;
    const { data: validatedTeacher, isLoading: validationLoading, error: validationError } = useSWR<Teacher>(validationKey);

    // Fetch teacher profile if not already in state
    const profileKey = token && validatedTeacher?.id && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) ? ['teacher', validatedTeacher.id] as const : null;
    const { data: fetchedProfile, isLoading: profileLoading, error: profileError, mutate } = useSWR<Teacher>(profileKey);
    const isProfileLoading = loading || validationLoading || profileLoading || (Boolean(validationKey) && !validatedTeacher && !validationError);
    const profileIssue = validationError || profileError;

    // Use fetched profile if available, otherwise use state. The profile endpoint
    // may return the teacher row without a nested user, so merge auth user data for
    // self-profile form defaults such as role/isManager.
    const rawTeacherData = fetchedProfile || teacherDataFromState;
    const effectiveTeacherData = rawTeacherData ? {
        ...rawTeacherData,
        user: rawTeacherData.user ?? {
            id: user?.id || rawTeacherData.userId,
            name: user?.name || '',
            email: user?.email || '',
            userName: user?.userName || '',
            role: user?.role || Role.TEACHER,
            phone: undefined,
            avatarUrl: user?.avatarUrl,
            avatarUpdatedAt: user?.avatarUpdatedAt,
            organizationId: user?.organizationId ?? user?.orgId ?? null,
        },
    } : null;

    // Scroll to section if hash is present
    useEffect(() => {
        const hash = window.location.hash;
        if (hash) {
            const elementId = hash.substring(1); // Remove the # symbol
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, []);

    return (
        <FormPageShell>
            <FormPageHeader
                title="Account Settings"
                description="Update your personal information and security preferences."
                icon={UserCircle}
            />

            {isProfileLoading ? (
                <div className="flex justify-center rounded-lg border border-border/70 bg-card/90 py-20 shadow-sm">
                    <Loading size="lg" />
                </div>
            ) : effectiveTeacherData ? (
                <TeacherForm
                    initialData={effectiveTeacherData}
                    isProfile={true}
                />
            ) : profileIssue ? (
                <div className="rounded-lg border border-border/70 bg-card/90 p-6 shadow-sm">
                    <ErrorState error={profileIssue} onRetry={() => mutate()} />
                </div>
            ) : (
                <div className="flex justify-center rounded-lg border border-border/70 bg-card/90 py-20 shadow-sm">
                    <Loading size="lg" />
                </div>
            )}

            {/* Session Management */}
            {!isProfileLoading && effectiveTeacherData && (
                <div id="sessions">
                    <SessionManagement userId={effectiveTeacherData.id} />
                </div>
            )}
        </FormPageShell>
    );
}
