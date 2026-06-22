import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserService } from '../users/user.service';
import { SectionsService } from '../sections/sections.service';
import { DepartmentScopeType, Role, TeacherStatus, UserStatus } from '../common/enums';
import { CreateTeacherDto } from '../org/dto/create-teacher.dto';
import { UpdateTeacherDto } from '../org/dto/update-teacher.dto';
import { PaginationOptions, getPaginationOptions, formatPaginatedResponse, extractUpdateFields } from '../common/utils';
import { Prisma } from '@/prisma/prisma-client';
import { extractTimetableEntries } from '../common/utils';
import {
  assertDepartmentIdsBelongToOrg,
  getDepartmentScope,
  teacherDepartmentScopeWhere,
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
export class TeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly userService: UserService,
    private readonly sectionsService: SectionsService,
  ) { }

  private async getTeacherById(orgId: string, id: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id,
        organizationId: orgId,
        status: { not: TeacherStatus.DELETED },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return teacher;
  }

  async getTeachers(
    orgId: string,
    options: PaginationOptions,
    requester?: DepartmentScopedUser,
  ) {
    const { skip, take, sortBy, sortOrder, status, deleted } = getPaginationOptions(options);
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    const scopeWhere = teacherDepartmentScopeWhere(departmentScope);

    const where: Prisma.TeacherWhereInput = {
      organizationId: orgId,
      ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}),
      ...(options.departmentId
        ? { teacherDepartments: { some: { departmentId: options.departmentId } } }
        : {}),
      status: deleted
        ? TeacherStatus.DELETED
        : status
          ? { in: status.split(',') as TeacherStatus[] }
          : { not: TeacherStatus.DELETED },
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
            { subject: { contains: options.search, mode: 'insensitive' } },
            { department: { contains: options.search, mode: 'insensitive' } },
            {
              designation: { contains: options.search, mode: 'insensitive' },
            },
          ],
        }
        : {}),
    };

    // Handle nested sorting for user fields
    let orderBy: Prisma.TeacherOrderByWithRelationInput = {};
    const userFields = ['name', 'email', 'phone'];

    if (sortBy.startsWith('user.')) {
      const field = sortBy.split('.')[1];
      orderBy = { user: { [field]: sortOrder } };
    } else if (userFields.includes(sortBy)) {
      orderBy = { user: { [sortBy]: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [teachers, totalRecords] = await Promise.all([
      this.prisma.teacher.findMany({
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
              role: true,
              avatarUrl: true,
              avatarUpdatedAt: true,
            },
          },
          sections: { select: { id: true, name: true, color: true, course: { select: { id: true, name: true } } } },
          teacherDepartments: { include: { department: true } },
          managerDepartments: { include: { department: true } },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return formatPaginatedResponse(
      teachers,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getManagers(
    orgId: string,
    options: PaginationOptions,
    requester?: DepartmentScopedUser,
  ) {
    const { skip, take, sortBy, sortOrder, status, deleted } = getPaginationOptions(options);
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    const scopeWhere: Prisma.TeacherWhereInput =
      !departmentScope.applies || departmentScope.all
        ? {}
        : departmentScope.departmentIds.length === 0
          ? { id: '__no_department_scope__' }
          : {
              OR: [
                { managerDepartments: { some: { departmentId: { in: departmentScope.departmentIds } } } },
                { managerDepartments: { none: {} } },
              ],
            };

    const where: Prisma.TeacherWhereInput = {
      organizationId: orgId,
      user: { role: Role.ORG_MANAGER },
      ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}),
      ...(options.departmentId
        ? { managerDepartments: { some: { departmentId: options.departmentId } } }
        : {}),
      status: deleted
        ? TeacherStatus.DELETED
        : status
          ? { in: status.split(',') as TeacherStatus[] }
          : { not: TeacherStatus.DELETED },
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
            { subject: { contains: options.search, mode: 'insensitive' } },
            { department: { contains: options.search, mode: 'insensitive' } },
            {
              designation: { contains: options.search, mode: 'insensitive' },
            },
          ],
        }
        : {}),
    };

    let orderBy: Prisma.TeacherOrderByWithRelationInput = {};
    const userFields = ['name', 'email', 'phone'];

    if (sortBy.startsWith('user.')) {
      const field = sortBy.split('.')[1];
      orderBy = { user: { [field]: sortOrder } };
    } else if (userFields.includes(sortBy)) {
      orderBy = { user: { [sortBy]: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [managers, totalRecords] = await Promise.all([
      this.prisma.teacher.findMany({
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
              role: true,
              avatarUrl: true,
              avatarUpdatedAt: true,
            },
          },
          sections: { select: { id: true, name: true, color: true, course: { select: { id: true, name: true } } } },
          teacherDepartments: { include: { department: true } },
          managerDepartments: { include: { department: true } },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return formatPaginatedResponse(
      managers,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getTeacher(orgId: string, id: string, userContext?: { id: string, role: string }) {
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id,
        organizationId: orgId,
        status: { not: TeacherStatus.DELETED },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            avatarUrl: true,
            avatarUpdatedAt: true,
          },
        },
        sections: { select: { id: true, name: true, color: true, course: { select: { id: true, name: true } } } },
        teacherDepartments: { include: { department: true } },
        managerDepartments: { include: { department: true } },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    
    if (userContext?.role === Role.TEACHER && teacher.userId !== userContext.id) {
        throw new ForbiddenException('You do not have permission to view this teacher profile');
    }
    return teacher;
  }

  async createTeacher(
    orgId: string,
    data: CreateTeacherDto,
    userContext: { id: string; role: string },
  ) {
    if (data.isManager && userContext.role === Role.ORG_MANAGER) {
      throw new ForbiddenException(
        'Only Organization Admins can create Managers',
      );
    }

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        const departmentIds = await assertDepartmentIdsBelongToOrg(prisma, orgId, data.departmentIds);
        const scopeDepartmentIds = await assertDepartmentIdsBelongToOrg(prisma, orgId, data.scopeDepartmentIds);

        const user = await this.userService.createUser({
          email: data.email,
          password: data.password,
          role: data.isManager ? Role.ORG_MANAGER : Role.TEACHER,
          organizationId: orgId,
          name: data.name,
          phone: data.phone,
          status: data.status as unknown as UserStatus,
        }, prisma);

        const teacher = await prisma.teacher.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            subject: data.subject,
            education: data.education,
            designation: data.designation,
            department: data.department,
            departmentScopeType: data.isManager
              ? (data.departmentScopeType || DepartmentScopeType.ALL)
              : DepartmentScopeType.ALL,
            joiningDate: data.joiningDate
              ? new Date(data.joiningDate)
              : undefined,
            emergencyContact: data.emergencyContact,
            bloodGroup: data.bloodGroup,
            address: data.address,
            status: data.status as unknown as TeacherStatus,
            sections: data.sectionIds
              ? { connect: data.sectionIds.map((id) => ({ id })) }
              : undefined,
            teacherDepartments: departmentIds.length
              ? {
                  createMany: {
                    data: departmentIds.map((departmentId) => ({ organizationId: orgId, departmentId })),
                  },
                }
              : undefined,
            managerDepartments: data.isManager && scopeDepartmentIds.length
              ? {
                  createMany: {
                    data: scopeDepartmentIds.map((departmentId) => ({ organizationId: orgId, departmentId })),
                  },
                }
              : undefined,
          },
          include: {
            user: {
              select: { email: true, name: true, phone: true },
            },
            teacherDepartments: { include: { department: true } },
            managerDepartments: { include: { department: true } },
          },
        });

        return teacher;
      });
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('email'))
            throw new ConflictException('Email address already in use');
        }
      }
      if (
        error instanceof ForbiddenException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      console.error('[CreateTeacher Error]:', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the teacher account',
      );
    }
  }

  async updateTeacher(
    orgId: string,
    id: string,
    data: UpdateTeacherDto,
    userContext: { id: string; role: string },
  ) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, organizationId: orgId },
      include: { user: true },
    });

    if (!teacher) throw new NotFoundException('Teacher not found');

    if (userContext.role === Role.ORG_MANAGER) {
      if (
        teacher.user.role === Role.ORG_ADMIN ||
        (userContext.id !== teacher.userId &&
          teacher.user.role === Role.ORG_MANAGER)
      ) {
        throw new ForbiddenException(
          'Managers cannot modify Admin or Manager profiles',
        );
      }

      // Managers cannot change status for themselves or other managers
      if (
        data.status !== undefined &&
        (teacher.user.role === Role.ORG_MANAGER || userContext.id === teacher.userId)
      ) {
        throw new ForbiddenException(
          'Managers cannot change account status for themselves or other managers',
        );
      }
    }

    const userFields = ['name', 'email', 'phone', 'password'];
    const teacherFields = [
      'subject',
      'education',
      'designation',
      'department',
      'departmentScopeType',
      'emergencyContact',
      'bloodGroup',
      'address',
      'status',
    ];

    const { userData, entityData: teacherData } = await extractUpdateFields(
      data as unknown as Record<string, unknown>,
      userFields,
      teacherFields,
      teacher.user.email,
    );

    if (data.isManager !== undefined) {
      userData.role = data.isManager ? Role.ORG_MANAGER : Role.TEACHER;
      if (!data.isManager && data.departmentScopeType === undefined) {
        teacherData.departmentScopeType = DepartmentScopeType.ALL;
      }
    }

    if (data.status !== undefined) {
      userData.status = data.status as unknown as UserStatus;
    }

    if (data.sectionIds !== undefined) {
      teacherData.sections = { set: data.sectionIds.map((id) => ({ id })) };
    }

    if (data.joiningDate) {
      const date = new Date(data.joiningDate);
      if (!isNaN(date.getTime())) {
        teacherData.joiningDate = date;
      }
    }

    const updatedTeacher = await this.prisma.$transaction(async (tx) => {
      const departmentIds = data.departmentIds !== undefined
        ? await assertDepartmentIdsBelongToOrg(tx, orgId, data.departmentIds)
        : undefined;
      const scopeDepartmentIds = data.scopeDepartmentIds !== undefined
        ? await assertDepartmentIdsBelongToOrg(tx, orgId, data.scopeDepartmentIds)
        : undefined;

      if (Object.keys(userData).length > 0) {
        await this.userService.updateUser(teacher.userId, userData, tx);
      }

      if (Object.keys(teacherData).length > 0) {
        await tx.teacher.update({
          where: { id },
          data: teacherData,
        });
      }

      if (departmentIds !== undefined) {
        await tx.teacherDepartment.deleteMany({ where: { teacherId: id } });
        if (departmentIds.length) {
          await tx.teacherDepartment.createMany({
            data: departmentIds.map((departmentId) => ({
              organizationId: orgId,
              teacherId: id,
              departmentId,
            })),
          });
        }
      }

      if (scopeDepartmentIds !== undefined || data.isManager === false) {
        await tx.managerDepartment.deleteMany({ where: { teacherId: id } });
        if (data.isManager !== false && scopeDepartmentIds?.length) {
          await tx.managerDepartment.createMany({
            data: scopeDepartmentIds.map((departmentId) => ({
              organizationId: orgId,
              teacherId: id,
              departmentId,
            })),
          });
        }
      }

      return tx.teacher.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              role: true,
              avatarUrl: true,
              avatarUpdatedAt: true,
            },
          },
          sections: { include: { course: true } },
          teacherDepartments: { include: { department: true } },
          managerDepartments: { include: { department: true } },
        },
      });
    });

    // --- Persistent Notifications ---
    if (data.status && data.status !== teacher.status) {
      await this.notifications.createNotification({
        userId: teacher.userId,
        title: 'Account Status Updated',
        body: `Your account status has been changed to ${data.status.toLowerCase()}.`,
        type: 'USER_STATUS_CHANGE',
        actionUrl: `/teachers/${teacher.userId}/profile`,
        metadata: { oldStatus: teacher.status, newStatus: data.status },
      });
    }

    if (
      data.isManager !== undefined &&
      (data.isManager ? Role.ORG_MANAGER : Role.TEACHER) !== teacher.user.role
    ) {
      await this.notifications.createNotification({
        userId: teacher.userId,
        title: 'Role Updated',
        body: `Your administrative role has been updated to ${data.isManager ? 'Manager' : 'Teacher'}.`,
        type: 'USER_ROLE_CHANGE',
        actionUrl: `/teachers/${teacher.userId}/profile`,
        metadata: {
          oldRole: teacher.user.role,
          newRole: data.isManager ? Role.ORG_MANAGER : Role.TEACHER,
        },
      });
    }

    return updatedTeacher;
  }

  async deleteTeacher(
    orgId: string,
    id: string,
    userContext: { id: string; role: string },
  ) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, organizationId: orgId },
      include: { user: true },
    });

    if (!teacher) throw new NotFoundException('Teacher not found');

    if (userContext.role === Role.ORG_MANAGER) {
      if (
        teacher.user.role === Role.ORG_ADMIN ||
        teacher.user.role === Role.ORG_MANAGER
      ) {
        throw new ForbiddenException(
          'Managers cannot delete Admin or Manager profiles',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id },
        data: { status: TeacherStatus.DELETED as unknown as TeacherStatus },
      });

      await tx.user.update({
        where: { id: teacher.userId },
        data: { status: UserStatus.DELETED as unknown as UserStatus },
      });
    });

    return { message: 'Teacher deleted successfully' };
  }
  
  async restoreTeacher(orgId: string, id: string, status: TeacherStatus = TeacherStatus.ACTIVE) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, organizationId: orgId, status: TeacherStatus.DELETED },
    });

    if (!teacher) throw new NotFoundException('Deleted teacher not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id },
        data: { status: status as unknown as TeacherStatus },
      });

      await tx.user.update({
        where: { id: teacher.userId },
        data: { status: UserStatus.ACTIVE as unknown as UserStatus },
      });
    });

    return { message: 'Teacher restored successfully' };
  }

  async getTeacherByUserId(userId: string) {
    return this.prisma.teacher.findUnique({ where: { userId } });
  }

  async getTeacherProfile(orgId: string, user: JwtPayload) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            avatarUrl: true,
            avatarUpdatedAt: true,
          },
        },
        sections: { include: { course: true } },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher profile not found');
    return teacher;
  }

  async getTeacherTimetable(orgId: string, userId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, organizationId: orgId },
    });
    if (!teacher) return [];

    const sections = await this.sectionsService.getSectionsByTeacherId(teacher.id);
    const sectionIds = sections.map(s => s.id);

    const sectionsWithDetails = await this.prisma.section.findMany({
      where: { id: { in: sectionIds } },
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
    });

    return extractTimetableEntries(sectionsWithDetails);
  }
}
