import { InsightTone } from '../../common/enums';
import { getBuildingRoomInsights } from './building-room-insights.helper';

describe('building room insights helper', () => {
  it('counts schedules that use a section default room as room and building usage', async () => {
    const prisma = {
      room: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'room-1',
            name: 'Room 101',
            capacity: 20,
            building: { id: 'building-1', name: 'Main Campus', code: 'MAIN' },
            schedules: [
              {
                id: 'schedule-explicit',
                section: {
                  id: 'section-explicit',
                  name: 'Section A',
                  course: { name: 'Physics' },
                  _count: { enrollments: 18 },
                },
              },
            ],
            defaultSections: [
              {
                schedules: [
                  {
                    id: 'schedule-default-room',
                    section: {
                      id: 'section-default',
                      name: 'Section B',
                      course: { name: 'Chemistry' },
                      _count: { enrollments: 24 },
                    },
                  },
                ],
              },
            ],
          },
        ]),
      },
    };

    const result = await getBuildingRoomInsights(prisma as any, 'org-1');

    expect(prisma.room.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1', isActive: true },
    }));
    expect(result.roomUsage).toEqual([
      {
        room: 'Room 101',
        building: 'MAIN - Main Campus',
        scheduledSlots: 2,
        capacity: 20,
      },
    ]);
    expect(result.buildingUsage).toEqual([
      {
        building: 'Main Campus',
        rooms: 1,
        scheduledSlots: 2,
      },
    ]);
    expect(result.group?.items).toEqual([
      expect.objectContaining({
        id: 'capacity:room-1:section-default',
        title: 'Room 101 may be over capacity',
        meta: '24/20 students',
        tone: InsightTone.DANGER,
      }),
    ]);
  });

  it('shows the unscheduled setup item only when effective room slots are zero', async () => {
    const prisma = {
      room: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'room-1',
            name: 'Room 101',
            capacity: null,
            building: { id: 'building-1', name: 'Main Campus', code: 'MAIN' },
            schedules: [],
            defaultSections: [{ schedules: [] }],
          },
        ]),
      },
    };

    const result = await getBuildingRoomInsights(prisma as any, 'org-1');

    expect(result.roomUsage).toEqual([
      expect.objectContaining({ room: 'Room 101', scheduledSlots: 0 }),
    ]);
    expect(result.group?.items).toEqual([
      expect.objectContaining({
        id: 'rooms-unscheduled',
        tone: InsightTone.WARNING,
      }),
    ]);
  });
});
