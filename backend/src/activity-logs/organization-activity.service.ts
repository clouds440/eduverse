import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import {
  ActivityLogFilters,
  isActivityLogType,
  OrganizationActivityLogRecordInput,
  resolveActivityLogType,
} from './activity-log.types';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { ActivityLogMapperService } from './activity-log-mapper.service';

@Injectable()
export class OrganizationActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ActivityLogMapperService,
  ) {}

  async record(input: OrganizationActivityLogRecordInput) {
    return this.prisma.organizationActivityLog.create({
      data: {
        organizationId: input.organizationId,
        type: resolveActivityLogType(input.action, input.type),
        action: input.action,
        actorUserId: input.actorUserId || undefined,
        targetUserId: input.targetUserId || undefined,
        module: input.module || undefined,
        resourceType: input.resourceType || undefined,
        resourceId: input.resourceId || undefined,
        resourceTitle: input.resourceTitle || undefined,
        financeStructureId: input.financeStructureId || undefined,
        financeEntryId: input.financeEntryId || undefined,
        paymentClaimId: input.paymentClaimId || undefined,
        transactionId: input.transactionId || undefined,
        ip: input.ip || undefined,
        userAgent: input.userAgent || undefined,
        sessionId: input.sessionId || undefined,
        details: input.details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(organizationId: string, options: ActivityLogFilters) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const { skip, take, search } = getPaginationOptions({
      ...options,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const matchingUserIds = search
      ? (
          await this.prisma.user.findMany({
            where: {
              organizationId,
              OR: [
                { id: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          })
        ).map((matchedUser) => matchedUser.id)
      : [];

    const where: Prisma.OrganizationActivityLogWhereInput = {
      organizationId,
      ...(options.action && options.action !== 'ALL'
        ? { action: { contains: options.action, mode: 'insensitive' } }
        : {}),
      ...(isActivityLogType(options.type) ? { type: options.type } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { module: { contains: search, mode: 'insensitive' } },
              { resourceType: { contains: search, mode: 'insensitive' } },
              { resourceId: { contains: search, mode: 'insensitive' } },
              { resourceTitle: { contains: search, mode: 'insensitive' } },
              ...(matchingUserIds.length
                ? [
                    { actorUserId: { in: matchingUserIds } },
                    { targetUserId: { in: matchingUserIds } },
                  ]
                : []),
            ],
          }
        : {}),
    };

    const [logs, totalRecords, actions, types] = await Promise.all([
      this.prisma.organizationActivityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              avatarUpdatedAt: true,
            },
          },
        },
      }),
      this.prisma.organizationActivityLog.count({ where }),
      this.prisma.organizationActivityLog.groupBy({
        where: { organizationId },
        by: ['action'],
        _count: { _all: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.organizationActivityLog.groupBy({
        where: { organizationId },
        by: ['type'],
        _count: { _all: true },
        orderBy: { type: 'asc' },
      }),
    ]);

    return {
      ...formatPaginatedResponse(
        await this.mapper.map(logs),
        totalRecords,
        options.page,
        options.limit,
      ),
      counts: Object.fromEntries(actions.map((entry) => [entry.action, entry._count._all])),
      typeCounts: Object.fromEntries(types.map((entry) => [entry.type, entry._count._all])),
    };
  }

  async getLatestContactEmailVerificationReason(orgId: string) {
    const logs = await this.prisma.organizationActivityLog.findMany({
      where: {
        organizationId: orgId,
        action: 'contact_email_verification_requested',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { details: true },
    });

    for (const log of logs) {
      if (!log.details || typeof log.details !== 'object' || Array.isArray(log.details)) continue;
      const reason = (log.details as Record<string, unknown>).reason;
      if (reason === 'first_registration' || reason === 'contact_email_changed') {
        return reason;
      }
    }
    return null;
  }
}
