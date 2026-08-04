import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AcademicCycleStatus, Prisma, ProgramClassificationStatus, SectionLifecycleStatus } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
  fuzzyFilterAndRank,
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
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';

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

  private async validateRequirementMappings(
    client: PrismaService | Prisma.TransactionClient,
    orgId: string,
    input: {
      classification: ProgramClassificationStatus;
      academicCycleId: string;
      courseId: string;
      cohortId?: string | null;
      requirementIds?: string[];
    },
  ) {
    const requirementIds = [...new Set((input.requirementIds || []).filter(Boolean))];
    if (input.classification === ProgramClassificationStatus.STANDALONE) {
      if (requirementIds.length) throw new BadRequestException('Standalone sections cannot include program requirement mappings');
      return { requirementIds: [], programAcademicCycleId: null };
    }
    if (!requirementIds.length) {
      throw new BadRequestException('Program-mapped sections require at least one course requirement mapping');
    }

    const cohort = input.cohortId
      ? await client.cohort.findFirst({
        where: {
          id: input.cohortId,
          organizationId: orgId,
          academicCycleId: input.academicCycleId,
          programClassificationStatus: ProgramClassificationStatus.PROGRAM_MAPPED,
        },
        select: { programAcademicCycleId: true, programStageId: true },
      })
      : null;
    if (input.cohortId && !cohort) throw new BadRequestException('Program-mapped section requires a compatible program-mapped cohort');

    const requirements = await client.stageCourseRequirement.findMany({
      where: {
        id: { in: requirementIds },
        organizationId: orgId,
        courseId: input.courseId,
        programStage: {
          programAcademicCycle: { academicCycleId: input.academicCycleId, status: 'ACTIVE' },
          ...(cohort?.programStageId ? { id: cohort.programStageId } : {}),
        },
      },
      include: {
        programStage: {
          include: {
            curriculumVersion: { include: { programConfigurationRevision: true } },
            programAcademicCycle: { include: { program: true } },
          },
        },
      },
    });
    if (requirements.length !== requirementIds.length) {
      throw new BadRequestException('One or more requirements do not match the section course, cycle, and stage');
    }
    if (requirements.some((requirement) => requirement.programStage.curriculumVersion.status !== 'ACTIVE'
      || requirement.programStage.curriculumVersion.programConfigurationRevision.version !== requirement.programStage.programAcademicCycle.program.configurationVersion)) {
      throw new ConflictException('Section requirements must belong to the current active program curriculum');
    }
    const associationIds = new Set(requirements.map((requirement) => requirement.programStage.programAcademicCycleId));
    if (associationIds.size !== 1) throw new BadRequestException('All section requirements must belong to one program-cycle association');
    const programAcademicCycleId = [...associationIds][0];
    if (cohort?.programAcademicCycleId !== undefined && cohort.programAcademicCycleId !== programAcademicCycleId) {
      throw new BadRequestException('Section requirements do not match the cohort program-cycle association');
    }
    return { requirementIds, programAcademicCycleId };
  }

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

    const baseWhere: Prisma.SectionWhereInput = {
      course: { organizationId: orgId },
      ...(Object.keys(scopeWhere).length ? { AND: [scopeWhere] } : {}),
      ...(options.departmentId ? { course: { organizationId: orgId, departmentId: options.departmentId } } : {}),
      ...(options.academicCycleId ? { academicCycleId: options.academicCycleId } : {}),
      ...(options.activeAcademicCycleOnly ? { academicCycle: { status: AcademicCycleStatus.ACTIVE } } : {}),
      ...(options.cohortId ? { cohortId: options.cohortId } : {}),
      ...(options.programClassificationStatus ? { programClassificationStatus: options.programClassificationStatus as ProgramClassificationStatus } : {}),
      ...(options.programId ? { requirementMappings: { some: { programAcademicCycle: { programId: options.programId } } } } : {}),
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
    };
    const searchWhere: Prisma.SectionWhereInput = options.search
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
      : {};
    const where: Prisma.SectionWhereInput = {
      ...baseWhere,
      ...(options.search
        ? searchWhere
        : {}),
    };

    // Handle nested sorting for course name
    let orderBy: Prisma.SectionOrderByWithRelationInput = {};
    if (sortBy === 'courseName') {
      orderBy = { course: { name: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const include = {
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
        orderBy: [{ day: 'asc' as const }, { startTime: 'asc' as const }],
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
      requirementMappings: {
        include: { stageCourseRequirement: { include: { programStage: true } }, programAcademicCycle: { include: { program: true } } },
      },
      _count: { select: { enrollments: true, courseMaterials: true } },
    } satisfies Prisma.SectionInclude;

    const [sections, totalRecords] = await Promise.all([
      this.prisma.section.findMany({
        where,
        skip,
        take,
        include,
        orderBy,
      }),
      this.prisma.section.count({ where }),
    ]);

    if (options.search && totalRecords === 0) {
      const candidates = await this.prisma.section.findMany({
        where: baseWhere,
        take: 500,
        include,
        orderBy,
      });
      const fuzzySections = fuzzyFilterAndRank(candidates, options.search, (section) => [
        section.name,
        section.code,
        section.room,
        section.course?.name,
        section.course?.code,
        section.course?.department?.name,
        section.defaultRoom?.name,
        section.defaultRoom?.building?.name,
        ...section.teachers.map((teacher) => teacher.user?.name),
      ]);
      const formattedFuzzySections = fuzzySections.slice(skip, skip + take).map((s) => ({
        ...s,
        students: s.enrollments.map((e) => ({
          ...e.student,
          user: e.student.user,
        })),
        studentsCount: s._count?.enrollments || 0,
        courseMaterialsCount: s._count?.courseMaterials || 0,
      }));

      return formatPaginatedResponse(
        formattedFuzzySections,
        fuzzySections.length,
        options.page,
        options.limit,
      );
    }

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
        requirementMappings: {
          include: { stageCourseRequirement: { include: { programStage: true } }, programAcademicCycle: { include: { program: true } } },
        },
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
    await assertAcademicCycleWritable(this.prisma, orgId, data.academicCycleId, 'SETUP');
    const cohort = data.cohortId
      ? await this.prisma.cohort.findFirst({
        where: { id: data.cohortId, organizationId: orgId },
        select: { programClassificationStatus: true, programAcademicCycleId: true, programStageId: true },
      })
      : null;
    if (data.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED
      && cohort?.programClassificationStatus !== ProgramClassificationStatus.PROGRAM_MAPPED) {
      throw new BadRequestException('A program-mapped section requires a compatible program-mapped cohort until requirement mappings are available');
    }
    if (data.programClassificationStatus === ProgramClassificationStatus.STANDALONE
      && cohort?.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED) {
      throw new BadRequestException('A standalone section cannot be assigned to a program-mapped cohort');
    }
    if (data.defaultRoomId) {
      await validateRoomBelongsToOrg(this.prisma, orgId, data.defaultRoomId);
    }
    const teacherIds = await this.assertTeachersBelongToOrg(orgId, data.teacherIds);
    const color = normalizeSectionColor(data.color, `${orgId}:${data.courseId}:${data.name}`);
    return this.prisma.$transaction(async (tx) => {
      const mapping = await this.validateRequirementMappings(tx, orgId, {
        classification: data.programClassificationStatus as ProgramClassificationStatus,
        academicCycleId: data.academicCycleId,
        courseId: data.courseId,
        cohortId: data.cohortId,
        requirementIds: data.stageCourseRequirementIds,
      });
      return tx.section.create({
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
          status: (data.status as SectionLifecycleStatus | undefined) ?? SectionLifecycleStatus.ACTIVE,
          programClassificationStatus: data.programClassificationStatus as ProgramClassificationStatus,
          teachers: teacherIds.length ? { connect: teacherIds.map((id) => ({ id })) } : undefined,
          requirementMappings: mapping.programAcademicCycleId ? {
            create: mapping.requirementIds.map((stageCourseRequirementId) => ({
              organizationId: orgId,
              stageCourseRequirementId,
              programAcademicCycleId: mapping.programAcademicCycleId!,
            })),
          } : undefined,
        },
        include: {
          course: { include: { department: true } },
          defaultRoom: { include: { building: true } },
          teachers: { include: { user: { select: { id: true, email: true, name: true } } } },
          requirementMappings: { include: { stageCourseRequirement: true, programAcademicCycle: { include: { program: true } } } },
        },
      });
    });
  }

  async updateSection(orgId: string, id: string, data: UpdateSectionDto, requester?: DepartmentScopedUser) {
    const { teacherIds: requestedTeacherIds, scheduleTeacherResolution, stageCourseRequirementIds, ...sectionData } = data;
    const existing = await this.prisma.section.findFirst({
      where: { id, course: { organizationId: orgId } },
      include: {
        course: true,
        cohort: true,
        requirementMappings: { select: { stageCourseRequirementId: true } },
        teachers: { select: { id: true } },
        schedules: { select: { id: true, teacherId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Section not found');
    if (existing.status === SectionLifecycleStatus.ARCHIVED) {
      throw new ConflictException('Archived sections are read-only');
    }

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
    await assertAcademicCycleWritable(this.prisma, orgId, sectionData.academicCycleId || existing.academicCycleId, 'SETUP');
    if (sectionData.status !== undefined) {
      const nextStatus = sectionData.status as SectionLifecycleStatus;
      const validStatusChange = existing.status === nextStatus
        || (existing.status === SectionLifecycleStatus.ACTIVE && nextStatus === SectionLifecycleStatus.CLOSED);
      if (!validStatusChange) throw new ConflictException(`Section cannot transition from ${existing.status} to ${nextStatus}`);
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
      const nextClassification = (sectionData.programClassificationStatus ?? existing.programClassificationStatus) as ProgramClassificationStatus;
      const nextAcademicCycleId = sectionData.academicCycleId || existing.academicCycleId;
      const nextCourseId = sectionData.courseId || existing.courseId;
      const nextCohortId = sectionData.cohortId === '' ? null : (sectionData.cohortId ?? existing.cohortId);
      const mapping = await this.validateRequirementMappings(tx, orgId, {
        classification: nextClassification,
        academicCycleId: nextAcademicCycleId,
        courseId: nextCourseId,
        cohortId: nextCohortId,
        requirementIds: stageCourseRequirementIds ?? existing.requirementMappings.map((item) => item.stageCourseRequirementId),
      });
      if (affectedScheduleIds.length > 0 && scheduleTeacherResolution?.action === 'DELETE') {
        await tx.attendanceSession.deleteMany({ where: { scheduleId: { in: affectedScheduleIds } } });
        await tx.sectionSchedule.deleteMany({ where: { id: { in: affectedScheduleIds } } });
      } else if (affectedScheduleIds.length > 0 && scheduleTeacherResolution?.action === 'MOVE') {
        await tx.sectionSchedule.updateMany({
          where: { id: { in: affectedScheduleIds } },
          data: { teacherId: scheduleTeacherResolution.teacherId },
        });
      }

      const updated = await tx.section.update({
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
          requirementMappings: { include: { stageCourseRequirement: true, programAcademicCycle: { include: { program: true } } } },
        },
      });
      if (stageCourseRequirementIds !== undefined || nextClassification !== existing.programClassificationStatus || nextAcademicCycleId !== existing.academicCycleId || nextCourseId !== existing.courseId || nextCohortId !== existing.cohortId) {
        await tx.sectionRequirementMapping.deleteMany({ where: { sectionId: id } });
        if (mapping.programAcademicCycleId) {
          await tx.sectionRequirementMapping.createMany({
            data: mapping.requirementIds.map((stageCourseRequirementId) => ({
              organizationId: orgId,
              sectionId: id,
              stageCourseRequirementId,
              programAcademicCycleId: mapping.programAcademicCycleId!,
            })),
          });
        }
      }
      return tx.section.findUnique({
        where: { id: updated.id },
        include: {
          course: { include: { department: true } },
          defaultRoom: { include: { building: true } },
          teachers: { include: { user: { select: { id: true, email: true, name: true } } } },
          requirementMappings: { include: { stageCourseRequirement: true, programAcademicCycle: { include: { program: true } } } },
        },
      });
    });
  }

  async deleteSection(orgId: string, id: string, requester?: DepartmentScopedUser) {
    const section = await this.prisma.section.findFirst({
      where: { id, course: { organizationId: orgId } },
      include: {
        course: true,
        academicCycle: { select: { status: true } },
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
          },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    const departmentScope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(departmentScope, section.course.departmentId, 'You cannot delete a section outside your department scope');

    const hasActivity = Object.values(section._count).some((count) => count > 0);
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
      select: { id: true, status: true },
    });
    if (!cohort) {
      throw new NotFoundException('Cohort not found for this academic cycle');
    }
    if (cohort.status !== 'ACTIVE') {
      throw new ConflictException('Cannot assign sections to a closed cohort');
    }
  }
}


