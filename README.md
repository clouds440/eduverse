# EduVerse - Technical Design Document

**Version:** 3.2.0
**Document Revision Date:** August 19, 2026
**Repository:** `clouds440/eduverse`  
**Document Type:** Technical Design Document (TDD)

> **License: PolyForm Noncommercial 1.0.0**
> Commercial use, resale, or commercial deployment is not permitted without a separate license from the copyright holder.

---

## Table of Contents

1. Overview
2. Goals and Non-Goals
3. Architecture
4. Repository Structure
5. Data Model
6. Backend Modules and API Design
7. Frontend Architecture
8. Core Product Flows
9. Security and Permissions
10. GPA, Transcripts, and Academic Policy
11. Finance
12. Real-Time Communication and Notifications
13. Files, PWA, and Browser Runtime
14. Environment Variables
15. Local Development
16. Testing and Verification
17. Rollout and Migration Notes
18. License and Copyright Notice

---

## 1. Overview

EduVerse is a multi-tenant school and institute management platform. It supports platform administration, organization workspaces, department-owned programs and curricula, institute-wide academic cycles, durable student majors, standalone and program-mapped delivery, immutable historical records, students, teachers, courses, sections, schedules, attendance, assessments, grading evidence, GPA policies, transcripts, finance records, communication, notifications, and file-backed workflows.

The application is web-first and responsive. It uses a NestJS backend, PostgreSQL with Prisma ORM, and a Next.js frontend.

### Primary Users

| Role            | Scope                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Super Admin     | Highest platform authority for the deployment.                                    |
| Platform Admin  | Platform-level organization and admin management.                                 |
| Org Admin       | Full administrative control inside one organization.                              |
| Sub Admin       | Delegated organization operations without main-admin ownership.                   |
| Org Manager     | Academic oversight for assigned sections and students.                            |
| Finance Manager | Finance structures, entries, payment claims, and transaction review.              |
| Teacher         | Assigned teaching, attendance, material, assessment, and grading workflows.       |
| Student         | Enrolled learning, submissions, timetable, grades, finance, and transcript views. |
| Guardian        | Read-only linked-student overview, attendance, grades, timetable, and fees.       |

### Product Scope

- Multi-organization administration with data isolation.
- Role-based access control.
- Student and teacher management.
- Sub Admin, Finance Manager, and Guardian account flows.
- Department-owned programs, versioned curricula, ordered stages, and course requirements.
- Independent institute-wide academic cycles reusable across programs and standalone delivery.
- Durable student majors, program transfers, cycle progression, and historical enrollment snapshots.
- Courses, sections, enrollments, cohorts, academic cycles, and reassignment.
- Verified cycle archives and scoped, read-only past records.
- Optional answerbook references and protected PDF/image evidence on individual grades.
- Multi-teacher section support.
- Teacher-owned schedules and timetables.
- Materials and assessments with creator attribution.
- Submissions, grading, grade validation, and notifications.
- Organization-level GPA policies and course credit hours.
- Transcript GPA/CGPA calculation using centralized backend logic.
- Finance structures, entries, claims, verification, and transaction history.
- Chat, mail, announcements, notifications, and real-time updates.
- File uploads backed by Cloudinary.
- Password strength, password reset, sessions, and audit logging.
- Optional email-code and trusted-device two-factor authentication.
- Linked Google sign-in, verified contact emails, and preference-aware login alerts.
- Provider-neutral public online admissions with offering-first discovery, rich fee/funding/eligibility disclosure, versioned application forms, required-document uploads, email updates, review queues, rejection retention, provider acceptance, and Campus student conversion where applicable.
- Self-hosted Cap proof-of-work verification for organization registration, suspicious sign-in, and public admission submission.

---

## 2. Goals and Non-Goals

### Goals

- Keep each organization's data isolated.
- Preserve academic history even when policies or assignments change later.
- Keep programs and institute academic cycles independent while supporting explicit many-to-many delivery plans.
- Preserve each student's admitted program configuration through every required cycle and later program edits.
- Make archived academic records immutable, verifiable, searchable, and role-scoped.
- Centralize business rules for grading, GPA, transcripts, schedules, and finance.
- Keep teacher and student portals scoped to the signed-in user's role and assignments.
- Provide clear validation instead of silent data correction.
- Make operational pages fast, scannable, and mobile-safe.
- Keep docs and technical design aligned with the implementation.

### Non-Goals

- Native mobile applications.
- Built-in video conferencing.
- Payment gateway processing.
- Offline-first academic workflows.
- Arbitrary custom GPA formulas or executable grading code.
- Multi-language product UI.

---

## 3. Architecture

### Stack

| Layer                 | Technology                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| Frontend              | Next.js 16, React 19, TypeScript, Tailwind CSS 4                        |
| Backend               | NestJS 11, Node.js, TypeScript                                          |
| Database              | PostgreSQL 18, Prisma ORM 7                                             |
| Authentication        | JWT, Passport.js, Role Guards                                           |
| End-to-End Encryption | libsodium, XChaCha20-Poly1305, X25519 (Curve25519), Ed25519             |
| Trusted Devices       | Device approval, per-device key management, history-key synchronization |
| Real-time             | Socket.IO                                                               |
| AI                    | LangChain, RAG (Retrieval-Augmented Generation)                         |
| Validation            | `class-validator`, DTOs, Zod (selected frontend forms)                  |
| File Storage          | Cloudinary                                                              |
| Email                 | Resend API                                                              |
| Password Strength     | `zxcvbn`                                                                |
| PDF                   | `pdf-lib`                                                               |
| Security              | HTTP-only JWT Cookies, bcrypt, CORS, CSP, Rate Limiting                 |
| DevOps                | Docker                                                                  |

### Runtime Shape

```text
Browser / Next.js App Router
  -> frontend API client
  -> NestJS controllers
  -> guards, DTO validation, services
  -> Prisma
  -> PostgreSQL

Socket.IO
  -> EventsGateway
  -> chat, notifications, presence, dashboard refresh events
```

### Backend Design Principles

- Controllers stay thin.
- Services own business rules and persistence.
- DTOs validate input before service execution.
- Organization-scoped endpoints use active organization context.
- Cross-module calculations, such as GPA, are centralized in reusable services.
- Historical academic calculations use snapshots where later changes would otherwise rewrite history.

### Frontend Design Principles

- App Router routes are organized by public, admin, and organization workspaces.
- Shared UI primitives live under `frontend/components/ui`.
- Feature components live near the feature domain where possible.
- Data fetching uses the central API client and SWR patterns where appropriate.
- Forms prefer typed schemas and explicit error states.
- Operational dashboard UI should avoid oversized marketing-style surfaces.

---

## 4. Repository Structure

```text
backend/
  prisma/
    schema.prisma
    migrations/
  src/
    academic-cycles/
    admin/
    ai/
    announcements/
    attendance/
    auth/
    captcha/
    chat/
    cohorts/
    common/
    copy-forward/
    course-materials/
    courses/
    events/
    files/
    finance/
    finance-managers/
    gpa/
    insights/
    mail/
    notifications/
    online-admissions/
    org/
    prisma/
    promotions/
    program-offerings/
    programs/
    sections/
    students/
    guardians/
    role-accounts/
    sub-admins/
    teacher/
    transcripts/

frontend/
  app/
    (org)/
    admin/
    docs/
    login/
    register/
  components/
    forms/
    sections/
    ui/
  context/
  hooks/
  lib/
  types/
```

---

## 5. Data Model

This section lists the important product models and recent fields. Refer to `backend/prisma/schema.prisma` for the complete schema.

### Organization and Users

- Organizations isolate academic, finance, user, and communication data.
- Users can hold platform or organization roles.
- Organization roles include `ORG_ADMIN`, `SUB_ADMIN`, `ORG_MANAGER`, `FINANCE_MANAGER`, `TEACHER`, `STUDENT`, and `GUARDIAN`.
- Teacher and student profile records connect account identity to academic workflows.
- Sub Admin and Finance Manager accounts are role accounts managed through shared account-management services.
- Guardian profiles link guardian users to student records. Guardian reads are checked against those student links.
- Audit logs record security-sensitive and administrative activity.

### Communication Blocks

`UserCommunicationBlock` stores user-controlled communication blocks outside chat records so the behavior can grow beyond a single conversation later.

Important fields:

- `userId`: the user who created the block.
- `targetUserId`: the user whose direct messages are blocked by `userId`.
- `chatId`: optional direct-chat reference used as a fast lookup path when a DM already exists.
- `organizationId`: the organization context for organization users.
- `channel`: currently `DIRECT_MESSAGE`.
- `createdAt`: when the block was created.

Rules:

- The unique key is `userId`, `targetUserId`, and `channel`, so one user cannot create duplicate active blocks for the same target/channel.
- Blocking uses an upsert; repeated block attempts may fill in `chatId` when available but preserve the original `createdAt`.
- When a direct chat already exists, blocking stores `chatId`. If a block was created before a DM exists, `chatId` can remain null.
- Runtime checks include `chatId` when available and fall back to the directed `userId`/`targetUserId` pair.
- Unblocking deletes the active row. A later block creates a new row with a new `createdAt`.
- Direct chats read both directions to know whether the current user blocked the other participant or the other participant blocked the current user.
- `chatId` is not the source of truth. The directed user pair and channel remain canonical so users can block DMs before a chat exists.

### End-to-End Encryption Data Model

Chat and Mail protected content uses trusted browser devices and per-recipient envelopes. The backend stores ciphertext and routing metadata, but private keys stay in the browser.

Important models:

- `EncryptionIdentity`: one encryption identity per user.
- `TrustedEncryptionDevice`: browser/device public keys, trust state, key version, revocation, and approval metadata.
- `TrustedDeviceApproval`: pending-device approval requests that must be approved from an already trusted device.
- `EncryptedContent`: ciphertext for Chat messages, Mail messages, and Mail subjects.
- `E2EEKeyEnvelope`: per-recipient-device wrapped content keys.
- `ChatHistoryKey`: scoped chat history keys used to avoid rewrapping every message key for already trusted devices.
- `E2EEContentHistoryKeyEnvelope`: content-key wrappers against chat history keys.
- `E2EETrustedDeviceHistoryKeyEnvelope`: history-key wrappers for trusted devices.

Rules:

- New protected Chat/Mail content must include envelopes for every intended recipient and every currently trusted recipient device.
- Pending or revoked devices do not receive new envelopes.
- A new device is not trusted just because the user signed in; approval must come from an existing trusted device.
- Newly added chat/group participants do not receive old message history.
- Mail and Chat notifications use generic text and do not include protected message content.
- Mail search and AI backend tools do not search or read encrypted subject/body content.

### Account Security Data Model

- `User.contactEmail` and its verification timestamps store the multipurpose security address for non-org-admin users.
- Org admins use `Organization.contactEmail` and its verification timestamps as their security address.
- `UserSettings` stores independent email/device 2FA flags, the combined compatibility fields, login email/push alert preferences, theme, and marketing preference.
- `PendingLogin` stores a 15-minute login challenge, available and selected methods, email-code state, verification status, and originating device metadata.
- `Session` represents an authenticated login. `TrustedEncryptionDevice` separately represents a browser/device allowed to approve sign-ins and access protected Chat/Mail.
- Linked Google accounts support direct Google login and can supply a pre-verified contact email when the user explicitly chooses it.

### Courses

`Course` defines the subject identity used by sections and transcripts.

Important fields:

- `id`
- `organizationId`
- `name`
- `description`
- `creditHours Float @default(3)`
- timestamps and update metadata

Rules:

- `creditHours` defaults to `3`.
- `creditHours` must be greater than `0`.
- Credit hours are used by GPA calculations when the policy method is weighted by credit hours.
- Courses used by a program stage must belong to the program's department.

### Sections and Section Teachers

Sections connect courses, academic cycles, students, teachers, schedules, materials, assessments, attendance, grades, and optional program-delivery requirements.

Rules:

- A section can have multiple assigned teachers.
- Every section declares `programClassificationStatus` as `STANDALONE` or `PROGRAM_MAPPED`.
- A program-mapped section uses `SectionProgramMapping` to identify the stage offering and course requirement it delivers.
- A standalone section remains valid without any program relationship.
- Section create/edit is the source of teacher assignment. Teacher profile forms do not assign sections.
- Section colors use predefined safe colors so labels remain readable.
- Teacher selection for schedules is limited to teachers assigned to the selected section.
- Removing a teacher from a section requires resolving any schedules owned by that teacher by moving those schedules to another assigned teacher or deleting them.

### Section Result Relationships

Theory/Lab and similar paired delivery is modeled as a course-level section relationship over normal sections. The same model can represent Theory/Lab, Lecture/Practical, Lecture/Tutorial, Studio/Critique, Clinic/Classroom, or other weighted relationships between sections.

Important models:

- `CourseResultScheme`: one optional aggregation setup for a course in an academic cycle.
- `CourseResultComponent`: a weighted component such as `THEORY`, `LAB`, `PRACTICAL`, `TUTORIAL`, or `OTHER`.
- `CourseResultComponentSection`: links a component to one or more independent sections.

Rules:

- Related sections remain ordinary `Section` records.
- A related section is not a child section, nested assessment, or simplified grading record.
- Each linked section keeps its own teachers, enrollments, attendance, assessments, gradebook, schedules, materials, and academic operations.
- `Section.componentType` labels the section's role in relationships and reports.
- Component weights must total `100`.
- Every component section must belong to the same organization, course, and academic cycle as the scheme.
- A section can appear in only one component within the same scheme.
- A linked section cannot be moved to another course or academic cycle while the scheme exists.
- A scheme cannot be changed or deleted after linked finalized grades exist.
- Saving a relationship can synchronize enrollments so students present in any related section are enrolled in the missing related sections.
- Adding one related section to a cohort offering expands to the other related sections before cohort student enrollment is applied.
- Cohort offering creation and cohort section assignment both preview relationship expansion before confirmation.
- Program detail pages can start cohort creation for a specific program stage offering. This preselects the program stage and academic cycle, then the cohort offering bulk-adds selected sections.

Calculation:

1. Each section result is calculated using the existing assessment and gradebook rules.
2. Transcript aggregation finds the student's own enrolled/history-linked component sections.
3. Component section percentages are combined using the configured weights.
4. The final course percentage is passed to the existing GPA policy calculation.
5. Transcript web and PDF output show the final course result and the component breakdown.

UI flow:

1. Open a section and choose `Relationships`, or open Courses and choose `Section Relationships`.
2. Pick the course and academic cycle when they are not already preselected.
3. Add component rows such as Theory, Lab, Practical, Tutorial, Studio, Clinic, or Other.
4. Select the sections for each component and keep the weights at exactly `100`.
5. Preview the change. The confirmation window shows affected sections, affected students, and missing enrollments that will be created.
6. Confirm only when the summary is correct.

Example:

```text
Theory: 82 x 75% = 61.5
Lab:    90 x 25% = 22.5
Final:             84
```

### Schedules

Schedules are stored as section schedules.

Important rule:

- A schedule belongs to exactly one teacher through `teacherId`.

Behavior:

- Student timetables remain section-based.
- Teacher timetables are teacher-based and use `schedule.teacherId`.
- The timetable displays the teacher from `schedule.teacherId`.
- Room, student, section, and teacher conflict detection reports the exact conflicting person or room, the occupied section, and the occupied time.
- Timetable views show a full week when no date is selected and a single day only when a specific date is selected.

### Materials

Course materials belong to sections.

Important field:

- `createdById`

Behavior:

- New materials automatically store the authenticated creator.
- API responses include basic creator info where useful.
- Teacher and student UIs show subtle attribution such as `Added by John Smith`.
- Older records without creator info must not break rendering.

### Assessments

Assessments belong to sections and support submissions and grading.

Important field:

- `createdById`

Behavior:

- New assessments automatically store the authenticated creator.
- API responses include basic creator info where useful.
- UIs show attribution such as `Created by John Smith`.
- Teacher workflow notifications use the assessment creator.

### Grade Answerbook Evidence

Answerbook evidence belongs to one student's `Grade`, never to the whole assessment.

Important fields and models:

- `Grade.answerbookReferenceNumber`: optional external or physical answerbook identifier, limited to 100 characters.
- `GradeAnswerbookAttachment`: typed join between one `Grade` and one managed `File`.
- `uploadedById`: records the staff user who attached the evidence.

Rules:

- A grade can have at most five answerbook attachments.
- Accepted formats are PDF, JPG, JPEG, PNG, and WEBP.
- Evidence can be changed only while the grade is not finalized and the academic cycle is writable.
- Students can read evidence only after the grade is published or finalized; guardians follow linked-student scope.
- Teachers follow assigned-section scope. Sub Admins and Managers follow department scope. Org Admins are organization-wide.
- Archive creation locks referenced files. Archived evidence is immutable and remains downloadable only through authorized archive routes.

### GPA Policies

`GpaPolicy` belongs to an organization.

Important fields:

- `organizationId`
- `name`
- `scale Float @default(4.0)`
- `method`
- `rounding`
- `gradeRules Json`
- `isDefault`
- archival/reference metadata where applicable
- timestamps

Enums:

- `GpaCalculationMethod`: `SIMPLE_AVERAGE`, `WEIGHTED_BY_CREDIT_HOURS`
- `GpaRounding`: `NONE`, `ONE_DECIMAL`, `TWO_DECIMALS`

Rules:

- One default policy per organization.
- Policies can be multiple; one is active/default.
- Grade rules must cover `0..100` with no overlaps or gaps.
- Grade points cannot decrease as marks increase.
- Points must stay within `0..scale`.
- Maximum rule count is `20`.
- No raw formulas, `eval`, or custom code execution.

### Academic Cycles, Lifecycle, and GPA Snapshots

`AcademicCycle` is an institute-wide period such as Fall 2026. It does not belong to a program. The same cycle may be related to many programs, may deliver standalone courses, or may exist without any program relationship.

Lifecycle:

```text
DRAFT -> ACTIVE -> COMPLETED -> ARCHIVING -> ARCHIVED
```

Rules:

- Cycle identity is unique by organization and code.
- More than one cycle may be active when institute calendars overlap.
- Programs and cycles are independent. `ProgramOffering` relates a program and curriculum to a shared institute cycle only when that delivery is needed.
- Completing or archiving a cycle never changes a program's status and never silently advances a student program enrollment.
- Operational writes are blocked as the cycle moves out of its writable lifecycle.
- A cycle can store a selected GPA policy and immutable policy snapshot.
- Once finalized grades exist, the selected cycle policy cannot change.
- A completed cycle can be archived only when no student stage enrollment in that cycle remains in progress.

### Programs and Curricula

`Program` is a provider-owned educational product. In Campus it can be a department-owned qualification or major; for Discover-style providers it can also represent a course, diploma, certificate, workshop, or training product without requiring a Campus organization account.

Core program fields:

- education provider and optional Campus organization/owning department
- unique organization code and display metadata
- lifecycle: `DRAFT`, `ACTIVE`, `PAUSED`, `TEACH_OUT`, `ARCHIVED`
- structure, progression, and completion modes
- ordered stable curriculum stages
- admissions visibility, label, description, duration, search metadata, and sort order
- monotonic `configurationVersion`

Program structure:

```text
Department
  -> Program
     -> ProgramConfigurationRevision[]
     -> CurriculumVersion[]
        -> ProgramStage[]
           -> StageCourseRequirement[] -> Course

AcademicCycle
  -> ProgramOffering -> Program + CurriculumVersion
     -> ProgramStageOffering[] -> stable ProgramStage
```

Rules:

- One department can own many programs.
- One shared academic cycle can host many program offerings, and one program can offer several stages in the same cycle.
- Program creation configures stable stages and requirements without creating or selecting cycles.
- Program metadata, its initial immutable configuration revision, draft curriculum, stages, and course requirements are created transactionally.
- Replacing program structure requires the caller's current `configurationVersion` and a change reason.
- Structural edits append a `ProgramConfigurationRevision`, increment the version, and scaffold a new draft curriculum for future students.
- Existing student majors never change when program metadata or future curriculum structure changes later.
- Programs with student history cannot move to another department.
- `TEACH_OUT` blocks new admissions but allows existing students to finish. Archiving never archives shared cycles.

### Program Delivery Mapping

Programs do not own cohorts or sections. Delivery records explicitly state whether they are standalone or mapped.

- `Cohort` is a durable group; `CohortOffering` places it in a cycle and optionally in a `ProgramStageOffering`.
- `CohortOfferingSection` allows sections to serve several cohort offerings without giving a section a single cohort owner.
- A mapped section uses one or more `SectionProgramMapping` rows for exact stage-offering and requirement pairs.
- Program, curriculum, stage, course, organization, and academic-cycle compatibility are validated server-side. Cross-department courses remain possible.
- Cohort offerings and sections with no program mapping remain first-class standalone delivery.

### Student Program Enrollment

`StudentProgramEnrollment` is the durable major assignment. It survives academic-cycle changes until the student completes, withdraws, or transfers out of the program.

Key invariants:

- A student can have at most one open major enrollment.
- Assigning a major derives `Student.primaryDepartmentId` from the program department.
- Admission stores the exact program, curriculum, configuration revision, required-stage count, and optional stable entry stage. It creates no future cycle rows.
- `StudentStageEnrollment` records each actual stage attempt in a real `ProgramStageOffering`; repeats create new rows in the chosen cycle.
- `StudentProgressionDecision` records advance, repeat, pause, transfer, withdrawal, and completion decisions with evidence and reasons.
- Program edits never mutate a student's pinned curriculum or historical attempts.
- Transfer closes the old enrollment as `TRANSFERRED_OUT` and creates a new historical chain; it does not overwrite the old major.
- Hold, resume, withdrawal, stage activation, completion, skip, repeat, transfer, and final program completion are explicit commands with actor/reason metadata.
- Section and enrollment history can reference the major, stage enrollment, and cohort membership that produced the placement.

### Online Admissions

`OnlineAdmissionSubmission` keeps public applications separate from admitted student accounts. Provider-only applications can be accepted without a Campus student record; Campus-backed applications can later be converted into students by an authorized administrator.

Key records and rules:

- Education providers own programs, offerings, locations, forms, submissions, and documents. A Campus organization is optional provider metadata.
- Organization settings explicitly enable or disable public admissions and store applicant email templates for Campus-backed offerings.
- Admissions Setup configures offering summary, delivery, dates, locations, fees, funding, eligibility, form selection, and publish/open/close readiness.
- `AdmissionApplicationTemplateVersion` and `AdmissionDocumentRequirement` define versioned applicant fields and required or optional uploads.
- A submission snapshots applicant answers, form definition, document requirements, consent version, provider, optional Campus department/offering/cycle context, status history, and uploaded-document labels.
- Applicants do not need an account. Expiring email links allow requested document updates without exposing internal records.
- Review is provider-scoped; Campus-backed review additionally applies organization and department scope. Rejected and withdrawn records remain auditable instead of being deleted.
- Student conversion preloads the normal admission form only for Campus-backed applications, permits an administrator to correct data and choose the final login email, and links the admitted student atomically.
- Public submission, organization registration, and suspicious login use separate, single-use Cap CAPTCHA token scopes.

### Academic Cycle Archives and Past Records

Archive data is a verified read model, not a live query with an old-cycle filter.

Important models:

- `AcademicCycleArchive`: revision, schema version, status, manifest, counts, checksum, cutoff, and creator.
- `AcademicCycleArchiveSection`: immutable JSON payload and section checksum.
- `AcademicCycleArchiveSectionProgramIndex`: program, curriculum, stage, and requirement search dimensions.
- `AcademicCycleArchiveStudentIndex`: snapshotted student identity and normalized search dimensions.

Archive rules:

- Archive status is `BUILDING`, `READY`, or `FAILED`; failed revisions can be retried idempotently.
- Finalization verifies every section checksum, the aggregate archive checksum, record counts, and the locked file set.
- The cycle becomes `ARCHIVED` only after a ready archive is committed and assigned as `currentArchive`.
- Snapshot payloads include section identity, students, enrollments/history, assessments, grades, submissions, schedules, attendance, materials, program mappings, and referenced files.
- Files referenced by a ready archive are locked against mutation/deletion.
- Past Records reads only `READY` snapshots attached to `ARCHIVED` cycles.
- Archived payloads are sanitized before return; storage identifiers are hidden and student/guardian payloads are reduced to authorized students.

---

## 6. Backend Modules and API Design

### Auth

Main responsibilities:

- Password and Google login, pending-login challenges, and JWT issuance.
- Password strength and password reset support.
- Session/device tracking.
- Multipurpose contact email verification for recovery, security communication, and email 2FA.
- Optional email-code and trusted-device 2FA methods that can be enabled independently.
- Linked Google account management and use of its verified email as the contact email.
- Login email and push alerts governed by the centralized user settings context.
- Guards and decorators for role and organization context.
- Purpose-isolated Cap challenge and token verification for bot-sensitive public operations.

The backend resolves the complete user settings context through `UserSettingsContextService`. Feature services consume that context instead of independently querying individual preference booleans. The frontend mirrors this with `UserSettingsProvider`, which loads one canonical settings object and exposes shared refresh/update operations.

Selected routes:

- `POST /auth/two-factor/challenge`, `/select`, `/email/verify`, `/email/resend`, `/device/approve`, `/complete`, `/cancel`
- `GET|PATCH /auth/contact-email` plus resend, verify, and linked-Google adoption routes
- `POST /auth/contact-email/change-confirmation/request|confirm`
- `GET /auth/users/:userId/two-factor` and `POST /auth/users/:userId/two-factor/reset`
- `GET|PATCH /auth/settings`
- `GET /auth/google/login`, `/google/link`, and `/google/callback`
- `GET /auth/sessions` plus session revocation routes
- `PATCH /admin/organizations/:id/contact-email/recovery`
- `POST /public/captcha/:purpose/challenge|redeem`

### Org Module

Main responsibilities:

- Organization-scoped course, section, schedule, and user operations.
- Active organization enforcement.
- Organization settings and branding flows.
- Shared user avatar upload through `PATCH /org/users/:id/avatar`.

Selected routes:

- `GET /org/courses`
- `POST /org/courses`
- `PATCH /org/courses/:id`
- `DELETE /org/courses/:id`
- `POST /org/sections/:id/schedules`
- `PATCH /org/sections/:id/schedules/:scheduleId`
- `DELETE /org/sections/:id/schedules/:scheduleId`

### Role Account Modules

Main responsibilities:

- `sub-admins`, `finance-managers`, and `role-accounts` implement shared account-list/create/update/delete behavior for non-teaching operational roles.
- Role account responses include `avatarUrl` and `avatarUpdatedAt` so the frontend `Brand` component can render profile pictures consistently.
- Sub Admin accounts are main-admin managed.
- Finance Manager accounts are managed from the organization user area and are limited to finance workflows.

### Guardians

Routes under `/org/guardians`.

Main responsibilities:

- Create and update guardian login accounts.
- Store guardian contact details and relationship label.
- Link guardians to students through `Student.guardianId`.
- Return linked students for guardian edit and guardian portal flows.
- Enforce guardian portal reads against linked students only.

### GPA Module

Routes under `/org/gpa-policies`:

- `GET /`
- `POST /`
- `PATCH /:id`
- `DELETE /:id`
- `PATCH /:id/default`
- `POST /preview`

Permissions:

- GPA policy management is restricted to `ORG_ADMIN`.

Core services:

- `GpaPoliciesService` manages CRUD, default selection, preview, and archival/delete behavior.
- `GpaService` validates rules, resolves grade metadata, calculates GPA, applies rounding, and snapshots policies.

### Academic Cycles

Main responsibilities:

- Create, update, list, and transition shared institute cycles.
- Store and update selected GPA policy.
- Lock GPA policy changes after finalized grades exist.
- Enforce legal `DRAFT -> ACTIVE -> COMPLETED -> ARCHIVING -> ARCHIVED` transitions and cycle write policy.
- Keep activation organization-wide and independent from program status.
- Support copy-forward and reassignment through related modules.

Selected routes:

- `POST|GET /org/academic-cycles`
- `GET|PATCH|DELETE /org/academic-cycles/:id`
- `PATCH /org/academic-cycles/:id/status`

### Programs and Curricula

`ProgramsModule` owns program metadata, shared-cycle relationships, immutable configuration revisions, curriculum versions, stages, and course requirements.

Selected routes:

- `POST|GET /org/programs`
- `GET|PATCH|DELETE /org/programs/:id`
- `PUT /org/programs/:id/cycles`
- `PATCH /org/programs/:id/status`
- `GET /org/programs/:id/configuration-revisions`
- `GET /org/programs/eligible-cycles`
- `GET /org/programs/delivery-options`
- `POST /org/programs/:id/curricula`
- `PATCH /org/programs/curricula/:id`
- `PATCH /org/programs/curricula/:id/status`
- stage and requirement CRUD under `/org/programs/stages/*` and `/org/programs/requirements/*`

Write permissions:

- Org Admin can create and modify programs in every organization department.
- Sub Admin can write programs only in departments explicitly assigned through `SubAdminDepartment`; moving a program requires both source and target scope.
- Program reads are filtered through the actor's effective department scope.
- Every nested write resolves the owning program and repeats the same scope check; controllers do not rely on hidden navigation as authorization.

### Student Program Enrollment

`StudentProgramEnrollmentsModule` owns durable major assignment and progression. Generic student updates cannot overwrite program history.

Selected routes under `/org/students/:studentId/program-enrollments`:

- `GET /`
- `POST /admit`
- `POST /transfer`
- `POST /:enrollmentId/hold|resume|withdraw|complete`
- `POST /:enrollmentId/cycles/activate`
- `POST /:enrollmentId/cycles/:cycleId/complete|skip|repeat`

Admission and transfer commands snapshot the active curriculum and program configuration. Student creation and Manage Enrollment use these commands instead of manually patching a department or program ID.

### Program Offerings and Online Admissions

`ProgramOfferingsModule` manages provider-owned offerings, optional Campus cycle delivery, locations, lifecycle readiness, fees, funding, and eligibility disclosure. `AdmissionFormsModule` owns versioned application forms and document requirements. `OnlineAdmissionsModule` owns provider-neutral public discovery and submission, applicant update links, Campus department-scoped review, provider acceptance, status transitions, export, protected document downloads, and final Campus student linkage where applicable.

Selected routes:

- `GET /v1/public/admissions/offerings`
- `GET /v1/public/admissions/offerings/:id`
- `GET /v1/public/admissions/providers/:slug`
- `POST /v1/public/admissions/offerings/:id/submissions`
- `GET|POST /v1/public/admissions/submissions/update/:token[/documents]`
- Legacy compatibility routes remain under `/public/online-admissions/*` for the current Campus frontend, but new public surfaces should use `/v1/public/admissions/*`.
- `GET /org/admission-forms`
- `POST /org/admission-forms`
- `POST /org/admission-forms/:id/versions`
- `PUT|PATCH /org/admission-forms/versions/:id`
- `PUT /org/admission-forms/offerings/:offeringId`
- `GET /org/program-offerings/:id/readiness`
- `GET /org/online-admissions` and `/org/online-admissions/:id`
- `PATCH /org/online-admissions/:id/status|admit`
- `GET /org/online-admissions/export.csv`
- `POST /org/online-admissions/:id/document-requests`

Public responses use applicant-safe projections and never expose internal template configuration, storage identifiers, source IP fingerprints, reviewer-only state, or organization email templates. Canonical public application links use `/admissions/apply/:offeringId`; organization/provider pages are browsing aids rather than ownership assumptions.

### Academic Cycle Archives and Past Records

Archive routes:

- `GET /org/academic-cycles/:cycleId/archive`
- `POST /org/academic-cycles/:cycleId/archive`
- `POST /org/academic-cycles/:cycleId/archive?retry=true`
- `GET /org/academic-cycles/:cycleId/archive/verify`

Only Org Admin can create or retry an archive. Org Admin, Sub Admin, and Org Manager can inspect status and verification within their access level.

Past-record routes:

- `GET /org/past-records/options`
- `GET /org/past-records/cycles`
- `GET /org/past-records/students`
- `GET /org/past-records/students/:studentId`
- `GET /org/past-records/sections`
- `GET /org/past-records/sections/:archiveSectionId`
- archived answerbook download under the archived section/grade path

Filters include cycle, department, program, cohort, delivery classification, student, free-text search, and pagination. Org Admin is organization-wide; Sub Admin and Manager follow department scope; Teacher follows archived teacher assignment; Student follows self scope; Guardian follows linked students.

### Transcripts

Routes under `/org/transcripts`.

Main responsibilities:

- Build transcript data for one student and optional cycle.
- Include course name, section name, credit hours, marks/percentage, letter grade, grade points, and quality points.
- Calculate cycle GPA and cumulative CGPA through `GpaService`.
- Use the cycle policy snapshot when present.
- Preserve finalized-grade filtering.
- Use enrollment history so mid-cycle section transfers can preserve old-section academic records while allowing excluded historical sections to appear without contributing to GPA or merit.

### Attendance and Schedules

Main responsibilities:

- Create/update/delete section schedules.
- Validate schedule teacher assignment.
- Preserve room, time-slot, and teacher conflict checks.
- Record and retrieve attendance.
- Keep historical attendance attached to the section where it was originally recorded. A transfer must not delete old attendance.

### Course Materials

Main responsibilities:

- Create, update, view, and delete section materials.
- Attach creator metadata to new materials.
- Notify relevant students when materials are added or updated.

### Assessments and Grading

Main responsibilities:

- Create and manage section assessments.
- Track submissions.
- Grade individual or bulk submissions.
- Validate grade entry rules.
- Route teacher workflow notifications to assessment creators.
- Save an optional answerbook reference on each grade.
- Upload, list, download, and remove typed grade answerbook attachments while the grade and cycle are writable.
- Enforce file type, MIME, size, five-file cap, section enrollment, role scope, released-grade reads, archive locks, and cleanup after a failed database link.

Grade-evidence routes:

- `GET /org/grades/:gradeId/answerbook-attachments`
- `POST /org/grades/:gradeId/answerbook-attachments`
- `GET /org/grades/:gradeId/answerbook-attachments/:attachmentId/download`
- `DELETE /org/grades/:gradeId/answerbook-attachments/:attachmentId`

### Finance

Main responsibilities:

- Fee structures.
- Generated finance entries.
- Student payment claims.
- Admin verification and rejection.
- Transaction history.

Role behavior:

- Admin and Finance Manager can perform finance management actions.
- Sub Admin can view/audit finance where the product exposes it, but finance operations are owned by Admin and Finance Manager.
- Manager has no finance management authority.
- Students can view and claim their own payments.
- Guardians can view linked-student finance status through the guardian portal.

### Communication

Main responsibilities:

- Chat and presence through Socket.IO.
- Internal mail.
- Announcements.
- Notifications and badges.

Chat rules:

- Student can direct-message assigned teachers and cannot create groups.
- Guardian can direct-message Admin, Sub Admin, or Finance Manager where available and cannot create groups.
- Finance Manager can direct-message Admin/Sub Admin and cannot create academic groups.
- Teacher can direct-message assigned students and academic leadership, and can create section chats for assigned sections.
- Manager can message assigned academic scope and create academic groups for assigned sections.
- Admin/Sub Admin can perform organization-level chat management.
- Direct-message blocking is user-controlled and applies to one-to-one DMs only. Any user can block DMs from any other user they can otherwise contact, including Org Admins.
- DM blocks do not block the user globally and do not affect shared group chats.
- The backend enforces DM blocks before direct messages are created, so the frontend composer state is not the security boundary.
- When either side blocks a DM, both participants see a blocked-DM banner and the direct-message composer is hidden.
- Chat mention targets are centralized. Individual mentions, everyone mentions, role mentions, and related-scope mentions all resolve through shared mention utilities before notification dispatch.
- Mention notification recipients are deduped by user ID before notifications are created, so a user mentioned individually and through a role or related group receives one notification.
- Related-scope mentions are selected as audience first, then scope type, then scope: for example all students, all teachers, or everyone in a section, department, or cohort represented by active group participants.

Mail rules:

- Guardian mail is limited to administration, finance, or platform support.
- Finance Manager mail is limited to finance-related categories and selected recipients in Admin/Sub Admin/Student/Guardian roles.
- Org Admin/Sub Admin can view and manage organization mail.
- Manager bulk mail is restricted and should not behave like Admin mail.

Protected communication rules:

- Chat message bodies, Mail message bodies, Mail subjects, and Chat/Mail attachments are encrypted in the browser before upload.
- Decryption happens only in protected render/download components that actively need to display or save protected content.
- The API client, stores, notifications, sockets, unread counts, read state, timestamps, recipient resolution, and permissions do not decrypt content.
- A compact end-to-end encryption banner appears at the bottom of the Chat list and Mail inbox panel.
- Sending protected content requires every intended recipient to have at least one trusted encryption device.
- If a recipient has multiple trusted devices, new content must include envelopes for all of those devices.
- Backend validation rejects missing, stale, pending, revoked, mismatched, or non-recipient envelopes.

---

## 7. Frontend Architecture

### Route Groups

```text
frontend/app/
  (org)/              Organization dashboard routes
    programs/         Program list, creation, detail, curricula, and lifecycle
    past-records/     Archived cycle, student, and section search/read views
    users/            User orchestration and canonical user-management routes
  admin/              Platform admin routes
  docs/               Public user-facing documentation
  login/              Authentication
  register/           Organization registration
```

### Shared Systems

| Area                  | Key Files                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| API client            | `frontend/lib/api.ts`                                                      |
| Types                 | `frontend/types/index.ts`, `frontend/types/enums.ts`                       |
| UI primitives         | `frontend/components/ui/*`                                                 |
| Forms                 | `frontend/components/forms/*`                                              |
| Program feature UI    | `frontend/components/programs/*`                                           |
| Past-record UI        | `frontend/components/past-records/*`                                       |
| Grade evidence UI     | `frontend/components/grading/*`, `frontend/components/ui/AttachmentPreviewCard.tsx` |
| Section feature UI    | `frontend/components/sections/*`                                           |
| Transcript PDF        | `frontend/lib/pdf/transcript.ts`                                           |
| PWA prompt/runtime    | `frontend/components/ui/PWAInstallPrompt.tsx`                              |
| Docs content registry | `packages/docs/src/index.ts`                                               |
| Breadcrumb logic      | `frontend/lib/routeOrientation.ts`                                         |
| Organization sidebar  | `frontend/lib/orgSidebar.ts`, `frontend/components/ui/DashboardLayout.tsx` |

### Docs Architecture

The public docs are registry-driven.

Important files:

- `packages/docs/src/index.ts`
- `frontend/app/docs/_components/DocsIndex.tsx`
- `frontend/app/docs/_components/DocArticle.tsx`
- `frontend/app/docs/[slug]/page.tsx`
- `frontend/app/docs/layout.tsx`

Each doc page has:

- `slug`
- `title`
- `description`
- `category`
- `tags`
- sections with stable `id` values for hash links
- related docs

This prepares the docs for client-side search in a later phase without scraping rendered JSX.

Public docs style rule for the fine-tuning phase:

- User-facing docs should explain behavior in plain language.
- Avoid exposing internal field names, database details, DTOs, services, or implementation structure.
- Prefer "A schedule has one selected teacher" over "Schedules belong to a teacher through `teacherId`."
- Keep technical architecture details in this TDD, not in the public `/docs` experience.

### Organization User Routes

`/users` is the organization user orchestration point. Canonical management routes live under:

- `/users/sub-admins`
- `/users/finance-managers`
- `/users/teachers`
- `/users/students`
- `/users/guardians`

Legacy top-level routes such as `/teachers`, `/students`, `/sub-admins`, `/finance-managers`, and `/guardians` remain compatible where present, but in-app links should prefer `/users/*` for management workflows. Student and teacher self/profile routes can still use their portal paths when the signed-in role is Student, Teacher, or Manager.

---

## 8. Core Product Flows

### Password Sign-In and Two-Factor Verification

1. The user submits valid password credentials.
2. Google sign-in completes directly because Google already authenticated the account.
3. If password sign-in requires 2FA, the backend creates a pending login that expires after 15 minutes and returns a temporary token instead of an access token.
4. When both methods are enabled, the user chooses email or another signed-in device.
5. Email verification sends a six-digit code to the verified contact email. Codes expire after 10 minutes and resend is rate-limited.
6. Device verification sends a notification to the user's other trusted, signed-in devices. The user can approve from the notification or from Security > Devices & sessions.
7. Successful verification consumes the pending login, exchanges the temporary token for a full access token, creates the session, and trusts the successful browser.
8. Cancelling the prompt cancels the pending login and signs the user out.

### Contact Email and 2FA Setup

- Org admins use the verified organization contact email.
- Other users can add and verify a personal contact email from Security.
- A linked Google email can be adopted as the contact email before email 2FA is enabled.
- Email 2FA requires a verified contact email.
- Device 2FA requires at least one trusted browser/device.
- Email and device verification can be enabled independently or together.
- Confirmation dialogs explain the method-specific lockout risk before a method is enabled or disabled.

#### Changing a Verified Contact Email

1. The user chooses **Change contact email**.
2. EduVerse sends a six-digit code to the current verified address.
3. Entering the correct code unlocks the contact-email field for that signed-in session for 15 minutes.
4. The user enters the replacement address and saves it. Saving uses up the temporary permission.
5. EduVerse sends the normal verification code to the replacement address. The new address cannot be used for email sign-in codes until this second verification is complete.
6. Signing out, losing the session, or allowing the temporary permission to expire requires another code from the old address.

The linked Google email option follows the same old-address confirmation rule when it would replace an existing verified contact email.

#### Organization User Recovery

- Org admins can copy a password-reset link or reset two-step verification for any user in their organization.
- Sub-admins can do the same for teachers, managers, finance managers, students, and guardians.
- Sub-admins cannot reset the password or change two-step verification for the org admin or another sub-admin. The backend enforces this even if someone calls the API directly.
- The user-table action opens one shared **Account recovery** modal containing the password-reset and two-step reset options.
- Admins cannot turn two-step verification on for another user. They can only reset it to off when the user is locked out.
- Resetting two-step verification removes the extra sign-in check but does not change the user's password, active sessions, or trusted-device records.

#### Org Admin Recovery

- An org admin with device-only two-step verification can choose the verified organization contact email when no trusted device is available.
- This is a recovery choice for that sign-in. It does not silently turn on email verification for later sign-ins.
- If the org admin has also lost access to the organization contact email, a platform admin can replace it from **Organizations > Actions** after confirming the request through the support process.
- A platform recovery address is marked verified immediately so it can be used to regain access. Any waiting org-admin sign-in requests are cancelled, and the org admin starts sign-in again using the new address.
- The previous verified address receives a notice that the organization contact email changed.

### Sessions, Trusted Devices, and Login Alerts

- Authentication sessions and trusted encryption/approval devices remain separate records and controls.
- Users can sign out another session without removing its trust, or remove browser trust without presenting both actions as equivalent.
- New-device and new-location security events read the full user settings context once, then independently honor login email and login push preferences.
- Security alert email delivery uses the common email-template service; delivery failures do not invalidate an otherwise successful login.

### Program Setup

1. Org Admin or department-scoped Sub Admin selects the owning department.
2. Admin enters program identity, structure, progression, completion, duration, and optional admissions metadata.
3. Admin adds stable curriculum stages in progression order and assigns course requirements.
4. Academic cycles are created independently; a program offering is added only when the curriculum will run in a cycle.
5. Backend validates organization, department scope, course, ordering, uniqueness, and curriculum invariants.
6. One transaction creates the program, revision 1, draft curriculum, stages, and requirements.
7. Admin reviews the generated curriculum, activates a complete version as the admissions default, then activates the program.

### Online Admission Setup and Review

1. Org Admin enables Online Admissions in organization settings and reviews applicant email templates.
2. Org Admin or department-scoped Sub Admin opens a program offering, enables online admission, adds applicant instructions, and defines required or optional document labels.
3. An applicant browses `/admissions`, chooses an organization and offering, completes the student-style form, solves Cap verification, uploads required documents, and submits without creating an account.
4. Org Admin, scoped Sub Admin, or Manager reviews visible applications and documents. Org Admin and Sub Admin can request updates, accept, or reject; rejected records remain available by status.
5. A requested applicant update uses the expiring email link to supply missing documents.
6. For an accepted submission, an authorized administrator opens the prefilled student-admission form, corrects data as needed, chooses the final login email, and creates the student.
7. Student creation and application linkage commit atomically, then the submission becomes `ADMITTED` and outstanding update links are revoked.

### Program Change

1. Metadata-only edits update the program without changing historical student plans.
2. Structural edits use the dedicated replace command with current `configurationVersion` and a reason.
3. The backend rejects stale versions, appends a configuration revision, and scaffolds a future draft curriculum.
4. Existing students retain their original revision, curriculum, stage attempts, and progression decisions.

### Student Major Admission and Transfer

1. Admin selects a program during student admission or from Manage Enrollment.
2. The selected active/default curriculum and optional stable entry stage are resolved.
3. The student's primary department is derived from the program department.
4. Admission creates one open `StudentProgramEnrollment` without pre-creating future cycle rows.
5. Placement creates `StudentStageEnrollment` rows against actual stage offerings; institute cycle transitions do not advance students automatically.
6. Changing majors uses transfer, closes the old enrollment with history, and creates a new enrollment chain.
7. Clearing a major requires an explicit withdrawal reason; generic student profile edits cannot erase it.

### Student Progression

1. Each major enrollment pins the program's progression mode, completion mode, passing threshold, optional attendance threshold, curriculum revision, and entry stage at admission time.
2. A preview evaluates finalized weighted grades, required courses, elective-group minima, earned credits, attendance, prior attempts, and open target offerings without changing records.
3. Sequential programs advance in stage order; credit-accumulation and flexible programs evaluate their configured evidence; manual programs always require an explicit operator decision.
4. Completing and advancing a stage is one atomic operation. The completed attempt, immutable decision, and next attempt either all persist or all roll back.
5. A failed automatic recommendation can be overridden only with a reason. The recommendation, evidence, result, actor, and override flag are retained for audit and archives.
6. The Progression Workbench previews a stage offering in bulk and applies selected rows with per-student results. Retrying the same request with the same idempotency key cannot duplicate decisions or stage attempts.

### Student Academic Identity and Program View

- Student-facing identity resolves in one order everywhere: active major program, then current cohort, then current section, then unassigned.
- The student Overview shows the major, department, curriculum, current and next stage, stage and credit progress, configured duration, progression/completion policy, and expected graduation.
- Expected graduation uses the recorded student graduation date when present. Otherwise, month/year program durations produce an estimate from the program start or admission date; cycle-based durations remain undated instead of inventing a calendar date.
- Transcripts, printable/PDF transcript headers, student lists, selectors, and AI student results use the same academic identity projection.
- Copilot resolves programs as first-class entities and can retrieve role-scoped program structure, curricula, stages, course requirements, open offerings, student progress, duration, and expected graduation context.

### Standalone and Program-Mapped Delivery

1. Admin chooses `STANDALONE` or `PROGRAM_MAPPED` when creating a cohort or section.
2. Standalone delivery needs only the ordinary academic cycle/course context.
3. Program-mapped delivery selects a compatible program stage offering in the section's cycle.
4. A mapped section additionally resolves the stage course requirement it delivers.
5. Imports, copy-forward, reassignment, filters, and archive indexes preserve the selected classification.

### Course and Section Setup

1. Org admin creates courses with credit hours.
2. Org admin creates sections for courses and academic cycles.
3. Teachers are assigned to sections.
4. Students are enrolled through the dedicated enrollment workflow, either directly into sections or through cohorts.
5. Materials, schedules, attendance, assessments, and grades attach to sections.

### Section Removal and Transfer Policy

1. Removing a student from a section closes the live enrollment only. Attendance records, grades, submissions, and enrollment history remain preserved.
2. If the section already has grades for the student, the removal confirmation must offer a clear `wasExcluded` choice. Excluding the section means it can remain visible as historical context but should not contribute to transcript GPA, CGPA, rank, or merit calculations.
3. The removal confirmation must warn: if the intent is to move the student into another section, use the dedicated transfer or reassignment utility instead of remove-then-add.
4. Section transfer changes current placement from a source section to a destination section and records the source enrollment as historical. It should be used for mid-cycle section moves, not for deleting academic evidence.
5. Previous-section attendance should remain in the previous section. Destination-section attendance starts from the transfer date.
6. Percentage-only attendance transfer is available as an auditable administrative adjustment, not as real session mapping. It stores the source percentage and reason, marks generated destination records with `TRANSFER_PERCENTAGE`, and keeps them distinguishable from ordinary teacher-marked attendance.
7. Missed assessments caused by transfer do not become automatic zeroes. The transfer utility creates explicit destination assessment exemptions for assessments before the transfer date when the student has no grade.
8. After transfer, staff should review transcript inclusion, attendance summary, destination gradebook exemptions, and any required makeup assessments before finalization.

### Multi-Teacher Sections

- Sections support multiple assigned teachers.
- Materials and assessments store the creator.
- Teacher workflow notifications for assessments are routed to the creator.
- Schedules store one selected teacher, so timetable and conflict logic are explicit.

### Schedule Creation

1. Admin selects a section.
2. Admin selects a teacher assigned to that section.
3. Admin selects day/time/room details.
4. Backend validates teacher assignment.
5. Backend checks room, section, student, and selected-teacher conflicts.
6. Schedule is saved with `teacherId`.

### Timetable Views

- Students see schedules for enrolled sections.
- Teachers see schedules assigned to them through `schedule.teacherId`.
- Admins do not get a synthetic organization-wide timetable by default; they must select a teacher, room, or student target.
- A blank date shows the general weekly timetable; selecting a date narrows the grid to that date/day.
- Time columns scroll with the timetable grid on small screens.

### Attendance Ownership

- Only the teacher who owns a schedule through `schedule.teacherId` can create or mark attendance for that schedule.
- Organization admins and sub-admins can review attendance but cannot mark or import attendance.
- Monthly attendance import is limited to teacher and manager users and only affects schedules owned by the importing teacher.

### Assessment and Grading

1. Teacher creates an assessment for a section.
2. Assessment stores `createdById`.
3. Students submit where applicable.
4. Teacher grades submissions.
5. Grade input allows `0`.
6. Non-zero grades must be at least `0.5`.
7. Grades are rounded to one decimal.
8. Invalid values show explicit form errors.

### Answerbook Evidence

1. Grader saves the student's grade so a stable grade ID exists.
2. Grader optionally enters an answerbook reference number.
3. Grader uploads up to five PDF or image files from the grading form.
4. Backend rechecks role, department/section assignment, enrollment, grade status, cycle writability, file policy, and concurrent attachment count.
5. Published/finalized evidence is visible to the student and linked guardians; draft evidence remains staff-only.
6. Finalization freezes evidence changes. Cycle archive locks the underlying files and serves them through archive-scoped download routes.

### Grade Finalization

1. Teacher enters or publishes grades for assigned academic work.
2. Manager, Admin, or Sub Admin reviews finalization readiness.
3. Grades are finalized only when they are ready for official records.
4. Transcript generation reads finalized grades and the cycle GPA policy snapshot.
5. Finalized-grade audit fields record who finalized or changed official grade state.

### User Management

1. Admin opens `/users`.
2. Admin creates Sub Admins and Finance Managers where needed.
3. Admin or Sub Admin creates teachers, managers, students, and guardians where allowed.
4. Teacher/manager accounts use the teacher form and `isManager` role option.
5. Sub Admin, Finance Manager, Guardian, Teacher, and Student account forms can upload cropped profile photos through the shared avatar upload route.
6. Sidebar active state and breadcrumbs treat `/users/*` as the user-management tree.

### Guardian Linking

1. Admin or Sub Admin creates a Guardian account.
2. Admin or Sub Admin opens a student edit form.
3. The student record selects `guardianId` and optional relationship text.
4. Guardian signs in and selects one of the linked students.
5. Guardian portal queries are filtered to those linked students.

### Transcript Generation

1. Transcript service loads student enrollment history and finalized grades.
2. Course and section details include course credit hours.
3. Section results are calculated from finalized assessment grades.
4. Optional section result schemes aggregate independent component section results into one course result.
5. Cycle GPA policy snapshot is resolved.
6. GPA service maps percentages to letter grades and grade points.
7. GPA service calculates GPA and CGPA.
8. Sections marked excluded remain historical transcript context but do not contribute to GPA, CGPA, rank, or merit.
9. Web and PDF views render credit hours, grade points, quality points, GPA, CGPA, scale, policy name, and component breakdowns when configured.

### Cycle Completion, Archive, and Past Records

1. Staff finishes operational corrections and resolves in-progress student stage enrollments.
2. Org Admin transitions the active cycle to `COMPLETED`.
3. Archive creation rejects remaining in-progress stage enrollments or unverifiable referenced files.
4. The archive service creates immutable section snapshots and student/program search indexes.
5. It verifies per-section checksums, aggregate checksum, counts, and file locks before marking the archive ready.
6. Only then does the cycle become `ARCHIVED` and appear in Past Records.
7. Users can browse by cycle, department, program, cohort, standalone/program-mapped classification, section, or student search.
8. Archived section detail renders students, grades, assessments/exams, attendance, schedules, materials, submissions, and answerbook evidence in read-only mode.

---

## 9. Security and Permissions

### Authentication and Token Boundaries

- A pending 2FA token grants access only to the 2FA challenge endpoints and related socket room.
- Pending logins expire after 15 minutes and are consumed once.
- Full JWTs contain the resolved access level. Guards validate and trust the signed claim instead of resolving permissions again.
- Missing or invalid access-level claims default to `0` (no access), never full write access.
- Google login bypasses EduVerse 2FA because Google has already authenticated the linked account.
- Successful password-based 2FA automatically trusts the browser after the full access token is issued.

### Security Preferences

- `loginNotificationEmail` controls new-device and suspicious-location security email.
- `loginNotificationPush` controls the corresponding in-app/push alert.
- Missing settings rows receive secure product defaults through one backend settings resolver.
- Frontend account settings use one global settings context so 2FA, appearance, and notification screens do not maintain conflicting copies.

### Tenant Isolation

- Organization routes enforce active organization scope.
- Services validate that referenced records belong to the active organization.
- Cross-organization record access should fail even if IDs are known.

### Role-Based Access Control

- Platform administration is separate from organization administration.
- Main organization administration is separate from delegated Sub Admin operations.
- GPA policy management is restricted to trusted organization administration.
- Org Admin program writes are organization-wide. Sub Admin program writes require explicit assignment to the owning department.
- Student major admission, transfer, withdrawal, and progression are restricted to Org Admin and appropriately scoped Sub Admin users.
- Archive creation/retry is Org Admin-only; archive status and verification reads are available to authorized academic leadership.
- Teacher and Manager access is scoped to assigned teaching or academic oversight workflows.
- Student access is scoped to the signed-in student's own data.
- Guardian access is scoped to students linked through guardian relationships.
- Finance Manager access is scoped to finance workflows and finance-related communication.
- Online-admission reads are available to Org Admin, department-scoped Sub Admin, and department-scoped Manager. Decisions and student conversion remain Org Admin/Sub Admin writes.

| Role              | Backend authority summary                                                                               | Frontend route summary                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ORG_ADMIN`       | Full organization management, programs and admissions across all departments, student majors, cycle archive, settings, finance, users, academic setup, grade finalization. | `/overview`, `/users/*`, `/programs/*`, `/online-admissions/*`, `/past-records/*`, academics, finance, settings. |
| `SUB_ADMIN`       | Delegated operations and program/admission/major writes inside explicitly assigned departments; cannot archive cycles or manage main admin-only areas. | `/overview`, permitted `/users/*`, scoped `/programs/*`, `/online-admissions/*`, `/past-records/*`, academics. |
| `ORG_MANAGER`     | Assigned-department academic oversight, admission review, attendance, assessments, grades, transcripts, finalization review. | Academic monitoring and read-only scoped online-admission routes; no finance/settings/user orchestration. |
| `FINANCE_MANAGER` | Finance structures, entries, payment claims, transactions, finance mail.                                | `/finance`, mail/chat support routes.                                                        |
| `TEACHER`         | Assigned sections, materials, assessments, submissions, attendance, grading.                            | Teaching profile, assigned courses/sections, attendance, grades, timetable.                  |
| `STUDENT`         | Own portal data, own finance claims, own transcript and attendance.                                     | Student portal, fees, timetable, transcript, chat.                                           |
| `GUARDIAN`        | Linked-student read flows only.                                                                         | `/guardian`, linked-student switcher, communication support routes.                          |

### Query-Level Scoping

- Every program and nested curriculum write resolves the owning department and enforces explicit Sub Admin assignment.
- Program lists, delivery options, mapped cohorts/sections, student majors, imports, and archived records apply department scope server-side.
- Teacher and Manager transcript reads are checked against assigned sections.
- Teacher and Manager cohort include/exclude overrides are checked against assigned sections.
- Guardian overview reads require the requested student to be linked to the guardian.
- Student profile, finance, attendance, and transcript reads are self-scoped where exposed.
- Finance services verify organization ownership for all finance records.
- Past Records limits teachers to archived sections they taught, students to their own archived records, and guardians to linked students. Unauthorized nested archive payload data is removed server-side.

### Navigation and Breadcrumbs

- Organization user-management links should point to `/users/*`.
- Breadcrumbs for user management use `Organization > Users > Role Area > Action`.
- Sidebar active matching maps `/users/*` and compatibility user routes back to the Users sidebar item.
- Frontend visibility is treated as guidance; backend guards and service checks remain authoritative.

### Sensitive Locks

- GPA policy on an academic cycle locks after finalized grades exist.
- Program configuration revisions and admitted student cycle plans are immutable historical contracts.
- Archived cycle snapshots and archive-locked files are read-only.
- Finalized grades block answerbook reference and attachment mutation.
- Historical GPA policies used by cycles should be archived instead of hard-deleted.
- Finance transactions act as audit records and should not be treated like ordinary editable notes.

### Input Safety

- Backend DTOs validate incoming payloads.
- GPA grade rules are structured JSON only.
- No custom code, raw formulas, or `eval` are allowed for GPA calculation.
- Numeric form fields avoid browser spinner controls globally.

### Protected Content Boundaries

- Authentication sessions and trusted encryption devices are separate concepts.
- Private encryption keys are generated and stored in the browser; the backend stores public keys, device trust metadata, ciphertext, and key envelopes.
- Backend services enforce recipient/device envelope coverage before storing encrypted Chat, Mail, or attachment content.
- Notifications, sockets, unread counts, delivery/read state, timestamps, recipient resolution, and permissions remain metadata-only.
- AI/Copilot backend tools do not decrypt or fetch Mail body content. Decrypted Mail handoff to Copilot remains an explicit future client-side action.
- User-composed protected Mail is encrypted. Backend-generated operational Mail can remain plaintext until a separate server-side product alternative exists.
- Search over encrypted message body/subject content is not supported on the backend. Search can use metadata such as category, status, sender, assignee, and timestamps.

---

## 10. GPA, Transcripts, and Academic Policy

### Default Standard GPA Policy

Newly initialized development data can use the standard 4.0 policy below:

| Min | Max   | Letter | Points |
| --- | ----- | ------ | ------ |
| 85  | 100   | A      | 4.0    |
| 80  | 84.99 | A-     | 3.7    |
| 75  | 79.99 | B+     | 3.3    |
| 70  | 74.99 | B      | 3.0    |
| 65  | 69.99 | B-     | 2.7    |
| 60  | 64.99 | C+     | 2.3    |
| 55  | 59.99 | C      | 2.0    |
| 50  | 54.99 | D      | 1.0    |
| 0   | 49.99 | F      | 0      |

### GPA Methods

Simple average:

```text
GPA = average(gradePoints)
```

Weighted by credit hours:

```text
qualityPoints = gradePoints * creditHours
GPA = sum(qualityPoints) / sum(creditHours)
```

### Rounding

Policies support:

- `NONE`
- `ONE_DECIMAL`
- `TWO_DECIMALS`

### Transcript Labels

Transcript tables use:

- `Grade Points` for the policy grade-point value.
- `Quality Points` for `gradePoints * creditHours`.
- `GPA` for cycle GPA.
- `CGPA` for cumulative GPA across returned cycles.

---

## 11. Finance

Finance is data-record and verification focused. It does not process external payments.

### Finance Structures

Finance structures define charge rules, amounts, billing behavior, and targets.

Rules:

- Amount inputs must be editable without an unremovable leading zero.
- Structures generate entries; entries track actual payment state.

### Finance Entries

Entries can move through states such as:

- Pending
- Unverified
- Partial
- Paid
- Overdue

### Transactions

Transactions represent verified payment activity and should be treated as audit-sensitive records.

---

## 12. Real-Time Communication and Notifications

### Socket.IO

Socket.IO powers:

- Chat updates.
- Presence.
- Notification updates.
- Dashboard refresh events.

### Notifications

Notification routing is event-specific.

Important assessment notification rules:

- Submission received: assessment creator.
- Missing submissions: assessment creator.
- Overdue grading reminders: assessment creator.
- All students submitted: assessment creator.
- Student notifications remain unchanged by teacher creator routing.

Chat mention notification rules:

- Group-chat mentions carry `chatId` and `messageId` in the notification action URL.
- Mention targets can be individual users, everyone in the active group, active users by role when a group has more than one role, or active users in a related section, department, or cohort.
- Related-scope mention options are derived from active group participants and are fetched on demand with frontend SWR caching.
- The backend expands all mention targets and dedupes recipients with a set before notification creation.

Protected-content notification rules:

- Chat and Mail notifications use generic copy instead of protected message or subject text.
- Mention notifications still carry `chatId` and `messageId`, but not decrypted message content.
- Socket payloads can refresh UI state but must not require decrypted content for notification text or badge counts.

---

## 13. Files, PWA, and Browser Runtime

### Files

- Uploads are stored through Cloudinary.
- File flows are used by chat, mail, materials, submissions, grade answerbook evidence, organization logos, and profile media.
- File validation should happen before upload where the UI has enough information.
- Files are stored as private Cloudinary assets and are downloaded through authenticated backend endpoints.
- Mail-message files use Mail participant access rules; Chat files use active chat membership access rules.
- Grade answerbook files use typed `GradeAnswerbookAttachment` ownership and grade/section/student authorization.
- Archive finalization records and verifies referenced file IDs, then locks those files against mutation or deletion.

### PWA

- The app includes manifest and PWA prompt support.
- In development, service worker registration is disabled and old EduVerse caches are cleared to reduce stale-chunk reload issues.
- Production can use service worker behavior where configured.

---

## 14. Environment Variables

### Required Backend Variables

| Variable         | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`       | Use `production` for a release deployment.                                  |
| `DATABASE_URL`   | PostgreSQL connection string.                                                |
| `JWT_SECRET`     | JWT signing secret; production requires at least 32 characters.             |
| `CLOUDINARY_URL` | Cloudinary upload configuration.                                             |
| `FRONTEND_URL`   | Exact comma-separated allowed frontend origins; production requires HTTPS.  |
| `PORT`           | Backend port.                                                                |
| `BCRYPT_ROUNDS`  | Password hash cost between 10 and 15.                                        |

### Optional / Feature Variables

| Variable                    | Description                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| `RESEND_API_KEY`            | Resend API key.                                                                   |
| `RESEND_FROM_EMAIL`         | Email sender address.                                                             |
| `AUTH_COOKIE_DOMAIN`        | Cookie domain.                                                                    |
| `AUTH_COOKIE_SECURE`        | Secure cookie flag.                                                               |
| `AUTH_COOKIE_SAME_SITE`     | Cookie SameSite policy.                                                           |
| `GOOGLE_CLIENT_ID`          | Google OAuth client ID for linked-account sign-in.                                |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth client secret used by the backend code exchange.                     |
| `GOOGLE_REDIRECT_URI`       | Backend callback URL, usually `/auth/google/callback`.                            |
| `GOOGLE_OAUTH_STATE_SECRET` | Optional separate secret for signed Google OAuth state. Defaults to `JWT_SECRET`. |
| `THROTTLE_TTL`              | Rate-limit TTL.                                                                   |
| `THROTTLE_LIMIT`            | Rate-limit request count.                                                         |
| `DATABASE_POOL_MAX`         | Maximum PostgreSQL connections per backend replica; defaults to 10.               |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Idle pool-connection timeout; defaults to 30000 ms.                          |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | Pool connection timeout; defaults to 5000 ms.                        |
| `SUPER_ADMIN_USERNAME`      | Creates the first super admin when configured and no super admin exists.           |
| `SUPER_ADMIN_PASSWORD`      | Password used only when creating that first super admin.                           |
| `SUPER_ADMIN_EMAIL`         | Platform notification address.                                                     |

Use `backend/.env.example` and `frontend/.env.example` as the complete inventory. Production values belong in a secret manager. Run `npm run release:env-check` inside the built backend artifact before migration or startup.

The exact production certification, staging, deployment, smoke-test, and rollback procedure is in [production-release-runbook.md](production-release-runbook.md).

---

## 15. Local Development

### Backend

```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Build

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

### Prisma

Use Prisma migrations for schema changes.

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

On Windows, Prisma engine execution may require the environment to allow child process execution.

---

## 16. Testing and Verification

### Backend Verification

18. Departments, Buildings, and Rooms

### Departments, Buildings, and Rooms

- `npm run build`
- DTO validation checks for new endpoints.
- Role guard and service-scope checks:
  - Admin can manage organization users and settings.

### Departments, Buildings, and Rooms

- `Department`: organization-scoped grouping used for academic/administrative scope, filtering, reporting, and scoped access. Key fields: `id`, `organizationId`, `name`, `code?`, `description?`, `color?`, `isActive`, timestamps.
- `Building`: physical or logical campus location. Key fields: `id`, `organizationId`, `name`, `code?`, `address?`, `description?`, `isActive`, timestamps.
- `Room`: belongs to a `Building` and represents a schedulable space. Key fields: `id`, `organizationId`, `buildingId`, `name`, `floor?`, `type?` (enum: `CLASSROOM|LAB|AUDITORIUM|OFFICE|LIBRARY|HALL|OTHER`), `capacity?`, `description?`, `isActive`, timestamps.
- `BuildingDepartment`: join table for optional many-to-many association between buildings and departments. Key fields: `id`, `organizationId`, `buildingId`, `departmentId`.

Notes:

- Room names may repeat across different buildings but must be unique within a building.
- `Section` may gain an optional `defaultRoomId` (suggestion only). `Schedule` migrates to using `roomId` as the authoritative room for conflict checks.
  - Sub Admin can manage delegated users but cannot create or edit Sub Admin accounts.
  - Manager cannot access finance management or settings.
  - Finance Manager can perform finance actions and cannot access academic setup.
  - Guardian can read linked-student data and cannot read unrelated students.
  - Teacher and Manager assigned-section transcript and cohort override checks reject unrelated students.
  - Student self access rejects other student records.
- GPA policy validation:
  - overlapping ranges fail
- `GET /org/departments`
- `POST /org/departments`
- `PATCH /org/departments/:id`
- `DELETE /org/departments/:id`
- `GET /org/buildings`
- `POST /org/buildings`
- `PATCH /org/buildings/:id`
- `DELETE /org/buildings/:id`
- `GET /org/rooms`
- `POST /org/rooms`
- `PATCH /org/rooms/:id`
- `DELETE /org/rooms/:id`
- `POST /org/buildings/:id/departments` (assign/remove departments)
- gaps fail
- points above scale fail
- points decreasing as marks increase fail
- more than 20 rules fail
- GPA calculation:

Room and schedule behavior:

- `Schedule` accepts optional `roomId` (migrated from legacy `room` string). Conflict checks prefer `roomId` when present.
- Room validation ensures `buildingId` and `organizationId` match the active organization; room must be active when selected for new schedules.
- Capacity warnings are surfaced during schedule creation but are not hard blocking in v1.
  - simple average
  - credit-hour weighted
  - rounding modes
- Schedule validation:
  - teacher belongs to section
  - room conflict
  - teacher conflict

Management pages added:

- `/setup/departments` — list, create, edit, enable/disable departments.
- `/setup/buildings` — list, create, edit, assign departments, enable/disable buildings.
- `/setup/rooms` — list, create, edit, filter by building/department/type, enable/disable rooms.

UI helpers:

- `formatDepartmentLabel(department)` — renders name (and code if present).
- `formatBuildingLabel(building)` — renders name (and code if present).
- `formatRoomLabel(room)` — preferred rendering `Building Name • Room Name` or `BUILDING_CODE • Room Name` when code exists.
  - time-slot conflict
- Transcript:
  - finalized grades only
  - course credit hours included
  - cycle policy snapshot used
  - GPA and CGPA calculated centrally

* Schedule/Room migration
  - Create schedules with `roomId` and with legacy `room` string; legacy records must render fallback room text until migrated.
  - Room conflict detection uses `roomId` when present; identical room names in different buildings do not conflict.

- Guardian:
  - create guardian
  - update guardian
  - link student through student update
  - many linked students appear in guardian portal
- Finance:

### Departments, Buildings, Rooms Migration

- Phase 0: Audit all usages of `room` across backend and frontend; map `section.room`, `schedule.room`, schedule conflict checks, and UI inputs.
- Phase 1: Add Prisma models for `Department`, `Building`, `Room`, `BuildingDepartment` and `RoomType` enum. Generate migrations and keep `isActive` flags.
- Phase 2: Add CRUD endpoints and management UI pages. Keep legacy `Section.room` and `Schedule.room` string fields initially.
- Phase 3: Add nullable `Schedule.roomId` and optional `Section.defaultRoomId`, update DTOs to accept `roomId` while keeping old string fields until stable.
- Phase 4: Update conflict logic to prefer `roomId`, and migrate existing schedule records to `roomId` where possible.
- Phase 5: Once stable, mark `Schedule.roomId` required and remove legacy `room` string fields.
  - Finance Manager can create/update finance records
  - Manager cannot call finance management endpoints
  - Student self payment claim remains available
- Communication:
  - Student can DM assigned teachers only
  - Guardian and Finance Manager cannot create groups
  - Finance Manager mail categories and recipients are enforced

### Frontend Verification

- `npm run build`
- Sidebar and route checks:
  - Users sidebar remains active for `/users/*`.
  - User-management breadcrumbs link back to `/users`.
  - `/users/sub-admins` remains Admin-only.
  - Finance Manager sees finance navigation, not academic management.
  - Guardian sees the guardian portal and linked-student switcher.
- Course forms validate credit hours.
- GPA policy UI:
  - supports multiple policies
  - creates draft policies
  - validates rule table
  - caps rules at 20
  - previews calculations
  - handles mobile rule-table scroll
- Academic cycle UI:
  - explains policy lock clearly
  - prevents changing policy after finalized grades exist
- Transcript web and PDF:
  - show `Grade Points`
  - show `Quality Points`
  - show total credit hours
  - show GPA/CGPA metadata
- Docs:
  - `/docs`
  - `/docs/[slug]`
  - section hash links such as `/docs/gpa-policies#policy-locking`
- User forms:
  - Sub Admin avatar upload uses the cropped image flow and persists to `avatarUrl`.
  - Guardian create/edit avatar upload uses the cropped image flow and persists to `avatarUrl`.
  - Guardian edit shows linked students.

---

## 17. Rollout and Migration Notes

### Clean Initialization Contract

- The project is pre-production and intentionally maintains one consolidated Prisma initialization migration at `backend/prisma/migrations/20260804145000_init/migration.sql`.
- There is no legacy compatibility or data-backfill chain for the programs release.
- A database containing the superseded development schema must be reset before applying the consolidated init.
- Never run `prisma migrate reset` against an active deployment. Stop application replicas first and confirm the target database.
- Run reset/deploy with the database role intended to own the application schema. Resetting with an admin URL can recreate `public` under the admin role and remove the runtime user's ownership/privileges.
- `prisma migrate deploy` is idempotent after the init is recorded, but production migration execution should be serialized before introducing multiple backend replicas.

### Release Verification

Required automated gates include:

- Prisma validation, migration status, and zero schema diff.
- Clean-init replay on a disposable database.
- Programs preflight and removed-field scans.
- Backup/restore parity across critical program, archive, grade-evidence, and academic tables.
- Critical API authorization coverage for Org Admin, scoped Sub Admin, Manager, Teacher, Student, Guardian, and public offering access.
- Archive retry/checksum/file-lock verification.
- Backend tests and build, frontend lint and build, and dependency audit.
- `/health/live` process liveness and `/health/ready` database readiness.

### Production Runtime Constraints

- Initial production runs one backend replica because Socket.IO rooms/presence and throttling state are process-local.
- Add shared Redis-backed Socket.IO and throttling stores before horizontal backend scaling.
- Use exact HTTPS frontend origins, secure cookies, strong JWT secrets, bounded database pools, and private managed-file downloads.
- `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD` recreate only the first super admin when no super-admin row exists; they do not overwrite an existing account.
- Container startup applies committed migrations before starting NestJS. For multi-replica production, move migration execution to one dedicated release job.
- Follow `production-release-runbook.md` for staging, health checks, backup/restore, rollback, and go/no-go evidence.

---

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**.

You are welcome to:

- View and study the source code.
- Fork the repository for personal, educational, and non-commercial purposes.
- Submit issues and pull requests.

You may **not** use this software, or any substantial portion of it, for commercial purposes without prior written permission.

See the full license in the [LICENSE](./LICENSE) file.

---

## Notice

Copyright © 2026 Zahid.

EduVerse is an actively developed commercial project. The source code is publicly available to encourage learning, transparency, and community contributions.

Any commercial use, resale, hosting as a service, redistribution as a competing product, or incorporation into a commercial offering is prohibited unless explicitly authorized by the copyright holder.

Contributions are welcome and will be considered under the terms of the project's license.

---

## Live Deployment

Production URL: https://eduversepak.cloud

---

**Document End**
