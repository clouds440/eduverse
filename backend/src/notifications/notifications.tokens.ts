import type { Prisma } from '@prisma/client';

export const NOTIFICATIONS_SERVICE = Symbol('NOTIFICATIONS_SERVICE');

export interface NotificationCreator {
  createNotification(dto: {
    userId: string;
    title: string;
    body?: string;
    actionUrl?: string;
    type?: string;
    metadata?: Prisma.JsonValue;
  }): Promise<unknown>;
}
