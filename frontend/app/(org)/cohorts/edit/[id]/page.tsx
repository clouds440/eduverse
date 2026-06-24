'use client';

import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Cohort } from '@/types';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { CohortFormPage } from '@/components/cohorts/CohortFormPage';

export default function EditCohortPage() {
    const { token } = useAuth();
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const cohortId = params.id;
    const returnTo = useMemo(() => {
        const requested = searchParams.get('returnTo');
        return requested?.startsWith('/cohorts') ? requested : `/cohorts/${cohortId}`;
    }, [cohortId, searchParams]);

    const cohortKey = token ? ['cohort', cohortId] as const : null;
    const { data: cohort, isLoading, error, mutate } = useSWR<Cohort>(cohortKey, async () => {
        if (!token) throw new Error('Authentication required');
        return api.cohorts.getCohort(cohortId, token);
    });

    if (!token || isLoading || !cohort) {
        return <Loading className="h-full" text="Loading Cohort..." />;
    }

    if (error) {
        return <ErrorState error={error} onRetry={() => mutate()} />;
    }

    return <CohortFormPage mode="edit" cohort={cohort} returnTo={returnTo} />;
}
