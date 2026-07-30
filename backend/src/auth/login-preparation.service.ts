import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Role } from '@/prisma/prisma-client';
import { InsightsService } from '../insights/insights.service';
import type { DashboardInsightsResponse, InsightsUser } from '../insights/shared/insights.types';

const LOGIN_PREPARATION_TTL_MS = 5 * 60_000;
const DEFAULT_INSIGHT_RANGE = '1M' as const;

export type LoginBootstrapKind =
  | 'overview-insights'
  | 'finance-insights'
  | 'teacher-insights'
  | 'student-insights';

export interface LoginBootstrapPayload {
  kind: LoginBootstrapKind;
  range: typeof DEFAULT_INSIGHT_RANGE;
  data: DashboardInsightsResponse;
}

interface LoginPreparationUser extends InsightsUser {
  role?: Role | string;
}

interface LoginPreparationEntry {
  id: string;
  userId: string;
  email: string;
  expiresAt: number;
  promise: Promise<LoginBootstrapPayload | null>;
}

@Injectable()
export class LoginPreparationService {
  private readonly logger = new Logger(LoginPreparationService.name);
  private readonly entries = new Map<string, LoginPreparationEntry>();

  constructor(private readonly insights: InsightsService) {}

  prepare(user: LoginPreparationUser & { email: string }) {
    this.cleanup();
    const existing = this.findReusableEntry(user);
    if (existing) {
      return {
        loginPreparationId: existing.id,
        expiresAt: new Date(existing.expiresAt).toISOString(),
      };
    }

    const id = randomUUID();
    const entry: LoginPreparationEntry = {
      id,
      userId: user.id,
      email: user.email,
      expiresAt: Date.now() + LOGIN_PREPARATION_TTL_MS,
      promise: this.buildBootstrap(user).catch((error) => {
        this.logger.warn(
          `Login bootstrap preparation failed for user ${user.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }),
    };
    this.entries.set(id, entry);
    return {
      loginPreparationId: id,
      expiresAt: new Date(entry.expiresAt).toISOString(),
    };
  }

  async consume(
    loginPreparationId: string | null | undefined,
    user: { id: string; email: string },
  ) {
    if (!loginPreparationId) return null;
    const entry = this.entries.get(loginPreparationId);
    if (!entry) return null;
    this.entries.delete(loginPreparationId);

    if (
      entry.expiresAt <= Date.now() ||
      entry.userId !== user.id ||
      entry.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return null;
    }

    return entry.promise;
  }

  private async buildBootstrap(user: LoginPreparationUser) {
    if (!user.organizationId || !user.role) return null;

    if (user.role === Role.FINANCE_MANAGER) {
      return {
        kind: 'finance-insights' as const,
        range: DEFAULT_INSIGHT_RANGE,
        data: await this.insights.getFinanceInsights(user.organizationId, user, {
          range: DEFAULT_INSIGHT_RANGE,
        }),
      };
    }

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      return {
        kind: 'teacher-insights' as const,
        range: DEFAULT_INSIGHT_RANGE,
        data: await this.insights.getInsights(user.organizationId, user, {
          range: DEFAULT_INSIGHT_RANGE,
        }),
      };
    }

    if (user.role === Role.STUDENT) {
      return {
        kind: 'student-insights' as const,
        range: DEFAULT_INSIGHT_RANGE,
        data: await this.insights.getInsights(user.organizationId, user, {
          range: DEFAULT_INSIGHT_RANGE,
        }),
      };
    }

    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return {
        kind: 'overview-insights' as const,
        range: DEFAULT_INSIGHT_RANGE,
        data: await this.insights.getInsights(user.organizationId, user, {
          range: DEFAULT_INSIGHT_RANGE,
        }),
      };
    }

    return null;
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) this.entries.delete(id);
    }
  }

  private findReusableEntry(user: { id: string; email: string }) {
    const now = Date.now();
    return [...this.entries.values()].find((entry) => (
      entry.expiresAt > now &&
      entry.userId === user.id &&
      entry.email.toLowerCase() === user.email.toLowerCase()
    ));
  }
}
