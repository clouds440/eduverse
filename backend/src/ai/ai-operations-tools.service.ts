import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Prisma,
  PreferenceWindowStatus,
  Role,
  TargetType,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

const ORG_OVERSIGHT_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER]);
const ORG_STAFF_TARGET_ROLES = new Set<string>([
  Role.ORG_ADMIN,
  Role.SUB_ADMIN,
  Role.ORG_MANAGER,
  Role.TEACHER,
  Role.FINANCE_MANAGER,
]);

interface OperationsToolInput {
  search?: string;
  include?: string[];
  days?: number;
  limit?: number;
}

@Injectable()
export class AIOperationsToolsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.register(
      'getOperationsContext',
      'Generic operations context tool. Accepts include array values calendar, campus, announcements, preferences, or all, plus search/days/limit. Returns organization operational context across events, academic calendar, rooms/buildings, announcements, and course/section polling.',
      (input, context) => this.getOperationsContext(context, parseInput(input)),
    );
    this.register(
      'getAcademicCalendarSummary',
      'Return academic calendar context: active/upcoming academic cycles, holidays, events, closures, and active course/section preference windows.',
      (input, context) => this.getAcademicCalendarSummary(context, parseInput(input)),
    );
    this.register(
      'getCampusSpaceHelp',
      'Search campus buildings and rooms with capacity, directions, default sections, and scheduled usage. Use this for room/building/location questions.',
      (input, context) => this.getCampusSpaceHelp(context, parseInput(input)),
    );
    this.register(
      'getAnnouncementsSummary',
      'Return visible recent announcements for the current user, including role, org, course, section, and cohort announcements.',
      (input, context) => this.getAnnouncementsSummary(context, parseInput(input)),
    );
    this.register(
      'getPreferenceWindowHelp',
      'Return visible course/section preference polling windows, options, response counts, deadlines, and capacity/schedule warnings.',
      (input, context) => this.getPreferenceWindowHelp(context, parseInput(input)),
    );
  }

  private register(
    name: string,
    description: string,
    run: (input: unknown, context: AIToolContext) => Promise<AIToolResult<unknown>>,
  ) {
    this.toolRegistry.register({ name, description, run });
  }

  private async getOperationsContext(
    context: AIToolContext,
    input: OperationsToolInput,
  ): Promise<AIToolResult<unknown>> {
    const include = normalizedIncludes(input.include);
    const [calendar, campus, announcements, preferences] = await Promise.all([
      include.has('calendar') ? this.getAcademicCalendarSummary(context, input) : Promise.resolve(undefined),
      include.has('campus') ? this.getCampusSpaceHelp(context, input) : Promise.resolve(undefined),
      include.has('announcements') ? this.getAnnouncementsSummary(context, input) : Promise.resolve(undefined),
      include.has('preferences') ? this.getPreferenceWindowHelp(context, input) : Promise.resolve(undefined),
    ]);

    return {
      ok: true,
      data: {
        include: Array.from(include),
        calendar,
        campus,
        announcements,
        preferences,
      },
    };
  }

  private async getAcademicCalendarSummary(
    context: AIToolContext,
    input: OperationsToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const now = new Date();
    const end = addDays(now, Math.min(Math.max(input.days ?? 90, 1), 180));
    const limit = clampLimit(input.limit, 12);
    const searchWhere = textSearch(input.search, ['title', 'description']);
    const [cycles, holidays, preferenceWindows] = await Promise.all([
      this.prisma.academicCycle.findMany({
        where: {
          organizationId: context.orgId,
          OR: [
            { isActive: true },
            { endDate: { gte: now } },
          ],
        },
        take: limit,
        orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }],
        select: { id: true, name: true, code: true, startDate: true, endDate: true, isActive: true },
      }),
      this.prisma.holiday.findMany({
        where: {
          organizationId: context.orgId,
          isActive: true,
          startDate: { lte: end },
          endDate: { gte: now },
          ...searchWhere,
        },
        take: limit,
        include: {
          departmentLinks: { include: { department: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
      }),
      this.prisma.preferenceWindow.findMany({
        where: {
          organizationId: context.orgId,
          status: { in: [PreferenceWindowStatus.ACTIVE, PreferenceWindowStatus.CLOSED] },
          endAt: { gte: now },
        },
        take: limit,
        include: {
          academicCycle: { select: { id: true, name: true, code: true } },
          _count: { select: { options: true, audiences: true, submissions: true } },
        },
        orderBy: { endAt: 'asc' },
      }),
    ]);

    return {
      ok: true,
      data: {
        range: { startDate: dateKey(now), endDate: dateKey(end) },
        academicCycles: cycles.map((cycle) => ({
          academicCycleId: cycle.id,
          name: cycle.name,
          code: cycle.code,
          isActive: cycle.isActive,
          startDate: dateKey(cycle.startDate),
          endDate: dateKey(cycle.endDate),
        })),
        calendarItems: holidays.map((holiday) => ({
          calendarItemId: holiday.id,
          title: holiday.title,
          description: holiday.description,
          type: holiday.type,
          matchMode: holiday.matchMode,
          startDate: dateKey(holiday.startDate),
          endDate: dateKey(holiday.endDate),
          startTime: holiday.startTime,
          endTime: holiday.endTime,
          isFullDay: holiday.isFullDay,
          departmentScopeType: holiday.departmentScopeType,
          departments: holiday.departmentLinks.map((entry) => ({
            departmentId: entry.department.id,
            name: entry.department.name,
            code: entry.department.code,
          })),
        })),
        preferenceWindows: preferenceWindows.map((window) => ({
          preferenceWindowId: window.id,
          title: window.title,
          kind: window.kind,
          status: window.status,
          academicCycle: window.academicCycle.name,
          startAt: window.startAt.toISOString(),
          endAt: window.endAt.toISOString(),
          options: window._count.options,
          audiences: window._count.audiences,
          submissions: window._count.submissions,
          href: `/preference-windows/${window.id}`,
        })),
      },
    };
  }

  private async getCampusSpaceHelp(
    context: AIToolContext,
    input: OperationsToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const search = input.search?.trim();
    const limit = clampLimit(input.limit, 8);
    const buildingWhere: Prisma.BuildingWhereInput = {
      organizationId: context.orgId,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { address: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { landmark: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { directionsNote: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { rooms: { some: { isActive: true, OR: roomSearch(search) } } },
            ],
          }
        : {}),
    };

    const buildings = await this.prisma.building.findMany({
      where: buildingWhere,
      take: limit,
      include: {
        rooms: {
          where: {
            isActive: true,
            ...(search ? { OR: roomSearch(search) } : {}),
          },
          take: search ? 10 : 5,
          include: {
            defaultSections: {
              select: {
                id: true,
                name: true,
                course: { select: { id: true, name: true, code: true } },
                _count: { select: { enrollments: true } },
              },
              take: 5,
            },
            schedules: {
              select: {
                id: true,
                day: true,
                startTime: true,
                endTime: true,
                section: { select: { id: true, name: true, course: { select: { name: true } } } },
              },
              orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
              take: 6,
            },
          },
          orderBy: [{ floor: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        },
        _count: { select: { rooms: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return {
      ok: true,
      data: {
        buildings: buildings.map((building) => ({
          buildingId: building.id,
          name: building.name,
          code: building.code,
          address: building.address,
          landmark: building.landmark,
          directionsNote: building.directionsNote,
          totalRooms: building._count.rooms,
          rooms: building.rooms.map((room) => ({
            roomId: room.id,
            name: room.name,
            code: room.code,
            floor: room.floor,
            type: room.type,
            capacity: room.capacity,
            landmark: room.landmark,
            directionsNote: room.directionsNote,
            defaultSections: room.defaultSections.map((section) => ({
              sectionId: section.id,
              sectionName: section.name,
              courseName: section.course.name,
              enrolledStudents: section._count.enrollments,
              capacityWarning: room.capacity && section._count.enrollments > room.capacity
                ? `Enrollment ${section._count.enrollments} exceeds room capacity ${room.capacity}.`
                : null,
            })),
            schedules: room.schedules.map((schedule) => ({
              scheduleId: schedule.id,
              day: dayLabel(schedule.day),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              sectionId: schedule.section.id,
              sectionName: schedule.section.name,
              courseName: schedule.section.course.name,
            })),
          })),
        })),
      },
    };
  }

  private async getAnnouncementsSummary(
    context: AIToolContext,
    input: OperationsToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const targetWhere = await this.announcementVisibility(context);
    const since = addDays(new Date(), -Math.min(Math.max(input.days ?? 30, 1), 180));
    const announcements = await this.prisma.announcement.findMany({
      where: {
        AND: [
          { OR: targetWhere },
          { createdAt: { gte: since } },
          input.search ? textSearch(input.search, ['title', 'body']) : {},
        ],
      },
      take: clampLimit(input.limit, 12),
      include: { creator: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      ok: true,
      data: {
        announcements: announcements.map((announcement) => ({
          announcementId: announcement.id,
          title: announcement.title,
          summary: announcement.body.slice(0, 360),
          priority: announcement.priority,
          targetType: announcement.targetType,
          targetId: announcement.targetId,
          actionUrl: announcement.actionUrl,
          createdAt: announcement.createdAt.toISOString(),
          creator: announcement.creator?.name ?? announcement.creator?.email ?? null,
        })),
      },
    };
  }

  private async getPreferenceWindowHelp(
    context: AIToolContext,
    input: OperationsToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const limit = clampLimit(input.limit, 8);
    const where: Prisma.PreferenceWindowWhereInput = {
      organizationId: context.orgId,
      status: { in: [PreferenceWindowStatus.ACTIVE, PreferenceWindowStatus.CLOSED] },
      ...(input.search ? textSearch(input.search, ['title', 'description']) : {}),
    };

    const windows = await this.prisma.preferenceWindow.findMany({
      where,
      take: limit,
      include: {
        academicCycle: { select: { id: true, name: true, code: true } },
        options: {
          include: {
            course: { select: { id: true, name: true, code: true } },
            section: {
              select: {
                id: true,
                name: true,
                code: true,
                defaultRoom: { select: { id: true, name: true, capacity: true, building: { select: { name: true } } } },
                _count: { select: { enrollments: true, schedules: true } },
                course: { select: { id: true, name: true, code: true } },
              },
            },
            _count: { select: { ranks: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: { select: { audiences: true, submissions: true } },
      },
      orderBy: { endAt: 'asc' },
    });

    return {
      ok: true,
      data: {
        windows: windows.map((window) => ({
          preferenceWindowId: window.id,
          title: window.title,
          description: window.description,
          kind: window.kind,
          status: window.status,
          academicCycle: window.academicCycle.name,
          startAt: window.startAt.toISOString(),
          endAt: window.endAt.toISOString(),
          audiences: window._count.audiences,
          submissions: window._count.submissions,
          href: `/preference-windows/${window.id}`,
          options: window.options.slice(0, 12).map((option) => {
            const section = option.section;
            const capacityWarning = section?.defaultRoom?.capacity && section._count.enrollments > section.defaultRoom.capacity
              ? `Enrollment ${section._count.enrollments} exceeds default room capacity ${section.defaultRoom.capacity}.`
              : null;
            const scheduleWarning = section && section._count.schedules === 0
              ? 'No schedule is configured for this section.'
              : null;
            return {
              optionId: option.id,
              targetType: option.targetType,
              course: option.course ? { courseId: option.course.id, name: option.course.name, code: option.course.code } : undefined,
              section: section ? {
                sectionId: section.id,
                name: section.name,
                code: section.code,
                courseName: section.course.name,
                enrolledStudents: section._count.enrollments,
                schedules: section._count.schedules,
                room: section.defaultRoom
                  ? [section.defaultRoom.building?.name, section.defaultRoom.name].filter(Boolean).join(' - ')
                  : null,
              } : undefined,
              ranks: option._count.ranks,
              warnings: [capacityWarning, scheduleWarning].filter(Boolean),
            };
          }),
        })),
      },
    };
  }

  private async announcementVisibility(context: AIToolContext): Promise<Prisma.AnnouncementWhereInput[]> {
    const conditions: Prisma.AnnouncementWhereInput[] = [
      { targetType: TargetType.GLOBAL },
      { targetType: TargetType.ORG, organizationId: context.orgId },
      { targetType: TargetType.ROLE, targetId: context.role, organizationId: context.orgId },
    ];

    if (context.role && ORG_STAFF_TARGET_ROLES.has(context.role)) {
      conditions.push({ targetType: TargetType.ROLE, targetId: 'ORG_STAFF', organizationId: context.orgId });
    }

    if (context.role === Role.TEACHER || context.role === Role.ORG_MANAGER) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: context.userId, organizationId: context.orgId },
        select: { sections: { select: { id: true, courseId: true } } },
      });
      if (teacher?.sections.length) {
        conditions.push({ targetType: TargetType.SECTION, targetId: { in: teacher.sections.map((section) => section.id) } });
        conditions.push({ targetType: TargetType.COURSE, targetId: { in: unique(teacher.sections.map((section) => section.courseId)) } });
      }
    }

    if (context.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId: context.userId, organizationId: context.orgId },
        select: {
          cohortId: true,
          enrollments: { select: { sectionId: true, section: { select: { courseId: true } } } },
        },
      });
      if (student?.enrollments.length) {
        conditions.push({ targetType: TargetType.SECTION, targetId: { in: student.enrollments.map((entry) => entry.sectionId) } });
        conditions.push({ targetType: TargetType.COURSE, targetId: { in: unique(student.enrollments.map((entry) => entry.section.courseId)) } });
      }
      if (student?.cohortId) conditions.push({ targetType: TargetType.COHORT, targetId: student.cohortId });
    }

    if (ORG_OVERSIGHT_ROLES.has(context.role ?? '')) {
      conditions.push({ organizationId: context.orgId });
    }

    return conditions;
  }
}

function parseInput(input: unknown): OperationsToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    search: stringValue(value.search),
    include: stringArrayValue(value.include),
    days: numberValue(value.days),
    limit: numberValue(value.limit),
  };
}

function normalizedIncludes(include?: string[]) {
  const aliases = new Map<string, string>([
    ['event', 'calendar'],
    ['events', 'calendar'],
    ['holiday', 'calendar'],
    ['holidays', 'calendar'],
    ['academicCalendar', 'calendar'],
    ['room', 'campus'],
    ['rooms', 'campus'],
    ['building', 'campus'],
    ['buildings', 'campus'],
    ['polling', 'preferences'],
    ['polls', 'preferences'],
    ['preferenceWindows', 'preferences'],
  ]);
  const raw = include?.length ? include : ['all'];
  const normalized = new Set<string>();
  for (const item of raw) {
    const value = item.trim();
    const key = aliases.get(value) ?? value;
    if (key === 'all') {
      normalized.add('calendar');
      normalized.add('campus');
      normalized.add('announcements');
      normalized.add('preferences');
    } else if (['calendar', 'campus', 'announcements', 'preferences'].includes(key)) {
      normalized.add(key);
    }
  }
  if (!normalized.size) normalized.add('calendar');
  return normalized;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArrayValue(value: unknown) {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean) as string[];
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return undefined;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function clampLimit(limit = 10, max = 20) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(limit) ? limit : 10)));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dayLabel(day: number) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? `Day ${day}`;
}

function textSearch<T extends string>(search: string | undefined, fields: T[]) {
  if (!search?.trim()) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: search.trim(), mode: Prisma.QueryMode.insensitive },
    })),
  };
}

function roomSearch(search: string): Prisma.RoomWhereInput[] {
  return [
    { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { floor: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { landmark: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { directionsNote: { contains: search, mode: Prisma.QueryMode.insensitive } },
  ];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function permissionDenied(message: string): AIToolResult<unknown> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}
