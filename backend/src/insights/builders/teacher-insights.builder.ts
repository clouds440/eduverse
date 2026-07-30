import { Injectable, NotFoundException } from '@nestjs/common';
import { ScheduleType } from '@/prisma/prisma-client';
import { AttendanceStatus, InsightTone, Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { InsightsQueryDto } from '../dto/insights-query.dto';
import { sortActivities } from '../shared/insights-activity.util';
import { getAttendanceCoverage, getMissingScheduledSessions, getUpcomingScheduleOccurrences } from '../shared/insights-attendance.util';
import { processGradeDistribution } from '../shared/insights-chart.util';
import { countWeekdayOccurrences, resolveInsightDateRange, toDateOnly } from '../shared/insights-date.util';
import { formatPercent, formatSectionLabel } from '../shared/insights-format.util';
import type { DashboardInsightItem, InsightsUser, StandardDashboardInsightsResponse } from '../shared/insights.types';

@Injectable()
export class TeacherInsightsBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async buildShell(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const teacher = await this.getTeacher(orgId, user);
    const now = new Date();
    const range = resolveInsightDateRange(query);
    const sections = await this.getTeacherSections(teacher.id);
    const sectionIds = sections.map((section) => section.id);
    const assignedSchedules = this.getAssignedSchedules(sections);

    const [attendanceSessions, uniqueStudentEnrollments, gradingBacklog, upcomingAssessments] = await Promise.all([
      this.getOfficialAttendanceSessions(sectionIds, range.from, range.to),
      this.prisma.enrollment.count({ where: { sectionId: { in: sectionIds } } }),
      this.getGradingBacklog(sectionIds, now),
      this.prisma.assessment.findMany({
        where: {
          sectionId: { in: sectionIds },
          dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
        },
        include: {
          section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
          _count: { select: { submissions: true, grades: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
    ]);

    const attendanceCoverage = getAttendanceCoverage(
      assignedSchedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      range.from,
      range.to,
    );
    const nextClass = getUpcomingScheduleOccurrences(assignedSchedules, 1)[0];

    return {
      role: user.role || Role.TEACHER,
      filters: {
        selectedRange: range.range,
        interval: range.interval,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      headline: {
        eyebrow: user.role === Role.ORG_MANAGER ? 'Manager Insights' : 'Teaching Insights',
        title: 'Teaching command center',
        subtitle: `Fast teaching snapshot. Detailed teaching modules load independently for the selected ${range.range} window.`,
      },
      summaryCards: [
        {
          id: 'sections',
          label: 'Assigned Sections',
          value: `${sections.length}`,
          detail: `${assignedSchedules.length} weekly slots configured`,
          href: '/sections?my=true',
          tone: InsightTone.INFO,
        },
        {
          id: 'students',
          label: 'Students Reached',
          value: `${uniqueStudentEnrollments}`,
          detail: 'Across all assigned sections',
          href: '/users/students?my=true',
          tone: InsightTone.DEFAULT,
        },
        {
          id: 'coverage',
          label: 'Attendance Follow-through',
          value: formatPercent(attendanceCoverage.percent),
          detail: `${attendanceCoverage.actual}/${attendanceCoverage.expected} scheduled slots marked in ${range.range}`,
          href: '/attendance',
          tone:
            attendanceCoverage.percent >= 85
              ? InsightTone.SUCCESS
              : attendanceCoverage.percent >= 60
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'grading-backlog',
          label: 'Ungraded Submissions',
          value: `${gradingBacklog.total}`,
          detail: `${gradingBacklog.items.length} past-due assessments need grading`,
          href: '/grades',
          tone: gradingBacklog.total > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
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
      spotlight: this.getSpotlight({
        nextClass,
        gradingBacklog,
        atRiskStudents: [],
        lowGradeSections: [],
      }),
      groups: [],
      recentActivity: [],
      charts: {},
    };
  }

  async buildModule(
    orgId: string,
    user: InsightsUser,
    module: string,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const teacher = await this.getTeacher(orgId, user);
    const now = new Date();
    const range = resolveInsightDateRange(query);
    const sections = await this.getTeacherSections(teacher.id);
    const sectionIds = sections.map((section) => section.id);
    const assignedSchedules = this.getAssignedSchedules(sections);
    const base = this.emptyResponse(user, range);

    if (module === 'summary') {
      return this.buildShell(orgId, user, query);
    }

    if (module === 'charts') {
      const [attendanceSessions, gradesBySection, assessmentCompletion] = await Promise.all([
        this.getOfficialAttendanceSessions(sectionIds, range.from, range.to),
        this.getPublishedGrades(sectionIds),
        this.getAssessmentCompletion(sectionIds, range.from, range.to),
      ]);
      return {
        ...base,
        charts: {
          attendanceTrend: this.getDailyAttendanceCoverageTrend(
            assignedSchedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
            attendanceSessions,
            range.from,
            range.to,
          ),
          gradeDistribution: processGradeDistribution(gradesBySection),
          assessmentCompletion,
        },
      };
    }

    if (module === 'actions') {
      const [attendanceSessions, officialAttendanceRecords, gradesBySection, gradingBacklog, upcomingAssessments] = await Promise.all([
        this.getOfficialAttendanceSessions(sectionIds, range.from, range.to),
        this.getOfficialAttendanceRecords(sectionIds, range.from, range.to),
        this.getPublishedGrades(sectionIds),
        this.getGradingBacklog(sectionIds, now),
        this.prisma.assessment.findMany({
          where: {
            sectionId: { in: sectionIds },
            dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
          },
          include: {
            section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
            _count: { select: { submissions: true, grades: true } },
          },
          orderBy: { dueDate: 'asc' },
          take: 6,
        }),
      ]);
      const missedSessions = getMissingScheduledSessions(
        assignedSchedules.map((schedule) => ({
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
      const atRiskStudents = this.getAtRiskStudents(officialAttendanceRecords);
      const lowGradeSections = this.getLowGradeSections(gradesBySection);
      return {
        ...base,
        groups: this.getActionGroups(sectionIds, range.range, gradingBacklog, missedSessions, atRiskStudents, lowGradeSections, upcomingAssessments),
      };
    }

    if (module === 'activity') {
      const [submissions, recentAssessments, recentAttendance] = await Promise.all([
        this.getRecentSubmissions(sectionIds, range.from, range.to),
        this.prisma.assessment.findMany({
          where: { sectionId: { in: sectionIds } },
          include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 4,
        }),
        this.prisma.attendanceSession.findMany({
          where: { sectionId: { in: sectionIds } },
          include: {
            section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
            schedule: { select: { type: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 4,
        }),
      ]);
      return {
        ...base,
        recentActivity: this.getRecentActivity(submissions, recentAssessments, recentAttendance),
      };
    }

    return base;
  }

  async build(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const teacher = await this.getTeacher(orgId, user);

    const now = new Date();
    const range = resolveInsightDateRange(query);

    const sections = await this.getTeacherSections(teacher.id);

    const sectionIds = sections.map((section) => section.id);
    const scheduleIds = sections.flatMap((section) => section.schedules.map((schedule) => schedule.id));

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
      gradingBacklog,
      assessmentCompletion,
    ] = await Promise.all([
      this.prisma.assessment.findMany({
        where: {
          sectionId: { in: sectionIds },
          dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
        },
        include: {
          section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
          _count: { select: { submissions: true, grades: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      this.prisma.attendanceSession.findMany({
        where: {
          scheduleId: { in: scheduleIds },
          schedule: { type: ScheduleType.OFFICIAL },
          date: { gte: range.from, lte: range.to },
        },
        select: { scheduleId: true, date: true },
      }),
      this.prisma.submission.findMany({
        where: {
          assessment: { sectionId: { in: sectionIds } },
          submittedAt: { gte: range.from, lte: range.to },
        },
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
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
        include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.attendanceSession.findMany({
        where: { sectionId: { in: sectionIds } },
        include: {
          section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
          schedule: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          session: {
            sectionId: { in: sectionIds },
            schedule: { type: ScheduleType.OFFICIAL },
            date: { gte: range.from, lte: range.to },
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
      this.prisma.attendanceSession.groupBy({
        by: ['date'],
        where: {
          sectionId: { in: sectionIds },
          schedule: { type: ScheduleType.OFFICIAL },
          date: { gte: range.from, lte: range.to },
        },
        _count: true,
      }),
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
      this.getGradingBacklog(sectionIds, now),
      this.getAssessmentCompletion(sectionIds, range.from, range.to),
    ]);

    const assignedSchedules = sections.flatMap((section) =>
      section.schedules.map((schedule) => ({
        ...schedule,
        section: {
          id: section.id,
          name: section.name,
          color: section.color,
          room: section.room,
          course: { name: section.course.name },
        },
      })),
    );

    const uniqueStudents = uniqueStudentEnrollments.length;
    const attendanceCoverage = getAttendanceCoverage(
      assignedSchedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      range.from,
      range.to,
    );
    const nextClass = getUpcomingScheduleOccurrences(assignedSchedules, 1)[0];
    const missedSessions = getMissingScheduledSessions(
      assignedSchedules.map((schedule) => ({
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

    const attendanceTrend = this.getDailyAttendanceCoverageTrend(
      assignedSchedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      range.from,
      range.to,
    );
    const gradeDistribution = processGradeDistribution(gradesBySection);
    const atRiskStudents = this.getAtRiskStudents(officialAttendanceRecords);
    const lowGradeSections = this.getLowGradeSections(gradesBySection);

    const spotlight = this.getSpotlight({
      nextClass,
      gradingBacklog,
      atRiskStudents,
      lowGradeSections,
    });

    const recentActivity = sortActivities([
      ...submissions.map((submission) => ({
        id: `submission:${submission.id}`,
        title: 'Submission received',
        description: `${submission.student.user.name || 'Student'} - ${submission.assessment.title}`,
        createdAt: submission.submittedAt.toISOString(),
        href: `/sections/${submission.assessment.section.id}/assessments/${submission.assessment.id}`,
        tone: InsightTone.INFO,
      })),
      ...recentAssessments.map((assessment) => ({
        id: `assessment:${assessment.id}`,
        title: 'Assessment updated',
        description: `${assessment.title} - ${formatSectionLabel(assessment.section.name, assessment.section.course.name)}`,
        createdAt: assessment.createdAt.toISOString(),
        href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
        tone: InsightTone.WARNING,
      })),
      ...recentAttendance.map((session) => ({
        id: `attendance:${session.id}`,
        title: session.schedule.type === ScheduleType.AD_HOC ? 'Ad-hoc attendance saved' : 'Attendance saved',
        description: formatSectionLabel(session.section.name, session.section.course.name),
        createdAt: session.createdAt.toISOString(),
        href: `/attendance/${session.section.id}`,
        tone: InsightTone.SUCCESS,
      })),
    ]);

    return {
      role: user.role || Role.TEACHER,
      filters: {
        selectedRange: range.range,
        interval: range.interval,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      headline: {
        eyebrow: user.role === Role.ORG_MANAGER ? 'Manager Insights' : 'Teaching Insights',
        title: 'Teaching command center',
        subtitle: `Attendance follow-through, learner risk, grading pressure, and deadlines for the selected ${range.range} window.`,
      },
      summaryCards: [
        {
          id: 'sections',
          label: 'Assigned Sections',
          value: `${sections.length}`,
          detail: `${assignedSchedules.length} weekly slots configured`,
          href: '/sections?my=true',
          tone: InsightTone.INFO,
        },
        {
          id: 'students',
          label: 'Students Reached',
          value: `${uniqueStudents}`,
          detail: 'Across all assigned sections',
          href: '/users/students?my=true',
          tone: InsightTone.DEFAULT,
        },
        {
          id: 'coverage',
          label: 'Attendance Follow-through',
          value: formatPercent(attendanceCoverage.percent),
          detail: `${attendanceCoverage.actual}/${attendanceCoverage.expected} scheduled slots marked in ${range.range}`,
          href: '/attendance',
          tone:
            attendanceCoverage.percent >= 85
              ? InsightTone.SUCCESS
              : attendanceCoverage.percent >= 60
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'grading-backlog',
          label: 'Ungraded Submissions',
          value: `${gradingBacklog.total}`,
          detail: `${gradingBacklog.items.length} past-due assessments need grading`,
          href: '/grades',
          tone: gradingBacklog.total > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
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
      spotlight,
      groups: [
        {
          id: 'grading-backlog',
          title: 'Grading backlog',
          description: 'Past-due submitted work that has not been fully graded yet.',
          items: gradingBacklog.items.map((item) => ({
            id: `grading:${item.assessmentId}`,
            title: item.title,
            description: formatSectionLabel(item.sectionName, item.courseName),
            meta: `${item.ungraded} ungraded`,
            href: `/sections/${item.sectionId}/assessments/${item.assessmentId}`,
            badge: 'Grade',
            tone: InsightTone.WARNING,
          })),
        },
        {
          id: 'attendance-gaps',
          title: 'Missing attendance',
          description: 'Scheduled slots from the last 7 days that still need a marked session.',
          items: missedSessions.map((session) => ({
            id: `missing:${session.scheduleId}:${session.date}`,
            title: `${formatSectionLabel(session.sectionName, session.courseName)} - ${session.startTime}-${session.endTime}`,
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
          description: `Students below 75% official attendance in the selected ${range.range} window.`,
          items: atRiskStudents.map((student) => ({
            id: `risk:${student.studentId}`,
            title: student.name,
            description: 'Official attendance trend',
            meta: formatPercent(student.percent),
            href: student.sectionId ? `/attendance/${student.sectionId}` : '/users/students?my=true',
            badge: 'At risk',
            tone: InsightTone.DANGER,
          })),
        },
        {
          id: 'academic-risk',
          title: 'Academic risk',
          description: 'Sections where released grades are trending below target.',
          items: lowGradeSections.map((section) => ({
            id: `grade-risk:${section.sectionId}`,
            title: `${formatSectionLabel(section.sectionName, section.courseName)} average is ${formatPercent(section.average, 1)}`,
            description: section.courseName,
            meta: `${section.graded} grades`,
            href: `/sections/${section.sectionId}`,
            badge: 'Grade risk',
            tone: InsightTone.WARNING,
          })),
        },
        {
          id: 'upcoming',
          title: 'Upcoming deadlines',
          description: 'Work that will hit students soon and may need reminders or grading prep.',
          items: upcomingAssessments.map((assessment) => ({
            id: `assessment:${assessment.id}`,
            title: assessment.title,
            description: formatSectionLabel(assessment.section.name, assessment.section.course.name),
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

  private emptyResponse(
    user: InsightsUser,
    range: ReturnType<typeof resolveInsightDateRange>,
  ): StandardDashboardInsightsResponse {
    return {
      role: user.role || Role.TEACHER,
      filters: {
        selectedRange: range.range,
        interval: range.interval,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      headline: {
        eyebrow: user.role === Role.ORG_MANAGER ? 'Manager Insights' : 'Teaching Insights',
        title: 'Teaching command center',
        subtitle: `Teaching module for the selected ${range.range} window.`,
      },
      summaryCards: [],
      spotlight: null,
      groups: [],
      recentActivity: [],
      charts: {},
    };
  }

  private async getTeacher(orgId: string, user: InsightsUser) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: user.id, organizationId: orgId },
      include: { user: { select: { name: true } } },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    return teacher;
  }

  private getTeacherSections(teacherId: string) {
    return this.prisma.section.findMany({
      where: { teachers: { some: { id: teacherId } } },
      include: {
        course: { select: { name: true } },
        schedules: true,
        _count: { select: { enrollments: true } },
      },
    });
  }

  private getAssignedSchedules(sections: Awaited<ReturnType<TeacherInsightsBuilder['getTeacherSections']>>) {
    return sections.flatMap((section) =>
      section.schedules.map((schedule) => ({
        ...schedule,
        section: {
          id: section.id,
          name: section.name,
          color: section.color,
          room: section.room,
          course: { name: section.course.name },
        },
      })),
    );
  }

  private getOfficialAttendanceSessions(sectionIds: string[], from: Date, to: Date) {
    return this.prisma.attendanceSession.findMany({
      where: {
        sectionId: { in: sectionIds },
        schedule: { type: ScheduleType.OFFICIAL },
        date: { gte: from, lte: to },
      },
      select: { scheduleId: true, date: true },
    });
  }

  private getOfficialAttendanceRecords(sectionIds: string[], from: Date, to: Date) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        session: {
          sectionId: { in: sectionIds },
          schedule: { type: ScheduleType.OFFICIAL },
          date: { gte: from, lte: to },
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
    });
  }

  private getPublishedGrades(sectionIds: string[]) {
    return this.prisma.grade.findMany({
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
    });
  }

  private getRecentSubmissions(sectionIds: string[], from: Date, to: Date) {
    return this.prisma.submission.findMany({
      where: {
        assessment: { sectionId: { in: sectionIds } },
        submittedAt: { gte: from, lte: to },
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
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
    });
  }

  private getDailyAttendanceCoverageTrend(
    schedules: { id: string; day: number }[],
    sessions: { scheduleId: string | null; date: Date }[],
    from: Date,
    to: Date,
  ) {
    const sessionsByDate = new Map<string, Set<string>>();
    sessions.forEach((session) => {
      if (!session.scheduleId) return;
      const key = toDateOnly(session.date);
      const set = sessionsByDate.get(key) || new Set<string>();
      set.add(session.scheduleId);
      sessionsByDate.set(key, set);
    });

    const rows: { date: string; value: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const expected = schedules.reduce(
        (total, schedule) => total + countWeekdayOccurrences(cursor, cursor, schedule.day),
        0,
      );
      const actual = sessionsByDate.get(toDateOnly(cursor))?.size || 0;
      rows.push({ date: toDateOnly(cursor), value: expected > 0 ? Math.round((actual / expected) * 100) : 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return rows;
  }

  private getRecentActivity(
    submissions: Awaited<ReturnType<TeacherInsightsBuilder['getRecentSubmissions']>>,
    recentAssessments: Array<{
      id: string;
      title: string;
      createdAt: Date;
      section: { id: string; name: string; course: { name: string } };
    }>,
    recentAttendance: Array<{
      id: string;
      createdAt: Date;
      schedule: { type: ScheduleType };
      section: { id: string; name: string; course: { name: string } };
    }>,
  ) {
    return sortActivities([
      ...submissions.map((submission) => ({
        id: `submission:${submission.id}`,
        title: 'Submission received',
        description: `${submission.student.user.name || 'Student'} - ${submission.assessment.title}`,
        createdAt: submission.submittedAt.toISOString(),
        href: `/sections/${submission.assessment.section.id}/assessments/${submission.assessment.id}`,
        tone: InsightTone.INFO,
      })),
      ...recentAssessments.map((assessment) => ({
        id: `assessment:${assessment.id}`,
        title: 'Assessment updated',
        description: `${assessment.title} - ${formatSectionLabel(assessment.section.name, assessment.section.course.name)}`,
        createdAt: assessment.createdAt.toISOString(),
        href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
        tone: InsightTone.WARNING,
      })),
      ...recentAttendance.map((session) => ({
        id: `attendance:${session.id}`,
        title: session.schedule.type === ScheduleType.AD_HOC ? 'Ad-hoc attendance saved' : 'Attendance saved',
        description: formatSectionLabel(session.section.name, session.section.course.name),
        createdAt: session.createdAt.toISOString(),
        href: `/attendance/${session.section.id}`,
        tone: InsightTone.SUCCESS,
      })),
    ]);
  }

  private getActionGroups(
    _sectionIds: string[],
    rangeLabel: string,
    gradingBacklog: Awaited<ReturnType<TeacherInsightsBuilder['getGradingBacklog']>>,
    missedSessions: ReturnType<typeof getMissingScheduledSessions>,
    atRiskStudents: ReturnType<TeacherInsightsBuilder['getAtRiskStudents']>,
    lowGradeSections: ReturnType<TeacherInsightsBuilder['getLowGradeSections']>,
    upcomingAssessments: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      section: { id: string; name: string; course: { name: string } };
      _count: { submissions: number };
    }>,
  ) {
    return [
      {
        id: 'grading-backlog',
        title: 'Grading backlog',
        description: 'Past-due submitted work that has not been fully graded yet.',
        items: gradingBacklog.items.map((item) => ({
          id: `grading:${item.assessmentId}`,
          title: item.title,
          description: formatSectionLabel(item.sectionName, item.courseName),
          meta: `${item.ungraded} ungraded`,
          href: `/sections/${item.sectionId}/assessments/${item.assessmentId}`,
          badge: 'Grade',
          tone: InsightTone.WARNING,
        })),
      },
      {
        id: 'attendance-gaps',
        title: 'Missing attendance',
        description: 'Scheduled slots from the last 7 days that still need a marked session.',
        items: missedSessions.map((session) => ({
          id: `missing:${session.scheduleId}:${session.date}`,
          title: `${formatSectionLabel(session.sectionName, session.courseName)} - ${session.startTime}-${session.endTime}`,
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
        description: `Students below 75% official attendance in the selected ${rangeLabel} window.`,
        items: atRiskStudents.map((student) => ({
          id: `risk:${student.studentId}`,
          title: student.name,
          description: 'Official attendance trend',
          meta: formatPercent(student.percent),
          href: student.sectionId ? `/attendance/${student.sectionId}` : '/users/students?my=true',
          badge: 'At risk',
          tone: InsightTone.DANGER,
        })),
      },
      {
        id: 'academic-risk',
        title: 'Academic risk',
        description: 'Sections where released grades are trending below target.',
        items: lowGradeSections.map((section) => ({
          id: `grade-risk:${section.sectionId}`,
          title: `${formatSectionLabel(section.sectionName, section.courseName)} average is ${formatPercent(section.average, 1)}`,
          description: section.courseName,
          meta: `${section.graded} grades`,
          href: `/sections/${section.sectionId}`,
          badge: 'Grade risk',
          tone: InsightTone.WARNING,
        })),
      },
      {
        id: 'upcoming',
        title: 'Upcoming deadlines',
        description: 'Work that will hit students soon and may need reminders or grading prep.',
        items: upcomingAssessments.map((assessment) => ({
          id: `assessment:${assessment.id}`,
          title: assessment.title,
          description: formatSectionLabel(assessment.section.name, assessment.section.course.name),
          meta: assessment.dueDate?.toLocaleDateString(),
          href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
          badge: `${assessment._count.submissions} submissions`,
          tone: InsightTone.INFO,
        })),
      },
    ];
  }

  private async getAssessmentCompletion(sectionIds: string[], from: Date, to: Date) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        sectionId: { in: sectionIds },
        OR: [
          { dueDate: { gte: from, lte: to } },
          { createdAt: { gte: from, lte: to } },
        ],
      },
      include: {
        section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
        _count: { select: { submissions: true } },
      },
    });

    const enrollmentCounts = await this.prisma.enrollment.groupBy({
      by: ['sectionId'],
      where: { sectionId: { in: sectionIds } },
      _count: true,
    });
    const enrollmentMap = new Map(enrollmentCounts.map((item) => [item.sectionId, item._count]));

    const rows = new Map<string, { section: string; courseName: string; color: string; completed: number; total: number }>();
    assessments.forEach((assessment) => {
      const row = rows.get(assessment.sectionId) || {
        section: formatSectionLabel(assessment.section.name, assessment.section.course.name),
        courseName: assessment.section.course.name,
        color: assessment.section.color,
        completed: 0,
        total: 0,
      };
      row.completed += assessment._count.submissions;
      row.total += enrollmentMap.get(assessment.sectionId) || 0;
      rows.set(assessment.sectionId, row);
    });

    return Array.from(rows.values());
  }

  private async getGradingBacklog(sectionIds: string[], now: Date) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        sectionId: { in: sectionIds },
        dueDate: { lt: now },
      },
      include: {
        section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
        _count: { select: { submissions: true, grades: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const items = assessments
      .map((assessment) => ({
        assessmentId: assessment.id,
        sectionId: assessment.section.id,
        sectionName: assessment.section.name,
        courseName: assessment.section.course.name,
        color: assessment.section.color,
        title: assessment.title,
        ungraded: Math.max(assessment._count.submissions - assessment._count.grades, 0),
      }))
      .filter((item) => item.ungraded > 0)
      .sort((a, b) => b.ungraded - a.ungraded)
      .slice(0, 5);

    return {
      total: items.reduce((sum, item) => sum + item.ungraded, 0),
      items,
    };
  }

  private getAtRiskStudents(records: Array<{
    status: string;
    session: { sectionId: string };
    student: { id: string; user: { name: string | null } };
  }>) {
    const attendanceByStudent = new Map<string, {
      studentName: string;
      sectionIds: Set<string>;
      present: number;
      total: number;
    }>();

    records.forEach((record) => {
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

    return Array.from(attendanceByStudent.entries())
      .map(([studentId, stats]) => ({
        studentId,
        name: stats.studentName,
        percent: stats.total > 0 ? (stats.present / stats.total) * 100 : 100,
        sectionId: Array.from(stats.sectionIds)[0] || null,
      }))
      .filter((student) => student.percent < 75)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);
  }

  private getLowGradeSections(grades: Array<{
    marksObtained: number;
    assessment: {
      totalMarks: number;
      section: { id: string; name: string; course: { name: string } };
    };
  }>) {
    const rows = new Map<string, {
      sectionName: string;
      courseName: string;
      total: number;
      graded: number;
    }>();

    grades.forEach((grade) => {
      const section = grade.assessment.section;
      const row = rows.get(section.id) || {
        sectionName: section.name,
        courseName: section.course.name,
        total: 0,
        graded: 0,
      };
      row.total += (grade.marksObtained / grade.assessment.totalMarks) * 100;
      row.graded += 1;
      rows.set(section.id, row);
    });

    return Array.from(rows.entries())
      .map(([sectionId, row]) => ({
        sectionId,
        ...row,
        average: row.graded > 0 ? row.total / row.graded : 0,
      }))
      .filter((section) => section.graded >= 2 && section.average < 65)
      .sort((a, b) => a.average - b.average)
      .slice(0, 5);
  }

  private getSpotlight(input: {
    nextClass?: ReturnType<typeof getUpcomingScheduleOccurrences>[number];
    gradingBacklog: { total: number; items: { assessmentId: string; sectionId: string; sectionName: string; courseName: string; title: string; ungraded: number }[] };
    atRiskStudents: { studentId: string; name: string; percent: number; sectionId: string | null }[];
    lowGradeSections: { sectionId: string; sectionName: string; courseName: string; average: number }[];
  }): DashboardInsightItem | null {
    const topBacklog = input.gradingBacklog.items[0];
    if (topBacklog) {
      return {
        id: `grading:${topBacklog.assessmentId}`,
        title: `${topBacklog.title} needs grading`,
        description: formatSectionLabel(topBacklog.sectionName, topBacklog.courseName),
        meta: `${topBacklog.ungraded} ungraded`,
        href: `/sections/${topBacklog.sectionId}/assessments/${topBacklog.assessmentId}`,
        badge: 'Grading backlog',
        tone: InsightTone.WARNING,
      };
    }

    const topRisk = input.atRiskStudents[0];
    if (topRisk) {
      return {
        id: `risk:${topRisk.studentId}`,
        title: `${topRisk.name} attendance is slipping`,
        description: 'Official attendance in selected period',
        meta: formatPercent(topRisk.percent),
        href: topRisk.sectionId ? `/attendance/${topRisk.sectionId}` : '/users/students?my=true',
        badge: 'Learner risk',
        tone: InsightTone.DANGER,
      };
    }

    const lowGrade = input.lowGradeSections[0];
    if (lowGrade) {
      return {
        id: `grade-risk:${lowGrade.sectionId}`,
        title: `${formatSectionLabel(lowGrade.sectionName, lowGrade.courseName)} needs academic follow-up`,
        description: lowGrade.courseName,
        meta: formatPercent(lowGrade.average, 1),
        href: `/sections/${lowGrade.sectionId}`,
        badge: 'Grade risk',
        tone: InsightTone.WARNING,
      };
    }

    if (input.nextClass) {
      return {
        id: 'next-class',
        title: `${formatSectionLabel(input.nextClass.sectionName, input.nextClass.courseName)} is your next class`,
        description: `${input.nextClass.courseName} - ${input.nextClass.startTime}-${input.nextClass.endTime}${input.nextClass.room ? ` - ${input.nextClass.room}` : ''}`,
        meta: input.nextClass.startsAt.toLocaleString(),
        href: `/attendance/${input.nextClass.sectionId}?scheduleId=${input.nextClass.scheduleId}&date=${toDateOnly(input.nextClass.startsAt)}`,
        badge: 'Next class',
        tone: InsightTone.INFO,
      };
    }

    return null;
  }
}
