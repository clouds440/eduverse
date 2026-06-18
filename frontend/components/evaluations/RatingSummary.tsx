'use client';

import { EvaluationSummary } from '@/types';
import { StarRatingInput } from './StarRatingInput';

interface RatingSummaryProps {
    summary?: Pick<EvaluationSummary, 'averageRating' | 'totalRatings' | 'distribution'> | null;
    compact?: boolean;
}

export function RatingSummary({ summary, compact }: RatingSummaryProps) {
    const average = summary?.averageRating ?? 0;
    const total = summary?.totalRatings ?? 0;

    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
            <div className="flex flex-wrap items-center gap-3">
                <div className="text-3xl font-black text-foreground">{summary?.averageRating?.toFixed(1) ?? '-'}</div>
                <div>
                    <StarRatingInput value={Math.round(average)} readOnly size={compact ? 'sm' : 'md'} />
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{total} rating{total === 1 ? '' : 's'}</p>
                </div>
            </div>
            {!compact && (
                <div className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map((rating) => {
                        const count = summary?.distribution?.[rating as 1 | 2 | 3 | 4 | 5] ?? 0;
                        const percent = total ? Math.round((count / total) * 100) : 0;
                        return (
                            <div key={rating} className="grid grid-cols-[2rem_1fr_2.5rem] items-center gap-2 text-xs font-medium text-muted-foreground">
                                <span>{rating} star</span>
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-warning" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="text-right">{count}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
