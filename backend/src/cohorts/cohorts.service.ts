import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
} from '../common/utils';
import { Prisma, EnrollmentSource } from '@prisma/client';

@Injectable()
export class CohortsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async createCohort(orgId: string, dto: CreateCohortDto) {
    // Validate cycle belongs to org
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.academicCycleId, organizationId: orgId },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found in this organization');

    return this.prisma.$transaction(async (tx) => {
      const cohort = await tx.cohort.create({
        data: {
          name: dto.name,
          organizationId: orgId,
          academicCycleId: dto.academicCycleId,
          sections: {
            connect: dto.sectionIds?.map(id => ({ id })) || [],
          },
        },
        include: {
          sections: { select: { id: true, academicCycleId: true } },
        },
      });

      if (dto.studentIds?.length) {
        const students = await tx.student.findMany({
          where: { id: { in: dto.studentIds }, organizationId: orgId },
        });

        if (students.length !== dto.studentIds.length) {
          throw new BadRequestException('Some students not found in this organization');
        }

        for (const student of students) {
          if (student.cohortId) {
            await this.removeCohortEnrollments(tx, student.id, student.cohortId);
            await tx.cohortMembershipHistory.updateMany({
              where: { studentId: student.id, cohortId: student.cohortId, leftAt: null },
              data: { leftAt: new Date() },
            });
          }

          await tx.student.update({
            where: { id: student.id },
            data: { cohortId: cohort.id },
          });

          await tx.cohortMembershipHistory.create({
            data: {
              studentId: student.id,
              cohortId: cohort.id,
              academicCycleId: cohort.academicCycleId,
            },
          });

          for (const section of cohort.sections) {
            await this.autoEnrollStudent(tx, student.id, section.id, section.academicCycleId || cohort.academicCycleId);
          }
        }
      }

      return tx.cohort.findUnique({
        where: { id: cohort.id },
        include: {
          academicCycle: { select: { id: true, name: true } },
          _count: { select: { students: true, sections: true } },
        },
      });
    });
  }

  async getCohorts(orgId: string, options: PaginationOptions & { academicCycleId?: string }) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
    });

    const where: Prisma.CohortWhereInput = {
      organizationId: orgId,
      ...(options.academicCycleId ? { academicCycleId: options.academicCycleId } : {}),
      ...(options.search
        ? { name: { contains: options.search, mode: 'insensitive' } }
        : {}),
    };

    const [cohorts, totalRecords] = await Promise.all([
      this.prisma.cohort.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          academicCycle: { select: { id: true, name: true, isActive: true } },
          _count: { select: { students: true, sections: true } },
        },
      }),
      this.prisma.cohort.count({ where }),
    ]);

    return formatPaginatedResponse(cohorts, totalRecords, options.page, options.limit);
  }

  async getCohort(orgId: string, id: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      include: {
        academicCycle: { select: { id: true, name: true, isActive: true } },
        students: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        sections: {
          include: {
            course: { select: { id: true, name: true } },
            _count: { select: { enrollments: true } },
          },
        },
        _count: { select: { students: true, sections: true } },
      },
    });

    if (!cohort) throw new NotFoundException('Cohort not found');
    return cohort;
  }

  async updateCohort(orgId: string, id: string, dto: UpdateCohortDto) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      include: {
        students: { select: { id: true } },
        sections: { select: { id: true, academicCycleId: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    return this.prisma.$transaction(async (tx) => {
      const previousStudentIds = new Set(cohort.students.map(student => student.id));
      const previousSectionIds = new Set(cohort.sections.map(section => section.id));
      const nextStudentIds = dto.studentIds ? new Set(dto.studentIds) : previousStudentIds;
      const nextSectionIds = dto.sectionIds ? new Set(dto.sectionIds) : previousSectionIds;

      const removedStudentIds = [...previousStudentIds].filter(studentId => !nextStudentIds.has(studentId));
      const addedStudentIds = [...nextStudentIds].filter(studentId => !previousStudentIds.has(studentId));
      const removedSectionIds = [...previousSectionIds].filter(sectionId => !nextSectionIds.has(sectionId));
      const addedSectionIds = [...nextSectionIds].filter(sectionId => !previousSectionIds.has(sectionId));

      await tx.cohort.update({
        where: { id },
        data: {
          name: dto.name,
          sections: dto.sectionIds ? {
            set: dto.sectionIds.map(sectionId => ({ id: sectionId })),
          } : undefined,
        },
      });

      for (const studentId of removedStudentIds) {
        await this.removeCohortEnrollments(tx, studentId, id);
        await tx.student.update({
          where: { id: studentId },
          data: { cohortId: null },
        });
        await tx.cohortMembershipHistory.updateMany({
          where: { studentId, cohortId: id, leftAt: null },
          data: { leftAt: new Date() },
        });
      }

      if (removedSectionIds.length > 0) {
        await this.removeCohortSectionEnrollments(tx, removedSectionIds);
      }

      let currentStudents = cohort.students;
      if (addedStudentIds.length > 0) {
        const addedStudents = await tx.student.findMany({
          where: { id: { in: addedStudentIds }, organizationId: orgId },
        });
        if (addedStudents.length !== addedStudentIds.length) {
          throw new BadRequestException('Some students not found in this organization');
        }

        for (const student of addedStudents) {
          if (student.cohortId && student.cohortId !== id) {
            await this.removeCohortEnrollments(tx, student.id, student.cohortId);
            await tx.cohortMembershipHistory.updateMany({
              where: { studentId: student.id, cohortId: student.cohortId, leftAt: null },
              data: { leftAt: new Date() },
            });
          }

          await tx.student.update({
            where: { id: student.id },
            data: { cohortId: id },
          });

          await tx.cohortMembershipHistory.create({
            data: {
              studentId: student.id,
              cohortId: id,
              academicCycleId: cohort.academicCycleId,
            },
          });
        }

        currentStudents = [
          ...cohort.students.filter(student => !removedStudentIds.includes(student.id)),
          ...addedStudents.map(student => ({ id: student.id })),
        ];
      } else if (removedStudentIds.length > 0) {
        currentStudents = cohort.students.filter(student => !removedStudentIds.includes(student.id));
      }

      const sectionsForEnrollment = await tx.section.findMany({
        where: { id: { in: [...nextSectionIds] } },
        select: { id: true, academicCycleId: true },
      });
      const addedSections = sectionsForEnrollment.filter(section => addedSectionIds.includes(section.id));

      for (const student of currentStudents) {
        const targetSections = addedStudentIds.includes(student.id) ? sectionsForEnrollment : addedSections;
        for (const section of targetSections) {
          await this.autoEnrollStudent(tx, student.id, section.id, section.academicCycleId || cohort.academicCycleId);
        }
      }

      return tx.cohort.findUnique({
        where: { id },
        include: {
          academicCycle: { select: { id: true, name: true } },
          _count: { select: { students: true, sections: true } },
        },
      });
    });
  }

  async deleteCohort(orgId: string, id: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { students: true } } },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    if (cohort._count.students > 0) {
      throw new ConflictException(
        'Cannot delete cohort with assigned students. Remove students first.',
      );
    }

    // Remove cohort association from sections
    await this.prisma.section.updateMany({
      where: { cohortId: id },
      data: { cohortId: null },
    });

    await this.prisma.cohort.delete({ where: { id } });
    return { message: 'Cohort deleted' };
  }

  // ─── STUDENT ↔ COHORT MANAGEMENT ──────────────────────────────────────────

  async addStudentToCohort(orgId: string, cohortId: string, studentId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        sections: { select: { id: true, academicCycleId: true } },
        academicCycle: { select: { id: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (student.cohortId === cohortId) {
      throw new ConflictException('Student is already in this cohort');
    }

    await this.prisma.$transaction(async (tx) => {
      // If student was in another cohort, close that membership
      if (student.cohortId) {
        await this.removeCohortEnrollments(tx, studentId, student.cohortId);
        await tx.cohortMembershipHistory.updateMany({
          where: { studentId, cohortId: student.cohortId, leftAt: null },
          data: { leftAt: new Date() },
        });
      }

      // Update student's cohort
      await tx.student.update({
        where: { id: studentId },
        data: { cohortId },
      });

      // Create membership history
      await tx.cohortMembershipHistory.create({
        data: {
          studentId,
          cohortId,
          academicCycleId: cohort.academicCycleId,
        },
      });

      // Auto-enroll into all cohort sections
      for (const section of cohort.sections) {
        await this.autoEnrollStudent(tx, studentId, section.id, section.academicCycleId || cohort.academicCycleId);
      }
    });

    return { message: 'Student added to cohort' };
  }

  async addStudentsToCohortBulk(orgId: string, cohortId: string, studentIds: string[]) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        sections: { select: { id: true, academicCycleId: true } },
        academicCycle: { select: { id: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, organizationId: orgId },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestException('Some students not found in this organization');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const student of students) {
        // Close old membership if exists
        if (student.cohortId && student.cohortId !== cohortId) {
          await this.removeCohortEnrollments(tx, student.id, student.cohortId);
          await tx.cohortMembershipHistory.updateMany({
            where: { studentId: student.id, cohortId: student.cohortId, leftAt: null },
            data: { leftAt: new Date() },
          });
        }

        // Skip if already in this cohort
        if (student.cohortId === cohortId) continue;

        // Update student's cohort
        await tx.student.update({
          where: { id: student.id },
          data: { cohortId },
        });

        // Create membership history
        await tx.cohortMembershipHistory.create({
          data: {
            studentId: student.id,
            cohortId,
            academicCycleId: cohort.academicCycleId,
          },
        });

        // Auto-enroll into all cohort sections
        for (const section of cohort.sections) {
          await this.autoEnrollStudent(tx, student.id, section.id, section.academicCycleId || cohort.academicCycleId);
        }
      }
    });

    return { message: `${studentIds.length} students added to cohort` };
  }

  async removeStudentFromCohort(orgId: string, cohortId: string, studentId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId, cohortId },
    });
    if (!student) throw new NotFoundException('Student not found in this cohort');

    await this.prisma.$transaction(async (tx) => {
      // Remove ONLY cohort-based, non-excluded enrollments
      const cohortEnrollments = await tx.enrollment.findMany({
        where: {
          studentId,
          source: EnrollmentSource.COHORT,
          isExcludedFromCohort: false,
          section: { cohortId },
        },
      });

      for (const enrollment of cohortEnrollments) {
        // Update enrollment history
        await tx.enrollmentHistory.updateMany({
          where: {
            studentId,
            sectionId: enrollment.sectionId,
            removedAt: null,
            source: EnrollmentSource.COHORT,
          },
          data: { removedAt: new Date() },
        });

        // Delete the enrollment
        await tx.enrollment.delete({ where: { id: enrollment.id } });
      }

      // Clear cohort from student
      await tx.student.update({
        where: { id: studentId },
        data: { cohortId: null },
      });

      // Close membership history
      await tx.cohortMembershipHistory.updateMany({
        where: { studentId, cohortId, leftAt: null },
        data: { leftAt: new Date() },
      });
    });

    return { message: 'Student removed from cohort' };
  }

  // ─── SECTION ↔ COHORT MANAGEMENT ──────────────────────────────────────────

  async assignSectionToCohort(orgId: string, cohortId: string, sectionId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        students: { select: { id: true } },
        academicCycle: { select: { id: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, course: { organizationId: orgId } },
    });
    if (!section) throw new NotFoundException('Section not found');

    if (section.cohortId === cohortId) {
      throw new ConflictException('Section is already assigned to this cohort');
    }

    await this.prisma.$transaction(async (tx) => {
      // Assign section to cohort
      await tx.section.update({
        where: { id: sectionId },
        data: {
          cohortId,
          academicCycleId: section.academicCycleId || cohort.academicCycleId,
        },
      });

      // Auto-enroll all cohort students into this section
      for (const student of cohort.students) {
        await this.autoEnrollStudent(
          tx,
          student.id,
          sectionId,
          section.academicCycleId || cohort.academicCycleId,
        );
      }
    });

    return { message: 'Section assigned to cohort' };
  }

  async removeSectionFromCohort(orgId: string, cohortId: string, sectionId: string) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, cohortId, course: { organizationId: orgId } },
    });
    if (!section) throw new NotFoundException('Section not found in this cohort');

    await this.prisma.$transaction(async (tx) => {
      // Remove cohort-sourced enrollments for this section
      const cohortEnrollments = await tx.enrollment.findMany({
        where: {
          sectionId,
          source: EnrollmentSource.COHORT,
          isExcludedFromCohort: false,
        },
      });

      for (const enrollment of cohortEnrollments) {
        await tx.enrollmentHistory.updateMany({
          where: {
            studentId: enrollment.studentId,
            sectionId,
            removedAt: null,
            source: EnrollmentSource.COHORT,
          },
          data: { removedAt: new Date() },
        });

        await tx.enrollment.delete({ where: { id: enrollment.id } });
      }

      // Remove cohort association from section
      await tx.section.update({
        where: { id: sectionId },
        data: { cohortId: null },
      });
    });

    return { message: 'Section removed from cohort' };
  }

  // ─── EXCLUSION SYSTEM ─────────────────────────────────────────────────────

  async excludeStudentFromSection(orgId: string, studentId: string, sectionId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        sectionId,
        source: EnrollmentSource.COHORT,
        section: { course: { organizationId: orgId } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Cohort-based enrollment not found for this student/section');
    }

    if (enrollment.isExcludedFromCohort) {
      throw new ConflictException('Student is already excluded from this section');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { isExcludedFromCohort: true },
      });

      // Update enrollment history
      await tx.enrollmentHistory.updateMany({
        where: {
          studentId,
          sectionId,
          removedAt: null,
          source: EnrollmentSource.COHORT,
        },
        data: { wasExcluded: true },
      });
    });

    return { message: 'Student excluded from cohort section' };
  }

  async includeStudentInSection(orgId: string, studentId: string, sectionId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        sectionId,
        source: EnrollmentSource.COHORT,
        isExcludedFromCohort: true,
        section: { course: { organizationId: orgId } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Excluded cohort enrollment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { isExcludedFromCohort: false },
      });

      // Create new history entry for re-inclusion
      await tx.enrollmentHistory.create({
        data: {
          studentId,
          sectionId,
          academicCycleId: enrollment.academicCycleId,
          source: EnrollmentSource.COHORT,
          wasExcluded: false,
        },
      });
    });

    return { message: 'Student re-included in cohort section' };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  /**
   * Auto-enroll a student into a section if not already enrolled.
   * Creates enrollment with source=COHORT and corresponding history entry.
   */
  private async autoEnrollStudent(
    tx: Prisma.TransactionClient,
    studentId: string,
    sectionId: string,
    academicCycleId: string,
  ) {
    // Check if enrollment already exists
    const existing = await tx.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId } },
    });

    if (existing) return; // Don't duplicate

    await tx.enrollment.create({
      data: {
        studentId,
        sectionId,
        academicCycleId,
        source: EnrollmentSource.COHORT,
      },
    });

    await tx.enrollmentHistory.create({
      data: {
        studentId,
        sectionId,
        academicCycleId,
        source: EnrollmentSource.COHORT,
      },
    });
  }

  private async removeCohortEnrollments(
    tx: Prisma.TransactionClient,
    studentId: string,
    cohortId: string,
  ) {
    const cohortEnrollments = await tx.enrollment.findMany({
      where: {
        studentId,
        source: EnrollmentSource.COHORT,
        isExcludedFromCohort: false,
        section: { cohortId },
      },
      select: { id: true, sectionId: true },
    });

    if (cohortEnrollments.length === 0) return;

    await tx.enrollmentHistory.updateMany({
      where: {
        studentId,
        sectionId: { in: cohortEnrollments.map(enrollment => enrollment.sectionId) },
        source: EnrollmentSource.COHORT,
        removedAt: null,
      },
      data: { removedAt: new Date() },
    });

    await tx.enrollment.deleteMany({
      where: { id: { in: cohortEnrollments.map(enrollment => enrollment.id) } },
    });
  }

  private async removeCohortSectionEnrollments(
    tx: Prisma.TransactionClient,
    sectionIds: string[],
  ) {
    if (sectionIds.length === 0) return;

    const cohortEnrollments = await tx.enrollment.findMany({
      where: {
        sectionId: { in: sectionIds },
        source: EnrollmentSource.COHORT,
        isExcludedFromCohort: false,
      },
      select: { id: true, studentId: true, sectionId: true },
    });

    if (cohortEnrollments.length === 0) return;

    for (const enrollment of cohortEnrollments) {
      await tx.enrollmentHistory.updateMany({
        where: {
          studentId: enrollment.studentId,
          sectionId: enrollment.sectionId,
          source: EnrollmentSource.COHORT,
          removedAt: null,
        },
        data: { removedAt: new Date() },
      });
    }

    await tx.enrollment.deleteMany({
      where: { id: { in: cohortEnrollments.map(enrollment => enrollment.id) } },
    });
  }
}
