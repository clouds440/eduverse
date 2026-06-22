import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoomType } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { formatPaginatedResponse, getPaginationOptions, PaginationOptions } from '../common/utils';
import { FilesService } from '../files/files.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { normalizeEntityCode } from '../common/entity-code';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private normalizeRequiredText(value: string | undefined | null, field: string) {
    const trimmed = value?.trim();
    if (!trimmed) throw new BadRequestException(`${field} is required`);
    return trimmed;
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

  private async assertUnique(orgId: string, buildingId: string, name: string, code: string, excludeId?: string) {
    const duplicate = await this.prisma.room.findFirst({
      where: {
        organizationId: orgId,
        buildingId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { buildingId, name: { equals: name.trim(), mode: Prisma.QueryMode.insensitive } },
          { code: { equals: code, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { id: true, buildingId: true, name: true, code: true },
    });

    if (!duplicate) return;
    if (duplicate.buildingId === buildingId && duplicate.name.toLowerCase() === name.trim().toLowerCase()) {
      throw new ConflictException('Room name already exists inside this building');
    }
    throw new ConflictException('Room code already exists in this organization');
  }

  private validateCapacity(capacity?: number) {
    if (capacity !== undefined && capacity <= 0) {
      throw new BadRequestException('Room capacity must be positive');
    }
  }

  async createRoom(orgId: string, dto: CreateRoomDto) {
    this.validateCapacity(dto.capacity);
    await this.getBuildingForOrg(orgId, dto.buildingId);
    const code = normalizeEntityCode(dto.code)!;
    await this.assertUnique(orgId, dto.buildingId, dto.name, code);

    const room = await this.prisma.room.create({
      data: {
        organizationId: orgId,
        buildingId: dto.buildingId,
        name: dto.name.trim(),
        code,
        floor: this.normalizeRequiredText(dto.floor, 'Room floor'),
        type: dto.type,
        capacity: dto.capacity,
        description: this.normalizeText(dto.description),
        landmark: this.normalizeText(dto.landmark),
        directionsNote: this.normalizeText(dto.directionsNote),
        sortOrder: dto.sortOrder ?? 0,
        mapX: dto.mapX,
        mapY: dto.mapY,
        mapWidth: dto.mapWidth,
        mapHeight: dto.mapHeight,
        imageUrl: this.normalizeText(dto.imageUrl),
        imageUpdatedAt: dto.imageUrl ? new Date() : undefined,
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
            { code: { contains: options.search, mode: 'insensitive' } },
            { floor: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
            { landmark: { contains: options.search, mode: 'insensitive' } },
            { directionsNote: { contains: options.search, mode: 'insensitive' } },
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
    const nextCode = dto.code !== undefined ? normalizeEntityCode(dto.code)! : existing.code;
    if (dto.buildingId !== undefined) {
      await this.getBuildingForOrg(orgId, dto.buildingId);
    }
    if (dto.name !== undefined || dto.buildingId !== undefined || dto.code !== undefined) {
      await this.assertUnique(orgId, nextBuildingId, nextName, nextCode, id);
    }
    this.validateCapacity(dto.capacity);

    const room = await this.prisma.room.update({
      where: { id },
      data: {
        buildingId: dto.buildingId,
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        code: dto.code !== undefined ? nextCode : undefined,
        floor: dto.floor !== undefined ? this.normalizeRequiredText(dto.floor, 'Room floor') : undefined,
        type: dto.type,
        capacity: dto.capacity,
        description: dto.description !== undefined ? this.normalizeText(dto.description) : undefined,
        landmark: dto.landmark !== undefined ? this.normalizeText(dto.landmark) : undefined,
        directionsNote: dto.directionsNote !== undefined ? this.normalizeText(dto.directionsNote) : undefined,
        sortOrder: dto.sortOrder,
        mapX: dto.mapX,
        mapY: dto.mapY,
        mapWidth: dto.mapWidth,
        mapHeight: dto.mapHeight,
        imageUrl: dto.imageUrl !== undefined ? this.normalizeText(dto.imageUrl) : undefined,
        imageUpdatedAt: dto.imageUrl !== undefined ? new Date() : undefined,
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

  async updateImage(orgId: string, id: string, file: Express.Multer.File) {
    const room = await this.prisma.room.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, imageUrl: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    const imageUrl = await this.filesService.replaceFile(room.imageUrl, file);
    const updated = await this.prisma.room.update({
      where: { id },
      data: { imageUrl, imageUpdatedAt: new Date() },
      include: this.includeRelations,
    });

    return this.shapeRoom(updated);
  }
}

