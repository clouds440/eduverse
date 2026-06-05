'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { DashboardInsights, Role, Teacher } from '@/types';
import { Loading } from '@/components/ui/Loading';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { NotFound } from '@/components/NotFound';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { LayoutDashboard } from 'lucide-react';

export default function TeacherLandingPage() {
    const { token, loading, user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const { dispatch } = useGlobal();

    const userId = params.userId as string;

    // SWR: Validation fetch for teacher existence
    const validationKey = token && userId ? ['validate-teacher', userId] as const : null;
    const { data: teacherData, error: validationError, isLoading: validating } = useSWR<Teacher>(validationKey);

    // Derived: Teacher exists check
    const teacherExists = validationError ? false : (teacherData ? true : null);

    // Check if current user is viewing own profile
    const isOwnProfile = user?.id === userId;

    // SWR: Insights fetch (conditional - only if validation passed AND viewing own profile)
    const insightsKey = token && teacherData && isOwnProfile ? ['teacher-insights'] as const : null;
    const { data: insights, isLoading: insightsLoading } = useSWR<DashboardInsights>(insightsKey);

    // Authorization effect - handles redirects based on validation and role
    useEffect(() => {
        if (!user || !teacherData) return;

        if (user.id !== userId) {
            if (user.role === Role.ORG_ADMIN || user.role === Role.ORG_MANAGER) {
                // Redirect to edit page for admins/managers
                router.replace(`/teachers/edit/${teacherData.id}`);
            } else {
                // Unauthorized access
                dispatch({ type: 'TOAST_ADD', payload: { message: 'You do not have permission to view this teacher profile.', type: 'error' } });
            }
        }
    }, [user, teacherData, userId, router, dispatch]);

    // Show loading while auth is loading or validating
    if (loading || validating) {
        return (
            <div className="flex flex-1 items-center justify-center py-12">
                <Loading size="lg" />
            </div>
        );
    }

    // Show not found if teacher doesn't exist or unauthorized
    if (teacherExists === false) {
        return <NotFound page="Teacher" />;
    }

    // Show loading while fetching insights (only for own profile view)
    if (isOwnProfile && insightsLoading) {
        return (
            <div className="flex flex-1 items-center justify-center py-12">
                <Loading size="lg" />
            </div>
        );
    }

    // If viewing someone else's profile (already redirected), or no insights to show
    if (!insights) {
        return (
            <div className="flex flex-1 items-center justify-center py-12">
                <Loading size="lg" />
            </div>
        );
    }

    return (
        <PageShell>
            <PageHeader
                title="Teacher Overview"
                description="Your teaching snapshot across sections, attendance, schedules, grading, and student activity."
                icon={LayoutDashboard}
                meta={<Badge variant="neutral" size="sm">Live dashboard</Badge>}
                breadcrumbs={[
                    { label: 'Teacher Portal' },
                    { label: 'Overview' },
                ]}
            />
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                <InsightsOverview insights={insights} />
            </div>
        </PageShell>
    );
}
