import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions, PaginationOptions } from '../common/utils';
import { FilesService } from '../files/files.service';
import { AssignBuildingDepartmentsDto } from './dto/assign-building-departments.dto';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private includeRelations = {
    buildingDepartments: {
      include: {
        department: {
          select: { id: true, name: true, code: true, color: true, isActive: true },
        },
      },
    },
    _count: { select: { rooms: true } },
  } satisfies Prisma.BuildingInclude;

  private shapeBuilding<T extends { buildingDepartments?: { department: unknown }[] }>(building: T) {
    const { buildingDepartments, ...rest } = building;
    return {
      ...rest,
      departments: buildingDepartments?.map((link) => link.department) || [],
    };
  }

  private uniqueDepartmentIds(departmentIds?: string[]) {
    return [...new Set((departmentIds || []).filter(Boolean))];
  }

  private async assertUnique(orgId: string, dto: Pick<CreateBuildingDto, 'name' | 'code'>, excludeId?: string) {
    const name = dto.name?.trim();
    const code = this.normalizeText(dto.code);
    const duplicate = await this.prisma.building.findFirst({
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
      throw new ConflictException('Building name already exists in this organization');
    }
    throw new ConflictException('Building code already exists in this organization');
  }

  private async validateDepartments(orgId: string, departmentIds: string[]) {
    if (departmentIds.length === 0) return;

    const count = await this.prisma.department.count({
      where: { id: { in: departmentIds }, organizationId: orgId },
    });

    if (count !== departmentIds.length) {
      throw new BadRequestException('Some departments do not belong to this organization');
    }
  }

  async createBuilding(orgId: string, dto: CreateBuildingDto) {
    await this.assertUnique(orgId, dto);
    const departmentIds = this.uniqueDepartmentIds(dto.departmentIds);
    await this.validateDepartments(orgId, departmentIds);

    const building = await this.prisma.building.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        code: this.normalizeText(dto.code),
        address: this.normalizeText(dto.address),
        description: this.normalizeText(dto.description),
        imageUrl: this.normalizeText(dto.imageUrl),
        imageUpdatedAt: dto.imageUrl ? new Date() : undefined,
        isActive: dto.isActive ?? true,
        buildingDepartments: {
          create: departmentIds.map((departmentId) => ({
            organizationId: orgId,
            departmentId,
          })),
        },
      },
      include: this.includeRelations,
    });

    return this.shapeBuilding(building);
  }

  async getBuildings(
    orgId: string,
    options: PaginationOptions & { isActive?: boolean; departmentId?: string },
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'name',
      sortOrder: options.sortOrder || 'asc',
    });

    const where: Prisma.BuildingWhereInput = {
      organizationId: orgId,
      ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      ...(options.departmentId
        ? { buildingDepartments: { some: { departmentId: options.departmentId } } }
        : {}),
      ...(options.search
        ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
            { address: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [buildings, totalRecords] = await Promise.all([
      this.prisma.building.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: this.includeRelations,
      }),
      this.prisma.building.count({ where }),
    ]);

    return formatPaginatedResponse(
      buildings.map((building) => this.shapeBuilding(building)),
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getBuilding(orgId: string, id: string) {
    const building = await this.prisma.building.findFirst({
      where: { id, organizationId: orgId },
      include: {
        ...this.includeRelations,
        rooms: {
          select: { id: true, name: true, floor: true, type: true, capacity: true, isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!building) throw new NotFoundException('Building not found');
    return this.shapeBuilding(building);
  }

  async updateBuilding(orgId: string, id: string, dto: UpdateBuildingDto) {
    const existing = await this.prisma.building.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException('Building not found');

    if (dto.name !== undefined || dto.code !== undefined) {
      await this.assertUnique(
        orgId,
        {
          name: dto.name ?? existing.name,
          code: dto.code ?? existing.code ?? undefined,
        },
        id,
      );
    }

    const departmentIds = dto.departmentIds !== undefined
      ? this.uniqueDepartmentIds(dto.departmentIds)
      : undefined;
    if (departmentIds) await this.validateDepartments(orgId, departmentIds);

    const building = await this.prisma.$transaction(async (tx) => {
      await tx.building.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          code: dto.code !== undefined ? this.normalizeText(dto.code) : undefined,
          address: dto.address !== undefined ? this.normalizeText(dto.address) : undefined,
          description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
          imageUrl: dto.imageUrl !== undefined ? this.normalizeText(dto.imageUrl) : undefined,
          imageUpdatedAt: dto.imageUrl !== undefined ? new Date() : undefined,
          isActive: dto.isActive,
        },
      });

      if (departmentIds !== undefined) {
        await tx.buildingDepartment.deleteMany({ where: { buildingId: id } });
        if (departmentIds.length > 0) {
          await tx.buildingDepartment.createMany({
            data: departmentIds.map((departmentId) => ({
              organizationId: orgId,
              buildingId: id,
              departmentId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.building.findUnique({
        where: { id },
        include: this.includeRelations,
      });
    });

    return this.shapeBuilding(building!);
  }

  async setActive(orgId: string, id: string, isActive: boolean) {
    await this.getBuilding(orgId, id);
    return this.updateBuilding(orgId, id, { isActive });
  }

  async updateImage(orgId: string, id: string, file: Express.Multer.File) {
    const building = await this.prisma.building.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, imageUrl: true },
    });
    if (!building) throw new NotFoundException('Building not found');

    const imageUrl = await this.filesService.replaceFile(building.imageUrl, file);
    return this.prisma.building.update({
      where: { id },
      data: { imageUrl, imageUpdatedAt: new Date() },
      include: this.includeRelations,
    }).then((updated) => this.shapeBuilding(updated));
  }

  async assignDepartments(orgId: string, buildingId: string, dto: AssignBuildingDepartmentsDto) {
    await this.getBuilding(orgId, buildingId);
    const departmentIds = this.uniqueDepartmentIds(dto.departmentIds);
    await this.validateDepartments(orgId, departmentIds);

    if (departmentIds.length === 0) {
      throw new BadRequestException('At least one departmentId is required');
    }

    await this.prisma.buildingDepartment.createMany({
      data: departmentIds.map((departmentId) => ({
        organizationId: orgId,
        buildingId,
        departmentId,
      })),
      skipDuplicates: true,
    });

    return this.getBuilding(orgId, buildingId);
  }

  async removeDepartment(orgId: string, buildingId: string, departmentId: string) {
    await this.getBuilding(orgId, buildingId);
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found');

    await this.prisma.buildingDepartment.deleteMany({
      where: { organizationId: orgId, buildingId, departmentId },
    });

    return this.getBuilding(orgId, buildingId);
  }
}
