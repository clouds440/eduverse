import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromoteStudentsDto } from './dto/promote-students.dto';
import { EnrollmentSource } from '@/prisma/prisma-client';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Promote students from one academic cycle/cohort to another.
   * 
   * Steps:
   * 1. Validate both cycles and target cohort exist
   * 2. For each student:
   *    - Close old CohortMembershipHistory
   *    - Update Student.cohortId to new cohort
   *    - Create new CohortMembershipHistory
   *    - Auto-enroll into new cohort's sections
   * 3. Does NOT modify old cycle data
   */
  async promoteStudents(orgId: string, dto: PromoteStudentsDto) {
    // Validate cycles
    const fromCycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.fromCycleId, organizationId: orgId },
    });
    if (!fromCycle) throw new NotFoundException('Source academic cycle not found');

    const toCycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.toCycleId, organizationId: orgId },
    });
    if (!toCycle) throw new NotFoundException('Target academic cycle not found');

    // Validate target cohort
    const toCohort = await this.prisma.cohort.findFirst({
      where: { id: dto.toCohortId, organizationId: orgId, academicCycleId: dto.toCycleId },
      include: {
        sections: { select: { id: true, academicCycleId: true } },
      },
    });
    if (!toCohort) throw new NotFoundException('Target cohort not found in the target cycle');

    // Validate students
    const students = await this.prisma.student.findMany({
      where: { id: { in: dto.studentIds }, organizationId: orgId },
    });

    if (students.length !== dto.studentIds.length) {
      throw new BadRequestException('Some students not found in this organization');
    }

    const results = { promoted: 0, skipped: 0 };

    await this.prisma.$transaction(async (tx) => {
      for (const student of students) {
        // Skip if student is already in the target cohort
        if (student.cohortId === dto.toCohortId) {
          results.skipped++;
          continue;
        }

        // Close old cohort membership
        if (student.cohortId) {
          await tx.cohortMembershipHistory.updateMany({
            where: { studentId: student.id, cohortId: student.cohortId, leftAt: null },
            data: { leftAt: new Date() },
          });
        }

        // Update student's cohort
        await tx.student.update({
          where: { id: student.id },
          data: { cohortId: dto.toCohortId },
        });

        // Create new membership history
        await tx.cohortMembershipHistory.create({
          data: {
            studentId: student.id,
            cohortId: dto.toCohortId,
            academicCycleId: dto.toCycleId,
          },
        });

        // Auto-enroll into new cohort's sections
        for (const section of toCohort.sections) {
          const existing = await tx.enrollment.findUnique({
            where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } },
          });

          if (!existing) {
            await tx.enrollment.create({
              data: {
                studentId: student.id,
                sectionId: section.id,
                academicCycleId: section.academicCycleId,
                source: EnrollmentSource.COHORT,
              },
            });

            await tx.enrollmentHistory.create({
              data: {
                studentId: student.id,
                sectionId: section.id,
                academicCycleId: section.academicCycleId,
                source: EnrollmentSource.COHORT,
              },
            });
          }
        }

        results.promoted++;
      }
    });

    return {
      message: `Promotion complete: ${results.promoted} promoted, ${results.skipped} skipped`,
      ...results,
    };
  }
}
