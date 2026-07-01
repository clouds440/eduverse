'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { fuzzySearchScore, normalizeFuzzyText } from '@/lib/fuzzySearch';
import { buildDocsSearchEntries } from '../_data/docs';
import type { DocsSearchEntry } from '../_data/docs';

type DocsSearchProps = {
  compact?: boolean;
  onNavigate?: () => void;
  autoFocus?: boolean;
  className?: string;
  resultsMode?: 'inline' | 'popover';
};

const MIN_QUERY_LENGTH = 2;
const SNIPPET_BEFORE_MATCH = 40;
const SNIPPET_AFTER_MATCH = 80;

type ScoredDocsSearchEntry = DocsSearchEntry & {
  score: number;
  snippet: string;
  matchedTokens: string[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value: string) {
  return normalizeFuzzyText(value);
}

function includesToken(value: string, token: string) {
  return normalize(value).includes(token);
}

function findBestMatchIndex(text: string, tokens: string[], query: string) {
  const normalizedText = normalize(text);
  const exactIndex = normalizedText.indexOf(query);
  if (exactIndex !== -1) return { index: exactIndex, length: query.length };

  const matches = tokens
    .map((token) => ({ index: normalizedText.indexOf(token), length: token.length }))
    .filter((match) => match.index !== -1)
    .sort((a, b) => a.index - b.index || b.length - a.length);

  return matches[0] ?? { index: -1, length: 0 };
}

function sentenceAroundMatch(text: string, matchIndex: number) {
  const before = text.slice(0, matchIndex);
  const after = text.slice(matchIndex);
  const previousBoundary = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'));
  const nextBoundaryCandidates = ['.', '!', '?', '\n']
    .map((char) => after.indexOf(char))
    .filter((index) => index !== -1);
  const nextBoundary = nextBoundaryCandidates.length ? Math.min(...nextBoundaryCandidates) : -1;
  const sentenceStart = previousBoundary === -1 ? 0 : previousBoundary + 1;
  const sentenceEnd = nextBoundary === -1 ? text.length : matchIndex + nextBoundary + 1;

  return {
    text: text.slice(sentenceStart, sentenceEnd).trim(),
    offset: matchIndex - sentenceStart,
    startsMidText: sentenceStart > 0,
    endsMidText: sentenceEnd < text.length,
  };
}

function extractMatchSnippet(text: string, query: string, tokens: string[]) {
  const source = text.trim();
  if (!source) return '';

  const match = findBestMatchIndex(source, tokens, query);
  if (match.index === -1) return source.slice(0, 140);

  const sentence = sentenceAroundMatch(source, match.index);
  const windowStart = Math.max(0, sentence.offset - SNIPPET_BEFORE_MATCH);
  const windowEnd = Math.min(sentence.text.length, sentence.offset + match.length + SNIPPET_AFTER_MATCH);
  const prefix = sentence.startsMidText || windowStart > 0 ? '...' : '';
  const suffix = sentence.endsMidText || windowEnd < sentence.text.length ? '...' : '';

  return `${prefix}${sentence.text.slice(windowStart, windowEnd).trim()}${suffix}`;
}

function pickSnippetSource(entry: DocsSearchEntry, query: string, tokens: string[]) {
  const candidates = [
    entry.titleText,
    entry.tagText,
    entry.categoryText,
    entry.bodyText,
    entry.fallbackSnippet,
    entry.pageTitle,
  ];

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      tokenHits: tokens.filter((token) => includesToken(candidate, token)).length,
      exactMatch: normalize(candidate).includes(query),
    }))
    .filter((item) => item.tokenHits > 0)
    .sort((a, b) => Number(b.exactMatch) - Number(a.exactMatch) || b.tokenHits - a.tokenHits || a.index - b.index)[0]?.candidate
    ?? entry.fallbackSnippet;
}

function scoreEntry(entry: DocsSearchEntry, tokens: string[]): number {
  const tokenScore = tokens.reduce((total, token) => {
    const titleMatch = includesToken(entry.titleText, token);
    const tagMatch = includesToken(entry.tagText, token) || entry.pageTags.some((tag) => includesToken(tag, token));
    const categoryMatch = includesToken(entry.categoryText, token);
    const bodyMatch = includesToken(entry.bodyText, token);
    const pageTitleMatch = includesToken(entry.pageTitle, token);

    return total
      + (titleMatch ? 10 : 0)
      + (tagMatch ? 6 : 0)
      + (categoryMatch ? 4 : 0)
      + (bodyMatch ? 1 : 0)
      + (pageTitleMatch && (titleMatch || tagMatch || bodyMatch) ? 2 : 0);
  }, 0);
  const fuzzyScore = fuzzySearchScore(tokens.join(' '), [
    entry.titleText,
    entry.tagText,
    entry.categoryText,
    entry.pageTitle,
    entry.bodyText,
  ]);
  return tokenScore + fuzzyScore / 20;
}

function HighlightedText({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = tokens.some((token) => part.toLowerCase() === token);
        return isMatch ? (
          <mark key={`${part}-${index}`} className="rounded-sm bg-warning/25 px-0.5 font-black text-foreground">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </>
  );
}

export function DocsSearch({ compact, onNavigate, autoFocus, className, resultsMode = 'inline' }: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(() => buildDocsSearchEntries(), []);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

    return entries
      .map<ScoredDocsSearchEntry | null>((entry) => {
        const score = scoreEntry(entry, tokens);
        if (score <= 0) return null;

        const snippetSource = pickSnippetSource(entry, normalizedQuery, tokens);
        return {
          ...entry,
          matchedTokens: tokens,
          score,
          snippet: extractMatchSnippet(snippetSource, normalizedQuery, tokens),
        };
      })
      .filter((entry): entry is ScoredDocsSearchEntry => Boolean(entry && entry.score > 0))
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
                    <p className="text-sm font-black text-foreground">
                      <HighlightedText text={result.sectionTitle} tokens={result.matchedTokens} />
                    </p>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <HighlightedText text={result.category} tokens={result.matchedTokens} />
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-primary">
                    <HighlightedText text={result.pageTitle} tokens={result.matchedTokens} />
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-muted-foreground">
                    <HighlightedText text={result.snippet} tokens={result.matchedTokens} />
                  </p>
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
