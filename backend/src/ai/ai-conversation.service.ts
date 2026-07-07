import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AIMessageRole, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import type { AIProviderMessage } from './ai.types';

const AI_CONVERSATION_TTL_DAYS = 30;
const AI_CONTEXT_RECENT_MESSAGE_LIMIT = 12;
const AI_CONTEXT_SUMMARY_MESSAGE_LIMIT = 16;
const AI_CONTEXT_MAX_MESSAGE_CHARS = 4000;
const AI_TITLE_MAX_CHARS = 80;

export interface AIConversationActor {
  id: string;
  organizationId?: string | null;
}

export interface AIConversationContext {
  conversationId: string;
  title?: string | null;
  messages: AIProviderMessage[];
}

@Injectable()
export class AIConversationService {
  private readonly logger = new Logger(AIConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateConversation(
    actor: AIConversationActor,
    conversationId?: string,
    subscriptionId?: string | null,
  ) {
    if (conversationId) {
      const existing = await this.prisma.aIConversation.findFirst({
        where: {
          id: conversationId,
          userId: actor.id,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (!existing) {
        throw new NotFoundException({
          code: 'CONVERSATION_NOT_FOUND',
          message: 'This Copilot conversation is no longer available.',
        });
      }

      if (subscriptionId && existing.subscriptionId !== subscriptionId) {
        return this.prisma.aIConversation.update({
          where: { id: existing.id },
          data: {
            subscriptionId,
            expiresAt: this.getExpiryDate(),
          },
        });
      }

      return existing;
    }

    return this.prisma.aIConversation.create({
      data: {
        userId: actor.id,
        organizationId: actor.organizationId ?? null,
        subscriptionId: subscriptionId ?? null,
        expiresAt: this.getExpiryDate(),
      },
    });
  }

  async getContextMessages(
    conversationId: string,
    fallbackHistory: AIProviderMessage[] = [],
  ): Promise<AIConversationContext> {
    const conversation = await this.prisma.aIConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 80,
        },
      },
    });

    const storedMessages = conversation?.messages.map((message) => ({
      role: this.toProviderRole(message.role),
      content: clampMessageContent(message.content),
    })) ?? [];

    const baseMessages = storedMessages.length > 0
      ? storedMessages
      : fallbackHistory.map((message) => ({
          role: message.role,
          content: clampMessageContent(message.content),
          name: message.name,
        }));

    return {
      conversationId,
      title: conversation?.title,
      messages: compactContextMessages(baseMessages),
    };
  }

  async appendUserMessage(conversationId: string, content: string) {
    return this.appendMessage(conversationId, AIMessageRole.USER, content);
  }

  async appendAssistantMessage(
    conversationId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.appendMessage(conversationId, AIMessageRole.ASSISTANT, content, metadata);
  }

  async touchConversationTitle(conversationId: string, prompt: string) {
    const title = createConversationTitle(prompt);
    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        title,
        expiresAt: this.getExpiryDate(),
      },
    });
    return title;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async deleteExpiredConversations() {
    const result = await this.prisma.aIConversation.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} expired AI Copilot conversations.`);
    }
  }

  private appendMessage(
    conversationId: string,
    role: AIMessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.aIMessage.create({
      data: {
        conversationId,
        role,
        content: clampMessageContent(content, 12000),
        metadata: metadata ? metadata as Prisma.InputJsonValue : undefined,
      },
    });
  }

  private toProviderRole(role: AIMessageRole): AIProviderMessage['role'] {
    if (role === AIMessageRole.ASSISTANT) return 'assistant';
    if (role === AIMessageRole.TOOL) return 'tool';
    if (role === AIMessageRole.SYSTEM) return 'system';
    return 'user';
  }

  private getExpiryDate() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + AI_CONVERSATION_TTL_DAYS);
    return expiresAt;
  }
}

export function compactContextMessages(messages: AIProviderMessage[]): AIProviderMessage[] {
  const cleaned = messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      ...message,
      content: clampMessageContent(message.content),
    }));

  if (cleaned.length <= AI_CONTEXT_RECENT_MESSAGE_LIMIT) return cleaned;

  const olderMessages = cleaned.slice(
    Math.max(0, cleaned.length - AI_CONTEXT_RECENT_MESSAGE_LIMIT - AI_CONTEXT_SUMMARY_MESSAGE_LIMIT),
    -AI_CONTEXT_RECENT_MESSAGE_LIMIT,
  );
  const recentMessages = cleaned.slice(-AI_CONTEXT_RECENT_MESSAGE_LIMIT);
  const summary = summarizeOlderMessages(olderMessages);

  return summary
    ? [{ role: 'system', content: summary }, ...recentMessages]
    : recentMessages;
}

function summarizeOlderMessages(messages: AIProviderMessage[]) {
  if (messages.length === 0) return '';

  const lines = messages.map((message) => {
    const label = message.role === 'assistant' ? 'Copilot' : 'User';
    return `${label}: ${message.content.replace(/\s+/g, ' ').slice(0, 220)}`;
  });

  return [
    'Compact memory from earlier turns. Use only as conversational context; re-check backend tools for live facts before answering:',
    ...lines,
  ].join('\n');
}

function clampMessageContent(content: string, maxChars = AI_CONTEXT_MAX_MESSAGE_CHARS) {
  const normalized = content.replace(/\s+\n/g, '\n').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 24).trimEnd()}\n[Content truncated]`;
}

function createConversationTitle(prompt: string) {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'New Copilot conversation';
  if (normalized.length <= AI_TITLE_MAX_CHARS) return normalized;
  return `${normalized.slice(0, AI_TITLE_MAX_CHARS - 1).trimEnd()}...`;
}
