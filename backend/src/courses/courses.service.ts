import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
} from '../common/utils';
import {
  courseDepartmentScopeWhere,
  getDepartmentScope,
  type DepartmentScopedUser,
  assertDepartmentIdsBelongToOrg,
  assertDepartmentInScope,
} from '../common/department-scope';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCourses(
    orgId: string,
    options: PaginationOptions = {},
    requester?: DepartmentScopedUser,
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'name',
      sortOrder: options.sortOrder || 'asc',
    });

    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    const scopeWhere = courseDepartmentScopeWhere(departmentScope);

    const where: Prisma.CourseWhereInput = {
      organizationId: orgId,
      ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}),
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
      ...(options.my && options.userId
        ? {
            sections: {
              some: {
                teachers: {
                  some: { userId: options.userId },
                },
              },
            },
          }
        : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              {
                description: { contains: options.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [courses, totalRecords] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take,
        include: { sections: true, department: true },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.course.count({ where }),
    ]);

    return formatPaginatedResponse(
      courses,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async createCourse(orgId: string, data: CreateCourseDto, requester?: DepartmentScopedUser) {
    if (data.departmentId) {
      await assertDepartmentIdsBelongToOrg(this.prisma, orgId, [data.departmentId]);
    }
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, data.departmentId, 'You cannot create a course outside your department scope');

    return this.prisma.course.create({
      data: {
        ...data,
        departmentId: data.departmentId || null,
        organizationId: orgId,
      },
      include: { department: true },
    });
  }

  async updateCourse(orgId: string, id: string, data: UpdateCourseDto, requester?: DepartmentScopedUser) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course || course.organizationId !== orgId) {
      throw new NotFoundException('Course not found');
    }
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, course.departmentId, 'You cannot update a course outside your department scope');
    if (data.departmentId) {
      await assertDepartmentIdsBelongToOrg(this.prisma, orgId, [data.departmentId]);
    }
    assertDepartmentInScope(departmentScope, data.departmentId, 'You cannot move a course outside your department scope');

    return this.prisma.course.update({
      where: { id },
      data: {
        ...data,
        departmentId: data.departmentId === '' ? null : data.departmentId,
      },
      include: { department: true },
    });
  }

  async deleteCourse(orgId: string, id: string, requester?: DepartmentScopedUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { sections: true },
    });
    if (!course || course.organizationId !== orgId) {
      throw new NotFoundException('Course not found');
    }
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, course.departmentId, 'You cannot delete a course outside your department scope');
    if (course.sections.length > 0) {
      throw new BadRequestException(
        'Cannot delete course with active sections',
      );
    }
    return this.prisma.course.delete({ where: { id } });
  }

  async getCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async validateCourseBelongsToOrg(courseId: string, organizationId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.organizationId !== organizationId) {
      throw new ForbiddenException('Course does not belong to your organization');
    }

    return course;
  }
}
