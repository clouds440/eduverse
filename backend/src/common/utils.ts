import { Prisma } from '@/prisma/prisma-client';

export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS!, 10);

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  my?: boolean;
  sectionId?: string;
  userId?: string;
  status?: string;
  deleted?: boolean;
  academicCycleId?: string;
  cohortId?: string;
  teacherId?: string;
  departmentId?: string;
  activeAcademicCycleOnly?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
}

export interface TimetableSection {
  id: string;
  name: string;
  color?: string | null;
  room: string | null;
  defaultRoomId?: string | null;
  defaultRoom?: { name: string; building?: { name: string } | null } | null;
  course: { id?: string; name: string; departmentId?: string | null };
  schedules: {
    id: string;
    day: number;
    date?: Date | null;
    type?: 'OFFICIAL' | 'AD_HOC';
    startTime: string;
    endTime: string;
    room: string | null;
    roomId?: string | null;
    roomRef?: { name: string; building?: { name: string } | null } | null;
    teacherId?: string | null;
    teacher?: { user?: { id?: string; name: string | null; email?: string | null } | null } | null;
  }[];
}

export interface TimetableEntry {
  scheduleId: string;
  sectionId: string;
  sectionName: string;
  courseId: string | null;
  courseName: string;
  departmentId: string | null;
  color: string | null;
  day: number;
  date: string | null;
  type: 'OFFICIAL' | 'AD_HOC';
  startTime: string;
  endTime: string;
  room: string | null;
  roomId: string | null;
  teacherId: string | null;
  teacherUserId: string | null;
  teacherName: string | null;
}

export interface GroupedTimetableEntry {
  day: number;
  dayOrder: number;
  startTime: string;
  endTime: string;
  sections: {
    id: string;
    name: string;
    room: string | null;
    course: { name: string };
  }[];
}

export const extractTimetableEntries = (sections: TimetableSection[]): TimetableEntry[] => {
  const timetable: TimetableEntry[] = [];

  for (const section of sections) {
    for (const schedule of section.schedules) {
      const scheduleRoom = schedule.roomRef
        ? [schedule.roomRef.building?.name, schedule.roomRef.name].filter(Boolean).join(' - ')
        : null;
      const defaultRoom = section.defaultRoom
        ? [section.defaultRoom.building?.name, section.defaultRoom.name].filter(Boolean).join(' - ')
        : null;
      timetable.push({
        scheduleId: schedule.id,
        sectionId: section.id,
        sectionName: section.name,
        courseId: section.course.id || null,
        courseName: section.course.name,
        departmentId: section.course.departmentId || null,
        color: section.color || null,
        day: schedule.day,
        date: schedule.date ? schedule.date.toISOString().slice(0, 10) : null,
        type: schedule.type || 'OFFICIAL',
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: scheduleRoom || defaultRoom || schedule.room || section.room,
        roomId: schedule.roomId || section.defaultRoomId || null,
        teacherId: schedule.teacherId || null,
        teacherUserId: schedule.teacher?.user?.id || null,
        teacherName: schedule.teacher?.user?.name || schedule.teacher?.user?.email || null,
      });
    }
  }

  timetable.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.startTime.localeCompare(b.startTime);
  });

  return timetable;
};

export const getPaginationOptions = (options: PaginationOptions) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    status,
    deleted,
  } = options;

  const skip = (page - 1) * limit;
  const take = limit;

  return { skip, take, search, sortBy, sortOrder, status, deleted };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  totalRecords: number,
  page: number = 1,
  limit: number = 10,
): PaginatedResult<T> => {
  return {
    data,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    currentPage: page,
  };
};

export function normalizeSearchText(value?: string | number | null) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fuzzyTokens(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function editDistance(a: string, b: string, maxDistance = 2) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temp;
    }
  }

  return previous[b.length];
}

function isTransposition(a: string, b: string) {
  if (a.length !== b.length) return false;
  let firstDiff = -1;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === b[index]) continue;
    if (firstDiff !== -1) {
      return (
        index === firstDiff + 1 &&
        a[firstDiff] === b[index] &&
        a[index] === b[firstDiff] &&
        a.slice(index + 1) === b.slice(index + 1)
      );
    }
    firstDiff = index;
  }
  return false;
}

function tokenMatchScore(queryToken: string, fieldToken: string) {
  if (!queryToken || !fieldToken) return 0;
  if (fieldToken === queryToken) return 120;
  if (fieldToken.startsWith(queryToken)) return 90;
  if (fieldToken.includes(queryToken)) return 72;
  if (queryToken.length < 4 || fieldToken.length < 4) return 0;
  if (isTransposition(queryToken, fieldToken)) return 58;

  const maxDistance = queryToken.length >= 7 && fieldToken.length >= 7 ? 2 : 1;
  const sameAnchor = queryToken[0] === fieldToken[0] || queryToken.slice(0, 2) === fieldToken.slice(0, 2);
  if (!sameAnchor) return 0;

  const distance = editDistance(queryToken, fieldToken, maxDistance);
  return distance <= maxDistance ? 48 - distance * 12 : 0;
}

export function fuzzySearchScore(query: string, values: Array<string | number | null | undefined>) {
  const queryTokens = fuzzyTokens(query);
  if (!queryTokens.length) return 0;

  const fieldText = normalizeSearchText(values.filter(Boolean).join(' '));
  if (!fieldText) return 0;
  const fieldTokens = fieldText.split(/\s+/).filter(Boolean);

  let total = 0;
  for (const queryToken of queryTokens) {
    const wholeTextScore = fieldText.includes(queryToken) ? 66 : 0;
    const tokenScore = fieldTokens.reduce(
      (best, fieldToken) => Math.max(best, tokenMatchScore(queryToken, fieldToken)),
      wholeTextScore,
    );
    if (tokenScore <= 0) return 0;
    total += tokenScore;
  }

  if (fieldText === normalizeSearchText(query)) total += 160;
  if (fieldText.startsWith(normalizeSearchText(query))) total += 90;
  return total;
}

export function fuzzyFilterAndRank<T>(
  items: T[],
  query: string | undefined,
  getValues: (item: T) => Array<string | number | null | undefined>,
) {
  const trimmed = query?.trim();
  if (!trimmed) return items;

  return items
    .map((item) => ({ item, score: fuzzySearchScore(trimmed, getValues(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

export const extractUpdateFields = async <T extends Record<string, unknown>>(
  data: T,
  userFields: string[],
  entityFields: string[],
  existingUserEmail?: string,
) => {
  const userData: Record<string, unknown> = {};
  const entityData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (userFields.includes(key)) {
      if (key === 'password') {
        // Skip empty password to preserve existing password
        if (typeof value === 'string' && value.trim() === '') {
          continue;
        }
        // Pass password through as-is - updateUser will handle hashing
        userData.password = value;
      } else if (key === 'email') {
        if (value !== existingUserEmail) {
          userData.email = value;
        }
      } else {
        userData[key] = value;
      }
    } else if (entityFields.includes(key)) {
      entityData[key] = value;
    }
  }

  return { userData: userData as Prisma.UserUpdateInput, entityData };
};

export const mapStatusCounts = <T extends string>(
  statusCounts: { status: string; _count: { _all?: number; id?: number } }[],
  allowedStatuses: Record<T, unknown>,
): Record<T, number> => {
  const countsMap = {} as Record<T, number>;
  for (const status of Object.keys(allowedStatuses)) {
    countsMap[status as T] = 0;
  }

  statusCounts.forEach((c) => {
    if (c.status in countsMap) {
      countsMap[c.status as T] = c._count._all || c._count.id || 0;
    }
  });

  return countsMap;
};
