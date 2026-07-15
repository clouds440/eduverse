import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, TargetType } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AIKnowledgeService } from './ai-knowledge.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import type { AIToolContext, AIToolResult } from './ai.types';

interface ContextToolInput {
  intent?: string;
  search?: string;
  entities?: string[];
  date?: string;
  startDate?: string;
  endDate?: string;
  include?: string[];
  limit?: number;
}

@Injectable()
export class AIContextToolsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeService: AIKnowledgeService,
    private readonly toolRegistry: AIToolRegistryService,
  ) {}

  onModuleInit() {
    this.toolRegistry.register({
      name: 'getEduVerseContext',
      description:
        'General orchestration context tool for compound Copilot requests. Accepts intent/search/date/startDate/endDate/include and returns separated EduVerse context sections for entities, schedule, academic, operations, policy/docs/flows/routes, communication, and finance without mutating records.',
      run: async (input: unknown, context) => this.getEduVerseContext(parseInput(input), context),
    });

    this.toolRegistry.register({
      name: 'getPolicyContext',
      description:
        'General policy and workflow context tool. Searches EduVerse docs, flows, and role-safe routes for academic, GPA, attendance, grading, enrollment, finance, evaluation, and platform rules.',
      run: async (input: unknown, context) => this.getPolicyContext(parseInput(input), context),
    });

    this.toolRegistry.register({
      name: 'getCommunicationContext',
      description:
        'General communication context tool. Searches visible mail, announcements, and formal communication references for the current user and organization.',
      run: async (input: unknown, context) => this.getCommunicationContext(parseInput(input), context),
    });

    this.toolRegistry.register({
      name: 'getEntityRelationshipContext',
      description:
        'General relationship context tool. Resolves people, roles, departments, courses, sections, cohorts, academic cycles, rooms, schedules, assessments, and enrollments, then returns connected context. Use for "what is X connected to", "what does this student take", and teacher or manager assignment questions.',
      run: async (input: unknown, context) => this.getEntityRelationshipContext(parseInput(input), context),
    });

    this.toolRegistry.register({
      name: 'getAcademicPlanningContext',
      description:
        'General academic planning context tool. Returns role-aware study, teaching, workload, schedule, deadline, attendance, and performance context for planning and prioritization prompts.',
      run: async (input: unknown, context) => this.getAcademicPlanningContext(parseInput(input), context),
    });

    this.toolRegistry.register({
      name: 'getEnrollmentFeasibilityContext',
      description:
        'General enrollment feasibility tool. Checks current load, target course or section, schedule fit, capacity context, academic cycle or cohort fit, and recent performance when available.',
      run: async (input: unknown, context) => this.getEnrollmentFeasibilityContext(parseInput(input), context),
    });
  }

  private async getEduVerseContext(
    input: ContextToolInput,
    context: AIToolContext,
  ): Promise<AIToolResult<unknown>> {
    const include = normalizeIncludes(input);
    const search = input.search ?? '';
    const shared = {
      search,
      limit: input.limit ?? 6,
      ...(input.date ? { date: input.date } : {}),
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.endDate ? { endDate: input.endDate } : {}),
    };
    const requests: Array<{ name: string; input?: Record<string, unknown> }> = [];
    const add = (name: string, toolInput: Record<string, unknown> = shared) => {
      if (!requests.some((request) => request.name === name && JSON.stringify(request.input ?? {}) === JSON.stringify(toolInput))) {
        requests.push({ name, input: toolInput });
      }
    };

    if (include.has('entities')) add('resolveEduVerseEntities', { search, limit: 6 });
    if (include.has('knowledge')) {
      add('searchFlows', { search, limit: 4 });
      add('searchDocs', { search, limit: 5 });
      add('searchRoutes', { search, limit: 4 });
    }
    if (include.has('policy')) add('getPolicyContext', { search, limit: 5 });
    if (include.has('schedule')) {
      add('getScheduleContext', {
        ...shared,
        includeLoad: true,
        includeBottlenecks: hasAny(search, ['bottleneck', 'overloaded', 'workload', 'room']),
      });
    }
    if (include.has('academic')) {
      add('getAcademicPerformanceProfile', { search, limit: 8 });
      if (hasAny(search, ['deadline', 'assignment', 'quiz', 'exam', 'due', 'study plan'])) {
        add('getPendingDeadlines', { search, days: 21, limit: 8 });
      }
      if (hasAny(search, ['enroll', 'enrollment', 'course load', 'too much', 'section'])) {
        add('listSections', { search, limit: 8 });
        add('listCourses', { search, limit: 8 });
      }
    }
    if (include.has('operations')) {
      add('getOperationsContext', {
        search,
        limit: input.limit ?? 6,
        include: ['calendar', 'campus', 'announcements', 'preferences'],
      });
    }
    if (include.has('communication')) add('getCommunicationContext', { search, limit: input.limit ?? 6 });
    if (include.has('finance')) add('getFinanceSummary', { search, limit: input.limit ?? 6 });
    if (include.has('relationships')) add('getEntityRelationshipContext', { search, entities: input.entities, limit: input.limit ?? 6 });
    if (include.has('planning')) add('getAcademicPlanningContext', {
      search,
      limit: input.limit ?? 8,
      ...(input.date ? { date: input.date } : {}),
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.endDate ? { endDate: input.endDate } : {}),
    });
    if (include.has('enrollment')) add('getEnrollmentFeasibilityContext', { search, entities: input.entities, limit: input.limit ?? 8 });

    const results = await this.toolRegistry.runTools(requests.slice(0, 9), context);

    return {
      ok: true,
      data: {
        intent: input.intent ?? 'general',
        include: Array.from(include),
        knownFacts: summarizeKnownFacts(results),
        missingFacts: summarizeMissingFacts(results),
        sections: results.map((result) => ({
          section: friendlyToolSection(result.tool),
          ok: result.result.ok,
          code: result.result.code,
          message: result.result.message,
          data: result.result.ok ? result.result.data : undefined,
        })),
      },
    };
  }

  private async getPolicyContext(
    input: ContextToolInput,
    context: AIToolContext,
  ): Promise<AIToolResult<unknown>> {
    const search = input.search?.trim() ?? '';
    if (search.length < 2) return { ok: true, data: { docs: [], flows: [], routes: [] }, message: 'Policy search query is too short.' };
    return {
      ok: true,
      data: {
        conceptExplanation: this.knowledgeService.searchDocs(search, input.limit ?? 5),
        workflowSteps: this.knowledgeService.searchFlows(search, input.limit ?? 4),
        navigation: this.knowledgeService.searchRoutes(search, context.role, context.userId, input.limit ?? 4),
      },
    };
  }

  private async getCommunicationContext(
    input: ContextToolInput,
    context: AIToolContext,
  ): Promise<AIToolResult<unknown>> {
    if (!context.orgId) return permissionDenied('Organization context is required.');
    const search = input.search?.trim();
    const limit = clampLimit(input.limit, 8);
    const mailWhere: Prisma.MailWhereInput = {
      organizationId: context.orgId,
      ...(search ? {
        OR: [
          { category: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      } : {}),
      AND: [{
        OR: [
          { creatorId: context.userId },
          { assigneeId: context.userId },
          { assignees: { some: { id: context.userId } } },
          ...(context.role ? [{ targetRole: context.role }] : []),
        ],
      }],
    };
    const announcementWhere: Prisma.AnnouncementWhereInput = {
      OR: [
        { organizationId: context.orgId },
        { organizationId: null, targetType: TargetType.GLOBAL },
      ],
      ...(search ? {
        AND: [{
          OR: [
            { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { body: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }],
      } : {}),
    };

    const [mails, announcements] = await Promise.all([
      this.prisma.mail.findMany({
        where: mailWhere,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          subject: true,
          subjectEncryptedContent: { select: { id: true } },
          category: true,
          priority: true,
          status: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.announcement.findMany({
        where: announcementWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          title: true,
          targetType: true,
          priority: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      ok: true,
      data: {
        mails: mails.map((mail) => ({
          subject: mail.subjectEncryptedContent ? 'Encrypted mail' : mail.subject,
          category: mail.category,
          priority: mail.priority,
          status: mail.status,
          messages: mail._count.messages,
          updatedAt: mail.updatedAt,
        })),
        announcements,
        emptyReason: mails.length || announcements.length ? undefined : 'No visible matching communication records were found.',
      },
    };
  }

  private async getEntityRelationshipContext(
    input: ContextToolInput,
    context: AIToolContext,
  ): Promise<AIToolResult<unknown>> {
    const search = input.search ?? '';
    const entities = input.entities?.length ? input.entities : inferEntityKinds(search);
    const requests: Array<{ name: string; input?: Record<string, unknown> }> = [
      { name: 'resolveEduVerseEntities', input: { search, entities, limit: input.limit ?? 8 } },
      { name: 'getScheduleContext', input: { search, limit: input.limit ?? 12, includeLoad: true } },
    ];

    if (entities.some((entity) => ['student', 'teacher', 'course', 'section', 'department'].includes(entity))) {
      requests.push({ name: 'getAcademicPerformanceProfile', input: { search, limit: input.limit ?? 8 } });
    }

    const results = await this.toolRegistry.runTools(requests, context);
    return {
      ok: true,
      data: {
        search,
        entities,
        knownFacts: summarizeKnownFacts(results),
        missingFacts: summarizeMissingFacts(results),
        relationships: results.map((result) => ({
          section: friendlyToolSection(result.tool),
          ok: result.result.ok,
          code: result.result.code,
          message: result.result.message,
          data: result.result.ok ? result.result.data : undefined,
        })),
      },
    };
  }

  private async getAcademicPlanningContext(
    input: ContextToolInput,
    context: AIToolContext,
  ): Promise<AIToolResult<unknown>> {
    const search = input.search ?? '';
    const shared = {
      search,
      limit: input.limit ?? 8,
      ...(input.date ? { date: input.date } : {}),
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.endDate ? { endDate: input.endDate } : {}),
    };
    const requests: Array<{ name: string; input?: Record<string, unknown> }> = [
      { name: 'resolveEduVerseEntities', input: { search, entities: inferEntityKinds(search), limit: input.limit ?? 8 } },
      { name: 'getScheduleContext', input: { ...shared, includeLoad: true, includeBottlenecks: true } },
      { name: 'getAcademicPerformanceProfile', input: { search, limit: input.limit ?? 8, targetType: academicTargetForRole(context.role) } },
      { name: 'getPendingDeadlines', input: { search, days: 21, limit: input.limit ?? 8 } },
    ];

    if (context.role !== 'STUDENT' && context.role !== 'GUARDIAN') {
      requests.push({ name: 'getPendingGrading', input: { search, limit: input.limit ?? 8 } });
      requests.push({ name: 'getStudentsNeedingAttention', input: { search, limit: input.limit ?? 8 } });
    }

    const results = await this.toolRegistry.runTools(requests, context);
    return {
      ok: true,
      data: {
        intent: input.intent ?? 'academic planning',
        search,
        knownFacts: summarizeKnownFacts(results),
        missingFacts: summarizeMissingFacts(results),
        planningSections: results.map((result) => ({
          section: friendlyToolSection(result.tool),
          ok: result.result.ok,
          code: result.result.code,
          message: result.result.message,
          data: result.result.ok ? result.result.data : undefined,
        })),
      },
    };
  }

  private async getEnrollmentFeasibilityContext(
    input: ContextToolInput,
    context: AIToolContext,
  ): Promise<AIToolResult<unknown>> {
    const search = input.search ?? '';
    const requests: Array<{ name: string; input?: Record<string, unknown> }> = [
      { name: 'resolveEduVerseEntities', input: { search, entities: input.entities?.length ? input.entities : ['student', 'course', 'section', 'academicCycle', 'cohort'], limit: input.limit ?? 8 } },
      { name: 'getAcademicPerformanceProfile', input: { search, limit: input.limit ?? 8, targetType: 'student' } },
      { name: 'getScheduleContext', input: { search, limit: input.limit ?? 12, includeLoad: true } },
      { name: 'listSections', input: { search, limit: input.limit ?? 8 } },
      { name: 'listCourses', input: { search, limit: input.limit ?? 8 } },
    ];

    const results = await this.toolRegistry.runTools(requests, context);
    return {
      ok: true,
      data: {
        intent: input.intent ?? 'enrollment feasibility',
        search,
        knownFacts: summarizeKnownFacts(results),
        missingFacts: summarizeMissingFacts(results),
        checks: [
          'current load',
          'target course or section',
          'schedule fit',
          'capacity context',
          'academic cycle or cohort fit',
          'recent performance',
        ],
        feasibilitySections: results.map((result) => ({
          section: friendlyToolSection(result.tool),
          ok: result.result.ok,
          code: result.result.code,
          message: result.result.message,
          data: result.result.ok ? result.result.data : undefined,
        })),
      },
    };
  }
}

function parseInput(input: unknown): ContextToolInput {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const include = Array.isArray(value.include)
    ? value.include.filter((item): item is string => typeof item === 'string')
    : typeof value.include === 'string'
      ? value.include.split(',').map((item) => item.trim())
      : undefined;
  const limit = typeof value.limit === 'number'
    ? value.limit
    : typeof value.limit === 'string'
      ? Number(value.limit)
      : undefined;
  return {
    intent: stringValue(value.intent),
    search: stringValue(value.search ?? value.query ?? value.q),
    entities: Array.isArray(value.entities)
      ? value.entities.filter((item): item is string => typeof item === 'string')
      : undefined,
    date: stringValue(value.date),
    startDate: stringValue(value.startDate),
    endDate: stringValue(value.endDate),
    include,
    limit,
  };
}

function normalizeIncludes(input: ContextToolInput) {
  const include = new Set((input.include?.length ? input.include : ['entities', 'knowledge']).map((item) => item.toLowerCase()));
  if (include.has('all')) {
    return new Set(['entities', 'knowledge', 'policy', 'schedule', 'academic', 'operations', 'communication', 'finance', 'relationships', 'planning', 'enrollment']);
  }
  return include;
}

function friendlyToolSection(name: string) {
  if (name.includes('Docs')) return 'Docs';
  if (name.includes('Flows')) return 'Workflow guide';
  if (name.includes('Routes')) return 'Navigation';
  if (name.includes('Schedule')) return 'Schedule';
  if (name.includes('Academic') || name.includes('Course') || name.includes('Section') || name.includes('Student') || name.includes('Teacher')) return 'Academic records';
  if (name.includes('Operations') || name.includes('Calendar') || name.includes('Campus') || name.includes('Announcement') || name.includes('Preference')) return 'Operations';
  if (name.includes('Communication') || name.includes('Mail')) return 'Communication';
  if (name.includes('Finance')) return 'Finance';
  return 'EduVerse records';
}

function summarizeKnownFacts(results: Array<{ tool: string; result: AIToolResult<unknown> }>) {
  return results
    .filter((result) => result.result.ok)
    .map((result) => `${friendlyToolSection(result.tool)} returned context`)
    .slice(0, 8);
}

function summarizeMissingFacts(results: Array<{ tool: string; result: AIToolResult<unknown> }>) {
  return results
    .filter((result) => !result.result.ok || result.result.message)
    .map((result) => `${friendlyToolSection(result.tool)}: ${result.result.message ?? result.result.code ?? 'not available'}`)
    .slice(0, 8);
}

function hasAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function inferEntityKinds(search: string) {
  const value = search.toLowerCase();
  const entities: string[] = [];
  const add = (entity: string) => {
    if (!entities.includes(entity)) entities.push(entity);
  };

  if (hasAny(value, ['student', 'learner', 'registration', 'roll'])) add('student');
  if (hasAny(value, ['teacher', 'manager', 'faculty', 'instructor', 'staff'])) add('teacher');
  if (hasAny(value, ['course', 'subject', 'class'])) add('course');
  if (hasAny(value, ['section', 'class'])) add('section');
  if (hasAny(value, ['cohort', 'batch'])) add('cohort');
  if (hasAny(value, ['semester', 'academic cycle', 'term', 'summer', 'fall', 'spring'])) add('academicCycle');
  if (hasAny(value, ['department', 'dept'])) add('department');
  if (hasAny(value, ['room', 'building', 'lab', 'campus'])) add('room');
  return entities.length ? entities : ['student', 'teacher', 'course', 'section', 'academicCycle', 'department'];
}

function academicTargetForRole(role?: string | null) {
  if (role === 'STUDENT' || role === 'GUARDIAN') return 'student';
  if (role === 'TEACHER') return 'teacher';
  if (role === 'ORG_ADMIN' || role === 'SUB_ADMIN' || role === 'ORG_MANAGER') return 'organization';
  return 'student';
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function clampLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(12, Math.round(parsed)));
}

function permissionDenied(message: string): AIToolResult<never> {
  return { ok: false, code: 'PERMISSION_DENIED', message };
}
