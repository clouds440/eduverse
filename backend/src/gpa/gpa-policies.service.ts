import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GpaCalculationMethod, GpaRounding, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGpaPolicyDto, PreviewGpaPolicyDto, UpdateGpaPolicyDto } from './dto/gpa-policy.dto';
import { GpaGradeRule, GpaService } from './gpa.service';

@Injectable()
export class GpaPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gpaService: GpaService,
  ) {}

  list(orgId: string, includeArchived = false) {
    return this.prisma.gpaPolicy.findMany({
      where: { organizationId: orgId, ...(includeArchived ? {} : { isArchived: false }) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { academicCycles: true },
        },
      },
    });
  }

  async create(orgId: string, dto: CreateGpaPolicyDto) {
    const scale = dto.scale ?? 4.0;
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('GPA policy name is required');
    const gradeRules = this.gpaService.validateGradeRules(dto.gradeRules, scale);
    const existingCount = await this.prisma.gpaPolicy.count({ where: { organizationId: orgId } });
    const shouldDefault = dto.isDefault || existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (shouldDefault) {
        await tx.gpaPolicy.updateMany({
          where: { organizationId: orgId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.gpaPolicy.create({
        data: {
          organizationId: orgId,
          name,
          scale,
          method: dto.method ?? GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS,
          rounding: dto.rounding ?? GpaRounding.TWO_DECIMALS,
          gradeRules: gradeRules as unknown as Prisma.InputJsonValue,
          isDefault: shouldDefault,
        },
      });
    });
  }

  async update(orgId: string, id: string, dto: UpdateGpaPolicyDto) {
    const existing = await this.prisma.gpaPolicy.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('GPA policy not found');

    const scale = dto.scale ?? existing.scale;
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException('GPA policy name is required');
    const gradeRules = dto.gradeRules
      ? this.gpaService.validateGradeRules(dto.gradeRules, scale)
      : dto.scale !== undefined
        ? this.gpaService.validateGradeRules(existing.gradeRules as unknown as GpaGradeRule[], scale)
        : undefined;

    return this.prisma.gpaPolicy.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(dto.scale !== undefined ? { scale } : {}),
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.rounding !== undefined ? { rounding: dto.rounding } : {}),
        ...(gradeRules ? { gradeRules: gradeRules as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async delete(orgId: string, id: string) {
    const existing = await this.prisma.gpaPolicy.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('GPA policy not found');
    if (existing.isDefault) {
      throw new BadRequestException('Set another GPA policy as default before deleting this one');
    }
    const usedByCycles = await this.prisma.academicCycle.count({ where: { organizationId: orgId, gpaPolicyId: id } });
    if (usedByCycles > 0) {
      return this.prisma.gpaPolicy.update({
        where: { id },
        data: { isArchived: true },
      });
    }
    return this.prisma.gpaPolicy.delete({ where: { id } });
  }

  async setDefault(orgId: string, id: string) {
    const existing = await this.prisma.gpaPolicy.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('GPA policy not found');
    if (existing.isArchived) throw new BadRequestException('Archived GPA policies cannot be set as default');

    return this.prisma.$transaction(async (tx) => {
      await tx.gpaPolicy.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.gpaPolicy.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  preview(dto: PreviewGpaPolicyDto) {
    const policy = {
      name: 'Preview',
      scale: dto.scale ?? 4.0,
      method: dto.method ?? GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS,
      rounding: dto.rounding ?? GpaRounding.TWO_DECIMALS,
      gradeRules: dto.gradeRules.map((rule) => ({
        min: rule.min,
        max: rule.max,
        letter: rule.letter,
        points: rule.points,
      })) as unknown as Prisma.JsonValue,
    };
    const result = this.gpaService.calculateCourses([
      {
        courseName: 'Sample Course',
        creditHours: dto.creditHours,
        percentage: dto.marks,
      },
    ], policy);

    const course = result.courses[0];
    return {
      letterGrade: course.letterGrade,
      gradePoints: course.gradePoints,
      gpa: result.summary.gpa,
      totalCreditHours: result.summary.totalCreditHours,
    };
  }
}
