'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, CheckCircle, Clock, ListChecks, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PreferenceWindow, PreferenceWindowStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

function formatDate(value: string) {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function hasSubmitted(window: PreferenceWindow) {
    return Boolean(window.submissions?.length);
}

function statusBadge(window: PreferenceWindow) {
    const submitted = hasSubmitted(window);
    if (submitted) return <Badge variant="success" size="sm" icon={CheckCircle}>Submitted</Badge>;
    if (window.status === PreferenceWindowStatus.ACTIVE) return <Badge variant="warning" size="sm" icon={Clock}>Pending</Badge>;
    return <Badge variant="neutral" size="sm" icon={Lock}>Closed</Badge>;
}

function WindowCard({ window }: { window: PreferenceWindow }) {
    const submitted = hasSubmitted(window);
    const isActive = window.status === PreferenceWindowStatus.ACTIVE;

    return (
        <Card padding="md" hoverable>
            <div className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                            {statusBadge(window)}
                            <Badge variant="primary" size="sm">{window.kind === 'SECTION_CHOICE' ? 'Sections' : 'Courses'}</Badge>
                        </div>
                        <h3 className="truncate text-base font-black text-foreground">{window.title}</h3>
                        {window.description && (
                            <p className="mt-1 line-clamp-2 text-sm font-medium text-muted-foreground">{window.description}</p>
                        )}
                    </div>
                </div>

                <div className="grid gap-2 text-xs font-semibold text-muted-foreground sm:grid-cols-2">
                    <span>Opens: {formatDate(window.startAt)}</span>
                    <span>Deadline: {formatDate(window.endAt)}</span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-muted-foreground">
                        {window._count?.options || window.options?.length || 0} options
                    </p>
                    <Link
                        href={`/preference-windows/${window.id}`}
                        className={[
                            'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold leading-tight transition-colors',
                            submitted || !isActive
                                ? 'border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/5'
                                : 'border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
                        ].join(' ')}
                    >
                        <ArrowRight className="h-4 w-4 shrink-0" />
                        <span>{submitted ? 'Review' : 'Choose'}</span>
                    </Link>
                </div>
            </div>
        </Card>
    );
}

export default function Preferences() {
    const { token } = useAuth();
    const key = token ? ['student-preference-windows', token] as const : null;
    const { data, error, isLoading, mutate } = useSWR<PreferenceWindow[]>(key, ([, t]) => api.org.getMyPreferenceWindows(t as string));

    if (isLoading) {
        return (
            <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-lg" />)}
            </div>
        );
    }

    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;

    const windows = data || [];
    const active = windows.filter((window) => window.status === PreferenceWindowStatus.ACTIVE);
    const closed = windows.filter((window) => window.status !== PreferenceWindowStatus.ACTIVE);

    if (windows.length === 0) {
        return (
            <EmptyState
                icon={ListChecks}
                title="No preference windows"
                description="When your institution opens a course or section preference window, it will appear here."
                className="min-h-80"
            />
        );
    }

    return (
        <div className="space-y-6">
            {active.length > 0 && (
                <section>
                    <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Open</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                        {active.map((window) => <WindowCard key={window.id} window={window} />)}
                    </div>
                </section>
            )}
            {closed.length > 0 && (
                <section>
                    <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Closed</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                        {closed.map((window) => <WindowCard key={window.id} window={window} />)}
                    </div>
                </section>
            )}
        </div>
    );
}
