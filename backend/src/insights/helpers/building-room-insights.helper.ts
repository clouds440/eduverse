import { InsightTone } from '../../common/enums';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DashboardInsightGroup, DashboardInsightItem } from '../shared/insights.types';
import { formatSectionLabel } from '../shared/insights-format.util';

export interface RoomUsagePoint {
  room: string;
  building: string;
  scheduledSlots: number;
  capacity?: number | null;
}

export interface BuildingUsagePoint {
  building: string;
  rooms: number;
  scheduledSlots: number;
}

function formatName(entity: { name: string; code?: string | null }) {
  return entity.code ? `${entity.code} - ${entity.name}` : entity.name;
}

export async function getBuildingRoomInsights(
  prisma: PrismaService,
  orgId: string,
): Promise<{
  group: DashboardInsightGroup | null;
  roomUsage: RoomUsagePoint[];
  buildingUsage: BuildingUsagePoint[];
}> {
  const rooms = await prisma.room.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true,
      name: true,
      capacity: true,
      building: { select: { id: true, name: true, code: true } },
      schedules: {
        select: {
          id: true,
          section: {
            select: {
              id: true,
              name: true,
              course: { select: { name: true } },
              _count: { select: { enrollments: true } },
            },
          },
        },
      },
    },
    orderBy: [{ building: { name: 'asc' } }, { name: 'asc' }],
  });

  const buildingRooms = new Map<string, { building: string; rooms: number; scheduledSlots: number }>();
  const capacityWarnings = new Map<string, {
    id: string;
    room: string;
    section: string;
    enrolled: number;
    capacity: number;
  }>();

  const roomUsage = rooms.map((room) => {
    const building = formatName(room.building);
    const buildingStats = buildingRooms.get(room.building.id) || {
      building,
      rooms: 0,
      scheduledSlots: 0,
    };
    buildingStats.rooms += 1;
    buildingStats.scheduledSlots += room.schedules.length;
    buildingRooms.set(room.building.id, buildingStats);

    if (room.capacity !== null && room.capacity !== undefined) {
      room.schedules.forEach((schedule) => {
        const enrolled = schedule.section._count.enrollments;
        if (enrolled > room.capacity!) {
          capacityWarnings.set(`${room.id}:${schedule.section.id}`, {
            id: `${room.id}:${schedule.section.id}`,
            room: room.name,
            section: formatSectionLabel(schedule.section.name, schedule.section.course.name),
            enrolled,
            capacity: room.capacity!,
          });
        }
      });
    }

    return {
      room: room.name,
      building,
      scheduledSlots: room.schedules.length,
      capacity: room.capacity,
    };
  });

  const buildingUsage = Array.from(buildingRooms.values())
    .sort((a, b) => b.scheduledSlots - a.scheduledSlots)
    .slice(0, 8);
  const rankedRooms = [...roomUsage].sort((a, b) => b.scheduledSlots - a.scheduledSlots);
  const warnings = Array.from(capacityWarnings.values())
    .sort((a, b) => (b.enrolled - b.capacity) - (a.enrolled - a.capacity));
  const totalScheduledSlots = roomUsage.reduce((sum, room) => sum + room.scheduledSlots, 0);

  if (rooms.length === 0) {
    return {
      roomUsage: [],
      buildingUsage,
      group: {
        id: 'campus-usage',
        title: 'Campus usage',
        description: 'Buildings, rooms, and scheduled room utilization.',
        items: [{
          id: 'rooms-empty',
          title: 'No rooms created yet',
          description: 'Add buildings and rooms to begin tracking room usage.',
          href: '/buildings-and-rooms',
          badge: 'Setup',
          tone: InsightTone.INFO,
        }],
      },
    };
  }

  const items: DashboardInsightItem[] = [];

  if (totalScheduledSlots === 0) {
    items.push({
      id: 'rooms-unscheduled',
      title: 'No rooms scheduled yet',
      description: 'Schedules exist independently until a structured room is selected.',
      meta: `${rooms.length} rooms available`,
      href: '/schedules',
      badge: 'Scheduling',
      tone: InsightTone.WARNING,
    });
  }

  warnings.slice(0, 2).forEach((warning) => {
    items.push({
      id: `capacity:${warning.id}`,
      title: `${warning.room} may be over capacity`,
      description: warning.section,
      meta: `${warning.enrolled}/${warning.capacity} students`,
      href: '/schedules',
      badge: 'Capacity',
      tone: InsightTone.DANGER,
    });
  });

  return {
    roomUsage: rankedRooms.slice(0, 8),
    buildingUsage,
    group: items.length > 0 ? {
      id: 'campus-usage',
      title: 'Campus usage',
      description: 'Only room scheduling issues that need follow-up.',
      items: items.slice(0, 4),
    } : null,
  };
}
