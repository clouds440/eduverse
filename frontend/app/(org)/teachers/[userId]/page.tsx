'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { DashboardInsights, Role, Teacher, type InsightTimeRange } from '@/types';
import { Loading } from '@/components/ui/Loading';
import InsightsOverview from '@/components/dashboard/InsightsOverview';
import { getInsightRangePreview, InsightRangeControl } from '@/components/dashboard/InsightRangeControl';
import { NotFound } from '@/components/NotFound';
import { PageHeader, PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { LayoutDashboard } from 'lucide-react';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

export default function TeacherLandingPage() {
    const { token, loading, user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [range, setRange] = useState<InsightTimeRange>('1M');

    const userId = params.userId as string;

    // SWR: Validation fetch for teacher existence
    const validationKey = token && userId ? ['validate-teacher', userId] as const : null;
    const { data: teacherData, error: validationError, isLoading: validating } = useSWR<Teacher>(validationKey);

    // Derived: Teacher exists check
    const teacherExists = validationError ? false : (teacherData ? true : null);

    // Check if current user is viewing own profile
    const isOwnProfile = user?.id === userId;

    // SWR: Insights fetch (conditional - only if validation passed AND viewing own profile)
    const insightsKey = token && teacherData && isOwnProfile ? ['teacher-insights', token, { range }] as const : null;
    const { data: insights, isLoading: insightsLoading } = useSWR<DashboardInsights>(
        insightsKey,
        ([, t]) => api.org.getInsights(t as string, { range })
    );

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
                actions={<InsightRangeControl value={range} onChange={setRange} preview={getInsightRangePreview(insights?.filters)} />}
            />
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                {insightsLoading || !insights ? <DashboardSkeleton /> : <InsightsOverview insights={insights} />}
            </div>
        </PageShell>
    );
}
