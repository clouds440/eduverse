# 



# School Management System - Technical Design Document
**Version:** 1.0
**Date:** March 2026
**Repository:** clouds440/school-management
**Document Type:** Technical Design Document (TDD)

---

## Table of Contents
1. Overview
2. Goals and Non-Goals
3. Architecture
4. Data Model
5. API Design
6. Security Considerations
7. Testing Strategy
8. Rollout Plan
9. New Features
   - 9.1 Password Strength Validation
   - 9.2 Academic Lifecycle Management
   - 9.3 Cohort Management
   - 9.4 Transcript Generation
   - 9.5 Student Promotions
   - 9.6 Financial Management System
   - 9.7 Dashboard Insights
   - 9.8 Copy-Forward System
---

## Overview
### Purpose
The School Management System is a comprehensive web-based platform designed to streamline educational institution administration. It provides a multi-tenant architecture supporting multiple organizations with role-based access control for administrators, teachers, and students.

### Scope
The system encompasses:

- **Multi-Organization Management**: Hierarchical organization structure with parent-child relationships
- **User Management**: Role-based access for Super Admins, Platform Admins, Org Admins, Org Managers, Teachers, and Students
- **Academic Management**: Courses, sections, enrollments, assessments, and grading
- **Academic Lifecycle Management**: Academic cycles, cohorts, student promotions, and transcript generation
- **Attendance Tracking**: Schedule management and attendance recording
- **Communication Systems**: Real-time chat, internal mail, notifications, and announcements
- **File Management**: Document and media uploads with cloud storage integration
- **Security Features**: Password strength validation, multi-device session management, password reset flow, contact email verification
- **Audit Trail**: Complete tracking of administrative actions and security events
- **Live Deployment**: Production instance available at https://eduversepak.cloud
### Technology Stack Summary
| Layer | Technology |
| ----- | ----- |
| Frontend | Next.js 16.1.6, React 19.2.3, TypeScript 5.x, TailwindCSS 4.x |
| Backend | NestJS 11.x, Node.js, TypeScript 5.7.3 |
| Database | PostgreSQL with Prisma ORM 6.4.1 |
| Real-time | Socket.IO (WebSockets) |
| Authentication | JWT with Passport.js |
| File Storage | Cloudinary |
| Password Validation | zxcvbn (password strength library) |
| Email Service | Resend API |
| Production URL | https://eduversepak.cloud |
---

## Goals and Non-Goals
### Goals
- **Scalable Multi-Tenancy**: Support multiple educational institutions with complete data isolation
- **Role-Based Access Control**: Granular permissions for six distinct user roles
- **Real-Time Communication**: Instant messaging and notifications via WebSockets
- **Comprehensive Academic Tracking**: Full lifecycle management of courses, assessments, and grades
- **Academic Lifecycle Management**: Track students through academic cycles with cohorts, promotions, and transcripts
- **Password Security**: Real-time password strength validation to enforce security standards
- **Session Security**: Multi-device session management with suspicious activity detection
- **Audit Trail**: Complete tracking of administrative actions and data changes
- **Password Recovery**: Secure password reset flow with email verification
- **Contact Email Verification**: Organization contact email verification for security communications
### Non-Goals
- **Mobile Native Applications**: Current scope is web-only (responsive design)
- **Payment Processing**: Fee management is data-only; no payment gateway integration
- **Video Conferencing**: External links supported but no built-in video functionality
- **Offline Support**: Requires active internet connection
- **Multi-Language Support**: English-only in current version
---

## Architecture
### High-Level System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                   Next.js 16 (React 19) SPA                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │  App Router  │ │   Context    │ │    Resource Stores       │ │
│  │  (Pages)     │ │   Providers  │ │    (Caching Layer)       │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                        API LAYER                                │
│                    NestJS Application                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │   Guards     │ │ Interceptors │ │     Rate Limiting        │ │
│  │  (Auth/RBAC) │ │  (Transform) │ │     (Throttler)          │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │  Auth   │ │  Admin  │ │   Org   │ │  Chat   │ │   Mail    │  │
│  │ Service │ │ Service │ │ Service │ │ Service │ │  Service  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐│
│  │ Events  │ │  Files  │ │ Notify  │ │     Announcements       ││
│  │ Gateway │ │ Service │ │ Service │ │        Service          ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    DATA ACCESS LAYER                            │
│                      Prisma ORM                                 │
├─────────────────────────────────────────────────────────────────┤
│                    DATABASE LAYER                               │
│                    PostgreSQL                                   │
└─────────────────────────────────────────────────────────────────┘
```
### Backend Module Structure
```
backend/src/
├── admin/                 # Platform administration module
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── admin.module.ts
├── auth/                  # Authentication & session management
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── guards/
├── chat/                  # Real-time messaging system
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   └── chat.gateway.ts
├── common/                # Shared utilities
│   ├── guards/
│   │   └── active-org.guard.ts
│   ├── decorators/
│   └── enums/
├── events/                # WebSocket gateway
│   └── events.gateway.ts
├── files/                 # File upload management
│   ├── files.controller.ts
│   └── files.service.ts
├── mail/                  # Internal mail system
│   ├── mail.controller.ts
│   └── mail.service.ts
├── notifications/         # User notifications
│   ├── notifications.controller.ts
│   └── notifications.service.ts
├── announcements/         # Organization announcements
│   ├── announcements.controller.ts
│   └── announcements.service.ts
├── academic-cycles/       # Academic cycle management
│   ├── academic-cycles.controller.ts
│   ├── academic-cycles.service.ts
│   ├── dto/
│   └── academic-cycles.module.ts
├── cohorts/               # Cohort management
│   ├── cohorts.controller.ts
│   ├── cohorts.service.ts
│   ├── dto/
│   └── cohorts.module.ts
├── transcripts/           # Transcript generation
│   ├── transcripts.controller.ts
│   ├── transcripts.service.ts
│   └── transcripts.module.ts
├── promotions/            # Student promotions
│   ├── promotions.service.ts
│   └── promotions.module.ts
├── finance/               # Financial management system
│   ├── finance.controller.ts
│   ├── finance.service.ts
│   ├── finance.dto.ts
│   ├── finance.cron.ts
│   └── finance.module.ts
├── insights/              # Dashboard analytics
│   ├── insights.service.ts
│   └── insights.module.ts
├── copy-forward/          # Academic data copying between cycles
│   ├── copy-forward.controller.ts
│   ├── copy-forward.service.ts
│   ├── dto/
│   └── copy-forward.module.ts
├── org/                   # Organization operations
│   ├── org.controller.ts
│   ├── org.service.ts
│   └── dto/
├── prisma/                # Database client
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts          # Root module
└── main.ts                # Application entry point
```
### Frontend Structure
```
frontend/
├── app/                   # Next.js App Router
│   ├── (org)/            # Organization dashboard routes
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── courses/
│   │   ├── sections/
│   │   ├── assessments/
│   │   ├── attendance/
│   │   ├── chat/
│   │   └── settings/
│   ├── admin/            # Platform admin routes
│   ├── login/            # Authentication pages
│   └── layout.tsx        # Root layout
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   │   ├── DataTable/
│   │   ├── ModalForm/
│   │   ├── CustomSelect/
│   │   └── CustomMultiSelect/
│   ├── forms/           # Form components
│   └── sections/        # Feature-specific components
├── context/             # React Context providers
│   ├── AuthContext.tsx
│   ├── GlobalContext.tsx
│   ├── ThemeContext.tsx
│   └── UIContext.tsx
├── hooks/               # Custom React hooks
│   ├── usePaginatedData.ts
│   ├── useSocket.ts
│   └── useDebounce.ts
├── lib/                 # Utilities and API client
│   ├── api.ts          # API client with request helper
│   └── *Store.ts       # Resource stores for caching
└── types/              # TypeScript type definitions
```
### Main Business Flows
#### 1. Authentication Flow
```
User Login Request
       │
       ▼
┌─────────────────────────┐
│  Validate Credentials   │
│  (Email + Password)     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Check Organization     │
│  Status (APPROVED?)     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Generate JWT Token     │
│  Create/Update Session  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  IP Geolocation Lookup  │
│  Device Fingerprinting  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  New Device Detection?  │──Yes──▶ Send Security Notification
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Return Token + Role    │
└─────────────────────────┘
```

#### 1.1 Password Reset Flow
```
User Requests Password Reset
       │
       ▼
┌─────────────────────────┐
│  Validate Email         │
│  (Org Admin Only)       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Check Contact Email    │
│  Verification Status    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Generate Reset Token   │
│  (30 min expiration)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Send Reset Link Email  │
│  to Contact Email       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Log Audit Event        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Return Generic Message │
└─────────────────────────┘
```

#### 1.2 Contact Email Verification Flow
```
Organization Registration
       │
       ▼
┌─────────────────────────┐
│  Create Org & User      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Generate 6-Digit Code  │
│  (10 min expiration)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Send Verification Email │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  User Enters Code        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Validate Code           │
│  (Max 5 attempts)       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Mark Email Verified     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Log Audit Event        │
└─────────────────────────┘
```
#### 2. Organization Lifecycle Flow
```
Registration (PENDING)
       │
       ▼
Contact Email Verification Required
       │
       ▼
Platform Admin Review
       │
       ├──Approve──▶ APPROVED ──▶ Full Access Granted
       │
       ├──Reject───▶ REJECTED ──▶ Access Denied + Reason Email
       │
       └──Suspend──▶ SUSPENDED ─▶ Access Revoked + Sessions Cleared
```
#### 3. Academic Management Flow
```
Course Creation
       │
       ▼
Section Creation (linked to Course)
       │
       ├──▶ Teacher Assignment (many-to-many)
       │
       └──▶ Student Enrollment (via Enrollment table)
              │
              ▼
       Assessment Creation
              │
              ├──▶ Student Submissions
              │
              └──▶ Grade Entry (DRAFT → PUBLISHED → FINALIZED)
```
#### 4. Real-Time Chat Flow
```
User Initiates Chat
│
├──Direct Chat──▶ Find/Create 1:1 Chat
│
└──Group Chat───▶ Create Chat + Add Participants
       │
       ▼
WebSocket Connection (Socket.IO)
       │
       ├──▶ Send Message ──▶ Broadcast to Participants
       │
       ├──▶ Typing Indicator ──▶ Real-time Update
       │
       └──▶ Read Receipt ──▶ Update lastReadMessageId
```
---

## Data Model
### Core Entities
#### Organization
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| name | String | Organization name |
| location | String | Physical location |
| type | String | Organization type |
| contactEmail | String | Primary contact email |
| contactEmailVerifiedAt | DateTime? | When contact email was verified |
| contactEmailVerificationCodeHash | String? | Hashed verification code |
| contactEmailVerificationExpiresAt | DateTime? | Verification code expiration |
| contactEmailVerificationAttempts | Int | Number of verification attempts |
| lastVerificationSentAt | DateTime? | Last time verification was sent |
| phone | String? | Contact phone |
| status | Enum | PENDING, APPROVED, REJECTED, SUSPENDED |
| statusHistory | JSON | Audit trail of status changes |
| logoUrl | String? | Organization logo |
| accentColor | JSON? | Theme customization |
| parentOrgId | UUID? | Parent organization (hierarchy) |
#### User
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| email | String | Unique email address |
| password | String | Bcrypt hashed password |
| role | Enum | SUPER_ADMIN, PLATFORM_ADMIN, ORG_ADMIN, ORG_MANAGER, TEACHER, STUDENT |
| status | Enum | ACTIVE, SUSPENDED, ON_LEAVE, ALUMNI, EMERITUS, DELETED |
| isFirstLogin | Boolean | Force password change flag |
| organizationId | UUID? | Associated organization |
| name | String? | Display name |
| themeMode | Enum | LIGHT, DARK, SYSTEM |
| avatarUrl | String? | Profile picture URL |
#### Session
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| userId | UUID | Associated user |
| deviceId | String | Device fingerprint |
| deviceName | String? | Human-readable device name |
| deviceType | String? | desktop, mobile, tablet |
| browser | String? | Browser name |
| os | String? | Operating system |
| location | String? | Country from IP geolocation |
| ip | String? | IP address |
| token | String | JWT token |
| isActive | Boolean | Session validity |
| lastSeenAt | DateTime | Last activity timestamp |
| expiresAt | DateTime | Token expiration |
### Security Entities

#### PasswordResetToken
Stores password reset tokens for secure password recovery.

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| userId | UUID | Associated user |
| tokenHash | String | Hashed reset token |
| expiresAt | DateTime | Token expiration |
| usedAt | DateTime? | When token was used |
| createdAt | DateTime | Creation timestamp |
| ip | String? | Request IP address |
| userAgent | String? | Request user agent |

**Relations:**
- User (N:1)

#### AuditLog
Comprehensive audit trail for security events and administrative actions.

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| action | String | Action performed (e.g., password_reset_requested, contact_email_verified) |
| actorUserId | UUID? | User who performed the action |
| targetUserId | UUID? | User affected by the action |
| organizationId | UUID? | Associated organization |
| ip | String? | Request IP address |
| userAgent | String? | Request user agent |
| sessionId | String? | Associated session |
| details | JSON? | Additional action details |
| createdAt | DateTime | Creation timestamp |

**Relations:**
- Organization (N:1, optional)

### Academic Entities
#### Course → Section → Enrollment
```
Course (1) ──────▶ (N) Section (N) ◀────── (N) Teacher
     │                    │
     │ (1)                │ (1)
     ▼                    ▼
Enrollment (N) ◀────── (1) Student
     │
     └──▶ EnrollmentHistory (audit trail)
```
#### Assessment → Grade/Submission
```
Assessment (1) ──────▶ (N) Grade (N) ◀────── (1) Student
│
└──────────────▶ (N) Submission (N) ◀── (1) Student
```
#### Academic Lifecycle (New)
```
AcademicCycle (1) ──────▶ (N) Cohort (N) ◀────── (N) Student
     │                            │
     │                            └──▶ CohortMembershipHistory (audit trail)
     │
     ├──────────────▶ (N) Section
     ├──────────────▶ (N) Assessment
     ├──────────────▶ (N) Grade
     ├──────────────▶ (N) Enrollment
     ├──────────────▶ (N) EnrollmentHistory (audit trail)
     └──────────────▶ (N) AttendanceSession
```
### Communication Entities
#### Chat System
```
Chat (1) ──────▶ (N) ChatParticipant (N) ◀────── (1) User
│
└──────────▶ (N) ChatMessage
                  │
                  └──▶ replyTo (self-referencing)
```
#### Mail System
```
Mail (1) ──────▶ (N) MailMessage
│
├──────────▶ (N) MailActionLog (audit trail)
│
└──────────▶ (N) MailUserView (read tracking)
```
### Attendance Entities
```
Section (1) ──▶ (N) SectionSchedule (1) ──▶ (N) AttendanceSession
│
└──▶ (N) AttendanceRecord
```
### Entity Relationship Diagram Summary
```
Organization
│
├── Users (1:N)
│     ├── Teacher Profile (1:1)
│     └── Student Profile (1:1)
│
├── Academic Cycles (1:N)
│     ├── Cohorts (1:N)
│     │     └── Students (N:N)
│     ├── Sections (1:N)
│     ├── Enrollments (1:N)
│     ├── Assessments (1:N)
│     ├── Grades (1:N)
│     └── Attendance Sessions (1:N)
│
├── Courses (1:N)
│     └── Sections (1:N)
│           ├── Enrollments (1:N)
│           ├── Teachers (N:N)
│           ├── Schedules (1:N)
│           └── Assessments (1:N)
│
├── Financial Structures (1:N)
│     ├── Financial Entries (1:N)
│     └── Transactions (1:N)
│
├── Chats (1:N)
├── Mails (1:N)
└── Announcements (1:N)
```

### New Academic Lifecycle Entities

#### AcademicCycle
Represents a time-bound academic period (e.g., Fall 2025, Spring 2026, Academic Year 2025-2026).

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| name | String | Cycle name (e.g., "Fall 2025") |
| startDate | DateTime | Cycle start date |
| endDate | DateTime | Cycle end date |
| isActive | Boolean | Whether this is the currently active cycle |
| organizationId | UUID | Associated organization |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Organization (N:1)
- Cohorts (1:N)
- Sections (1:N)
- Enrollments (1:N)
- Assessments (1:N)
- Grades (1:N)
- Submissions (1:N)
- AttendanceSessions (1:N)
- CourseMaterials (1:N)
- SectionSchedules (1:N)
- EnrollmentHistory (1:N)
- CohortMembershipHistory (1:N)

#### Cohort
Represents a group of students within an academic cycle (e.g., Grade 10, Class of 2026).

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| name | String | Cohort name (e.g., "Grade 10") |
| organizationId | UUID | Associated organization |
| academicCycleId | UUID | Parent academic cycle |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Organization (N:1)
- AcademicCycle (N:1)
- Students (N:N)
- Sections (N:N)
- CohortMembershipHistory (1:N)

#### EnrollmentHistory
Audit trail tracking enrollment changes over time.

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| studentId | UUID | Associated student |
| sectionId | UUID | Associated section |
| academicCycleId | UUID? | Academic cycle at time of enrollment |
| source | Enum | MANUAL or COHORT (auto-enrolled via cohort) |
| wasExcluded | Boolean | Whether student was excluded from cohort enrollment |
| enrolledAt | DateTime | When enrollment occurred |
| removedAt | DateTime? | When enrollment was removed |

**Relations:**
- Student (N:1)
- Section (N:1)
- AcademicCycle (N:1, optional)

#### CohortMembershipHistory
Audit trail tracking cohort membership changes over time.

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| studentId | UUID | Associated student |
| cohortId | UUID | Associated cohort |
| academicCycleId | UUID? | Academic cycle at time of membership |
| joinedAt | DateTime | When student joined cohort |
| leftAt | DateTime? | When student left cohort |

**Relations:**
- Student (N:1)
- Cohort (N:1)
- AcademicCycle (N:1, optional)

### Academic Entities

#### Teacher
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| userId | UUID | Associated user account |
| organizationId | UUID | Associated organization |
| subject | String | Subject specialization |
| designation | String | Job title/designation |
| education | String | Educational qualification |
| address | String? | Home address |
| bloodGroup | String? | Blood type |
| department | String? | Department |
| emergencyContact | String? | Emergency contact |
| joiningDate | DateTime | Date of joining |
| status | TeacherStatus | Teacher status |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- User (N:1)
- Organization (N:1)
- Sections (N:N)
- FinancialStructures (1:N)
- FinancialEntries (1:N)

#### Section
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| name | String | Section name |
| room | String? | Room number/location |
| courseId | UUID | Associated course |
| academicCycleId | UUID | Associated academic cycle |
| cohortId | UUID? | Associated cohort (optional) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Course (N:1)
- AcademicCycle (N:1)
- Cohort (N:1, optional)
- Teachers (N:N)
- Enrollments (1:N)
- Schedules (1:N)
- Assessments (1:N)

#### Student
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| userId | UUID | Associated user account |
| organizationId | UUID | Associated organization |
| cohortId | UUID? | Current cohort membership |
| registrationNumber | String | Student registration ID |
| rollNumber | String | Roll number |
| fatherName | String? | Father's name |
| age | Int? | Student age |
| address | String? | Home address |
| major | String | Major/field of study |
| updatedBy | String? | User who last updated |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |
| admissionDate | DateTime | Admission date |
| bloodGroup | String? | Blood type |
| department | String? | Department |
| emergencyContact | String? | Emergency contact |
| gender | String | Gender |
| graduationDate | DateTime? | Expected graduation date |
| status | StudentStatus | Student status |

**Relations:**
- User (N:1)
- Organization (N:1)
- Cohort (N:1, optional)
- Enrollments (1:N)
- Grades (1:N)
- Submissions (1:N)
- AttendanceRecords (1:N)
- EnrollmentHistory (1:N)
- CohortMembershipHistory (1:N)
- FinancialStructures (1:N)
- FinancialEntries (1:N)

#### Enrollment
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| studentId | UUID | Associated student |
| sectionId | UUID | Associated section |
| academicCycleId | UUID? | Academic cycle at enrollment time |
| source | EnrollmentSource | MANUAL or COHORT |
| isExcludedFromCohort | Boolean | Whether excluded from cohort auto-enrollment |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Student (N:1)
- Section (N:1)
- AcademicCycle (N:1, optional)

#### Assessment
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| sectionId | UUID | Associated section |
| courseId | UUID | Associated course |
| title | String | Assessment title |
| type | AssessmentType | Assessment type |
| totalMarks | Float | Maximum possible marks |
| weightage | Float | Weight percentage (0-100) |
| dueDate | DateTime? | Due date |
| allowSubmissions | Boolean | Whether submissions are allowed |
| externalLink | String? | External link URL |
| isVideoLink | Boolean | Whether external link is a video |
| academicCycleId | UUID? | Associated academic cycle |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |
| organizationId | UUID | Associated organization |

**Relations:**
- Section (N:1)
- Course (N:1)
- Organization (N:1)
- AcademicCycle (N:1, optional)
- Grades (1:N)
- Submissions (1:N)

#### Grade
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| assessmentId | UUID | Associated assessment |
| studentId | UUID | Associated student |
| marksObtained | Float | Marks obtained by student |
| feedback | String? | Teacher feedback |
| status | GradeStatus | Grade status |
| academicCycleId | UUID? | Associated academic cycle |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |
| updatedBy | String? | User who last updated |

**Relations:**
- Assessment (N:1)
- Student (N:1)
- AcademicCycle (N:1, optional)

#### Submission
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| assessmentId | UUID | Associated assessment |
| studentId | UUID | Associated student |
| fileUrl | String? | Submitted file URL |
| academicCycleId | UUID? | Associated academic cycle |
| submittedAt | DateTime | Submission timestamp |

**Relations:**
- Assessment (N:1)
- Student (N:1)
- AcademicCycle (N:1, optional)

#### SectionSchedule
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| sectionId | UUID | Associated section |
| academicCycleId | UUID? | Associated academic cycle |
| day | Int | Day of week (0=Sunday, 6=Saturday) |
| startTime | String | Start time (e.g., "09:00") |
| endTime | String | End time (e.g., "10:00") |
| room | String? | Room override |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Section (N:1)
- AcademicCycle (N:1, optional)
- AttendanceSessions (1:N)

#### AttendanceSession
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| sectionId | UUID | Associated section |
| scheduleId | UUID? | Associated schedule |
| academicCycleId | UUID? | Associated academic cycle |
| isAdhoc | Boolean | Whether this is an ad-hoc session |
| date | DateTime | Session date |
| startTime | String? | Start time |
| endTime | String? | End time |
| createdAt | DateTime | Creation timestamp |

**Relations:**
- Section (N:1)
- SectionSchedule (N:1, optional)
- AcademicCycle (N:1, optional)
- Records (1:N)

#### CourseMaterial
| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| sectionId | UUID | Associated section |
| academicCycleId | UUID? | Associated academic cycle |
| title | String | Material title |
| description | String? | Material description |
| links | String[] | List of resource links |
| isVideoLink | Boolean | Whether links are videos |
| createdBy | String | User who created |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Section (N:1)
- AcademicCycle (N:1, optional)
---
### Financial Entities

#### FinancialStructure
Defines recurring or one-time financial obligations for students or teachers (e.g., tuition fees, salaries).

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| organizationId | UUID | Associated organization |
| title | String | Structure title (e.g., "Standard Tuition") |
| description | String? | Description |
| studentId | UUID? | Associated student (for individual plans) |
| teacherId | UUID? | Associated teacher (for individual plans) |
| category | FinanceCategory | TUITION, TRANSPORT, SALARY, BONUS, etc. |
| amount | Float | Base amount |
| currency | String | Currency code (default: USD) |
| billingCycle | BillingCycle | ONCE, MONTHLY, SEMESTER, YEARLY, ACADEMIC_CYCLE |
| dueDay | Int? | Day of month for billing (null for ONCE) |
| startDate | DateTime | Start date |
| endDate | DateTime? | End date (null for indefinite) |
| isActive | Boolean | Whether structure is active |
| metadata | JSON? | Additional metadata |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Organization (N:1)
- Student (N:1, optional)
- Teacher (N:1, optional)
- FinancialEntries (1:N)

#### FinancialEntry
Represents a specific instance of a financial obligation (e.g., "September 2025 Tuition").

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| organizationId | UUID | Associated organization |
| structureId | UUID? | Parent financial structure |
| title | String | Entry title |
| studentId | UUID? | Associated student |
| teacherId | UUID? | Associated teacher |
| periodStart | DateTime? | Billing period start |
| periodEnd | DateTime? | Billing period end |
| dueDate | DateTime | Due date |
| amount | Float | Total amount due |
| paidAmount | Float | Amount paid (default: 0) |
| status | EntryStatus | PENDING, UNVERIFIED, PARTIAL, PAID, OVERDUE, CANCELLED |
| markedByUser | Boolean | Whether marked as paid by user |
| markedAt | DateTime? | When user marked as paid |
| receiptUrl | String? | Receipt image URL |
| paymentMethod | String? | Payment method |
| confirmedByAdmin | Boolean | Whether confirmed by admin |
| confirmedAt | DateTime? | When confirmed |
| confirmedById | UUID? | Admin who confirmed |
| source | EntrySource | SYSTEM (auto-generated) or MANUAL |
| metadata | JSON? | Additional metadata |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:**
- Organization (N:1)
- FinancialStructure (N:1, optional)
- Student (N:1, optional)
- Teacher (N:1, optional)
- ConfirmedBy (N:1, optional)
- Transactions (1:N)

#### Transaction
Records actual financial transactions (payments received or expenses paid).

| Field | Type | Description |
| ----- | ----- | ----- |
| id | UUID | Primary key |
| organizationId | UUID | Associated organization |
| type | TransactionType | INCOME or EXPENSE |
| category | FinanceCategory | Transaction category |
| amount | Float | Transaction amount |
| currency | String | Currency code (default: USD) |
| description | String? | Transaction description |
| relatedEntryId | UUID? | Associated financial entry |
| paymentMethod | String? | Payment method |
| referenceNumber | String? | Reference/transaction ID |
| createdById | UUID | User who created transaction |
| createdAt | DateTime | Creation timestamp |

**Relations:**
- Organization (N:1)
- RelatedEntry (N:1, optional)
- CreatedBy (N:1)
---

## API Design
### Authentication Endpoints
| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/auth/register`  | Register new organization with admin |
| POST | `/auth/login`  | Authenticate user, return JWT |
| POST | `/auth/logout`  | Invalidate current session |
| POST | `/auth/change-password`  | Update user password |
| POST | `/auth/forgot-password`  | Initiate password reset flow |
| POST | `/auth/reset-password`  | Complete password reset with token |
| POST | `/auth/contact-email/resend-verification`  | Resend contact email verification code |
| POST | `/auth/contact-email/verify`  | Verify contact email with code |
| PATCH | `/auth/profile`  | Update user profile |
| GET | `/auth/sessions`  | List active sessions |
| DELETE | `/auth/sessions/:id`  | Revoke specific session |
| DELETE | `/auth/sessions`  | Revoke all sessions except current |
### Admin Endpoints (Platform Level)
| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/admin/organizations`  | List all organizations (paginated) |
| PATCH | `/admin/organizations/:id/approve`  | Approve organization |
| PATCH | `/admin/organizations/:id/reject`  | Reject organization with reason |
| PATCH | `/admin/organizations/:id/suspend`  | Suspend organization |
| GET | `/admin/stats`  | Platform statistics |
| GET | `/admin/platform-admins`  | List platform administrators |
| POST | `/admin/platform-admins`  | Create platform admin |
| PATCH | `/admin/platform-admins/:id`  | Update platform admin |
| DELETE | `/admin/platform-admins/:id`  | Remove platform admin |
### Organization Endpoints
| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/settings`  | Get organization settings |
| PATCH | `/org/settings`  | Update organization settings |
| PATCH | `/org/logo`  | Upload organization logo |
| GET | `/org/stats`  | Organization statistics |
### Resource Management Endpoints
**Teachers**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/teachers`  | List teachers (paginated, filterable) |
| POST | `/org/teachers`  | Create teacher |
| PATCH | `/org/teachers/:id`  | Update teacher |
| DELETE | `/org/teachers/:id`  | Soft-delete teacher |
**Students**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/students`  | List students (paginated, filterable) |
| POST | `/org/students`  | Create student with enrollments |
| PATCH | `/org/students/:id`  | Update student and enrollments |
| DELETE | `/org/students/:id`  | Soft-delete student |
**Courses & Sections**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/courses`  | List courses |
| POST | `/org/courses`  | Create course |
| PATCH | `/org/courses/:id`  | Update course |
| DELETE | `/org/courses/:id`  | Delete course (cascades sections) |
| GET | `/org/sections`  | List sections |
| POST | `/org/sections`  | Create section |
| PATCH | `/org/sections/:id`  | Update section |
| DELETE | `/org/sections/:id`  | Delete section |
**Assessments & Grades**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/assessments`  | List assessments |
| POST | `/org/assessments`  | Create assessment |
| PATCH | `/org/assessments/:id`  | Update assessment |
| DELETE | `/org/assessments/:id`  | Delete assessment |
| GET | `/org/grades`  | Get grades for assessment |
| PATCH | `/org/grades/:gradeId`  | Update grade |
| GET | `/org/grades/final`  | Get final grades report |
**Attendance**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/schedules`  | List section schedules |
| POST | `/org/schedules`  | Create schedule |
| PATCH | `/org/schedules/:id`  | Update schedule |
| DELETE | `/org/schedules/:id`  | Delete schedule |
| GET | `/org/attendance/:sectionId`  | Get attendance for section |
| POST | `/org/attendance/mark`  | Mark attendance (bulk) |
| GET | `/org/attendance/range`  | Get attendance for date range |
### Academic Lifecycle Endpoints
**Academic Cycles**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/org/academic-cycles`  | Create academic cycle |
| GET | `/org/academic-cycles`  | List academic cycles (paginated) |
| GET | `/org/academic-cycles/active`  | Get currently active cycle |
| GET | `/org/academic-cycles/:id`  | Get specific cycle |
| PATCH | `/org/academic-cycles/:id`  | Update cycle |
| PATCH | `/org/academic-cycles/:id/activate`  | Set cycle as active |
| DELETE | `/org/academic-cycles/:id`  | Delete cycle |

**Cohorts**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/org/cohorts`  | Create cohort |
| GET | `/org/cohorts`  | List cohorts (paginated, filterable by cycle) |
| GET | `/org/cohorts/:id`  | Get specific cohort |
| PATCH | `/org/cohorts/:id`  | Update cohort |
| DELETE | `/org/cohorts/:id`  | Delete cohort |
| POST | `/org/cohorts/:id/students`  | Add students to cohort |
| DELETE | `/org/cohorts/:id/students/:studentId`  | Remove student from cohort |
| POST | `/org/cohorts/:id/sections`  | Assign section to cohort |
| DELETE | `/org/cohorts/:id/sections/:sectionId`  | Remove section from cohort |
| POST | `/org/cohorts/enrollments/exclude`  | Exclude student from section (cohort enrollment) |
| POST | `/org/cohorts/enrollments/include`  | Include student in section (cohort enrollment) |

**Transcripts**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/transcripts/students/:id`  | Get student transcript (with optional cycle filter) |
| GET | `/org/transcripts/cycles/:id/report`  | Get cycle-level report |

**Promotions**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/org/promotions`  | Promote students between cycles/cohorts |
### Finance Endpoints
**Financial Structures**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/finance/structures`  | Create financial structure |
| PATCH | `/finance/structures/:id`  | Update financial structure |
| GET | `/finance/structures`  | List financial structures (filterable by student/teacher) |

**Financial Entries**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/finance/entries/manual`  | Create manual financial entry |
| GET | `/finance/entries`  | List financial entries (filterable by student/teacher) |
| PATCH | `/finance/entries/:id/mark-paid`  | Mark entry as paid (user action) |
| PATCH | `/finance/entries/:id/confirm`  | Confirm payment and create transaction (admin) |

**Transactions & Stats**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/finance/transactions`  | List transactions (filterable by student/teacher) |
| GET | `/finance/stats`  | Get financial statistics (income, expenses, overdue) |

### Insights Endpoints

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/insights/dashboard`  | Get dashboard insights for current user |

### Copy-Forward Endpoints

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| POST | `/org/copy-forward`  | Copy academic data from one cycle to another |

### Communication Endpoints
**Chat**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/chat/users`  | Search users for chat |
| POST | `/org/chat/direct`  | Create/get direct chat |
| POST | `/org/chat/group`  | Create group chat |
| GET | `/org/chat/:id`  | Get chat with messages |
| POST | `/org/chat/:id/messages`  | Send message |
| GET | `/org/chats`  | List user's chats |
**Mail**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/mail`  | List mail threads |
| POST | `/org/mail`  | Create mail thread |
| GET | `/org/mail/:id`  | Get mail with messages |
| POST | `/org/mail/:id/messages`  | Reply to mail |
| PATCH | `/org/mail/:id`  | Update mail status |
**Notifications & Announcements**

| Method | Endpoint | Description |
| ----- | ----- | ----- |
| GET | `/org/notifications`  | List user notifications |
| PATCH | `/org/notifications/:id/read`  | Mark as read |
| PATCH | `/org/notifications/read-all`  | Mark all as read |
| GET | `/org/announcements`  | List announcements |
| POST | `/org/announcements`  | Create announcement |
### WebSocket Events
| Event | Direction | Description |
| ----- | ----- | ----- |
| `chat:message`  | Server → Client | New chat message |
| `chat:typing`  | Bidirectional | Typing indicator |
| `chat:read`  | Client → Server | Mark message as read |
| `notification:new`  | Server → Client | New notification |
| `presence:online`  | Server → Client | User online status |
| `presence:offline`  | Server → Client | User offline status |
---

## Security Considerations
### Authentication Security
- **Password Hashing**: Bcrypt with configurable salt rounds
- **JWT Tokens**: 
    - Default expiration: 1 day
    - Remember me: 30 days
    - Signed with secret key from environment

- **Token Payload**: userId, email, role, orgId, orgName, status
### Session Management
- **Multi-Device Support**: One active session per device (deviceId)
- **Session Tracking**: Device fingerprint, browser, OS, IP, location
- **Security Alerts**:
    - New device login notification
    - Country change detection (suspicious activity)

- **Session Revocation**:
    - On password change (all sessions)
    - On organization status change (all org users)
    - Manual revocation (except current session)

- **Auto-Cleanup**: Sessions older than 90 days automatically removed
### Authorization
- **Role-Based Access Control (RBAC)**:
    - Guards at route level (`@Roles()`  decorator)
    - Service-level authorization checks

- **Organization Isolation**:
    - All org-scoped queries filter by organizationId
    - ActiveOrgGuard prevents access to suspended/rejected orgs

- **Role Hierarchy**:SUPER_ADMIN > PLATFORM_ADMIN > ORG_ADMIN > ORG_MANAGER > TEACHER > STUDENT
### Data Protection
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Prevention**: React's built-in sanitization + markdown sanitizer
- **Rate Limiting**: NestJS Throttler module (configurable TTL/limit)
- **CORS**: Configured for specific origins
- **Input Validation**: class-validator DTOs on all endpoints
### File Security
- **Upload Validation**: File type and size restrictions
- **Cloud Storage**: Cloudinary with secure URLs
- **Cache Busting**: avatarUpdatedAt timestamp for profile pictures
- **Audit Trail**: All uploads tracked in File entity
---

## Testing Strategy
### Backend Testing
#### Unit Tests
- **Framework**: Jest
- **Coverage Target**: 80% minimum
- **Focus Areas**:
    - Service layer business logic
    - Guard authorization logic
    - DTO validation
    - Utility functions

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:cov
```
#### Integration Tests
- **Framework**: Jest + Supertest
- **Database**: Test database with Prisma migrations
- **Focus Areas**:
    - API endpoint responses
    - Authentication flows
    - Authorization enforcement
    - Database transactions

```bash
# Run e2e tests
npm run test:e2e
```
#### Test Structure
```
backend/
├── src/
│   └── **/*.spec.ts      # Unit tests (co-located)
└── test/
    ├── jest-e2e.json     # E2E configuration
    └── **/*.e2e-spec.ts  # E2E tests
```
### Frontend Testing
#### Component Testing
- **Framework**: Jest + React Testing Library
- **Focus Areas**:
    - Component rendering
    - User interactions
    - Form validation
    - Context providers

#### Integration Testing
- **Focus Areas**:
    - Page navigation
    - API integration
    - State management
    - Real-time updates

### Test Data
- **Faker.js**: `@faker-js/faker`  for generating test data
- **Seed Scripts**: Database seeding for development/testing
### CI/CD Testing
- **Pre-commit**: Lint checks
- **Pull Request**: Full test suite
- **Main Branch**: Full test suite + coverage report
---

## Rollout Plan
### Phase 1: Development Environment
1. **Prerequisites**:
    - Node.js 20+
    - PostgreSQL 15+
    - Cloudinary account

2. **Backend Setup:**
```bash
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL, JWT_SECRET, CLOUDINARY_*
npx prisma migrate dev
npm run start:dev
```

3. **Frontend Setup:**
```bash
cd frontend
npm install
cp .env.example .env.local
# Configure NEXT_PUBLIC_API_URL
npm run dev
```

### Phase 2: Staging Environment
1. **Infrastructure**:
    - PostgreSQL managed database
    - Node.js hosting (Railway, Render, AWS ECS)
    - CDN for static assets

2. **Environment Variables**:
```bash
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=<secure-random-string>
JWT_EXPIRATION=1d
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Frontend
NEXT_PUBLIC_API_URL=https://api.staging.example.com
```

3. **Database Migration:**

```bash
npx prisma migrate deploy
```

4. **Build & Deploy**:
```bash
# Backend
npm run build
npm run start:prod

# Frontend
npm run build
npm start
```

### Phase 3: Production Environment

1. **Infrastructure Requirements**:
    - Load balancer with SSL termination
    - PostgreSQL with connection pooling
    - Redis for session caching (optional)
    - CDN for static assets
    - Monitoring (APM, logging)

2. **Security Checklist**:
    - [x] SSL/TLS certificates configured
    - [x] Environment variables secured
    - [x] Database credentials rotated
    - [x] Rate limiting configured
    - [x] CORS origins restricted
    - [x] Backup strategy implemented

3. **Monitoring Setup**:
    - Application performance monitoring
    - Error tracking (Sentry)
    - Log aggregation
    - Uptime monitoring
    - Database performance metrics

4. **Rollback Plan**:
    - Database migration rollback scripts
    - Previous version container images
    - Feature flags for gradual rollout

### Phase 4: Post-Launch

1. **Performance Optimization**:
    - Database query optimization
    - Caching strategy implementation
    - CDN optimization
    - Image optimization

2. **Scaling Strategy**:
    - Horizontal scaling for API servers
    - Database read replicas
    - WebSocket server clustering

3. **Maintenance Schedule**:
    - Weekly security updates
    - Monthly dependency updates
    - Quarterly performance reviews

---

## 9. New Features

### 9.1 Password Strength Validation

#### Overview
The system implements real-time password strength validation using the `zxcvbn` library to enforce security standards across all password creation and change operations.

#### Implementation
- **Frontend Component**: `frontend/components/ui/PasswordStrength.tsx`
- **Library**: `zxcvbn` - Open-source password strength estimator
- **Integration Points**:
  - User registration (`frontend/app/register/page.tsx`)
  - Password change form (`frontend/components/ChangePasswordForm.tsx`)
  - Platform admin creation (`frontend/app/admin/platform-admins/page.tsx`)

#### Strength Scoring
The `zxcvbn` library evaluates passwords on a scale of 0-4:

| Score | Label | Color | Description |
| ----- | ----- | ----- | ----- |
| 0 | Very Weak | Red | Easily guessable patterns |
| 1 | Weak | Orange | Common words or simple patterns |
| 2 | Fair | Yellow | Moderate complexity |
| 3 | Strong | Lime | Good complexity and length |
| 4 | Very Strong | Green | Excellent password |

#### Features
- **Real-time Feedback**: Visual strength indicator updates as user types
- **Warning Messages**: Displays specific warnings (e.g., "This is a top-10 common password")
- **Suggestions**: Provides actionable suggestions for improvement
- **Visual Progress Bar**: 4-segment progress bar showing current strength level
- **Accessibility**: Color-coded labels for easy visual identification

#### Usage Example
```tsx
import PasswordStrength from '@/components/ui/PasswordStrength';

<PasswordStrength password={passwordValue} />
```

#### Security Benefits
- Prevents weak passwords that are vulnerable to brute-force attacks
- Educates users about password security best practices
- Reduces risk of account compromise due to poor password choices
- Enforces consistent security standards across the platform

---

### 9.2 Academic Lifecycle Management

#### Overview
The Academic Lifecycle Management system provides comprehensive tracking of students through academic periods (cycles) with support for historical data, audit trails, and seamless transitions between cycles.

#### Core Concepts
- **Academic Cycle**: A time-bound academic period (e.g., "Fall 2025", "Academic Year 2025-2026")
- **Active Cycle**: The currently active academic cycle for operations
- **Cycle Isolation**: Each cycle maintains separate data for sections, enrollments, assessments, grades, and attendance

#### Academic Cycle Features

##### Creation and Management
- **Create Cycle**: Define cycle name, start date, end date
- **Set Active**: Designate one cycle as active (automatically deactivates others)
- **Update Cycle**: Modify cycle dates or name
- **Delete Cycle**: Remove cycle (with data integrity checks)

##### Data Isolation
All academic data is scoped to academic cycles:
- Sections linked to cycles
- Enrollments track cycle at time of enrollment
- Assessments created within cycles
- Grades recorded per cycle
- Attendance sessions per cycle
- Course materials per cycle

##### Audit Trail
- **EnrollmentHistory**: Tracks when students enroll/withdraw from sections
- **CohortMembershipHistory**: Tracks cohort membership changes over time
- **Immutable Records**: Historical data preserved even after cycle changes

#### API Endpoints

| Role | Create | Read | Update | Delete | Activate |
| ----- | ------ | ---- | ------ | ------ | -------- |
| ORG_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| ORG_MANAGER | ✓ | ✓ | ✓ | ✓ | ✓ |
| TEACHER | ✗ | ✓ | ✗ | ✗ | ✗ |
| STUDENT | ✗ | ✓ | ✗ | ✗ | ✗ |

#### Frontend Implementation
- **Page**: `frontend/app/(org)/academic-cycles/page.tsx`
- **Features**: List, create, edit, delete, activate cycles
- **Filtering**: Search by name, sort by date
- **Status Indicators**: Visual indicator for active cycle

#### Business Rules
1. Only one cycle can be active at a time per organization
2. Cycle end date must be after start date
3. Cannot delete a cycle that has active sections or enrollments
4. Historical data preserved when changing active cycles

---

### 9.3 Cohort Management

#### Overview
Cohorts provide a flexible way to group students within an academic cycle (e.g., Grade 10, Class of 2026, Science Stream). Cohorts enable bulk operations like auto-enrollment and promotions.

#### Cohort Features

##### Cohort Creation
- Define cohort name within an academic cycle
- Assign students to cohort (bulk or individual)
- Assign sections to cohort (for auto-enrollment)

##### Student Management
- **Add Students**: Bulk add students to cohort
- **Remove Students**: Remove individual students
- **Auto-Enrollment**: Students automatically enrolled in cohort's sections
- **Exclusions**: Exclude specific students from section enrollment

##### Section Management
- **Assign Sections**: Link sections to cohort
- **Remove Sections**: Unlink sections from cohort
- **Bulk Enrollment**: All cohort students enrolled in linked sections

##### Exclusion Management
- **Exclude from Section**: Mark student as excluded from cohort enrollment
- **Include in Section**: Remove exclusion, allow auto-enrollment
- **Manual Enrollment**: Override cohort enrollment for specific students

#### Enrollment Source Tracking
The system tracks how students are enrolled:

| Source | Description | Behavior |
| ----- | ----- | ----- |
| MANUAL | Manually enrolled by admin/teacher | Not affected by cohort changes |
| COHORT | Auto-enrolled via cohort | Updates when cohort sections change |

#### API Endpoints

| Operation | Method | Endpoint | Roles |
| --------- | ------ | -------- | ----- |
| Create Cohort | POST | `/org/cohorts` | ORG_ADMIN, ORG_MANAGER |
| List Cohorts | GET | `/org/cohorts` | ORG_ADMIN, ORG_MANAGER, TEACHER |
| Get Cohort | GET | `/org/cohorts/:id` | ORG_ADMIN, ORG_MANAGER, TEACHER |
| Update Cohort | PATCH | `/org/cohorts/:id` | ORG_ADMIN, ORG_MANAGER |
| Delete Cohort | DELETE | `/org/cohorts/:id` | ORG_ADMIN, ORG_MANAGER |
| Add Students | POST | `/org/cohorts/:id/students` | ORG_ADMIN, ORG_MANAGER |
| Remove Student | DELETE | `/org/cohorts/:id/students/:studentId` | ORG_ADMIN, ORG_MANAGER |
| Assign Section | POST | `/org/cohorts/:id/sections` | ORG_ADMIN, ORG_MANAGER |
| Remove Section | DELETE | `/org/cohorts/:id/sections/:sectionId` | ORG_ADMIN, ORG_MANAGER |
| Exclude Student | POST | `/org/cohorts/enrollments/exclude` | ORG_ADMIN, ORG_MANAGER, TEACHER |
| Include Student | POST | `/org/cohorts/enrollments/include` | ORG_ADMIN, ORG_MANAGER, TEACHER |

#### Frontend Implementation
- **List Page**: `frontend/app/(org)/cohorts/page.tsx`
- **Detail Page**: `frontend/app/(org)/cohorts/[id]/page.tsx`
- **Features**: CRUD operations, student management, section assignment, exclusion management

#### Business Rules
1. Cohorts must be created within an academic cycle
2. Students can belong to only one cohort per cycle
3. Sections can be linked to multiple cohorts
4. Excluded students are not auto-enrolled when cohort sections change
5. Removing a student from cohort closes their CohortMembershipHistory record

---

### 9.4 Transcript Generation

#### Overview
The Transcript system generates comprehensive academic records for students, including enrollment history, grades, attendance summaries, and cohort information across academic cycles.

#### Transcript Features

##### Student Transcripts
- **Comprehensive View**: All academic data across all cycles
- **Cycle Filtering**: View transcript for specific academic cycle
- **Enrollment History**: Track section enrollments over time
- **Cohort History**: Track cohort membership over time
- **Grade Summary**: All grades with assessment details
- **Attendance Summary**: Attendance records per section

##### Cycle Reports
- **Aggregated Data**: Cycle-level statistics
- **Performance Metrics**: Average grades, completion rates
- **Attendance Metrics**: Overall attendance rates
- **Cohort Analysis**: Performance by cohort

#### Data Included in Transcript

| Data Type | Description | Source |
| --------- | ----------- | ------ |
| Student Info | Name, email, registration number, cohort | Student table |
| Enrollment History | Section enrollments with dates | EnrollmentHistory |
| Cohort History | Cohort membership with dates | CohortMembershipHistory |
| Grades | Assessment grades with feedback | Grade table |
| Assessments | Assessment details (type, weight, total marks) | Assessment table |
| Attendance | Attendance records per session | AttendanceRecord |
| Courses | Course names and descriptions | Course table |
| Sections | Section details with room/schedule | Section table |

#### Access Control

| Role | Student Transcript | Cycle Report |
| ----- | ----------------- | ------------ |
| ORG_ADMIN | ✓ (all students) | ✓ |
| ORG_MANAGER | ✓ (all students) | ✓ |
| TEACHER | ✓ (assigned students) | ✗ |
| STUDENT | ✓ (own only) | ✗ |

#### API Endpoints

| Operation | Method | Endpoint | Description |
| --------- | ------ | -------- | ----------- |
| Get Student Transcript | GET | `/org/transcripts/students/:id` | Get transcript (optional cycle filter) |
| Get Cycle Report | GET | `/org/transcripts/cycles/:id/report` | Get cycle-level statistics |

#### Frontend Implementation
- **Transcript Page**: `frontend/app/(org)/transcripts/page.tsx`
- **Features**: 
  - Student selection dropdown
  - Academic cycle filter
  - Print/export functionality
  - Responsive layout for viewing

#### Business Rules
1. Students can only view their own transcripts
2. Teachers can view transcripts for students in their sections
3. Admins/Managers can view all student transcripts
4. Historical data preserved from EnrollmentHistory and CohortMembershipHistory
5. Grades show status (DRAFT, PUBLISHED, FINALIZED)

---

### 9.5 Student Promotions

#### Overview
The Promotions system enables seamless transition of students between academic cycles and cohorts, preserving historical data while updating current assignments.

#### Promotion Process

##### Steps
1. **Validate Cycles**: Verify source and target cycles exist in organization
2. **Validate Cohort**: Verify target cohort exists in target cycle
3. **Validate Students**: Verify all students exist in organization
4. **For Each Student**:
   - Close CohortMembershipHistory for old cohort
   - Update Student.cohortId to new cohort
   - Create new CohortMembershipHistory
   - Auto-enroll into new cohort's sections (if not excluded)
5. **Preserve Old Data**: Does NOT modify or delete old cycle data

##### Data Changes
- **Student.cohortId**: Updated to new cohort
- **CohortMembershipHistory**: New record created, old record closed with `leftAt`
- **Enrollment**: New enrollments created for target cohort sections
- **EnrollmentHistory**: Records enrollment changes

##### What's Preserved
- All grades from previous cycles
- All attendance records from previous cycles
- All enrollment history
- All cohort membership history
- All assessments and submissions from previous cycles

#### API Endpoints

| Operation | Method | Endpoint | Roles |
| --------- | ------ | -------- | ----- |
| Promote Students | POST | `/org/promotions` | ORG_ADMIN, ORG_MANAGER |

#### Request Body
```typescript
{
  fromCycleId: string;    // Source academic cycle
  toCycleId: string;      // Target academic cycle
  toCohortId: string;     // Target cohort (must be in toCycleId)
  studentIds: string[];   // Students to promote
}
```

#### Frontend Implementation
- **Promotions Page**: `frontend/app/(org)/promotions/page.tsx`
- **Features**:
  - Select source cycle
  - Select target cycle
  - Select target cohort
  - Multi-select students
  - Preview changes before confirmation
  - Progress indicator during bulk promotion

#### Business Rules
1. Source and target cycles must be in the same organization
2. Target cohort must belong to target cycle
3. Students must be in source cycle (verified via cohort or enrollment)
4. Promotion is atomic - all students succeed or all fail
5. Cannot promote students with active enrollments in current cycle
6. Exclusion status preserved when auto-enrolling in new sections

#### Use Cases
- **End of Year Promotion**: Move Grade 10 students to Grade 11
- **Mid-Year Transfer**: Move students between cohorts within same cycle
- **Batch Reassignment**: Reassign multiple students to different cohort
- **Graduation**: Move graduating students to alumni status (via status change)

---

### 9.6 Financial Management System

#### Overview
The Financial Management System provides comprehensive tracking of income (student fees) and expenses (teacher salaries) with support for recurring billing structures, payment verification, and transaction history.

#### Core Concepts
- **FinancialStructure**: Template for recurring financial obligations (tuition, salary, transport, etc.)
- **FinancialEntry**: Specific instance of a financial obligation (e.g., "September 2025 Tuition")
- **Transaction**: Actual payment record (income received or expense paid)
- **Billing Cycles**: ONCE, MONTHLY, SEMESTER, YEARLY, ACADEMIC_CYCLE

#### Financial Structure Features

##### Structure Creation
- Define recurring or one-time financial obligations
- Set billing cycle (monthly, semester, yearly, etc.)
- Assign to individual students/teachers or use as default
- Set amount, currency, and due day
- Configure start and end dates

##### Structure Types
- **Student Structures**: Tuition, transport, library, exam fees, hostel, activity fees
- **Teacher Structures**: Salary, bonuses, reimbursements
- **Categories**: TUITION, TRANSPORT, LIBRARY, EXAM, SALARY, BONUS, ADMISSION, HOSTEL, ACTIVITY, REIMBURSEMENT, OTHER

#### Financial Entry Features

##### Entry Generation
- **System-Generated**: Auto-created from active structures based on billing cycle
- **Manual Entry**: Ad-hoc charges or payments created by admin

##### Payment Workflow
1. **PENDING**: Entry created, awaiting payment
2. **Mark as Paid**: Student/teacher marks entry as paid with receipt
3. **UNVERIFIED**: Entry marked as paid, awaiting admin confirmation
4. **Confirm Payment**: Admin verifies receipt, creates transaction record
5. **PAID**: Entry fully paid and confirmed
6. **PARTIAL**: Partial payment accepted
7. **OVERDUE**: Past due date without payment

##### Entry Status Flow
```
PENDING → (user marks paid) → UNVERIFIED → (admin confirms) → PAID
PENDING → (partial payment) → PARTIAL → (admin confirms partial) → PARTIAL → (full payment) → PAID
PENDING → (past due date) → OVERDUE
```

#### Transaction Features

##### Transaction Recording
- Automatically created when admin confirms payment
- Tracks type (INCOME/EXPENSE), category, amount
- Links to related financial entry
- Records payment method and reference number

##### Transaction Types
- **INCOME**: Student fee payments
- **EXPENSE**: Teacher salary payments, other expenses

#### Financial Statistics

The system provides comprehensive financial analytics:
- **Total Expected Income**: Sum of all pending entry amounts
- **Total Collected Income**: Sum of all paid amounts
- **Overdue Amount**: Sum of overdue entries
- **Total Salary Expenses**: Sum of teacher salary entries
- **Pending Confirmations**: Count of entries awaiting admin verification
- **Recent Transactions**: Latest 5 transactions

#### Access Control

| Operation | ORG_ADMIN | ORG_MANAGER | TEACHER | STUDENT |
| --------- | --------- | ----------- | ------- | ------- |
| Create Structure | ✓ | ✓ | ✗ | ✗ |
| Update Structure | ✓ | ✓ | ✗ | ✗ |
| View Structures | ✓ (all) | ✓ (all) | ✓ (own) | ✓ (own) |
| Create Manual Entry | ✓ | ✓ | ✗ | ✗ |
| Mark Entry as Paid | ✓ | ✓ | ✓ (own) | ✓ (own) |
| Confirm Payment | ✓ | ✓ | ✗ | ✗ |
| View Entries | ✓ (all) | ✓ (all) | ✓ (own) | ✓ (own) |
| View Transactions | ✓ (all) | ✓ (all) | ✓ (own) | ✓ (own) |
| View Stats | ✓ (org) | ✓ (org) | ✓ (own) | ✓ (own) |

#### API Endpoints

| Operation | Method | Endpoint | Roles |
| --------- | ------ | -------- | ----- |
| Create Structure | POST | `/finance/structures` | ORG_ADMIN, ORG_MANAGER |
| Update Structure | PATCH | `/finance/structures/:id` | ORG_ADMIN, ORG_MANAGER |
| List Structures | GET | `/finance/structures` | All (filtered by role) |
| Create Manual Entry | POST | `/finance/entries/manual` | ORG_ADMIN, ORG_MANAGER |
| List Entries | GET | `/finance/entries` | All (filtered by role) |
| Mark as Paid | PATCH | `/finance/entries/:id/mark-paid` | All (own entries only) |
| Confirm Payment | PATCH | `/finance/entries/:id/confirm` | ORG_ADMIN, ORG_MANAGER |
| List Transactions | GET | `/finance/transactions` | All (filtered by role) |
| Get Stats | GET | `/finance/stats` | All (filtered by role) |

#### Business Rules
1. Financial structures can be assigned to individual students/teachers or used as defaults
2. Only one structure per category per student/teacher
3. Entries are auto-generated from active structures based on billing cycle
4. Users can mark their own entries as paid with receipt upload
5. Admin must confirm payments before they are recorded as transactions
6. Partial payments are supported
7. Historical data preserved even after structures are deactivated
8. Currency is organization-specific

#### Use Cases
- **Monthly Tuition Billing**: Auto-generate monthly tuition entries for all students
- **Salary Payments**: Track teacher salary payments with verification
- **One-Time Fees**: Create manual entries for admission fees, activity fees
- **Payment Tracking**: Students mark payments, admins verify receipts
- **Financial Reports**: View income, expenses, overdue amounts
- **Individual Plans**: Create custom fee structures for specific students

---

### 9.7 Dashboard Insights

#### Overview
The Dashboard Insights system provides role-specific analytics and actionable intelligence for administrators, teachers, and students. It aggregates data across the system to present key metrics, trends, and attention items.

#### Insight Types

##### Role-Specific Dashboards
- **Organization Admin/Manager**: Operational overview, staffing, scheduling, attendance coverage
- **Teacher**: Teaching command center, upcoming assessments, submissions, student performance
- **Student**: Personal academic progress, upcoming deadlines, attendance summary

##### Insight Components
- **Summary Cards**: High-level metrics with trend indicators
- **Spotlight**: Time-sensitive items requiring immediate attention
- **Insight Groups**: Categorized items (needs attention, capacity, etc.)
- **Recent Activity**: Timeline of recent actions and events
- **Charts**: Visual data representations (trends, distributions, comparisons)

#### Organization Admin Insights

##### Summary Cards
- **Active Staff**: Total teachers, sections without teachers
- **Active Students**: Total students, active sections count
- **Learning Units**: Total courses, sections in delivery
- **Attendance Coverage**: Scheduled vs marked attendance (14-day window)
- **Open Mail Threads**: Operational requests awaiting action

##### Spotlight
- **Next Class**: Upcoming class with time, location, and course details

##### Insight Groups
- **Needs Attention**: Sections without teachers, sections without schedules, upcoming assessments
- **Section Hotspots**: Most populated sections with enrollment counts

##### Charts
- **Enrollment Trend**: Student enrollments over time (30 days)
- **Attendance Trend**: Attendance coverage over time (30 days)
- **Mail Status**: Distribution of mail thread statuses
- **Section Capacity**: Enrollment counts per section
- **Teacher Workload**: Sections and students per teacher

#### Teacher Insights

##### Summary Cards
- **My Sections**: Total assigned sections
- **My Students**: Total unique students across sections
- **Upcoming Assessments**: Assessments due in next 7 days
- **Attendance Coverage**: Scheduled vs marked attendance (14-day window)
- **Pending Submissions**: Recent submissions awaiting review

##### Spotlight
- **Next Class**: Upcoming class with time, location, and course details

##### Insight Groups
- **Needs Attention**: Missed attendance sessions, upcoming assessments
- **At-Risk Students**: Students with low attendance (<75%)

##### Charts
- **Attendance Trend**: Attendance coverage over time (30 days)
- **Grade Distribution**: Grade ranges across all assessments
- **Assessment Completion**: Submission rates per assessment
- **Student Performance**: Grades and attendance per student

#### Data Sources

Insights aggregate data from:
- **Academic**: Sections, enrollments, assessments, grades, submissions
- **Attendance**: Schedules, sessions, records
- **Personnel**: Teachers, students
- **Communication**: Mail threads
- **Financial**: (future integration)

#### Access Control

| Role | Org Stats | Teacher Stats | Student Stats |
| ----- | --------- | ------------ | ------------- |
| ORG_ADMIN | ✓ (full) | ✓ (all) | ✓ (all) |
| ORG_MANAGER | ✓ (full) | ✓ (all) | ✓ (all) |
| TEACHER | ✗ | ✓ (own) | ✓ (assigned) |
| STUDENT | ✗ | ✗ | ✓ (own) |

#### API Endpoints

| Operation | Method | Endpoint | Description |
| --------- | ------ | -------- | ----------- |
| Get Dashboard Insights | GET | `/insights/dashboard` | Get role-specific insights |

#### Frontend Implementation
- **Dashboard Page**: `frontend/app/(org)/dashboard/page.tsx`
- **Features**: 
  - Role-specific layout and components
  - Interactive charts with tooltips
  - Click-through to detailed views
  - Real-time data refresh
  - Responsive design for mobile

#### Business Rules
1. Insights are computed on-demand from current database state
2. Data filtered by user's organization and role
3. Teachers see only data for their assigned sections and students
4. Students see only their own data
5. Time windows: 14 days for attendance, 30 days for trends
6. Recent activity limited to most recent 6 items per category

---

### 9.8 Copy-Forward System

#### Overview
The Copy-Forward system enables efficient setup of new academic cycles by copying sections, schedules, assessments, and course materials from a source cycle to a target cycle. This reduces manual setup time and ensures consistency across academic periods.

#### Copy-Forward Features

##### Data Types to Copy
- **Sections**: Section names, rooms, course assignments, teacher assignments
- **Schedules**: Timetable information (day, time, room)
- **Assessments**: Assessment templates (title, type, marks, weightage)
- **Course Materials**: Learning resources (links, descriptions)

##### Copy Process
1. **Select Source Cycle**: Choose the academic cycle to copy from
2. **Select Target Cycle**: Choose the destination academic cycle
3. **Choose Data Types**: Toggle which data types to copy
4. **Execute Copy**: System creates new records in target cycle
5. **Review Results**: Summary of copied items (sections, schedules, assessments, materials)

##### Data Handling
- **New IDs**: All copied records receive new primary keys
- **No Links**: No references back to source cycle records
- **Teacher Preservation**: Teacher assignments preserved (same teacher IDs)
- **Course Preservation**: Course assignments preserved (same course IDs)
- **Cycle Update**: All records linked to target academic cycle

#### Copy Options

| Data Type | Description | Notes |
| --------- | ----------- | ----- |
| Sections | Section definitions with teacher assignments | Always copied if selected |
| Schedules | Timetable information for sections | Optional, requires sections |
| Assessments | Assessment templates | Optional, requires sections |
| Course Materials | Learning resources | Optional, requires sections |

#### Access Control

| Operation | ORG_ADMIN | ORG_MANAGER | TEACHER | STUDENT |
| --------- | --------- | ----------- | ------- | ------- |
| Copy Forward | ✓ | ✓ | ✗ | ✗ |

#### API Endpoints

| Operation | Method | Endpoint | Description |
| --------- | ------ | -------- | ----------- |
| Copy Forward | POST | `/org/copy-forward` | Copy data between cycles |

#### Request Body
```typescript
{
  fromCycleId: string;      // Source academic cycle
  toCycleId: string;        // Target academic cycle
  copySchedules: boolean;   // Copy timetable data
  copyAssessments: boolean; // Copy assessment templates
  copyMaterials: boolean;   // Copy course materials
}
```

#### Response
```typescript
{
  message: string;
  sectionsCopied: number;
  schedulesCopied: number;
  assessmentsCopied: number;
  materialsCopied: number;
}
```

#### Frontend Implementation
- **Copy-Forward Page**: `frontend/app/(org)/copy-forward/page.tsx`
- **Features**:
  - Cycle selection dropdowns
  - Checkbox toggles for data types
  - Preview of items to be copied
  - Progress indicator during copy operation
  - Success summary with counts

#### Business Rules
1. Source and target cycles must be different
2. Both cycles must belong to the same organization
3. Copy operation is atomic - all items succeed or all fail
4. Teacher assignments preserved (teachers must exist)
5. Course assignments preserved (courses must exist)
6. No data is modified in source cycle
7. Target cycle data is not deleted (only added)
8. Duplicate section names allowed in different cycles

#### Use Cases
- **New Academic Year**: Copy all data from previous year to new year
- **Semester Setup**: Copy sections and schedules for new semester
- **Course Replication**: Copy course structure across multiple cycles
- **Template Reuse**: Copy assessment templates for consistent grading

---

## Appendix
### A. Libraries and Dependencies
#### Backend Dependencies
| Package | Version | Purpose |
| ----- | ----- | ----- |
| @nestjs/core | ^11.0.1 | NestJS framework core |
| @nestjs/jwt | ^11.0.2 | JWT authentication |
| @nestjs/passport | ^11.0.2 | Passport integration |
| @nestjs/websockets | ^11.1.17 | WebSocket support |
| @nestjs/platform-socket.io | ^11.1.17 | Socket.IO adapter |
| @nestjs/throttler | ^6.5.0 | Rate limiting |
| @nestjs/schedule | ^6.1.1 | Task scheduling |
| @nestjs/config | ^4.0.3 | Configuration management |
| @prisma/client | ^6.4.1 | Database ORM |
| bcrypt | ^6.0.0 | Password hashing |
| class-validator | ^0.14.4 | DTO validation |
| class-transformer | ^0.5.1 | Data transformation |
| cloudinary | ^1.41.3 | Cloud file storage |
| passport-jwt | ^4.0.1 | JWT strategy |
#### Frontend Dependencies
| Package | Version | Purpose |
| ----- | ----- | ----- |
| next | 16.1.6 | React framework |
| react | 19.2.3 | UI library |
| react-hook-form | ^7.71.2 | Form management |
| @hookform/resolvers | ^5.2.2 | Form validation resolvers |
| zod | ^4.3.6 | Schema validation |
| socket.io-client | ^4.8.3 | WebSocket client |
| tailwind-merge | ^3.5.0 | CSS class merging |
| lucide-react | ^0.577.0 | Icon library |
| date-fns | ^4.1.0 | Date formatting |
| marked | ^17.0.4 | Markdown rendering |
| clsx | ^2.1.1 | Conditional classes |
| react-easy-crop | ^5.5.6 | Image cropping |
| zxcvbn | ^2.0.0 | Password strength validation |
### B. Environment Variables Reference
```bash
# Backend
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1d
PORT=3000
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
```
### C. Status Enumerations
| Entity | Status Values |
| ----- | ----- |
| Organization | PENDING, APPROVED, REJECTED, SUSPENDED |
| Teacher | ACTIVE, SUSPENDED, ON_LEAVE, DELETED |
| Student | ACTIVE, SUSPENDED, ALUMNI, DELETED |
| Grade | DRAFT, PUBLISHED, FINALIZED |
| Mail | OPEN, IN_PROGRESS, AWAITING_RESPONSE, RESOLVED, CLOSED, NO_REPLY |
| Attendance | PRESENT, ABSENT, LATE, EXCUSED |
| EnrollmentSource | MANUAL, COHORT |
| AcademicCycle | isActive: boolean (only one active per org) |
| FinanceCategory | TUITION, TRANSPORT, LIBRARY, EXAM, SALARY, BONUS, ADMISSION, HOSTEL, ACTIVITY, REIMBURSEMENT, OTHER |
| BillingCycle | ONCE, MONTHLY, SEMESTER, YEARLY, ACADEMIC_CYCLE |
| EntryStatus | PENDING, UNVERIFIED, PARTIAL, PAID, OVERDUE, CANCELLED |
| EntrySource | SYSTEM, MANUAL |
| TransactionType | INCOME, EXPENSE |
---

# System Activity Diagrams
## EduVerse - Mermaid Flowcharts

---

## 1. User Authentication Flow

```mermaid
flowchart TD
    A[User visits app] --> B{Has account?}
    B -->|No| C[Register Page]
    B -->|Yes| D[Login Page]
    
    C --> E[Enter name email password]
    E --> F[Submit registration]
    F --> G{Validation passed?}
    G -->|No| H[Show error messages]
    H --> E
    G -->|Yes| I[Create account]
    I --> J[Auto-login user]
    J --> K[Redirect to dashboard]
    
    D --> L[Enter credentials]
    L --> M[Submit login]
    M --> N{Credentials valid?}
    N -->|No| O[Show error]
    O --> L
    N -->|Yes| P{Check user role}
    
    P -->|Admin| Q[Redirect to admin dashboard]
    P -->|Org User| K
    P -->|Super Admin| R[Redirect to super admin panel]
    
    K --> S[Load user data]
    S --> T[Initialize theme]
    T --> U[Connect to WebSocket]
    U --> V[Dashboard ready]
```

---

## 2. Chat Messaging Flow

```mermaid
flowchart TD
    A[User opens chat] --> B[Load chat list]
    B --> C[Fetch user chats from API]
    C --> D{Chats exist?}
    D -->|No| E[Show empty state]
    D -->|Yes| F[Display chat list]
    
    F --> G[User selects chat]
    G --> H[Load chat messages]
    H --> I[Subscribe to presence updates]
    I --> J[Subscribe to message events]
    J --> K[Display message history]
    
    K --> L{User action?}
    
    L -->|Send message| M[Type message]
    M --> N[Add attachments?]
    N -->|Yes| O[Upload files]
    O --> P{Upload success?}
    P -->|No| Q[Show upload error]
    Q --> M
    P -->|Yes| R[Files attached]
    N -->|No| R
    R --> S[Send message via WebSocket]
    S --> T[Optimistic UI update]
    T --> U[Wait for server confirmation]
    U --> V{Message confirmed?}
    V -->|Yes| W[Final message state]
    V -->|No| X[Mark as failed]
    X --> Y[Show retry option]
    
    L -->|Long press message| Z[Show context menu]
    Z --> AA{User selects action}
    AA -->|Reply| AB[Set reply reference]
    AB --> M
    AA -->|Copy| AC[Copy to clipboard]
    AA -->|Edit| AD[Enter edit mode]
    AD --> AE[Save changes]
    AA -->|Delete| AF[Confirm delete]
    AF --> AG[Delete message]
    
    L -->|Scroll up| AH[Load older messages]
    AH --> AI[Paginate messages]
    AI --> K
    
    L -->|Switch chat| G
    L -->|Close chat| AJ[Unsubscribe events]
    AJ --> AK[Clear chat state]
```

---

## 3. Mail System Flow

```mermaid
flowchart TD
    A[User opens mail] --> B[Fetch inbox]
    B --> C{Unread mail?}
    C -->|Yes| D[Display unread badge]
    C -->|No| E[Show inbox]
    D --> E
    
    E --> F{User action?}
    
    F -->|Select mail| G[Load mail content]
    G --> H{Mail has attachments?}
    H -->|Yes| I[Show attachment list]
    H -->|No| J[Display content]
    I --> J
    J --> K[Mark as read]
    K --> L[Update unread count]
    
    F -->|Compose mail| M[Open compose modal]
    M --> N[Enter recipient]
    N --> O[Enter subject]
    O --> P[Type message body]
    P --> Q[Add attachments?]
    Q -->|Yes| R[Upload files]
    R --> S[Attach to mail]
    Q -->|No| T[Review mail]
    S --> T
    T --> U[Send mail]
    U --> V{Send successful?}
    V -->|Yes| W[Close modal]
    W --> E
    V -->|No| X[Show error]
    X --> T
    
    F -->|Delete mail| Y[Confirm deletion]
    Y --> Z[Move to trash]
    Z --> AA[Remove from list]
    
    F -->|Refresh| B
```

---

## 4. Theme Settings Flow

```mermaid
flowchart TD
    A[User opens settings] --> B[Load settings page]
    B --> C[Fetch current theme]
    C --> D[Display theme options]
    
    D --> E{User changes theme?}
    
    E -->|Change mode| F[Select Light Dark System]
    F --> G[Apply theme preview]
    G --> H[Update CSS variables]
    H --> I[Store in localStorage]
    
    E -->|Change primary color| J[Select accent color]
    J --> K[Update primary color]
    K --> L[Compute secondary color]
    L --> M[Apply color preview]
    M --> N[Update CSS properties]
    
    E -->|Save changes| O[Submit to API]
    O --> P{Save successful?}
    P -->|Yes| Q[Show success toast]
    P -->|No| R[Show error toast]
    R --> D
    
    E -->|Cancel| S[Revert changes]
    S --> D
```

---

## 5. Dashboard Navigation Flow

```mermaid
flowchart TD
    A[User logged in] --> B[Load dashboard layout]
    B --> C[Initialize sidebar]
    C --> D{Sidebar state}
    D -->|Expanded| E[Show full sidebar]
    D -->|Collapsed| F[Show icons only]
    
    E --> G[Render navigation links]
    F --> G
    
    G --> H[Check user role]
    H --> I{Role based links}
    
    I -->|Admin| J[Show admin links]
    I -->|User| K[Show user links]
    I -->|Super Admin| L[Show super admin links]
    
    J --> M[Render bottom section]
    K --> M
    L --> M
    
    M --> N{Bottom section collapsed?}
    N -->|Yes| O[Show toggle button with badge]
    N -->|No| P[Show full bottom links]
    
    N --> Q[User clicks navigation]
    Q --> R[Navigate to route]
    R --> S[Load page content]
    S --> T[Update active link state]
    T --> U[Page ready]
    
    Q -->|Toggle sidebar| V[Toggle expanded state]
    V --> W[Animate transition]
    W --> D
    
    Q -->|Toggle bottom section| X[Toggle collapse state]
    X --> Y[Animate section]
    Y --> N
```

---

## 7. Financial Payment Flow

```mermaid
flowchart TD
    A[Financial Structure Created] --> B[Billing Cycle Triggered]
    B --> C[Generate Financial Entry]
    C --> D[Entry Status: PENDING]
    
    D --> E{User marks as paid?}
    E -->|Yes| F[Upload Receipt]
    F --> G[Mark Entry as Paid]
    G --> H[Entry Status: UNVERIFIED]
    H --> I[Notify Admin]
    
    E -->|No| J[Due Date Passed?]
    J -->|Yes| K[Entry Status: OVERDUE]
    J -->|No| D
    
    I --> L{Admin confirms payment?}
    L -->|Yes| M[Verify Receipt]
    M --> N[Create Transaction]
    N --> O[Update Entry Status]
    O --> P{Full payment?}
    P -->|Yes| Q[Entry Status: PAID]
    P -->|No| R[Entry Status: PARTIAL]
    
    L -->|No| S[Reject Payment]
    S --> T[Entry Status: PENDING]
    T --> U[Notify User]
    
    Q --> V[Payment Complete]
    R --> W[Await Remaining Payment]
    W --> E
```

---

## 8. Copy-Forward Flow

```mermaid
flowchart TD
    A[Admin initiates copy-forward] --> B[Select Source Cycle]
    B --> C[Select Target Cycle]
    C --> D{Cycles different?}
    D -->|No| E[Show error]
    E --> B
    
    D -->|Yes| F[Select Data Types]
    F --> G{Copy Schedules?}
    F --> H{Copy Assessments?}
    F --> I{Copy Materials?}
    
    G -->|Yes| J[Include Schedules]
    H -->|Yes| K[Include Assessments]
    I -->|Yes| L[Include Materials]
    
    J --> M[Preview Copy Operation]
    K --> M
    L --> M
    
    M --> N[Confirm Copy]
    N --> O[Start Transaction]
    
    O --> P[For Each Section]
    P --> Q[Create New Section]
    Q --> R[Copy Teacher Assignments]
    R --> S{Schedules selected?}
    S -->|Yes| T[Copy Schedules]
    S -->|No| U[Skip Schedules]
    
    T --> V{Assessments selected?}
    U --> V
    V -->|Yes| W[Copy Assessments]
    V -->|No| X[Skip Assessments]
    
    W --> Y{Materials selected?}
    X --> Y
    Y -->|Yes| Z[Copy Materials]
    Y -->|No| AA[Skip Materials]
    
    Z --> AB[More Sections?]
    AA --> AB
    AB -->|Yes| P
    AB -->|No| AC[Commit Transaction]
    
    AC --> AD[Show Results Summary]
    AD --> AE[Copy Complete]
```

---

## 9. Dashboard Insights Generation Flow

```mermaid
flowchart TD
    A[User requests dashboard] --> B[Authenticate User]
    B --> C[Get User Role]
    C --> D{Role Type}
    
    D -->|Org Admin/Manager| E[Build Org Admin Insights]
    D -->|Teacher| F[Build Teacher Insights]
    D -->|Student| G[Build Student Insights]
    
    E --> H[Query Organization Data]
    H --> I[Calculate Staff Metrics]
    I --> J[Calculate Student Metrics]
    J --> K[Calculate Attendance Coverage]
    K --> L[Identify Sections Without Teachers]
    L --> M[Identify Sections Without Schedules]
    M --> N[Get Upcoming Assessments]
    N --> O[Generate Charts]
    O --> P[Compile Recent Activity]
    P --> Q[Return Org Admin Insights]
    
    F --> R[Query Teacher Data]
    R --> S[Get Assigned Sections]
    S --> T[Calculate Student Count]
    T --> U[Get Upcoming Assessments]
    U --> V[Calculate Attendance Coverage]
    V --> W[Identify Missed Sessions]
    W --> X[Identify At-Risk Students]
    X --> Y[Get Recent Submissions]
    Y --> Z[Generate Charts]
    Z --> AA[Compile Recent Activity]
    AA --> AB[Return Teacher Insights]
    
    G --> AC[Query Student Data]
    AC --> AD[Get Enrollments]
    AD --> AE[Get Upcoming Assessments]
    AE --> AF[Get Grades]
    AF --> AG[Calculate GPA]
    AG --> AH[Get Attendance Records]
    AH --> AI[Calculate Attendance Rate]
    AI --> AJ[Compile Personal Stats]
    AJ --> AK[Return Student Insights]
    
    Q --> AL[Render Dashboard]
    AB --> AL
    AK --> AL
```

---

## 10. Admin User Management Flow

```mermaid
flowchart TD
    A[Admin opens users] --> B[Load user list]
    B --> C[Fetch users from API]
    C --> D[Display user table]
    
    D --> E{Admin action?}
    
    E -->|Search| F[Enter search term]
    F --> G[Filter user list]
    G --> D
    
    E -->|Filter| H[Select filter criteria]
    H --> I[Apply filter]
    I --> D
    
    E -->|Create user| J[Open create modal]
    J --> K[Enter user details]
    K --> L[Select role]
    L --> M[Submit create]
    M --> N{Validation passed?}
    N -->|No| O[Show errors]
    O --> K
    N -->|Yes| P[Create user]
    P --> Q[Refresh user list]
    Q --> D
    
    E -->|Edit user| R[Select user]
    R --> S[Open edit modal]
    S --> T[Update details]
    T --> U[Save changes]
    U --> V{Save successful?}
    V -->|Yes| W[Update user list]
    V -->|No| X[Show error]
    X --> T
    W --> D
    
    E -->|Delete user| Y[Select user]
    Y --> Z[Confirm deletion]
    Z --> AA{Confirmed?}
    AA -->|No| D
    AA -->|Yes| AB[Delete user]
    AB --> AC[Remove from list]
    AC --> D
    
    E -->|Change role| AD[Select user]
    AD --> AE[Select new role]
    AE --> AF[Update role]
    AF --> AG[Notify user]
    AG --> D
```

---

## 7. File Upload Flow (Chat Attachment)

```mermaid
flowchart TD
    A[User in chat] --> B[Click attachment button]
    B --> C[Open file picker]
    C --> D[User selects files]
    D --> E{Files selected?}
    E -->|No| A
    E -->|Yes| F[Validate files]
    
    F --> G{Valid?}
    G -->|No| H[Show validation error]
    H --> B
    
    G -->|Yes| I[Preview attachments]
    I --> J{User confirms?}
    J -->|No| K[Remove attachments]
    K --> B
    
    J -->|Yes| L[Start upload]
    L --> M[Show progress indicator]
    M --> N[Upload chunk by chunk]
    N --> O{Upload complete?}
    
    O -->|Error| P[Show upload error]
    P --> Q{Retry?}
    Q -->|Yes| L
    Q -->|No| K
    
    O -->|Success| R[Files uploaded]
    R --> S[Attach to message]
    S --> T[Enable send button]
    T --> U[User sends message]
    U --> V[Include attachments in message]
    V --> W[Message sent]
```

---

## 8. Real-time Presence Flow

```mermaid
flowchart TD
    A[App starts] --> B[Connect to WebSocket]
    B --> C{Connection successful?}
    C -->|No| D[Retry connection]
    D --> B
    
    C -->|Yes| E[Subscribe to presence]
    E --> F[Emit user online]
    F --> G[Listen for presence updates]
    
    G --> H{Received update}
    H -->|User online| I[Update online status]
    I --> J[Show online indicator]
    
    H -->|User offline| K[Update offline status]
    K --> L[Show last seen time]
    
    H -->|Typing started| M[Show typing indicator]
    M --> N[Animate dots]
    
    H -->|Typing stopped| O[Hide typing indicator]
    
    H -->|User disconnect| P[Handle disconnect]
    P --> Q{Reconnect?}
    Q -->|Yes| R[Reconnect]
    R --> B
    Q -->|No| S[Go offline]
    
    T[User closes app] --> U[Emit offline]
    U --> V[Update last seen]
    V --> W[Disconnect WebSocket]
```

---

## 9. Notification System Flow

```mermaid
flowchart TD
    A[Event occurs] --> B{Event type?}
    
    B -->|New message| C[Create message notification]
    B -->|New mail| D[Create mail notification]
    B -->|System alert| E[Create system notification]
    
    C --> F[Determine recipients]
    D --> F
    E --> F
    
    F --> G{User online?}
    G -->|Yes| H[Send via WebSocket]
    H --> I[Show toast notification]
    I --> J[Update badge count]
    
    G -->|No| K[Queue notification]
    K --> L[Send push notification]
    L --> M[Store for later]
    
    N[User clicks notification] --> O{Notification type?}
    O -->|Message| P[Navigate to chat]
    O -->|Mail| Q[Navigate to mail]
    O -->|System| R[Navigate to relevant page]
    
    S[User dismisses] --> T[Clear notification]
    T --> U[Update badge count]
```

---

## 10. Settings Update Flow

```mermaid
flowchart TD
    A[User opens settings] --> B[Load current settings]
    B --> C[Display settings form]
    
    C --> D{User edits}
    D -->|Personal info| E[Update name email]
    D -->|Password| F[Enter old password]
    F --> G[Enter new password]
    G --> H[Confirm new password]
    
    D -->|Theme| I[Change color mode]
    I --> J[Preview theme]
    
    D -->|Organization| K[Update org details]
    K --> L[Upload logo?]
    L -->|Yes| M[Upload new logo]
    L -->|No| N[Review changes]
    M --> N
    
    E --> N
    H --> O{Passwords match?}
    O -->|No| P[Show mismatch error]
    P --> G
    O -->|Yes| N
    J --> N
    
    N --> Q[Click save]
    Q --> R[Validate all fields]
    R --> S{Valid?}
    S -->|No| T[Show validation errors]
    T --> D
    
    S -->|Yes| U[Submit to API]
    U --> V{Save successful?}
    V -->|Yes| W[Show success message]
    W --> X[Apply changes immediately]
    
    V -->|No| Y[Show error message]
    Y --> Z{Retry?}
    Z -->|Yes| U
    Z -->|No| D
```

---

## 11. Academic Cycle Management Flow

```mermaid
flowchart TD
    A[Admin opens academic cycles] --> B[Load cycle list]
    B --> C{Action?}
    
    C -->|Create| D[Open create modal]
    D --> E[Enter cycle name]
    E --> F[Set start date]
    F --> G[Set end date]
    G --> H{Set as active?}
    H -->|Yes| I[Deactivate current active cycle]
    H -->|No| J[Submit creation]
    I --> J
    J --> K{Valid dates?}
    K -->|No| L[Show error]
    L --> F
    K -->|Yes| M[Create cycle]
    M --> N[Refresh cycle list]
    
    C -->|Activate| O[Select cycle to activate]
    O --> P[Confirm activation]
    P --> Q[Deactivate all other cycles]
    Q --> R[Activate selected cycle]
    R --> S[Update UI indicators]
    S --> B
    
    C -->|Update| T[Select cycle to edit]
    T --> U[Open edit modal]
    U --> V[Modify details]
    V --> W[Save changes]
    W --> X[Update cycle]
    X --> B
    
    C -->|Delete| Y[Select cycle to delete]
    Y --> Z{Has data?}
    Z -->|Yes| AA[Show error - cannot delete]
    Z -->|No| AB[Confirm deletion]
    AB --> AC[Delete cycle]
    AC --> N
    
    C -->|View| AD[View cycle details]
    AD --> AE[Show linked cohorts, sections, enrollments]
    AE --> B
```

---

## 12. Cohort Management Flow

```mermaid
flowchart TD
    A[Admin opens cohorts] --> B[Load cohort list]
    B --> C[Filter by academic cycle]
    C --> D{Action?}
    
    D -->|Create| E[Open create modal]
    E --> F[Select academic cycle]
    F --> G[Enter cohort name]
    G --> H[Select students to add]
    H --> I[Select sections to assign]
    I --> J[Submit creation]
    J --> K[Create cohort]
    K --> L[Create cohort membership records]
    L --> M[Auto-enroll students in sections]
    M --> N[Refresh cohort list]
    
    D -->|Add Students| O[Select cohort]
    O --> P[Select students to add]
    P --> Q[Submit addition]
    Q --> R[Create cohort membership records]
    R --> S[Auto-enroll in cohort sections]
    S --> T[Update cohort details]
    
    D -->|Remove Student| U[Select cohort]
    U --> V[Select student to remove]
    V --> W[Confirm removal]
    W --> X[Close cohort membership history]
    X --> Y[Remove from cohort]
    Y --> Z[Update cohort details]
    
    D -->|Assign Section| AA[Select cohort]
    AA --> AB[Select section to assign]
    AB --> AC[Submit assignment]
    AC --> AD[Link section to cohort]
    AD --> AE[Auto-enroll cohort students in section]
    AE --> T
    
    D -->|Exclude Student| AF[Select section]
    AF --> AG[Select student to exclude]
    AG --> AH[Mark enrollment as excluded]
    AH --> AI[Update enrollment record]
    
    D -->|Include Student| AJ[Select section]
    AJ --> AK[Select student to include]
    AK --> AL[Remove exclusion flag]
    AL --> AM[Update enrollment record]
    
    D -->|Delete| AN[Select cohort to delete]
    AN --> AO[Confirm deletion]
    AO --> AP[Delete cohort]
    AP --> AQ[Close all membership histories]
    AQ --> N
```

---

## 13. Student Promotion Flow

```mermaid
flowchart TD
    A[Admin opens promotions] --> B[Select source cycle]
    B --> C[Select target cycle]
    C --> D[Select target cohort]
    D --> E[Select students to promote]
    E --> F[Review promotion summary]
    F --> G{Confirm?}
    G -->|No| B
    G -->|Yes| H[Start promotion process]
    
    H --> I[Validate cycles exist]
    I --> J[Validate cohort exists]
    J --> K[Validate students exist]
    K --> L{All valid?}
    L -->|No| M[Show validation errors]
    M --> B
    L -->|Yes| N[Begin student processing]
    
    N --> O[For each student]
    O --> P[Close old cohort membership history]
    P --> Q[Update student cohort ID]
    Q --> R[Create new cohort membership history]
    R --> S[Get target cohort sections]
    S --> T[Check exclusion status]
    T --> U{Excluded?}
    U -->|Yes| V[Skip auto-enrollment]
    U -->|No| W[Auto-enroll in sections]
    W --> X[Create enrollment records]
    X --> Y[Create enrollment history]
    V --> Z[Next student]
    Y --> Z
    Z --> AA{More students?}
    AA -->|Yes| O
    AA -->|No| AB[Show success message]
    AB --> AC[Refresh student list]
```

---

## 14. Transcript Generation Flow

```mermaid
flowchart TD
    A[User opens transcripts] --> B{User role?}
    
    B -->|Student| C[Load own student ID]
    B -->|Teacher| D[Select student from dropdown]
    B -->|Admin/Manager| D
    
    C --> E[Select academic cycle filter]
    D --> E
    E --> F{Cycle selected?}
    F -->|Yes| G[Fetch data for specific cycle]
    F -->|No| H[Fetch data for all cycles]
    
    G --> I[Fetch enrollment history]
    H --> I
    I --> J[Fetch cohort membership history]
    J --> K[Fetch grades with assessments]
    K --> L[Fetch attendance records]
    L --> M[Fetch course and section details]
    M --> N[Compile transcript data]
    
    N --> O[Format transcript]
    O --> P[Display student info]
    P --> Q[Display enrollment history]
    Q --> R[Display cohort history]
    R --> S[Display grades by section]
    S --> T[Display attendance summary]
    T --> U[Generate GPA/aggregate metrics]
    U --> V[Render transcript view]
    
    V --> W{User action?}
    W -->|Print/Export| X[Generate printable version]
    W -->|Change cycle filter| E
    W -->|Select different student| D
```

---

## Environment Variables

### Required Environment Variables
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT token signing |
| `CLOUDINARY_URL` | Cloudinary API URL for file storage |
| `FRONTEND_URL` | Frontend application URL (for email links) |
| `SUPER_ADMIN_USERNAME` | Super admin username for initial setup |
| `SUPER_ADMIN_PASSWORD` | Super admin password for initial setup |
| `PORT` | Backend server port |
| `BCRYPT_ROUNDS` | Number of bcrypt rounds for password hashing |

### Recommended Environment Variables
| Variable | Description |
|----------|-------------|
| `THROTTLE_TTL` | Rate limiting time-to-live in milliseconds |
| `THROTTLE_LIMIT` | Maximum requests per TTL window |
| `RESEND_API_KEY` | Resend API key for email sending |
| `RESEND_FROM_EMAIL` | Sender email address for system emails |
| `AUTH_COOKIE_DOMAIN` | Domain for authentication cookies |
| `AUTH_COOKIE_SECURE` | Whether auth cookies should be secure (HTTPS only) |
| `AUTH_COOKIE_SAME_SITE` | Same-site cookie policy (lax, strict, none) |

## Main Activities Summary

| Activity | Description | Key Files |
|----------|-------------|-----------|
| **Authentication** | Login, register, role-based routing | `login/page.tsx`, `register/page.tsx` |
| **Password Strength** | Real-time password validation | `PasswordStrength.tsx`, `ChangePasswordForm.tsx` |
| **Password Reset** | Secure password recovery via email | `forgot-password/page.tsx`, `reset-password/page.tsx` |
| **Contact Email Verification** | Organization email verification for security | `auth.service.ts`, `org.service.ts` |
| **Audit Logging** | Security event tracking | `auth.service.ts`, AuditLog model |
| **Chat Messaging** | Real-time messaging with attachments | `ChatLayout.tsx`, `ChatMessage.tsx` |
| **Mail System** | Inbox, compose, read mail | `mail/page.tsx`, `NewMailModal.tsx` |
| **Theme Settings** | Light/dark mode, color customization | `ThemeContext.tsx`, `settings/page.tsx` |
| **Dashboard Navigation** | Sidebar, layout, responsive behavior | `DashboardLayout.tsx`, `Navbar.tsx` |
| **Admin Management** | User CRUD, role management | Admin page components |
| **File Upload** | Attachment handling in chat/mail | Upload components |
| **Real-time Presence** | Online status, typing indicators | `EventsGateway`, presence subscriptions |
| **Notifications** | Toast messages, badges | Notification components |
| **Settings Management** | User/org settings updates | `settings/page.tsx` |
| **Academic Cycles** | Manage academic periods, set active cycle | `academic-cycles/page.tsx`, `academic-cycles.service.ts` |
| **Cohort Management** | Student grouping, bulk enrollment | `cohorts/page.tsx`, `cohorts/[id]/page.tsx` |
| **Student Promotions** | Move students between cycles/cohorts | `promotions/page.tsx`, `promotions.service.ts` |
| **Transcripts** | Generate student academic records | `transcripts/page.tsx`, `transcripts.service.ts` |

## Live Deployment

The School Management System is deployed and available at: **https://eduversepak.cloud**

This production instance includes all features documented in this technical design document, including:
- Multi-tenant organization management
- Complete academic lifecycle tracking
- Real-time communication systems
- Financial management
- Security features including password reset and email verification
- Audit logging for compliance and security monitoring

---

**Document End**



