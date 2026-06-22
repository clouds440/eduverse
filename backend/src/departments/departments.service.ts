import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions, PaginationOptions } from '../common/utils';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { normalizeEntityColor } from '../common/colors';
import { getDepartmentScope, assertDepartmentInScope, type DepartmentScopedUser } from '../common/department-scope';
import { Role } from '../common/enums';
import { normalizeEntityCode } from '../common/entity-code';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private includeRelations = {
    buildingDepartments: {
      include: {
        building: {
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    },
  } satisfies Prisma.DepartmentInclude;

  private shapeDepartment<T extends { buildingDepartments?: { building: unknown }[] }>(department: T) {
    const { buildingDepartments, ...rest } = department;
    return {
      ...rest,
      buildings: buildingDepartments?.map((link) => link.building) || [],
    };
  }

  private async assertUnique(orgId: string, dto: Pick<CreateDepartmentDto, 'name' | 'code'>, excludeId?: string) {
    const name = dto.name?.trim();
    const code = normalizeEntityCode(dto.code);
    const duplicate = await this.prisma.department.findFirst({
      where: {
        organizationId: orgId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          ...(name ? [{ name: { equals: name, mode: Prisma.QueryMode.insensitive } }] : []),
          ...(code ? [{ code: { equals: code, mode: Prisma.QueryMode.insensitive } }] : []),
        ],
      },
      select: { id: true, name: true, code: true },
    });

    if (!duplicate) return;
    if (name && duplicate.name.toLowerCase() === name.toLowerCase()) {
      throw new ConflictException('Department name already exists in this organization');
    }
    throw new ConflictException('Department code already exists in this organization');
  }

  async createDepartment(orgId: string, dto: CreateDepartmentDto) {
    await this.assertUnique(orgId, dto);

    const color = normalizeEntityColor(dto.color, `${orgId}:${dto.name}`, '#3B82F6');

    const department = await this.prisma.department.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        code: normalizeEntityCode(dto.code)!,
        description: this.normalizeText(dto.description),
        color,
        isActive: dto.isActive ?? true,
      },
      include: this.includeRelations,
    });

    return this.shapeDepartment(department);
  }

  async getDepartments(orgId: string, options: PaginationOptions & { isActive?: boolean }) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'name',
      sortOrder: options.sortOrder || 'asc',
    });

    const where: Prisma.DepartmentWhereInput = {
      organizationId: orgId,
      ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      ...(options.search
        ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [departments, totalRecords] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: this.includeRelations,
      }),
      this.prisma.department.count({ where }),
    ]);

    return formatPaginatedResponse(
      departments.map((department) => this.shapeDepartment(department)),
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getDepartment(orgId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, organizationId: orgId },
      include: this.includeRelations,
    });
    if (!department) throw new NotFoundException('Department not found');
    return this.shapeDepartment(department);
  }

  async updateDepartment(orgId: string, id: string, dto: UpdateDepartmentDto, actor?: DepartmentScopedUser) {
    const existing = await this.prisma.department.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException('Department not found');

    if (actor?.role === Role.SUB_ADMIN) {
      if (dto.isActive !== undefined) {
        throw new ForbiddenException('Sub Admins cannot change department status');
      }

      const scope = await getDepartmentScope(this.prisma, orgId, actor);
      assertDepartmentInScope(scope, id, 'Sub Admins can only edit departments in their assigned scope');
    }

    if (dto.name !== undefined || dto.code !== undefined) {
      await this.assertUnique(
        orgId,
        {
          name: dto.name ?? existing.name,
          code: dto.code ?? existing.code,
        },
        id,
      );
    }

    const color = dto.color !== undefined
      ? normalizeEntityColor(dto.color, `${orgId}:${dto.name ?? existing.name}`, '#3B82F6')
      : undefined;

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        code: dto.code !== undefined ? normalizeEntityCode(dto.code)! : undefined,
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        color,
        isActive: dto.isActive,
      },
      include: this.includeRelations,
    });

    return this.shapeDepartment(department);
  }

  async setActive(orgId: string, id: string, isActive: boolean) {
    await this.getDepartment(orgId, id);
    return this.updateDepartment(orgId, id, { isActive });
  }
}
