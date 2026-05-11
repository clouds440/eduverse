import {
    Teacher, Student, Organization, RegisterRequest, LoginRequest, AuthResponse,
    UpdateOrgSettingsRequest, PlatformAdmin, AdminStats, Section, Course,
    CreateTeacherRequest, UpdateTeacherRequest, CreateStudentRequest, UpdateStudentRequest,
    CreateSectionRequest, UpdateSectionRequest, CreateCourseRequest, UpdateCourseRequest,
    PaginatedResponse, OrgStatus, MailItem, MailDetail, CreateMailPayload, UpdateMailPayload,
    Assessment, Grade, Submission, CreateAssessmentRequest, UpdateAssessmentRequest,
    UpdateGradeRequest, CreateSubmissionRequest, FinalGradeResponse, MailTarget,
    Chat, ChatMessage, Notification, Announcement, TargetType, AnnouncementPriority, User,
    ThemeMode, SectionSchedule, TimetableEntry, AttendanceRecord, SectionAttendanceResponse,
    RangeAttendanceResponse, CourseMaterial, CreateCourseMaterialRequest, UpdateCourseMaterialRequest, DashboardInsights,
    AcademicCycle, Cohort, Transcript, CreateAcademicCycleDto, UpdateAcademicCycleDto, CreateCohortDto, UpdateCohortDto, PromoteStudentsDto, CopyForwardDto
} from '@/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? '';

function getApiBaseUrl(): string {
    if (!API_BASE_URL) {
        throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
    }

    return API_BASE_URL;
}

let unauthorizedHandler: ((failedToken?: string) => void) | null = null;

export const setUnauthorizedHandler = (handler: (failedToken?: string) => void) => {
    unauthorizedHandler = handler;
};

interface RequestOptions extends RequestInit {
    token?: string;
    signal?: AbortSignal;
}

interface QueryParams {
    [key: string]: string | number | boolean | undefined;
}

interface AuthSessionSummary {
    id: string;
    userId: string;
    deviceId: string;
    deviceName: string;
    os: string;
    token: string;
    lastSeenAt: string;
    expiresAt: string;
    createdAt: string;
    ip?: string | null;
    location?: string | null;
    shouldLogout?: boolean;
}

function buildQueryString(params: QueryParams): string {
    const query = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
    return query ? `?${query}` : '';
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, signal, ...rest } = options;
    const apiBaseUrl = getApiBaseUrl();

    const headers: HeadersInit = {
        ...(rest.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> ?? {}),
    };

    // Note: SWR handles request deduplication with dedupingInterval.
    // We keep AbortSignal support for explicit cancellation when needed.
    const response = await fetch(`${apiBaseUrl}${endpoint}`, { ...rest, headers, signal });

    if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler(token);
    }

    if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const data = await response.json();
                message = Array.isArray(data.message) ? data.message[0] : data.message || message;
            } else {
                const text = await response.text();
                if (text && text.length < 200) message = text;
            }
        } catch (error) {
            console.error('Error parsing error response:', error);
        }
        throw new Error(message);
    }

    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
}

// --- FIX 3: Consolidated FormData upload helper ---
// Previously, uploadLogo, uploadAvatar, uploadFile, and addMessage (with files)
// each duplicated the raw fetch + 401 handling + error parsing logic.
// This single helper covers all of them and supports AbortSignal too.
async function uploadFormData<T>(
    endpoint: string,
    formData: FormData,
    token: string,
    method: string = 'POST',
    signal?: AbortSignal,
): Promise<T> {
    return request<T>(endpoint, {
        method,
        body: formData,
        token,
        signal,
    });
}

export const api = {
    auth: {
        register: (data: RegisterRequest) =>
            request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
        login: (data: LoginRequest) =>
            request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
        logout: (token: string) =>
            request<void>('/auth/logout', { method: 'POST', token }).catch(e => console.warn('Logout failed', e)),
        changePassword: (oldPassword: string, newPassword: string, token: string) =>
            request<{ access_token: string, role: string }>('/auth/change-password', {
                method: 'POST', body: JSON.stringify({ oldPassword, newPassword }), token
            }),
        updateProfile: (data: Partial<{ themeMode?: ThemeMode; name?: string }>, token: string) =>
            request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data), token }),
        getSessions: (token: string) =>
            request<AuthSessionSummary[]>('/auth/sessions', { token }),
        revokeSession: (sessionId: string, token: string) =>
            request<{ message: string; shouldLogout?: boolean }>(`/auth/sessions/${sessionId}`, { method: 'DELETE', token }),
        revokeAllSessions: (token: string) =>
            request<{ message: string }>('/auth/sessions', { method: 'DELETE', token }),
    },

    user: {
        getUser: (id: string, token: string) =>
            request<User>(`/users/${id}`, { token }),
    },

    admin: {
        getOrganizations: (token: string, params: { status?: OrgStatus, page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', type?: string } = {}) =>
            request<PaginatedResponse<Organization>>(`/admin/organizations${buildQueryString(params)}`, { token }),
        approveOrganization: (id: string, token: string) =>
            request<void>(`/admin/organizations/${id}/approve`, { method: 'PATCH', token }),
        rejectOrganization: (id: string, reason: string, token: string) =>
            request<void>(`/admin/organizations/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }), token }),
        suspendOrganization: (id: string, reason: string, token: string) =>
            request<void>(`/admin/organizations/${id}/suspend`, { method: 'PATCH', body: JSON.stringify({ reason }), token }),
        getAdminStats: (token: string) =>
            request<AdminStats>('/admin/stats', { token }),
        getPlatformAdmins: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc' } = {}) =>
            request<PaginatedResponse<PlatformAdmin>>(`/admin/platform-admins${buildQueryString(params)}`, { token }),
        createPlatformAdmin: (data: Partial<PlatformAdmin> & { password?: string }, token: string) =>
            request<PlatformAdmin>('/admin/platform-admins', { method: 'POST', body: JSON.stringify(data), token }),
        updatePlatformAdmin: (id: string, data: Partial<PlatformAdmin>, token: string) =>
            request<PlatformAdmin>(`/admin/platform-admins/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deletePlatformAdmin: (id: string, token: string) =>
            request<void>(`/admin/platform-admins/${id}`, { method: 'DELETE', token }),
    },

    org: {
        getOrgData: (token: string) =>
            request<Organization>('/org/settings', { token }),
        updateSettings: (data: UpdateOrgSettingsRequest, token: string) =>
            request<void>('/org/settings', { method: 'PATCH', body: JSON.stringify(data), token }),
        reapply: (token: string) =>
            request<void>('/org/reapply', { method: 'PATCH', token }),

        // FIX 3 applied: was duplicating raw fetch + 401 handling
        uploadLogo: (file: File, token: string): Promise<{ logoUrl: string; avatarUpdatedAt: string }> => {
            const formData = new FormData();
            formData.append('file', file);
            return uploadFormData('/org/settings/logo', formData, token, 'PATCH');
        },

        getTeacher: (id: string, token: string) =>
            request<Teacher>(`/org/teachers/${id}`, { token }),
        getTeacherByUserId: (userId: string, token: string) =>
            request<Teacher>(`/org/teachers/by-user/${userId}`, { token }),
        getTeachers: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, deleted?: boolean } = {}) =>
            request<PaginatedResponse<Teacher>>(`/org/teachers${buildQueryString(params)}`, { token }),
        createTeacher: (data: CreateTeacherRequest, token: string) =>
            request<Teacher>('/org/teachers', { method: 'POST', body: JSON.stringify(data), token }),
        updateTeacher: (id: string, data: UpdateTeacherRequest, token: string) =>
            request<Teacher>(`/org/teachers/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        restoreTeacher: (id: string, status: string, token: string) =>
            request<{ message: string }>(`/org/teachers/${id}/restore`, { method: 'PATCH', body: JSON.stringify({ status }), token }),
        deleteTeacher: (id: string, token: string) =>
            request<void>(`/org/teachers/${id}`, { method: 'DELETE', token }),
        getManagers: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, deleted?: boolean } = {}) =>
            request<PaginatedResponse<Teacher>>(`/org/managers${buildQueryString(params)}`, { token }),

        getStudent: (id: string, token: string) =>
            request<Student>(`/org/students/${id}`, { token }),
        getStudentByUserId: (userId: string, token: string) =>
            request<Student>(`/org/students/by-user/${userId}`, { token }),
        getStudents: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', my?: boolean, sectionId?: string, status?: string, deleted?: boolean, cohortId?: string } = {}) =>
            request<PaginatedResponse<Student>>(`/org/students${buildQueryString(params)}`, { token }),
        createStudent: (data: CreateStudentRequest, token: string) =>
            request<Student>('/org/students', { method: 'POST', body: JSON.stringify(data), token }),
        updateStudent: (id: string, data: UpdateStudentRequest, token: string) =>
            request<Student>(`/org/students/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        restoreStudent: (id: string, status: string, token: string) =>
            request<{ message: string }>(`/org/students/${id}/restore`, { method: 'PATCH', body: JSON.stringify({ status }), token }),
        deleteStudent: (id: string, token: string) =>
            request<void>(`/org/students/${id}`, { method: 'DELETE', token }),

        getSection: (id: string, token: string) =>
            request<Section>(`/org/sections/${id}`, { token }),
        getSections: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', my?: boolean, userId?: string, academicCycleId?: string } = {}) =>
            request<PaginatedResponse<Section>>(`/org/sections${buildQueryString(params)}`, { token }),
        createSection: (data: CreateSectionRequest, token: string) =>
            request<Section>('/org/sections', { method: 'POST', body: JSON.stringify(data), token }),
        updateSection: (id: string, data: UpdateSectionRequest, token: string) =>
            request<Section>(`/org/sections/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteSection: (id: string, token: string) =>
            request<void>(`/org/sections/${id}`, { method: 'DELETE', token }),

        getCourses: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', my?: boolean } = {}) =>
            request<PaginatedResponse<Course>>(`/org/courses${buildQueryString(params)}`, { token }),
        createCourse: (data: CreateCourseRequest, token: string) =>
            request<Course>('/org/courses', { method: 'POST', body: JSON.stringify(data), token }),
        updateCourse: (id: string, data: UpdateCourseRequest, token: string) =>
            request<Course>(`/org/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteCourse: (id: string, token: string) =>
            request<void>(`/org/courses/${id}`, { method: 'DELETE', token }),

        // FIX 3 applied: was duplicating raw fetch + 401 handling
        uploadAvatar: (userId: string, file: File, token: string): Promise<{ avatarUrl: string; avatarUpdatedAt: string }> => {
            const formData = new FormData();
            formData.append('file', file);
            return uploadFormData(`/org/users/${userId}/avatar`, formData, token, 'PATCH');
        },

        // --- Assessments ---
        getAssessments: (token: string, params: { sectionId?: string, courseId?: string } = {}) =>
            request<Assessment[]>(`/org/assessments${buildQueryString(params)}`, { token }),
        getAssessment: (id: string, token: string) =>
            request<Assessment>(`/org/assessments/${id}`, { token }),
        createAssessment: (data: CreateAssessmentRequest, token: string) =>
            request<Assessment>('/org/assessments', { method: 'POST', body: JSON.stringify(data), token }),
        updateAssessment: (id: string, data: UpdateAssessmentRequest, token: string) =>
            request<Assessment>(`/org/assessments/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteAssessment: (id: string, token: string) =>
            request<void>(`/org/assessments/${id}`, { method: 'DELETE', token }),

        // --- Grades ---
        getGrades: (assessmentId: string, token: string) =>
            request<Grade[]>(`/org/assessments/${assessmentId}/grades`, { token }),
        updateGrade: (assessmentId: string, studentId: string, data: UpdateGradeRequest, token: string) =>
            request<Grade>(`/org/assessments/${assessmentId}/grades/${studentId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getOwnFinalGrades: (token: string) =>
            request<FinalGradeResponse[]>('/org/grades/final', { token }),
        publishGrades: (assessmentId: string, token: string) =>
            request<void>(`/org/assessments/${assessmentId}/publish`, { method: 'PATCH', token }),
        finalizeGrades: (assessmentId: string, token: string) =>
            request<void>(`/org/assessments/${assessmentId}/finalize`, { method: 'PATCH', token }),

        // --- Submissions ---
        getSubmissions: (assessmentId: string, token: string) =>
            request<Submission[]>(`/org/assessments/${assessmentId}/submissions`, { token }),
        createSubmission: (assessmentId: string, data: CreateSubmissionRequest, token: string) =>
            request<Submission>(`/org/assessments/${assessmentId}/submissions`, { method: 'POST', body: JSON.stringify(data), token }),

        // --- Final Results ---
        getStudentFinalGrades: (studentId: string, token: string, sectionId?: string) =>
            request<FinalGradeResponse[]>(`/org/students/${studentId}/final-grades${buildQueryString({ sectionId })}`, { token }),
        getProfile: <T = Student | Teacher>(token: string) =>
            request<T>('/org/profile', { token }),
        updateProfile: <T = Student | Teacher>(data: UpdateStudentRequest | UpdateTeacherRequest, token: string) =>
            request<T>('/org/profile', { method: 'PATCH', body: JSON.stringify(data), token }),
        getInsights: (token: string) =>
            request<DashboardInsights>('/org/insights', { token }),

        // --- Timetable & Attendance ---
        createSchedule: (id: string, data: { day: number, startTime: string, endTime: string, room?: string }, token: string) =>
            request<SectionSchedule>(`/org/sections/${id}/schedules`, { method: 'POST', body: JSON.stringify(data), token }),
        getSchedules: (id: string, token: string) =>
            request<SectionSchedule[]>(`/org/sections/${id}/schedules`, { token }),
        updateSchedule: (sectionId: string, scheduleId: string, data: Partial<{ day: number, startTime: string, endTime: string, room?: string }>, token: string) =>
            request<SectionSchedule>(`/org/sections/${sectionId}/schedules/${scheduleId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteSchedule: (sectionId: string, scheduleId: string, token: string) =>
            request<void>(`/org/sections/${sectionId}/schedules/${scheduleId}`, { method: 'DELETE', token }),
        getTimetable: (token: string) =>
            request<TimetableEntry[]>('/org/timetable', { token }),

        createAttendanceSession: (sectionId: string, date: string, token: string, scheduleId?: string, startTime?: string, endTime?: string) =>
            request<{ id: string }>(`/org/sections/${sectionId}/attendance/sessions`, { method: 'POST', body: JSON.stringify({ date, scheduleId, startTime, endTime }), token }),
        markAttendance: (sessionId: string, records: { studentId: string, status: string }[], token: string) =>
            request<AttendanceRecord[]>(`/org/attendance/${sessionId}`, { method: 'POST', body: JSON.stringify(records), token }),
        getSectionAttendance: (sectionId: string, date: string, token: string, scheduleId?: string) =>
            request<SectionAttendanceResponse>(`/org/sections/${sectionId}/attendance${buildQueryString({ date, scheduleId })}`, { token }),
        getSectionAttendanceRange: (sectionId: string, start: string, end: string, token: string) =>
            request<RangeAttendanceResponse>(`/org/sections/${sectionId}/attendance/range${buildQueryString({ start, end })}`, { token }),
        getStudentAttendance: (studentId: string, token: string) =>
            request<AttendanceRecord[]>(`/org/students/${studentId}/attendance`, { token }),
    },

    files: {
        // FIX 3 applied: was duplicating raw fetch + 401 handling + error parsing
        uploadFile: (orgId: string, entityType: string, entityId: string, file: File, token: string): Promise<{ id?: string; url?: string; path?: string }> => {
            const formData = new FormData();
            formData.append('orgId', orgId);
            formData.append('entityType', entityType);
            formData.append('entityId', entityId);
            formData.append('file', file);
            return uploadFormData('/files', formData, token, 'POST');
        },
        deleteFile: (id: string, token: string) =>
            request<void>(`/files/${id}`, { method: 'DELETE', token }),
    },

    mail: {
        getMails: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, category?: string } = {}) =>
            request<PaginatedResponse<MailItem>>(`/mail${buildQueryString(params)}`, { token }),
        getMail: (id: string, token: string) =>
            request<MailDetail>(`/mail/${id}`, { token }),
        createMail: (data: CreateMailPayload, token: string) =>
            request<MailDetail>('/mail', { method: 'POST', body: JSON.stringify(data), token }),
        updateMail: (id: string, data: UpdateMailPayload, token: string) =>
            request<MailDetail>(`/mail/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

        // FIX 3 applied: was duplicating raw fetch + 401 handling in the files branch
        addMessage: (mailId: string, data: { content: string }, token: string, files?: File[]) => {
            if (files && files.length > 0) {
                const formData = new FormData();
                formData.append('content', data.content);
                files.forEach(file => formData.append('files', file));
                return uploadFormData<MailDetail>(`/mail/${mailId}/messages`, formData, token, 'POST');
            }
            return request<MailDetail>(`/mail/${mailId}/messages`, { method: 'POST', body: JSON.stringify(data), token });
        },

        getContactableUsers: (token: string, search?: string) =>
            request<MailTarget[]>(`/mail/contacts${buildQueryString({ search })}`, { token }),
        getUnreadCount: (token: string) =>
            request<{ unread: number; total: number; countsByStatus: Record<string, number> }>('/mail/unread-count', { token }),
    },

    chat: {
        searchUsers: (token: string, search?: string) =>
            request<User[]>(`/chat/users${buildQueryString({ search })}`, { token }),
        createDirectChat: (participantId: string, token: string) =>
            request<Chat>('/chat/direct', { method: 'POST', body: JSON.stringify({ participantId }), token }),
        createGroupChat: (name: string, participantIds: string[], token: string) =>
            request<Chat>('/chat/group', { method: 'POST', body: JSON.stringify({ name, participantIds }), token }),
        getChat: (chatId: string, token: string) =>
            request<Chat>(`/chat/${chatId}`, { token }),
        getUserChats: (token: string) =>
            request<Chat[]>('/chat', { token }),
        getChatMessages: (chatId: string, token: string, params: { page?: number, limit?: number, aroundId?: string } = {}) =>
            request<PaginatedResponse<ChatMessage>>(`/chat/${chatId}/messages${buildQueryString(params)}`, { token }),
        sendMessage: (chatId: string, content: string, token: string, replyToId?: string, mentionedUserIds?: string[]) =>
            request<ChatMessage>(`/chat/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ content, replyToId, mentionedUserIds }), token }),
        editMessage: (chatId: string, messageId: string, content: string, token: string) =>
            request<ChatMessage>(`/chat/${chatId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }), token }),
        getUnreadCount: (token: string) =>
            request<{ unread: number }>('/chat/unread-count', { token }),
        markAsRead: (chatId: string, messageId: string | undefined, token: string) =>
            request<void>(`/chat/${chatId}/read${messageId ? `/${messageId}` : ''}`, { method: 'PATCH', token }),
        deleteMessage: (chatId: string, messageId: string, token: string) =>
            request<void>(`/chat/${chatId}/messages/${messageId}/delete`, { method: 'POST', token }),
        updateLocalState: (chatId: string, options: { hide?: boolean, clear?: boolean }, token: string) =>
            request<void>(`/chat/${chatId}/local-state`, { method: 'POST', body: JSON.stringify(options), token }),
        updateChat: (chatId: string, data: { name?: string, avatarUrl?: string, readOnly?: boolean }, token: string) =>
            request<Chat>(`/chat/${chatId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        addParticipants: (chatId: string, participantIds: string[], token: string) =>
            request<void>(`/chat/${chatId}/participants`, { method: 'POST', body: JSON.stringify({ participantIds }), token }),
        removeParticipant: (chatId: string, userId: string, token: string) =>
            request<void>(`/chat/${chatId}/participants/${userId}/remove`, { method: 'POST', token }),
        updateParticipantRole: (chatId: string, userId: string, role: 'ADMIN' | 'MOD' | 'MEMBER', token: string) =>
            request<void>(`/chat/${chatId}/participants/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }), token }),
    },

    notifications: {
        getUserNotifications: (token: string, params: { page?: number, limit?: number } = {}) =>
            request<PaginatedResponse<Notification> & { unreadCount: number }>(`/notifications${buildQueryString(params)}`, { token }),
        markAsRead: (id: string, token: string) =>
            request<void>(`/notifications/${id}/read`, { method: 'PATCH', token }),
        markAllAsRead: (token: string) =>
            request<void>('/notifications/read-all', { method: 'PATCH', token }),
        clearCategory: (category: 'CHAT' | 'MAIL', token: string) =>
            request<void>(`/notifications/clear-category/${category}`, { method: 'PATCH', token }),
    },

    announcements: {
        createAnnouncement: (data: { title: string, body: string, targetType: TargetType, targetId?: string, actionUrl?: string, priority?: AnnouncementPriority }, token: string) =>
            request<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(data), token }),
        getAnnouncements: (token: string, params: { page?: number, limit?: number } = {}) =>
            request<PaginatedResponse<Announcement>>(`/announcements${buildQueryString(params)}`, { token }),
    },

    courseMaterials: {
        getMaterials: (sectionId: string, token: string) =>
            request<CourseMaterial[]>(`/course-materials/section/${sectionId}`, { token }),
        createMaterial: (sectionId: string, data: CreateCourseMaterialRequest, token: string) =>
            request<CourseMaterial>(`/course-materials`, { method: 'POST', body: JSON.stringify({ ...data, sectionId }), token }),
        updateMaterial: (materialId: string, data: UpdateCourseMaterialRequest, token: string) =>
            request<CourseMaterial>(`/course-materials/${materialId}`, { method: 'PUT', body: JSON.stringify(data), token }),
        deleteMaterial: (materialId: string, token: string) =>
            request<void>(`/course-materials/${materialId}`, { method: 'DELETE', token }),
    },

    academicCycles: {
        getCycles: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc' } = {}) =>
            request<PaginatedResponse<AcademicCycle>>(`/org/academic-cycles${buildQueryString(params)}`, { token }),
        getActiveCycle: (token: string) =>
            request<AcademicCycle>(`/org/academic-cycles/active`, { token }),
        getCycle: (id: string, token: string) =>
            request<AcademicCycle>(`/org/academic-cycles/${id}`, { token }),
        createCycle: (data: CreateAcademicCycleDto, token: string) =>
            request<AcademicCycle>(`/org/academic-cycles`, { method: 'POST', body: JSON.stringify(data), token }),
        updateCycle: (id: string, data: UpdateAcademicCycleDto, token: string) =>
            request<AcademicCycle>(`/org/academic-cycles/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        activateCycle: (id: string, token: string) =>
            request<{ message: string; cycle: AcademicCycle }>(`/org/academic-cycles/${id}/activate`, { method: 'PATCH', token }),
        deleteCycle: (id: string, token: string) =>
            request<void>(`/org/academic-cycles/${id}`, { method: 'DELETE', token }),
    },

    cohorts: {
        getCohorts: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', academicCycleId?: string } = {}) =>
            request<PaginatedResponse<Cohort>>(`/org/cohorts${buildQueryString(params)}`, { token }),
        getCohort: (id: string, token: string) =>
            request<Cohort>(`/org/cohorts/${id}`, { token }),
        createCohort: (data: CreateCohortDto, token: string) =>
            request<Cohort>(`/org/cohorts`, { method: 'POST', body: JSON.stringify(data), token }),
        updateCohort: (id: string, data: UpdateCohortDto, token: string) =>
            request<Cohort>(`/org/cohorts/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteCohort: (id: string, token: string) =>
            request<void>(`/org/cohorts/${id}`, { method: 'DELETE', token }),
        addStudents: (id: string, studentIds: string[], token: string) =>
            request<{ message: string }>(`/org/cohorts/${id}/students`, { method: 'POST', body: JSON.stringify({ studentIds }), token }),
        removeStudent: (id: string, studentId: string, token: string) =>
            request<{ message: string }>(`/org/cohorts/${id}/students/${studentId}`, { method: 'DELETE', token }),
        assignSection: (id: string, sectionId: string, token: string) =>
            request<{ message: string }>(`/org/cohorts/${id}/sections`, { method: 'POST', body: JSON.stringify({ sectionId }), token }),
        removeSection: (id: string, sectionId: string, token: string) =>
            request<{ message: string }>(`/org/cohorts/${id}/sections/${sectionId}`, { method: 'DELETE', token }),
        excludeStudentFromSection: (studentId: string, sectionId: string, token: string) =>
            request<{ message: string }>(`/org/cohorts/enrollments/exclude`, { method: 'POST', body: JSON.stringify({ studentId, sectionId }), token }),
        includeStudentInSection: (studentId: string, sectionId: string, token: string) =>
            request<{ message: string }>(`/org/cohorts/enrollments/include`, { method: 'POST', body: JSON.stringify({ studentId, sectionId }), token }),
    },

    transcripts: {
        getStudentTranscript: (studentId: string, token: string, cycleId?: string) =>
            request<Transcript>(`/org/transcripts/students/${studentId}${buildQueryString({ cycleId })}`, { token }),
        getCycleReport: (cycleId: string, token: string) =>
            request<Transcript[]>(`/org/transcripts/cycles/${cycleId}/report`, { token }),
    },

    promotions: {
        promoteStudents: (data: PromoteStudentsDto, token: string) =>
            request<{ message: string; promoted: number; skipped: number }>(`/org/promotions`, { method: 'POST', body: JSON.stringify(data), token }),
    },

    copyForward: {
        execute: (data: CopyForwardDto, token: string) =>
            request<{ message: string; sectionsCopied: number; details: any }>(`/org/copy-forward`, { method: 'POST', body: JSON.stringify(data), token }),
    }
};
