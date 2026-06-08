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
| Org Manager | Operational organization management where allowed. |
| Teacher | Assigned teaching, attendance, material, assessment, and grading workflows. |
| Student | Enrolled learning, submissions, timetable, grades, finance, and transcript views. |

### Product Scope

- Multi-organization administration with data isolation.
- Role-based access control.
- Student and teacher management.
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
    gpa/
    insights/
    mail/
    notifications/
    org/
    prisma/
    promotions/
    sections/
    students/
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
- Teacher and student profile records connect account identity to academic workflows.
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

Selected routes:

- `GET /org/courses`
- `POST /org/courses`
- `PATCH /org/courses/:id`
- `DELETE /org/courses/:id`
- `POST /org/sections/:id/schedules`
- `PATCH /org/sections/:id/schedules/:scheduleId`
- `DELETE /org/sections/:id/schedules/:scheduleId`

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

### Communication

Main responsibilities:

- Chat and presence through Socket.IO.
- Internal mail.
- Announcements.
- Notifications and badges.

---

## 7. Frontend Architecture

### Route Groups

```text
frontend/app/
  (org)/              Organization dashboard routes
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
- GPA policy management is restricted to `ORG_ADMIN`.
- Teacher access is scoped to assigned teaching workflows.
- Student access is scoped to the signed-in student's own data.

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

- `npm run build`
- DTO validation checks for new endpoints.
- GPA policy validation:
  - overlapping ranges fail
  - gaps fail
  - points above scale fail
  - points decreasing as marks increase fail
  - more than 20 rules fail
- GPA calculation:
  - simple average
  - credit-hour weighted
  - rounding modes
- Schedule validation:
  - teacher belongs to section
  - room conflict
  - teacher conflict
  - time-slot conflict
- Transcript:
  - finalized grades only
  - course credit hours included
  - cycle policy snapshot used
  - GPA and CGPA calculated centrally

### Frontend Verification

- `npm run build`
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
