import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicCycleStatus, Prisma, SectionLifecycleStatus } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateSectionDto, SectionProgramMappingInputDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { formatPaginatedResponse, fuzzyFilterAndRank, getPaginationOptions, PaginationOptions } from '../common/utils';
import { normalizeSectionColor } from './section-colors';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  sectionDepartmentScopeWhere,
  type DepartmentScopedUser,
  validateRoomBelongsToOrg,
} from '../common/department-scope';
import { normalizeEntityCode } from '../common/entity-code';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';

interface JwtPayload {
  name: string | null | undefined;
  id: string;
  role?: string;
  email?: string;
  organizationId?: string | null;
  userName?: string;
}

const SECTION_INCLUDE = {
  course: { include: { department: true } },
  defaultRoom: { include: { building: true } },
  teachers: { include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } } },
  academicCycle: true,
  programMappings: {
    include: {
      stageCourseRequirement: { include: { programStage: true } },
      programStageOffering: {
        include: { programStage: true, programOffering: { include: { program: true, academicCycle: true } } },
      },
    },
  },
  cohortOfferingSections: { include: { cohortOffering: { include: { cohort: true } } } },
  enrollments: { include: { student: { include: { user: true } } } },
  _count: { select: { enrollments: true, courseMaterials: true } },
} satisfies Prisma.SectionInclude;

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  private async validateMappings(
    client: PrismaService | Prisma.TransactionClient,
    orgId: string,
    academicCycleId: string,
    courseId: string,
    mappings: SectionProgramMappingInputDto[] = [],
  ) {
    const keys = mappings.map((row) => `${row.programStageOfferingId}:${row.stageCourseRequirementId}`);
    if (new Set(keys).size !== keys.length) throw new ConflictException('Duplicate section program mapping');
    if (!mappings.length) return [];
    const rows = await client.stageCourseRequirement.findMany({
      where: {
        id: { in: mappings.map((row) => row.stageCourseRequirementId) },
        organizationId: orgId,
        courseId,
      },
      include: {
        programStage: {
          include: {
            offerings: {
              where: {
                id: { in: mappings.map((row) => row.programStageOfferingId) },
                programOffering: { academicCycleId },
              },
            },
          },
        },
      },
    });
    const valid = new Set(rows.flatMap((row) => row.programStage.offerings.map((offering) => `${offering.id}:${row.id}`)));
    if (mappings.some((row) => !valid.has(`${row.programStageOfferingId}:${row.stageCourseRequirementId}`))) {
      throw new BadRequestException('Every mapping must match the section course, academic cycle, stage, and requirement');
    }
    return mappings;
  }

  async getSections(orgId: string, options: PaginationOptions, requester?: DepartmentScopedUser) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
    });
    const scope = await getDepartmentScope(this.prisma, orgId, requester);
    const scopeWhere = sectionDepartmentScopeWhere(scope);
    const baseWhere: Prisma.SectionWhereInput = {
      organizationId: orgId,
      ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}),
      ...(options.departmentId ? { course: { departmentId: options.departmentId } } : {}),
      ...(options.academicCycleId ? { academicCycleId: options.academicCycleId } : {}),
      ...(options.activeAcademicCycleOnly ? { academicCycle: { status: AcademicCycleStatus.ACTIVE } } : {}),
      ...(options.cohortId ? { cohortOfferingSections: { some: { cohortOffering: { cohortId: options.cohortId } } } } : {}),
      ...(options.programId ? { programMappings: { some: { programStageOffering: { programOffering: { programId: options.programId } } } } } : {}),
      ...(options.teacherId ? { teachers: { some: { id: options.teacherId } } } : {}),
      ...(options.my && options.userId
        ? { OR: [{ teachers: { some: { userId: options.userId } } }, { enrollments: { some: { student: { userId: options.userId } } } }] }
        : {}),
    };
    const where: Prisma.SectionWhereInput = options.search
      ? {
          ...baseWhere,
          AND: [
            ...(baseWhere.AND ? (Array.isArray(baseWhere.AND) ? baseWhere.AND : [baseWhere.AND]) : []),
            {
              OR: [
                { name: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
                { code: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
                { room: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
                { course: { name: { contains: options.search, mode: Prisma.QueryMode.insensitive } } },
              ],
            },
          ],
        }
      : baseWhere;
    const orderBy: Prisma.SectionOrderByWithRelationInput = sortBy === 'courseName'
      ? { course: { name: sortOrder } }
      : { [sortBy]: sortOrder };
    const [sections, total] = await Promise.all([
      this.prisma.section.findMany({ where, skip, take, include: SECTION_INCLUDE, orderBy }),
      this.prisma.section.count({ where }),
    ]);
    if (options.search && total === 0) {
      const candidates = await this.prisma.section.findMany({ where: baseWhere, take: 500, include: SECTION_INCLUDE, orderBy });
      const ranked = fuzzyFilterAndRank(candidates, options.search, (section) => [
        section.name,
        section.code,
        section.room,
        section.course.name,
        section.course.code,
        section.course.department?.name,
      ]);
      return formatPaginatedResponse(ranked.slice(skip, skip + take).map(this.formatSection), ranked.length, options.page, options.limit);
    }
    return formatPaginatedResponse(sections.map(this.formatSection), total, options.page, options.limit);
  }

  private formatSection(section: Prisma.SectionGetPayload<{ include: typeof SECTION_INCLUDE }>) {
    const cohort = section.cohortOfferingSections[0]?.cohortOffering.cohort;
    return {
      ...section,
      students: section.enrollments.map((enrollment) => ({ ...enrollment.student, user: enrollment.student.user })),
      studentsCount: section._count.enrollments,
      courseMaterialsCount: section._count.courseMaterials,
      programClassificationStatus: section.programMappings.length ? 'PROGRAM_MAPPED' : 'STANDALONE',
      cohortId: cohort?.id,
      cohort,
    };
  }

  async getSectionById(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id }, include: SECTION_INCLUDE });
    if (!section) throw new NotFoundException('Section not found');
    return this.formatSection(section);
  }

  private async assertUnique(orgId: string, data: Pick<CreateSectionDto, 'name' | 'code'>, excludeId?: string) {
    const name = data.name.trim();
    const code = normalizeEntityCode(data.code)!;
    const duplicate = await this.prisma.section.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { name: { equals: name, mode: Prisma.QueryMode.insensitive } },
          { code: { equals: code, mode: Prisma.QueryMode.insensitive } },
        ],
      },
    });
    if (!duplicate) return;
    if (duplicate.name.toLowerCase() === name.toLowerCase()) throw new ConflictException('Section name already exists in this organization');
    throw new ConflictException('Section code already exists in this organization');
  }

  private async assertTeachersBelongToOrg(orgId: string, teacherIds: string[] = []) {
    const ids = [...new Set(teacherIds.filter(Boolean))];
    const count = ids.length ? await this.prisma.teacher.count({ where: { id: { in: ids }, organizationId: orgId } }) : 0;
    if (count !== ids.length) throw new BadRequestException('One or more selected teachers do not belong to this organization');
    return ids;
  }

  private async validateCycle(orgId: string, academicCycleId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({ where: { id: academicCycleId, organizationId: orgId } });
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    return cycle;
  }

  async createSection(orgId: string, data: CreateSectionDto, requester?: DepartmentScopedUser) {
    await this.assertUnique(orgId, data);
    const course = await this.coursesService.validateCourseBelongsToOrg(data.courseId, orgId);
    const scope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(scope, course.departmentId, 'You cannot create a section outside your department scope');
    await this.validateCycle(orgId, data.academicCycleId);
    await assertAcademicCycleWritable(this.prisma, orgId, data.academicCycleId, 'SETUP');
    if (data.defaultRoomId) await validateRoomBelongsToOrg(this.prisma, orgId, data.defaultRoomId);
    const teacherIds = await this.assertTeachersBelongToOrg(orgId, data.teacherIds);
    const mappings = await this.validateMappings(this.prisma, orgId, data.academicCycleId, data.courseId, data.programMappings);
    return this.prisma.section.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        code: normalizeEntityCode(data.code)!,
        color: normalizeSectionColor(data.color, `${orgId}:${data.courseId}:${data.name}`),
        room: data.room,
        defaultRoomId: data.defaultRoomId || null,
        courseId: data.courseId,
        academicCycleId: data.academicCycleId,
        status: data.status ?? SectionLifecycleStatus.ACTIVE,
        teachers: teacherIds.length ? { connect: teacherIds.map((id) => ({ id })) } : undefined,
        programMappings: mappings.length
          ? {
              create: mappings.map((mapping) => ({
                organizationId: orgId,
                programStageOfferingId: mapping.programStageOfferingId,
                stageCourseRequirementId: mapping.stageCourseRequirementId,
                createdById: requester?.id ?? 'system',
              })),
            }
          : undefined,
      },
      include: SECTION_INCLUDE,
    });
  }

  async updateSection(orgId: string, id: string, data: UpdateSectionDto, requester?: DepartmentScopedUser) {
    const { teacherIds, scheduleTeacherResolution, programMappings, ...sectionData } = data;
    const existing = await this.prisma.section.findFirst({
      where: { id, organizationId: orgId },
      include: {
        course: true,
        teachers: { select: { id: true } },
        schedules: { select: { id: true, teacherId: true } },
        programMappings: true,
      },
    });
    if (!existing) throw new NotFoundException('Section not found');
    if (existing.status === SectionLifecycleStatus.ARCHIVED) throw new ConflictException('Archived sections are read-only');
    const scope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(scope, existing.course.departmentId, 'You cannot update a section outside your department scope');
    const nextCourseId = sectionData.courseId ?? existing.courseId;
    if (sectionData.courseId && sectionData.courseId !== existing.courseId) {
      const course = await this.coursesService.validateCourseBelongsToOrg(sectionData.courseId, orgId);
      assertDepartmentInScope(scope, course.departmentId, 'You cannot move a section outside your department scope');
    }
    const nextCycleId = sectionData.academicCycleId ?? existing.academicCycleId;
    await this.validateCycle(orgId, nextCycleId);
    await assertAcademicCycleWritable(this.prisma, orgId, nextCycleId, 'SETUP');
    if (sectionData.defaultRoomId) await validateRoomBelongsToOrg(this.prisma, orgId, sectionData.defaultRoomId);
    if (sectionData.name || sectionData.code) {
      await this.assertUnique(orgId, { name: sectionData.name ?? existing.name, code: sectionData.code ?? existing.code }, id);
    }
    if (sectionData.status && sectionData.status !== existing.status
      && !(existing.status === SectionLifecycleStatus.ACTIVE && sectionData.status === SectionLifecycleStatus.CLOSED)) {
      throw new ConflictException(`Section cannot transition from ${existing.status} to ${sectionData.status}`);
    }
    const nextTeacherIds = teacherIds === undefined ? undefined : await this.assertTeachersBelongToOrg(orgId, teacherIds);
    const removedTeacherIds = nextTeacherIds
      ? existing.teachers.map((teacher) => teacher.id).filter((teacherId) => !nextTeacherIds.includes(teacherId))
      : [];
    const affectedScheduleIds = existing.schedules.filter((schedule) => removedTeacherIds.includes(schedule.teacherId)).map((schedule) => schedule.id);
    if (affectedScheduleIds.length && !scheduleTeacherResolution) {
      throw new BadRequestException('Existing schedules use removed teachers. Move those schedules or delete them.');
    }
    if (scheduleTeacherResolution?.action === 'MOVE'
      && (!scheduleTeacherResolution.teacherId || !nextTeacherIds?.includes(scheduleTeacherResolution.teacherId))) {
      throw new BadRequestException('Choose a remaining assigned teacher for affected schedules');
    }
    const nextMappings = programMappings === undefined
      ? existing.programMappings.map((row) => ({
          programStageOfferingId: row.programStageOfferingId,
          stageCourseRequirementId: row.stageCourseRequirementId,
        }))
      : programMappings;
    await this.validateMappings(this.prisma, orgId, nextCycleId, nextCourseId, nextMappings);

    return this.prisma.$transaction(async (tx) => {
      if (affectedScheduleIds.length && scheduleTeacherResolution?.action === 'DELETE') {
        await tx.attendanceSession.deleteMany({ where: { scheduleId: { in: affectedScheduleIds } } });
        await tx.sectionSchedule.deleteMany({ where: { id: { in: affectedScheduleIds } } });
      } else if (affectedScheduleIds.length && scheduleTeacherResolution?.action === 'MOVE') {
        await tx.sectionSchedule.updateMany({ where: { id: { in: affectedScheduleIds } }, data: { teacherId: scheduleTeacherResolution.teacherId } });
      }
      await tx.sectionProgramMapping.deleteMany({ where: { sectionId: id } });
      if (nextMappings.length) {
        await tx.sectionProgramMapping.createMany({
          data: nextMappings.map((mapping) => ({
            organizationId: orgId,
            sectionId: id,
            programStageOfferingId: mapping.programStageOfferingId,
            stageCourseRequirementId: mapping.stageCourseRequirementId,
            createdById: requester?.id ?? 'system',
          })),
        });
      }
      return tx.section.update({
        where: { id },
        data: {
          ...sectionData,
          name: sectionData.name?.trim(),
          code: sectionData.code ? normalizeEntityCode(sectionData.code)! : undefined,
          color: sectionData.color ? normalizeSectionColor(sectionData.color) : undefined,
          defaultRoomId: sectionData.defaultRoomId === '' ? null : sectionData.defaultRoomId,
          teachers: nextTeacherIds ? { set: nextTeacherIds.map((teacherId) => ({ id: teacherId })) } : undefined,
        },
        include: SECTION_INCLUDE,
      });
    });
  }

  async deleteSection(orgId: string, id: string, requester?: DepartmentScopedUser) {
    const section = await this.prisma.section.findFirst({
      where: { id, organizationId: orgId },
      include: {
        course: true,
        academicCycle: true,
        _count: {
          select: {
            enrollments: true,
            enrollmentHistories: true,
            assessments: true,
            attendanceSessions: true,
            schedules: true,
            courseMaterials: true,
            evaluations: true,
            evaluationWindows: true,
            preferenceOptions: true,
            preferenceAudiences: true,
            archiveSections: true,
            cohortOfferingSections: true,
            programMappings: true,
          },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    const scope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(scope, section.course.departmentId, 'You cannot delete a section outside your department scope');
    const hasActivity = Object.entries(section._count).some(([key, count]) => !['programMappings'].includes(key) && count > 0);
    if (section.academicCycle.status !== AcademicCycleStatus.DRAFT || hasActivity) {
      if (section.status === SectionLifecycleStatus.ACTIVE) {
        await this.prisma.section.update({ where: { id }, data: { status: SectionLifecycleStatus.CLOSED } });
      }
      return { message: 'Section has delivery history and was closed instead of deleted' };
    }
    await this.prisma.section.delete({ where: { id } });
    return { message: 'Unused draft section deleted successfully' };
  }

  async getSectionsByTeacherId(teacherId: string) {
    return this.prisma.section.findMany({ where: { teachers: { some: { id: teacherId } } } });
  }

  async isTeacherAssignedToSection(sectionId: string, teacherUserId: string) {
    return Boolean(await this.prisma.section.findFirst({ where: { id: sectionId, teachers: { some: { userId: teacherUserId } } } }));
  }

  async validateSectionBelongsToOrg(sectionId: string, organizationId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId }, include: { course: true } });
    if (!section) throw new NotFoundException('Section not found');
    if (section.organizationId !== organizationId) throw new ForbiddenException('Section does not belong to your organization');
    return section;
  }
}
