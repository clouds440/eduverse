import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TeacherStatus, StudentStatus, MailStatus, InsightTone, AttendanceStatus } from '../common/enums';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

export interface DashboardInsightCard {
  id: string;
  label: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: InsightTone;
}

export interface DashboardInsightItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  href?: string;
  badge?: string;
  tone?: InsightTone;
}

export interface DashboardInsightGroup {
  id: string;
  title: string;
  description?: string;
  items: DashboardInsightItem[];
}

export interface DashboardInsightActivity {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  href?: string;
  tone?: InsightTone;
}

export interface DashboardInsightsResponse {
  role: string;
  headline: {
    eyebrow?: string;
    title: string;
    subtitle: string;
  };
  summaryCards: DashboardInsightCard[];
  spotlight: DashboardInsightItem | null;
  groups: DashboardInsightGroup[];
  recentActivity: DashboardInsightActivity[];
  // Visualization data
  charts?: {
    attendanceTrend?: { date: string; value: number }[];
    enrollmentTrend?: { date: string; value: number }[];
    gradeDistribution?: { range: string; count: number }[];
    sectionCapacity?: { name: string; enrolled: number; capacity?: number }[];
    mailStatus?: { status: string; count: number }[];
    assessmentCompletion?: { section: string; completed: number; total: number }[];
    teacherWorkload?: { name: string; sections: number; students: number }[];
    studentPerformance?: { subject: string; grade: number; attendance: number }[];
  };
}

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) { }

  private formatPercent(value: number, fractionDigits = 0) {
    if (!Number.isFinite(value)) return '0%';
    return `${value.toFixed(fractionDigits)}%`;
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private countWeekdayOccurrences(start: Date, end: Date, targetDay: number) {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);

    let count = 0;
    while (cursor <= endDate) {
      if (cursor.getDay() === targetDay) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  private getAttendanceCoverage(
    schedules: { id: string; day: number }[],
    sessions: { scheduleId: string | null; date: Date }[],
    start: Date,
    end: Date,
  ) {
    const expected = schedules.reduce(
      (total, schedule) => total + this.countWeekdayOccurrences(start, end, schedule.day),
      0,
    );

    const uniqueSessions = new Set(
      sessions
        .filter((session) => session.scheduleId)
        .map((session) => `${session.scheduleId}:${this.toDateOnly(session.date)}`),
    );

    const actual = uniqueSessions.size;
    return {
      actual,
      expected,
      percent: expected > 0 ? (actual / expected) * 100 : 100,
    };
  }

  private getUpcomingScheduleOccurrences(
    schedules: {
      id: string;
      day: number;
      startTime: string;
      endTime: string;
      room?: string | null;
      section: { id: string; name: string; course: { name: string }; room?: string | null };
    }[],
    limit = 5,
  ) {
    const now = new Date();
    const occurrences = schedules.map((schedule) => {
      const occurrenceDate = new Date(now);
      occurrenceDate.setHours(0, 0, 0, 0);
      const delta = (schedule.day - occurrenceDate.getDay() + 7) % 7;
      occurrenceDate.setDate(occurrenceDate.getDate() + delta);

      const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
      const startsAt = new Date(occurrenceDate);
      startsAt.setHours(startHour, startMinute, 0, 0);

      if (startsAt <= now) {
        startsAt.setDate(startsAt.getDate() + 7);
      }

      return {
        scheduleId: schedule.id,
        sectionId: schedule.section.id,
        sectionName: schedule.section.name,
        courseName: schedule.section.course.name,
        room: schedule.room || schedule.section.room || null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        startsAt,
      };
    });

    return occurrences
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit);
  }

  private getMissingScheduledSessions(
    schedules: {
      id: string;
      day: number;
      startTime: string;
      endTime: string;
      section: { id: string; name: string; course: { name: string } };
    }[],
    existingSessions: { scheduleId: string | null; date: Date }[],
    daysBack: number,
    limit = 5,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - daysBack);

    const existingKeys = new Set(
      existingSessions
        .filter((session) => session.scheduleId)
        .map((session) => `${session.scheduleId}:${this.toDateOnly(session.date)}`),
    );

    const missing: {
      scheduleId: string;
      date: string;
      sectionId: string;
      sectionName: string;
      courseName: string;
      startTime: string;
      endTime: string;
    }[] = [];

    schedules.forEach((schedule) => {
      const cursor = new Date(start);
      while (cursor <= today) {
        if (cursor.getDay() === schedule.day) {
          const dateKey = this.toDateOnly(cursor);
          if (!existingKeys.has(`${schedule.id}:${dateKey}`)) {
            missing.push({
              scheduleId: schedule.id,
              date: dateKey,
              sectionId: schedule.section.id,
              sectionName: schedule.section.name,
              courseName: schedule.section.course.name,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
            });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return missing
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);
  }

  private sortActivities(activities: DashboardInsightActivity[], limit = 6) {
    return activities
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private processDateTrendData(
    groupByData: { createdAt?: Date; date?: Date; _count: number }[],
    startDate: Date,
    endDate: Date,
  ): { date: string; value: number }[] {
    const result: { date: string; value: number }[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDateOnly = new Date(endDate);
    endDateOnly.setHours(23, 59, 59, 999);

    // Create a map of date to count
    const dataMap = new Map<string, number>();
    groupByData.forEach((item) => {
      const dateKey = item.createdAt
        ? this.formatLocalDate(item.createdAt)
        : item.date
          ? this.formatLocalDate(item.date)
          : '';
      if (dateKey) {
        dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + item._count);
      }
    });

    // Fill in all dates in range
    while (currentDate.getTime() <= endDateOnly.getTime()) {
      const dateKey = this.formatLocalDate(currentDate);
      result.push({
        date: dateKey,
        value: dataMap.get(dateKey) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  private async getTeacherWorkload(orgId: string): Promise<{ name: string; sections: number; students: number }[]> {
    const teachers = await this.prisma.teacher.findMany({
      where: { organizationId: orgId, status: { not: TeacherStatus.DELETED } },
      include: {
        user: { select: { name: true } },
        sections: {
          include: {
            _count: { select: { enrollments: true } },
          },
        },
      },
    });

    return teachers.map((teacher) => ({
      name: teacher.user.name || 'Unknown',
      sections: teacher.sections.length,
      students: teacher.sections.reduce((sum, section) => sum + (section._count?.enrollments || 0), 0),
    }));
  }

  private processGradeDistribution(grades: Array<{ marksObtained: number; assessment: { totalMarks: number; section: { course: { name: string } } } }>): { range: string; count: number }[] {
    const distribution = {
      '90-100%': 0,
      '80-89%': 0,
      '70-79%': 0,
      '60-69%': 0,
      '50-59%': 0,
      '0-49%': 0,
    };

    grades.forEach((grade) => {
      const percentage = (grade.marksObtained / grade.assessment.totalMarks) * 100;
      if (percentage >= 90) distribution['90-100%']++;
      else if (percentage >= 80) distribution['80-89%']++;
      else if (percentage >= 70) distribution['70-79%']++;
      else if (percentage >= 60) distribution['60-69%']++;
      else if (percentage >= 50) distribution['50-59%']++;
      else distribution['0-49%']++;
    });

    return Object.entries(distribution).map(([range, count]) => ({ range, count }));
  }

  private async getAssessmentCompletion(sectionIds: string[]): Promise<{ section: string; completed: number; total: number }[]> {
    const assessments = await this.prisma.assessment.findMany({
      where: { sectionId: { in: sectionIds } },
      include: {
        section: { select: { name: true } },
      },
    });

    // Get submission counts and enrollment counts separately
    const assessmentIds = assessments.map((a) => a.id);
    const [submissionCounts, enrollmentCounts] = await Promise.all([
      this.prisma.submission.groupBy({
        by: ['assessmentId'],
        where: { assessmentId: { in: assessmentIds } },
        _count: true,
      }),
      this.prisma.enrollment.groupBy({
        by: ['sectionId'],
        where: { sectionId: { in: sectionIds } },
        _count: true,
      }),
    ]);

    const submissionMap = new Map(
      submissionCounts.map((s) => [s.assessmentId, s._count]),
    );
    const enrollmentMap = new Map(
      enrollmentCounts.map((e) => [e.sectionId, e._count]),
    );

    return assessments.map((assessment) => ({
      section: assessment.section.name,
      completed: submissionMap.get(assessment.id) || 0,
      total: enrollmentMap.get(assessment.sectionId) || 0,
    }));
  }

  private async buildOrgAdminInsights(
    orgId: string,
    user: JwtPayload,
  ): Promise<DashboardInsightsResponse> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);

    const [
      teachers,
      students,
      courses,
      sections,
      schedules,
      attendanceSessions,
      upcomingAssessments,
      recentTeachers,
      recentStudents,
      recentAssessments,
      recentAttendance,
      openMailCount,
      mailByStatus,
      studentEnrollmentsByDate,
      cohortMembershipsByDate,
      attendanceCoverageByDate,
    ] = await Promise.all([
      this.prisma.teacher.count({
        where: { organizationId: orgId, status: { not: TeacherStatus.DELETED } },
      }),
      this.prisma.student.count({
        where: { organizationId: orgId, status: { not: StudentStatus.DELETED } },
      }),
      this.prisma.course.count({ where: { organizationId: orgId } }),
      this.prisma.section.findMany({
        where: { course: { organizationId: orgId } },
        include: {
          course: { select: { name: true } },
          teachers: { select: { id: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      this.prisma.sectionSchedule.findMany({
        where: { section: { course: { organizationId: orgId } } },
        include: {
          section: {
            select: {
              id: true,
              name: true,
              room: true,
              course: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.attendanceSession.findMany({
        where: {
          section: { course: { organizationId: orgId } },
          isAdhoc: false,
          date: { gte: fourteenDaysAgo, lte: now },
        },
        select: { scheduleId: true, date: true },
      }),
      this.prisma.assessment.findMany({
        where: {
          organizationId: orgId,
          dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
        },
        include: { section: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      this.prisma.teacher.findMany({
        where: { organizationId: orgId, status: { not: TeacherStatus.DELETED } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.student.findMany({
        where: { organizationId: orgId, status: { not: StudentStatus.DELETED } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.assessment.findMany({
        where: { organizationId: orgId },
        include: { section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.attendanceSession.findMany({
        where: { section: { course: { organizationId: orgId } } },
        include: { section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.mail.count({
        where: {
          organizationId: orgId,
          status: {
            in: [MailStatus.OPEN, MailStatus.IN_PROGRESS, MailStatus.AWAITING_RESPONSE],
          },
        },
      }),
      this.prisma.mail.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true,
      }),
      // Enrollment trend data (last 30 days)
      this.prisma.enrollment.groupBy({
        by: ['createdAt'],
        where: {
          section: { course: { organizationId: orgId } },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
      // Cohort membership trend data (last 30 days)
      this.prisma.cohortMembershipHistory.groupBy({
        by: ['joinedAt'],
        where: {
          cohort: { organizationId: orgId },
          joinedAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
      // Attendance coverage by date (last 30 days)
      this.prisma.attendanceSession.groupBy({
        by: ['date'],
        where: {
          section: { course: { organizationId: orgId } },
          isAdhoc: false,
          date: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
    ]);

    const attendanceCoverage = this.getAttendanceCoverage(
      schedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      fourteenDaysAgo,
      now,
    );
    const sectionsWithoutTeachers = sections.filter((section) => section.teachers.length === 0);
    const sectionIdsWithSchedules = new Set(schedules.map((schedule) => schedule.section.id));
    const sectionsWithoutSchedules = sections.filter(
      (section) => !sectionIdsWithSchedules.has(section.id),
    );
    const topSections = [...sections]
      .sort((a, b) => b._count.enrollments - a._count.enrollments)
      .slice(0, 5);
    const nextClass = this.getUpcomingScheduleOccurrences(schedules, 1)[0];

    // Process chart data - merge section enrollments and cohort memberships for enrollment trend
    const cohortMembershipTrend = cohortMembershipsByDate.map((item) => ({
      createdAt: item.joinedAt,
      _count: item._count,
    }));
    const allEnrollments = [...studentEnrollmentsByDate, ...cohortMembershipTrend];
    const enrollmentTrend = this.processDateTrendData(allEnrollments, thirtyDaysAgo, now);
    const attendanceTrend = this.processDateTrendData(attendanceCoverageByDate, thirtyDaysAgo, now);
    const mailStatus = mailByStatus.map((item) => ({
      status: item.status,
      count: item._count,
    }));
    const sectionCapacity = topSections.map((section) => ({
      name: section.name,
      enrolled: section._count?.enrollments || 0,
    }));
    const teacherWorkload = await this.getTeacherWorkload(orgId);

    const recentActivity = this.sortActivities([
      ...recentTeachers.map((teacher) => ({
        id: `teacher:${teacher.id}`,
        title: 'Teacher added',
        description: teacher.user.name || 'New teacher profile created',
        createdAt: teacher.createdAt.toISOString(),
        href: '/teachers',
        tone: InsightTone.INFO,
      })),
      ...recentStudents.map((student) => ({
        id: `student:${student.id}`,
        title: 'Student enrolled',
        description: student.user.name || student.registrationNumber,
        createdAt: student.createdAt.toISOString(),
        href: '/students',
        tone: InsightTone.SUCCESS,
      })),
      ...recentAssessments.map((assessment) => ({
        id: `assessment:${assessment.id}`,
        title: 'Assessment published',
        description: `${assessment.title} in ${assessment.section.name}`,
        createdAt: assessment.createdAt.toISOString(),
        href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
        tone: InsightTone.WARNING,
      })),
      ...recentAttendance.map((session) => ({
        id: `attendance:${session.id}`,
        title: session.isAdhoc ? 'Ad-hoc attendance captured' : 'Attendance session captured',
        description: session.section.name,
        createdAt: session.createdAt.toISOString(),
        href: `/attendance/${session.section.id}`,
        tone: session.isAdhoc ? InsightTone.WARNING : InsightTone.DEFAULT,
      })),
    ]);

    return {
      role: user.role || Role.ORG_ADMIN,
      headline: {
        eyebrow: 'Organization Analytics',
        title: 'Operational overview',
        subtitle:
          'Live staffing, scheduling, attendance coverage, and assessment pressure across the organization.',
      },
      summaryCards: [
        {
          id: 'staff',
          label: 'Active Staff',
          value: `${teachers}`,
          detail: `${sectionsWithoutTeachers.length} sections need a teacher`,
          href: '/teachers',
          tone: sectionsWithoutTeachers.length > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'students',
          label: 'Active Students',
          value: `${students}`,
          detail: `${sections.length} active sections`,
          href: '/students',
          tone: InsightTone.INFO,
        },
        {
          id: 'courses',
          label: 'Learning Units',
          value: `${courses}`,
          detail: `${sections.length} sections in delivery`,
          href: '/courses',
          tone: InsightTone.DEFAULT,
        },
        {
          id: 'coverage',
          label: 'Attendance Coverage',
          value: this.formatPercent(attendanceCoverage.percent),
          detail: `${attendanceCoverage.actual}/${attendanceCoverage.expected} scheduled slots marked in 14 days`,
          href: '/attendance',
          tone:
            attendanceCoverage.percent >= 85
              ? InsightTone.SUCCESS
              : attendanceCoverage.percent >= 60
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'mail',
          label: 'Open Mail Threads',
          value: `${openMailCount}`,
          detail: 'Operational requests awaiting action',
          href: '/mail',
          tone: openMailCount > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
      ],
      spotlight: nextClass
        ? {
          id: 'next-class',
          title: `${nextClass.sectionName} is up next`,
          description: `${nextClass.courseName} • ${nextClass.startTime}-${nextClass.endTime}${nextClass.room ? ` • ${nextClass.room}` : ''}`,
          meta: nextClass.startsAt.toLocaleString(),
          href: `/attendance/${nextClass.sectionId}?scheduleId=${nextClass.scheduleId}&date=${this.toDateOnly(nextClass.startsAt)}`,
          badge: 'Next class',
          tone: InsightTone.INFO,
        }
        : null,
      groups: [
        {
          id: 'attention',
          title: 'Needs attention',
          description: 'Structural gaps and time-bound items that deserve follow-up.',
          items: [
            ...sectionsWithoutTeachers.slice(0, 3).map((section) => ({
              id: `staff-gap:${section.id}`,
              title: `${section.name} has no assigned teacher`,
              description: section.course.name,
              href: `/sections/${section.id}`,
              badge: 'Staffing gap',
              tone: InsightTone.WARNING,
            })),
            ...sectionsWithoutSchedules.slice(0, 3).map((section) => ({
              id: `schedule-gap:${section.id}`,
              title: `${section.name} has no timetable`,
              description: section.course.name,
              href: `/sections/${section.id}`,
              badge: 'Schedule gap',
              tone: InsightTone.DANGER,
            })),
            ...upcomingAssessments.slice(0, 3).map((assessment) => ({
              id: `due:${assessment.id}`,
              title: assessment.title,
              description: `${assessment.section.name} due soon`,
              meta: assessment.dueDate?.toLocaleDateString(),
              href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
              badge: 'Due in 7 days',
              tone: InsightTone.INFO,
            })),
          ],
        },
        {
          id: 'capacity',
          title: 'Section hotspots',
          description: 'Most populated sections in the organization right now.',
          items: topSections.map((section) => ({
            id: `section:${section.id}`,
            title: section.name,
            description: section.course.name,
            meta: `${section._count.enrollments} students`,
            href: `/sections/${section.id}`,
            badge: section.teachers.length > 0 ? 'Staffed' : 'Unstaffed',
            tone: section.teachers.length > 0 ? InsightTone.SUCCESS : InsightTone.WARNING,
          })),
        },
      ],
      recentActivity,
      charts: {
        enrollmentTrend,
        attendanceTrend,
        mailStatus,
        sectionCapacity,
        teacherWorkload,
      },
    };
  }

  private async buildTeacherInsights(
    orgId: string,
    user: JwtPayload,
  ): Promise<DashboardInsightsResponse> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: user.id, organizationId: orgId },
      include: { user: { select: { name: true } } },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);

    const sections = await this.prisma.section.findMany({
      where: { teachers: { some: { id: teacher.id } } },
      include: {
        course: { select: { name: true } },
        schedules: true,
        _count: { select: { enrollments: true } },
      },
    });

    const sectionIds = sections.map((section) => section.id);
    const scheduleIds = sections.flatMap((section) =>
      section.schedules.map((schedule) => schedule.id),
    );

    const [
      upcomingAssessments,
      attendanceSessions,
      submissions,
      recentAssessments,
      recentAttendance,
      officialAttendanceRecords,
      uniqueStudentEnrollments,
      attendanceByDate,
      gradesBySection,
    ] = await Promise.all([
      this.prisma.assessment.findMany({
        where: {
          sectionId: { in: sectionIds },
          dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
        },
        include: {
          section: { select: { id: true, name: true } },
          _count: { select: { submissions: true, grades: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      this.prisma.attendanceSession.findMany({
        where: {
          scheduleId: { in: scheduleIds },
          isAdhoc: false,
          date: { gte: fourteenDaysAgo, lte: now },
        },
        select: { scheduleId: true, date: true },
      }),
      this.prisma.submission.findMany({
        where: { assessment: { sectionId: { in: sectionIds } } },
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              section: { select: { id: true, name: true } },
            },
          },
          student: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }),
      this.prisma.assessment.findMany({
        where: { sectionId: { in: sectionIds } },
        include: { section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.attendanceSession.findMany({
        where: { sectionId: { in: sectionIds } },
        include: { section: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          session: {
            sectionId: { in: sectionIds },
            isAdhoc: false,
          },
        },
        orderBy: { session: { date: 'desc' } },
        include: {
          session: { select: { sectionId: true } },
          student: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.enrollment.findMany({
        where: { sectionId: { in: sectionIds } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      // Attendance by date for trend (last 30 days)
      this.prisma.attendanceSession.groupBy({
        by: ['date'],
        where: {
          sectionId: { in: sectionIds },
          isAdhoc: false,
          date: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
      // Grade data for distribution
      this.prisma.grade.findMany({
        where: {
          assessment: { sectionId: { in: sectionIds } },
          status: { in: ['PUBLISHED', 'FINALIZED'] },
        },
        include: {
          assessment: {
            include: {
              section: {
                select: { id: true, name: true, course: { select: { name: true } } },
              },
            },
          },
        },
      }),
    ]);

    const schedules = sections.flatMap((section) =>
      section.schedules.map((schedule) => ({
        ...schedule,
        section: {
          id: section.id,
          name: section.name,
          room: section.room,
          course: { name: section.course.name },
        },
      })),
    );

    const uniqueStudents = uniqueStudentEnrollments.length;
    const attendanceCoverage = this.getAttendanceCoverage(
      schedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      fourteenDaysAgo,
      now,
    );
    const nextClass = this.getUpcomingScheduleOccurrences(schedules, 1)[0];
    const missedSessions = this.getMissingScheduledSessions(
      schedules.map((schedule) => ({
        id: schedule.id,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        section: {
          id: schedule.section.id,
          name: schedule.section.name,
          course: { name: schedule.section.course.name },
        },
      })),
      attendanceSessions,
      7,
      5,
    );

    // Process chart data for teacher
    const attendanceTrend = this.processDateTrendData(attendanceByDate, thirtyDaysAgo, now);
    const gradeDistribution = this.processGradeDistribution(gradesBySection);
    const assessmentCompletion = await this.getAssessmentCompletion(sectionIds);

    const attendanceByStudent = new Map<
      string,
      {
        studentName: string;
        sectionIds: Set<string>;
        present: number;
        total: number;
      }
    >();

    officialAttendanceRecords.forEach((record) => {
      const existing = attendanceByStudent.get(record.student.id) || {
        studentName: record.student.user.name || 'Student',
        sectionIds: new Set<string>(),
        present: 0,
        total: 0,
      };

      existing.sectionIds.add(record.session.sectionId);
      existing.total += 1;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        existing.present += 1;
      }
      attendanceByStudent.set(record.student.id, existing);
    });

    const atRiskStudents = Array.from(attendanceByStudent.entries())
      .map(([studentId, stats]) => ({
        studentId,
        name: stats.studentName,
        percent: stats.total > 0 ? (stats.present / stats.total) * 100 : 100,
        sectionId: Array.from(stats.sectionIds)[0] || null,
      }))
      .filter((student) => student.percent < 75)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);

    const recentActivity = this.sortActivities([
      ...submissions.map((submission) => ({
        id: `submission:${submission.id}`,
        title: 'Submission received',
        description: `${submission.student.user.name || 'Student'} • ${submission.assessment.title}`,
        createdAt: submission.submittedAt.toISOString(),
        href: `/sections/${submission.assessment.section.id}/assessments/${submission.assessment.id}`,
        tone: InsightTone.INFO,
      })),
      ...recentAssessments.map((assessment) => ({
        id: `assessment:${assessment.id}`,
        title: 'Assessment updated',
        description: `${assessment.title} • ${assessment.section.name}`,
        createdAt: assessment.createdAt.toISOString(),
        href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
        tone: InsightTone.WARNING,
      })),
      ...recentAttendance.map((session) => ({
        id: `attendance:${session.id}`,
        title: session.isAdhoc ? 'Ad-hoc attendance saved' : 'Attendance saved',
        description: session.section.name,
        createdAt: session.createdAt.toISOString(),
        href: `/attendance/${session.section.id}`,
        tone: InsightTone.SUCCESS,
      })),
    ]);

    return {
      role: user.role || Role.TEACHER,
      headline: {
        eyebrow: user.role === Role.ORG_MANAGER ? 'Manager Insights' : 'Teaching Insights',
        title: 'Teaching command center',
        subtitle:
          'See your next class, attendance follow-through, learner risk signals, and upcoming deadlines in one place.',
      },
      summaryCards: [
        {
          id: 'sections',
          label: 'Assigned Sections',
          value: `${sections.length}`,
          detail: `${schedules.length} weekly slots configured`,
          href: '/sections?my=true',
          tone: InsightTone.INFO,
        },
        {
          id: 'students',
          label: 'Students Reached',
          value: `${uniqueStudents}`,
          detail: 'Across all assigned sections',
          href: '/students?my=true',
          tone: InsightTone.DEFAULT,
        },
        {
          id: 'coverage',
          label: 'Attendance Follow-through',
          value: this.formatPercent(attendanceCoverage.percent),
          detail: `${attendanceCoverage.actual}/${attendanceCoverage.expected} scheduled slots marked in 14 days`,
          href: '/attendance',
          tone:
            attendanceCoverage.percent >= 85
              ? InsightTone.SUCCESS
              : attendanceCoverage.percent >= 60
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'deadlines',
          label: 'Due This Week',
          value: `${upcomingAssessments.length}`,
          detail: 'Assessments closing in the next 7 days',
          href: '/sections',
          tone: upcomingAssessments.length > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
      ],
      spotlight: nextClass
        ? {
          id: 'next-class',
          title: `${nextClass.sectionName} is your next class`,
          description: `${nextClass.courseName} • ${nextClass.startTime}-${nextClass.endTime}${nextClass.room ? ` • ${nextClass.room}` : ''}`,
          meta: nextClass.startsAt.toLocaleString(),
          href: `/attendance/${nextClass.sectionId}?scheduleId=${nextClass.scheduleId}&date=${this.toDateOnly(nextClass.startsAt)}`,
          badge: 'Next class',
          tone: InsightTone.INFO,
        }
        : null,
      groups: [
        {
          id: 'attendance-gaps',
          title: 'Missing attendance',
          description: 'Scheduled slots from the last 7 days that still need a marked session.',
          items: missedSessions.map((session) => ({
            id: `missing:${session.scheduleId}:${session.date}`,
            title: `${session.sectionName} • ${session.startTime}-${session.endTime}`,
            description: session.courseName,
            meta: session.date,
            href: `/attendance/${session.sectionId}?scheduleId=${session.scheduleId}&date=${session.date}`,
            badge: 'Mark now',
            tone: InsightTone.WARNING,
          })),
        },
        {
          id: 'learner-risk',
          title: 'Learner risk signals',
          description: 'Students trending below 75% official attendance in your sections.',
          items: atRiskStudents.map((student) => ({
            id: `risk:${student.studentId}`,
            title: student.name,
            description: 'Official attendance trend',
            meta: this.formatPercent(student.percent),
            href: student.sectionId ? `/attendance/${student.sectionId}` : '/students?my=true',
            badge: 'At risk',
            tone: InsightTone.DANGER,
          })),
        },
        {
          id: 'upcoming',
          title: 'Upcoming deadlines',
          description: 'Work that will hit students soon and may need reminders or grading prep.',
          items: upcomingAssessments.map((assessment) => ({
            id: `assessment:${assessment.id}`,
            title: assessment.title,
            description: assessment.section.name,
            meta: assessment.dueDate?.toLocaleDateString(),
            href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
            badge: `${assessment._count.submissions} submissions`,
            tone: InsightTone.INFO,
          })),
        },
      ],
      recentActivity,
      charts: {
        attendanceTrend,
        gradeDistribution,
        assessmentCompletion,
      },
    };
  }

  private async buildStudentInsights(
    orgId: string,
    user: JwtPayload,
  ): Promise<DashboardInsightsResponse> {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      include: { user: { select: { name: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);

    const [enrollments, grades, attendanceRecords, pendingAssessments, submissions, attendanceByDate] =
      await Promise.all([
        this.prisma.enrollment.findMany({
          where: {
            studentId: student.id,
            section: { course: { organizationId: orgId } },
          },
          include: {
            section: {
              include: {
                course: { select: { name: true } },
                schedules: true,
              },
            },
          },
        }),
        this.calculateFinalGrade(student.id),
        this.prisma.attendanceRecord.findMany({
          where: {
            studentId: student.id,
            session: {
              section: { course: { organizationId: orgId } },
              isAdhoc: false,
            },
          },
          orderBy: { session: { date: 'desc' } },
          include: {
            session: {
              include: {
                section: {
                  select: {
                    id: true,
                    name: true,
                    course: { select: { name: true } },
                  },
                },
              },
            },
          },
        }),
        this.prisma.assessment.findMany({
          where: {
            section: {
              enrollments: { some: { studentId: student.id } },
              course: { organizationId: orgId },
            },
            submissions: { none: { studentId: student.id } },
          },
          include: { section: { select: { id: true, name: true } } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 8,
        }),
        this.prisma.submission.findMany({
          where: { studentId: student.id },
          include: {
            assessment: {
              include: { section: { select: { id: true, name: true } } },
            },
          },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
        // Attendance by date for trend (last 30 days)
        this.prisma.attendanceSession.groupBy({
          by: ['date'],
          where: {
            section: {
              enrollments: { some: { studentId: student.id } },
              course: { organizationId: orgId },
            },
            isAdhoc: false,
            date: { gte: thirtyDaysAgo },
          },
          _count: true,
        }),
      ]);

    const officialPresent = attendanceRecords.filter(
      (record) => record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE,
    ).length;
    const overallAttendancePercent =
      attendanceRecords.length > 0
        ? (officialPresent / attendanceRecords.length) * 100
        : 100;
    const averageGrade =
      grades.length > 0
        ? grades.reduce((sum, grade) => sum + grade.finalPercentage, 0) / grades.length
        : 0;

    // Process chart data for student
    const attendanceTrend = this.processDateTrendData(attendanceByDate, thirtyDaysAgo, now);
    const gradeDistribution = this.processGradeDistribution(grades.map((g) => ({
      marksObtained: g.finalPercentage,
      assessment: { totalMarks: 100, section: { course: { name: g.courseName } } },
    })));
    const studentPerformance = grades.map((g) => ({
      subject: g.courseName,
      grade: g.finalPercentage,
      attendance: 0, // Will calculate below
    }));

    // Calculate attendance per subject for performance chart
    const attendanceCountsBySection = new Map<string, { present: number; total: number }>();
    attendanceRecords.forEach((record) => {
      const sectionId = record.session.section.id;
      const existing = attendanceCountsBySection.get(sectionId) || { present: 0, total: 0 };
      existing.total += 1;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        existing.present += 1;
      }
      attendanceCountsBySection.set(sectionId, existing);
    });

    studentPerformance.forEach((perf) => {
      const gradeData = grades.find((g) => g.courseName === perf.subject);
      if (gradeData) {
        const sectionAttendance = attendanceCountsBySection.get(gradeData.sectionId);
        if (sectionAttendance) {
          perf.attendance = (sectionAttendance.present / sectionAttendance.total) * 100;
        }
      }
    });

    const attendanceBySection = new Map<
      string,
      {
        sectionName: string;
        courseName: string;
        present: number;
        total: number;
      }
    >();

    attendanceRecords.forEach((record) => {
      const existing = attendanceBySection.get(record.session.section.id) || {
        sectionName: record.session.section.name,
        courseName: record.session.section.course.name,
        present: 0,
        total: 0,
      };
      existing.total += 1;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        existing.present += 1;
      }
      attendanceBySection.set(record.session.section.id, existing);
    });

    const lowAttendanceSections = Array.from(attendanceBySection.entries())
      .map(([sectionId, stats]) => ({
        sectionId,
        ...stats,
        percent: stats.total > 0 ? (stats.present / stats.total) * 100 : 100,
      }))
      .filter((section) => section.percent < 75)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);

    const lowGradeSections = grades
      .filter((grade) => grade.finalPercentage < 60)
      .sort((a, b) => a.finalPercentage - b.finalPercentage)
      .slice(0, 5);

    const upcomingClasses = this.getUpcomingScheduleOccurrences(
      enrollments.flatMap((enrollment) =>
        enrollment.section.schedules.map((schedule) => ({
          ...schedule,
          section: {
            id: enrollment.section.id,
            name: enrollment.section.name,
            room: enrollment.section.room,
            course: { name: enrollment.section.course.name },
          },
        })),
      ),
      5,
    );

    const nextClass = upcomingClasses[0];
    const nextDeadline = pendingAssessments.find((assessment) => assessment.dueDate);

    const spotlight = (() => {
      if (
        nextDeadline?.dueDate &&
        (!nextClass || nextDeadline.dueDate.getTime() <= nextClass.startsAt.getTime())
      ) {
        return {
          id: `deadline:${nextDeadline.id}`,
          title: `${nextDeadline.title} needs attention`,
          description: `${nextDeadline.section.name} • ${nextDeadline.type}`,
          meta: `Due ${nextDeadline.dueDate.toLocaleString()}`,
          href: `/students/${student.userId}?tab=assessments&assessmentId=${nextDeadline.id}`,
          badge: 'Nearest deadline',
          tone: InsightTone.WARNING,
        };
      }

      if (nextClass) {
        return {
          id: 'next-class',
          title: `${nextClass.sectionName} is your next class`,
          description: `${nextClass.courseName} • ${nextClass.startTime}-${nextClass.endTime}${nextClass.room ? ` • ${nextClass.room}` : ''}`,
          meta: nextClass.startsAt.toLocaleString(),
          href: '/timetable',
          badge: 'Next class',
          tone: InsightTone.INFO,
        };
      }

      return null;
    })();

    const recentActivity = this.sortActivities([
      ...submissions.map((submission) => ({
        id: `submission:${submission.id}`,
        title: 'Submission recorded',
        description: `${submission.assessment.title} • ${submission.assessment.section.name}`,
        createdAt: submission.submittedAt.toISOString(),
        href: `/students/${student.userId}?tab=assessments&assessmentId=${submission.assessment.id}`,
        tone: InsightTone.SUCCESS,
      })),
      ...attendanceRecords.slice(0, 4).map((record) => ({
        id: `attendance:${record.id}`,
        title: 'Attendance updated',
        description: `${record.session.section.name} • ${record.status}`,
        createdAt: record.session.date.toISOString(),
        href: `/students/${student.userId}?tab=attendance`,
        tone:
          record.status === AttendanceStatus.ABSENT
            ? InsightTone.DANGER
            : record.status === AttendanceStatus.LATE
              ? InsightTone.WARNING
              : InsightTone.SUCCESS,
      })),
    ]);

    return {
      role: user.role || Role.STUDENT,
      headline: {
        eyebrow: 'Student Insights',
        title: 'Academic overview',
        subtitle:
          'Track attendance, final standing, upcoming coursework, and the classes that need the most attention.',
      },
      summaryCards: [
        {
          id: 'sections',
          label: 'Enrolled Sections',
          value: `${enrollments.length}`,
          detail: `${upcomingClasses.length} upcoming classes in view`,
          href: `/students/${student.userId}?tab=courses`,
          tone: InsightTone.INFO,
        },
        {
          id: 'grade',
          label: 'Average Final Grade',
          value: grades.length > 0 ? this.formatPercent(averageGrade, 1) : 'No grade',
          detail: `${grades.length} graded sections`,
          href: `/students/${student.userId}?tab=grades`,
          tone:
            averageGrade >= 80
              ? InsightTone.SUCCESS
              : averageGrade >= 60
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'attendance',
          label: 'Official Attendance',
          value: this.formatPercent(overallAttendancePercent),
          detail: `${attendanceRecords.length} official attendance marks`,
          href: `/students/${student.userId}?tab=attendance`,
          tone:
            overallAttendancePercent >= 85
              ? InsightTone.SUCCESS
              : overallAttendancePercent >= 75
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'pending',
          label: 'Pending Assessments',
          value: `${pendingAssessments.length}`,
          detail: 'Awaiting your submission',
          href: `/students/${student.userId}?tab=assessments`,
          tone: pendingAssessments.length > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
      ],
      spotlight,
      groups: [
        {
          id: 'attention',
          title: 'Needs attention',
          description: 'Low-attendance or low-grade sections that may affect standing.',
          items: [
            ...lowAttendanceSections.map((section, idx) => ({
              id: `attendance-risk:${section.sectionId}-${idx}`,
              title: `${section.sectionName} attendance is low`,
              description: section.courseName,
              meta: this.formatPercent(section.percent),
              href: `/students/${student.userId}?tab=attendance`,
              badge: 'Attendance risk',
              tone: InsightTone.DANGER,
            })),
            ...lowGradeSections.map((grade, idx) => ({
              id: `grade-risk:${grade.sectionId}-${idx}`,
              title: `${grade.sectionName} grade is below target`,
              description: grade.courseName,
              meta: this.formatPercent(grade.finalPercentage, 1),
              href: `/students/${student.userId}?tab=grades`,
              badge: 'Grade risk',
              tone: InsightTone.WARNING,
            })),
          ].slice(0, 6),
        },
        {
          id: 'upcoming',
          title: 'Coming up',
          description: 'Deadlines and classes that will shape your next few days.',
          items: [
            ...pendingAssessments.slice(0, 4).map((assessment) => ({
              id: `pending:${assessment.id}`,
              title: assessment.title,
              description: `${assessment.section.name} • ${assessment.type}`,
              meta: assessment.dueDate
                ? `Due ${assessment.dueDate.toLocaleDateString()}`
                : 'No due date',
              href: `/students/${student.userId}?tab=assessments&assessmentId=${assessment.id}`,
              badge: 'Pending',
              tone: InsightTone.WARNING,
            })),
            ...upcomingClasses.slice(0, 4).map((next) => ({
              id: `class:${next.scheduleId}:${next.startsAt.toISOString()}`,
              title: `${next.sectionName} • ${next.startTime}-${next.endTime}`,
              description: next.courseName,
              meta: next.startsAt.toLocaleString(),
              href: '/timetable',
              badge: 'Class',
              tone: InsightTone.INFO,
            })),
          ].slice(0, 8),
        },
      ],
      recentActivity,
      charts: {
        attendanceTrend,
        gradeDistribution,
        studentPerformance,
      },
    };
  }

  private async calculateFinalGrade(studentId: string) {
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        status: { in: ['PUBLISHED', 'FINALIZED'] },
      },
      include: {
        assessment: {
          include: {
            section: {
              select: {
                id: true,
                name: true,
                course: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return grades.map((grade) => ({
      sectionId: grade.assessment.section.id,
      sectionName: grade.assessment.section.name,
      courseName: grade.assessment.section.course.name,
      finalPercentage: (grade.marksObtained / grade.assessment.totalMarks) * 100,
    }));
  }

  async getInsights(
    orgId: string,
    user: JwtPayload,
  ): Promise<DashboardInsightsResponse> {
    if (user.role === Role.ORG_ADMIN) {
      return this.buildOrgAdminInsights(orgId, user);
    }

    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      return this.buildTeacherInsights(orgId, user);
    }

    if (user.role === Role.STUDENT) {
      return this.buildStudentInsights(orgId, user);
    }

    throw new ForbiddenException('Insights are not available for this role.');
  }
}
