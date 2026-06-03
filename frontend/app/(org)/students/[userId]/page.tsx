'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useSWR from 'swr';
import { useGlobal } from '@/context/GlobalContext';
import { Section, FinalGradeResponse, Student, Role, Assessment, DashboardInsights, PaginatedResponse } from '@/types';
import { ShieldOff, GraduationCap, LayoutDashboard, Book, BookOpen, Trophy, CheckCircle, UserCircle, type LucideIcon } from 'lucide-react';
import { Skeleton, DashboardSkeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { NotFound } from '@/components/NotFound';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, PageShell, ResourcePanel, type PageBreadcrumb } from '@/components/ui/PageShell';

import Overview from './_components/Overview';
import Courses from './_components/Courses';
import Grades from './_components/Grades';
import Attendance from './_components/Attendance';
import Profile from './_components/Profile';
import Assessments from './_components/Assessments';

type StudentPortalTab = 'overview' | 'courses' | 'assessments' | 'grades' | 'attendance' | 'profile';

const STUDENT_PORTAL_TABS: Record<StudentPortalTab, {
    id: StudentPortalTab;
    label: string;
    title: string;
    description: string;
    icon: LucideIcon;
    breadcrumbs: PageBreadcrumb[];
}> = {
    overview: {
        id: 'overview',
        label: 'Overview',
        title: 'Student Overview',
        description: 'Your live academic snapshot, upcoming work, and progress signals.',
        icon: LayoutDashboard,
        breadcrumbs: [{ label: 'Student Portal' }, { label: 'Overview' }],
    },
    courses: {
        id: 'courses',
        label: 'Courses',
        title: 'My Courses',
        description: 'Browse your enrolled course sections, teachers, rooms, schedules, and materials.',
        icon: Book,
        breadcrumbs: [{ label: 'Student Portal' }, { label: 'Courses' }],
    },
    assessments: {
        id: 'assessments',
        label: 'Assessments',
        title: 'Assessments',
        description: 'Track assigned work, due dates, submissions, and published results.',
        icon: BookOpen,
        breadcrumbs: [{ label: 'Student Portal' }, { label: 'Assessments' }],
    },
    grades: {
        id: 'grades',
        label: 'Grades',
        title: 'Grades',
        description: 'Review published course performance and open your official transcript.',
        icon: Trophy,
        breadcrumbs: [{ label: 'Student Portal' }, { label: 'Grades' }],
    },
    attendance: {
        id: 'attendance',
        label: 'Attendance',
        title: 'Attendance',
        description: 'See your attendance summary by course section and drill into monthly records.',
        icon: CheckCircle,
        breadcrumbs: [{ label: 'Student Portal' }, { label: 'Attendance' }],
    },
    profile: {
        id: 'profile',
        label: 'Profile',
        title: 'Profile Settings',
        description: 'Update your personal information and manage account sessions.',
        icon: UserCircle,
        breadcrumbs: [{ label: 'Student Portal' }, { label: 'Profile Settings' }],
    },
};

function getStudentPortalTab(value: string | null): StudentPortalTab {
    if (value && value in STUDENT_PORTAL_TABS) return value as StudentPortalTab;
    return 'overview';
}

function StudentPortalContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = getStudentPortalTab(searchParams.get('tab'));
    const tabMeta = STUDENT_PORTAL_TABS[tab];
    const { user, token } = useAuth();
    const { dispatch } = useGlobal();

    const userId = params.userId as string;

    const validationKey = token && userId ? ['validate-student', userId] as const : null;
    const { data: studentData, error: validationError, isLoading: validatingStudent } = useSWR<Student>(validationKey);

    const profileKey = token && user?.role === Role.STUDENT ? ['student-profile', user.id] as const : null;
    const { data: profile, isLoading: profileLoading, error: profileError, mutate: mutateProfile } = useSWR<Student>(profileKey);

    const isStudentPortalOwner = user?.role === Role.STUDENT && user.id === userId;
    const shouldFetchData = Boolean(token && user && isStudentPortalOwner && studentData);

    const sectionsKey = shouldFetchData && (tab === 'courses' || tab === 'assessments') && user?.id
        ? ['student-sections', user.id, { my: true, limit: 100, activeAcademicCycleOnly: true }] as const
        : null;
    const { data: sectionsData, isLoading: sectionsLoading, error: sectionsError, mutate: mutateSections } = useSWR<PaginatedResponse<Section>>(sectionsKey);

    const gradesKey = shouldFetchData && tab === 'grades' && studentData?.id ? ['student-grades', studentData.id] as const : null;
    const { data: grades, isLoading: gradesLoading, error: gradesError, mutate: mutateGrades } = useSWR<FinalGradeResponse[]>(gradesKey);

    const assessmentsKey = shouldFetchData && (tab === 'courses' || tab === 'assessments') ? ['student-assessments', {}] as const : null;
    const { data: assessments, isLoading: assessmentsLoading, error: assessmentsError, mutate: mutateAssessments } = useSWR<Assessment[]>(assessmentsKey);

    const insightsKey = shouldFetchData && tab === 'overview' ? ['student-insights'] as const : null;
    const { data: insights, isLoading: insightsLoading, error: insightsError, mutate: mutateInsights } = useSWR<DashboardInsights>(insightsKey);

    const studentExists = validationError ? false : (studentData ? true : null);
    const sections = sectionsData?.data || [];

    useEffect(() => {
        const hash = window.location.hash;
        if (!hash) return;
        const element = document.getElementById(hash.substring(1));
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        if (!user || !studentData) return;

        const isAuthorized = user.role === Role.STUDENT && user.id === userId;

        if (!isAuthorized) {
            if (user.role === Role.ORG_ADMIN || user.role === Role.ORG_MANAGER) {
                router.replace(`/students/edit/${studentData.id}`);
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
            <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center justify-center rounded-lg border border-warning bg-card/70 p-8 text-center shadow-xl backdrop-blur-md sm:p-12">
                <ShieldOff className="mb-6 h-16 w-16 text-warning sm:h-20 sm:w-20" />
                <h2 className="mb-3 text-2xl font-black text-foreground sm:text-4xl">Account Suspended</h2>
                <p className="text-sm font-medium text-muted-foreground sm:text-lg">
                    Your account has been temporarily suspended by the administration. Please contact your administration for details.
                </p>
            </div>
        );
    }

    const renderTabContent = () => {
        if (validatingStudent || studentExists === null) {
            return <DashboardSkeleton />;
        }

        if (!isStudentPortalOwner) {
            return (
                <EmptyState
                    icon={ShieldOff}
                    title="Access denied"
                    description="This student portal is only available to the assigned student account."
                    className="min-h-96"
                />
            );
        }

        if (tab === 'overview') {
            if (insightsLoading) return <DashboardSkeleton />;
            if (insightsError) return <ErrorState error={insightsError} onRetry={() => mutateInsights()} />;
            return <Overview insights={insights || null} />;
        }

        if (tab === 'courses') {
            if (sectionsLoading || assessmentsLoading) return <SkeletonTable rows={5} columns={4} />;
            if (sectionsError) return <ErrorState error={sectionsError} onRetry={() => mutateSections()} />;
            if (assessmentsError) return <ErrorState error={assessmentsError} onRetry={() => mutateAssessments()} />;
            return <Courses sections={sections} assessments={assessments || []} />;
        }

        if (tab === 'assessments') {
            if (sectionsLoading || assessmentsLoading) {
                return (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-28 w-full rounded-lg" />
                        ))}
                    </div>
                );
            }
            if (sectionsError) return <ErrorState error={sectionsError} onRetry={() => mutateSections()} />;
            if (assessmentsError) return <ErrorState error={assessmentsError} onRetry={() => mutateAssessments()} />;
            return <Assessments assessments={assessments || []} sections={sections} />;
        }

        if (tab === 'grades') {
            if (gradesLoading) return <SkeletonTable rows={8} columns={3} />;
            if (gradesError) return <ErrorState error={gradesError} onRetry={() => mutateGrades()} />;
            return <Grades grades={grades || []} />;
        }

        if (tab === 'attendance') {
            return <Attendance />;
        }

        if (profileLoading) {
            return (
                <div className="space-y-5">
                    <Skeleton className="h-12 w-48 rounded-md" />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <Skeleton className="h-4 w-24 rounded-md" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        if (profileError) return <ErrorState error={profileError} onRetry={() => mutateProfile()} />;
        return <Profile profile={profile || studentData || null} />;
    };

    return (
        <PageShell>
            <PageHeader
                title={tabMeta.title}
                description={tabMeta.description}
                icon={tabMeta.icon}
                breadcrumbs={tabMeta.breadcrumbs}
            />

            {user?.status === 'ALUMNI' && (
                <div className="shrink-0 rounded-lg border border-info/20 bg-info/10 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-info" />
                        <div>
                            <p className="text-sm font-black text-info">Alumni Access</p>
                            <p className="mt-1 text-sm font-medium text-info/80">
                                You are viewing as an alumnus. Active course features may be limited.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <ResourcePanel>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    {renderTabContent()}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}

export default function StudentOverviewPage() {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <StudentPortalContent />
        </Suspense>
    );
}
