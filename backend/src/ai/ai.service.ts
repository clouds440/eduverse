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
        'Only suggest questions answerable from available EduVerse backend tools: schedules, courses, sections, enrollment, academic cycles, attendance, grades, deadlines, evaluations, finance summaries, organization health, AI usage, docs, routes, mail/entity search, and visible performance profiles.',
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
      plannedToolRequests.length
      ? normalizePlannedTools(plannedToolRequests, dto.prompt)
      : selectRelevantTools(dto.prompt, user.role ?? undefined),
      dto.prompt,
    );
    const results: AIProviderMessage[] = [];

    for (const request of toolRequests) {
      const result = await this.toolRegistry.runTool(
        request.name,
        request.input,
        toolContext,
      );
      results.push({
        role: 'tool',
        name: request.name,
        content: JSON.stringify({
          tool: request.name,
          input: request.input,
          result,
        }),
      });
    }

    return results;
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

  if (mentionsAny(text, ['today', 'tomorrow', 'week', 'schedule', 'class', 'teach next', 'study plan', 'planner'])) {
    if (text.includes('tomorrow')) add('getMyTomorrowSchedule', {});
    else if (mentionsAny(text, ['week', 'weekly'])) add('getMyWeeklySchedule', {});
    else if (mentionsAny(text, ['next class', 'teach next', 'what do i teach next'])) add('getNextClass', {});
    else add('getMyTodaySchedule', {});
  }

  if (mentionsAny(text, ['deadline', 'assignment', 'quiz', 'exam', 'due'])) {
    add('getPendingDeadlines', { limit: 10, days: 21 });
  }

  if (mentionsAny(text, ['grading', 'grade', 'marks', 'pending'])) {
    add(role === 'STUDENT' || role === 'GUARDIAN' ? 'getStudentPerformanceProfile' : 'getPendingGrading', input);
  }

  if (mentionsAny(text, ['enrollment', 'enrolled', 'highest enrollment', 'most enrolled', 'largest courses', 'popular courses'])) {
    add('getCourseEnrollmentRanking', { search: prompt, limit: 10 });
  }

  if (mentionsAny(text, ['attendance', 'absent', 'late', 'risk'])) {
    add(role === 'STUDENT' || role === 'GUARDIAN' ? 'getStudentPerformanceProfile' : 'getAttendanceRisk', input);
  }

  if (mentionsAny(text, ['weakest', 'weak course', 'study plan', 'performing', 'performance', 'improve', 'improvement', 'need attention', 'struggling'])) {
    add('searchAcademicEntities', input);
    if (role === 'STUDENT' || role === 'GUARDIAN') add('getStudentPerformanceProfile', input);
    if (role === 'TEACHER') {
      add('getTeacherPerformanceProfile', input);
      add('getStudentsNeedingAttention', input);
    }
    if (role === 'ORG_ADMIN' || role === 'SUB_ADMIN' || role === 'ORG_MANAGER') {
      if (mentionsAny(text, ['teacher', 'instructor', 'faculty'])) add('getTeacherPerformanceProfile', input);
      if (mentionsAny(text, ['course', 'class', 'subject'])) add('getCoursePerformanceProfile', input);
      if (mentionsAny(text, ['student', 'learner'])) add('getStudentPerformanceProfile', input);
      if (mentionsAny(text, ['department'])) add('getDepartmentPerformanceProfile', input);
      if (!mentionsAny(text, ['teacher', 'instructor', 'faculty', 'course', 'class', 'subject', 'student', 'learner', 'department'])) {
        add('getOrganizationHealthProfile', input);
      }
    }
  }

  if (mentionsAny(text, ['workload', 'overloaded', 'bottleneck', 'staffing', 'room'])) {
    add('getTeacherScheduleLoad', input);
    add('getScheduleBottlenecks', input);
    if (role === 'ORG_ADMIN' || role === 'SUB_ADMIN' || role === 'ORG_MANAGER') add('getOrganizationHealthProfile', input);
  }

  if (mentionsAny(text, ['organization health', 'org health', 'academic activity', 'summary', 'trend', 'departments need attention'])) {
    add('getOrganizationHealthProfile', input);
  }

  if (mentionsAny(text, ['where', 'open', 'navigate', 'page', 'screen'])) {
    add('searchRoutes', { search: prompt, limit: 5 });
  }

  if (mentionsAny(text, ['how do i', 'help', 'docs', 'guide'])) {
    add('searchDocs', { search: prompt, limit: 5 });
  }

  return requests.slice(0, 6);
}

function withEntityResolution(
  requests: SelectedToolRequest[],
  prompt: string,
): SelectedToolRequest[] {
  const entities = entityKindsFromPrompt(prompt);
  if (!entities.length) return requests.slice(0, 6);
  if (requests.some((request) => request.name === 'resolveEduVerseEntities')) {
    return requests.slice(0, 6);
  }

  return [
    {
      name: 'resolveEduVerseEntities',
      input: { search: prompt, entities, limit: 6 },
    },
    ...requests,
  ].slice(0, 6);
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
  if (mentionsAny(text, ['teacher', 'faculty', 'instructor'])) add('teacher');
  if (mentionsAny(text, ['department', 'dept'])) add('department');
  if (mentionsAny(text, ['mail', 'message', 'thread', 'ticket'])) add('mail');

  return entities;
}

function mentionsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function normalizePlannedTools(
  requests: AIProviderToolRequest[],
  prompt: string,
): SelectedToolRequest[] {
  return requests.slice(0, 6).map((request) => ({
    name: request.name,
    input: {
      search: prompt,
      limit: 8,
      ...(request.input ?? {}),
    },
  }));
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
    'Prefer backend tools for facts about schedules, courses, sections, attendance, grades, finance, evaluations, docs, routes, AI credits, and organization usage.',
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
