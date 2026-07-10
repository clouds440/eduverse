import { ForbiddenException } from '@nestjs/common';
import { AIUsageSourceType, Role, UserStatus } from '@/prisma/prisma-client';
import { AIService } from './ai.service';
import type { AIEntitlementSource } from './ai.types';

describe('AIService', () => {
  const user = {
    id: 'user-1',
    organizationId: 'org-1',
    role: Role.STUDENT,
    status: UserStatus.ACTIVE,
  } as never;

  const entitlementSource: AIEntitlementSource = {
    sourceType: AIUsageSourceType.ORGANIZATION,
    subscription: {
      id: 'sub-1',
      organizationId: 'org-1',
      userId: null,
      monthlyCredits: 100,
    } as never,
    period: {
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
    },
    balance: {
      monthlyCredits: 100,
      usedCredits: 0,
      remainingCredits: 100,
      overageCredits: 0,
    },
    overageAllowed: false,
  };

  function createService(overrides: Partial<{
    entitlement: { allowed: true; source: AIEntitlementSource } | { allowed: false; code: string; message: string };
    providerChatError: Error;
    plannerResult: unknown;
    contextMessages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>;
  }> = {}) {
    const conversationService = {
      getOrCreateConversation: jest.fn().mockResolvedValue({ id: 'conversation-1', title: null }),
      getContextMessages: jest.fn().mockResolvedValue({
        conversationId: 'conversation-1',
        messages: overrides.contextMessages ?? [{ role: 'assistant', content: 'Earlier context' }],
      }),
      appendUserMessage: jest.fn().mockResolvedValue(undefined),
      appendAssistantMessage: jest.fn().mockResolvedValue(undefined),
      touchConversationTitle: jest.fn().mockResolvedValue('What should I study today?'),
      setConversationTitle: jest.fn().mockResolvedValue('Study Plan'),
    };
    const creditService = {
      recordUsage: jest.fn().mockResolvedValue(undefined),
    };
    const entitlementService = {
      resolveEntitlement: jest.fn().mockResolvedValue(
        overrides.entitlement ?? { allowed: true, source: entitlementSource },
      ),
    };
    const providerService = {
      estimateCredits: jest.fn().mockReturnValue(1),
      planTools: jest.fn().mockResolvedValue(overrides.plannerResult ?? []),
      chat: jest.fn().mockResolvedValue({
        content: 'Study Algebra first.',
        providerName: 'openrouter',
        model: 'qwen/qwen3-8b',
        providerTokenEstimate: 20,
        creditEstimate: 1,
        toolCalls: [],
      }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('openrouter'),
    };
    if (overrides.providerChatError) {
      providerService.chat.mockRejectedValue(overrides.providerChatError);
    }
    const toolRegistry = {
      listTools: jest.fn().mockReturnValue([{ name: 'getScheduleContext', description: 'Generic schedule context' }]),
      runTools: jest.fn().mockImplementation((requests: Array<{ name: string; input?: Record<string, unknown> }>) => (
        Promise.resolve(requests.length ? [
          {
            tool: 'getScheduleContext',
            input: { date: '2026-07-07' },
            result: {
              ok: true,
              data: {
                schedules: [{
                  scheduleId: 'schedule-1',
                  sectionId: 'section-1',
                  courseName: 'Algebra',
                  startTime: '09:00',
                  href: '/sections/section-1',
                }],
              },
            },
          },
        ] : [])
      )),
    };

    return {
      service: new AIService(
        conversationService as never,
        creditService as never,
        entitlementService as never,
        providerService as never,
        toolRegistry as never,
      ),
      conversationService,
      creditService,
      entitlementService,
      providerService,
      toolRegistry,
    };
  }

  it('uses stored conversation context, persists messages, and records usage', async () => {
    const { service, conversationService, creditService, providerService, entitlementService, toolRegistry } = createService();

    const response = await service.chat(user, {
      prompt: 'What should I study today?',
      conversationId: 'conversation-1',
      history: [{ role: 'user', content: 'Fallback context' }],
    });

    expect(conversationService.getOrCreateConversation).toHaveBeenCalledWith(
      { id: 'user-1', organizationId: 'org-1' },
      'conversation-1',
      'sub-1',
    );
    expect(providerService.chat).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        { role: 'assistant', content: 'Earlier context' },
        { role: 'user', content: 'What should I study today?' },
        expect.objectContaining({ role: 'tool', name: 'eduverseToolResults' }),
      ]),
    }));
    const providerInput = providerService.chat.mock.calls[0][0];
    const toolMessage = providerInput.messages.find((message: any) => message.role === 'tool');
    expect(toolMessage.content).toContain('"source":"context_');
    expect(toolMessage.content).toContain('"courseName":"Algebra"');
    expect(toolMessage.content).not.toContain('getScheduleContext');
    expect(toolMessage.content).not.toContain('schedule-1');
    expect(toolMessage.content).not.toContain('/sections/section-1');
    expect(toolRegistry.runTools).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'getScheduleContext' }),
      ]),
      expect.objectContaining({ userId: 'user-1', orgId: 'org-1' }),
    );
    expect(entitlementService.resolveEntitlement).toHaveBeenCalledTimes(2);
    expect(conversationService.appendUserMessage).toHaveBeenCalledWith(
      'conversation-1',
      'What should I study today?',
    );
    expect(conversationService.appendAssistantMessage).toHaveBeenCalledWith(
      'conversation-1',
      'Study Algebra first.',
      expect.objectContaining({ providerName: 'openrouter', creditEstimate: 1 }),
    );
    expect(creditService.recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      credits: 1,
      providerTokenEstimate: 20,
    }));
    expect(response.conversationId).toBe('conversation-1');
    expect(response.message.content).toBe('Study Algebra first.');
  });

  it('blocks chat before creating conversation when entitlement is denied', async () => {
    const { service, conversationService } = createService({
      entitlement: {
        allowed: false,
        code: 'NO_SUBSCRIPTION',
        message: 'EduVerse Copilot requires a subscription.',
      },
    });

    await expect(service.chat(user, { prompt: 'Help me.' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(conversationService.getOrCreateConversation).not.toHaveBeenCalled();
  });

  it('uses the planner title for a new conversation when provided', async () => {
    const { service, conversationService } = createService({
      plannerResult: {
        title: 'Study Plan',
        requests: [],
      },
      contextMessages: [],
    });

    const response = await service.chat(user, {
      prompt: 'Make me a study plan.',
    });

    expect(conversationService.setConversationTitle).toHaveBeenCalledWith(
      'conversation-1',
      'Study Plan',
    );
    expect(conversationService.touchConversationTitle).not.toHaveBeenCalled();
    expect(response.title).toBe('Study Plan');
  });

  it('instructs the model not to ask for facts already present in backend context', async () => {
    const { service, providerService } = createService();

    await service.chat(user, {
      prompt: 'How do I enroll a student in summer semester 2026?',
    });

    const providerInput = providerService.chat.mock.calls[0][0];
    const toolMessage = providerInput.messages.find((message: any) => message.role === 'tool');

    expect(providerInput.systemPrompt).toContain(
      'Do not ask the user to confirm facts already present in backend context',
    );
    expect(providerInput.systemPrompt).toContain(
      'Do not add closing engagement questions after a complete answer',
    );
    expect(toolMessage.content).toContain(
      'Facts present here are already known; do not ask the user to confirm them.',
    );
  });

  it('grounds Copilot capability answers from the authenticated role only', async () => {
    const { service, providerService, toolRegistry } = createService();

    await service.chat(user, {
      prompt: 'What can you do?',
    });

    const providerInput = providerService.chat.mock.calls[0][0];
    const capabilityMessage = providerInput.messages.find((message: any) => (
      message.role === 'system'
      && message.content.includes('Role-scoped EduVerse Copilot capability context')
    ));
    expect(providerInput.systemPrompt).toContain(
      'If asked what you can do, describe user-facing EduVerse help by role.',
    );
    expect(providerInput.systemPrompt).toContain('Do not list internal tools.');
    expect(providerInput.systemPrompt).toContain('Capability areas:');
    expect(providerInput.systemPrompt).toContain('study planning around timetable and deadlines');
    expect(providerInput.systemPrompt).toContain(
      'politely redirect to EduVerse-focused help',
    );
    expect(capabilityMessage?.content).toContain('authenticated role STUDENT');
    expect(capabilityMessage?.content).toContain('study planning around timetable and deadlines');
    expect(capabilityMessage?.content).not.toContain('teaching schedule briefings');
    expect(capabilityMessage?.content).not.toContain('organization setup and operating workflows');
    expect(toolRegistry.runTools).toHaveBeenCalledWith(
      [],
      expect.any(Object),
    );
  });

  it('persists an assistant error when provider generation fails after the user message is stored', async () => {
    const { service, conversationService } = createService({
      providerChatError: new Error('Provider is unavailable.'),
    });

    await expect(service.chat(user, {
      prompt: 'What should I study today?',
      conversationId: 'conversation-1',
    })).rejects.toThrow('Provider is unavailable.');

    expect(conversationService.appendUserMessage).toHaveBeenCalledWith(
      'conversation-1',
      'What should I study today?',
    );
    expect(conversationService.appendAssistantMessage).toHaveBeenCalledWith(
      'conversation-1',
      expect.stringContaining('I could not complete that request.'),
      expect.objectContaining({
        error: true,
        providerName: 'openrouter',
        errorCode: 'AI_RESPONSE_ERROR',
      }),
    );
  });
});
