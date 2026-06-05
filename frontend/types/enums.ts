export enum Role {
    SUPER_ADMIN = 'SUPER_ADMIN',
    PLATFORM_ADMIN = 'PLATFORM_ADMIN',
    ORG_ADMIN = 'ORG_ADMIN',
    ORG_MANAGER = 'ORG_MANAGER',
    TEACHER = 'TEACHER',
    STUDENT = 'STUDENT',
}

export enum OrgStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    SUSPENDED = 'SUSPENDED',
}

export enum MailStatus {
    OPEN = 'OPEN',
    IN_PROGRESS = 'IN_PROGRESS',
    AWAITING_RESPONSE = 'AWAITING_RESPONSE',
    RESOLVED = 'RESOLVED',
    CLOSED = 'CLOSED',
    NO_REPLY = 'NO_REPLY',
}

export enum TeacherStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    ON_LEAVE = 'ON_LEAVE',
    EMERITUS = 'EMERITUS',
    DELETED = 'DELETED',
}

export enum StudentStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    ALUMNI = 'ALUMNI',
    DELETED = 'DELETED',
}

export enum OrganizationType {
    KINDERGARTEN = 'KINDERGARTEN',
    PRE_SCHOOL = 'PRE_SCHOOL',
    PRIMARY_SCHOOL = 'PRIMARY_SCHOOL',
    MIDDLE_SCHOOL = 'MIDDLE_SCHOOL',
    HIGH_SCHOOL = 'HIGH_SCHOOL',
    COLLEGE = 'COLLEGE',
    UNIVERSITY = 'UNIVERSITY',
    VOCATIONAL_SCHOOL = 'VOCATIONAL_SCHOOL',
    INSTITUTE = 'INSTITUTE',
    ACADEMY = 'ACADEMY',
    TUTORING_CENTER = 'TUTORING_CENTER',
    ONLINE_SCHOOL = 'ONLINE_SCHOOL',
    OTHER = 'OTHER',
}

export enum AssessmentType {
    ASSIGNMENT = 'ASSIGNMENT',
    QUIZ = 'QUIZ',
    MIDTERM = 'MIDTERM',
    FINAL = 'FINAL',
    PROJECT = 'PROJECT',
}

export enum GradeStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    FINALIZED = 'FINALIZED',
}

// ── Mail Categories (context-aware) ──────────────────────────────────────────
export enum MailCategory {
    // Platform-level
    ACCOUNT_STATUS = 'ACCOUNT_STATUS',
    BUG_REPORT = 'BUG_REPORT',
    FEATURE_REQUEST = 'FEATURE_REQUEST',
    BILLING = 'BILLING',
    PLATFORM_SUPPORT = 'PLATFORM_SUPPORT',
    // Platform → Org Admin
    ORG_COMPLIANCE = 'ORG_COMPLIANCE',
    ORG_ACCOUNT = 'ORG_ACCOUNT',
    PLATFORM_NOTICE = 'PLATFORM_NOTICE',
    // Org Admin/Manager → Staff
    TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
    SCHEDULE_CHANGE = 'SCHEDULE_CHANGE',
    POLICY_UPDATE = 'POLICY_UPDATE',
    PERFORMANCE = 'PERFORMANCE',
    GENERAL_NOTICE = 'GENERAL_NOTICE',
    // Teacher → Manager/Teacher
    LEAVE_REQUEST = 'LEAVE_REQUEST',
    RESOURCE_REQUEST = 'RESOURCE_REQUEST',
    SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',
    COLLABORATION = 'COLLABORATION',
    // Universal
    GENERAL_INQUIRY = 'GENERAL_INQUIRY',
    OTHER = 'OTHER',
}

// ── Communication System Enums ────────────────────────────────────────────────
export enum ChatType {
    DIRECT = 'DIRECT',
    GROUP = 'GROUP',
}

export enum ChatParticipantRole {
    ADMIN = 'ADMIN',
    MOD = 'MOD',
    MEMBER = 'MEMBER',
}

export enum ChatMessageType {
    TEXT = 'TEXT',
    SYSTEM = 'SYSTEM',
}

export enum TargetType {
    GLOBAL = 'GLOBAL',
    ORG = 'ORG',
    ROLE = 'ROLE',
    SECTION = 'SECTION',
}

export enum AnnouncementPriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
    URGENT = 'URGENT'
}

export enum ThemeMode {
    LIGHT = 'LIGHT',
    DARK = 'DARK',
    SYSTEM = 'SYSTEM',
}

export enum AttendanceStatus {
    PRESENT = 'PRESENT',
    ABSENT = 'ABSENT',
    LATE = 'LATE',
    EXCUSED = 'EXCUSED',
}

// Insights
export enum Tone {
    DEFAULT = 'DEFAULT',
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    WARNING = 'WARNING',
    DANGER = 'DANGER',
}

// Shared lowercase UI variants used by badges, banners, buttons, and status helpers.
// This is intentionally an enum-like const object so JSX string literals such as
// variant="success" remain assignable without noisy casts.
export const UiVariant = {
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    DANGER: 'danger',
    NEUTRAL: 'neutral',
    PURPLE: 'purple',
    BLACK: 'black',
    GHOST: 'ghost',
    OUTLINE: 'outline',
} as const;

export type UiVariant = typeof UiVariant[keyof typeof UiVariant];
export type FeedbackVariant = typeof UiVariant.SUCCESS | typeof UiVariant.ERROR | typeof UiVariant.WARNING | typeof UiVariant.INFO | typeof UiVariant.NEUTRAL;
export type BadgeVariant = FeedbackVariant | typeof UiVariant.PRIMARY | typeof UiVariant.SECONDARY | typeof UiVariant.PURPLE;
export type StatusBannerVariant = typeof UiVariant.INFO | typeof UiVariant.SUCCESS | typeof UiVariant.WARNING | typeof UiVariant.DANGER | typeof UiVariant.NEUTRAL;
export type ButtonVariant = typeof UiVariant.PRIMARY | typeof UiVariant.SECONDARY | typeof UiVariant.DANGER | typeof UiVariant.SUCCESS | typeof UiVariant.WARNING | typeof UiVariant.BLACK | typeof UiVariant.GHOST | typeof UiVariant.OUTLINE;
export type StatToneVariant = typeof UiVariant.SUCCESS | typeof UiVariant.DANGER | typeof UiVariant.WARNING | typeof UiVariant.INFO;
export type ToastVariant = typeof UiVariant.SUCCESS | typeof UiVariant.ERROR | typeof UiVariant.INFO;
