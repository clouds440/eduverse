import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicCycleStatus,
  CurriculumStatus,
  Prisma,
  ProgramStatus,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { GpaService } from '../gpa/gpa.service';
import { OrganizationActivityService } from '../activity-logs/organization-activity.service';
import {
  assertDepartmentInScope,
  getDepartmentScope,
  type DepartmentScopedUser,
} from '../common/department-scope';
import {
  formatPaginatedResponse,
  getPaginationOptions,
  PaginationOptions,
} from '../common/utils';
import { normalizeEntityCode } from '../common/entity-code';
import { runSerializableTransaction } from '../common/prisma-transaction';
import {
  CreateProgramDto,
  ProgramCourseRequirementInputDto,
  ProgramStageInputDto,
  ReplaceProgramStructureDto,
  UpdateProgramDto,
} from './dto/program.dto';
import {
  CreateCourseRequirementDto,
  CreateCurriculumDto,
  CreateProgramStageDto,
  UpdateCourseRequirementDto,
  UpdateCurriculumDto,
  UpdateProgramStageDto,
} from './dto/curriculum.dto';

type Actor = DepartmentScopedUser & { id: string };
type Transaction = Prisma.TransactionClient;

const PROGRAM_DETAIL_INCLUDE = {
  department: { select: { id: true, name: true, code: true, isActive: true } },
  configurationRevisions: { orderBy: { version: 'desc' as const }, take: 5 },
  curriculumVersions: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      stages: {
        orderBy: { sequence: 'asc' as const },
        include: {
          courseRequirements: {
            orderBy: { sortOrder: 'asc' as const },
            include: { course: true },
          },
        },
      },
    },
  },
  offerings: {
    orderBy: { academicCycle: { startDate: 'desc' as const } },
    include: {
      academicCycle: true,
      stageOfferings: {
        orderBy: { programStage: { sequence: 'asc' as const } },
        include: { programStage: true },
      },
    },
  },
  _count: { select: { studentEnrollments: true, curriculumVersions: true, offerings: true } },
} satisfies Prisma.ProgramInclude;

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    // Retained in the module contract; GPA policy is now selected on the institute cycle.
    private readonly _gpaService: GpaService,
    private readonly activity: OrganizationActivityService,
  ) {}

  private text(value?: string | null) {
    return value?.trim() || null;
  }

  private checksum(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private runSerializable<T>(operation: (tx: Transaction) => Promise<T>) {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage: 'Program configuration changed concurrently; refresh and try again',
    });
  }

  private async log(
    orgId: string,
    actorId: string,
    action: string,
    program: { id: string; name: string },
    details?: Record<string, unknown>,
  ) {
    await this.activity.record({
      organizationId: orgId,
      actorUserId: actorId,
      action,
      module: 'programs',
      resourceType: 'Program',
      resourceId: program.id,
      resourceTitle: program.name,
      details,
    });
  }

  private async assertDepartment(orgId: string, departmentId: string, actor: Actor) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true, isActive: true },
    });
    if (!department) throw new NotFoundException('Department not found');
    if (!department.isActive) throw new ConflictException('Programs cannot be assigned to an inactive department');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, departmentId, 'You cannot manage programs outside your assigned departments');
  }

  private async assertUnique(orgId: string, nameValue: string, codeValue: string, excludeId?: string) {
    const name = nameValue.trim();
    const code = normalizeEntityCode(codeValue)!;
    const duplicate = await this.prisma.program.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { name: { equals: name, mode: Prisma.QueryMode.insensitive } },
          { code: { equals: code, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { name: true },
    });
    if (!duplicate) return;
    if (duplicate.name.toLowerCase() === name.toLowerCase()) throw new ConflictException('Program name already exists');
    throw new ConflictException('Program code already exists');
  }

  private validateStages(stages: ProgramStageInputDto[]) {
    const codes = new Set<string>();
    stages.forEach((stage, index) => {
      const code = normalizeEntityCode(stage.code)!;
      if (codes.has(code)) throw new ConflictException(`Stage ${index + 1} duplicates code ${code}`);
      codes.add(code);
      if (!stage.isOptional && stage.courseRequirements.length === 0) {
        throw new BadRequestException(`Stage ${index + 1} requires at least one course requirement`);
      }
    });
  }

  private async loadCourses(
    tx: Transaction,
    orgId: string,
    stages: ProgramStageInputDto[],
  ) {
    const ids = [...new Set(stages.flatMap((stage) => stage.courseRequirements.map((row) => row.courseId)))];
    const courses = await tx.course.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true, creditHours: true },
    });
    if (courses.length !== ids.length) throw new BadRequestException('One or more curriculum courses do not belong to this organization');
    return new Map(courses.map((course) => [course.id, course]));
  }

  private structureSnapshot(dto: {
    curriculumName: string;
    curriculumCode: string;
    stageTerminology?: string;
    stages: ProgramStageInputDto[];
  }) {
    return {
      curriculum: {
        name: dto.curriculumName.trim(),
        code: normalizeEntityCode(dto.curriculumCode),
        stageTerminology: this.text(dto.stageTerminology),
      },
      stages: dto.stages.map((stage, index) => ({
        sequence: index + 1,
        ...stage,
        code: normalizeEntityCode(stage.code),
      })),
    };
  }

  private async createStructure(
    tx: Transaction,
    orgId: string,
    programId: string,
    version: number,
    actorId: string,
    input: {
      curriculumName: string;
      curriculumCode: string;
      stageTerminology?: string;
      stages: ProgramStageInputDto[];
      changeReason?: string;
    },
  ) {
    this.validateStages(input.stages);
    const courses = await this.loadCourses(tx, orgId, input.stages);
    const snapshot = this.structureSnapshot(input);
    const revision = await tx.programConfigurationRevision.create({
      data: {
        organizationId: orgId,
        programId,
        version,
        configurationSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        checksum: this.checksum(snapshot),
        changeReason: input.changeReason,
        createdById: actorId,
      },
    });
    const curriculum = await tx.curriculumVersion.create({
      data: {
        organizationId: orgId,
        programId,
        programConfigurationRevisionId: revision.id,
        name: input.curriculumName.trim(),
        code: normalizeEntityCode(input.curriculumCode)!,
        stageTerminology: this.text(input.stageTerminology),
      },
    });
    for (const [index, stageInput] of input.stages.entries()) {
      const stage = await tx.programStage.create({
        data: {
          organizationId: orgId,
          curriculumVersionId: curriculum.id,
          name: stageInput.name.trim(),
          code: normalizeEntityCode(stageInput.code)!,
          sequence: index + 1,
          stageType: this.text(stageInput.stageType),
          isOptional: stageInput.isOptional ?? false,
          minCredits: stageInput.minCredits,
          expectedCredits: stageInput.expectedCredits,
        },
      });
      for (const [sortOrder, requirement] of stageInput.courseRequirements.entries()) {
        await tx.stageCourseRequirement.create({
          data: {
            organizationId: orgId,
            programStageId: stage.id,
            courseId: requirement.courseId,
            requirementType: requirement.requirementType,
            groupKey: this.text(requirement.groupKey),
            minCourses: requirement.minCourses,
            minCredits: requirement.minCredits,
            notes: this.text(requirement.notes),
            sortOrder,
            creditHoursSnapshot: courses.get(requirement.courseId)!.creditHours,
          },
        });
      }
    }
    return { revision, curriculum };
  }

  private async scopedProgram(orgId: string, id: string, actor: Actor) {
    const program = await this.prisma.program.findFirst({ where: { id, organizationId: orgId } });
    if (!program) throw new NotFoundException('Program not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, program.departmentId);
    return program;
  }

  async create(orgId: string, dto: CreateProgramDto, actor: Actor) {
    await this.assertDepartment(orgId, dto.departmentId, actor);
    await this.assertUnique(orgId, dto.name, dto.code);
    const program = await this.runSerializable(async (tx) => {
      const created = await tx.program.create({
        data: {
          organizationId: orgId,
          departmentId: dto.departmentId,
          name: dto.name.trim(),
          code: normalizeEntityCode(dto.code)!,
          description: this.text(dto.description),
          structureType: dto.structureType,
          progressionMode: dto.progressionMode,
          completionMode: dto.completionMode,
          minimumPassingPercentage: dto.minimumPassingPercentage ?? 50,
          minimumAttendancePercentage: dto.minimumAttendancePercentage,
          durationValue: dto.durationValue,
          durationUnit: dto.durationUnit,
          isVisibleForAdmissions: dto.isVisibleForAdmissions ?? false,
          admissionsLabel: this.text(dto.admissionsLabel),
          admissionsDescription: this.text(dto.admissionsDescription),
        },
      });
      await this.createStructure(tx, orgId, created.id, 1, actor.id, {
        curriculumName: dto.curriculumName,
        curriculumCode: dto.curriculumCode,
        stageTerminology: dto.stageTerminology,
        stages: dto.stages,
        changeReason: 'Initial program structure',
      });
      return created;
    });
    await this.log(orgId, actor.id, 'program_created', program);
    return this.get(orgId, program.id, actor);
  }

  async list(
    orgId: string,
    options: PaginationOptions & { departmentId?: string; status?: ProgramStatus },
    actor: Actor,
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions(options);
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    const where: Prisma.ProgramWhereInput = {
      organizationId: orgId,
      departmentId: options.departmentId ?? (!scope.applies || scope.all ? undefined : { in: scope.departmentIds }),
      status: options.status,
      OR: options.search
        ? [
            { name: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: {
          department: true,
          _count: { select: { curriculumVersions: true, offerings: true, studentEnrollments: true } },
        },
      }),
      this.prisma.program.count({ where }),
    ]);
    return formatPaginatedResponse(data, total, options.page || 1, options.limit || 20);
  }

  async get(orgId: string, id: string, actor: Actor) {
    await this.scopedProgram(orgId, id, actor);
    return this.prisma.program.findUnique({ where: { id }, include: PROGRAM_DETAIL_INCLUDE });
  }

  async eligibleCycles(
    orgId: string,
    options: PaginationOptions & { programId?: string },
    actor: Actor,
  ) {
    if (options.programId) await this.scopedProgram(orgId, options.programId, actor);
    const { skip, take } = getPaginationOptions(options);
    const where: Prisma.AcademicCycleWhereInput = {
      organizationId: orgId,
      status: { in: [AcademicCycleStatus.DRAFT, AcademicCycleStatus.ACTIVE] },
      OR: options.search
        ? [
            { name: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
            { code: { contains: options.search, mode: Prisma.QueryMode.insensitive } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.academicCycle.findMany({ where, skip, take, orderBy: { startDate: 'desc' } }),
      this.prisma.academicCycle.count({ where }),
    ]);
    return formatPaginatedResponse(data, total, options.page || 1, options.limit || 50);
  }

  async deliveryOptions(orgId: string, academicCycleId: string, departmentId: string | undefined, actor: Actor) {
    if (!academicCycleId) throw new BadRequestException('academicCycleId is required');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (departmentId) assertDepartmentInScope(scope, departmentId);
    return this.prisma.programStageOffering.findMany({
      where: {
        organizationId: orgId,
        programOffering: {
          academicCycleId,
          program: {
            departmentId: departmentId ?? (!scope.applies || scope.all ? undefined : { in: scope.departmentIds }),
          },
        },
      },
      orderBy: [{ programOffering: { program: { name: 'asc' } } }, { programStage: { sequence: 'asc' } }],
      include: {
        programStage: { include: { courseRequirements: { include: { course: true } } } },
        programOffering: { include: { program: { include: { department: true } }, academicCycle: true } },
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateProgramDto, actor: Actor) {
    const current = await this.scopedProgram(orgId, id, actor);
    const nextDepartmentId = dto.departmentId ?? current.departmentId;
    await this.assertDepartment(orgId, nextDepartmentId, actor);
    if (dto.name || dto.code) await this.assertUnique(orgId, dto.name ?? current.name, dto.code ?? current.code, id);
    const program = await this.prisma.program.update({
      where: { id },
      data: {
        ...dto,
        name: dto.name?.trim(),
        code: dto.code ? normalizeEntityCode(dto.code)! : undefined,
        description: dto.description === undefined ? undefined : this.text(dto.description),
        admissionsLabel: dto.admissionsLabel === undefined ? undefined : this.text(dto.admissionsLabel),
        admissionsDescription: dto.admissionsDescription === undefined ? undefined : this.text(dto.admissionsDescription),
      },
    });
    await this.log(orgId, actor.id, 'program_updated', program);
    return this.get(orgId, id, actor);
  }

  async replaceStructure(orgId: string, id: string, dto: ReplaceProgramStructureDto, actor: Actor) {
    const current = await this.scopedProgram(orgId, id, actor);
    if (current.configurationVersion !== dto.configurationVersion) {
      throw new ConflictException('Program configuration changed; refresh and try again');
    }
    if (dto.metadata) await this.update(orgId, id, dto.metadata, actor);
    await this.runSerializable(async (tx) => {
      const updated = await tx.program.updateMany({
        where: { id, organizationId: orgId, configurationVersion: dto.configurationVersion },
        data: { configurationVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Program configuration changed; refresh and try again');
      await this.createStructure(tx, orgId, id, dto.configurationVersion + 1, actor.id, {
        curriculumName: dto.curriculumName,
        curriculumCode: dto.curriculumCode,
        stageTerminology: dto.stageTerminology,
        stages: dto.stages,
        changeReason: dto.changeReason,
      });
    });
    await this.log(orgId, actor.id, 'program_structure_replaced', current, { version: dto.configurationVersion + 1 });
    return this.get(orgId, id, actor);
  }

  async transitionProgram(orgId: string, id: string, status: ProgramStatus, reason: string | undefined, actor: Actor) {
    const current = await this.scopedProgram(orgId, id, actor);
    if (status === ProgramStatus.ACTIVE) {
      const curriculum = await this.prisma.curriculumVersion.findFirst({
        where: { programId: id, status: CurriculumStatus.ACTIVE, isDefaultForAdmissions: true },
        include: { stages: { include: { _count: { select: { courseRequirements: true } } } } },
      });
      if (!curriculum || curriculum.stages.length === 0) throw new ConflictException('Activate a default admissions curriculum with stages first');
      if (curriculum.stages.some((stage) => !stage.isOptional && stage._count.courseRequirements === 0)) {
        throw new ConflictException('Every required stage needs at least one course requirement');
      }
    }
    const program = await this.prisma.program.update({
      where: { id },
      data: {
        status,
        archivedAt: status === ProgramStatus.ARCHIVED ? new Date() : null,
        archivedById: status === ProgramStatus.ARCHIVED ? actor.id : null,
        archiveReason: status === ProgramStatus.ARCHIVED ? this.text(reason) : null,
      },
    });
    await this.log(orgId, actor.id, 'program_status_changed', program, { from: current.status, to: status, reason });
    return this.get(orgId, id, actor);
  }

  async revisions(orgId: string, id: string, actor: Actor) {
    await this.scopedProgram(orgId, id, actor);
    return this.prisma.programConfigurationRevision.findMany({ where: { programId: id }, orderBy: { version: 'desc' } });
  }

  async delete(orgId: string, id: string, actor: Actor) {
    const program = await this.scopedProgram(orgId, id, actor);
    const used = await this.prisma.program.findUnique({
      where: { id },
      select: { _count: { select: { offerings: true, studentEnrollments: true } } },
    });
    if (used && (used._count.offerings || used._count.studentEnrollments)) {
      throw new ConflictException('Programs with offerings or student history must be archived');
    }
    await this.prisma.program.delete({ where: { id } });
    await this.log(orgId, actor.id, 'program_deleted', program);
    return { success: true };
  }

  private async draftCurriculum(orgId: string, id: string, actor: Actor) {
    const curriculum = await this.prisma.curriculumVersion.findFirst({ where: { id, organizationId: orgId }, include: { program: true } });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, curriculum.program.departmentId);
    if (curriculum.status !== CurriculumStatus.DRAFT) throw new ConflictException('Only draft curricula can be edited');
    return curriculum;
  }

  async createCurriculum(orgId: string, programId: string, dto: CreateCurriculumDto, actor: Actor) {
    const program = await this.scopedProgram(orgId, programId, actor);
    const revision = await this.prisma.programConfigurationRevision.findUnique({
      where: { programId_version: { programId, version: program.configurationVersion } },
    });
    if (!revision) throw new ConflictException('Current program configuration revision is missing');
    return this.prisma.curriculumVersion.create({
      data: {
        organizationId: orgId,
        programId,
        programConfigurationRevisionId: revision.id,
        name: dto.name.trim(),
        code: normalizeEntityCode(dto.code)!,
        stageTerminology: this.text(dto.stageTerminology),
      },
    });
  }

  async updateCurriculum(orgId: string, id: string, dto: UpdateCurriculumDto, actor: Actor) {
    await this.draftCurriculum(orgId, id, actor);
    return this.prisma.curriculumVersion.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code ? normalizeEntityCode(dto.code)! : undefined,
        stageTerminology: dto.stageTerminology === undefined ? undefined : this.text(dto.stageTerminology),
      },
    });
  }

  async transitionCurriculum(
    orgId: string,
    id: string,
    status: CurriculumStatus,
    defaultForAdmissions: boolean | undefined,
    actor: Actor,
  ) {
    const curriculum = await this.prisma.curriculumVersion.findFirst({
      where: { id, organizationId: orgId },
      include: { program: true, stages: { include: { _count: { select: { courseRequirements: true } } } } },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, curriculum.program.departmentId);
    if (status === CurriculumStatus.ACTIVE && curriculum.stages.length === 0) throw new ConflictException('A curriculum needs at least one stage');
    if (status === CurriculumStatus.ACTIVE && curriculum.stages.some((stage) => !stage.isOptional && stage._count.courseRequirements === 0)) {
      throw new ConflictException('Every required stage needs at least one course requirement');
    }
    return this.prisma.$transaction(async (tx) => {
      if (defaultForAdmissions) {
        await tx.curriculumVersion.updateMany({ where: { programId: curriculum.programId }, data: { isDefaultForAdmissions: false } });
      }
      return tx.curriculumVersion.update({
        where: { id },
        data: {
          status,
          isDefaultForAdmissions: defaultForAdmissions ?? curriculum.isDefaultForAdmissions,
          activatedAt: status === CurriculumStatus.ACTIVE ? new Date() : curriculum.activatedAt,
          retiredAt: status === CurriculumStatus.RETIRED ? new Date() : null,
        },
      });
    });
  }

  async createStage(orgId: string, curriculumId: string, dto: CreateProgramStageDto, actor: Actor) {
    await this.draftCurriculum(orgId, curriculumId, actor);
    return this.prisma.programStage.create({
      data: {
        organizationId: orgId,
        curriculumVersionId: curriculumId,
        name: dto.name.trim(),
        code: normalizeEntityCode(dto.code)!,
        sequence: dto.sequence,
        stageType: this.text(dto.stageType),
        isOptional: dto.isOptional ?? false,
        minCredits: dto.minCredits,
        expectedCredits: dto.expectedCredits,
      },
    });
  }

  private async editableStage(orgId: string, id: string, actor: Actor) {
    const stage = await this.prisma.programStage.findFirst({
      where: { id, organizationId: orgId },
      include: { curriculumVersion: { include: { program: true } } },
    });
    if (!stage) throw new NotFoundException('Program stage not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(scope, stage.curriculumVersion.program.departmentId);
    if (stage.curriculumVersion.status !== CurriculumStatus.DRAFT) throw new ConflictException('Only draft curricula can be edited');
    return stage;
  }

  async updateStage(orgId: string, id: string, dto: UpdateProgramStageDto, actor: Actor) {
    await this.editableStage(orgId, id, actor);
    return this.prisma.programStage.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code ? normalizeEntityCode(dto.code)! : undefined,
        stageType: dto.stageType === undefined ? undefined : this.text(dto.stageType),
        isOptional: dto.isOptional,
        minCredits: dto.minCredits,
        expectedCredits: dto.expectedCredits,
      },
    });
  }

  async deleteStage(orgId: string, id: string, actor: Actor) {
    await this.editableStage(orgId, id, actor);
    const count = await this.prisma.programStageOffering.count({ where: { programStageId: id } });
    if (count) throw new ConflictException('An offered stage cannot be deleted');
    await this.prisma.programStage.delete({ where: { id } });
    return { success: true };
  }

  async createRequirement(orgId: string, stageId: string, dto: CreateCourseRequirementDto, actor: Actor) {
    await this.editableStage(orgId, stageId, actor);
    const course = await this.prisma.course.findFirst({ where: { id: dto.courseId, organizationId: orgId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.stageCourseRequirement.create({
      data: {
        organizationId: orgId,
        programStageId: stageId,
        courseId: dto.courseId,
        requirementType: dto.requirementType,
        groupKey: this.text(dto.groupKey),
        minCourses: dto.minCourses,
        minCredits: dto.minCredits,
        sortOrder: dto.sortOrder ?? 0,
        creditHoursSnapshot: course.creditHours,
        notes: this.text(dto.notes),
      },
    });
  }

  private async editableRequirement(orgId: string, id: string, actor: Actor) {
    const requirement = await this.prisma.stageCourseRequirement.findFirst({ where: { id, organizationId: orgId } });
    if (!requirement) throw new NotFoundException('Course requirement not found');
    await this.editableStage(orgId, requirement.programStageId, actor);
    return requirement;
  }

  async updateRequirement(orgId: string, id: string, dto: UpdateCourseRequirementDto, actor: Actor) {
    await this.editableRequirement(orgId, id, actor);
    const course = await this.prisma.course.findFirst({ where: { id: dto.courseId, organizationId: orgId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.stageCourseRequirement.update({
      where: { id },
      data: {
        courseId: dto.courseId,
        requirementType: dto.requirementType,
        groupKey: this.text(dto.groupKey),
        minCourses: dto.minCourses,
        minCredits: dto.minCredits,
        sortOrder: dto.sortOrder ?? 0,
        creditHoursSnapshot: course.creditHours,
        notes: this.text(dto.notes),
      },
    });
  }

  async deleteRequirement(orgId: string, id: string, actor: Actor) {
    await this.editableRequirement(orgId, id, actor);
    const count = await this.prisma.sectionProgramMapping.count({ where: { stageCourseRequirementId: id } });
    if (count) throw new ConflictException('A requirement mapped to delivery cannot be deleted');
    await this.prisma.stageCourseRequirement.delete({ where: { id } });
    return { success: true };
  }
}
