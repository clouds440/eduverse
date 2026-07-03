import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Prisma } from '@/prisma/prisma-client';
import * as webpush from 'web-push';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  body?: string;
  actionUrl?: string;
  type?: string;
  metadata?: Prisma.JsonValue;
}

export type NotificationDedupeMetadata = Record<string, string | number | boolean>;

export interface NotificationDedupeOptions {
  includeActionUrlFallback?: boolean;
}

export interface WebPushSubscriptionDto {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface WebPushUnsubscribeDto {
  endpoint?: string;
}

export interface WebPushTestDto {
  endpoint?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async createNotification(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        body: dto.body,
        actionUrl: dto.actionUrl,
        type: dto.type,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? null,
      },
    });

    // Broadcast to user room
    this.events.emitToUser(dto.userId, 'notification:new', notification);

    // Send Web Push Notification asynchronously
    this.sendPushNotification(dto.userId, {
      title: dto.title,
      body: dto.body,
      url: dto.actionUrl || '/',
    }).catch((e) => console.error('Failed to send push notification:', e));

    return notification;
  }

  async createNotificationOnce(
    dto: CreateNotificationDto,
    metadataMatch: NotificationDedupeMetadata = {},
    options: NotificationDedupeOptions = {},
  ) {
    const metadataFilters: Prisma.NotificationWhereInput[] = Object.entries(metadataMatch)
      .map(([key, value]) => ({
        metadata: {
          path: [key],
          equals: value as Prisma.InputJsonValue,
        },
      }));

    const dedupeMatches: Prisma.NotificationWhereInput[] = [];

    if (metadataFilters.length > 0) {
      dedupeMatches.push({ AND: metadataFilters });
    }

    if (
      dto.actionUrl &&
      (metadataFilters.length === 0 || options.includeActionUrlFallback)
    ) {
      dedupeMatches.push({ actionUrl: dto.actionUrl });
    }

    const where: Prisma.NotificationWhereInput = {
      userId: dto.userId,
      ...(dto.type ? { type: dto.type } : {}),
      ...(dedupeMatches.length > 1
        ? { OR: dedupeMatches }
        : dedupeMatches[0] ?? {}),
    };

    const existing = await this.prisma.notification.findFirst({ where });
    if (existing) return existing;

    return this.createNotification(dto);
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async getDropdownNotifications(
    userId: string,
    readPage: number = 1,
    readLimit: number = 10,
  ) {
    const safeReadPage = Math.max(1, readPage || 1);
    const safeReadLimit = Math.min(50, Math.max(1, readLimit || 10));
    const readSkip = (safeReadPage - 1) * safeReadLimit;

    const [unread, read, unreadCount, totalRead] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { userId, isRead: true },
        orderBy: { createdAt: 'desc' },
        skip: readSkip,
        take: safeReadLimit,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.count({ where: { userId, isRead: true } }),
    ]);

    const data = [...unread, ...read].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return {
      data,
      unreadCount,
      readPage: safeReadPage,
      readLimit: safeReadLimit,
      totalRead,
      hasMoreRead: readSkip + read.length < totalRead,
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId)
      throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    this.events.emitToUser(userId, 'notification:read', { notificationId });

    return updated;
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    this.events.emitToUser(userId, 'notification:deleted', {
      notificationId,
      wasUnread: !notification.isRead,
    });

    return { deleted: true };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    this.events.emitToUser(userId, 'notification:read_all', {});

    return result;
  }

  async markCategoryAsRead(userId: string, category: 'CHAT' | 'MAIL') {
    const typePrefix = category === 'CHAT' ? 'CHAT_' : 'MAIL_';
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        type: { startsWith: typePrefix },
      },
      data: { isRead: true },
    });

    this.events.emitToUser(userId, 'notification:read_all', { category });

    return result;
  }

  // --- Web Push Integration ---

  getPushConfig() {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
      configured: Boolean(
        process.env.VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT,
      ),
    };
  }

  async subscribeToPush(userId: string, subscription: WebPushSubscriptionDto) {
    if (
      !subscription?.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      throw new BadRequestException('Invalid web push subscription payload.');
    }

    const existing = await this.prisma.webPushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      await this.prisma.webPushSubscription.update({
        where: { id: existing.id },
        data: {
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
      return {
        success: true,
        message: 'Subscription already exists or updated.',
      };
    }

    await this.prisma.webPushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return { success: true, message: 'Subscribed successfully.' };
  }

  async unsubscribeFromPush(
    userId: string,
    subscription: WebPushUnsubscribeDto,
  ) {
    if (!subscription?.endpoint) {
      throw new BadRequestException('Invalid web push unsubscribe payload.');
    }

    await this.prisma.webPushSubscription.deleteMany({
      where: {
        userId,
        endpoint: subscription.endpoint,
      },
    });

    return { success: true, message: 'Unsubscribed successfully.' };
  }

  async sendPushNotification(
    userId: string,
    payload: { title: string; body?: string; url?: string },
  ) {
    // Skip push if user has the app open (foreground)
    if (this.events.isUserOnline(userId)) return;

    await this._dispatchPush(userId, payload);
  }

  async sendTestPushNotification(
    userId: string,
    payload: { title: string; body?: string; url?: string },
    endpoint?: string,
  ) {
    await this._dispatchPush(userId, payload, { force: true, endpoint });
  }

  /**
   * Send a push notification WITHOUT saving to the Notification model.
   * Used for chat messages — they are real-time via socket, push is only a fallback
   * for when the user is offline / app is in background.
   */
  async sendPushOnly(
    userId: string,
    payload: { title: string; body?: string; url?: string },
  ) {
    // Only send push when user is NOT online (app not in foreground)
    if (this.events.isUserOnline(userId)) return;

    await this._dispatchPush(userId, payload);
  }

  private async _dispatchPush(
    userId: string,
    payload: { title: string; body?: string; url?: string },
    options: { force?: boolean; endpoint?: string } = {},
  ) {
    if (
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY ||
      !process.env.VAPID_SUBJECT
    ) {
      this.logger.warn('Web push skipped: VAPID keys are not configured.');
      return;
    }

    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: {
        userId,
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      },
    });

    if (!subscriptions.length) {
      this.logger.warn(
        `Web push skipped: no subscriptions found for user ${userId}.`,
      );
      return;
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );

    const webpushPayload = JSON.stringify(payload);

    const promises = subscriptions.map((sub) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          webpushPayload,
        )
        .catch((err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription has expired or is no longer valid, clean it up
            return this.prisma.webPushSubscription.delete({
              where: { id: sub.id },
            });
          }
          this.logger.error(
            `Error sending web push notification to ${sub.endpoint}: ${err?.message || err}`,
            err?.stack,
          );
        }),
    );

    if (options.force) {
      this.logger.log(
        `Forced test push dispatched to ${subscriptions.length} subscription(s) for user ${userId}.`,
      );
    }

    await Promise.allSettled(promises);
  }
}
