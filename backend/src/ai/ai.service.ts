import { ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '@/prisma/prisma-client';
import { AIConversationService, shouldReuseLastUserMessage } from './ai-conversation.service';
import { AICreditService } from './ai-credit.service';
import { AIEntitlementService } from './ai-entitlement.service';
import { AIProviderService } from './ai-provider.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIChatRequestDto } from './dto/ai-chat.dto';
import type {
  AIEntitlementSource,
  AIProviderChatInput,
  AIProviderChatOutput,
  AIProviderMessage,
  AIProviderToolRequest,
  AIStreamEvent,
} from './ai.types';

@Injectable()
export class AIService {
  constructor(
    private readonly conversationService: AIConversationService,
    private readonly creditService: AICreditService,
    private readonly entitlementService: AIEntitlementService,
    private readonly providerService: AIProviderService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  async chat(user: User, dto: AIChatRequestDto) {
    const prepared = await this.prepareChat(user, dto);
    let shouldPersistAssistantError = prepared.reusedLastUserMessage;
    if (!prepared.reusedLastUserMessage) {
      await this.conversationService.appendUserMessage(
        prepared.conversation.id,
        dto.prompt,
      );
      shouldPersistAssistantError = true;
    }

    try {
      const output = await this.providerService.chat(prepared.providerInput);
      return this.finalizeProviderOutput(user, prepared, output);
    } catch (error) {
      if (shouldPersistAssistantError) {
        await this.persistAssistantError(prepared.conversation.id, error);
      }
      throw error;
    }
  }

  async *streamChat(user: User, dto: AIChatRequestDto): AsyncIterable<AIStreamEvent> {
    yield { type: 'status', label: 'Opening EduVerse context' };
    const prepared = await this.prepareChat(user, dto);
    let shouldPersistAssistantError = prepared.reusedLastUserMessage;
    if (!prepared.reusedLastUserMessage) {
      await this.conversationService.appendUserMessage(
        prepared.conversation.id,
        dto.prompt,
      );
      shouldPersistAssistantError = true;
    }

    yield {
      type: 'conversation',
      conversationId: prepared.conversation.id,
      title: prepared.conversation.title,
    };
    yield { type: 'status', label: 'Writing inside EduVerse' };

    let lastOutput: AIProviderChatOutput | null = null;
    let content = '';

    try {
      for await (const output of this.providerService.stream(prepared.providerInput)) {
        lastOutput = output;
        const chunks = chunkStreamContent(output.content);
        for (const chunk of chunks) {
          content += chunk;
          yield { type: 'delta', content: chunk };
        }
      }

      if (!lastOutput) {
        lastOutput = await this.providerService.chat(prepared.providerInput);
        for (const chunk of chunkStreamContent(lastOutput.content)) {
          content += chunk;
          yield { type: 'delta', content: chunk };
        }
      }

      const response = await this.finalizeProviderOutput(user, prepared, {
        ...lastOutput,
        content: content || lastOutput.content,
      });

      yield {
        type: 'complete',
        response,
      };
    } catch (error) {
      if (shouldPersistAssistantError) {
        await this.persistAssistantError(prepared.conversation.id, error);
      }
      throw error;
    }
  }

  listConversations(user: User) {
    return this.conversationService.listConversations({
      id: user.id,
      organizationId: user.organizationId,
    });
  }

  getConversation(user: User, conversationId: string) {
    return this.conversationService.getConversation(
      {
        id: user.id,
        organizationId: user.organizationId,
      },
      conversationId,
    );
  }

  updateConversationTitle(user: User, conversationId: string, title: string) {
    return this.conversationService.updateConversationTitle(
      {
        id: user.id,
        organizationId: user.organizationId,
      },
      conversationId,
      title,
    );
  }

  deleteConversation(user: User, conversationId: string) {
    return this.conversationService.deleteConversation(
      {
        id: user.id,
        organizationId: user.organizationId,
      },
      conversationId,
    );
  }

  async generateSuggestedQuestions(user: User) {
    const input = this.buildSuggestionInput(user);
    const credits = this.providerService.estimateCredits(input);
    const entitlement = await this.entitlementService.resolveEntitlement(
      {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        status: user.status,
      },
      credits,
    );

    if (!entitlement.allowed) {
      throw new ForbiddenException({
        code: entitlement.code,
        message: entitlement.message,
      });
    }

    const output = await this.providerService.chat(input);
    await this.creditService.recordUsage({
      source: entitlement.source,
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      credits: output.creditEstimate,
      providerTokenEstimate: output.providerTokenEstimate,
      estimatedCost: estimateProviderCost(output),
    });

    return {
      suggestions: parseSuggestedQuestions(output.content),
      provider: {
        name: output.providerName,
        model: output.model,
      },
      usage: {
        creditEstimate: output.creditEstimate,
        providerTokenEstimate: output.providerTokenEstimate,
        sourceType: entitlement.source.sourceType,
        remainingCreditsBeforeRequest: entitlement.source.balance.remainingCredits,
      },
    };
  }

  private async prepareChat(user: User, dto: AIChatRequestDto) {
    const estimatedInput = this.buildProviderInput(user, dto);
    const estimatedCredits = this.providerService.estimateCredits(estimatedInput);
    const entitlement = await this.entitlementService.resolveEntitlement(
      {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        status: user.status,
      },
      estimatedCredits,
    );

    if (!entitlement.allowed) {
      throw new ForbiddenException({
        code: entitlement.code,
        message: entitlement.message,
      });
    }

    const conversation = await this.conversationService.getOrCreateConversation(
      {
        id: user.id,
        organizationId: user.organizationId,
      },
      dto.conversationId,
      entitlement.source.subscription.id,
    );
    const context = await this.conversationService.getContextMessages(
      conversation.id,
    );
    const reusedLastUserMessage = shouldReuseLastUserMessage(
      context.messages,
      dto.prompt,
      dto.retryLastUserMessage,
    );
    const toolMessages = await this.collectRelevantToolContext(
      user,
      dto,
      context.messages,
      entitlement.source,
    );
    const providerInput = this.buildProviderInput(
      user,
      dto,
      context.messages,
      toolMessages,
      reusedLastUserMessage,
    );
    const finalCredits = this.providerService.estimateCredits(providerInput);
    const finalEntitlement = await this.entitlementService.resolveEntitlement(
      {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role,
        status: user.status,
      },
      finalCredits,
    );

    if (!finalEntitlement.allowed) {
      throw new ForbiddenException({
        code: finalEntitlement.code,
        message: finalEntitlement.message,
      });
    }

    return {
      conversation,
      prompt: dto.prompt,
      providerInput,
      entitlementSource: finalEntitlement.source,
      reusedLastUserMessage,
    };
  }

  buildProviderInput(
    user: User,
    dto: AIChatRequestDto,
    contextMessages: AIProviderMessage[] = [],
    toolMessages: AIProviderMessage[] = [],
    omitCurrentPrompt = false,
  ): AIProviderChatInput {
    return {
      systemPrompt: buildSystemPrompt(user),
      messages: [
        ...contextMessages,
        ...(omitCurrentPrompt ? [] : [{ role: 'user' as const, content: dto.prompt }]),
        ...toolMessages,
      ],
      tools: this.toolRegistry.listTools(),
      metadata: {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    };
  }

  private buildSuggestionInput(user: User): AIProviderChatInput {
    return {
      systemPrompt: [
        buildSystemPrompt(user),
        '',
        'Return exactly 3 role-aware suggested questions as JSON only: [{"label":"2-4 words","prompt":"question"}].',
        'Questions must be answerable by EduVerse read-only tools: schedules, courses, attendance, grades, deadlines, performance, operations, finance, usage, docs, routes, mail/entity search. No mutation actions.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: 'Generate my EduVerse Copilot suggested questions.',
        },
      ],
      tools: [],
      metadata: {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    };
  }

  private async collectRelevantToolContext(
    user: User,
    dto: AIChatRequestDto,
    contextMessages: AIProviderMessage[],
    entitlementSource: AIEntitlementSource,
  ): Promise<AIProviderMessage[]> {
    const toolContext = {
      userId: user.id,
      orgId: user.organizationId ?? '',
      role: user.role,
      subscriptionId: entitlementSource.subscription.id,
      sourceType: entitlementSource.sourceType,
    };
    const planningInput = this.buildProviderInput(user, dto, contextMessages);
    const plannedToolRequests = await this.providerService.planTools(planningInput).catch(() => []);
    const toolRequests = withEntityResolution(
      mergeToolRequests([
        ...selectRelevantTools(dto.prompt, user.role ?? undefined),
        ...normalizePlannedTools(plannedToolRequests, dto.prompt),
      ]),
      dto.prompt,
    );
    const results = await this.toolRegistry.runTools(toolRequests, toolContext);

    if (!results.length) return [];

    return [{
      role: 'tool',
      name: 'eduverseToolResults',
      content: JSON.stringify({
        instruction: 'EduVerse tool results. IDs/links removed. Use successful data first; if ambiguous, ask one concise clarifying question.',
        results: compactToolResultsForModel(results),
      }),
    }];
  }

  private async finalizeProviderOutput(
    user: User,
    prepared: {
      conversation: { id: string; title?: string | null };
      prompt: string;
      entitlementSource: AIEntitlementSource;
    },
    output: AIProviderChatOutput,
  ) {
    await this.creditService.recordUsage({
      source: prepared.entitlementSource,
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      credits: output.creditEstimate,
      providerTokenEstimate: output.providerTokenEstimate,
      estimatedCost: estimateProviderCost(output),
    });

    await this.conversationService.appendAssistantMessage(
      prepared.conversation.id,
      output.content,
      {
        providerName: output.providerName,
        model: output.model,
        creditEstimate: output.creditEstimate,
        providerTokenEstimate: output.providerTokenEstimate,
        toolCalls: output.toolCalls ?? [],
      },
    );

    const title = prepared.conversation.title
      ?? await this.conversationService.touchConversationTitle(
        prepared.conversation.id,
        prepared.prompt,
      );

    return {
      conversationId: prepared.conversation.id,
      title,
      message: {
        role: 'assistant' as const,
        content: output.content,
      },
      provider: {
        name: output.providerName,
        model: output.model,
      },
      usage: {
        creditEstimate: output.creditEstimate,
        providerTokenEstimate: output.providerTokenEstimate,
        sourceType: prepared.entitlementSource.sourceType,
        remainingCreditsBeforeRequest: prepared.entitlementSource.balance.remainingCredits,
      },
      toolCalls: output.toolCalls ?? [],
    };
  }

  private async persistAssistantError(conversationId: string, error: unknown) {
    const message = assistantErrorMessage(error);
    await this.conversationService.appendAssistantMessage(
      conversationId,
      message,
      {
        error: true,
        providerName: this.providerService.getProviderName(),
        errorCode: errorCode(error),
      },
    );
  }
}

function assistantErrorMessage(error: unknown) {
  const message = errorMessage(error);
  return [
    'I could not complete that request.',
    '',
    message,
  ].join('\n');
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: unknown }).response;
    if (typeof response === 'object' && response && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'EduVerse Copilot hit an unexpected issue while generating the reply.';
}

function errorCode(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: unknown }).response;
    if (typeof response === 'object' && response && 'code' in response) {
      const code = (response as { code?: unknown }).code;
      if (typeof code === 'string') return code;
    }
  }

  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }

  return 'AI_RESPONSE_ERROR';
}

function chunkStreamContent(content: string) {
  const normalized = content || '';
  if (normalized.length <= 120) return normalized ? [normalized] : [];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const next = Math.min(normalized.length, cursor + 80);
    const boundary = normalized.lastIndexOf(' ', next);
    const end = boundary > cursor + 30 ? boundary + 1 : next;
    chunks.push(normalized.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

function sanitizeToolResultsForModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeToolResultsForModel);
  if (!value || typeof value !== 'object') return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isInternalIdentifierKey(key)) continue;
    if (key === 'href' || key === 'url' || key === 'actionUrl') continue;
    sanitized[key] = sanitizeToolResultsForModel(child);
  }
  return sanitized;
}

function compactToolResultsForModel(
  results: Array<{ tool: string; input?: Record<string, unknown>; result: unknown }>,
) {
  return results.map((entry) => {
    const result = entry.result && typeof entry.result === 'object'
      ? entry.result as Record<string, unknown>
      : {};
    const ok = result.ok === true;
    const compact: Record<string, unknown> = {
      tool: entry.tool,
      ok,
    };
    if (typeof result.code === 'string') compact.code = result.code;
    if (typeof result.message === 'string') compact.message = trimForModel(result.message, 220);
    const input = compactToolInput(entry.input ?? {});
    if (Object.keys(input).length) compact.input = input;
    if (ok && 'data' in result) compact.data = compactModelValue(result.data, 0);
    return compact;
  });
}

function compactToolInput(input: Record<string, unknown>) {
  const allowed = ['search', 'targetType', 'date', 'startDate', 'endDate', 'include', 'limit', 'days', 'range', 'includeLoad', 'includeBottlenecks'];
  return Object.fromEntries(
    allowed
      .filter((key) => key in input && !isInternalIdentifierKey(key))
      .map((key) => [key, compactModelValue(input[key], 1)]),
  );
}

function compactModelValue(value: unknown, depth: number): unknown {
  const sanitized = sanitizeToolResultsForModel(value);
  return compactSanitizedValue(sanitized, depth);
}

function compactSanitizedValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return trimForModel(value, depth > 2 ? 180 : 420);
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    const limit = depth === 0 ? 10 : depth === 1 ? 8 : 5;
    return value.slice(0, limit).map((item) => compactSanitizedValue(item, depth + 1));
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined && child !== null)
    .filter(([, child]) => !(Array.isArray(child) && child.length === 0));
  const objectLimit = depth > 2 ? 18 : 32;
  return Object.fromEntries(
    entries
      .slice(0, objectLimit)
      .map(([key, child]) => [key, compactSanitizedValue(child, depth + 1)]),
  );
}

function trimForModel(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function isInternalIdentifierKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized === 'id'
    || normalized === 'ids'
    || normalized === 'tool_call_id'
    || /(^|_)(id|ids)$/i.test(key)
    || /(Id|Ids|ID|IDs)$/.test(key);
}

interface SelectedToolRequest {
  name: string;
  input: Record<string, unknown>;
}

function selectRelevantTools(prompt: string, role?: string): SelectedToolRequest[] {
  const text = prompt.toLowerCase();
  const input = { search: prompt, limit: 8 };
  const explicitDate = extractExplicitDate(prompt);
  const requests: SelectedToolRequest[] = [];
  const add = (name: string, toolInput: Record<string, unknown> = input) => {
    if (!requests.some((request) => request.name === name)) {
      requests.push({ name, input: toolInput });
    }
  };

  if (mentionsAny(text, ['credit', 'quota', 'usage', 'cost', 'subscription', 'plan'])) {
    add('getAICreditStatus', {});
    if (role === 'ORG_ADMIN') add('getAIUsageSummary', {});
  }

  if (mentionsAny(text, ['today', 'tomorrow', 'week', 'schedule', 'timetable', 'class', 'teach next', 'study plan', 'planner'])) {
    const date = explicitDate
      ?? (text.includes('tomorrow') ? relativeIsoDate(1) : undefined)
      ?? (text.includes('today') ? relativeIsoDate(0) : undefined);
    add('getScheduleContext', {
      search: prompt,
      limit: 30,
      ...(date ? { date } : {}),
      ...(!date && mentionsAny(text, ['week', 'weekly']) ? weekRangeInput() : {}),
      includeLoad: mentionsAny(text, ['teacher', 'teach', 'load', 'workload', 'overloaded']),
      includeBottlenecks: mentionsAny(text, ['bottleneck', 'overloaded', 'room', 'staffing']),
    });
  }

  if (mentionsAny(text, ['deadline', 'assignment', 'quiz', 'exam', 'due'])) {
    add('getPendingDeadlines', { limit: 10, days: 21 });
  }

  if (mentionsAny(text, ['grading', 'grade', 'marks', 'pending'])) {
    if (role === 'STUDENT' || role === 'GUARDIAN') add('getAcademicPerformanceProfile', { ...input, targetType: 'student' });
    else add('getPendingGrading', input);
  }

  if (mentionsAny(text, ['enrollment', 'enrolled', 'enroll ', 'enroll a', 'enroll this', 'course load', 'too much', 'overload'])) {
    if (mentionsAny(text, ['highest enrollment', 'most enrolled', 'largest courses', 'popular courses'])) {
      add('getCourseEnrollmentRanking', { search: prompt, limit: 10 });
    } else {
      add('getAcademicPerformanceProfile', { ...input, targetType: 'student' });
      add('getAcademicPerformanceProfile', { ...input, targetType: 'course' });
      add('getScheduleContext', { ...input, includeLoad: true });
    }
  }

  if (mentionsAny(text, ['attendance', 'absent', 'late', 'risk'])) {
    if (role === 'STUDENT' || role === 'GUARDIAN') add('getAcademicPerformanceProfile', { ...input, targetType: 'student' });
    else add('getAttendanceRisk', input);
  }

  if (mentionsAny(text, ['weakest', 'weak course', 'study plan', 'performing', 'performance', 'improve', 'improvement', 'need attention', 'struggling', 'review'])) {
    if (role === 'STUDENT' || role === 'GUARDIAN') add('getAcademicPerformanceProfile', { ...input, targetType: 'student' });
    if (role === 'TEACHER') {
      add('getAcademicPerformanceProfile', { ...input, targetType: 'teacher' });
      add('getStudentsNeedingAttention', input);
    }
    if (role === 'ORG_ADMIN' || role === 'SUB_ADMIN' || role === 'ORG_MANAGER') {
      if (mentionsAny(text, ['teacher', 'instructor', 'faculty', 'manager', 'staff'])) add('getAcademicPerformanceProfile', { ...input, targetType: 'teacher' });
      if (mentionsAny(text, ['course', 'class', 'subject'])) add('getAcademicPerformanceProfile', { ...input, targetType: 'course' });
      if (mentionsAny(text, ['student', 'learner'])) add('getAcademicPerformanceProfile', { ...input, targetType: 'student' });
      if (mentionsAny(text, ['department'])) add('getAcademicPerformanceProfile', { ...input, targetType: 'department' });
      if (!mentionsAny(text, ['teacher', 'instructor', 'faculty', 'manager', 'staff', 'course', 'class', 'subject', 'student', 'learner', 'department'])) {
        add('getAcademicPerformanceProfile', { ...input, targetType: 'organization' });
      }
    }
  }

  if ((role === 'STUDENT' || role === 'GUARDIAN') && mentionsAny(text, ['study plan', 'study schedule', 'revision plan', 'improve them', 'weak courses'])) {
    add('getAcademicPerformanceProfile', { ...input, targetType: 'student' });
    add('getPendingDeadlines', { limit: 10, days: 21 });
    if (explicitDate) add('getScheduleContext', { date: explicitDate, search: prompt, limit: 30 });
  }

  if (mentionsAny(text, ['workload', 'overloaded', 'bottleneck', 'staffing'])) {
    add('getScheduleContext', { ...input, includeLoad: true, includeBottlenecks: true });
    if (role === 'ORG_ADMIN' || role === 'SUB_ADMIN' || role === 'ORG_MANAGER') add('getAcademicPerformanceProfile', { ...input, targetType: 'organization' });
  }

  if (mentionsAny(text, ['calendar', 'event', 'holiday', 'closure', 'break', 'academic calendar', 'important date'])) {
    add('getOperationsContext', { ...input, include: ['calendar'] });
  }

  if (mentionsAny(text, ['room', 'building', 'campus', 'location', 'where is', 'directions', 'capacity', 'lab', 'classroom'])) {
    add('getOperationsContext', { ...input, include: ['campus'] });
    if (mentionsAny(text, ['bottleneck', 'overbooked', 'occupied', 'availability', 'used', 'usage'])) add('getScheduleContext', { ...input, includeBottlenecks: true });
  }

  if (mentionsAny(text, ['announcement', 'notice', 'announcements', 'news', 'update'])) {
    add('getOperationsContext', { ...input, include: ['announcements'] });
  }

  if (mentionsAny(text, ['poll', 'preference', 'course choice', 'section choice', 'selection window', 'choose course', 'choose section'])) {
    add('getOperationsContext', { ...input, include: ['preferences'] });
  }

  if (mentionsAny(text, ['organization health', 'org health', 'academic activity', 'summary', 'trend', 'departments need attention'])) {
    add('getAcademicPerformanceProfile', { ...input, targetType: 'organization' });
  }

  if (mentionsAny(text, ['where', 'open', 'navigate', 'page', 'screen'])) {
    add('searchRoutes', { search: prompt, limit: 5 });
  }

  if (mentionsAny(text, ['how do i', 'help', 'docs', 'guide'])) {
    add('searchDocs', { search: prompt, limit: 5 });
  }

  return requests.slice(0, 8);
}

function withEntityResolution(
  requests: SelectedToolRequest[],
  prompt: string,
): SelectedToolRequest[] {
  const entities = entityKindsFromPrompt(prompt);
  if (!entities.length) return requests.slice(0, 8);
  if (requests.some((request) => request.name === 'resolveEduVerseEntities')) {
    return requests.slice(0, 8);
  }

  return [
    {
      name: 'resolveEduVerseEntities',
      input: { search: prompt, entities, limit: 6 },
    },
    ...requests,
  ].slice(0, 8);
}

function entityKindsFromPrompt(prompt: string) {
  const text = prompt.toLowerCase();
  const entities: string[] = [];
  const add = (entity: string) => {
    if (!entities.includes(entity)) entities.push(entity);
  };

  if (mentionsAny(text, ['semester', 'term', 'academic cycle', 'cycle'])) add('academicCycle');
  if (mentionsAny(text, ['course', 'subject', 'class', 'enroll', 'enrollment', 'course load', 'too much'])) add('course');
  if (mentionsAny(text, ['section', 'class'])) add('section');
  if (mentionsAny(text, ['student', 'learner', 'roll number', 'registration'])) add('student');
  if (mentionsAny(text, ['teacher', 'faculty', 'instructor', 'manager', 'staff'])) add('teacher');
  if (mentionsAny(text, ['department', 'dept'])) add('department');
  if (mentionsAny(text, ['mail', 'message', 'thread', 'ticket'])) add('mail');

  return entities;
}

function mentionsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function mergeToolRequests(requests: SelectedToolRequest[]): SelectedToolRequest[] {
  const merged: SelectedToolRequest[] = [];
  for (const request of requests) {
    const input = {
      ...(request.input ?? {}),
    };
    const key = `${request.name}:${JSON.stringify(input)}`;
    if (merged.some((candidate) => `${candidate.name}:${JSON.stringify(candidate.input ?? {})}` === key)) continue;
    merged.push({ name: request.name, input });
  }
  return merged.slice(0, 8);
}

function normalizePlannedTools(
  requests: AIProviderToolRequest[],
  prompt: string,
): SelectedToolRequest[] {
  return requests.slice(0, 8).map((request) => ({
    name: request.name,
    input: {
      search: prompt,
      limit: 8,
      ...(request.input ?? {}),
    },
  }));
}

function relativeIsoDate(offsetDays: number, now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function weekRangeInput(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function extractExplicitDate(prompt: string, now = new Date()) {
  const text = prompt.trim();
  const iso = text.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthPattern = monthNames.join('|');
  const daySuffix = '(?:st|nd|rd|th)?';
  const dayMonth = new RegExp(`\\b([0-3]?\\d)${daySuffix}\\s+(?:of\\s+)?(${monthPattern})(?:\\s+(20\\d{2}))?\\b`, 'i');
  const monthDay = new RegExp(`\\b(${monthPattern})\\s+([0-3]?\\d)${daySuffix}(?:,?\\s+(20\\d{2}))?\\b`, 'i');
  const match = text.match(dayMonth) ?? text.match(monthDay);
  if (!match) return null;

  const monthFirst = monthNames.includes(match[1].toLowerCase());
  const monthName = monthFirst ? match[1] : match[2];
  const day = Number(monthFirst ? match[2] : match[1]);
  const rawYear = monthFirst ? match[3] : match[3];
  let year = rawYear ? Number(rawYear) : now.getUTCFullYear();
  const month = monthNames.indexOf(monthName.toLowerCase()) + 1;
  if (!isValidDatePart(year, month, day)) return null;

  if (!rawYear) {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (candidate.getTime() < today.getTime()) year += 1;
  }

  return isoDate(year, month, day);
}

function isValidDatePart(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day;
}

function isoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function estimateProviderCost(output: AIProviderChatOutput) {
  const costPerThousandTokens = Number(process.env.AI_COST_PER_1K_TOKENS ?? 0);
  if (!Number.isFinite(costPerThousandTokens) || costPerThousandTokens <= 0) return 0;
  return (output.providerTokenEstimate / 1000) * costPerThousandTokens;
}

function buildSystemPrompt(user: User) {
  const role = user.role ?? 'USER';
  return [
    'You are EduVerse Copilot. Use "I". Be concise, practical, and markdown-friendly.',
    'Use only EduVerse tool data, conversation context, and visible user info. Never reveal internal IDs, UUIDs, database fields, or raw route IDs.',
    'For EduVerse facts, rely on tool results. If data is missing, partial, denied, or ambiguous: say what is known, name what is missing, or ask one concise clarifying question. Do not invent records.',
    'For compound requests, combine relevant tool results into one answer. For code, use fenced blocks with language labels.',
    `Role: ${role}. Focus: ${roleFocus(role)}.`,
    `User: ${JSON.stringify({
      name: user.name ?? null,
      email: user.email,
      status: user.status,
    })}.`,
  ].join('\n');
}

function roleFocus(role: string) {
  if (role === 'STUDENT') {
    return 'study planning, schedule, deadlines, attendance, courses, grades';
  }
  if (role === 'TEACHER') {
    return 'classes, schedule, grading, attendance, prep, workload';
  }
  if (role === 'ORG_MANAGER') {
    return 'academic activity, workload, staffing, attendance, evaluations, bottlenecks';
  }
  if (role === 'ORG_ADMIN') {
    return 'organization health, AI usage, costs, subscriptions, role access, configuration';
  }
  return 'role-scoped EduVerse help';
}

function parseSuggestedQuestions(content: string) {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const label = typeof item.label === 'string' ? item.label.trim() : '';
        const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
        if (!label || !prompt) return null;
        return {
          id: `suggestion-${index + 1}`,
          label: label.slice(0, 48),
          prompt: prompt.slice(0, 240),
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}
