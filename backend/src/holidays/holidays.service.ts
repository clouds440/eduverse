import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentScopeType, HolidayMatchMode, HolidayType, Prisma, TargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementPriority } from '../announcements/dto/create-announcement.dto';
import { Role } from '../common/enums';
import { assertDepartmentIdsBelongToOrg, assertDepartmentInScope, getDepartmentScope, type DepartmentScopedUser } from '../common/department-scope';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { buildHolidayOverlays, getCurrentWeekRange, toDateOnlyUtc, timeToMinutes, type TimetableSlotLike } from './holiday-matcher';

interface CurrentUser extends DepartmentScopedUser {
  id: string;
  role?: string;
  organizationId?: string | null;
  name?: string | null;
  email?: string | null;
}

interface HolidayQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: HolidayType;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}

@Injectable()
export class HolidaysService {
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
  } satisfies Prisma.HolidayInclude;

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

  private async validatePayload(
    orgId: string,
    dto: CreateHolidayDto | UpdateHolidayDto,
    actor: CurrentUser,
    existing?: { startDate: Date; endDate: Date; matchMode: HolidayMatchMode; isFullDay: boolean; startTime: string | null; endTime: string | null; departmentScopeType: DepartmentScopeType },
  ) {
    const matchMode = dto.matchMode ?? existing?.matchMode ?? HolidayMatchMode.SINGLE_DAY;
    const isFullDay = dto.isFullDay ?? existing?.isFullDay ?? true;
    const startDate = dto.startDate ? this.parseDate(dto.startDate, 'startDate') : existing?.startDate;
    if (!startDate) throw new BadRequestException('startDate is required');

    const endDate = dto.endDate
      ? this.parseDate(dto.endDate, 'endDate')
      : matchMode === HolidayMatchMode.SINGLE_DAY
        ? startDate
        : existing?.endDate || startDate;

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be after or equal to startDate');
    }

    const startTime = isFullDay ? null : this.normalizeTime(dto.startTime ?? existing?.startTime);
    const endTime = isFullDay ? null : this.normalizeTime(dto.endTime ?? existing?.endTime);
    if (!isFullDay) {
      if (!startTime || !endTime) throw new BadRequestException('startTime and endTime are required for partial-day holidays');
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }

    const daysOfWeek = dto.daysOfWeek ? Array.from(new Set(dto.daysOfWeek)).sort((a, b) => a - b) : [];
    if (matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE && daysOfWeek.length === 0) {
      throw new BadRequestException('daysOfWeek is required for selected weekdays in range');
    }

    const departmentScopeType = dto.departmentScopeType ?? existing?.departmentScopeType ?? DepartmentScopeType.ALL;
    const departmentIds = await assertDepartmentIdsBelongToOrg(this.prisma, orgId, dto.departmentIds || []);

    if (departmentScopeType === DepartmentScopeType.SELECTED && departmentIds.length === 0 && !existing) {
      throw new BadRequestException('Select at least one department or choose all departments');
    }

    const actorScope = await getDepartmentScope(this.prisma, orgId, actor);
    if (departmentScopeType === DepartmentScopeType.ALL) {
      if (actor.role === Role.SUB_ADMIN && actorScope.applies && !actorScope.all) {
        throw new ForbiddenException('Sub Admins with selected department access must choose departments in their scope');
      }
    } else {
      departmentIds.forEach((departmentId) => {
        assertDepartmentInScope(actorScope, departmentId, 'You can only assign holidays to departments in your scope');
      });
    }

    return {
      matchMode,
      isFullDay,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek: matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE ? daysOfWeek : [],
      departmentScopeType,
      departmentIds,
    };
  }

  private buildAnnouncementBody(holiday: { title: string; description?: string | null; startDate: Date; endDate: Date; isFullDay: boolean; startTime?: string | null; endTime?: string | null }) {
    const dates = holiday.startDate.getTime() === holiday.endDate.getTime()
      ? holiday.startDate.toISOString().slice(0, 10)
      : `${holiday.startDate.toISOString().slice(0, 10)} to ${holiday.endDate.toISOString().slice(0, 10)}`;
    const time = holiday.isFullDay ? 'Full day' : `${holiday.startTime} - ${holiday.endTime}`;
    return [holiday.description, `Date: ${dates}`, `Time: ${time}`].filter(Boolean).join('\n\n');
  }

  private async maybeAnnounce(dto: CreateHolidayDto | UpdateHolidayDto, holiday: { id: string; title: string; description?: string | null; startDate: Date; endDate: Date; isFullDay: boolean; startTime?: string | null; endTime?: string | null }, actor: CurrentUser) {
    if (!dto.announce) return null;
    const targetType = dto.announcementTargetType || TargetType.ORG;
    return this.announcementsService.createAnnouncement({
      title: holiday.title,
      body: this.buildAnnouncementBody(holiday),
      targetType,
      targetId: dto.announcementTargetId || (targetType === TargetType.ORG ? actor.organizationId || undefined : undefined),
      actionUrl: '/holidays',
      priority: dto.announcementPriority || AnnouncementPriority.NORMAL,
    }, {
      id: actor.id,
      role: actor.role as Role,
      organizationId: actor.organizationId || null,
    });
  }

  private scopedWhere(orgId: string, actor?: CurrentUser): Prisma.HolidayWhereInput {
    return { organizationId: orgId };
  }

  async createHoliday(orgId: string, dto: CreateHolidayDto, actor: CurrentUser) {
    const normalized = await this.validatePayload(orgId, dto, actor);
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('title is required');

    const holiday = await this.prisma.holiday.create({
      data: {
        organizationId: orgId,
        title,
        description: dto.description?.trim() || null,
        type: dto.type || HolidayType.HOLIDAY,
        matchMode: normalized.matchMode,
        departmentScopeType: normalized.departmentScopeType,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        daysOfWeek: normalized.daysOfWeek,
        isFullDay: normalized.isFullDay,
        isActive: dto.isActive ?? true,
        createdById: actor.id,
        departmentLinks: normalized.departmentScopeType === DepartmentScopeType.SELECTED
          ? { create: normalized.departmentIds.map((departmentId) => ({ departmentId })) }
          : undefined,
      },
      include: this.includeRelations,
    });

    await this.maybeAnnounce(dto, holiday, actor);
    return holiday;
  }

  async getHolidays(orgId: string, query: HolidayQuery, actor?: CurrentUser) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      page: query.page,
      limit: query.limit,
      sortBy: 'startDate',
      sortOrder: 'asc',
    });

    const start = query.startDate ? this.parseDate(query.startDate, 'startDate') : undefined;
    const end = query.endDate ? this.parseDate(query.endDate, 'endDate') : undefined;

    const where: Prisma.HolidayWhereInput = {
      ...this.scopedWhere(orgId, actor),
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
      this.prisma.holiday.findMany({
        where,
        include: this.includeRelations,
        skip,
        take,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: 'desc' }],
      }),
      this.prisma.holiday.count({ where }),
    ]);

    return formatPaginatedResponse(data, totalRecords, query.page, query.limit);
  }

  async getHoliday(orgId: string, id: string) {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id, organizationId: orgId },
      include: this.includeRelations,
    });
    if (!holiday) throw new NotFoundException('Holiday not found');
    return holiday;
  }

  async updateHoliday(orgId: string, id: string, dto: UpdateHolidayDto, actor: CurrentUser) {
    const existing = await this.prisma.holiday.findFirst({
      where: { id, organizationId: orgId },
      include: { departmentLinks: true },
    });
    if (!existing) throw new NotFoundException('Holiday not found');

    const dtoForValidation = {
      ...dto,
      departmentIds: dto.departmentIds ?? existing.departmentLinks.map((link) => link.departmentId),
    };
    const normalized = await this.validatePayload(orgId, dtoForValidation, actor, existing);

    const holiday = await this.prisma.$transaction(async (tx) => {
      if (dto.departmentScopeType !== undefined || dto.departmentIds !== undefined) {
        await tx.holidayDepartment.deleteMany({ where: { holidayId: id } });
      }

      return tx.holiday.update({
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

    await this.maybeAnnounce(dto, holiday, actor);
    return holiday;
  }

  async setHolidayActive(orgId: string, id: string, isActive: boolean, actor: CurrentUser) {
    await this.getHoliday(orgId, id);
    return this.prisma.holiday.update({
      where: { id },
      data: { isActive, updatedById: actor.id },
      include: this.includeRelations,
    });
  }

  async deleteHoliday(orgId: string, id: string) {
    await this.getHoliday(orgId, id);
    return this.prisma.holiday.delete({ where: { id } });
  }

  async getActiveHolidaysForRange(orgId: string, startDate: Date, endDate: Date) {
    return this.prisma.holiday.findMany({
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
    const holidays = await this.getActiveHolidaysForRange(orgId, start, end);
    const overlays = buildHolidayOverlays(holidays, schedules, start, end);
    return { schedules, holidays, overlays, range: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) } };
  }
}
