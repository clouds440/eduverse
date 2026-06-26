import { Injectable, NotFoundException } from '@nestjs/common';
import { EntryStatus, ScheduleType } from '@/prisma/prisma-client';
import { AttendanceStatus, InsightTone, Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { InsightsQueryDto } from '../dto/insights-query.dto';
import { sortActivities } from '../shared/insights-activity.util';
import { getUpcomingScheduleOccurrences } from '../shared/insights-attendance.util';
import { processGradeDistribution } from '../shared/insights-chart.util';
import { formatLocalDate, resolveInsightDateRange } from '../shared/insights-date.util';
import { formatCurrency, formatPercent, formatSectionLabel } from '../shared/insights-format.util';
import type { DashboardInsightActivity, DashboardInsightItem, InsightsUser, StandardDashboardInsightsResponse } from '../shared/insights.types';

function moneyNumber(value: unknown): number {
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString(): string }).toString());
  }
  return Number(value || 0);
}

@Injectable()
export class StudentInsightsBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    orgId: string,
    user: InsightsUser,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const student = await this.prisma.student.findFirst({
      where: { userId: user.id, organizationId: orgId },
      include: { user: { select: { name: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return this.buildForStudent(orgId, student.id, student.userId, user.role || Role.STUDENT, query);
  }

  async buildForStudent(
    orgId: string,
    studentId: string,
    studentUserId: string,
    role: string,
    query: InsightsQueryDto = {},
  ): Promise<StandardDashboardInsightsResponse> {
    const now = new Date();
    const range = resolveInsightDateRange(query);

    const [enrollments, grades, attendanceRecords, pendingAssessments, overdueAssessments, submissions, financeEntries] =
      await Promise.all([
        this.prisma.enrollment.findMany({
          where: {
            studentId,
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
        this.calculateFinalGrade(orgId, studentId),
        this.prisma.attendanceRecord.findMany({
          where: {
            studentId,
            session: {
              section: { course: { organizationId: orgId } },
              schedule: { type: ScheduleType.OFFICIAL },
              date: { gte: range.from, lte: range.to },
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
                  color: true,
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
              enrollments: { some: { studentId } },
              course: { organizationId: orgId },
            },
            dueDate: { gte: now },
            submissions: { none: { studentId } },
          },
          include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 8,
        }),
        this.prisma.assessment.findMany({
          where: {
            section: {
              enrollments: { some: { studentId } },
              course: { organizationId: orgId },
            },
            dueDate: { lt: now },
            submissions: { none: { studentId } },
          },
          include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 8,
        }),
        this.prisma.submission.findMany({
          where: {
            studentId,
            submittedAt: { gte: range.from, lte: range.to },
          },
          include: {
            assessment: {
              include: { section: { select: { id: true, name: true, color: true, course: { select: { name: true } } } } },
            },
          },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
        this.prisma.financialEntry.findMany({
          where: {
            organizationId: orgId,
            studentId,
            status: { not: EntryStatus.CANCELLED },
          },
          include: {
            structure: { select: { currency: true, title: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
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

    const finance = this.getFinanceSummary(financeEntries);
    const attendanceTrend = this.getAttendanceTrend(attendanceRecords, range.from, range.to);
    const gradeDistribution = processGradeDistribution(grades.map((grade) => ({
      marksObtained: grade.finalPercentage,
      assessment: { totalMarks: 100, section: { course: { name: grade.courseName } } },
    })));
    const studentPerformance = this.getStudentPerformance(grades, attendanceRecords);
    const lowAttendanceSections = this.getLowAttendanceSections(attendanceRecords);
    const lowGradeSections = grades
      .filter((grade) => grade.finalPercentage < 60)
      .sort((a, b) => a.finalPercentage - b.finalPercentage)
      .slice(0, 5);

    const upcomingClasses = getUpcomingScheduleOccurrences(
      enrollments.flatMap((enrollment) =>
        enrollment.section.schedules.map((schedule) => ({
          ...schedule,
          section: {
            id: enrollment.section.id,
            name: enrollment.section.name,
            color: enrollment.section.color,
            room: enrollment.section.room,
            course: { name: enrollment.section.course.name },
          },
        })),
      ),
      5,
    );

    const nextClass = upcomingClasses[0];
    const nextDeadline = pendingAssessments.find((assessment) => assessment.dueDate);
    const spotlight = this.getSpotlight({
      studentUserId,
      overdueAssessments,
      finance,
      lowAttendanceSections,
      lowGradeSections,
      nextDeadline,
      nextClass,
    });

    const recentActivity = sortActivities([
      ...submissions.map((submission) => ({
        id: `submission:${submission.id}`,
        title: 'Submission recorded',
        description: `${submission.assessment.title} - ${formatSectionLabel(submission.assessment.section.name, submission.assessment.section.course.name)}`,
        createdAt: submission.submittedAt.toISOString(),
        href: `/students/${studentUserId}?tab=assessments&assessmentId=${submission.assessment.id}`,
        tone: InsightTone.SUCCESS,
      })),
      ...attendanceRecords.slice(0, 4).map((record) => ({
        id: `attendance:${record.id}`,
        title: 'Attendance updated',
        description: `${formatSectionLabel(record.session.section.name, record.session.section.course.name)} - ${record.status}`,
        createdAt: record.session.date.toISOString(),
        href: `/students/${studentUserId}?tab=attendance`,
        tone:
          record.status === AttendanceStatus.ABSENT
            ? InsightTone.DANGER
            : record.status === AttendanceStatus.LATE
              ? InsightTone.WARNING
              : InsightTone.SUCCESS,
      })),
      ...this.getFinanceActivities(financeEntries, finance.currency),
    ]);

    return {
      role,
      filters: {
        selectedRange: range.range,
        interval: range.interval,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        selectedStudentId: studentId,
      },
      headline: {
        eyebrow: role === Role.GUARDIAN ? 'Guardian Insights' : 'Student Insights',
        title: 'Academic overview',
        subtitle: `Attendance, grades, coursework, and fee health for the selected ${range.range} window.`,
      },
      summaryCards: [
        {
          id: 'sections',
          label: 'Enrolled Sections',
          value: `${enrollments.length}`,
          detail: `${upcomingClasses.length} upcoming classes in view`,
          href: `/students/${studentUserId}?tab=courses`,
          tone: InsightTone.INFO,
        },
        {
          id: 'grade',
          label: 'Average Final Grade',
          value: grades.length > 0 ? formatPercent(averageGrade, 1) : 'No grade',
          detail: `${grades.length} graded sections`,
          href: `/students/${studentUserId}?tab=grades`,
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
          value: formatPercent(overallAttendancePercent),
          detail: `${attendanceRecords.length} official marks in ${range.range}`,
          href: `/students/${studentUserId}?tab=attendance`,
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
          detail: `${overdueAssessments.length} overdue submissions`,
          href: `/students/${studentUserId}?tab=assessments`,
          tone: overdueAssessments.length > 0 ? InsightTone.DANGER : pendingAssessments.length > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
        {
          id: 'fees',
          label: 'Outstanding Fees',
          value: formatCurrency(finance.outstanding, finance.currency),
          detail: `${formatCurrency(finance.overdue, finance.currency)} overdue`,
          href: role === Role.GUARDIAN ? '/guardian?view=fees' : '/finance/entries',
          tone: finance.overdue > 0 ? InsightTone.DANGER : finance.outstanding > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
        },
      ],
      spotlight,
      groups: [
        {
          id: 'urgent',
          title: 'Urgent follow-up',
          description: 'Overdue coursework and overdue fees that need action first.',
          items: [
            ...overdueAssessments.slice(0, 4).map((assessment) => ({
              id: `overdue:${assessment.id}`,
              title: `${assessment.title} is overdue`,
              description: `${formatSectionLabel(assessment.section.name, assessment.section.course.name)} - ${assessment.type}`,
              meta: assessment.dueDate ? `Due ${assessment.dueDate.toLocaleDateString()}` : undefined,
              href: `/students/${studentUserId}?tab=assessments&assessmentId=${assessment.id}`,
              badge: 'Overdue',
              tone: InsightTone.DANGER,
            })),
            ...finance.overdueItems.slice(0, 3).map((entry) => ({
              id: `finance-overdue:${entry.id}`,
              title: entry.title,
              description: 'Past-due fee entry',
              meta: formatCurrency(Math.max(moneyNumber(entry.amount) - moneyNumber(entry.paidAmount), 0), finance.currency),
              href: role === Role.GUARDIAN ? '/guardian?view=fees' : '/finance/entries',
              badge: 'Fee',
              tone: InsightTone.DANGER,
            })),
          ],
        },
        {
          id: 'attention',
          title: 'Needs attention',
          description: 'Low-attendance or low-grade sections that may affect standing.',
          items: [
            ...lowAttendanceSections.map((section, idx) => ({
              id: `attendance-risk:${section.sectionId}-${idx}`,
              title: `${formatSectionLabel(section.sectionName, section.courseName)} attendance is low`,
              description: section.courseName,
              meta: formatPercent(section.percent),
              href: `/students/${studentUserId}?tab=attendance`,
              badge: 'Attendance risk',
              tone: InsightTone.DANGER,
            })),
            ...lowGradeSections.map((grade, idx) => ({
              id: `grade-risk:${grade.sectionId}-${idx}`,
              title: `${formatSectionLabel(grade.sectionName, grade.courseName)} grade is below target`,
              description: grade.courseName,
              meta: formatPercent(grade.finalPercentage, 1),
              href: `/students/${studentUserId}?tab=grades`,
              badge: 'Grade risk',
              tone: InsightTone.WARNING,
            })),
          ].slice(0, 6),
        },
        {
          id: 'upcoming',
          title: 'Coming up',
          description: 'Deadlines and classes that will shape the next few days.',
          items: [
            ...pendingAssessments.slice(0, 4).map((assessment) => ({
              id: `pending:${assessment.id}`,
              title: assessment.title,
              description: `${formatSectionLabel(assessment.section.name, assessment.section.course.name)} - ${assessment.type}`,
              meta: assessment.dueDate
                ? `Due ${assessment.dueDate.toLocaleDateString()}`
                : 'No due date',
              href: `/students/${studentUserId}?tab=assessments&assessmentId=${assessment.id}`,
              badge: 'Pending',
              tone: InsightTone.WARNING,
            })),
            ...upcomingClasses.slice(0, 4).map((next) => ({
              id: `class:${next.scheduleId}:${next.startsAt.toISOString()}`,
              title: `${formatSectionLabel(next.sectionName, next.courseName)} - ${next.startTime}-${next.endTime}`,
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

  private async calculateFinalGrade(orgId: string, studentId: string) {
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        status: { in: ['PUBLISHED', 'FINALIZED'] },
        assessment: { organizationId: orgId },
      },
      include: {
        assessment: {
          include: {
            section: {
              select: {
                id: true,
                name: true,
                color: true,
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
      color: grade.assessment.section.color,
      finalPercentage: (grade.marksObtained / grade.assessment.totalMarks) * 100,
    }));
  }

  private getAttendanceTrend(
    records: Array<{ status: string; session: { date: Date } }>,
    from: Date,
    to: Date,
  ) {
    const rows = new Map<string, { present: number; total: number }>();
    records.forEach((record) => {
      const date = formatLocalDate(record.session.date);
      const row = rows.get(date) || { present: 0, total: 0 };
      row.total += 1;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        row.present += 1;
      }
      rows.set(date, row);
    });

    const result: { date: string; value: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    while (cursor <= end) {
      const date = formatLocalDate(cursor);
      const row = rows.get(date);
      result.push({ date, value: row && row.total > 0 ? (row.present / row.total) * 100 : 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  private getStudentPerformance(
    grades: Array<{ sectionId: string; sectionName: string; courseName: string; color: string; finalPercentage: number }>,
    attendanceRecords: Array<{ status: string; session: { section: { id: string } } }>,
  ) {
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

    return grades.map((grade) => {
      const sectionAttendance = attendanceCountsBySection.get(grade.sectionId);
      return {
        subject: formatSectionLabel(grade.sectionName, grade.courseName),
        sectionName: grade.sectionName,
        courseName: grade.courseName,
        color: grade.color,
        grade: grade.finalPercentage,
        attendance: sectionAttendance && sectionAttendance.total > 0
          ? (sectionAttendance.present / sectionAttendance.total) * 100
          : 0,
      };
    });
  }

  private getLowAttendanceSections(records: Array<{
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
      const existing = attendanceBySection.get(record.session.section.id) || {
        sectionName: record.session.section.name,
        courseName: record.session.section.course.name,
        color: record.session.section.color,
        present: 0,
        total: 0,
      };
      existing.total += 1;
      if (record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE) {
        existing.present += 1;
      }
      attendanceBySection.set(record.session.section.id, existing);
    });

    return Array.from(attendanceBySection.entries())
      .map(([sectionId, stats]) => ({
        sectionId,
        ...stats,
        percent: stats.total > 0 ? (stats.present / stats.total) * 100 : 100,
      }))
      .filter((section) => section.percent < 75)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);
  }

  private getFinanceSummary(entries: Array<{
    id: string;
    title: string;
    amount: unknown;
    paidAmount: unknown;
    dueDate: Date;
    status: EntryStatus;
    updatedAt: Date;
    structure: { currency: string; title: string } | null;
  }>) {
    const now = new Date();
    const currency = entries.find((entry) => entry.structure?.currency)?.structure?.currency || 'USD';
    let outstanding = 0;
    let overdue = 0;
    const overdueItems: typeof entries = [];

    entries.forEach((entry) => {
      const remaining = Math.max(moneyNumber(entry.amount) - moneyNumber(entry.paidAmount), 0);
      if (remaining <= 0) return;
      outstanding += remaining;
      if (entry.status === EntryStatus.OVERDUE || entry.dueDate < now) {
        overdue += remaining;
        overdueItems.push(entry);
      }
    });

    return { currency, outstanding, overdue, overdueItems };
  }

  private getFinanceActivities(entries: Array<{
    id: string;
    title: string;
    amount: unknown;
    paidAmount: unknown;
    status: EntryStatus;
    updatedAt: Date;
  }>, currency: string): DashboardInsightActivity[] {
    return entries
      .filter((entry) => entry.status === EntryStatus.PAID || moneyNumber(entry.paidAmount) > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 3)
      .map((entry) => ({
        id: `finance:${entry.id}`,
        title: entry.status === EntryStatus.PAID ? 'Fee paid' : 'Fee partially paid',
        description: `${entry.title} - ${formatCurrency(moneyNumber(entry.paidAmount) || moneyNumber(entry.amount), currency)}`,
        createdAt: entry.updatedAt.toISOString(),
        href: '/finance/entries',
        tone: InsightTone.SUCCESS,
      }));
  }

  private getSpotlight(input: {
    studentUserId: string;
    overdueAssessments: Array<{ id: string; title: string; type: string; dueDate: Date | null; section: { name: string; course: { name: string } } }>;
    finance: { currency: string; outstanding: number; overdue: number };
    lowAttendanceSections: { sectionId: string; sectionName: string; courseName: string; percent: number }[];
    lowGradeSections: { sectionId: string; sectionName: string; courseName: string; finalPercentage: number }[];
    nextDeadline?: { id: string; title: string; type: string; dueDate: Date | null; section: { name: string; course: { name: string } } };
    nextClass?: ReturnType<typeof getUpcomingScheduleOccurrences>[number];
  }): DashboardInsightItem | null {
    const overdueAssessment = input.overdueAssessments[0];
    if (overdueAssessment) {
      return {
        id: `overdue:${overdueAssessment.id}`,
        title: `${overdueAssessment.title} is overdue`,
        description: `${formatSectionLabel(overdueAssessment.section.name, overdueAssessment.section.course.name)} - ${overdueAssessment.type}`,
        meta: overdueAssessment.dueDate ? `Due ${overdueAssessment.dueDate.toLocaleString()}` : undefined,
        href: `/students/${input.studentUserId}?tab=assessments&assessmentId=${overdueAssessment.id}`,
        badge: 'Overdue',
        tone: InsightTone.DANGER,
      };
    }

    if (input.finance.overdue > 0) {
      return {
        id: 'finance-overdue',
        title: 'Fee payment is overdue',
        description: 'A past-due finance entry needs follow-up.',
        meta: formatCurrency(input.finance.overdue, input.finance.currency),
        href: '/finance/entries',
        badge: 'Fees',
        tone: InsightTone.DANGER,
      };
    }

    const lowAttendance = input.lowAttendanceSections[0];
    if (lowAttendance) {
      return {
        id: `attendance-risk:${lowAttendance.sectionId}`,
        title: `${formatSectionLabel(lowAttendance.sectionName, lowAttendance.courseName)} attendance is low`,
        description: lowAttendance.courseName,
        meta: formatPercent(lowAttendance.percent),
        href: `/students/${input.studentUserId}?tab=attendance`,
        badge: 'Attendance risk',
        tone: InsightTone.DANGER,
      };
    }

    const lowGrade = input.lowGradeSections[0];
    if (lowGrade) {
      return {
        id: `grade-risk:${lowGrade.sectionId}`,
        title: `${formatSectionLabel(lowGrade.sectionName, lowGrade.courseName)} grade is below target`,
        description: lowGrade.courseName,
        meta: formatPercent(lowGrade.finalPercentage, 1),
        href: `/students/${input.studentUserId}?tab=grades`,
        badge: 'Grade risk',
        tone: InsightTone.WARNING,
      };
    }

    if (
      input.nextDeadline?.dueDate &&
      (!input.nextClass || input.nextDeadline.dueDate.getTime() <= input.nextClass.startsAt.getTime())
    ) {
      return {
        id: `deadline:${input.nextDeadline.id}`,
        title: `${input.nextDeadline.title} needs attention`,
        description: `${formatSectionLabel(input.nextDeadline.section.name, input.nextDeadline.section.course.name)} - ${input.nextDeadline.type}`,
        meta: `Due ${input.nextDeadline.dueDate.toLocaleString()}`,
        href: `/students/${input.studentUserId}?tab=assessments&assessmentId=${input.nextDeadline.id}`,
        badge: 'Nearest deadline',
        tone: InsightTone.WARNING,
      };
    }

    if (input.nextClass) {
      return {
        id: 'next-class',
        title: `${formatSectionLabel(input.nextClass.sectionName, input.nextClass.courseName)} is your next class`,
        description: `${input.nextClass.courseName} - ${input.nextClass.startTime}-${input.nextClass.endTime}${input.nextClass.room ? ` - ${input.nextClass.room}` : ''}`,
        meta: input.nextClass.startsAt.toLocaleString(),
        href: '/timetable',
        badge: 'Next class',
        tone: InsightTone.INFO,
      };
    }

    return null;
  }
}
