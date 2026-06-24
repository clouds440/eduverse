import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationType, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  sectionDepartmentScopeWhere,
  type DepartmentScopedUser,
} from '../common/department-scope';
import { formatPaginatedResponse, getPaginationOptions } from '../common/utils';
import { EvaluationAggregationService } from './evaluation-aggregation.service';
import { hasBadWords } from '@/common/bad-words.util';
import { EvaluationEligibilityService } from './evaluation-eligibility.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { BulkCreateEvaluationWindowsDto, CreateEvaluationWindowDto, UpdateEvaluationWindowDto } from './dto/evaluation-window.dto';
import { EvaluationVisibilityDto } from './dto/evaluation-visibility.dto';

interface CurrentUser extends DepartmentScopedUser {
  id: string;
  role?: string;
  organizationId?: string | null;
}

interface EvaluationListQuery {
  page?: number;
  limit?: number;
  type?: EvaluationType;
  academicCycleId?: string;
  courseId?: string;
  sectionId?: string;
  teacherId?: string;
  rating?: number;
  ratingMin?: number;
  ratingMax?: number;
  hasFeedback?: boolean;
  isHidden?: boolean;
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: EvaluationEligibilityService,
    private readonly aggregation: EvaluationAggregationService,
  ) {}

  private includeEvaluation = {
    student: { include: { user: { select: { id: true, name: true, email: true } } } },
    section: { include: { course: { select: { id: true, name: true, departmentId: true } } } },
    course: { select: { id: true, name: true, departmentId: true } },
    teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
    academicCycle: { select: { id: true, name: true } },
    window: { select: { id: true, title: true, startDate: true, endDate: true, isActive: true } },
    hiddenBy: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.EvaluationInclude;

  private includeWindow = {
    academicCycle: { select: { id: true, name: true } },
    course: { select: { id: true, name: true, departmentId: true } },
    section: { select: { id: true, name: true, courseId: true } },
    createdBy: { select: { id: true, name: true, email: true } },
    updatedBy: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.EvaluationWindowInclude;

  private parseDate(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return date;
  }

  private normalizeFeedback(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    if (trimmed && hasBadWords(trimmed)) {
      throw new BadRequestException('Feedback contains inappropriate language. Please revise it before submitting.');
    }
    return trimmed ? trimmed : null;
  }

  private async sectionScopeFilter(orgId: string, actor: CurrentUser): Promise<Prisma.SectionWhereInput> {
    const departmentScope = await getDepartmentScope(this.prisma, orgId, actor);
    const departmentWhere = sectionDepartmentScopeWhere(departmentScope);

    if (actor.role === Role.ORG_MANAGER) {
      return {
        ...departmentWhere,
        teachers: { some: { userId: actor.id } },
      };
    }

    return departmentWhere;
  }

  private async ensureEvaluationInActorScope(orgId: string, id: string, actor: CurrentUser) {
    const sectionScope = await this.sectionScopeFilter(orgId, actor);
    const evaluation = await this.prisma.evaluation.findFirst({
      where: {
        id,
        organizationId: orgId,
        section: sectionScope,
      },
      include: this.includeEvaluation,
    });
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    return evaluation;
  }

  async getPending(orgId: string, actor: CurrentUser) {
    return this.eligibility.getStudentPending(orgId, actor);
  }

  async createEvaluation(orgId: string, dto: CreateEvaluationDto, actor: CurrentUser) {
    const context = await this.eligibility.resolveStudentEvaluationContext(
      orgId,
      actor,
      dto.type,
      dto.sectionId,
      dto.teacherId,
    );

    try {
      return await this.prisma.evaluation.create({
        data: {
          organizationId: orgId,
          type: dto.type,
          studentId: context.student.id,
          sectionId: context.section.id,
          courseId: context.course.id,
          teacherId: dto.type === EvaluationType.TEACHER ? context.teacher!.id : null,
          academicCycleId: context.section.academicCycleId,
          windowId: context.window.id,
          rating: dto.rating,
          feedback: this.normalizeFeedback(dto.feedback),
          createdById: actor.id,
        },
        include: this.includeEvaluation,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This evaluation has already been submitted');
      }
      throw error;
    }
  }

  async updateEvaluation(orgId: string, id: string, dto: UpdateEvaluationDto, actor: CurrentUser) {
    const existing = await this.prisma.evaluation.findFirst({
      where: { id, organizationId: orgId, createdById: actor.id },
    });
    if (!existing) throw new NotFoundException('Evaluation not found');

    const context = await this.eligibility.resolveStudentEvaluationContext(
      orgId,
      actor,
      existing.type,
      existing.sectionId,
      existing.teacherId,
    );

    return this.prisma.evaluation.update({
      where: { id },
      data: {
        rating: dto.rating,
        feedback: dto.feedback !== undefined ? this.normalizeFeedback(dto.feedback) : undefined,
        windowId: context.window.id,
        updatedById: actor.id,
      },
      include: this.includeEvaluation,
    });
  }

  async listEvaluations(orgId: string, query: EvaluationListQuery, actor: CurrentUser) {
    const { skip, take } = getPaginationOptions({
      page: query.page,
      limit: query.limit,
    });
    const sectionScope = await this.sectionScopeFilter(orgId, actor);
    const where: Prisma.EvaluationWhereInput = {
      organizationId: orgId,
      section: sectionScope,
      ...(query.type ? { type: query.type } : {}),
      ...(query.academicCycleId ? { academicCycleId: query.academicCycleId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.ratingMin || query.ratingMax
        ? { rating: { gte: query.ratingMin, lte: query.ratingMax } }
        : {}),
      ...(query.hasFeedback === undefined
        ? {}
        : query.hasFeedback
          ? { feedback: { not: null } }
          : { feedback: null }),
      ...(query.isHidden === undefined ? {} : { isHidden: query.isHidden }),
    };

    const [data, totalRecords] = await Promise.all([
      this.prisma.evaluation.findMany({
        where,
        include: this.includeEvaluation,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.evaluation.count({ where }),
    ]);

    return formatPaginatedResponse(data, totalRecords, query.page, query.limit);
  }

  async setVisibility(orgId: string, id: string, dto: EvaluationVisibilityDto, actor: CurrentUser) {
    await this.ensureEvaluationInActorScope(orgId, id, actor);
    return this.prisma.evaluation.update({
      where: { id },
      data: {
        isHidden: dto.isHidden,
        hiddenById: dto.isHidden ? actor.id : null,
        hiddenAt: dto.isHidden ? new Date() : null,
        hiddenReason: dto.isHidden ? this.normalizeFeedback(dto.hiddenReason) : null,
        updatedById: actor.id,
      },
      include: this.includeEvaluation,
    });
  }

  async getTeacherSelfFeedback(orgId: string, actor: CurrentUser, query: EvaluationListQuery) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: actor.id, organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!teacher) throw new ForbiddenException('Teacher profile not found for this organization');

    return this.getTeacherSummary(orgId, teacher.id, actor, {
      ...query,
      includeFeedback: true,
      allowSelf: true,
    });
  }

  async getTeacherSummary(
    orgId: string,
    teacherId: string,
    actor: CurrentUser,
    query: EvaluationListQuery & { includeFeedback?: boolean; allowSelf?: boolean } = {},
  ) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    if (actor.role === Role.TEACHER && teacher.userId !== actor.id && !query.allowSelf) {
      throw new ForbiddenException('Teachers can only view their own feedback');
    }

    const sectionScope = await this.sectionScopeFilter(orgId, actor);
    const where = this.aggregation.summaryWhereForTeacher(orgId, teacherId, {
      section: sectionScope,
      ...(query.academicCycleId ? { academicCycleId: query.academicCycleId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    });

    const summary = await this.aggregation.summarize(where, {
      includeFeedback: query.includeFeedback ?? actor.role !== Role.STUDENT,
      includeHiddenFeedback: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER].includes(actor.role as Role),
      anonymizeFeedback: false,
    });
    return { teacher, ...summary };
  }

  async getCourseSummary(orgId: string, courseId: string, actor: CurrentUser, query: EvaluationListQuery = {}) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: orgId },
      select: { id: true, name: true, departmentId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const sectionScope = await this.sectionScopeFilter(orgId, actor);
    const where = this.aggregation.summaryWhereForCourse(orgId, courseId, {
      section: sectionScope,
      ...(query.academicCycleId ? { academicCycleId: query.academicCycleId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    });

    const summary = await this.aggregation.summarize(where, {
      includeFeedback: true,
      includeHiddenFeedback: [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER].includes(actor.role as Role),
      anonymizeFeedback: ![Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER].includes(actor.role as Role),
    });
    return { course, ...summary };
  }

  private async validateWindowPayload(
    orgId: string,
    dto: CreateEvaluationWindowDto | UpdateEvaluationWindowDto,
    actor: CurrentUser,
    existing?: { academicCycleId: string; courseId: string | null; sectionId: string | null; startDate: Date; endDate: Date },
  ) {
    const academicCycleId = dto.academicCycleId ?? existing?.academicCycleId;
    if (!academicCycleId) throw new BadRequestException('academicCycleId is required');

    const academicCycle = await this.prisma.academicCycle.findFirst({
      where: { id: academicCycleId, organizationId: orgId },
    });
    if (!academicCycle) throw new BadRequestException('Academic cycle must belong to this organization');

    const courseId = dto.courseId !== undefined ? dto.courseId || null : existing?.courseId ?? null;
    const sectionId = dto.sectionId !== undefined ? dto.sectionId || null : existing?.sectionId ?? null;

    const section = sectionId
      ? await this.prisma.section.findFirst({
          where: { id: sectionId, academicCycleId, course: { organizationId: orgId } },
          include: { course: { select: { id: true, departmentId: true } } },
        })
      : null;
    if (sectionId && !section) {
      throw new BadRequestException('Section must belong to this organization and academic cycle');
    }

    const course = courseId
      ? await this.prisma.course.findFirst({ where: { id: courseId, organizationId: orgId } })
      : null;
    if (courseId && !course) throw new BadRequestException('Course must belong to this organization');
    if (section && courseId && section.courseId !== courseId) {
      throw new BadRequestException('Section must belong to the selected course');
    }
    if (actor.role === Role.SUB_ADMIN) {
      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      assertDepartmentInScope(
        scope,
        section?.course.departmentId ?? course?.departmentId ?? null,
        'You can only create evaluation windows for departments in your scope',
      );
    }

    const startDate = dto.startDate ? this.parseDate(dto.startDate, 'startDate') : existing?.startDate;
    const endDate = dto.endDate ? this.parseDate(dto.endDate, 'endDate') : existing?.endDate;
    if (!startDate || !endDate) throw new BadRequestException('startDate and endDate are required');
    if (endDate < startDate) throw new BadRequestException('endDate must be after startDate');

    return { academicCycleId, courseId, sectionId, startDate, endDate };
  }

  private uniqueStrings(values?: string[]) {
    return Array.from(new Set((values ?? []).map((value) => value?.trim()).filter(Boolean)));
  }

  private buildWindowTitle(prefix: string | undefined, parts: string[]) {
    const normalizedPrefix = prefix?.trim() || 'Evaluation Window';
    const title = [normalizedPrefix, ...parts.map((part) => part.trim()).filter(Boolean)].join(' - ');
    return title.length > 160 ? `${title.slice(0, 157).trimEnd()}...` : title;
  }

  private async resolveBulkSections(orgId: string, actor: CurrentUser, dto: BulkCreateEvaluationWindowsDto) {
    const sectionScope = await this.sectionScopeFilter(orgId, actor);
    const cohortIds = this.uniqueStrings(dto.cohortIds);
    const departmentIds = this.uniqueStrings(dto.departmentIds);
    const courseIds = this.uniqueStrings(dto.courseIds);
    const sectionIds = this.uniqueStrings(dto.sectionIds);
    const andFilters: Prisma.SectionWhereInput[] = Object.keys(sectionScope).length ? [sectionScope] : [];

    if (departmentIds.length) {
      andFilters.push({ course: { departmentId: { in: departmentIds } } });
    }

    return this.prisma.section.findMany({
      where: {
        academicCycleId: dto.academicCycleId,
        course: { organizationId: orgId },
        ...(cohortIds.length ? { cohortId: { in: cohortIds } } : {}),
        ...(courseIds.length ? { courseId: { in: courseIds } } : {}),
        ...(sectionIds.length ? { id: { in: sectionIds } } : {}),
        ...(andFilters.length ? { AND: andFilters } : {}),
      },
      include: {
        course: { select: { id: true, name: true, departmentId: true } },
        academicCycle: { select: { id: true, name: true } },
        cohort: { select: { id: true, name: true } },
      },
      orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async listWindows(orgId: string, actor: CurrentUser, query: { academicCycleId?: string; isActive?: boolean } = {}) {
    const sectionScope = await this.sectionScopeFilter(orgId, actor);
    return this.prisma.evaluationWindow.findMany({
      where: {
        organizationId: orgId,
        ...(query.academicCycleId ? { academicCycleId: query.academicCycleId } : {}),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        OR: [
          { sectionId: null },
          { section: sectionScope },
        ],
      },
      include: this.includeWindow,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createWindow(orgId: string, dto: CreateEvaluationWindowDto, actor: CurrentUser) {
    const normalized = await this.validateWindowPayload(orgId, dto, actor);
    return this.prisma.evaluationWindow.create({
      data: {
        organizationId: orgId,
        ...normalized,
        title: dto.title.trim(),
        description: this.normalizeFeedback(dto.description),
        isActive: dto.isActive ?? true,
        createdById: actor.id,
      },
      include: this.includeWindow,
    });
  }

  async createWindowsBulk(orgId: string, dto: BulkCreateEvaluationWindowsDto, actor: CurrentUser) {
    const academicCycle = await this.prisma.academicCycle.findFirst({
      where: { id: dto.academicCycleId, organizationId: orgId },
      select: { id: true },
    });
    if (!academicCycle) throw new BadRequestException('Academic cycle must belong to this organization');

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = this.parseDate(dto.endDate, 'endDate');
    if (endDate < startDate) throw new BadRequestException('endDate must be after startDate');

    const sections = await this.resolveBulkSections(orgId, actor, dto);
    if (sections.length === 0) {
      throw new BadRequestException('No sections match the selected evaluation window scope');
    }

    const rawRecords = dto.targetType === 'COURSE'
      ? Array.from(new Map(sections.map((section) => [
        section.courseId,
        {
          courseId: section.courseId,
          sectionId: null as string | null,
          title: this.buildWindowTitle(dto.titlePrefix, [section.course.name]),
        },
      ])).values())
      : sections.map((section) => ({
        courseId: section.courseId,
        sectionId: section.id,
        title: this.buildWindowTitle(dto.titlePrefix, [section.course.name, section.name]),
      }));

    if (rawRecords.length > 500) {
      throw new BadRequestException('Bulk evaluation window creation is limited to 500 windows at a time');
    }

    let records = rawRecords;
    let skipped = 0;

    if (dto.skipExisting ?? true) {
      const existing = await this.prisma.evaluationWindow.findMany({
        where: {
          organizationId: orgId,
          academicCycleId: dto.academicCycleId,
          startDate,
          endDate,
          ...(dto.targetType === 'COURSE'
            ? { sectionId: null, courseId: { in: rawRecords.map((record) => record.courseId) } }
            : { sectionId: { in: rawRecords.map((record) => record.sectionId).filter(Boolean) as string[] } }),
        },
        select: { courseId: true, sectionId: true },
      });
      const existingTargets = new Set(existing.map((window) => `${window.courseId || ''}:${window.sectionId || ''}`));
      records = rawRecords.filter((record) => !existingTargets.has(`${record.courseId}:${record.sectionId || ''}`));
      skipped = rawRecords.length - records.length;
    }

    const windows = records.length
      ? await this.prisma.$transaction(records.map((record) => (
        this.prisma.evaluationWindow.create({
          data: {
            organizationId: orgId,
            academicCycleId: dto.academicCycleId,
            courseId: record.courseId,
            sectionId: record.sectionId,
            title: record.title,
            description: null,
            startDate,
            endDate,
            isActive: dto.isActive ?? true,
            createdById: actor.id,
          },
          include: this.includeWindow,
        })
      )))
      : [];

    return {
      created: windows.length,
      skipped,
      totalTargets: rawRecords.length,
      windows,
    };
  }

  async updateWindow(orgId: string, id: string, dto: UpdateEvaluationWindowDto, actor: CurrentUser) {
    const existing = await this.prisma.evaluationWindow.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Evaluation window not found');

    const normalized = await this.validateWindowPayload(orgId, dto, actor, existing);
    return this.prisma.evaluationWindow.update({
      where: { id },
      data: {
        ...normalized,
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description: dto.description !== undefined ? this.normalizeFeedback(dto.description) : undefined,
        isActive: dto.isActive,
        updatedById: actor.id,
      },
      include: this.includeWindow,
    });
  }
}
