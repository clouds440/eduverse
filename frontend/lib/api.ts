import type {
    Teacher, Student, Organization, RegisterRequest, LoginRequest, AuthResponse,
    UpdateOrgSettingsRequest, PlatformAdmin, AdminStats, Section, Course,
    CreateTeacherRequest, UpdateTeacherRequest, CreateSubAdminRequest, UpdateSubAdminRequest, CreateFinanceManagerRequest, UpdateFinanceManagerRequest, CreateStudentRequest, UpdateStudentRequest,
    CreateGuardianRequest, GuardianOverview, GuardianProfile, UpdateGuardianRequest,
    CreateSectionRequest, UpdateSectionRequest, CreateCourseRequest, UpdateCourseRequest,
    PaginatedResponse, OrgStatus, MailItem, MailDetail, CreateMailPayload, UpdateMailPayload,
    Assessment, Grade, Submission, CreateAssessmentRequest, UpdateAssessmentRequest,
    UpdateGradeRequest, CreateSubmissionRequest, FinalGradeResponse, MailTarget,
    Chat, ChatMessage, ChatSearchUser, Notification, Announcement, TargetType, AnnouncementPriority, User,
    ThemeMode, SectionSchedule, TimetableResponse, AttendanceRecord, SectionAttendanceResponse,
    RangeAttendanceResponse, CourseMaterial, CreateCourseMaterialRequest, UpdateCourseMaterialRequest, DashboardInsights, InsightsQueryParams,
    AcademicCycle, Cohort, Transcript, CreateAcademicCycleDto, UpdateAcademicCycleDto, CreateCohortDto, UpdateCohortDto, PromoteStudentsDto, CopyForwardDto, CopyForwardPreview,
    Department, Building, Room, CreateDepartmentRequest, UpdateDepartmentRequest, CreateBuildingRequest, UpdateBuildingRequest, CreateRoomRequest, UpdateRoomRequest, RoomType,
    CampusNavigationBuildingRoomsResponse,
    CampusNavigationResponse,
    CampusNavigationRoomSelection,
    FinancialStructure, FinancialEntry, Transaction, FinanceStats, FinanceInsights, TeacherFinanceOverview, MessageResponse, AuditLogItem, PayrollRosterRow,
    GpaPolicy, CreateGpaPolicyRequest, UpdateGpaPolicyRequest, GpaPolicyPreviewRequest, GpaPolicyPreviewResponse,
    GradeFinalizationFilters, GradeFinalizationRow, SectionGradebookResponse, OrgUserCounts,
    ImportEntity, ImportValidationResult, ImportPreviewRow, ImportConfirmResult, InvalidImportRow, AttendanceMonthlyImportOptions,
    Holiday, CreateHolidayRequest, UpdateHolidayRequest, HolidayType,
    Evaluation, EvaluationPendingResponse, EvaluationSummary, EvaluationType,
    CreateEvaluationRequest, UpdateEvaluationRequest, EvaluationWindow, CreateEvaluationWindowRequest, UpdateEvaluationWindowRequest, BulkCreateEvaluationWindowsRequest, BulkCreateEvaluationWindowsResponse,
    PreferenceWindow, PreferenceWindowRequest, PreferenceResults, PreferenceSubmission, Enrollment, EnrollmentMutationResponse,
    LinkedAccount, PasswordResetLinkResponse, PublicProfile
} from '@/types';
import type {
    AIOrgSettingsResponse,
    AIOrgUsageResponse,
    AIPersonalSettingsResponse,
    AIPersonalUsageResponse,
    AIChatRequest,
    AIChatResponse,
    AIChatStreamEvent,
    AIConversationDetail,
    AIConversationSummary,
    AIEntitlementResponse,
    AISuggestedQuestionsResponse,
    AIDocsSearchResult,
    AIRouteSearchResult,
    AISubscriptionOwnerType,
    AISubscriptionPlan,
    Role,
} from '@/types';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { enqueueMutation } from './offlineQueue';
import { emitProfanityWarning, PROFANITY_ERROR_CODE } from './profanityWarning';

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

export class ApiRequestError extends Error {
    status: number;
    code?: string;
    field?: string;
    response?: {
        status: number;
        data: {
            code?: string;
            field?: string;
            message: string;
        };
    };

    constructor(message: string, status: number, details?: { code?: string; field?: string }) {
        super(message);
        this.name = 'ApiRequestError';
        this.status = status;
        this.code = details?.code;
        this.field = details?.field;
        this.response = {
            status,
            data: {
                code: details?.code,
                field: details?.field,
                message,
            },
        };
    }
}

export class ApiNetworkError extends ApiRequestError {
    constructor(message = 'Unable to reach the server') {
        super(message, 0);
        this.name = 'ApiNetworkError';
    }
}

interface RequestOptions extends RequestInit {
    token?: string;
    signal?: AbortSignal;
}

interface AIChatStreamHandlers {
    onEvent: (event: AIChatStreamEvent) => void;
}

interface QueryParams {
    [key: string]: string | number | boolean | undefined;
}

export interface WebPushSubscriptionPayload {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface WebPushConfigResponse {
    publicKey: string | null;
    configured: boolean;
}

interface AuthSessionSummary {
    id: string;
    userId: string;
    deviceId: string;
    deviceName: string;
    os: string;
    lastSeenAt: string;
    expiresAt: string;
    createdAt: string;
    ip?: string | null;
    location?: string | null;
    isCurrent?: boolean;
    shouldLogout?: boolean;
}

function buildQueryString(params: QueryParams): string {
    const query = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
    return query ? `?${query}` : '';
}

function parseApiErrorData(data: unknown, fallback: string) {
    const root = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const nested = root.message && typeof root.message === 'object' && !Array.isArray(root.message)
        ? root.message as Record<string, unknown>
        : {};
    const rawMessage = root.message ?? nested.message;
    const message = Array.isArray(rawMessage)
        ? String(rawMessage[0] || fallback)
        : typeof rawMessage === 'string'
            ? rawMessage
            : typeof nested.message === 'string'
                ? nested.message
                : fallback;
    const code = typeof root.code === 'string'
        ? root.code
        : typeof nested.code === 'string'
            ? nested.code
            : undefined;
    const field = typeof root.field === 'string'
        ? root.field
        : typeof nested.field === 'string'
            ? nested.field
            : undefined;

    return { message, code, field };
}

function maybeEmitProfanityWarning(error: { code?: string; field?: string; message: string }) {
    if (error.code !== PROFANITY_ERROR_CODE) return;

    emitProfanityWarning({
        field: error.field,
        message: error.message,
    });
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, signal, ...rest } = options;

    const headers: HeadersInit = {
        ...(rest.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> ?? {}),
    };

    const isGet = !rest.method || rest.method.toUpperCase() === 'GET';
    const canUseOfflineCache = isGet && endpoint !== '/auth/session';
    const cacheKey = `eduverse-cache:${endpoint}`;

    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}${endpoint}`, {
            ...rest,
            credentials: 'include',
            headers,
            signal,
        });

        if (response.status === 401 && unauthorizedHandler) {
            unauthorizedHandler(token);
        }

        if (!response.ok) {
            let message = `Request failed with status ${response.status}`;
            let code: string | undefined;
            let field: string | undefined;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const data = await response.json();
                    const parsed = parseApiErrorData(data, message);
                    message = parsed.message;
                    code = parsed.code;
                    field = parsed.field;
                } else {
                    const text = await response.text();
                    if (text && text.length < 200) message = text;
                }
            } catch (error) {
                console.error('Error parsing error response:', error);
            }
            maybeEmitProfanityWarning({ code, field, message });
            throw new ApiRequestError(message, response.status, { code, field });
        }

        if (response.status === 204) return null as T;
        
        const data = await response.json() as T;

        if (canUseOfflineCache && typeof window !== 'undefined') {
            idbSet(cacheKey, data).catch(err => console.warn('Failed to cache data', err));
        }

        return data;
    } catch (error: unknown) {
        // For GET requests: serve from IndexedDB cache
        if (canUseOfflineCache && typeof window !== 'undefined') {
            try {
                const cachedData = await idbGet<T>(cacheKey);
                if (cachedData !== undefined) {
                    console.info(`[Offline] Serving ${endpoint} from cache`);
                    return cachedData;
                }
            } catch (idbErr) {
                console.error('Failed to read from cache', idbErr);
            }
        }

        // For mutation requests: queue for retry when online
        if (!isGet && typeof window !== 'undefined' && !navigator.onLine) {
            const bodyStr = typeof rest.body === 'string' ? rest.body : undefined;
            // Only queue JSON mutations (not file uploads)
            if (bodyStr !== undefined || !rest.body) {
                await enqueueMutation({
                    endpoint,
                    method: rest.method || 'POST',
                    body: bodyStr,
                }).catch((e) => console.warn('Failed to queue mutation:', e));
            }
        }

        if (error instanceof ApiRequestError) {
            throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new ApiNetworkError('Request timed out');
        }

        if (error instanceof Error) {
            throw new ApiNetworkError(error.message || 'Unable to reach the server');
        }

        throw new ApiNetworkError();
    }
}

async function requestText(endpoint: string, options: RequestOptions = {}): Promise<string> {
    const { token, signal, ...rest } = options;
    const headers: HeadersInit = {
        ...(rest.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> ?? {}),
    };

    try {
        const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
            ...rest,
            credentials: 'include',
            headers,
            signal,
        });

        if (response.status === 401 && unauthorizedHandler) {
            unauthorizedHandler(token);
        }

        if (!response.ok) {
            let message = `Request failed with status ${response.status}`;
            let code: string | undefined;
            let field: string | undefined;
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const data = await response.json();
                const parsed = parseApiErrorData(data, message);
                message = parsed.message;
                code = parsed.code;
                field = parsed.field;
            } else {
                const text = await response.text();
                if (text && text.length < 200) message = text;
            }
            maybeEmitProfanityWarning({ code, field, message });
            throw new ApiRequestError(message, response.status, { code, field });
        }

        return response.text();
    } catch (error: unknown) {
        if (error instanceof ApiRequestError) throw error;
        if (error instanceof Error) {
            throw new ApiNetworkError(error.message || 'Unable to reach the server');
        }
        throw new ApiNetworkError();
    }
}

async function streamAiChat(
    data: AIChatRequest,
    token: string,
    handlers: AIChatStreamHandlers,
    signal?: AbortSignal,
) {
    const response = await fetch(`${getApiBaseUrl()}/ai/copilot/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal,
    });

    if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler(token);
    }

    if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        let code: string | undefined;
        let field: string | undefined;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            const parsed = parseApiErrorData(await response.json(), message);
            message = parsed.message;
            code = parsed.code;
            field = parsed.field;
        } else {
            const text = await response.text();
            if (text && text.length < 200) message = text;
        }
        maybeEmitProfanityWarning({ code, field, message });
        throw new ApiRequestError(message, response.status, { code, field });
    }

    if (!response.body) {
        throw new ApiNetworkError('EduVerse Copilot stream did not return a response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = consumeSseBuffer(buffer, handlers);
    }

    buffer += decoder.decode();
    consumeSseBuffer(`${buffer}\n\n`, handlers);
}

function consumeSseBuffer(buffer: string, handlers: AIChatStreamHandlers) {
    let cursor = buffer.indexOf('\n\n');

    while (cursor >= 0) {
        const block = buffer.slice(0, cursor).trim();
        buffer = buffer.slice(cursor + 2);
        if (block) consumeSseBlock(block, handlers);
        cursor = buffer.indexOf('\n\n');
    }

    return buffer;
}

function consumeSseBlock(block: string, handlers: AIChatStreamHandlers) {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trimStart());
        }
    }

    if (dataLines.length === 0) return;
    const parsed = JSON.parse(dataLines.join('\n')) as AIChatStreamEvent;
    handlers.onEvent(parsed);

    if (eventName === 'error' || parsed.type === 'error') {
        throw new ApiRequestError(
            parsed.type === 'error' ? parsed.message : 'EduVerse Copilot stream failed.',
            200,
            { code: parsed.type === 'error' ? parsed.code : undefined },
        );
    }
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
        getGoogleLoginUrl: (params: Partial<LoginRequest> & { returnTo?: string } = {}) => {
            const query = buildQueryString({
                rememberMe: params.rememberMe,
                deviceId: params.deviceId,
                deviceName: params.deviceName,
                deviceType: params.deviceType,
                browser: params.browser,
                os: params.os,
                returnTo: params.returnTo,
            });
            return `${getApiBaseUrl()}/auth/google/login${query}`;
        },
        getGoogleLinkUrl: () =>
            `${getApiBaseUrl()}/auth/google/link`,
        session: (options: Pick<RequestOptions, 'signal'> = {}) =>
            request<AuthResponse | null>('/auth/session', options),
        forgotPassword: (email: string) =>
            request<MessageResponse>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
        resetPassword: (token: string, password: string) =>
            request<MessageResponse>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
        generatePasswordResetLink: (userId: string, token: string) =>
            request<PasswordResetLinkResponse>(`/auth/users/${userId}/password-reset-link`, { method: 'POST', token }),
        resendContactEmailVerification: (token: string) =>
            request<MessageResponse>('/auth/contact-email/resend-verification', { method: 'POST', token }),
        verifyContactEmail: (code: string, token: string) =>
            request<MessageResponse>('/auth/contact-email/verify', { method: 'POST', body: JSON.stringify({ code }), token }),
        logout: (token?: string) =>
            request<void>('/auth/logout', { method: 'POST', token }).catch(e => console.warn('Logout failed', e)),
        changePassword: (oldPassword: string, newPassword: string, token: string) =>
            request<{ access_token: string, role: string }>('/auth/change-password', {
                method: 'POST', body: JSON.stringify({ oldPassword, newPassword }), token
            }),
        updateProfile: (data: Partial<{ themeMode?: ThemeMode; name?: string }>, token: string) =>
            request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data), token }),
        getLinkedAccounts: (token: string) =>
            request<LinkedAccount[]>('/auth/linked-accounts/me', { token }),
        unlinkGoogle: (token: string) =>
            request<MessageResponse>('/auth/linked-accounts/google', { method: 'DELETE', token }),
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
        getAuditLogs: (token: string, params: { page?: number, limit?: number, search?: string, action?: string } = {}) =>
            request<PaginatedResponse<AuditLogItem> & { counts?: Record<string, number> }>(`/admin/audit-logs${buildQueryString(params)}`, { token }),
        createPlatformAdmin: (data: Partial<PlatformAdmin> & { password?: string }, token: string) =>
            request<PlatformAdmin>('/admin/platform-admins', { method: 'POST', body: JSON.stringify(data), token }),
        updatePlatformAdmin: (id: string, data: Partial<PlatformAdmin>, token: string) =>
            request<PlatformAdmin>(`/admin/platform-admins/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deletePlatformAdmin: (id: string, token: string) =>
            request<void>(`/admin/platform-admins/${id}`, { method: 'DELETE', token }),
    },

    ai: {
        getEntitlement: (token: string) =>
            request<AIEntitlementResponse>('/ai/entitlement', { token }),
        chat: (data: AIChatRequest, token: string, signal?: AbortSignal) =>
            request<AIChatResponse>('/ai/copilot/chat', { method: 'POST', body: JSON.stringify(data), token, signal }),
        streamChat: (data: AIChatRequest, token: string, handlers: AIChatStreamHandlers, signal?: AbortSignal) =>
            streamAiChat(data, token, handlers, signal),
        getSuggestedQuestions: (token: string) =>
            request<AISuggestedQuestionsResponse>('/ai/copilot/suggestions', { token }),
        getConversations: (token: string) =>
            request<AIConversationSummary[]>('/ai/copilot/conversations', { token }),
        getConversation: (id: string, token: string) =>
            request<AIConversationDetail>(`/ai/copilot/conversations/${id}`, { token }),
        updateConversationTitle: (id: string, title: string, token: string) =>
            request<AIConversationSummary>(`/ai/copilot/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }), token }),
        deleteConversation: (id: string, token: string) =>
            request<{ deleted: boolean }>(`/ai/copilot/conversations/${id}`, { method: 'DELETE', token }),
        getOrgSettings: (token: string) =>
            request<AIOrgSettingsResponse>('/ai/org/settings', { token }),
        updateOrgSubscription: (plan: AISubscriptionPlan, token: string) =>
            request<AIOrgSettingsResponse>('/ai/org/subscription', { method: 'PATCH', body: JSON.stringify({ plan }), token }),
        createOrgBillingCheckout: (plan: AISubscriptionPlan, token: string) =>
            request<{ checkoutUrl: string | null; sessionId: string }>('/ai/org/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }), token }),
        updateOrgAccessPolicy: (data: Partial<AIOrgSettingsResponse['accessPolicy']>, token: string) =>
            request<AIOrgSettingsResponse>('/ai/org/access-policy', { method: 'PATCH', body: JSON.stringify(data), token }),
        updateRoleCreditPolicy: (role: Role, monthlyCredits: number, token: string) =>
            request<AIOrgSettingsResponse>('/ai/org/role-credit-policy', { method: 'PATCH', body: JSON.stringify({ role, monthlyCredits }), token }),
        getOrgUsage: (token: string) =>
            request<AIOrgUsageResponse>('/ai/org/usage', { token }),
        getPersonalSubscription: (token: string) =>
            request<AIPersonalSettingsResponse>('/ai/personal/subscription', { token }),
        updatePersonalSubscription: (plan: AISubscriptionPlan, token: string) =>
            request<AIPersonalSettingsResponse>('/ai/personal/subscription', { method: 'PATCH', body: JSON.stringify({ plan }), token }),
        createPersonalBillingCheckout: (plan: AISubscriptionPlan, token: string) =>
            request<{ checkoutUrl: string | null; sessionId: string }>('/ai/personal/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }), token }),
        createBillingPortal: (ownerType: AISubscriptionOwnerType, token: string, returnPath = '/ai') =>
            request<{ portalUrl: string }>('/ai/billing/portal', { method: 'POST', body: JSON.stringify({ ownerType, returnPath }), token }),
        getPersonalUsage: (token: string) =>
            request<AIPersonalUsageResponse>('/ai/personal/usage', { token }),
        searchDocs: (query: string, token: string, limit = 5) =>
            request<{ results: AIDocsSearchResult[] }>(`/ai/docs/search${buildQueryString({ q: query, limit })}`, { token }),
        searchRoutes: (query: string, token: string, limit = 5) =>
            request<{ results: AIRouteSearchResult[] }>(`/ai/routes/search${buildQueryString({ q: query, limit })}`, { token }),
    },

    org: {
        getOrgData: (token: string) =>
            request<Organization>('/org/settings', { token }),
        getUserCounts: (token: string) =>
            request<OrgUserCounts>('/org/users/counts', { token }),
        getPublicProfile: (userId: string, token: string) =>
            request<PublicProfile>(`/org/public-profiles/${userId}`, { token }),
        updateSettings: (data: UpdateOrgSettingsRequest, token: string) =>
            request<Organization>('/org/settings', { method: 'PATCH', body: JSON.stringify(data), token }),
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
        getTeachers: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, deleted?: boolean, departmentId?: string } = {}) =>
            request<PaginatedResponse<Teacher>>(`/org/teachers${buildQueryString(params)}`, { token }),
        createTeacher: (data: CreateTeacherRequest, token: string) =>
            request<Teacher>('/org/teachers', { method: 'POST', body: JSON.stringify(data), token }),
        updateTeacher: (id: string, data: UpdateTeacherRequest, token: string) =>
            request<Teacher>(`/org/teachers/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        restoreTeacher: (id: string, status: string, token: string) =>
            request<{ message: string }>(`/org/teachers/${id}/restore`, { method: 'PATCH', body: JSON.stringify({ status }), token }),
        deleteTeacher: (id: string, token: string) =>
            request<void>(`/org/teachers/${id}`, { method: 'DELETE', token }),
        getManagers: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, deleted?: boolean, departmentId?: string } = {}) =>
            request<PaginatedResponse<Teacher>>(`/org/managers${buildQueryString(params)}`, { token }),

        getSubAdmins: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, deleted?: boolean } = {}) =>
            request<PaginatedResponse<User>>(`/org/sub-admins${buildQueryString(params)}`, { token }),
        getSubAdmin: (id: string, token: string) =>
            request<User>(`/org/sub-admins/${id}`, { token }),
        createSubAdmin: (data: CreateSubAdminRequest, token: string) =>
            request<User>('/org/sub-admins', { method: 'POST', body: JSON.stringify(data), token }),
        updateSubAdmin: (id: string, data: UpdateSubAdminRequest, token: string) =>
            request<User>(`/org/sub-admins/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        restoreSubAdmin: (id: string, status: string, token: string) =>
            request<{ message: string }>(`/org/sub-admins/${id}/restore`, { method: 'PATCH', body: JSON.stringify({ status }), token }),
        deleteSubAdmin: (id: string, token: string) =>
            request<void>(`/org/sub-admins/${id}`, { method: 'DELETE', token }),

        getFinanceManagers: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, deleted?: boolean } = {}) =>
            request<PaginatedResponse<User>>(`/org/finance-managers${buildQueryString(params)}`, { token }),
        getFinanceManager: (id: string, token: string) =>
            request<User>(`/org/finance-managers/${id}`, { token }),
        getFinanceManagerProfile: (token: string) =>
            request<User>('/org/finance-managers/me/profile', { token }),
        updateFinanceManagerProfile: (data: Partial<Pick<User, 'name' | 'phone'>> & { password?: string }, token: string) =>
            request<User>('/org/finance-managers/me/profile', { method: 'PATCH', body: JSON.stringify(data), token }),
        createFinanceManager: (data: CreateFinanceManagerRequest, token: string) =>
            request<User>('/org/finance-managers', { method: 'POST', body: JSON.stringify(data), token }),
        updateFinanceManager: (id: string, data: UpdateFinanceManagerRequest, token: string) =>
            request<User>(`/org/finance-managers/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        restoreFinanceManager: (id: string, status: string, token: string) =>
            request<{ message: string }>(`/org/finance-managers/${id}/restore`, { method: 'PATCH', body: JSON.stringify({ status }), token }),
        deleteFinanceManager: (id: string, token: string) =>
            request<void>(`/org/finance-managers/${id}`, { method: 'DELETE', token }),

        getStudent: (id: string, token: string) =>
            request<Student>(`/org/students/${id}`, { token }),
        getStudentByUserId: (userId: string, token: string) =>
            request<Student>(`/org/students/by-user/${userId}`, { token }),
        getStudents: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', my?: boolean, sectionId?: string, status?: string, deleted?: boolean, cohortId?: string, departmentId?: string } = {}) =>
            request<PaginatedResponse<Student>>(`/org/students${buildQueryString(params)}`, { token }),
        createStudent: (data: CreateStudentRequest, token: string) =>
            request<Student>('/org/students', { method: 'POST', body: JSON.stringify(data), token }),
        updateStudent: (id: string, data: UpdateStudentRequest, token: string) =>
            request<Student>(`/org/students/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getEnrollments: (token: string, params: { studentId?: string, sectionId?: string, academicCycleId?: string } = {}) =>
            request<Enrollment[]>(`/org/enrollments${buildQueryString(params)}`, { token }),
        enrollStudentInSection: (studentId: string, sectionId: string, token: string) =>
            request<EnrollmentMutationResponse>('/org/enrollments', { method: 'POST', body: JSON.stringify({ studentId, sectionId }), token }),
        bulkEnrollStudentsInSection: (sectionId: string, studentIds: string[], token: string) =>
            request<EnrollmentMutationResponse>('/org/enrollments/bulk', { method: 'POST', body: JSON.stringify({ sectionId, studentIds }), token }),
        withdrawStudentFromSection: (studentId: string, sectionId: string, token: string) =>
            request<EnrollmentMutationResponse>('/org/enrollments/withdraw', { method: 'POST', body: JSON.stringify({ studentId, sectionId }), token }),
        transferStudentEnrollment: (studentId: string, fromSectionId: string, toSectionId: string, token: string) =>
            request<EnrollmentMutationResponse>('/org/enrollments/transfer', { method: 'POST', body: JSON.stringify({ studentId, fromSectionId, toSectionId }), token }),
        restoreStudent: (id: string, status: string, token: string) =>
            request<{ message: string }>(`/org/students/${id}/restore`, { method: 'PATCH', body: JSON.stringify({ status }), token }),
        deleteStudent: (id: string, token: string) =>
            request<void>(`/org/students/${id}`, { method: 'DELETE', token }),

        getGuardians: (token: string, params: { search?: string } = {}) =>
            request<GuardianProfile[]>(`/org/guardians${buildQueryString(params)}`, { token }),
        getGuardian: (id: string, token: string) =>
            request<GuardianProfile>(`/org/guardians/${id}`, { token }),
        createGuardian: (data: CreateGuardianRequest, token: string) =>
            request<GuardianProfile>('/org/guardians', { method: 'POST', body: JSON.stringify(data), token }),
        updateGuardian: (id: string, data: UpdateGuardianRequest, token: string) =>
            request<GuardianProfile>(`/org/guardians/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getMyGuardianProfile: (token: string) =>
            request<GuardianProfile>('/org/guardians/me/profile', { token }),
        getGuardianOverview: (token: string, studentId?: string) =>
            request<GuardianOverview>(`/org/guardians/me/overview${buildQueryString({ studentId })}`, { token }),

        getSection: (id: string, token: string) =>
            request<Section>(`/org/sections/${id}`, { token }),
        getSections: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', my?: boolean, userId?: string, academicCycleId?: string, cohortId?: string, teacherId?: string, departmentId?: string, activeAcademicCycleOnly?: boolean } = {}) =>
            request<PaginatedResponse<Section>>(`/org/sections${buildQueryString(params)}`, { token }),
        createSection: (data: CreateSectionRequest, token: string) =>
            request<Section>('/org/sections', { method: 'POST', body: JSON.stringify(data), token }),
        updateSection: (id: string, data: UpdateSectionRequest, token: string) =>
            request<Section>(`/org/sections/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteSection: (id: string, token: string) =>
            request<void>(`/org/sections/${id}`, { method: 'DELETE', token }),

        getCourses: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', my?: boolean, departmentId?: string } = {}) =>
            request<PaginatedResponse<Course>>(`/org/courses${buildQueryString(params)}`, { token }),
        createCourse: (data: CreateCourseRequest, token: string) =>
            request<Course>('/org/courses', { method: 'POST', body: JSON.stringify(data), token }),
        updateCourse: (id: string, data: UpdateCourseRequest, token: string) =>
            request<Course>(`/org/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteCourse: (id: string, token: string) =>
            request<void>(`/org/courses/${id}`, { method: 'DELETE', token }),

        getDepartments: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', isActive?: boolean } = {}) =>
            request<PaginatedResponse<Department>>(`/org/departments${buildQueryString(params)}`, { token }),
        getDepartment: (id: string, token: string) =>
            request<Department>(`/org/departments/${id}`, { token }),
        createDepartment: (data: CreateDepartmentRequest, token: string) =>
            request<Department>('/org/departments', { method: 'POST', body: JSON.stringify(data), token }),
        updateDepartment: (id: string, data: UpdateDepartmentRequest, token: string) =>
            request<Department>(`/org/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        setDepartmentActive: (id: string, isActive: boolean, token: string) =>
            request<Department>(`/org/departments/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),

        getBuildings: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', isActive?: boolean, departmentId?: string } = {}) =>
            request<PaginatedResponse<Building>>(`/org/buildings${buildQueryString(params)}`, { token }),
        getBuilding: (id: string, token: string) =>
            request<Building>(`/org/buildings/${id}`, { token }),
        createBuilding: (data: CreateBuildingRequest, token: string) =>
            request<Building>('/org/buildings', { method: 'POST', body: JSON.stringify(data), token }),
        updateBuilding: (id: string, data: UpdateBuildingRequest, token: string) =>
            request<Building>(`/org/buildings/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        uploadBuildingImage: (id: string, file: File, token: string): Promise<Building> => {
            const formData = new FormData();
            formData.append('file', file);
            return uploadFormData(`/org/buildings/${id}/image`, formData, token, 'PATCH');
        },
        setBuildingActive: (id: string, isActive: boolean, token: string) =>
            request<Building>(`/org/buildings/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),
        assignBuildingDepartments: (id: string, departmentIds: string[], token: string) =>
            request<Building>(`/org/buildings/${id}/departments`, { method: 'POST', body: JSON.stringify({ departmentIds }), token }),
        removeBuildingDepartment: (id: string, departmentId: string, token: string) =>
            request<Building>(`/org/buildings/${id}/departments/${departmentId}`, { method: 'DELETE', token }),

        getRooms: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', isActive?: boolean, buildingId?: string, departmentId?: string, type?: RoomType } = {}) =>
            request<PaginatedResponse<Room>>(`/org/rooms${buildQueryString(params)}`, { token }),
        getRoom: (id: string, token: string) =>
            request<Room>(`/org/rooms/${id}`, { token }),
        createRoom: (data: CreateRoomRequest, token: string) =>
            request<Room>('/org/rooms', { method: 'POST', body: JSON.stringify(data), token }),
        updateRoom: (id: string, data: UpdateRoomRequest, token: string) =>
            request<Room>(`/org/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        uploadRoomImage: (id: string, file: File, token: string): Promise<Room> => {
            const formData = new FormData();
            formData.append('file', file);
            return uploadFormData(`/org/rooms/${id}/image`, formData, token, 'PATCH');
        },
        setRoomActive: (id: string, isActive: boolean, token: string) =>
            request<Room>(`/org/rooms/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),
        getCampusNavigation: (token: string, params: { q?: string, roomId?: string, buildingCode?: string, departmentCode?: string, floor?: string, roomType?: RoomType | '' } = {}) =>
            request<CampusNavigationResponse>(`/org/campus-navigation${buildQueryString(params)}`, { token }),
        getCampusNavigationRoom: (token: string, roomId: string) =>
            request<CampusNavigationRoomSelection>(`/org/campus-navigation/rooms/${roomId}`, { token }),
        getCampusNavigationBuildingRooms: (token: string, buildingId: string, params: { q?: string, floor?: string, roomType?: RoomType | '' } = {}) =>
            request<CampusNavigationBuildingRoomsResponse>(`/org/campus-navigation/buildings/${buildingId}/rooms${buildQueryString(params)}`, { token }),

        // FIX 3 applied: was duplicating raw fetch + 401 handling
        uploadAvatar: (userId: string, file: File, token: string): Promise<{ avatarUrl: string; avatarUpdatedAt: string }> => {
            const formData = new FormData();
            formData.append('file', file);
            return uploadFormData(`/org/users/${userId}/avatar`, formData, token, 'PATCH');
        },

        // --- Assessments ---
        getAssessments: (token: string, params: { sectionId?: string, courseId?: string, academicCycleId?: string } = {}) =>
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
        getSectionGradebook: (sectionId: string, token: string) =>
            request<SectionGradebookResponse>(`/org/sections/${sectionId}/gradebook`, { token }),
        updateGrade: (assessmentId: string, studentId: string, data: UpdateGradeRequest, token: string) =>
            request<Grade>(`/org/assessments/${assessmentId}/grades/${studentId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getOwnFinalGrades: (token: string) =>
            request<FinalGradeResponse[]>('/org/grades/final', { token }),
        getOwnReleasedGrades: (token: string) =>
            request<FinalGradeResponse[]>('/org/grades/released', { token }),
        publishGrades: (assessmentId: string, token: string) =>
            request<void>(`/org/assessments/${assessmentId}/publish`, { method: 'PATCH', token }),
        finalizeGrades: (assessmentId: string, token: string) =>
            request<void>(`/org/assessments/${assessmentId}/finalize`, { method: 'PATCH', token }),
        getGradeFinalization: (token: string, params: GradeFinalizationFilters = {}) => {
            const queryParams: QueryParams = { ...params };
            return request<GradeFinalizationRow[]>(`/org/grade-finalization${buildQueryString(queryParams)}`, { token });
        },

        // --- Submissions ---
        getSubmissions: (assessmentId: string, token: string) =>
            request<Submission[]>(`/org/assessments/${assessmentId}/submissions`, { token }),
        createSubmission: (assessmentId: string, data: CreateSubmissionRequest, token: string) =>
            request<Submission>(`/org/assessments/${assessmentId}/submissions`, { method: 'POST', body: JSON.stringify(data), token }),

        // --- Final Results ---
        getStudentFinalGrades: (studentId: string, token: string, sectionId?: string) =>
            request<FinalGradeResponse[]>(`/org/students/${studentId}/final-grades${buildQueryString({ sectionId })}`, { token }),
        getStudentReleasedGrades: (studentId: string, token: string, sectionId?: string) =>
            request<FinalGradeResponse[]>(`/org/students/${studentId}/released-grades${buildQueryString({ sectionId })}`, { token }),
        getProfile: <T = Student | Teacher | User>(token: string) =>
            request<T>('/org/profile', { token }),
        updateProfile: <T = Student | Teacher | User>(data: UpdateStudentRequest | UpdateTeacherRequest | (Partial<Pick<User, 'name' | 'phone'>> & { password?: string }), token: string) =>
            request<T>('/org/profile', { method: 'PATCH', body: JSON.stringify(data), token }),
        getInsights: (token: string, params: InsightsQueryParams = {}) =>
            request<DashboardInsights>(`/org/insights${buildQueryString(params as QueryParams)}`, { token }),

        // --- Holidays / Academic Calendar ---
        getHolidays: (token: string, params: { page?: number, limit?: number, search?: string, type?: HolidayType, isActive?: boolean, startDate?: string, endDate?: string, departmentId?: string } = {}) =>
            request<PaginatedResponse<Holiday>>(`/org/holidays${buildQueryString(params)}`, { token }),
        createHoliday: (data: CreateHolidayRequest, token: string) =>
            request<Holiday>('/org/holidays', { method: 'POST', body: JSON.stringify(data), token }),
        updateHoliday: (id: string, data: UpdateHolidayRequest, token: string) =>
            request<Holiday>(`/org/holidays/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        setHolidayActive: (id: string, isActive: boolean, token: string) =>
            request<Holiday>(`/org/holidays/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),
        deleteHoliday: (id: string, token: string) =>
            request<void>(`/org/holidays/${id}`, { method: 'DELETE', token }),

        // --- Evaluations & Feedback ---
        getEvaluationPending: (token: string) =>
            request<EvaluationPendingResponse>('/org/evaluations/pending', { token }),
        createEvaluation: (data: CreateEvaluationRequest, token: string) =>
            request<Evaluation>('/org/evaluations', { method: 'POST', body: JSON.stringify(data), token }),
        updateEvaluation: (id: string, data: UpdateEvaluationRequest, token: string) =>
            request<Evaluation>(`/org/evaluations/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getTeacherFeedback: (token: string, params: { academicCycleId?: string, courseId?: string, sectionId?: string, rating?: number } = {}) =>
            request<EvaluationSummary>(`/org/evaluations/teacher/me${buildQueryString(params)}`, { token }),
        getTeacherEvaluationSummary: (teacherId: string, token: string, params: { academicCycleId?: string, courseId?: string, sectionId?: string, rating?: number } = {}) =>
            request<EvaluationSummary>(`/org/evaluations/teacher/${teacherId}/summary${buildQueryString(params)}`, { token }),
        getCourseEvaluationSummary: (courseId: string, token: string, params: { academicCycleId?: string, sectionId?: string, rating?: number } = {}) =>
            request<EvaluationSummary>(`/org/evaluations/course/${courseId}/summary${buildQueryString(params)}`, { token }),
        getEvaluations: (token: string, params: { page?: number, limit?: number, type?: EvaluationType, academicCycleId?: string, courseId?: string, sectionId?: string, teacherId?: string, rating?: number, ratingMin?: number, ratingMax?: number, hasFeedback?: boolean, isHidden?: boolean } = {}) =>
            request<PaginatedResponse<Evaluation>>(`/org/evaluations${buildQueryString(params)}`, { token }),
        setEvaluationVisibility: (id: string, data: { isHidden: boolean, hiddenReason?: string }, token: string) =>
            request<Evaluation>(`/org/evaluations/${id}/visibility`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getEvaluationWindows: (token: string, params: { academicCycleId?: string, isActive?: boolean } = {}) =>
            request<EvaluationWindow[]>(`/org/evaluations/windows${buildQueryString(params)}`, { token }),
        createEvaluationWindow: (data: CreateEvaluationWindowRequest, token: string) =>
            request<EvaluationWindow>('/org/evaluations/windows', { method: 'POST', body: JSON.stringify(data), token }),
        createEvaluationWindowsBulk: (data: BulkCreateEvaluationWindowsRequest, token: string) =>
            request<BulkCreateEvaluationWindowsResponse>('/org/evaluations/windows/bulk', { method: 'POST', body: JSON.stringify(data), token }),
        updateEvaluationWindow: (id: string, data: UpdateEvaluationWindowRequest, token: string) =>
            request<EvaluationWindow>(`/org/evaluations/windows/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),

        // --- Preference Windows ---
        getPreferenceWindows: (token: string, params: { page?: number, limit?: number, status?: string, kind?: string, academicCycleId?: string, courseId?: string, cohortId?: string } = {}) =>
            request<PaginatedResponse<PreferenceWindow>>(`/org/preference-windows${buildQueryString(params)}`, { token }),
        getPreferenceWindow: (id: string, token: string) =>
            request<PreferenceWindow>(`/org/preference-windows/${id}`, { token }),
        createPreferenceWindow: (data: PreferenceWindowRequest, token: string) =>
            request<PreferenceWindow>('/org/preference-windows', { method: 'POST', body: JSON.stringify(data), token }),
        updatePreferenceWindow: (id: string, data: PreferenceWindowRequest, token: string) =>
            request<PreferenceWindow>(`/org/preference-windows/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        activatePreferenceWindow: (id: string, token: string, priority?: AnnouncementPriority) =>
            request<PreferenceWindow>(`/org/preference-windows/${id}/activate`, { method: 'POST', body: JSON.stringify({ priority }), token }),
        closePreferenceWindow: (id: string, token: string) =>
            request<PreferenceWindow>(`/org/preference-windows/${id}/close`, { method: 'POST', token }),
        getPreferenceWindowResults: (id: string, token: string) =>
            request<PreferenceResults>(`/org/preference-windows/${id}/results`, { token }),
        getMyPreferenceWindows: (token: string) =>
            request<PreferenceWindow[]>('/org/preference-windows/my', { token }),
        getStudentPreferenceWindow: (id: string, token: string) =>
            request<PreferenceWindow>(`/org/preference-windows/${id}/student`, { token }),
        submitPreferenceWindow: (id: string, rankedOptionIds: string[], token: string) =>
            request<PreferenceSubmission>(`/org/preference-windows/${id}/submission`, { method: 'PUT', body: JSON.stringify({ rankedOptionIds }), token }),

        // --- GPA Policies ---
        getGpaPolicies: (token: string, params: { includeArchived?: boolean } = {}) =>
            request<GpaPolicy[]>(`/org/gpa-policies${buildQueryString(params)}`, { token }),
        createGpaPolicy: (data: CreateGpaPolicyRequest, token: string) =>
            request<GpaPolicy>('/org/gpa-policies', { method: 'POST', body: JSON.stringify(data), token }),
        updateGpaPolicy: (id: string, data: UpdateGpaPolicyRequest, token: string) =>
            request<GpaPolicy>(`/org/gpa-policies/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteGpaPolicy: (id: string, token: string) =>
            request<void>(`/org/gpa-policies/${id}`, { method: 'DELETE', token }),
        setDefaultGpaPolicy: (id: string, token: string) =>
            request<GpaPolicy>(`/org/gpa-policies/${id}/default`, { method: 'PATCH', token }),
        previewGpaPolicy: (data: GpaPolicyPreviewRequest, token: string) =>
            request<GpaPolicyPreviewResponse>('/org/gpa-policies/preview', { method: 'POST', body: JSON.stringify(data), token }),

        // --- Timetable & Attendance ---
        createSchedule: (id: string, data: { day?: number, date?: string | null, type?: string, startTime: string, endTime: string, room?: string, roomId?: string | null, teacherId?: string }, token: string) =>
            request<SectionSchedule>(`/org/sections/${id}/schedules`, { method: 'POST', body: JSON.stringify(data), token }),
        getSchedules: (id: string, token: string) =>
            request<SectionSchedule[]>(`/org/sections/${id}/schedules`, { token }),
        updateSchedule: (sectionId: string, scheduleId: string, data: Partial<{ day?: number, date?: string | null, type?: string, startTime: string, endTime: string, room?: string, roomId?: string | null, teacherId?: string }>, token: string) =>
            request<SectionSchedule>(`/org/sections/${sectionId}/schedules/${scheduleId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        deleteSchedule: (sectionId: string, scheduleId: string, token: string) =>
            request<void>(`/org/sections/${sectionId}/schedules/${scheduleId}`, { method: 'DELETE', token }),
        getTimetableTeachers: (token: string, params: { search?: string, limit?: number } = {}) =>
            request<Teacher[]>(`/org/timetable/teachers${buildQueryString(params)}`, { token }),
        getTimetableStudents: (token: string, params: { search?: string, limit?: number } = {}) =>
            request<Student[]>(`/org/timetable/students${buildQueryString(params)}`, { token }),
        getTimetable: (token: string, params: { studentId?: string, teacherId?: string, roomId?: string, date?: string, startDate?: string, endDate?: string } = {}) =>
            request<TimetableResponse>(`/org/timetable${buildQueryString(params)}`, { token }),

        createAttendanceSession: (sectionId: string, date: string, token: string, scheduleId: string) =>
            request<{ id: string }>(`/org/sections/${sectionId}/attendance/sessions`, { method: 'POST', body: JSON.stringify({ date, scheduleId }), token }),
        markAttendance: (sessionId: string, records: { studentId: string, status: string }[], token: string) =>
            request<AttendanceRecord[]>(`/org/attendance/${sessionId}`, { method: 'POST', body: JSON.stringify(records), token }),
        getSectionAttendance: (sectionId: string, date: string, token: string, scheduleId?: string, studentId?: string) =>
            request<SectionAttendanceResponse>(`/org/sections/${sectionId}/attendance${buildQueryString({ date, scheduleId, studentId })}`, { token }),
        getSectionAttendanceRange: (sectionId: string, start: string, end: string, token: string, studentId?: string) =>
            request<RangeAttendanceResponse>(`/org/sections/${sectionId}/attendance/range${buildQueryString({ start, end, studentId })}`, { token }),
        getStudentAttendance: (studentId: string, token: string) =>
            request<AttendanceRecord[]>(`/org/students/${studentId}/attendance`, { token }),
    },

    imports: {
        getTemplate: (entity: ImportEntity, token: string) =>
            requestText(`/org/imports/${entity}/template`, { token }),
        getStructure: (entity: ImportEntity, token: string) =>
            requestText(`/org/imports/${entity}/structure`, { token }),
        validate: (entity: ImportEntity, file: File, token: string) => {
            const formData = new FormData();
            formData.append('file', file);
            return uploadFormData<ImportValidationResult>(`/org/imports/${entity}/validate`, formData, token);
        },
        confirm: (entity: ImportEntity, rows: ImportPreviewRow[], token: string) =>
            request<ImportConfirmResult>(`/org/imports/${entity}/confirm`, {
                method: 'POST',
                body: JSON.stringify({ rows }),
                token,
            }),
        getErrorReport: (entity: ImportEntity, rows: InvalidImportRow[], token: string) =>
            requestText(`/org/imports/${entity}/error-report`, {
                method: 'POST',
                body: JSON.stringify({ rows }),
                token,
            }),
        getAttendanceMonthlyTemplate: (options: Pick<AttendanceMonthlyImportOptions, 'sectionId' | 'year' | 'month'>, token: string) =>
            requestText(`/org/imports/attendance/monthly/template${buildQueryString(options)}`, { token }),
        validateAttendanceMonthly: (options: AttendanceMonthlyImportOptions, file: File, token: string) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sectionId', options.sectionId);
            formData.append('year', String(options.year));
            formData.append('month', String(options.month));
            formData.append('targetMode', options.targetMode);
            return uploadFormData<ImportValidationResult>('/org/imports/attendance/monthly/validate', formData, token);
        },
        confirmAttendanceMonthly: (options: AttendanceMonthlyImportOptions, rows: ImportPreviewRow[], token: string) =>
            request<ImportConfirmResult>('/org/imports/attendance/monthly/confirm', {
                method: 'POST',
                body: JSON.stringify({ ...options, rows }),
                token,
            }),
        getAttendanceMonthlyErrorReport: (year: number, month: number, rows: InvalidImportRow[], token: string) =>
            requestText('/org/imports/attendance/monthly/error-report', {
                method: 'POST',
                body: JSON.stringify({ year, month, rows }),
                token,
            }),
    },

    files: {
        // FIX 3 applied: was duplicating raw fetch + 401 handling + error parsing
        uploadFile: (orgId: string, entityType: string, entityId: string, file: File, token: string): Promise<{ id?: string; url?: string; path?: string; filename?: string; mimeType?: string; size?: number; uploadedBy?: string }> => {
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
        getMails: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', status?: string, category?: string, direction?: string } = {}) =>
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
        searchUsers: (token: string, params: { search?: string, role?: string } = {}) =>
            request<ChatSearchUser[]>(`/chat/users${buildQueryString(params)}`, { token }),
        getPresetUsers: (token: string, params: { preset: string, cohortId?: string, departmentId?: string }) =>
            request<ChatSearchUser[]>(`/chat/preset-users${buildQueryString(params)}`, { token }),
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
        getDropdownNotifications: (token: string, params: { readPage?: number, readLimit?: number } = {}) =>
            request<{ data: Notification[]; unreadCount: number; readPage: number; readLimit: number; totalRead: number; hasMoreRead: boolean }>(`/notifications/dropdown${buildQueryString(params)}`, { token }),
        markAsRead: (id: string, token: string) =>
            request<void>(`/notifications/${id}/read`, { method: 'PATCH', token }),
        markAllAsRead: (token: string) =>
            request<void>('/notifications/read-all', { method: 'PATCH', token }),
        deleteNotification: (id: string, token: string) =>
            request<void>(`/notifications/${id}`, { method: 'DELETE', token }),
        clearCategory: (category: 'CHAT' | 'MAIL', token: string) =>
            request<void>(`/notifications/clear-category/${category}`, { method: 'PATCH', token }),
        getPushConfig: (token: string) =>
            request<WebPushConfigResponse>('/notifications/push/config', { token }),
        subscribeToPush: (subscription: WebPushSubscriptionPayload, token: string) =>
            request<void>('/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(subscription), token }),
        unsubscribeFromPush: (endpoint: string, token: string) =>
            request<void>('/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }), token }),
        testPush: (token: string, endpoint?: string) =>
            request<void>('/notifications/push/test', { method: 'POST', body: JSON.stringify({ endpoint }), token }),
    },

    announcements: {
        createAnnouncement: (data: { title: string, body: string, targetType: TargetType, targetId?: string, actionUrl?: string, priority?: AnnouncementPriority }, token: string) =>
            request<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(data), token }),
        getAnnouncements: (token: string, params: { page?: number, limit?: number, unreadSince?: number } = {}) =>
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
        getCohorts: (token: string, params: { page?: number, limit?: number, search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc', academicCycleId?: string, includeAllCycles?: boolean } = {}) =>
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
        preview: (data: CopyForwardDto, token: string) =>
            request<CopyForwardPreview>(`/org/copy-forward/preview`, { method: 'POST', body: JSON.stringify(data), token }),
        execute: (data: CopyForwardDto, token: string) =>
            request<{ message: string; sectionsCopied: number; schedulesCopied: number; assessmentsCopied: number; materialsCopied: number }>(`/org/copy-forward`, { method: 'POST', body: JSON.stringify(data), token }),
    },

    finance: {
        getStructures: (token: string, params: { studentId?: string, teacherId?: string, employeeUserId?: string, targetType?: string, category?: string, billingCycle?: string, assignmentSource?: string, isActive?: string, search?: string } = {}) =>
            request<FinancialStructure[]>(`/finance/structures${buildQueryString(params)}`, { token }),
        getStructuresPage: (token: string, params: { page?: number, limit?: number, studentId?: string, teacherId?: string, employeeUserId?: string, targetType?: string, category?: string, billingCycle?: string, assignmentSource?: string, isActive?: string, search?: string } = {}) =>
            request<PaginatedResponse<FinancialStructure>>(`/finance/structures${buildQueryString(params)}`, { token }),
        createStructure: (data: Partial<FinancialStructure>, token: string) =>
            request<FinancialStructure>('/finance/structures', { method: 'POST', body: JSON.stringify(data), token }),
        updateStructure: (id: string, data: Partial<FinancialStructure>, token: string) =>
            request<{ structure: FinancialStructure, entryUpdateSummary: { updated: number, skipped: number, skippedEntryIds: string[] } }>(`/finance/structures/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
        generateStructureEntries: (id: string, token: string) =>
            request<{ structureId: string, createdCount: number, skippedCount: number, skippedAssignmentIds: string[], entries: FinancialEntry[] }>(`/finance/structures/${id}/generate-entries`, { method: 'POST', token }),
        getEntries: (token: string, params: { studentId?: string, teacherId?: string, employeeUserId?: string, targetType?: string, category?: string, billingCycle?: string, status?: string, search?: string, dueFrom?: string, dueTo?: string } = {}) =>
            request<FinancialEntry[]>(`/finance/entries${buildQueryString(params)}`, { token }),
        getEntriesPage: (token: string, params: { page?: number, limit?: number, studentId?: string, teacherId?: string, employeeUserId?: string, targetType?: string, category?: string, billingCycle?: string, status?: string, search?: string, dueFrom?: string, dueTo?: string } = {}) =>
            request<PaginatedResponse<FinancialEntry>>(`/finance/entries${buildQueryString(params)}`, { token }),
        createManualEntry: (data: Partial<FinancialEntry>, token: string) =>
            request<FinancialEntry>('/finance/entries/manual', { method: 'POST', body: JSON.stringify(data), token }),
        markEntryPaid: (id: string, data: { claimedAmount?: number, paymentMethod?: string, receiptUrl?: string, referenceNumber?: string, note?: string, attachmentIds?: string[] }, token: string) =>
            request<FinancialEntry>(`/finance/entries/${id}/mark-paid`, { method: 'PATCH', body: JSON.stringify(data), token }),
        confirmEntry: (id: string, data: { paidAmount?: number, claimId?: string, attachmentIds?: string[] }, token: string) =>
            request<{ entry: FinancialEntry, transaction: Transaction }>(`/finance/entries/${id}/confirm`, { method: 'PATCH', body: JSON.stringify(data), token }),
        rejectPaymentClaim: (id: string, data: { rejectionReason?: string }, token: string) =>
            request(`/finance/claims/${id}/reject`, { method: 'PATCH', body: JSON.stringify(data), token }),
        cancelEntry: (id: string, data: { reason?: string }, token: string) =>
            request<FinancialEntry>(`/finance/entries/${id}/cancel`, { method: 'PATCH', body: JSON.stringify(data), token }),
        reverseTransaction: (id: string, data: { reason?: string }, token: string) =>
            request<{ entry: FinancialEntry, transaction: Transaction }>(`/finance/transactions/${id}/reverse`, { method: 'PATCH', body: JSON.stringify(data), token }),
        getTransactions: (token: string, params: { studentId?: string, teacherId?: string, employeeUserId?: string, targetType?: string, category?: string, billingCycle?: string, type?: string, paymentMethod?: string, search?: string, dateFrom?: string, dateTo?: string } = {}) =>
            request<Transaction[]>(`/finance/transactions${buildQueryString(params)}`, { token }),
        getTransactionsPage: (token: string, params: { page?: number, limit?: number, studentId?: string, teacherId?: string, employeeUserId?: string, targetType?: string, category?: string, billingCycle?: string, type?: string, paymentMethod?: string, search?: string, dateFrom?: string, dateTo?: string } = {}) =>
            request<PaginatedResponse<Transaction>>(`/finance/transactions${buildQueryString(params)}`, { token }),
        getStats: (token: string) =>
            request<FinanceStats>('/finance/stats', { token }),
        getTeacherOverview: (token: string) =>
            request<TeacherFinanceOverview>('/finance/teacher-overview', { token }),
        getMyPayroll: (token: string) =>
            request<TeacherFinanceOverview>('/finance/my-payroll', { token }),
        getPayroll: (token: string, params: { targetType?: string } = {}) =>
            request<PayrollRosterRow[]>(`/finance/payroll${buildQueryString(params)}`, { token }),
        getAuditLogs: (token: string, params: { page?: number, limit?: number, search?: string, action?: string, resourceType?: string, resourceId?: string, userId?: string } = {}) =>
            request<PaginatedResponse<AuditLogItem> & { counts?: Record<string, number> }>(`/finance/audit-logs${buildQueryString(params)}`, { token }),
        getInsights: (token: string, params: InsightsQueryParams & { currency?: string } = {}) =>
            request<FinanceInsights>(`/finance/insights${buildQueryString(params as QueryParams)}`, { token }),
    }
};
