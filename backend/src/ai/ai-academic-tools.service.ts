import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  AttendanceStatus,
  EntryStatus,
  EvaluationType,
  Prisma,
  Role,
} from '@/prisma/prisma-client';
import { getDepartmentScope, sectionDepartmentScopeWhere, courseDepartmentScopeWhere } from '../common/department-scope';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { InsightsService } from '../insights/insights.service';
import { PrismaService } from '../prisma/prisma.service';
import { AISettingsService } from './ai-settings.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

const ORG_ACADEMIC_SCOPE_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER]);
const ACADEMIC_STAFF_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER]);
const FINANCE_SUMMARY_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER]);

interface AcademicToolInput {
  search?: string;
  sectionId?: string;
  courseId?: string;
  teacherId?: string;
  studentId?: string;
  days?: number;
  limit?: number;
  range?: string;
}

@Injectable()
export class AIAcademicToolsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: InsightsService,
    private readonly evaluationsService: EvaluationsService,
    private readonly settingsService: AISettingsService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.register('getCurrentPermissions', 'Summarize current Copilot actor permissions and role boundaries.', (_input, context) => this.getCurrentPermissions(context));
    this.register('getMyInsights', 'Return compact role-aware dashboard insights for the current user.', (input, context) => this.getMyInsights(context, parseInput(input)));
    this.register('listCourses', 'List compact courses visible to the current user.', (input, context) => this.listCourses(context, parseInput(input)));
    this.register('listSections', 'List compact sections visible to the current user.', (input, context) => this.listSections(context, parseInput(input)));
    this.register('getCourseEnrollmentRanking', 'Rank visible courses by enrolled student count for the current or selected academic cycle.', (input, context) => this.getCourseEnrollmentRanking(context, parseInput(input)));
    this.register('getSectionDetails', 'Return compact details for a visible section.', (input, context) => this.getSectionDetails(context, parseInput(input)));
    this.register('getPendingDeadlines', 'Return upcoming assessment deadlines visible to the current user.', (input, context) => this.getPendingDeadlines(context, parseInput(input)));
    this.register('getPendingGrading', 'Return pending grading workload for staff roles.', (input, context) => this.getPendingGrading(context, parseInput(input)));
    this.register('getAttendanceRisk', 'Return attendance risk summary for visible students.', (input, context) => this.getAttendanceRisk(context, parseInput(input)));
    this.register('getTeacherEvaluationSummary', 'Return privacy-safe teacher evaluation summary.', (input, context) => this.getTeacherEvaluationSummary(context, parseInput(input)));
    this.register('getCourseEvaluationSummary', 'Return privacy-safe course evaluation summary.', (input, context) => this.getCourseEvaluationSummary(context, parseInput(input)));
    this.register('getFinanceSummary', 'Return compact read-only finance summary for permitted roles.', (input, context) => this.getFinanceSummary(context, parseInput(input)));
    this.register('getAIUsageSummary', 'Return organization AI usage summary for org admins.', (_input, context) => this.getAIUsageSummary(context));
    this.register('getAICreditStatus', 'Return AI credit status for the current user and, for org admins, the organization.', (_input, context) => this.getAICreditStatus(context));
    this.register('getAIRoleAccessPolicy', 'Return AI role access policy for org admins.', (_input, context) => this.getAIRoleAccessPolicy(context));
  }

  private register(
    name: string,
    description: string,
    run: (input: unknown, context: AIToolContext) => Promise<AIToolResult<unknown>>,
  ) {
    this.toolRegistry.register({ name, description, run });
  }

  private async getCurrentPermissions(context: AIToolContext): Promise<AIToolResult<unknown>> {
    return {
      ok: true,
      data: {
        userId: context.userId,
        organizationId: context.orgId,
        role: context.role,
        canUseOrgAcademicScope: ORG_ACADEMIC_SCOPE_ROLES.has(context.role ?? ''),
        canManageAISubscription: context.role === Role.ORG_ADMIN,
        canViewOrgAIUsage: context.role === Role.ORG_ADMIN,
        note: 'Copilot tools never expand the user permissions beyond normal EduVerse access.',
      },
    };
  }

  private async getMyInsights(
    context: AIToolContext,
    input: AcademicToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');
    try {
      const insights = await this.insightsService.getInsights(context.orgId, actorForScopedServices(context), {
        range: input.range as any,
      });
      return {
        ok: true,
        data: {
          headline: insights.headline,
          summaryCards: insights.summaryCards.slice(0, 8),
          spotlight: insights.spotlight,
          groups: insights.groups.slice(0, 4).map((group) => ({
            id: group.id,
            title: group.title,
            items: group.items.slice(0, 5),
          })),
          recentActivity: insights.recentActivity.slice(0, 6),
        },
      };
    } catch (error) {
      return permissionDenied(error instanceof Error ? error.message : 'Insights are not available for this role.');
    }
  }

  private async listCourses(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    const where = await this.courseWhereForActor(context, input);
    const courses = await this.prisma.course.findMany({
      where,
      take: clampLimit(input.limit, 12),
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { sections: true, assessments: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      ok: true,
      data: {
        courses: courses.map((course) => ({
          courseId: course.id,
          name: course.name,
          code: course.code,
          department: course.department?.name ?? null,
          sections: course._count.sections,
          assessments: course._count.assessments,
          href: '/courses',
        })),
      },
    };
  }

  private async listSections(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    const where = await this.sectionWhereForActor(context, input);
    const sections = await this.prisma.section.findMany({
      where,
      take: clampLimit(input.limit, 12),
      include: {
        course: { select: { id: true, name: true, code: true } },
        teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { enrollments: true, schedules: true, assessments: true } },
      },
      orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
    });

    return {
      ok: true,
      data: {
        sections: sections.map((section) => ({
          sectionId: section.id,
          name: section.name,
          code: section.code,
          courseName: section.course.name,
          teachers: section.teachers.map((teacher) => teacher.user?.name ?? teacher.user?.email).filter(Boolean),
          students: section._count.enrollments,
          schedules: section._count.schedules,
          assessments: section._count.assessments,
          href: `/sections/${section.id}`,
        })),
      },
    };
  }

  private async getCourseEnrollmentRanking(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const cycle = await this.resolveAcademicCycle(context.orgId, input);
    if (!cycle) {
      return notFound('No current academic cycle is available for this organization.');
    }

    const sectionWhere = await this.sectionWhereForActor(context, {
      ...input,
      search: undefined,
    });
    const sections = await this.prisma.section.findMany({
      where: {
        ...sectionWhere,
        academicCycleId: cycle.id,
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            department: { select: { id: true, name: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
    });

    const courseMap = new Map<string, {
      courseId: string;
      name: string;
      code: string | null;
      department: string | null;
      enrolledStudents: number;
      sections: Array<{ sectionId: string; name: string; code: string; enrolledStudents: number; href: string }>;
    }>();

    for (const section of sections) {
      const current = courseMap.get(section.course.id) ?? {
        courseId: section.course.id,
        name: section.course.name,
        code: section.course.code,
        department: section.course.department?.name ?? null,
        enrolledStudents: 0,
        sections: [],
      };
      current.enrolledStudents += section._count.enrollments;
      current.sections.push({
        sectionId: section.id,
        name: section.name,
        code: section.code,
        enrolledStudents: section._count.enrollments,
        href: `/sections/${section.id}`,
      });
      courseMap.set(section.course.id, current);
    }

    const courses = Array.from(courseMap.values())
      .sort((a, b) => b.enrolledStudents - a.enrolledStudents || a.name.localeCompare(b.name))
      .slice(0, clampLimit(input.limit, 10));

    return {
      ok: true,
      data: {
        academicCycle: {
          id: cycle.id,
          name: cycle.name,
          code: cycle.code,
          startDate: dateKey(cycle.startDate),
          endDate: dateKey(cycle.endDate),
          source: cycle.isActive ? 'active' : 'date-range-or-latest',
        },
        courses,
        totalVisibleCourses: courseMap.size,
        totalVisibleSections: sections.length,
        note: 'Enrollment counts are summed from visible sections in the selected academic cycle.',
      },
    };
  }

  private async getSectionDetails(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    if (!input.sectionId) return notFound('sectionId is required.');
    const where = await this.sectionWhereForActor(context, input);
    const section = await this.prisma.section.findFirst({
      where: { ...where, id: input.sectionId },
      include: {
        course: { select: { id: true, name: true, code: true } },
        academicCycle: { select: { id: true, name: true } },
        teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
        schedules: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] },
        assessments: { orderBy: { dueDate: 'asc' }, take: 8 },
        _count: { select: { enrollments: true, courseMaterials: true } },
      },
    });
    if (!section) return notFound('Section not found or not visible to this user.');

    return {
      ok: true,
      data: {
        sectionId: section.id,
        name: section.name,
        code: section.code,
        courseName: section.course.name,
        academicCycle: section.academicCycle.name,
        teachers: section.teachers.map((teacher) => teacher.user?.name ?? teacher.user?.email).filter(Boolean),
        students: section._count.enrollments,
        materials: section._count.courseMaterials,
        schedules: section.schedules.slice(0, 10).map((schedule) => ({
          day: schedule.date ? dateKey(schedule.date) : dayLabel(schedule.day),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          type: schedule.type,
        })),
        upcomingAssessments: section.assessments.map((assessment) => ({
          assessmentId: assessment.id,
          title: assessment.title,
          type: assessment.type,
          dueDate: assessment.dueDate ? dateKey(assessment.dueDate) : null,
        })),
        href: `/sections/${section.id}`,
      },
    };
  }

  private async resolveAcademicCycle(contextOrgId: string, input: AcademicToolInput) {
    if (input.search) {
      const searched = await this.prisma.academicCycle.findFirst({
        where: {
          organizationId: contextOrgId,
          OR: [
            { name: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
          ],
        },
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      });
      if (searched) return searched;
    }

    const now = new Date();
    const current = await this.prisma.academicCycle.findFirst({
      where: {
        organizationId: contextOrgId,
        OR: [
          { isActive: true },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    });
    if (current) return current;

    return this.prisma.academicCycle.findFirst({
      where: { organizationId: contextOrgId },
      orderBy: { startDate: 'desc' },
    });
  }

  private async getPendingDeadlines(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    const start = new Date();
    const end = addDays(start, Math.min(Math.max(input.days ?? 14, 1), 60));
    const sectionWhere = await this.sectionWhereForActor(context, input);
    const assessments = await this.prisma.assessment.findMany({
      where: {
        organizationId: context.orgId,
        dueDate: { gte: start, lte: end },
        section: sectionWhere,
      },
      take: clampLimit(input.limit, 15),
      include: {
        course: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        submissions: context.role === Role.STUDENT
          ? { where: { student: { userId: context.userId } }, select: { id: true } }
          : false,
      },
      orderBy: { dueDate: 'asc' },
    });

    return {
      ok: true,
      data: {
        deadlines: assessments.map((assessment) => ({
          assessmentId: assessment.id,
          title: assessment.title,
          type: assessment.type,
          dueDate: assessment.dueDate ? dateKey(assessment.dueDate) : null,
          courseName: assessment.course.name,
          sectionName: assessment.section.name,
          submitted: Array.isArray((assessment as any).submissions)
            ? (assessment as any).submissions.length > 0
            : undefined,
          href: `/sections/${assessment.sectionId}/assessments/${assessment.id}`,
        })),
      },
    };
  }

  private async getPendingGrading(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    if (!ACADEMIC_STAFF_ROLES.has(context.role ?? '')) {
      return permissionDenied('Pending grading is available to academic staff only.');
    }

    const sectionWhere = await this.sectionWhereForActor(context, input);
    const assessments = await this.prisma.assessment.findMany({
      where: { organizationId: context.orgId, section: sectionWhere },
      take: clampLimit(input.limit, 20),
      include: {
        course: { select: { name: true } },
        section: {
          select: {
            id: true,
            name: true,
            _count: { select: { enrollments: true } },
          },
        },
        _count: { select: { grades: true, submissions: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      ok: true,
      data: {
        pending: assessments
          .map((assessment) => ({
            assessmentId: assessment.id,
            title: assessment.title,
            courseName: assessment.course.name,
            sectionName: assessment.section.name,
            dueDate: assessment.dueDate ? dateKey(assessment.dueDate) : null,
            enrolledStudents: assessment.section._count.enrollments,
            submittedCount: assessment._count.submissions,
            gradedCount: assessment._count.grades,
            missingGrades: Math.max(0, assessment.section._count.enrollments - assessment._count.grades),
            href: `/sections/${assessment.sectionId}/assessments/${assessment.id}`,
          }))
          .filter((assessment) => assessment.missingGrades > 0),
      },
    };
  }

  private async getAttendanceRisk(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    const since = addDays(new Date(), -90);
    const students = await this.visibleStudents(context, input);
    if (!students.length) return { ok: true, data: { students: [] } };

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: students.map((student) => student.id) },
        session: {
          date: { gte: since },
          section: await this.sectionWhereForActor(context, input),
        },
      },
      include: { student: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    const byStudent = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
    for (const record of records) {
      const current = byStudent.get(record.studentId) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      current.total += 1;
      if (record.status === AttendanceStatus.PRESENT) current.present += 1;
      if (record.status === AttendanceStatus.ABSENT) current.absent += 1;
      if (record.status === AttendanceStatus.LATE) current.late += 1;
      if (record.status === AttendanceStatus.EXCUSED) current.excused += 1;
      byStudent.set(record.studentId, current);
    }

    return {
      ok: true,
      data: {
        students: students.map((student) => {
          const summary = byStudent.get(student.id) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
          const attended = summary.present + summary.late + summary.excused;
          const attendanceRate = summary.total ? Math.round((attended / summary.total) * 100) : null;
          return {
            studentId: student.id,
            name: student.user?.name ?? student.user?.email ?? 'Student',
            attendanceRate,
            risk: attendanceRate === null ? 'unknown' : attendanceRate < 75 ? 'high' : attendanceRate < 85 ? 'moderate' : 'normal',
            ...summary,
          };
        }).sort((a, b) => (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101)).slice(0, clampLimit(input.limit, 12)),
      },
    };
  }

  private async getTeacherEvaluationSummary(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    const teacherId = input.teacherId ?? await this.teacherIdForUser(context);
    if (!teacherId) return notFound('teacherId is required for this role.');

    try {
      const summary = await this.evaluationsService.getTeacherSummary(context.orgId, teacherId, actorForScopedServices(context), {
        includeFeedback: false,
      } as any);
      return { ok: true, data: compactEvaluationSummary(summary, 'teacher') };
    } catch (error) {
      return permissionDenied(error instanceof Error ? error.message : 'Teacher evaluation summary is not available.');
    }
  }

  private async getCourseEvaluationSummary(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    if (!input.courseId) return notFound('courseId is required.');
    try {
      const summary = await this.evaluationsService.getCourseSummary(context.orgId, input.courseId, actorForScopedServices(context), {
        includeFeedback: false,
      } as any);
      return { ok: true, data: compactEvaluationSummary(summary, 'course') };
    } catch (error) {
      return permissionDenied(error instanceof Error ? error.message : 'Course evaluation summary is not available.');
    }
  }

  private async getFinanceSummary(context: AIToolContext, input: AcademicToolInput): Promise<AIToolResult<unknown>> {
    const where = await this.financeWhereForActor(context, input);
    if (!where) return permissionDenied('Finance summary is not available for this role.');

    const entries = await this.prisma.financialEntry.findMany({
      where,
      take: 250,
      orderBy: { dueDate: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
      },
    });
    const totals = entries.reduce((acc, entry) => {
      const amount = Number(entry.amount ?? 0);
      const paid = Number(entry.paidAmount ?? 0);
      acc.expected += amount;
      acc.paid += paid;
      acc.pending += Math.max(0, amount - paid);
      acc.byStatus[entry.status] = (acc.byStatus[entry.status] ?? 0) + 1;
      return acc;
    }, { expected: 0, paid: 0, pending: 0, byStatus: {} as Record<string, number> });

    return {
      ok: true,
      data: {
        totals,
        overdueCount: entries.filter((entry) => entry.status === EntryStatus.OVERDUE).length,
        recentEntries: entries.slice(0, clampLimit(input.limit, 8)).map((entry) => ({
          entryId: entry.id,
          title: entry.title,
          status: entry.status,
          amount: Number(entry.amount ?? 0),
          paidAmount: Number(entry.paidAmount ?? 0),
          dueDate: dateKey(entry.dueDate),
        })),
      },
    };
  }

  private async getAIUsageSummary(context: AIToolContext): Promise<AIToolResult<unknown>> {
    if (context.role !== Role.ORG_ADMIN) return permissionDenied('Only org admins can view organization AI usage.');
    const usage = await this.settingsService.getOrgUsage(context.orgId);
    return {
      ok: true,
      data: {
        plan: usage.subscription.plan,
        usage: usage.usage,
        topUsers: usage.topUsers.slice(0, 5),
        roleUsage: usage.roleUsage.slice(0, 7),
        featureUsage: usage.featureUsage.slice(0, 8),
        estimatedCost: usage.estimatedCost,
      },
    };
  }

  private async getAICreditStatus(context: AIToolContext): Promise<AIToolResult<unknown>> {
    const personal = await this.settingsService.getPersonalSettings(context.userId, context.orgId);
    const org = context.role === Role.ORG_ADMIN ? await this.settingsService.getOrgSettings(context.orgId) : null;
    return {
      ok: true,
      data: {
        personal: {
          plan: personal.subscription.plan,
          status: personal.subscription.status,
          usage: personal.usage,
        },
        organization: org ? {
          plan: org.subscription.plan,
          status: org.subscription.status,
          usage: org.usage,
        } : undefined,
      },
    };
  }

  private async getAIRoleAccessPolicy(context: AIToolContext): Promise<AIToolResult<unknown>> {
    if (context.role !== Role.ORG_ADMIN) return permissionDenied('Only org admins can view AI role access policy.');
    const settings = await this.settingsService.getOrgSettings(context.orgId);
    return {
      ok: true,
      data: {
        accessPolicy: settings.accessPolicy,
        roleCreditPolicies: settings.roleCreditPolicies,
        warning: settings.warning,
      },
    };
  }

  private async courseWhereForActor(context: AIToolContext, input: AcademicToolInput): Promise<Prisma.CourseWhereInput> {
    const searchWhere = input.search ? {
      OR: [
        { name: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
        { code: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
      ],
    } satisfies Prisma.CourseWhereInput : {};
    const departmentScope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
    const departmentWhere = courseDepartmentScopeWhere(departmentScope);

    if (context.role === Role.STUDENT) {
      return { organizationId: context.orgId, sections: { some: { enrollments: { some: { student: { userId: context.userId } } } } }, ...searchWhere };
    }
    if (context.role === Role.GUARDIAN) {
      return { organizationId: context.orgId, sections: { some: { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } } }, ...searchWhere };
    }
    if (context.role === Role.TEACHER || context.role === Role.ORG_MANAGER) {
      return { organizationId: context.orgId, sections: { some: { teachers: { some: { userId: context.userId } } } }, ...searchWhere };
    }

    return {
      organizationId: context.orgId,
      ...(Object.keys(departmentWhere).length ? { AND: [departmentWhere] } : {}),
      ...searchWhere,
    };
  }

  private async sectionWhereForActor(context: AIToolContext, input: AcademicToolInput): Promise<Prisma.SectionWhereInput> {
    const searchWhere = input.search ? {
      OR: [
        { name: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
        { code: { contains: input.search, mode: Prisma.QueryMode.insensitive } },
        { course: { name: { contains: input.search, mode: Prisma.QueryMode.insensitive } } },
      ],
    } satisfies Prisma.SectionWhereInput : {};
    const departmentScope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
    const departmentWhere = sectionDepartmentScopeWhere(departmentScope);

    const base: Prisma.SectionWhereInput = {
      organizationId: context.orgId,
      ...(input.courseId ? { courseId: input.courseId } : {}),
      ...searchWhere,
    };

    if (context.role === Role.STUDENT) {
      return { ...base, enrollments: { some: { student: { userId: context.userId } } } };
    }
    if (context.role === Role.GUARDIAN) {
      return { ...base, enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } };
    }
    if (context.role === Role.TEACHER || context.role === Role.ORG_MANAGER) {
      return { ...base, teachers: { some: { userId: context.userId } } };
    }

    return {
      ...base,
      ...(Object.keys(departmentWhere).length ? { AND: [departmentWhere] } : {}),
    };
  }

  private async visibleStudents(context: AIToolContext, input: AcademicToolInput) {
    const studentWhere: Prisma.StudentWhereInput = {
      organizationId: context.orgId,
      ...(input.studentId ? { id: input.studentId } : {}),
    };

    if (context.role === Role.STUDENT) {
      studentWhere.userId = context.userId;
    } else if (context.role === Role.GUARDIAN) {
      studentWhere.guardianLinks = { some: { guardian: { userId: context.userId } } };
    } else if (context.role === Role.TEACHER || context.role === Role.ORG_MANAGER) {
      studentWhere.enrollments = { some: { section: { teachers: { some: { userId: context.userId } } } } };
    }

    return this.prisma.student.findMany({
      where: studentWhere,
      take: clampLimit(input.limit, 20),
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }

  private async teacherIdForUser(context: AIToolContext) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { organizationId: context.orgId, userId: context.userId },
      select: { id: true },
    });
    return teacher?.id ?? null;
  }

  private async financeWhereForActor(context: AIToolContext, input: AcademicToolInput): Promise<Prisma.FinancialEntryWhereInput | null> {
    const base: Prisma.FinancialEntryWhereInput = { organizationId: context.orgId };

    if (FINANCE_SUMMARY_ROLES.has(context.role ?? '')) {
      return base;
    }

    if (context.role === Role.STUDENT) {
      return { ...base, student: { userId: context.userId } };
    }

    if (context.role === Role.GUARDIAN) {
      return {
        ...base,
        student: {
          guardianLinks: { some: { guardian: { userId: context.userId } } },
          ...(input.studentId ? { id: input.studentId } : {}),
        },
      };
    }

    if (context.role === Role.TEACHER || context.role === Role.ORG_MANAGER) {
      const teacher = await this.prisma.teacher.findFirst({ where: { userId: context.userId, organizationId: context.orgId }, select: { id: true } });
      return {
        ...base,
        OR: [
          ...(teacher ? [{ teacherId: teacher.id }] : []),
          { employeeUserId: context.userId },
        ],
      };
    }

    return null;
  }
}

function parseInput(input: unknown): AcademicToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    search: stringValue(value.search),
    sectionId: stringValue(value.sectionId),
    courseId: stringValue(value.courseId),
    teacherId: stringValue(value.teacherId),
    studentId: stringValue(value.studentId),
    range: stringValue(value.range),
    days: numberValue(value.days),
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

function clampLimit(limit = 10, max = 10) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(limit) ? limit : 10)));
}

function permissionDenied<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}

function notFound<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'NOT_FOUND', message };
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayLabel(day: number) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? `Day ${day}`;
}

function compactEvaluationSummary(summary: any, target: 'teacher' | 'course') {
  return {
    target,
    teacher: summary.teacher ? {
      teacherId: summary.teacher.id,
      name: summary.teacher.user?.name ?? summary.teacher.user?.email ?? 'Teacher',
    } : undefined,
    course: summary.course ? {
      courseId: summary.course.id,
      name: summary.course.name,
    } : undefined,
    averageRating: summary.averageRating,
    totalRatings: summary.totalRatings,
    distribution: summary.distribution,
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
