'use client';

import type { InsightTimeRange } from '@/types';

export const INSIGHT_TIME_RANGE_OPTIONS: Array<{ value: InsightTimeRange; label: string }> = [
  { value: '1D', label: '1D' },
  { value: '3D', label: '3D' },
  { value: '7D', label: '7D' },
  { value: '15D', label: '15D' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
];

export function InsightRangeControl({
  value,
  onChange,
  preview,
  className = '',
}: {
  value: InsightTimeRange;
  onChange: (value: InsightTimeRange) => void;
  preview?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className}`}>
      <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-border/70 bg-background/80 p-1 shadow-xs">
        {INSIGHT_TIME_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-8 shrink-0 rounded px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-3 ${
              value === option.value
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {preview && (
        <div className="inline-flex min-h-9 min-w-0 items-center rounded-md border border-border/70 bg-background/80 px-3 text-xs font-black text-foreground shadow-xs">
          <span className="truncate">{preview}</span>
        </div>
      )}
    </div>
  );
}

export function getInsightRangePreview(filters?: { from?: string; to?: string }) {
  if (!filters?.from || !filters?.to) return undefined;
  return `${new Date(filters.from).toLocaleDateString()} - ${new Date(filters.to).toLocaleDateString()}`;
}
