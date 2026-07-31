import { Injectable } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import {
  ActivityLogFilters,
  ActivityLogRecordInput,
  isActivityLogType,
  resolveActivityLogType,
} from './activity-log.types';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { ActivityLogMapperService } from './activity-log-mapper.service';

@Injectable()
export class PlatformActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ActivityLogMapperService,
  ) {}

  async record(input: ActivityLogRecordInput) {
    return this.prisma.platformActivityLog.create({
      data: {
        type: resolveActivityLogType(input.action, input.type),
        action: input.action,
        actorUserId: input.actorUserId || undefined,
        targetUserId: input.targetUserId || undefined,
        module: input.module || undefined,
        resourceType: input.resourceType || undefined,
        resourceId: input.resourceId || undefined,
        resourceTitle: input.resourceTitle || undefined,
        ip: input.ip || undefined,
        userAgent: input.userAgent || undefined,
        sessionId: input.sessionId || undefined,
        details: input.details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(options: ActivityLogFilters) {
    const { skip, take, search } = getPaginationOptions({
      ...options,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    const matchingUserIds = search
      ? (
          await this.prisma.user.findMany({
            where: {
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

    const where: Prisma.PlatformActivityLogWhereInput = {
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
      this.prisma.platformActivityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformActivityLog.count({ where }),
      this.prisma.platformActivityLog.groupBy({
        by: ['action'],
        _count: { _all: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.platformActivityLog.groupBy({
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
}
