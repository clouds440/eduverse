import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CourseResultComponentType, EnrollmentSource, GradeStatus, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCourseResultSchemeDto } from './dto/course-result-scheme.dto';
import { assertAcademicCycleWritable } from '../common/academic-cycle-write-policy';
import { assertDepartmentInScope, getDepartmentScope, type DepartmentScopedUser } from '../common/department-scope';
import { StudentProgramEnrollmentsService } from '../student-program-enrollments/student-program-enrollments.service';
import { buildMissingEnrollmentPreview, enrollmentPairKey } from '../common/enrollment-preview';
import { formatEnumLabel } from '../common/enum-label';

const WEIGHT_TOTAL = 100;
const WEIGHT_EPSILON = 0.000001;

const SCHEME_INCLUDE = {
  course: { select: { id: true, name: true, code: true, creditHours: true, departmentId: true } },
  academicCycle: { select: { id: true, name: true, code: true, status: true } },
  components: {
    orderBy: [{ sortOrder: 'asc' }, { componentType: 'asc' }],
    include: {
      sectionLinks: {
        include: {
          section: {
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
              courseId: true,
              academicCycleId: true,
              status: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CourseResultSchemeInclude;

export type CourseResultSchemeWithComponents = Prisma.CourseResultSchemeGetPayload<{ include: typeof SCHEME_INCLUDE }>;

@Injectable()
export class CourseResultSchemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentPrograms: StudentProgramEnrollmentsService,
  ) {}

  async getScheme(orgId: string, courseId: string, academicCycleId: string, requester?: DepartmentScopedUser) {
    const course = await this.assertCourseInScope(orgId, courseId, requester);
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: academicCycleId, organizationId: orgId },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');

    const scheme = await this.prisma.courseResultScheme.findUnique({
      where: { organizationId_courseId_academicCycleId: { organizationId: orgId, courseId, academicCycleId } },
      include: SCHEME_INCLUDE,
    });

    return scheme ? this.formatScheme(scheme) : { courseId, course, academicCycleId, components: [] };
  }

  async upsertScheme(
    orgId: string,
    courseId: string,
    academicCycleId: string,
    dto: UpsertCourseResultSchemeDto,
    requester: DepartmentScopedUser,
  ) {
    const course = await this.assertCourseInScope(orgId, courseId, requester);
    await assertAcademicCycleWritable(this.prisma, orgId, academicCycleId, 'SETUP');
    const components = this.normalizeComponents(dto);
    const sectionIds = components.flatMap((component) => component.sectionIds);
    await this.assertSectionsMatchCourseAndCycle(orgId, courseId, academicCycleId, sectionIds);
    const enrollmentPreview = await this.previewEnrollmentSync(orgId, courseId, academicCycleId, dto, requester);

    const existing = await this.prisma.courseResultScheme.findUnique({
      where: { organizationId_courseId_academicCycleId: { organizationId: orgId, courseId, academicCycleId } },
      include: { components: { include: { sectionLinks: true } } },
    });

    const existingSectionIds = existing?.components.flatMap((component) => component.sectionLinks.map((link) => link.sectionId)) ?? [];
    await this.assertNoFinalizedLinkedGrades([...existingSectionIds, ...sectionIds]);

    const scheme = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.courseResultScheme.update({
            where: { id: existing.id },
            data: { name: dto.name?.trim() || existing.name },
          })
        : await tx.courseResultScheme.create({
            data: {
              organizationId: orgId,
              courseId,
              academicCycleId,
              name: dto.name?.trim() || 'Section Result Relationship',
              createdById: requester.id,
            },
          });

      await tx.courseResultComponent.deleteMany({ where: { schemeId: saved.id } });
      for (const component of components) {
        await tx.courseResultComponent.create({
          data: {
            schemeId: saved.id,
            componentType: component.componentType,
            label: component.label,
            weight: component.weight,
            sortOrder: component.sortOrder,
            sectionLinks: {
              create: component.sectionIds.map((sectionId) => ({ sectionId })),
            },
          },
        });
      }
      if (dto.syncEnrollments) {
        await this.syncRelationshipEnrollments(tx, orgId, sectionIds, enrollmentPreview.missingEnrollments, requester);
      }

      return tx.courseResultScheme.findUniqueOrThrow({
        where: { id: saved.id },
        include: SCHEME_INCLUDE,
      });
    });

    return this.formatScheme(scheme);
  }

  async previewScheme(
    orgId: string,
    courseId: string,
    academicCycleId: string,
    dto: UpsertCourseResultSchemeDto,
    requester: DepartmentScopedUser,
  ) {
    await this.assertCourseInScope(orgId, courseId, requester);
    await assertAcademicCycleWritable(this.prisma, orgId, academicCycleId, 'SETUP');
    const components = this.normalizeComponents(dto);
    const sectionIds = components.flatMap((component) => component.sectionIds);
    await this.assertSectionsMatchCourseAndCycle(orgId, courseId, academicCycleId, sectionIds);
    return this.previewEnrollmentSync(orgId, courseId, academicCycleId, dto, requester);
  }

  async deleteScheme(orgId: string, schemeId: string, requester: DepartmentScopedUser) {
    const scheme = await this.prisma.courseResultScheme.findFirst({
      where: { id: schemeId, organizationId: orgId },
      include: {
        course: true,
        components: { include: { sectionLinks: true } },
      },
    });
    if (!scheme) throw new NotFoundException('Course result scheme not found');
    const scope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(scope, scheme.course.departmentId, 'You cannot delete a result scheme outside your department scope');
    await assertAcademicCycleWritable(this.prisma, orgId, scheme.academicCycleId, 'SETUP');
    await this.assertNoFinalizedLinkedGrades(scheme.components.flatMap((component) => component.sectionLinks.map((link) => link.sectionId)));
    await this.prisma.courseResultScheme.delete({ where: { id: scheme.id } });
    return { message: 'Course result scheme deleted successfully' };
  }

  async findLockedSectionLink(sectionId: string) {
    return this.prisma.courseResultComponentSection.findFirst({
      where: { sectionId },
      include: {
        component: {
          include: {
            scheme: { select: { id: true, name: true, courseId: true, academicCycleId: true } },
          },
        },
      },
    });
  }

  async getSchemesForCycle(orgId: string, academicCycleId: string) {
    return this.prisma.courseResultScheme.findMany({
      where: { organizationId: orgId, academicCycleId },
      include: SCHEME_INCLUDE,
    });
  }

  async expandSectionIdsWithRelated(orgId: string, sectionIds: string[]) {
    const uniqueSectionIds = Array.from(new Set(sectionIds.filter(Boolean)));
    if (uniqueSectionIds.length === 0) {
      return { sectionIds: [], addedSectionIds: [], groups: [] };
    }

    const links = await this.prisma.courseResultComponentSection.findMany({
      where: { sectionId: { in: uniqueSectionIds }, section: { organizationId: orgId } },
      include: {
        component: {
          include: {
            scheme: {
              include: {
                components: {
                  include: {
                    sectionLinks: {
                      include: {
                        section: { select: { id: true, name: true, code: true, componentType: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const expanded = new Set(uniqueSectionIds);
    const groups = links.map((link) => {
      const groupSections = link.component.scheme.components
        .flatMap((component) => component.sectionLinks.map((sectionLink) => ({
          id: sectionLink.section.id,
          name: sectionLink.section.name,
          code: sectionLink.section.code,
          componentType: sectionLink.section.componentType,
          componentLabel: component.label,
          componentWeight: component.weight,
        })));
      groupSections.forEach((section) => expanded.add(section.id));
      return {
        schemeId: link.component.scheme.id,
        schemeName: link.component.scheme.name,
        triggerSectionId: link.sectionId,
        sections: groupSections,
      };
    });

    const expandedIds = Array.from(expanded);
    return {
      sectionIds: expandedIds,
      addedSectionIds: expandedIds.filter((sectionId) => !uniqueSectionIds.includes(sectionId)),
      groups,
    };
  }

  private async assertCourseInScope(orgId: string, courseId: string, requester?: DepartmentScopedUser) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: orgId },
      select: { id: true, name: true, code: true, creditHours: true, departmentId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const scope = await getDepartmentScope(this.prisma, orgId, requester);
    assertDepartmentInScope(scope, course.departmentId, 'You cannot manage a result scheme outside your department scope');
    return course;
  }

  private normalizeComponents(dto: UpsertCourseResultSchemeDto) {
    if (!Array.isArray(dto.components) || dto.components.length === 0) {
      throw new BadRequestException('At least one result component is required');
    }
    const seenTypes = new Set<CourseResultComponentType>();
    const seenSections = new Set<string>();
    let totalWeight = 0;

    const components = dto.components.map((component, index) => {
      if (seenTypes.has(component.componentType)) {
        throw new ConflictException('Each component type can appear only once in a result scheme');
      }
      seenTypes.add(component.componentType);
      const sectionIds = Array.from(new Set((component.sectionIds || []).filter(Boolean)));
      if (sectionIds.length === 0) {
        throw new BadRequestException(`${component.componentType} must include at least one section`);
      }
      for (const sectionId of sectionIds) {
        if (seenSections.has(sectionId)) {
          throw new ConflictException('A section can belong to only one component in a result scheme');
        }
        seenSections.add(sectionId);
      }
      const weight = Number(component.weight);
      if (!Number.isFinite(weight) || weight < 0 || weight > WEIGHT_TOTAL) {
        throw new BadRequestException('Component weights must be between 0 and 100');
      }
      totalWeight += weight;
      return {
        componentType: component.componentType,
        label: component.label?.trim() || this.defaultLabel(component.componentType),
        weight,
        sortOrder: component.sortOrder ?? index,
        sectionIds,
      };
    });

    if (Math.abs(totalWeight - WEIGHT_TOTAL) > WEIGHT_EPSILON) {
      throw new BadRequestException('Result component weights must total 100');
    }

    return components;
  }

  private async assertSectionsMatchCourseAndCycle(
    orgId: string,
    courseId: string,
    academicCycleId: string,
    sectionIds: string[],
  ) {
    const uniqueSectionIds = Array.from(new Set(sectionIds));
    const sections = await this.prisma.section.findMany({
      where: { id: { in: uniqueSectionIds }, organizationId: orgId },
      select: { id: true, courseId: true, academicCycleId: true },
    });
    if (sections.length !== uniqueSectionIds.length) {
      throw new BadRequestException('One or more selected sections do not belong to this organization');
    }
    if (sections.some((section) => section.courseId !== courseId || section.academicCycleId !== academicCycleId)) {
      throw new BadRequestException('Every component section must match the selected course and academic cycle');
    }
  }

  private async previewEnrollmentSync(
    orgId: string,
    _courseId: string,
    academicCycleId: string,
    dto: UpsertCourseResultSchemeDto,
    _requester: DepartmentScopedUser,
  ) {
    const components = this.normalizeComponents(dto);
    const sectionIds = components.flatMap((component) => component.sectionIds);
    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds }, organizationId: orgId, academicCycleId },
      select: {
        id: true,
        name: true,
        code: true,
        componentType: true,
        enrollments: {
          select: {
            studentId: true,
            student: { select: { id: true, registrationNumber: true, user: { select: { name: true, email: true } } } },
          },
        },
      },
    });
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const allStudentIds = Array.from(new Set(sections.flatMap((section) => section.enrollments.map((enrollment) => enrollment.studentId))));
    const existingPairs = new Set(sections.flatMap((section) => section.enrollments.map((enrollment) => enrollmentPairKey(enrollment.studentId, section.id))));
    const studentById = new Map(sections.flatMap((section) => section.enrollments.map((enrollment) => [enrollment.studentId, enrollment.student])));
    const missingEnrollments = buildMissingEnrollmentPreview({ studentIds: allStudentIds, sectionIds, existingPairs, studentById, sectionById });

    return {
      sectionCount: sectionIds.length,
      studentCount: allStudentIds.length,
      missingEnrollmentCount: missingEnrollments.length,
      missingEnrollments,
      components: components.map((component) => ({
        componentType: component.componentType,
        label: component.label,
        weight: component.weight,
        sectionIds: component.sectionIds,
        sections: component.sectionIds.map((sectionId) => sectionById.get(sectionId)).filter(Boolean),
      })),
    };
  }

  private async syncRelationshipEnrollments(
    tx: Prisma.TransactionClient,
    orgId: string,
    sectionIds: string[],
    missingEnrollments: Array<{ studentId: string; sectionId: string }>,
    requester: DepartmentScopedUser,
  ) {
    if (missingEnrollments.length === 0) return;
    const sections = await tx.section.findMany({
      where: { id: { in: sectionIds }, organizationId: orgId },
      include: { programMappings: { include: { stageCourseRequirement: true } } },
    });
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    for (const missing of missingEnrollments) {
      const section = sectionById.get(missing.sectionId);
      if (!section) continue;
      const existing = await tx.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: missing.studentId, sectionId: missing.sectionId } },
        select: { id: true },
      });
      if (existing) continue;
      const programContext = section.programMappings.length
        ? await this.studentPrograms.ensureMappedSectionEnrollment(tx, orgId, missing.studentId, section, requester.id)
        : null;
      await tx.enrollment.create({
        data: {
          studentId: missing.studentId,
          sectionId: missing.sectionId,
          academicCycleId: section.academicCycleId,
          source: EnrollmentSource.MANUAL,
          studentProgramEnrollmentId: programContext?.enrollment.id,
          studentStageEnrollmentId: programContext?.stageEnrollment.id,
        },
      });
      await tx.enrollmentHistory.create({
        data: {
          studentId: missing.studentId,
          sectionId: missing.sectionId,
          academicCycleId: section.academicCycleId,
          source: EnrollmentSource.MANUAL,
          studentProgramEnrollmentId: programContext?.enrollment.id,
          studentStageEnrollmentId: programContext?.stageEnrollment.id,
        },
      });
    }
  }

  private async assertNoFinalizedLinkedGrades(sectionIds: string[]) {
    const ids = Array.from(new Set(sectionIds.filter(Boolean)));
    if (ids.length === 0) return;
    const finalizedCount = await this.prisma.grade.count({
      where: {
        status: GradeStatus.FINALIZED,
        assessment: { sectionId: { in: ids } },
      },
    });
    if (finalizedCount > 0) {
      throw new ConflictException('Section result relationships cannot be changed after linked sections have finalized grades');
    }
  }

  private defaultLabel(componentType: CourseResultComponentType) {
    return formatEnumLabel(componentType);
  }

  private formatScheme(scheme: CourseResultSchemeWithComponents) {
    return {
      id: scheme.id,
      organizationId: scheme.organizationId,
      courseId: scheme.courseId,
      academicCycleId: scheme.academicCycleId,
      name: scheme.name,
      createdById: scheme.createdById,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt,
      course: scheme.course,
      academicCycle: scheme.academicCycle,
      components: scheme.components.map((component) => ({
        id: component.id,
        componentType: component.componentType,
        label: component.label,
        weight: component.weight,
        sortOrder: component.sortOrder,
        sections: component.sectionLinks.map((link) => link.section),
        sectionIds: component.sectionLinks.map((link) => link.sectionId),
      })),
    };
  }
}
