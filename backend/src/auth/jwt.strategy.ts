import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export const AUTH_COOKIE_NAME = 'eduverse_access_token';

export function extractJwtFromRequest(req: Request): string | null {
  const bearerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (bearerToken) return bearerToken;

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === AUTH_COOKIE_NAME) {
      const value = rawValue.join('=');
      if (!value) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || '',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    // Check if the session exists and is active
    const token = extractJwtFromRequest(req);
    let activeSessionId: string | undefined;
    if (token) {
      const session = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          token,
          isActive: true,
        },
      });

      if (!session) {
        throw new UnauthorizedException(
          'Session expired or revoked. Please log in again.',
        );
      }
      activeSessionId = session.id;

      // Update lastSeenAt for the session
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId,
      organizationStatus: user.organization?.status,
      name: user.name,
      sessionId: activeSessionId,
    };
  }
}
