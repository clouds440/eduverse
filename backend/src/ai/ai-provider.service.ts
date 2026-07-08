import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import type {
  AIProviderAdapter,
  AIProviderChatInput,
  AIProviderChatOutput,
  AIProviderMessage,
  AIProviderToolRequest,
} from './ai.types';

@Injectable()
export class AILangChainProviderAdapter implements AIProviderAdapter {
  async chat(input: AIProviderChatInput): Promise<AIProviderChatOutput> {
    const model = this.createModel();
    const response = await model.invoke(toLangChainMessages(input));
    const content = stringifyModelContent(response.content);
    const providerTokenEstimate =
      tokenUsageFromResponse(response) ??
      this.estimateProviderTokens({
        ...input,
        messages: [...input.messages, { role: 'assistant', content }],
      });

    return {
      content,
      providerName: this.getProviderName(),
      model: this.modelName(),
      providerTokenEstimate,
      creditEstimate: this.estimateCreditsFromTokens(providerTokenEstimate),
      toolCalls: input.messages
        .filter((message) => message.role === 'tool')
        .map((message) => ({
          name: message.name ?? 'unknownTool',
          input: parseToolEnvelope(message.content)?.input,
        })),
    };
  }

  async *stream(
    input: AIProviderChatInput,
  ): AsyncIterable<AIProviderChatOutput> {
    const output = await this.chat(input);
    yield output;
  }

  async planTools(
    input: AIProviderChatInput,
  ): Promise<AIProviderToolRequest[]> {
    if (!input.tools.length) return [];

    const model = this.createModel({ temperature: 0 });
    const knownTools = new Set(input.tools.map((tool) => tool.name));
    const prompt = [
      'Plan EduVerse read-only tools. JSON only: [{"name":"tool","input":{...}}].',
      'Use [] if no EduVerse facts are needed. Use only listed tool names.',
      'Resolve named/ambiguous entities first. For compound requests, choose all independent context tools needed.',
      'Prefer generic tools: resolveEduVerseEntities, getAcademicPerformanceProfile, getScheduleContext, getOperationsContext, searchDocs, searchRoutes, AI usage tools.',
      'Use structured inputs when useful: search, targetType, date, startDate, endDate, include, includeLoad, includeBottlenecks, limit.',
      'If recent context lists an internal request key already used, do not request the same tool with the same effective input again unless the user asks for refreshed data or changes the target/date/scope.',
      '',
      'Available tools:',
      ...input.tools.map((tool) => `- ${tool.name}: ${trimForPlanner(tool.description, 180)}`),
      '',
      `Role: ${String(input.metadata?.role ?? 'unknown')}`,
      '',
      'Recent:',
      ...input.messages
        .filter((message) => message.role !== 'tool')
        .slice(-5)
        .map((message) => `${message.role}: ${trimForPlanner(message.content, 700)}`),
    ].join('\n');
    const response = await model.invoke([new HumanMessage(prompt)]);
    const parsed = parseToolPlanJson(stringifyModelContent(response.content));

    return parsed.filter((request) => knownTools.has(request.name)).slice(0, 8);
  }

  estimateProviderTokens(input: AIProviderChatInput | string) {
    const text =
      typeof input === 'string'
        ? input
        : buildOpenRouterPrompt(input);

    return Math.ceil(text.length / 4);
  }

  estimateCredits(input: AIProviderChatInput | string) {
    return Math.max(1, Math.ceil(this.estimateProviderTokens(input) / 1000));
  }

  getProviderName() {
    return 'openrouter';
  }

  private createModel(options: { temperature?: number } = {}) {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new Error('AI_API_KEY is required for EduVerse Copilot.');
    }
    const model = this.modelName();

    return new ChatOpenAI({
      apiKey,
      model,
      temperature:
        options.temperature ?? Number(process.env.AI_TEMPERATURE ?? 0.2),
      maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
      configuration: {
        baseURL: process.env.AI_API_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
        defaultHeaders: openRouterHeaders(),
      },
    });
  }

  private modelName(): string {
    const model = process.env.AI_MODEL?.trim();
    if (!model) {
      throw new Error('AI_MODEL is required for EduVerse Copilot.');
    }
    return model;
  }

  private estimateCreditsFromTokens(providerTokens: number) {
    return Math.max(1, Math.ceil(Math.max(0, providerTokens) / 1000));
  }
}

@Injectable()
export class AIProviderService implements AIProviderAdapter {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly adapter: AIProviderAdapter;

  constructor(private readonly langChainAdapter: AILangChainProviderAdapter) {
    this.adapter = this.langChainAdapter;
    this.logger.log(`AI provider selected: ${this.adapter.getProviderName()}`);
  }

  async chat(input: AIProviderChatInput) {
    return this.adapter.chat(input);
  }

  async *stream(input: AIProviderChatInput) {
    for await (const output of this.adapter.stream(input)) {
      yield output;
    }
  }

  async planTools(input: AIProviderChatInput) {
    try {
      return await (this.adapter.planTools?.(input) ?? Promise.resolve([]));
    } catch (error) {
      this.logger.warn(
        `AI tool planner failed; using deterministic tool routing: ${errorMessage(error)}`,
      );
      return [];
    }
  }

  estimateProviderTokens(input: AIProviderChatInput | string) {
    return this.adapter.estimateProviderTokens(input);
  }

  estimateCredits(input: AIProviderChatInput | string) {
    return this.adapter.estimateCredits(input);
  }

  getProviderName() {
    return this.adapter.getProviderName();
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown provider error';
}

function toLangChainMessages(input: AIProviderChatInput) {
  return [new HumanMessage(buildOpenRouterPrompt(input))];
}

function buildOpenRouterPrompt(input: AIProviderChatInput) {
  const transcript = input.messages
    .map((message) => {
      if (message.role === 'tool') {
        return [
          'EduVerse backend context:',
          normalizeMessageContent(message.content),
        ].join('\n');
      }
      return `${message.role.toUpperCase()}: ${normalizeMessageContent(message.content)}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return [
    input.systemPrompt,
    '',
    'EduVerse backend context is authoritative. Do not mention tools, tool names, backend functions, or retrieval steps. Answer directly when intent and data are sufficient. Ask a brief natural follow-up only when ambiguity blocks a useful answer.',
    '',
    'Context:',
    transcript || 'USER: Please answer using the available EduVerse context.',
  ].join('\n');
}

function trimForPlanner(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function normalizeMessageContent(content: unknown) {
  if (typeof content === 'string') return content.trim();
  if (content == null) return '';
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function stringifyModelContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return content == null ? '' : String(content);
}

function tokenUsageFromResponse(response: unknown) {
  const value = response as {
    usage_metadata?: {
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    };
    response_metadata?: {
      tokenUsage?: {
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      };
    };
  };
  return (
    value.usage_metadata?.total_tokens ??
    value.response_metadata?.tokenUsage?.totalTokens ??
    sumOptional(
      value.usage_metadata?.input_tokens,
      value.usage_metadata?.output_tokens,
    ) ??
    sumOptional(
      value.response_metadata?.tokenUsage?.promptTokens,
      value.response_metadata?.tokenUsage?.completionTokens,
    )
  );
}

function sumOptional(a?: number, b?: number) {
  if (typeof a !== 'number' && typeof b !== 'number') return undefined;
  return (a ?? 0) + (b ?? 0);
}

function openRouterHeaders() {
  const headers: Record<string, string> = {};
  const appUrl = process.env.AI_APP_URL?.trim() || process.env.FRONTEND_URL?.split(',')[0]?.trim();
  const appName = process.env.AI_APP_NAME?.trim() || 'EduVerse';
  if (appUrl) headers['HTTP-Referer'] = appUrl;
  if (appName) headers['X-OpenRouter-Title'] = appName;
  return headers;
}

function parseToolPlanJson(content: string): AIProviderToolRequest[] {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return [];
    const requests: AIProviderToolRequest[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const name = typeof entry.name === 'string' ? entry.name : null;
      if (!name) continue;
      const input =
        entry.input &&
        typeof entry.input === 'object' &&
        !Array.isArray(entry.input)
          ? (entry.input as Record<string, unknown>)
          : {};
      requests.push({ name, input });
    }
    return requests;
  } catch {
    return [];
  }
}

function parseToolEnvelope(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
