import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, Role } from '@/prisma/prisma-client';
import { fuzzySearchScore, normalizeSearchText } from '../common/utils';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

interface ScheduleToolInput {
  search?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  includeLoad?: boolean;
  includeBottlenecks?: boolean;
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
      name: 'getScheduleContext',
      description: 'Generic schedule context tool. Accepts search/date/startDate/endDate plus optional teacherId, includeLoad, and includeBottlenecks. For staff, resolves visible teacher/manager names and returns that target timetable. Distinguishes a missing target from a valid target with no configured schedules.',
      run: async (input: unknown, context) => this.getScheduleContext(context, parseInput(input)),
    });

    this.toolRegistry.register({
      name: 'getMyScheduleForDate',
      description: 'Return the current user schedule for a specific ISO date and compute free study/work slots between classes.',
      run: async (input: unknown, context) => {
        const parsed = parseInput(input);
        return this.getMyScheduleForDate(context, parsed.date ?? dateKey(new Date()));
      },
    });

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
  ): Promise<AIToolResult<{ range: unknown; schedules: unknown[]; freeSlots?: unknown[] }>> {
    return this.getMySchedule(context, { date });
  }

  private async getMySchedule(
    context: AIToolContext,
    query: { date?: string; startDate?: string; endDate?: string },
    limit = 30,
  ): Promise<AIToolResult<{ range: unknown; schedules: unknown[]; freeSlots?: unknown[]; studyPlanningHints?: unknown; emptyReason?: string }>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const timetable = await this.attendanceService.getTimetable(
      context.orgId,
      actorForScopedServices(context),
      query,
    );
    const schedules = timetable.schedules
      .slice(0, clampLimit(limit, 50))
      .map(compactSchedule)
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || a.startTime.localeCompare(b.startTime));
    const freeSlots = query.date ? computeFreeSlots(schedules, query.date) : undefined;

    return {
      ok: true,
      data: {
        range: timetable.range,
        schedules,
        freeSlots,
        studyPlanningHints: query.date
          ? {
              date: query.date,
              instruction: 'Use freeSlots to place study blocks around classes. Prefer the longest blocks for weakest courses and keep short review blocks between classes.',
            }
          : undefined,
      },
    };
  }

  private async getScheduleContext(
    context: AIToolContext,
    input: ScheduleToolInput,
  ): Promise<AIToolResult<unknown>> {
    const date = input.date;
    const startDate = input.startDate;
    const endDate = input.endDate;
    const query = scheduleRangeInput(input);
    const teacherTarget = await this.resolveTeacherTarget(context, input);
    const schedule = teacherTarget?.teacher
      ? await this.getTeacherSchedule(context, teacherTarget.teacher.id, query, input.limit)
      : await this.getMySchedule(context, query, input.limit);
    const [nextClass, teacherLoad, bottlenecks] = await Promise.all([
      teacherTarget?.teacher
        ? Promise.resolve({ ok: true, data: { nextClass: nextClassFromSchedules(schedule.data?.schedules as any[] ?? []) } })
        : this.getNextClass(context).catch((error) => unavailable(error)),
      input.includeLoad || input.teacherId || teacherTarget?.teacher
        ? this.getTeacherScheduleLoad(context, {
            ...input,
            teacherId: teacherTarget?.teacher?.id ?? input.teacherId,
          }).catch((error) => unavailable(error))
        : Promise.resolve(undefined),
      input.includeBottlenecks
        ? this.getScheduleBottlenecks(context, input).catch((error) => unavailable(error))
        : Promise.resolve(undefined),
    ]);

    return {
      ok: true,
      data: {
        requestedRange: date
          ? { date }
          : { startDate, endDate, sourceRange: schedule.data?.range ?? null },
        target: teacherTarget?.teacher ? compactTeacherTarget(teacherTarget.teacher) : undefined,
        targetResolution: teacherTarget?.resolution,
        timetable: schedule,
        nextClass,
        teacherLoad,
        bottlenecks,
        note: teacherTarget?.teacher && (schedule.data as any)?.schedules?.length === 0
          ? 'The teacher exists and is visible, but no schedule rows are configured for the requested range.'
          : undefined,
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
    const teachers = await this.prisma.teacher.findMany({
      where: teacherWhere,
      take: clampLimit(input.limit, input.teacherId ? 1 : 30),
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { schedules: true, sections: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    if (input.teacherId && !teachers.length) {
      return notFound('Teacher not found or not visible to this user.');
    }
    const weeklyRows = teachers.length
      ? await this.prisma.sectionSchedule.groupBy({
          by: ['teacherId'],
          where: {
            teacherId: { in: teachers.map((teacher) => teacher.id) },
            section: { organizationId: context.orgId },
            date: null,
          },
          _count: { id: true },
        })
      : [];
    const weeklyCountByTeacher = new Map(weeklyRows.map((row) => [row.teacherId, row._count.id]));

    return {
      ok: true,
      data: {
        teachers: teachers
          .map((teacher) => {
            const weeklySlots = weeklyCountByTeacher.get(teacher.id) ?? 0;
            return {
              name: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
              subject: teacher.subject,
              designation: teacher.designation,
              weeklySlots,
              sections: teacher._count.sections,
              hasSchedule: weeklySlots > 0,
              scheduleStatus: weeklySlots > 0 ? 'configured' : 'no-schedules-configured',
              loadLevel: weeklySlots >= 15 ? 'high' : weeklySlots >= 10 ? 'moderate' : 'normal',
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

  private async resolveTeacherTarget(context: AIToolContext, input: ScheduleToolInput) {
    if (!STAFF_SCHEDULE_ROLES.has(context.role ?? '')) return null;
    if (!input.teacherId && !input.search) return null;

    const teacherWhere = await this.teacherScopeWhere(context, input.teacherId);
    const teachers = await this.prisma.teacher.findMany({
      where: teacherWhere,
      take: input.teacherId ? 1 : 80,
      include: {
        user: { select: { name: true, email: true } },
        teacherDepartments: { include: { department: { select: { name: true } } } },
        _count: { select: { schedules: true, sections: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    if (input.teacherId) {
      const teacher = teachers[0];
      return teacher
        ? { teacher, resolution: { matched: true, reason: 'teacherId' } }
        : { resolution: { matched: false, reason: 'not-visible-or-not-found', message: 'No visible teacher matched the requested target.' } };
    }

    const ranked = rankTeacherCandidates(teachers, input.search);
    const top = ranked[0];
    if (!top) {
      if (!mentionsTeacherTarget(input.search)) return null;
      return {
        resolution: {
          matched: false,
          reason: 'no-confident-teacher-match',
          searched: input.search,
          message: 'No visible teacher was confidently matched. Ask for the exact name or email before saying the teacher does not exist.',
        },
      };
    }

    return {
      teacher: top.teacher,
      resolution: {
        matched: true,
        reason: top.candidate.split(/\s+/).length > 1 ? 'name-match' : 'single-token-match',
        searched: input.search,
        matchedName: top.teacher.user?.name ?? top.teacher.user?.email ?? 'Teacher',
        confidence: top.score,
      },
    };
  }

  private async getTeacherSchedule(
    context: AIToolContext,
    teacherId: string,
    query: { date?: string; startDate?: string; endDate?: string },
    limit = 30,
  ): Promise<AIToolResult<{ range: unknown; schedules: unknown[]; freeSlots?: unknown[]; studyPlanningHints?: unknown; emptyReason?: string }>> {
    const timetable = await this.attendanceService.getTimetable(
      context.orgId,
      actorForScopedServices(context),
      { ...query, teacherId },
    );
    const schedules = timetable.schedules
      .slice(0, clampLimit(limit, 50))
      .map(compactSchedule)
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || a.startTime.localeCompare(b.startTime));
    const freeSlots = query.date ? computeFreeSlots(schedules, query.date) : undefined;

    return {
      ok: true,
      data: {
        range: timetable.range,
        schedules,
        freeSlots,
        studyPlanningHints: query.date
          ? {
              date: query.date,
              instruction: 'Use freeSlots only if the user asks for planning around this teacher schedule.',
            }
          : undefined,
        emptyReason: schedules.length === 0 ? 'target-exists-but-no-schedules-in-range' : undefined,
      },
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
    search: stringValue(value.search),
    date: stringValue(value.date),
    startDate: stringValue(value.startDate),
    endDate: stringValue(value.endDate),
    teacherId: stringValue(value.teacherId),
    includeLoad: booleanValue(value.includeLoad),
    includeBottlenecks: booleanValue(value.includeBottlenecks),
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

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  return undefined;
}

function clampLimit(limit = 30, max = 30) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(limit) ? limit : 30)));
}

function permissionDenied<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}

function notFound<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'NOT_FOUND', message };
}

function unavailable(error: unknown): AIToolResult<unknown> {
  return {
    ok: false,
    code: 'UNAVAILABLE',
    message: error instanceof Error ? error.message : 'Schedule context is not available.',
  };
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

function scheduleRangeInput(input: ScheduleToolInput) {
  if (input.date) return { date: input.date };
  if (input.startDate || input.endDate) {
    return {
      startDate: input.startDate ?? dateKey(new Date()),
      endDate: input.endDate ?? input.startDate ?? dateKey(new Date()),
    };
  }
  return { startDate: dateKey(startOfWeek(new Date())), endDate: dateKey(addDays(startOfWeek(new Date()), 6)) };
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

function compactTeacherTarget(teacher: any) {
  return {
    type: 'teacher',
    name: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
    email: teacher.user?.email ?? null,
    subject: teacher.subject,
    designation: teacher.designation,
    sections: teacher._count?.sections,
    weeklyScheduleSlots: teacher._count?.schedules,
    scheduleStatus: teacher._count?.schedules > 0 ? 'configured' : 'no-schedules-configured',
  };
}

function nextClassFromSchedules(schedules: any[]) {
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = dateKey(now);
  return schedules
    .map((schedule) => ({ ...schedule, occurrenceDate: schedule.date ?? occurrenceDateForDay(now, dayIndex(schedule.day)) }))
    .filter((schedule) => schedule.occurrenceDate > today || timeToMinutes(schedule.startTime) >= nowMinutes)
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.startTime.localeCompare(b.startTime))[0] ?? null;
}

function dayIndex(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const index = DAY_NAMES.findIndex((day) => day.toLowerCase() === value.toLowerCase());
    if (index >= 0) return index;
  }
  return new Date().getUTCDay();
}

function rankTeacherCandidates(teachers: any[], search?: string) {
  const candidates = searchCandidates(search);
  if (!candidates.length) return [];

  const ranked: Array<{ teacher: any; candidate: string; score: number }> = [];
  for (const candidate of candidates) {
    const candidateTokenCount = candidate.split(/\s+/).length;
    const matches = teachers
      .map((teacher) => ({
        teacher,
        candidate,
        score: fuzzySearchScore(candidate, [
          teacher.user?.name,
          teacher.user?.email,
          teacher.subject,
          teacher.designation,
          ...(teacher.teacherDepartments ?? []).map((entry: any) => entry.department?.name),
        ]),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = matches[0];
    if (!best) continue;
    if (candidateTokenCount > 1 || best.score >= 120) {
      ranked.push(best);
      break;
    }
  }

  return ranked;
}

function searchCandidates(search?: string) {
  const normalized = normalizeSearchText(search);
  if (!normalized) return [];
  const stopWords = new Set([
    'a', 'about', 'and', 'class', 'classes', 'for', 'from', 'get', 'give', 'his', 'her', 'i', 'is',
    'me', 'next', 'of', 'on', 'schedule', 'schedules', 'show', 'summarize', 'teacher', 'the',
    'timetable', 'to', 'week', 'weekly', 'what',
  ]);
  const tokens = normalized.split(/\s+/).filter((token) => token.length > 1 && !stopWords.has(token));
  const candidates = new Set<string>();
  for (let size = Math.min(4, tokens.length); size >= 1; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      candidates.add(tokens.slice(index, index + size).join(' '));
    }
  }
  return Array.from(candidates).slice(0, 30);
}

function mentionsTeacherTarget(search?: string) {
  const normalized = normalizeSearchText(search);
  return ['teacher', 'instructor', 'faculty', 'manager', 'staff', 'professor'].some((term) => normalized.includes(term));
}

function computeFreeSlots(
  schedules: Array<{ startTime: string; endTime: string; date?: string | null; sectionName?: string; courseName?: string }>,
  date: string,
) {
  const dayStart = 7 * 60;
  const dayEnd = 22 * 60;
  const minimumSlotMinutes = 30;
  const sorted = schedules
    .filter((schedule) => !schedule.date || schedule.date === date)
    .map((schedule) => ({
      ...schedule,
      startMinutes: timeToMinutes(schedule.startTime),
      endMinutes: timeToMinutes(schedule.endTime),
    }))
    .filter((schedule) => Number.isFinite(schedule.startMinutes) && Number.isFinite(schedule.endMinutes))
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const slots: Array<{
    startTime: string;
    endTime: string;
    minutes: number;
    fit: string;
    after?: string;
    before?: string;
  }> = [];
  let cursor = dayStart;
  let previousLabel: string | undefined;

  for (const schedule of sorted) {
    if (schedule.startMinutes - cursor >= minimumSlotMinutes) {
      slots.push({
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(schedule.startMinutes),
        minutes: schedule.startMinutes - cursor,
        fit: studyFit(schedule.startMinutes - cursor),
        after: previousLabel,
        before: schedule.courseName ?? schedule.sectionName,
      });
    }
    cursor = Math.max(cursor, schedule.endMinutes);
    previousLabel = schedule.courseName ?? schedule.sectionName;
  }

  if (dayEnd - cursor >= minimumSlotMinutes) {
    slots.push({
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(dayEnd),
      minutes: dayEnd - cursor,
      fit: studyFit(dayEnd - cursor),
      after: previousLabel,
    });
  }

  return slots;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function studyFit(minutes: number) {
  if (minutes >= 120) return 'deep-study';
  if (minutes >= 60) return 'focused-study';
  return 'quick-review';
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
