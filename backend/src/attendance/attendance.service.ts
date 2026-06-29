import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentService } from '../students/student.service';
import { TeacherService } from '../teacher/teacher.service';
import { SectionsService } from '../sections/sections.service';
import { Role, StudentStatus, TeacherStatus } from '../common/enums';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { AttendanceRecordDto } from './dto/mark-attendance.dto';
import { validateRoomBelongsToOrg } from '../common/department-scope';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma, ScheduleType } from '@/prisma/prisma-client';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

interface NormalizedScheduleInput {
  day: number;
  date: Date | null;
  type: ScheduleType;
  startTime: string;
  endTime: string;
  room?: string;
  roomId?: string | null;
  teacherId?: string;
}

interface TimetableQuery {
  studentId?: string;
  teacherId?: string;
  roomId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}

const TIME_RE = /^\d{2}:\d{2}$/;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ConflictScheduleForMessage {
  sectionId: string;
  day: number;
  date: Date | null;
  startTime: string;
  endTime: string;
  room: string | null;
  roomId: string | null;
  roomRef?: { name: string; building?: { name: string } | null } | null;
  section: {
    name: string;
    room: string | null;
    defaultRoomId: string | null;
    course: { name: string };
    defaultRoom?: { name: string; building?: { name: string } | null } | null;
    enrollments: Array<{
      studentId: string;
      student?: {
        registrationNumber?: string | null;
        rollNumber?: string | null;
        user?: { name: string | null; email: string | null } | null;
      } | null;
    }>;
  };
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
    private readonly sectionsService: SectionsService,
    private readonly notifications: NotificationsService,
  ) {}

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private parseDateOnly(value: string, field = 'date') {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }

  private todayDateOnly() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private startOfWeek(date: Date) {
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() - this.getDayFromDate(date));
    return start;
  }

  private getDayFromDate(date: Date) {
    return date.getUTCDay();
  }

  private assertTime(value: string, field: string) {
    if (!TIME_RE.test(value)) {
      throw new BadRequestException(`${field} must use HH:mm format`);
    }
    const [hours, minutes] = value.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new BadRequestException(`${field} must be a valid HH:mm value`);
    }
  }

  private assertTimeRange(startTime: string, endTime: string) {
    this.assertTime(startTime, 'startTime');
    this.assertTime(endTime, 'endTime');
    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }

  private normalizeScheduleInput(dto: CreateScheduleDto | UpdateScheduleDto, existing?: NormalizedScheduleInput): NormalizedScheduleInput {
    const type = dto.type ?? existing?.type ?? ScheduleType.OFFICIAL;
    const date = dto.date !== undefined
      ? (dto.date ? this.parseDateOnly(dto.date) : null)
      : existing?.date ?? null;
    const day = date ? this.getDayFromDate(date) : dto.day ?? existing?.day;
    const startTime = dto.startTime ?? existing?.startTime;
    const endTime = dto.endTime ?? existing?.endTime;

    if (day === undefined || day < 0 || day > 6) {
      throw new BadRequestException('day is required unless date is provided');
    }
    if (!startTime || !endTime) {
      throw new BadRequestException('startTime and endTime are required');
    }
    if (type === ScheduleType.AD_HOC && !date) {
      throw new BadRequestException('Ad-hoc schedules require a date');
    }

    this.assertTimeRange(startTime, endTime);

    return {
      day,
      date,
      type,
      startTime,
      endTime,
      room: dto.room === undefined ? existing?.room : dto.room,
      roomId: dto.roomId === undefined ? existing?.roomId : dto.roomId,
      teacherId: dto.teacherId === undefined ? existing?.teacherId : dto.teacherId,
    };
  }

  private async resolveScheduleTeacher(
    orgId: string,
    sectionId: string,
    requestedTeacherId: string | undefined,
    user: JwtPayload,
    type: ScheduleType,
  ) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        course: true,
        teachers: { select: { id: true, userId: true } },
      },
    });

    if (!section || section.course.organizationId !== orgId) {
      throw new NotFoundException('Section not found');
    }

    if (section.teachers.length === 0) {
      throw new BadRequestException('Assign at least one teacher to this section before creating schedules.');
    }

    const teacherId = requestedTeacherId || (section.teachers.length === 1 ? section.teachers[0].id : undefined);
    if (!teacherId) {
      throw new BadRequestException('teacherId is required when a section has multiple teachers.');
    }

    const teacher = section.teachers.find((candidate) => candidate.id === teacherId);
    if (!teacher) {
      throw new BadRequestException('Schedule teacher must be assigned to this section.');
    }

    if (type === ScheduleType.AD_HOC && (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) && teacher.userId !== user.id) {
      throw new ForbiddenException('You can only create ad-hoc schedules for your own teaching slots.');
    }

    return teacherId;
  }

  private async assertCanManageSchedule(
    orgId: string,
    sectionId: string,
    user: JwtPayload,
    type: ScheduleType,
  ) {
    if (type === ScheduleType.OFFICIAL) {
      if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) return;
      throw new ForbiddenException('Only admins can manage official schedules');
    }

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, course: { organizationId: orgId } },
      select: {
        id: true,
        teachers: { select: { userId: true } },
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    const isAssignedTeacher = (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER)
      && section.teachers.some((teacher) => teacher.userId === user.id);
    if (!isAssignedTeacher) {
      throw new ForbiddenException('Only assigned teachers can manage ad-hoc schedules for this section');
    }
  }

  private async getAuthorizedSection(
    orgId: string,
    sectionId: string,
    user: JwtPayload,
    targetStudentId?: string,
  ) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        course: true,
        teachers: { select: { id: true, userId: true } },
        enrollments: { select: { studentId: true, student: { select: { userId: true } } } },
      },
    });

    if (!section || section.course.organizationId !== orgId) {
      throw new NotFoundException('Section not found');
    }

    if (user.role === Role.TEACHER) {
      const isAssigned = section.teachers.some((teacher) => teacher.userId === user.id);
      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this section.',
        );
      }
    }

    if (user.role === Role.STUDENT) {
      const isEnrolled = section.enrollments.some(
        (enrollment) => enrollment.student.userId === user.id,
      );
      if (!isEnrolled) {
        throw new ForbiddenException(
          'You are not enrolled in this section.',
        );
      }
    }

    if (user.role === Role.GUARDIAN) {
      if (!targetStudentId) {
        throw new BadRequestException('Query parameter "studentId" is required');
      }

      const isEnrolled = section.enrollments.some(
        (enrollment) => enrollment.studentId === targetStudentId,
      );
      if (!isEnrolled) {
        throw new ForbiddenException('This student is not enrolled in this section.');
      }

      await this.studentService.assertGuardianCanAccessStudent(orgId, user.id, targetStudentId);
    }

    return section;
  }

  private async assertAttendanceSectionAccess(
    orgId: string,
    sectionId: string,
    user: JwtPayload,
    targetStudentId?: string,
  ) {
    return this.getAuthorizedSection(orgId, sectionId, user, targetStudentId);
  }

  private async validateAttendanceSchedule(
    sectionId: string,
    scheduleId: string | undefined,
    date?: Date,
  ) {
    if (!scheduleId) {
      throw new BadRequestException('scheduleId is required');
    }

    const schedule = await this.prisma.sectionSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        sectionId: true,
        day: true,
        date: true,
        type: true,
        academicCycleId: true,
        startTime: true,
        endTime: true,
        teacherId: true,
        teacher: { select: { userId: true, organizationId: true } },
      },
    });

    if (!schedule || schedule.sectionId !== sectionId) {
      throw new BadRequestException(
        'The provided schedule does not belong to this section.',
      );
    }

    if (date) {
      if (schedule.date && this.dateKey(schedule.date) !== this.dateKey(date)) {
        throw new BadRequestException('The selected schedule is not available on this date.');
      }

      if (!schedule.date && schedule.day !== this.getDayFromDate(date)) {
        throw new BadRequestException('The selected schedule does not match this date.');
      }
    }

    return schedule;
  }

  private assertCanWriteAttendanceForSchedule(
    orgId: string,
    user: JwtPayload,
    schedule: { teacher?: { userId: string; organizationId: string } | null },
  ) {
    if (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER) {
      throw new ForbiddenException('Only the assigned teacher can mark attendance for this schedule.');
    }

    if (!schedule.teacher || schedule.teacher.organizationId !== orgId || schedule.teacher.userId !== user.id) {
      throw new ForbiddenException('Only the teacher assigned to this schedule can mark attendance.');
    }
  }

  private async assertStudentsBelongToSection(
    sectionId: string,
    studentIds: string[],
  ) {
    return this.studentService.assertStudentsBelongToSection(sectionId, studentIds);
  }

  async getSection(orgId: string, id: string, user: JwtPayload) {
    await this.getAuthorizedSection(orgId, id, user);

    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        course: true,
        teachers: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        enrollments: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                    avatarUpdatedAt: true,
                  },
                },
              },
            },
          },
        },
        academicCycle: true,
        cohort: true,
        assessments: true,
        defaultRoom: { include: { building: true } },
        schedules: {
          include: {
            roomRef: { include: { building: true } },
            teacher: { include: { user: { select: { id: true, email: true, name: true } } } },
          },
        },
      },
    });

    if (!section || section.course.organizationId !== orgId) {
      throw new NotFoundException('Section not found');
    }

    const enrollments =
      user.role === Role.STUDENT
        ? section.enrollments.filter((enrollment) => enrollment.student.user.id === user.id)
        : section.enrollments;

    return {
      ...section,
      enrollments,
      students: enrollments.map((e) => ({
        ...e.student,
        user: e.student.user,
      })),
      studentsCount: enrollments.length,
    };
  }

  // --- Timetable & Attendance ---
  async createSchedule(orgId: string, sectionId: string, dto: CreateScheduleDto, user: JwtPayload) {
    const normalized = this.normalizeScheduleInput(dto);
    await this.assertCanManageSchedule(orgId, sectionId, user, normalized.type);
    normalized.teacherId = await this.resolveScheduleTeacher(orgId, sectionId, normalized.teacherId, user, normalized.type);

    if (normalized.roomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, normalized.roomId);
    }
    await this.validateScheduleConflict(orgId, sectionId, normalized);

    // Derive academicCycleId from section
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { academicCycleId: true, defaultRoomId: true, _count: { select: { enrollments: true } } },
    });

    const schedule = await this.prisma.sectionSchedule.create({
      data: {
        sectionId,
        academicCycleId: section?.academicCycleId,
        day: normalized.day,
        date: normalized.date,
        type: normalized.type,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        room: normalized.room,
        roomId: normalized.roomId || null,
        teacherId: normalized.teacherId,
      },
      include: { roomRef: { include: { building: true } }, teacher: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    if (schedule.type === ScheduleType.AD_HOC) {
      await this.notifyAdHocScheduleCreated(orgId, schedule.id);
    }

    const capacityWarning = await this.getCapacityWarning(
      orgId,
      normalized.roomId || section?.defaultRoomId,
      section?._count.enrollments || 0,
    );

    return capacityWarning ? { ...schedule, capacityWarning } : schedule;
  }

  async updateSchedule(orgId: string, scheduleId: string, dto: UpdateScheduleDto, user: JwtPayload) {
    const existing = await this.prisma.sectionSchedule.findUnique({
      where: { id: scheduleId },
      include: { section: { include: { course: true, _count: { select: { enrollments: true } } } } },
    });

    if (!existing || existing.section.course.organizationId !== orgId) {
      throw new NotFoundException('Schedule not found');
    }

    const normalized = this.normalizeScheduleInput(dto, {
      day: existing.day,
      date: existing.date,
      type: existing.type,
      startTime: existing.startTime,
      endTime: existing.endTime,
      room: existing.room ?? undefined,
      roomId: existing.roomId,
      teacherId: existing.teacherId,
    });

    await this.assertCanManageSchedule(orgId, existing.sectionId, user, normalized.type);
    normalized.teacherId = await this.resolveScheduleTeacher(orgId, existing.sectionId, normalized.teacherId, user, normalized.type);

    if (normalized.roomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, normalized.roomId);
    }

    await this.validateScheduleConflict(orgId, existing.sectionId, normalized, scheduleId);

    const schedule = await this.prisma.sectionSchedule.update({
      where: { id: scheduleId },
      data: {
        day: normalized.day,
        date: normalized.date,
        type: normalized.type,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        room: normalized.room,
        roomId: normalized.roomId === '' ? null : normalized.roomId,
        teacherId: normalized.teacherId,
      },
      include: { roomRef: { include: { building: true } }, teacher: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    const capacityWarning = await this.getCapacityWarning(
      orgId,
      schedule.roomId || existing.section.defaultRoomId,
      existing.section._count.enrollments,
    );

    return capacityWarning ? { ...schedule, capacityWarning } : schedule;
  }

  async deleteSchedule(orgId: string, scheduleId: string, user: JwtPayload) {
    const existing = await this.prisma.sectionSchedule.findUnique({
      where: { id: scheduleId },
      include: { section: { include: { course: true } } },
    });

    if (!existing || existing.section.course.organizationId !== orgId) {
      throw new NotFoundException('Schedule not found');
    }

    await this.assertCanManageSchedule(orgId, existing.sectionId, user, existing.type);

    return this.prisma.sectionSchedule.delete({ where: { id: scheduleId } });
  }

  private async validateScheduleConflict(orgId: string, sectionId: string, dto: NormalizedScheduleInput, excludeId?: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { 
        course: true,
        enrollments: { select: { studentId: true } },
        defaultRoom: { select: { name: true, building: { select: { name: true } } } },
      },
    });

    if (!section || section.course.organizationId !== orgId) throw new NotFoundException('Section not found');

    const studentIds = section.enrollments.map(e => e.studentId);
    const targetRoom = dto.room || section.room;
    const targetRoomId = dto.roomId || section.defaultRoomId;
    const occurrenceWhere: Prisma.SectionScheduleWhereInput = dto.date
      ? {
          OR: [
            { date: dto.date },
            { date: null, day: dto.day },
          ],
        }
      : {
          OR: [
            { date: null, day: dto.day },
            { date: { not: null }, day: dto.day },
          ],
        };

    // Check for overlaps using the rule: aStart < bEnd && bStart < aEnd
    const conflicts = await this.prisma.sectionSchedule.findMany({
      where: {
        section: { course: { organizationId: orgId } },
        ...occurrenceWhere,
        startTime: { lt: dto.endTime },
        endTime: { gt: dto.startTime },
        id: excludeId ? { not: excludeId } : undefined,
      },
      include: {
        roomRef: { include: { building: true } },
        section: {
          include: {
            course: { select: { name: true } },
            enrollments: {
              select: {
                studentId: true,
                student: {
                  select: {
                    registrationNumber: true,
                    rollNumber: true,
                    user: { select: { name: true, email: true } },
                  },
                },
              },
            },
            defaultRoom: { select: { name: true, building: { select: { name: true } } } },
          }
        },
        teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
      }
    });

    const conflictMessages: string[] = [];

    for (const conflict of conflicts) {
      // 1. Same Section Conflict
      if (conflict.sectionId === sectionId) {
          conflictMessages.push(`This section already has a schedule at ${this.formatConflictSlot(conflict)}.`);
          continue;
      }

      // 2. Room Conflict
      const conflictRoomId = conflict.roomId || conflict.section.defaultRoomId;
      if (targetRoomId && conflictRoomId === targetRoomId) {
          const roomName = this.formatRoom(conflict) || 'Selected room';
          conflictMessages.push(`Room "${roomName}" is already occupied by ${this.formatConflictSlot(conflict)}.`);
      }

      const conflictRoom = conflict.room || conflict.section.room;
      if (!targetRoomId && targetRoom && conflictRoom === targetRoom) {
          conflictMessages.push(`Room "${targetRoom}" is already occupied by ${this.formatConflictSlot(conflict)}.`);
      }

      // 3. Teacher Conflict
      if (dto.teacherId && conflict.teacherId === dto.teacherId) {
          conflictMessages.push(`Teacher "${this.formatUserLabel(conflict.teacher.user)}" is already assigned to ${this.formatConflictSlot(conflict)}.`);
      }

      // 4. Student Conflict
      const conflictingStudents = conflict.section.enrollments.filter(e => studentIds.includes(e.studentId));
      if (conflictingStudents.length > 0) {
          const studentList = conflictingStudents.map((enrollment) => this.formatStudentConflictLabel(enrollment)).join(', ');
          const subject = conflictingStudents.length === 1 ? 'Student' : 'Students';
          const verb = conflictingStudents.length === 1 ? 'is' : 'are';
          conflictMessages.push(`${subject} ${studentList} ${verb} already scheduled in ${this.formatConflictSlot(conflict)}.`);
      }
    }

    if (conflictMessages.length > 0) {
      throw new ConflictException(`Schedule conflict: ${Array.from(new Set(conflictMessages)).join(' ')}`);
    }
  }

  async getSchedules(orgId: string, sectionId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });
    if (!section || section.course.organizationId !== orgId) {
      throw new NotFoundException('Section not found');
    }
    return this.prisma.sectionSchedule.findMany({
      where: { sectionId },
      include: { roomRef: { include: { building: true } }, teacher: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: [{ date: 'asc' }, { day: 'asc' }, { startTime: 'asc' }],
    });
  }

  private async getCapacityWarning(orgId: string, roomId: string | null | undefined, enrolledCount: number) {
    if (!roomId) return null;
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, organizationId: orgId },
      select: { name: true, capacity: true },
    });
    if (!room?.capacity || room.capacity >= enrolledCount) return null;
    return `Room "${room.name}" capacity is ${room.capacity}, below the current enrollment of ${enrolledCount}.`;
  }

  async getStudentTimetable(orgId: string, userId: string) {
    return this.studentService.getStudentTimetable(orgId, userId);
  }

  async getTeacherTimetable(orgId: string, userId: string) {
    return this.teacherService.getTeacherTimetable(orgId, userId);
  }

  private async notifyAdHocScheduleCreated(orgId: string, scheduleId: string) {
    const schedule = await this.prisma.sectionSchedule.findFirst({
      where: { id: scheduleId, section: { course: { organizationId: orgId } } },
      include: {
        section: {
          include: {
            course: { select: { name: true } },
            enrollments: { select: { student: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!schedule?.date) return;

    const date = this.dateKey(schedule.date);
    const title = 'Ad-hoc class scheduled';
    const body = `${schedule.section.course.name} ${schedule.section.name} on ${date}, ${schedule.startTime} - ${schedule.endTime}.`;
    await Promise.all(schedule.section.enrollments.map((enrollment) =>
      this.notifications.createNotification({
        userId: enrollment.student.userId,
        title,
        body,
        actionUrl: `/timetable?date=${date}`,
        type: 'AD_HOC_SCHEDULE',
        metadata: {
          scheduleId: schedule.id,
          sectionId: schedule.sectionId,
          date,
        },
      })
    ));
  }

  private getTimetableRange(query: TimetableQuery) {
    if (query.date) {
      const date = this.parseDateOnly(query.date);
      return { start: date, end: date };
    }

    if (query.startDate || query.endDate) {
      const start = query.startDate ? this.parseDateOnly(query.startDate, 'startDate') : this.todayDateOnly();
      const end = query.endDate ? this.parseDateOnly(query.endDate, 'endDate') : start;
      if (end < start) {
        throw new BadRequestException('endDate must be after or equal to startDate');
      }
      return { start, end };
    }

    const start = this.startOfWeek(this.todayDateOnly());
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start, end };
  }

  private getDaysInRange(start: Date, end: Date) {
    const days = new Set<number>();
    const cursor = new Date(start);
    while (cursor <= end) {
      days.add(this.getDayFromDate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return Array.from(days);
  }

  private getScheduleRangeWhere(start: Date, end: Date): Prisma.SectionScheduleWhereInput {
    return {
      OR: [
        { date: null, day: { in: this.getDaysInRange(start, end) } },
        { date: { gte: start, lte: end } },
      ],
    };
  }

  private formatRoom(schedule: {
    room: string | null;
    roomId: string | null;
    roomRef?: { name: string; building?: { name: string } | null } | null;
    section: {
      room: string | null;
      defaultRoomId: string | null;
      defaultRoom?: { name: string; building?: { name: string } | null } | null;
    };
  }) {
    const scheduleRoom = schedule.roomRef
      ? [schedule.roomRef.building?.name, schedule.roomRef.name].filter(Boolean).join(' - ')
      : null;
    const defaultRoom = schedule.section.defaultRoom
      ? [schedule.section.defaultRoom.building?.name, schedule.section.defaultRoom.name].filter(Boolean).join(' - ')
      : null;
    return scheduleRoom || defaultRoom || schedule.room || schedule.section.room || null;
  }

  private formatScheduleOccurrence(schedule: ConflictScheduleForMessage) {
    return schedule.date ? this.dateKey(schedule.date) : DAY_NAMES[schedule.day] || `Day ${schedule.day}`;
  }

  private formatConflictSection(schedule: ConflictScheduleForMessage) {
    return [schedule.section.course?.name, schedule.section.name].filter(Boolean).join(' - ');
  }

  private formatConflictSlot(schedule: ConflictScheduleForMessage) {
    const room = this.formatRoom(schedule);
    return [
      `${this.formatConflictSection(schedule)} on ${this.formatScheduleOccurrence(schedule)}`,
      `${schedule.startTime} - ${schedule.endTime}`,
      room ? `in ${room}` : null,
    ].filter(Boolean).join(', ');
  }

  private formatUserLabel(user?: { name: string | null; email: string | null } | null) {
    return user?.name || user?.email || 'Unnamed user';
  }

  private formatStudentConflictLabel(enrollment: ConflictScheduleForMessage['section']['enrollments'][number]) {
    const name = this.formatUserLabel(enrollment.student?.user);
    const identifier = enrollment.student?.rollNumber || enrollment.student?.registrationNumber;
    return identifier ? `${name} (${identifier})` : name;
  }

  private mapSchedulesToTimetableEntries(schedules: Array<any>) {
    return schedules.map((schedule) => {
      return {
        scheduleId: schedule.id,
        sectionId: schedule.sectionId,
        sectionName: schedule.section.name,
        courseId: schedule.section.course.id || null,
        courseName: schedule.section.course.name,
        departmentId: schedule.section.course.departmentId || null,
        color: schedule.section.color || null,
        day: schedule.day,
        date: schedule.date ? this.dateKey(schedule.date) : null,
        type: schedule.type,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: this.formatRoom(schedule),
        roomId: schedule.roomId || schedule.section.defaultRoomId || null,
        teacherId: schedule.teacherId,
        teacherUserId: schedule.teacher?.user?.id || null,
        teacherName: schedule.teacher?.user?.name || schedule.teacher?.user?.email || null,
      };
    }).sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.startTime.localeCompare(b.startTime);
    });
  }

  async getTimetable(orgId: string, user: JwtPayload, query: TimetableQuery = {}) {
    const { start, end } = this.getTimetableRange(query);
    const hasExplicitTarget = Boolean(query.studentId || query.teacherId || query.roomId);

    if (!hasExplicitTarget && (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN)) {
      return {
        schedules: [],
        range: { startDate: this.dateKey(start), endDate: this.dateKey(end) },
      };
    }

    const filters: Prisma.SectionScheduleWhereInput[] = [
      { section: { course: { organizationId: orgId } } },
      this.getScheduleRangeWhere(start, end),
    ];

    if (query.studentId) {
      filters.push({ section: { enrollments: { some: { studentId: query.studentId } } } });
    } else if (query.teacherId) {
      filters.push({ teacherId: query.teacherId });
    } else if (user.role === Role.STUDENT) {
      filters.push({ section: { enrollments: { some: { student: { userId: user.id } } } } });
    } else if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      filters.push({ teacher: { userId: user.id } });
    }

    if (query.roomId) {
      filters.push({
        OR: [
          { roomId: query.roomId },
          { roomId: null, section: { defaultRoomId: query.roomId } },
        ],
      });
    }

    const schedules = await this.prisma.sectionSchedule.findMany({
      where: { AND: filters },
      include: {
        roomRef: { include: { building: true } },
        teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
        section: {
          include: {
            course: { select: { id: true, name: true, departmentId: true } },
            defaultRoom: { select: { name: true, building: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });

    return {
      schedules: this.mapSchedulesToTimetableEntries(schedules),
      range: { startDate: this.dateKey(start), endDate: this.dateKey(end) },
    };
  }

  async searchTimetableTeachers(orgId: string, search = '', limit = 100) {
    const take = Math.min(Math.max(limit || 100, 1), 250);
    return this.prisma.teacher.findMany({
      where: {
        organizationId: orgId,
        status: { not: TeacherStatus.DELETED },
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { subject: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        subject: true,
        designation: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } },
      },
      orderBy: { user: { name: 'asc' } },
      take,
    });
  }

  async searchTimetableStudents(orgId: string, search = '', limit = 100) {
    const take = Math.min(Math.max(limit || 100, 1), 250);
    return this.prisma.student.findMany({
      where: {
        organizationId: orgId,
        status: { not: StudentStatus.DELETED },
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { registrationNumber: { contains: search, mode: 'insensitive' } },
                { rollNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        registrationNumber: true,
        rollNumber: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true, avatarUpdatedAt: true } },
      },
      orderBy: { user: { name: 'asc' } },
      take,
    });
  }

  async createAttendanceSession(
    orgId: string, 
    sectionId: string, 
    user: JwtPayload,
    date: string, 
    scheduleId?: string,
  ) {
    await this.assertAttendanceSectionAccess(orgId, sectionId, user);
    const sessionDate = this.parseDateOnly(date);
    const schedule = await this.validateAttendanceSchedule(sectionId, scheduleId, sessionDate);
    this.assertCanWriteAttendanceForSchedule(orgId, user, schedule);

    // Derive academicCycleId from section
    const sectionData = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { academicCycleId: true },
    });

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { 
        sectionId,
        date: sessionDate,
        scheduleId: schedule.id,
      },
    });

    if (existing) {
      throw new ConflictException('Attendance session already exists for this schedule and date');
    }

    return this.prisma.attendanceSession.create({
      data: {
        sectionId,
        scheduleId: schedule.id,
        academicCycleId: schedule.academicCycleId || sectionData?.academicCycleId,
        date: sessionDate,
      },
    });
  }

  async markAttendance(
    orgId: string,
    sessionId: string,
    user: JwtPayload,
    records: AttendanceRecordDto[],
  ) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        section: { include: { course: true } },
        schedule: { include: { teacher: { select: { userId: true, organizationId: true } } } },
      },
    });
    if (!session || session.section.course.organizationId !== orgId) {
      throw new NotFoundException('Session not found');
    }

    await this.assertAttendanceSectionAccess(orgId, session.sectionId, user);
    this.assertCanWriteAttendanceForSchedule(orgId, user, session.schedule);
    await this.assertStudentsBelongToSection(
      session.sectionId,
      [...new Set(records.map((record) => record.studentId))],
    );

    return this.prisma.$transaction(async (tx) => {
      for (const record of records) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId,
              studentId: record.studentId,
            },
          },
          create: {
            sessionId,
            studentId: record.studentId,
            status: record.status,
          },
          update: {
            status: record.status,
          },
        });
      }
      return tx.attendanceRecord.findMany({ where: { sessionId } });
    });
  }

  async getSectionAttendanceRange(
    orgId: string,
    sectionId: string,
    user: JwtPayload,
    start: string,
    end: string,
    targetStudentId?: string,
  ) {
    await this.assertAttendanceSectionAccess(orgId, sectionId, user, targetStudentId);

    const startDate = new Date(start);
    const endDate = new Date(end);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { sectionId, date: { gte: startDate, lte: endDate } },
      orderBy: [{ date: 'asc' }, { schedule: { startTime: 'asc' } }],
      include: { 
        records: true,
        schedule: {
          select: {
            startTime: true,
            endTime: true,
            room: true,
            type: true,
          }
        }
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId,
        ...(user.role === Role.STUDENT
          ? { student: { userId: user.id } }
          : {}),
        ...(user.role === Role.GUARDIAN && targetStudentId
          ? { studentId: targetStudentId }
          : {}),
      },
      include: { student: { include: { user: { select: { name: true, email: true, avatarUrl: true } } } } },
    });

    return {
      sessions: sessions.map(s => ({ 
        id: s.id, 
        date: s.date,
        type: s.schedule?.type || ScheduleType.OFFICIAL,
        startTime: s.startTime || s.schedule?.startTime,
        endTime: s.endTime || s.schedule?.endTime,
        schedule: s.schedule
          ? {
              startTime: s.schedule.startTime,
              endTime: s.schedule.endTime,
              room: s.schedule.room,
              type: s.schedule.type,
            }
          : null,
      })),
      students: enrollments.map(e => ({
        studentId: e.student.id,
        name: e.student.user.name,
        email: e.student.user.email,
        avatarUrl: e.student.user.avatarUrl,
        registrationNumber: e.student.registrationNumber,
        rollNumber: e.student.rollNumber,
        records: sessions.map(s => {
          const record = s.records.find(r => r.studentId === e.student.id);
          return {
            sessionId: s.id,
            date: s.date,
            status: record?.status || null,
          };
        }),
      })),
    };
  }

  async getSectionAttendance(
    orgId: string,
    sectionId: string,
    user: JwtPayload,
    date: string,
    scheduleId?: string,
    targetStudentId?: string,
  ) {
    await this.assertAttendanceSectionAccess(orgId, sectionId, user, targetStudentId);
    const sessionDate = this.parseDateOnly(date);
    const schedule = await this.validateAttendanceSchedule(sectionId, scheduleId, sessionDate);
    const session = await this.prisma.attendanceSession.findFirst({
      where: { 
        sectionId, 
        date: sessionDate,
        scheduleId: schedule.id,
      },
      include: {
        records: true,
        schedule: true,
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId,
        ...(user.role === Role.STUDENT
          ? { student: { userId: user.id } }
          : {}),
        ...(user.role === Role.GUARDIAN && targetStudentId
          ? { studentId: targetStudentId }
          : {}),
      },
      include: { student: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } },
    });

    const recordsMap = new Map();
    if (session) {
      session.records.forEach(r => recordsMap.set(r.studentId, r.status));
    }

    return {
      sessionId: session?.id || null,
      date: sessionDate,
      students: enrollments.map(e => ({
        studentId: e.student.id,
        name: e.student.user.name,
        email: e.student.user.email,
        avatarUrl: e.student.user.avatarUrl,
        registrationNumber: e.student.registrationNumber,
        rollNumber: e.student.rollNumber,
        status: recordsMap.get(e.student.id) || null,
      })),
    };
  }

  async getStudentAttendance(
    orgId: string,
    studentId: string,
    requester: JwtPayload,
  ) {
    return this.studentService.getStudentAttendance(orgId, studentId, requester);
  }
}
