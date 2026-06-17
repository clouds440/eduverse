import { Injectable } from '@nestjs/common';
import { AttendanceStatus, InsightTone, MailStatus, Role, StudentStatus, TeacherStatus } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { InsightsQueryDto } from '../dto/insights-query.dto';
import { sortActivities } from '../shared/insights-activity.util';
import { getAttendanceCoverage } from '../shared/insights-attendance.util';
import { processDateTrendData } from '../shared/insights-chart.util';
import { resolveInsightDateRange } from '../shared/insights-date.util';
import { formatPercent, formatSectionLabel } from '../shared/insights-format.util';
import type { DashboardInsightItem, InsightsUser, StandardDashboardInsightsResponse } from '../shared/insights.types';
import { getBuildingRoomInsights } from '../helpers/building-room-insights.helper';
import { getDepartmentAdminInsights } from '../helpers/department-admin-insights.helper';

@Injectable()
export class AdminInsightsBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const now = new Date();
    const range = resolveInsightDateRange(query);

    const [
      teachers,
      students,
      courses,
      sections,
      schedules,
      attendanceSessions,
      attendanceRecords,
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
      pendingSubmissions,
      teacherWorkload,
      departmentInsights,
      buildingRoomInsights,
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
          date: { gte: range.from, lte: range.to },
        },
        select: { scheduleId: true, date: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          session: {
            section: { course: { organizationId: orgId } },
            isAdhoc: false,
            date: { gte: range.from, lte: range.to },
          },
        },
        include: {
          session: {
            select: {
              section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.assessment.findMany({
        where: {
          organizationId: orgId,
          dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
        },
        include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
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
        include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.attendanceSession.findMany({
        where: { section: { course: { organizationId: orgId } } },
        include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.mail.count({
        where: {
          organizationId: orgId,
          status: { in: [MailStatus.OPEN, MailStatus.IN_PROGRESS, MailStatus.AWAITING_RESPONSE] },
        },
      }),
      this.prisma.mail.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.enrollment.groupBy({
        by: ['createdAt'],
        where: {
          section: { course: { organizationId: orgId } },
          createdAt: { gte: range.from, lte: range.to },
        },
        _count: true,
      }),
      this.prisma.cohortMembershipHistory.groupBy({
        by: ['joinedAt'],
        where: {
          cohort: { organizationId: orgId },
          joinedAt: { gte: range.from, lte: range.to },
        },
        _count: true,
      }),
      this.prisma.attendanceSession.groupBy({
        by: ['date'],
        where: {
          section: { course: { organizationId: orgId } },
          isAdhoc: false,
          date: { gte: range.from, lte: range.to },
        },
        _count: true,
      }),
      this.getGradingBacklogCount(orgId, now),
      this.getTeacherWorkload(orgId),
      getDepartmentAdminInsights(this.prisma, orgId),
      getBuildingRoomInsights(this.prisma, orgId),
    ]);

    const attendanceCoverage = getAttendanceCoverage(
      schedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      range.from,
      range.to,
    );
    const sectionsWithoutTeachers = sections.filter((section) => section.teachers.length === 0);
    const sectionIdsWithSchedules = new Set(schedules.map((schedule) => schedule.section.id));
    const sectionsWithoutSchedules = sections.filter((section) => !sectionIdsWithSchedules.has(section.id));
    const topSections = [...sections]
      .sort((a, b) => b._count.enrollments - a._count.enrollments)
      .slice(0, 5);
    const enrollmentTrend = processDateTrendData(
      [
        ...studentEnrollmentsByDate,
        ...cohortMembershipsByDate.map((item) => ({ createdAt: item.joinedAt, _count: item._count })),
      ],
      range.from,
      range.to,
    );
    const attendanceTrend = processDateTrendData(attendanceCoverageByDate, range.from, range.to);
    const mailStatus = mailByStatus.map((item) => ({ status: item.status, count: item._count }));
    const sectionCapacity = topSections.map((section) => ({
      name: formatSectionLabel(section.name, section.course.name),
      courseName: section.course.name,
      color: section.color,
      enrolled: section._count.enrollments,
    }));
    const attendanceHotspots = this.getAttendanceHotspots(attendanceRecords);
    const spotlight = this.getOperationalSpotlight({
      sectionsWithoutTeachers,
      sectionsWithoutSchedules,
      openMailCount,
      pendingSubmissions,
      attendanceCoverage,
      attendanceHotspots,
      upcomingAssessments,
      topSections,
    });

    const recentActivity = sortActivities([
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
        description: `${assessment.title} in ${formatSectionLabel(assessment.section.name, assessment.section.course.name)}`,
        createdAt: assessment.createdAt.toISOString(),
        href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
        tone: InsightTone.WARNING,
      })),
      ...recentAttendance.map((session) => ({
        id: `attendance:${session.id}`,
        title: session.isAdhoc ? 'Ad-hoc attendance captured' : 'Attendance session captured',
        description: formatSectionLabel(session.section.name, session.section.course.name),
        createdAt: session.createdAt.toISOString(),
        href: `/attendance/${session.section.id}`,
        tone: session.isAdhoc ? InsightTone.WARNING : InsightTone.DEFAULT,
      })),
    ]);

    return {
      role: user.role || Role.ORG_ADMIN,
      filters: {
        selectedRange: range.range,
        interval: range.interval,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      headline: {
        eyebrow: 'Organization Analytics',
        title: 'Operational overview',
        subtitle: `Staffing, scheduling, attendance coverage, and assessment pressure for the selected ${range.range} window.`,
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
          id: 'coverage',
          label: 'Attendance Coverage',
          value: formatPercent(attendanceCoverage.percent),
          detail: `${attendanceCoverage.actual}/${attendanceCoverage.expected} scheduled slots marked in ${range.range}`,
          href: '/attendance',
          tone: attendanceCoverage.percent >= 85 ? InsightTone.SUCCESS : attendanceCoverage.percent >= 60 ? InsightTone.WARNING : InsightTone.DANGER,
        },
        {
          id: 'mail',
          label: 'Open Mail Threads',
          value: `${openMailCount}`,
          detail: 'Operational requests awaiting action',
          href: '/mail',
          tone: openMailCount > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'grading-backlog',
          label: 'Grading Backlog',
          value: `${pendingSubmissions}`,
          detail: 'Past-due submissions without a grade',
          href: '/grades',
          tone: pendingSubmissions > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
      ],
      spotlight,
      groups: [
        ...[departmentInsights.group, buildingRoomInsights.group].filter((group) => group !== null),
        {
          id: 'attendance-hotspots',
          title: 'Attendance hotspots',
          description: 'Sections with official attendance under 80% in the selected period.',
          items: attendanceHotspots.map((section) => ({
            id: `attendance-hotspot:${section.sectionId}`,
              title: `${formatSectionLabel(section.sectionName, section.courseName)} is at ${formatPercent(section.percent, 1)}`,
            description: section.courseName,
            meta: `${section.total} attendance marks`,
            href: `/attendance/${section.sectionId}`,
            badge: 'At risk',
            tone: InsightTone.DANGER,
          })),
        },
        {
          id: 'attention',
          title: 'Needs attention',
          description: 'Structural gaps and time-bound items that deserve follow-up.',
          items: [
            ...sectionsWithoutTeachers.slice(0, 3).map((section) => ({
              id: `staff-gap:${section.id}`,
              title: `${formatSectionLabel(section.name, section.course.name)} has no assigned teacher`,
              description: section.course.name,
              href: `/sections/${section.id}`,
              badge: 'Staffing gap',
              tone: InsightTone.WARNING,
            })),
            ...sectionsWithoutSchedules.slice(0, 3).map((section) => ({
              id: `schedule-gap:${section.id}`,
              title: `${formatSectionLabel(section.name, section.course.name)} has no timetable`,
              description: section.course.name,
              href: `/sections/${section.id}`,
              badge: 'Schedule gap',
              tone: InsightTone.DANGER,
            })),
            ...upcomingAssessments.slice(0, 3).map((assessment) => ({
              id: `due:${assessment.id}`,
              title: assessment.title,
              description: `${formatSectionLabel(assessment.section.name, assessment.section.course.name)} due soon`,
              meta: assessment.dueDate?.toLocaleDateString(),
              href: `/sections/${assessment.section.id}/assessments/${assessment.id}`,
              badge: 'Due soon',
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
            title: formatSectionLabel(section.name, section.course.name),
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
        departmentActivity: departmentInsights.chart,
        departmentPerformance: departmentInsights.performance,
        roomUsage: buildingRoomInsights.roomUsage,
        buildingUsage: buildingRoomInsights.buildingUsage,
      },
    };
  }

  private async getTeacherWorkload(orgId: string): Promise<{ name: string; sections: number; students: number }[]> {
    const teachers = await this.prisma.teacher.findMany({
      where: { organizationId: orgId, status: { not: TeacherStatus.DELETED } },
      include: {
        user: { select: { name: true } },
        sections: {
          include: { _count: { select: { enrollments: true } } },
        },
      },
    });

    return teachers.map((teacher) => ({
      name: teacher.user.name || 'Unknown',
      sections: teacher.sections.length,
      students: teacher.sections.reduce((sum, section) => sum + (section._count?.enrollments || 0), 0),
    }));
  }

  private async getGradingBacklogCount(orgId: string, now: Date) {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        organizationId: orgId,
        dueDate: { lt: now },
      },
      select: {
        _count: { select: { submissions: true, grades: true } },
      },
    });

    return assessments.reduce(
      (total, assessment) => total + Math.max(assessment._count.submissions - assessment._count.grades, 0),
      0,
    );
  }

  private getOperationalSpotlight(input: {
    sectionsWithoutTeachers: Array<{ id: string; name: string; course: { name: string } }>;
    sectionsWithoutSchedules: Array<{ id: string; name: string; course: { name: string } }>;
    openMailCount: number;
    pendingSubmissions: number;
    attendanceCoverage: { actual: number; expected: number; percent: number };
    attendanceHotspots: Array<{
      sectionId: string;
      sectionName: string;
      courseName: string;
      percent: number;
      total: number;
    }>;
    upcomingAssessments: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      section: { id: string; name: string; color: string; course: { name: string } };
    }>;
    topSections: Array<{ id: string; name: string; color: string; course: { name: string }; _count: { enrollments: number } }>;
  }): DashboardInsightItem | null {
    const unstaffedSection = input.sectionsWithoutTeachers[0];
    if (unstaffedSection) {
      return {
        id: `staff-gap:${unstaffedSection.id}`,
        title: `${formatSectionLabel(unstaffedSection.name, unstaffedSection.course.name)} needs a teacher`,
        description: unstaffedSection.course.name,
        href: `/sections/${unstaffedSection.id}`,
        badge: 'Staffing gap',
        tone: InsightTone.WARNING,
      };
    }

    const unscheduledSection = input.sectionsWithoutSchedules[0];
    if (unscheduledSection) {
      return {
        id: `schedule-gap:${unscheduledSection.id}`,
        title: `${formatSectionLabel(unscheduledSection.name, unscheduledSection.course.name)} needs a timetable`,
        description: unscheduledSection.course.name,
        href: `/sections/${unscheduledSection.id}`,
        badge: 'Schedule gap',
        tone: InsightTone.DANGER,
      };
    }

    if (input.openMailCount > 0) {
      return {
        id: 'open-mail',
        title: 'Operational mail needs review',
        description: 'Open, in-progress, or awaiting-response threads are pending.',
        meta: `${input.openMailCount} open threads`,
        href: '/mail',
        badge: 'Inbox',
        tone: InsightTone.WARNING,
      };
    }

    if (input.pendingSubmissions > 0) {
      return {
        id: 'grading-backlog',
        title: 'Grading backlog needs follow-up',
        description: 'Past-due submitted work has not been fully graded.',
        meta: `${input.pendingSubmissions} ungraded submissions`,
        href: '/grade-finalization',
        badge: 'Academic ops',
        tone: InsightTone.WARNING,
      };
    }

    if (input.attendanceCoverage.expected > 0 && input.attendanceCoverage.percent < 70) {
      return {
        id: 'coverage-low',
        title: 'Attendance follow-through is low',
        description: 'Scheduled slots are not being marked consistently in the selected period.',
        meta: `${input.attendanceCoverage.actual}/${input.attendanceCoverage.expected} slots marked`,
        href: '/attendance',
        badge: 'Coverage',
        tone: InsightTone.DANGER,
      };
    }

    const attendanceHotspot = input.attendanceHotspots[0];
    if (attendanceHotspot) {
      return {
        id: `attendance-hotspot:${attendanceHotspot.sectionId}`,
        title: `${formatSectionLabel(attendanceHotspot.sectionName, attendanceHotspot.courseName)} attendance is slipping`,
        description: attendanceHotspot.courseName,
        meta: formatPercent(attendanceHotspot.percent, 1),
        href: `/attendance/${attendanceHotspot.sectionId}`,
        badge: 'Attendance hotspot',
        tone: InsightTone.WARNING,
      };
    }

    const dueSoon = input.upcomingAssessments[0];
    if (dueSoon) {
      return {
        id: `due:${dueSoon.id}`,
        title: `${dueSoon.title} is due soon`,
        description: formatSectionLabel(dueSoon.section.name, dueSoon.section.course.name),
        meta: dueSoon.dueDate?.toLocaleDateString(),
        href: `/sections/${dueSoon.section.id}/assessments/${dueSoon.id}`,
        badge: 'Assessment',
        tone: InsightTone.INFO,
      };
    }

    const busiestSection = input.topSections[0];
    if (busiestSection) {
      return {
        id: `capacity:${busiestSection.id}`,
        title: `${formatSectionLabel(busiestSection.name, busiestSection.course.name)} is the busiest section`,
        description: busiestSection.course.name,
        meta: `${busiestSection._count.enrollments} students enrolled`,
        href: `/sections/${busiestSection.id}`,
        badge: 'Capacity',
        tone: InsightTone.INFO,
      };
    }

    return null;
  }

  private getAttendanceHotspots(records: Array<{
    status: string;
    session: { section: { id: string; name: string; color: string; course: { name: string } } };
  }>) {
    const attendanceBySection = new Map<string, {
      sectionName: string;
      courseName: string;
      color: string;
      present: number;
      total: number;
    }>();

    records.forEach((record) => {
      const section = record.session.section;
      const existing = attendanceBySection.get(section.id) || {
        sectionName: section.name,
        courseName: section.course.name,
        color: section.color,
        present: 0,
        total: 0,
      };
      existing.total += 1;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        existing.present += 1;
      }
      attendanceBySection.set(section.id, existing);
    });

    return Array.from(attendanceBySection.entries())
      .map(([sectionId, stats]) => ({
        sectionId,
        ...stats,
        percent: stats.total > 0 ? (stats.present / stats.total) * 100 : 100,
      }))
      .filter((section) => section.total >= 3 && section.percent < 80)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);
  }
}
