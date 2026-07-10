import { Injectable, OnModuleInit } from '@nestjs/common';
import { Role } from '@/prisma/prisma-client';
import { buildDocsSearchEntries, type DocsSearchEntry } from '@eduverse/docs';
import { fuzzySearchScore } from '../common/utils';
import { buildAIFlowSearchEntries, type AIFlowSearchEntry } from './ai-flows.source';
import { aiRouteEntries, type AIRouteEntry } from './ai-routes.source';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext } from './ai.types';

export interface AIDocsSearchResult {
  title: string;
  section: string;
  snippet: string;
  details: string[];
  href: string;
  tags: string[];
}

export interface AIRouteSearchResult {
  label: string;
  href: string;
  roles: Role[];
  description: string;
  module: string;
}

export interface AIFlowSearchResult {
  title: string;
  category: string;
  summary: string;
  roles: string[];
  routes: Array<{ label: string; href: string }>;
  prerequisites: string[];
  steps: Array<{ label: string; detail: string }>;
  warnings: string[];
  relatedDocs: string[];
  tags: string[];
}

@Injectable()
export class AIKnowledgeService implements OnModuleInit {
  private readonly docsEntries = buildDocsSearchEntries();
  private readonly flowEntries = buildAIFlowSearchEntries();

  constructor(private readonly toolRegistry: AIToolRegistryService) {}

  onModuleInit() {
    this.toolRegistry.register({
      name: 'searchDocs',
      description: 'Search EduVerse product documentation, including operational workflow steps, navigation paths, buttons, prerequisites, required fields, and compact docs links.',
      run: async (input: unknown) => {
        const searchInput = parseSearchInput(input);
        const query = searchInput.query;
        if (query.length < 2) {
          return {
            ok: true,
            data: { results: [] },
            message: 'Search query is too short.',
          };
        }

        return {
          ok: true,
          data: { results: this.searchDocs(query, searchInput.limit) },
        };
      },
    });

    this.toolRegistry.register({
      name: 'searchRoutes',
      description: 'Search safe EduVerse internal routes for the current user role.',
      run: async (input: unknown, context: AIToolContext) => {
        const searchInput = parseSearchInput(input);
        const query = searchInput.query;
        if (query.length < 2) {
          return {
            ok: true,
            data: { results: [] },
            message: 'Search query is too short.',
          };
        }

        return {
          ok: true,
          data: {
            results: this.searchRoutes(query, context.role as Role | undefined, context.userId, searchInput.limit),
          },
        };
      },
    });

    this.toolRegistry.register({
      name: 'searchFlows',
      description: 'Search compact EduVerse workflow flows: prerequisites, navigation, exact actions, required records/fields, warnings, and related docs. Use with searchDocs and live DB tools for complete how-to answers.',
      run: async (input: unknown) => {
        const searchInput = parseSearchInput(input);
        const query = searchInput.query;
        if (query.length < 2) {
          return {
            ok: true,
            data: { results: [] },
            message: 'Search query is too short.',
          };
        }

        return {
          ok: true,
          data: { results: this.searchFlows(query, searchInput.limit) },
        };
      },
    });
  }

  searchDocs(query: string, limit = 5): AIDocsSearchResult[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];

    const scored = this.docsEntries
      .map((entry) => ({
        entry,
        score: scoreDocsEntry(entry, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.pageTitle.localeCompare(b.entry.pageTitle));

    return expandDocsResults(scored, clampLimit(limit), tokens).map((entry) => ({
      title: entry.pageTitle,
      section: entry.sectionTitle,
      snippet: buildSnippet(entry.bodyText, entry.fallbackSnippet, tokens),
      details: buildDetails(entry.bodyText, tokens, query),
      href: entry.href,
      tags: entry.tags.slice(0, 5),
    }));
  }

  searchRoutes(
    query: string,
    role?: Role | string | null,
    userId?: string | null,
    limit = 5,
  ): AIRouteSearchResult[] {
    const tokens = tokenize(query);
    if (!tokens.length || !role) return [];
    const normalizedRole = role as Role;

    return aiRouteEntries
      .filter((entry) => entry.roles.includes(normalizedRole))
      .map((entry) => ({
        entry: resolveRouteHref(entry, userId),
        score: scoreRouteEntry(entry, tokens),
      }))
      .filter((item): item is { entry: AIRouteEntry; score: number } => Boolean(item.entry) && item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
      .slice(0, clampLimit(limit))
      .map(({ entry }) => ({
        label: entry.label,
        href: entry.href,
        roles: entry.roles,
        description: entry.description,
        module: entry.module,
      }));
  }

  searchFlows(query: string, limit = 5): AIFlowSearchResult[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];

    return this.flowEntries
      .map((entry) => ({
        entry,
        score: scoreFlowEntry(entry, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      .slice(0, clampLimit(limit))
      .map(({ entry }) => ({
        title: entry.title,
        category: entry.category,
        summary: entry.summary,
        roles: entry.roles,
        routes: entry.routes,
        prerequisites: entry.prerequisites,
        steps: entry.steps,
        warnings: entry.warnings,
        relatedDocs: entry.relatedDocs,
        tags: entry.tags.slice(0, 8),
      }));
  }
}

function parseSearchInput(input: unknown) {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const query = firstString(value.query, value.search, value.q).trim();
  const limit = typeof value.limit === 'number'
    ? value.limit
    : typeof value.limit === 'string'
      ? Number(value.limit)
      : undefined;

  return { query, limit };
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string') ?? '';
}

function clampLimit(limit?: number) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(12, Math.max(1, Math.round(parsed)));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(query: string) {
  return normalize(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !KNOWLEDGE_SEARCH_STOP_WORDS.has(token));
}

const KNOWLEDGE_SEARCH_STOP_WORDS = new Set([
  'about',
  'after',
  'all',
  'also',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'can',
  'could',
  'do',
  'does',
  'for',
  'from',
  'have',
  'help',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'new',
  'of',
  'ok',
  'on',
  'or',
  'please',
  'should',
  'tell',
  'that',
  'the',
  'them',
  'this',
  'to',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

function includesToken(value: string, token: string) {
  return normalize(value).includes(token);
}

function scoreDocsEntry(entry: DocsSearchEntry, tokens: string[]) {
  const tokenScore = tokens.reduce((score, token) => {
    const title = includesToken(entry.titleText, token) || includesToken(entry.pageTitle, token);
    const tags = includesToken(entry.tagText, token) || entry.pageTags.some((tag) => includesToken(tag, token));
    const category = includesToken(entry.categoryText, token);
    const body = includesToken(entry.bodyText, token);
    const pageTitle = includesToken(entry.pageTitle, token);

    return score
      + (title ? 10 : 0)
      + (tags ? 6 : 0)
      + (category ? 4 : 0)
      + (body ? 1 : 0)
      + (pageTitle && (title || tags || body) ? 2 : 0);
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

function expandDocsResults(
  scored: Array<{ entry: DocsSearchEntry; score: number }>,
  limit: number,
  tokens: string[],
) {
  const selected: DocsSearchEntry[] = [];
  const seen = new Set<string>();
  const add = (entry: DocsSearchEntry) => {
    if (seen.has(entry.href) || selected.length >= limit) return;
    seen.add(entry.href);
    selected.push(entry);
  };

  for (const item of scored) {
    add(item.entry);
    if (selected.length >= limit) break;

    if (isStrongDocsMatch(item.entry, tokens)) {
      const pagePrefix = item.entry.href.split('#')[0];
      const siblingEntries = scored
        .map((candidate) => candidate.entry)
        .filter((candidate) => candidate.href.split('#')[0] === pagePrefix);
      for (const sibling of siblingEntries) {
        add(sibling);
        if (selected.length >= limit) break;
      }
    }
  }

  return selected;
}

function isStrongDocsMatch(entry: DocsSearchEntry, tokens: string[]) {
  return tokens.some((token) =>
    includesToken(entry.pageTitle, token) ||
    includesToken(entry.titleText, token) ||
    includesToken(entry.tagText, token),
  );
}

function scoreRouteEntry(entry: AIRouteEntry, tokens: string[]) {
  const text = [
    entry.label,
    entry.href,
    entry.module,
    entry.description,
    entry.tags.join(' '),
  ].join(' ');

  return tokens.reduce((score, token) => {
    const label = includesToken(entry.label, token);
    const module = includesToken(entry.module, token);
    const tags = entry.tags.some((tag) => includesToken(tag, token));
    const body = includesToken(text, token);
    return score + (label ? 10 : 0) + (tags ? 6 : 0) + (module ? 4 : 0) + (body ? 1 : 0);
  }, 0);
}

function scoreFlowEntry(entry: AIFlowSearchEntry, tokens: string[]) {
  const tokenScore = tokens.reduce((score, token) => {
    const title = includesToken(entry.title, token);
    const tags = includesToken(entry.tagText, token);
    const category = includesToken(entry.category, token);
    const route = includesToken(entry.routeText, token);
    const body = includesToken(entry.bodyText, token);

    return score
      + (title ? 12 : 0)
      + (tags ? 7 : 0)
      + (category ? 4 : 0)
      + (route ? 3 : 0)
      + (body ? 1 : 0);
  }, 0);
  const fuzzyScore = fuzzySearchScore(tokens.join(' '), [
    entry.title,
    entry.summary,
    entry.category,
    entry.tagText,
    entry.routeText,
    entry.bodyText,
  ]);
  return tokenScore + fuzzyScore / 20;
}

function buildSnippet(body: string, fallback: string, tokens: string[]) {
  const source = body || fallback;
  const normalized = normalize(source);
  const token = tokens.find((item) => normalized.includes(item));
  if (!token) return fallback.slice(0, 220);

  const index = normalized.indexOf(token);
  const start = Math.max(0, index - 70);
  const end = Math.min(source.length, index + token.length + 130);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < source.length ? '...' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function buildDetails(body: string, tokens: string[], query: string) {
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 24);
  const matching = sentences.filter((sentence) =>
    tokens.some((token) => includesToken(sentence, token)),
  );
  const selected = matching.length ? matching : sentences;
  const prioritized = isWorkflowQuery(query)
    ? [...selected].sort((a, b) => detailPriority(b) - detailPriority(a))
    : selected;
  return prioritized.slice(0, 10).map((sentence) => sentence.slice(0, 420));
}

function isWorkflowQuery(query: string) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return ['how', 'step', 'steps', 'flow', 'workflow', 'process', 'click', 'button', 'add', 'create', 'enroll', 'manage', 'where'].some((token) => tokens.includes(token));
}

function detailPriority(value: string) {
  const normalized = normalize(value);
  const actionScore = ['open', 'click', 'fill', 'save', 'find', 'choose', 'select', 'use', 'search', 'review', 'confirm', 'return'].some((token) => normalized.includes(token)) ? 3 : 0;
  const prerequisiteScore = ['prerequisite', 'permission', 'before'].some((token) => normalized.includes(token)) ? 2 : 0;
  const warningScore = ['warning', 'do not', 'cannot'].some((token) => normalized.includes(token)) ? 1 : 0;
  return actionScore + prerequisiteScore + warningScore;
}

function resolveRouteHref(entry: AIRouteEntry, userId?: string | null): AIRouteEntry | null {
  if (!entry.href.includes('{userId}')) return entry;
  if (!userId) return null;

  return {
    ...entry,
    href: entry.href.replace('{userId}', encodeURIComponent(userId)),
  };
}
