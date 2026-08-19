import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  GradeStatus,
  OnlineAdmissionSubmissionStatus,
  Prisma,
  StudentProgramEnrollmentStatus,
} from '@/prisma/prisma-client';
import { Role, StudentStatus, UserStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserService } from '../users/user.service';
import { CreateStudentDto } from '../org/dto/create-student.dto';
import { UpdateStudentDto } from '../org/dto/update-student.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  extractUpdateFields,
  PaginationOptions,
  extractTimetableEntries,
  fuzzyFilterAndRank,
} from '../common/utils';
import {
  assertDepartmentIdsBelongToOrg,
  assertDepartmentInScope,
  getDepartmentScope,
  studentDepartmentScopeWhere,
  type DepartmentScopedUser,
} from '../common/department-scope';
import { StudentProgramEnrollmentsService } from '../student-program-enrollments/student-program-enrollments.service';
import { toPublicGradeEvidenceAttachment } from '../grade-evidence/grade-evidence.types';
import { buildStudentAcademicIdentity, buildStudentProgramOverview } from '../common/student-academic-identity';

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
    private readonly studentPrograms: StudentProgramEnrollmentsService,
  ) {}

  private currentProgramInclude() {
    return {
      programEnrollments: {
        where: {
          status: { in: [
            StudentProgramEnrollmentStatus.ADMITTED,
            StudentProgramEnrollmentStatus.ACTIVE,
            StudentProgramEnrollmentStatus.ON_HOLD,
          ] },
        },
        include: {
          program: { include: { department: true } },
          curriculumVersion: {
            include: {
              stages: {
                orderBy: { sequence: 'asc' as const },
                include: { courseRequirements: true },
              },
            },
          },
          stageEnrollments: { orderBy: { createdAt: 'asc' as const } },
        },
        take: 1,
        orderBy: { admittedAt: 'desc' as const },
      },
    };
  }

  private normalizeStudent(student: any): any {
    if (!student) return student;
    const normalized = this.normalizeStudentGuardian(student);
    const majorProgramEnrollment = student.programEnrollments?.[0] || null;
    const currentCohortMembership = student.cohortMemberships?.[0] || null;
    const academicIdentity = buildStudentAcademicIdentity({
      majorProgramEnrollment,
      currentCohortMembership,
      cohort: currentCohortMembership?.cohortOffering?.cohort,
      enrollments: student.enrollments,
    });
    return {
      ...normalized,
      majorProgramEnrollment,
      majorProgram: majorProgramEnrollment?.program || null,
      currentCohortMembership,
      cohort: currentCohortMembership?.cohortOffering?.cohort || null,
      academicIdentity,
      programOverview: buildStudentProgramOverview(majorProgramEnrollment, student.graduationDate),
    };
  }

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

    const baseWhere: Prisma.StudentWhereInput = {
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
      ...(options.cohortId
        ? { cohortMemberships: { some: { leftAt: null, cohortOffering: { cohortId: options.cohortId } } } }
        : {}),
      ...(options.programId
        ? { programEnrollments: { some: { programId: options.programId, status: { in: ['ADMITTED', 'ACTIVE', 'ON_HOLD'] } } } }
        : {}),
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
    };
    const searchWhere: Prisma.StudentWhereInput = options.search
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
            { primaryDepartment: { name: { contains: options.search, mode: 'insensitive' } } },
            { studentDepartments: { some: { department: { name: { contains: options.search, mode: 'insensitive' } } } } },
            { programEnrollments: { some: { status: { in: ['ADMITTED', 'ACTIVE', 'ON_HOLD'] }, program: { name: { contains: options.search, mode: 'insensitive' } } } } },
          ],
        }
      : {};
    const where: Prisma.StudentWhereInput = { ...baseWhere, ...searchWhere };

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

    const include = {
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
      cohortMemberships: { where: { leftAt: null }, take: 1, include: { cohortOffering: { include: { cohort: true, academicCycle: true } } } },
      primaryDepartment: true,
      studentDepartments: { include: { department: true } },
      ...this.currentProgramInclude(),
      ...this.studentGuardianInclude(),
      enrollments: {
        include: {
          section: {
            include: { course: true },
          },
        },
      },
    } satisfies Prisma.StudentInclude;

    const [students, totalRecords] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        orderBy,
        include,
      }),
      this.prisma.student.count({ where }),
    ]);

    if (options.search && totalRecords === 0) {
      const candidates = await this.prisma.student.findMany({
        where: baseWhere,
        take: 500,
        orderBy,
        include,
      });
      const ranked = fuzzyFilterAndRank(candidates, options.search, (student) => [
        student.user?.name,
        student.user?.email,
        student.user?.phone,
        student.registrationNumber,
        student.rollNumber,
        student.cohortMemberships?.[0]?.cohortOffering?.cohort?.name,
        student.cohortMemberships?.[0]?.cohortOffering?.cohort?.code,
        student.primaryDepartment?.name,
        student.primaryDepartment?.code,
        ...(student.studentDepartments || []).flatMap((link) => [
          link.department?.name,
          link.department?.code,
        ]),
        ...(student.enrollments || []).flatMap((enrollment) => [
          enrollment.section?.name,
          enrollment.section?.course?.name,
          enrollment.section?.course?.code,
        ]),
      ]);
      const pageItems = ranked.slice(skip, skip + take);

      return formatPaginatedResponse(
        pageItems.map((student) => this.normalizeStudent(student)),
        ranked.length,
        options.page,
        options.limit,
      );
    }

    return formatPaginatedResponse(
      students.map((student) => this.normalizeStudent(student)),
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
        cohortMemberships: { where: { leftAt: null }, take: 1, include: { cohortOffering: { include: { cohort: true, academicCycle: true } } } },
        primaryDepartment: true,
        studentDepartments: { include: { department: true } },
        ...this.currentProgramInclude(),
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
    return this.normalizeStudent(student);
  }

  async createStudent(
    orgId: string,
    data: CreateStudentDto,
    userContext: { id?: string; role?: string; name?: string | null; email: string },
  ) {
    const onlineAdmission = data.onlineAdmissionId
      ? await this.prisma.onlineAdmissionSubmission.findFirst({
          where: { id: data.onlineAdmissionId, organizationId: orgId },
          select: {
            id: true,
            status: true,
            programId: true,
            programOfferingId: true,
          },
        })
      : null;
    if (data.onlineAdmissionId && !onlineAdmission) {
      throw new NotFoundException('Online admission submission not found');
    }
    if (onlineAdmission) {
      if (onlineAdmission.status === OnlineAdmissionSubmissionStatus.REJECTED) {
        throw new ConflictException('Rejected online admissions cannot be converted to students');
      }
      if (onlineAdmission.status === OnlineAdmissionSubmissionStatus.ADMITTED) {
        throw new ConflictException('Online admission has already been converted');
      }
      if (
        data.programId !== onlineAdmission.programId
        || data.programOfferingId !== onlineAdmission.programOfferingId
      ) {
        throw new BadRequestException(
          'Student program and offering must match the online admission submission',
        );
      }
    }
    const programDepartment = data.programId
      ? await this.studentPrograms.resolveAdmissionDepartment(orgId, data.programId, userContext.id && userContext.role ? { id: userContext.id, role: userContext.role } : undefined, data.programOfferingId)
      : null;
    if (programDepartment && data.primaryDepartmentId && data.primaryDepartmentId !== programDepartment.id) {
      throw new BadRequestException('Primary department is derived from the selected major program');
    }
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
            ...((programDepartment?.id || data.primaryDepartmentId) ? [programDepartment?.id || data.primaryDepartmentId!] : []),
            ...(data.departmentIds || []),
          ],
        );
        const departmentScope = await getDepartmentScope(this.prisma, orgId, userContext.id && userContext.role ? { id: userContext.id, role: userContext.role } : undefined);
        assertDepartmentInScope(departmentScope, programDepartment?.id || data.primaryDepartmentId, 'You cannot create a student outside your department scope');
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
            primaryDepartmentId: programDepartment?.id || data.primaryDepartmentId || null,
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
            ...this.currentProgramInclude(),
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

        if (data.programId) {
          const major = await this.studentPrograms.admitInTransaction(
            prisma,
            orgId,
            student.id,
            {
              programId: data.programId,
              programOfferingId: data.programOfferingId,
              entryStageId: data.entryStageId,
            },
            userContext.id!,
          );
          await prisma.student.update({
            where: { id: student.id },
            data: { primaryDepartmentId: major.program.departmentId },
          });
        }

        if (onlineAdmission) {
          const linked = await prisma.onlineAdmissionSubmission.updateMany({
            where: {
              id: onlineAdmission.id,
              organizationId: orgId,
              status: onlineAdmission.status,
              admittedStudentId: null,
            },
            data: {
              status: OnlineAdmissionSubmissionStatus.ADMITTED,
              admittedStudentId: student.id,
              reviewedById: userContext.id,
              reviewedAt: new Date(),
              updateTokenHash: null,
              updateTokenExpiresAt: null,
            },
          });
          if (linked.count !== 1) {
            throw new ConflictException('Online admission changed while the student was being created');
          }
          await prisma.onlineAdmissionStatusEvent.create({
            data: {
              submissionId: onlineAdmission.id,
              fromStatus: onlineAdmission.status,
              toStatus: OnlineAdmissionSubmissionStatus.ADMITTED,
              actorUserId: userContext.id,
              actorType: 'ADMIN',
              note: 'Converted to student admission',
            },
          });
        }

        const createdStudent = await prisma.student.findUnique({
          where: { id: student.id },
          include: {
            user: { select: { email: true, name: true, phone: true } },
            cohortMemberships: { where: { leftAt: null }, take: 1, include: { cohortOffering: { include: { cohort: true, academicCycle: true } } } },
            primaryDepartment: true,
            studentDepartments: { include: { department: true } },
            ...this.currentProgramInclude(),
            ...this.studentGuardianInclude(),
            enrollments: { include: { section: true } },
          },
        });
        return this.normalizeStudent(createdStudent);
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
      'primaryDepartmentId',
      'admissionDate',
      'graduationDate',
      'emergencyContact',
      'bloodGroup',
      'gender',
      'status',
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
          cohortMemberships: { where: { leftAt: null }, take: 1, include: { cohortOffering: { include: { cohort: true, academicCycle: true } } } },
          primaryDepartment: true,
          studentDepartments: { include: { department: true } },
          ...this.currentProgramInclude(),
          ...this.studentGuardianInclude(),
          enrollments: { include: { section: true } },
        },
      });
      return this.normalizeStudent(savedStudent);
    });

    // --- Persistent Notifications ---
    if (data.status && data.status !== student.status) {
      await this.notifications.createNotification({
        userId: student.userId,
        title: 'Account Status Updated',
        body: `Your account status has been changed to ${data.status.toLowerCase()}.`,
        type: 'USER_STATUS_CHANGE',
        actionUrl: `/settings/${student.userId}`,
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
    return this.prisma.student.findUnique({
      where: { userId },
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
        cohortMemberships: { where: { leftAt: null }, take: 1, include: { cohortOffering: { include: { cohort: true, academicCycle: true } } } },
        primaryDepartment: true,
        studentDepartments: { include: { department: true } },
        ...this.studentGuardianInclude(),
      },
    });
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
                  include: {
                    answerbookAttachments: {
                      include: {
                        file: {
                          select: {
                            id: true, filename: true, mimeType: true, size: true,
                            fileKind: true, extension: true, createdAt: true,
                          },
                        },
                      },
                    },
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
          gradeId: grade.id,
          assessmentId: a.id,
          title: a.title,
          type: a.type,
          weightage: a.weightage,
          marksObtained: grade.marksObtained,
          totalMarks: a.totalMarks,
          status: grade.status,
          percentage: percentage.toFixed(2),
          answerbookReferenceNumber: grade.answerbookReferenceNumber,
          answerbookAttachments: grade.answerbookAttachments.map(toPublicGradeEvidenceAttachment),
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
                date: true,
                type: true,
                startTime: true,
                endTime: true,
                room: true,
                roomId: true,
                roomRef: { select: { name: true, building: { select: { name: true } } } },
              },
            },
            teachers: {
              select: {
                id: true,
                user: { select: { id: true, name: true, email: true } },
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
            schedule: { select: { type: true } },
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
    }).then((records) => records.map((record) => ({
      ...record,
      session: record.session
        ? {
            ...record.session,
            type: record.session.schedule.type,
          }
        : record.session,
    })));
  }
}
