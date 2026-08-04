import { Injectable } from '@nestjs/common';
import { EntryStatus, PaymentClaimStatus, PreferenceWindowStatus, ScheduleType } from '@/prisma/prisma-client';
import { AttendanceStatus, InsightTone, MailStatus, Role, StudentStatus, TeacherStatus } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { InsightsQueryDto } from '../dto/insights-query.dto';
import { sortActivities } from '../shared/insights-activity.util';
import { getAttendanceCoverage } from '../shared/insights-attendance.util';
import { processDateTrendData } from '../shared/insights-chart.util';
import { countWeekdayOccurrences, resolveInsightDateRange, toDateOnly } from '../shared/insights-date.util';
import { formatPercent, formatSectionLabel } from '../shared/insights-format.util';
import type { DashboardInsightGroup, DashboardInsightItem, InsightsUser, StandardDashboardInsightsResponse } from '../shared/insights.types';
import { getBuildingRoomInsights } from '../helpers/building-room-insights.helper';
import { getDepartmentAdminInsights } from '../helpers/department-admin-insights.helper';

type AdminSection = Awaited<ReturnType<AdminInsightsBuilder['getSections']>>[number];
type OfficialSchedule = Awaited<ReturnType<AdminInsightsBuilder['getOfficialSchedules']>>[number];
type AttendanceSessionForInsight = Awaited<ReturnType<AdminInsightsBuilder['getAttendanceSessions']>>[number];
type AttendanceRecordAggregate = Awaited<ReturnType<AdminInsightsBuilder['getAttendanceRecordAggregates']>>[number];
type UpcomingAssessment = Awaited<ReturnType<AdminInsightsBuilder['getUpcomingAssessments']>>[number];

@Injectable()
export class AdminInsightsBuilder {
  constructor(private readonly prisma: PrismaService) {}

  private emptyResponse(
    user: InsightsUser,
    range: ReturnType<typeof resolveInsightDateRange>,
  ): StandardDashboardInsightsResponse {
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
        subtitle: `Current setup health plus selected ${range.range} activity.`,
      },
      summaryCards: [],
      spotlight: null,
      groups: [],
      recentActivity: [],
      charts: {},
    };
  }

  async buildShell(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const now = new Date();
    const range = resolveInsightDateRange(query);
    const [
      teachers,
      students,
      sections,
      officialSchedules,
      attendanceSessions,
      pendingSubmissions,
      openMailCount,
      upcomingAssessments,
      operationalHealth,
      activePrograms,
    ] = await Promise.all([
      this.prisma.teacher.count({ where: { organizationId: orgId, status: { not: TeacherStatus.DELETED } } }),
      this.prisma.student.count({ where: { organizationId: orgId, status: { not: StudentStatus.DELETED } } }),
      this.getSections(orgId),
      this.getOfficialSchedules(orgId),
      this.getAttendanceSessions(orgId, range.from, range.to),
      this.getGradingBacklogCount(orgId, now),
      this.prisma.mail.count({
        where: {
          organizationId: orgId,
          status: { in: [MailStatus.OPEN, MailStatus.IN_PROGRESS, MailStatus.AWAITING_RESPONSE] },
        },
      }),
      this.getUpcomingAssessments(orgId, now),
      this.getOperationalHealth(orgId, now, range.from, range.to),
      this.prisma.program.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    ]);

    const attendanceCoverage = getAttendanceCoverage(
      officialSchedules.map((schedule) => ({ id: schedule.id, day: schedule.day })),
      attendanceSessions,
      range.from,
      range.to,
    );
    const sectionsWithoutTeachers = sections.filter((section) => section.teachers.length === 0);
    const officialScheduleSectionIds = new Set(officialSchedules.map((schedule) => schedule.sectionId));
    const sectionsWithoutSchedules = sections.filter((section) => !officialScheduleSectionIds.has(section.id));
    const setupGapCount = sectionsWithoutTeachers.length
      + sectionsWithoutSchedules.length
      + operationalHealth.studentsWithoutGuardians
      + (operationalHealth.activeAcademicCycles === 0 ? 1 : 0);

    return {
      ...this.emptyResponse(user, range),
      headline: {
        eyebrow: 'Organization Analytics',
        title: 'Operational overview',
        subtitle: `Fast operational snapshot. Detailed charts load independently underneath it for the selected ${range.range} window.`,
      },
      summaryCards: [
        {
          id: 'staff',
          label: 'Active Staff',
          value: `${teachers}`,
          detail: `${sectionsWithoutTeachers.length} sections need a teacher`,
          href: '/users/teachers',
          tone: sectionsWithoutTeachers.length > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'students',
          label: 'Active Students',
          value: `${students}`,
          detail: `${sections.length} sections, ${operationalHealth.activeCohorts} active cohorts`,
          href: '/users/students',
          tone: InsightTone.INFO,
        },
        {
          id: 'programs',
          label: 'Active Programs',
          value: `${activePrograms}`,
          detail: 'Current department course offerings',
          href: '/programs',
          tone: activePrograms > 0 ? InsightTone.SUCCESS : InsightTone.INFO,
        },
        {
          id: 'coverage',
          label: 'Official Attendance',
          value: formatPercent(attendanceCoverage.percent),
          detail: `${attendanceCoverage.actual}/${attendanceCoverage.expected} official slots marked in ${range.range}`,
          href: '/attendance',
          tone: attendanceCoverage.percent >= 85 ? InsightTone.SUCCESS : attendanceCoverage.percent >= 60 ? InsightTone.WARNING : InsightTone.DANGER,
        },
        {
          id: 'setup-health',
          label: 'Setup Gaps',
          value: `${setupGapCount}`,
          detail: 'Staffing, timetable, guardian, and cycle gaps',
          href: '/sections',
          tone: setupGapCount > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'grading-backlog',
          label: 'Grading Backlog',
          value: `${pendingSubmissions}`,
          detail: 'Past-due submissions without a grade',
          href: '/grade-finalization',
          tone: pendingSubmissions > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
      ],
      spotlight: this.getOperationalSpotlight({
        sectionsWithoutTeachers,
        sectionsWithoutSchedules,
        openMailCount,
        pendingSubmissions,
        attendanceCoverage,
        attendanceHotspots: [],
        upcomingAssessments,
        topSections: [...sections].sort((a, b) => b._count.enrollments - a._count.enrollments).slice(0, 5),
        operationalHealth,
      }),
      groups: [
        this.getAcademicSetupGroup(operationalHealth, sectionsWithoutTeachers, sectionsWithoutSchedules),
        this.getFinanceOperationsGroup(operationalHealth),
        this.getCommunicationGroup(operationalHealth, openMailCount),
      ],
      charts: {},
    };
  }

  async buildModule(
    orgId: string,
    user: InsightsUser,
    module: string,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const now = new Date();
    const range = resolveInsightDateRange(query);
    const response = this.emptyResponse(user, range);

    if (module === 'attendance') {
      const [officialSchedules, attendanceSessions, attendanceRecordAggregates, newStudentsByDate] = await Promise.all([
        this.getOfficialSchedules(orgId),
        this.getAttendanceSessions(orgId, range.from, range.to),
        this.getAttendanceRecordAggregates(orgId, range.from, range.to),
        this.prisma.student.groupBy({
          by: ['createdAt'],
          where: {
            organizationId: orgId,
            status: { not: StudentStatus.DELETED },
            createdAt: { gte: range.from, lte: range.to },
          },
            _count: true,
        }),
      ]);
      const attendanceHotspots = this.getAttendanceHotspots(attendanceRecordAggregates, attendanceSessions);
      return {
        ...response,
        groups: [{
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
        }],
        charts: {
          enrollmentTrend: processDateTrendData(newStudentsByDate, range.from, range.to),
          attendanceTrend: this.getDailyAttendanceCoverageTrend(officialSchedules, attendanceSessions, range.from, range.to),
        },
      };
    }

    if (module === 'structure') {
      const [sections, teacherWorkload, departmentInsights] = await Promise.all([
        this.getSections(orgId),
        this.getTeacherWorkload(orgId),
        getDepartmentAdminInsights(this.prisma, orgId, range.from, range.to),
      ]);
      const topSections = [...sections].sort((a, b) => b._count.enrollments - a._count.enrollments).slice(0, 5);
      return {
        ...response,
        groups: [
          ...(departmentInsights.group ? [departmentInsights.group] : []),
          {
            id: 'largest-sections',
            title: 'Largest sections',
            description: 'Current enrollment concentration across sections.',
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
        charts: {
          sectionCapacity: topSections.map((section) => ({
            name: formatSectionLabel(section.name, section.course.name),
            courseName: section.course.name,
            color: section.color,
            enrolled: section._count.enrollments,
          })),
          teacherWorkload,
          departmentActivity: departmentInsights.chart,
          departmentPerformance: departmentInsights.performance,
        },
      };
    }

    if (module === 'campus') {
      const buildingRoomInsights = await getBuildingRoomInsights(this.prisma, orgId);
      return {
        ...response,
        groups: buildingRoomInsights.group ? [buildingRoomInsights.group] : [],
        charts: {
          roomUsage: buildingRoomInsights.roomUsage,
          buildingUsage: buildingRoomInsights.buildingUsage,
        },
      };
    }

    if (module === 'activity') {
      const [recentTeachers, recentStudents, recentAssessments, recentAttendance, mailByStatus] = await Promise.all([
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
          include: {
            section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } },
            schedule: { select: { type: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 4,
        }),
        this.prisma.mail.groupBy({
          by: ['status'],
          where: { organizationId: orgId },
          _count: true,
        }),
      ]);

      return {
        ...response,
        recentActivity: sortActivities([
          ...recentTeachers.map((teacher) => ({
            id: `teacher:${teacher.id}`,
            title: 'Teacher added',
            description: teacher.user.name || 'New teacher profile created',
            createdAt: teacher.createdAt.toISOString(),
            href: '/users/teachers',
            tone: InsightTone.INFO,
          })),
          ...recentStudents.map((student) => ({
            id: `student:${student.id}`,
            title: 'Student enrolled',
            description: student.user.name || student.registrationNumber,
            createdAt: student.createdAt.toISOString(),
            href: '/users/students',
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
            title: session.schedule.type === ScheduleType.AD_HOC ? 'Ad-hoc attendance captured' : 'Attendance session captured',
            description: formatSectionLabel(session.section.name, session.section.course.name),
            createdAt: session.createdAt.toISOString(),
            href: `/attendance/${session.section.id}`,
            tone: session.schedule.type === ScheduleType.AD_HOC ? InsightTone.WARNING : InsightTone.DEFAULT,
          })),
        ]),
        charts: {
          mailStatus: mailByStatus.map((item) => ({ status: item.status, count: item._count })),
        },
      };
    }

    return response;
  }

  private getSections(orgId: string) {
    return this.prisma.section.findMany({
      where: { course: { organizationId: orgId } },
      select: {
        id: true,
        name: true,
        color: true,
        course: { select: { name: true } },
        teachers: { select: { id: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  private getOfficialSchedules(orgId: string) {
    return this.prisma.sectionSchedule.findMany({
      where: { type: ScheduleType.OFFICIAL, section: { course: { organizationId: orgId } } },
      select: { id: true, day: true, sectionId: true, teacherId: true, startTime: true, endTime: true },
    });
  }

  private getAttendanceSessions(orgId: string, from: Date, to: Date) {
    return this.prisma.attendanceSession.findMany({
      where: {
        section: { course: { organizationId: orgId } },
        schedule: { type: ScheduleType.OFFICIAL },
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        scheduleId: true,
        date: true,
        section: {
          select: { id: true, name: true, color: true, course: { select: { name: true } } },
        },
      },
    });
  }

  private getAttendanceRecordAggregates(orgId: string, from: Date, to: Date) {
    return this.prisma.attendanceRecord.groupBy({
      by: ['sessionId', 'status'],
      where: {
        session: {
          section: { course: { organizationId: orgId } },
          schedule: { type: ScheduleType.OFFICIAL },
          date: { gte: from, lte: to },
        },
      },
      _count: true,
    });
  }

  private getUpcomingAssessments(orgId: string, now: Date) {
    return this.prisma.assessment.findMany({
      where: {
        organizationId: orgId,
        dueDate: { gte: now, lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
      },
      include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 6,
    });
  }

  private async getTeacherWorkload(orgId: string): Promise<{ name: string; sections: number; students: number; weeklySlots: number }[]> {
    const [teachers, scheduleCounts] = await Promise.all([
      this.prisma.teacher.findMany({
        where: { organizationId: orgId, status: { not: TeacherStatus.DELETED } },
        include: {
          user: { select: { name: true } },
          sections: {
            include: { _count: { select: { enrollments: true } } },
          },
        },
      }),
      this.prisma.sectionSchedule.groupBy({
        by: ['teacherId'],
        where: {
          type: ScheduleType.OFFICIAL,
          section: { course: { organizationId: orgId } },
        },
        _count: true,
      }),
    ]);
    const slotsByTeacher = new Map(scheduleCounts.map((row) => [row.teacherId, row._count]));

    return teachers
      .map((teacher) => ({
        name: teacher.user.name || 'Unknown',
        sections: teacher.sections.length,
        students: teacher.sections.reduce((sum, section) => sum + (section._count?.enrollments || 0), 0),
        weeklySlots: slotsByTeacher.get(teacher.id) || 0,
      }))
      .sort((a, b) => b.weeklySlots - a.weeklySlots || b.sections - a.sections || b.students - a.students)
      .slice(0, 10);
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

  private async getOperationalHealth(orgId: string, now: Date, from: Date, to: Date) {
    const [
      activeAcademicCycles,
      activeCohorts,
      studentsWithoutGuardians,
      activePreferenceWindows,
      activeEvaluationWindows,
      upcomingAcademicEvents,
      announcementsInRange,
      pendingFinanceConfirmations,
      pendingPaymentClaims,
      overdueFinanceEntries,
      aiCreditsUsed,
      cohortMovesInRange,
    ] = await Promise.all([
      this.prisma.academicCycle.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.cohort.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.student.count({
        where: {
          organizationId: orgId,
          status: { not: StudentStatus.DELETED },
          guardianLinks: { none: {} },
        },
      }),
      this.prisma.preferenceWindow.count({
        where: {
          organizationId: orgId,
          status: PreferenceWindowStatus.ACTIVE,
          startAt: { lte: now },
          endAt: { gte: now },
        },
      }),
      this.prisma.evaluationWindow.count({
        where: {
          organizationId: orgId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      this.prisma.academicEvent.count({
        where: {
          organizationId: orgId,
          isActive: true,
          startDate: { lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14) },
          endDate: { gte: now },
        },
      }),
      this.prisma.announcement.count({
        where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.financialEntry.count({
        where: { organizationId: orgId, status: EntryStatus.UNVERIFIED },
      }),
      this.prisma.paymentClaim.count({
        where: { organizationId: orgId, status: PaymentClaimStatus.PENDING },
      }),
      this.prisma.financialEntry.count({
        where: {
          organizationId: orgId,
          status: { in: [EntryStatus.PENDING, EntryStatus.PARTIAL, EntryStatus.OVERDUE, EntryStatus.UNVERIFIED] },
          dueDate: { lt: now },
        },
      }),
      this.prisma.aIUsage.aggregate({
        where: {
          organizationId: orgId,
          periodStart: { lte: to },
          periodEnd: { gte: from },
        },
        _sum: { creditUsed: true },
      }),
      this.prisma.cohortMembershipHistory.count({
        where: { cohort: { organizationId: orgId }, joinedAt: { gte: from, lte: to } },
      }),
    ]);

    return {
      activeAcademicCycles,
      activeCohorts,
      studentsWithoutGuardians,
      activePreferenceWindows,
      activeEvaluationWindows,
      upcomingAcademicEvents,
      announcementsInRange,
      pendingFinanceConfirmations,
      pendingPaymentClaims,
      overdueFinanceEntries,
      aiCreditsUsed: aiCreditsUsed._sum.creditUsed || 0,
      cohortMovesInRange,
    };
  }

  private getAcademicSetupGroup(
    health: Awaited<ReturnType<AdminInsightsBuilder['getOperationalHealth']>>,
    sectionsWithoutTeachers: AdminSection[],
    sectionsWithoutSchedules: AdminSection[],
  ): DashboardInsightGroup {
    return {
      id: 'academic-setup',
      title: 'Academic setup health',
      description: 'Current cycle, cohort, timetable, staffing, guardian, and feedback setup.',
      items: [
        {
          id: 'active-cycles',
          title: health.activeAcademicCycles > 0 ? `${health.activeAcademicCycles} active academic cycles` : 'No active academic cycle',
          description: health.activeCohorts > 0 ? `${health.activeCohorts} active cohorts` : 'No active cohorts',
          href: '/academic-cycles',
          badge: 'Cycles',
          tone: health.activeAcademicCycles > 0 ? InsightTone.SUCCESS : InsightTone.DANGER,
        },
        {
          id: 'schedule-setup',
          title: `${sectionsWithoutSchedules.length} sections without official timetables`,
          description: `${sectionsWithoutTeachers.length} sections without assigned teachers`,
          href: '/sections',
          badge: 'Timetable',
          tone: sectionsWithoutSchedules.length || sectionsWithoutTeachers.length ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'guardian-coverage',
          title: `${health.studentsWithoutGuardians} students without guardians`,
          description: 'Guardian linking coverage for family access.',
          href: '/users/guardians',
          badge: 'Guardians',
          tone: health.studentsWithoutGuardians > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'feedback-windows',
          title: `${health.activeEvaluationWindows} active evaluation windows`,
          description: `${health.activePreferenceWindows} active preference windows`,
          href: '/evaluations',
          badge: 'Windows',
          tone: health.activeEvaluationWindows || health.activePreferenceWindows ? InsightTone.INFO : InsightTone.DEFAULT,
        },
      ],
    };
  }

  private getFinanceOperationsGroup(health: Awaited<ReturnType<AdminInsightsBuilder['getOperationalHealth']>>): DashboardInsightGroup {
    return {
      id: 'finance-operations',
      title: 'Finance operations',
      description: 'Confirmation and overdue work that affects admin follow-through.',
      items: [
        {
          id: 'pending-confirmations',
          title: `${health.pendingFinanceConfirmations} entries need confirmation`,
          description: `${health.pendingPaymentClaims} pending payment claims`,
          href: '/finance/entries?tab=UNVERIFIED',
          badge: 'Confirm',
          tone: health.pendingFinanceConfirmations > 0 || health.pendingPaymentClaims > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'overdue-finance',
          title: `${health.overdueFinanceEntries} overdue finance entries`,
          description: 'Open entries past their due date.',
          href: '/finance/entries?tab=OVERDUE',
          badge: 'Overdue',
          tone: health.overdueFinanceEntries > 0 ? InsightTone.DANGER : InsightTone.SUCCESS,
        },
      ],
    };
  }

  private getCommunicationGroup(
    health: Awaited<ReturnType<AdminInsightsBuilder['getOperationalHealth']>>,
    openMailCount: number,
  ): DashboardInsightGroup {
    return {
      id: 'communication-activity',
      title: 'Communication activity',
      description: 'Messages, announcements, calendar interruptions, and AI usage.',
      items: [
        {
          id: 'open-mail',
          title: `${openMailCount} open mail threads`,
          description: 'Open, in-progress, or awaiting-response requests.',
          href: '/mail',
          badge: 'Inbox',
          tone: openMailCount > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'announcements',
          title: `${health.announcementsInRange} announcements in this window`,
          description: `${health.upcomingAcademicEvents} active or upcoming academic events`,
          href: '/academic-calendar',
          badge: 'Comms',
          tone: health.announcementsInRange || health.upcomingAcademicEvents ? InsightTone.INFO : InsightTone.DEFAULT,
        },
        {
          id: 'ai-usage',
          title: `${health.aiCreditsUsed} AI credits used`,
          description: 'Organization AI usage overlapping the selected window.',
          href: '/ai',
          badge: 'AI',
          tone: health.aiCreditsUsed > 0 ? InsightTone.INFO : InsightTone.DEFAULT,
        },
      ],
    };
  }

  private getOperationalSpotlight(input: {
    sectionsWithoutTeachers: AdminSection[];
    sectionsWithoutSchedules: AdminSection[];
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
    upcomingAssessments: UpcomingAssessment[];
    topSections: AdminSection[];
    operationalHealth: Awaited<ReturnType<AdminInsightsBuilder['getOperationalHealth']>>;
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
        title: `${formatSectionLabel(unscheduledSection.name, unscheduledSection.course.name)} needs an official timetable`,
        description: unscheduledSection.course.name,
        href: `/sections/${unscheduledSection.id}`,
        badge: 'Schedule gap',
        tone: InsightTone.DANGER,
      };
    }

    if (input.operationalHealth.pendingFinanceConfirmations > 0) {
      return {
        id: 'finance-confirmations',
        title: 'Payment confirmations need review',
        description: 'Finance entries are waiting for admin confirmation.',
        meta: `${input.operationalHealth.pendingFinanceConfirmations} unverified entries`,
        href: '/finance/entries?tab=UNVERIFIED',
        badge: 'Finance',
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
        title: 'Official attendance follow-through is low',
        description: 'Official scheduled slots are not being marked consistently in the selected period.',
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
        title: `${formatSectionLabel(busiestSection.name, busiestSection.course.name)} is the largest section`,
        description: busiestSection.course.name,
        meta: `${busiestSection._count.enrollments} students enrolled`,
        href: `/sections/${busiestSection.id}`,
        badge: 'Enrollment',
        tone: InsightTone.INFO,
      };
    }

    return null;
  }

  private getAttendanceHotspots(
    records: AttendanceRecordAggregate[],
    sessions: AttendanceSessionForInsight[],
  ) {
    const sessionsById = new Map(sessions.map((session) => [session.id, session]));
    const attendanceBySection = new Map<string, {
      sectionName: string;
      courseName: string;
      color: string | null;
      present: number;
      total: number;
    }>();

    records.forEach((record) => {
      const session = sessionsById.get(record.sessionId);
      if (!session) return;
      const section = session.section;
      const existing = attendanceBySection.get(section.id) || {
        sectionName: section.name,
        courseName: section.course.name,
        color: section.color,
        present: 0,
        total: 0,
      };
      existing.total += record._count;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        existing.present += record._count;
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

  private getDailyAttendanceCoverageTrend(
    schedules: OfficialSchedule[],
    sessions: AttendanceSessionForInsight[],
    from: Date,
    to: Date,
  ) {
    const sessionsByDate = new Map<string, Set<string>>();
    sessions.forEach((session) => {
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
      rows.push({
        date: toDateOnly(cursor),
        value: expected > 0 ? Math.round((actual / expected) * 100) : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return rows;
  }
}
