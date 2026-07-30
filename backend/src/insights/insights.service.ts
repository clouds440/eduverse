import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../common/enums';
import { AdminInsightsBuilder } from './builders/admin-insights.builder';
import { FinanceInsightsBuilder, type FinanceInsightsQuery } from './builders/finance-insights.builder';
import { GuardianInsightsBuilder } from './builders/guardian-insights.builder';
import { StudentInsightsBuilder } from './builders/student-insights.builder';
import { TeacherInsightsBuilder } from './builders/teacher-insights.builder';
import type { InsightsQueryDto } from './dto/insights-query.dto';
import type { DashboardInsightsResponse, InsightsUser } from './shared/insights.types';

function insightShell(response: DashboardInsightsResponse): DashboardInsightsResponse {
  return {
    ...response,
    groups: response.groups.slice(0, 2),
    recentActivity: [],
    charts: {},
  };
}

function insightModule(response: DashboardInsightsResponse, module: string): DashboardInsightsResponse {
  const base = {
    ...response,
    summaryCards: [],
    spotlight: null,
    groups: [],
    recentActivity: [],
    charts: {},
  };

  if (module === 'summary') {
    return insightShell(response);
  }

  if (module === 'actions') {
    return { ...base, groups: response.groups };
  }

  if (module === 'activity') {
    return { ...base, recentActivity: response.recentActivity };
  }

  return { ...base, charts: response.charts || {} };
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly adminInsightsBuilder: AdminInsightsBuilder,
    private readonly teacherInsightsBuilder: TeacherInsightsBuilder,
    private readonly studentInsightsBuilder: StudentInsightsBuilder,
    private readonly guardianInsightsBuilder: GuardianInsightsBuilder,
    private readonly financeInsightsBuilder: FinanceInsightsBuilder,
  ) {}

  async getInsights(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<DashboardInsightsResponse> {
    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return this.adminInsightsBuilder.buildShell(orgId, user, query);
    }

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      return this.teacherInsightsBuilder.buildShell(orgId, user, query);
    }

    if (user.role === Role.STUDENT) {
      return this.studentInsightsBuilder.buildShell(orgId, user, query);
    }

    if (user.role === Role.GUARDIAN) {
      return this.guardianInsightsBuilder.buildShell(orgId, user, query);
    }

    if (user.role === Role.FINANCE_MANAGER) {
      return this.financeInsightsBuilder.buildShell(orgId, user, query);
    }

    throw new ForbiddenException('Insights are not available for this role.');
  }

  async getInsightModule(
    orgId: string,
    user: InsightsUser,
    module: string,
    query: InsightsQueryDto = {},
  ): Promise<DashboardInsightsResponse> {
    if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
      return this.adminInsightsBuilder.buildModule(orgId, user, module, query);
    }

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      return this.teacherInsightsBuilder.buildModule(orgId, user, module, query);
    }

    if (user.role === Role.STUDENT) {
      return this.studentInsightsBuilder.buildModule(orgId, user, module, query);
    }

    if (user.role === Role.GUARDIAN) {
      return this.guardianInsightsBuilder.buildModule(orgId, user, module, query);
    }

    if (user.role === Role.FINANCE_MANAGER) {
      return this.financeInsightsBuilder.buildModule(orgId, user, module, query);
    }

    throw new ForbiddenException('Insight modules are not available for this role.');
  }

  async getFinanceInsights(
    orgId: string,
    user: InsightsUser,
    query: FinanceInsightsQuery = {},
  ) {
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) {
      throw new ForbiddenException('Cannot access finance insights for a different organization.');
    }

    if (
      user.role === Role.ORG_ADMIN ||
      user.role === Role.SUB_ADMIN ||
      user.role === Role.FINANCE_MANAGER ||
      user.role === Role.SUPER_ADMIN
    ) {
      return this.financeInsightsBuilder.buildShell(orgId, user, query);
    }

    throw new ForbiddenException('Finance insights are not available for this role.');
  }

  async getFinanceInsightModule(
    orgId: string,
    user: InsightsUser,
    module: string,
    query: FinanceInsightsQuery = {},
  ) {
    if (user.role !== Role.SUPER_ADMIN && orgId !== user.organizationId) {
      throw new ForbiddenException('Cannot access finance insights for a different organization.');
    }

    if (
      user.role === Role.ORG_ADMIN ||
      user.role === Role.SUB_ADMIN ||
      user.role === Role.FINANCE_MANAGER ||
      user.role === Role.SUPER_ADMIN
    ) {
      return this.financeInsightsBuilder.buildModule(orgId, user, module, query);
    }

    throw new ForbiddenException('Finance insight modules are not available for this role.');
  }
}
