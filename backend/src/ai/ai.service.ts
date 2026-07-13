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
  AIResponseAction,
  AIResponseSource,
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
    yield { type: 'status', label: 'Getting context' };
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
    yield { type: 'status', label: 'Generating response' };

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
    const requestPolicy = classifyCopilotRequest(dto.prompt, user.role ?? undefined);
    const estimatedInput = this.buildProviderInput(user, dto, [], [], false, {
      requestKind: requestPolicy.kind,
    });
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
    const isChatStart = !context.title && !hasUserVisibleMessages(context.messages);
    const toolContextResult = await this.collectRelevantToolContext(
      user,
      dto,
      context.messages,
      entitlement.source,
      isChatStart,
      requestPolicy,
    );
    const conversationTitle = !conversation.title && toolContextResult.title
      ? await this.conversationService.setConversationTitle(conversation.id, toolContextResult.title)
      : conversation.title;
    const preparedConversation = {
      ...conversation,
      title: conversationTitle,
    };
    const providerContextMessages = conversationTitle && context.title !== conversationTitle
      ? [
          {
            role: 'system' as const,
            content: `Conversation title: ${conversationTitle}`,
          },
          ...context.messages,
        ]
      : context.messages;
    const reusedPrompt = shouldReuseLastUserMessage(
      providerContextMessages,
      dto.prompt,
      dto.retryLastUserMessage,
    );
    const providerInput = this.buildProviderInput(
      user,
      dto,
      providerContextMessages,
      toolContextResult.messages,
      reusedPrompt,
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
      conversation: preparedConversation,
      prompt: dto.prompt,
      providerInput,
      entitlementSource: finalEntitlement.source,
      reusedLastUserMessage,
      toolCalls: toolContextResult.toolCalls,
      requestPolicy,
    };
  }

  buildProviderInput(
    user: User,
    dto: AIChatRequestDto,
    contextMessages: AIProviderMessage[] = [],
    toolMessages: AIProviderMessage[] = [],
    omitCurrentPrompt = false,
    extraMetadata: Record<string, unknown> = {},
  ): AIProviderChatInput {
    const requestKind = typeof extraMetadata.requestKind === 'string'
      ? extraMetadata.requestKind
      : classifyCopilotRequest(dto.prompt, user.role ?? undefined).kind;
    return {
      systemPrompt: buildSystemPrompt(user, requestKind),
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
        requestKind,
        ...extraMetadata,
      },
    };
  }

  private buildSuggestionInput(user: User): AIProviderChatInput {
    return {
      systemPrompt: [
        buildSystemPrompt(user, 'general'),
        '',
        'Return exactly 3 role-aware suggested questions as JSON only: [{"label":"2-4 words","prompt":"question"}].',
        'Questions must be answerable by EduVerse read-only tools: schedules, courses, attendance, grades, deadlines, performance, operations, finance, usage, flows, docs, routes, mail/entity search. No mutation actions.',
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
    isChatStart = false,
    requestPolicy = classifyCopilotRequest(dto.prompt, user.role ?? undefined),
  ): Promise<{
    messages: AIProviderMessage[];
    toolCalls: Array<{ name: string; key: string; input?: Record<string, unknown> }>;
    title?: string | null;
  }> {
    const toolContext = {
      userId: user.id,
      orgId: user.organizationId ?? '',
      role: user.role,
      subscriptionId: entitlementSource.subscription.id,
      sourceType: entitlementSource.sourceType,
    };
    const planningInput = this.buildProviderInput(user, dto, contextMessages, [], false, {
      isChatStart,
      requestKind: requestPolicy.kind,
    });
    const plannedToolPlan = shouldSkipPlanner(requestPolicy)
      ? { requests: [] as AIProviderToolRequest[], title: null }
      : normalizeToolPlan(
        await this.providerService.planTools({
          ...planningInput,
          tools: filterPlannerTools(planningInput.tools, requestPolicy, user.role ?? undefined),
        }).catch(() => ({ requests: [] })),
      );
    const isCapabilityQuestion = isCopilotCapabilityQuery(dto.prompt.toLowerCase());
    const plannedToolRequests = plannedToolPlan.requests;
    const toolRequests = withEntityResolution(
      mergeToolRequests([
        ...selectRelevantTools(dto.prompt, user.role ?? undefined, requestPolicy),
        ...normalizePlannedTools(plannedToolRequests, dto.prompt),
      ]),
      dto.prompt,
    ).filter((request) => !isCapabilityQuestion || request.name !== 'searchDocs');
    const results = await this.toolRegistry.runTools(toolRequests, toolContext);

    const toolCalls = toolRequests.map((request) => ({
      name: request.name,
      key: toolRequestKey(request),
      input: compactToolInput(request.input ?? {}),
    }));

    const capabilityMessage = isCapabilityQuestion
      ? buildCapabilityContextMessage(user.role ?? 'USER')
      : null;

    if (!results.length && !capabilityMessage) {
      return { messages: [], toolCalls, title: plannedToolPlan.title };
    }

    return {
      title: plannedToolPlan.title,
      toolCalls,
      messages: [
        ...(capabilityMessage ? [capabilityMessage] : []),
        ...(results.length ? [{
          role: 'tool' as const,
          name: 'eduverseToolResults',
          content: JSON.stringify({
            instruction: [
              'Backend context for EduVerse Copilot. Internal source names and IDs are removed.',
              'Facts present here are already known; do not ask the user to confirm them.',
              'Known facts are summarized in each context section. Missing facts are explicit; do not invent missing records.',
              'Do not mention tools, tool names, backend functions, or retrieval steps.',
              'Use the data to answer naturally.',
            ].join(' '),
            requestKind: requestPolicy.kind,
            responseContract: requestPolicy.responseContract,
            results: compactToolResultsForModel(results),
          }),
        }] : []),
      ],
    };
  }

  private async finalizeProviderOutput(
    user: User,
    prepared: {
      conversation: { id: string; title?: string | null };
      prompt: string;
      entitlementSource: AIEntitlementSource;
      toolCalls?: Array<{ name: string; key: string; input?: Record<string, unknown> }>;
      requestPolicy?: CopilotRequestPolicy;
    },
    output: AIProviderChatOutput,
  ) {
    const requestPolicy = prepared.requestPolicy ?? classifyCopilotRequest(prepared.prompt, user.role ?? undefined);
    const content = validateAssistantContent(
      output.content,
      prepared.toolCalls ?? [],
      requestPolicy,
    );
    const sources = responseSourcesForToolCalls(prepared.toolCalls ?? [], requestPolicy);
    const relatedActions = relatedActionsForToolCalls(prepared.toolCalls ?? [], requestPolicy);

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
      content,
      {
        providerName: output.providerName,
        model: output.model,
        creditEstimate: output.creditEstimate,
        providerTokenEstimate: output.providerTokenEstimate,
        toolCalls: prepared.toolCalls ?? [],
        requestKind: requestPolicy.kind,
        sources,
        relatedActions,
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
        content,
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
      sources,
      relatedActions,
      requestKind: requestPolicy.kind,
      toolCalls: [],
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

function validateAssistantContent(
  content: string,
  toolCalls: Array<{ name: string; key: string; input?: Record<string, unknown> }>,
  policy: CopilotRequestPolicy,
) {
  let next = sanitizeInternalLeaks(content);
  const hadSuccessfulContext = toolCalls.length > 0;
  if (hadSuccessfulContext && impliesNoContext(next)) {
    next = [
      'I found EduVerse context for this request, but I could not turn it into a confident answer.',
      '',
      'Here is the safest next step: ask me to narrow the result by name, course, section, date, or department, and I will use the available EduVerse records again.',
    ].join('\n');
  }

  if (policy.kind !== 'capability') {
    next = removeUnneededFinalQuestion(next, policy);
  }

  return next.trim() || 'I could not produce a useful EduVerse Copilot response for that request.';
}

function sanitizeInternalLeaks(content: string) {
  let next = content;
  for (const internal of [
    'resolveEduVerseEntities',
    'getEduVerseContext',
    'getAcademicPerformanceProfile',
    'getScheduleContext',
    'getOperationsContext',
    'getCommunicationContext',
    'getPolicyContext',
    'getEntityRelationshipContext',
    'getAcademicPlanningContext',
    'getEnrollmentFeasibilityContext',
    'searchDocs',
    'searchFlows',
    'searchRoutes',
    'backend context',
    'tool call',
    'tool result',
  ]) {
    next = next.replace(new RegExp(internal, 'gi'), 'EduVerse context');
  }
  next = next.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[record]');
  return next;
}

function impliesNoContext(content: string) {
  const normalized = content.toLowerCase();
  return [
    "i don't have access",
    'i do not have access',
    "i don't have enough information",
    'i do not have enough information',
    "i couldn't find any information",
    'i could not find any information',
    'no information available',
  ].some((phrase) => normalized.includes(phrase));
}

function removeUnneededFinalQuestion(content: string, policy: CopilotRequestPolicy) {
  if (['mixed', 'live-data', 'workflow'].includes(policy.kind)) return content;
  const lines = content.trimEnd().split('\n');
  const last = lines[lines.length - 1]?.trim() ?? '';
  if (!last.endsWith('?')) return content;
  if (/^(quick question|question|just to be clear|to clarify)/i.test(last)) return content;
  return lines.slice(0, -1).join('\n').trimEnd();
}

function responseSourcesForToolCalls(
  toolCalls: Array<{ name: string }>,
  policy: CopilotRequestPolicy,
): AIResponseSource[] {
  const sources = new Map<string, AIResponseSource>();
  const add = (label: string, kind: string) => sources.set(kind, { label, kind });
  if (policy.kind === 'capability') add('Role access', 'role');
  for (const call of toolCalls) {
    if (call.name.includes('Docs') || call.name === 'searchDocs' || call.name === 'getPolicyContext') add('Docs', 'docs');
    if (call.name.includes('Flows') || call.name === 'searchFlows') add('Workflow guide', 'flows');
    if (call.name.includes('Routes') || call.name === 'searchRoutes') add('Navigation', 'routes');
    if (call.name.includes('Schedule') || call.name.includes('Class')) add('Schedule', 'schedule');
    if (call.name.includes('Academic') || call.name.includes('Performance') || call.name.includes('Student') || call.name.includes('Teacher') || call.name.includes('Course') || call.name.includes('Section') || call.name.includes('Relationship')) add('Academic records', 'academic');
    if (call.name.includes('Enrollment')) add('Enrollment', 'enrollment');
    if (call.name.includes('Attendance')) add('Attendance', 'attendance');
    if (call.name.includes('Evaluation')) add('Evaluations', 'evaluations');
    if (call.name.includes('Finance')) add('Finance', 'finance');
    if (call.name.includes('Operation') || call.name.includes('Calendar') || call.name.includes('Campus') || call.name.includes('Announcement') || call.name.includes('Preference')) add('Operations', 'operations');
    if (call.name.includes('Communication') || call.name.includes('Mail')) add('Communication', 'communication');
    if (call.name.includes('AI') || call.name.includes('Credit')) add('AI Credits', 'credits');
    if (call.name === 'getEduVerseContext') add('EduVerse context', 'eduverse-context');
  }
  return Array.from(sources.values()).slice(0, 5);
}

function relatedActionsForToolCalls(
  toolCalls: Array<{ name: string }>,
  policy: CopilotRequestPolicy,
): AIResponseAction[] {
  const actions = new Map<string, AIResponseAction>();
  const add = (label: string, href: string) => actions.set(href, { label, href });
  for (const call of toolCalls) {
    if (call.name.includes('Docs') || call.name === 'searchDocs' || call.name === 'getPolicyContext') add('Open Docs', '/docs');
    if (call.name.includes('Routes') || call.name === 'searchRoutes') add('Open Overview', '/overview');
    if (call.name.includes('Schedule')) add('Open Timetable', '/timetable');
    if (call.name.includes('Student')) add('Open Students', '/users/students');
    if (call.name.includes('Teacher')) add('Open Teachers', '/users/teachers');
    if (call.name.includes('Course')) add('Open Courses', '/courses');
    if (call.name.includes('Section')) add('Open Sections', '/sections');
    if (call.name.includes('Enrollment')) add('Open Students', '/users/students');
    if (call.name.includes('Mail') || call.name.includes('Communication')) add('Open Mail', '/mail');
    if (call.name.includes('Credit') || call.name.includes('AI')) add('Open AI Usage', '/ai');
  }
  if (policy.kind === 'credit-status') add('Manage Subscription', '/ai/subscription');
  return Array.from(actions.values()).slice(0, 4);
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
  return results.map((entry, index) => {
    const result = entry.result && typeof entry.result === 'object'
      ? entry.result as Record<string, unknown>
      : {};
    const ok = result.ok === true;
    const compact: Record<string, unknown> = {
      source: `context_${index + 1}`,
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
  const allowed = ['intent', 'search', 'targetType', 'date', 'startDate', 'endDate', 'include', 'entities', 'limit', 'days', 'range', 'includeLoad', 'includeBottlenecks'];
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

const MAX_TOOL_REQUESTS = 10;

type CopilotRequestKind =
  | 'capability'
  | 'workflow'
  | 'live-data'
  | 'mixed'
  | 'credit-status'
  | 'off-topic'
  | 'general';

interface CopilotRequestPolicy {
  kind: CopilotRequestKind;
  responseContract: string;
  skipPlanner: boolean;
  preferredTools: string[];
}

function toolRequestKey(request: SelectedToolRequest) {
  return `${request.name}:${JSON.stringify(compactToolInput(request.input ?? {}))}`;
}

function selectRelevantTools(
  prompt: string,
  role?: string,
  policy = classifyCopilotRequest(prompt, role),
): SelectedToolRequest[] {
  const text = prompt.toLowerCase();
  const input = { search: prompt, limit: 8 };
  const explicitDate = extractExplicitDate(prompt);
  const requests: SelectedToolRequest[] = [];
  const add = (name: string, toolInput: Record<string, unknown> = input) => {
    const request = { name, input: toolInput };
    if (!requests.some((candidate) => toolRequestKey(candidate) === toolRequestKey(request))) requests.push(request);
  };

  if (isWorkflowInstructionQuery(text)) {
    add('searchFlows', { search: prompt, limit: 6 });
    add('searchDocs', { search: prompt, limit: 8 });
    add('searchRoutes', { search: prompt, limit: 5 });
  }

  if (policy.kind === 'mixed' || isComplexAcademicPlanningQuery(text)) {
    add('getEduVerseContext', {
      intent: policy.kind,
      search: prompt,
      include: inferEduVerseContextIncludes(text, role),
      limit: 8,
      ...(explicitDate ? { date: explicitDate } : {}),
    });
  }

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
      add('getEnrollmentFeasibilityContext', { search: prompt, limit: 8 });
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
    add('getAcademicPlanningContext', { search: prompt, limit: 8, ...(explicitDate ? { date: explicitDate } : {}) });
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
    add('getEntityRelationshipContext', { search: prompt, limit: 8 });
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
    add('getAcademicPlanningContext', { search: prompt, limit: 8 });
    add('getAcademicPerformanceProfile', { ...input, targetType: 'organization' });
  }

  if (mentionsAny(text, ['where', 'open', 'navigate', 'page', 'screen'])) {
    add('searchRoutes', { search: prompt, limit: 5 });
  }

  if (mentionsAny(text, ['how do i', 'how to', 'help', 'docs', 'guide', 'what is', 'what are', 'explain', 'meaning', 'what does'])) {
    add('searchDocs', { search: prompt, limit: 8 });
  }

  return requests.slice(0, MAX_TOOL_REQUESTS);
}

function withEntityResolution(
  requests: SelectedToolRequest[],
  prompt: string,
): SelectedToolRequest[] {
  const entities = entityKindsFromPrompt(prompt);
  if (!entities.length) return requests.slice(0, MAX_TOOL_REQUESTS);
  if (requests.some((request) => request.name === 'resolveEduVerseEntities')) {
    return requests.slice(0, MAX_TOOL_REQUESTS);
  }

  return [
    {
      name: 'resolveEduVerseEntities',
      input: { search: prompt, entities, limit: 6 },
    },
    ...requests,
  ].slice(0, MAX_TOOL_REQUESTS);
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

function classifyCopilotRequest(prompt: string, role?: string): CopilotRequestPolicy {
  const text = prompt.toLowerCase();
  const workflow = isWorkflowInstructionQuery(text);
  const capability = isCopilotCapabilityQuery(text);
  const credit = mentionsAny(text, ['credit', 'quota', 'usage', 'cost', 'subscription', 'plan', 'top up']);
  const liveData = isLiveDataQuery(text);
  const offTopic = isClearlyOffTopic(text);
  const mixed = !capability && !offTopic && (
    (workflow && liveData)
    || isComplexAcademicPlanningQuery(text)
    || mentionsAny(text, ['should i', 'should we', 'what should', 'how to improve', 'recommend', 'compare'])
  );

  if (capability) {
    return {
      kind: 'capability',
      skipPlanner: true,
      preferredTools: [],
      responseContract: 'Explain what EduVerse Copilot can do for the authenticated role only. Keep it user-facing and do not mention tools, credits, or subscriptions unless asked.',
    };
  }
  if (offTopic) {
    return {
      kind: 'off-topic',
      skipPlanner: true,
      preferredTools: [],
      responseContract: 'Briefly redirect to EduVerse-focused help. Do not answer unrelated factual, entertainment, medical, legal, political, or generic web questions.',
    };
  }
  if (credit && !liveData && !workflow) {
    return {
      kind: 'credit-status',
      skipPlanner: true,
      preferredTools: ['getAICreditStatus', role === 'ORG_ADMIN' ? 'getAIUsageSummary' : ''],
      responseContract: 'Summarize AI Credits, subscription availability, and next action. Do not discuss academic records unless asked.',
    };
  }
  if (mixed) {
    return {
      kind: 'mixed',
      skipPlanner: false,
      preferredTools: ['getEduVerseContext', 'getEntityRelationshipContext', 'getAcademicPlanningContext', 'getEnrollmentFeasibilityContext', 'resolveEduVerseEntities', 'getAcademicPerformanceProfile', 'getScheduleContext', 'searchFlows', 'searchDocs', 'searchRoutes'],
      responseContract: 'Combine workflow guidance and live EduVerse data. Separate known facts, recommendation, and next steps. Ask at most one question only if a required choice is missing.',
    };
  }
  if (workflow) {
    return {
      kind: 'workflow',
      skipPlanner: true,
      preferredTools: ['searchFlows', 'searchDocs', 'searchRoutes', 'getPolicyContext'],
      responseContract: 'Give ordered steps with prerequisites, exact navigation, required fields, warnings, and safe links when available. Do not ask a closing question after the flow is complete.',
    };
  }
  if (liveData) {
    return {
      kind: 'live-data',
      skipPlanner: false,
      preferredTools: ['getEduVerseContext', 'getEntityRelationshipContext', 'getAcademicPlanningContext', 'getEnrollmentFeasibilityContext', 'resolveEduVerseEntities', 'getAcademicPerformanceProfile', 'getScheduleContext', 'getOperationsContext', 'getCommunicationContext'],
      responseContract: 'Use live backend context. Explain empty results precisely: target missing, target found with no child records, permission denied, or partial data.',
    };
  }
  return {
    kind: 'general',
    skipPlanner: false,
    preferredTools: ['searchDocs', 'searchFlows', 'searchRoutes', 'getEduVerseContext'],
    responseContract: 'Answer as EduVerse Copilot using available EduVerse context. If unrelated to EduVerse, redirect briefly.',
  };
}

function shouldSkipPlanner(policy: CopilotRequestPolicy) {
  void policy;
  return false;
}

function filterPlannerTools(
  tools: AIProviderChatInput['tools'],
  policy: CopilotRequestPolicy,
  role?: string,
) {
  if (!policy.preferredTools.length) return tools;
  const preferred = new Set(policy.preferredTools.filter(Boolean));
  const roleAllowsAdmin = role === 'ORG_ADMIN';
  return tools.filter((tool) => {
    if (!preferred.has(tool.name)) return false;
    if (!roleAllowsAdmin && ['getAIUsageSummary', 'getAIRoleAccessPolicy'].includes(tool.name)) return false;
    return true;
  });
}

function isLiveDataQuery(value: string) {
  return mentionsAny(value, [
    'today',
    'tomorrow',
    'week',
    'schedule',
    'timetable',
    'class',
    'course',
    'section',
    'student',
    'teacher',
    'manager',
    'department',
    'attendance',
    'grade',
    'grading',
    'deadline',
    'assignment',
    'exam',
    'quiz',
    'enrollment',
    'enrolled',
    'performance',
    'weak',
    'risk',
    'room',
    'building',
    'announcement',
    'mail',
    'message',
    'finance',
    'fee',
    'evaluation',
    'cohort',
    'semester',
    'academic cycle',
  ]);
}

function isComplexAcademicPlanningQuery(value: string) {
  return mentionsAny(value, [
    'study plan',
    'improve them',
    'weak courses',
    'course load',
    'too much',
    'free time',
    'around my schedule',
    'according to my schedule',
    'what should i study',
    'should i enroll',
    'should we enroll',
    'students need attention',
    'how to improve',
  ]);
}

function inferEduVerseContextIncludes(value: string, role?: string) {
  const include = new Set<string>(['entities']);
  if (mentionsAny(value, ['how do i', 'how to', 'workflow', 'process', 'steps', 'where', 'open', 'click'])) include.add('knowledge');
  if (mentionsAny(value, ['policy', 'rule', 'gpa', 'attendance rule', 'grading rule', 'restriction'])) include.add('policy');
  if (mentionsAny(value, ['schedule', 'timetable', 'today', 'tomorrow', 'week', 'free time', 'class'])) include.add('schedule');
  if (mentionsAny(value, ['course', 'section', 'student', 'teacher', 'grade', 'attendance', 'deadline', 'performance', 'weak', 'enroll'])) include.add('academic');
  if (mentionsAny(value, ['connected', 'relationship', 'assigned', 'taking', 'teaching', 'belongs to'])) include.add('relationships');
  if (mentionsAny(value, ['study plan', 'plan', 'priority', 'workload', 'weak', 'improve', 'need attention'])) include.add('planning');
  if (mentionsAny(value, ['enroll', 'enrollment', 'course load', 'too much', 'feasible', 'fit'])) include.add('enrollment');
  if (mentionsAny(value, ['room', 'building', 'announcement', 'calendar', 'event', 'holiday', 'poll', 'preference'])) include.add('operations');
  if (mentionsAny(value, ['mail', 'message', 'communication'])) include.add('communication');
  if (mentionsAny(value, ['finance', 'fee', 'payment', 'salary']) || role === 'FINANCE_MANAGER') include.add('finance');
  return Array.from(include);
}

function isClearlyOffTopic(value: string) {
  if (isLiveDataQuery(value) || isWorkflowInstructionQuery(value) || isCopilotCapabilityQuery(value)) return false;
  return mentionsAny(value, [
    'write a poem',
    'movie recommendation',
    'weather',
    'stock price',
    'crypto',
    'medical advice',
    'legal advice',
    'politics',
    'recipe',
    'dating advice',
    'tell me a joke',
  ]);
}

function isWorkflowInstructionQuery(value: string) {
  return mentionsAny(value, [
    'how do i',
    'how to',
    'steps',
    'step by step',
    'flow',
    'workflow',
    'process',
    'click',
    'button',
    'add ',
    'create',
    'edit',
    'update',
    'delete',
    'remove',
    'enroll',
    'withdraw',
    'transfer',
    'assign',
    'setup',
    'set up',
    'configure',
    'manage',
    'import',
    'export',
    'publish',
    'send',
    'finalize',
    'record attendance',
    'mark attendance',
    'grade',
    'pay ',
  ]);
}

function isCopilotCapabilityQuery(value: string) {
  return mentionsAny(value, [
    'what can you do',
    'what do you do',
    'how can you help',
    'what can copilot do',
    'copilot capabilities',
    'ai capabilities',
    'what can ai do',
    'what are your features',
    'your capabilities',
  ]);
}

function hasUserVisibleMessages(messages: AIProviderMessage[]) {
  return messages.some((message) => message.role === 'user' || message.role === 'assistant');
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
  return merged.slice(0, MAX_TOOL_REQUESTS);
}

function normalizePlannedTools(
  requests: AIProviderToolRequest[],
  prompt: string,
): SelectedToolRequest[] {
  return requests.slice(0, MAX_TOOL_REQUESTS).map((request) => ({
    name: request.name,
    input: {
      search: prompt,
      limit: 8,
      ...(request.input ?? {}),
    },
  }));
}

function normalizeToolPlan(value: unknown) {
  if (Array.isArray(value)) return { requests: value as AIProviderToolRequest[] };
  if (!value || typeof value !== 'object') return { requests: [] as AIProviderToolRequest[] };
  const record = value as {
    title?: unknown;
    requests?: unknown;
    tools?: unknown;
  };
  const requests = Array.isArray(record.requests)
    ? record.requests
    : Array.isArray(record.tools)
      ? record.tools
      : [];
  return {
    title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : null,
    requests: requests as AIProviderToolRequest[],
  };
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

function buildCapabilityContextMessage(role: string): AIProviderMessage {
  return {
    role: 'system',
    content: [
      `Role-scoped EduVerse Copilot capability context for authenticated role ${role}.`,
      'Answer "what can you do" using only these user-facing capabilities.',
      'Do not mention capabilities for other roles.',
      'Do not mention internal tools, backend functions, retrieval, or raw permission names.',
      'Do not lead with credits, subscription, or organization health unless that is central to this role or the user asks about billing/admin controls.',
      `Capabilities: ${roleCapabilities(role)}.`,
    ].join('\n'),
  };
}

function buildSystemPrompt(user: User, requestKind: string) {
  const role = user.role ?? 'USER';
  const policy = classifyCopilotRequest('', role);
  return [
    'You are EduVerse Copilot. Use "I". Be concise, practical, and markdown-friendly.',
    'Use only EduVerse backend context, conversation context, and visible user info. Never reveal internal IDs, UUIDs, database fields, raw route IDs, tool names, backend function names, or retrieval steps.',
    'For EduVerse facts, rely on backend context. Answer directly when the user intent is clear and context is sufficient, even if some optional fields are unavailable.',
    'If asked what you can do, describe user-facing EduVerse help by role. Do not list internal tools. Do not lead with AI credits, subscriptions, or organization health unless the user asks about billing/admin controls.',
    `Capability areas: ${roleCapabilities(role)}.`,
    'For questions unrelated to EduVerse, school operations, study, teaching, administration, or using this product, politely redirect to EduVerse-focused help instead of guessing.',
    'Do not ask the user to confirm facts already present in backend context or conversation context.',
    'Ask a short, natural follow-up only when the missing answer blocks the next required action, such as unclear intent, multiple plausible records, or a required target/date/scope that is absent.',
    'Do not add closing engagement questions after a complete answer. If the request is answered, stop after the useful guidance.',
    'Avoid routine sections titled "Missing Information" or "Clarifying Question". If a question is genuinely required, ask it conversationally in one sentence.',
    'If data is partial but enough to help, state the useful answer and add a brief inline caveat. Do not invent records.',
    'For compound requests, combine relevant tool results into one answer. For code, use fenced blocks with language labels.',
    'For how-to or process questions, combine workflow flows, docs, routes, and live records when available. Give ordered steps with prerequisites, exact navigation/actions, and important warnings. Do not invent UI locations.',
    `Request kind: ${requestKind}. Response contract: ${responseContractForKind(requestKind, policy.responseContract)}.`,
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

function responseContractForKind(kind: string, fallback: string) {
  if (kind === 'capability') return 'Explain role-specific Copilot capabilities only. No internal tools, no other roles, no billing focus unless asked.';
  if (kind === 'workflow') return 'Give exact steps, prerequisites, required fields, warnings, and safe navigation. Stop when complete.';
  if (kind === 'live-data') return 'Use backend context, distinguish missing targets from empty child records, and explain evidence briefly.';
  if (kind === 'mixed') return 'Combine live facts, workflow steps, analysis, recommendation, and next actions in one coherent answer.';
  if (kind === 'credit-status') return 'Summarize credits, subscription source, limits, and the next billing or top-up action.';
  if (kind === 'off-topic') return 'Politely redirect to EduVerse, school operations, study, teaching, or administration help.';
  return fallback;
}

function roleCapabilities(role: string) {
  const common = [
    'explain EduVerse workflows and where to go',
    'find relevant docs and navigation',
    'summarize schedules, academic cycles, courses, sections, rooms, events, announcements, and deadlines',
    'interpret visible attendance, grading, evaluation, enrollment, finance, and communication context',
  ];

  if (role === 'STUDENT') {
    return [
      'study planning around timetable and deadlines',
      'course, attendance, grade, transcript, material, fee, and announcement guidance',
      'weak-course explanations and practical improvement plans',
      ...common.slice(0, 2),
    ].join('; ');
  }

  if (role === 'TEACHER') {
    return [
      'teaching schedule briefings',
      'next-class preparation',
      'pending grading and attendance reminders',
      'students needing attention',
      'section workload and course material guidance',
      ...common.slice(0, 2),
    ].join('; ');
  }

  if (role === 'ORG_MANAGER') {
    return [
      'department and academic activity summaries',
      'teacher workload, schedule bottleneck, attendance, evaluation, and course performance analysis',
      'staffing or operational concerns visible to the manager',
      ...common,
    ].join('; ');
  }

  if (role === 'ORG_ADMIN') {
    return [
      'organization setup and operating workflows',
      'academic health, enrollment, attendance, grading, evaluations, schedules, rooms, events, announcements, finance, users, and permissions',
      'Copilot usage, credits, subscription, and role-access configuration when asked',
      ...common,
    ].join('; ');
  }

  return common.join('; ');
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
