import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicCycleDto } from './dto/create-academic-cycle.dto';
import { UpdateAcademicCycleDto } from './dto/update-academic-cycle.dto';
import {
  getPaginationOptions,
  formatPaginatedResponse,
  PaginationOptions,
  fuzzyFilterAndRank,
} from '../common/utils';
import { AcademicCycleStatus, Prisma } from '@/prisma/prisma-client';
import { GpaService } from '../gpa/gpa.service';
import { normalizeEntityCode } from '../common/entity-code';
import { runSerializableTransaction } from '../common/prisma-transaction';

@Injectable()
export class AcademicCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gpaService: GpaService,
  ) {}

  private async getPolicySnapshot(orgId: string, gpaPolicyId?: string) {
    const policyId = gpaPolicyId?.trim() || undefined;
    const policy = policyId
      ? await this.prisma.gpaPolicy.findFirst({
          where: { id: policyId, organizationId: orgId, isArchived: false },
        })
      : await this.gpaService.getDefaultPolicy(orgId);

    if (!policy) throw new NotFoundException('GPA policy not found');
    if (policy.isArchived)
      throw new BadRequestException(
        'Archived GPA policies cannot be assigned to academic cycles',
      );

    return this.gpaService.snapshotPolicy(policy);
  }

  private async hasFinalizedGrades(cycleId: string) {
    const finalizedCount = await this.prisma.grade.count({
      where: { academicCycleId: cycleId, status: 'FINALIZED' },
    });
    return finalizedCount > 0;
  }

  private async hasDeliveryActivity(
    cycleId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const [
      sections,
      enrollments,
      assessments,
      attendanceSessions,
      evaluations,
      preferenceWindows,
    ] = await Promise.all([
      client.section.count({ where: { academicCycleId: cycleId } }),
      client.enrollment.count({ where: { academicCycleId: cycleId } }),
      client.assessment.count({ where: { academicCycleId: cycleId } }),
      client.attendanceSession.count({ where: { academicCycleId: cycleId } }),
      client.evaluation.count({ where: { academicCycleId: cycleId } }),
      client.preferenceWindow.count({ where: { academicCycleId: cycleId } }),
    ]);
    return (
      sections +
        enrollments +
        assessments +
        attendanceSessions +
        evaluations +
        preferenceWindows >
      0
    );
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    conflictMessage: string,
  ): Promise<T> {
    return runSerializableTransaction(this.prisma, operation, {
      conflictMessage,
    });
  }

  private async assertCodeUnique(
    orgId: string,
    codeValue: string,
    excludeId?: string,
  ) {
    const code = normalizeEntityCode(codeValue);
    if (!code) throw new BadRequestException('Academic cycle code is required');

    const duplicate = await this.prisma.academicCycle.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        code: { equals: code, mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'Academic cycle code already exists in this organization',
      );
    }
  }

  async createCycle(orgId: string, dto: CreateAcademicCycleDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const code = normalizeEntityCode(dto.code);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    await this.assertCodeUnique(orgId, dto.code);

    const gpaPolicySnapshot = await this.getPolicySnapshot(
      orgId,
      dto.gpaPolicyId,
    );
    const status = dto.status ?? AcademicCycleStatus.DRAFT;

    return this.runSerializable(async (tx) => {
      return tx.academicCycle.create({
        data: {
          name: dto.name.trim(),
          code: code!,
          startDate,
          endDate,
          status,
          organizationId: orgId,
          gpaPolicyId: gpaPolicySnapshot.policyId,
          gpaPolicySnapshot:
            gpaPolicySnapshot as unknown as Prisma.InputJsonValue,
        },
      });
    }, 'Academic cycle creation conflicted with another cycle change; refresh and try again');
  }

  async getCycles(
    orgId: string,
    options: PaginationOptions & { academicCycleId?: string },
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'startDate',
      sortOrder: options.sortOrder || 'desc',
    });

    const baseWhere: Prisma.AcademicCycleWhereInput = {
      organizationId: orgId,
    };
    const searchWhere: Prisma.AcademicCycleWhereInput = options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const where: Prisma.AcademicCycleWhereInput = {
      ...baseWhere,
      ...searchWhere,
    };

    const include = {
      gpaPolicy: {
        select: { id: true, name: true, isArchived: true },
      },
      _count: {
        select: {
          cohorts: true,
          sections: true,
          enrollments: true,
        },
      },
    } satisfies Prisma.AcademicCycleInclude;

    const [cycles, totalRecords] = await Promise.all([
      this.prisma.academicCycle.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include,
      }),
      this.prisma.academicCycle.count({ where }),
    ]);

    let visibleCycles = cycles;
    let visibleTotal = totalRecords;

    if (options.search && totalRecords === 0) {
      const candidates = await this.prisma.academicCycle.findMany({
        where: baseWhere,
        take: 500,
        orderBy: { [sortBy]: sortOrder },
        include,
      });
      const ranked = fuzzyFilterAndRank(candidates, options.search, (cycle) => [
        cycle.name,
        cycle.code,
        cycle.gpaPolicy?.name,
      ]);
      visibleCycles = ranked.slice(skip, skip + take);
      visibleTotal = ranked.length;
    }

    const finalizedGrades = await this.prisma.grade.groupBy({
      by: ['academicCycleId'],
      where: {
        academicCycleId: { in: visibleCycles.map((cycle) => cycle.id) },
        status: 'FINALIZED',
      },
      _count: { _all: true },
    });
    const finalizedCycleIds = new Set(
      finalizedGrades.map((row) => row.academicCycleId).filter(Boolean),
    );

    return formatPaginatedResponse(
      visibleCycles.map((cycle) => ({
        ...cycle,
        hasFinalizedGrades: finalizedCycleIds.has(cycle.id),
      })),
      visibleTotal,
      options.page,
      options.limit,
    );
  }

  async getCycle(orgId: string, id: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id, organizationId: orgId },
      include: {
        gpaPolicy: {
          select: { id: true, name: true, isArchived: true },
        },
        campusProgramOfferingBindings: {
          orderBy: { programOffering: { program: { name: 'asc' } } },
          include: {
            programOffering: {
              include: {
                program: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    status: true,
                    campusConfiguration: { select: { departmentId: true } },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            cohortOfferings: true,
            sections: true,
            enrollments: true,
          },
        },
      },
    });

    if (!cycle) throw new NotFoundException('Academic cycle not found');
    return {
      ...cycle,
      hasFinalizedGrades: await this.hasFinalizedGrades(cycle.id),
    };
  }

  async updateCycle(orgId: string, id: string, dto: UpdateAcademicCycleDto) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');
    if (cycle.status !== AcademicCycleStatus.DRAFT) {
      throw new ConflictException(
        'Academic cycle metadata can only be edited while the cycle is in draft',
      );
    }

    const updateData: Prisma.AcademicCycleUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.code !== undefined) {
      await this.assertCodeUnique(orgId, dto.code, id);
      updateData.code = normalizeEntityCode(dto.code)!;
    }
    if (dto.startDate !== undefined)
      updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    const nextGpaPolicyId = dto.gpaPolicyId?.trim() || undefined;
    if (
      dto.gpaPolicyId !== undefined &&
      nextGpaPolicyId !== (cycle.gpaPolicyId || undefined)
    ) {
      if (await this.hasFinalizedGrades(id)) {
        throw new BadRequestException(
          'GPA policy cannot be changed after finalized grades have been pushed for this cycle',
        );
      }
      const gpaPolicySnapshot = await this.getPolicySnapshot(
        orgId,
        nextGpaPolicyId,
      );
      updateData.gpaPolicy = { connect: { id: gpaPolicySnapshot.policyId } };
      updateData.gpaPolicySnapshot =
        gpaPolicySnapshot as unknown as Prisma.InputJsonValue;
    }

    // Validate dates if either is being updated
    const newStart = dto.startDate ? new Date(dto.startDate) : cycle.startDate;
    const newEnd = dto.endDate ? new Date(dto.endDate) : cycle.endDate;
    if (newEnd <= newStart) {
      throw new BadRequestException('End date must be after start date');
    }

    return this.prisma.academicCycle.update({
      where: { id },
      data: updateData,
    });
  }

  async transitionCycle(
    orgId: string,
    id: string,
    targetStatus: AcademicCycleStatus,
    actorId: string,
    reason?: string,
  ) {
    void reason;
    return this.runSerializable(async (tx) => {
      const cycle = await tx.academicCycle.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!cycle) throw new NotFoundException('Academic cycle not found');

      if (cycle.status === targetStatus) return cycle;
      const allowed =
        (cycle.status === AcademicCycleStatus.DRAFT &&
          targetStatus === AcademicCycleStatus.ACTIVE) ||
        (cycle.status === AcademicCycleStatus.ACTIVE &&
          targetStatus === AcademicCycleStatus.DRAFT) ||
        (cycle.status === AcademicCycleStatus.ACTIVE &&
          targetStatus === AcademicCycleStatus.COMPLETED);
      if (!allowed) {
        throw new ConflictException(
          `Academic cycle cannot transition from ${cycle.status} to ${targetStatus}`,
        );
      }
      if (
        cycle.status === AcademicCycleStatus.ACTIVE &&
        targetStatus === AcademicCycleStatus.DRAFT &&
        (await this.hasDeliveryActivity(id, tx))
      ) {
        throw new ConflictException(
          'An academic cycle with delivery activity cannot return to draft',
        );
      }

      if (targetStatus === AcademicCycleStatus.COMPLETED) {
        const unresolvedStageEnrollments =
          await tx.studentStageEnrollment.count({
            where: {
              programStageOffering: { programOffering: { campusBinding: { academicCycleId: id } } },
              status: 'IN_PROGRESS',
            },
          });
        if (unresolvedStageEnrollments) {
          throw new ConflictException(
            `Resolve ${unresolvedStageEnrollments} in-progress student stage enrollment(s) before completing this academic cycle`,
          );
        }
      }

      const updated = await tx.academicCycle.updateMany({
        where: { id, organizationId: orgId, status: cycle.status },
        data: {
          status: targetStatus,
          completedAt:
            targetStatus === AcademicCycleStatus.COMPLETED ? new Date() : null,
          completedById:
            targetStatus === AcademicCycleStatus.COMPLETED ? actorId : null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Academic cycle status changed concurrently; refresh and try again',
        );
      }

      return tx.academicCycle.findUniqueOrThrow({ where: { id } });
    }, 'Academic cycle status changed concurrently; refresh and try again');
  }

  async getActiveCycle(orgId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { organizationId: orgId, status: AcademicCycleStatus.ACTIVE },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { cohortOfferings: true, sections: true, enrollments: true },
        },
      },
    });

    if (!cycle) throw new NotFoundException('No active academic cycle found');
    return cycle;
  }

  async deleteCycle(orgId: string, id: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: {
          select: { sections: true, enrollments: true },
        },
      },
    });

    if (!cycle) throw new NotFoundException('Academic cycle not found');

    if (cycle.status !== AcademicCycleStatus.DRAFT) {
      throw new ConflictException(
        'Only an unused draft academic cycle can be deleted',
      );
    }
    const associationCount = await this.prisma.campusProgramOfferingBinding.count({
      where: { academicCycleId: id },
    });
    if (
      cycle._count.sections > 0 ||
      cycle._count.enrollments > 0 ||
      associationCount > 0 ||
      (await this.hasDeliveryActivity(id))
    ) {
      throw new ConflictException(
        'Cannot delete an academic cycle referenced by delivery or a program offering',
      );
    }

    await this.prisma.academicCycle.delete({ where: { id } });
    return { message: 'Academic cycle deleted' };
  }

  /**
   * Validates that a cycle belongs to the given organization.
   * Returns the cycle or throws NotFoundException.
   */
  async validateCycleBelongsToOrg(cycleId: string, orgId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: cycleId, organizationId: orgId },
    });
    if (!cycle)
      throw new NotFoundException(
        'Academic cycle not found in this organization',
      );
    return cycle;
  }
}
