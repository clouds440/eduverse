import { Injectable, OnModuleInit } from '@nestjs/common';
import { MailStatus, Prisma, Role } from '@/prisma/prisma-client';
import {
  courseDepartmentScopeWhere,
  getDepartmentScope,
  sectionDepartmentScopeWhere,
  studentDepartmentScopeWhere,
  teacherDepartmentScopeWhere,
} from '../common/department-scope';
import { fuzzySearchScore, normalizeSearchText } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

const OVERSIGHT_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER]);
const STAFF_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.FINANCE_MANAGER]);
const STUDENT_VISIBLE_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.FINANCE_MANAGER]);
const ORG_STAFF_TARGET_ROLES = new Set<string>([Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.FINANCE_MANAGER]);

type EntityKind =
  | 'academicCycle'
  | 'course'
  | 'section'
  | 'student'
  | 'teacher'
  | 'department'
  | 'mail';

interface EntityResolverInput {
  search?: string;
  entity?: string;
  entities?: string[];
  limit?: number;
}

@Injectable()
export class AIEntityResolverService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.toolRegistry.register({
      name: 'resolveEduVerseEntities',
      description:
        'Fuzzy-search visible EduVerse entities by keyword before using a domain tool. Supports courses, sections, academic cycles/semesters, students, teachers/managers/staff, departments, and mail threads. Returns user-safe labels, confidence, and ambiguity hints so Copilot can distinguish unknown entities from known entities with missing related records.',
      run: (input, context) => this.resolveEntities(context, parseInput(input)),
    });
  }

  private async resolveEntities(
    context: AIToolContext,
    input: EntityResolverInput,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');

    const search = normalizeSearchText(input.search ?? '');
    const kinds = requestedKinds(input, search);
    const limit = clampLimit(input.limit, 6);
    const results: Record<string, unknown[]> = {};

    await Promise.all(kinds.map(async (kind) => {
      results[kind] = await this.searchKind(kind, context, search, limit);
    }));

    const ambiguity = Object.entries(results)
      .map(([kind, matches]) => ({
        kind,
        count: matches.length,
        topLabels: matches.slice(0, 3).map((match) => (match as { label?: string }).label).filter(Boolean),
      }))
      .filter((entry) => entry.count > 1);

    return {
      ok: true,
      data: {
        search,
        requestedEntities: kinds,
        results,
        needsClarification: ambiguity.length > 0,
        ambiguity,
        instruction:
          ambiguity.length > 0
            ? 'If the user did not clearly identify one result, ask a short clarifying question before using a domain-specific tool.'
            : 'Use the returned IDs with domain-specific tools when they are relevant.',
      },
    };
  }

  private searchKind(kind: EntityKind, context: AIToolContext, search: string, limit: number) {
    if (kind === 'academicCycle') return this.searchAcademicCycles(context, search, limit);
    if (kind === 'course') return this.searchCourses(context, search, limit);
    if (kind === 'section') return this.searchSections(context, search, limit);
    if (kind === 'student') return this.searchStudents(context, search, limit);
    if (kind === 'teacher') return this.searchTeachers(context, search, limit);
    if (kind === 'department') return this.searchDepartments(context, search, limit);
    return this.searchMails(context, search, limit);
  }

  private async searchAcademicCycles(context: AIToolContext, search: string, limit: number) {
    const where = await this.academicCycleWhereForActor(context, search);
    const cycles = await this.prisma.academicCycle.findMany({
      where,
      take: 40,
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    });
    const ranked = rankOrDefault(cycles, search, (cycle) => [cycle.name, cycle.code], limit);
    return ranked.map(({ item: cycle, confidence }) => ({
      entity: 'academicCycle',
      academicCycleId: cycle.id,
      label: cycle.name,
      code: cycle.code,
      isActive: cycle.isActive,
      startDate: dateKey(cycle.startDate),
      endDate: dateKey(cycle.endDate),
      confidence,
    }));
  }

  private async searchCourses(context: AIToolContext, search: string, limit: number) {
    const where = await this.courseWhereForActor(context, search);
    const courses = await this.prisma.course.findMany({
      where,
      take: 60,
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    const ranked = rankOrDefault(courses, search, (course) => [course.name, course.code, course.department?.name], limit);
    return ranked.map(({ item: course, confidence }) => ({
      entity: 'course',
      courseId: course.id,
      label: course.name,
      code: course.code,
      department: course.department?.name ?? null,
      href: '/courses',
      confidence,
    }));
  }

  private async searchSections(context: AIToolContext, search: string, limit: number) {
    const where = await this.sectionWhereForActor(context, search);
    const sections = await this.prisma.section.findMany({
      where,
      take: 60,
      include: {
        academicCycle: { select: { id: true, name: true, code: true, isActive: true } },
        course: { select: { id: true, name: true, code: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
    });
    const ranked = rankOrDefault(sections, search, (section) => [
      section.name,
      section.code,
      section.course.name,
      section.course.code,
      section.academicCycle.name,
      section.academicCycle.code,
    ], limit);
    return ranked.map(({ item: section, confidence }) => ({
      entity: 'section',
      sectionId: section.id,
      label: `${section.course.name} - ${section.name}`,
      name: section.name,
      code: section.code,
      courseId: section.course.id,
      courseName: section.course.name,
      academicCycleId: section.academicCycle.id,
      academicCycle: section.academicCycle.name,
      academicCycleIsActive: section.academicCycle.isActive,
      enrolledStudents: section._count.enrollments,
      href: `/sections/${section.id}`,
      confidence,
    }));
  }

  private async searchStudents(context: AIToolContext, search: string, limit: number) {
    const where = await this.studentWhereForActor(context, search);
    const students = await this.prisma.student.findMany({
      where,
      take: 60,
      include: {
        user: { select: { id: true, name: true, email: true } },
        primaryDepartment: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    const ranked = rankOrDefault(students, search, (student) => [
      student.user?.name,
      student.user?.email,
      student.registrationNumber,
      student.rollNumber,
      student.primaryDepartment?.name,
    ], limit);
    return ranked.map(({ item: student, confidence }) => ({
      entity: 'student',
      studentId: student.id,
      userId: student.userId,
      label: student.user?.name ?? student.user?.email ?? 'Student',
      email: student.user?.email ?? null,
      registrationNumber: student.registrationNumber,
      rollNumber: student.rollNumber,
      department: student.primaryDepartment?.name ?? student.department ?? null,
      href: `/student/${student.userId}`,
      confidence,
    }));
  }

  private async searchTeachers(context: AIToolContext, search: string, limit: number) {
    const where = await this.teacherWhereForActor(context, search);
    const teachers = await this.prisma.teacher.findMany({
      where,
      take: 60,
      include: {
        user: { select: { id: true, name: true, email: true } },
        teacherDepartments: { include: { department: { select: { id: true, name: true } } } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    const ranked = rankOrDefault(teachers, search, (teacher) => [
      teacher.user?.name,
      teacher.user?.email,
      teacher.subject,
      teacher.designation,
      ...teacher.teacherDepartments.map((entry) => entry.department.name),
    ], limit);
    return ranked.map(({ item: teacher, confidence }) => ({
      entity: 'teacher',
      teacherId: teacher.id,
      userId: teacher.userId,
      label: teacher.user?.name ?? teacher.user?.email ?? 'Teacher',
      email: teacher.user?.email ?? null,
      subject: teacher.subject,
      designation: teacher.designation,
      departments: teacher.teacherDepartments.map((entry) => entry.department.name),
      href: `/teacher/${teacher.userId}`,
      confidence,
    }));
  }

  private async searchDepartments(context: AIToolContext, search: string, limit: number) {
    if (!OVERSIGHT_ROLES.has(context.role ?? '')) return [];
    const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
    const departments = await this.prisma.department.findMany({
      where: {
        organizationId: context.orgId,
        ...(scope.applies && !scope.all ? { id: { in: scope.departmentIds } } : {}),
        ...tokenSearch(search, ['name', 'code']),
      },
      take: 60,
      orderBy: { name: 'asc' },
    });
    const ranked = rankOrDefault(departments, search, (department) => [department.name, department.code], limit);
    return ranked.map(({ item: department, confidence }) => ({
      entity: 'department',
      departmentId: department.id,
      label: department.name,
      code: department.code,
      confidence,
    }));
  }

  private async searchMails(context: AIToolContext, search: string, limit: number) {
    const where = this.mailWhereForActor(context, search);
    const mails = await this.prisma.mail.findMany({
      where,
      take: 60,
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
        subjectEncryptedContent: { select: { id: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const ranked = rankOrDefault(mails, search, (mail) => [
      mail.subjectEncryptedContent ? undefined : mail.subject,
      mail.category,
      mail.priority,
      mail.status,
      mail.creator?.name,
      mail.creator?.email,
      mail.assignee?.name,
      mail.assignee?.email,
    ], limit);
    return ranked.map(({ item: mail, confidence }) => ({
      entity: 'mail',
      mailId: mail.id,
      label: mail.subjectEncryptedContent ? 'Encrypted mail' : mail.subject,
      category: mail.category,
      priority: mail.priority,
      status: mail.status,
      creator: mail.creator?.name ?? mail.creator?.email ?? null,
      assignee: mail.assignee?.name ?? mail.assignee?.email ?? null,
      messages: mail._count.messages,
      updatedAt: mail.updatedAt.toISOString(),
      href: `/mail?mailId=${mail.id}`,
      confidence,
    }));
  }

  private async academicCycleWhereForActor(context: AIToolContext, search: string): Promise<Prisma.AcademicCycleWhereInput> {
    const base: Prisma.AcademicCycleWhereInput = { organizationId: context.orgId };
    const searchWhere = cycleSearch(search);

    if (context.role === Role.STUDENT) {
      return {
        ...base,
        sections: { some: { enrollments: { some: { student: { userId: context.userId } } } } },
        ...searchWhere,
      };
    }
    if (context.role === Role.GUARDIAN) {
      return {
        ...base,
        sections: { some: { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } } },
        ...searchWhere,
      };
    }
    if (context.role === Role.TEACHER) {
      return { ...base, sections: { some: { teachers: { some: { userId: context.userId } } } }, ...searchWhere };
    }
    if (STAFF_ROLES.has(context.role ?? '')) return { ...base, ...searchWhere };
    return { id: '__not_visible__' };
  }

  private async courseWhereForActor(context: AIToolContext, search: string): Promise<Prisma.CourseWhereInput> {
    const base: Prisma.CourseWhereInput = { organizationId: context.orgId, ...courseSearch(search) };
    if (context.role === Role.STUDENT) return withAnd(base, { sections: { some: { enrollments: { some: { student: { userId: context.userId } } } } } });
    if (context.role === Role.GUARDIAN) return withAnd(base, { sections: { some: { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } } } });
    if (context.role === Role.TEACHER) return withAnd(base, { sections: { some: { teachers: { some: { userId: context.userId } } } } });
    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, courseDepartmentScopeWhere(scope));
    }
    return { id: '__not_visible__' };
  }

  private async sectionWhereForActor(context: AIToolContext, search: string): Promise<Prisma.SectionWhereInput> {
    const base: Prisma.SectionWhereInput = { organizationId: context.orgId, ...sectionSearch(search) };
    if (context.role === Role.STUDENT) return withAnd(base, { enrollments: { some: { student: { userId: context.userId } } } });
    if (context.role === Role.GUARDIAN) return withAnd(base, { enrollments: { some: { student: { guardianLinks: { some: { guardian: { userId: context.userId } } } } } } });
    if (context.role === Role.TEACHER) return withAnd(base, { teachers: { some: { userId: context.userId } } });
    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, sectionDepartmentScopeWhere(scope));
    }
    return { id: '__not_visible__' };
  }

  private async studentWhereForActor(context: AIToolContext, search: string): Promise<Prisma.StudentWhereInput> {
    const base: Prisma.StudentWhereInput = { organizationId: context.orgId, ...studentSearch(search) };
    if (context.role === Role.STUDENT) return withAnd(base, { userId: context.userId });
    if (context.role === Role.GUARDIAN) return withAnd(base, { guardianLinks: { some: { guardian: { userId: context.userId } } } });
    if (context.role === Role.TEACHER) return withAnd(base, { enrollments: { some: { section: { teachers: { some: { userId: context.userId } } } } } });
    if (STUDENT_VISIBLE_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, studentDepartmentScopeWhere(scope));
    }
    return { id: '__not_visible__' };
  }

  private async teacherWhereForActor(context: AIToolContext, search: string): Promise<Prisma.TeacherWhereInput> {
    const base: Prisma.TeacherWhereInput = { organizationId: context.orgId, ...teacherSearch(search) };
    if (context.role === Role.TEACHER) return withAnd(base, { userId: context.userId });
    if (OVERSIGHT_ROLES.has(context.role ?? '')) {
      const scope = await getDepartmentScope(this.prisma, context.orgId, actorForScopedServices(context));
      return withAnd(base, teacherDepartmentScopeWhere(scope));
    }
    return { id: '__not_visible__' };
  }

  private mailWhereForActor(context: AIToolContext, search: string): Prisma.MailWhereInput {
    const activeStatuses = [MailStatus.OPEN, MailStatus.IN_PROGRESS, MailStatus.AWAITING_RESPONSE];
    const searchWhere = mailSearch(search);
    const visibility: Prisma.MailWhereInput[] = [
      { creatorId: context.userId },
      { assigneeId: context.userId },
      { assignees: { some: { id: context.userId } } },
      { targetRole: context.role },
    ];
    if (context.role && ORG_STAFF_TARGET_ROLES.has(context.role)) {
      visibility.push({ targetRole: 'ORG_STAFF' });
    }
    if (context.role === Role.ORG_ADMIN || context.role === Role.SUB_ADMIN) {
      visibility.push({ organizationId: context.orgId });
    }

    return {
      organizationId: context.orgId,
      status: search ? undefined : { in: activeStatuses },
      AND: [{ OR: visibility }, searchWhere].filter((item) => Object.keys(item).length > 0),
    };
  }
}

function requestedKinds(input: EntityResolverInput, search: string): EntityKind[] {
  const raw = [
    input.entity,
    ...(Array.isArray(input.entities) ? input.entities : []),
  ].filter((value): value is string => Boolean(value));
  const normalized = new Set(raw.flatMap(entityAliases));
  const text = normalizeSearchText(`${raw.join(' ')} ${search}`);

  if (!normalized.size) {
    if (mentionsAny(text, ['semester', 'term', 'cycle', 'academic cycle'])) normalized.add('academicCycle');
    if (mentionsAny(text, ['course', 'subject', 'class'])) normalized.add('course');
    if (mentionsAny(text, ['section', 'class'])) normalized.add('section');
    if (mentionsAny(text, ['student', 'learner', 'registration', 'roll'])) normalized.add('student');
    if (mentionsAny(text, ['teacher', 'faculty', 'instructor', 'manager', 'staff'])) normalized.add('teacher');
    if (mentionsAny(text, ['department', 'dept'])) normalized.add('department');
    if (mentionsAny(text, ['mail', 'message', 'thread', 'ticket'])) normalized.add('mail');
  }

  if (!normalized.size) {
    return ['academicCycle', 'course', 'section', 'student', 'teacher', 'department', 'mail'];
  }

  return Array.from(normalized).filter(isEntityKind);
}

function entityAliases(value: string): EntityKind[] {
  const text = normalizeSearchText(value);
  if (['semester', 'semesters', 'term', 'terms', 'cycle', 'cycles', 'academic cycle', 'academic cycles', 'academiccycle'].includes(text)) return ['academicCycle'];
  if (['course', 'courses', 'subject', 'subjects', 'class', 'classes'].includes(text)) return ['course'];
  if (['section', 'sections', 'class section', 'class sections'].includes(text)) return ['section'];
  if (['student', 'students', 'learner', 'learners'].includes(text)) return ['student'];
  if (['teacher', 'teachers', 'faculty', 'instructor', 'instructors', 'manager', 'managers', 'staff'].includes(text)) return ['teacher'];
  if (['department', 'departments', 'dept', 'depts'].includes(text)) return ['department'];
  if (['mail', 'mails', 'message', 'messages', 'thread', 'threads', 'ticket', 'tickets'].includes(text)) return ['mail'];
  return [];
}

function isEntityKind(value: string): value is EntityKind {
  return ['academicCycle', 'course', 'section', 'student', 'teacher', 'department', 'mail'].includes(value);
}

function tokenSearch<T extends string>(search: string, fields: T[]) {
  const tokens = searchTokens(search);
  if (!tokens.length) return {};
  return {
    OR: fields.flatMap((field) => tokens.map((token) => ({
      [field]: { contains: token, mode: Prisma.QueryMode.insensitive },
    }))),
  };
}

function cycleSearch(search: string): Prisma.AcademicCycleWhereInput {
  return tokenSearch(search, ['name', 'code']);
}

function courseSearch(search: string): Prisma.CourseWhereInput {
  const tokens = searchTokens(search);
  if (!tokens.length) return {};
  return {
    OR: tokens.flatMap((token) => [
      { name: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { code: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { department: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { department: { code: { contains: token, mode: Prisma.QueryMode.insensitive } } },
    ]),
  };
}

function sectionSearch(search: string): Prisma.SectionWhereInput {
  const tokens = searchTokens(search);
  if (!tokens.length) return {};
  return {
    OR: tokens.flatMap((token) => [
      { name: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { code: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { course: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { course: { code: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { academicCycle: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { academicCycle: { code: { contains: token, mode: Prisma.QueryMode.insensitive } } },
    ]),
  };
}

function studentSearch(search: string): Prisma.StudentWhereInput {
  const tokens = searchTokens(search);
  if (!tokens.length) return {};
  return {
    OR: tokens.flatMap((token) => [
      { registrationNumber: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { rollNumber: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { user: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { user: { email: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { primaryDepartment: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
    ]),
  };
}

function teacherSearch(search: string): Prisma.TeacherWhereInput {
  const tokens = searchTokens(search);
  if (!tokens.length) return {};
  return {
    OR: tokens.flatMap((token) => [
      { subject: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { designation: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { user: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { user: { email: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { teacherDepartments: { some: { department: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } } } },
    ]),
  };
}

function mailSearch(search: string): Prisma.MailWhereInput {
  const tokens = searchTokens(search);
  if (!tokens.length) return {};
  const statusMatches = tokens
    .map(statusSearch)
    .filter((status): status is { equals: MailStatus } => Boolean(status));
  return {
    OR: [
      ...tokens.flatMap((token) => [
      {
        AND: [
          { subjectEncryptedContent: null },
          { subject: { contains: token, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      { category: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { priority: { contains: token, mode: Prisma.QueryMode.insensitive } },
      { creator: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { creator: { email: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { assignee: { name: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      { assignee: { email: { contains: token, mode: Prisma.QueryMode.insensitive } } },
      ]),
      ...statusMatches.map((status) => ({ status })),
    ],
  };
}

function statusSearch(token: string) {
  const match = Object.values(MailStatus).find((status) => normalizeSearchText(status).includes(token));
  return match ? { equals: match } : undefined;
}

function searchTokens(search: string) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'by', 'for', 'in', 'of', 'on', 'or', 'to',
    'the', 'this', 'that', 'with', 'from', 'has', 'have', 'having', 'highest', 'lowest', 'current',
    'semester', 'course', 'courses', 'section', 'sections', 'student', 'students',
    'teacher', 'teachers', 'mail', 'mails', 'show', 'what', 'which', 'about', 'performance',
    'enrollment', 'enrollments', 'enrolled', 'count', 'counts', 'rank', 'ranking',
    'performing', 'improve', 'improvement', 'summary', 'summarize',
  ]);
  return normalizeSearchText(search)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token))
    .slice(0, 8);
}

function rankOrDefault<T>(
  items: T[],
  search: string,
  values: (item: T) => Array<string | number | null | undefined>,
  limit: number,
) {
  const ranked = searchTokens(search).length
    ? items
      .map((item) => ({ item, score: fuzzySearchScore(search, values(item)) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
    : items.map((item) => ({ item, score: 1 }));
  return ranked.slice(0, limit).map(({ item, score }) => ({
    item,
    confidence: score >= 120 ? 'high' : score >= 45 ? 'medium' : 'low',
  }));
}

function withAnd<T extends { AND?: unknown }>(base: T, extra: T): T {
  return { ...base, AND: [...arrayOf(base.AND), extra] };
}

function arrayOf(value: unknown) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function actorForScopedServices(context: AIToolContext) {
  return { id: context.userId, role: context.role };
}

function parseInput(value: unknown): EntityResolverInput {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  return {
    search: stringValue(input.search),
    entity: stringValue(input.entity),
    entities: Array.isArray(input.entities) ? input.entities.map(stringValue).filter(Boolean) as string[] : undefined,
    limit: numberValue(input.limit),
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function clampLimit(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.floor(number), 1), 20);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mentionsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function permissionDenied(message: string): AIToolResult<unknown> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}
