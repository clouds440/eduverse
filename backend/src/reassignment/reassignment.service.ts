import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentSource, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { ReassignStudentsDto } from './dto/reassign-students.dto';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { StudentProgramEnrollmentsService } from '../student-program-enrollments/student-program-enrollments.service';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';

type Transaction = Prisma.TransactionClient;
type Actor = DepartmentScopedUser & { id: string };

@Injectable()
export class ReassignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentPrograms: StudentProgramEnrollmentsService,
  ) {}

  private unique(ids?: Array<string | undefined>): string[] {
    return [...new Set((ids ?? []).map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
  }

  private async assertReassignmentScope(orgId: string, dto: ReassignStudentsDto, actor: Actor) {
    const sourceType = dto.sourceType ?? (dto.fromSectionId ? 'section' : 'cohort');
    const departmentIds: Array<string | null> = [];
    if (sourceType === 'section') {
      const sections = await this.prisma.section.findMany({
        where: { id: { in: this.unique([dto.fromSectionId, dto.toSectionId]) }, organizationId: orgId },
        include: { course: { select: { departmentId: true } } },
      });
      if (sections.length !== this.unique([dto.fromSectionId, dto.toSectionId]).length) {
        throw new NotFoundException('Source or destination section not found');
      }
      departmentIds.push(...sections.map((section) => section.course.departmentId));
    } else {
      const offeringIds = this.unique([dto.fromCohortId, dto.toCohortId]);
      const offerings = await this.prisma.cohortOffering.findMany({
        where: { id: { in: offeringIds }, organizationId: orgId },
        include: {
          programStageOffering: { include: { programOffering: { include: { program: true } } } },
          sections: { include: { section: { include: { course: true } } } },
        },
      });
      if (offerings.length !== offeringIds.length) throw new NotFoundException('Source or destination cohort offering not found');
      for (const offering of offerings) {
        departmentIds.push(offering.programStageOffering?.programOffering.program.departmentId ?? null);
        departmentIds.push(...offering.sections.map((link) => link.section.course.departmentId));
      }
    }

    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (!scope.applies || scope.all) return;
    const scopedIds = [...new Set(departmentIds.filter((id): id is string => Boolean(id)))];
    if (!scopedIds.length) {
      throw new ForbiddenException('This reassignment has no department context and requires organization-wide scope');
    }
    scopedIds.forEach((departmentId) => assertDepartmentInScope(
      scope,
      departmentId,
      'You cannot reassign students outside your assigned departments',
    ));
  }

  private async sourceStudentIds(orgId: string, dto: ReassignStudentsDto) {
    const explicit = this.unique(dto.studentIds);
    if (explicit.length) return explicit;
    const sourceType = dto.sourceType ?? (dto.fromSectionId ? 'section' : 'cohort');
    if (sourceType === 'section') {
      if (!dto.fromSectionId) throw new BadRequestException('Source section is required');
      const rows = await this.prisma.enrollment.findMany({
        where: { sectionId: dto.fromSectionId, student: { organizationId: orgId } },
        select: { studentId: true },
      });
      return rows.map((row) => row.studentId);
    }
    if (!dto.fromCohortId) throw new BadRequestException('Source cohort offering is required');
    const rows = await this.prisma.studentCohortMembership.findMany({
      where: { organizationId: orgId, cohortOfferingId: dto.fromCohortId, leftAt: null },
      select: { studentId: true },
    });
    return rows.map((row) => row.studentId);
  }

  private async archiveEnrollment(tx: Transaction, enrollment: Prisma.EnrollmentGetPayload<Record<string, never>>) {
    await tx.enrollmentHistory.create({
      data: {
        studentId: enrollment.studentId,
        sectionId: enrollment.sectionId,
        academicCycleId: enrollment.academicCycleId,
        studentProgramEnrollmentId: enrollment.studentProgramEnrollmentId,
        studentStageEnrollmentId: enrollment.studentStageEnrollmentId,
        studentCohortMembershipId: enrollment.studentCohortMembershipId,
        source: enrollment.source,
        wasExcluded: enrollment.isExcludedFromCohort,
        enrolledAt: enrollment.createdAt,
        removedAt: new Date(),
      },
    });
    await tx.enrollment.delete({ where: { id: enrollment.id } });
  }

  private async moveSection(
    tx: Transaction,
    orgId: string,
    studentId: string,
    fromSectionId: string,
    toSection: { id: string; academicCycleId: string; programMappings: Array<{ programStageOfferingId: string }> },
    actorId: string,
  ) {
    const [current, duplicate] = await Promise.all([
      tx.enrollment.findUnique({ where: { studentId_sectionId: { studentId, sectionId: fromSectionId } } }),
      tx.enrollment.findUnique({ where: { studentId_sectionId: { studentId, sectionId: toSection.id } } }),
    ]);
    if (!current || duplicate) return false;
    const context = toSection.programMappings.length
      ? await this.studentPrograms.ensureMappedSectionEnrollment(tx, orgId, studentId, toSection, actorId)
      : null;
    await this.archiveEnrollment(tx, current);
    await tx.enrollment.create({
      data: {
        studentId,
        sectionId: toSection.id,
        academicCycleId: toSection.academicCycleId,
        source: current.source,
        studentProgramEnrollmentId: context?.enrollment.id,
        studentStageEnrollmentId: context?.stageEnrollment.id,
      },
    });
    return true;
  }

  private async placeInCohortOffering(
    tx: Transaction,
    orgId: string,
    studentId: string,
    offering: {
      id: string;
      academicCycleId: string;
      programStageOfferingId: string | null;
      sections: Array<{ section: { id: string; academicCycleId: string } }>;
    },
    actorId: string,
  ) {
    const existing = await tx.studentCohortMembership.findFirst({
      where: { studentId, cohortOfferingId: offering.id, leftAt: null },
    });
    if (existing) return false;
    const stageEnrollment = offering.programStageOfferingId
      ? await this.studentPrograms.ensureCohortOfferingPlacement(tx, orgId, studentId, offering.id, actorId)
      : null;
    const membership = await tx.studentCohortMembership.create({
      data: {
        organizationId: orgId,
        studentId,
        cohortOfferingId: offering.id,
        studentStageEnrollmentId: stageEnrollment?.id,
        source: EnrollmentSource.COHORT,
        joinedById: actorId,
      },
    });
    for (const link of offering.sections) {
      await tx.enrollment.upsert({
        where: { studentId_sectionId: { studentId, sectionId: link.section.id } },
        create: {
          studentId,
          sectionId: link.section.id,
          academicCycleId: link.section.academicCycleId,
          source: EnrollmentSource.COHORT,
          studentCohortMembershipId: membership.id,
          studentStageEnrollmentId: stageEnrollment?.id,
          studentProgramEnrollmentId: stageEnrollment?.studentProgramEnrollmentId,
        },
        update: {},
      });
    }
    return true;
  }

  async reassignStudents(orgId: string, dto: ReassignStudentsDto, actor: Actor) {
    await this.assertReassignmentScope(orgId, dto, actor);
    const actorId = actor.id;
    await assertAcademicCycleWritable(this.prisma, orgId, dto.toCycleId, 'DELIVERY');
    if (dto.fromCycleId) await assertAcademicCycleWritable(this.prisma, orgId, dto.fromCycleId, 'DELIVERY');
    const excluded = new Set(this.unique(dto.excludedStudentIds));
    const studentIds = this.unique(await this.sourceStudentIds(orgId, dto)).filter((id) => !excluded.has(id));
    if (!studentIds.length) throw new BadRequestException('No students selected for reassignment');
    const count = await this.prisma.student.count({ where: { id: { in: studentIds }, organizationId: orgId } });
    if (count !== studentIds.length) throw new BadRequestException('Some students were not found in this organization');

    const sourceType = dto.sourceType ?? (dto.fromSectionId ? 'section' : 'cohort');
    const results = { reassigned: 0, skipped: 0, excluded: excluded.size };
    if (sourceType === 'section') {
      if (!dto.fromSectionId || !dto.toSectionId) throw new BadRequestException('Source and destination sections are required');
      if (dto.fromSectionId === dto.toSectionId) throw new BadRequestException('Choose a different destination section');
      const toSection = await this.prisma.section.findFirst({
        where: { id: dto.toSectionId, organizationId: orgId, academicCycleId: dto.toCycleId },
        include: { programMappings: true },
      });
      if (!toSection) throw new NotFoundException('Destination section not found in the target cycle');
      await this.prisma.$transaction(async (tx) => {
        for (const studentId of studentIds) {
          if (await this.moveSection(tx, orgId, studentId, dto.fromSectionId!, toSection, actorId)) results.reassigned++;
          else results.skipped++;
        }
      });
      return { message: 'Section reassignment complete', ...results };
    }

    if (!dto.toCohortId) throw new BadRequestException('Destination cohort offering is required');
    const target = await this.prisma.cohortOffering.findFirst({
      where: { id: dto.toCohortId, organizationId: orgId, academicCycleId: dto.toCycleId },
      include: { sections: { where: { isDefault: true }, include: { section: true } } },
    });
    if (!target) throw new NotFoundException('Destination cohort offering not found in the target cycle');
    await this.prisma.$transaction(async (tx) => {
      for (const studentId of studentIds) {
        if (dto.fromCohortId) {
          const oldMemberships = await tx.studentCohortMembership.findMany({
            where: { studentId, cohortOfferingId: dto.fromCohortId, leftAt: null },
          });
          for (const membership of oldMemberships) {
            const enrollments = await tx.enrollment.findMany({ where: { studentCohortMembershipId: membership.id, source: EnrollmentSource.COHORT } });
            for (const enrollment of enrollments) await this.archiveEnrollment(tx, enrollment);
            await tx.studentCohortMembership.update({ where: { id: membership.id }, data: { leftAt: new Date(), leftById: actorId } });
          }
        }
        if (await this.placeInCohortOffering(tx, orgId, studentId, target, actorId)) results.reassigned++;
        else results.skipped++;
      }
    });
    return { message: 'Cohort offering reassignment complete', ...results };
  }
}
