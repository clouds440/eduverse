import { Injectable, OnModuleInit } from '@nestjs/common';
import { Role } from '@/prisma/prisma-client';
import { buildAIDocsSearchEntries, type AIDocsSearchEntry } from './ai-docs.source';
import { aiRouteEntries, type AIRouteEntry } from './ai-routes.source';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext } from './ai.types';

export interface AIDocsSearchResult {
  title: string;
  section: string;
  snippet: string;
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

@Injectable()
export class AIKnowledgeService implements OnModuleInit {
  private readonly docsEntries = buildAIDocsSearchEntries();

  constructor(private readonly toolRegistry: AIToolRegistryService) {}

  onModuleInit() {
    this.toolRegistry.register({
      name: 'searchDocs',
      description: 'Search EduVerse product documentation and return compact docs links.',
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
  }

  searchDocs(query: string, limit = 5): AIDocsSearchResult[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];

    return this.docsEntries
      .map((entry) => ({
        entry,
        score: scoreDocsEntry(entry, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.pageTitle.localeCompare(b.entry.pageTitle))
      .slice(0, clampLimit(limit))
      .map(({ entry }) => ({
        title: entry.pageTitle,
        section: entry.sectionTitle,
        snippet: buildSnippet(entry.bodyText, entry.fallbackSnippet, tokens),
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
}

function parseSearchInput(input: unknown) {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const query = typeof value.query === 'string' ? value.query.trim() : '';
  const limit = typeof value.limit === 'number'
    ? value.limit
    : typeof value.limit === 'string'
      ? Number(value.limit)
      : undefined;

  return { query, limit };
}

function clampLimit(limit?: number) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(10, Math.max(1, Math.round(parsed)));
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
  return normalize(query).split(/\s+/).filter((token) => token.length >= 2);
}

function includesToken(value: string, token: string) {
  return normalize(value).includes(token);
}

function scoreDocsEntry(entry: AIDocsSearchEntry, tokens: string[]) {
  return tokens.reduce((score, token) => {
    const title = includesToken(entry.titleText, token) || includesToken(entry.pageTitle, token);
    const tags = includesToken(entry.tagText, token);
    const category = includesToken(entry.categoryText, token);
    const body = includesToken(entry.bodyText, token);

    return score + (title ? 10 : 0) + (tags ? 6 : 0) + (category ? 4 : 0) + (body ? 1 : 0);
  }, 0);
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

function resolveRouteHref(entry: AIRouteEntry, userId?: string | null): AIRouteEntry | null {
  if (!entry.href.includes('{userId}')) return entry;
  if (!userId) return null;

  return {
    ...entry,
    href: entry.href.replace('{userId}', encodeURIComponent(userId)),
  };
}
