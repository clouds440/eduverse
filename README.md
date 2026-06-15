# EduVerse - Technical Design Document

**Version:** 2.2.0  
**Date:** June 2026  
**Repository:** `clouds440/eduverse`  
**Document Type:** Technical Design Document (TDD)

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

---

## 1. Overview

EduVerse is a multi-tenant school and institute management platform. It supports platform administration, organization workspaces, academic lifecycle management, students, teachers, courses, sections, schedules, attendance, assessments, grading, GPA policies, transcripts, finance records, communication, notifications, and file-backed workflows.

The application is web-first and responsive. It uses a NestJS backend, PostgreSQL with Prisma ORM, and a Next.js frontend.

### Primary Users

| Role | Scope |
| --- | --- |
| Super Admin | Highest platform authority for the deployment. |
| Platform Admin | Platform-level organization and admin management. |
| Org Admin | Full administrative control inside one organization. |
| Sub Admin | Delegated organization operations without main-admin ownership. |
| Org Manager | Academic oversight for assigned sections and students. |
| Finance Manager | Finance structures, entries, payment claims, and transaction review. |
| Teacher | Assigned teaching, attendance, material, assessment, and grading workflows. |
| Student | Enrolled learning, submissions, timetable, grades, finance, and transcript views. |
| Guardian | Read-only linked-student overview, attendance, grades, timetable, and fees. |

### Product Scope

- Multi-organization administration with data isolation.
- Role-based access control.
- Student and teacher management.
- Sub Admin, Finance Manager, and Guardian account flows.
- Courses, sections, enrollments, cohorts, academic cycles, and promotions.
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

---

## 2. Goals and Non-Goals

### Goals

- Keep each organization's data isolated.
- Preserve academic history even when policies or assignments change later.
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

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | NestJS 11, Node.js, TypeScript |
| Database | PostgreSQL, Prisma ORM 6 |
| Real-time | Socket.IO |
| Auth | JWT, Passport.js, role guards |
| Validation | `class-validator`, DTOs, Zod on selected frontend forms |
| Files | Cloudinary |
| Email | Resend API |
| Password strength | `zxcvbn` |
| PDF | `pdf-lib` |

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
    announcements/
    attendance/
    auth/
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
    org/
    prisma/
    promotions/
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
- Existing courses are backfilled to `3` through migration.
- Credit hours are used by GPA calculations when the policy method is weighted by credit hours.

### Sections and Section Teachers

Sections connect courses, academic cycles, students, teachers, schedules, materials, assessments, attendance, and grades.

Rules:

- A section can have multiple assigned teachers.
- Section colors use predefined safe colors so labels remain readable.
- Teacher selection for schedules is limited to teachers assigned to the selected section.

### Schedules

Schedules are stored as section schedules.

Important rule:

- A schedule belongs to exactly one teacher through `teacherId`.

Behavior:

- Student timetables remain section-based.
- Teacher timetables are teacher-based and use `schedule.teacherId`.
- The timetable displays the teacher from `schedule.teacherId`.
- Room, time-slot, and teacher conflict detection remain enforced.

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

### Academic Cycles and GPA Policy Snapshots

Academic cycles group cohorts, sections, enrollments, assessments, grades, attendance, and transcripts.

GPA policy behavior:

- A cycle can store a selected GPA policy.
- A cycle stores a policy snapshot so historical transcripts are stable.
- If no cycle policy is chosen, the organization default policy is used.
- Once finalized grades exist in the cycle, the cycle GPA policy cannot be changed.
- Policies associated with historical cycles should be archived/hidden instead of hard-deleted.

---

## 6. Backend Modules and API Design

### Auth

Main responsibilities:

- Login and JWT issuance.
- Password strength and password reset support.
- Session/device tracking.
- Contact email verification.
- Guards and decorators for role and organization context.

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

- Create, update, activate, list, and delete academic cycles where allowed.
- Store and update selected GPA policy.
- Lock GPA policy changes after finalized grades exist.
- Support copy-forward and promotion flows through related modules.

### Transcripts

Routes under `/org/transcripts`.

Main responsibilities:

- Build transcript data for one student and optional cycle.
- Include course name, section name, credit hours, marks/percentage, letter grade, grade points, and quality points.
- Calculate cycle GPA and cumulative CGPA through `GpaService`.
- Use the cycle policy snapshot when present.
- Preserve finalized-grade filtering.

### Attendance and Schedules

Main responsibilities:

- Create/update/delete section schedules.
- Validate schedule teacher assignment.
- Preserve room, time-slot, and teacher conflict checks.
- Record and retrieve attendance.

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

Mail rules:

- Guardian mail is limited to administration, finance, or platform support.
- Finance Manager mail is limited to finance-related categories and selected recipients in Admin/Sub Admin/Student/Guardian roles.
- Org Admin/Sub Admin can view and manage organization mail.
- Manager bulk mail is restricted and should not behave like Admin mail.

---

## 7. Frontend Architecture

### Route Groups

```text
frontend/app/
  (org)/              Organization dashboard routes
    users/            User orchestration and canonical user-management routes
  admin/              Platform admin routes
  docs/               Public user-facing documentation
  login/              Authentication
  register/           Organization registration
```

### Shared Systems

| Area | Key Files |
| --- | --- |
| API client | `frontend/lib/api.ts` |
| Types | `frontend/types/index.ts`, `frontend/types/enums.ts` |
| UI primitives | `frontend/components/ui/*` |
| Forms | `frontend/components/forms/*` |
| Section feature UI | `frontend/components/sections/*` |
| Transcript PDF | `frontend/lib/pdf/transcript.ts` |
| PWA prompt/runtime | `frontend/components/ui/PWAInstallPrompt.tsx` |
| Docs content registry | `frontend/app/docs/_data/docs.ts` |
| Breadcrumb logic | `frontend/lib/routeOrientation.ts` |
| Organization sidebar | `frontend/lib/orgSidebar.ts`, `frontend/components/ui/DashboardLayout.tsx` |

### Docs Architecture

The public docs are registry-driven.

Important files:

- `frontend/app/docs/_data/docs.ts`
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

### Course and Section Setup

1. Org admin creates courses with credit hours.
2. Org admin creates sections for courses and academic cycles.
3. Teachers are assigned to sections.
4. Students are enrolled directly or through cohorts.
5. Materials, schedules, attendance, assessments, and grades attach to sections.

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
5. Backend checks room, time-slot, and teacher conflicts.
6. Schedule is saved with `teacherId`.

### Timetable Views

- Students see schedules for enrolled sections.
- Teachers see schedules assigned to them through `schedule.teacherId`.
- Admins can inspect broader timetable data by section and organization context.
- Time columns scroll with the timetable grid on small screens.

### Assessment and Grading

1. Teacher creates an assessment for a section.
2. Assessment stores `createdById`.
3. Students submit where applicable.
4. Teacher grades submissions.
5. Grade input allows `0`.
6. Non-zero grades must be at least `0.5`.
7. Grades are rounded to one decimal.
8. Invalid values show explicit form errors.

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

1. Transcript service loads student enrollments and finalized grades.
2. Course and section details include course credit hours.
3. Cycle GPA policy snapshot is resolved.
4. GPA service maps percentages to letter grades and grade points.
5. GPA service calculates GPA and CGPA.
6. Web and PDF views render credit hours, grade points, quality points, GPA, CGPA, scale, and policy name.

---

## 9. Security and Permissions

### Tenant Isolation

- Organization routes enforce active organization scope.
- Services validate that referenced records belong to the active organization.
- Cross-organization record access should fail even if IDs are known.

### Role-Based Access Control

- Platform administration is separate from organization administration.
- Main organization administration is separate from delegated Sub Admin operations.
- GPA policy management is restricted to trusted organization administration.
- Teacher and Manager access is scoped to assigned teaching or academic oversight workflows.
- Student access is scoped to the signed-in student's own data.
- Guardian access is scoped to students linked through guardian relationships.
- Finance Manager access is scoped to finance workflows and finance-related communication.

| Role | Backend authority summary | Frontend route summary |
| --- | --- | --- |
| `ORG_ADMIN` | Full organization management, settings, finance, users, academic setup, grade finalization. | `/overview`, `/users/*`, academics, finance, settings. |
| `SUB_ADMIN` | Delegated operational management; cannot manage main admin-only areas such as Sub Admin creation. | `/overview`, `/users/*` except Sub Admin management, academics, finance audit where visible. |
| `ORG_MANAGER` | Assigned-section academic oversight, attendance, assessments, grades, transcripts, finalization review. | Academic monitoring routes; no finance/settings/user orchestration. |
| `FINANCE_MANAGER` | Finance structures, entries, payment claims, transactions, finance mail. | `/finance`, mail/chat support routes. |
| `TEACHER` | Assigned sections, materials, assessments, submissions, attendance, grading. | Teaching profile, assigned courses/sections, attendance, grades, timetable. |
| `STUDENT` | Own portal data, own finance claims, own transcript and attendance. | Student portal, fees, timetable, transcript, chat. |
| `GUARDIAN` | Linked-student read flows only. | `/guardian`, linked-student switcher, communication support routes. |

### Query-Level Scoping

- Teacher and Manager transcript reads are checked against assigned sections.
- Teacher and Manager cohort include/exclude overrides are checked against assigned sections.
- Guardian overview reads require the requested student to be linked to the guardian.
- Student profile, finance, attendance, and transcript reads are self-scoped where exposed.
- Finance services verify organization ownership for all finance records.

### Navigation and Breadcrumbs

- Organization user-management links should point to `/users/*`.
- Breadcrumbs for user management use `Organization > Users > Role Area > Action`.
- Sidebar active matching maps `/users/*` and compatibility user routes back to the Users sidebar item.
- Frontend visibility is treated as guidance; backend guards and service checks remain authoritative.

### Sensitive Locks

- GPA policy on an academic cycle locks after finalized grades exist.
- Historical GPA policies used by cycles should be archived instead of hard-deleted.
- Finance transactions act as audit records and should not be treated like ordinary editable notes.

### Input Safety

- Backend DTOs validate incoming payloads.
- GPA grade rules are structured JSON only.
- No custom code, raw formulas, or `eval` are allowed for GPA calculation.
- Numeric form fields avoid browser spinner controls globally.

---

## 10. GPA, Transcripts, and Academic Policy

### Default Standard GPA Policy

Existing organizations are seeded/backfilled with a standard 4.0 policy:

| Min | Max | Letter | Points |
| --- | --- | --- | --- |
| 85 | 100 | A | 4.0 |
| 80 | 84.99 | A- | 3.7 |
| 75 | 79.99 | B+ | 3.3 |
| 70 | 74.99 | B | 3.0 |
| 65 | 69.99 | B- | 2.7 |
| 60 | 64.99 | C+ | 2.3 |
| 55 | 59.99 | C | 2.0 |
| 50 | 54.99 | D | 1.0 |
| 0 | 49.99 | F | 0 |

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

---

## 13. Files, PWA, and Browser Runtime

### Files

- Uploads are stored through Cloudinary.
- File flows are used by chat, mail, materials, submissions, organization logos, and profile media.
- File validation should happen before upload where the UI has enough information.

### PWA

- The app includes manifest and PWA prompt support.
- In development, service worker registration is disabled and old EduVerse caches are cleared to reduce stale-chunk reload issues.
- Production can use service worker behavior where configured.

---

## 14. Environment Variables

### Required Backend Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | JWT signing secret. |
| `FRONTEND_URL` | Frontend URL used in email links and redirects. |
| `SUPER_ADMIN_USERNAME` | Initial super admin username. |
| `SUPER_ADMIN_PASSWORD` | Initial super admin password. |
| `PORT` | Backend port. |
| `BCRYPT_ROUNDS` | Password hash cost. |

### Optional / Feature Variables

| Variable | Description |
| --- | --- |
| `CLOUDINARY_URL` | Cloudinary upload configuration. |
| `RESEND_API_KEY` | Resend API key. |
| `RESEND_FROM_EMAIL` | Email sender address. |
| `AUTH_COOKIE_DOMAIN` | Cookie domain. |
| `AUTH_COOKIE_SECURE` | Secure cookie flag. |
| `AUTH_COOKIE_SAME_SITE` | Cookie SameSite policy. |
| `THROTTLE_TTL` | Rate-limit TTL. |
| `THROTTLE_LIMIT` | Rate-limit request count. |

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

### Course Credit Hours

- Migration adds `Course.creditHours`.
- Existing courses are backfilled to `3`.
- Backend validation prevents values less than or equal to `0`.

### GPA Policies

- Migration adds GPA policy tables/enums.
- A default 4.0 policy is seeded/backfilled for every existing organization.
- A partial unique index enforces one default policy per organization.
- Existing transcript logic is routed through `GpaService`.

### Academic Cycle Policy Snapshots

- Migration adds selected policy and snapshot support to academic cycles.
- Cycle policy changes are blocked after finalized grades exist.
- Policies referenced by historical cycles should be archived rather than deleted.

### Teacher-Based Schedules

- Schedules require `teacherId`.
- Existing data must be backfilled or migrated to a valid assigned teacher where required.
- Teacher timetable logic uses `schedule.teacherId`.

### Creator Attribution

- Materials and assessments store `createdById` for new records.
- Existing records without creator remain valid and render with fallback text.

---

## Live Deployment

Production URL: https://eduversepak.cloud

---

**Document End**
