import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentSource, Prisma, StudentStatus } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  sectionDepartmentScopeWhere,
  studentDepartmentScopeWhere,
  type DepartmentScopedUser,
} from '../common/department-scope';
import { BulkEnrollStudentsDto, EnrollStudentDto, TransferEnrollmentDto, WithdrawEnrollmentDto } from './dto/enrollment.dto';

interface CurrentUser extends DepartmentScopedUser {
  id: string;
  role?: string;
}

export interface EnrollmentWarning {
  code: string;
  message: string;
}

const ENROLLMENT_INCLUDE = {
  student: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      primaryDepartment: true,
      studentDepartments: { include: { department: true } },
    },
  },
  section: {
    include: {
      course: { include: { department: true } },
      academicCycle: true,
      cohort: true,
      defaultRoom: true,
      schedules: true,
      _count: { select: { enrollments: true } },
    },
  },
  academicCycle: true,
} satisfies Prisma.EnrollmentInclude;

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanWrite(actor: CurrentUser) {
    if (actor.role === Role.ORG_ADMIN || actor.role === Role.SUB_ADMIN) return;
    throw new ForbiddenException('Only admins and sub-admins can manage enrollments');
  }

  private unique(ids: string[]) {
    return Array.from(new Set(ids.map((id) => id?.trim()).filter(Boolean)));
  }

  private async assertStudentAndSectionScope(orgId: string, studentId: string, sectionId: string, actor?: CurrentUser) {
    const [student, section] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: studentId, organizationId: orgId },
        include: { user: true, studentDepartments: true },
      }),
      this.prisma.section.findFirst({
        where: { id: sectionId, organizationId: orgId },
        include: {
          course: true,
          defaultRoom: true,
          schedules: true,
          _count: { select: { enrollments: true } },
        },
      }),
    ]);

    if (!student) throw new NotFoundException('Student not found');
    if (!section) throw new NotFoundException('Section not found');
    if (student.status === StudentStatus.DELETED || student.status === StudentStatus.ALUMNI) {
      throw new ConflictException('Deleted and alumni students cannot be enrolled');
    }

    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, student.primaryDepartmentId, 'You cannot manage enrollment for a student outside your department scope');
    assertDepartmentInScope(scope, section.course.departmentId, 'You cannot manage enrollment for a section outside your department scope');

    return { student, section };
  }

  private enrollmentWarnings(section: { defaultRoom?: { capacity?: number | null } | null; schedules: unknown[]; _count: { enrollments: number } }) {
    const warnings: EnrollmentWarning[] = [];
    const capacity = section.defaultRoom?.capacity;
    if (capacity && section._count.enrollments + 1 > capacity) {
      warnings.push({
        code: 'CAPACITY',
        message: `Default room capacity is ${capacity}, but this enrollment would bring the section to ${section._count.enrollments + 1} students.`,
      });
    }
    if (section.schedules.length === 0) {
      warnings.push({ code: 'NO_SCHEDULE', message: 'This section does not have a schedule yet.' });
    }
    return warnings;
  }

  async list(orgId: string, query: { studentId?: string; sectionId?: string; academicCycleId?: string }, actor: CurrentUser) {
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    return this.prisma.enrollment.findMany({
      where: {
        studentId: query.studentId,
        sectionId: query.sectionId,
        academicCycleId: query.academicCycleId,
        student: { organizationId: orgId, ...studentDepartmentScopeWhere(scope) },
        section: { organizationId: orgId, ...sectionDepartmentScopeWhere(scope) },
      },
      include: ENROLLMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async enroll(orgId: string, dto: EnrollStudentDto, actor: CurrentUser) {
    this.assertCanWrite(actor);
    const { section } = await this.assertStudentAndSectionScope(orgId, dto.studentId, dto.sectionId, actor);
    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.sectionId } },
    });
    if (existing) throw new ConflictException('Student already enrolled in this section');

    const warnings = this.enrollmentWarnings(section);
    const enrollment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.create({
        data: {
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          academicCycleId: section.academicCycleId,
          source: EnrollmentSource.MANUAL,
        },
        include: ENROLLMENT_INCLUDE,
      });
      await tx.enrollmentHistory.create({
        data: {
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          academicCycleId: section.academicCycleId,
          source: EnrollmentSource.MANUAL,
        },
      });
      return created;
    });

    return { enrollment, warnings };
  }

  async bulkEnroll(orgId: string, dto: BulkEnrollStudentsDto, actor: CurrentUser) {
    this.assertCanWrite(actor);
    const studentIds = this.unique(dto.studentIds);
    if (studentIds.length === 0) throw new BadRequestException('studentIds array is required');
    const results: Awaited<ReturnType<EnrollmentsService['enroll']>>[] = [];
    for (const studentId of studentIds) {
      results.push(await this.enroll(orgId, { studentId, sectionId: dto.sectionId }, actor));
    }
    return { count: results.length, results };
  }

  async withdraw(orgId: string, dto: WithdrawEnrollmentDto, actor: CurrentUser) {
    this.assertCanWrite(actor);
    await this.assertStudentAndSectionScope(orgId, dto.studentId, dto.sectionId, actor);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId: dto.studentId,
        sectionId: dto.sectionId,
        student: { organizationId: orgId },
        section: { organizationId: orgId },
      },
      include: ENROLLMENT_INCLUDE,
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const warnings: EnrollmentWarning[] = enrollment.source === EnrollmentSource.COHORT
      ? [{ code: 'COHORT_SECTION', message: 'This section came from a cohort. Removing it only withdraws this one section.' }]
      : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollmentHistory.updateMany({
        where: {
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          removedAt: null,
        },
        data: { removedAt: new Date() },
      });
      await tx.enrollment.delete({ where: { id: enrollment.id } });
    });

    return { enrollment, warnings };
  }

  async transfer(orgId: string, dto: TransferEnrollmentDto, actor: CurrentUser) {
    this.assertCanWrite(actor);
    if (dto.fromSectionId === dto.toSectionId) throw new BadRequestException('Choose a different target section');
    const targetExisting = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.toSectionId } },
    });
    if (targetExisting) throw new ConflictException('Student already enrolled in this section');
    const withdrawn = await this.withdraw(orgId, { studentId: dto.studentId, sectionId: dto.fromSectionId }, actor);
    const enrolled = await this.enroll(orgId, { studentId: dto.studentId, sectionId: dto.toSectionId }, actor);
    return { withdrawn, enrolled, warnings: [...withdrawn.warnings, ...enrolled.warnings] };
  }

  async withdrawCohort(orgId: string, studentId: string, cohortId: string, actor: CurrentUser) {
    this.assertCanWrite(actor);
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      select: { id: true },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        source: EnrollmentSource.COHORT,
        section: { cohortId, organizationId: orgId },
      },
      select: { id: true, sectionId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollmentHistory.updateMany({
        where: {
          studentId,
          sectionId: { in: enrollments.map((enrollment) => enrollment.sectionId) },
          source: EnrollmentSource.COHORT,
          removedAt: null,
        },
        data: { removedAt: new Date() },
      });
      await tx.enrollment.deleteMany({ where: { id: { in: enrollments.map((enrollment) => enrollment.id) } } });
      await tx.student.update({ where: { id: studentId }, data: { cohortId: null } });
    });
    return { count: enrollments.length };
  }
}
