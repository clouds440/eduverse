import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoomType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions, PaginationOptions } from '../common/utils';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private includeRelations = {
    building: {
      include: {
        buildingDepartments: {
          include: {
            department: {
              select: { id: true, name: true, code: true, color: true, isActive: true },
            },
          },
        },
      },
    },
  } satisfies Prisma.RoomInclude;

  private shapeRoom<T extends { building?: { buildingDepartments?: { department: unknown }[] } | null }>(room: T) {
    if (!room.building) return room;
    const { buildingDepartments, ...building } = room.building;
    return {
      ...room,
      building: {
        ...building,
        departments: buildingDepartments?.map((link) => link.department) || [],
      },
    };
  }

  private async getBuildingForOrg(orgId: string, buildingId: string) {
    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, organizationId: orgId },
      select: { id: true },
    });
    if (!building) throw new NotFoundException('Building not found in this organization');
    return building;
  }

  private async assertUnique(orgId: string, buildingId: string, name: string, excludeId?: string) {
    const duplicate = await this.prisma.room.findFirst({
      where: {
        organizationId: orgId,
        buildingId,
        id: excludeId ? { not: excludeId } : undefined,
        name: { equals: name.trim(), mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Room name already exists inside this building');
    }
  }

  private validateCapacity(capacity?: number) {
    if (capacity !== undefined && capacity <= 0) {
      throw new BadRequestException('Room capacity must be positive');
    }
  }

  async createRoom(orgId: string, dto: CreateRoomDto) {
    this.validateCapacity(dto.capacity);
    await this.getBuildingForOrg(orgId, dto.buildingId);
    await this.assertUnique(orgId, dto.buildingId, dto.name);

    const room = await this.prisma.room.create({
      data: {
        organizationId: orgId,
        buildingId: dto.buildingId,
        name: dto.name.trim(),
        floor: this.normalizeText(dto.floor),
        type: dto.type,
        capacity: dto.capacity,
        description: this.normalizeText(dto.description),
        isActive: dto.isActive ?? true,
      },
      include: this.includeRelations,
    });

    return this.shapeRoom(room);
  }

  async getRooms(
    orgId: string,
    options: PaginationOptions & {
      isActive?: boolean;
      buildingId?: string;
      departmentId?: string;
      type?: RoomType;
    },
  ) {
    const { skip, take, sortBy, sortOrder } = getPaginationOptions({
      ...options,
      sortBy: options.sortBy || 'name',
      sortOrder: options.sortOrder || 'asc',
    });

    const where: Prisma.RoomWhereInput = {
      organizationId: orgId,
      ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      ...(options.buildingId ? { buildingId: options.buildingId } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.departmentId
        ? { building: { buildingDepartments: { some: { departmentId: options.departmentId } } } }
        : {}),
      ...(options.search
        ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { floor: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
            { building: { name: { contains: options.search, mode: 'insensitive' } } },
            { building: { code: { contains: options.search, mode: 'insensitive' } } },
          ],
        }
        : {}),
    };

    const [rooms, totalRecords] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take,
        orderBy: sortBy === 'building'
          ? { building: { name: sortOrder } }
          : { [sortBy]: sortOrder },
        include: this.includeRelations,
      }),
      this.prisma.room.count({ where }),
    ]);

    return formatPaginatedResponse(
      rooms.map((room) => this.shapeRoom(room)),
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getRoom(orgId: string, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, organizationId: orgId },
      include: this.includeRelations,
    });
    if (!room) throw new NotFoundException('Room not found');
    return this.shapeRoom(room);
  }

  async updateRoom(orgId: string, id: string, dto: UpdateRoomDto) {
    const existing = await this.prisma.room.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException('Room not found');

    const nextBuildingId = dto.buildingId ?? existing.buildingId;
    const nextName = dto.name ?? existing.name;
    if (dto.buildingId !== undefined) {
      await this.getBuildingForOrg(orgId, dto.buildingId);
    }
    if (dto.name !== undefined || dto.buildingId !== undefined) {
      await this.assertUnique(orgId, nextBuildingId, nextName, id);
    }
    this.validateCapacity(dto.capacity);

    const room = await this.prisma.room.update({
      where: { id },
      data: {
        buildingId: dto.buildingId,
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        floor: dto.floor !== undefined ? this.normalizeText(dto.floor) : undefined,
        type: dto.type,
        capacity: dto.capacity,
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        isActive: dto.isActive,
      },
      include: this.includeRelations,
    });

    return this.shapeRoom(room);
  }

  async setActive(orgId: string, id: string, isActive: boolean) {
    await this.getRoom(orgId, id);
    return this.updateRoom(orgId, id, { isActive });
  }
}
