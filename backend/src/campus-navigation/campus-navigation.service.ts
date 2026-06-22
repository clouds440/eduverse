import { Injectable } from '@nestjs/common';
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
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const shapedBuildings = buildings
      .map((building) => this.shapeBuilding(building, q))
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
        rooms: shapedBuildings.reduce((total, building) => total + building.rooms.length, 0),
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

  private shapeBuilding(building: any, q?: string) {
    const departments = building.buildingDepartments
      .map((link: any) => link.department)
      .filter((department: any) => department.isActive);
    const buildingMatches = this.matchesText(q, [
      building.name,
      building.code,
      building.address,
      building.description,
      building.landmark,
      building.directionsNote,
      ...departments.flatMap((department: any) => [department.name, department.code]),
    ]);
    const rooms = building.rooms
      .filter((room: any) => buildingMatches || this.matchesRoom(room, q))
      .map((room: any) => ({
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
          ...room.schedules.map((schedule: any) => schedule.section),
        ]),
        schedules: room.schedules.map((schedule: any) => ({
          id: schedule.id,
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          section: schedule.section,
        })),
      }));

    const floors = Array.from(new Set(rooms.map((room: any) => room.floor))).sort().map((roomFloor) => ({
      floor: roomFloor,
      rooms: rooms.filter((room: any) => room.floor === roomFloor),
    }));

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
      matchesQuery: buildingMatches,
    };
  }

  private matchesBuilding(building: any, q?: string) {
    if (!q) return true;
    return building.matchesQuery;
  }

  private matchesRoom(room: any, q?: string) {
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

  private uniqueDepartments(buildings: Array<{ departments: Array<{ id: string }> }>) {
    const seen = new Set<string>();
    return buildings.flatMap((building: any) => building.departments).filter((department: any) => {
      if (seen.has(department.id)) return false;
      seen.add(department.id);
      return true;
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  private uniqueSections(sections: Array<any>) {
    const seen = new Set<string>();
    return sections.filter((section) => {
      if (!section || seen.has(section.id)) return false;
      seen.add(section.id);
      return true;
    });
  }
}
