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
  ProgramAcademicCycleStatus,
  ProgramStatus,
  Role,
} from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { GpaService, GpaPolicySnapshot } from '../gpa/gpa.service';
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
  ProgramCycleInputDto,
  ProgramCycleInputKind,
  ReplaceProgramCyclesDto,
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

type StructureInput = {
  curriculumName: string;
  curriculumCode: string;
  stageTerminology?: string;
  cycles: ProgramCycleInputDto[];
};

type PreparedCycle = {
  gpaPolicySnapshot?: GpaPolicySnapshot;
};

const PROGRAM_DETAIL_INCLUDE = {
  department: { select: { id: true, name: true, code: true, isActive: true } },
  academicCycles: {
    orderBy: { sequence: 'asc' as const },
    include: {
      academicCycle: {
        select: {
          id: true,
          name: true,
          code: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      },
    },
  },
  configurationRevisions: { orderBy: { version: 'desc' as const }, take: 1 },
  curriculumVersions: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      stages: {
        orderBy: { sequence: 'asc' as const },
        include: {
          programAcademicCycle: {
            include: {
              academicCycle: {
                select: { id: true, name: true, code: true, status: true },
              },
            },
          },
          courseRequirements: {
            orderBy: { sortOrder: 'asc' as const },
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  creditHours: true,
                  departmentId: true,
                },
              },
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      studentEnrollments: true,
      academicCycles: true,
      curriculumVersions: true,
    },
  },
} satisfies Prisma.ProgramInclude;

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gpaService: GpaService,
    private readonly activity: OrganizationActivityService,
  ) {}

  private text(value?: string | null) {
    return value?.trim() || null;
  }

  private checksum(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage:
        'Program configuration changed concurrently; refresh and try again',
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

  private async assertDepartment(
    orgId: string,
    departmentId: string,
    actor: Actor,
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true, isActive: true },
    });
    if (!department) throw new NotFoundException('Department not found');
    if (!department.isActive)
      throw new ConflictException(
        'Programs cannot be assigned to an inactive department',
      );
    await this.assertProgramWriteScope(orgId, departmentId, actor);
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(
      scope,
      departmentId,
      'You cannot manage programs outside your department scope',
    );
  }

  private async assertProgramWriteScope(
    orgId: string,
    departmentId: string,
    actor: Actor,
  ) {
    if (actor.role !== Role.SUB_ADMIN) return;
    const assigned = await this.prisma.subAdminDepartment.findFirst({
      where: {
        organizationId: orgId,
        userId: actor.id,
        departmentId,
      },
      select: { id: true },
    });
    if (!assigned) {
      throw new BadRequestException(
        'You cannot manage programs outside your assigned departments',
      );
    }
  }

  private async assertUnique(
    orgId: string,
    nameValue: string,
    codeValue: string,
    excludeId?: string,
  ) {
    const name = nameValue.trim();
    const code = normalizeEntityCode(codeValue);
    const duplicate = await this.prisma.program.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { name: { equals: name, mode: Prisma.QueryMode.insensitive } },
          { code: { equals: code!, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { name: true, code: true },
    });
    if (!duplicate) return;
    if (duplicate.name.toLowerCase() === name.toLowerCase())
      throw new ConflictException('Program name already exists');
    throw new ConflictException('Program code already exists');
  }

  private validateCycleRows(cycles: ProgramCycleInputDto[]) {
    const existingIds = new Set<string>();
    const newCodes = new Set<string>();
    cycles.forEach((cycle, index) => {
      if (!cycle.stage)
        throw new BadRequestException(
          `Cycle row ${index + 1} requires a stage`,
        );
      if (cycle.kind === ProgramCycleInputKind.EXISTING) {
        if (!cycle.academicCycleId)
          throw new BadRequestException(
            `Cycle row ${index + 1} must select an existing cycle`,
          );
        if (existingIds.has(cycle.academicCycleId))
          throw new ConflictException(
            `Cycle row ${index + 1} duplicates an existing selection`,
          );
        existingIds.add(cycle.academicCycleId);
      } else {
        if (
          !cycle.name?.trim() ||
          !cycle.code ||
          !cycle.startDate ||
          !cycle.endDate
        ) {
          throw new BadRequestException(
            `Cycle row ${index + 1} requires name, code, start date, and end date`,
          );
        }
        const code = normalizeEntityCode(cycle.code)!;
        if (newCodes.has(code))
          throw new ConflictException(
            `Cycle row ${index + 1} duplicates code ${code}`,
          );
        if (new Date(cycle.endDate) <= new Date(cycle.startDate)) {
          throw new BadRequestException(
            `Cycle row ${index + 1} end date must be after its start date`,
          );
        }
        newCodes.add(code);
      }
    });
  }

  private async prepareCycles(orgId: string, cycles: ProgramCycleInputDto[]) {
    this.validateCycleRows(cycles);
    return Promise.all(
      cycles.map(async (cycle): Promise<PreparedCycle> => {
        if (cycle.kind !== ProgramCycleInputKind.NEW) return {};
        const policy = cycle.gpaPolicyId
          ? await this.prisma.gpaPolicy.findFirst({
              where: {
                id: cycle.gpaPolicyId,
                organizationId: orgId,
                isArchived: false,
              },
            })
          : await this.gpaService.getDefaultPolicy(orgId);
        if (!policy) throw new NotFoundException('GPA policy not found');
        return { gpaPolicySnapshot: this.gpaService.snapshotPolicy(policy) };
      }),
    );
  }

  private async validateCourseRequirements(
    tx: PrismaService | Prisma.TransactionClient,
    orgId: string,
    departmentId: string,
    requirements: ProgramCourseRequirementInputDto[],
  ) {
    const ids = requirements.map((requirement) => requirement.courseId);
    if (new Set(ids).size !== ids.length)
      throw new ConflictException(
        'A course can only appear once in the same stage',
      );
    if (ids.length === 0)
      return new Map<string, { id: string; creditHours: number }>();
    const courses = await tx.course.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true, creditHours: true, departmentId: true },
    });
    if (courses.length !== ids.length)
      throw new BadRequestException(
        'One or more stage courses do not belong to this organization',
      );
    if (courses.some((course) => course.departmentId !== departmentId)) {
      throw new BadRequestException(
        'Every stage course must belong to the program department',
      );
    }
    return new Map(courses.map((course) => [course.id, course]));
  }

  private async resolveCycle(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: ProgramCycleInputDto,
    index: number,
    prepared: PreparedCycle,
  ) {
    if (row.kind === ProgramCycleInputKind.EXISTING) {
      const cycle = await tx.academicCycle.findFirst({
        where: {
          id: row.academicCycleId!,
          organizationId: orgId,
          status: {
            notIn: [
              AcademicCycleStatus.ARCHIVING,
              AcademicCycleStatus.ARCHIVED,
            ],
          },
        },
      });
      if (!cycle)
        throw new BadRequestException(`Cycle row ${index + 1} is not eligible`);
      return cycle;
    }

    const code = normalizeEntityCode(row.code)!;
    const conflict = await tx.academicCycle.findFirst({
      where: {
        organizationId: orgId,
        code: { equals: code, mode: Prisma.QueryMode.insensitive },
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });
    if (conflict) {
      throw new ConflictException({
        message: `Cycle ${code} already exists; switch this row to Use existing`,
        rowIndex: index,
        code: 'INLINE_CYCLE_EXISTS',
        existingCycle: conflict,
      });
    }
    const snapshot = prepared.gpaPolicySnapshot!;
    return tx.academicCycle.create({
      data: {
        organizationId: orgId,
        name: row.name!.trim(),
        code,
        startDate: new Date(row.startDate!),
        endDate: new Date(row.endDate!),
        status: AcademicCycleStatus.DRAFT,
        gpaPolicyId: snapshot.policyId,
        gpaPolicySnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async createConfiguration(
    tx: Prisma.TransactionClient,
    orgId: string,
    program: { id: string; departmentId: string; code: string },
    version: number,
    actorId: string,
    input: StructureInput,
    prepared: PreparedCycle[],
    changeReason?: string,
  ) {
    const selectedCycleIds = new Set<string>();
    const associations: Prisma.ProgramAcademicCycleGetPayload<{
      include: {
        academicCycle: { select: { id: true; name: true; code: true } };
      };
    }>[] = [];

    if (version > 1) {
      await tx.programAcademicCycle.updateMany({
        where: {
          programId: program.id,
          status: ProgramAcademicCycleStatus.ACTIVE,
        },
        data: {
          status: ProgramAcademicCycleStatus.RETIRED,
          retiredAt: new Date(),
          retiredById: actorId,
        },
      });
    }

    for (let index = 0; index < input.cycles.length; index += 1) {
      const cycle = await this.resolveCycle(
        tx,
        orgId,
        input.cycles[index],
        index,
        prepared[index],
      );
      if (selectedCycleIds.has(cycle.id))
        throw new ConflictException(
          `Cycle row ${index + 1} duplicates another row`,
        );
      selectedCycleIds.add(cycle.id);

      const association = await tx.programAcademicCycle.upsert({
        where: {
          programId_academicCycleId: {
            programId: program.id,
            academicCycleId: cycle.id,
          },
        },
        create: {
          organizationId: orgId,
          programId: program.id,
          academicCycleId: cycle.id,
          sequence: index + 1,
          status: ProgramAcademicCycleStatus.ACTIVE,
        },
        update: {
          sequence: index + 1,
          status: ProgramAcademicCycleStatus.ACTIVE,
          retiredAt: null,
          retiredById: null,
        },
        include: {
          academicCycle: { select: { id: true, name: true, code: true } },
        },
      });
      associations.push(association);
    }

    await tx.programAcademicCycle.updateMany({
      where: {
        programId: program.id,
        academicCycleId: { notIn: [...selectedCycleIds] },
        status: ProgramAcademicCycleStatus.ACTIVE,
      },
      data: {
        status: ProgramAcademicCycleStatus.RETIRED,
        retiredAt: new Date(),
        retiredById: actorId,
      },
    });

    const cyclesSnapshot = associations.map((association) => ({
      programAcademicCycleId: association.id,
      academicCycleId: association.academicCycleId,
      sequence: association.sequence,
      code: association.academicCycle.code,
      name: association.academicCycle.name,
    }));
    const revision = await tx.programConfigurationRevision.create({
      data: {
        organizationId: orgId,
        programId: program.id,
        version,
        requiredCycleCount: associations.length,
        cyclesSnapshot: cyclesSnapshot as unknown as Prisma.InputJsonValue,
        checksum: this.checksum(cyclesSnapshot),
        changeReason: this.text(changeReason),
        createdById: actorId,
      },
    });

    const curriculum = await tx.curriculumVersion.create({
      data: {
        organizationId: orgId,
        programId: program.id,
        programConfigurationRevisionId: revision.id,
        name: input.curriculumName.trim(),
        code: normalizeEntityCode(input.curriculumCode)!,
        stageTerminology: this.text(input.stageTerminology),
        status: CurriculumStatus.DRAFT,
      },
    });

    for (let index = 0; index < input.cycles.length; index += 1) {
      const stageInput = input.cycles[index].stage;
      const courseMap = await this.validateCourseRequirements(
        tx,
        orgId,
        program.departmentId,
        stageInput.courseRequirements || [],
      );
      const stage = await tx.programStage.create({
        data: {
          organizationId: orgId,
          curriculumVersionId: curriculum.id,
          programAcademicCycleId: associations[index].id,
          name: stageInput.name.trim(),
          code: normalizeEntityCode(stageInput.code)!,
          sequence: index + 1,
          stageType: this.text(stageInput.stageType),
          isOptional: stageInput.isOptional ?? false,
          minCredits: stageInput.minCredits,
          expectedCredits: stageInput.expectedCredits,
        },
      });
      for (
        let requirementIndex = 0;
        requirementIndex < (stageInput.courseRequirements || []).length;
        requirementIndex += 1
      ) {
        const requirement = stageInput.courseRequirements[requirementIndex];
        await tx.stageCourseRequirement.create({
          data: {
            organizationId: orgId,
            programStageId: stage.id,
            courseId: requirement.courseId,
            requirementType: requirement.requirementType,
            groupKey: this.text(requirement.groupKey),
            minCourses: requirement.minCourses,
            minCredits: requirement.minCredits,
            sortOrder: requirementIndex,
            creditHoursSnapshot: courseMap.get(requirement.courseId)!
              .creditHours,
            notes: this.text(requirement.notes),
          },
        });
      }
    }

    return { revision, curriculum, associations };
  }

  async create(orgId: string, dto: CreateProgramDto, actor: Actor) {
    await this.assertDepartment(orgId, dto.departmentId, actor);
    await this.assertUnique(orgId, dto.name, dto.code);
    const prepared = await this.prepareCycles(orgId, dto.cycles);
    const program = await this.runSerializable(async (tx) => {
      const created = await tx.program.create({
        data: {
          organizationId: orgId,
          departmentId: dto.departmentId,
          name: dto.name.trim(),
          code: normalizeEntityCode(dto.code)!,
          description: this.text(dto.description),
          requiredCycleCount: dto.cycles.length,
          configurationVersion: 1,
          structureType: dto.structureType,
          progressionMode: dto.progressionMode,
          completionMode: dto.completionMode,
          durationValue: dto.durationValue,
          durationUnit: dto.durationUnit,
          isVisibleForAdmissions: dto.isVisibleForAdmissions ?? false,
          admissionsLabel: this.text(dto.admissionsLabel),
          admissionsDescription: this.text(dto.admissionsDescription),
        },
      });
      await this.createConfiguration(
        tx,
        orgId,
        created,
        1,
        actor.id,
        dto,
        prepared,
        'Initial program configuration',
      );
      return created;
    });
    await this.log(orgId, actor.id, 'program_created', program, {
      requiredCycleCount: dto.cycles.length,
    });
    return this.get(orgId, program.id, actor);
  }

  async list(
    orgId: string,
    options: PaginationOptions & {
      departmentId?: string;
      status?: ProgramStatus;
    },
    actor: Actor,
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'name',
    });
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    const where: Prisma.ProgramWhereInput = {
      organizationId: orgId,
      ...(scope.applies && !scope.all
        ? { departmentId: { in: scope.departmentIds } }
        : {}),
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { code: { contains: options.search, mode: 'insensitive' } },
              {
                description: { contains: options.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          department: {
            select: { id: true, name: true, code: true, isActive: true },
          },
          academicCycles: {
            where: { status: ProgramAcademicCycleStatus.ACTIVE },
            orderBy: { sequence: 'asc' },
            include: {
              academicCycle: {
                select: { id: true, name: true, code: true, status: true },
              },
            },
          },
          _count: {
            select: { studentEnrollments: true, curriculumVersions: true },
          },
        },
      }),
      this.prisma.program.count({ where }),
    ]);
    return formatPaginatedResponse(rows, total, options.page, options.limit);
  }

  async get(orgId: string, id: string, actor: Actor) {
    const program = await this.prisma.program.findFirst({
      where: { id, organizationId: orgId },
      include: PROGRAM_DETAIL_INCLUDE,
    });
    if (!program) throw new NotFoundException('Program not found');
    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    assertDepartmentInScope(
      scope,
      program.departmentId,
      'You cannot view programs outside your department scope',
    );
    return program;
  }

  async eligibleCycles(
    orgId: string,
    options: PaginationOptions & { programId?: string },
    actor: Actor,
  ) {
    const { skip, take } = getPaginationOptions(options);
    const search = options.search;
    const programId = options.programId;
    if (programId) await this.get(orgId, programId, actor);
    const where: Prisma.AcademicCycleWhereInput = {
      organizationId: orgId,
      status: {
        notIn: [AcademicCycleStatus.ARCHIVING, AcademicCycleStatus.ARCHIVED],
      },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(programId
        ? {
            programAssociations: {
              none: { programId, status: ProgramAcademicCycleStatus.ACTIVE },
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.academicCycle.findMany({
        where,
        skip,
        take,
        orderBy: { startDate: 'desc' },
        include: {
          _count: {
            select: {
              programAssociations: {
                where: { status: ProgramAcademicCycleStatus.ACTIVE },
              },
            },
          },
        },
      }),
      this.prisma.academicCycle.count({ where }),
    ]);
    return formatPaginatedResponse(
      rows.map((cycle) => ({
        ...cycle,
        programUseCount: cycle._count.programAssociations,
      })),
      total,
      options.page,
      options.limit,
    );
  }

  async deliveryOptions(
    orgId: string,
    academicCycleId: string,
    departmentId: string | undefined,
    actor: Actor,
  ) {
    if (!academicCycleId)
      throw new BadRequestException('Academic cycle is required');
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: academicCycleId, organizationId: orgId },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');

    const scope = await getDepartmentScope(this.prisma, orgId, actor);
    if (departmentId)
      assertDepartmentInScope(
        scope,
        departmentId,
        'You cannot view program delivery outside your department scope',
      );
    const scopedDepartmentIds =
      scope.applies && !scope.all ? scope.departmentIds : undefined;
    if (scopedDepartmentIds && scopedDepartmentIds.length === 0) return [];

    const associations = await this.prisma.programAcademicCycle.findMany({
      where: {
        organizationId: orgId,
        academicCycleId,
        status: ProgramAcademicCycleStatus.ACTIVE,
        program: {
          status: { in: [ProgramStatus.ACTIVE, ProgramStatus.TEACH_OUT] },
          departmentId:
            departmentId ??
            (scopedDepartmentIds ? { in: scopedDepartmentIds } : undefined),
        },
      },
      include: {
        academicCycle: true,
        program: { include: { department: true } },
        stages: {
          where: { curriculumVersion: { status: CurriculumStatus.ACTIVE } },
          include: {
            curriculumVersion: {
              include: { programConfigurationRevision: true },
            },
            courseRequirements: {
              include: { course: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: [{ program: { name: 'asc' } }, { sequence: 'asc' }],
    });

    return associations
      .map((association) => ({
        ...association,
        stages: association.stages.filter(
          (stage) =>
            stage.curriculumVersion.programConfigurationRevision.version ===
            association.program.configurationVersion,
        ),
      }))
      .filter((association) => association.stages.length > 0);
  }

  async update(orgId: string, id: string, dto: UpdateProgramDto, actor: Actor) {
    const existing = await this.get(orgId, id, actor);
    await this.assertProgramWriteScope(orgId, existing.departmentId, actor);
    if (existing.status === ProgramStatus.ARCHIVED)
      throw new ConflictException('Archived programs are read-only');
    const departmentId = dto.departmentId ?? existing.departmentId;
    if (
      dto.departmentId &&
      dto.departmentId !== existing.departmentId &&
      existing._count.studentEnrollments > 0
    ) {
      throw new ConflictException(
        'A program with student enrollment history cannot move to another department',
      );
    }
    await this.assertDepartment(orgId, departmentId, actor);
    if (dto.name !== undefined || dto.code !== undefined) {
      await this.assertUnique(
        orgId,
        dto.name ?? existing.name,
        dto.code ?? existing.code,
        id,
      );
    }
    const program = await this.prisma.program.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code:
          dto.code !== undefined ? normalizeEntityCode(dto.code)! : undefined,
        departmentId: dto.departmentId,
        description:
          dto.description !== undefined
            ? this.text(dto.description)
            : undefined,
        structureType: dto.structureType,
        progressionMode: dto.progressionMode,
        completionMode: dto.completionMode,
        durationValue: dto.durationValue,
        durationUnit: dto.durationUnit,
        isVisibleForAdmissions: dto.isVisibleForAdmissions,
        admissionsLabel:
          dto.admissionsLabel !== undefined
            ? this.text(dto.admissionsLabel)
            : undefined,
        admissionsDescription:
          dto.admissionsDescription !== undefined
            ? this.text(dto.admissionsDescription)
            : undefined,
      },
    });
    await this.log(orgId, actor.id, 'program_updated', program);
    return this.get(orgId, id, actor);
  }

  async replaceCycles(
    orgId: string,
    id: string,
    dto: ReplaceProgramCyclesDto,
    actor: Actor,
  ) {
    const existing = await this.get(orgId, id, actor);
    await this.assertProgramWriteScope(orgId, existing.departmentId, actor);
    if (
      existing.status !== ProgramStatus.DRAFT &&
      existing.status !== ProgramStatus.PAUSED
    ) {
      throw new ConflictException(
        'Program cycles can only be changed while the program is draft or paused',
      );
    }
    const metadata = dto.metadata;
    const nextDepartmentId = metadata?.departmentId ?? existing.departmentId;
    await this.assertDepartment(orgId, nextDepartmentId, actor);
    if (
      metadata?.departmentId &&
      metadata.departmentId !== existing.departmentId &&
      existing._count.studentEnrollments > 0
    ) {
      throw new ConflictException(
        'A program with student enrollment history cannot move to another department',
      );
    }
    if (metadata?.name !== undefined || metadata?.code !== undefined) {
      await this.assertUnique(
        orgId,
        metadata.name ?? existing.name,
        metadata.code ?? existing.code,
        id,
      );
    }
    const prepared = await this.prepareCycles(orgId, dto.cycles);
    const program = await this.runSerializable(async (tx) => {
      const versionClaim = await tx.program.updateMany({
        where: {
          id,
          organizationId: orgId,
          configurationVersion: dto.configurationVersion,
        },
        data: {
          configurationVersion: { increment: 1 },
          requiredCycleCount: dto.cycles.length,
          name: metadata?.name?.trim(),
          code:
            metadata?.code !== undefined
              ? normalizeEntityCode(metadata.code)!
              : undefined,
          departmentId: metadata?.departmentId,
          description:
            metadata?.description !== undefined
              ? this.text(metadata.description)
              : undefined,
          structureType: metadata?.structureType,
          progressionMode: metadata?.progressionMode,
          completionMode: metadata?.completionMode,
          durationValue: metadata?.durationValue,
          durationUnit: metadata?.durationUnit,
          isVisibleForAdmissions: metadata?.isVisibleForAdmissions,
          admissionsLabel:
            metadata?.admissionsLabel !== undefined
              ? this.text(metadata.admissionsLabel)
              : undefined,
          admissionsDescription:
            metadata?.admissionsDescription !== undefined
              ? this.text(metadata.admissionsDescription)
              : undefined,
        },
      });
      if (versionClaim.count !== 1)
        throw new ConflictException(
          'Program configuration is stale; refresh and try again',
        );
      const updated = await tx.program.findUniqueOrThrow({ where: { id } });
      await this.createConfiguration(
        tx,
        orgId,
        updated,
        updated.configurationVersion,
        actor.id,
        dto,
        prepared,
        dto.changeReason,
      );
      return updated;
    });
    await this.log(orgId, actor.id, 'program_cycles_reconfigured', program, {
      configurationVersion: program.configurationVersion,
      requiredCycleCount: dto.cycles.length,
      reason: dto.changeReason,
    });
    return this.get(orgId, id, actor);
  }

  private async assertCurriculumComplete(
    tx: Prisma.TransactionClient,
    curriculumId: string,
    programId: string,
  ) {
    const curriculum = await tx.curriculumVersion.findFirst({
      where: { id: curriculumId, programId },
      include: {
        program: {
          include: {
            academicCycles: {
              where: { status: ProgramAcademicCycleStatus.ACTIVE },
            },
          },
        },
        stages: {
          include: { _count: { select: { courseRequirements: true } } },
        },
      },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    const requiredAssociations = curriculum.program.academicCycles;
    if (curriculum.stages.length !== requiredAssociations.length) {
      throw new ConflictException(
        'Curriculum must map every required program cycle exactly once',
      );
    }
    const stageAssociations = new Set(
      curriculum.stages.map((stage) => stage.programAcademicCycleId),
    );
    if (
      stageAssociations.size !== requiredAssociations.length ||
      requiredAssociations.some((row) => !stageAssociations.has(row.id))
    ) {
      throw new ConflictException(
        'Curriculum stages do not match the current program cycle configuration',
      );
    }
    const incomplete = curriculum.stages.find(
      (stage) => stage._count.courseRequirements === 0 && !stage.isOptional,
    );
    if (incomplete)
      throw new ConflictException(
        `Stage ${incomplete.name} requires at least one course requirement`,
      );
    return curriculum;
  }

  async transitionProgram(
    orgId: string,
    id: string,
    target: ProgramStatus,
    reason: string | undefined,
    actor: Actor,
  ) {
    const existing = await this.get(orgId, id, actor);
    await this.assertProgramWriteScope(orgId, existing.departmentId, actor);
    if (existing.status === target) return existing;
    const allowed: Record<ProgramStatus, ProgramStatus[]> = {
      DRAFT: [ProgramStatus.ACTIVE, ProgramStatus.ARCHIVED],
      ACTIVE: [
        ProgramStatus.PAUSED,
        ProgramStatus.TEACH_OUT,
        ProgramStatus.ARCHIVED,
      ],
      PAUSED: [ProgramStatus.ACTIVE, ProgramStatus.ARCHIVED],
      TEACH_OUT: [ProgramStatus.ARCHIVED],
      ARCHIVED: [],
    };
    if (!allowed[existing.status].includes(target)) {
      throw new ConflictException(
        `Program cannot transition from ${existing.status} to ${target}`,
      );
    }
    if (target === ProgramStatus.ARCHIVED && !reason?.trim())
      throw new BadRequestException('Archive reason is required');
    if (target === ProgramStatus.ARCHIVED) {
      const openStudents = await this.prisma.studentProgramEnrollment.count({
        where: {
          programId: id,
          status: { in: ['ADMITTED', 'ACTIVE', 'ON_HOLD'] },
        },
      });
      if (openStudents > 0)
        throw new ConflictException(
          'A program with open student enrollments cannot be archived',
        );
    }

    const program = await this.runSerializable(async (tx) => {
      if (target === ProgramStatus.ACTIVE) {
        const currentRevision =
          await tx.programConfigurationRevision.findUnique({
            where: {
              programId_version: {
                programId: id,
                version: existing.configurationVersion,
              },
            },
          });
        if (!currentRevision)
          throw new ConflictException(
            'Current program configuration revision is missing',
          );
        const curriculum = await tx.curriculumVersion.findFirst({
          where: {
            programId: id,
            programConfigurationRevisionId: currentRevision.id,
            status: CurriculumStatus.ACTIVE,
            isDefaultForAdmissions: true,
          },
        });
        if (!curriculum)
          throw new ConflictException(
            'Activate a default curriculum for the current program configuration first',
          );
        await this.assertCurriculumComplete(tx, curriculum.id, id);
      }
      return tx.program.update({
        where: { id },
        data: {
          status: target,
          isVisibleForAdmissions:
            target === ProgramStatus.ARCHIVED ? false : undefined,
          archivedAt: target === ProgramStatus.ARCHIVED ? new Date() : null,
          archivedById: target === ProgramStatus.ARCHIVED ? actor.id : null,
          archiveReason:
            target === ProgramStatus.ARCHIVED ? reason!.trim() : null,
        },
      });
    });
    await this.log(orgId, actor.id, 'program_status_changed', program, {
      from: existing.status,
      to: target,
      reason,
    });
    return this.get(orgId, id, actor);
  }

  async revisions(orgId: string, id: string, actor: Actor) {
    await this.get(orgId, id, actor);
    return this.prisma.programConfigurationRevision.findMany({
      where: { programId: id, organizationId: orgId },
      orderBy: { version: 'desc' },
    });
  }

  async delete(orgId: string, id: string, actor: Actor) {
    const program = await this.get(orgId, id, actor);
    await this.assertProgramWriteScope(orgId, program.departmentId, actor);
    if (program.status !== ProgramStatus.DRAFT)
      throw new ConflictException('Only a draft program can be deleted');
    const [studentEnrollments, cohorts, requirementMappings] =
      await Promise.all([
        this.prisma.studentProgramEnrollment.count({
          where: { programId: id },
        }),
        this.prisma.cohort.count({
          where: { programAcademicCycle: { programId: id } },
        }),
        this.prisma.sectionRequirementMapping.count({
          where: { programAcademicCycle: { programId: id } },
        }),
      ]);
    if (studentEnrollments + cohorts + requirementMappings > 0) {
      throw new ConflictException(
        'A program referenced by students or delivery cannot be deleted',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.stageCourseRequirement.deleteMany({
        where: { programStage: { curriculumVersion: { programId: id } } },
      });
      await tx.programStage.deleteMany({
        where: { curriculumVersion: { programId: id } },
      });
      await tx.curriculumVersion.deleteMany({ where: { programId: id } });
      await tx.programConfigurationRevision.deleteMany({
        where: { programId: id },
      });
      await tx.programAcademicCycle.deleteMany({ where: { programId: id } });
      await tx.program.delete({ where: { id } });
    });
    await this.log(orgId, actor.id, 'program_deleted', program);
    return { message: 'Unused draft program deleted' };
  }

  async createCurriculum(
    orgId: string,
    programId: string,
    dto: CreateCurriculumDto,
    actor: Actor,
  ) {
    const program = await this.get(orgId, programId, actor);
    await this.assertProgramWriteScope(orgId, program.departmentId, actor);
    if (program.status === ProgramStatus.ARCHIVED)
      throw new ConflictException('Archived programs are read-only');
    const revision = await this.prisma.programConfigurationRevision.findUnique({
      where: {
        programId_version: { programId, version: program.configurationVersion },
      },
    });
    if (!revision)
      throw new ConflictException(
        'Current program configuration revision is missing',
      );
    const curriculum = await this.prisma.curriculumVersion.create({
      data: {
        organizationId: orgId,
        programId,
        programConfigurationRevisionId: revision.id,
        name: dto.name.trim(),
        code: normalizeEntityCode(dto.code)!,
        stageTerminology: this.text(dto.stageTerminology),
      },
    });
    await this.log(orgId, actor.id, 'program_curriculum_created', program, {
      curriculumId: curriculum.id,
    });
    return curriculum;
  }

  private async editableCurriculum(
    orgId: string,
    curriculumId: string,
    actor: Actor,
  ) {
    const curriculum = await this.prisma.curriculumVersion.findFirst({
      where: { id: curriculumId, organizationId: orgId },
      include: { program: true },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    await this.get(orgId, curriculum.programId, actor);
    await this.assertProgramWriteScope(
      orgId,
      curriculum.program.departmentId,
      actor,
    );
    if (curriculum.status !== CurriculumStatus.DRAFT)
      throw new ConflictException('Only draft curricula can be edited');
    return curriculum;
  }

  async updateCurriculum(
    orgId: string,
    id: string,
    dto: UpdateCurriculumDto,
    actor: Actor,
  ) {
    const existing = await this.editableCurriculum(orgId, id, actor);
    return this.prisma.curriculumVersion.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code:
          dto.code !== undefined ? normalizeEntityCode(dto.code)! : undefined,
        stageTerminology:
          dto.stageTerminology !== undefined
            ? this.text(dto.stageTerminology)
            : undefined,
      },
    });
  }

  async transitionCurriculum(
    orgId: string,
    id: string,
    target: CurriculumStatus,
    defaultForAdmissions: boolean | undefined,
    actor: Actor,
  ) {
    const curriculum = await this.prisma.curriculumVersion.findFirst({
      where: { id, organizationId: orgId },
      include: { program: true },
    });
    if (!curriculum) throw new NotFoundException('Curriculum not found');
    await this.get(orgId, curriculum.programId, actor);
    await this.assertProgramWriteScope(
      orgId,
      curriculum.program.departmentId,
      actor,
    );
    if (curriculum.status === target) return curriculum;
    const allowed =
      (curriculum.status === CurriculumStatus.DRAFT &&
        target === CurriculumStatus.ACTIVE) ||
      (curriculum.status === CurriculumStatus.ACTIVE &&
        target === CurriculumStatus.RETIRED) ||
      (curriculum.status === CurriculumStatus.RETIRED &&
        target === CurriculumStatus.ARCHIVED);
    if (!allowed)
      throw new ConflictException(
        `Curriculum cannot transition from ${curriculum.status} to ${target}`,
      );

    return this.runSerializable(async (tx) => {
      if (target === CurriculumStatus.ACTIVE) {
        const revision = await tx.programConfigurationRevision.findUnique({
          where: {
            programId_version: {
              programId: curriculum.programId,
              version: curriculum.program.configurationVersion,
            },
          },
        });
        if (
          !revision ||
          curriculum.programConfigurationRevisionId !== revision.id
        ) {
          throw new ConflictException(
            'Only a curriculum for the current program configuration can be activated',
          );
        }
        await this.assertCurriculumComplete(tx, id, curriculum.programId);
        if (defaultForAdmissions ?? true) {
          await tx.curriculumVersion.updateMany({
            where: {
              programId: curriculum.programId,
              isDefaultForAdmissions: true,
            },
            data: { isDefaultForAdmissions: false },
          });
        }
      }
      return tx.curriculumVersion.update({
        where: { id },
        data: {
          status: target,
          isDefaultForAdmissions:
            target === CurriculumStatus.ACTIVE
              ? (defaultForAdmissions ?? true)
              : false,
          activatedAt:
            target === CurriculumStatus.ACTIVE
              ? new Date()
              : curriculum.activatedAt,
          retiredAt:
            target === CurriculumStatus.RETIRED
              ? new Date()
              : curriculum.retiredAt,
        },
      });
    });
  }

  async createStage(
    orgId: string,
    curriculumId: string,
    dto: CreateProgramStageDto,
    actor: Actor,
  ) {
    const curriculum = await this.editableCurriculum(
      orgId,
      curriculumId,
      actor,
    );
    const association = await this.prisma.programAcademicCycle.findFirst({
      where: {
        id: dto.programAcademicCycleId,
        programId: curriculum.programId,
        organizationId: orgId,
        status: ProgramAcademicCycleStatus.ACTIVE,
      },
    });
    if (!association)
      throw new BadRequestException(
        'Program cycle association is not eligible',
      );
    return this.prisma.programStage.create({
      data: {
        organizationId: orgId,
        curriculumVersionId: curriculumId,
        programAcademicCycleId: dto.programAcademicCycleId,
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

  async updateStage(
    orgId: string,
    id: string,
    dto: UpdateProgramStageDto,
    actor: Actor,
  ) {
    const stage = await this.prisma.programStage.findFirst({
      where: { id, organizationId: orgId },
      include: { curriculumVersion: true },
    });
    if (!stage) throw new NotFoundException('Program stage not found');
    await this.editableCurriculum(orgId, stage.curriculumVersionId, actor);
    return this.prisma.programStage.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code:
          dto.code !== undefined ? normalizeEntityCode(dto.code)! : undefined,
        stageType:
          dto.stageType !== undefined ? this.text(dto.stageType) : undefined,
        isOptional: dto.isOptional,
        minCredits: dto.minCredits,
        expectedCredits: dto.expectedCredits,
      },
    });
  }

  async deleteStage(orgId: string, id: string, actor: Actor) {
    const stage = await this.prisma.programStage.findFirst({
      where: { id, organizationId: orgId },
      include: {
        curriculumVersion: true,
        _count: { select: { cohorts: true, studentStageAttempts: true } },
      },
    });
    if (!stage) throw new NotFoundException('Program stage not found');
    await this.editableCurriculum(orgId, stage.curriculumVersionId, actor);
    if (stage._count.cohorts || stage._count.studentStageAttempts)
      throw new ConflictException('A used stage cannot be deleted');
    await this.prisma.programStage.delete({ where: { id } });
    return { message: 'Program stage deleted' };
  }

  async createRequirement(
    orgId: string,
    stageId: string,
    dto: CreateCourseRequirementDto,
    actor: Actor,
  ) {
    const stage = await this.prisma.programStage.findFirst({
      where: { id: stageId, organizationId: orgId },
      include: { curriculumVersion: { include: { program: true } } },
    });
    if (!stage) throw new NotFoundException('Program stage not found');
    await this.editableCurriculum(orgId, stage.curriculumVersionId, actor);
    const duplicate = await this.prisma.stageCourseRequirement.findFirst({
      where: { programStageId: stageId, courseId: dto.courseId },
    });
    if (duplicate)
      throw new ConflictException(
        'This course is already required by the stage',
      );
    const courses = await this.validateCourseRequirements(
      this.prisma,
      orgId,
      stage.curriculumVersion.program.departmentId,
      [dto],
    );
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
        creditHoursSnapshot: courses.get(dto.courseId)!.creditHours,
        notes: this.text(dto.notes),
      },
    });
  }

  async updateRequirement(
    orgId: string,
    id: string,
    dto: UpdateCourseRequirementDto,
    actor: Actor,
  ) {
    const requirement = await this.prisma.stageCourseRequirement.findFirst({
      where: { id, organizationId: orgId },
      include: {
        programStage: {
          include: { curriculumVersion: { include: { program: true } } },
        },
      },
    });
    if (!requirement)
      throw new NotFoundException('Course requirement not found');
    await this.editableCurriculum(
      orgId,
      requirement.programStage.curriculumVersionId,
      actor,
    );
    const courses = await this.validateCourseRequirements(
      this.prisma,
      orgId,
      requirement.programStage.curriculumVersion.program.departmentId,
      [dto],
    );
    return this.prisma.stageCourseRequirement.update({
      where: { id },
      data: {
        courseId: dto.courseId,
        requirementType: dto.requirementType,
        groupKey: this.text(dto.groupKey),
        minCourses: dto.minCourses,
        minCredits: dto.minCredits,
        sortOrder: dto.sortOrder ?? 0,
        creditHoursSnapshot: courses.get(dto.courseId)!.creditHours,
        notes: this.text(dto.notes),
      },
    });
  }

  async deleteRequirement(orgId: string, id: string, actor: Actor) {
    const requirement = await this.prisma.stageCourseRequirement.findFirst({
      where: { id, organizationId: orgId },
      include: {
        programStage: true,
        _count: { select: { sectionMappings: true } },
      },
    });
    if (!requirement)
      throw new NotFoundException('Course requirement not found');
    await this.editableCurriculum(
      orgId,
      requirement.programStage.curriculumVersionId,
      actor,
    );
    if (requirement._count.sectionMappings)
      throw new ConflictException(
        'A mapped course requirement cannot be deleted',
      );
    await this.prisma.stageCourseRequirement.delete({ where: { id } });
    return { message: 'Course requirement deleted' };
  }
}
