import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CohortLifecycleStatus,
  CohortOfferingStatus,
  CohortSectionSource,
  EnrollmentSource,
  Prisma,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { AssignCohortSectionDto, CreateCohortOfferingDto, UpdateCohortOfferingDto } from './dto/cohort-offering.dto';
import { formatPaginatedResponse, getPaginationOptions, PaginationOptions } from '../common/utils';
import { normalizeEntityCode } from '../common/entity-code';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { StudentProgramEnrollmentsService } from '../student-program-enrollments/student-program-enrollments.service';
import { Role } from '../common/enums';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';
import { assertLifecycleTransition, COHORT_OFFERING_TRANSITIONS } from '../common/offering-lifecycle';
import { CourseResultSchemesService } from '../course-result-schemes/course-result-schemes.service';
import { buildMissingEnrollmentPreview, enrollmentPairKey } from '../common/enrollment-preview';
import { SECTION_COMPONENT_OMIT } from '../common/section-query';

type Transaction = Prisma.TransactionClient;
type Actor = DepartmentScopedUser & { id: string };

const COHORT_INCLUDE = {
  offerings: {
    orderBy: { academicCycle: { startDate: 'desc' as const } },
    include: {
      academicCycle: true,
      programStageOffering: {
        include: {
          programStage: true,
          programOffering: { include: { program: { include: { department: true } } } },
        },
      },
      sections: { include: { section: { include: { course: true }, omit: SECTION_COMPONENT_OMIT } } },
      memberships: { where: { leftAt: null }, include: { student: { include: { user: true } } } },
      _count: { select: { memberships: true, sections: true, stageEnrollments: true } },
    },
  },
} satisfies Prisma.CohortInclude;

@Injectable()
export class CohortsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentPrograms: StudentProgramEnrollmentsService,
    private readonly courseResultSchemes: CourseResultSchemesService,
  ) {}

  private async assertCodeUnique(orgId: string, value: string, excludeId?: string) {
    const code = normalizeEntityCode(value);
    if (!code) throw new BadRequestException('Cohort code is required');
    const duplicate = await this.prisma.cohort.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        code: { equals: code, mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Cohort code already exists in this organization');
  }

  private async assertDepartmentContext(orgId: string, actor: Actor, departmentIds: Array<string | null | undefined>) {
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (!scope.applies || scope.all) return;
    const ids = [...new Set(departmentIds.filter((id): id is string => Boolean(id)))];
    if (!ids.length) throw new ForbiddenException('This cohort operation has no department context and requires organization-wide scope');
    ids.forEach((departmentId) => assertDepartmentInScope(scope, departmentId, 'You cannot manage this cohort outside your assigned departments'));
  }

  private async assertOfferingScope(orgId: string, offeringId: string, actor: Actor) {
    const offering = await this.prisma.cohortOffering.findFirst({
      where: { id: offeringId, organizationId: orgId },
      include: {
        programStageOffering: { include: { programOffering: { include: { program: true } } } },
        sections: { include: { section: { include: { course: true }, omit: SECTION_COMPONENT_OMIT } } },
      },
    });
    if (!offering) throw new NotFoundException('Cohort offering not found');
    if (!([CohortOfferingStatus.PLANNED, CohortOfferingStatus.ACTIVE] as CohortOfferingStatus[]).includes(offering.status)) {
      throw new ConflictException('Closed or cancelled cohort offerings cannot be changed');
    }
    await this.assertDepartmentContext(orgId, actor, [
      offering.programStageOffering?.programOffering.program.departmentId,
      ...offering.sections.map((link) => link.section.course.departmentId),
    ]);
    return offering;
  }

  private async assertCohortScope(orgId: string, cohortId: string, actor: Actor) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, organizationId: orgId },
      include: {
        offerings: {
          include: {
            programStageOffering: { include: { programOffering: { include: { program: true } } } },
            sections: { include: { section: { include: { course: true }, omit: SECTION_COMPONENT_OMIT } } },
          },
        },
      },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    await this.assertDepartmentContext(orgId, actor, cohort.offerings.flatMap((offering) => [
      offering.programStageOffering?.programOffering.program.departmentId,
      ...offering.sections.map((link) => link.section.course.departmentId),
    ]));
    return cohort;
  }

  private async offering(orgId: string, id: string) {
    const offering = await this.prisma.cohortOffering.findFirst({
      where: { id, organizationId: orgId },
      include: {
        cohort: true,
        academicCycle: true,
        programStageOffering: {
          include: { programStage: true, programOffering: { include: { program: true } } },
        },
        sections: { include: { section: { omit: SECTION_COMPONENT_OMIT } } },
      },
    });
    if (!offering) throw new NotFoundException('Cohort offering not found');
    return offering;
  }

  async createCohort(orgId: string, dto: CreateCohortDto) {
    await this.assertCodeUnique(orgId, dto.code);
    return this.prisma.cohort.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        code: normalizeEntityCode(dto.code)!,
        status: dto.status ?? CohortLifecycleStatus.ACTIVE,
      },
      include: COHORT_INCLUDE,
    });
  }

  async createOffering(orgId: string, cohortId: string, dto: CreateCohortOfferingDto, actor: Actor) {
    if (dto.status && dto.status !== CohortOfferingStatus.PLANNED) {
      throw new ConflictException('New cohort offerings must start as PLANNED');
    }
    const [cohort, cycle] = await Promise.all([
      this.prisma.cohort.findFirst({ where: { id: cohortId, organizationId: orgId } }),
      this.prisma.academicCycle.findFirst({ where: { id: dto.academicCycleId, organizationId: orgId } }),
    ]);
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    if (cohort.status !== CohortLifecycleStatus.ACTIVE) throw new ConflictException('Only active cohorts can be offered');
    await assertAcademicCycleWritable(this.prisma, orgId, cycle.id, 'SETUP');

    let stageOffering: { id: string; programOffering: { program: { departmentId: string } } } | null = null;
    if (dto.programStageOfferingId) {
      stageOffering = await this.prisma.programStageOffering.findFirst({
        where: {
          id: dto.programStageOfferingId,
          organizationId: orgId,
          programOffering: { academicCycleId: cycle.id },
        },
        include: { programOffering: { include: { program: true } } },
      });
      if (!stageOffering) throw new BadRequestException('Program stage offering does not belong to this academic cycle');
    }

    const expandedSections = await this.courseResultSchemes.expandSectionIdsWithRelated(orgId, dto.sectionIds ?? []);
    const sectionIds = expandedSections.sectionIds;
    const sections = sectionIds.length
      ? await this.prisma.section.findMany({ where: { id: { in: sectionIds }, organizationId: orgId, academicCycleId: cycle.id }, include: { course: true } })
      : [];
    if (sections.length !== sectionIds.length) throw new BadRequestException('All sections must belong to the cohort offering cycle');
    await this.assertDepartmentContext(orgId, actor, [
      stageOffering?.programOffering.program.departmentId,
      ...sections.map((section) => section.course.departmentId),
    ]);

    const created = await this.prisma.$transaction(async (tx) => {
      const offering = await tx.cohortOffering.create({
        data: {
          organizationId: orgId,
          cohortId,
          academicCycleId: cycle.id,
          programStageOfferingId: stageOffering?.id,
          status: dto.status ?? CohortOfferingStatus.PLANNED,
          capacity: dto.capacity,
          createdById: actor.id,
          sections: {
            create: sectionIds.map((sectionId) => ({
              organizationId: orgId,
              sectionId,
              source: CohortSectionSource.MANUAL,
              createdById: actor.id,
            })),
          },
        },
      });
      for (const studentId of [...new Set(dto.studentIds ?? [])]) {
        await this.addMembership(tx, orgId, offering.id, studentId, actor.id);
      }
      return offering;
    });
    return this.offering(orgId, created.id);
  }

  async previewCreateOffering(orgId: string, dto: CreateCohortOfferingDto, actor: Actor, cohortId?: string) {
    const cycle = await this.prisma.academicCycle.findFirst({ where: { id: dto.academicCycleId, organizationId: orgId } });
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    if (cohortId) {
      const cohort = await this.prisma.cohort.findFirst({ where: { id: cohortId, organizationId: orgId } });
      if (!cohort) throw new NotFoundException('Cohort not found');
    }

    let stageOffering: { id: string; programOffering: { program: { departmentId: string } } } | null = null;
    if (dto.programStageOfferingId) {
      stageOffering = await this.prisma.programStageOffering.findFirst({
        where: {
          id: dto.programStageOfferingId,
          organizationId: orgId,
          programOffering: { academicCycleId: cycle.id },
        },
        include: { programOffering: { include: { program: true } } },
      });
      if (!stageOffering) throw new BadRequestException('Program stage offering does not belong to this academic cycle');
    }

    const expandedSections = await this.courseResultSchemes.expandSectionIdsWithRelated(orgId, dto.sectionIds ?? []);
    const sectionIds = expandedSections.sectionIds;
    const sections = sectionIds.length
      ? await this.prisma.section.findMany({
          where: { id: { in: sectionIds }, organizationId: orgId, academicCycleId: cycle.id },
          include: { course: true },
        })
      : [];
    if (sections.length !== sectionIds.length) throw new BadRequestException('All sections must belong to the cohort offering cycle');
    await this.assertDepartmentContext(orgId, actor, [
      stageOffering?.programOffering.program.departmentId,
      ...sections.map((section) => section.course.departmentId),
    ]);

    return this.buildCohortSectionExpansionPreview({
      orgId,
      selectedSectionIds: dto.sectionIds ?? [],
      expandedSectionIds: sectionIds,
      addedSectionIds: expandedSections.addedSectionIds,
      groups: expandedSections.groups,
      studentIds: [...new Set(dto.studentIds ?? [])],
      sections,
    });
  }

  async updateOffering(orgId: string, offeringId: string, dto: UpdateCohortOfferingDto, actor: Actor) {
    const current = await this.assertOfferingScope(orgId, offeringId, actor);
    await assertAcademicCycleWritable(this.prisma, orgId, current.academicCycleId, 'SETUP');
    assertLifecycleTransition(current.status, dto.status, COHORT_OFFERING_TRANSITIONS, 'Cohort offering');

    if (dto.status === CohortOfferingStatus.ACTIVE) {
      const stageOfferingId = dto.programStageOfferingId === undefined ? current.programStageOfferingId : dto.programStageOfferingId;
      if (stageOfferingId) {
        const openStage = await this.prisma.programStageOffering.findFirst({
          where: {
            id: stageOfferingId,
            organizationId: orgId,
            status: 'OPEN',
            programOffering: { status: 'OPEN', academicCycleId: current.academicCycleId },
          },
          select: { id: true },
        });
        if (!openStage) throw new ConflictException('Open the linked program and stage offering before activating this cohort offering');
      }
    }

    if (dto.capacity !== undefined) {
      const members = await this.prisma.studentCohortMembership.count({
        where: { cohortOfferingId: offeringId, leftAt: null },
      });
      if (dto.capacity < members) throw new ConflictException('Capacity cannot be lower than the current active membership');
    }

    if (dto.programStageOfferingId !== undefined && dto.programStageOfferingId !== current.programStageOfferingId) {
      const inUse = await this.prisma.studentCohortMembership.count({ where: { cohortOfferingId: offeringId } });
      if (inUse) throw new ConflictException('Program stage placement cannot change after student membership exists');
      if (dto.programStageOfferingId) {
        const target = await this.prisma.programStageOffering.findFirst({
          where: {
            id: dto.programStageOfferingId,
            organizationId: orgId,
            programOffering: { academicCycleId: current.academicCycleId },
          },
          include: { programOffering: { include: { program: true } } },
        });
        if (!target) throw new BadRequestException('Program stage offering does not belong to this academic cycle');
        await this.assertDepartmentContext(orgId, actor, [target.programOffering.program.departmentId]);
      }
    }

    await this.prisma.cohortOffering.update({
      where: { id: offeringId },
      data: {
        programStageOfferingId: dto.programStageOfferingId,
        status: dto.status,
        capacity: dto.capacity,
      },
    });
    return this.offering(orgId, offeringId);
  }

  async getCohorts(
    orgId: string,
    options: PaginationOptions & { academicCycleId?: string; programId?: string },
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions(options);
    const where: Prisma.CohortWhereInput = {
      organizationId: orgId,
      OR: options.search
        ? [
            { name: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
          ]
        : undefined,
      offerings: options.academicCycleId || options.programId
        ? {
            some: {
              academicCycleId: options.academicCycleId,
              programStageOffering: options.programId
                ? { programOffering: { programId: options.programId } }
                : undefined,
            },
          }
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.cohort.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: COHORT_INCLUDE,
      }),
      this.prisma.cohort.count({ where }),
    ]);
    return formatPaginatedResponse(data, total, options.page || 1, options.limit || 50);
  }

  async getCohort(orgId: string, id: string) {
    const cohort = await this.prisma.cohort.findFirst({ where: { id, organizationId: orgId }, include: COHORT_INCLUDE });
    if (!cohort) throw new NotFoundException('Cohort not found');
    return cohort;
  }

  async updateCohort(orgId: string, id: string, dto: UpdateCohortDto, actor: Actor) {
    await this.assertCohortScope(orgId, id, actor);
    if (dto.code) await this.assertCodeUnique(orgId, dto.code, id);
    await this.prisma.cohort.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code ? normalizeEntityCode(dto.code)! : undefined,
        status: dto.status,
      },
    });
    return this.getCohort(orgId, id);
  }

  async deleteCohort(orgId: string, id: string, actor: Actor) {
    await this.assertCohortScope(orgId, id, actor);
    const cohort = await this.prisma.cohort.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { offerings: true } } },
    });
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (cohort._count.offerings) throw new ConflictException('Cohorts with offering history must be archived');
    await this.prisma.cohort.delete({ where: { id } });
    return { success: true };
  }

  private async addMembership(
    tx: Transaction,
    orgId: string,
    cohortOfferingId: string,
    studentId: string,
    actorId: string,
  ) {
    const offering = await tx.cohortOffering.findFirst({
      where: { id: cohortOfferingId, organizationId: orgId },
      include: { sections: { where: { isDefault: true }, include: { section: { omit: SECTION_COMPONENT_OMIT } } }, programStageOffering: true },
    });
    if (!offering) throw new NotFoundException('Cohort offering not found');
    if (!([CohortOfferingStatus.PLANNED, CohortOfferingStatus.ACTIVE] as CohortOfferingStatus[]).includes(offering.status)) {
      throw new ConflictException('Students cannot join a closed or cancelled cohort offering');
    }
    await assertAcademicCycleWritable(tx, orgId, offering.academicCycleId, 'DELIVERY');
    const student = await tx.student.findFirst({ where: { id: studentId, organizationId: orgId } });
    if (!student) throw new NotFoundException('Student not found');
    const existing = await tx.studentCohortMembership.findFirst({
      where: { studentId, cohortOfferingId, leftAt: null },
    });
    if (existing) return existing;

    if (offering.capacity) {
      const occupied = await tx.studentCohortMembership.count({ where: { cohortOfferingId, leftAt: null } });
      if (occupied >= offering.capacity) throw new ConflictException('The cohort offering is at capacity');
    }

    const stageEnrollment = offering.programStageOfferingId
      ? await this.studentPrograms.ensureCohortOfferingPlacement(tx, orgId, studentId, offering.id, actorId)
      : null;
    const membership = await tx.studentCohortMembership.create({
      data: {
        organizationId: orgId,
        studentId,
        cohortOfferingId,
        studentStageEnrollmentId: stageEnrollment?.id,
        source: EnrollmentSource.COHORT,
        joinedById: actorId,
      },
    });
    for (const link of offering.sections) {
      await this.autoEnroll(tx, studentId, link.section, membership.id, stageEnrollment?.id ?? null);
    }
    return membership;
  }

  async addStudentToCohort(orgId: string, offeringId: string, studentId: string, actor: Actor) {
    await this.assertOfferingScope(orgId, offeringId, actor);
    return this.prisma.$transaction((tx) => this.addMembership(tx, orgId, offeringId, studentId, actor.id));
  }

  async addStudentsToCohortBulk(orgId: string, offeringId: string, studentIds: string[], actor: Actor) {
    await this.assertOfferingScope(orgId, offeringId, actor);
    const ids = [...new Set(studentIds)];
    return this.prisma.$transaction(async (tx) => {
      const memberships: Prisma.StudentCohortMembershipGetPayload<Record<string, never>>[] = [];
      for (const studentId of ids) memberships.push(await this.addMembership(tx, orgId, offeringId, studentId, actor.id));
      return { added: memberships.length, memberships };
    });
  }

  async removeStudentFromCohort(orgId: string, offeringId: string, studentId: string, actor: Actor) {
    await this.assertOfferingScope(orgId, offeringId, actor);
    const offering = await this.offering(orgId, offeringId);
    await assertAcademicCycleWritable(this.prisma, orgId, offering.academicCycleId, 'DELIVERY');
    return this.prisma.$transaction(async (tx) => {
      const memberships = await tx.studentCohortMembership.findMany({
        where: { cohortOfferingId: offeringId, studentId, leftAt: null },
      });
      for (const membership of memberships) {
        await this.removeMembershipEnrollments(tx, membership.id);
        await tx.studentCohortMembership.update({ where: { id: membership.id }, data: { leftAt: new Date() } });
      }
      return { success: true };
    });
  }

  async assignSectionToCohort(
    orgId: string,
    offeringId: string,
    sectionId: string,
    actor: Actor,
    source: CohortSectionSource = CohortSectionSource.MANUAL,
    isDefault = true,
  ) {
    await this.assertOfferingScope(orgId, offeringId, actor);
    const offering = await this.offering(orgId, offeringId);
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, organizationId: orgId, academicCycleId: offering.academicCycleId },
    });
    if (!section) throw new BadRequestException('Section must belong to the cohort offering cycle');
    await assertAcademicCycleWritable(this.prisma, orgId, offering.academicCycleId, 'DELIVERY');
    const expandedSections = await this.courseResultSchemes.expandSectionIdsWithRelated(orgId, [sectionId]);
    const sectionIds = expandedSections.sectionIds;
    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds }, organizationId: orgId, academicCycleId: offering.academicCycleId },
    });
    if (sections.length !== sectionIds.length) throw new BadRequestException('Every related section must belong to the cohort offering cycle');
    return this.prisma.$transaction(async (tx) => {
      let primaryLink: Prisma.CohortOfferingSectionGetPayload<Record<string, never>> | null = null;
      for (const relatedSectionId of sectionIds) {
        const link = await tx.cohortOfferingSection.upsert({
          where: { cohortOfferingId_sectionId: { cohortOfferingId: offeringId, sectionId: relatedSectionId } },
          create: { organizationId: orgId, cohortOfferingId: offeringId, sectionId: relatedSectionId, source, isDefault, createdById: actor.id },
          update: { source, isDefault },
        });
        if (relatedSectionId === sectionId) primaryLink = link;
      }
      if (isDefault) {
        const memberships = await tx.studentCohortMembership.findMany({
          where: { cohortOfferingId: offeringId, leftAt: null },
        });
        const sectionById = new Map(sections.map((row) => [row.id, row]));
        for (const membership of memberships) {
          for (const relatedSectionId of sectionIds) {
            const relatedSection = sectionById.get(relatedSectionId);
            if (relatedSection) await this.autoEnroll(tx, membership.studentId, relatedSection, membership.id, membership.studentStageEnrollmentId);
          }
        }
      }
      return {
        link: primaryLink,
        expandedSectionIds: sectionIds,
        addedSectionIds: expandedSections.addedSectionIds,
        relationshipGroups: expandedSections.groups,
      };
    });
  }

  async previewAssignSectionToCohort(
    orgId: string,
    offeringId: string,
    dto: AssignCohortSectionDto,
    actor: Actor,
  ) {
    await this.assertOfferingScope(orgId, offeringId, actor);
    const offering = await this.offering(orgId, offeringId);
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, organizationId: orgId, academicCycleId: offering.academicCycleId },
    });
    if (!section) throw new BadRequestException('Section must belong to the cohort offering cycle');
    await assertAcademicCycleWritable(this.prisma, orgId, offering.academicCycleId, 'DELIVERY');
    const expandedSections = await this.courseResultSchemes.expandSectionIdsWithRelated(orgId, [dto.sectionId]);
    const sectionIds = expandedSections.sectionIds;
    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds }, organizationId: orgId, academicCycleId: offering.academicCycleId },
      include: { course: true },
    });
    if (sections.length !== sectionIds.length) throw new BadRequestException('Every related section must belong to the cohort offering cycle');
    const memberships = await this.prisma.studentCohortMembership.findMany({
      where: { cohortOfferingId: offeringId, leftAt: null },
      select: { studentId: true },
    });
    const currentSectionIds = offering.sections.map((link) => link.sectionId);

    return this.buildCohortSectionExpansionPreview({
      orgId,
      selectedSectionIds: [dto.sectionId],
      expandedSectionIds: sectionIds,
      addedSectionIds: expandedSections.addedSectionIds.filter((sectionId) => !currentSectionIds.includes(sectionId)),
      groups: expandedSections.groups,
      studentIds: memberships.map((membership) => membership.studentId),
      sections,
      existingOfferingSectionIds: currentSectionIds,
    });
  }

  async removeSectionFromCohort(orgId: string, offeringId: string, sectionId: string, actor: Actor) {
    await this.assertOfferingScope(orgId, offeringId, actor);
    const offering = await this.offering(orgId, offeringId);
    await assertAcademicCycleWritable(this.prisma, orgId, offering.academicCycleId, 'DELIVERY');
    return this.prisma.$transaction(async (tx) => {
      const memberships = await tx.studentCohortMembership.findMany({ where: { cohortOfferingId: offeringId }, select: { id: true } });
      await this.removeCohortSectionEnrollments(tx, memberships.map((row) => row.id), sectionId);
      await tx.cohortOfferingSection.deleteMany({ where: { cohortOfferingId: offeringId, sectionId } });
      return { success: true };
    });
  }

  private async assertCanOverrideEnrollment(orgId: string, sectionId: string, user?: { id: string; role: string }) {
    if (!user || user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) return;
    if (user.role !== Role.TEACHER && user.role !== Role.ORG_MANAGER) throw new ForbiddenException('You cannot change cohort enrollment overrides');
    const assigned = await this.prisma.section.findFirst({
      where: { id: sectionId, organizationId: orgId, teachers: { some: { userId: user.id } } },
      select: { id: true },
    });
    if (!assigned) throw new ForbiddenException('You can only change overrides for assigned sections');
  }

  async excludeStudentFromSection(orgId: string, studentId: string, sectionId: string, user?: { id: string; role: string }) {
    await this.assertCanOverrideEnrollment(orgId, sectionId, user);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, sectionId, section: { organizationId: orgId } },
    });
    if (!enrollment || enrollment.source !== EnrollmentSource.COHORT) throw new BadRequestException('No cohort enrollment found');
    return this.prisma.enrollment.update({ where: { id: enrollment.id }, data: { isExcludedFromCohort: true } });
  }

  async includeStudentInSection(orgId: string, studentId: string, sectionId: string, user?: { id: string; role: string }) {
    await this.assertCanOverrideEnrollment(orgId, sectionId, user);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, sectionId, section: { organizationId: orgId } },
    });
    if (!enrollment || enrollment.source !== EnrollmentSource.COHORT) throw new BadRequestException('No cohort enrollment found');
    return this.prisma.enrollment.update({ where: { id: enrollment.id }, data: { isExcludedFromCohort: false } });
  }

  private async autoEnroll(
    tx: Transaction,
    studentId: string,
    section: { id: string; academicCycleId: string },
    membershipId: string,
    stageEnrollmentId: string | null,
  ) {
    return tx.enrollment.upsert({
      where: { studentId_sectionId: { studentId, sectionId: section.id } },
      create: {
        studentId,
        sectionId: section.id,
        academicCycleId: section.academicCycleId,
        studentCohortMembershipId: membershipId,
        studentStageEnrollmentId: stageEnrollmentId,
        source: EnrollmentSource.COHORT,
      },
      update: {},
    });
  }

  private async buildCohortSectionExpansionPreview({
    orgId,
    selectedSectionIds,
    expandedSectionIds,
    addedSectionIds,
    groups,
    studentIds,
    sections,
    existingOfferingSectionIds = [],
  }: {
    orgId: string;
    selectedSectionIds: string[];
    expandedSectionIds: string[];
    addedSectionIds: string[];
    groups: Array<{
      schemeId: string;
      schemeName: string;
      triggerSectionId: string;
      sections: Array<{
        id: string;
        name: string;
        code: string;
        componentType: string;
        componentLabel: string;
        componentWeight: number;
      }>;
    }>;
    studentIds: string[];
    sections: Array<{ id: string; name: string; code: string; componentType: string; course?: { code: string | null; name: string } }>;
    existingOfferingSectionIds?: string[];
  }) {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
    const existingSectionSet = new Set(existingOfferingSectionIds);
    const sectionsToAdd = sections.filter((section) => !existingSectionSet.has(section.id));
    const existingEnrollments = uniqueStudentIds.length && expandedSectionIds.length
      ? await this.prisma.enrollment.findMany({
          where: { studentId: { in: uniqueStudentIds }, sectionId: { in: expandedSectionIds }, section: { organizationId: orgId } },
          select: { studentId: true, sectionId: true },
        })
      : [];
    const existingPairs = new Set(existingEnrollments.map((enrollment) => enrollmentPairKey(enrollment.studentId, enrollment.sectionId)));
    const students = uniqueStudentIds.length
      ? await this.prisma.student.findMany({
          where: { id: { in: uniqueStudentIds }, organizationId: orgId },
          select: { id: true, registrationNumber: true, user: { select: { name: true, email: true } } },
        })
      : [];
    const studentById = new Map(students.map((student) => [student.id, student]));
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const missingEnrollments = buildMissingEnrollmentPreview({ studentIds: uniqueStudentIds, sectionIds: expandedSectionIds, existingPairs, studentById, sectionById });

    return {
      selectedSectionCount: [...new Set(selectedSectionIds.filter(Boolean))].length,
      expandedSectionCount: expandedSectionIds.length,
      addedRelatedSectionCount: addedSectionIds.length,
      sectionsToAddCount: sectionsToAdd.length,
      studentCount: uniqueStudentIds.length,
      missingEnrollmentCount: missingEnrollments.length,
      selectedSectionIds,
      expandedSectionIds,
      addedSectionIds,
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        code: section.code,
        componentType: section.componentType,
        courseCode: section.course?.code ?? null,
        courseName: section.course?.name ?? null,
        alreadyAssigned: existingSectionSet.has(section.id),
      })),
      missingEnrollments,
      relationshipGroups: groups,
    };
  }

  private async archiveEnrollments(tx: Transaction, enrollments: Awaited<ReturnType<Transaction['enrollment']['findMany']>>) {
    if (!enrollments.length) return;
    await tx.enrollmentHistory.createMany({
      data: enrollments.map((row) => ({
        studentId: row.studentId,
        sectionId: row.sectionId,
        academicCycleId: row.academicCycleId,
        studentProgramEnrollmentId: row.studentProgramEnrollmentId,
        studentStageEnrollmentId: row.studentStageEnrollmentId,
        studentCohortMembershipId: row.studentCohortMembershipId,
        source: row.source,
        wasExcluded: row.isExcludedFromCohort,
        enrolledAt: row.createdAt,
        removedAt: new Date(),
      })),
    });
    await tx.enrollment.deleteMany({ where: { id: { in: enrollments.map((row) => row.id) } } });
  }

  private async removeMembershipEnrollments(tx: Transaction, membershipId: string) {
    const enrollments = await tx.enrollment.findMany({
      where: { studentCohortMembershipId: membershipId, source: EnrollmentSource.COHORT },
    });
    await this.archiveEnrollments(tx, enrollments);
  }

  private async removeCohortSectionEnrollments(tx: Transaction, membershipIds: string[], sectionId: string) {
    const enrollments = await tx.enrollment.findMany({
      where: { studentCohortMembershipId: { in: membershipIds }, sectionId, source: EnrollmentSource.COHORT },
    });
    await this.archiveEnrollments(tx, enrollments);
  }
}
