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
import { Role } from '../common/enums';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { AttendanceRecordDto } from './dto/mark-attendance.dto';
import { validateRoomBelongsToOrg } from '../common/department-scope';
import { extractTimetableEntries } from '../common/utils';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
    private readonly sectionsService: SectionsService,
  ) {}

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
    scheduleId?: string,
  ) {
    if (!scheduleId) return null;

    const schedule = await this.prisma.sectionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, sectionId: true },
    });

    if (!schedule || schedule.sectionId !== sectionId) {
      throw new BadRequestException(
        'The provided schedule does not belong to this section.',
      );
    }

    return schedule;
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
        schedules: { include: { roomRef: { include: { building: true } } } },
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
  async createSchedule(orgId: string, sectionId: string, dto: CreateScheduleDto) {
    if (dto.roomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, dto.roomId);
    }
    await this.validateScheduleConflict(orgId, sectionId, dto);

    // Derive academicCycleId from section
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { academicCycleId: true, defaultRoomId: true, _count: { select: { enrollments: true } } },
    });

    const schedule = await this.prisma.sectionSchedule.create({
      data: {
        sectionId,
        academicCycleId: section?.academicCycleId,
        day: dto.day,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room,
        roomId: dto.roomId || null,
      },
      include: { roomRef: { include: { building: true } } },
    });

    const capacityWarning = await this.getCapacityWarning(
      orgId,
      dto.roomId || section?.defaultRoomId,
      section?._count.enrollments || 0,
    );

    return capacityWarning ? { ...schedule, capacityWarning } : schedule;
  }

  async updateSchedule(orgId: string, scheduleId: string, dto: UpdateScheduleDto) {
    const existing = await this.prisma.sectionSchedule.findUnique({
      where: { id: scheduleId },
      include: { section: { include: { course: true, _count: { select: { enrollments: true } } } } },
    });

    if (!existing || existing.section.course.organizationId !== orgId) {
      throw new NotFoundException('Schedule not found');
    }

    if (dto.roomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, dto.roomId);
    }

    // Prepare full data for validation
    const validationDto: CreateScheduleDto = {
      day: dto.day ?? existing.day,
      startTime: dto.startTime ?? existing.startTime,
      endTime: dto.endTime ?? existing.endTime,
      room: dto.room === undefined ? (existing.room ?? undefined) : (dto.room ?? undefined),
      roomId: dto.roomId === undefined ? (existing.roomId ?? undefined) : (dto.roomId ?? undefined),
    };

    await this.validateScheduleConflict(orgId, existing.sectionId, validationDto, scheduleId);

    const schedule = await this.prisma.sectionSchedule.update({
      where: { id: scheduleId },
      data: {
        ...dto,
        roomId: dto.roomId === '' ? null : dto.roomId,
      },
      include: { roomRef: { include: { building: true } } },
    });

    const capacityWarning = await this.getCapacityWarning(
      orgId,
      schedule.roomId || existing.section.defaultRoomId,
      existing.section._count.enrollments,
    );

    return capacityWarning ? { ...schedule, capacityWarning } : schedule;
  }

  async deleteSchedule(orgId: string, scheduleId: string) {
    const existing = await this.prisma.sectionSchedule.findUnique({
      where: { id: scheduleId },
      include: { section: { include: { course: true } } },
    });

    if (!existing || existing.section.course.organizationId !== orgId) {
      throw new NotFoundException('Schedule not found');
    }

    return this.prisma.sectionSchedule.delete({ where: { id: scheduleId } });
  }

  private async validateScheduleConflict(orgId: string, sectionId: string, dto: CreateScheduleDto, excludeId?: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { 
        course: true,
        teachers: { select: { id: true } },
        enrollments: { select: { studentId: true } },
        defaultRoom: true,
      },
    });

    if (!section || section.course.organizationId !== orgId) throw new NotFoundException('Section not found');

    const teacherIds = section.teachers.map(t => t.id);
    const studentIds = section.enrollments.map(e => e.studentId);
    const targetRoom = dto.room || section.room;
    const targetRoomId = dto.roomId || section.defaultRoomId;

    // Check for overlaps using the rule: aStart < bEnd && bStart < aEnd
    const conflicts = await this.prisma.sectionSchedule.findMany({
      where: {
        section: { course: { organizationId: orgId } },
        day: dto.day,
        startTime: { lt: dto.endTime },
        endTime: { gt: dto.startTime },
        id: excludeId ? { not: excludeId } : undefined,
      },
      include: {
        section: {
          include: {
            teachers: { select: { id: true, user: { select: { name: true } } } },
            enrollments: { select: { studentId: true } },
            defaultRoom: true,
          }
        },
        roomRef: true,
      }
    });

    for (const conflict of conflicts) {
      // 1. Same Section Conflict
      if (conflict.sectionId === sectionId) {
          throw new ConflictException('Section already has a class at this time');
      }

      // 2. Room Conflict
      const conflictRoomId = conflict.roomId || conflict.section.defaultRoomId;
      if (targetRoomId && conflictRoomId === targetRoomId) {
          const roomName = conflict.roomRef?.name || 'Selected room';
          throw new ConflictException(`${roomName} is already occupied at this time`);
      }

      const conflictRoom = conflict.room || conflict.section.room;
      if (!targetRoomId && targetRoom && conflictRoom === targetRoom) {
          throw new ConflictException(`Room "${targetRoom}" is already occupied at this time`);
      }

      // 3. Teacher Conflict
      const conflictTeacher = conflict.section.teachers.find(t => teacherIds.includes(t.id));
      if (conflictTeacher) {
          throw new ConflictException(`Teacher "${conflictTeacher.user.name}" is already assigned to another section at this time`);
      }

      // 4. Student Conflict
      const hasStudentConflict = conflict.section.enrollments.some(e => studentIds.includes(e.studentId));
      if (hasStudentConflict) {
          throw new ConflictException('One or more students have conflicting schedules in another section');
      }
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
      include: { roomRef: { include: { building: true } } },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
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

  async getOrgTimetable(orgId: string, user: JwtPayload) {
    const sections = await this.sectionsService.getSections(orgId, {
      page: 1,
      limit: 1000,
      sortBy: 'courseName',
      sortOrder: 'asc',
    }, user);

    return extractTimetableEntries(sections.data);
  }

  async createAttendanceSession(
    orgId: string, 
    sectionId: string, 
    user: JwtPayload,
    date: string, 
    scheduleId?: string,
    startTime?: string,
    endTime?: string
  ) {
    await this.assertAttendanceSectionAccess(orgId, sectionId, user);
    await this.validateAttendanceSchedule(sectionId, scheduleId);
    
    const sessionDate = new Date(date);
    if (isNaN(sessionDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    
    const isAdhoc = !scheduleId;

    // Derive academicCycleId from section
    const sectionData = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { academicCycleId: true },
    });

    const existing = await this.prisma.attendanceSession.findFirst({
      where: { 
        sectionId,
        date: sessionDate,
        ...(scheduleId ? { scheduleId } : { isAdhoc: true })
      },
    });

    if (existing) {
      throw new ConflictException(
        isAdhoc 
          ? 'An ad-hoc attendance session already exists for this date' 
          : 'Attendance session already exists for this schedule and date'
      );
    }

    return this.prisma.attendanceSession.create({
      data: {
        sectionId,
        scheduleId,
        academicCycleId: sectionData?.academicCycleId,
        isAdhoc,
        date: sessionDate,
        startTime,
        endTime,
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
      include: { section: { include: { course: true } } },
    });
    if (!session || session.section.course.organizationId !== orgId) {
      throw new NotFoundException('Session not found');
    }

    await this.assertAttendanceSectionAccess(orgId, session.sectionId, user);
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
            room: true
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
        isAdhoc: s.isAdhoc,
        startTime: s.startTime || s.schedule?.startTime,
        endTime: s.endTime || s.schedule?.endTime,
        schedule: s.schedule
          ? {
              startTime: s.schedule.startTime,
              endTime: s.schedule.endTime,
              room: s.schedule.room,
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
    await this.validateAttendanceSchedule(sectionId, scheduleId);

    const sessionDate = new Date(date);
    const session = await this.prisma.attendanceSession.findFirst({
      where: { 
        sectionId, 
        date: sessionDate,
        scheduleId: scheduleId || null,
        ...(scheduleId ? {} : { isAdhoc: true })
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
