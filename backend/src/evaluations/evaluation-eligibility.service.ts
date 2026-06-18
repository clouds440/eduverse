import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EvaluationType, GradeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CurrentUser {
  id: string;
  role?: string;
  organizationId?: string | null;
}

type SectionForEligibility = Prisma.SectionGetPayload<{
  include: {
    course: { select: { id: true; name: true; departmentId: true; organizationId: true } };
    teachers: { include: { user: { select: { id: true; name: true; email: true } } } };
    academicCycle: { select: { id: true; name: true } };
  };
}>;

type TeacherForEligibility = SectionForEligibility['teachers'][number];

export interface EvaluationTask {
  key: string;
  type: EvaluationType;
  eligible: boolean;
  reason: 'FINALIZED_GRADE_REQUIRED' | 'ACTIVE_WINDOW_REQUIRED' | null;
  window: Prisma.EvaluationWindowGetPayload<Record<string, never>> | null;
  evaluation: Prisma.EvaluationGetPayload<Record<string, never>> | null;
  section: SectionForEligibility;
  course: SectionForEligibility['course'];
  academicCycle: SectionForEligibility['academicCycle'];
  teacher: TeacherForEligibility | null;
}

@Injectable()
export class EvaluationEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentProfile(orgId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId, organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!student) throw new ForbiddenException('Student profile not found for this organization');
    return student;
  }

  async getActiveWindowForSection(orgId: string, section: SectionForEligibility, now = new Date()) {
    const windows = await this.prisma.evaluationWindow.findMany({
      where: {
        organizationId: orgId,
        academicCycleId: section.academicCycleId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        AND: [
          { OR: [{ sectionId: null }, { sectionId: section.id }] },
          { OR: [{ courseId: null }, { courseId: section.courseId }] },
        ],
      },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
    });

    return windows
      .map((window) => ({
        window,
        score: (window.sectionId ? 2 : 0) + (window.courseId ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.window.endDate.getTime() - b.window.endDate.getTime())[0]?.window ?? null;
  }

  async hasFinalizedGrade(studentId: string, sectionId: string) {
    const count = await this.prisma.grade.count({
      where: {
        studentId,
        status: GradeStatus.FINALIZED,
        assessment: { sectionId },
      },
    });
    return count > 0;
  }

  async getStudentPending(orgId: string, actor: CurrentUser) {
    const student = await this.getStudentProfile(orgId, actor.id);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: student.id,
        isExcludedFromCohort: false,
        section: { course: { organizationId: orgId } },
      },
      include: {
        section: {
          include: {
            course: { select: { id: true, name: true, departmentId: true, organizationId: true } },
            teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
            academicCycle: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tasks: EvaluationTask[] = [];
    for (const enrollment of enrollments) {
      const section = enrollment.section;
      const [hasGrade, window, existingEvaluations] = await Promise.all([
        this.hasFinalizedGrade(student.id, section.id),
        this.getActiveWindowForSection(orgId, section),
        this.prisma.evaluation.findMany({
          where: {
            organizationId: orgId,
            studentId: student.id,
            sectionId: section.id,
            academicCycleId: section.academicCycleId,
          },
        }),
      ]);

      const eligible = hasGrade && Boolean(window);
      const courseEvaluation = existingEvaluations.find((evaluation) => evaluation.type === EvaluationType.COURSE);
      tasks.push({
        key: `${section.id}:course`,
        type: EvaluationType.COURSE,
        eligible,
        reason: !hasGrade ? 'FINALIZED_GRADE_REQUIRED' : !window ? 'ACTIVE_WINDOW_REQUIRED' : null,
        window,
        evaluation: courseEvaluation ?? null,
        section,
        course: section.course,
        academicCycle: section.academicCycle,
        teacher: null,
      });

      for (const teacher of section.teachers) {
        const evaluation = existingEvaluations.find(
          (item) => item.type === EvaluationType.TEACHER && item.teacherId === teacher.id,
        );
        tasks.push({
          key: `${section.id}:teacher:${teacher.id}`,
          type: EvaluationType.TEACHER,
          eligible,
          reason: !hasGrade ? 'FINALIZED_GRADE_REQUIRED' : !window ? 'ACTIVE_WINDOW_REQUIRED' : null,
          window,
          evaluation: evaluation ?? null,
          section,
          course: section.course,
          academicCycle: section.academicCycle,
          teacher,
        });
      }
    }

    return {
      student: { id: student.id, user: student.user },
      pending: tasks.filter((task) => task.eligible && !task.evaluation),
      completed: tasks.filter((task) => Boolean(task.evaluation)),
      locked: tasks.filter((task) => !task.eligible),
      tasks,
    };
  }

  async resolveStudentEvaluationContext(
    orgId: string,
    actor: CurrentUser,
    type: EvaluationType,
    sectionId: string,
    teacherId?: string | null,
  ) {
    const student = await this.getStudentProfile(orgId, actor.id);
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, course: { organizationId: orgId } },
      include: {
        course: { select: { id: true, name: true, departmentId: true, organizationId: true } },
        teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
        academicCycle: { select: { id: true, name: true } },
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } },
    });
    if (!enrollment || enrollment.isExcludedFromCohort) {
      throw new ForbiddenException('You are not enrolled in this section');
    }

    const hasGrade = await this.hasFinalizedGrade(student.id, section.id);
    if (!hasGrade) throw new ForbiddenException('A finalized grade is required before evaluations open');

    const window = await this.getActiveWindowForSection(orgId, section);
    if (!window) throw new ForbiddenException('There is no active evaluation window for this section');

    let teacher: TeacherForEligibility | null = null;
    if (type === EvaluationType.TEACHER) {
      if (!teacherId) throw new BadRequestException('teacherId is required for teacher evaluations');
      teacher = section.teachers.find((candidate) => candidate.id === teacherId) ?? null;
      if (!teacher) throw new ForbiddenException('This teacher is not assigned to the selected section');
    }

    return { student, section, course: section.course, teacher, window };
  }
}
