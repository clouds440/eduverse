import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Prisma } from '@prisma/client';
import * as webpush from 'web-push';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  body?: string;
  actionUrl?: string;
  type?: string;
  metadata?: Prisma.JsonValue;
}

@Injectable()
export class NotificationsService {
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
    }).catch(e => console.error('Failed to send push notification:', e));

    return notification;
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

  async subscribeToPush(userId: string, subscription: any) {
    const existing = await this.prisma.webPushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      if (existing.userId !== userId) {
        // Same endpoint used by a different user now (e.g. log out and log in as another user on same browser)
        await this.prisma.webPushSubscription.update({
          where: { id: existing.id },
          data: { userId }
        });
      }
      return { success: true, message: 'Subscription already exists or updated.' };
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

  async sendPushNotification(userId: string, payload: { title: string, body?: string, url?: string }) {
    // Skip push if user has the app open (foreground)
    if (this.events.isUserOnline(userId)) return;

    await this._dispatchPush(userId, payload);
  }

  /**
   * Send a push notification WITHOUT saving to the Notification model.
   * Used for chat messages — they are real-time via socket, push is only a fallback
   * for when the user is offline / app is in background.
   */
  async sendPushOnly(userId: string, payload: { title: string, body?: string, url?: string }) {
    // Only send push when user is NOT online (app not in foreground)
    if (this.events.isUserOnline(userId)) return;

    await this._dispatchPush(userId, payload);
  }

  private async _dispatchPush(userId: string, payload: { title: string, body?: string, url?: string }) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
      return; // VAPID not configured, silently skip push
    }

    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions.length) return;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const webpushPayload = JSON.stringify(payload);

    const promises = subscriptions.map(sub => 
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, webpushPayload).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid, clean it up
          return this.prisma.webPushSubscription.delete({ where: { id: sub.id } });
        }
        console.error('Error sending web push notification:', err);
      })
    );

    await Promise.allSettled(promises);
  }
}
