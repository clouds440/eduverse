import { ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '@/prisma/prisma-client';
import { AIConversationService } from './ai-conversation.service';
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
    await this.conversationService.appendUserMessage(
      prepared.conversation.id,
      dto.prompt,
    );
    const output = await this.providerService.chat(prepared.providerInput);
    return this.finalizeProviderOutput(user, prepared, output);
  }

  async *streamChat(user: User, dto: AIChatRequestDto): AsyncIterable<AIStreamEvent> {
    yield { type: 'status', label: 'Thinking...' };
    const prepared = await this.prepareChat(user, dto);
    await this.conversationService.appendUserMessage(
      prepared.conversation.id,
      dto.prompt,
    );

    yield {
      type: 'conversation',
      conversationId: prepared.conversation.id,
      title: prepared.conversation.title,
    };
    yield { type: 'status', label: 'Generating response...' };

    let lastOutput: AIProviderChatOutput | null = null;
    let content = '';

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
    const toolMessages = await this.collectRelevantToolContext(
      user,
      dto,
      context.messages,
      entitlement.source,
    );
    const providerInput = this.buildProviderInput(user, dto, context.messages, toolMessages);
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
    };
  }

  buildProviderInput(
    user: User,
    dto: AIChatRequestDto,
    contextMessages: AIProviderMessage[] = [],
    toolMessages: AIProviderMessage[] = [],
  ): AIProviderChatInput {
    return {
      systemPrompt: buildSystemPrompt(user),
      messages: [
        ...contextMessages,
        { role: 'user', content: dto.prompt },
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
        'Generate suggested questions for this user before they start a Copilot conversation.',
        'Return only valid JSON. No markdown. No commentary.',
        'JSON shape: [{"label":"2 to 4 words","prompt":"a natural question the user can ask"}]',
        'Create exactly 3 useful, role-aware questions.',
        'Only suggest questions answerable from available EduVerse backend tools: schedules, courses, sections, enrollment, academic cycles, calendar events, holidays, campus rooms/buildings, announcements, preference windows, attendance, grades, deadlines, evaluations, finance summaries, organization health, AI usage, docs, routes, mail/entity search, and visible performance profiles.',
        'Do not suggest actions that mutate data, send messages, create records, approve payments, edit settings, or require data outside the user permissions.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: 'Generate my EduVerse AI Copilot suggested questions.',
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
        instruction: 'Each item below is a separate EduVerse tool result. Use the most specific successful result first. If an entity or tool result is ambiguous, ask one concise clarifying question.',
        results,
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

  if (mentionsAny(text, ['enrollment', 'enrolled', 'highest enrollment', 'most enrolled', 'largest courses', 'popular courses'])) {
    add('getCourseEnrollmentRanking', { search: prompt, limit: 10 });
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
  if (mentionsAny(text, ['course', 'subject', 'class'])) add('course');
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
    'You are EduVerse AI Copilot, a role-aware productivity assistant for a school management system.',
    'You are not a generic chatbot. Help users act inside EduVerse with concise, practical, markdown responses.',
    'Never claim access to data that was not provided by backend tools or conversation context.',
    'Respect existing EduVerse permissions. Personal AI subscriptions never expand data access.',
    'Prefer backend tools for facts about schedules, courses, sections, attendance, grades, finance, evaluations, docs, routes, AI credits, organization usage, calendar events, announcements, preference windows, rooms, buildings, and campus locations.',
    'For compound requests, synthesize all relevant tool results into one coherent answer. Example: weak courses plus a dated study plan should combine performance data, deadlines, exact-day schedule, free slots, and course-specific improvement actions.',
    'When a prompt names or implies an EduVerse entity, use entity resolver results to identify the exact record before relying on other tools.',
    'If entity resolver results are ambiguous, ask one concise clarifying question instead of guessing.',
    'When tool results indicate failure, explain the failure plainly using the tool result code and message.',
    `Current user role: ${role}.`,
    `Current user general info: ${JSON.stringify({
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId ?? null,
    })}.`,
    roleGuidance(role),
  ].join('\n');
}

function roleGuidance(role: string) {
  if (role === 'STUDENT') {
    return 'Student mode: act as a study coach, schedule-aware planner, deadline assistant, attendance advisor, and course guide.';
  }
  if (role === 'TEACHER') {
    return 'Teacher mode: help with morning briefings, next class preparation, weekly schedule overview, grading workload, and attendance reminders.';
  }
  if (role === 'ORG_MANAGER') {
    return 'Manager mode: summarize academic activity, workload, staffing concerns, attendance trends, evaluation trends, and schedule bottlenecks.';
  }
  if (role === 'ORG_ADMIN') {
    return 'Org admin mode: help with organization health, AI usage, AI costs, subscription management, and feature configuration.';
  }
  return 'Use the user role to keep answers scoped, operational, and permission-aware.';
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
