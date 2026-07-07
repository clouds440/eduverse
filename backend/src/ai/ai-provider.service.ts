import { Injectable, Logger } from '@nestjs/common';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import type {
  AIProviderAdapter,
  AIProviderChatInput,
  AIProviderChatOutput,
  AIProviderMessage,
  AIProviderToolRequest,
} from './ai.types';

type AIProviderName = 'local' | 'langchain';

@Injectable()
export class AILocalProviderAdapter implements AIProviderAdapter {
  async chat(input: AIProviderChatInput): Promise<AIProviderChatOutput> {
    const prompt = latestUserMessage(input) ?? '';
    const toolMessages = input.messages.filter((message) => message.role === 'tool');
    const toolNames = input.tools.map((tool) => `\`${tool.name}\``).slice(0, 12).join(', ');
    const content = toolMessages.length
      ? buildLocalToolBackedAnswer(prompt, toolMessages)
      : [
          'I am EduVerse AI Copilot running in local provider mode.',
          '',
          'The provider abstraction is ready, but no external LangChain model is configured yet.',
          prompt ? `You asked: ${prompt}` : null,
          toolNames ? `Available backend tools include: ${toolNames}.` : null,
          '',
          'Configure a LangChain adapter/provider to generate full Copilot answers.',
        ].filter(Boolean).join('\n');

    const providerTokenEstimate = this.estimateProviderTokens({ ...input, messages: [...input.messages, { role: 'assistant', content }] });

    return {
      content,
      providerName: this.getProviderName(),
      model: 'local-deterministic',
      providerTokenEstimate,
      creditEstimate: this.estimateCredits(content),
      toolCalls: toolMessages.map((message) => ({
        name: message.name ?? 'unknownTool',
        input: parseToolEnvelope(message.content)?.input,
      })),
    };
  }

  async *stream(input: AIProviderChatInput): AsyncIterable<AIProviderChatOutput> {
    yield await this.chat(input);
  }

  estimateProviderTokens(input: AIProviderChatInput | string) {
    const text = typeof input === 'string'
      ? input
      : [
          input.systemPrompt,
          ...input.messages.map((message) => `${message.role}: ${message.content}`),
          ...input.tools.map((tool) => `${tool.name}: ${tool.description}`),
        ].join('\n');

    return Math.ceil(text.length / 4);
  }

  estimateCredits(input: AIProviderChatInput | string) {
    return Math.max(1, Math.ceil(this.estimateProviderTokens(input) / 1000));
  }

  getProviderName() {
    return 'local';
  }
}

@Injectable()
export class AILangChainProviderAdapter implements AIProviderAdapter {
  private readonly fallback = new AILocalProviderAdapter();

  async chat(input: AIProviderChatInput): Promise<AIProviderChatOutput> {
    const model = this.createModel();
    const response = await model.invoke(toLangChainMessages(input));
    const content = stringifyModelContent(response.content);
    const providerTokenEstimate = tokenUsageFromResponse(response)
      ?? this.estimateProviderTokens({ ...input, messages: [...input.messages, { role: 'assistant', content }] });

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

  async *stream(input: AIProviderChatInput): AsyncIterable<AIProviderChatOutput> {
    const model = this.createModel();
    let content = '';
    let providerTokenEstimate = this.estimateProviderTokens(input);

    for await (const chunk of await model.stream(toLangChainMessages(input))) {
      const delta = stringifyModelContent(chunk.content);
      if (!delta) continue;
      content += delta;
      providerTokenEstimate = this.estimateProviderTokens({ ...input, messages: [...input.messages, { role: 'assistant', content }] });
      yield {
        content: delta,
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
  }

  async planTools(input: AIProviderChatInput): Promise<AIProviderToolRequest[]> {
    if (!input.tools.length) return [];

    const model = this.createModel({ temperature: 0 });
    const knownTools = new Set(input.tools.map((tool) => tool.name));
    const prompt = [
      'You are the EduVerse Copilot backend tool planner.',
      'Choose up to 6 backend tools that should run before answering the user.',
      'Return only valid JSON. No markdown. No commentary.',
      'JSON shape: [{"name":"toolName","input":{"search":"original user question","limit":8}}]',
      'Use only available tool names. Use an empty array if no tool is needed.',
      '',
      'Available tools:',
      ...input.tools.map((tool) => `- ${tool.name}: ${tool.description}`),
      '',
      `Current role: ${String(input.metadata?.role ?? 'unknown')}`,
      '',
      'Recent conversation and user request:',
      ...input.messages
        .filter((message) => message.role !== 'tool')
        .slice(-8)
        .map((message) => `${message.role}: ${message.content}`),
    ].join('\n');
    const response = await model.invoke([new HumanMessage(prompt)]);
    const parsed = parseToolPlanJson(stringifyModelContent(response.content));

    return parsed
      .filter((request) => knownTools.has(request.name))
      .slice(0, 6);
  }

  estimateProviderTokens(input: AIProviderChatInput | string) {
    return this.fallback.estimateProviderTokens(input);
  }

  estimateCredits(input: AIProviderChatInput | string) {
    return this.fallback.estimateCredits(input);
  }

  getProviderName() {
    return 'langchain';
  }

  private createModel(options: { temperature?: number } = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=langchain.');
    }

    return new ChatOpenAI({
      apiKey,
      model: this.modelName(),
      temperature: options.temperature ?? Number(process.env.OPENAI_TEMPERATURE ?? 0.2),
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 2),
    });
  }

  private modelName() {
    return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  private estimateCreditsFromTokens(providerTokens: number) {
    return Math.max(1, Math.ceil(Math.max(0, providerTokens) / 1000));
  }
}

@Injectable()
export class AIProviderService implements AIProviderAdapter {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly adapter: AIProviderAdapter;
  private readonly allowLocalFallback = process.env.AI_PROVIDER_ALLOW_LOCAL_FALLBACK !== 'false';

  constructor(
    private readonly localAdapter: AILocalProviderAdapter,
    private readonly langChainAdapter: AILangChainProviderAdapter,
  ) {
    const provider = this.resolveProviderName();
    this.adapter = provider === 'langchain' ? this.langChainAdapter : this.localAdapter;
    this.logger.log(`AI provider selected: ${this.adapter.getProviderName()}`);
  }

  async chat(input: AIProviderChatInput) {
    try {
      return await this.adapter.chat(input);
    } catch (error) {
      if (!this.canFallbackToLocal()) throw error;
      this.logger.warn(`AI provider failed; falling back to local provider: ${errorMessage(error)}`);
      return this.localAdapter.chat(input);
    }
  }

  async *stream(input: AIProviderChatInput) {
    try {
      for await (const output of this.adapter.stream(input)) {
        yield output;
      }
    } catch (error) {
      if (!this.canFallbackToLocal()) throw error;
      this.logger.warn(`AI stream provider failed; falling back to local provider: ${errorMessage(error)}`);
      for await (const output of this.localAdapter.stream(input)) {
        yield output;
      }
    }
  }

  async planTools(input: AIProviderChatInput) {
    try {
      return await (this.adapter.planTools?.(input) ?? Promise.resolve([]));
    } catch (error) {
      if (this.canFallbackToLocal()) {
        this.logger.warn(`AI tool planner failed; using deterministic tool routing: ${errorMessage(error)}`);
        return [];
      }
      throw error;
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

  private resolveProviderName(): AIProviderName {
    const raw = (process.env.AI_PROVIDER ?? 'local').toLowerCase();
    if (raw === 'langchain') return 'langchain';
    return 'local';
  }

  private canFallbackToLocal() {
    return this.allowLocalFallback && this.adapter !== this.localAdapter;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown provider error';
}

function latestUserMessage(input: AIProviderChatInput) {
  return [...input.messages].reverse().find((message) => message.role === 'user')?.content;
}

function toLangChainMessages(input: AIProviderChatInput) {
  return [
    new SystemMessage([
      input.systemPrompt,
      '',
      'Use the backend tool result messages as authoritative context.',
      'If tool context is missing, say what you can and cannot determine.',
      'Do not invent EduVerse records, prices, grades, schedules, or permissions.',
    ].join('\n')),
    ...input.messages.map((message) => toLangChainMessage(message)),
  ];
}

function toLangChainMessage(message: AIProviderMessage) {
  if (message.role === 'assistant') return new AIMessage(message.content);
  if (message.role === 'system') return new SystemMessage(message.content);
  if (message.role === 'tool') {
    return new HumanMessage([
      `Backend tool result${message.name ? ` from ${message.name}` : ''}:`,
      message.content,
    ].join('\n'));
  }
  return new HumanMessage(message.content);
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
    usage_metadata?: { total_tokens?: number; input_tokens?: number; output_tokens?: number };
    response_metadata?: { tokenUsage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number } };
  };
  return value.usage_metadata?.total_tokens
    ?? value.response_metadata?.tokenUsage?.totalTokens
    ?? sumOptional(value.usage_metadata?.input_tokens, value.usage_metadata?.output_tokens)
    ?? sumOptional(value.response_metadata?.tokenUsage?.promptTokens, value.response_metadata?.tokenUsage?.completionTokens);
}

function sumOptional(a?: number, b?: number) {
  if (typeof a !== 'number' && typeof b !== 'number') return undefined;
  return (a ?? 0) + (b ?? 0);
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
      const input = entry.input && typeof entry.input === 'object' && !Array.isArray(entry.input)
        ? entry.input as Record<string, unknown>
        : {};
      requests.push({ name, input });
    }
    return requests;
  } catch {
    return [];
  }
}

function buildLocalToolBackedAnswer(prompt: string, toolMessages: Array<{ name?: string; content: string }>) {
  const envelopes = toolMessages
    .map((message) => parseToolEnvelope(message.content) ?? { tool: message.name, result: null })
    .filter((envelope) => envelope.result);
  const successful = envelopes.filter((envelope) => envelope.result?.ok);
  const failed = envelopes.filter((envelope) => envelope.result && !envelope.result.ok);

  return [
    'I found relevant EduVerse context for this question.',
    prompt ? `\n**Question**\n${prompt}` : null,
    successful.length ? [
      '\n**What I found**',
      ...successful.slice(0, 5).map((envelope) => `- ${humanizeToolName(envelope.tool)}: ${summarizeData(envelope.result.data)}`),
    ].join('\n') : null,
    failed.length ? [
      '\n**Unavailable Context**',
      ...failed.map((envelope) => `- ${humanizeToolName(envelope.tool)}: ${envelope.result.code ?? 'UNAVAILABLE'}${envelope.result.message ? ` - ${envelope.result.message}` : ''}`),
    ].join('\n') : null,
    '\n**Recommended Next Step**',
    bestRecommendation(successful) ?? 'Review the linked EduVerse records and use the strongest risk signals first: attendance, missing work, low grade averages, workload, and evaluation trend.',
    '\nConfigure a full LangChain model to turn this structured context into a richer natural-language Copilot answer.',
  ].filter(Boolean).join('\n');
}

function parseToolEnvelope(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function humanizeToolName(name?: string) {
  return (name ?? 'Tool')
    .replace(/^get/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeData(data: unknown): string {
  if (!data || typeof data !== 'object') return 'No records returned.';
  const value = data as Record<string, any>;

  if (Array.isArray(value.recommendations) && value.recommendations.length) {
    return value.recommendations.slice(0, 2).join(' ');
  }
  if (value.academicSignals) {
    return summarizeRecord(value.academicSignals);
  }
  if (value.students && Array.isArray(value.students)) {
    return `${value.students.length} student signal${value.students.length === 1 ? '' : 's'} returned.`;
  }
  if (value.teachers && Array.isArray(value.teachers)) {
    return `${value.teachers.length} teacher result${value.teachers.length === 1 ? '' : 's'} returned.`;
  }
  if (value.courses && Array.isArray(value.courses)) {
    return `${value.courses.length} course result${value.courses.length === 1 ? '' : 's'} returned.`;
  }
  if (value.deadlines && Array.isArray(value.deadlines)) {
    return `${value.deadlines.length} deadline${value.deadlines.length === 1 ? '' : 's'} returned.`;
  }
  if (value.schedules && Array.isArray(value.schedules)) {
    return `${value.schedules.length} schedule item${value.schedules.length === 1 ? '' : 's'} returned.`;
  }
  return summarizeRecord(value);
}

function summarizeRecord(value: Record<string, any>) {
  return Object.entries(value)
    .filter(([, entry]) => entry !== null && entry !== undefined && typeof entry !== 'object')
    .slice(0, 6)
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(', ') || 'Structured context returned.';
}

function bestRecommendation(envelopes: any[]) {
  for (const envelope of envelopes) {
    const recommendations = envelope.result?.data?.recommendations;
    if (Array.isArray(recommendations) && recommendations.length) {
      return recommendations[0];
    }
  }
  return null;
}
