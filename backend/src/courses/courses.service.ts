import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
  fuzzyFilterAndRank,
} from '../common/utils';
import {
  courseDepartmentScopeWhere,
  getDepartmentScope,
  type DepartmentScopedUser,
  assertDepartmentIdsBelongToOrg,
  assertDepartmentInScope,
} from '../common/department-scope';
import { normalizeEntityCode } from '../common/entity-code';

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

    const baseWhere: Prisma.CourseWhereInput = {
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
    };
    const searchWhere: Prisma.CourseWhereInput = options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const where: Prisma.CourseWhereInput = {
      ...baseWhere,
      ...(options.search
        ? searchWhere
        : {}),
    };
    const include = { sections: true, department: true } satisfies Prisma.CourseInclude;

    const [courses, totalRecords] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take,
        include,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.course.count({ where }),
    ]);

    if (options.search && totalRecords === 0) {
      const candidates = await this.prisma.course.findMany({
        where: baseWhere,
        take: 500,
        include,
        orderBy: { [sortBy]: sortOrder },
      });
      const fuzzyCourses = fuzzyFilterAndRank(candidates, options.search, (course) => [
        course.name,
        course.code,
        course.description,
        course.department?.name,
        course.department?.code,
      ]);
      return formatPaginatedResponse(
        fuzzyCourses.slice(skip, skip + take),
        fuzzyCourses.length,
        options.page,
        options.limit,
      );
    }

    return formatPaginatedResponse(
      courses,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  private async assertUnique(orgId: string, data: Pick<CreateCourseDto, 'name' | 'code'>, excludeId?: string) {
    const name = data.name?.trim();
    const code = normalizeEntityCode(data.code);
    const duplicate = await this.prisma.course.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          ...(name ? [{ name: { equals: name, mode: Prisma.QueryMode.insensitive } }] : []),
          ...(code ? [{ code: { equals: code, mode: Prisma.QueryMode.insensitive } }] : []),
        ],
      },
      select: { id: true, name: true, code: true },
    });

    if (!duplicate) return;
    if (name && duplicate.name.toLowerCase() === name.toLowerCase()) {
      throw new ConflictException('Course name already exists in this organization');
    }
    throw new ConflictException('Course code already exists in this organization');
  }

  async createCourse(orgId: string, data: CreateCourseDto, requester?: DepartmentScopedUser) {
    await this.assertUnique(orgId, data);
    const code = normalizeEntityCode(data.code)!;
    if (data.departmentId) {
      await assertDepartmentIdsBelongToOrg(this.prisma, orgId, [data.departmentId]);
    }
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, data.departmentId, 'You cannot create a course outside your department scope');

    return this.prisma.course.create({
      data: {
        ...data,
        name: data.name.trim(),
        code,
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
    if (data.name !== undefined || data.code !== undefined) {
      await this.assertUnique(orgId, { name: data.name ?? course.name, code: data.code ?? course.code }, id);
    }
    const code = data.code !== undefined ? normalizeEntityCode(data.code)! : undefined;

    return this.prisma.course.update({
      where: { id },
      data: {
        ...data,
        name: data.name !== undefined ? data.name.trim() : undefined,
        code,
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
