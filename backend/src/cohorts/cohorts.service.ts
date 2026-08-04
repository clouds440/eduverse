import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
  fuzzyFilterAndRank,
} from '../common/utils';
import { AcademicCycleStatus, CohortLifecycleStatus, EnrollmentSource, Prisma, ProgramClassificationStatus } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import { normalizeEntityCode } from '../common/entity-code';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { StudentProgramEnrollmentsService } from '../student-program-enrollments/student-program-enrollments.service';

@Injectable()
export class CohortsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentPrograms: StudentProgramEnrollmentsService,
  ) {}

  private async validateProgramPlacement(
    client: PrismaService | Prisma.TransactionClient,
    orgId: string,
    academicCycleId: string,
    classification: ProgramClassificationStatus,
    programAcademicCycleId?: string | null,
    programStageId?: string | null,
  ) {
    if (classification === ProgramClassificationStatus.STANDALONE) {
      if (programAcademicCycleId || programStageId) {
        throw new BadRequestException('Standalone cohorts cannot include program mapping fields');
      }
      return null;
    }
    if (!programAcademicCycleId || !programStageId) {
      throw new BadRequestException('Program-mapped cohorts require both a program association and stage');
    }
    const mapping = await client.programStage.findFirst({
      where: {
        id: programStageId,
        organizationId: orgId,
        programAcademicCycleId,
        programAcademicCycle: {
          academicCycleId,
          organizationId: orgId,
          status: 'ACTIVE',
          program: { status: { in: ['ACTIVE', 'TEACH_OUT'] } },
        },
        curriculumVersion: { status: 'ACTIVE' },
      },
      include: {
        curriculumVersion: { include: { programConfigurationRevision: true } },
        programAcademicCycle: { include: { program: true } },
      },
    });
    if (!mapping) throw new BadRequestException('Program stage mapping does not match this academic cycle');
    if (mapping.curriculumVersion.programConfigurationRevision.version !== mapping.programAcademicCycle.program.configurationVersion) {
      throw new ConflictException('Program stage is not part of the current active configuration');
    }
    return mapping;
  }

  private async assertCodeUnique(orgId: string, codeValue: string, excludeId?: string) {
    const code = normalizeEntityCode(codeValue);
    if (!code) throw new BadRequestException('Cohort code is required');

    const duplicate = await this.prisma.cohort.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        code: { equals: code, mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Cohort code already exists in this organization');
    }
  }

  private async assertCanOverrideEnrollment(
    orgId: string,
    sectionId: string,
    user?: { id: string; role: string },
  ) {
    if (!user || user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) return;

    if (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER) {
      throw new ForbiddenException('You cannot change cohort enrollment overrides');
    }

    const assignedSection = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        course: { organizationId: orgId },
        teachers: { some: { userId: user.id } },
      },
      select: { id: true },
    });

    if (!assignedSection) {
      throw new ForbiddenException(
        'You can only change cohort enrollment overrides for your assigned sections',
      );
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async createCohort(orgId: string, dto: CreateCohortDto) {
    const code = normalizeEntityCode(dto.code);
    await this.assertCodeUnique(orgId, dto.code);

    // Validate cycle belongs to org
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.academicCycleId, organizationId: orgId },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found in this organization');
    await assertAcademicCycleWritable(this.prisma, orgId, dto.academicCycleId, dto.studentIds?.length ? 'DELIVERY' : 'SETUP');

    await this.validateProgramPlacement(
      this.prisma,
      orgId,
      dto.academicCycleId,
      dto.programClassificationStatus as ProgramClassificationStatus,
      dto.programAcademicCycleId,
      dto.programStageId,
    );
    if (dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED && dto.studentIds?.length) {
      throw new ConflictException('Students must enter a program-mapped cohort through the program progression workflow');
    }

    return this.prisma.$transaction(async (tx) => {
      const cohort = await tx.cohort.create({
        data: {
          name: dto.name.trim(),
          code: code!,
          organizationId: orgId,
          academicCycleId: dto.academicCycleId,
          status: (dto.status as CohortLifecycleStatus | undefined) ?? CohortLifecycleStatus.ACTIVE,
          programClassificationStatus: dto.programClassificationStatus as ProgramClassificationStatus,
          programAcademicCycleId: dto.programAcademicCycleId ?? null,
          programStageId: dto.programStageId ?? null,
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
          academicCycle: { select: { id: true, name: true, code: true } },
          programAcademicCycle: { include: { program: { include: { department: true } } } },
          programStage: true,
          _count: { select: { students: true, sections: true } },
        },
      });
    });
  }

  async getCohorts(orgId: string, options: PaginationOptions & { academicCycleId?: string; includeAllCycles?: boolean; programId?: string; programClassificationStatus?: string }) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
    });

    const baseWhere: Prisma.CohortWhereInput = {
      organizationId: orgId,
      ...(options.academicCycleId
        ? { academicCycleId: options.academicCycleId }
        : options.includeAllCycles
          ? {}
          : { academicCycle: { status: AcademicCycleStatus.ACTIVE } }),
      ...(options.programClassificationStatus ? { programClassificationStatus: options.programClassificationStatus as ProgramClassificationStatus } : {}),
      ...(options.programId ? { programAcademicCycle: { programId: options.programId } } : {}),
    };
    const searchWhere: Prisma.CohortWhereInput = options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const where: Prisma.CohortWhereInput = { ...baseWhere, ...searchWhere };

    const include = {
      academicCycle: { select: { id: true, name: true, code: true, status: true } },
      programAcademicCycle: { include: { program: { include: { department: true } } } },
      programStage: true,
      _count: { select: { students: true, sections: true } },
    } satisfies Prisma.CohortInclude;

    const [cohorts, totalRecords] = await Promise.all([
      this.prisma.cohort.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include,
      }),
      this.prisma.cohort.count({ where }),
    ]);

    if (options.search && totalRecords === 0) {
      const candidates = await this.prisma.cohort.findMany({
        where: baseWhere,
        take: 500,
        orderBy: { [sortBy]: sortOrder },
        include,
      });
      const ranked = fuzzyFilterAndRank(candidates, options.search, (cohort) => [
        cohort.name,
        cohort.code,
        cohort.academicCycle?.name,
        cohort.academicCycle?.code,
      ]);

      return formatPaginatedResponse(
        ranked.slice(skip, skip + take),
        ranked.length,
        options.page,
        options.limit,
      );
    }

    return formatPaginatedResponse(cohorts, totalRecords, options.page, options.limit);
  }

  async getCohort(orgId: string, id: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      include: {
        academicCycle: { select: { id: true, name: true, code: true, status: true } },
        programAcademicCycle: { include: { program: { include: { department: true } } } },
        programStage: true,
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

  async updateCohort(orgId: string, id: string, dto: UpdateCohortDto, actorId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      include: {
        students: { select: { id: true } },
        sections: { select: { id: true, academicCycleId: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');

    if (dto.code !== undefined) {
      await this.assertCodeUnique(orgId, dto.code, id);
    }

    const nextAcademicCycleId = dto.academicCycleId ?? cohort.academicCycleId;
    const nextClassification = (dto.programClassificationStatus ?? cohort.programClassificationStatus) as ProgramClassificationStatus;
    const nextProgramAcademicCycleId = nextClassification === ProgramClassificationStatus.PROGRAM_MAPPED
      ? (dto.programAcademicCycleId ?? cohort.programAcademicCycleId)
      : null;
    const nextProgramStageId = nextClassification === ProgramClassificationStatus.PROGRAM_MAPPED
      ? (dto.programStageId ?? cohort.programStageId)
      : null;
    await assertAcademicCycleWritable(
      this.prisma,
      orgId,
      nextAcademicCycleId,
      dto.studentIds !== undefined || dto.sectionIds !== undefined ? 'DELIVERY' : 'SETUP',
    );

    if (dto.academicCycleId !== undefined) {
      const cycle = await this.prisma.academicCycle.findFirst({
        where: { id: dto.academicCycleId, organizationId: orgId },
        select: { id: true },
      });
      if (!cycle) throw new NotFoundException('Academic cycle not found in this organization');
    }

    await this.validateProgramPlacement(
      this.prisma,
      orgId,
      nextAcademicCycleId,
      nextClassification,
      nextProgramAcademicCycleId,
      nextProgramStageId,
    );
    const placementChanged = nextClassification !== cohort.programClassificationStatus
      || nextProgramAcademicCycleId !== cohort.programAcademicCycleId
      || nextProgramStageId !== cohort.programStageId
      || nextAcademicCycleId !== cohort.academicCycleId;
    if (placementChanged && cohort.students.length > 0) {
      throw new ConflictException('Move enrolled students through program progression before changing cohort program placement');
    }

    const sectionIdsForValidation = dto.sectionIds ?? cohort.sections.map(section => section.id);
    const uniqueSectionIds = [...new Set(sectionIdsForValidation)];
    if (uniqueSectionIds.length > 0) {
      const sections = await this.prisma.section.findMany({
        where: {
          id: { in: uniqueSectionIds },
          course: { organizationId: orgId },
        },
        select: { id: true, academicCycleId: true, programClassificationStatus: true },
      });

      if (sections.length !== uniqueSectionIds.length) {
        throw new BadRequestException('Some sections not found in this organization');
      }

      const sectionFromOtherCycle = sections.find(section => section.academicCycleId !== nextAcademicCycleId);
      if (sectionFromOtherCycle) {
        throw new BadRequestException('Assigned sections must belong to the selected academic cycle');
      }
      const sectionWithWrongClassification = sections.find(section => section.programClassificationStatus !== nextClassification);
      if (sectionWithWrongClassification) {
        throw new BadRequestException('Assigned sections must use the same delivery classification as the cohort');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const previousStudentIds = new Set(cohort.students.map(student => student.id));
      const previousSectionIds = new Set(cohort.sections.map(section => section.id));
      const nextStudentIds = dto.studentIds !== undefined ? new Set(dto.studentIds) : previousStudentIds;
      const nextSectionIds = dto.sectionIds !== undefined ? new Set(dto.sectionIds) : previousSectionIds;

      const removedStudentIds = [...previousStudentIds].filter(studentId => !nextStudentIds.has(studentId));
      const addedStudentIds = [...nextStudentIds].filter(studentId => !previousStudentIds.has(studentId));
      const removedSectionIds = [...previousSectionIds].filter(sectionId => !nextSectionIds.has(sectionId));
      const addedSectionIds = [...nextSectionIds].filter(sectionId => !previousSectionIds.has(sectionId));

      await tx.cohort.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          code: dto.code !== undefined ? normalizeEntityCode(dto.code)! : undefined,
          academicCycleId: dto.academicCycleId !== undefined ? dto.academicCycleId : undefined,
          status: dto.status as CohortLifecycleStatus | undefined,
          programClassificationStatus: nextClassification,
          programAcademicCycleId: nextProgramAcademicCycleId,
          programStageId: nextProgramStageId,
          sections: dto.sectionIds !== undefined ? {
            set: dto.sectionIds.map(sectionId => ({ id: sectionId })),
          } : undefined,
        },
      });

      if (dto.academicCycleId !== undefined && dto.academicCycleId !== cohort.academicCycleId) {
        await tx.cohortMembershipHistory.updateMany({
          where: { cohortId: id, leftAt: null },
          data: { academicCycleId: nextAcademicCycleId },
        });
      }

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
              academicCycleId: nextAcademicCycleId,
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
        const programContext = nextClassification === ProgramClassificationStatus.PROGRAM_MAPPED
          ? await this.studentPrograms.ensureMappedCohortPlacement(tx, orgId, student.id, {
            id,
            academicCycleId: nextAcademicCycleId,
            programAcademicCycleId: nextProgramAcademicCycleId,
            programStageId: nextProgramStageId,
          }, actorId)
          : null;
        const targetSections = addedStudentIds.includes(student.id) ? sectionsForEnrollment : addedSections;
        for (const section of targetSections) {
          await this.autoEnrollStudent(tx, student.id, section.id, section.academicCycleId || nextAcademicCycleId, programContext);
        }
      }

      return tx.cohort.findUnique({
        where: { id },
        include: {
          academicCycle: { select: { id: true, name: true, code: true } },
          programAcademicCycle: { include: { program: { include: { department: true } } } },
          programStage: true,
          _count: { select: { students: true, sections: true } },
        },
      });
    });
  }

  async deleteCohort(orgId: string, id: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, status: true, academicCycleId: true },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    await assertAcademicCycleWritable(this.prisma, orgId, cohort.academicCycleId, 'CLOSEOUT');

    if (cohort.status !== CohortLifecycleStatus.ACTIVE) {
      return { message: 'Cohort is already closed' };
    }

    await this.prisma.cohort.update({ where: { id }, data: { status: CohortLifecycleStatus.CLOSED } });
    return { message: 'Cohort closed' };
  }

  // ─── STUDENT ↔ COHORT MANAGEMENT ──────────────────────────────────────────

  async addStudentToCohort(orgId: string, cohortId: string, studentId: string, actorId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        sections: { select: { id: true, academicCycleId: true } },
        academicCycle: { select: { id: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (cohort.status !== CohortLifecycleStatus.ACTIVE) throw new ConflictException('Cannot add students to a closed cohort');
    await assertAcademicCycleWritable(this.prisma, orgId, cohort.academicCycleId, 'DELIVERY');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId: orgId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (student.cohortId === cohortId) {
      throw new ConflictException('Student is already in this cohort');
    }

    await this.prisma.$transaction(async (tx) => {
      const programContext = cohort.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED
        ? await this.studentPrograms.ensureMappedCohortPlacement(tx, orgId, studentId, cohort, actorId)
        : null;
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
        await this.autoEnrollStudent(tx, studentId, section.id, section.academicCycleId || cohort.academicCycleId, programContext);
      }
    });

    return { message: 'Student added to cohort' };
  }

  async addStudentsToCohortBulk(orgId: string, cohortId: string, studentIds: string[], actorId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        sections: { select: { id: true, academicCycleId: true } },
        academicCycle: { select: { id: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (cohort.status !== CohortLifecycleStatus.ACTIVE) throw new ConflictException('Cannot add students to a closed cohort');
    await assertAcademicCycleWritable(this.prisma, orgId, cohort.academicCycleId, 'DELIVERY');

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, organizationId: orgId },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestException('Some students not found in this organization');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const student of students) {
        const programContext = cohort.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED
          ? await this.studentPrograms.ensureMappedCohortPlacement(tx, orgId, student.id, cohort, actorId)
          : null;
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
          await this.autoEnrollStudent(tx, student.id, section.id, section.academicCycleId || cohort.academicCycleId, programContext);
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
    if (cohort.status !== CohortLifecycleStatus.ACTIVE) throw new ConflictException('Cannot remove students from a closed cohort');
    await assertAcademicCycleWritable(this.prisma, orgId, cohort.academicCycleId, 'DELIVERY');

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

  async assignSectionToCohort(orgId: string, cohortId: string, sectionId: string, actorId: string) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        students: { select: { id: true } },
        academicCycle: { select: { id: true } },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (cohort.status !== CohortLifecycleStatus.ACTIVE) throw new ConflictException('Cannot assign sections to a closed cohort');
    await assertAcademicCycleWritable(this.prisma, orgId, cohort.academicCycleId, 'DELIVERY');

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, course: { organizationId: orgId } },
    });
    if (!section) throw new NotFoundException('Section not found');
    if (section.academicCycleId !== cohort.academicCycleId) {
      throw new BadRequestException('Section and cohort must belong to the same academic cycle');
    }
    if (section.programClassificationStatus !== cohort.programClassificationStatus) {
      throw new BadRequestException('Section and cohort delivery classifications must match');
    }

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
        const programContext = cohort.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED
          ? await this.studentPrograms.ensureMappedCohortPlacement(tx, orgId, student.id, cohort, actorId)
          : null;
        await this.autoEnrollStudent(
          tx,
          student.id,
          sectionId,
          section.academicCycleId || cohort.academicCycleId,
          programContext,
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
    await assertAcademicCycleWritable(this.prisma, orgId, section.academicCycleId, 'DELIVERY');

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

  async excludeStudentFromSection(
    orgId: string,
    studentId: string,
    sectionId: string,
    user?: { id: string; role: string },
  ) {
    await this.assertCanOverrideEnrollment(orgId, sectionId, user);

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
    await assertAcademicCycleWritable(this.prisma, orgId, enrollment.academicCycleId, 'DELIVERY');

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

  async includeStudentInSection(
    orgId: string,
    studentId: string,
    sectionId: string,
    user?: { id: string; role: string },
  ) {
    await this.assertCanOverrideEnrollment(orgId, sectionId, user);

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
    await assertAcademicCycleWritable(this.prisma, orgId, enrollment.academicCycleId, 'DELIVERY');

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
    programContext?: {
      enrollment: { id: string };
      attempt: { id: string };
    } | null,
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
        studentProgramEnrollmentId: programContext?.enrollment.id,
        studentStageAttemptId: programContext?.attempt.id,
      },
    });

    await tx.enrollmentHistory.create({
      data: {
        studentId,
        sectionId,
        academicCycleId,
        source: EnrollmentSource.COHORT,
        studentProgramEnrollmentId: programContext?.enrollment.id,
        studentStageAttemptId: programContext?.attempt.id,
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
