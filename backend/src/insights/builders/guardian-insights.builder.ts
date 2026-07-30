import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { InsightsQueryDto } from '../dto/insights-query.dto';
import type { InsightsUser, StandardDashboardInsightsResponse } from '../shared/insights.types';
import { StudentInsightsBuilder } from './student-insights.builder';

@Injectable()
export class GuardianInsightsBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentInsightsBuilder: StudentInsightsBuilder,
  ) {}

  async build(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: {
        userId: user.id,
        organizationId: orgId,
      },
      include: {
        studentLinks: {
          include: {
            student: {
              select: {
                id: true,
                userId: true,
                registrationNumber: true,
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    if (guardian.studentLinks.length === 0) {
      return {
        role: Role.GUARDIAN,
        filters: {
          selectedRange: undefined,
          interval: undefined,
          from: undefined,
          to: undefined,
          selectedStudentId: null,
        },
        headline: {
          eyebrow: 'Guardian Insights',
          title: 'No linked student yet',
          subtitle: 'Ask the school office to link this guardian account with a student record.',
        },
        summaryCards: [],
        spotlight: null,
        groups: [],
        recentActivity: [],
        charts: {},
      };
    }

    const selectedLink = query.studentId
      ? guardian.studentLinks.find((link) => link.studentId === query.studentId)
      : guardian.studentLinks[0];

    if (!selectedLink) {
      throw new ForbiddenException('This guardian is not linked to the selected student.');
    }

    return this.studentInsightsBuilder.buildForStudent(
      orgId,
      selectedLink.student.id,
      selectedLink.student.userId,
      Role.GUARDIAN,
      { ...query, studentId: selectedLink.student.id },
    );
  }

  async buildShell(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const selectedLink = await this.getSelectedStudentLink(orgId, user, query);
    if (!selectedLink) return this.emptyGuardianResponse();
    return this.studentInsightsBuilder.buildShellForStudent(
      orgId,
      selectedLink.student.id,
      selectedLink.student.userId,
      Role.GUARDIAN,
      { ...query, studentId: selectedLink.student.id },
    );
  }

  async buildModule(
    orgId: string,
    user: InsightsUser,
    module: string,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const selectedLink = await this.getSelectedStudentLink(orgId, user, query);
    if (!selectedLink) return this.emptyGuardianResponse();
    return this.studentInsightsBuilder.buildModuleForStudent(
      orgId,
      selectedLink.student.id,
      selectedLink.student.userId,
      Role.GUARDIAN,
      module,
      { ...query, studentId: selectedLink.student.id },
    );
  }

  private emptyGuardianResponse(): StandardDashboardInsightsResponse {
    return {
      role: Role.GUARDIAN,
      filters: {
        selectedRange: undefined,
        interval: undefined,
        from: undefined,
        to: undefined,
        selectedStudentId: null,
      },
      headline: {
        eyebrow: 'Guardian Insights',
        title: 'No linked student yet',
        subtitle: 'Ask the school office to link this guardian account with a student record.',
      },
      summaryCards: [],
      spotlight: null,
      groups: [],
      recentActivity: [],
      charts: {},
    };
  }

  private async getSelectedStudentLink(orgId: string, user: InsightsUser, query: InsightsQueryDto) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: {
        userId: user.id,
        organizationId: orgId,
      },
      include: {
        studentLinks: {
          include: {
            student: {
              select: {
                id: true,
                userId: true,
                registrationNumber: true,
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }

    if (guardian.studentLinks.length === 0) return null;

    const selectedLink = query.studentId
      ? guardian.studentLinks.find((link) => link.studentId === query.studentId)
      : guardian.studentLinks[0];

    if (!selectedLink) {
      throw new ForbiddenException('This guardian is not linked to the selected student.');
    }

    return selectedLink;
  }
}
