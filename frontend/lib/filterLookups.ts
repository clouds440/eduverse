import type { DropdownOption } from '@/components/ui/CustomSelect';
import { api } from '@/lib/api';
import { formatBuildingLabel, formatCourseSectionLabel, formatDepartmentLabel, formatRoomLabel } from '@/lib/utils';
import type { RoomType } from '@/types';

const DEFAULT_FILTER_LOOKUP_LIMIT = 25;

interface FilterLookupBase {
    token: string;
    search: string;
    limit?: number;
}

export type FilterLookupRequest =
    | (FilterLookupBase & { entity: 'departments'; isActive?: boolean })
    | (FilterLookupBase & { entity: 'courses'; my?: boolean; departmentId?: string })
    | (FilterLookupBase & { entity: 'sections'; my?: boolean; academicCycleId?: string; cohortId?: string; teacherId?: string; departmentId?: string; activeAcademicCycleOnly?: boolean })
    | (FilterLookupBase & { entity: 'teachers'; departmentId?: string; status?: string })
    | (FilterLookupBase & { entity: 'students'; my?: boolean; sectionId?: string; status?: string; cohortId?: string; departmentId?: string })
    | (FilterLookupBase & { entity: 'cohorts'; academicCycleId?: string; includeAllCycles?: boolean })
    | (FilterLookupBase & { entity: 'rooms'; isActive?: boolean; buildingId?: string; departmentId?: string; type?: RoomType })
    | (FilterLookupBase & { entity: 'buildings'; isActive?: boolean; departmentId?: string })
    | (FilterLookupBase & { entity: 'guardians' })
    | (FilterLookupBase & { entity: 'mailUsers' })
    | (FilterLookupBase & { entity: 'timetableTeachers' })
    | (FilterLookupBase & { entity: 'timetableStudents' });

function getLimit(request: FilterLookupRequest) {
    return request.limit ?? DEFAULT_FILTER_LOOKUP_LIMIT;
}

export async function searchFilterLookup(request: FilterLookupRequest): Promise<DropdownOption[]> {
    const search = request.search.trim();
    const limit = getLimit(request);

    switch (request.entity) {
        case 'departments': {
            const response = await api.org.getDepartments(request.token, {
                page: 1,
                limit,
                search,
                isActive: request.isActive,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((department) => ({
                value: department.id,
                label: formatDepartmentLabel(department),
            }));
        }
        case 'courses': {
            const response = await api.org.getCourses(request.token, {
                page: 1,
                limit,
                search,
                my: request.my,
                departmentId: request.departmentId,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((course) => ({
                value: course.id,
                label: course.code ? `${course.code} - ${course.name}` : course.name,
            }));
        }
        case 'sections': {
            const response = await api.org.getSections(request.token, {
                page: 1,
                limit,
                search,
                my: request.my,
                academicCycleId: request.academicCycleId,
                cohortId: request.cohortId,
                teacherId: request.teacherId,
                departmentId: request.departmentId,
                activeAcademicCycleOnly: request.activeAcademicCycleOnly,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((section) => ({
                value: section.id,
                label: formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name }),
                meta: section.code,
            }));
        }
        case 'teachers': {
            const response = await api.org.getTeachers(request.token, {
                page: 1,
                limit,
                search,
                departmentId: request.departmentId,
                status: request.status,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((teacher) => ({
                value: teacher.id,
                label: teacher.user?.name || teacher.user?.email || teacher.subject || 'Unnamed teacher',
                description: teacher.user?.email,
            }));
        }
        case 'students': {
            const response = await api.org.getStudents(request.token, {
                page: 1,
                limit,
                search,
                my: request.my,
                sectionId: request.sectionId,
                status: request.status,
                cohortId: request.cohortId,
                departmentId: request.departmentId,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((student) => ({
                value: student.id,
                label: student.user?.name || student.user?.email || student.registrationNumber || 'Unnamed student',
                description: student.user?.email,
                meta: student.rollNumber ? `Roll ${student.rollNumber}` : student.registrationNumber,
            }));
        }
        case 'cohorts': {
            const response = await api.cohorts.getCohorts(request.token, {
                page: 1,
                limit,
                search,
                academicCycleId: request.academicCycleId,
                includeAllCycles: request.includeAllCycles,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((cohort) => ({
                value: cohort.id,
                label: cohort.code ? `${cohort.code} - ${cohort.name}` : cohort.name,
            }));
        }
        case 'rooms': {
            const response = await api.org.getRooms(request.token, {
                page: 1,
                limit,
                search,
                isActive: request.isActive,
                buildingId: request.buildingId,
                departmentId: request.departmentId,
                type: request.type,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((room) => ({
                value: room.id,
                label: formatRoomLabel(room),
                description: room.building ? formatBuildingLabel(room.building) : undefined,
            }));
        }
        case 'buildings': {
            const response = await api.org.getBuildings(request.token, {
                page: 1,
                limit,
                search,
                isActive: request.isActive,
                departmentId: request.departmentId,
                sortBy: 'name',
                sortOrder: 'asc',
            });
            return response.data.map((building) => ({
                value: building.id,
                label: formatBuildingLabel(building),
            }));
        }
        case 'guardians': {
            const guardians = await api.org.getGuardians(request.token, { search });
            return guardians.slice(0, limit).map((guardian) => ({
                value: guardian.id,
                label: guardian.user?.name || guardian.user?.email || 'Unnamed guardian',
                description: guardian.user?.email,
            }));
        }
        case 'mailUsers': {
            const targets = await api.mail.getContactableUsers(request.token, search);
            return targets
                .filter((target) => target.type === 'USER')
                .slice(0, limit)
                .map((target) => ({
                    value: target.id,
                    label: target.email ? `${target.label} (${target.email})` : target.label,
                    description: target.description,
                }));
        }
        case 'timetableTeachers': {
            const teachers = await api.org.getTimetableTeachers(request.token, { search, limit });
            return teachers.map((teacher) => ({
                value: teacher.id,
                label: teacher.user?.name || teacher.user?.email || teacher.subject || 'Unnamed teacher',
                description: teacher.user?.email,
            }));
        }
        case 'timetableStudents': {
            const students = await api.org.getTimetableStudents(request.token, { search, limit });
            return students.map((student) => ({
                value: student.id,
                label: student.user?.name || student.user?.email || student.rollNumber || 'Unnamed student',
                description: student.user?.email,
                meta: student.rollNumber ? `Roll ${student.rollNumber}` : student.registrationNumber,
            }));
        }
    }
}
