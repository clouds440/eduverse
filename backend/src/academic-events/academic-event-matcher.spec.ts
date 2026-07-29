import { AcademicEventMatchMode, AcademicEventType, DepartmentScopeType } from '@/prisma/prisma-client';
import { academicEventAppliesToDepartment, buildAcademicEventOverlays } from './academic-event-matcher';

const baseEvent = {
  id: 'event-1',
  title: 'Science Fair',
  description: 'Department showcase',
  type: AcademicEventType.EVENT,
  matchMode: AcademicEventMatchMode.SINGLE_DAY,
  departmentScopeType: DepartmentScopeType.SELECTED,
  startDate: new Date(Date.UTC(2026, 6, 29)),
  endDate: new Date(Date.UTC(2026, 6, 29)),
  startTime: null,
  endTime: null,
  daysOfWeek: [],
  bannerUrl: '/files/banner/download',
  bannerFileId: 'banner-1',
  bannerFilename: 'science-fair.jpg',
  bannerMimeType: 'image/jpeg',
  bannerUpdatedAt: new Date(Date.UTC(2026, 6, 29, 8)),
  isFullDay: true,
  isActive: true,
  departmentLinks: [{ departmentId: 'science' }],
};

describe('academic event matcher', () => {
  it('matches selected departments only within the event scope', () => {
    expect(academicEventAppliesToDepartment(baseEvent, 'science')).toBe(true);
    expect(academicEventAppliesToDepartment(baseEvent, 'arts')).toBe(false);
  });

  it('builds overlays with academic event ids and banner metadata', () => {
    const overlays = buildAcademicEventOverlays(
      [baseEvent],
      [{
        scheduleId: 'schedule-1',
        day: 3,
        startTime: '09:00',
        endTime: '10:00',
        departmentId: 'science',
      }],
      new Date(Date.UTC(2026, 6, 29)),
      new Date(Date.UTC(2026, 6, 29)),
    );

    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({
      academicEventId: 'event-1',
      bannerUrl: '/files/banner/download',
      bannerFileId: 'banner-1',
      coveredScheduleIds: ['schedule-1'],
    });
    expect(overlays[0]).not.toHaveProperty('holidayId');
  });
});
