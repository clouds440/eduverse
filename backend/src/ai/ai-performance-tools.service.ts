import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  AttendanceStatus,
  EvaluationType,
  Prisma,
  Role,
} from '@/prisma/prisma-client';
import {
  courseDepartmentScopeWhere,
  getDepartmentScope,
  sectionDepartmentScopeWhere,
  studentDepartmentScopeWhere,
  teacherDepartmentScopeWhere,
} from '../common/department-scope';
import { PrismaService } from '../prisma/prisma.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

const OVERSIGHT_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER]);
const ACADEMIC_ROLES = new Set<string>([
  Role.ORG_ADMIN,
  Role.SUB_ADMIN,
  Role.ORG_MANAGER,
  Role.TEACHER,
  Role.STUDENT,
  Role.GUARDIAN,
]);
const STAFF_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER]);

interface PerformanceToolInput {
  search?: string;
  targetType?: string;
  teacherId?: string;
  courseId?: string;
  sectionId?: string;
  studentId?: string;
  departmentId?: string;
  days?: number;
  limit?: number;
}

@Injectable()
export class AIPerformanceToolsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.register(
      'getAcademicPerformanceProfile',
      'Generic academic performance context tool. Accepts targetType student, teacher, course, department, or organization plus optional search/id fields. Returns the most complete permission-scoped performance, workload, attendance, evaluation, deadline, and recommendation profile available for that target.',
      (input, context) => this.getAcademicPerformanceProfile(context, parseInput(input)),
    );
    this.register(
      'searchAcademicEntities',
      'Search visible teachers/managers/staff, students, courses, sections, and departments for name-based Copilot follow-up questions.',
      (input, context) => this.searchAcademicEntities(context, parseInput(input)),
    );
    this.register(
      'getTeacherPerformanceProfile',
      'Return a compact, permission-scoped teacher/manager/staff performance profile with workload, grades, attendance, evaluations, risks, schedules, and recommendations. Use this directly for teacher or manager review questions.',
      (input, context) => this.getTeacherPerformanceProfile(context, parseInput(input)),
    );
    this.register(
      'getCoursePerformanceProfile',
      'Return a compact, permission-scoped course performance profile with grades, attendance, evaluations, sections, teachers, risks, and recommendations.',
      (input, context) => this.getCoursePerformanceProfile(context, parseInput(input)),
    );
    this.register(
      'getStudentPerformanceProfile',
      'Return a compact, permission-scoped student performance profile with weak courses, attendance, deadlines, schedule signals, and recommendations.',
      (input, context) => this.getStudentPerformanceProfile(context, parseInput(input)),
    );
    this.register(
      'getDepartmentPerformanceProfile',
      'Return a compact department performance profile for managers and admins.',
      (input, context) => this.getDepartmentPerformanceProfile(context, parseInput(input)),
    );
    this.register(
      'getOrganizationHealthProfile',
      'Return a compact academic organization health profile for admins and managers.',
      (input, context) => this.getOrganizationHealthProfile(context, parseInput(input)),
    );
    this.register(
      'getStudentsNeedingAttention',
      'Return visible students who may need academic, attendance, or deadline attention.',
      (input, context) => this.getStudentsNeedingAttention(context, parseInput(input)),
    );
  }

  private register(
    name: string,
    description: string,
    run: (input: unknown, context: AIToolContext) => Promise<AIToolResult<unknown>>,
  ) {
    this.toolRegistry.register({ name, description, run });
  }

  private async getAcademicPerformanceProfile(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    const targetType = inferPerformanceTarget(context, input);
    if (targetType === 'student') return this.getStudentPerformanceProfile(context, input);
    if (targetType === 'teacher') return this.getTeacherPerformanceProfile(context, input);
    if (targetType === 'course') return this.getCoursePerformanceProfile(context, input);
    if (targetType === 'department') return this.getDepartmentPerformanceProfile(context, input);
    if (targetType === 'organization') return this.getOrganizationHealthProfile(context, input);
    return notFound('Performance target could not be inferred. Provide targetType student, teacher, course, department, or organization.');
  }

  private async searchAcademicEntities(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!ACADEMIC_ROLES.has(context.role ?? '')) {
      return permissionDenied('Academic search is not available for this role.');
    }

    const limit = clampLimit(input.limit, 6);
    const [teachers, courses, sections, students, departments] = await Promise.all([
      STAFF_ROLES.has(context.role ?? '')
        ? this.prisma.teacher.findMany({
            where: await this.teacherWhereForActor(context, input),
            take: limit,
            include: {
              user: { select: { id: true, name: true, email: true } },
              teacherDepartments: { include: { department: { select: { id: true, name: true } } } },
            },
            orderBy: { user: { name: 'asc' } },
          })
        : Promise.resolve([]),
      this.prisma.course.findMany({
        where: await this.courseWhereForActor(context, input),
        take: limit,
        include: { department: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.section.findMany({
        where: await this.sectionWhereForActor(context, input),
        take: limit,
        include: { course: { select: { id: true, name: true, code: true } } },
        orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.student.findMany({
        where: await this.studentWhereForActor(context, input),
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          primaryDepartment: { select: { id: true, name: true } },
        },
        orderBy: { user: { name: 'asc' } },
      }),
      OVERSIGHT_ROLES.has(context.role ?? '')
        ? this.prisma.department.findMany({
            where: await this.departmentWhereForActor(context, input),
            take: limit,
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      ok: true,
      data: {
        teachers: teachers.map((teacher) => ({
          teacherId: teacher.id,
          userId: teacher.userId,
          name: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
          subject: teacher.subject,
          designation: teacher.designation,
          departments: teacher.teacherDepartments.map((entry) => entry.department.name),
        })),
        courses: courses.map((course) => ({
          courseId: course.id,
          name: course.name,
          code: course.code,
          department: course.department?.name ?? null,
          href: '/courses',
        })),
        sections: sections.map((section) => ({
          sectionId: section.id,
          name: section.name,
          code: section.code,
          courseName: section.course.name,
          href: `/sections/${section.id}`,
        })),
        students: students.map((student) => ({
          studentId: student.id,
          userId: student.userId,
          name: student.user?.name ?? student.user?.email ?? 'Student',
          registrationNumber: student.registrationNumber,
          department: student.primaryDepartment?.name ?? student.department ?? null,
        })),
        departments: departments.map((department) => ({
          departmentId: department.id,
          name: department.name,
          code: department.code,
        })),
      },
    };
  }

  private async getTeacherPerformanceProfile(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!STAFF_ROLES.has(context.role ?? '')) {
      return permissionDenied('Teacher performance is available to academic staff only.');
    }

    const teacher = await this.resolveTeacher(context, input);
    if (!teacher) return notFound('Teacher not found or not visible to this user.');

    const sectionWhere: Prisma.SectionWhereInput = {
      organizationId: context.orgId,
      teachers: { some: { id: teacher.id } },
    };
    const [sections, gradeSummary, attendance, evaluation, pendingGrading, scheduleCount, studentsNeedingAttention] = await Promise.all([
      this.prisma.section.findMany({
        where: sectionWhere,
        take: 30,
        include: {
          course: { select: { id: true, name: true, code: true } },
          _count: { select: { enrollments: true, schedules: true, assessments: true } },
        },
        orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.gradeSummary({ assessment: { section: sectionWhere } }),
      this.attendanceSummary({ session: { section: sectionWhere } }),
      this.evaluationSummary({ teacherId: teacher.id, type: EvaluationType.TEACHER }),
      this.pendingGradingSummary(sectionWhere),
      this.prisma.sectionSchedule.count({ where: { teacherId: teacher.id, section: { organizationId: context.orgId } } }),
      this.studentsNeedingAttentionRows(context, { ...input, teacherId: teacher.id, limit: 6 }),
    ]);

    const uniqueCourses = uniqueBy(sections.map((section) => section.course), (course) => course.id);
    const totalStudents = sections.reduce((sum, section) => sum + section._count.enrollments, 0);
    const profile = {
      teacher: {
        teacherId: teacher.id,
        userId: teacher.userId,
        name: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
        subject: teacher.subject,
        designation: teacher.designation,
      },
      workload: {
        courses: uniqueCourses.length,
        sections: sections.length,
        enrolledSeatsAcrossSections: totalStudents,
        weeklyScheduleSlots: scheduleCount,
        loadLevel: scheduleCount >= 15 || sections.length >= 6 ? 'high' : scheduleCount >= 10 || sections.length >= 4 ? 'moderate' : 'normal',
      },
      academicSignals: {
        averageGradePercent: gradeSummary.averagePercent,
        gradedItems: gradeSummary.gradedItems,
        attendanceRate: attendance.attendanceRate,
        evaluationAverage: evaluation.averageRating,
        evaluationCount: evaluation.totalRatings,
        pendingGrades: pendingGrading.missingGrades,
      },
      courses: uniqueCourses.slice(0, 8).map((course) => ({
        courseId: course.id,
        name: course.name,
        code: course.code,
      })),
      sections: sections.slice(0, 8).map((section) => ({
        sectionId: section.id,
        name: section.name,
        courseName: section.course.name,
        students: section._count.enrollments,
        schedules: section._count.schedules,
        assessments: section._count.assessments,
        href: `/sections/${section.id}`,
      })),
      studentsNeedingAttention,
      recommendations: teacherRecommendations({
        scheduleCount,
        sections: sections.length,
        averageGradePercent: gradeSummary.averagePercent,
        attendanceRate: attendance.attendanceRate,
        evaluationAverage: evaluation.averageRating,
        pendingGrades: pendingGrading.missingGrades,
      }),
    };

    return { ok: true, data: profile };
  }

  private async getCoursePerformanceProfile(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    const course = await this.resolveCourse(context, input);
    if (!course) return notFound('Course not found or not visible to this user.');

    const sectionWhere: Prisma.SectionWhereInput = {
      organizationId: context.orgId,
      courseId: course.id,
      ...(context.role === Role.STUDENT ? { enrollments: { some: { student: { userId: context.userId } } } } : {}),
      ...(context.role === Role.GUARDIAN ? { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } } : {}),
      ...(context.role === Role.TEACHER ? { teachers: { some: { userId: context.userId } } } : {}),
    };
    const [sections, gradeSummary, attendance, evaluation, pendingGrading, upcomingAssessments] = await Promise.all([
      this.prisma.section.findMany({
        where: sectionWhere,
        take: 20,
        include: {
          teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { enrollments: true, assessments: true, schedules: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.gradeSummary({ assessment: { courseId: course.id, section: sectionWhere } }),
      this.attendanceSummary({ session: { section: sectionWhere } }),
      this.evaluationSummary({ courseId: course.id, type: EvaluationType.COURSE }),
      this.pendingGradingSummary(sectionWhere),
      this.prisma.assessment.findMany({
        where: { organizationId: context.orgId, courseId: course.id, section: sectionWhere, dueDate: { gte: new Date() } },
        take: 8,
        orderBy: { dueDate: 'asc' },
        select: { id: true, title: true, type: true, dueDate: true, sectionId: true, section: { select: { name: true } } },
      }),
    ]);

    const teachers = uniqueBy(sections.flatMap((section) => section.teachers), (teacher) => teacher.id);
    const studentCount = sections.reduce((sum, section) => sum + section._count.enrollments, 0);

    return {
      ok: true,
      data: {
        course: {
          courseId: course.id,
          name: course.name,
          code: course.code,
          department: course.department?.name ?? null,
          creditHours: course.creditHours,
        },
        academicSignals: {
          sections: sections.length,
          enrolledSeatsAcrossSections: studentCount,
          averageGradePercent: gradeSummary.averagePercent,
          gradedItems: gradeSummary.gradedItems,
          attendanceRate: attendance.attendanceRate,
          evaluationAverage: evaluation.averageRating,
          evaluationCount: evaluation.totalRatings,
          pendingGrades: pendingGrading.missingGrades,
        },
        teachers: teachers.slice(0, 8).map((teacher) => ({
          teacherId: teacher.id,
          name: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
          subject: teacher.subject,
        })),
        sections: sections.slice(0, 10).map((section) => ({
          sectionId: section.id,
          name: section.name,
          students: section._count.enrollments,
          schedules: section._count.schedules,
          assessments: section._count.assessments,
          href: `/sections/${section.id}`,
        })),
        upcomingAssessments: upcomingAssessments.map((assessment) => ({
          assessmentId: assessment.id,
          title: assessment.title,
          type: assessment.type,
          dueDate: assessment.dueDate ? dateKey(assessment.dueDate) : null,
          sectionName: assessment.section.name,
          href: `/sections/${assessment.sectionId}/assessments/${assessment.id}`,
        })),
        recommendations: courseRecommendations({
          averageGradePercent: gradeSummary.averagePercent,
          attendanceRate: attendance.attendanceRate,
          evaluationAverage: evaluation.averageRating,
          pendingGrades: pendingGrading.missingGrades,
          sections: sections.length,
          teachers: teachers.length,
        }),
      },
    };
  }

  private async getStudentPerformanceProfile(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    const student = await this.resolveStudent(context, input);
    if (!student) return notFound('Student not found or not visible to this user.');

    const [grades, attendanceRecords, upcomingAssessments, scheduleCount] = await Promise.all([
      this.prisma.grade.findMany({
        where: { studentId: student.id },
        take: 250,
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              totalMarks: true,
              dueDate: true,
              course: { select: { id: true, name: true, code: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id, session: { date: { gte: addDays(new Date(), -90) } } },
        take: 300,
        include: {
          session: {
            select: {
              date: true,
              section: { select: { id: true, name: true, course: { select: { id: true, name: true, code: true } } } },
            },
          },
        },
      }),
      this.prisma.assessment.findMany({
        where: {
          organizationId: context.orgId,
          dueDate: { gte: new Date() },
          section: { enrollments: { some: { studentId: student.id } } },
          submissions: { none: { studentId: student.id } },
        },
        take: 10,
        orderBy: { dueDate: 'asc' },
        include: { course: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } },
      }),
      this.prisma.sectionSchedule.count({
        where: { section: { enrollments: { some: { studentId: student.id } } } },
      }),
    ]);

    const courseSummaries = summarizeStudentCourses(grades, attendanceRecords);
    const weakestCourses = courseSummaries
      .filter((course) => course.averageGradePercent !== null || course.attendanceRate !== null)
      .sort((a, b) => riskScore(b) - riskScore(a))
      .slice(0, 5);
    const overallAverage = average(courseSummaries.map((course) => course.averageGradePercent).filter(isNumber));
    const overallAttendance = attendanceFromRecords(attendanceRecords).attendanceRate;

    return {
      ok: true,
      data: {
        student: {
          studentId: student.id,
          userId: student.userId,
          name: student.user?.name ?? student.user?.email ?? 'Student',
          registrationNumber: student.registrationNumber,
          department: student.primaryDepartment?.name ?? student.department ?? null,
        },
        academicSignals: {
          averageGradePercent: roundOrNull(overallAverage),
          attendanceRate: overallAttendance,
          gradedItems: grades.length,
          upcomingMissingDeadlines: upcomingAssessments.length,
          weeklyScheduleSlots: scheduleCount,
        },
        weakestCourses,
        upcomingMissingDeadlines: upcomingAssessments.map((assessment) => ({
          assessmentId: assessment.id,
          title: assessment.title,
          courseName: assessment.course.name,
          sectionName: assessment.section.name,
          dueDate: assessment.dueDate ? dateKey(assessment.dueDate) : null,
          href: `/sections/${assessment.sectionId}/assessments/${assessment.id}`,
        })),
        recommendations: studentRecommendations({
          averageGradePercent: roundOrNull(overallAverage),
          attendanceRate: overallAttendance,
          missingDeadlines: upcomingAssessments.length,
          weakestCourses,
        }),
      },
    };
  }

  private async getDepartmentPerformanceProfile(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!OVERSIGHT_ROLES.has(context.role ?? '')) {
      return permissionDenied('Department performance is available to admins and managers only.');
    }

    const department = await this.resolveDepartment(context, input);
    if (!department) return notFound('Department not found or not visible to this user.');

    const sectionWhere: Prisma.SectionWhereInput = {
      organizationId: context.orgId,
      course: { departmentId: department.id },
    };
    const [courseCount, teacherCount, studentCount, sectionCount, gradeSummary, attendance, evaluation, pendingGrading, overloadedTeachers] = await Promise.all([
      this.prisma.course.count({ where: { organizationId: context.orgId, departmentId: department.id } }),
      this.prisma.teacher.count({ where: { organizationId: context.orgId, teacherDepartments: { some: { departmentId: department.id } } } }),
      this.prisma.student.count({
        where: {
          organizationId: context.orgId,
          OR: [
            { primaryDepartmentId: department.id },
            { studentDepartments: { some: { departmentId: department.id } } },
          ],
        },
      }),
      this.prisma.section.count({ where: sectionWhere }),
      this.gradeSummary({ assessment: { section: sectionWhere } }),
      this.attendanceSummary({ session: { section: sectionWhere } }),
      this.evaluationSummary({ course: { departmentId: department.id } }),
      this.pendingGradingSummary(sectionWhere),
      this.teacherLoadRows(context, { departmentId: department.id, limit: 5 }),
    ]);

    return {
      ok: true,
      data: {
        department: {
          departmentId: department.id,
          name: department.name,
          code: department.code,
        },
        academicSignals: {
          courses: courseCount,
          teachers: teacherCount,
          students: studentCount,
          sections: sectionCount,
          averageGradePercent: gradeSummary.averagePercent,
          attendanceRate: attendance.attendanceRate,
          evaluationAverage: evaluation.averageRating,
          evaluationCount: evaluation.totalRatings,
          pendingGrades: pendingGrading.missingGrades,
        },
        overloadedTeachers: overloadedTeachers.filter((teacher) => teacher.weeklySlots >= 15),
        recommendations: departmentRecommendations({
          averageGradePercent: gradeSummary.averagePercent,
          attendanceRate: attendance.attendanceRate,
          evaluationAverage: evaluation.averageRating,
          pendingGrades: pendingGrading.missingGrades,
          overloadedTeachers: overloadedTeachers.filter((teacher) => teacher.weeklySlots >= 15).length,
        }),
      },
    };
  }

  private async getOrganizationHealthProfile(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!OVERSIGHT_ROLES.has(context.role ?? '')) {
      return permissionDenied('Organization health is available to admins and managers only.');
    }

    const courseWhere = await this.courseWhereForActor(context, {});
    const sectionWhere = await this.sectionWhereForActor(context, {});
    const teacherWhere = await this.teacherWhereForActor(context, {});
    const studentWhere = await this.studentWhereForActor(context, {});
    const [courseCount, teacherCount, studentCount, sectionCount, unscheduledSections, gradeSummary, attendance, evaluation, pendingGrading, overloadedTeachers, departments] = await Promise.all([
      this.prisma.course.count({ where: courseWhere }),
      this.prisma.teacher.count({ where: teacherWhere }),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.section.count({ where: sectionWhere }),
      this.prisma.section.count({ where: { ...sectionWhere, schedules: { none: {} } } }),
      this.gradeSummary({ assessment: { section: sectionWhere } }),
      this.attendanceSummary({ session: { section: sectionWhere } }),
      this.evaluationSummary({ organizationId: context.orgId }),
      this.pendingGradingSummary(sectionWhere),
      this.teacherLoadRows(context, { limit: 8 }),
      this.prisma.department.findMany({ where: await this.departmentWhereForActor(context, input), take: 8, orderBy: { name: 'asc' } }),
    ]);

    return {
      ok: true,
      data: {
        scope: context.role === Role.ORG_MANAGER || context.role === Role.SUB_ADMIN ? 'department-scoped' : 'organization',
        academicSignals: {
          courses: courseCount,
          teachers: teacherCount,
          students: studentCount,
          sections: sectionCount,
          unscheduledSections,
          averageGradePercent: gradeSummary.averagePercent,
          attendanceRate: attendance.attendanceRate,
          evaluationAverage: evaluation.averageRating,
          evaluationCount: evaluation.totalRatings,
          pendingGrades: pendingGrading.missingGrades,
        },
        departments: departments.map((department) => ({
          departmentId: department.id,
          name: department.name,
          code: department.code,
        })),
        overloadedTeachers: overloadedTeachers.filter((teacher) => teacher.weeklySlots >= 15),
        recommendations: organizationRecommendations({
          averageGradePercent: gradeSummary.averagePercent,
          attendanceRate: attendance.attendanceRate,
          evaluationAverage: evaluation.averageRating,
          pendingGrades: pendingGrading.missingGrades,
          overloadedTeachers: overloadedTeachers.filter((teacher) => teacher.weeklySlots >= 15).length,
          unscheduledSections,
        }),
      },
    };
  }

  private async getStudentsNeedingAttention(
    context: AIToolContext,
    input: PerformanceToolInput,
  ): Promise<AIToolResult<unknown>> {
    if (!ACADEMIC_ROLES.has(context.role ?? '')) {
      return permissionDenied('Student attention signals are not available for this role.');
    }

    const students = await this.studentsNeedingAttentionRows(context, input);
    return {
      ok: true,
      data: {
        students,
        note: 'Signals are advisory. Review normal EduVerse records before taking action.',
      },
    };
  }

  private async studentsNeedingAttentionRows(context: AIToolContext, input: PerformanceToolInput) {
    const students = await this.prisma.student.findMany({
      where: await this.studentWhereForActor(context, input),
      take: clampLimit(input.limit, 12),
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    if (!students.length) return [];

    const studentIds = students.map((student) => student.id);
    const [grades, attendanceRecords, missingDeadlines] = await Promise.all([
      this.prisma.grade.findMany({
        where: { studentId: { in: studentIds } },
        take: 1000,
        include: { assessment: { select: { totalMarks: true } } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { studentId: { in: studentIds }, session: { date: { gte: addDays(new Date(), -90) } } },
        take: 1500,
      }),
      this.prisma.assessment.findMany({
        where: {
          organizationId: context.orgId,
          dueDate: { gte: addDays(new Date(), -7), lte: addDays(new Date(), 14) },
          section: { enrollments: { some: { studentId: { in: studentIds } } } },
        },
        take: 300,
        include: { submissions: { where: { studentId: { in: studentIds } }, select: { studentId: true } } },
      }),
    ]);

    const gradeByStudent = groupBy(grades, (grade) => grade.studentId);
    const attendanceByStudent = groupBy(attendanceRecords, (record) => record.studentId);
    const missingByStudent = new Map<string, number>();
    for (const assessment of missingDeadlines) {
      const submitted = new Set(assessment.submissions.map((submission) => submission.studentId));
      for (const studentId of studentIds) {
        if (!submitted.has(studentId)) {
          missingByStudent.set(studentId, (missingByStudent.get(studentId) ?? 0) + 1);
        }
      }
    }

    return students
      .map((student) => {
        const studentGrades = gradeByStudent.get(student.id) ?? [];
        const averageGradePercent = roundOrNull(average(studentGrades
          .map((grade) => percent(grade.marksObtained, grade.assessment.totalMarks))
          .filter(isNumber)));
        const attendanceRate = attendanceFromRecords(attendanceByStudent.get(student.id) ?? []).attendanceRate;
        const missingDeadlineCount = missingByStudent.get(student.id) ?? 0;
        const reasons = [
          averageGradePercent !== null && averageGradePercent < 70 ? 'low grade average' : null,
          attendanceRate !== null && attendanceRate < 85 ? 'attendance risk' : null,
          missingDeadlineCount > 0 ? 'missing or upcoming unsubmitted deadlines' : null,
        ].filter(Boolean);
        return {
          studentId: student.id,
          userId: student.userId,
          name: student.user?.name ?? student.user?.email ?? 'Student',
          averageGradePercent,
          attendanceRate,
          missingDeadlineCount,
          attentionLevel: reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'moderate' : 'normal',
          reasons,
        };
      })
      .filter((student) => student.attentionLevel !== 'normal')
      .sort((a, b) => attentionRank(b.attentionLevel) - attentionRank(a.attentionLevel))
      .slice(0, clampLimit(input.limit, 12));
  }

  private async resolveTeacher(context: AIToolContext, input: PerformanceToolInput) {
    return this.prisma.teacher.findFirst({
      where: await this.teacherWhereForActor(context, input),
      include: {
        user: { select: { id: true, name: true, email: true } },
        teacherDepartments: { include: { department: { select: { id: true, name: true } } } },
      },
      orderBy: { user: { name: 'asc' } },
    });
  }

  private async resolveCourse(context: AIToolContext, input: PerformanceToolInput) {
    return this.prisma.course.findFirst({
      where: await this.courseWhereForActor(context, input),
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  private async resolveStudent(context: AIToolContext, input: PerformanceToolInput) {
    return this.prisma.student.findFirst({
      where: await this.studentWhereForActor(context, input),
      include: {
        user: { select: { id: true, name: true, email: true } },
        primaryDepartment: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
  }

  private async resolveDepartment(context: AIToolContext, input: PerformanceToolInput) {
    return this.prisma.department.findFirst({
      where: await this.departmentWhereForActor(context, input),
      orderBy: { name: 'asc' },
    });
  }

  private async teacherWhereForActor(context: AIToolContext, input: PerformanceToolInput): Promise<Prisma.TeacherWhereInput> {
    const searchWhere = teacherSearchWhere(input.search);
    const base: Prisma.TeacherWhereInput = {
      organizationId: context.orgId,
      ...(input.teacherId ? { id: input.teacherId } : {}),
      ...searchWhere,
    };

    if (context.role === Role.TEACHER) {
      return { ...base, userId: context.userId };
    }

    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, teacherDepartmentScopeWhere(scope));
    }

    return { id: '__not_visible__' };
  }

  private async courseWhereForActor(context: AIToolContext, input: PerformanceToolInput): Promise<Prisma.CourseWhereInput> {
    const base: Prisma.CourseWhereInput = {
      organizationId: context.orgId,
      ...(input.courseId ? { id: input.courseId } : {}),
      ...courseSearchWhere(input.search),
    };

    if (context.role === Role.STUDENT) {
      return withAnd(base, { sections: { some: { enrollments: { some: { student: { userId: context.userId } } } } } });
    }
    if (context.role === Role.GUARDIAN) {
      return withAnd(base, { sections: { some: { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } } } });
    }
    if (context.role === Role.TEACHER) {
      return withAnd(base, { sections: { some: { teachers: { some: { userId: context.userId } } } } });
    }
    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, courseDepartmentScopeWhere(scope));
    }

    return { id: '__not_visible__' };
  }

  private async sectionWhereForActor(context: AIToolContext, input: PerformanceToolInput): Promise<Prisma.SectionWhereInput> {
    const base: Prisma.SectionWhereInput = {
      organizationId: context.orgId,
      ...(input.sectionId ? { id: input.sectionId } : {}),
      ...(input.courseId ? { courseId: input.courseId } : {}),
      ...sectionSearchWhere(input.search),
    };

    if (context.role === Role.STUDENT) {
      return withAnd(base, { enrollments: { some: { student: { userId: context.userId } } } });
    }
    if (context.role === Role.GUARDIAN) {
      return withAnd(base, { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } });
    }
    if (context.role === Role.TEACHER) {
      return withAnd(base, { teachers: { some: { userId: context.userId } } });
    }
    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, sectionDepartmentScopeWhere(scope));
    }

    return { id: '__not_visible__' };
  }

  private async studentWhereForActor(context: AIToolContext, input: PerformanceToolInput): Promise<Prisma.StudentWhereInput> {
    const base: Prisma.StudentWhereInput = {
      organizationId: context.orgId,
      ...(input.studentId ? { id: input.studentId } : {}),
      ...studentSearchWhere(input.search),
    };

    if (context.role === Role.STUDENT) {
      return { ...base, userId: context.userId };
    }
    if (context.role === Role.GUARDIAN) {
      return withAnd(base, { guardianLinks: { some: { guardian: { userId: context.userId } } } });
    }
    if (context.role === Role.TEACHER) {
      return withAnd(base, {
        enrollments: {
          some: {
            section: {
              teachers: { some: { userId: context.userId } },
              ...(input.teacherId ? { teachers: { some: { id: input.teacherId, userId: context.userId } } } : {}),
            },
          },
        },
      });
    }
    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, studentDepartmentScopeWhere(scope));
    }

    return { id: '__not_visible__' };
  }

  private async departmentWhereForActor(context: AIToolContext, input: PerformanceToolInput): Promise<Prisma.DepartmentWhereInput> {
    if (!OVERSIGHT_ROLES.has(context.role ?? '')) return { id: '__not_visible__' };

    const base: Prisma.DepartmentWhereInput = {
      organizationId: context.orgId,
      isActive: true,
      ...(input.departmentId ? { id: input.departmentId } : {}),
      ...departmentSearchWhere(input.search),
    };
    const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
    if (!scope.applies || scope.all) return base;
    if (!scope.departmentIds.length) return { id: '__not_visible__' };
    return { ...base, id: input.departmentId ? input.departmentId : { in: scope.departmentIds } };
  }

  private async gradeSummary(where: Prisma.GradeWhereInput) {
    const grades = await this.prisma.grade.findMany({
      where,
      take: 1000,
      select: { marksObtained: true, assessment: { select: { totalMarks: true } } },
    });
    const percentages = grades.map((grade) => percent(grade.marksObtained, grade.assessment.totalMarks)).filter(isNumber);
    return {
      gradedItems: grades.length,
      averagePercent: roundOrNull(average(percentages)),
    };
  }

  private async attendanceSummary(where: Prisma.AttendanceRecordWhereInput) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        AND: [
          where,
          { session: { date: { gte: addDays(new Date(), -90) } } },
        ],
      },
      take: 1500,
      select: { status: true },
    });
    return attendanceFromRecords(records);
  }

  private async evaluationSummary(where: Prisma.EvaluationWhereInput) {
    const visibleWhere: Prisma.EvaluationWhereInput = {
      organizationId: where.organizationId ?? undefined,
      ...where,
      isHidden: false,
    };
    const [aggregate, distribution] = await Promise.all([
      this.prisma.evaluation.aggregate({
        where: visibleWhere,
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.prisma.evaluation.groupBy({
        by: ['rating'],
        where: visibleWhere,
        _count: { id: true },
      }),
    ]);
    return {
      averageRating: roundOrNull(aggregate._avg.rating),
      totalRatings: aggregate._count.id,
      distribution: distribution
        .sort((a, b) => a.rating - b.rating)
        .map((row) => ({ rating: row.rating, count: row._count.id })),
    };
  }

  private async pendingGradingSummary(sectionWhere: Prisma.SectionWhereInput) {
    const assessments = await this.prisma.assessment.findMany({
      where: { organizationId: sectionWhere.organizationId as string, section: sectionWhere },
      take: 500,
      include: {
        section: { select: { _count: { select: { enrollments: true } } } },
        _count: { select: { grades: true } },
      },
    });
    return assessments.reduce((acc, assessment) => {
      acc.assessments += 1;
      acc.missingGrades += Math.max(0, assessment.section._count.enrollments - assessment._count.grades);
      return acc;
    }, { assessments: 0, missingGrades: 0 });
  }

  private async teacherLoadRows(context: AIToolContext, input: PerformanceToolInput) {
    const teacherWhere = await this.teacherWhereForActor(context, input);
    const teachers = await this.prisma.teacher.findMany({
      where: teacherWhere,
      take: clampLimit(input.limit, 10),
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { schedules: true, sections: true } },
      },
      orderBy: { schedules: { _count: 'desc' } },
    });
    return teachers.map((teacher) => ({
      teacherId: teacher.id,
      name: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
      weeklySlots: teacher._count.schedules,
      sections: teacher._count.sections,
      loadLevel: teacher._count.schedules >= 15 ? 'high' : teacher._count.schedules >= 10 ? 'moderate' : 'normal',
    }));
  }
}

function parseInput(input: unknown): PerformanceToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    search: stringValue(value.search),
    targetType: stringValue(value.targetType),
    teacherId: stringValue(value.teacherId),
    courseId: stringValue(value.courseId),
    sectionId: stringValue(value.sectionId),
    studentId: stringValue(value.studentId),
    departmentId: stringValue(value.departmentId),
    days: numberValue(value.days),
    limit: numberValue(value.limit),
  };
}

function inferPerformanceTarget(context: AIToolContext, input: PerformanceToolInput) {
  const target = input.targetType?.toLowerCase();
  if (['student', 'teacher', 'course', 'department', 'organization'].includes(target ?? '')) return target;
  if (input.studentId) return 'student';
  if (input.teacherId) return 'teacher';
  if (input.courseId || input.sectionId) return 'course';
  if (input.departmentId) return 'department';

  const text = (input.search ?? '').toLowerCase();
  if (mentionsAny(text, ['student', 'learner', 'weakest', 'weak course', 'study plan'])) return 'student';
  if (mentionsAny(text, ['teacher', 'faculty', 'instructor', 'manager', 'staff'])) return 'teacher';
  if (mentionsAny(text, ['course', 'subject', 'class', 'section'])) return 'course';
  if (mentionsAny(text, ['department', 'dept'])) return 'department';
  if (context.role === Role.STUDENT || context.role === Role.GUARDIAN) return 'student';
  if (context.role === Role.TEACHER) return 'teacher';
  if (OVERSIGHT_ROLES.has(context.role ?? '')) return 'organization';
  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return undefined;
}

function mentionsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function permissionDenied<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}

function notFound<T>(message: string): AIToolResult<T> {
  return { ok: false, code: 'NOT_FOUND', message };
}

function clampLimit(limit = 10, max = 10) {
  return Math.min(max, Math.max(1, Math.round(Number.isFinite(limit) ? limit : 10)));
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

function withAnd<T extends object>(base: T, extra: T): T {
  if (!Object.keys(extra).length) return base;
  return { AND: [base, extra] } as T;
}

function teacherSearchWhere(search?: string): Prisma.TeacherWhereInput {
  if (!search) return {};
  return {
    OR: [
      { subject: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { designation: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { user: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      { user: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } },
    ],
  };
}

function courseSearchWhere(search?: string): Prisma.CourseWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { department: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
    ],
  };
}

function sectionSearchWhere(search?: string): Prisma.SectionWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { course: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      { course: { code: { contains: search, mode: Prisma.QueryMode.insensitive } } },
    ],
  };
}

function studentSearchWhere(search?: string): Prisma.StudentWhereInput {
  if (!search) return {};
  return {
    OR: [
      { registrationNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { rollNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { user: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
      { user: { email: { contains: search, mode: Prisma.QueryMode.insensitive } } },
    ],
  };
}

function departmentSearchWhere(search?: string): Prisma.DepartmentWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ],
  };
}

function percent(marks: number, total: number) {
  if (!total || total <= 0) return null;
  return (marks / total) * 100;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundOrNull(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function attendanceFromRecords(records: Array<{ status: AttendanceStatus }>) {
  const total = records.length;
  const present = records.filter((record) => record.status === AttendanceStatus.PRESENT).length;
  const late = records.filter((record) => record.status === AttendanceStatus.LATE).length;
  const excused = records.filter((record) => record.status === AttendanceStatus.EXCUSED).length;
  const absent = records.filter((record) => record.status === AttendanceStatus.ABSENT).length;
  const attended = present + late + excused;
  return {
    total,
    present,
    late,
    excused,
    absent,
    attendanceRate: total ? Math.round((attended / total) * 1000) / 10 : null,
  };
}

function summarizeStudentCourses(
  grades: Array<{
    marksObtained: number;
    assessment: {
      totalMarks: number;
      course: { id: string; name: string; code: string };
    };
  }>,
  attendanceRecords: Array<{
    status: AttendanceStatus;
    session: { section: { course: { id: string; name: string; code: string } } };
  }>,
) {
  const courseMap = new Map<string, {
    courseId: string;
    name: string;
    code: string;
    percentages: number[];
    attendance: Array<{ status: AttendanceStatus }>;
  }>();

  for (const grade of grades) {
    const course = grade.assessment.course;
    const current = courseMap.get(course.id) ?? {
      courseId: course.id,
      name: course.name,
      code: course.code,
      percentages: [],
      attendance: [],
    };
    const gradePercent = percent(grade.marksObtained, grade.assessment.totalMarks);
    if (gradePercent !== null) current.percentages.push(gradePercent);
    courseMap.set(course.id, current);
  }

  for (const record of attendanceRecords) {
    const course = record.session.section.course;
    const current = courseMap.get(course.id) ?? {
      courseId: course.id,
      name: course.name,
      code: course.code,
      percentages: [],
      attendance: [],
    };
    current.attendance.push(record);
    courseMap.set(course.id, current);
  }

  return Array.from(courseMap.values()).map((course) => ({
    courseId: course.courseId,
    name: course.name,
    code: course.code,
    averageGradePercent: roundOrNull(average(course.percentages)),
    attendanceRate: attendanceFromRecords(course.attendance).attendanceRate,
    gradedItems: course.percentages.length,
  }));
}

function riskScore(course: { averageGradePercent: number | null; attendanceRate: number | null }) {
  const gradeRisk = course.averageGradePercent === null ? 0 : Math.max(0, 80 - course.averageGradePercent);
  const attendanceRisk = course.attendanceRate === null ? 0 : Math.max(0, 90 - course.attendanceRate);
  return gradeRisk + attendanceRisk;
}

function attentionRank(level: string) {
  if (level === 'high') return 3;
  if (level === 'moderate') return 2;
  return 1;
}

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const id = key(value);
    grouped.set(id, [...(grouped.get(id) ?? []), value]);
  }
  return grouped;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function teacherRecommendations(metrics: {
  scheduleCount: number;
  sections: number;
  averageGradePercent: number | null;
  attendanceRate: number | null;
  evaluationAverage: number | null;
  pendingGrades: number;
}) {
  return compactRecommendations([
    metrics.scheduleCount >= 15 || metrics.sections >= 6
      ? 'Review teaching load and consider redistributing sections or support hours.'
      : null,
    metrics.pendingGrades > 20
      ? 'Prioritize grading backlog so students get timely feedback.'
      : null,
    metrics.averageGradePercent !== null && metrics.averageGradePercent < 70
      ? 'Review recent assessments for concept gaps and schedule targeted remediation.'
      : null,
    metrics.attendanceRate !== null && metrics.attendanceRate < 85
      ? 'Investigate attendance patterns before performance issues compound.'
      : null,
    metrics.evaluationAverage !== null && metrics.evaluationAverage < 3.5
      ? 'Pair evaluation trends with classroom observations and coaching.'
      : null,
  ]);
}

function courseRecommendations(metrics: {
  averageGradePercent: number | null;
  attendanceRate: number | null;
  evaluationAverage: number | null;
  pendingGrades: number;
  sections: number;
  teachers: number;
}) {
  return compactRecommendations([
    metrics.averageGradePercent !== null && metrics.averageGradePercent < 70
      ? 'Identify the weakest assessment topics and add a short intervention plan.'
      : null,
    metrics.attendanceRate !== null && metrics.attendanceRate < 85
      ? 'Coordinate attendance outreach for sections with repeated absences.'
      : null,
    metrics.evaluationAverage !== null && metrics.evaluationAverage < 3.5
      ? 'Review course feedback themes and align expectations across sections.'
      : null,
    metrics.pendingGrades > 20
      ? 'Clear grading backlog to improve feedback loops.'
      : null,
    metrics.sections > 1 && metrics.teachers > 1
      ? 'Compare section outcomes to find teaching practices worth sharing.'
      : null,
  ]);
}

function studentRecommendations(metrics: {
  averageGradePercent: number | null;
  attendanceRate: number | null;
  missingDeadlines: number;
  weakestCourses: Array<{ name: string; averageGradePercent: number | null; attendanceRate: number | null }>;
}) {
  return compactRecommendations([
    metrics.weakestCourses[0]
      ? `Start with ${metrics.weakestCourses[0].name}; it has the strongest risk signal.`
      : null,
    metrics.averageGradePercent !== null && metrics.averageGradePercent < 70
      ? 'Use short daily revision blocks and ask for feedback on the latest assessment mistakes.'
      : null,
    metrics.attendanceRate !== null && metrics.attendanceRate < 85
      ? 'Protect attendance first; missed sessions are likely hurting momentum.'
      : null,
    metrics.missingDeadlines > 0
      ? 'Clear the nearest missing or upcoming unsubmitted deadline before adding extra study work.'
      : null,
  ]);
}

function departmentRecommendations(metrics: {
  averageGradePercent: number | null;
  attendanceRate: number | null;
  evaluationAverage: number | null;
  pendingGrades: number;
  overloadedTeachers: number;
}) {
  return compactRecommendations([
    metrics.overloadedTeachers > 0
      ? 'Review overloaded teachers and rebalance schedules where possible.'
      : null,
    metrics.pendingGrades > 40
      ? 'Set a department grading recovery target for this week.'
      : null,
    metrics.averageGradePercent !== null && metrics.averageGradePercent < 70
      ? 'Identify high-risk courses and plan coordinated academic support.'
      : null,
    metrics.attendanceRate !== null && metrics.attendanceRate < 85
      ? 'Run attendance outreach by section before performance drops further.'
      : null,
    metrics.evaluationAverage !== null && metrics.evaluationAverage < 3.5
      ? 'Review evaluation themes and support teachers with recurring concerns.'
      : null,
  ]);
}

function organizationRecommendations(metrics: {
  averageGradePercent: number | null;
  attendanceRate: number | null;
  evaluationAverage: number | null;
  pendingGrades: number;
  overloadedTeachers: number;
  unscheduledSections: number;
}) {
  return compactRecommendations([
    metrics.unscheduledSections > 0
      ? 'Resolve unscheduled sections first because they block attendance and planning workflows.'
      : null,
    metrics.overloadedTeachers > 0
      ? 'Review overloaded teachers and redistribute recurring slots where possible.'
      : null,
    metrics.pendingGrades > 100
      ? 'Create a short grading recovery window with department-level ownership.'
      : null,
    metrics.attendanceRate !== null && metrics.attendanceRate < 85
      ? 'Treat attendance as an organization-level risk and focus on sections with repeated absences.'
      : null,
    metrics.averageGradePercent !== null && metrics.averageGradePercent < 70
      ? 'Ask departments to identify weak courses and publish support plans.'
      : null,
    metrics.evaluationAverage !== null && metrics.evaluationAverage < 3.5
      ? 'Pair evaluation data with schedule load and course outcomes before acting.'
      : null,
  ]);
}

function compactRecommendations(values: Array<string | null>) {
  const recommendations = values.filter((value): value is string => Boolean(value)).slice(0, 5);
  return recommendations.length ? recommendations : ['No urgent risk signal found. Keep monitoring recent trends and compare against normal EduVerse records.'];
}
