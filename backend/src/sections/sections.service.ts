import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
} from '../common/utils';
import { normalizeSectionColor } from './section-colors';
import {
  getDepartmentScope,
  sectionDepartmentScopeWhere,
  assertDepartmentInScope,
  validateRoomBelongsToOrg,
  type DepartmentScopedUser,
} from '../common/department-scope';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async getSections(
    orgId: string,
    options: PaginationOptions,
    requester?: DepartmentScopedUser,
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
    });

    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    const scopeWhere = sectionDepartmentScopeWhere(departmentScope);

    const where: Prisma.SectionWhereInput = {
      course: { organizationId: orgId },
      ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}),
      ...(options.departmentId ? { course: { organizationId: orgId, departmentId: options.departmentId } } : {}),
      ...(options.academicCycleId ? { academicCycleId: options.academicCycleId } : {}),
      ...(options.activeAcademicCycleOnly ? { academicCycle: { isActive: true } } : {}),
      ...(options.cohortId ? { cohortId: options.cohortId } : {}),
      ...(options.teacherId ? { teachers: { some: { id: options.teacherId } } } : {}),
      ...(options.my && options.userId
        ? {
            OR: [
              { teachers: { some: { userId: options.userId } } },
              {
                enrollments: { some: { student: { userId: options.userId } } },
              },
            ],
          }
        : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { room: { contains: options.search, mode: 'insensitive' } },
              {
                course: {
                  name: { contains: options.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    // Handle nested sorting for course name
    let orderBy: Prisma.SectionOrderByWithRelationInput = {};
    if (sortBy === 'courseName') {
      orderBy = { course: { name: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [sections, totalRecords] = await Promise.all([
      this.prisma.section.findMany({
        where,
        skip,
        take,
        include: {
          course: { include: { department: true } },
          defaultRoom: { include: { building: true } },
          teachers: {
            include: { user: { select: { email: true, name: true } } },
          },
          schedules: {
            select: {
              id: true,
              day: true,
              startTime: true,
              endTime: true,
              room: true,
              roomId: true,
              roomRef: { include: { building: true } },
            },
            orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
          },
          enrollments: {
            include: {
              student: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          academicCycle: true,
          cohort: true,
          _count: { select: { enrollments: true, courseMaterials: true } },
        },
        orderBy,
      }),
      this.prisma.section.count({ where }),
    ]);

    const formattedSections = sections.map((s) => ({
      ...s,
      students: s.enrollments.map((e) => ({
        ...e.student,
        user: e.student.user,
      })),
      studentsCount: s._count?.enrollments || 0,
      courseMaterialsCount: s._count?.courseMaterials || 0,
    }));

    return formatPaginatedResponse(
      formattedSections,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getSectionById(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        course: { include: { department: true } },
        defaultRoom: { include: { building: true } },
        teachers: {
          include: { user: { select: { email: true, name: true, avatarUrl: true } } },
        },
        academicCycle: true,
        cohort: true,
        enrollments: {
          include: {
            student: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
          },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async createSection(orgId: string, data: CreateSectionDto, requester?: DepartmentScopedUser) {
    // Verify course belongs to the organization
    const course = await this.coursesService.validateCourseBelongsToOrg(data.courseId, orgId);
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, course.departmentId, 'You cannot create a section outside your department scope');
    if (data.defaultRoomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, data.defaultRoomId);
    }
    const color = normalizeSectionColor(data.color, `${orgId}:${data.courseId}:${data.name}`);

    return this.prisma.section.create({
      data: {
        name: data.name,
        color,
        room: data.room,
        defaultRoomId: data.defaultRoomId || null,
        courseId: data.courseId,
        academicCycleId: data.academicCycleId,
        cohortId: data.cohortId || null,
      },
      include: {
        course: { include: { department: true } },
        defaultRoom: { include: { building: true } },
      },
    });
  }

  async updateSection(orgId: string, id: string, data: UpdateSectionDto, requester?: DepartmentScopedUser) {
    const existing = await this.prisma.section.findFirst({
      where: { id, course: { organizationId: orgId } },
      include: { course: true },
    });
    if (!existing) throw new NotFoundException('Section not found');

    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, existing.course.departmentId, 'You cannot update a section outside your department scope');

    if (data.courseId && data.courseId !== existing.courseId) {
      const nextCourse = await this.coursesService.validateCourseBelongsToOrg(data.courseId, orgId);
      assertDepartmentInScope(departmentScope, nextCourse.departmentId, 'You cannot move a section outside your department scope');
    }

    if (data.defaultRoomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, data.defaultRoomId);
    }

    const color = data.color ? normalizeSectionColor(data.color) : undefined;

    return this.prisma.section.update({
      where: { id },
      data: {
        ...data,
        color,
        defaultRoomId: data.defaultRoomId === '' ? null : data.defaultRoomId,
        academicCycleId: data.academicCycleId === '' ? undefined : data.academicCycleId,
        cohortId: data.cohortId === '' ? null : data.cohortId,
      },
      include: {
        course: { include: { department: true } },
        defaultRoom: { include: { building: true } },
      },
    });
  }

  async deleteSection(orgId: string, id: string, requester?: DepartmentScopedUser) {
    const section = await this.prisma.section.findFirst({
      where: { id, course: { organizationId: orgId } },
      include: { course: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, section.course.departmentId, 'You cannot delete a section outside your department scope');

    await this.prisma.section.delete({ where: { id } });
    return { message: 'Section deleted successfully' };
  }

  async getSectionsByTeacherId(teacherId: string) {
    return this.prisma.section.findMany({
      where: { teachers: { some: { id: teacherId } } },
    });
  }

  async isTeacherAssignedToSection(sectionId: string, teacherUserId: string) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        teachers: { some: { userId: teacherUserId } },
      },
    });
    return !!section;
  }

  async validateSectionBelongsToOrg(sectionId: string, organizationId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (section.course.organizationId !== organizationId) {
      throw new ForbiddenException('Section does not belong to your organization');
    }

    return section;
  }
}
