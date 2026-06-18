'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { MessageSquareText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { EvaluationSummary } from '@/types';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { RatingSummary } from '@/components/evaluations/RatingSummary';
import { StarRatingInput } from '@/components/evaluations/StarRatingInput';

export default function TeacherFeedbackPage() {
    const { token } = useAuth();
    const [rating, setRating] = useState<number | undefined>(undefined);
    const key = token ? ['teacher-feedback', token, rating] as const : null;
    const { data, error, isLoading, mutate } = useSWR<EvaluationSummary>(
        key,
        ([, t, selectedRating]) => api.org.getTeacherFeedback(t as string, { rating: selectedRating as number | undefined }),
    );

    return (
        <PageShell>
            <PageHeader
                title="Feedback"
                description="Review your teacher evaluation summary and student comments."
                icon={MessageSquareText}
                breadcrumbs={[{ label: 'Teacher' }, { label: 'Feedback' }]}
            />
            <ResourcePanel>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-44 rounded-lg" />
                            <Skeleton className="h-28 rounded-lg" />
                            <Skeleton className="h-28 rounded-lg" />
                        </div>
                    ) : error ? (
                        <ErrorState error={error} onRetry={() => mutate()} />
                    ) : (
                        <div className="space-y-4">
                            <Card padding="md" hoverable={false}>
                                <RatingSummary summary={data} />
                            </Card>
                            <div className="flex flex-wrap gap-2">
                                {[undefined, 5, 4, 3, 2, 1].map((value) => (
                                    <button
                                        key={value ?? 'all'}
                                        type="button"
                                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${rating === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'}`}
                                        onClick={() => setRating(value)}
                                    >
                                        {value ? `${value} stars` : 'All ratings'}
                                    </button>
                                ))}
                            </div>
                            {(data?.feedback || []).length === 0 ? (
                                <EmptyState
                                    icon={MessageSquareText}
                                    title="No feedback yet"
                                    description="Written feedback will appear here after eligible students submit evaluations."
                                    className="min-h-64"
                                />
                            ) : (
                                <div className="space-y-3">
                                    {data?.feedback.map((item) => (
                                        <Card key={item.id} padding="md" hoverable={false}>
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-black text-foreground">{item.course?.name || 'Course'}</p>
                                                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                                                        {[item.section?.name, item.academicCycle?.name, new Date(item.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                                                    </p>
                                                </div>
                                                <StarRatingInput value={item.rating} readOnly />
                                            </div>
                                            {item.feedback && !item.isHidden && (
                                                <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">{item.feedback}</p>
                                            )}
                                            {item.isHidden && (
                                                <p className="mt-4 text-sm font-semibold text-muted-foreground">Feedback hidden by moderation.</p>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
