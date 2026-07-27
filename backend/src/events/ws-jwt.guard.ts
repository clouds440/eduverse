import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

interface WsJwtPayload {
  sub: string;
  tokenType?: string;
  pendingLoginId?: string;
}

/**
 * Guard for WebSocket connections.
 * Validates the JWT from the handshake auth and attaches user data to socket.data.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    return this.validateClient(client);
  }

  /**
   * Validates a socket client's JWT token.
   * Can be called directly from the gateway's handleConnection.
   */
  async validateClient(client: Socket): Promise<boolean> {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return false;

      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) return false;

      const payload = jwt.verify(token, secret) as WsJwtPayload;
      if (!payload?.sub) return false;

      if (payload.tokenType === 'two_factor' && payload.pendingLoginId) {
        const pending = await this.prisma.pendingLogin.findFirst({
          where: {
            id: payload.pendingLoginId,
            userId: payload.sub,
            status: { in: ['PENDING', 'VERIFIED'] },
            expiresAt: { gt: new Date() },
          },
          select: { id: true, userId: true },
        });
        if (!pending) return false;
        client.data.pendingLogin = pending;
        return true;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          role: true,
          name: true,
          email: true,
          organizationId: true,
        },
      });

      if (!user) return false;

      // Attach user data to socket for downstream use
      client.data.user = user;

      return true;
    } catch {
      return false;
    }
  }
}
