import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async getStudents(orgId: string, options: PaginationOptions) {
    const { skip, take, sortBy, sortOrder, status, deleted } = getPaginationOptions(options);

    const where: Prisma.StudentWhereInput = {
      organizationId: orgId,
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
      students,
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
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    
    if (userContext?.role === Role.STUDENT && student.userId !== userContext.id) {
        throw new ForbiddenException('You do not have permission to view this student profile');
    }
    return student;
  }

  async createStudent(
    orgId: string,
    data: CreateStudentDto,
    userContext: { name?: string | null; email: string },
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
          },
          include: {
            user: { select: { email: true, name: true, phone: true } },
            enrollments: { include: { section: true } },
          },
        });

        if (data.sectionIds && data.sectionIds.length > 0) {
          const sections = await prisma.section.findMany({
            where: { id: { in: data.sectionIds } },
            select: { id: true, academicCycleId: true },
          });
          const sectionCycleMap = new Map(sections.map(s => [s.id, s.academicCycleId]));

          await prisma.enrollment.createMany({
            data: data.sectionIds.map((sectionId) => ({
              studentId: student.id,
              sectionId,
              academicCycleId: sectionCycleMap.get(sectionId) || undefined,
              source: 'MANUAL' as const,
            })),
          });

          await prisma.enrollmentHistory.createMany({
            data: data.sectionIds.map((sectionId) => ({
              studentId: student.id,
              sectionId,
              academicCycleId: sectionCycleMap.get(sectionId) || undefined,
              source: 'MANUAL' as const,
            })),
          });
          
          // Re-fetch to include the newly created manual enrollments
          return prisma.student.findUnique({
            where: { id: student.id },
            include: {
              user: { select: { email: true, name: true, phone: true } },
              enrollments: { include: { section: true } },
            },
          });
        }

        return student;
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
    userContext: { role: Role; name?: string | null; email: string },
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

    if (data.cohortId === '') {
      studentData.cohortId = null;
    }

    const updatedStudent = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await this.userService.updateUser(student.userId, userData, tx);
      }

      if (Object.keys(studentData).length > 0) {
        studentData.updatedBy = userContext.name || userContext.email;
        await tx.student.update({
          where: { id },
          data: studentData,
        });
      }

      if (data.sectionIds !== undefined) {
        // Fetch current MANUAL enrollments
        const currentManualEnrollments = await tx.enrollment.findMany({
          where: { studentId: id, source: 'MANUAL' },
          select: { id: true, sectionId: true, academicCycleId: true },
        });

        const currentSectionIds = new Set(currentManualEnrollments.map(e => e.sectionId));
        const newSectionIds = new Set(data.sectionIds);

        const sectionsToAdd = data.sectionIds.filter(id => !currentSectionIds.has(id));
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
          const sections = await tx.section.findMany({
            where: { id: { in: sectionsToAdd } },
            select: { id: true, academicCycleId: true },
          });
          const sectionCycleMap = new Map(sections.map(s => [s.id, s.academicCycleId]));

          await tx.enrollment.createMany({
            data: sectionsToAdd.map((sectionId) => ({
              studentId: id,
              sectionId,
              academicCycleId: sectionCycleMap.get(sectionId) || undefined,
              source: 'MANUAL' as const,
            })),
          });

          await tx.enrollmentHistory.createMany({
            data: sectionsToAdd.map((sectionId) => ({
              studentId: id,
              sectionId,
              academicCycleId: sectionCycleMap.get(sectionId) || undefined,
              source: 'MANUAL' as const,
            })),
          });
        }
      }

      return tx.student.findUnique({
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
          enrollments: { include: { section: true } },
        },
      });
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

  async deleteStudent(orgId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!student) throw new NotFoundException('Student not found');

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

  async calculateFinalGrade(studentId: string, sectionId?: string) {
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
                    status: { in: ['PUBLISHED', 'FINALIZED'] },
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
      const assessmentGrades = section.assessments.map((a) => {
        const grade = a.grades[0];
        const percentage = grade
          ? (grade.marksObtained / a.totalMarks) * a.weightage
          : 0;
        totalPercentage += percentage;
        return {
          assessmentId: a.id,
          title: a.title,
          type: a.type,
          weightage: a.weightage,
          marksObtained: grade?.marksObtained || 0,
          totalMarks: a.totalMarks,
          status: grade?.status || 'NOT_GRADED',
          percentage: percentage.toFixed(2),
        };
      });

      return {
        sectionId: section.id,
        sectionName: section.name,
        courseName: section.course.name,
        finalPercentage: parseFloat(totalPercentage.toFixed(2)),
        assessments: assessmentGrades,
      };
    });
  }

  async getStudentFinalGrades(orgId: string, userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return [];

    const results = await this.calculateFinalGrade(student.id);
    return results;
  }

  async getStudentTimetable(orgId: string, userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return [];
    
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: student.id, section: { course: { organizationId: orgId } } },
      include: {
        section: {
          include: {
            course: { select: { name: true } },
            schedules: { select: { id: true, day: true, startTime: true, endTime: true, room: true } },
          },
        },
      },
    });

    return extractTimetableEntries(enrollments.map((e) => e.section));
  }

  async getStudentAttendance(
    orgId: string,
    userId: string,
    requester: JwtPayload,
  ) {
    if (requester.role === Role.STUDENT && requester.id !== userId) {
      throw new ForbiddenException(
        'Students can only view their own attendance.',
      );
    }

    const student = await this.getStudentByUserId(userId);
    if (!student) return [];

    if (requester.role === Role.TEACHER) {
      const canAccess = await this.prisma.enrollment.findFirst({
        where: {
          studentId: student.id,
          section: {
            course: { organizationId: orgId },
            teachers: { some: { userId: requester.id } },
          },
        },
        select: { id: true },
      });

      if (!canAccess) {
        throw new ForbiddenException(
          'You are not assigned to this section.',
        );
      }
    }
    
    return this.prisma.attendanceRecord.findMany({
      where: { studentId: student.id, session: { section: { course: { organizationId: orgId } } } },
      include: {
        session: {
          include: {
            section: { select: { id: true, name: true, course: { select: { name: true } } } },
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });
  }
}
