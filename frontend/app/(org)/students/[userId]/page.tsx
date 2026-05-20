'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { useGlobal } from '@/context/GlobalContext';
import { Section, FinalGradeResponse, Student, Role, Assessment, DashboardInsights, PaginatedResponse } from '@/types';
import { ShieldOff, GraduationCap } from 'lucide-react';
import { Skeleton, DashboardSkeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { NotFound } from '@/components/NotFound';
import { ErrorState } from '@/components/ui/ErrorState';

import Overview from './_components/Overview';
import Courses from './_components/Courses';
import Grades from './_components/Grades';
import Attendance from './_components/Attendance';
import Profile from './_components/Profile';
import Assessments from './_components/Assessments';

function StudentPortalContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'overview';
    const { user, token } = useAuth();
    const { state, dispatch } = useGlobal();

    const profile = state.auth.userProfile as Student | null;
    const userId = params.userId as string;

    // SWR: Validation fetch (runs in parallel with data, NOT blocking)
    const validationKey = token && userId ? ['validate-student', userId] as const : null;
    const { data: studentData, error: validationError } = useSWR<Student>(validationKey);

    // SWR: Fetch student profile if not already in state
    const profileKey = token && user?.role === 'STUDENT' && studentData?.id ? ['student', studentData.id] as const : null;
    const { data: fetchedProfile, isLoading: profileLoading, error: profileError, mutate: mutateProfile } = useSWR<Student>(profileKey);

    // Use fetched profile if available, otherwise use state
    const effectiveProfile = fetchedProfile || profile;

    // SWR: Data fetches - lazy loaded per tab
    const shouldFetchData = token && user;

    // Only fetch sections when on courses tab
    const sectionsKey = shouldFetchData && tab === 'courses' && user?.id ? ['student-sections', user.id, { my: true }] as const : null;
    const { data: sectionsData, isLoading: sectionsLoading, error: sectionsError, mutate: mutateSections } = useSWR<PaginatedResponse<Section>>(sectionsKey);

    // Only fetch grades when on grades tab
    const gradesKey = shouldFetchData && tab === 'grades' && user?.id ? ['student-grades', user.id] as const : null;
    const { data: grades, isLoading: gradesLoading, error: gradesError, mutate: mutateGrades } = useSWR<FinalGradeResponse[]>(gradesKey);

    // Only fetch assessments when on assessments tab
    const assessmentsKey = shouldFetchData && tab === 'assessments' ? ['student-assessments', {}] as const : null;
    const { data: assessments, isLoading: assessmentsLoading, error: assessmentsError, mutate: mutateAssessments } = useSWR<Assessment[]>(assessmentsKey);

    // Only fetch insights when on overview tab
    const insightsKey = shouldFetchData && tab === 'overview' ? ['student-insights'] as const : null;
    const { data: insights, isLoading: insightsLoading, error: insightsError, mutate: mutateInsights } = useSWR<DashboardInsights>(insightsKey);

    // Derived states
    const studentExists = validationError ? false : (studentData ? true : null);
    const sections = sectionsData?.data || [];

    // Handle hash scroll
    useEffect(() => {
        const hash = window.location.hash;
        if (hash) {
            const elementId = hash.substring(1);
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, []);

    // Authorization effect - handles redirects based on validation and role
    useEffect(() => {
        if (!user || !studentData) return;

        const isAuthorized = user.role === Role.STUDENT && user.id === userId;

        if (!isAuthorized) {
            if (user.role === Role.ORG_ADMIN || user.role === Role.ORG_MANAGER) {
                router.push(`/students/edit/${studentData.id}`);
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Access Denied. You are not authorized to view this portal.', type: 'error' } });
            }
        }
    }, [user, studentData, userId, router, dispatch]);



    if (studentExists === false) {
        return <NotFound page="Student" />;
    }

    if (user?.status === 'SUSPENDED') {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card/70 backdrop-blur-md rounded-lg shadow-2xl border border-warning text-center max-w-2xl mx-auto mt-10">
                <ShieldOff className="w-20 h-20 text-warning mb-6" />
                <h2 className="text-4xl font-black text-foreground mb-4">Account Suspended</h2>
                <p className="text-muted-foreground text-lg mb-8">
                    Your account has been temporarily suspended by the administration. Please contact your Administration for details.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full">
            {user?.status === 'ALUMNI' && (
                <div className="flex flex-col items-center justify-center p-12 bg-card/70 backdrop-blur-md rounded-lg shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-info/20 text-center max-w-2xl mx-auto mb-10 hover:shadow-2xl transition-all duration-500">
                    <div className="p-6 bg-info/10 rounded-full mb-6">
                        <GraduationCap className="w-20 h-20 text-info" />
                    </div>
                    <h2 className="text-4xl font-black text-foreground mb-4 tracking-tight">Alumni Access</h2>
                    <p className="text-muted-foreground text-lg mb-8 font-medium">
                        You are viewing as an alumnus. Some features like active courses are not available.
                    </p>
                </div>
            )}

            <div className="mt-4">
                {tab === 'overview' && (
                    insightsLoading ? (
                        <DashboardSkeleton />
                    ) : insightsError ? (
                        <ErrorState error={insightsError} onRetry={() => mutateInsights()} />
                    ) : (
                        <Overview insights={insights || null} />
                    )
                )}
                {tab === 'courses' && (
                    sectionsLoading ? (
                        <SkeletonTable rows={5} columns={4} />
                    ) : sectionsError ? (
                        <ErrorState error={sectionsError} onRetry={() => mutateSections()} />
                    ) : (
                        <Courses sections={sections} />
                    )
                )}
                {tab === 'assessments' && (
                    assessmentsLoading ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : assessmentsError ? (
                        <ErrorState error={assessmentsError} onRetry={() => mutateAssessments()} />
                    ) : (
                        <Assessments assessments={assessments || []} sections={sections} />
                    )
                )}
                {tab === 'grades' && (
                    gradesLoading ? (
                        <SkeletonTable rows={8} columns={3} />
                    ) : gradesError ? (
                        <ErrorState error={gradesError} onRetry={() => mutateGrades()} />
                    ) : (
                        <Grades grades={grades || []} />
                    )
                )}
                {tab === 'attendance' && <Attendance />}
                {tab === 'profile' && (
                    profileLoading ? (
                        <div className="space-y-6">
                            <Skeleton className="h-12 w-1/4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-10 w-full rounded-md" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : profileError ? (
                        <ErrorState error={profileError} onRetry={() => mutateProfile()} />
                    ) : (
                        <Profile profile={effectiveProfile} />
                    )
                )}
            </div>
        </div>
    );
}

export default function StudentOverviewPage() {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <StudentPortalContent />
        </Suspense>
    );
}
