import type { Role, TeacherStatus, StudentStatus, UserStatus, MailStatus, MailCategory, OrganizationType, OrgStatus, AssessmentType, GradeStatus, GpaCalculationMethod, GpaRounding, ChatType, ChatParticipantRole, ChatMessageType, TargetType, AnnouncementPriority, HolidayType, HolidayMatchMode, EvaluationType, ThemeMode, AttendanceStatus, RoomType, DepartmentScopeType, Tone } from './enums';
export { Role, TeacherStatus, StudentStatus, UserStatus, MailStatus, MailCategory, OrganizationType, OrgStatus, AssessmentType, GradeStatus, GpaCalculationMethod, GpaRounding, ChatType, ChatParticipantRole, ChatMessageType, TargetType, AnnouncementPriority, HolidayType, HolidayMatchMode, EvaluationType, ThemeMode, AttendanceStatus, RoomType, DepartmentScopeType, Tone, UiVariant } from './enums';
export type { BadgeVariant, ButtonVariant, FeedbackVariant, StatToneVariant, StatusBannerVariant, ToastVariant, UiVariant as UiVariantType } from './enums';
import type { CommunicationChannel } from './enums';
export { CommunicationChannel } from './enums';
import type { AISubscriptionPlan, AISubscriptionOwnerType, AISubscriptionStatus, AILimitMode, AIUsageSourceType } from './enums';
export { AISubscriptionPlan, AISubscriptionOwnerType, AISubscriptionStatus, AILimitMode, AIUsageSourceType } from './enums';
import type { PreferenceWindowKind, PreferenceWindowStatus, PreferenceTargetType } from './enums';
export { PreferenceWindowKind, PreferenceWindowStatus, PreferenceTargetType } from './enums';
import type { ScheduleType } from './enums';
export { ScheduleType } from './enums';

export interface PaginatedResponse<T> {
    data: T[];
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    counts?: Record<string, number>;
    hasMoreBefore?: boolean;
    hasMoreAfter?: boolean;
}

export interface User {
    id: string;
    name: string;
    email: string;
    userName: string;
    role: Role;
    status?: UserStatus;
    phone?: string;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    organizationId?: string | null;
    departmentScopeType?: DepartmentScopeType;
    subAdminDepartments?: { department: Department; departmentId: string }[];
    createdAt?: string;
    updatedAt?: string;
}

export interface ChatSearchUser extends User {
    studentProfile?: {
        registrationNumber?: string | null;
        rollNumber?: string | null;
    } | null;
    teacherProfile?: {
        designation?: string | null;
    } | null;
    guardianProfile?: {
        phone?: string | null;
        studentLinks?: {
            relationshipLabel?: string | null;
            student?: {
                registrationNumber?: string | null;
                rollNumber?: string | null;
                user?: {
                    id: string;
                    name?: string | null;
                } | null;
            } | null;
        }[];
    } | null;
}

export interface Teacher {
    id: string;
    education?: string;
    designation?: string;
    subject?: string;
    userId: string;
    department?: string;
    joiningDate?: string;
    emergencyContact?: string;
    bloodGroup?: string;
    address?: string;
    status?: TeacherStatus;
    departmentScopeType?: DepartmentScopeType;
    user: User;
    sections?: Section[];
    teacherDepartments?: { department: Department; departmentId: string }[];
    managerDepartments?: { department: Department; departmentId: string }[];
}

export interface GuardianProfile {
    id: string;
    userId: string;
    organizationId: string;
    phone?: string | null;
    address?: string | null;
    createdAt?: string;
    updatedAt?: string;
    user: User;
    students?: Student[];
    studentLinks?: GuardianStudent[];
}

export interface GuardianStudent {
    id: string;
    guardianId: string;
    studentId: string;
    organizationId: string;
    relationshipLabel: string;
    createdAt?: string;
    updatedAt?: string;
    guardian?: GuardianProfile;
    student?: Student;
}

export interface GuardianAttendanceSummary {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
}

export interface GuardianFinanceSummary {
    totalDue: number;
    totalPaid: number;
    balance: number;
}

export interface GuardianStudentInsight {
    studentId: string;
    studentName: string;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    relationship?: string | null;
    registrationNumber?: string;
    rollNumber?: string;
    status?: StudentStatus | null;
    cohortName?: string | null;
    sections: {
        id: string;
        name: string;
        color?: string | null;
        room?: string | null;
        courseName: string;
        academicCycleName?: string | null;
    }[];
    attendance: GuardianAttendanceSummary & {
        rate: number | null;
        latestStatus?: AttendanceStatus | null;
        latestDate?: string | null;
        latestSectionName?: string | null;
    };
    grades: {
        count: number;
        averagePercentage: number | null;
        latestTitle?: string | null;
        latestCourseName?: string | null;
        latestPercentage?: number | null;
        latestStatus?: GradeStatus | null;
        latestUpdatedAt?: string | null;
    };
    assessments: {
        upcomingCount: number;
        nextTitle?: string | null;
        nextDueDate?: string | null;
        nextCourseName?: string | null;
    };
    timetable: {
        scheduledClasses: number;
        todayCount: number;
        nextClassName?: string | null;
        nextClassDay?: number | null;
        nextClassTime?: string | null;
        nextClassRoom?: string | null;
    };
    finance: GuardianFinanceSummary & {
        overdueAmount: number;
        overdueCount: number;
        pendingCount: number;
    };
    announcementsCount: number;
}

export interface GuardianOverviewTotals {
    linkedStudents: number;
    totalSections: number;
    upcomingAssessments: number;
    todayClasses: number;
    totalBalance: number;
    overdueAmount: number;
    overdueEntries: number;
    averageAttendanceRate: number | null;
}

export interface GuardianOverview {
    guardian: GuardianProfile;
    linkedStudents: Student[];
    selectedStudent: Student | null;
    selectedInsight?: GuardianStudentInsight | null;
    studentInsights: GuardianStudentInsight[];
    overviewTotals: GuardianOverviewTotals;
    attendanceSummary: GuardianAttendanceSummary | null;
    recentAttendance?: AttendanceRecord[];
    recentGrades: Grade[];
    upcomingAssessments: Assessment[];
    upcomingSchedule: SectionSchedule[];
    financeSummary: GuardianFinanceSummary | null;
    recentFinanceEntries: FinancialEntry[];
    recentAnnouncements: Announcement[];
}

export interface Course {
    id: string;
    name: string;
    code: string;
    description?: string;
    creditHours: number;
    updatedBy?: string;
    updatedAt?: string;
    departmentId?: string | null;
    department?: Department | null;
}

export interface Department {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    description?: string | null;
    color?: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    buildings?: Building[];
}

export interface Building {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    address?: string | null;
    description?: string | null;
    landmark?: string | null;
    directionsNote?: string | null;
    sortOrder?: number;
    mapX?: number | null;
    mapY?: number | null;
    mapWidth?: number | null;
    mapHeight?: number | null;
    imageUrl?: string | null;
    imageUpdatedAt?: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    departments?: Department[];
    rooms?: Room[];
    _count?: {
        rooms?: number;
    };
}

export interface Room {
    id: string;
    organizationId: string;
    buildingId: string;
    name: string;
    code: string;
    floor: string;
    type?: RoomType | null;
    capacity?: number | null;
    description?: string | null;
    landmark?: string | null;
    directionsNote?: string | null;
    sortOrder?: number;
    mapX?: number | null;
    mapY?: number | null;
    mapWidth?: number | null;
    mapHeight?: number | null;
    imageUrl?: string | null;
    imageUpdatedAt?: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    building?: Building;
}

export interface CreateDepartmentRequest {
    name: string;
    code: string;
    description?: string | null;
    color?: string | null;
    isActive?: boolean;
}

export type UpdateDepartmentRequest = Partial<CreateDepartmentRequest>;

export interface CreateBuildingRequest {
    name: string;
    code: string;
    address?: string | null;
    description?: string | null;
    landmark?: string | null;
    directionsNote?: string | null;
    sortOrder?: number;
    mapX?: number | null;
    mapY?: number | null;
    mapWidth?: number | null;
    mapHeight?: number | null;
    imageUrl?: string | null;
    isActive?: boolean;
    departmentIds?: string[];
}

export type UpdateBuildingRequest = Partial<CreateBuildingRequest>;

export interface CreateRoomRequest {
    buildingId: string;
    name: string;
    code: string;
    floor: string;
    type?: RoomType | null;
    capacity?: number | null;
    description?: string | null;
    landmark?: string | null;
    directionsNote?: string | null;
    sortOrder?: number;
    mapX?: number | null;
    mapY?: number | null;
    mapWidth?: number | null;
    mapHeight?: number | null;
    imageUrl?: string | null;
    isActive?: boolean;
}

export type UpdateRoomRequest = Partial<CreateRoomRequest>;

export interface CampusNavigationSectionSummary {
    id: string;
    name: string;
    code: string;
    course?: Pick<Course, 'id' | 'name' | 'code'> | null;
}

export interface CampusNavigationScheduleSummary {
    id: string;
    day: number;
    startTime: string;
    endTime: string;
    section: CampusNavigationSectionSummary;
}

export interface CampusNavigationRoom extends Omit<Room, 'building'> {
    sections: CampusNavigationSectionSummary[];
    schedules: CampusNavigationScheduleSummary[];
}

export interface CampusNavigationFloor {
    floor: string;
    rooms: CampusNavigationRoom[];
}

export interface CampusNavigationBuilding extends Omit<Building, 'rooms'> {
    rooms: CampusNavigationRoom[];
    floors: CampusNavigationFloor[];
    roomsTotal: number;
    floorsTotal: number;
    roomsPreviewLimit?: number;
    matchesQuery?: boolean;
}

export interface CampusNavigationBuildingRoomsResponse {
    buildingId: string;
    rooms: CampusNavigationRoom[];
    floors: CampusNavigationFloor[];
    roomsTotal: number;
    floorsTotal: number;
}

export interface CampusNavigationRoomSelection {
    room: CampusNavigationRoom;
    building: CampusNavigationBuilding;
}

export interface CampusNavigationResponse {
    filters: {
        q: string;
        roomId: string;
        buildingCode: string;
        departmentCode: string;
        floor: string;
        roomType: RoomType | '';
    };
    counts: {
        buildings: number;
        floors: number;
        rooms: number;
        departments: number;
    };
    lookups: {
        departments: Department[];
        floors: string[];
        roomTypes: RoomType[];
    };
    buildings: CampusNavigationBuilding[];
}

export interface Section {
    id: string;
    name: string;
    code: string;
    color?: string | null;
    room?: string;
    defaultRoomId?: string | null;
    defaultRoom?: Room | null;
    courseId?: string;
    course?: Course;
    teachers?: Teacher[];
    students?: Student[];
    studentsCount?: number;
    courseMaterialsCount?: number;
    updatedBy?: string;
    updatedAt?: string;
    schedules?: SectionSchedule[];
    academicCycleId?: string;
    cohortId?: string | null;
    academicCycle?: AcademicCycle;
    cohort?: Cohort;
}

export interface Student {
    id: string;
    registrationNumber?: string;
    rollNumber?: string;
    fatherName?: string;
    age?: number;
    address?: string;
    major?: string;
    userId: string;
    department?: string;
    primaryDepartmentId?: string | null;
    primaryDepartment?: Department | null;
    studentDepartments?: { department: Department; departmentId: string }[];
    admissionDate?: string;
    graduationDate?: string;
    createdAt?: string;
    updatedAt?: string;
    emergencyContact?: string;
    bloodGroup?: string;
    gender?: string | null;
    status?: StudentStatus;
    user: User;
    enrollments?: { id?: string; sectionId?: string; section: Section; source?: 'MANUAL' | 'COHORT' | string; isExcludedFromCohort?: boolean; academicCycleId?: string }[];
    updatedBy?: string;
    cohortId?: string | null;
    cohort?: Cohort;
    guardianId?: string | null;
    guardianRelationship?: string | null;
    guardian?: GuardianProfile | null;
    guardianLinks?: GuardianStudent[];
}

export interface PublicProfileRating {
    averageRating: number | null;
    totalRatings: number;
}

export interface PublicProfileUser {
    id: string;
    name?: string | null;
    role: Role;
    status?: UserStatus | StudentStatus | TeacherStatus;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    createdAt?: string;
}

export interface PublicProfileDepartment {
    id: string;
    name: string;
    code?: string;
    color?: string | null;
}

export interface PublicProfileSection {
    id: string;
    name: string;
    color?: string | null;
    course?: Pick<Course, 'id' | 'name' | 'code'> | null;
    academicCycle?: Pick<AcademicCycle, 'id' | 'name'> | null;
}

export interface PublicStudentProfile {
    id: string;
    registrationNumber?: string | null;
    rollNumber?: string | null;
    major?: string | null;
    admissionDate?: string | null;
    graduationDate?: string | null;
    status?: StudentStatus;
    primaryDepartment?: PublicProfileDepartment | null;
    studentDepartments?: { department: PublicProfileDepartment; departmentId: string }[];
    cohort?: Pick<Cohort, 'id' | 'name' | 'code'> | null;
    enrollments?: { section: PublicProfileSection }[];
}

export interface PublicTeacherProfile {
    id: string;
    designation?: string | null;
    subject?: string | null;
    education?: string | null;
    joiningDate?: string | null;
    status?: TeacherStatus;
    departmentScopeType?: DepartmentScopeType;
    teacherDepartments?: { department: PublicProfileDepartment; departmentId: string }[];
    managerDepartments?: { department: PublicProfileDepartment; departmentId: string }[];
    sections?: PublicProfileSection[];
}

export interface PublicGuardianProfile {
    id: string;
    createdAt?: string;
    studentLinks?: {
        relationshipLabel: string;
        student: {
            id: string;
            registrationNumber?: string | null;
            rollNumber?: string | null;
            user?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'avatarUpdatedAt'> | null;
        };
    }[];
}

export interface PublicRoleAccountProfile {
    id: string;
    departmentScopeType?: DepartmentScopeType;
    subAdminDepartments?: { department: PublicProfileDepartment; departmentId: string }[];
}

export type PublicProfile =
    | { kind: 'student'; user: PublicProfileUser; canEdit: boolean; editHref?: string | null; profile: PublicStudentProfile }
    | { kind: 'teacher' | 'manager'; user: PublicProfileUser; canEdit: boolean; editHref?: string | null; profile: PublicTeacherProfile; rating: PublicProfileRating }
    | { kind: 'guardian'; user: PublicProfileUser; canEdit: boolean; editHref?: string | null; profile: PublicGuardianProfile }
    | { kind: 'subAdmin' | 'financeManager'; user: PublicProfileUser; canEdit: boolean; editHref?: string | null; profile: PublicRoleAccountProfile };

export interface Attachment {
    id: string;
    orgId: string;
    entityType: string;
    entityId: string;
    path: string;
    filename: string;
    mimeType: string;
    size: number;
    resourceType?: string | null;
    deliveryType?: string | null;
    fileKind?: string | null;
    extension?: string | null;
    sha256?: string | null;
    scanStatus?: string | null;
    uploadedBy: string;
    createdAt: string;
}

export interface StatusHistoryEntry {
    status: OrgStatus;
    message: string;
    adminName: string;
    adminRole: string;
    createdAt: string;
}

export interface Organization {
    id: string;
    name: string;
    location: string;
    type: OrganizationType;
    currency: string;
    email: string;
    contactEmail: string;
    contactEmailVerifiedAt?: string | null;
    contactEmailVerificationExpiresAt?: string | null;
    lastVerificationSentAt?: string | null;
    phone?: string;
    logoUrl?: string | null;
    avatarUpdatedAt?: string | null;
    accentColor?: { primary?: string; secondary?: string; mode?: ThemeMode } | null;
    status: OrgStatus;
    statusHistory?: StatusHistoryEntry[];
    createdAt: string;
    adminUserId?: string;
}

export interface RegisterRequest {
    name: string;
    adminName: string;
    location: string;
    type: OrganizationType;
    email: string;
    contactEmail: string;
    phone?: string;
    password: string;
}

export interface LoginRequest {
    email: string;
    password: string;
    rememberMe?: boolean;
    deviceId?: string;
    deviceName?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
}

export interface AuthResponse {
    id?: string;
    name?: string;
    email?: string;
    access_token?: string;
    message?: string;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
}

export interface LinkedAccount {
    id: string;
    provider: 'google';
    email?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface MessageResponse {
    message: string;
}

export interface PasswordResetLinkResponse {
    resetUrl: string;
    expiresAt: string;
    emailSent: boolean;
    message?: string;
    warning?: string;
}

export interface AuditLogItem {
    id: string;
    action: string;
    message: string;
    actor: { id: string; name: string | null; email: string; role: string } | null;
    target: { id: string; name: string | null; email: string; role: string } | null;
    organization: { id: string; name: string; logoUrl: string | null; avatarUpdatedAt: string | null } | null;
    module?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    resourceTitle?: string | null;
    financeStructureId?: string | null;
    financeEntryId?: string | null;
    paymentClaimId?: string | null;
    transactionId?: string | null;
    ip: string | null;
    userAgent: string | null;
    sessionId: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
}

export interface UpdateOrgSettingsRequest {
    name?: string;
    location?: string;
    contactEmail?: string;
    phone?: string;
    currency?: string;
    accentColor?: { primary?: string; secondary?: string; mode?: ThemeMode };
}

export interface PlatformAdmin {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    createdAt: string;
}

export interface AdminStats {
    PENDING: number;
    APPROVED: number;
    REJECTED: number;
    SUSPENDED: number;
    TOTAL_MAIL: number;
    UNREAD_MAIL: number;
    PLATFORM_ADMINS: number;
}

export interface OrgUserCounts {
    subAdmins?: number;
    financeManagers: number;
    managers: number;
    teachers: number;
    students: number;
    guardians: number;
}

export interface AIPlanOption {
    plan: AISubscriptionPlan;
    label: string;
    monthlyCredits: number;
    limitMode: AILimitMode;
    description: string;
}

export interface AISubscription {
    id: string;
    ownerType: AISubscriptionOwnerType;
    organizationId?: string | null;
    userId?: string | null;
    plan: AISubscriptionPlan;
    status: AISubscriptionStatus;
    monthlyCredits: number;
    limitMode: AILimitMode;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    lemonSqueezyCustomerId?: string | null;
    lemonSqueezySubscriptionId?: string | null;
    lemonSqueezyVariantId?: string | null;
    lemonSqueezyPortalUrl?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AICreditBalance {
    periodStart: string;
    periodEnd: string;
    monthlyCredits: number;
    usedCredits: number;
    remainingCredits: number;
    overageCredits: number;
}

export interface AIOrgAccessPolicy {
    id: string;
    organizationId: string;
    allowSubAdmins: boolean;
    allowManagers: boolean;
    allowFinanceManagers: boolean;
    allowTeachers: boolean;
    allowStudents: boolean;
    allowGuardians: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AIRoleCreditPolicy {
    id: string;
    organizationId: string;
    role: Role;
    monthlyCredits: number;
    createdAt: string;
    updatedAt: string;
}

export interface AIOrgSettingsResponse {
    plans: AIPlanOption[];
    subscription: AISubscription;
    accessPolicy: AIOrgAccessPolicy;
    roleCreditPolicies: AIRoleCreditPolicy[];
    usage: AICreditBalance;
    orgAccessRoles: Role[];
    warning: string;
}

export interface AIUsageTopUser {
    userId: string;
    name: string;
    email?: string | null;
    role?: Role | null;
    creditsUsed: number;
    providerTokenEstimate: number;
    estimatedCost: number;
    overageCredits: number;
}

export interface AIRoleUsageSummary {
    role?: Role | null;
    creditsUsed: number;
    providerTokenEstimate: number;
    estimatedCost: number;
    overageCredits: number;
}

export interface AIFeatureUsageSummary {
    toolName: string;
    calls: number;
    allowed: number;
    denied: number;
    creditEstimate: number;
}

export interface AIUsageTrendPoint {
    date: string;
    creditsUsed: number;
}

export interface AIOrgUsageResponse {
    subscription: AISubscription;
    usage: AICreditBalance;
    topUsers: AIUsageTopUser[];
    roleUsage: AIRoleUsageSummary[];
    featureUsage: AIFeatureUsageSummary[];
    estimatedCost: number;
    trends: AIUsageTrendPoint[];
}

export interface AIPersonalSettingsResponse {
    plans: AIPlanOption[];
    subscription: AISubscription;
    usage: AICreditBalance;
}

export interface AIPersonalUsageResponse {
    subscription: AISubscription;
    usage: AICreditBalance;
    estimatedCost: number;
    featureUsage: AIFeatureUsageSummary[];
    trends: AIUsageTrendPoint[];
}

export interface AIEntitlementAllowedResponse {
    allowed: true;
    source: {
        sourceType: AIUsageSourceType;
        subscription: AISubscription;
        balance: AICreditBalance;
        roleMonthlyCredits?: number | null;
        roleUsedCredits?: number;
        roleRemainingCredits?: number | null;
        overageAllowed: boolean;
    };
}

export interface AIEntitlementDeniedResponse {
    allowed: false;
    code: string;
    message: string;
    orgSubscriptionStatus?: AISubscriptionStatus | null;
    orgLimitMode?: AILimitMode | null;
    personalSubscriptionStatus?: AISubscriptionStatus | null;
}

export type AIEntitlementResponse = AIEntitlementAllowedResponse | AIEntitlementDeniedResponse;

export interface AIChatMessagePayload {
    role: 'user' | 'assistant';
    content: string;
}

export interface AIChatRequest {
    prompt: string;
    conversationId?: string;
    retryLastUserMessage?: boolean;
}

export interface AIChatResponse {
    conversationId: string;
    title?: string | null;
    message: AIChatMessagePayload;
    provider: {
        name: string;
        model?: string;
    };
    usage: {
        creditEstimate: number;
        providerTokenEstimate: number;
        sourceType: AIUsageSourceType;
        remainingCreditsBeforeRequest: number;
    };
    toolCalls: Array<{
        name: string;
        input?: unknown;
    }>;
    sources?: Array<{
        label: string;
        kind: string;
    }>;
    relatedActions?: Array<{
        label: string;
        href: string;
    }>;
    requestKind?: string;
}

export type AIChatStreamEvent =
    | {
        type: 'conversation';
        conversationId: string;
        title?: string | null;
    }
    | {
        type: 'delta';
        content: string;
    }
    | {
        type: 'status';
        label: string;
    }
    | {
        type: 'complete';
        response: AIChatResponse;
    }
    | {
        type: 'error';
        code?: string;
        message: string;
    };

export interface AISuggestedQuestion {
    id: string;
    label: string;
    prompt: string;
}

export interface AISuggestedQuestionsResponse {
    suggestions: AISuggestedQuestion[];
    provider: AIChatResponse['provider'];
    usage: AIChatResponse['usage'];
}

export interface AIConversationSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    creditTotal: number;
}

export interface AIStoredConversationMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    createdAt: string;
    metadata?: {
        providerName?: string;
        model?: string;
        creditEstimate?: number;
        providerTokenEstimate?: number;
        sources?: AIChatResponse['sources'];
        relatedActions?: AIChatResponse['relatedActions'];
        requestKind?: string;
        error?: boolean;
    } | null;
}

export interface AIConversationDetail extends Omit<AIConversationSummary, 'messageCount'> {
    messages: AIStoredConversationMessage[];
}

export interface AIPlatformQualityResponse {
    range: {
        start: string;
        end: string;
        days: number;
    };
    totals: {
        toolCalls: number;
        failedToolCalls: number;
        deniedToolCalls: number;
        providerFailures: number;
        averageLatencyMs: number;
        creditsUsed: number;
    };
    creditUsageByAnswerType: Array<{
        requestKind: string;
        creditsUsed: number;
        responses: number;
    }>;
    mostCommonUserIntents: Array<{
        requestKind: string;
        responses: number;
    }>;
    toolHealth: Array<{
        toolName: string;
        calls: number;
        allowed: number;
        denied: number;
        averageLatencyMs: number;
        creditsUsed: number;
    }>;
    providerFailuresByDay: Array<{
        date: string;
        failures: number;
    }>;
    note: string;
}

export interface AIDocsSearchResult {
    title: string;
    section: string;
    snippet: string;
    details?: string[];
    href: string;
    tags: string[];
}

export interface AIRouteSearchResult {
    label: string;
    href: string;
    roles: Role[];
    description: string;
    module: string;
}

export interface DashboardInsightCard {
    id: string;
    label: string;
    value: string;
    detail?: string;
    href?: string;
    tone?: Tone;
}

export interface DashboardInsightItem {
    id: string;
    title: string;
    description?: string;
    meta?: string;
    href?: string;
    badge?: string;
    tone?: Tone;
}

export interface DashboardInsightGroup {
    id: string;
    title: string;
    description?: string;
    items: DashboardInsightItem[];
}

export interface DashboardInsightActivity {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    href?: string;
    tone?: Tone;
}

export interface DashboardInsightCharts {
    attendanceTrend?: { date: string; value: number }[];
    enrollmentTrend?: { date: string; value: number }[];
    gradeDistribution?: { range: string; count: number }[];
    sectionCapacity?: { name: string; courseName?: string; color?: string; enrolled: number; capacity?: number }[];
    mailStatus?: { status: string; count: number }[];
    assessmentCompletion?: { section: string; courseName?: string; color?: string; completed: number; total: number }[];
    teacherWorkload?: { name: string; sections: number; students: number }[];
    studentPerformance?: { subject: string; sectionName?: string; courseName?: string; color?: string; grade: number; attendance: number }[];
    departmentActivity?: { department: string; courses: number; sections: number; students: number; teachers: number; color?: string | null }[];
    departmentPerformance?: { department: string; averageGradePercent: number; attendanceRatePercent: number; gradedAssessments: number; attendanceMarks: number; color?: string | null }[];
    roomUsage?: { room: string; building: string; scheduledSlots: number; capacity?: number | null }[];
    buildingUsage?: { building: string; rooms: number; scheduledSlots: number }[];
    departmentFinance?: { departmentId: string; department: string; expectedAmount: number; collectedAmount: number; pendingAmount: number; overdueAmount: number; collectionRatePercent: number; estimated: boolean }[];
    moneyFlowTrend?: Array<{
        label: string;
        income: number;
        expense: number;
        netFlow: number;
    }>;
    incomeSources?: Array<{
        source: string;
        amount: number;
        percentage: number;
    }>;
    expenseSources?: Array<{
        source: string;
        amount: number;
        percentage: number;
    }>;
    incomeSourceTrend?: Array<{
        label: string;
        [sourceName: string]: string | number;
    }>;
    expenseSourceTrend?: Array<{
        label: string;
        [sourceName: string]: string | number;
    }>;
    topMonths?: {
        highestIncomeMonth: { label: string; amount: number } | null;
        highestExpenseMonth: { label: string; amount: number } | null;
        bestNetFlowMonth: { label: string; amount: number } | null;
        worstNetFlowMonth: { label: string; amount: number } | null;
    };
    collectionHealth?: {
        collectedAmount: number;
        pendingAmount: number;
        overdueAmount: number;
        collectionRatePercent: number;
        chartData: Array<{
            status: 'Collected' | 'Pending' | 'Overdue';
            amount: number;
        }>;
    };
    chartRecommendations?: {
        moneyFlowTrend: 'ComposedChart';
        incomeSources: 'BarChart';
        expenseSources: 'BarChart';
        incomeSourceTrend: 'LineChart';
        expenseSourceTrend: 'LineChart';
        collectionHealth?: 'RadialBarChart' | 'PieChart';
        topMonths: 'BarChart' | 'Cards';
    };
}

export interface DashboardInsights {
    role: string;
    filters?: {
        selectedRange?: InsightTimeRange;
        interval?: InsightInterval;
        from?: string;
        to?: string;
        selectedStudentId?: string | null;
    };
    headline: {
        eyebrow?: string;
        title: string;
        subtitle: string;
    };
    summaryCards: DashboardInsightCard[];
    spotlight: DashboardInsightItem | null;
    groups: DashboardInsightGroup[];
    recentActivity: DashboardInsightActivity[];
    // Visualization data
    charts?: DashboardInsightCharts;
}

export type InsightTimeRange = '1D' | '3D' | '7D' | '15D' | '1M' | '3M' | '6M' | '1Y';
export type InsightInterval = 'daily' | 'weekly' | 'monthly';
export interface InsightsQueryParams {
    range?: InsightTimeRange;
    from?: string;
    to?: string;
    interval?: InsightInterval;
    studentId?: string;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Mail System Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface MailUser {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;
}

export interface MailOrg {
    id: string;
    name: string;
    logoUrl?: string | null;
}

export interface MailMessage {
    id: string;
    mailId: string;
    senderId: string;
    content: string;
    encryptionVersion?: number | null;
    ciphertext?: string | null;
    encryptedContent?: EncryptedMailContent | null;
    createdAt: string;
    updatedAt: string;
    sender: MailUser;
    files?: Attachment[];
}

export interface MailActionLog {
    id: string;
    mailId: string;
    performedBy: string;
    action: string;
    details?: Record<string, unknown> | null;
    note?: string | null;
    createdAt: string;
    performer: { id: string; name: string | null; role: string };
}

export interface MailUserView {
    userId: string;
    mailId: string;
    lastViewedAt: string;
}

/** Summary item returned in list views */
export interface MailItem {
    id: string;
    subject: string;
    encryptionVersion?: number | null;
    ciphertext?: string | null;
    subjectEncryptedContent?: EncryptedMailContent | null;
    encryptedContent?: EncryptedMailContent | null;
    category: MailCategory;
    priority: string;
    status: MailStatus;
    creatorId: string;
    creatorRole: string;
    organizationId: string | null;
    targetRole: string | null;
    assigneeId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    creator: MailUser;
    assignee: MailUser | null;
    assignees: MailUser[];
    organization: MailOrg | null;
    _count: { messages: number };
    unreadCount: number;
}

/** Full detail returned when viewing a single mail thread */
export interface MailDetail extends MailItem {
    messages: MailMessage[];
    actionLogs: MailActionLog[];
    userViews: MailUserView[];
}

export interface CreateMailPayload {
    subject: string;
    category: MailCategory;
    priority?: string;
    message: string;
    targetRole?: string;
    assigneeIds?: string[];
    metadata?: Record<string, unknown>;
    noReply?: boolean;
    encryptedSubject?: EncryptedMailContent;
    encryptedMessage?: EncryptedMailContent;
}

export type EncryptedMailContent = Omit<EncryptedChatContent, 'contentType'> & {
    contentType?: 'MAIL_MESSAGE' | 'MAIL_SUBJECT';
};

export interface MailE2EEContextRequest {
    category?: string;
    targetRole?: string;
    assigneeIds?: string[];
}

export interface UpdateMailPayload {
    status?: MailStatus;
    assigneeId?: string;
    priority?: string;
}

export interface MailTarget {
    id: string;
    label: string;
    email?: string;
    type: 'ROLE' | 'USER';
    role?: Role | 'ORG_STAFF';
    avatarUrl?: string | null;
    description?: string;
}

// Request Interfaces
export interface CreateTeacherRequest {
    name: string;
    email: string;
    phone?: string | null;
    password?: string;
    education?: string | null;
    designation?: string | null;
    subject?: string | null;
    department?: string | null;
    joiningDate?: string | null;
    emergencyContact?: string | null;
    bloodGroup?: string | null;
    address?: string | null;
    isManager?: boolean;
    status?: TeacherStatus;
    departmentIds?: string[];
    departmentScopeType?: DepartmentScopeType;
    scopeDepartmentIds?: string[];
}

export type UpdateTeacherRequest = Partial<CreateTeacherRequest>;

export interface CreateSubAdminRequest {
    name: string;
    email: string;
    phone?: string | null;
    password?: string;
    status?: UserStatus;
    departmentScopeType?: DepartmentScopeType;
    departmentIds?: string[];
}

export type UpdateSubAdminRequest = Partial<CreateSubAdminRequest>;

export interface CreateRoleAccountRequest {
    name: string;
    email: string;
    phone?: string | null;
    password?: string;
    status?: UserStatus;
    departmentScopeType?: DepartmentScopeType;
    departmentIds?: string[];
}

export type UpdateRoleAccountRequest = Partial<CreateRoleAccountRequest>;

export type CreateFinanceManagerRequest = Omit<CreateRoleAccountRequest, 'departmentScopeType' | 'departmentIds'>;
export type UpdateFinanceManagerRequest = Partial<CreateFinanceManagerRequest>;

export interface CreateStudentRequest {
    name: string;
    email: string;
    phone?: string | null;
    password?: string;
    registrationNumber?: string | null;
    rollNumber?: string | null;
    fatherName?: string | null;
    age?: number | null;
    address?: string | null;
    major?: string | null;
    department?: string | null;
    admissionDate?: string | null;
    graduationDate?: string | null;
    emergencyContact?: string | null;
    bloodGroup?: string | null;
    gender?: string | null;
    status?: StudentStatus;
    guardianId?: string | null;
    guardianRelationship?: string | null;
    primaryDepartmentId?: string | null;
    departmentIds?: string[];
}

export type UpdateStudentRequest = Partial<CreateStudentRequest>;

export interface Enrollment {
    id: string;
    studentId: string;
    sectionId: string;
    academicCycleId?: string | null;
    source: 'MANUAL' | 'COHORT';
    isExcludedFromCohort: boolean;
    createdAt: string;
    updatedAt: string;
    student?: Student;
    section?: Section;
}

export interface EnrollmentMutationResponse {
    enrollment?: Enrollment;
    count?: number;
    warnings?: { code: string; message: string }[];
    results?: EnrollmentMutationResponse[];
}

export interface CreateGuardianRequest {
    name: string;
    email: string;
    password: string;
    status?: UserStatus;
    phone?: string | null;
    address?: string | null;
}

export type UpdateGuardianRequest = Partial<CreateGuardianRequest>;

export interface CreateSectionRequest {
    name: string;
    code: string;
    color?: string;
    room?: string;
    defaultRoomId?: string | null;
    courseId: string;
    academicCycleId: string;
    cohortId?: string | null;
    teacherIds?: string[];
    scheduleTeacherResolution?: {
        action: 'MOVE' | 'DELETE';
        teacherId?: string;
    };
}

export type UpdateSectionRequest = Partial<CreateSectionRequest>;

export interface CreateCourseRequest {
    name: string;
    code: string;
    description?: string;
    creditHours?: number;
    departmentId?: string | null;
}


export type UpdateCourseRequest = Partial<CreateCourseRequest>;

export type ImportEntity =
    | 'students'
    | 'teachers'
    | 'guardians'
    | 'courses'
    | 'sections'
    | 'schedules'
    | 'cohorts'
    | 'departments'
    | 'buildings'
    | 'rooms';

export type AttendanceImportTargetMode =
    | 'FIRST_SCHEDULE'
    | 'ALL_SCHEDULES';

export interface ImportRowError {
    rowNumber: number;
    field?: string;
    message: string;
}

export interface ImportPreviewRow<T = Record<string, unknown>> {
    rowNumber: number;
    data: T;
    raw: Record<string, string>;
    warnings?: ImportRowError[];
}

export interface InvalidImportRow {
    rowNumber: number;
    raw: Record<string, string>;
    errors: ImportRowError[];
}

export interface ImportValidationResult<T = Record<string, unknown>> {
    entity: string;
    headers: string[];
    totalRows: number;
    validRows: ImportPreviewRow<T>[];
    invalidRows: InvalidImportRow[];
    summary: {
        valid: number;
        invalid: number;
        partial?: number;
        duplicate: number;
        skipped: number;
    };
    options?: Record<string, unknown>;
}

export interface ImportConfirmResult {
    entity: string;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    duplicateCount: number;
    errors: InvalidImportRow[];
}

export type ImportProgressEvent =
    | { type: 'progress'; percent: number }
    | { type: 'complete'; result: ImportConfirmResult }
    | { type: 'error'; message: string };

export interface AttendanceMonthlyImportOptions {
    sectionId: string;
    year: number;
    month: number;
    targetMode: AttendanceImportTargetMode;
}

export interface Assessment {
    id: string;
    sectionId: string;
    courseId: string;
    organizationId: string;
    title: string;
    type: AssessmentType;
    totalMarks: number;
    weightage: number;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
    allowSubmissions: boolean;
    externalLink?: string;
    isVideoLink?: boolean;
    files?: Attachment[];
    _count?: {
        grades: number;
        submissions: number;
    };
    section?: Section;
    grades?: Grade[];
    submissions?: Submission[];
}

export interface Grade {
    id: string;
    assessmentId: string;
    studentId: string;
    marksObtained: number;
    feedback?: string;
    status: GradeStatus;
    createdAt: string;
    updatedAt: string;
    updatedBy?: string;
    finalizedById?: string | null;
    finalizedAt?: string | null;
    lastCorrectedById?: string | null;
    lastCorrectedAt?: string | null;
    correctionReason?: string | null;
    assessment?: Assessment;
    student?: Student;
}

export interface Submission {
    id: string;
    assessmentId: string;
    studentId: string;
    fileUrl?: string;
    message?: string;
    submittedAt: string;
    student?: Student;
    files?: Attachment[];
}

export interface CreateAssessmentRequest {
    sectionId: string;
    courseId: string;
    title: string;
    type: AssessmentType;
    totalMarks: number;
    weightage: number;
    dueDate?: string;
    allowSubmissions?: boolean;
    externalLink?: string;
    isVideoLink?: boolean;
}

export type UpdateAssessmentRequest = Partial<CreateAssessmentRequest>;

export interface UpdateGradeRequest {
    marksObtained: number;
    feedback?: string;
    status?: GradeStatus;
    correctionReason?: string;
}

export interface CreateSubmissionRequest {
    assessmentId: string;
    fileUrl?: string;
    message?: string;
}

export interface FinalGradeDetail {
    assessmentId: string;
    title: string;
    type: AssessmentType;
    weightage: number;
    marksObtained: number;
    totalMarks: number;
    status: string;
    percentage: string;
}

export interface FinalGradeResponse {
    sectionId: string;
    sectionName: string;
    sectionColor?: string | null;
    courseName: string;
    creditHours?: number;
    finalPercentage: number;
    letterGrade?: string;
    gradePoints?: number;
    assessments: FinalGradeDetail[];
}

export interface SectionGradebookAssessment {
    id: string;
    title: string;
    type: AssessmentType;
    totalMarks: number;
    weightage: number;
    dueDate?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface SectionGradebookCell {
    assessmentId: string;
    gradeId?: string | null;
    marksObtained?: number | null;
    totalMarks: number;
    weightage: number;
    percentage?: number | null;
    weightedScore?: number | null;
    status?: GradeStatus | null;
    feedback?: string | null;
    updatedAt?: string | null;
}

export interface SectionGradebookStudentRow {
    student: Student;
    enrollment: {
        id: string;
        source?: string;
        isExcludedFromCohort?: boolean;
    };
    grades: SectionGradebookCell[];
    summary: {
        marksObtained: number;
        totalMarks: number;
        totalWeight: number;
        weightedPercentage: number;
        gradedAssessments: number;
        missingAssessments: number;
        draftCount: number;
        publishedCount: number;
        finalizedCount: number;
        letterGrade: string;
        gradePoints: number;
        qualityPoints: number;
    };
}

export interface SectionGradebookResponse {
    section: {
        id: string;
        name: string;
        color?: string | null;
        course?: Pick<Course, 'id' | 'name' | 'creditHours'>;
        academicCycle?: Pick<AcademicCycle, 'id' | 'name' | 'startDate' | 'endDate'> | null;
        cohort?: Pick<Cohort, 'id' | 'name'> | null;
        teachers?: {
            id: string;
            userId: string;
            name: string | null;
            email?: string;
        }[];
    };
    assessments: SectionGradebookAssessment[];
    students: SectionGradebookStudentRow[];
    summary: {
        studentCount: number;
        assessmentCount: number;
        enteredGradeCount: number;
        missingGradeCount: number;
        finalizedGradeCount: number;
        publishedGradeCount: number;
        draftGradeCount: number;
        averageWeightedPercentage: number;
        policyName: string;
        gpaScale: number;
    };
}
export interface GpaGradeRule {
    min: number;
    max: number;
    letter: string;
    points: number;
}

export interface GpaPolicy {
    id: string;
    organizationId: string;
    name: string;
    scale: number;
    method: GpaCalculationMethod;
    rounding: GpaRounding;
    gradeRules: GpaGradeRule[];
    isDefault: boolean;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        academicCycles?: number;
    };
}

export interface CreateGpaPolicyRequest {
    name: string;
    scale?: number;
    method?: GpaCalculationMethod;
    rounding?: GpaRounding;
    gradeRules: GpaGradeRule[];
    isDefault?: boolean;
}

export type UpdateGpaPolicyRequest = Partial<CreateGpaPolicyRequest>;

export interface GpaPolicyPreviewRequest {
    marks: number;
    creditHours: number;
    scale?: number;
    method?: GpaCalculationMethod;
    rounding?: GpaRounding;
    gradeRules: GpaGradeRule[];
}

export interface GpaPolicyPreviewResponse {
    letterGrade: string;
    gradePoints: number;
    gpa: number;
    totalCreditHours: number;
}

export interface UnfinalizedGradeReviewRow {
    id: string;
    assessmentId: string;
    assessmentTitle: string;
    assessmentType: AssessmentType;
    totalMarks: number;
    weightage: number;
    sectionId: string;
    sectionName: string;
    sectionColor?: string | null;
    courseName: string;
    grade: Grade;
    student: Student;
}

export type GradeFinalizationStatus =
    | 'DRAFT'
    | 'PUBLISHED'
    | 'READY_FOR_FINALIZATION'
    | 'FINALIZED'
    | 'NEEDS_REVIEW';

export interface GradeFinalizationFilters {
    academicCycleId?: string;
    courseId?: string;
    departmentId?: string;
    sectionId?: string;
    teacherId?: string;
    status?: GradeFinalizationStatus | 'ALL';
}

export interface GradeFinalizationRow {
    assessmentId: string;
    assessmentTitle: string;
    assessmentType: AssessmentType;
    totalMarks: number;
    weightage: number;
    status: GradeFinalizationStatus;
    academicCycle: {
        id: string;
        name: string;
        gpaPolicyName?: string | null;
    } | null;
    course: {
        id: string;
        name: string;
        departmentId?: string | null;
        department?: Department | null;
    };
    section: {
        id: string;
        name: string;
        color?: string | null;
    };
    teachers: {
        id: string;
        userId: string;
        name: string;
        email?: string;
    }[];
    totalStudents: number;
    gradedStudents: number;
    missingGrades: number;
    draftCount: number;
    publishedCount: number;
    finalizedCount: number;
    lastUpdatedBy?: string | null;
    lastUpdatedAt?: string | null;
    finalizedBy?: string | null;
    finalizedAt?: string | null;
    lastCorrectedBy?: string | null;
    lastCorrectedAt?: string | null;
    correctionReason?: string | null;
}

export interface ApiError {
    message?: string;
    status?: number;
    code?: string;
    field?: string;
    response?: {
        status?: number;
        data?: {
            code?: string;
            field?: string;
            message?: string | string[];
        };
    };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Communication System Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface ChatParticipant {
    id: string;
    chatId: string;
    userId: string;
    role: ChatParticipantRole;
    isActive: boolean;
    lastReadMessageId: string | null;
    lastSeenAt: string | null;
    joinedAt: string;
    hiddenAt?: string | null;
    clearedAt?: string | null;
    user?: User;
}

export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    organizationId?: string | null;
    content: string;
    encryptionVersion?: number | null;
    ciphertext?: string | null;
    encryptedContent?: EncryptedChatContent | null;
    type: ChatMessageType;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    deletedById?: string | null;
    sender?: User;
    deletedBy?: User;
    chat?: Partial<Chat>;
    replyToId?: string | null;
    replyTo?: ChatMessage | null;
    readBy?: string[];
}

export interface ChatKeyEnvelope {
    id?: string;
    recipientUserId: string;
    trustedDeviceId: string;
    senderDeviceId?: string | null;
    deviceKeyVersion: number;
    algorithm: string;
    wrappedKey: string;
    nonce?: string | null;
    associatedData?: Record<string, unknown> | null;
    senderDevice?: {
        id: string;
        userId: string;
        keyAgreementPublicKey: string;
        keyAgreementPublicKeyFingerprint?: string | null;
        keyVersion: number;
        trustStatus?: 'PENDING' | 'TRUSTED' | 'REVOKED';
        revokedAt?: string | null;
    } | null;
    trustedDevice?: {
        id: string;
        userId: string;
        clientDeviceId: string;
        keyVersion: number;
        trustStatus?: 'PENDING' | 'TRUSTED' | 'REVOKED';
        revokedAt?: string | null;
    } | null;
}

export interface ChatContentHistoryKeyEnvelope {
    id?: string;
    encryptedContentId?: string;
    historyKeyId: string;
    recipientUserId: string;
    algorithm: string;
    wrappedKey: string;
    nonce?: string | null;
    associatedData?: Record<string, unknown> | null;
    historyKey?: ChatHistoryKeyContext;
}

export interface ChatHistoryKeyDeviceEnvelope {
    id?: string;
    historyKeyId?: string;
    recipientUserId: string;
    trustedDeviceId: string;
    senderDeviceId?: string | null;
    deviceKeyVersion: number;
    algorithm: string;
    wrappedKey: string;
    nonce?: string | null;
    associatedData?: Record<string, unknown> | null;
    senderDevice?: {
        id: string;
        userId: string;
        keyAgreementPublicKey: string;
        keyAgreementPublicKeyFingerprint?: string | null;
        keyVersion: number;
        trustStatus?: 'PENDING' | 'TRUSTED' | 'REVOKED';
        revokedAt?: string | null;
    } | null;
    trustedDevice?: {
        id: string;
        userId: string;
        clientDeviceId: string;
        keyVersion: number;
        trustStatus?: 'PENDING' | 'TRUSTED' | 'REVOKED';
        revokedAt?: string | null;
    } | null;
}

export interface ChatHistoryKeyContext {
    id: string;
    chatId: string;
    userId?: string;
    scope?: 'CHAT_USER';
    epoch: number;
    keyVersion: number;
    algorithm: string;
    createdAt?: string;
    rotatedAt?: string | null;
    revokedAt?: string | null;
    deviceEnvelopes?: ChatHistoryKeyDeviceEnvelope[];
}

export interface ChatE2EEContext {
    chatId: string;
    activeParticipantIds: string[];
    historyKeys: ChatHistoryKeyContext[];
}

export interface RegisterChatHistoryKeyPayload {
    algorithm: string;
    deviceEnvelopes: ChatHistoryKeyDeviceEnvelope[];
}

export interface ApproveTrustedDevicePayload {
    approverDeviceId: string;
    historyKeyEnvelopes?: ChatHistoryKeyDeviceEnvelope[];
}

export interface EncryptedChatContent {
    id?: string;
    contentType?: 'CHAT_MESSAGE';
    encryptionVersion: number;
    algorithm: string;
    ciphertext: string;
    nonce: string;
    authTag?: string | null;
    associatedData?: Record<string, unknown> | null;
    contentKeyVersion?: number;
    keyEnvelopes?: ChatKeyEnvelope[];
    historyKeyEnvelopes?: ChatContentHistoryKeyEnvelope[];
}

export interface SendChatMessagePayload {
    content?: string;
    encryptedContent?: EncryptedChatContent;
    replyToId?: string;
    mentionTargets?: ChatMentionTarget[];
    mentionedUserIds?: string[];
}

export interface Chat {
    id: string;
    type: ChatType;
    name: string | null;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    organizationId: string | null;
    creatorId: string;
    createdAt: string;
    updatedAt: string;
    readOnly?: boolean;
    participants?: ChatParticipant[];
    messages?: ChatMessage[];
    _count?: { messages: number };
    unreadCount?: number;
    directMessageBlock?: {
        isBlocked: boolean;
        blockedByMe: boolean;
        blockedByOther: boolean;
        blockId?: string | null;
        canBlock: boolean;
        reason?: string | null;
    } | null;
}

export interface EncryptionIdentity {
    id: string;
    userId: string;
    keyVersion: number;
    identityPublicKey: string;
    publicKeyFingerprint?: string | null;
    signingPublicKey?: string | null;
    signingPublicKeyFingerprint?: string | null;
    algorithm: string;
    createdAt: string;
    rotatedAt?: string | null;
    disabledAt?: string | null;
}

export interface TrustedEncryptionDevice {
    id: string;
    userId: string;
    clientDeviceId: string;
    displayName?: string | null;
    deviceType?: string | null;
    browser?: string | null;
    os?: string | null;
    keyVersion: number;
    keyAgreementPublicKey: string;
    keyAgreementPublicKeyFingerprint?: string | null;
    signingPublicKey?: string | null;
    signingPublicKeyFingerprint?: string | null;
    algorithm: string;
    trustStatus: 'PENDING' | 'TRUSTED' | 'REVOKED';
    approvalRequestedAt?: string | null;
    trustedAt?: string | null;
    approvedByDeviceId?: string | null;
    lastSeenAt?: string | null;
    revokedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface RegisterTrustedDevicePayload {
    clientDeviceId: string;
    displayName?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    identityPublicKey: string;
    identityPublicKeyFingerprint?: string;
    identitySigningPublicKey?: string;
    identitySigningPublicKeyFingerprint?: string;
    keyAgreementPublicKey: string;
    keyAgreementPublicKeyFingerprint?: string;
    signingPublicKey?: string;
    signingPublicKeyFingerprint?: string;
    algorithm?: string;
    requestApprovalNotification?: boolean;
}

export interface TrustedDeviceRegistrationResponse {
    identity: EncryptionIdentity;
    device: TrustedEncryptionDevice;
}

export interface TrustedDevicesResponse {
    identity: EncryptionIdentity | null;
    devices: TrustedEncryptionDevice[];
}

export interface RecipientEncryptionDevicesResponse {
    userId: string;
    identity: EncryptionIdentity | null;
    devices: TrustedEncryptionDevice[];
}

export interface PendingDeviceApprovalContext {
    pendingDevice: TrustedEncryptionDevice;
    approverDevice: TrustedEncryptionDevice;
    historyKeys: ChatHistoryKeyContext[];
}

export type ChatMentionTargetType = 'USER' | 'EVERYONE' | 'ROLE' | 'RELATED_SCOPE';
export type ChatMentionScopeType = 'SECTION' | 'DEPARTMENT' | 'COHORT';
export type ChatMentionAudience = Role | 'EVERYONE';

export interface ChatMentionTarget {
    type: ChatMentionTargetType;
    userId?: string;
    role?: Role;
    scopeType?: ChatMentionScopeType;
    scopeId?: string;
    audienceRole?: ChatMentionAudience;
    label?: string;
}

export interface ChatMentionRoleOption {
    role: Role;
    count: number;
}

export interface ChatMentionScopeOption {
    type: ChatMentionScopeType;
    audienceRole: ChatMentionAudience;
    id: string;
    name: string;
    code?: string | null;
    count: number;
}

export interface ChatMentionOptions {
    roles: ChatMentionRoleOption[];
    scopes: ChatMentionScopeOption[];
}

export interface CommunicationBlock {
    id: string;
    userId: string;
    targetUserId: string;
    chatId?: string | null;
    organizationId?: string | null;
    channel: CommunicationChannel;
    createdAt: string;
    targetUser: User;
}

export interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string | null;
    actionUrl: string | null;
    type: string | null;
    metadata: Record<string, unknown> | null;
    isRead: boolean;
    createdAt: string;
}

export interface Announcement {
    id: string;
    title: string;
    body: string;
    targetType: TargetType;
    targetId: string | null;
    actionUrl: string | null;
    priority: AnnouncementPriority;
    creatorId: string;
    organizationId: string | null;
    createdAt: string;
    creator?: User;
    organization?: Organization;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Timetable & Attendance System Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface HolidayDepartmentLink {
    holidayId: string;
    departmentId: string;
    department?: Department;
}

export interface Holiday {
    id: string;
    organizationId: string;
    title: string;
    description?: string | null;
    type: HolidayType;
    matchMode: HolidayMatchMode;
    departmentScopeType: DepartmentScopeType;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    daysOfWeek: number[];
    isFullDay: boolean;
    isActive: boolean;
    createdById: string;
    updatedById?: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy?: User;
    updatedBy?: User | null;
    departmentLinks?: HolidayDepartmentLink[];
}

export interface CreateHolidayRequest {
    title: string;
    description?: string;
    type?: HolidayType;
    matchMode?: HolidayMatchMode;
    departmentScopeType?: DepartmentScopeType;
    departmentIds?: string[];
    startDate: string;
    endDate?: string;
    isFullDay?: boolean;
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    isActive?: boolean;
    announce?: boolean;
    announcementTargetType?: TargetType;
    announcementTargetId?: string;
    announcementPriority?: AnnouncementPriority;
}

export type UpdateHolidayRequest = Partial<CreateHolidayRequest>;

export interface EvaluationWindow {
    id: string;
    organizationId: string;
    academicCycleId: string;
    courseId?: string | null;
    sectionId?: string | null;
    title: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdById: string;
    updatedById?: string | null;
    createdAt: string;
    updatedAt: string;
    academicCycle?: Pick<AcademicCycle, 'id' | 'name'>;
    course?: Pick<Course, 'id' | 'name' | 'departmentId'> | null;
    section?: Pick<Section, 'id' | 'name' | 'courseId'> | null;
    createdBy?: Pick<User, 'id' | 'name' | 'email'>;
    updatedBy?: Pick<User, 'id' | 'name' | 'email'> | null;
}

export interface PreferenceWindowOption {
    id: string;
    windowId: string;
    targetType: PreferenceTargetType;
    courseId?: string | null;
    sectionId?: string | null;
    displayOrder: number;
    course?: Course | null;
    section?: Section | null;
}

export interface PreferenceWindowAudience {
    id: string;
    windowId: string;
    targetType: PreferenceTargetType;
    courseId?: string | null;
    cohortId?: string | null;
    sectionId?: string | null;
    course?: Course | null;
    cohort?: Cohort | null;
    section?: Section | null;
}

export interface PreferenceRank {
    id: string;
    submissionId: string;
    optionId: string;
    rank: number;
    option?: PreferenceWindowOption;
}

export interface PreferenceSubmission {
    id: string;
    windowId: string;
    studentId: string;
    submittedById: string;
    submittedAt: string;
    updatedAt: string;
    student?: Student;
    ranks?: PreferenceRank[];
}

export interface PreferenceWindow {
    id: string;
    organizationId: string;
    academicCycleId: string;
    title: string;
    description?: string | null;
    kind: PreferenceWindowKind;
    status: PreferenceWindowStatus;
    startAt: string;
    endAt: string;
    announcementId?: string | null;
    createdById: string;
    updatedById?: string | null;
    createdAt: string;
    updatedAt: string;
    academicCycle?: AcademicCycle;
    options?: PreferenceWindowOption[];
    audiences?: PreferenceWindowAudience[];
    submissions?: PreferenceSubmission[];
    _count?: { submissions?: number; options?: number; audiences?: number };
}

export interface PreferenceWindowRequest {
    kind: PreferenceWindowKind;
    academicCycleId: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    optionCourseIds?: string[];
    optionSectionIds?: string[];
    audienceCourseIds?: string[];
    audienceCohortIds?: string[];
    audienceSectionIds?: string[];
}

export interface PreferenceResults {
    window: PreferenceWindow;
    audienceCount: number;
    submittedCount: number;
    pendingCount: number;
    optionStats: {
        optionId: string;
        firstChoices: number;
        responses: number;
        averageRank: number | null;
        capacityWarnings: string[];
    }[];
    students: {
        student: Student;
        submitted: boolean;
        ranks: PreferenceRank[];
        currentSectionIds: string[];
    }[];
}

export interface Evaluation {
    id: string;
    organizationId: string;
    type: EvaluationType;
    studentId: string;
    sectionId: string;
    courseId: string;
    teacherId?: string | null;
    academicCycleId: string;
    windowId?: string | null;
    rating: number;
    feedback?: string | null;
    isHidden: boolean;
    hiddenById?: string | null;
    hiddenAt?: string | null;
    hiddenReason?: string | null;
    createdById: string;
    updatedById?: string | null;
    createdAt: string;
    updatedAt: string;
    student?: Student;
    section?: Section;
    course?: Course;
    teacher?: Teacher | null;
    academicCycle?: AcademicCycle;
    window?: EvaluationWindow | null;
    hiddenBy?: Pick<User, 'id' | 'name' | 'email'> | null;
}

export interface EvaluationPendingTask {
    key: string;
    type: EvaluationType;
    eligible: boolean;
    reason?: 'FINALIZED_GRADE_REQUIRED' | 'ACTIVE_WINDOW_REQUIRED' | null;
    window?: EvaluationWindow | null;
    evaluation?: Evaluation | null;
    section: Section;
    course: Course;
    academicCycle?: AcademicCycle;
    teacher?: Teacher | null;
}

export interface EvaluationPendingResponse {
    student: { id: string; user?: Pick<User, 'id' | 'name' | 'email'> };
    pending: EvaluationPendingTask[];
    completed: EvaluationPendingTask[];
    locked: EvaluationPendingTask[];
    tasks: EvaluationPendingTask[];
}

export interface EvaluationSummary {
    averageRating: number | null;
    totalRatings: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    feedback: Evaluation[];
    teacher?: Teacher;
    course?: Course;
}

export interface CreateEvaluationRequest {
    type: EvaluationType;
    sectionId: string;
    teacherId?: string;
    rating: number;
    feedback?: string;
}

export interface UpdateEvaluationRequest {
    rating?: number;
    feedback?: string;
}

export interface CreateEvaluationWindowRequest {
    academicCycleId: string;
    courseId?: string | null;
    sectionId?: string | null;
    title: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    isActive?: boolean;
}

export type UpdateEvaluationWindowRequest = Partial<CreateEvaluationWindowRequest>;

export interface BulkCreateEvaluationWindowsRequest {
    academicCycleId: string;
    startDate: string;
    endDate: string;
    targetType: 'SECTION' | 'COURSE';
    titlePrefix?: string;
    cohortIds?: string[];
    departmentIds?: string[];
    courseIds?: string[];
    sectionIds?: string[];
    isActive?: boolean;
    skipExisting?: boolean;
}

export interface BulkCreateEvaluationWindowsResponse {
    created: number;
    skipped: number;
    totalTargets: number;
    windows: EvaluationWindow[];
}

export interface SectionSchedule {
    id: string;
    sectionId: string;
    day: number;
    date?: string | null;
    type?: ScheduleType;
    startTime: string;
    endTime: string;
    room?: string | null;
    roomId?: string | null;
    roomRef?: Room | null;
    teacherId: string;
    teacher?: Teacher;
    capacityWarning?: string | null;
    createdAt?: string;
    updatedAt?: string;
    section?: Section;
}

export interface TimetableEntry {
    scheduleId: string;
    sectionId: string;
    sectionName: string;
    courseId?: string | null;
    departmentId?: string | null;
    courseName: string;
    color?: string | null;
    day: number;
    date?: string | null;
    type?: ScheduleType;
    startTime: string;
    endTime: string;
    room: string | null;
    roomId?: string | null;
    teacherId?: string | null;
    teacherUserId?: string | null;
    teacherName?: string | null;
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

export interface TimetableResponse {
    schedules: TimetableEntry[];
    holidays: Holiday[];
    overlays: HolidayOverlay[];
    range: {
        startDate: string;
        endDate: string;
    };
}

export interface AttendanceSession {
    id: string;
    sectionId: string;
    scheduleId: string;
    type?: ScheduleType;
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    createdAt?: string;
    records?: AttendanceRecord[];
    section?: {
        id: string;
        name: string;
        color?: string | null;
        course?: {
            id?: string;
            name: string;
        };
    };
}

export interface AttendanceRecord {
    id: string;
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    session?: AttendanceSession;
    student?: Student;
}

export interface SectionAttendanceStudent {
    studentId: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    registrationNumber?: string;
    rollNumber?: string;
    status: AttendanceStatus | null;
}

export interface SectionAttendanceResponse {
    sessionId: string | null;
    date: string;
    students: SectionAttendanceStudent[];
}
export interface RangeAttendanceResponse {
    sessions: {
        id: string;
        date: string;
        type?: ScheduleType;
        startTime?: string;
        endTime?: string;
        schedule?: {
            startTime: string;
            endTime: string;
            room: string | null;
            type?: ScheduleType;
        } | null;
    }[];
    students: {
        avatarUrl: string | null | undefined;
        studentId: string;
        name: string;
        email: string;
        registrationNumber: string | null;
        rollNumber: string | null;
        records: {
            sessionId: string;
            date: string;
            status: AttendanceStatus | null;
        }[];
    }[];
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Course Materials Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface CourseMaterial {
    id: string;
    sectionId: string;
    title: string;
    description?: string | null;
    files?: Attachment[];
    links?: string[];
    isVideoLink?: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    creator?: {
        id: string;
        name?: string;
    } | null;
    section?: Section;
}

export interface CreateCourseMaterialRequest {
    sectionId?: string;
    title: string;
    description?: string;
    fileIds?: string[];
    links?: string[];
    isVideoLink?: boolean;
}

export interface UpdateCourseMaterialRequest {
    title?: string;
    description?: string;
    fileIds?: string[];
    filesToRemove?: string[];
    links?: string[];
    isVideoLink?: boolean;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Academic Lifecycle System Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface AcademicCycle {
    id: string;
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    organizationId: string;
    gpaPolicyId?: string | null;
    gpaPolicySnapshot?: unknown;
    gpaPolicy?: Pick<GpaPolicy, 'id' | 'name' | 'isArchived'> | null;
    hasFinalizedGrades?: boolean;
    _count?: {
        cohorts: number;
        sections: number;
    };
}

export interface Cohort {
    id: string;
    name: string;
    code: string;
    organizationId: string;
    academicCycleId: string;
    isActive?: boolean;
    academicCycle?: AcademicCycle;
    students?: Student[];
    sections?: Section[];
    _count?: {
        students: number;
        sections: number;
    };
}

export interface EnrollmentHistory {
    id: string;
    studentId: string;
    sectionId: string;
    academicCycleId: string;
    source: 'MANUAL' | 'COHORT';
    wasExcluded: boolean;
    enrolledAt: string;
    removedAt?: string | null;
}

export interface TranscriptSection {
    sectionId: string;
    courseName: string;
    sectionName: string;
    courseId?: string;
    creditHours?: number;
    source: string;
    wasExcluded: boolean;
    removedAt?: string | null;
    totalMarks: number;
    marksObtained: number;
    percentage: number;
    letterGrade?: string;
    gradePoints?: number;
    qualityPoints?: number;
    status: string;
}

export interface Transcript {
    studentId: string;
    studentName: string;
    academicCycleId: string;
    academicCycleName: string;
    cohortName?: string;
    sections: TranscriptSection[];
    overallPercentage: number;
    gpa?: number;
    cgpa?: number;
    gpaScale?: number;
    policyName?: string;
    totalCreditHours?: number;
    totalAssessments: number;
}

export interface CreateAcademicCycleDto {
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
    gpaPolicyId?: string;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Financial System Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export enum FinanceCategory {
    TUITION = 'TUITION',
    TRANSPORT = 'TRANSPORT',
    LIBRARY = 'LIBRARY',
    LIBRARY_FINE = 'LIBRARY_FINE',
    EXAM = 'EXAM',
    SALARY = 'SALARY',
    BONUS = 'BONUS',
    ADMISSION = 'ADMISSION',
    HOSTEL = 'HOSTEL',
    ACTIVITY = 'ACTIVITY',
    REIMBURSEMENT = 'REIMBURSEMENT',
    REFUND = 'REFUND',
    LATE_FEE = 'LATE_FEE',
    FINE = 'FINE',
    BOOKS_SUPPLIES = 'BOOKS_SUPPLIES',
    STATIONERY = 'STATIONERY',
    UNIFORM = 'UNIFORM',
    LAB = 'LAB',
    ID_CARD = 'ID_CARD',
    CERTIFICATE = 'CERTIFICATE',
    TRANSCRIPT = 'TRANSCRIPT',
    GRADUATION = 'GRADUATION',
    REGISTRATION = 'REGISTRATION',
    APPLICATION_FEE = 'APPLICATION_FEE',
    PROCESSING_FEE = 'PROCESSING_FEE',
    DEVELOPMENT_FEE = 'DEVELOPMENT_FEE',
    BUILDING_FUND = 'BUILDING_FUND',
    CANTEEN = 'CANTEEN',
    CAFETERIA = 'CAFETERIA',
    MEDICAL = 'MEDICAL',
    HEALTH = 'HEALTH',
    SPORTS = 'SPORTS',
    ARTS = 'ARTS',
    MUSIC = 'MUSIC',
    TECHNOLOGY = 'TECHNOLOGY',
    PRINTING = 'PRINTING',
    PARKING = 'PARKING',
    SECURITY_DEPOSIT = 'SECURITY_DEPOSIT',
    FIELD_TRIP = 'FIELD_TRIP',
    EVENT = 'EVENT',
    DONATION = 'DONATION',
    GRANT = 'GRANT',
    SCHOLARSHIP = 'SCHOLARSHIP',
    DISCOUNT = 'DISCOUNT',
    WAIVER = 'WAIVER',
    VENDOR_PAYMENT = 'VENDOR_PAYMENT',
    ALLOWANCE = 'ALLOWANCE',
    OVERTIME = 'OVERTIME',
    COMMISSION = 'COMMISSION',
    ADVANCE = 'ADVANCE',
    LOAN = 'LOAN',
    TRAINING = 'TRAINING',
    PROFESSIONAL_DEVELOPMENT = 'PROFESSIONAL_DEVELOPMENT',
    TRAVEL = 'TRAVEL',
    MEAL = 'MEAL',
    ACCOMMODATION = 'ACCOMMODATION',
    MAINTENANCE = 'MAINTENANCE',
    UTILITIES = 'UTILITIES',
    RENT = 'RENT',
    EQUIPMENT = 'EQUIPMENT',
    SOFTWARE = 'SOFTWARE',
    INTERNET = 'INTERNET',
    PHONE = 'PHONE',
    OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',
    CLEANING = 'CLEANING',
    SECURITY = 'SECURITY',
    REPAIRS = 'REPAIRS',
    MARKETING = 'MARKETING',
    LEGAL = 'LEGAL',
    CONSULTING = 'CONSULTING',
    TAX = 'TAX',
    INSURANCE = 'INSURANCE',
    BANK_CHARGE = 'BANK_CHARGE',
    MISC_INCOME = 'MISC_INCOME',
    MISC_EXPENSE = 'MISC_EXPENSE',
    OTHER = 'OTHER'
}

export enum BillingCycle {
    ONCE = 'ONCE',
    MONTHLY = 'MONTHLY',
    SEMESTER = 'SEMESTER',
    YEARLY = 'YEARLY',
    ACADEMIC_CYCLE = 'ACADEMIC_CYCLE'
}

export enum EntryStatus {
    PENDING = 'PENDING',
    UNVERIFIED = 'UNVERIFIED',
    PARTIAL = 'PARTIAL',
    PAID = 'PAID',
    OVERDUE = 'OVERDUE',
    CANCELLED = 'CANCELLED'
}

export enum EntrySource {
    SYSTEM = 'SYSTEM',
    MANUAL = 'MANUAL'
}

export enum TransactionType {
    INCOME = 'INCOME',
    EXPENSE = 'EXPENSE'
}

export enum FinanceTargetType {
    STUDENT = 'STUDENT',
    TEACHER = 'TEACHER',
    SUB_ADMIN = 'SUB_ADMIN',
    FINANCE_MANAGER = 'FINANCE_MANAGER',
    OTHER_INCOME = 'OTHER_INCOME',
    OTHER_EXPENSE = 'OTHER_EXPENSE'
}

export enum FinanceAssignmentSource {
    MANUAL = 'MANUAL',
    SECTION = 'SECTION',
    COHORT = 'COHORT',
    COURSE = 'COURSE',
    OTHER = 'OTHER'
}

export enum PaymentClaimStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    REJECTED = 'REJECTED'
}

export enum FinanceTab {
    ALL = 'ALL',
    PENDING = 'PENDING',
    OVERDUE = 'OVERDUE',
    UNVERIFIED = 'UNVERIFIED',
    PAID = 'PAID'
}

export interface FinancialStructure {
    id: string;
    organizationId: string;
    title: string;
    description: string | null;
    targetType: FinanceTargetType;
    studentId: string | null;
    teacherId: string | null;
    employeeUserId: string | null;
    category: FinanceCategory;
    amount: string;
    currency: string;
    billingCycle: BillingCycle;
    dueDay: number | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    assignments?: FinancialStructureAssignment[];
    employeeUser?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'status' | 'avatarUrl' | 'avatarUpdatedAt'> | null;
    _count?: { assignments?: number; entries?: number };
}

export interface FinancialStructureAssignment {
    id: string;
    organizationId: string;
    structureId: string;
    targetType: FinanceTargetType;
    studentId: string | null;
    teacherId: string | null;
    employeeUserId: string | null;
    entityName: string | null;
    sourceType: FinanceAssignmentSource;
    sourceId: string | null;
    isActive: boolean;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    student?: Student | null;
    teacher?: Teacher | null;
    employeeUser?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'status' | 'avatarUrl' | 'avatarUpdatedAt'> | null;
}

export interface PaymentClaim {
    id: string;
    organizationId: string;
    entryId: string;
    claimedAmount: string;
    paymentMethod: string | null;
    referenceNumber: string | null;
    receiptUrl: string | null;
    note: string | null;
    status: PaymentClaimStatus;
    claimedById: string;
    claimedAt: string;
    reviewedById: string | null;
    reviewedAt: string | null;
    confirmedAmount: string | null;
    rejectionReason: string | null;
    metadata: Record<string, unknown> | null;
    claimedBy?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
    reviewedBy?: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
    attachments?: FinanceAttachment[];
}

export interface FinanceAttachment {
    id: string;
    organizationId: string;
    entryId: string;
    claimId?: string | null;
    transactionId?: string | null;
    fileId?: string | null;
    url: string;
    filename: string;
    mimeType?: string | null;
    size?: number | null;
    uploadedById: string;
    uploadedAt: string;
    uploadedBy?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

export interface FinancialEntry {
    id: string;
    organizationId: string;
    structureId: string | null;
    assignmentId: string | null;
    title: string;
    studentId: string | null;
    teacherId: string | null;
    employeeUserId: string | null;
    amount: string;
    paidAmount: string;
    currency: string;
    source: EntrySource;
    status: EntryStatus;
    periodStart: string | null;
    periodEnd: string | null;
    dueDate: string;
    metadata: Record<string, unknown> | null;
    markedByUser: boolean;
    markedAt: string | null;
    paymentMethod: string | null;
    receiptUrl: string | null;
    confirmedByAdmin: boolean;
    confirmedAt: string | null;
    confirmedById: string | null;
    createdAt: string;
    updatedAt: string;

    // Relations (if included)
    structure?: FinancialStructure | null;
    assignment?: FinancialStructureAssignment | null;
    student?: Student | null;
    teacher?: Teacher | null;
    employeeUser?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'status' | 'avatarUrl' | 'avatarUpdatedAt'> | null;
    claims?: PaymentClaim[];
    transactions?: Transaction[];
    attachments?: FinanceAttachment[];
}

export interface Transaction {
    id: string;
    organizationId: string;
    relatedEntryId: string | null;
    type: TransactionType;
    category: FinanceCategory;
    amount: string;
    currency: string;
    description: string | null;
    paymentMethod: string | null;
    metadata: Record<string, unknown> | null;
    createdById: string | null;
    createdAt: string;

    // Relations (if included)
    relatedEntry?: FinancialEntry | null;
    createdBy?: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
    attachments?: FinanceAttachment[];
}

export interface TeacherFinanceOverview {
    teacher?: Teacher | null;
    employee?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'avatarUrl' | 'avatarUpdatedAt'> | null;
    targetType?: FinanceTargetType;
    summary: {
        currency: string;
        assignedSalaryAmount: number;
        activeStructureCount: number;
        expectedAmount: number;
        receivedAmount: number;
        balanceAmount: number;
        overdueAmount: number;
        overdueCount: number;
        pendingAmount: number;
        pendingCount: number;
        paidCount: number;
        entryCount: number;
    };
    structures: FinancialStructure[];
    recentEntries: FinancialEntry[];
    overdueEntries: FinancialEntry[];
    recentTransactions: Transaction[];
}

export interface PayrollRosterRow {
    targetType: FinanceTargetType;
    teacherId: string | null;
    employeeUserId: string | null;
    user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'status' | 'avatarUrl' | 'avatarUpdatedAt'>;
    summary: TeacherFinanceOverview['summary'];
}
export interface FinanceStats {
    totalExpectedIncome: number;
    totalCollectedIncome: number;
    overdueAmount: number;
    totalSalaryExpenses: number;
    pendingConfirmations: number;
    recentTransactions: Transaction[];
}

export type FinanceInsightCharts = Required<Pick<
    DashboardInsightCharts,
    'moneyFlowTrend' |
    'incomeSources' |
    'expenseSources' |
    'incomeSourceTrend' |
    'expenseSourceTrend' |
    'topMonths' |
    'chartRecommendations'
>> & Pick<DashboardInsightCharts, 'collectionHealth' | 'departmentFinance'>;

export type FinanceInsights = DashboardInsights & {
    charts: FinanceInsightCharts;
};


export interface UpdateAcademicCycleDto {
    name?: string;
    code?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
    gpaPolicyId?: string;
}

export interface CreateCohortDto {
    name: string;
    code: string;
    academicCycleId: string;
    isActive?: boolean;
    studentIds?: string[];
    sectionIds?: string[];
}

export interface UpdateCohortDto {
    name?: string;
    code?: string;
    academicCycleId?: string;
    isActive?: boolean;
    studentIds?: string[];
    sectionIds?: string[];
}

export interface ReassignStudentsDto {
    sourceType?: 'cohort' | 'section';
    studentIds?: string[];
    excludedStudentIds?: string[];
    fromCycleId?: string;
    toCycleId: string;
    fromCohortId?: string;
    fromSectionId?: string;
    toCohortId?: string;
    toSectionId?: string;
}

export interface CopyForwardDto {
    fromCycleId: string;
    toCycleId: string;
    copySchedules?: boolean;
    copyMaterials?: boolean;
    options?: {
        copySchedules: boolean;
        copyMaterials: boolean;
    };
}

export interface CopyForwardPreview {
    sections: number;
    schedules: number;
    assessments: number;
    materials: number;
}
