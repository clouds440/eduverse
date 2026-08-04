'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ProgramForm } from '@/components/programs/ProgramForm';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Program } from '@/types';

export default function EditProgramPage() {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuth();
    const { data, isLoading, error, mutate } = useSWR<Program>(token ? ['program', id] : null, () => api.programs.getProgram(id, token!));
    if (isLoading || !data) return <Loading className="h-full" text="Loading program..." />;
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
    return <ProgramForm program={data} />;
}
