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
  }> = {}) {
    const conversationService = {
      getOrCreateConversation: jest.fn().mockResolvedValue({ id: 'conversation-1', title: null }),
      getContextMessages: jest.fn().mockResolvedValue({
        conversationId: 'conversation-1',
        messages: [{ role: 'assistant', content: 'Earlier context' }],
      }),
      appendUserMessage: jest.fn().mockResolvedValue(undefined),
      appendAssistantMessage: jest.fn().mockResolvedValue(undefined),
      touchConversationTitle: jest.fn().mockResolvedValue('What should I study today?'),
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
      planTools: jest.fn().mockResolvedValue([]),
      chat: jest.fn().mockResolvedValue({
        content: 'Study Algebra first.',
        providerName: 'gemini',
        model: 'gemini-1.5-flash',
        providerTokenEstimate: 20,
        creditEstimate: 1,
        toolCalls: [],
      }),
      stream: jest.fn(),
    };
    const toolRegistry = {
      listTools: jest.fn().mockReturnValue([{ name: 'getMyTodaySchedule', description: 'Today schedule' }]),
      runTool: jest.fn().mockResolvedValue({
        ok: true,
        data: { schedules: [{ courseName: 'Algebra', startTime: '09:00' }] },
      }),
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
        expect.objectContaining({ role: 'tool', name: 'getMyTodaySchedule' }),
      ]),
    }));
    expect(toolRegistry.runTool).toHaveBeenCalledWith(
      'getMyTodaySchedule',
      {},
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
      expect.objectContaining({ providerName: 'gemini', creditEstimate: 1 }),
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
        message: 'EduVerse AI Copilot requires a subscription.',
      },
    });

    await expect(service.chat(user, { prompt: 'Help me.' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(conversationService.getOrCreateConversation).not.toHaveBeenCalled();
  });
});
