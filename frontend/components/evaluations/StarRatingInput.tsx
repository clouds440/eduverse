'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingInputProps {
    value: number;
    onChange?: (value: number) => void;
    readOnly?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
};

export function StarRatingInput({ value, onChange, readOnly, size = 'md', className }: StarRatingInputProps) {
    return (
        <div className={cn('inline-flex items-center gap-1', className)} role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((rating) => {
                const active = rating <= value;
                const Icon = (
                    <Star
                        className={cn(
                            sizeClasses[size],
                            active ? 'fill-warning text-warning' : 'text-muted-foreground/45',
                        )}
                    />
                );

                if (readOnly) {
                    return <span key={rating}>{Icon}</span>;
                }

                return (
                    <button
                        key={rating}
                        type="button"
                        role="radio"
                        aria-checked={value === rating}
                        title={`${rating} star${rating === 1 ? '' : 's'}`}
                        className="rounded-sm p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/35"
                        onClick={() => onChange?.(rating)}
                    >
                        {Icon}
                    </button>
                );
            })}
        </div>
    );
}
