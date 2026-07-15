import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from './ws-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Authenticated user data attached to socket.data.user by WsJwtGuard.
 */
interface SocketUser {
  id: string;
  role: string;
  name: string | null;
  email: string;
  organizationId: string | null;
}

/**
 * Single WebSocket gateway designed for future expansion.
 *
 * Current scope:  mail:new, mail:update, mail:message
 * Future scope:   chat, notifications, announcements
 *
 * Room strategy:
 *   On connect → auto-join: user:{userId}, role:{role}, org:{orgId}
 *   On demand  → join: mail:{id}, chat:{id}, section:{id}, etc.
 */
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowedOrigins = (process.env.FRONTEND_URL || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);

      const isAllowed =
        allowedOrigins.some((allowed) => origin === allowed) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /\.vercel\.app$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly onlineConnectionCounts = new Map<string, number>();
  private readonly foregroundConnectionCounts = new Map<string, number>();

  constructor(
    private readonly wsGuard: WsJwtGuard,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ──────────────────────────── Connection lifecycle ──────────────────────────

  /**
   * Check if the user's session is active.
   * Used to validate write operations while allowing read-only access.
   */
  private async isSessionActive(client: Socket): Promise<boolean> {
    const token =
      (client.handshake.auth as Record<string, string>)?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return false;

    const user = client.data.user as SocketUser;
    if (!user) return false;

    const session = await this.prisma.session.findFirst({
      where: {
        userId: user.id,
        token,
        isActive: true,
      },
    });

    return !!session;
  }

  async handleConnection(client: Socket): Promise<void> {
    const isValid = await this.wsGuard.validateClient(client);

    if (!isValid) {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
      return;
    }

    const user = client.data.user as SocketUser;

    // Auto-join identity rooms
    await client.join(`user:${user.id}`);
    await client.join(`role:${user.role}`);

    if (user.organizationId) {
      await client.join(`org:${user.organizationId}`);
    }

    client.data.isForeground = true;
    this.setUserForegroundState(user.id, true);
    this.setUserOnlineState(user, true);

    client.emit('connected', {
      userId: user.id,
      rooms: [
        `user:${user.id}`,
        `role:${user.role}`,
        ...(user.organizationId ? [`org:${user.organizationId}`] : []),
      ],
    });
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as SocketUser | undefined;
    if (user) {
      const isForeground = client.data.isForeground !== false;
      if (isForeground) {
        this.setUserForegroundState(user.id, false);
      }
      this.setUserOnlineState(user, false);
    }

    // Socket.IO automatically cleans up room memberships on disconnect
  }

  // ──────────────────────────── Client-callable events ────────────────────────

  /**
   * Join a specific room (e.g., mail:{id}, chat:{id}, section:{id}).
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    if (!client.data.user || !data?.roomId) return;

    const user = client.data.user as SocketUser;

    // Check session is active for write operations
    const isSessionActive = await this.isSessionActive(client);
    if (!isSessionActive) {
      client.emit('error', { message: 'Session expired. Please log in again.' });
      return;
    }

    // Security: For chat rooms, verify active participation
    if (data.roomId.startsWith('chat:')) {
      const chatId = data.roomId.replace('chat:', '');
      const participant = await this.prisma.chatParticipant.findUnique({
        where: { chatId_userId: { chatId, userId: user.id } },
      });

      if (!participant || !participant.isActive) {
        // Silently ignore or emit error
        client.emit('error', { message: 'Join room unauthorized' });
        return;
      }
    }

    await client.join(data.roomId);
    client.emit('roomJoined', { roomId: data.roomId });
  }

  /**
   * Leave a specific room.
   */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    if (!client.data.user || !data?.roomId) return;
    await client.leave(data.roomId);
    client.emit('roomLeft', { roomId: data.roomId });
  }

  @SubscribeMessage('presence:request')
  async handlePresenceRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ): Promise<void> {
    if (!client.data.user || !data?.chatId) return;

    const user = client.data.user as SocketUser;

    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId: data.chatId, userId: user.id } },
    });

    if (!participant || !participant.isActive) return;

    const participants = await this.prisma.chatParticipant.findMany({
      where: { chatId: data.chatId, isActive: true },
      select: { userId: true },
    });

    const onlineUserIds = participants
      .map((chatParticipant) => chatParticipant.userId)
      .filter((userId) => this.onlineConnectionCounts.get(userId));

    client.emit('presence:state', {
      chatId: data.chatId,
      participantUserIds: participants.map((chatParticipant) => chatParticipant.userId),
      userIds: onlineUserIds,
    });
  }

  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; isTyping: boolean },
  ): void {
    if (!client.data.user || !data?.chatId) return;

    const user = client.data.user as SocketUser;

    // Broadcast typing state to all users in the chat room.
    // No DB lookup needed — the user is already authenticated on connect
    // and must have joined the room (which verifies participation).
    this.emitToRoom(`chat:${data.chatId}`, 'chat:typing', {
      chatId: data.chatId,
      userId: user.id,
      name: user.name,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('app:visibility')
  handleAppVisibility(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isForeground?: boolean },
  ): void {
    if (!client.data.user) return;

    const user = client.data.user as SocketUser;
    const wasForeground = client.data.isForeground !== false;
    const isForeground = data?.isForeground !== false;
    if (wasForeground === isForeground) return;

    client.data.isForeground = isForeground;
    this.setUserForegroundState(user.id, isForeground);
  }

  /**
   * Force a specific user to leave a room (e.g., when they are removed from a chat).
   */
  async forceLeaveRoom(userId: string, roomId: string): Promise<void> {
    const userRoom = `user:${userId}`;
    const sockets = await this.server.in(userRoom).fetchSockets();

    for (const socket of sockets) {
      socket.leave(roomId);
      socket.emit('roomLeft', { roomId, forced: true });
    }
  }

  // ──────────────────────────── Emit helpers (for services) ───────────────────

  /**
   * Emit an event to a specific room.
   */
  emitToRoom(room: string, event: string, data: unknown): void {
    this.server.to(room).emit(event, data);
  }

  /**
   * Check if a user has at least one active foreground app connection.
   */
  isUserOnline(userId: string): boolean {
    return (this.foregroundConnectionCounts.get(userId) || 0) > 0;
  }

  /**
   * Emit an event to a specific user by their userId.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit an event to all users with a specific role.
   */
  emitToRole(role: string, event: string, data: unknown): void {
    this.server.to(`role:${role}`).emit(event, data);
  }

  /**
   * Emit an event to all users in an organization.
   */
  emitToOrg(orgId: string, event: string, data: unknown): void {
    this.server.to(`org:${orgId}`).emit(event, data);
  }

  private setUserOnlineState(user: SocketUser, isConnecting: boolean): void {
    const previousCount = this.onlineConnectionCounts.get(user.id) || 0;
    const nextCount = isConnecting
      ? previousCount + 1
      : Math.max(0, previousCount - 1);

    if (nextCount === 0) {
      this.onlineConnectionCounts.delete(user.id);
    } else {
      this.onlineConnectionCounts.set(user.id, nextCount);
    }

    const becameOnline = isConnecting && previousCount === 0;
    const becameOffline = !isConnecting && nextCount === 0;

    if (!becameOnline && !becameOffline) return;

    const payload = {
      userId: user.id,
      isOnline: becameOnline,
      lastSeenAt: becameOffline ? new Date().toISOString() : null,
    };

    if (user.organizationId) {
      this.emitToOrg(user.organizationId, 'presence:update', payload);
    } else {
      this.emitToRole(user.role, 'presence:update', payload);
    }

    this.emitToUser(user.id, 'presence:update', payload);

    // Update lastSeenAt only when user goes offline
    if (becameOffline) {
      this.prisma.chatParticipant.updateMany({
        where: { userId: user.id, isActive: true },
        data: { lastSeenAt: new Date() }
      }).catch(err => {
        console.error('Failed to update lastSeenAt:', err);
      });
    }

    // Also emit to all chat rooms the user is a participant of
    this.prisma.chatParticipant.findMany({
      where: { userId: user.id, isActive: true },
      select: { chatId: true }
    }).then(participants => {
      for (const participant of participants) {
        this.emitToRoom(`chat:${participant.chatId}`, 'presence:update', payload);
      }
    }).catch(err => {
      console.error('Failed to emit presence to chat rooms:', err);
    });
  }

  private setUserForegroundState(userId: string, isForeground: boolean): void {
    const previousCount = this.foregroundConnectionCounts.get(userId) || 0;
    const nextCount = isForeground
      ? previousCount + 1
      : Math.max(0, previousCount - 1);

    if (nextCount === 0) {
      this.foregroundConnectionCounts.delete(userId);
    } else {
      this.foregroundConnectionCounts.set(userId, nextCount);
    }
  }
}
