import { countWeekdayOccurrences, toDateOnly } from './insights-date.util';

export function getAttendanceCoverage(
  schedules: { id: string; day: number }[],
  sessions: { scheduleId: string; date: Date }[],
  start: Date,
  end: Date,
) {
  const expected = schedules.reduce(
    (total, schedule) => total + countWeekdayOccurrences(start, end, schedule.day),
    0,
  );

  const uniqueSessions = new Set(
    sessions
      .filter((session) => session.scheduleId)
      .map((session) => `${session.scheduleId}:${toDateOnly(session.date)}`),
  );

  const actual = uniqueSessions.size;
  return {
    actual,
    expected,
    percent: expected > 0 ? (actual / expected) * 100 : 100,
  };
}

export function getUpcomingScheduleOccurrences(
  schedules: {
    id: string;
    day: number;
    startTime: string;
    endTime: string;
    room?: string | null;
    section: { id: string; name: string; color?: string | null; course: { name: string }; room?: string | null };
  }[],
  limit = 5,
) {
  const now = new Date();
  const occurrences = schedules.map((schedule) => {
    const occurrenceDate = new Date(now);
    occurrenceDate.setHours(0, 0, 0, 0);
    const delta = (schedule.day - occurrenceDate.getDay() + 7) % 7;
    occurrenceDate.setDate(occurrenceDate.getDate() + delta);

    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const startsAt = new Date(occurrenceDate);
    startsAt.setHours(startHour, startMinute, 0, 0);

    if (startsAt <= now) {
      startsAt.setDate(startsAt.getDate() + 7);
    }

    return {
      scheduleId: schedule.id,
      sectionId: schedule.section.id,
      sectionName: schedule.section.name,
      courseName: schedule.section.course.name,
      color: schedule.section.color || null,
      room: schedule.room || schedule.section.room || null,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      startsAt,
    };
  });

  return occurrences
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit);
}

export function getMissingScheduledSessions(
  schedules: {
    id: string;
    day: number;
    startTime: string;
    endTime: string;
    section: { id: string; name: string; color?: string | null; course: { name: string } };
  }[],
  existingSessions: { scheduleId: string; date: Date }[],
  daysBack: number,
  limit = 5,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);

  const existingKeys = new Set(
    existingSessions
      .filter((session) => session.scheduleId)
      .map((session) => `${session.scheduleId}:${toDateOnly(session.date)}`),
  );

  const missing: {
    scheduleId: string;
    date: string;
    sectionId: string;
    sectionName: string;
    courseName: string;
    color?: string | null;
    startTime: string;
    endTime: string;
  }[] = [];

  schedules.forEach((schedule) => {
    const cursor = new Date(start);
    while (cursor <= today) {
      if (cursor.getDay() === schedule.day) {
        const dateKey = toDateOnly(cursor);
        if (!existingKeys.has(`${schedule.id}:${dateKey}`)) {
          missing.push({
            scheduleId: schedule.id,
            date: dateKey,
            sectionId: schedule.section.id,
            sectionName: schedule.section.name,
            courseName: schedule.section.course.name,
            color: schedule.section.color || null,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return missing
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}
