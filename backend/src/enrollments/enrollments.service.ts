import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceRecordSource, AttendanceStatus, EnrollmentSource, Prisma, StudentStatus } from '@/prisma/prisma-client';
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
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { StudentProgramEnrollmentsService } from '../student-program-enrollments/student-program-enrollments.service';

interface CurrentUser extends DepartmentScopedUser {
  id: string;
  role?: string;
}

export interface EnrollmentWarning {
  code: string;
  message: string;
}

interface TransferOptions {
  wasExcluded?: boolean;
  attendanceTransferMode?: 'PRESERVE_ONLY' | 'PERCENTAGE_ADJUSTMENT';
  transferDate?: string;
  reason?: string;
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
      cohortOfferingSections: { include: { cohortOffering: { include: { cohort: true } } } },
      programMappings: true,
      defaultRoom: true,
      schedules: true,
      _count: { select: { enrollments: true } },
    },
  },
  academicCycle: true,
} satisfies Prisma.EnrollmentInclude;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentPrograms: StudentProgramEnrollmentsService,
  ) {}

  private assertCanWrite(actor: CurrentUser) {
    if (actor.role === Role.ORG_ADMIN || actor.role === Role.SUB_ADMIN) return;
    throw new ForbiddenException('Only admins and sub-admins can manage enrollments');
  }

  private unique(ids: string[]) {
    return Array.from(new Set(ids.map((id) => id?.trim()).filter(Boolean)));
  }

  private parseTransferDate(value?: string) {
    if (!value) return new Date();
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('transferDate must be a valid date');
    }
    return date;
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
          programMappings: { include: { stageCourseRequirement: true } },
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
    await assertAcademicCycleWritable(this.prisma, orgId, section.academicCycleId, 'DELIVERY');
    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.sectionId } },
    });
    if (existing) throw new ConflictException('Student already enrolled in this section');

    const warnings = this.enrollmentWarnings(section);
    const enrollment = await this.prisma.$transaction(async (tx) => {
      const programContext = section.programMappings.length
        ? await this.studentPrograms.ensureMappedSectionEnrollment(tx, orgId, dto.studentId, section, actor.id)
        : null;
      const created = await tx.enrollment.create({
        data: {
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          academicCycleId: section.academicCycleId,
          source: EnrollmentSource.MANUAL,
          studentProgramEnrollmentId: programContext?.enrollment.id,
          studentStageEnrollmentId: programContext?.stageEnrollment.id,
        },
        include: ENROLLMENT_INCLUDE,
      });
      await tx.enrollmentHistory.create({
        data: {
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          academicCycleId: section.academicCycleId,
          source: EnrollmentSource.MANUAL,
          studentProgramEnrollmentId: programContext?.enrollment.id,
          studentStageEnrollmentId: programContext?.stageEnrollment.id,
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
    await assertAcademicCycleWritable(this.prisma, orgId, enrollment.academicCycleId, 'DELIVERY');

    const warnings: EnrollmentWarning[] = enrollment.source === EnrollmentSource.COHORT
      ? [{ code: 'COHORT_SECTION', message: 'This section came from a cohort. Removing it only withdraws this one section.' }]
      : [];

    const gradeCount = await this.prisma.grade.count({
      where: {
        studentId: dto.studentId,
        assessment: { sectionId: dto.sectionId, organizationId: orgId },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollmentHistory.updateMany({
        where: {
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          removedAt: null,
        },
        data: {
          removedAt: new Date(),
          ...(dto.wasExcluded !== undefined ? { wasExcluded: dto.wasExcluded } : {}),
        },
      });
      await tx.enrollment.delete({ where: { id: enrollment.id } });
    });

    return {
      enrollment,
      warnings: [
        ...warnings,
        ...(gradeCount > 0
          ? [{
              code: 'TRANSCRIPT_EXCLUSION_REVIEW',
              message: dto.wasExcluded
                ? 'This section history is preserved but excluded from transcript GPA, CGPA, rank, and merit.'
                : 'This section has grades. It remains included in transcript GPA, CGPA, rank, and merit unless excluded.',
            }]
          : []),
        {
          code: 'TRANSFER_UTILITY_HINT',
          message: 'If the student is moving to another section, use the transfer or reassignment utility instead of remove-only.',
        },
      ],
    };
  }

  async transfer(orgId: string, dto: TransferEnrollmentDto, actor: CurrentUser) {
    this.assertCanWrite(actor);
    if (dto.fromSectionId === dto.toSectionId) throw new BadRequestException('Choose a different target section');
    const targetExisting = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: dto.studentId, sectionId: dto.toSectionId } },
    });
    if (targetExisting) throw new ConflictException('Student already enrolled in this section');
    const transferDate = this.parseTransferDate(dto.transferDate);
    const transferResult = await this.transferSectionEnrollment(
      orgId,
      dto.studentId,
      dto.fromSectionId,
      dto.toSectionId,
      actor,
      { ...dto, transferDate: transferDate.toISOString().slice(0, 10) },
    );
    return transferResult;
  }

  async transferSectionEnrollment(
    orgId: string,
    studentId: string,
    fromSectionId: string,
    toSectionId: string,
    actor: CurrentUser,
    options: TransferOptions = {},
  ) {
    this.assertCanWrite(actor);
    if (fromSectionId === toSectionId) throw new BadRequestException('Choose a different target section');
    const transferDate = this.parseTransferDate(options.transferDate);
    const targetExisting = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId: toSectionId } },
    });
    if (targetExisting) throw new ConflictException('Student already enrolled in this section');

    const { student, section: fromSection } = await this.assertStudentAndSectionScope(orgId, studentId, fromSectionId, actor);
    const { section: toSection } = await this.assertStudentAndSectionScope(orgId, studentId, toSectionId, actor);
    await assertAcademicCycleWritable(this.prisma, orgId, fromSection.academicCycleId, 'DELIVERY');
    await assertAcademicCycleWritable(this.prisma, orgId, toSection.academicCycleId, 'DELIVERY');

    const current = await this.prisma.enrollment.findFirst({
      where: { studentId, sectionId: fromSectionId, student: { organizationId: orgId }, section: { organizationId: orgId } },
      include: ENROLLMENT_INCLUDE,
    });
    if (!current) throw new NotFoundException('Enrollment not found');

    const warnings: EnrollmentWarning[] = [];
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.enrollmentHistory.updateMany({
        where: { studentId, sectionId: fromSectionId, removedAt: null },
        data: {
          removedAt: transferDate,
          ...(options.wasExcluded !== undefined ? { wasExcluded: options.wasExcluded } : {}),
        },
      });
      await tx.enrollment.delete({ where: { id: current.id } });

      const programContext = toSection.programMappings.length
        ? await this.studentPrograms.ensureMappedSectionEnrollment(tx, orgId, studentId, toSection, actor.id)
        : null;
      const enrolled = await tx.enrollment.create({
        data: {
          studentId,
          sectionId: toSectionId,
          academicCycleId: toSection.academicCycleId,
          source: current.source,
          studentProgramEnrollmentId: programContext?.enrollment.id,
          studentStageEnrollmentId: programContext?.stageEnrollment.id,
        },
        include: ENROLLMENT_INCLUDE,
      });
      await tx.enrollmentHistory.create({
        data: {
          studentId,
          sectionId: toSectionId,
          academicCycleId: toSection.academicCycleId,
          source: current.source,
          studentProgramEnrollmentId: programContext?.enrollment.id,
          studentStageEnrollmentId: programContext?.stageEnrollment.id,
          enrolledAt: transferDate,
        },
      });

      const exemptions = await this.createTransferAssessmentExemptions(tx, studentId, fromSectionId, toSectionId, toSection.academicCycleId, transferDate, actor.id, options.reason);
      const attendanceAdjustment = options.attendanceTransferMode === 'PERCENTAGE_ADJUSTMENT'
        ? await this.createPercentageAttendanceAdjustment(tx, studentId, fromSectionId, toSectionId, transferDate, options.reason)
        : null;
      return { enrolled, exemptions, attendanceAdjustment };
    });

    warnings.push({
      code: options.wasExcluded ? 'SOURCE_SECTION_EXCLUDED' : 'SOURCE_SECTION_INCLUDED',
      message: options.wasExcluded
        ? 'Source section history is preserved but excluded from transcript GPA, CGPA, rank, and merit.'
        : 'Source section history is preserved and remains eligible for transcript GPA, CGPA, rank, and merit.',
    });
    if (result.exemptions > 0) {
      warnings.push({
        code: 'TRANSFER_ASSESSMENT_EXEMPTIONS',
        message: `${result.exemptions} destination assessment${result.exemptions === 1 ? '' : 's'} before the transfer date were exempted instead of marked zero.`,
      });
    }
    if (result.attendanceAdjustment) {
      warnings.push({
        code: 'ATTENDANCE_PERCENTAGE_ADJUSTMENT',
        message: `Created ${result.attendanceAdjustment.created} auditable destination attendance adjustment${result.attendanceAdjustment.created === 1 ? '' : 's'} from a ${result.attendanceAdjustment.percentage}% source attendance rate.`,
      });
      if (result.attendanceAdjustment.availableSessions === 0) {
        warnings.push({ code: 'NO_DESTINATION_ATTENDANCE_SESSIONS', message: 'No destination sessions before the transfer date were available for percentage attendance adjustment.' });
      }
    }

    return { withdrawn: { enrollment: current }, enrolled: { enrollment: result.enrolled }, warnings, student };
  }

  private async createTransferAssessmentExemptions(
    tx: Prisma.TransactionClient,
    studentId: string,
    fromSectionId: string,
    toSectionId: string,
    academicCycleId: string,
    transferDate: Date,
    actorId: string,
    reason?: string,
  ) {
    const assessments = await tx.assessment.findMany({
      where: {
        sectionId: toSectionId,
        academicCycleId,
        OR: [
          { dueDate: { lt: transferDate } },
          { dueDate: null, createdAt: { lt: transferDate } },
        ],
      },
      select: { id: true },
    });
    let count = 0;
    for (const assessment of assessments) {
      const existingGrade = await tx.grade.findUnique({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId } },
        select: { id: true },
      });
      if (existingGrade) continue;
      await tx.assessmentExemption.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId } },
        create: {
          assessmentId: assessment.id,
          studentId,
          academicCycleId,
          sourceSectionId: fromSectionId,
          createdById: actorId,
          source: 'TRANSFER',
          reason: reason?.trim() || 'Student transferred into this section after the assessment was available.',
        },
        update: {
          sourceSectionId: fromSectionId,
          createdById: actorId,
          reason: reason?.trim() || 'Student transferred into this section after the assessment was available.',
        },
      });
      count++;
    }
    return count;
  }

  private async createPercentageAttendanceAdjustment(
    tx: Prisma.TransactionClient,
    studentId: string,
    fromSectionId: string,
    toSectionId: string,
    transferDate: Date,
    reason?: string,
  ) {
    const sourceRecords = await tx.attendanceRecord.findMany({
      where: { studentId, session: { sectionId: fromSectionId } },
      select: { status: true },
    });
    const total = sourceRecords.length;
    const attended = sourceRecords.filter((record) => record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE).length;
    const percentage = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

    const destinationSessions = await tx.attendanceSession.findMany({
      where: { sectionId: toSectionId, date: { lt: transferDate } },
      select: { id: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const existing = destinationSessions.length
      ? await tx.attendanceRecord.findMany({
          where: { studentId, sessionId: { in: destinationSessions.map((session) => session.id) } },
          select: { sessionId: true },
        })
      : [];
    const existingSessionIds = new Set(existing.map((record) => record.sessionId));
    const sessionsToAdjust = destinationSessions.filter((session) => !existingSessionIds.has(session.id));
    const presentCount = total > 0 ? Math.round((attended / total) * sessionsToAdjust.length) : 0;
    let created = 0;
    for (const [index, session] of sessionsToAdjust.entries()) {
      await tx.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId,
          status: index < presentCount ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
          source: AttendanceRecordSource.TRANSFER_PERCENTAGE,
          transferredFromSectionId: fromSectionId,
          transferredFromAttendancePercent: percentage,
          note: reason?.trim() || 'Percentage-based attendance adjustment from source section transfer.',
        },
      });
      created++;
    }
    return { created, percentage, sourceRecords: total, availableSessions: sessionsToAdjust.length };
  }

  async withdrawCohort(orgId: string, studentId: string, cohortOfferingId: string, actor: CurrentUser) {
    this.assertCanWrite(actor);
    const cohort = await this.prisma.cohortOffering.findFirst({
      where: { id: cohortOfferingId, organizationId: orgId },
      select: { id: true, academicCycleId: true },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    await assertAcademicCycleWritable(this.prisma, orgId, cohort.academicCycleId, 'DELIVERY');
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        source: EnrollmentSource.COHORT,
        studentCohortMembership: { cohortOfferingId },
        section: { organizationId: orgId },
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
      await tx.studentCohortMembership.updateMany({
        where: { studentId, cohortOfferingId, leftAt: null },
        data: { leftAt: new Date(), leftById: actor.id },
      });
    });
    return { count: enrollments.length };
  }
}
