import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReassignStudentsDto } from './dto/reassign-students.dto';
import { EnrollmentSource, Prisma } from '@/prisma/prisma-client';

@Injectable()
export class ReassignmentService {
  constructor(private readonly prisma: PrismaService) {}

  private unique(ids?: string[]) {
    return Array.from(new Set((ids ?? []).map((id) => id?.trim()).filter(Boolean)));
  }

  private async validateCycle(orgId: string, cycleId: string | undefined, label: string) {
    if (!cycleId) throw new BadRequestException(`${label} academic cycle is required`);
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: cycleId, organizationId: orgId },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException(`${label} academic cycle not found`);
    return cycle;
  }

  private async getSourceStudentIds(orgId: string, dto: ReassignStudentsDto) {
    const explicitIds = this.unique(dto.studentIds);
    if (explicitIds.length > 0) return explicitIds;

    const sourceType = dto.sourceType ?? (dto.fromSectionId ? 'section' : 'cohort');
    if (sourceType === 'section') {
      if (!dto.fromSectionId) throw new BadRequestException('Source section is required');
      const section = await this.prisma.section.findFirst({
        where: { id: dto.fromSectionId, organizationId: orgId },
        select: { id: true },
      });
      if (!section) throw new NotFoundException('Source section not found');

      const enrollments = await this.prisma.enrollment.findMany({
        where: { sectionId: dto.fromSectionId, student: { organizationId: orgId } },
        select: { studentId: true },
      });
      return enrollments.map((enrollment) => enrollment.studentId);
    }

    if (!dto.fromCohortId) throw new BadRequestException('Source cohort is required');
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: dto.fromCohortId, organizationId: orgId },
      include: { students: { select: { id: true } } },
    });
    if (!cohort) throw new NotFoundException('Source cohort not found');
    return cohort.students.map((student) => student.id);
  }

  private async closeCohortMembership(tx: Prisma.TransactionClient, studentId: string, cohortId: string) {
    await tx.cohortMembershipHistory.updateMany({
      where: { studentId, cohortId, leftAt: null },
      data: { leftAt: new Date() },
    });
  }

  private async removeCurrentCohortEnrollments(
    tx: Prisma.TransactionClient,
    studentId: string,
    cohortId: string,
  ) {
    const enrollments = await tx.enrollment.findMany({
      where: {
        studentId,
        source: EnrollmentSource.COHORT,
        section: { cohortId },
      },
      select: { id: true, sectionId: true },
    });
    if (enrollments.length === 0) return;

    await tx.enrollmentHistory.updateMany({
      where: {
        studentId,
        sectionId: { in: enrollments.map((enrollment) => enrollment.sectionId) },
        source: EnrollmentSource.COHORT,
        removedAt: null,
      },
      data: { removedAt: new Date() },
    });
    await tx.enrollment.deleteMany({
      where: { id: { in: enrollments.map((enrollment) => enrollment.id) } },
    });
  }

  private async enrollInSection(
    tx: Prisma.TransactionClient,
    studentId: string,
    section: { id: string; academicCycleId: string | null; cohortId?: string | null },
    source: EnrollmentSource,
  ) {
    const existing = await tx.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId: section.id } },
    });
    if (existing) return false;

    await tx.enrollment.create({
      data: {
        studentId,
        sectionId: section.id,
        academicCycleId: section.academicCycleId,
        source,
      },
    });
    await tx.enrollmentHistory.create({
      data: {
        studentId,
        sectionId: section.id,
        academicCycleId: section.academicCycleId,
        source,
      },
    });
    return true;
  }

  private async moveCurrentSectionEnrollment(
    tx: Prisma.TransactionClient,
    studentId: string,
    fromSectionId: string,
    toSection: { id: string; academicCycleId: string | null; cohortId: string | null },
  ) {
    const targetExisting = await tx.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId: toSection.id } },
    });
    if (targetExisting) return false;

    const current = await tx.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId: fromSectionId } },
      select: { id: true, source: true },
    });
    if (!current) return false;

    await tx.enrollmentHistory.updateMany({
      where: { studentId, sectionId: fromSectionId, removedAt: null },
      data: { removedAt: new Date() },
    });
    await tx.enrollment.delete({ where: { id: current.id } });

    await this.enrollInSection(tx, studentId, toSection, current.source);
    return true;
  }

  private async syncStudentToCohort(
    tx: Prisma.TransactionClient,
    student: { id: string; cohortId: string | null },
    targetCohort: { id: string; academicCycleId: string },
  ) {
    if (student.cohortId === targetCohort.id) return;
    if (student.cohortId) {
      await this.removeCurrentCohortEnrollments(tx, student.id, student.cohortId);
      await this.closeCohortMembership(tx, student.id, student.cohortId);
    }
    await tx.student.update({
      where: { id: student.id },
      data: { cohortId: targetCohort.id },
    });
    await tx.cohortMembershipHistory.create({
      data: {
        studentId: student.id,
        cohortId: targetCohort.id,
        academicCycleId: targetCohort.academicCycleId,
      },
    });
  }

  /**
   * Reassign students by cohort or by section. This only changes current placement
   * rows; historical enrollment, grades, submissions, attendance, and assessments
   * remain tied to their original academic cycle records.
   */
  async reassignStudents(orgId: string, dto: ReassignStudentsDto) {
    const sourceType = dto.sourceType ?? (dto.fromSectionId ? 'section' : 'cohort');
    const excludedStudentIds = new Set(this.unique(dto.excludedStudentIds));
    const sourceStudentIds = this.unique(await this.getSourceStudentIds(orgId, dto));
    const studentIds = sourceStudentIds.filter((studentId) => !excludedStudentIds.has(studentId));

    if (studentIds.length === 0) {
      throw new BadRequestException('No students selected for reassignment');
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, organizationId: orgId },
      select: { id: true, cohortId: true },
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException('Some students were not found in this organization');
    }

    const results = {
      reassigned: 0,
      skipped: 0,
      excluded: excludedStudentIds.size,
    };

    if (sourceType === 'section') {
      if (!dto.fromSectionId || !dto.toSectionId) {
        throw new BadRequestException('Source and destination sections are required');
      }
      await this.validateCycle(orgId, dto.toCycleId, 'Target');
      if (dto.fromSectionId === dto.toSectionId) {
        throw new BadRequestException('Choose a different destination section');
      }

      const [fromSection, toSection] = await Promise.all([
        this.prisma.section.findFirst({
          where: { id: dto.fromSectionId, organizationId: orgId },
          select: { id: true },
        }),
        this.prisma.section.findFirst({
          where: { id: dto.toSectionId, organizationId: orgId, academicCycleId: dto.toCycleId },
          select: { id: true, academicCycleId: true, cohortId: true, cohort: { select: { id: true, academicCycleId: true, isActive: true } } },
        }),
      ]);

      if (!fromSection) throw new NotFoundException('Source section not found');
      if (!toSection) throw new NotFoundException('Destination section not found in the target cycle');
      if (toSection.cohort && !toSection.cohort.isActive) {
        throw new ConflictException('Cannot reassign students into a section attached to an inactive cohort');
      }

      await this.prisma.$transaction(async (tx) => {
        for (const student of students) {
          const moved = await this.moveCurrentSectionEnrollment(tx, student.id, fromSection.id, toSection);
          if (!moved) {
            results.skipped++;
            continue;
          }

          if (toSection.cohort) {
            await this.syncStudentToCohort(tx, student, toSection.cohort);
          }
          results.reassigned++;
        }
      });

      return {
        message: `Section reassignment complete: ${results.reassigned} reassigned, ${results.skipped} skipped, ${results.excluded} excluded`,
        ...results,
      };
    }

    if (!dto.toCohortId) throw new BadRequestException('Destination cohort is required');
    await this.validateCycle(orgId, dto.toCycleId, 'Target');
    const targetCohort = await this.prisma.cohort.findFirst({
      where: { id: dto.toCohortId, organizationId: orgId, academicCycleId: dto.toCycleId },
      include: { sections: { select: { id: true, academicCycleId: true, cohortId: true } } },
    });
    if (!targetCohort) throw new NotFoundException('Destination cohort not found in the target cycle');
    if (!targetCohort.isActive) throw new ConflictException('Cannot reassign students into an inactive cohort');

    await this.prisma.$transaction(async (tx) => {
      for (const student of students) {
        if (student.cohortId === targetCohort.id) {
          results.skipped++;
          continue;
        }

        await this.syncStudentToCohort(tx, student, targetCohort);
        for (const section of targetCohort.sections) {
          await this.enrollInSection(tx, student.id, section, EnrollmentSource.COHORT);
        }

        results.reassigned++;
      }
    });

    return {
      message: `Cohort reassignment complete: ${results.reassigned} reassigned, ${results.skipped} skipped, ${results.excluded} excluded`,
      ...results,
    };
  }
}
