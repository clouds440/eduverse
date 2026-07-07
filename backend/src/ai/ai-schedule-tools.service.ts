import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, Role } from '@/prisma/prisma-client';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

interface ScheduleToolInput {
  date?: string;
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  limit?: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STAFF_SCHEDULE_ROLES = new Set<string>([
  Role.ORG_ADMIN,
  Role.SUB_ADMIN,
  Role.ORG_MANAGER,
  Role.TEACHER,
]);
const SCHEDULE_BOTTLENECK_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER]);

@Injectable()
export class AIScheduleToolsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.toolRegistry.register({
      name: 'getMyTodaySchedule',
      description: 'Return the current user schedule for today.',
      run: async (input: unknown, context) => this.getMyScheduleForDate(context, parseInput(input).date ?? dateKey(new Date())),
    });

    this.toolRegistry.register({
      name: 'getMyTomorrowSchedule',
      description: 'Return the current user schedule for tomorrow.',
      run: async (_input: unknown, context) => {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        return this.getMyScheduleForDate(context, dateKey(tomorrow));
      },
    });

    this.toolRegistry.register({
      name: 'getMyWeeklySchedule',
      description: 'Return the current user schedule for a week range.',
      run: async (input: unknown, context) => {
        const parsed = parseInput(input);
        const startDate = parsed.startDate ?? dateKey(startOfWeek(new Date()));
        const endDate = parsed.endDate ?? dateKey(addDays(parseDateOnly(startDate), 6));
        return this.getMySchedule(context, { startDate, endDate }, parsed.limit);
      },
    });

    this.toolRegistry.register({
      name: 'getNextClass',
      description: 'Return the next scheduled class for the current user.',
      run: async (_input: unknown, context) => this.getNextClass(context),
    });

    this.toolRegistry.register({
      name: 'getTeacherScheduleLoad',
      description: 'Summarize weekly teaching load by teacher.',
      run: async (input: unknown, context) => this.getTeacherScheduleLoad(context, parseInput(input)),
    });

    this.toolRegistry.register({
      name: 'getScheduleBottlenecks',
      description: 'Summarize schedule bottlenecks such as overloaded teachers, unscheduled sections, and heavily used rooms.',
      run: async (input: unknown, context) => this.getScheduleBottlenecks(context, parseInput(input)),
    });
  }

  private async getMyScheduleForDate(
    context: AIToolContext,
    date: string,
  ): Promise<AIToolResult<{ range: unknown; schedules: unknown[] }>> {
    return this.getMySchedule(context, { date });
  }

  private async getMySchedule(
    context: AIToolContext,
    query: { date?: string; startDate?: string; endDate?: string },
    limit = 30,
  ): Promise<AIToolResult<{ range: unknown; schedules: unknown[] }>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const timetable = await this.attendanceService.getTimetable(
      context.orgId,
      actorForScopedServices(context),
      query,
    );

    return {
      ok: true,
      data: {
        range: timetable.range,
        schedules: timetable.schedules.slice(0, clampLimit(limit, 50)).map(compactSchedule),
      },
    };
  }

  private async getNextClass(context: AIToolContext): Promise<AIToolResult<{ nextClass: unknown | null }>> {
    const start = new Date();
    const rangeStart = dateKey(start);
    const rangeEnd = dateKey(addDays(start, 14));
    const timetable = await this.attendanceService.getTimetable(
      context.orgId,
      actorForScopedServices(context),
      { startDate: rangeStart, endDate: rangeEnd },
    );
    const nowMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
    const today = dateKey(start);

    const nextClass = timetable.schedules
      .map((schedule: any) => ({ ...schedule, occurrenceDate: schedule.date ?? occurrenceDateForDay(start, schedule.day) }))
      .filter((schedule: any) => schedule.occurrenceDate > today || timeToMinutes(schedule.startTime) >= nowMinutes)
      .sort((a: any, b: any) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.startTime.localeCompare(b.startTime))[0];

    return {
      ok: true,
      data: { nextClass: nextClass ? compactSchedule(nextClass) : null },
    };
  }

  private async getTeacherScheduleLoad(
    context: AIToolContext,
    input: ScheduleToolInput,
  ): Promise<AIToolResult<{ teachers: unknown[] }>> {
    if (!STAFF_SCHEDULE_ROLES.has(context.role ?? '')) {
      return permissionDenied('Teacher schedule load is available to staff roles only.');
    }

    const teacherWhere = await this.teacherScopeWhere(context, input.teacherId);
    const schedules = await this.prisma.sectionSchedule.groupBy({
      by: ['teacherId'],
      where: {
        section: { organizationId: context.orgId },
        teacher: teacherWhere,
        date: null,
      },
      _count: { id: true },
    });
    const teacherIds = schedules.map((row) => row.teacherId);
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));

    return {
      ok: true,
      data: {
        teachers: schedules
          .map((row) => {
            const teacher = teacherMap.get(row.teacherId);
            return {
              teacherId: row.teacherId,
              userId: teacher?.userId ?? null,
              name: teacher?.user?.name ?? teacher?.user?.email ?? 'Unknown teacher',
              weeklySlots: row._count.id,
              loadLevel: row._count.id >= 15 ? 'high' : row._count.id >= 10 ? 'moderate' : 'normal',
            };
          })
          .sort((a, b) => b.weeklySlots - a.weeklySlots),
      },
    };
  }

  private async getScheduleBottlenecks(
    context: AIToolContext,
    input: ScheduleToolInput,
  ): Promise<AIToolResult<{ overloadedTeachers: unknown[]; unscheduledSections: unknown[]; heavilyUsedRooms: unknown[] }>> {
    if (!SCHEDULE_BOTTLENECK_ROLES.has(context.role ?? '')) {
      return permissionDenied('Schedule bottlenecks are available to admins and managers only.');
    }

    const teacherLoad = await this.getTeacherScheduleLoad(context, input);
    const teacherRows = teacherLoad.ok ? (teacherLoad.data?.teachers as Array<any> ?? []) : [];
    const sectionWhere = await this.sectionScopeWhere(context);
    const [unscheduledSections, roomRows] = await Promise.all([
      this.prisma.section.findMany({
        where: {
          organizationId: context.orgId,
          ...sectionWhere,
          schedules: { none: {} },
        },
        take: clampLimit(input.limit, 10),
        include: { course: { select: { id: true, name: true } } },
        orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.sectionSchedule.groupBy({
        by: ['roomId'],
        where: {
          section: { organizationId: context.orgId, ...sectionWhere },
          roomId: { not: null },
          date: null,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);
    const roomIds = roomRows.map((row) => row.roomId).filter(Boolean) as string[];
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: roomIds } },
      include: { building: { select: { name: true } } },
    });
    const roomMap = new Map(rooms.map((room) => [room.id, room]));

    return {
      ok: true,
      data: {
        overloadedTeachers: teacherRows.filter((row) => row.weeklySlots >= 15).slice(0, 10),
        unscheduledSections: unscheduledSections.map((section) => ({
          sectionId: section.id,
          sectionName: section.name,
          courseName: section.course.name,
          href: `/sections/${section.id}`,
        })),
        heavilyUsedRooms: roomRows.map((row) => {
          const room = row.roomId ? roomMap.get(row.roomId) : null;
          return {
            roomId: row.roomId,
            room: room ? [room.building?.name, room.name].filter(Boolean).join(' - ') : 'Unassigned room',
            weeklySlots: row._count.id,
          };
        }),
      },
    };
  }

  private async teacherScopeWhere(context: AIToolContext, teacherId?: string): Promise<Prisma.TeacherWhereInput> {
    if (context.role === Role.TEACHER || context.role === Role.ORG_MANAGER) {
      return { userId: context.userId, organizationId: context.orgId };
    }

    return {
      organizationId: context.orgId,
      ...(teacherId ? { id: teacherId } : {}),
    };
  }

  private async sectionScopeWhere(context: AIToolContext): Promise<Prisma.SectionWhereInput> {
    if (context.role === Role.ORG_MANAGER) {
      return { teachers: { some: { userId: context.userId } } };
    }
    return {};
  }
}

function parseInput(input: unknown): ScheduleToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    date: stringValue(value.date),
    startDate: stringValue(value.startDate),
    endDate: stringValue(value.endDate),
    teacherId: stringValue(value.teacherId),
    limit: numberValue(value.limit),
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return undefined;
}

function clampLimit(limit = 30, max = 30) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(limit) ? limit : 30)));
}

function permissionDenied<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number) {
  const next = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(value: Date) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function occurrenceDateForDay(start: Date, day: number) {
  const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const delta = (day - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return dateKey(date);
}

function compactSchedule(schedule: any) {
  return {
    scheduleId: schedule.scheduleId,
    sectionId: schedule.sectionId,
    sectionName: schedule.sectionName,
    courseName: schedule.courseName,
    day: DAY_NAMES[schedule.day] ?? schedule.day,
    date: schedule.date ?? schedule.occurrenceDate ?? null,
    type: schedule.type,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    room: schedule.room,
    teacherName: schedule.teacherName,
    href: schedule.sectionId ? `/sections/${schedule.sectionId}` : undefined,
  };
}

function actorForScopedServices(context: AIToolContext) {
  return {
    id: context.userId,
    role: context.role,
    organizationId: context.orgId,
    name: null,
    email: undefined,
  };
}
