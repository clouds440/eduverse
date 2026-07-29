import { AcademicEventMatchMode, AcademicEventType, DepartmentScopeType } from '@/prisma/prisma-client';

export interface AcademicEventLike {
  id: string;
  title: string;
  description?: string | null;
  type: AcademicEventType;
  matchMode: AcademicEventMatchMode;
  departmentScopeType: DepartmentScopeType;
  startDate: Date;
  endDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek: number[];
  bannerUrl?: string | null;
  bannerFileId?: string | null;
  bannerFilename?: string | null;
  bannerMimeType?: string | null;
  bannerUpdatedAt?: Date | null;
  isFullDay: boolean;
  isActive: boolean;
  createdBy?: { id: string; name?: string | null; email?: string | null } | null;
  departmentLinks?: { departmentId: string }[];
}

export interface TimetableSlotLike {
  scheduleId: string;
  day: number;
  startTime: string;
  endTime: string;
  departmentId?: string | null;
  roomId?: string | null;
}

export interface AcademicEventOverlay {
  id: string;
  academicEventId: string;
  title: string;
  description: string | null;
  type: AcademicEventType;
  date: string;
  day: number;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  bannerUrl: string | null;
  bannerFileId: string | null;
  bannerFilename: string | null;
  bannerMimeType: string | null;
  bannerUpdatedAt: Date | null;
  createdBy: string | null;
  departmentScopeType: DepartmentScopeType;
  departmentIds: string[];
  coveredScheduleIds: string[];
}

export function toDateOnlyUtc(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function dateKey(value: Date | string) {
  return toDateOnlyUtc(value).toISOString().slice(0, 10);
}

export function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getCurrentWeekRange(reference = new Date()) {
  const start = toDateOnlyUtc(reference);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return { start, end: addUtcDays(start, 6) };
}

export function timeToMinutes(time: string) {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function timeRangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

export function academicEventAppliesToDepartment(event: AcademicEventLike, departmentId?: string | null) {
  if (event.departmentScopeType !== DepartmentScopeType.SELECTED) return true;
  if (!departmentId) return false;
  return (event.departmentLinks || []).some((link) => link.departmentId === departmentId);
}

export function academicEventMatchesDate(event: AcademicEventLike, date: Date) {
  if (!event.isActive) return false;

  const current = toDateOnlyUtc(date);
  const start = toDateOnlyUtc(event.startDate);
  const end = toDateOnlyUtc(event.endDate);
  if (current < start || current > end) return false;

  const day = current.getUTCDay();
  if (event.matchMode === AcademicEventMatchMode.SINGLE_DAY) {
    return dateKey(current) === dateKey(start);
  }
  if (event.matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE) {
    return event.daysOfWeek.includes(day);
  }
  return true;
}

export function academicEventOverlapsSlot(event: AcademicEventLike, date: Date, slot: TimetableSlotLike) {
  if (!academicEventMatchesDate(event, date)) return false;
  if (!academicEventAppliesToDepartment(event, slot.departmentId)) return false;
  if (event.isFullDay) return true;
  if (!event.startTime || !event.endTime) return false;
  return timeRangesOverlap(event.startTime, event.endTime, slot.startTime, slot.endTime);
}

export function buildAcademicEventOverlays(
  events: AcademicEventLike[],
  slots: TimetableSlotLike[],
  startDate: Date,
  endDate: Date,
) {
  const overlays: AcademicEventOverlay[] = [];
  const start = toDateOnlyUtc(startDate);
  const end = toDateOnlyUtc(endDate);

  for (let current = start; current <= end; current = addUtcDays(current, 1)) {
    const day = current.getUTCDay();
    const daySlots = slots.filter((slot) => slot.day === day);

    for (const event of events) {
      if (!academicEventMatchesDate(event, current)) continue;

      const coveredScheduleIds = daySlots
        .filter((slot) => academicEventOverlapsSlot(event, current, slot))
        .map((slot) => slot.scheduleId);

      if (!event.isFullDay && coveredScheduleIds.length === 0) continue;

      overlays.push({
        id: `${event.id}:${dateKey(current)}:${event.isFullDay ? 'full' : `${event.startTime}-${event.endTime}`}`,
        academicEventId: event.id,
        title: event.title,
        description: event.description || null,
        type: event.type,
        date: dateKey(current),
        day,
        isFullDay: event.isFullDay,
        startTime: event.isFullDay ? null : event.startTime || null,
        endTime: event.isFullDay ? null : event.endTime || null,
        bannerUrl: event.bannerUrl || null,
        bannerFileId: event.bannerFileId || null,
        bannerFilename: event.bannerFilename || null,
        bannerMimeType: event.bannerMimeType || null,
        bannerUpdatedAt: event.bannerUpdatedAt || null,
        createdBy: event.createdBy?.name || event.createdBy?.email || null,
        departmentScopeType: event.departmentScopeType,
        departmentIds: event.departmentLinks?.map((link) => link.departmentId) || [],
        coveredScheduleIds,
      });
    }
  }

  return overlays;
}
