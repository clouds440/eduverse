import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoomType } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEntityCode } from '../common/entity-code';

export interface CampusNavigationQuery {
  q?: string;
  roomId?: string;
  buildingCode?: string;
  departmentCode?: string;
  floor?: string;
  roomType?: RoomType;
}

const CAMPUS_NAVIGATION_ROOM_PREVIEW_LIMIT = 12;

export interface CampusNavigationDepartmentRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
}

export interface CampusNavigationSectionRecord {
  id: string;
  name: string;
  code: string;
  course: { id: string; name: string; code: string } | null;
}

export interface CampusNavigationScheduleRecord {
  id: string;
  day: number;
  startTime: string;
  endTime: string;
  section: CampusNavigationSectionRecord;
}

export interface CampusNavigationRoomRecord {
  id: string;
  name: string;
  code: string;
  floor: string;
  type: RoomType | null;
  capacity: number | null;
  description: string | null;
  landmark: string | null;
  directionsNote: string | null;
  imageUrl: string | null;
  imageUpdatedAt: Date | null;
  sortOrder: number;
  mapX: number | null;
  mapY: number | null;
  mapWidth: number | null;
  mapHeight: number | null;
  defaultSections: CampusNavigationSectionRecord[];
  schedules: CampusNavigationScheduleRecord[];
}

export interface CampusNavigationBuildingRecord {
  id: string;
  name: string;
  code: string;
  address: string | null;
  description: string | null;
  landmark: string | null;
  directionsNote: string | null;
  imageUrl: string | null;
  imageUpdatedAt: Date | null;
  sortOrder: number;
  mapX: number | null;
  mapY: number | null;
  mapWidth: number | null;
  mapHeight: number | null;
  buildingDepartments: Array<{ department: CampusNavigationDepartmentRecord }>;
  rooms: CampusNavigationRoomRecord[];
}

export interface CampusNavigationRoomSummary extends Omit<CampusNavigationRoomRecord, 'defaultSections' | 'schedules'> {
  sections: CampusNavigationSectionRecord[];
  schedules: CampusNavigationScheduleRecord[];
}

@Injectable()
export class CampusNavigationService {
  constructor(private readonly prisma: PrismaService) {}

  async getNavigation(orgId: string, query: CampusNavigationQuery) {
    const q = query.q?.trim();
    const buildingCode = normalizeEntityCode(query.buildingCode);
    const departmentCode = normalizeEntityCode(query.departmentCode);
    const floor = query.floor?.trim();

    const roomFilter: Prisma.RoomWhereInput = {
      isActive: true,
      ...(floor ? { floor: { equals: floor, mode: Prisma.QueryMode.insensitive } } : {}),
      ...(query.roomType ? { type: query.roomType } : {}),
    };
    const shouldPreviewRooms = !q && !query.roomId;

    const buildings = await this.prisma.building.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(query.roomId ? { rooms: { some: { id: query.roomId, organizationId: orgId, isActive: true } } } : {}),
        ...(buildingCode ? { code: { equals: buildingCode, mode: Prisma.QueryMode.insensitive } } : {}),
        ...(departmentCode
          ? { buildingDepartments: { some: { department: { code: { equals: departmentCode, mode: Prisma.QueryMode.insensitive } } } } }
          : {}),
        ...(q
          ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { address: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { landmark: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { directionsNote: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { buildingDepartments: { some: { department: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } } },
              { buildingDepartments: { some: { department: { code: { contains: q, mode: Prisma.QueryMode.insensitive } } } } },
              {
                rooms: {
                  some: {
                    isActive: true,
                    OR: this.roomSearchConditions(q),
                  },
                },
              },
            ],
          }
          : {}),
      },
      include: {
        buildingDepartments: {
          include: {
            department: {
              select: { id: true, name: true, code: true, description: true, color: true, isActive: true },
            },
          },
        },
        rooms: {
          where: {
            ...roomFilter,
            ...(query.roomId ? { id: query.roomId } : {}),
          },
          include: {
            defaultSections: {
              select: {
                id: true,
                name: true,
                code: true,
                course: { select: { id: true, name: true, code: true } },
              },
              orderBy: [{ name: 'asc' }],
              take: 5,
            },
            schedules: {
              select: {
                id: true,
                day: true,
                startTime: true,
                endTime: true,
                section: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    course: { select: { id: true, name: true, code: true } },
                  },
                },
              },
              orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
              take: 5,
            },
          },
          orderBy: [{ floor: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
          ...(shouldPreviewRooms ? { take: CAMPUS_NAVIGATION_ROOM_PREVIEW_LIMIT } : {}),
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const roomStats = await this.getBuildingRoomStats(orgId, buildings.map((building) => building.id), roomFilter);
    const shapedBuildings = buildings
      .map((building) => this.shapeBuilding(building, q, roomStats.get(building.id)))
      .filter((building) => building.rooms.length > 0 || this.matchesBuilding(building, q));

    const departments = this.uniqueDepartments(shapedBuildings);
    const floors = Array.from(new Set(shapedBuildings.flatMap((building) => building.floors.map((item) => item.floor)))).sort();

    return {
      filters: {
        q: q || '',
        roomId: query.roomId || '',
        buildingCode: buildingCode || '',
        departmentCode: departmentCode || '',
        floor: floor || '',
        roomType: query.roomType || '',
      },
      counts: {
        buildings: shapedBuildings.length,
        floors: floors.length,
        rooms: shapedBuildings.reduce((total, building) => total + building.roomsTotal, 0),
        departments: departments.length,
      },
      lookups: {
        departments,
        floors,
        roomTypes: Object.values(RoomType),
      },
      buildings: shapedBuildings,
    };
  }

  async getBuildingRooms(orgId: string, buildingId: string, query: Pick<CampusNavigationQuery, 'q' | 'floor' | 'roomType'>) {
    const q = query.q?.trim();
    const floor = query.floor?.trim();
    const roomFilter: Prisma.RoomWhereInput = {
      organizationId: orgId,
      buildingId,
      isActive: true,
      ...(floor ? { floor: { equals: floor, mode: Prisma.QueryMode.insensitive } } : {}),
      ...(query.roomType ? { type: query.roomType } : {}),
      ...(q ? { OR: this.roomSearchConditions(q) } : {}),
    };

    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!building) throw new NotFoundException('Building not found');

    const rooms = await this.prisma.room.findMany({
      where: roomFilter,
      include: this.roomInclude(),
      orderBy: [{ floor: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    const shapedRooms = rooms.map((room) => this.shapeRoom(room as CampusNavigationRoomRecord));
    const floors = this.groupRoomsByFloor(shapedRooms);

    return {
      buildingId,
      rooms: shapedRooms,
      floors,
      roomsTotal: shapedRooms.length,
      floorsTotal: floors.length,
    };
  }

  async getRoomSelection(orgId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, organizationId: orgId, isActive: true },
      include: {
        ...this.roomInclude(),
        building: {
          include: {
            buildingDepartments: {
              include: {
                department: {
                  select: { id: true, name: true, code: true, description: true, color: true, isActive: true },
                },
              },
            },
          },
        },
      },
    });

    if (!room || !room.building) throw new NotFoundException('Room not found');

    const departments = room.building.buildingDepartments
      .map((link) => link.department)
      .filter((department) => department.isActive);
    const building = {
      id: room.building.id,
      name: room.building.name,
      code: room.building.code,
      address: room.building.address,
      description: room.building.description,
      landmark: room.building.landmark,
      directionsNote: room.building.directionsNote,
      imageUrl: room.building.imageUrl,
      imageUpdatedAt: room.building.imageUpdatedAt,
      sortOrder: room.building.sortOrder,
      mapX: room.building.mapX,
      mapY: room.building.mapY,
      mapWidth: room.building.mapWidth,
      mapHeight: room.building.mapHeight,
      departments,
      rooms: [],
      floors: [],
      roomsTotal: 0,
      floorsTotal: 0,
      matchesQuery: false,
    };

    return { room: this.shapeRoom(room as CampusNavigationRoomRecord), building };
  }

  private roomSearchConditions(q: string): Prisma.RoomWhereInput[] {
    return [
      { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { code: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { floor: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { landmark: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { directionsNote: { contains: q, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  private roomInclude() {
    return {
      defaultSections: {
        select: {
          id: true,
          name: true,
          code: true,
          course: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ name: 'asc' as const }],
        take: 5,
      },
      schedules: {
        select: {
          id: true,
          day: true,
          startTime: true,
          endTime: true,
          section: {
            select: {
              id: true,
              name: true,
              code: true,
              course: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: [{ day: 'asc' as const }, { startTime: 'asc' as const }],
        take: 5,
      },
    };
  }

  private async getBuildingRoomStats(orgId: string, buildingIds: string[], roomFilter: Prisma.RoomWhereInput) {
    if (buildingIds.length === 0) return new Map<string, { roomsTotal: number; floorsTotal: number }>();

    const floorGroups = await this.prisma.room.groupBy({
      by: ['buildingId', 'floor'],
      where: {
        ...roomFilter,
        organizationId: orgId,
        buildingId: { in: buildingIds },
      },
      _count: { _all: true },
    });
    const stats = new Map<string, { roomsTotal: number; floors: Set<string> }>();

    floorGroups.forEach((group) => {
      const current = stats.get(group.buildingId) || { roomsTotal: 0, floors: new Set<string>() };
      current.roomsTotal += group._count._all;
      current.floors.add(group.floor);
      stats.set(group.buildingId, current);
    });

    return new Map(Array.from(stats.entries()).map(([buildingId, value]) => [
      buildingId,
      { roomsTotal: value.roomsTotal, floorsTotal: value.floors.size },
    ]));
  }

  private shapeRoom(room: CampusNavigationRoomRecord): CampusNavigationRoomSummary {
    return {
      id: room.id,
      name: room.name,
      code: room.code,
      floor: room.floor,
      type: room.type,
      capacity: room.capacity,
      description: room.description,
      landmark: room.landmark,
      directionsNote: room.directionsNote,
      imageUrl: room.imageUrl,
      imageUpdatedAt: room.imageUpdatedAt,
      sortOrder: room.sortOrder,
      mapX: room.mapX,
      mapY: room.mapY,
      mapWidth: room.mapWidth,
      mapHeight: room.mapHeight,
      sections: this.uniqueSections([
        ...room.defaultSections,
        ...room.schedules.map((schedule) => schedule.section),
      ]),
      schedules: room.schedules.map((schedule) => ({
        id: schedule.id,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        section: schedule.section,
      })),
    };
  }

  private groupRoomsByFloor(rooms: CampusNavigationRoomSummary[]) {
    return Array.from(new Set(rooms.map((room) => room.floor))).sort().map((roomFloor) => ({
      floor: roomFloor,
      rooms: rooms.filter((room) => room.floor === roomFloor),
    }));
  }

  private shapeBuilding(building: CampusNavigationBuildingRecord, q?: string, roomStats?: { roomsTotal: number; floorsTotal: number }) {
    const departments = building.buildingDepartments
      .map((link) => link.department)
      .filter((department) => department.isActive);
    const buildingMatches = this.matchesText(q, [
      building.name,
      building.code,
      building.address,
      building.description,
      building.landmark,
      building.directionsNote,
      ...departments.flatMap((department) => [department.name, department.code]),
    ]);
    const rooms = building.rooms
      .filter((room) => buildingMatches || this.matchesRoom(room, q))
      .map((room) => this.shapeRoom(room));

    const floors = this.groupRoomsByFloor(rooms);

    return {
      id: building.id,
      name: building.name,
      code: building.code,
      address: building.address,
      description: building.description,
      landmark: building.landmark,
      directionsNote: building.directionsNote,
      imageUrl: building.imageUrl,
      imageUpdatedAt: building.imageUpdatedAt,
      sortOrder: building.sortOrder,
      mapX: building.mapX,
      mapY: building.mapY,
      mapWidth: building.mapWidth,
      mapHeight: building.mapHeight,
      departments,
      rooms,
      floors,
      roomsTotal: roomStats?.roomsTotal ?? rooms.length,
      floorsTotal: roomStats?.floorsTotal ?? floors.length,
      roomsPreviewLimit: CAMPUS_NAVIGATION_ROOM_PREVIEW_LIMIT,
      matchesQuery: buildingMatches,
    };
  }

  private matchesBuilding(building: { matchesQuery?: boolean }, q?: string) {
    if (!q) return true;
    return building.matchesQuery;
  }

  private matchesRoom(room: Pick<CampusNavigationRoomRecord, 'name' | 'code' | 'floor' | 'type' | 'description' | 'landmark' | 'directionsNote'>, q?: string) {
    return this.matchesText(q, [
      room.name,
      room.code,
      room.floor,
      room.type,
      room.description,
      room.landmark,
      room.directionsNote,
    ]);
  }

  private matchesText(q: string | undefined, values: Array<string | null | undefined>) {
    if (!q) return true;
    const needle = q.toLowerCase();
    return values.some((value) => value?.toLowerCase().includes(needle));
  }

  private uniqueDepartments(buildings: Array<{ departments: CampusNavigationDepartmentRecord[] }>) {
    const seen = new Set<string>();
    return buildings.flatMap((building) => building.departments).filter((department) => {
      if (seen.has(department.id)) return false;
      seen.add(department.id);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  private uniqueSections<T extends { id: string }>(sections: Array<T | null | undefined>) {
    const seen = new Set<string>();
    return sections.filter((section): section is T => {
      if (!section) return false;
      if (seen.has(section.id)) return false;
      seen.add(section.id);
      return true;
    });
  }
}
