import { Prisma } from '@/prisma/prisma-client';

export interface ChatMessageVisibilityParticipant {
  chatId: string;
  clearedAt: Date | null;
}

export interface ChatMessageVisibilityPeriod {
  activatedAt: Date;
  deactivatedAt: Date | null;
}

export function buildVisibleChatMessageWhere(
  participant: ChatMessageVisibilityParticipant,
  history: ChatMessageVisibilityPeriod[],
): Prisma.ChatMessageWhereInput {
  const membershipPeriods = history.map((period) => ({
    createdAt: {
      gte: period.activatedAt,
      ...(period.deactivatedAt ? { lte: period.deactivatedAt } : {}),
    },
  }));

  return {
    chatId: participant.chatId,
    ...(membershipPeriods.length > 0 ? { OR: membershipPeriods } : {}),
    ...(participant.clearedAt
      ? { createdAt: { gt: participant.clearedAt } }
      : {}),
  };
}
