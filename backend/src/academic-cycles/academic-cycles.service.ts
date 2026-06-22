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
} from '../common/utils';
import { Prisma } from '@/prisma/prisma-client';
import { GpaService } from '../gpa/gpa.service';
import { normalizeEntityCode } from '../common/entity-code';

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
    if (policy.isArchived) throw new BadRequestException('Archived GPA policies cannot be assigned to academic cycles');

    return this.gpaService.snapshotPolicy(policy);
  }

  private async hasFinalizedGrades(cycleId: string) {
    const finalizedCount = await this.prisma.grade.count({
      where: { academicCycleId: cycleId, status: 'FINALIZED' },
    });
    return finalizedCount > 0;
  }

  private async assertCodeUnique(orgId: string, codeValue: string, excludeId?: string) {
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
      throw new ConflictException('Academic cycle code already exists in this organization');
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

    // If setting as active, deactivate all others first
    if (dto.isActive) {
      await this.prisma.academicCycle.updateMany({
        where: { organizationId: orgId, isActive: true },
        data: { isActive: false },
      });
    }

    const gpaPolicySnapshot = await this.getPolicySnapshot(orgId, dto.gpaPolicyId);

    return this.prisma.academicCycle.create({
      data: {
        name: dto.name.trim(),
        code: code!,
        startDate,
        endDate,
        isActive: dto.isActive ?? false,
        organizationId: orgId,
        gpaPolicyId: gpaPolicySnapshot.policyId,
        gpaPolicySnapshot: gpaPolicySnapshot as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getCycles(orgId: string, options: PaginationOptions & { academicCycleId?: string }) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'startDate',
      sortOrder: options.sortOrder || 'desc',
    });

    const where: Prisma.AcademicCycleWhereInput = {
      organizationId: orgId,
      ...(options.search
        ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [cycles, totalRecords] = await Promise.all([
      this.prisma.academicCycle.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
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
        },
      }),
      this.prisma.academicCycle.count({ where }),
    ]);

    const finalizedGrades = await this.prisma.grade.groupBy({
      by: ['academicCycleId'],
      where: {
        academicCycleId: { in: cycles.map((cycle) => cycle.id) },
        status: 'FINALIZED',
      },
      _count: { _all: true },
    });
    const finalizedCycleIds = new Set(finalizedGrades.map((row) => row.academicCycleId).filter(Boolean));

    return formatPaginatedResponse(
      cycles.map((cycle) => ({ ...cycle, hasFinalizedGrades: finalizedCycleIds.has(cycle.id) })),
      totalRecords,
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
        _count: {
          select: {
            cohorts: true,
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

    const updateData: Prisma.AcademicCycleUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.code !== undefined) {
      await this.assertCodeUnique(orgId, dto.code, id);
      updateData.code = normalizeEntityCode(dto.code)!;
    }
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    const nextGpaPolicyId = dto.gpaPolicyId?.trim() || undefined;
    if (dto.gpaPolicyId !== undefined && nextGpaPolicyId !== (cycle.gpaPolicyId || undefined)) {
      if (await this.hasFinalizedGrades(id)) {
        throw new BadRequestException('GPA policy cannot be changed after finalized grades have been pushed for this cycle');
      }
      const gpaPolicySnapshot = await this.getPolicySnapshot(orgId, nextGpaPolicyId);
      updateData.gpaPolicy = { connect: { id: gpaPolicySnapshot.policyId } };
      updateData.gpaPolicySnapshot = gpaPolicySnapshot as unknown as Prisma.InputJsonValue;
    }

    // Validate dates if either is being updated
    const newStart = dto.startDate ? new Date(dto.startDate) : cycle.startDate;
    const newEnd = dto.endDate ? new Date(dto.endDate) : cycle.endDate;
    if (newEnd <= newStart) {
      throw new BadRequestException('End date must be after start date');
    }

    if (dto.isActive !== undefined) {
      if (dto.isActive) {
        // Deactivate all others
        await this.prisma.academicCycle.updateMany({
          where: { organizationId: orgId, isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }
      updateData.isActive = dto.isActive;
    }

    return this.prisma.academicCycle.update({
      where: { id },
      data: updateData,
    });
  }

  async setActiveCycle(orgId: string, id: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!cycle) throw new NotFoundException('Academic cycle not found');

    await this.prisma.$transaction([
      this.prisma.academicCycle.updateMany({
        where: { organizationId: orgId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.academicCycle.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    return { message: 'Academic cycle activated', id };
  }

  async getActiveCycle(orgId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { organizationId: orgId, isActive: true },
      include: {
        _count: {
          select: { cohorts: true, sections: true, enrollments: true },
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

    if (cycle._count.sections > 0 || cycle._count.enrollments > 0) {
      throw new ConflictException(
        'Cannot delete academic cycle with existing sections or enrollments. Archive it instead by deactivating.',
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
    if (!cycle) throw new NotFoundException('Academic cycle not found in this organization');
    return cycle;
  }
}
