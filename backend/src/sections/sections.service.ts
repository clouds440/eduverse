import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
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
import { normalizeEntityCode } from '../common/entity-code';

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
              { code: { contains: options.search, mode: 'insensitive' } },
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
            include: { user: { select: { id: true, email: true, name: true } } },
          },
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
              roomRef: { include: { building: true } },
              teacherId: true,
              teacher: {
                include: { user: { select: { id: true, email: true, name: true } } },
              },
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

  private async assertUnique(orgId: string, data: Pick<CreateSectionDto, 'name' | 'code'>, excludeId?: string) {
    const name = data.name?.trim();
    const code = normalizeEntityCode(data.code);
    const duplicate = await this.prisma.section.findFirst({
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
      throw new ConflictException('Section name already exists in this organization');
    }
    throw new ConflictException('Section code already exists in this organization');
  }

  private async assertTeachersBelongToOrg(orgId: string, teacherIds: string[] = []) {
    const uniqueIds = [...new Set(teacherIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: uniqueIds }, organizationId: orgId },
      select: { id: true },
    });
    if (teachers.length !== uniqueIds.length) {
      throw new BadRequestException('One or more selected teachers do not belong to this organization');
    }

    return uniqueIds;
  }

  async createSection(orgId: string, data: CreateSectionDto, requester?: DepartmentScopedUser) {
    // Verify course belongs to the organization
    await this.assertUnique(orgId, data);
    const code = normalizeEntityCode(data.code)!;
    const course = await this.coursesService.validateCourseBelongsToOrg(data.courseId, orgId);
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, course.departmentId, 'You cannot create a section outside your department scope');
    await this.validateAcademicPlacement(orgId, data.academicCycleId, data.cohortId);
    if (data.defaultRoomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, data.defaultRoomId);
    }
    const teacherIds = await this.assertTeachersBelongToOrg(orgId, data.teacherIds);
    const color = normalizeSectionColor(data.color, `${orgId}:${data.courseId}:${data.name}`);

    return this.prisma.section.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        code,
        color,
        room: data.room,
        defaultRoomId: data.defaultRoomId || null,
        courseId: data.courseId,
        academicCycleId: data.academicCycleId,
        cohortId: data.cohortId || null,
        teachers: teacherIds.length ? { connect: teacherIds.map((id) => ({ id })) } : undefined,
      },
      include: {
        course: { include: { department: true } },
        defaultRoom: { include: { building: true } },
        teachers: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });
  }

  async updateSection(orgId: string, id: string, data: UpdateSectionDto, requester?: DepartmentScopedUser) {
    const { teacherIds: requestedTeacherIds, scheduleTeacherResolution, ...sectionData } = data;
    const existing = await this.prisma.section.findFirst({
      where: { id, course: { organizationId: orgId } },
      include: {
        course: true,
        teachers: { select: { id: true } },
        schedules: { select: { id: true, teacherId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Section not found');

    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, existing.course.departmentId, 'You cannot update a section outside your department scope');

    if (sectionData.courseId && sectionData.courseId !== existing.courseId) {
      const nextCourse = await this.coursesService.validateCourseBelongsToOrg(sectionData.courseId, orgId);
      assertDepartmentInScope(departmentScope, nextCourse.departmentId, 'You cannot move a section outside your department scope');
    }

    if (sectionData.academicCycleId || sectionData.cohortId) {
      await this.validateAcademicPlacement(
        orgId,
        sectionData.academicCycleId || existing.academicCycleId,
        sectionData.cohortId === '' ? null : (sectionData.cohortId || existing.cohortId),
      );
    }

    if (sectionData.defaultRoomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, sectionData.defaultRoomId);
    }

    if (sectionData.name !== undefined || sectionData.code !== undefined) {
      await this.assertUnique(
        orgId,
        {
          name: sectionData.name ?? existing.name,
          code: sectionData.code ?? existing.code,
        },
        id,
      );
    }

    const nextTeacherIds = requestedTeacherIds !== undefined
      ? await this.assertTeachersBelongToOrg(orgId, requestedTeacherIds)
      : undefined;
    const removedTeacherIds = nextTeacherIds
      ? existing.teachers.map((teacher) => teacher.id).filter((teacherId) => !nextTeacherIds.includes(teacherId))
      : [];
    const affectedScheduleIds = removedTeacherIds.length
      ? existing.schedules.filter((schedule) => removedTeacherIds.includes(schedule.teacherId)).map((schedule) => schedule.id)
      : [];

    if (affectedScheduleIds.length > 0) {
      if (!scheduleTeacherResolution) {
        throw new BadRequestException('Existing schedules use removed teachers. Move those schedules to another assigned teacher or delete them.');
      }
      if (scheduleTeacherResolution.action === 'MOVE') {
        if (!scheduleTeacherResolution.teacherId || !nextTeacherIds?.includes(scheduleTeacherResolution.teacherId)) {
          throw new BadRequestException('Choose a remaining assigned teacher to receive affected schedules.');
        }
      }
    }

    const color = sectionData.color ? normalizeSectionColor(sectionData.color) : undefined;
    const code = sectionData.code !== undefined ? normalizeEntityCode(sectionData.code)! : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (affectedScheduleIds.length > 0 && scheduleTeacherResolution?.action === 'DELETE') {
        await tx.attendanceSession.deleteMany({ where: { scheduleId: { in: affectedScheduleIds } } });
        await tx.sectionSchedule.deleteMany({ where: { id: { in: affectedScheduleIds } } });
      } else if (affectedScheduleIds.length > 0 && scheduleTeacherResolution?.action === 'MOVE') {
        await tx.sectionSchedule.updateMany({
          where: { id: { in: affectedScheduleIds } },
          data: { teacherId: scheduleTeacherResolution.teacherId },
        });
      }

      return tx.section.update({
        where: { id },
        data: {
          ...sectionData,
          name: sectionData.name !== undefined ? sectionData.name.trim() : undefined,
          code,
          color,
          defaultRoomId: sectionData.defaultRoomId === '' ? null : sectionData.defaultRoomId,
          academicCycleId: sectionData.academicCycleId === '' ? undefined : sectionData.academicCycleId,
          cohortId: sectionData.cohortId === '' ? null : sectionData.cohortId,
          teachers: nextTeacherIds ? { set: nextTeacherIds.map((teacherId) => ({ id: teacherId })) } : undefined,
        },
        include: {
          course: { include: { department: true } },
          defaultRoom: { include: { building: true } },
          teachers: { include: { user: { select: { id: true, email: true, name: true } } } },
        },
      });
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

  private async validateAcademicPlacement(
    orgId: string,
    academicCycleId?: string | null,
    cohortId?: string | null,
  ) {
    if (!academicCycleId) throw new NotFoundException('Academic cycle not found');

    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: academicCycleId, organizationId: orgId },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');

    if (!cohortId) return;
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId, academicCycleId },
      select: { id: true, isActive: true },
    });
    if (!cohort) {
      throw new NotFoundException('Cohort not found for this academic cycle');
    }
    if (!cohort.isActive) {
      throw new ConflictException('Cannot assign sections to an inactive cohort');
    }
  }
}


