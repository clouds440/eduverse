import { HolidayMatchMode, HolidayType, DepartmentScopeType } from '@prisma/client';

export interface HolidayLike {
  id: string;
  title: string;
  description?: string | null;
  type: HolidayType;
  matchMode: HolidayMatchMode;
  departmentScopeType: DepartmentScopeType;
  startDate: Date;
  endDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek: number[];
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
}

export interface HolidayOverlay {
  id: string;
  holidayId: string;
  title: string;
  description: string | null;
  type: HolidayType;
  date: string;
  day: number;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
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

export function holidayAppliesToDepartment(holiday: HolidayLike, departmentId?: string | null) {
  if (holiday.departmentScopeType !== DepartmentScopeType.SELECTED) return true;
  if (!departmentId) return false;
  return (holiday.departmentLinks || []).some((link) => link.departmentId === departmentId);
}

export function holidayMatchesDate(holiday: HolidayLike, date: Date) {
  if (!holiday.isActive) return false;

  const current = toDateOnlyUtc(date);
  const start = toDateOnlyUtc(holiday.startDate);
  const end = toDateOnlyUtc(holiday.endDate);
  if (current < start || current > end) return false;

  const day = current.getUTCDay();
  if (holiday.matchMode === HolidayMatchMode.SINGLE_DAY) {
    return dateKey(current) === dateKey(start);
  }
  if (holiday.matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE) {
    return holiday.daysOfWeek.includes(day);
  }
  return true;
}

export function holidayOverlapsSlot(holiday: HolidayLike, date: Date, slot: TimetableSlotLike) {
  if (!holidayMatchesDate(holiday, date)) return false;
  if (!holidayAppliesToDepartment(holiday, slot.departmentId)) return false;
  if (holiday.isFullDay) return true;
  if (!holiday.startTime || !holiday.endTime) return false;
  return timeRangesOverlap(holiday.startTime, holiday.endTime, slot.startTime, slot.endTime);
}

export function buildHolidayOverlays(
  holidays: HolidayLike[],
  slots: TimetableSlotLike[],
  startDate: Date,
  endDate: Date,
) {
  const overlays: HolidayOverlay[] = [];
  const start = toDateOnlyUtc(startDate);
  const end = toDateOnlyUtc(endDate);

  for (let current = start; current <= end; current = addUtcDays(current, 1)) {
    const day = current.getUTCDay();
    const daySlots = slots.filter((slot) => slot.day === day);

    for (const holiday of holidays) {
      if (!holidayMatchesDate(holiday, current)) continue;

      const coveredScheduleIds = daySlots
        .filter((slot) => holidayOverlapsSlot(holiday, current, slot))
        .map((slot) => slot.scheduleId);

      if (!holiday.isFullDay && coveredScheduleIds.length === 0) continue;

      overlays.push({
        id: `${holiday.id}:${dateKey(current)}:${holiday.isFullDay ? 'full' : `${holiday.startTime}-${holiday.endTime}`}`,
        holidayId: holiday.id,
        title: holiday.title,
        description: holiday.description || null,
        type: holiday.type,
        date: dateKey(current),
        day,
        isFullDay: holiday.isFullDay,
        startTime: holiday.isFullDay ? null : holiday.startTime || null,
        endTime: holiday.isFullDay ? null : holiday.endTime || null,
        createdBy: holiday.createdBy?.name || holiday.createdBy?.email || null,
        departmentScopeType: holiday.departmentScopeType,
        departmentIds: holiday.departmentLinks?.map((link) => link.departmentId) || [],
        coveredScheduleIds,
      });
    }
  }

  return overlays;
}
