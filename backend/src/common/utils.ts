import { Prisma } from '@prisma/client';

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
  defaultRoom?: { name: string; building?: { name: string } | null } | null;
  course: { id?: string; name: string };
  schedules: {
    id: string;
    day: number;
    startTime: string;
    endTime: string;
    room: string | null;
    roomRef?: { name: string; building?: { name: string } | null } | null;
  }[];
  teachers?: { id: string; user?: { name: string | null; email?: string | null } | null }[];
}

export interface TimetableEntry {
  scheduleId: string;
  sectionId: string;
  sectionName: string;
  courseId: string | null;
  courseName: string;
  color: string | null;
  day: number;
  startTime: string;
  endTime: string;
  room: string | null;
  teacherName: string | null;
  additionalTeachersCount: number;
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
        color: section.color || null,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: scheduleRoom || defaultRoom || schedule.room || section.room,
        teacherName: section.teachers?.[0]?.user?.name || section.teachers?.[0]?.user?.email || null,
        additionalTeachersCount: Math.max(0, (section.teachers?.length || 0) - 1),
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
