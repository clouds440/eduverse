import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { E2EEDeviceTrustStatus } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { SessionDeviceInput } from './auth-internal.types';
import { SecurityService } from './security.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly securityService: SecurityService,
  ) {}

  async persistLoginSession(
    user: { id: string; role: Role },
    token: string,
    rememberMe: boolean,
    device: SessionDeviceInput,
    ip = 'unknown',
  ) {
    if (!device.deviceId) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 1));
    const location = await this.lookupCountry(ip);
    const existingSession = await this.prisma.session.findFirst({
      where: { userId: user.id, deviceId: device.deviceId, isActive: true },
    });

    if (existingSession) {
      const countryChanged =
        existingSession.location &&
        location &&
        existingSession.location !== location;
      await this.prisma.session.update({
        where: { id: existingSession.id },
        data: {
          token,
          lastSeenAt: new Date(),
          expiresAt,
          deviceName: device.deviceName,
          deviceType: device.deviceType,
          ip,
          location,
        },
      });
      if (countryChanged) {
        await this.securityService.notifySuspiciousLocation({
          userId: user.id,
          role: user.role,
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          previousLocation: existingSession.location!,
          newLocation: location!,
        });
      }
      return;
    }

    const deviceSessions = await this.prisma.session.findMany({
      where: { userId: user.id },
      select: { deviceId: true, ip: true, location: true },
    });
    const isNewDevice = !deviceSessions.some(
      (session) => session.deviceId === device.deviceId,
    );
    const isFirstLogin = deviceSessions.length === 0;

    await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        token,
        expiresAt,
        ip,
        location,
      },
    });

    if (isNewDevice && !isFirstLogin) {
      const targetClientDeviceIds = await this.getTrustedClientDeviceIds(
        user.id,
        device.deviceId,
      );
      if (targetClientDeviceIds.length > 0) {
        await this.securityService.notifyNewDevice({
          userId: user.id,
          role: user.role,
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          ip,
          location,
          targetClientDeviceIds,
        });
      }
    }
  }

  async cleanupOldSessions(userId: string) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    await this.prisma.session.deleteMany({
      where: {
        userId,
        isActive: false,
        expiresAt: { lt: ninetyDaysAgo },
      },
    });
  }

  async replaceCurrentAndRevokeOthers(
    userId: string,
    currentToken: string,
    newToken: string,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await this.prisma.session.updateMany({
      where: { userId, token: currentToken, isActive: true },
      data: { token: newToken, lastSeenAt: new Date(), expiresAt },
    });
    await this.prisma.session.updateMany({
      where: { userId, token: { not: newToken }, isActive: true },
      data: { isActive: false },
    });
  }

  async logout(userId: string, token?: string) {
    if (token) {
      const session = await this.prisma.session.findFirst({
        where: { userId, token, isActive: true },
      });
      if (session) {
        await this.prisma.session.update({
          where: { id: session.id },
          data: { isActive: false },
        });
      }
    } else {
      await this.prisma.session.updateMany({
        where: { userId },
        data: { isActive: false },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async getSessions(userId: string, currentToken?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map(({ token, ...session }) => ({
      ...session,
      isCurrent: !!currentToken && token === currentToken,
    }));
  }

  async validateSessionToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
        token,
        { secret: this.configService.get<string>('JWT_SECRET') || '' },
      );
      if (!payload.sub) return false;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!user) return false;
      const session = await this.prisma.session.findFirst({
        where: { userId: user.id, token, isActive: true },
        select: { id: true },
      });
      if (!session) return false;
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  async revokeSession(userId: string, sessionId: string, currentToken?: string) {
    await this.ensureCurrentSessionCanManageSessions(userId, currentToken);
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new UnauthorizedException('Session not found');
    if (currentToken && session.token === currentToken) {
      return {
        message: 'Cannot revoke current session. Please log out instead.',
        shouldLogout: true,
      };
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
    return { message: 'Session revoked successfully' };
  }

  async revokeAllSessions(userId: string, excludeToken?: string) {
    await this.ensureCurrentSessionCanManageSessions(userId, excludeToken);
    await this.prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        ...(excludeToken && { token: { not: excludeToken } }),
      },
      data: { isActive: false },
    });
    return { message: 'All sessions revoked successfully' };
  }

  private async ensureCurrentSessionCanManageSessions(
    userId: string,
    currentToken?: string,
  ) {
    if (!currentToken) {
      throw new ForbiddenException(
        'Use a trusted browser to manage account sessions.',
      );
    }
    const currentSession = await this.prisma.session.findFirst({
      where: { userId, token: currentToken, isActive: true },
      select: { deviceId: true },
    });
    if (!currentSession?.deviceId) {
      throw new ForbiddenException(
        'Use a trusted browser to manage account sessions.',
      );
    }
    const trustedDevice = await this.prisma.trustedEncryptionDevice.findFirst({
      where: {
        userId,
        clientDeviceId: currentSession.deviceId,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
        trustedAt: { not: null },
      },
      select: { id: true },
    });
    if (!trustedDevice) {
      throw new ForbiddenException(
        'Use a trusted browser to manage account sessions.',
      );
    }
  }

  private async getTrustedClientDeviceIds(
    userId: string,
    excludeClientDeviceId?: string | null,
  ) {
    const devices = await this.prisma.trustedEncryptionDevice.findMany({
      where: {
        userId,
        trustStatus: E2EEDeviceTrustStatus.TRUSTED,
        revokedAt: null,
        trustedAt: { not: null },
        ...(excludeClientDeviceId
          ? { clientDeviceId: { not: excludeClientDeviceId } }
          : {}),
      },
      select: { clientDeviceId: true },
    });
    return devices.map((device) => device.clientDeviceId);
  }

  private async lookupCountry(ip: string) {
    if (ip === 'unknown') return null;
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      const data = (await response.json()) as {
        status?: string;
        country?: string;
      };
      return data.status === 'success' ? data.country || null : null;
    } catch (error) {
      console.warn('Failed to lookup location from IP:', error);
      return null;
    }
  }
}
