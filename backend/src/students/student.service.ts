import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { EnrollmentSource, GradeStatus, Prisma } from '@/prisma/prisma-client';
import { Role, StudentStatus, UserStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserService } from '../users/user.service';
import { CreateStudentDto } from '../org/dto/create-student.dto';
import { UpdateStudentDto } from '../org/dto/update-student.dto';
import * as bcrypt from 'bcrypt';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  extractUpdateFields,
  BCRYPT_ROUNDS,
  PaginationOptions,
  extractTimetableEntries,
} from '../common/utils';
import {
  assertDepartmentIdsBelongToOrg,
  assertDepartmentInScope,
  getDepartmentScope,
  studentDepartmentScopeWhere,
  type DepartmentScopedUser,
} from '../common/department-scope';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: Role | string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly userService: UserService,
  ) {}

  private async getStudentById(orgId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organizationId: orgId,
        status: { not: StudentStatus.DELETED },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private async getStudentByRegistrationNumber(orgId: string, registrationNumber: string) {
    return this.prisma.student.findFirst({
      where: {
        organizationId: orgId,
        registrationNumber,
      },
    });
  }

  private async getStudentByRollNumber(orgId: string, rollNumber: string) {
    return this.prisma.student.findFirst({
      where: {
        organizationId: orgId,
        rollNumber,
      },
    });
  }

  private normalizeSectionIds(sectionIds?: string[]) {
    return Array.from(new Set(sectionIds || [])).filter(Boolean);
  }

  private async validateGuardianAssignment(
    tx: Prisma.TransactionClient,
    orgId: string,
    guardianId?: string | null,
    guardianRelationship?: string | null,
  ) {
    if (!guardianId) {
      return null;
    }

    const relationship = guardianRelationship?.trim();
    if (!relationship) {
      throw new BadRequestException(
        'Guardian relationship is required when assigning a guardian',
      );
    }

    const guardian = await tx.guardianProfile.findFirst({
      where: { id: guardianId, organizationId: orgId },
      select: { id: true },
    });

    if (!guardian) {
      throw new BadRequestException(
        'Guardian must belong to the same organization',
      );
    }

    return { guardianId: guardian.id, relationshipLabel: relationship };
  }

  private async setStudentGuardianLink(
    tx: Prisma.TransactionClient,
    orgId: string,
    studentId: string,
    guardianId?: string | null,
    guardianRelationship?: string | null,
  ) {
    if (!guardianId) {
      await tx.guardianStudent.deleteMany({ where: { studentId } });
      return;
    }

    const assignment = await this.validateGuardianAssignment(
      tx,
      orgId,
      guardianId,
      guardianRelationship,
    );
    if (!assignment) return;

    await tx.guardianStudent.upsert({
      where: { studentId },
      create: {
        studentId,
        guardianId: assignment.guardianId,
        organizationId: orgId,
        relationshipLabel: assignment.relationshipLabel,
      },
      update: {
        guardianId: assignment.guardianId,
        organizationId: orgId,
        relationshipLabel: assignment.relationshipLabel,
      },
    });
  }

  private normalizeStudentGuardian<T extends { guardianLinks?: Array<{ guardianId: string; relationshipLabel: string; guardian: unknown }> } | null>(student: T) {
    if (!student) return student;
    const guardianLink = student.guardianLinks?.[0] || null;
    const { guardianLinks, ...rest } = student as T & { guardianLinks?: unknown };
    return {
      ...rest,
      guardianLinks,
      guardianId: guardianLink?.guardianId || null,
      guardianRelationship: guardianLink?.relationshipLabel || null,
      guardian: guardianLink?.guardian || null,
    };
  }

  private studentGuardianInclude() {
    return {
      guardianLinks: {
        include: {
          guardian: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
        take: 1,
        orderBy: { updatedAt: 'desc' as const },
      },
    };
  }

  private async getCohortForEnrollment(
    tx: Prisma.TransactionClient,
    orgId: string,
    cohortId: string,
  ) {
    const cohort = await tx.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: { sections: { select: { id: true, academicCycleId: true } } },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    return cohort;
  }

  private async createManualEnrollments(
    tx: Prisma.TransactionClient,
    studentId: string,
    sectionIds: string[],
  ) {
    const uniqueSectionIds = this.normalizeSectionIds(sectionIds);
    if (uniqueSectionIds.length === 0) return;

    const sections = await tx.section.findMany({
      where: { id: { in: uniqueSectionIds } },
      select: { id: true, academicCycleId: true },
    });
    const sectionCycleMap = new Map(sections.map((section) => [section.id, section.academicCycleId]));

    for (const sectionId of uniqueSectionIds) {
      const existing = await tx.enrollment.findUnique({
        where: { studentId_sectionId: { studentId, sectionId } },
      });

      if (existing) {
        if (existing.source !== EnrollmentSource.MANUAL) {
          await tx.enrollment.update({
            where: { id: existing.id },
            data: {
              source: EnrollmentSource.MANUAL,
              isExcludedFromCohort: false,
              academicCycleId: existing.academicCycleId || sectionCycleMap.get(sectionId) || undefined,
            },
          });
          await tx.enrollmentHistory.create({
            data: {
              studentId,
              sectionId,
              academicCycleId: existing.academicCycleId || sectionCycleMap.get(sectionId) || undefined,
              source: EnrollmentSource.MANUAL,
            },
          });
        }
        continue;
      }

      await tx.enrollment.create({
        data: {
          studentId,
          sectionId,
          academicCycleId: sectionCycleMap.get(sectionId) || undefined,
          source: EnrollmentSource.MANUAL,
        },
      });

      await tx.enrollmentHistory.create({
        data: {
          studentId,
          sectionId,
          academicCycleId: sectionCycleMap.get(sectionId) || undefined,
          source: EnrollmentSource.MANUAL,
        },
      });
    }
  }

  private async autoEnrollCohortSections(
    tx: Prisma.TransactionClient,
    studentId: string,
    sections: { id: string; academicCycleId: string }[],
    fallbackAcademicCycleId: string,
  ) {
    for (const section of sections) {
      const existing = await tx.enrollment.findUnique({
        where: { studentId_sectionId: { studentId, sectionId: section.id } },
      });

      // Existing manual enrollment wins. Removing the cohort later must not
      // remove an individually selected section.
      if (existing) continue;

      await tx.enrollment.create({
        data: {
          studentId,
          sectionId: section.id,
          academicCycleId: section.academicCycleId || fallbackAcademicCycleId,
          source: EnrollmentSource.COHORT,
        },
      });

      await tx.enrollmentHistory.create({
        data: {
          studentId,
          sectionId: section.id,
          academicCycleId: section.academicCycleId || fallbackAcademicCycleId,
          source: EnrollmentSource.COHORT,
        },
      });
    }
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

    const sectionIds = cohortEnrollments.map((enrollment) => enrollment.sectionId);
    await tx.enrollmentHistory.updateMany({
      where: {
        studentId,
        sectionId: { in: sectionIds },
        source: EnrollmentSource.COHORT,
        removedAt: null,
      },
      data: { removedAt: new Date() },
    });

    await tx.enrollment.deleteMany({
      where: { id: { in: cohortEnrollments.map((enrollment) => enrollment.id) } },
    });
  }

  private async moveStudentToCohort(
    tx: Prisma.TransactionClient,
    orgId: string,
    studentId: string,
    fromCohortId: string | null,
    toCohortId: string | null,
  ) {
    if (fromCohortId === toCohortId) return;

    if (fromCohortId) {
      await this.removeCohortEnrollments(tx, studentId, fromCohortId);
      await tx.cohortMembershipHistory.updateMany({
        where: { studentId, cohortId: fromCohortId, leftAt: null },
        data: { leftAt: new Date() },
      });
    }

    if (!toCohortId) return;

    const cohort = await this.getCohortForEnrollment(tx, orgId, toCohortId);
    await tx.cohortMembershipHistory.create({
      data: {
        studentId,
        cohortId: toCohortId,
        academicCycleId: cohort.academicCycleId,
      },
    });
    await this.autoEnrollCohortSections(tx, studentId, cohort.sections, cohort.academicCycleId);
  }

  async assertStudentsBelongToSection(
    sectionId: string,
    studentIds: string[],
  ) {
    if (studentIds.length === 0) return;

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        sectionId,
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    });

    const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
    const invalidStudentId = studentIds.find((studentId) => !enrolledIds.has(studentId));
    if (invalidStudentId) {
      throw new BadRequestException(
        'Attendance can only be marked for students enrolled in this section.',
      );
    }
  }

  async getStudents(
    orgId: string,
    options: PaginationOptions,
    requester?: DepartmentScopedUser,
  ) {
    const { skip, take, sortBy, sortOrder, status, deleted } = getPaginationOptions(options);
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    const scopeWhere = studentDepartmentScopeWhere(departmentScope);
    const andFilters: Prisma.StudentWhereInput[] = [
      ...(Object.keys(scopeWhere).length ? [scopeWhere] : []),
      ...(options.departmentId
        ? [{
            OR: [
              { primaryDepartmentId: options.departmentId },
              { studentDepartments: { some: { departmentId: options.departmentId } } },
            ],
          }]
        : []),
    ];

    const where: Prisma.StudentWhereInput = {
      organizationId: orgId,
      ...(andFilters.length ? { AND: andFilters } : {}),
      status: deleted
        ? StudentStatus.DELETED
        : status
          ? { in: status.split(',') as StudentStatus[] }
          : { not: StudentStatus.DELETED },
      ...(options.sectionId
        ? {
            enrollments: {
              some: { sectionId: options.sectionId },
            },
          }
        : {}),
      ...(options.cohortId ? { cohortId: options.cohortId } : {}),
      ...(options.my && options.userId
        ? {
            enrollments: {
              some: {
                section: {
                  teachers: {
                    some: { userId: options.userId },
                  },
                },
              },
            },
          }
        : {}),
      ...(options.search
        ? {
            OR: [
              {
                user: {
                  name: { contains: options.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  email: { contains: options.search, mode: 'insensitive' },
                },
              },
              {
                registrationNumber: {
                  contains: options.search,
                  mode: 'insensitive',
                },
              },
              { rollNumber: { contains: options.search, mode: 'insensitive' } },
              { major: { contains: options.search, mode: 'insensitive' } },
              { department: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Handle nested sorting for user fields
    let orderBy: Prisma.StudentOrderByWithRelationInput = {};
    const userFields = ['name', 'email', 'phone'];

    if (sortBy.startsWith('user.')) {
      const field = sortBy.split('.')[1];
      orderBy = { user: { [field]: sortOrder } };
    } else if (userFields.includes(sortBy)) {
      orderBy = { user: { [sortBy]: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [students, totalRecords] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              avatarUrl: true,
              avatarUpdatedAt: true,
            },
          },
          cohort: true,
          primaryDepartment: true,
          studentDepartments: { include: { department: true } },
          ...this.studentGuardianInclude(),
          enrollments: {
            include: {
              section: {
                include: { course: true },
              },
            },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return formatPaginatedResponse(
      students.map((student) => this.normalizeStudentGuardian(student)),
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getStudent(orgId: string, id: string, userContext?: { id: string, role: string }) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        organizationId: orgId,
        status: { not: StudentStatus.DELETED },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatarUrl: true,
            avatarUpdatedAt: true,
          },
        },
        primaryDepartment: true,
        studentDepartments: { include: { department: true } },
        enrollments: {
          include: {
            section: {
              include: {
                course: true,
                teachers: { include: { user: true } },
              },
            },
          },
        },
        ...this.studentGuardianInclude(),
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    
    if (userContext?.role === Role.STUDENT && student.userId !== userContext.id) {
        throw new ForbiddenException('You do not have permission to view this student profile');
    }
    return this.normalizeStudentGuardian(student);
  }

  async createStudent(
    orgId: string,
    data: CreateStudentDto,
    userContext: { id?: string; role?: string; name?: string | null; email: string },
  ) {
    const existingRegNum = await this.getStudentByRegistrationNumber(orgId, data.registrationNumber);

    if (existingRegNum) {
      throw new ConflictException(
        `Registration number "${data.registrationNumber}" is already assigned to another student in this organization`,
      );
    }

    const existingRollNum = await this.getStudentByRollNumber(orgId, data.rollNumber);

    if (existingRollNum) {
      throw new ConflictException(
        `Roll number "${data.rollNumber}" is already assigned to another student in this organization`,
      );
    }

    try {
      return await this.prisma.$transaction(async (prisma) => {
        const departmentIds = await assertDepartmentIdsBelongToOrg(
          prisma,
          orgId,
          [
            ...(data.primaryDepartmentId ? [data.primaryDepartmentId] : []),
            ...(data.departmentIds || []),
          ],
        );
        const departmentScope = await getDepartmentScope(this.prisma, orgId, userContext.id && userContext.role ? { id: userContext.id, role: userContext.role } : undefined);
        assertDepartmentInScope(departmentScope, data.primaryDepartmentId, 'You cannot create a student outside your department scope');
        departmentIds.forEach((departmentId) =>
          assertDepartmentInScope(departmentScope, departmentId, 'You cannot assign a student outside your department scope'),
        );

        const user = await this.userService.createUser({
          email: data.email,
          password: data.password,
          role: Role.STUDENT,
          organizationId: orgId,
          name: data.name,
          phone: data.phone,
          status: data.status as unknown as UserStatus,
        }, prisma);

        const student = await prisma.student.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            registrationNumber: data.registrationNumber,
            rollNumber: data.rollNumber,
            fatherName: data.fatherName,
            age: data.age,
            address: data.address,
            major: data.major,
            department: data.department,
            primaryDepartmentId: data.primaryDepartmentId || null,
            admissionDate: data.admissionDate
              ? new Date(data.admissionDate)
              : undefined,
            graduationDate: data.graduationDate
              ? new Date(data.graduationDate)
              : undefined,
            emergencyContact: data.emergencyContact,
            bloodGroup: data.bloodGroup,
            gender: data.gender,
            status: data.status as unknown as StudentStatus,
            cohortId: data.cohortId || null,
            updatedBy: userContext.name || userContext.email,
            studentDepartments: data.departmentIds?.length
              ? {
                  createMany: {
                    data: Array.from(new Set(data.departmentIds.filter(Boolean))).map((departmentId) => ({
                      organizationId: orgId,
                      departmentId,
                    })),
                  },
                }
              : undefined,
          },
          include: {
            user: { select: { email: true, name: true, phone: true } },
            primaryDepartment: true,
            studentDepartments: { include: { department: true } },
            ...this.studentGuardianInclude(),
            enrollments: { include: { section: true } },
          },
        });

        if (data.guardianId) {
          await this.setStudentGuardianLink(
            prisma,
            orgId,
            student.id,
            data.guardianId,
            data.guardianRelationship,
          );
        }

        await this.createManualEnrollments(prisma, student.id, data.sectionIds || []);

        if (data.cohortId) {
          await this.moveStudentToCohort(prisma, orgId, student.id, null, data.cohortId);
        }

        const createdStudent = await prisma.student.findUnique({
          where: { id: student.id },
          include: {
            user: { select: { email: true, name: true, phone: true } },
            cohort: { select: { id: true, name: true } },
            primaryDepartment: true,
            studentDepartments: { include: { department: true } },
            ...this.studentGuardianInclude(),
            enrollments: { include: { section: true } },
          },
        });
        return this.normalizeStudentGuardian(createdStudent);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('registrationNumber'))
            throw new ConflictException('Registration number already in use');
          if (target.includes('rollNumber'))
            throw new ConflictException('Roll number already in use');
        }
      }
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      console.error('[CreateStudent Error]:', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the student record',
      );
    }
  }

  async updateStudent(
    orgId: string,
    id: string,
    data: UpdateStudentDto,
    userContext: { id?: string; role: Role; name?: string | null; email: string },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id, organizationId: orgId },
      include: { user: true },
    });

    if (!student) throw new NotFoundException('Student not found');

    const userFields = ['name', 'email', 'phone', 'password'];
    const studentFields = [
      'registrationNumber',
      'rollNumber',
      'fatherName',
      'age',
      'address',
      'major',
      'department',
      'primaryDepartmentId',
      'admissionDate',
      'graduationDate',
      'emergencyContact',
      'bloodGroup',
      'gender',
      'status',
      'cohortId',
    ];

    const { userData, entityData: studentData } = await extractUpdateFields(
      data as unknown as Record<string, unknown>,
      userFields,
      studentFields,
      student.user.email,
    );

    if (data.status !== undefined) {
      userData.status = data.status as unknown as UserStatus;
    }

    // --- Role-based Field Locking ---
    const isOrgAdmin = userContext.role === Role.ORG_ADMIN;
    if (!isOrgAdmin) {
      delete studentData.registrationNumber;
      delete studentData.rollNumber;
    }

    if (
      studentData.registrationNumber &&
      studentData.registrationNumber !== student.registrationNumber
    ) {
      const existing = await this.getStudentByRegistrationNumber(orgId, studentData.registrationNumber as string);
      if (existing && existing.id !== id)
        throw new BadRequestException('Registration number already in use');
    }

    if (
      studentData.rollNumber &&
      studentData.rollNumber !== student.rollNumber
    ) {
      const existing = await this.getStudentByRollNumber(orgId, studentData.rollNumber as string);
      if (existing && existing.id !== id) throw new BadRequestException('Roll number already in use');
    }

    if (data.admissionDate) {
      const date = new Date(data.admissionDate);
      if (!isNaN(date.getTime())) {
        studentData.admissionDate = date;
      }
    }

    if (data.graduationDate !== undefined) {
      if (data.graduationDate) {
        const date = new Date(data.graduationDate);
        if (!isNaN(date.getTime())) {
          studentData.graduationDate = date;
        }
      } else {
        studentData.graduationDate = null;
      }
    }

    const nextCohortId = data.cohortId === ''
      ? null
      : data.cohortId !== undefined
        ? data.cohortId
        : undefined;

    if (data.cohortId === '') {
      studentData.cohortId = null;
    }

    const departmentScope = await getDepartmentScope(
      this.prisma,
      orgId,
      userContext.id ? { id: userContext.id, role: userContext.role } : undefined,
    );
    assertDepartmentInScope(departmentScope, student.primaryDepartmentId, 'You cannot update a student outside your department scope');
    if (data.primaryDepartmentId) {
      await assertDepartmentIdsBelongToOrg(this.prisma, orgId, [data.primaryDepartmentId]);
    }
    assertDepartmentInScope(departmentScope, data.primaryDepartmentId, 'You cannot move a student outside your department scope');

    const updatedStudent = await this.prisma.$transaction(async (tx) => {
      const departmentIds = data.departmentIds !== undefined
        ? await assertDepartmentIdsBelongToOrg(tx, orgId, data.departmentIds)
        : undefined;
      departmentIds?.forEach((departmentId) =>
        assertDepartmentInScope(departmentScope, departmentId, 'You cannot assign a student outside your department scope'),
      );

      if (Object.keys(userData).length > 0) {
        await this.userService.updateUser(student.userId, userData, tx);
      }

      if (data.guardianId !== undefined) {
        await this.setStudentGuardianLink(
          tx,
          orgId,
          id,
          data.guardianId === '' ? null : data.guardianId,
          data.guardianRelationship,
        );
      }

      if (Object.keys(studentData).length > 0) {
        studentData.updatedBy = userContext.name || userContext.email;
        if (studentData.primaryDepartmentId === '') {
          studentData.primaryDepartmentId = null;
        }
        await tx.student.update({
          where: { id },
          data: studentData,
        });
      }

      if (departmentIds !== undefined) {
        await tx.studentDepartment.deleteMany({ where: { studentId: id } });
        if (departmentIds.length) {
          await tx.studentDepartment.createMany({
            data: departmentIds.map((departmentId) => ({
              organizationId: orgId,
              studentId: id,
              departmentId,
            })),
          });
        }
      }

      if (data.sectionIds !== undefined) {
        // Fetch current MANUAL enrollments
        const currentManualEnrollments = await tx.enrollment.findMany({
          where: { studentId: id, source: 'MANUAL' },
          select: { id: true, sectionId: true, academicCycleId: true },
        });

        const currentSectionIds = new Set(currentManualEnrollments.map(e => e.sectionId));
        const normalizedSectionIds = this.normalizeSectionIds(data.sectionIds);
        const newSectionIds = new Set(normalizedSectionIds);

        const sectionsToAdd = normalizedSectionIds.filter(id => !currentSectionIds.has(id));
        const sectionsToRemove = currentManualEnrollments.filter(e => !newSectionIds.has(e.sectionId));

        if (sectionsToRemove.length > 0) {
          const idsToRemove = sectionsToRemove.map(e => e.id);
          const sectionIdsToRemove = sectionsToRemove.map(e => e.sectionId);

          // Mark as removed in history
          await tx.enrollmentHistory.updateMany({
            where: {
              studentId: id,
              sectionId: { in: sectionIdsToRemove },
              source: 'MANUAL',
              removedAt: null,
            },
            data: { removedAt: new Date() },
          });

          // Delete the manual enrollments
          await tx.enrollment.deleteMany({
            where: { id: { in: idsToRemove } },
          });
        }

        if (sectionsToAdd.length > 0) {
          await this.createManualEnrollments(tx, id, sectionsToAdd);
        }
      }

      if (nextCohortId !== undefined) {
        await this.moveStudentToCohort(tx, orgId, id, student.cohortId, nextCohortId);
      }

      const effectiveCohortId = nextCohortId !== undefined ? nextCohortId : student.cohortId;
      if (data.sectionIds !== undefined && effectiveCohortId) {
        const cohort = await this.getCohortForEnrollment(tx, orgId, effectiveCohortId);
        await this.autoEnrollCohortSections(tx, id, cohort.sections, cohort.academicCycleId);
      }

      const savedStudent = await tx.student.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              avatarUrl: true,
              avatarUpdatedAt: true,
            },
          },
          cohort: { select: { id: true, name: true } },
          primaryDepartment: true,
          studentDepartments: { include: { department: true } },
          ...this.studentGuardianInclude(),
          enrollments: { include: { section: true } },
        },
      });
      return this.normalizeStudentGuardian(savedStudent);
    });

    // --- Persistent Notifications ---
    if (data.status && data.status !== student.status) {
      await this.notifications.createNotification({
        userId: student.userId,
        title: 'Account Status Updated',
        body: `Your account status has been changed to ${data.status.toLowerCase()}.`,
        type: 'USER_STATUS_CHANGE',
        actionUrl: `/students/${student.userId}/profile`,
        metadata: { oldStatus: student.status, newStatus: data.status },
      });
    }

    return updatedStudent;
  }

  async deleteStudent(orgId: string, id: string, requester?: DepartmentScopedUser) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { userId: true, organizationId: true, primaryDepartmentId: true },
    });

    if (!student || student.organizationId !== orgId) throw new NotFoundException('Student not found');
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, student.primaryDepartmentId, 'You cannot delete a student outside your department scope');

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: { status: StudentStatus.DELETED },
      });

      await tx.user.update({
        where: { id: student.userId },
        data: { status: UserStatus.DELETED },
      });
    });

    return { message: 'Student deleted successfully' };
  }

  async restoreStudent(orgId: string, id: string, status: StudentStatus = StudentStatus.ACTIVE) {
    const student = await this.prisma.student.findFirst({
      where: { id, organizationId: orgId, status: StudentStatus.DELETED },
    });

    if (!student) throw new NotFoundException('Deleted student not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: { status: status as unknown as StudentStatus },
      });

      await tx.user.update({
        where: { id: student.userId },
        data: { status: UserStatus.ACTIVE as unknown as UserStatus },
      });
    });

    return { message: 'Student restored successfully' };
  }

  async getStudentByUserId(userId: string) {
    return this.prisma.student.findUnique({ where: { userId } });
  }

  async assertGuardianCanAccessStudent(orgId: string, guardianUserId: string, studentId: string) {
    const link = await this.prisma.guardianStudent.findFirst({
      where: {
        studentId,
        organizationId: orgId,
        guardian: { userId: guardianUserId, organizationId: orgId },
      },
      select: { id: true },
    });

    if (!link) {
      throw new ForbiddenException('You can only view students linked to your guardian account.');
    }
  }

  async assertCanViewStudent(orgId: string, studentId: string, requester: JwtPayload) {
    const student = await this.getStudentById(orgId, studentId);
    if (!student) throw new NotFoundException('Student not found');

    if (requester.role === Role.STUDENT && requester.id !== student.userId) {
      throw new ForbiddenException('Students can only view their own records.');
    }

    if (requester.role === Role.GUARDIAN) {
      await this.assertGuardianCanAccessStudent(orgId, requester.id, studentId);
    }

    if (requester.role === Role.TEACHER) {
      const canAccess = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          section: {
            course: { organizationId: orgId },
            teachers: { some: { userId: requester.id } },
          },
        },
        select: { id: true },
      });

      if (!canAccess) {
        throw new ForbiddenException('You are not assigned to this section.');
      }
    }

    return student;
  }

  async calculateFinalGrade(
    studentId: string,
    sectionId?: string,
    statuses: GradeStatus[] = [GradeStatus.FINALIZED],
  ) {
    // If sectionId is provided, calculate for that section.
    // Otherwise, calculate for all sections the student is enrolled in.
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        ...(sectionId ? { sectionId } : {}),
      },
      include: {
        section: {
          include: {
            course: true,
            assessments: {
              include: {
                grades: {
                  where: {
                    studentId,
                    status: { in: statuses },
                  },
                },
              },
            },
          },
        },
      },
    });

    return enrollments.map((enrollment) => {
      const section = enrollment.section;
      let totalPercentage = 0;
      const assessmentGrades = section.assessments.flatMap((a) => {
        const grade = a.grades[0];
        if (!grade) return [];
        const percentage = grade
          ? (grade.marksObtained / a.totalMarks) * a.weightage
          : 0;
        totalPercentage += percentage;
        return [{
          assessmentId: a.id,
          title: a.title,
          type: a.type,
          weightage: a.weightage,
          marksObtained: grade.marksObtained,
          totalMarks: a.totalMarks,
          status: grade.status,
          percentage: percentage.toFixed(2),
        }];
      });

      return {
        sectionId: section.id,
        sectionName: section.name,
        sectionColor: section.color,
        courseName: section.course.name,
        finalPercentage: parseFloat(totalPercentage.toFixed(2)),
        assessments: assessmentGrades,
      };
    }).filter((result) => result.assessments.length > 0);
  }

  async getStudentFinalGrades(orgId: string, userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return [];

    const results = await this.calculateFinalGrade(student.id);
    return results;
  }

  async getStudentReleasedGrades(orgId: string, userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return [];

    return this.calculateFinalGrade(student.id, undefined, [
      GradeStatus.PUBLISHED,
      GradeStatus.FINALIZED,
    ]);
  }

  async getReleasedGradesForStudent(
    orgId: string,
    studentId: string,
    requester: JwtPayload,
    sectionId?: string,
  ) {
    await this.assertCanViewStudent(orgId, studentId, requester);

    return this.calculateFinalGrade(studentId, sectionId, [
      GradeStatus.PUBLISHED,
      GradeStatus.FINALIZED,
    ]);
  }

  async getStudentTimetable(orgId: string, userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return [];

    return this.getStudentTimetableByStudentId(orgId, student.id);
  }

  async getStudentTimetableByStudentId(
    orgId: string,
    studentId: string,
    requester?: JwtPayload,
  ) {
    if (requester) {
      await this.assertCanViewStudent(orgId, studentId, requester);
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, section: { course: { organizationId: orgId } } },
      include: {
        section: {
          include: {
            course: { select: { id: true, name: true, departmentId: true } },
            defaultRoom: { select: { name: true, building: { select: { name: true } } } },
            schedules: {
              select: {
                id: true,
                day: true,
                startTime: true,
                endTime: true,
                room: true,
                roomRef: { select: { name: true, building: { select: { name: true } } } },
              },
            },
            teachers: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    return extractTimetableEntries(enrollments.map((e) => e.section));
  }

  async getStudentAttendance(
    orgId: string,
    studentId: string,
    requester: JwtPayload,
  ) {
    const student = await this.assertCanViewStudent(orgId, studentId, requester);
    
    return this.prisma.attendanceRecord.findMany({
      where: { studentId: student.id, session: { section: { course: { organizationId: orgId } } } },
      include: {
        session: {
          include: {
            section: { select: { id: true, name: true, color: true, course: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });
  }
}
