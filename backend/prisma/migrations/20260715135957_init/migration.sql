-- CreateEnum
CREATE TYPE "GpaCalculationMethod" AS ENUM ('SIMPLE_AVERAGE', 'WEIGHTED_BY_CREDIT_HOURS');

-- CreateEnum
CREATE TYPE "GpaRounding" AS ENUM ('NONE', 'ONE_DECIMAL', 'TWO_DECIMALS');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'SUB_ADMIN', 'TEACHER', 'STUDENT', 'GUARDIAN', 'PLATFORM_ADMIN', 'ORG_MANAGER', 'FINANCE_MANAGER');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_RESPONSE', 'RESOLVED', 'CLOSED', 'NO_REPLY');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'EMERITUS', 'DELETED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ALUMNI', 'DELETED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('ASSIGNMENT', 'QUIZ', 'MIDTERM', 'FINAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('TEACHER', 'COURSE');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LAB', 'COMPUTER_LAB', 'SCIENCE_LAB', 'AUDITORIUM', 'OFFICE', 'ADMIN_OFFICE', 'STAFF_ROOM', 'TEACHER_ROOM', 'PRINCIPAL_OFFICE', 'FINANCE_OFFICE', 'EXAM_ROOM', 'MEETING_ROOM', 'SEMINAR_ROOM', 'LIBRARY', 'HALL', 'LECTURE_HALL', 'SPORTS_ROOM', 'MEDICAL_ROOM', 'COUNSELING_ROOM', 'STORAGE', 'CAFETERIA', 'PRAYER_ROOM', 'RECEPTION', 'SECURITY_ROOM', 'WASHROOM', 'OTHER');

-- CreateEnum
CREATE TYPE "DepartmentScopeType" AS ENUM ('ALL', 'SELECTED');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LinkedAccountProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'ALUMNI', 'EMERITUS', 'DELETED');

-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "ChatParticipantRole" AS ENUM ('ADMIN', 'MOD', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('DIRECT_MESSAGE');

-- CreateEnum
CREATE TYPE "E2EEContentType" AS ENUM ('CHAT_MESSAGE', 'MAIL_MESSAGE', 'MAIL_SUBJECT');

-- CreateEnum
CREATE TYPE "E2EEDeviceTrustStatus" AS ENUM ('PENDING', 'TRUSTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "E2EEApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "E2EEHistoryKeyScope" AS ENUM ('CHAT_USER');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('GLOBAL', 'ORG', 'ROLE', 'SECTION', 'COURSE', 'COHORT');

-- CreateEnum
CREATE TYPE "AISubscriptionPlan" AS ENUM ('NONE', 'STARTER', 'GROWTH', 'SCALE');

-- CreateEnum
CREATE TYPE "AISubscriptionOwnerType" AS ENUM ('ORGANIZATION', 'USER');

-- CreateEnum
CREATE TYPE "AISubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'CANCELED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "AILimitMode" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "AIUsageSourceType" AS ENUM ('ORGANIZATION', 'PERSONAL');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('HOLIDAY', 'EXAM_BREAK', 'EVENT', 'CLOSURE');

-- CreateEnum
CREATE TYPE "HolidayMatchMode" AS ENUM ('SINGLE_DAY', 'DATE_RANGE', 'WEEKDAYS_IN_RANGE', 'DAILY_IN_RANGE');

-- CreateEnum
CREATE TYPE "PreferenceWindowKind" AS ENUM ('SECTION_CHOICE', 'COURSE_CHOICE');

-- CreateEnum
CREATE TYPE "PreferenceWindowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PreferenceTargetType" AS ENUM ('COURSE', 'COHORT', 'SECTION');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('OFFICIAL', 'AD_HOC');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('MANUAL', 'COHORT');

-- CreateEnum
CREATE TYPE "FinanceCategory" AS ENUM ('TUITION', 'TRANSPORT', 'LIBRARY', 'LIBRARY_FINE', 'EXAM', 'SALARY', 'BONUS', 'ADMISSION', 'HOSTEL', 'ACTIVITY', 'REIMBURSEMENT', 'REFUND', 'LATE_FEE', 'FINE', 'BOOKS_SUPPLIES', 'STATIONERY', 'UNIFORM', 'LAB', 'ID_CARD', 'CERTIFICATE', 'TRANSCRIPT', 'GRADUATION', 'REGISTRATION', 'APPLICATION_FEE', 'PROCESSING_FEE', 'DEVELOPMENT_FEE', 'BUILDING_FUND', 'CANTEEN', 'CAFETERIA', 'MEDICAL', 'HEALTH', 'SPORTS', 'ARTS', 'MUSIC', 'TECHNOLOGY', 'PRINTING', 'PARKING', 'SECURITY_DEPOSIT', 'FIELD_TRIP', 'EVENT', 'DONATION', 'GRANT', 'SCHOLARSHIP', 'DISCOUNT', 'WAIVER', 'VENDOR_PAYMENT', 'ALLOWANCE', 'OVERTIME', 'COMMISSION', 'ADVANCE', 'LOAN', 'TRAINING', 'PROFESSIONAL_DEVELOPMENT', 'TRAVEL', 'MEAL', 'ACCOMMODATION', 'MAINTENANCE', 'UTILITIES', 'RENT', 'EQUIPMENT', 'SOFTWARE', 'INTERNET', 'PHONE', 'OFFICE_SUPPLIES', 'CLEANING', 'SECURITY', 'REPAIRS', 'MARKETING', 'LEGAL', 'CONSULTING', 'TAX', 'INSURANCE', 'BANK_CHARGE', 'MISC_INCOME', 'MISC_EXPENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('ONCE', 'MONTHLY', 'SEMESTER', 'YEARLY', 'ACADEMIC_CYCLE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'UNVERIFIED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('SYSTEM', 'MANUAL');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceTargetType" AS ENUM ('STUDENT', 'TEACHER', 'SUB_ADMIN', 'FINANCE_MANAGER', 'OTHER_INCOME', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceAssignmentSource" AS ENUM ('MANUAL', 'SECTION', 'COHORT', 'COURSE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactEmailVerifiedAt" TIMESTAMP(3),
    "contactEmailVerificationCodeHash" TEXT,
    "contactEmailVerificationExpiresAt" TIMESTAMP(3),
    "contactEmailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastVerificationSentAt" TIMESTAMP(3),
    "phone" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'PENDING',
    "statusHistory" JSONB,
    "avatarUpdatedAt" TIMESTAMP(3),
    "logoUrl" TEXT,
    "accentColor" JSONB,
    "parentOrgId" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SUPER_ADMIN',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "themeMode" "ThemeMode" NOT NULL DEFAULT 'SYSTEM',
    "avatarUrl" TEXT,
    "avatarUpdatedAt" TIMESTAMP(3),
    "departmentScopeType" "DepartmentScopeType" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "LinkedAccountProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "organizationId" TEXT,
    "module" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "financeStructureId" TEXT,
    "financeEntryId" TEXT,
    "paymentClaimId" TEXT,
    "transactionId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "location" TEXT,
    "ip" TEXT,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEncryptionIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "identityPublicKey" TEXT NOT NULL,
    "publicKeyFingerprint" TEXT,
    "signingPublicKey" TEXT,
    "signingPublicKeyFingerprint" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'libsodium:x25519+ed25519',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "UserEncryptionIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedEncryptionDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identityId" TEXT,
    "clientDeviceId" TEXT NOT NULL,
    "displayName" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "keyAgreementPublicKey" TEXT NOT NULL,
    "keyAgreementPublicKeyFingerprint" TEXT,
    "signingPublicKey" TEXT,
    "signingPublicKeyFingerprint" TEXT,
    "algorithm" TEXT NOT NULL DEFAULT 'libsodium:x25519+ed25519',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "trustStatus" "E2EEDeviceTrustStatus" NOT NULL DEFAULT 'TRUSTED',
    "approvalRequestedAt" TIMESTAMP(3),
    "trustedAt" TIMESTAMP(3),
    "approvedByDeviceId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "TrustedEncryptionDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "E2EEDeviceApprovalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pendingDeviceId" TEXT NOT NULL,
    "approverDeviceId" TEXT,
    "status" "E2EEApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "E2EEDeviceApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'Unassigned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "designation" TEXT NOT NULL DEFAULT 'Unassigned',
    "education" TEXT NOT NULL DEFAULT 'Unassigned',
    "address" TEXT,
    "bloodGroup" TEXT,
    "department" TEXT,
    "departmentScopeType" "DepartmentScopeType" NOT NULL DEFAULT 'ALL',
    "emergencyContact" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianStudent" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "relationshipLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "creditHours" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "landmark" TEXT,
    "directionsNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "mapWidth" DOUBLE PRECISION,
    "mapHeight" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" TEXT NOT NULL DEFAULT 'Unspecified',
    "type" "RoomType",
    "capacity" INTEGER,
    "description" TEXT,
    "landmark" TEXT,
    "directionsNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "mapWidth" DOUBLE PRECISION,
    "mapHeight" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "BuildingDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "TeacherDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "StudentDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "ManagerDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubAdminDepartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "SubAdminDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpaPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "method" "GpaCalculationMethod" NOT NULL DEFAULT 'WEIGHTED_BY_CREDIT_HOURS',
    "rounding" "GpaRounding" NOT NULL DEFAULT 'TWO_DECIMALS',
    "gradeRules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "room" TEXT,
    "defaultRoomId" TEXT,
    "courseId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "cohortId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "academicCycleId" TEXT,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'MANUAL',
    "isExcludedFromCohort" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cohortId" TEXT,
    "registrationNumber" TEXT NOT NULL DEFAULT 'TEMP_ID',
    "rollNumber" TEXT NOT NULL DEFAULT 'TEMP_ROLL',
    "fatherName" TEXT,
    "age" INTEGER,
    "address" TEXT,
    "major" TEXT NOT NULL DEFAULT 'Unassigned',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodGroup" TEXT,
    "department" TEXT,
    "primaryDepartmentId" TEXT,
    "emergencyContact" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'Unassigned',
    "graduationDate" TIMESTAMP(3),
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "allowSubmissions" BOOLEAN NOT NULL DEFAULT true,
    "externalLink" TEXT,
    "isVideoLink" BOOLEAN NOT NULL DEFAULT false,
    "academicCycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "status" "GradeStatus" NOT NULL DEFAULT 'DRAFT',
    "academicCycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "lastCorrectedById" TEXT,
    "lastCorrectedAt" TIMESTAMP(3),
    "correctionReason" TEXT,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "message" TEXT,
    "academicCycleId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mail" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "MailStatus" NOT NULL DEFAULT 'OPEN',
    "creatorId" TEXT NOT NULL,
    "creatorRole" TEXT NOT NULL,
    "organizationId" TEXT,
    "targetRole" TEXT,
    "assigneeId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailUserView" (
    "userId" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailUserView_pkey" PRIMARY KEY ("userId","mailId")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailActionLog" (
    "id" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "publicId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT 'raw',
    "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
    "fileKind" TEXT NOT NULL DEFAULT 'document',
    "extension" TEXT,
    "sha256" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'PASSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "type" "ChatType" NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "avatarUpdatedAt" TIMESTAMP(3),
    "organizationId" TEXT,
    "creatorId" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatParticipant" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChatParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReadMessageId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiddenAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMembershipHistory" (
    "id" TEXT NOT NULL,
    "chatParticipantId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMembershipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "organizationId" TEXT,
    "content" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "replyToId" TEXT,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptedContent" (
    "id" TEXT NOT NULL,
    "contentType" "E2EEContentType" NOT NULL,
    "chatMessageId" TEXT,
    "mailMessageId" TEXT,
    "mailId" TEXT,
    "encryptionVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "authTag" TEXT,
    "associatedData" JSONB,
    "contentKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncryptedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "E2EEKeyEnvelope" (
    "id" TEXT NOT NULL,
    "encryptedContentId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "senderDeviceId" TEXT,
    "deviceKeyVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2EEKeyEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatHistoryKey" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "E2EEHistoryKeyScope" NOT NULL DEFAULT 'CHAT_USER',
    "epoch" INTEGER NOT NULL DEFAULT 1,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "algorithm" TEXT NOT NULL DEFAULT 'libsodium:xchacha20poly1305-ietf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ChatHistoryKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "E2EEHistoryKeyDeviceEnvelope" (
    "id" TEXT NOT NULL,
    "historyKeyId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "senderDeviceId" TEXT,
    "deviceKeyVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "E2EEContentHistoryKeyEnvelope" (
    "id" TEXT NOT NULL,
    "encryptedContentId" TEXT NOT NULL,
    "historyKeyId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "nonce" TEXT,
    "associatedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "E2EEContentHistoryKeyEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCommunicationBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "chatId" TEXT,
    "organizationId" TEXT,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'DIRECT_MESSAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCommunicationBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actionUrl" TEXT,
    "type" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISubscription" (
    "id" TEXT NOT NULL,
    "ownerType" "AISubscriptionOwnerType" NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "plan" "AISubscriptionPlan" NOT NULL DEFAULT 'NONE',
    "status" "AISubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "limitMode" "AILimitMode" NOT NULL DEFAULT 'HARD',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "lemonSqueezyCustomerId" TEXT,
    "lemonSqueezySubscriptionId" TEXT,
    "lemonSqueezyVariantId" TEXT,
    "lemonSqueezyPortalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIOrgAccessPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "allowSubAdmins" BOOLEAN NOT NULL DEFAULT false,
    "allowManagers" BOOLEAN NOT NULL DEFAULT false,
    "allowFinanceManagers" BOOLEAN NOT NULL DEFAULT false,
    "allowTeachers" BOOLEAN NOT NULL DEFAULT false,
    "allowStudents" BOOLEAN NOT NULL DEFAULT false,
    "allowGuardians" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIOrgAccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRoleCreditPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIRoleCreditPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "sourceType" "AIUsageSourceType" NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "role" "Role",
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "creditUsed" INTEGER NOT NULL DEFAULT 0,
    "providerTokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    "overageCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIToolCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "subscriptionId" TEXT,
    "sourceType" "AIUsageSourceType",
    "toolName" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "creditEstimate" INTEGER,
    "providerTokenEstimate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIToolCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "subscriptionId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT,
    "actionUrl" TEXT,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "creatorId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceWindow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PreferenceWindowKind" NOT NULL,
    "status" "PreferenceWindowStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "announcementId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceWindowOption" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "targetType" "PreferenceTargetType" NOT NULL,
    "courseId" TEXT,
    "sectionId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PreferenceWindowOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceWindowAudience" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "targetType" "PreferenceTargetType" NOT NULL,
    "courseId" TEXT,
    "cohortId" TEXT,
    "sectionId" TEXT,

    CONSTRAINT "PreferenceWindowAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceSubmission" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceRank" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "PreferenceRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "HolidayType" NOT NULL DEFAULT 'HOLIDAY',
    "matchMode" "HolidayMatchMode" NOT NULL DEFAULT 'SINGLE_DAY',
    "departmentScopeType" "DepartmentScopeType" NOT NULL DEFAULT 'ALL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isFullDay" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayDepartment" (
    "holidayId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayDepartment_pkey" PRIMARY KEY ("holidayId","departmentId")
);

-- CreateTable
CREATE TABLE "EvaluationWindow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "courseId" TEXT,
    "sectionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT,
    "academicCycleId" TEXT NOT NULL,
    "windowId" TEXT,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenById" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionSchedule" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "academicCycleId" TEXT,
    "day" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "type" "ScheduleType" NOT NULL DEFAULT 'OFFICIAL',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "roomId" TEXT,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "academicCycleId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "academicCycleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "links" TEXT[],
    "isVideoLink" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "gpaPolicyId" TEXT,
    "gpaPolicySnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicCycleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "academicCycleId" TEXT,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'MANUAL',
    "wasExcluded" BOOLEAN NOT NULL DEFAULT false,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "EnrollmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMembershipHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "academicCycleId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "CohortMembershipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStructure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetType" "FinanceTargetType" NOT NULL DEFAULT 'STUDENT',
    "studentId" TEXT,
    "teacherId" TEXT,
    "employeeUserId" TEXT,
    "category" "FinanceCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "BillingCycle" NOT NULL,
    "dueDay" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStructureAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "targetType" "FinanceTargetType" NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "employeeUserId" TEXT,
    "entityName" TEXT,
    "sourceType" "FinanceAssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialStructureAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "structureId" TEXT,
    "assignmentId" TEXT,
    "title" TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "employeeUserId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "markedByUser" BOOLEAN NOT NULL DEFAULT false,
    "markedAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "paymentMethod" TEXT,
    "confirmedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "source" "EntrySource" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "claimedAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "receiptUrl" TEXT,
    "note" TEXT,
    "status" "PaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimedById" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "confirmedAmount" DECIMAL(12,2),
    "rejectionReason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "claimId" TEXT,
    "transactionId" TEXT,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "FinanceCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "metadata" JSONB,
    "relatedEntryId" TEXT,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SectionToTeacher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SectionToTeacher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MailParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MailParticipants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "LinkedAccount_userId_idx" ON "LinkedAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_provider_providerAccountId_key" ON "LinkedAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_userId_provider_key" ON "LinkedAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usedAt_idx" ON "PasswordResetToken"("usedAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_financeStructureId_idx" ON "AuditLog"("financeStructureId");

-- CreateIndex
CREATE INDEX "AuditLog_financeEntryId_idx" ON "AuditLog"("financeEntryId");

-- CreateIndex
CREATE INDEX "AuditLog_paymentClaimId_idx" ON "AuditLog"("paymentClaimId");

-- CreateIndex
CREATE INDEX "AuditLog_transactionId_idx" ON "AuditLog"("transactionId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

-- CreateIndex
CREATE INDEX "Session_isActive_idx" ON "Session"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserEncryptionIdentity_userId_key" ON "UserEncryptionIdentity"("userId");

-- CreateIndex
CREATE INDEX "UserEncryptionIdentity_userId_keyVersion_idx" ON "UserEncryptionIdentity"("userId", "keyVersion");

-- CreateIndex
CREATE INDEX "TrustedEncryptionDevice_identityId_idx" ON "TrustedEncryptionDevice"("identityId");

-- CreateIndex
CREATE INDEX "TrustedEncryptionDevice_userId_trustStatus_revokedAt_idx" ON "TrustedEncryptionDevice"("userId", "trustStatus", "revokedAt");

-- CreateIndex
CREATE INDEX "TrustedEncryptionDevice_clientDeviceId_idx" ON "TrustedEncryptionDevice"("clientDeviceId");

-- CreateIndex
CREATE INDEX "TrustedEncryptionDevice_approvedByDeviceId_idx" ON "TrustedEncryptionDevice"("approvedByDeviceId");

-- CreateIndex
CREATE INDEX "TrustedEncryptionDevice_revokedById_idx" ON "TrustedEncryptionDevice"("revokedById");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedEncryptionDevice_userId_clientDeviceId_key" ON "TrustedEncryptionDevice"("userId", "clientDeviceId");

-- CreateIndex
CREATE INDEX "E2EEDeviceApprovalRequest_userId_status_idx" ON "E2EEDeviceApprovalRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "E2EEDeviceApprovalRequest_pendingDeviceId_status_idx" ON "E2EEDeviceApprovalRequest"("pendingDeviceId", "status");

-- CreateIndex
CREATE INDEX "E2EEDeviceApprovalRequest_approverDeviceId_idx" ON "E2EEDeviceApprovalRequest"("approverDeviceId");

-- CreateIndex
CREATE INDEX "E2EEDeviceApprovalRequest_requestedAt_idx" ON "E2EEDeviceApprovalRequest"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE INDEX "Teacher_organizationId_idx" ON "Teacher"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianProfile_userId_key" ON "GuardianProfile"("userId");

-- CreateIndex
CREATE INDEX "GuardianProfile_organizationId_idx" ON "GuardianProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianStudent_studentId_key" ON "GuardianStudent"("studentId");

-- CreateIndex
CREATE INDEX "GuardianStudent_guardianId_idx" ON "GuardianStudent"("guardianId");

-- CreateIndex
CREATE INDEX "GuardianStudent_organizationId_idx" ON "GuardianStudent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianStudent_guardianId_studentId_key" ON "GuardianStudent"("guardianId", "studentId");

-- CreateIndex
CREATE INDEX "Course_organizationId_idx" ON "Course"("organizationId");

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "Course"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_organizationId_code_key" ON "Course"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Building_organizationId_idx" ON "Building"("organizationId");

-- CreateIndex
CREATE INDEX "Building_isActive_idx" ON "Building"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Building_organizationId_name_key" ON "Building"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Building_organizationId_code_key" ON "Building"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Room_organizationId_idx" ON "Room"("organizationId");

-- CreateIndex
CREATE INDEX "Room_buildingId_idx" ON "Room"("buildingId");

-- CreateIndex
CREATE INDEX "Room_isActive_idx" ON "Room"("isActive");

-- CreateIndex
CREATE INDEX "Room_type_idx" ON "Room"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Room_organizationId_buildingId_name_key" ON "Room"("organizationId", "buildingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_organizationId_code_key" ON "Room"("organizationId", "code");

-- CreateIndex
CREATE INDEX "BuildingDepartment_organizationId_idx" ON "BuildingDepartment"("organizationId");

-- CreateIndex
CREATE INDEX "BuildingDepartment_buildingId_idx" ON "BuildingDepartment"("buildingId");

-- CreateIndex
CREATE INDEX "BuildingDepartment_departmentId_idx" ON "BuildingDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildingDepartment_buildingId_departmentId_key" ON "BuildingDepartment"("buildingId", "departmentId");

-- CreateIndex
CREATE INDEX "TeacherDepartment_organizationId_idx" ON "TeacherDepartment"("organizationId");

-- CreateIndex
CREATE INDEX "TeacherDepartment_departmentId_idx" ON "TeacherDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDepartment_teacherId_departmentId_key" ON "TeacherDepartment"("teacherId", "departmentId");

-- CreateIndex
CREATE INDEX "StudentDepartment_organizationId_idx" ON "StudentDepartment"("organizationId");

-- CreateIndex
CREATE INDEX "StudentDepartment_departmentId_idx" ON "StudentDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartment_studentId_departmentId_key" ON "StudentDepartment"("studentId", "departmentId");

-- CreateIndex
CREATE INDEX "ManagerDepartment_organizationId_idx" ON "ManagerDepartment"("organizationId");

-- CreateIndex
CREATE INDEX "ManagerDepartment_departmentId_idx" ON "ManagerDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerDepartment_teacherId_departmentId_key" ON "ManagerDepartment"("teacherId", "departmentId");

-- CreateIndex
CREATE INDEX "SubAdminDepartment_organizationId_idx" ON "SubAdminDepartment"("organizationId");

-- CreateIndex
CREATE INDEX "SubAdminDepartment_departmentId_idx" ON "SubAdminDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAdminDepartment_userId_departmentId_key" ON "SubAdminDepartment"("userId", "departmentId");

-- CreateIndex
CREATE INDEX "GpaPolicy_organizationId_idx" ON "GpaPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "GpaPolicy_isDefault_idx" ON "GpaPolicy"("isDefault");

-- CreateIndex
CREATE INDEX "GpaPolicy_isArchived_idx" ON "GpaPolicy"("isArchived");

-- CreateIndex
CREATE INDEX "Section_organizationId_idx" ON "Section"("organizationId");

-- CreateIndex
CREATE INDEX "Section_courseId_idx" ON "Section"("courseId");

-- CreateIndex
CREATE INDEX "Section_defaultRoomId_idx" ON "Section"("defaultRoomId");

-- CreateIndex
CREATE INDEX "Section_academicCycleId_idx" ON "Section"("academicCycleId");

-- CreateIndex
CREATE INDEX "Section_cohortId_idx" ON "Section"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_organizationId_code_key" ON "Section"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_academicCycleId_idx" ON "Enrollment"("academicCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_sectionId_key" ON "Enrollment"("studentId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_organizationId_idx" ON "Student"("organizationId");

-- CreateIndex
CREATE INDEX "Student_cohortId_idx" ON "Student"("cohortId");

-- CreateIndex
CREATE INDEX "Student_primaryDepartmentId_idx" ON "Student"("primaryDepartmentId");

-- CreateIndex
CREATE INDEX "Assessment_sectionId_idx" ON "Assessment"("sectionId");

-- CreateIndex
CREATE INDEX "Assessment_courseId_idx" ON "Assessment"("courseId");

-- CreateIndex
CREATE INDEX "Assessment_dueDate_idx" ON "Assessment"("dueDate");

-- CreateIndex
CREATE INDEX "Assessment_academicCycleId_idx" ON "Assessment"("academicCycleId");

-- CreateIndex
CREATE INDEX "Grade_studentId_idx" ON "Grade"("studentId");

-- CreateIndex
CREATE INDEX "Grade_academicCycleId_idx" ON "Grade"("academicCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_assessmentId_studentId_key" ON "Grade"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "Submission_academicCycleId_idx" ON "Submission"("academicCycleId");

-- CreateIndex
CREATE INDEX "Mail_creatorId_idx" ON "Mail"("creatorId");

-- CreateIndex
CREATE INDEX "Mail_organizationId_idx" ON "Mail"("organizationId");

-- CreateIndex
CREATE INDEX "Mail_status_idx" ON "Mail"("status");

-- CreateIndex
CREATE INDEX "Mail_assigneeId_idx" ON "Mail"("assigneeId");

-- CreateIndex
CREATE INDEX "MailMessage_mailId_idx" ON "MailMessage"("mailId");

-- CreateIndex
CREATE INDEX "MailMessage_senderId_idx" ON "MailMessage"("senderId");

-- CreateIndex
CREATE INDEX "MailActionLog_mailId_idx" ON "MailActionLog"("mailId");

-- CreateIndex
CREATE INDEX "File_entityType_entityId_idx" ON "File"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "File_sha256_idx" ON "File"("sha256");

-- CreateIndex
CREATE INDEX "Chat_organizationId_idx" ON "Chat"("organizationId");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatParticipant_chatId_userId_key" ON "ChatParticipant"("chatId", "userId");

-- CreateIndex
CREATE INDEX "ChatMembershipHistory_chatParticipantId_idx" ON "ChatMembershipHistory"("chatParticipantId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedContent_chatMessageId_key" ON "EncryptedContent"("chatMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedContent_mailMessageId_key" ON "EncryptedContent"("mailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedContent_mailId_key" ON "EncryptedContent"("mailId");

-- CreateIndex
-- CreateIndex
CREATE INDEX "EncryptedContent_contentType_idx" ON "EncryptedContent"("contentType");

-- CreateIndex
CREATE INDEX "EncryptedContent_chatMessageId_idx" ON "EncryptedContent"("chatMessageId");

-- CreateIndex
CREATE INDEX "EncryptedContent_mailMessageId_idx" ON "EncryptedContent"("mailMessageId");

-- CreateIndex
CREATE INDEX "EncryptedContent_mailId_idx" ON "EncryptedContent"("mailId");

-- CreateIndex
-- CreateIndex
CREATE INDEX "EncryptedContent_encryptionVersion_idx" ON "EncryptedContent"("encryptionVersion");

-- CreateIndex
CREATE INDEX "EncryptedContent_createdAt_idx" ON "EncryptedContent"("createdAt");

-- CreateIndex
CREATE INDEX "E2EEKeyEnvelope_recipientUserId_idx" ON "E2EEKeyEnvelope"("recipientUserId");

-- CreateIndex
CREATE INDEX "E2EEKeyEnvelope_trustedDeviceId_idx" ON "E2EEKeyEnvelope"("trustedDeviceId");

-- CreateIndex
CREATE INDEX "E2EEKeyEnvelope_senderDeviceId_idx" ON "E2EEKeyEnvelope"("senderDeviceId");

-- CreateIndex
CREATE INDEX "E2EEKeyEnvelope_createdAt_idx" ON "E2EEKeyEnvelope"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "E2EEKeyEnvelope_encryptedContentId_trustedDeviceId_key" ON "E2EEKeyEnvelope"("encryptedContentId", "trustedDeviceId");

-- CreateIndex
CREATE INDEX "ChatHistoryKey_chatId_epoch_idx" ON "ChatHistoryKey"("chatId", "epoch");

-- CreateIndex
CREATE INDEX "ChatHistoryKey_userId_idx" ON "ChatHistoryKey"("userId");

-- CreateIndex
CREATE INDEX "ChatHistoryKey_scope_idx" ON "ChatHistoryKey"("scope");

-- CreateIndex
CREATE INDEX "ChatHistoryKey_revokedAt_idx" ON "ChatHistoryKey"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatHistoryKey_chatId_userId_epoch_key" ON "ChatHistoryKey"("chatId", "userId", "epoch");

-- CreateIndex
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_recipientUserId_idx" ON "E2EEHistoryKeyDeviceEnvelope"("recipientUserId");

-- CreateIndex
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_trustedDeviceId_idx" ON "E2EEHistoryKeyDeviceEnvelope"("trustedDeviceId");

-- CreateIndex
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_senderDeviceId_idx" ON "E2EEHistoryKeyDeviceEnvelope"("senderDeviceId");

-- CreateIndex
CREATE INDEX "E2EEHistoryKeyDeviceEnvelope_createdAt_idx" ON "E2EEHistoryKeyDeviceEnvelope"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "E2EEHistoryKeyDeviceEnvelope_historyKeyId_trustedDeviceId_key" ON "E2EEHistoryKeyDeviceEnvelope"("historyKeyId", "trustedDeviceId");

-- CreateIndex
CREATE INDEX "E2EEContentHistoryKeyEnvelope_historyKeyId_idx" ON "E2EEContentHistoryKeyEnvelope"("historyKeyId");

-- CreateIndex
CREATE INDEX "E2EEContentHistoryKeyEnvelope_recipientUserId_idx" ON "E2EEContentHistoryKeyEnvelope"("recipientUserId");

-- CreateIndex
CREATE INDEX "E2EEContentHistoryKeyEnvelope_createdAt_idx" ON "E2EEContentHistoryKeyEnvelope"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "E2EEContentHistoryKeyEnvelope_encryptedContentId_historyKey_key" ON "E2EEContentHistoryKeyEnvelope"("encryptedContentId", "historyKeyId");

-- CreateIndex
CREATE INDEX "UserCommunicationBlock_userId_idx" ON "UserCommunicationBlock"("userId");

-- CreateIndex
CREATE INDEX "UserCommunicationBlock_targetUserId_idx" ON "UserCommunicationBlock"("targetUserId");

-- CreateIndex
CREATE INDEX "UserCommunicationBlock_chatId_channel_idx" ON "UserCommunicationBlock"("chatId", "channel");

-- CreateIndex
CREATE INDEX "UserCommunicationBlock_organizationId_idx" ON "UserCommunicationBlock"("organizationId");

-- CreateIndex
CREATE INDEX "UserCommunicationBlock_channel_idx" ON "UserCommunicationBlock"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "UserCommunicationBlock_userId_targetUserId_channel_key" ON "UserCommunicationBlock"("userId", "targetUserId", "channel");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AISubscription_ownerType_idx" ON "AISubscription"("ownerType");

-- CreateIndex
CREATE INDEX "AISubscription_plan_idx" ON "AISubscription"("plan");

-- CreateIndex
CREATE INDEX "AISubscription_status_idx" ON "AISubscription"("status");

-- CreateIndex
CREATE INDEX "AISubscription_lemonSqueezyCustomerId_idx" ON "AISubscription"("lemonSqueezyCustomerId");

-- CreateIndex
CREATE INDEX "AISubscription_lemonSqueezySubscriptionId_idx" ON "AISubscription"("lemonSqueezySubscriptionId");

-- CreateIndex
CREATE INDEX "AISubscription_organizationId_idx" ON "AISubscription"("organizationId");

-- CreateIndex
CREATE INDEX "AISubscription_userId_idx" ON "AISubscription"("userId");

-- CreateIndex
CREATE INDEX "AISubscription_currentPeriodEnd_idx" ON "AISubscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AISubscription_ownerType_organizationId_key" ON "AISubscription"("ownerType", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AISubscription_ownerType_userId_key" ON "AISubscription"("ownerType", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIOrgAccessPolicy_organizationId_key" ON "AIOrgAccessPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "AIRoleCreditPolicy_organizationId_idx" ON "AIRoleCreditPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "AIRoleCreditPolicy_role_idx" ON "AIRoleCreditPolicy"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AIRoleCreditPolicy_organizationId_role_key" ON "AIRoleCreditPolicy"("organizationId", "role");

-- CreateIndex
CREATE INDEX "AIUsage_subscriptionId_idx" ON "AIUsage"("subscriptionId");

-- CreateIndex
CREATE INDEX "AIUsage_sourceType_idx" ON "AIUsage"("sourceType");

-- CreateIndex
CREATE INDEX "AIUsage_organizationId_idx" ON "AIUsage"("organizationId");

-- CreateIndex
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");

-- CreateIndex
CREATE INDEX "AIUsage_role_idx" ON "AIUsage"("role");

-- CreateIndex
CREATE INDEX "AIUsage_periodStart_idx" ON "AIUsage"("periodStart");

-- CreateIndex
CREATE INDEX "AIUsage_periodEnd_idx" ON "AIUsage"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsage_subscriptionId_userId_periodStart_key" ON "AIUsage"("subscriptionId", "userId", "periodStart");

-- CreateIndex
CREATE INDEX "AIToolCallLog_userId_idx" ON "AIToolCallLog"("userId");

-- CreateIndex
CREATE INDEX "AIToolCallLog_orgId_idx" ON "AIToolCallLog"("orgId");

-- CreateIndex
CREATE INDEX "AIToolCallLog_subscriptionId_idx" ON "AIToolCallLog"("subscriptionId");

-- CreateIndex
CREATE INDEX "AIToolCallLog_sourceType_idx" ON "AIToolCallLog"("sourceType");

-- CreateIndex
CREATE INDEX "AIToolCallLog_toolName_idx" ON "AIToolCallLog"("toolName");

-- CreateIndex
CREATE INDEX "AIToolCallLog_allowed_idx" ON "AIToolCallLog"("allowed");

-- CreateIndex
CREATE INDEX "AIToolCallLog_createdAt_idx" ON "AIToolCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIConversation_organizationId_idx" ON "AIConversation"("organizationId");

-- CreateIndex
CREATE INDEX "AIConversation_subscriptionId_idx" ON "AIConversation"("subscriptionId");

-- CreateIndex
CREATE INDEX "AIConversation_expiresAt_idx" ON "AIConversation"("expiresAt");

-- CreateIndex
CREATE INDEX "AIConversation_updatedAt_idx" ON "AIConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AIMessage_role_idx" ON "AIMessage"("role");

-- CreateIndex
CREATE INDEX "AIMessage_createdAt_idx" ON "AIMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Announcement_organizationId_idx" ON "Announcement"("organizationId");

-- CreateIndex
CREATE INDEX "Announcement_targetType_targetId_idx" ON "Announcement"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PreferenceWindow_organizationId_idx" ON "PreferenceWindow"("organizationId");

-- CreateIndex
CREATE INDEX "PreferenceWindow_academicCycleId_idx" ON "PreferenceWindow"("academicCycleId");

-- CreateIndex
CREATE INDEX "PreferenceWindow_kind_idx" ON "PreferenceWindow"("kind");

-- CreateIndex
CREATE INDEX "PreferenceWindow_status_idx" ON "PreferenceWindow"("status");

-- CreateIndex
CREATE INDEX "PreferenceWindow_startAt_endAt_idx" ON "PreferenceWindow"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "PreferenceWindow_announcementId_idx" ON "PreferenceWindow"("announcementId");

-- CreateIndex
CREATE INDEX "PreferenceWindowOption_windowId_idx" ON "PreferenceWindowOption"("windowId");

-- CreateIndex
CREATE INDEX "PreferenceWindowOption_courseId_idx" ON "PreferenceWindowOption"("courseId");

-- CreateIndex
CREATE INDEX "PreferenceWindowOption_sectionId_idx" ON "PreferenceWindowOption"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceWindowOption_windowId_courseId_key" ON "PreferenceWindowOption"("windowId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceWindowOption_windowId_sectionId_key" ON "PreferenceWindowOption"("windowId", "sectionId");

-- CreateIndex
CREATE INDEX "PreferenceWindowAudience_windowId_idx" ON "PreferenceWindowAudience"("windowId");

-- CreateIndex
CREATE INDEX "PreferenceWindowAudience_courseId_idx" ON "PreferenceWindowAudience"("courseId");

-- CreateIndex
CREATE INDEX "PreferenceWindowAudience_cohortId_idx" ON "PreferenceWindowAudience"("cohortId");

-- CreateIndex
CREATE INDEX "PreferenceWindowAudience_sectionId_idx" ON "PreferenceWindowAudience"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceWindowAudience_windowId_courseId_key" ON "PreferenceWindowAudience"("windowId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceWindowAudience_windowId_cohortId_key" ON "PreferenceWindowAudience"("windowId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceWindowAudience_windowId_sectionId_key" ON "PreferenceWindowAudience"("windowId", "sectionId");

-- CreateIndex
CREATE INDEX "PreferenceSubmission_windowId_idx" ON "PreferenceSubmission"("windowId");

-- CreateIndex
CREATE INDEX "PreferenceSubmission_studentId_idx" ON "PreferenceSubmission"("studentId");

-- CreateIndex
CREATE INDEX "PreferenceSubmission_submittedById_idx" ON "PreferenceSubmission"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceSubmission_windowId_studentId_key" ON "PreferenceSubmission"("windowId", "studentId");

-- CreateIndex
CREATE INDEX "PreferenceRank_optionId_idx" ON "PreferenceRank"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceRank_submissionId_optionId_key" ON "PreferenceRank"("submissionId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceRank_submissionId_rank_key" ON "PreferenceRank"("submissionId", "rank");

-- CreateIndex
CREATE INDEX "Holiday_organizationId_idx" ON "Holiday"("organizationId");

-- CreateIndex
CREATE INDEX "Holiday_organizationId_isActive_idx" ON "Holiday"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Holiday_organizationId_startDate_endDate_idx" ON "Holiday"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Holiday_type_idx" ON "Holiday"("type");

-- CreateIndex
CREATE INDEX "Holiday_matchMode_idx" ON "Holiday"("matchMode");

-- CreateIndex
CREATE INDEX "HolidayDepartment_departmentId_idx" ON "HolidayDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "EvaluationWindow_organizationId_idx" ON "EvaluationWindow"("organizationId");

-- CreateIndex
CREATE INDEX "EvaluationWindow_organizationId_isActive_idx" ON "EvaluationWindow"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "EvaluationWindow_academicCycleId_idx" ON "EvaluationWindow"("academicCycleId");

-- CreateIndex
CREATE INDEX "EvaluationWindow_courseId_idx" ON "EvaluationWindow"("courseId");

-- CreateIndex
CREATE INDEX "EvaluationWindow_sectionId_idx" ON "EvaluationWindow"("sectionId");

-- CreateIndex
CREATE INDEX "EvaluationWindow_startDate_endDate_idx" ON "EvaluationWindow"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Evaluation_organizationId_idx" ON "Evaluation"("organizationId");

-- CreateIndex
CREATE INDEX "Evaluation_type_idx" ON "Evaluation"("type");

-- CreateIndex
CREATE INDEX "Evaluation_studentId_idx" ON "Evaluation"("studentId");

-- CreateIndex
CREATE INDEX "Evaluation_teacherId_idx" ON "Evaluation"("teacherId");

-- CreateIndex
CREATE INDEX "Evaluation_courseId_idx" ON "Evaluation"("courseId");

-- CreateIndex
CREATE INDEX "Evaluation_sectionId_idx" ON "Evaluation"("sectionId");

-- CreateIndex
CREATE INDEX "Evaluation_academicCycleId_idx" ON "Evaluation"("academicCycleId");

-- CreateIndex
CREATE INDEX "Evaluation_windowId_idx" ON "Evaluation"("windowId");

-- CreateIndex
CREATE INDEX "Evaluation_isHidden_idx" ON "Evaluation"("isHidden");

-- CreateIndex
CREATE INDEX "SectionSchedule_sectionId_idx" ON "SectionSchedule"("sectionId");

-- CreateIndex
CREATE INDEX "SectionSchedule_day_idx" ON "SectionSchedule"("day");

-- CreateIndex
CREATE INDEX "SectionSchedule_date_idx" ON "SectionSchedule"("date");

-- CreateIndex
CREATE INDEX "SectionSchedule_type_idx" ON "SectionSchedule"("type");

-- CreateIndex
CREATE INDEX "SectionSchedule_academicCycleId_idx" ON "SectionSchedule"("academicCycleId");

-- CreateIndex
CREATE INDEX "SectionSchedule_roomId_idx" ON "SectionSchedule"("roomId");

-- CreateIndex
CREATE INDEX "SectionSchedule_teacherId_idx" ON "SectionSchedule"("teacherId");

-- CreateIndex
CREATE INDEX "AttendanceSession_sectionId_idx" ON "AttendanceSession"("sectionId");

-- CreateIndex
CREATE INDEX "AttendanceSession_scheduleId_idx" ON "AttendanceSession"("scheduleId");

-- CreateIndex
CREATE INDEX "AttendanceSession_date_idx" ON "AttendanceSession"("date");

-- CreateIndex
CREATE INDEX "AttendanceSession_academicCycleId_idx" ON "AttendanceSession"("academicCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_scheduleId_date_key" ON "AttendanceSession"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "CourseMaterial_sectionId_idx" ON "CourseMaterial"("sectionId");

-- CreateIndex
CREATE INDEX "CourseMaterial_academicCycleId_idx" ON "CourseMaterial"("academicCycleId");

-- CreateIndex
CREATE INDEX "AcademicCycle_organizationId_idx" ON "AcademicCycle"("organizationId");

-- CreateIndex
CREATE INDEX "AcademicCycle_isActive_idx" ON "AcademicCycle"("isActive");

-- CreateIndex
CREATE INDEX "AcademicCycle_gpaPolicyId_idx" ON "AcademicCycle"("gpaPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCycle_organizationId_code_key" ON "AcademicCycle"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Cohort_organizationId_idx" ON "Cohort"("organizationId");

-- CreateIndex
CREATE INDEX "Cohort_academicCycleId_idx" ON "Cohort"("academicCycleId");

-- CreateIndex
CREATE INDEX "Cohort_isActive_idx" ON "Cohort"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_organizationId_code_key" ON "Cohort"("organizationId", "code");

-- CreateIndex
CREATE INDEX "EnrollmentHistory_studentId_idx" ON "EnrollmentHistory"("studentId");

-- CreateIndex
CREATE INDEX "EnrollmentHistory_sectionId_idx" ON "EnrollmentHistory"("sectionId");

-- CreateIndex
CREATE INDEX "EnrollmentHistory_academicCycleId_idx" ON "EnrollmentHistory"("academicCycleId");

-- CreateIndex
CREATE INDEX "CohortMembershipHistory_studentId_idx" ON "CohortMembershipHistory"("studentId");

-- CreateIndex
CREATE INDEX "CohortMembershipHistory_cohortId_idx" ON "CohortMembershipHistory"("cohortId");

-- CreateIndex
CREATE INDEX "CohortMembershipHistory_academicCycleId_idx" ON "CohortMembershipHistory"("academicCycleId");

-- CreateIndex
CREATE INDEX "FinancialStructure_organizationId_idx" ON "FinancialStructure"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialStructure_targetType_idx" ON "FinancialStructure"("targetType");

-- CreateIndex
CREATE INDEX "FinancialStructure_studentId_idx" ON "FinancialStructure"("studentId");

-- CreateIndex
CREATE INDEX "FinancialStructure_teacherId_idx" ON "FinancialStructure"("teacherId");

-- CreateIndex
CREATE INDEX "FinancialStructure_employeeUserId_idx" ON "FinancialStructure"("employeeUserId");

-- CreateIndex
CREATE INDEX "FinancialStructure_isActive_idx" ON "FinancialStructure"("isActive");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_organizationId_idx" ON "FinancialStructureAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_structureId_idx" ON "FinancialStructureAssignment"("structureId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_targetType_idx" ON "FinancialStructureAssignment"("targetType");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_studentId_idx" ON "FinancialStructureAssignment"("studentId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_teacherId_idx" ON "FinancialStructureAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_employeeUserId_idx" ON "FinancialStructureAssignment"("employeeUserId");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_sourceType_idx" ON "FinancialStructureAssignment"("sourceType");

-- CreateIndex
CREATE INDEX "FinancialStructureAssignment_isActive_idx" ON "FinancialStructureAssignment"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_studentId_key" ON "FinancialStructureAssignment"("structureId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_teacherId_key" ON "FinancialStructureAssignment"("structureId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_employeeUserId_key" ON "FinancialStructureAssignment"("structureId", "employeeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStructureAssignment_structureId_targetType_entityN_key" ON "FinancialStructureAssignment"("structureId", "targetType", "entityName");

-- CreateIndex
CREATE INDEX "FinancialEntry_organizationId_idx" ON "FinancialEntry"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialEntry_assignmentId_idx" ON "FinancialEntry"("assignmentId");

-- CreateIndex
CREATE INDEX "FinancialEntry_studentId_idx" ON "FinancialEntry"("studentId");

-- CreateIndex
CREATE INDEX "FinancialEntry_teacherId_idx" ON "FinancialEntry"("teacherId");

-- CreateIndex
CREATE INDEX "FinancialEntry_employeeUserId_idx" ON "FinancialEntry"("employeeUserId");

-- CreateIndex
CREATE INDEX "FinancialEntry_status_idx" ON "FinancialEntry"("status");

-- CreateIndex
CREATE INDEX "FinancialEntry_dueDate_idx" ON "FinancialEntry"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_assignmentId_periodStart_periodEnd_key" ON "FinancialEntry"("assignmentId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PaymentClaim_organizationId_idx" ON "PaymentClaim"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentClaim_entryId_idx" ON "PaymentClaim"("entryId");

-- CreateIndex
CREATE INDEX "PaymentClaim_claimedById_idx" ON "PaymentClaim"("claimedById");

-- CreateIndex
CREATE INDEX "PaymentClaim_reviewedById_idx" ON "PaymentClaim"("reviewedById");

-- CreateIndex
CREATE INDEX "PaymentClaim_status_idx" ON "PaymentClaim"("status");

-- CreateIndex
CREATE INDEX "PaymentClaim_claimedAt_idx" ON "PaymentClaim"("claimedAt");

-- CreateIndex
CREATE INDEX "FinanceAttachment_organizationId_idx" ON "FinanceAttachment"("organizationId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_entryId_idx" ON "FinanceAttachment"("entryId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_claimId_idx" ON "FinanceAttachment"("claimId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_transactionId_idx" ON "FinanceAttachment"("transactionId");

-- CreateIndex
CREATE INDEX "FinanceAttachment_uploadedById_idx" ON "FinanceAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");

-- CreateIndex
CREATE INDEX "Transaction_relatedEntryId_idx" ON "Transaction"("relatedEntryId");

-- CreateIndex
CREATE INDEX "Transaction_createdById_idx" ON "Transaction"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_deviceId_idx" ON "WebPushSubscription"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "_SectionToTeacher_B_index" ON "_SectionToTeacher"("B");

-- CreateIndex
CREATE INDEX "_MailParticipants_B_index" ON "_MailParticipants"("B");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentOrgId_fkey" FOREIGN KEY ("parentOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEncryptionIdentity" ADD CONSTRAINT "UserEncryptionIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "UserEncryptionIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedEncryptionDevice" ADD CONSTRAINT "TrustedEncryptionDevice_approvedByDeviceId_fkey" FOREIGN KEY ("approvedByDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEDeviceApprovalRequest" ADD CONSTRAINT "E2EEDeviceApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEDeviceApprovalRequest" ADD CONSTRAINT "E2EEDeviceApprovalRequest_pendingDeviceId_fkey" FOREIGN KEY ("pendingDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEDeviceApprovalRequest" ADD CONSTRAINT "E2EEDeviceApprovalRequest_approverDeviceId_fkey" FOREIGN KEY ("approverDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingDepartment" ADD CONSTRAINT "BuildingDepartment_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingDepartment" ADD CONSTRAINT "BuildingDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDepartment" ADD CONSTRAINT "TeacherDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDepartment" ADD CONSTRAINT "TeacherDepartment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDepartment" ADD CONSTRAINT "TeacherDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartment" ADD CONSTRAINT "StudentDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartment" ADD CONSTRAINT "StudentDepartment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartment" ADD CONSTRAINT "StudentDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDepartment" ADD CONSTRAINT "ManagerDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDepartment" ADD CONSTRAINT "ManagerDepartment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDepartment" ADD CONSTRAINT "ManagerDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAdminDepartment" ADD CONSTRAINT "SubAdminDepartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAdminDepartment" ADD CONSTRAINT "SubAdminDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubAdminDepartment" ADD CONSTRAINT "SubAdminDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpaPolicy" ADD CONSTRAINT "GpaPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_defaultRoomId_fkey" FOREIGN KEY ("defaultRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_primaryDepartmentId_fkey" FOREIGN KEY ("primaryDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mail" ADD CONSTRAINT "Mail_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailUserView" ADD CONSTRAINT "MailUserView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailUserView" ADD CONSTRAINT "MailUserView_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailActionLog" ADD CONSTRAINT "MailActionLog_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailActionLog" ADD CONSTRAINT "MailActionLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMembershipHistory" ADD CONSTRAINT "ChatMembershipHistory_chatParticipantId_fkey" FOREIGN KEY ("chatParticipantId") REFERENCES "ChatParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_mailMessageId_fkey" FOREIGN KEY ("mailMessageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedContent" ADD CONSTRAINT "EncryptedContent_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- AddForeignKey
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_encryptedContentId_fkey" FOREIGN KEY ("encryptedContentId") REFERENCES "EncryptedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEKeyEnvelope" ADD CONSTRAINT "E2EEKeyEnvelope_senderDeviceId_fkey" FOREIGN KEY ("senderDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatHistoryKey" ADD CONSTRAINT "ChatHistoryKey_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatHistoryKey" ADD CONSTRAINT "ChatHistoryKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_historyKeyId_fkey" FOREIGN KEY ("historyKeyId") REFERENCES "ChatHistoryKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEHistoryKeyDeviceEnvelope" ADD CONSTRAINT "E2EEHistoryKeyDeviceEnvelope_senderDeviceId_fkey" FOREIGN KEY ("senderDeviceId") REFERENCES "TrustedEncryptionDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEContentHistoryKeyEnvelope" ADD CONSTRAINT "E2EEContentHistoryKeyEnvelope_encryptedContentId_fkey" FOREIGN KEY ("encryptedContentId") REFERENCES "EncryptedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEContentHistoryKeyEnvelope" ADD CONSTRAINT "E2EEContentHistoryKeyEnvelope_historyKeyId_fkey" FOREIGN KEY ("historyKeyId") REFERENCES "ChatHistoryKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "E2EEContentHistoryKeyEnvelope" ADD CONSTRAINT "E2EEContentHistoryKeyEnvelope_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunicationBlock" ADD CONSTRAINT "UserCommunicationBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISubscription" ADD CONSTRAINT "AISubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISubscription" ADD CONSTRAINT "AISubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIOrgAccessPolicy" ADD CONSTRAINT "AIOrgAccessPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRoleCreditPolicy" ADD CONSTRAINT "AIRoleCreditPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AISubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIToolCallLog" ADD CONSTRAINT "AIToolCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIToolCallLog" ADD CONSTRAINT "AIToolCallLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIToolCallLog" ADD CONSTRAINT "AIToolCallLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AISubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AISubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindow" ADD CONSTRAINT "PreferenceWindow_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowOption" ADD CONSTRAINT "PreferenceWindowOption_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "PreferenceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowOption" ADD CONSTRAINT "PreferenceWindowOption_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowOption" ADD CONSTRAINT "PreferenceWindowOption_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "PreferenceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceWindowAudience" ADD CONSTRAINT "PreferenceWindowAudience_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSubmission" ADD CONSTRAINT "PreferenceSubmission_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "PreferenceWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSubmission" ADD CONSTRAINT "PreferenceSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSubmission" ADD CONSTRAINT "PreferenceSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceRank" ADD CONSTRAINT "PreferenceRank_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PreferenceSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceRank" ADD CONSTRAINT "PreferenceRank_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PreferenceWindowOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayDepartment" ADD CONSTRAINT "HolidayDepartment_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayDepartment" ADD CONSTRAINT "HolidayDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationWindow" ADD CONSTRAINT "EvaluationWindow_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "EvaluationWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSchedule" ADD CONSTRAINT "SectionSchedule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSchedule" ADD CONSTRAINT "SectionSchedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSchedule" ADD CONSTRAINT "SectionSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSchedule" ADD CONSTRAINT "SectionSchedule_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SectionSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCycle" ADD CONSTRAINT "AcademicCycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCycle" ADD CONSTRAINT "AcademicCycle_gpaPolicyId_fkey" FOREIGN KEY ("gpaPolicyId") REFERENCES "GpaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHistory" ADD CONSTRAINT "EnrollmentHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHistory" ADD CONSTRAINT "EnrollmentHistory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHistory" ADD CONSTRAINT "EnrollmentHistory_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembershipHistory" ADD CONSTRAINT "CohortMembershipHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembershipHistory" ADD CONSTRAINT "CohortMembershipHistory_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembershipHistory" ADD CONSTRAINT "CohortMembershipHistory_academicCycleId_fkey" FOREIGN KEY ("academicCycleId") REFERENCES "AcademicCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructure" ADD CONSTRAINT "FinancialStructure_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" ADD CONSTRAINT "FinancialStructureAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" ADD CONSTRAINT "FinancialStructureAssignment_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FinancialStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" ADD CONSTRAINT "FinancialStructureAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" ADD CONSTRAINT "FinancialStructureAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStructureAssignment" ADD CONSTRAINT "FinancialStructureAssignment_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FinancialStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FinancialStructureAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PaymentClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAttachment" ADD CONSTRAINT "FinanceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedEntryId_fkey" FOREIGN KEY ("relatedEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SectionToTeacher" ADD CONSTRAINT "_SectionToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SectionToTeacher" ADD CONSTRAINT "_SectionToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MailParticipants" ADD CONSTRAINT "_MailParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MailParticipants" ADD CONSTRAINT "_MailParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
