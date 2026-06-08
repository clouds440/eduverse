'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { buildDocsSearchEntries } from '../_data/docs';

type DocsSearchProps = {
  compact?: boolean;
  onNavigate?: () => void;
  autoFocus?: boolean;
  className?: string;
  resultsMode?: 'inline' | 'popover';
};

const MIN_QUERY_LENGTH = 2;

export function DocsSearch({ compact, onNavigate, autoFocus, className, resultsMode = 'inline' }: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(() => buildDocsSearchEntries(), []);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);

    return entries
      .map((entry) => {
        const haystack = entry.text.toLowerCase();
        const tagText = entry.tags.join(' ').toLowerCase();
        const titleText = `${entry.pageTitle} ${entry.sectionTitle}`.toLowerCase();
        const score = terms.reduce((total, term) => {
          if (!haystack.includes(term)) return total;
          let nextScore = total + 1;
          if (titleText.includes(term)) nextScore += 4;
          if (tagText.includes(term)) nextScore += 2;
          if (entry.category.toLowerCase().includes(term)) nextScore += 1;
          return nextScore;
        }, 0);

        return { ...entry, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.pageTitle.localeCompare(b.pageTitle))
      .slice(0, compact ? 5 : 8);
  }, [compact, entries, query]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        type="search"
        size="sm"
        icon={Search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search docs..."
        aria-label="Search documentation"
        className="bg-card"
      />

      {query.trim().length >= MIN_QUERY_LENGTH && (
        <div
          className={cn(
            'max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg',
            resultsMode === 'popover'
              ? 'absolute left-0 right-0 top-full z-50 mt-2'
              : 'mt-2',
          )}
        >
          {results.length > 0 ? (
            <div className="divide-y divide-border/70">
              {results.map((result) => (
                <Link
                  key={result.href}
                  href={result.href}
                  onClick={() => {
                    setQuery('');
                    onNavigate?.();
                  }}
                  className="block p-3 transition-colors hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-foreground">{result.sectionTitle}</p>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      {result.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-primary">{result.pageTitle}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {result.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[11px] font-bold text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-3 text-sm font-semibold text-muted-foreground">No docs matched that search.</p>
          )}
        </div>
      )}
    </div>
  );
}
