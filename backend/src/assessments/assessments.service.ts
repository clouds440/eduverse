import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentService } from '../students/student.service';
import { SectionsService } from '../sections/sections.service';
import { Role, GradeStatus } from '../common/enums';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly studentService: StudentService,
    private readonly sectionsService: SectionsService,
  ) {}

  // --- Assessments ---
  async createAssessment(
    orgId: string,
    data: CreateAssessmentDto,
    user: JwtPayload,
  ) {
    // Org Admins cannot create assessments (only view)
    if (user.role === Role.ORG_ADMIN) {
      throw new ForbiddenException(
        'Organization Admins are not authorized to create assessments.',
      );
    }

    // Permission check: Manager/Teacher must be assigned to the section
    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      const isAssigned = await this.sectionsService.isTeacherAssignedToSection(data.sectionId, user.id);
      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this section and cannot create assessments for it.',
        );
      }
    }

    // Validate total weightage for the section
    const sectionAssessments = await this.prisma.assessment.findMany({
      where: { sectionId: data.sectionId },
    });

    const totalWeightage = sectionAssessments.reduce(
      (sum, a) => sum + a.weightage,
      0,
    );
    if (totalWeightage + data.weightage > 100) {
      throw new BadRequestException(
        `Total weightage for this section cannot exceed 100%. Current total: ${totalWeightage}%`,
      );
    }

    // Derive academicCycleId from section
    const sectionData = await this.prisma.section.findUnique({
      where: { id: data.sectionId },
      select: { academicCycleId: true },
    });

    const assessment = await this.prisma.assessment.create({
      data: {
        ...data,
        organizationId: orgId,
        academicCycleId: sectionData?.academicCycleId || undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: data.sectionId },
      include: { student: { select: { userId: true } } },
    });

    for (const e of enrollments) {
      await this.notifications.createNotification({
        userId: e.student.userId,
        title: 'New Assessment Created',
        body: `A new assessment "${assessment.title}" has been added.`,
        actionUrl: `/students/${e.student.userId}?tab=assessments&sectionId=${data.sectionId}`,
        type: 'ASSESSMENT_CREATED',
      });
    }

    return assessment;
  }

  async getAssessments(
    orgId: string,
    user: { id: string; role: string | Role },
    filters: { sectionId?: string; courseId?: string; academicCycleId?: string },
  ) {
    let allowedSectionIds: string[] | undefined = undefined;

    if (user.role === Role.STUDENT) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { student: { userId: user.id } },
        select: { sectionId: true },
      });
      allowedSectionIds = enrollments.map((e) => e.sectionId);

      // If a specific section filter was provided, ensure it's within the allowed sections
      if (filters.sectionId && !allowedSectionIds.includes(filters.sectionId)) {
        return []; // unauthorized intersection returns empty
      }
    }

    const whereClause: import('@prisma/client').Prisma.AssessmentWhereInput = {
      organizationId: orgId,
      ...(filters.academicCycleId ? { academicCycleId: filters.academicCycleId } : {}),
    };
    if (filters.courseId) whereClause.courseId = filters.courseId;

    if (user.role === Role.STUDENT) {
      whereClause.sectionId = filters.sectionId
        ? filters.sectionId
        : allowedSectionIds
          ? { in: allowedSectionIds }
          : undefined;
    } else if (user.role === Role.TEACHER) {
      // Restriction for Teachers: only assigned sections
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!teacher) {
        throw new ForbiddenException('Teacher profile not found');
      }
      const assignedSections = await this.sectionsService.getSectionsByTeacherId(teacher.id);
      const assignedIds = assignedSections.map((s) => s.id);

      if (filters.sectionId) {
        if (!assignedIds.includes(filters.sectionId)) {
          throw new ForbiddenException(
            'You are not authorized to view assessments for this section.',
          );
        }
        whereClause.sectionId = filters.sectionId;
      } else {
        whereClause.sectionId = { in: assignedIds };
      }
    } else if (user.role === Role.ORG_MANAGER) {
      // Managers can view all assessments in the org (no restriction like Teachers)
      if (filters.sectionId) whereClause.sectionId = filters.sectionId;
    } else if (filters.sectionId) {
      whereClause.sectionId = filters.sectionId;
    }

    return this.prisma.assessment.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { grades: true, submissions: true },
        },
        section: {
          select: {
            id: true,
            name: true,
            color: true,
            course: { select: { id: true, name: true } },
            teachers: { select: { user: { select: { name: true } } } },
          },
        },
        ...(user.role === Role.STUDENT
          ? {
              grades: {
                where: { student: { userId: user.id } },
              },
              submissions: {
                where: { student: { userId: user.id } },
                select: { id: true, assessmentId: true, studentId: true, fileUrl: true, submittedAt: true },
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAssessment(
    orgId: string,
    id: string,
    data: UpdateAssessmentDto,
    user: JwtPayload,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });
    if (!assessment || assessment.organizationId !== orgId) {
      throw new NotFoundException('Assessment not found');
    }

    // Permission check: Manager/Teacher must be assigned to the section
    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      const isAssigned = await this.sectionsService.isTeacherAssignedToSection(assessment.sectionId, user.id);
      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not authorized to modify this assessment.',
        );
      }
    }

    if (data.weightage !== undefined) {
      const sectionAssessments = await this.prisma.assessment.findMany({
        where: { sectionId: assessment.sectionId, id: { not: id } },
      });

      const totalWeightage = sectionAssessments.reduce(
        (sum, a) => sum + a.weightage,
        0,
      );
      if (totalWeightage + data.weightage > 100) {
        throw new BadRequestException(
          `Total weightage for this section cannot exceed 100%. Current total: ${totalWeightage}%`,
        );
      }
    }

    return this.prisma.assessment.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async deleteAssessment(orgId: string, id: string, user: JwtPayload) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });
    if (!assessment || assessment.organizationId !== orgId) {
      throw new NotFoundException('Assessment not found');
    }

    // Permission check: Manager/Teacher must be assigned to the section
    if (user.role === Role.TEACHER || user.role === Role.ORG_MANAGER) {
      const isAssigned = await this.sectionsService.isTeacherAssignedToSection(assessment.sectionId, user.id);
      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not authorized to delete this assessment.',
        );
      }
    }

    return this.prisma.assessment.delete({ where: { id } });
  }

  async getAssessment(orgId: string, id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id, organizationId: orgId },
      include: {
        course: true,
        section: true,
      },
    });

    if (!assessment) throw new NotFoundException('Assessment not found');

    const files = await this.prisma.file.findMany({
      where: { entityType: 'ASSESSMENT', entityId: id },
    });

    return { ...assessment, files };
  }

  // --- Grades ---
  async getGrades(orgId: string, assessmentId: string, user?: JwtPayload) {
    let studentFilter = {};
    if (user && user.role === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(user.id);
      if (student) studentFilter = { studentId: student.id };
    }

    return this.prisma.grade.findMany({
      where: {
        assessment: { id: assessmentId, organizationId: orgId },
        ...studentFilter,
      },
      include: {
        student: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  async updateGrade(
    orgId: string,
    assessmentId: string,
    studentId: string,
    data: UpdateGradeDto,
    userId: string,
    userRole: Role,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment || assessment.organizationId !== orgId) {
      throw new NotFoundException('Assessment not found');
    }

    const grade = await this.prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });

    if (grade && grade.status === GradeStatus.FINALIZED && userRole !== Role.ORG_ADMIN) {
      throw new ForbiddenException(
        'Only Org Admin can update finalized grades',
      );
    }

    // Permission check: Manager/Teacher must be assigned to the section
    if (userRole === Role.TEACHER || userRole === Role.ORG_MANAGER) {
      const isAssigned = await this.sectionsService.isTeacherAssignedToSection(assessment.sectionId, userId);
      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this section and cannot update grades for it.',
        );
      }
    }

    if (data.marksObtained > assessment.totalMarks) {
      throw new BadRequestException(
        `Marks obtained (${data.marksObtained}) cannot exceed total marks (${assessment.totalMarks})`,
      );
    }

    const result = await this.prisma.grade.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      create: {
        assessmentId,
        studentId,
        marksObtained: data.marksObtained,
        feedback: data.feedback,
        status: data.status || 'DRAFT',
        updatedBy: userId,
        academicCycleId: assessment.academicCycleId,
      },
      update: {
        marksObtained: data.marksObtained,
        feedback: data.feedback,
        status: data.status,
        updatedBy: userId,
      },
    });

    if (data.status === GradeStatus.PUBLISHED || data.status === GradeStatus.FINALIZED) {
      const student = await this.studentService.getStudent(orgId, studentId);
      if (student) {
        await this.notifications.createNotification({
          userId: student.userId,
          title: 'Assessment Graded',
          body: `Your grade for "${assessment.title}" has been ${data.status.toLowerCase()}.`,
          actionUrl: `/students/${student.userId}?tab=assessments?sectionId=${assessment.sectionId}`,
          type: 'ASSESSMENT_GRADED',
        });
      }
    }

    return result;
  }

  async publishGrades(orgId: string, assessmentId: string) {
    return this.prisma.grade.updateMany({
      where: { assessmentId, assessment: { organizationId: orgId } },
      data: { status: 'PUBLISHED' },
    });
  }

  async finalizeGrades(orgId: string, assessmentId: string) {
    return this.prisma.grade.updateMany({
      where: { assessmentId, assessment: { organizationId: orgId } },
      data: { status: 'FINALIZED' },
    });
  }

  async calculateFinalGrade(studentId: string, sectionId?: string) {
    return this.studentService.calculateFinalGrade(studentId, sectionId);
  }

  async getStudentFinalGrades(orgId: string, userId: string) {
    return this.studentService.getStudentFinalGrades(orgId, userId);
  }

  // --- Submissions ---
  async createSubmission(
    orgId: string,
    studentId: string,
    data: CreateSubmissionDto & { assessmentId: string },
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: data.assessmentId },
    });
    if (!assessment || assessment.organizationId !== orgId) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.dueDate && new Date() > assessment.dueDate) {
      throw new BadRequestException('Submission deadline has passed');
    }

    // Check if student already submitted this assessment
    const existingSubmission = await this.prisma.submission.findFirst({
      where: {
        assessmentId: data.assessmentId,
        studentId,
      },
    });

    if (existingSubmission) {
      throw new BadRequestException('You have already submitted this assessment');
    }

    const submission = await this.prisma.submission.create({
      data: {
        ...data,
        studentId,
      },
    });

    // 1. Notify teachers of the new submission
    await this.sectionsService.getSectionById(assessment.sectionId);
    const section = await this.prisma.section.findUnique({
      where: { id: assessment.sectionId },
      include: {
        teachers: { select: { userId: true } },
        enrollments: { select: { studentId: true } },
      },
    });

    const studentData = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { name: true } } },
    });

    if (section && studentData) {
      // 2. Check if ALL students in the section have submitted
      const submissionCount = await this.prisma.submission.count({
        where: { assessmentId: assessment.id },
      });

      if (submissionCount === section.enrollments.length) {
        for (const teacher of section.teachers) {
          await this.notifications.createNotification({
            userId: teacher.userId,
            title: 'Assessment Complete',
            body: `All students in "${section.name}" have submitted their work for "${assessment.title}".`,
            type: 'ASSESSMENT_COMPLETED_ALL',
            actionUrl: `/sections/${assessment.sectionId}/assessments/${assessment.id}`,
          });
        }
      }
    }

    return submission;
  }

  async getSubmissions(orgId: string, assessmentId: string, user?: JwtPayload) {
    let studentFilter = {};
    if (user && user.role === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(user.id);
      if (student) studentFilter = { studentId: student.id };
    }

    const submissions = await this.prisma.submission.findMany({
      where: {
        assessmentId,
        assessment: { organizationId: orgId },
        ...studentFilter,
      },
      include: {
        student: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    const submissionIds = submissions.map((s) => s.id);
    const files = await this.prisma.file.findMany({
      where: { entityType: 'SUBMISSION', entityId: { in: submissionIds } },
    });

    return submissions.map((s) => ({
      ...s,
      files: files.filter((f) => f.entityId === s.id),
    }));
  }
}
