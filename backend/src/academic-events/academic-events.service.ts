import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicEventMatchMode, AcademicEventType, DepartmentScopeType, Prisma, TargetType } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementPriority } from '../announcements/dto/create-announcement.dto';
import { Role } from '../common/enums';
import { assertDepartmentIdsBelongToOrg, assertDepartmentInScope, getDepartmentScope, type DepartmentScopedUser } from '../common/department-scope';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { CreateAcademicEventDto } from './dto/create-academic-event.dto';
import { UpdateAcademicEventDto } from './dto/update-academic-event.dto';
import { buildAcademicEventOverlays, getCurrentWeekRange, toDateOnlyUtc, timeToMinutes, type TimetableSlotLike } from './academic-event-matcher';

interface CurrentUser extends DepartmentScopedUser {
  id: string;
  role?: string;
  organizationId?: string | null;
  name?: string | null;
  email?: string | null;
}

interface AcademicEventQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: AcademicEventType;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}

type ExistingScope = {
  departmentScopeType: DepartmentScopeType;
  departmentLinks: { departmentId: string }[];
};

@Injectable()
export class AcademicEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  private includeRelations = {
    createdBy: { select: { id: true, name: true, email: true } },
    updatedBy: { select: { id: true, name: true, email: true } },
    departmentLinks: {
      include: {
        department: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
    },
  } satisfies Prisma.AcademicEventInclude;

  private parseDate(value: string, field: string) {
    const date = toDateOnlyUtc(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }

  private normalizeTime(value?: string | null) {
    if (!value) return null;
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException('Time must use HH:mm format');
    }
    const [hours, minutes] = value.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new BadRequestException('Time must be a valid HH:mm value');
    }
    return value;
  }

  private bannerData(dto: CreateAcademicEventDto | UpdateAcademicEventDto) {
    if (
      dto.bannerFileId === undefined &&
      dto.bannerUrl === undefined &&
      dto.bannerFilename === undefined &&
      dto.bannerMimeType === undefined
    ) {
      return {};
    }

    const bannerUrl = dto.bannerUrl?.trim() || null;
    return {
      bannerFileId: dto.bannerFileId?.trim() || null,
      bannerUrl,
      bannerFilename: dto.bannerFilename?.trim() || null,
      bannerMimeType: dto.bannerMimeType?.trim() || null,
      bannerUpdatedAt: bannerUrl ? new Date() : null,
    };
  }

  private async assertCanManageScope(orgId: string, actor: CurrentUser, scope: ExistingScope) {
    const actorScope = await getDepartmentScope(this.prisma, orgId, actor);
    if (actor.role !== Role.SUB_ADMIN || !actorScope.applies || actorScope.all) return;

    if (scope.departmentScopeType === DepartmentScopeType.ALL) {
      throw new ForbiddenException('You can only manage academic events assigned to departments in your scope');
    }

    scope.departmentLinks.forEach((link) => {
      assertDepartmentInScope(actorScope, link.departmentId, 'You can only manage academic events assigned to departments in your scope');
    });
  }

  private async validatePayload(
    orgId: string,
    dto: CreateAcademicEventDto | UpdateAcademicEventDto,
    actor: CurrentUser,
    existing?: {
      startDate: Date;
      endDate: Date;
      matchMode: AcademicEventMatchMode;
      isFullDay: boolean;
      startTime: string | null;
      endTime: string | null;
      departmentScopeType: DepartmentScopeType;
      departmentLinks?: { departmentId: string }[];
    },
  ) {
    const matchMode = dto.matchMode ?? existing?.matchMode ?? AcademicEventMatchMode.SINGLE_DAY;
    const isFullDay = dto.isFullDay ?? existing?.isFullDay ?? true;
    const startDate = dto.startDate ? this.parseDate(dto.startDate, 'startDate') : existing?.startDate;
    if (!startDate) throw new BadRequestException('startDate is required');

    const endDate = dto.endDate
      ? this.parseDate(dto.endDate, 'endDate')
      : matchMode === AcademicEventMatchMode.SINGLE_DAY
        ? startDate
        : existing?.endDate || startDate;

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be after or equal to startDate');
    }

    const startTime = isFullDay ? null : this.normalizeTime(dto.startTime ?? existing?.startTime);
    const endTime = isFullDay ? null : this.normalizeTime(dto.endTime ?? existing?.endTime);
    if (!isFullDay) {
      if (!startTime || !endTime) throw new BadRequestException('startTime and endTime are required for partial-day academic events');
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }

    const daysOfWeek = dto.daysOfWeek ? Array.from(new Set(dto.daysOfWeek)).sort((a, b) => a - b) : [];
    if (matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE && daysOfWeek.length === 0) {
      throw new BadRequestException('daysOfWeek is required for selected weekdays in range');
    }

    const departmentScopeType = dto.departmentScopeType ?? existing?.departmentScopeType ?? DepartmentScopeType.ALL;
    const fallbackDepartmentIds = existing?.departmentLinks?.map((link) => link.departmentId) || [];
    const departmentIds = await assertDepartmentIdsBelongToOrg(this.prisma, orgId, dto.departmentIds ?? fallbackDepartmentIds);

    if (departmentScopeType === DepartmentScopeType.SELECTED && departmentIds.length === 0) {
      throw new BadRequestException('Select at least one department or choose all departments');
    }

    const actorScope = await getDepartmentScope(this.prisma, orgId, actor);
    if (departmentScopeType === DepartmentScopeType.ALL) {
      if (actor.role === Role.SUB_ADMIN && actorScope.applies && !actorScope.all) {
        throw new ForbiddenException('Sub Admins with selected department access must choose departments in their scope');
      }
    } else {
      departmentIds.forEach((departmentId) => {
        assertDepartmentInScope(actorScope, departmentId, 'You can only assign academic events to departments in your scope');
      });
    }

    return {
      matchMode,
      isFullDay,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek: matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE ? daysOfWeek : [],
      departmentScopeType,
      departmentIds,
    };
  }

  private buildAnnouncementBody(event: { description?: string | null; startDate: Date; endDate: Date; isFullDay: boolean; startTime?: string | null; endTime?: string | null }) {
    const dates = event.startDate.getTime() === event.endDate.getTime()
      ? event.startDate.toISOString().slice(0, 10)
      : `${event.startDate.toISOString().slice(0, 10)} to ${event.endDate.toISOString().slice(0, 10)}`;
    const time = event.isFullDay ? 'Full day' : `${event.startTime} - ${event.endTime}`;
    return [event.description, `Date: ${dates}`, `Time: ${time}`].filter(Boolean).join('\n\n');
  }

  private async maybeAnnounce(
    dto: CreateAcademicEventDto | UpdateAcademicEventDto,
    event: {
      id: string;
      title: string;
      description?: string | null;
      startDate: Date;
      endDate: Date;
      isFullDay: boolean;
      startTime?: string | null;
      endTime?: string | null;
      bannerUrl?: string | null;
      bannerFileId?: string | null;
      bannerFilename?: string | null;
      bannerMimeType?: string | null;
      bannerUpdatedAt?: Date | null;
    },
    actor: CurrentUser,
  ) {
    if (!dto.announce) return null;
    const targetType = dto.announcementTargetType || TargetType.ORG;
    return this.announcementsService.createAnnouncement({
      title: event.title,
      body: this.buildAnnouncementBody(event),
      targetType,
      targetId: dto.announcementTargetId || (targetType === TargetType.ORG ? actor.organizationId || undefined : undefined),
      actionUrl: '/academic-calendar',
      priority: dto.announcementPriority || AnnouncementPriority.NORMAL,
      bannerUrl: event.bannerUrl || undefined,
      bannerFileId: event.bannerFileId || undefined,
      bannerFilename: event.bannerFilename || undefined,
      bannerMimeType: event.bannerMimeType || undefined,
      bannerUpdatedAt: event.bannerUpdatedAt || undefined,
    }, {
      id: actor.id,
      role: actor.role as Role,
      organizationId: actor.organizationId || null,
    });
  }

  private scopedWhere(orgId: string): Prisma.AcademicEventWhereInput {
    return { organizationId: orgId };
  }

  async createAcademicEvent(orgId: string, dto: CreateAcademicEventDto, actor: CurrentUser) {
    const normalized = await this.validatePayload(orgId, dto, actor);
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('title is required');

    const event = await this.prisma.academicEvent.create({
      data: {
        organizationId: orgId,
        title,
        description: dto.description?.trim() || null,
        type: dto.type || AcademicEventType.HOLIDAY,
        matchMode: normalized.matchMode,
        departmentScopeType: normalized.departmentScopeType,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        daysOfWeek: normalized.daysOfWeek,
        ...this.bannerData(dto),
        isFullDay: normalized.isFullDay,
        isActive: dto.isActive ?? true,
        createdById: actor.id,
        departmentLinks: normalized.departmentScopeType === DepartmentScopeType.SELECTED
          ? { create: normalized.departmentIds.map((departmentId) => ({ departmentId })) }
          : undefined,
      },
      include: this.includeRelations,
    });

    await this.maybeAnnounce(dto, event, actor);
    return event;
  }

  async getAcademicEvents(orgId: string, query: AcademicEventQuery, actor?: CurrentUser) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      page: query.page,
      limit: query.limit,
      sortBy: 'startDate',
      sortOrder: 'asc',
    });

    const start = query.startDate ? this.parseDate(query.startDate, 'startDate') : undefined;
    const end = query.endDate ? this.parseDate(query.endDate, 'endDate') : undefined;

    const where: Prisma.AcademicEventWhereInput = {
      ...this.scopedWhere(orgId),
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(start || end
        ? {
            startDate: end ? { lte: end } : undefined,
            endDate: start ? { gte: start } : undefined,
          }
        : {}),
      ...(query.departmentId
        ? {
            OR: [
              { departmentScopeType: DepartmentScopeType.ALL },
              { departmentLinks: { some: { departmentId: query.departmentId } } },
            ],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [data, totalRecords] = await Promise.all([
      this.prisma.academicEvent.findMany({
        where,
        include: this.includeRelations,
        skip,
        take,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: 'desc' }],
      }),
      this.prisma.academicEvent.count({ where }),
    ]);

    return formatPaginatedResponse(data, totalRecords, query.page, query.limit);
  }

  async getAcademicEvent(orgId: string, id: string) {
    const event = await this.prisma.academicEvent.findFirst({
      where: { id, organizationId: orgId },
      include: this.includeRelations,
    });
    if (!event) throw new NotFoundException('Academic event not found');
    return event;
  }

  async updateAcademicEvent(orgId: string, id: string, dto: UpdateAcademicEventDto, actor: CurrentUser) {
    const existing = await this.prisma.academicEvent.findFirst({
      where: { id, organizationId: orgId },
      include: { departmentLinks: true },
    });
    if (!existing) throw new NotFoundException('Academic event not found');
    await this.assertCanManageScope(orgId, actor, existing);

    const normalized = await this.validatePayload(orgId, dto, actor, existing);

    const event = await this.prisma.$transaction(async (tx) => {
      if (dto.departmentScopeType !== undefined || dto.departmentIds !== undefined) {
        await tx.academicEventDepartment.deleteMany({ where: { academicEventId: id } });
      }

      return tx.academicEvent.update({
        where: { id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          type: dto.type,
          matchMode: normalized.matchMode,
          departmentScopeType: normalized.departmentScopeType,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          startTime: normalized.startTime,
          endTime: normalized.endTime,
          daysOfWeek: normalized.daysOfWeek,
          ...this.bannerData(dto),
          isFullDay: normalized.isFullDay,
          isActive: dto.isActive,
          updatedById: actor.id,
          departmentLinks: normalized.departmentScopeType === DepartmentScopeType.SELECTED && (dto.departmentScopeType !== undefined || dto.departmentIds !== undefined)
            ? { create: normalized.departmentIds.map((departmentId) => ({ departmentId })) }
            : undefined,
        },
        include: this.includeRelations,
      });
    });

    await this.maybeAnnounce(dto, event, actor);
    return event;
  }

  async setAcademicEventActive(orgId: string, id: string, isActive: boolean, actor: CurrentUser) {
    const event = await this.prisma.academicEvent.findFirst({
      where: { id, organizationId: orgId },
      include: { departmentLinks: true },
    });
    if (!event) throw new NotFoundException('Academic event not found');
    await this.assertCanManageScope(orgId, actor, event);

    return this.prisma.academicEvent.update({
      where: { id },
      data: { isActive, updatedById: actor.id },
      include: this.includeRelations,
    });
  }

  async deleteAcademicEvent(orgId: string, id: string, actor: CurrentUser) {
    const event = await this.prisma.academicEvent.findFirst({
      where: { id, organizationId: orgId },
      include: { departmentLinks: true },
    });
    if (!event) throw new NotFoundException('Academic event not found');
    await this.assertCanManageScope(orgId, actor, event);

    return this.prisma.academicEvent.delete({ where: { id } });
  }

  async getActiveAcademicEventsForRange(orgId: string, startDate: Date, endDate: Date) {
    return this.prisma.academicEvent.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: this.includeRelations,
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async buildTimetableResponse(orgId: string, schedules: TimetableSlotLike[], range?: { startDate?: string; endDate?: string }) {
    const fallback = getCurrentWeekRange();
    const start = range?.startDate ? this.parseDate(range.startDate, 'startDate') : fallback.start;
    const end = range?.endDate ? this.parseDate(range.endDate, 'endDate') : fallback.end;
    const academicEvents = await this.getActiveAcademicEventsForRange(orgId, start, end);
    const overlays = buildAcademicEventOverlays(academicEvents, schedules, start, end);
    return { schedules, academicEvents, overlays, range: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) } };
  }
}
