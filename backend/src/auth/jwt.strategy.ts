import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AccessLevel } from '../common/access-control/access-level.enum';

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
    if (
      payload.id !== payload.sub ||
      !Object.values(AccessLevel).includes(payload.accessLevel)
    ) {
      throw new UnauthorizedException('Invalid session claims.');
    }

    // The signed token owns identity and access context. The database lookup is
    // only for revocation/session activity, not authorization re-resolution.
    const token = extractJwtFromRequest(req);
    let activeSessionId: string | undefined;
    if (token) {
      const session = await this.prisma.session.findFirst({
        where: {
          userId: payload.sub,
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
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.userStatus,
      organizationId: payload.orgId ?? null,
      organizationStatus: payload.status,
      accessLevel: payload.accessLevel,
      name: payload.name ?? null,
      sessionId: activeSessionId,
    };
  }
}
