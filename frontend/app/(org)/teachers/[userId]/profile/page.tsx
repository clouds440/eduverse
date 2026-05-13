'use client';

import { Role, Teacher } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { useAuth } from '@/context/AuthContext';
import TeacherForm from '@/components/forms/TeacherForm';
import SessionManagement from '@/components/SessionManagement';
import { Settings, UserCircle } from 'lucide-react';
import { Loading } from '@/components/ui/Loading';
import { useEffect } from 'react';
import useSWR from 'swr';
import { ErrorState } from '@/components/ui/ErrorState';

export default function TeacherProfilePage() {
    const { state } = useGlobal();
    const { user, token } = useAuth();
    const teacherData = state.auth.userProfile as Teacher | null;
    const loading = state.auth.loading;

    // Fetch teacher profile if not already in state
    const profileKey = token && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) ? ['teacher-profile', user?.id] as const : null;
    const { data: fetchedProfile, isLoading: profileLoading, error: profileError, mutate } = useSWR<Teacher>(profileKey);

    // Use fetched profile if available, otherwise use state. The profile endpoint
    // may return the teacher row without a nested user, so merge auth user data for
    // self-profile form defaults such as role/isManager.
    const rawTeacherData = fetchedProfile || teacherData;
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

    // Log error for debugging
    if (profileError) {
        console.error('Failed to fetch teacher profile:', profileError);
    }

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
        <div className="flex flex-col w-full gap-6 md:gap-8">
            {/* Profile Section */}
            <div className="bg-linear-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
                {/* Header */}
                <div className="bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8 border-b border-primary/10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-4 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 shadow-lg group">
                                <UserCircle className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                                Account Settings
                            </h2>
                            <p className="text-sm md:text-base text-muted-foreground font-medium mt-1 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Update your personal information and security preferences
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8">
                    {loading || profileLoading ? (
                        <div className="py-20 flex justify-center">
                            <Loading size="lg" />
                        </div>
                    ) : effectiveTeacherData ? (
                        <TeacherForm
                            initialData={effectiveTeacherData}
                            isProfile={true}
                        />
                    ) : (
                        <ErrorState error={profileError} onRetry={() => mutate()} />
                    )}
                </div>
            </div>

            {/* Session Management */}
            {!loading && !profileLoading && effectiveTeacherData && (
                <div id="sessions">
                    <SessionManagement userId={effectiveTeacherData.id} />
                </div>
            )}
        </div>
    );
}
