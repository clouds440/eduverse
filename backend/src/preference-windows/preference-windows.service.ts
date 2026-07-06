import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PreferenceTargetType,
  PreferenceWindowKind,
  PreferenceWindowStatus,
  Prisma,
  StudentStatus,
  TargetType,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AnnouncementPriority } from '../announcements/dto/create-announcement.dto';
import { Role } from '../common/enums';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { PreferenceSubmissionDto, PreferenceWindowDto, UpdatePreferenceWindowDto } from './dto/preference-window.dto';

interface CurrentUser extends DepartmentScopedUser {
  id: string;
  role?: string;
  organizationId?: string | null;
}

interface WindowQuery {
  page?: number;
  limit?: number;
  status?: PreferenceWindowStatus;
  kind?: PreferenceWindowKind;
  academicCycleId?: string;
  courseId?: string;
  cohortId?: string;
}

const WINDOW_INCLUDE = {
  academicCycle: { select: { id: true, name: true, code: true, isActive: true } },
  announcement: { select: { id: true, title: true, actionUrl: true, priority: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
  options: {
    include: {
      course: { select: { id: true, name: true, code: true, departmentId: true } },
      section: {
        include: {
          course: { select: { id: true, name: true, code: true, departmentId: true } },
          teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
          defaultRoom: { include: { building: true } },
          schedules: {
            include: {
              roomRef: { include: { building: true } },
              teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
            orderBy: [{ day: 'asc' as const }, { startTime: 'asc' as const }],
          },
          _count: { select: { enrollments: true } },
        },
      },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
  audiences: {
    include: {
      course: { select: { id: true, name: true, code: true, departmentId: true } },
      cohort: { select: { id: true, name: true, code: true, academicCycleId: true } },
      section: { include: { course: { select: { id: true, name: true, code: true, departmentId: true } } } },
    },
  },
  submissions: {
    include: {
      student: { include: { user: { select: { id: true, name: true, email: true } }, enrollments: { select: { sectionId: true } } } },
      ranks: { include: { option: true }, orderBy: { rank: 'asc' as const } },
    },
  },
  _count: { select: { submissions: true, options: true, audiences: true } },
} satisfies Prisma.PreferenceWindowInclude;

function studentWindowInclude(studentId: string): Prisma.PreferenceWindowInclude {
  return {
    ...WINDOW_INCLUDE,
    submissions: {
      where: { studentId },
      include: {
        ranks: { include: { option: true }, orderBy: { rank: 'asc' as const } },
      },
    },
  };
}

@Injectable()
export class PreferenceWindowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcements: AnnouncementsService,
  ) {}

  private unique(values?: string[]) {
    return Array.from(new Set((values ?? []).map((value) => value?.trim()).filter(Boolean)));
  }

  private parseDate(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }

  private async assertOrgAdminOrManager(actor: CurrentUser) {
    if ([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER].includes(actor.role as Role)) return;
    throw new ForbiddenException('You do not have permission to manage preference windows');
  }

  private async assertCourseScope(orgId: string, actor: CurrentUser, courseIds: string[]) {
    if (!courseIds.length) return;
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds }, organizationId: orgId },
      select: { id: true, departmentId: true },
    });
    if (courses.length !== courseIds.length) throw new BadRequestException('One or more courses do not belong to this organization');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    courses.forEach((course) => assertDepartmentInScope(scope, course.departmentId, 'You cannot use courses outside your department scope'));
  }

  private async assertSectionScope(orgId: string, actor: CurrentUser, sectionIds: string[], academicCycleId?: string) {
    if (!sectionIds.length) return;
    const sections = await this.prisma.section.findMany({
      where: {
        id: { in: sectionIds },
        course: { organizationId: orgId },
        ...(academicCycleId ? { academicCycleId } : {}),
      },
      include: { course: { select: { departmentId: true } } },
    });
    if (sections.length !== sectionIds.length) throw new BadRequestException('One or more sections do not belong to this organization or academic cycle');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    sections.forEach((section) => assertDepartmentInScope(scope, section.course.departmentId, 'You cannot use sections outside your department scope'));
  }

  private async validatePayload(orgId: string, dto: PreferenceWindowDto | UpdatePreferenceWindowDto, actor: CurrentUser) {
    await this.assertOrgAdminOrManager(actor);
    const startAt = this.parseDate(dto.startAt, 'startAt');
    const endAt = this.parseDate(dto.endAt, 'endAt');
    if (endAt <= startAt) throw new BadRequestException('endAt must be after startAt');

    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.academicCycleId, organizationId: orgId },
      select: { id: true },
    });
    if (!cycle) throw new BadRequestException('Academic cycle must belong to this organization');

    const optionCourseIds = this.unique(dto.optionCourseIds);
    const optionSectionIds = this.unique(dto.optionSectionIds);
    if (dto.kind === PreferenceWindowKind.COURSE_CHOICE) {
      if (optionCourseIds.length < 2) throw new BadRequestException('Course choice windows require at least two course options');
      await this.assertCourseScope(orgId, actor, optionCourseIds);
    } else {
      if (optionSectionIds.length < 2) throw new BadRequestException('Section choice windows require at least two section options');
      await this.assertSectionScope(orgId, actor, optionSectionIds, dto.academicCycleId);
    }

    const audienceCourseIds = this.unique(dto.audienceCourseIds);
    const audienceCohortIds = this.unique(dto.audienceCohortIds);
    const audienceSectionIds = this.unique(dto.audienceSectionIds);
    if (audienceCourseIds.length + audienceCohortIds.length + audienceSectionIds.length === 0) {
      throw new BadRequestException('At least one audience course, cohort, or section is required');
    }
    await this.assertCourseScope(orgId, actor, audienceCourseIds);
    await this.assertSectionScope(orgId, actor, audienceSectionIds);

    if (audienceCohortIds.length) {
      const cohorts = await this.prisma.cohort.count({ where: { id: { in: audienceCohortIds }, organizationId: orgId } });
      if (cohorts !== audienceCohortIds.length) throw new BadRequestException('One or more cohorts do not belong to this organization');
    }

    if (audienceCourseIds.length && audienceSectionIds.length) {
      const duplicateSections = await this.prisma.section.count({
        where: { id: { in: audienceSectionIds }, courseId: { in: audienceCourseIds } },
      });
      if (duplicateSections > 0) {
        throw new BadRequestException('Do not select sections for a course that is already selected as an audience');
      }
    }

    return { startAt, endAt, optionCourseIds, optionSectionIds, audienceCourseIds, audienceCohortIds, audienceSectionIds };
  }

  private optionCreates(kind: PreferenceWindowKind, courseIds: string[], sectionIds: string[]) {
    const ids = kind === PreferenceWindowKind.COURSE_CHOICE ? courseIds : sectionIds;
    return ids.map((id, index) => ({
      targetType: kind === PreferenceWindowKind.COURSE_CHOICE ? PreferenceTargetType.COURSE : PreferenceTargetType.SECTION,
      courseId: kind === PreferenceWindowKind.COURSE_CHOICE ? id : null,
      sectionId: kind === PreferenceWindowKind.SECTION_CHOICE ? id : null,
      displayOrder: index,
    }));
  }

  private audienceCreates(courseIds: string[], cohortIds: string[], sectionIds: string[]) {
    return [
      ...courseIds.map((courseId) => ({ targetType: PreferenceTargetType.COURSE, courseId, cohortId: null, sectionId: null })),
      ...cohortIds.map((cohortId) => ({ targetType: PreferenceTargetType.COHORT, courseId: null, cohortId, sectionId: null })),
      ...sectionIds.map((sectionId) => ({ targetType: PreferenceTargetType.SECTION, courseId: null, cohortId: null, sectionId })),
    ];
  }

  async list(orgId: string, actor: CurrentUser, query: WindowQuery = {}) {
    await this.assertOrgAdminOrManager(actor);
    const { skip, take } = getPaginationOptions({ page: query.page, limit: query.limit || 25 });
    const where: Prisma.PreferenceWindowWhereInput = {
      organizationId: orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.academicCycleId ? { academicCycleId: query.academicCycleId } : {}),
      ...(query.courseId
        ? { OR: [{ options: { some: { courseId: query.courseId } } }, { audiences: { some: { courseId: query.courseId } } }] }
        : {}),
      ...(query.cohortId ? { audiences: { some: { cohortId: query.cohortId } } } : {}),
    };
    const [data, totalRecords] = await Promise.all([
      this.prisma.preferenceWindow.findMany({ where, include: WINDOW_INCLUDE, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.preferenceWindow.count({ where }),
    ]);
    return formatPaginatedResponse(data, totalRecords, query.page, query.limit || 25);
  }

  async get(orgId: string, id: string, actor: CurrentUser) {
    await this.assertOrgAdminOrManager(actor);
    const window = await this.prisma.preferenceWindow.findFirst({ where: { id, organizationId: orgId }, include: WINDOW_INCLUDE });
    if (!window) throw new NotFoundException('Preference window not found');
    return window;
  }

  async create(orgId: string, dto: PreferenceWindowDto, actor: CurrentUser) {
    const normalized = await this.validatePayload(orgId, dto, actor);
    return this.prisma.preferenceWindow.create({
      data: {
        organizationId: orgId,
        academicCycleId: dto.academicCycleId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        kind: dto.kind,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        createdById: actor.id,
        options: { createMany: { data: this.optionCreates(dto.kind, normalized.optionCourseIds, normalized.optionSectionIds) } },
        audiences: { createMany: { data: this.audienceCreates(normalized.audienceCourseIds, normalized.audienceCohortIds, normalized.audienceSectionIds) } },
      },
      include: WINDOW_INCLUDE,
    });
  }

  async update(orgId: string, id: string, dto: UpdatePreferenceWindowDto, actor: CurrentUser) {
    const existing = await this.prisma.preferenceWindow.findFirst({ where: { id, organizationId: orgId }, include: { submissions: { select: { id: true } } } });
    if (!existing) throw new NotFoundException('Preference window not found');
    if (existing.status !== PreferenceWindowStatus.DRAFT && existing.submissions.length > 0) {
      throw new ConflictException('Preference windows with submissions can only be closed or archived');
    }
    const normalized = await this.validatePayload(orgId, dto, actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.preferenceWindowOption.deleteMany({ where: { windowId: id } });
      await tx.preferenceWindowAudience.deleteMany({ where: { windowId: id } });
      return tx.preferenceWindow.update({
        where: { id },
        data: {
          academicCycleId: dto.academicCycleId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          kind: dto.kind,
          startAt: normalized.startAt,
          endAt: normalized.endAt,
          updatedById: actor.id,
          options: { createMany: { data: this.optionCreates(dto.kind, normalized.optionCourseIds, normalized.optionSectionIds) } },
          audiences: { createMany: { data: this.audienceCreates(normalized.audienceCourseIds, normalized.audienceCohortIds, normalized.audienceSectionIds) } },
        },
        include: WINDOW_INCLUDE,
      });
    });
  }

  private async assertActivationReady(windowId: string) {
    const window = await this.prisma.preferenceWindow.findUnique({
      where: { id: windowId },
      include: {
        options: { include: { course: true, section: { include: { schedules: true } } } },
      },
    });
    if (!window) throw new NotFoundException('Preference window not found');
    if (window.endAt <= new Date()) throw new BadRequestException('Deadline must be in the future before activation');
    if (window.kind === PreferenceWindowKind.SECTION_CHOICE) {
      const missing = window.options.find((option) => !option.section || option.section.schedules.length === 0);
      if (missing) throw new BadRequestException('Every section option must have at least one schedule before activation');
    } else {
      for (const option of window.options) {
        const section = await this.prisma.section.findFirst({
          where: { courseId: option.courseId || '', academicCycleId: window.academicCycleId, schedules: { some: {} } },
          select: { id: true },
        });
        if (!section) throw new BadRequestException('Every course option must have at least one scheduled section in the selected academic cycle');
      }
    }
  }

  async activate(orgId: string, id: string, actor: CurrentUser, priority: AnnouncementPriority = AnnouncementPriority.HIGH) {
    await this.assertOrgAdminOrManager(actor);
    const window = await this.prisma.preferenceWindow.findFirst({ where: { id, organizationId: orgId }, include: { audiences: true } });
    if (!window) throw new NotFoundException('Preference window not found');
    await this.assertActivationReady(id);
    const actionUrl = `/preference-windows/${id}`;
    const announcements: Array<{ id: string }> = [];
    for (const audience of window.audiences) {
      const targetType = audience.targetType === PreferenceTargetType.COURSE
        ? TargetType.COURSE
        : audience.targetType === PreferenceTargetType.COHORT
          ? TargetType.COHORT
          : TargetType.SECTION;
      const targetId = audience.courseId || audience.cohortId || audience.sectionId || undefined;
      if (!targetId) continue;
      announcements.push(await this.announcements.createAnnouncement({
        title: `${window.title} is open`,
        body: `Preference selection is open until ${window.endAt.toLocaleString()}. Choose your ranked preferences before the deadline.`,
        targetType,
        targetId,
        actionUrl,
        priority,
      }, { id: actor.id, role: actor.role as Role, organizationId: orgId }));
    }
    return this.prisma.preferenceWindow.update({
      where: { id },
      data: {
        status: PreferenceWindowStatus.ACTIVE,
        announcementId: announcements[0]?.id,
        updatedById: actor.id,
      },
      include: WINDOW_INCLUDE,
    });
  }

  async close(orgId: string, id: string, actor: CurrentUser) {
    await this.assertOrgAdminOrManager(actor);
    const existing = await this.prisma.preferenceWindow.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Preference window not found');
    return this.prisma.preferenceWindow.update({
      where: { id },
      data: { status: PreferenceWindowStatus.CLOSED, updatedById: actor.id },
      include: WINDOW_INCLUDE,
    });
  }

  async resolveAudienceStudents(windowId: string) {
    const window = await this.prisma.preferenceWindow.findUnique({ where: { id: windowId }, include: { audiences: true } });
    if (!window) throw new NotFoundException('Preference window not found');
    const [courseStudents, cohortStudents, sectionStudents] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          organizationId: window.organizationId,
          status: { not: StudentStatus.DELETED },
          enrollments: { some: { section: { courseId: { in: window.audiences.map((a) => a.courseId).filter(Boolean) as string[] } } } },
        },
        include: { user: { select: { id: true, name: true, email: true } }, enrollments: { select: { sectionId: true } } },
      }),
      this.prisma.student.findMany({
        where: {
          organizationId: window.organizationId,
          status: { not: StudentStatus.DELETED },
          cohortId: { in: window.audiences.map((a) => a.cohortId).filter(Boolean) as string[] },
        },
        include: { user: { select: { id: true, name: true, email: true } }, enrollments: { select: { sectionId: true } } },
      }),
      this.prisma.student.findMany({
        where: {
          organizationId: window.organizationId,
          status: { not: StudentStatus.DELETED },
          enrollments: { some: { sectionId: { in: window.audiences.map((a) => a.sectionId).filter(Boolean) as string[] } } },
        },
        include: { user: { select: { id: true, name: true, email: true } }, enrollments: { select: { sectionId: true } } },
      }),
    ]);
    return Array.from(new Map([...courseStudents, ...cohortStudents, ...sectionStudents].map((student) => [student.id, student])).values());
  }

  async getMy(orgId: string, actor: CurrentUser) {
    const student = await this.prisma.student.findFirst({ where: { userId: actor.id, organizationId: orgId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student profile not found');
    const windows = await this.prisma.preferenceWindow.findMany({
      where: { organizationId: orgId, status: { in: [PreferenceWindowStatus.ACTIVE, PreferenceWindowStatus.CLOSED] } },
      include: studentWindowInclude(student.id),
      orderBy: { endAt: 'asc' },
    });
    const visible: typeof windows = [];
    for (const window of windows) {
      const audience = await this.resolveAudienceStudents(window.id);
      if (audience.some((candidate) => candidate.id === student.id)) visible.push(window);
    }
    return visible;
  }

  async getStudentWindow(orgId: string, id: string, actor: CurrentUser) {
    const student = await this.prisma.student.findFirst({ where: { userId: actor.id, organizationId: orgId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student profile not found');
    const audience = await this.resolveAudienceStudents(id);
    if (!audience.some((candidate) => candidate.id === student.id)) throw new ForbiddenException('You are not included in this preference window');
    const window = await this.prisma.preferenceWindow.findFirst({ where: { id, organizationId: orgId }, include: studentWindowInclude(student.id) });
    if (!window) throw new NotFoundException('Preference window not found');
    return window;
  }

  async submit(orgId: string, id: string, dto: PreferenceSubmissionDto, actor: CurrentUser) {
    const student = await this.prisma.student.findFirst({ where: { userId: actor.id, organizationId: orgId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student profile not found');
    const window = await this.getStudentWindow(orgId, id, actor);
    const now = new Date();
    if (window.status !== PreferenceWindowStatus.ACTIVE || now < window.startAt || now > window.endAt) {
      throw new ConflictException('Preference window is not open');
    }
    const optionIds = window.options.map((option) => option.id);
    const rankedIds = this.unique(dto.rankedOptionIds);
    if (rankedIds.length !== optionIds.length || rankedIds.some((optionId) => !optionIds.includes(optionId))) {
      throw new BadRequestException('Rank every available option exactly once');
    }
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.preferenceSubmission.upsert({
        where: { windowId_studentId: { windowId: id, studentId: student.id } },
        create: { windowId: id, studentId: student.id, submittedById: actor.id },
        update: { submittedById: actor.id, submittedAt: new Date() },
      });
      await tx.preferenceRank.deleteMany({ where: { submissionId: submission.id } });
      await tx.preferenceRank.createMany({
        data: rankedIds.map((optionId, index) => ({ submissionId: submission.id, optionId, rank: index + 1 })),
      });
      return tx.preferenceSubmission.findUnique({
        where: { id: submission.id },
        include: { ranks: { include: { option: true }, orderBy: { rank: 'asc' } } },
      });
    });
  }

  async results(orgId: string, id: string, actor: CurrentUser) {
    const window = await this.get(orgId, id, actor);
    const audience = await this.resolveAudienceStudents(id);
    const submittedStudentIds = new Set(window.submissions.map((submission) => submission.studentId));
    const optionStats = window.options.map((option) => {
      const ranks = window.submissions.flatMap((submission) => submission.ranks.filter((rank) => rank.optionId === option.id));
      const firstChoices = ranks.filter((rank) => rank.rank === 1).length;
      const averageRank = ranks.length ? ranks.reduce((sum, rank) => sum + rank.rank, 0) / ranks.length : null;
      const capacityWarnings: string[] = [];
      if (option.section?.defaultRoom?.capacity && option.section._count.enrollments > option.section.defaultRoom.capacity) {
        capacityWarnings.push(`Default room capacity is ${option.section.defaultRoom.capacity}, current enrollment is ${option.section._count.enrollments}.`);
      }
      if (option.section && option.section.schedules.length === 0) {
        capacityWarnings.push('No schedule is configured.');
      }
      return { optionId: option.id, firstChoices, responses: ranks.length, averageRank, capacityWarnings };
    });
    return {
      window,
      audienceCount: audience.length,
      submittedCount: submittedStudentIds.size,
      pendingCount: audience.length - submittedStudentIds.size,
      optionStats,
      students: audience.map((student) => {
        const submission = window.submissions.find((candidate) => candidate.studentId === student.id) || null;
        return {
          student,
          submitted: Boolean(submission),
          ranks: submission?.ranks || [],
          currentSectionIds: student.enrollments.map((enrollment) => enrollment.sectionId),
        };
      }),
    };
  }
}
