# Phase-Based Programs Implementation Plan

Source brief: [programs-implementation.md](programs-implementation.md)

## Purpose and Delivery Rule

This document is the implementation contract for adding department-owned programs, program-specific academic delivery, durable student progression, immutable academic-cycle archives, past-record browsing, future online-admission offerings, and optional answerbook evidence during grading.

This is a high-risk change because current cycles, cohorts, sections, enrollments, histories, grading, attendance, files, and transcripts are already connected. Implementation must therefore follow an additive expand-and-contract rollout. No phase may remove or reinterpret existing data before the replacement path is deployed, backfilled, verified, and observed in production.

Programs remain optional for legacy organizations and legacy records. Existing workflows must continue to work while records are progressively classified.

## Critical Corrections From the Second Audit

The following corrections are required before implementation starts:

1. The target ownership is `Program -> AcademicCycle`. Add nullable `AcademicCycle.programId` for migration compatibility, require it for every newly created program-aware cycle, and leave existing shared cycles null as `Legacy / Unclassified`. Do not add a many-to-many `ProgramCycle` join and do not guess how historical shared cycles should be split.
2. A status flag alone cannot guarantee that archives remain "exactly as is." Student names, course names, teachers, rooms, departments, programs, files, and other referenced rows can change. A verified archive snapshot and file-retention lock are required.
3. Archived cycles must be strictly read-only in v1. Do not add a normal unarchive or archived-grade correction endpoint. A future break-glass correction design may create a new archive revision, but it must never overwrite the original revision.
4. Current hard deletes of sections and assessments can cascade through historical records. Before archive rollout, destructive endpoints must be limited to empty draft data; records with delivery activity must be closed/archived instead.
5. Answerbook evidence must use a typed relation to `Grade`. The generic `File.entityType/entityId` fields alone do not provide referential integrity, lifecycle protection, or student/guardian visibility rules.
6. Existing nullable `academicCycleId` fields must be audited and deterministically backfilled from their owning section/assessment/schedule before archive enforcement.

## Target Architecture

```text
Department
  -> Program
     -> CurriculumVersion
        -> ProgramStage
           -> StageCourseRequirement
     -> AcademicCycle
        -> Cohort
           -> Section
              -> Enrollment
              -> Assessment -> Grade -> GradeAnswerbookAttachment -> File
              -> Submission
              -> Schedule -> AttendanceSession -> AttendanceRecord
              -> CourseMaterial

Student
  -> StudentProgramEnrollment
     -> CurriculumVersion
     -> StudentStageAttempt
        -> AcademicCycle + ProgramStage + optional Cohort
```

`Program` is the long-lived, hard-defined course offering. `AcademicCycle` is a dated semester/year delivery period owned by that program. `StudentProgramEnrollment` is the long-lived student assignment and survives the completion/archive of each individual cycle until all required program stages/cycles are completed, or the student transfers or withdraws.

The archive boundary is one `AcademicCycle`. For new data that cycle belongs to one program. Existing cycles with `programId = null` remain legacy organization cycles and can still be archived without inventing program history.

## Non-Negotiable Invariants

- Every new row is organization-scoped, and every relation is validated to belong to the same organization.
- A `Program` belongs to exactly one `Department`; a department can own many programs.
- A `Program` has many academic cycles; each new program-aware `AcademicCycle` belongs to exactly one program.
- Existing academic cycles may keep `programId = null` as legacy/unclassified records.
- A mapped cohort's stage belongs to a curriculum version of its `academicCycle.programId`.
- Completing or archiving one academic cycle never closes `StudentProgramEnrollment`.
- A student's program enrollment remains tied to the curriculum version and required-cycle snapshot selected at admission, even when the program is edited later.
- An active curriculum version is the hard definition of the program's offered courses, their required/optional status, and their stage/cycle placement. Editing that course structure for future students requires a new curriculum version.
- A section remains valid without a program mapping. Legacy/manual delivery is a supported state, not an error.
- Section enrollment and existing history tables remain the authoritative evidence of delivered teaching; curriculum models describe expected study.
- Program/curriculum edits never rewrite previous enrollment, grade, transcript, or archive facts.
- `ARCHIVED` is terminal through normal product APIs and all archived data is read-only.
- Archive views render the verified snapshot revision, not mutable live labels.
- Answerbook reference and attachments are optional and are attached to a per-student `Grade`, not to the whole `Assessment`.
- Existing API requests without program fields retain their current behavior.
- Every status transition, archive operation, curriculum activation, progression action, and answerbook mutation is auditable.

## Confirmed Current Architecture and Risks

Confirmed in [backend/prisma/schema.prisma](backend/prisma/schema.prisma):

- `Department` owns courses and staff/student scope, but has no programs.
- `AcademicCycle` is currently organization-wide and uses `isActive`; the target adds program ownership while retaining null ownership for legacy cycles.
- `Cohort` requires `academicCycleId`, owns current students/sections, and is deactivated through `isActive`.
- `Section` requires one course and one cycle, can belong to one cohort, and owns most delivery data.
- `Enrollment`, `Assessment`, `Grade`, `Submission`, `SectionSchedule`, `AttendanceSession`, and `CourseMaterial` have nullable cycle links even though their parent normally identifies the cycle.
- `EnrollmentHistory` and `CohortMembershipHistory` preserve movement history, but parent hard deletes can still cascade.
- `Student.cohortId`, `Student.major`, legacy `Student.department`, `primaryDepartmentId`, and `studentDepartments` represent current/legacy placement, not a durable program enrollment.
- `Grade` already has draft/published/finalized status and correction metadata.
- `File` is a generic polymorphic record with no database relation to its target and can be physically deleted from storage.
- `OrganizationActivityLog` and `OrganizationActivityService` already support organization audit events.

Confirmed service behavior and affected paths:

- [backend/src/cohorts/cohorts.service.ts](backend/src/cohorts/cohorts.service.ts) assigns students, sections, current cohort pointers, cohort history, and cohort-sourced enrollments.
- [backend/src/reassignment/reassignment.service.ts](backend/src/reassignment/reassignment.service.ts) changes current placement while retaining existing academic history.
- [backend/src/academic-cycles/academic-cycles.service.ts](backend/src/academic-cycles/academic-cycles.service.ts) enforces one active cycle per organization in application code and currently treats deactivation as archive-like. Program ownership requires this assumption to become one active cycle per program, with a temporary legacy rule for null-program cycles.
- [backend/src/sections/sections.service.ts](backend/src/sections/sections.service.ts) hard-deletes sections; cascading relations make this unsafe after delivery activity exists.
- [backend/src/assessments/assessments.service.ts](backend/src/assessments/assessments.service.ts) hard-deletes assessments and upserts grades.
- [backend/src/attendance/attendance.service.ts](backend/src/attendance/attendance.service.ts) mutates schedules, sessions, and attendance records.
- [backend/src/course-materials/course-materials.service.ts](backend/src/course-materials/course-materials.service.ts) mutates materials and retargets generic file rows.
- [backend/src/preference-windows/preference-windows.service.ts](backend/src/preference-windows/preference-windows.service.ts) and [backend/src/evaluations/evaluations.service.ts](backend/src/evaluations/evaluations.service.ts) write cycle-scoped data that must also obey archive locks.
- [backend/src/copy-forward/copy-forward.service.ts](backend/src/copy-forward/copy-forward.service.ts) copies sections, schedules, and materials but deliberately excludes student results.
- [backend/src/transcripts/transcripts.service.ts](backend/src/transcripts/transcripts.service.ts) derives transcripts from histories, finalized grades, attendance, cohort history, and GPA policy snapshots.
- [backend/src/files/files.service.ts](backend/src/files/files.service.ts) has entity-specific access checks, but no `GRADE_ANSWERBOOK` policy or retention lock.

## Preparation Phase: Exact Existing-Entity Changes

### Department

- Add `Department.programs`.
- Keep department ownership required on `Program`.
- Inactive departments cannot receive new programs or activate draft programs.
- Department deactivation must not hide its programs or historical records.
- Extend department-scope queries so program and past-record access follows the existing selected-department semantics.
- Block hard deletion of a department referenced by a program; current deactivation remains the supported lifecycle action.

### Course

- Keep courses reusable and department-owned; do not add `programId` directly to `Course`.
- Link courses to curricula through `StageCourseRequirement`.
- Block course deletion when referenced by a curriculum requirement, section, or archive manifest.
- Snapshot course name, code, credit hours, and department when archiving. Current mutable course values must not alter archive rendering.
- Curriculum credit expectations may be snapshotted on requirements, but GPA/transcript calculations continue using delivered/finalized rules until a separately approved policy changes that contract.

### AcademicCycle

- Add nullable `programId` and relation `Program.academicCycles`.
- Require `programId` in create/update DTOs for all new program-aware cycles. Only migration/admin compatibility paths may create or retain a null-program legacy cycle.
- Add lifecycle enum `DRAFT`, `ACTIVE`, `COMPLETED`, `ARCHIVING`, `ARCHIVED`.
- Add `status`, `completedAt`, `completedById`, `archivedAt`, `archivedById`, `archiveReason`, and optional `currentArchiveId`.
- Keep `isActive` during compatibility rollout and dual-write it from lifecycle transitions. Do not allow unrelated endpoints to set it independently.
- Replace the global-singleton assumption with one `ACTIVE` cycle per program. Add a PostgreSQL partial unique index on `(organizationId, programId)` for active program-owned cycles and a temporary organization-wide partial unique index for active legacy cycles where `programId IS NULL`.
- Keep the existing organization-wide cycle code uniqueness during the additive rollout. If repeated codes such as `FALL-2027` are required across programs, later migrate to `(organizationId, programId, code)` plus a null-program legacy partial index only after all code-based lookups use cycle IDs/program context.
- Enforce transitions: `DRAFT -> ACTIVE -> COMPLETED -> ARCHIVING -> ARCHIVED`. Allow `DRAFT <-> ACTIVE` only while no completed delivery rule is violated; do not allow normal transitions out of `ARCHIVED`.
- `COMPLETED` permits only explicitly listed closeout operations such as grade publication/finalization. Everything else is denied.
- `ARCHIVING` immediately freezes writes while snapshot generation and verification run.
- `ARCHIVED` serves the verified snapshot only.
- Update every "current cycle" query to accept program context. Cross-program dashboards aggregate all active program-owned cycles instead of selecting a single organization cycle.
- Do not put `curriculumVersionId` directly on `AcademicCycle`; one academic-cycle period may contain cohorts following different frozen curriculum versions. The cohort stage and student enrollment identify the version.

### Cohort

- Keep required `academicCycleId` and existing `isActive` during v1.
- Add nullable `programStageId`.
- Do not add a redundant `curriculumVersionId`; derive it from `programStage`.
- For a program-owned cycle, require a stage when creating new cohorts. Legacy cohorts/cycles may keep the stage null.
- Validate that the cycle program, curriculum stage program, organization, department scope, and lifecycle state all match in one transaction.
- Do not infer mappings from cohort names/codes.
- Closing a cohort does not close the program or cycle and never deletes history.

### Section

- Keep `courseId`, `academicCycleId`, and optional `cohortId`.
- Prefer a `SectionRequirementMapping` join over one requirement foreign key. This allows one delivered section to satisfy multiple valid requirements when manual/cross-program enrollment is used.
- Each mapping links `sectionId` and `stageCourseRequirementId`; derive program context through `section.academicCycle.programId` and validate the requirement course, program, and organization.
- Add a non-destructive section lifecycle (`ACTIVE`, `CLOSED`, `ARCHIVED`) or equivalent fields before archive rollout.
- Permit hard deletion only when the cycle is `DRAFT` and the section has no enrollments/history, assessments/grades/submissions, attendance, materials, evaluations, preferences, or archive reference.
- Replace all other delete actions with close/archive behavior.

### Enrollment and History

- Keep `Enrollment` as delivered enrollment truth.
- Add nullable `studentProgramEnrollmentId` and `studentStageAttemptId` to `Enrollment` and `EnrollmentHistory`.
- Populate links only for new program-aware actions or explicit admin mapping; never guess historical program membership.
- Ensure a linked stage attempt belongs to the same student, program, cycle, and compatible stage as the section mapping.
- Preserve the current `[studentId, sectionId]` uniqueness contract.
- Never delete `EnrollmentHistory` or `CohortMembershipHistory` during program transfer.

### Student

- Keep `Student.cohortId` as the current compatibility pointer.
- Add `StudentProgramEnrollment[]`; do not reinterpret `major` or the legacy department string.
- A transfer closes the previous enrollment and creates a new record; it never changes the previous program/curriculum identity.
- Existing student soft deletion must preserve program enrollment, stage attempts, grades, and archive-search identity.
- Snapshot student name, registration number, roll number, and relevant status at archive time so later profile edits do not alter past records.

### Assessments, Grades, and Submissions

- Keep assessments section-scoped and grades per assessment/student.
- Add non-destructive assessment retirement/archive behavior once grades or submissions exist.
- Block hard deletion after delivery activity or in `COMPLETED`, `ARCHIVING`, or `ARCHIVED` cycles.
- Add `Grade.answerbookReferenceNumber String?` with trim and maximum-length validation.
- Add `GradeAnswerbookAttachment` as a typed join to `Grade` and `File`; do not rely only on generic entity strings.
- Add answerbook file access, deletion, and retention rules to `FilesService`.
- Snapshot assessment definitions, all grade fields/finalization metadata, submissions, answerbook references, and locked attachment metadata during cycle archive.

### Schedules, Attendance, Materials, Evaluations, Preferences, and Events

- Apply the centralized cycle lifecycle check to schedule create/update/delete, attendance session/record writes, material create/update/delete, evaluation windows/evaluations, and preference windows/submissions.
- Backfill missing cycle IDs from their parent where deterministic and reject mismatches.
- Snapshot teacher/room display data because those shared entities remain mutable.
- Include academic events overlapping the cycle date range and applicable departments in the archive snapshot; events are not cycle-owned, so only their snapshot is historical.
- Do not copy assessments, grades, submissions, attendance, evaluations, or preferences through copy-forward.

### Transcripts, GPA, Reports, Search, AI, and Imports

- Keep current transcript and GPA behavior until program grouping has passed compatibility tests.
- Add program/curriculum/stage labels as optional transcript context; archived transcript rendering must use snapshot values.
- Extend imports only after APIs exist: programs, curricula/stages/requirements, program-owned academic cycles, cohort mapping, student program enrollments, and answerbook references.
- Existing imports remain valid without program columns.
- Add programs/program-owned cycles to global search, filter lookups, AI route context, and reporting only after tenant and authorization tests pass.

## New Domain Models

### Program

Fields:

- `id`, `organizationId`, `departmentId`, `name`, `code`, `description`
- `status`: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`
- `structureType`: `GRADE_BASED`, `TERM_BASED`, `CREDIT_BASED`, `LEVEL_BASED`, `CUSTOM`
- `progressionMode`: `SEQUENTIAL`, `CREDIT_ACCUMULATION`, `FLEXIBLE`, `MANUAL`
- `completionMode`: `FINAL_STAGE`, `REQUIREMENTS`, `CREDITS`, `MANUAL`
- optional `durationValue`, `durationUnit`
- admission metadata: `isVisibleForAdmissions`, `admissionsLabel`, `admissionsDescription`, `admissionsSortOrder`
- `createdAt`, `updatedAt`, `archivedAt`

Constraints: unique organization code; required same-organization department. Add `TEACH_OUT` to the lifecycle (`DRAFT`, `ACTIVE`, `PAUSED`, `TEACH_OUT`, `ARCHIVED`): teach-out blocks new admissions/curriculum starts but allows already enrolled students to finish. A program cannot become `ARCHIVED` while active student program enrollments or non-archived cycles remain.

### CurriculumVersion

Fields:

- `id`, `organizationId`, `programId`, `name`, `code`
- `effectiveFrom`, `effectiveTo`
- `status`: `DRAFT`, `ACTIVE`, `RETIRED`, `ARCHIVED`
- `requiredCycleCount Int` and optional cycle/stage terminology used by the UI
- `isDefaultForAdmissions`, `policySnapshot`
- `activatedAt`, `retiredAt`, timestamps

Rules: multiple active versions may serve different batches; use a partial unique index for one admissions default per program; structural edits and `requiredCycleCount` freeze after a student enrollment or delivered mapping references the version. Program edits create a new curriculum version for future students and never alter the version held by existing students.

### ProgramStage

Fields: `id`, `organizationId`, `curriculumVersionId`, `name`, `code`, `sequence`, optional `stageType`, `isOptional`, `minCredits`, `expectedCredits`, `completionRule`.

Constraints: unique code and sequence within a curriculum version; sequence changes are blocked after the version is frozen. For sequential programs, required non-optional stages represent the required semester/year progression and must agree with `requiredCycleCount` before curriculum activation.

### StageCourseRequirement

Fields: `id`, `organizationId`, `programStageId`, `courseId`, `requirementType`, optional `groupKey`, `minCourses`, `minCredits`, `sortOrder`, `creditHoursSnapshot`, `notes`.

Rules: use `REQUIRED`, `ELECTIVE`, or `OPTIONAL`; validate elective group rules; keep extra/manual delivered courses valid and label them outside the curriculum plan.

### SectionRequirementMapping

Fields: `id`, `organizationId`, `sectionId`, `stageCourseRequirementId`, timestamps.

Rules: unique section/requirement tuple; section course equals requirement course; the section cycle's program equals the requirement stage's program; mapping is immutable after cycle archive.

### StudentProgramEnrollment

Fields:

- `id`, `organizationId`, `studentId`, `programId`, `curriculumVersionId`
- status `APPLIED`, `ADMITTED`, `ACTIVE`, `ON_HOLD`, `TRANSFERRED_OUT`, `WITHDRAWN`, `COMPLETED`, `ARCHIVED`
- optional `entryAcademicCycleId`, `entryStageSequence`, `requiredCycleCountSnapshot`, `admittedAt`, `startedAt`, `endedAt`, `exitReason`, `metadata`

Rules: program and curriculum version must match; v1 allows at most one `ACTIVE` record per student through a PostgreSQL partial unique index; prior records are immutable except audited status closure. This row remains active across semester/year boundaries. Completed-cycle count is derived from completed non-skipped stage attempts rather than maintained as a drift-prone counter. Completion occurs only when the frozen curriculum's required stages/cycles and completion rule are satisfied or an authorized manual completion is recorded.

### StudentStageAttempt

Fields: `id`, `organizationId`, `studentProgramEnrollmentId`, `programStageId`, `academicCycleId`, optional `cohortId`, `attemptNumber`, status, reason, `startedAt`, `completedAt`, `resultSnapshot`.

Rules: each semester/year participation creates an attempt under the same durable student program enrollment; repeating creates a new attempt number; stage/program/curriculum/cycle must match; skip/transfer/withdraw statuses require a reason; historical attempts are never moved to a new stage. Completing/archiving the linked academic cycle does not complete the durable program enrollment.

## Program Change and Student Multi-Cycle Contract

Program changes follow this rule:

- Program identity/marketing metadata may be edited with audit logging.
- Course offering, stage order, required cycle count, credit rules, and completion rules belong to `CurriculumVersion`.
- Once a curriculum version is referenced by a student program enrollment, cohort, section mapping, or delivered result, it is frozen.
- To change the offering, clone the current version into a new draft, edit it, validate its exact required-course/stage structure, activate it, and optionally make it the default for future students.
- Existing students stay on their original version and `requiredCycleCountSnapshot`. They are not silently upgraded when the program changes.

Student assignment and progression use this exact flow:

1. Select student, program, active curriculum version, entry stage, and optional entry academic cycle/cohort.
2. In one transaction, create `StudentProgramEnrollment(status = ACTIVE)` with `requiredCycleCountSnapshot` copied from the curriculum version. Reject a second active enrollment in v1.
3. If an entry cycle is selected, verify `academicCycle.programId = program.id`, create the first `StudentStageAttempt`, update the compatibility `Student.cohortId` if applicable, and create/link section enrollments and history.
4. When that semester/year ends, complete/fail/repeat the stage attempt according to approved results. Leave `StudentProgramEnrollment.status = ACTIVE`.
5. For the next program-owned academic cycle, create the next stage attempt under the same `StudentProgramEnrollment` and move only current cohort/enrollment pointers through existing reassignment/history logic.
6. Repeated attempts remain separate and do not increase completed required-cycle count twice. Skipped/credited stages require an explicit reason and the frozen completion policy determines whether they count.
7. Mark the program enrollment `COMPLETED` only after the frozen required stages/course requirements and `requiredCycleCountSnapshot` are satisfied, or through an audited manual completion allowed by the frozen policy.
8. Transfer or withdrawal closes the durable enrollment with reason/date and preserves every cycle attempt, section enrollment, grade, attendance record, transcript fact, and archive snapshot.

Cycle status transitions must never cascade into `StudentProgramEnrollment.status`. Program progression is an explicit student-domain operation, not a side effect of cycle completion/archive.

### GradeAnswerbookAttachment

Fields: `id`, `organizationId`, `gradeId`, `fileId`, `uploadedById`, `createdAt`.

Rules: unique `fileId`; the linked `File` uses `entityType = GRADE_ANSWERBOOK` and `entityId = grade.id`; only PDF/JPG/JPEG/PNG/WEBP; deletion goes through the grading domain and is blocked for finalized grades and frozen cycles unless a future audited policy explicitly permits it.

### AcademicCycleArchive and Snapshot Indexes

`AcademicCycleArchive` fields: `id`, `organizationId`, `academicCycleId`, `revision`, status `BUILDING/READY/FAILED`, `schemaVersion`, `cutoffAt`, `createdById`, `createdAt`, `completedAt`, `failureReason`, `manifest`, `recordCounts`, `checksum`.

`AcademicCycleArchiveSection` fields: archive ID, source section ID, source department/program/curriculum/stage/cohort/course IDs where known, denormalized search labels, section checksum, and immutable JSON payload.

`AcademicCycleArchiveStudentIndex` fields: archive ID, archive-section ID, source student ID, snapshotted name/registration/roll values, normalized search text, and filter dimensions. This supports direct student search without scanning every JSON payload.

Store schema-versioned payloads so renderers can migrate safely. Preserve every ready revision; `currentArchiveId` points to the authoritative revision.

## Archive Scope and Procedure

An archive snapshot includes, at minimum:

- organization/cycle/GPA policy snapshot
- department, owning program, curricula, stages, and requirements participating in delivery
- cohorts, cohort membership history, sections, courses, teacher assignments, rooms, schedules
- enrolled students and enrollment history
- assessments/exam types, grades, finalization/correction metadata, submissions, answerbook references and files
- attendance sessions and records
- course materials and linked files
- evaluation windows/evaluations
- preference windows, options, audiences, submissions, and ranks
- applicable academic events during the cycle date range
- source IDs, timestamps, display values, counts, file hashes, and schema version

Notifications, chat, mail, and finance records are outside the archive unless a future schema explicitly links them to an academic cycle. This boundary must be approved before Phase 7 begins.

Archive sequence:

1. Run preflight integrity checks and produce a report. Block on cross-organization links, cycle mismatches, missing required parents, missing files, or unresolved null cycle IDs.
2. Atomically move `COMPLETED -> ARCHIVING` with a compare-and-set update. All writers must reject `ARCHIVING` immediately.
3. Record `cutoffAt` and create a `BUILDING` archive revision.
4. Generate section/student snapshots in deterministic ID order. Make generation idempotent and resumable by revision.
5. Lock referenced `File` rows against deletion and verify stored hash/metadata. Missing binaries fail the archive; they are not silently omitted.
6. Compare source counts to snapshot counts and compute per-section plus whole-manifest checksums.
7. Run representative reads for roster, grade, attendance, assessment, schedule, material, and direct student search.
8. In one transaction, mark the revision `READY`, set `currentArchiveId`, and move the cycle to `ARCHIVED`.
9. If generation fails, retain `ARCHIVING` and a `FAILED` revision for diagnosis; an authorized retry resumes/rebuilds the same next revision. A cancel action may return to `COMPLETED` only before any `READY` revision exists and must be audited.

## Past Records Product Flow

Primary flow at `/past-records`:

1. Select department.
2. Select program. Always include `Legacy / Unclassified` so historical data without a program is never hidden.
3. Select cycle within that program. Cycle search accepts name or code, such as `Fall 2020`.
4. Select cohort, section, or a combined cohort/section filter; optionally filter by stage, curriculum version, course, teacher, grade status, attendance status, student status, and finalized-only.
5. Open a section in a read-only control-panel layout with roster, assessments/exams, grades, attendance, schedules, materials, submissions, and applicable evaluations.

Additional entry flows:

- Search student by name, registration number, or roll number; then select cycle -> program/cohort/section.
- Search section by name/code/course; then select cycle if multiple historical matches exist.
- Search cycle directly; then narrow by department/program/cohort/section.
- Search course or teacher; then show matching archived sections grouped by cycle/program.
- Open an archived transcript and navigate back to its archived section evidence.

All filters use URL query parameters, server pagination, department scope, and snapshot indexes. Archived views display archive revision, archived timestamp, and a persistent read-only banner. They must not render edit/delete/upload controls.

## Reusable Building Blocks

Backend utilities/services to reuse:

- Pagination/search: `getPaginationOptions`, `formatPaginatedResponse`, `normalizeSearchText`, `fuzzyFilterAndRank` in [backend/src/common/utils.ts](backend/src/common/utils.ts).
- Codes: `normalizeEntityCode` and `ENTITY_CODE_PATTERN` in [backend/src/common/entity-code.ts](backend/src/common/entity-code.ts).
- Department authorization: `getDepartmentScope`, `assertDepartmentInScope`, and `assertDepartmentIdsBelongToOrg` in [backend/src/common/department-scope.ts](backend/src/common/department-scope.ts).
- Guards/decorators: existing role, organization, and access guards under [backend/src/auth](backend/src/auth) and [backend/src/common/access-control](backend/src/common/access-control).
- Audit: `OrganizationActivityService.record` in [backend/src/activity-logs/organization-activity.service.ts](backend/src/activity-logs/organization-activity.service.ts).
- Files: [backend/src/files/files.service.ts](backend/src/files/files.service.ts) and [backend/src/files/file-upload-policy.ts](backend/src/files/file-upload-policy.ts), extended with typed answerbook/archive policies.
- Existing transactional behavior in cohort, enrollment, reassignment, grade, and copy-forward services.

Frontend components/hooks to reuse:

- Page composition: `PageShell`, `PageHeader`, `PageTabs`, `ResourcePanel`, `ResourceToolbar` from [frontend/components/ui/PageShell.tsx](frontend/components/ui/PageShell.tsx).
- Lists and filters: `DataTable`, `PageControls`, `FilterDrawerGrid`, `RemoteFilterSelect`, `SearchBar`, `Pagination`.
- Forms: `FormPageShell`, `FormSection`, `FormField`, `FormGrid`, `FormActions`, `Input`, `Textarea`, `CustomSelect`, `CustomMultiSelect`, `Toggle`, `ModalForm`, `ConfirmDialog`.
- Feedback/state: `Badge`, `StatusBanner`, `EmptyState`, `ErrorState`, `Loading`, `SkeletonTable`, and the existing global toast/processing actions.
- Query behavior: `useUrlQueryState`, `usePersistentPageSize`, `useDebounce`, SWR, and `matchesCacheKeyPrefix` patterns already used by departments/cohorts/sections.
- Lookups: extend [frontend/lib/filterLookups.ts](frontend/lib/filterLookups.ts) for programs, program-filtered academic cycles, curricula, and stages.
- Files: `AttachmentPreviewCard`, [frontend/lib/uploadPolicy.ts](frontend/lib/uploadPolicy.ts), and [frontend/lib/attachmentUtils.ts](frontend/lib/attachmentUtils.ts), with answerbook-specific accept/size helpers.
- Section presentation: refactor `AssessmentList`, `AttendanceSheet`, `SectionSchedules`, and `CourseMaterials` under [frontend/components/sections](frontend/components/sections) into pure display panels plus live mutation wrappers. The pure panels are shared by live and archived pages.

## Phase 0: Baseline, Safety Harness, and Decisions

Objective: freeze contracts before schema changes.

Steps:

- Record production-like row counts and orphan/mismatch queries for every cycle-owned table.
- Add characterization tests for current cohort auto-enrollment/removal, reassignment, section deletion, assessment deletion, grade finalization/correction, transcript generation, file authorization/deletion, and copy-forward exclusions.
- Decide and document the exact archive scope listed above, retention period, maximum answerbook file count/size, and roles allowed to archive.
- Add a temporary rollout switch for program UI, program-aware writes, archive enforcement, past records, and answerbooks. Deployment config is sufficient; do not invent permanent product settings unless per-organization rollout is required.
- Take and restore-test a database backup before migration rehearsal.

Reuse:

- Existing Jest/Nest testing configuration, Prisma test mocks, `OrganizationActivityService`, role/access guards, and department-scope helpers.
- Existing frontend list-page SWR/error/loading patterns for later smoke-test fixtures.

Exit gate: baseline backend tests and both builds pass; integrity report is understood; backup restore is proven; unresolved product decisions are signed off.

## Phase 1: Additive Schema Foundation

Objective: deploy new structures without changing runtime behavior.

Steps:

- Add all program, progression, typed answerbook, archive, and snapshot-index models plus nullable `AcademicCycle.programId`.
- Add nullable links to current entities and lifecycle fields to cycles/sections/assessments/files.
- Add required indexes and explicit `onDelete` behavior. Use `Restrict` for new historical ownership links; do not introduce new cascades that can erase delivered history.
- Add custom PostgreSQL partial unique indexes for one active cycle per program (plus the temporary null-program legacy rule), one default admissions curriculum per program, and one active student program enrollment in v1.
- Generate Prisma client; never edit generated client files manually.
- Add mirrored backend/frontend enums and TypeScript interfaces.
- Do not expose new endpoints or change existing query defaults yet.

Reuse:

- `normalizeEntityCode` for all new codes, existing timestamp/UUID conventions, and existing enums/types layout.
- Frontend types in [frontend/types/index.ts](frontend/types/index.ts) and [frontend/types/enums.ts](frontend/types/enums.ts).

Tests and gate: `prisma validate`, migration on empty and production-like databases, old application against expanded schema, row-count comparison, backend build, frontend build. Rollback remains application-only because all additions are unused and nullable.

## Phase 2: Data Integrity Backfill and Lifecycle Compatibility

Objective: make cycle ownership reliable before any archive lock depends on it.

Steps:

- Backfill `AcademicCycle.status`: active rows become `ACTIVE`; inactive rows become `COMPLETED`; none become `ARCHIVED` automatically.
- Leave all existing `AcademicCycle.programId` values null. Historical cycles may have served multiple programs, so no automatic ownership backfill is safe.
- Dual-write `status` and `isActive` only through `AcademicCyclesService`; update all active-cycle reads incrementally and retain response compatibility.
- Deterministically fill nullable cycle IDs: enrollment/material/schedule from section; assessment from section; grade/submission from assessment/section; attendance session from schedule/section; histories from their section/cohort.
- Produce mismatch reports before updates. Never overwrite a non-null conflicting value automatically; require an admin-reviewed repair script.
- Add a shared `AcademicCycleLifecycleService` with `assertSetupMutable`, `assertDeliveryMutable`, `assertCloseoutAllowed`, and `assertNotArchived` methods that accept a Prisma transaction client.
- Refactor active-cycle lookups: program-aware screens require `programId`; organization dashboards aggregate active cycles; legacy screens retain a documented null-program fallback during migration.
- Add lifecycle tests for concurrent activation per program, simultaneous active cycles in different programs, legacy activation, and every allowed/denied transition.

Reuse:

- Existing cycle service transaction style, Prisma transactions, pagination/report helpers, and `OrganizationActivityService.record`.
- Existing cycle list `DataTable`, status `Badge`, `ConfirmDialog`, `StatusBanner`, and global toast/processing state.

Gate: zero unexplained cycle mismatches; all current active-cycle screens behave unchanged; old and new clients see consistent active state.

## Phase 3: Programs, Curricula, and Program-Owned Cycles API

Objective: implement the structural domain behind feature flags.

Files/modules:

- Add `backend/src/programs/programs.module.ts`, controller, service, DTOs, and tests.
- Extend [backend/src/academic-cycles](backend/src/academic-cycles) to require and validate program ownership for new cycles; expose each program's nested academic-cycle listing without creating a separate join model.
- Register modules in [backend/src/app.module.ts](backend/src/app.module.ts).
- Add client methods to [frontend/lib/api.ts](frontend/lib/api.ts).

Steps:

- CRUD programs; activate/pause/archive with transition validation.
- CRUD curriculum versions, stages, requirements; activate/retire/freeze with transactional checks.
- Create/list academic cycles under a program. A new cycle stores `programId`; it is not linked to multiple programs.
- Enforce tenant, department scope, inactive department, duplicate code, frozen curriculum, course department/org, and lifecycle rules.
- Return paginated/filterable DTOs; do not leak raw unrestricted Prisma includes.
- Log create/update/status/activation/retirement and program-owned cycle actions.
- Prevent hard deletion after any dependent record exists.

Reuse:

- Backend code normalization, pagination/search, department-scope helpers, guards/decorators, activity logging, and Prisma transaction patterns.
- Frontend `api` request/error/upload helpers only; UI remains flagged off in this phase.

Gate: API integration tests cover cross-organization attacks, selected-department scope, concurrency, freeze rules, and legacy-null behavior.

## Phase 4: Programs Management UI

Objective: let authorized admins manage structure without touching live delivery.

Routes:

- `frontend/app/(org)/programs/page.tsx`
- `frontend/app/(org)/programs/create/page.tsx`
- `frontend/app/(org)/programs/[id]/page.tsx`
- `frontend/app/(org)/programs/[id]/edit/page.tsx`
- components under `frontend/components/programs/`

Steps:

- Build program list/detail/form, curriculum tabs, ordered stages, course requirements, admission visibility, and the program's academic-cycle list.
- Add Programs between Departments and Courses in [frontend/lib/orgSidebar.ts](frontend/lib/orgSidebar.ts).
- Add programs to [frontend/components/global-search/searchIndex.ts](frontend/components/global-search/searchIndex.ts).
- Extend `filterLookups.ts` and API types for remote program/curriculum/stage/cycle selectors.
- Show frozen/archived states and disable prohibited controls based on server capabilities, not duplicated client-only rules.

Reuse:

- `PageShell`, `PageHeader`, `PageTabs`, `ResourcePanel`, `ResourceToolbar`, `DataTable`, `PageControls`, `FilterDrawerGrid`, `RemoteFilterSelect`, `FormLayout` components, `CustomSelect`, `Toggle`, `Badge`, `StatusBanner`, `ConfirmDialog`, `EmptyState`, `ErrorState`, and skeletons.
- `useUrlQueryState`, `usePersistentPageSize`, `useDebounce`, SWR cache invalidation, existing department/course list patterns, and `useAccess`.

Gate: component/E2E flow creates department program -> curriculum with required cycle count -> stages -> requirements -> program-owned academic cycle; narrow/mobile layouts and unauthorized states are verified.

## Phase 5: Cohort and Section Mapping

Objective: connect curriculum expectations to actual cycle delivery.

Affected files include cohort/section DTOs and services, [frontend/components/cohorts/CohortFormPage.tsx](frontend/components/cohorts/CohortFormPage.tsx), and section create/edit pages.

Steps:

- The selected academic cycle determines the program. Add curriculum/stage selectors filtered to that program to cohort forms.
- Require `programCycleId` and `programStageId` together for new mappings.
- Add section requirement mappings; prefilter requirements by the section cycle's program, cohort stage, and course while retaining manual sections.
- Keep all mapping writes in the same transaction as cohort/section updates and auto-enrollment changes.
- Add `Legacy / Unclassified` badges and filters.
- Update copy-forward: require a target academic cycle belonging to the same program for program-aware copies. Copied sections remain unmapped by default, or map only when an identical compatible target requirement is explicitly selected. Never silently carry a source mapping or copy into another program.
- Replace unsafe section deletion as described in preparation.

Reuse:

- Existing cohort transaction/auto-enrollment helpers, `validateAcademicPlacement`, department scope, code normalization, room validation, and lifecycle service.
- `CohortFormPage`, section forms, `RemoteFilterSelect`, `CustomSelect`, `CustomMultiSelect`, `FormSection`, `StatusBanner`, `CourseSectionLabel`, and existing section color/room helpers.

Gate: tests cover mapped/unmapped cohorts, program-owned and legacy cycles, multiple cohorts per stage, cross-program/cycle rejection, copy-forward behavior, and unchanged legacy auto-enrollment.

## Phase 6: Student Program Enrollment and Progression

Objective: add durable program and stage history without replacing current placement fields.

Affected areas: student service/controller and DTOs, enrollment and reassignment services, student forms, enrollment page, profile overview, transcripts.

Steps:

- Assigning a student creates one durable `StudentProgramEnrollment` with the selected frozen curriculum version and `requiredCycleCountSnapshot`. This is the primary proof that the student belongs to the program.
- Add explicit admit, activate, hold, withdraw, transfer, complete, repeat, and skip commands. Do not expose generic arbitrary status patching.
- Create stage attempts when assigning a program-enrolled student to a compatible mapped cohort; require an explicit choice if no deterministic match exists.
- Link new cohort/manual enrollments and history rows to the selected stage attempt where valid.
- At the next semester/year, create a new `StudentStageAttempt` under the same `StudentProgramEnrollment`; never create a new program enrollment merely because the academic cycle changed.
- Completing or archiving a cycle closes/finalizes only that cycle's stage attempts. It must not set the parent program enrollment to `COMPLETED`.
- Compute progress as completed required stages/cycles versus `requiredCycleCountSnapshot`, with repeats retained but not double-counted. Optional/skipped stages follow the frozen curriculum completion rule.
- Transfer closes old program enrollment/stage attempt, preserves every old record, then opens the new program enrollment in one transaction.
- Stage completion stores a result snapshot and actor/reason; it does not recompute or move grades.
- Program completion validates the frozen curriculum requirements and required cycle count, writes a final result snapshot, and then closes the durable enrollment. Program metadata or newer curriculum versions are not consulted for that decision.
- Add optional program/stage context to transcript responses behind compatibility tests.

Reuse:

- Existing student soft-delete behavior, cohort membership history, enrollment history, reassignment transactions, notification service, transcript/GPA services, department scope, and activity logging.
- `StudentForm`, enrollment page controls, profile `Overview`, `PageTabs`, `Badge`, `StatusBanner`, `DataTable`, `ModalForm`, `ConfirmDialog`, remote selectors, and form components.

Gate: admission persists across at least two completed/archived cycles; admit/transfer/repeat/skip/withdraw/completion scenarios, concurrent assignment, selected-department scope, legacy students, and transcript before/after snapshots all pass.

## Phase 7: Archive Enforcement and Snapshot Generation

Objective: make academic archives genuinely immutable and verifiable.

Steps:

- Apply lifecycle checks to every mutation path in cohorts, sections, enrollments, reassignment, assessments/grades/submissions, attendance/schedules, materials/files, evaluations, preferences, imports, and copy-forward.
- Ensure nested/indirect writes call the shared lifecycle service inside the transaction immediately before mutation.
- Implement preflight, archive state machine, resumable snapshot builder, checksums, count verification, file locks, and activity logs.
- Replace section/assessment destructive endpoints with draft-empty hard delete or non-destructive close/archive.
- Update `FilesService.deleteFile` to reject locked files and add explicit answerbook/archive authorization branches.
- Keep `ARCHIVED` terminal; omit normal unarchive.
- Add operational commands/endpoints to inspect failed builds and retry safely.

Reuse:

- `AcademicCycleLifecycleService` from Phase 2, Prisma transactions, existing file hash metadata, `OrganizationActivityService`, pagination utilities, and current service ownership checks.
- Existing cycle page `DataTable`, `Badge`, `ConfirmDialog`, `StatusBanner`, loading state, and toast actions for archive progress/error UI.

Gate: a write-denial matrix proves every endpoint rejects `ARCHIVING/ARCHIVED`; source/snapshot counts and checksums match; file deletion is denied; failed archive retry is idempotent.

## Phase 8: Past Records API and Read-Only UI

Objective: expose archived snapshots through all requested navigation flows.

Backend:

- Add `backend/src/past-records/past-records.module.ts`, controller, service, DTOs, and tests.
- Add endpoints for filter options, section results, section detail, student search, section search, and cycle search.
- Query `currentArchiveId` and snapshot indexes only for archived cycles. Return `archiveRevision`, `schemaVersion`, and source mode.
- Apply role, guardian/student ownership, teacher assignment snapshot, and department scope on every query.

Frontend:

- Add `frontend/app/(org)/past-records/page.tsx` and section/student drill-down routes as needed.
- Refactor live section components into pure display panels and mutation wrappers. Archive pages consume snapshot DTOs through pure panels.
- Persist filters in URL; use server pagination and remote search; include `Legacy / Unclassified`.
- Add Past Records navigation and global-search entries.

Reuse:

- Backend pagination, normalized/fuzzy search, department scope, access guards, and transcript query patterns.
- `PageShell`, `PageHeader`, `PageTabs`, `ResourcePanel`, `ResourceToolbar`, `DataTable`, `PageControls`, `FilterDrawerGrid`, `RemoteFilterSelect`, `SearchBar`, `Pagination`, `Badge`, `StatusBanner`, `EmptyState`, `ErrorState`, and skeletons.
- Refactored pure panels from `AssessmentList`, `AttendanceSheet`, `SectionSchedules`, and `CourseMaterials`; `AttachmentPreviewCard` for retained files; `useUrlQueryState`, `usePersistentPageSize`, and `useDebounce`.

Gate: every requested flow works against snapshot data; no archive page sends mutations; direct student/section/cycle searches are paginated and scoped; performance is measured on production-like volumes.

## Phase 9: Answerbook Evidence at Grading

Objective: add optional reference numbers and PDF/image evidence safely.

Affected areas: Prisma schema from Phase 1, `UpdateGradeDto`, assessment service/routes in [backend/src/org/org.controller.ts](backend/src/org/org.controller.ts), file policy/service, grading forms, gradebook/assessment pages, types/API/Zod schemas.

Steps:

- Extend grade update DTO/response with optional normalized reference number.
- Add a grade-domain upload endpoint that first validates assessment, student enrollment, actor permission, grade/cycle state, file count, file type, and size.
- Save/update the grade first so a real grade ID exists; upload the file; create `GradeAnswerbookAttachment`; if the DB link fails, compensate by deleting the just-uploaded object or record it for cleanup.
- Add list/download/delete endpoints through grade authorization. Do not let callers create arbitrary `GRADE_ANSWERBOOK` generic targets.
- Teachers can manage evidence only where they can grade. Students/guardians can view only their linked student's evidence when the grade is `PUBLISHED` or `FINALIZED`. Org admins/managers follow existing grading authority and department scope.
- Finalized grades and `COMPLETED` cycles follow existing correction rules for the reference field; attachment replacement after finalization is denied in v1. `ARCHIVING/ARCHIVED` always deny changes.
- Keep bulk grading marks/status only. Evidence remains per-student in the individual grading flow to avoid ambiguous file-to-student mapping.
- Lock answerbook files during archive and include hashes/metadata in snapshots.

Reuse:

- Backend `FilesService`, `classifyAndValidateUpload`, grade permission/finalization checks, section teacher/enrollment access patterns, lifecycle service, and activity logging.
- `GradingForm`, `Input`, `Textarea`, `Button`, `Modal`, `Label`, `AttachmentPreviewCard`, global toast/processing state, `api.uploadFile` internals, upload-policy extension helpers, and attachment type helpers.

Gate: reference-only/file-only/both/neither, unsupported/oversize files, partial upload failure, unauthorized access, published visibility, finalization, archive lock, and cleanup behavior are tested.

## Phase 10: Admissions Hooks, Reporting, and Contract Cleanup

Objective: prepare stable program offerings and remove temporary compatibility only after adoption.

Steps:

- Expose an admission-safe program listing only when the online admissions workflow is built. Offerings reference `Program.id` and optionally a default `CurriculumVersion.id`; departments are filters, not the selected qualification.
- Update AI route/source files, reporting, dashboard counts, filter lookups, exports, docs, and global search.
- Add program/curriculum/stage columns to imports as optional; add dedicated imports only with preview/validation and row-level errors.
- Measure null mapping adoption. Keep legacy support indefinitely unless a separate migration project achieves verified full classification.
- Remove `AcademicCycle.isActive` only after repository-wide searches show no readers/writers, API consumers have migrated, and a separate contract migration is approved.
- Remove rollout switches after stable observation; do not drop archive or compatibility data in this project.

Reuse:

- Existing imports validation/preview in [backend/src/imports](backend/src/imports) and [frontend/components/imports](frontend/components/imports), CSV utilities, global search index, AI route sources, transcript PDF utilities, and common list/filter components.

Gate: admission output contains no internal/private fields; old import templates still pass; API compatibility tests pass; no cleanup migration removes user data.

## Authorization Matrix

- `ORG_ADMIN`: full program/curriculum/program-owned-cycle management, progression, archive, and past-record access within organization.
- `SUB_ADMIN`: same only within configured department scope and allowed role routes.
- `ORG_MANAGER`: read by default; progression approval/archive permission must be explicitly granted by existing product semantics before enabling writes.
- `TEACHER`: view program context and live/past records only for assigned sections; grade and answerbook actions follow assignment and lifecycle rules.
- `STUDENT`: view own active/history records and released answerbooks only.
- `GUARDIAN`: view linked student's permitted records and released answerbooks only.
- `FINANCE_MANAGER`: no academic structure/archive write access; no access unless an existing finance workflow needs a program label.
- Platform roles follow existing organization-access rules and every action remains audited.

Client-side hiding is convenience only. Controllers/services must enforce role, organization, department scope, ownership/assignment, and lifecycle independently.

## Migration, Deployment, and Rollback Runbook

1. Rehearse every migration on a recent sanitized production-size database and record duration, locks, row counts, and query plans.
2. Deploy additive schema first. Use concurrent/manual index creation where PostgreSQL table size makes normal index locks unsafe; document SQL outside Prisma-generated assumptions.
3. Deploy compatibility code that understands old and new fields while features remain disabled.
4. Run idempotent backfills in bounded batches with checkpoints; verify counts and mismatches after each batch.
5. Enable read paths for internal admins, then program writes for a pilot organization, then cohort/student mapping.
6. Enable lifecycle enforcement before allowing archive creation.
7. Archive one non-critical completed cycle; independently verify snapshot screens, checksums, files, transcripts, and direct searches.
8. Enable past records and answerbooks progressively while monitoring errors, latency, denied writes, snapshot failures, and storage growth.
9. Keep rollback at the application/feature-switch level. Additive tables/columns remain in place; do not reverse/drop them during an incident.
10. Never roll back by changing an `ARCHIVED` cycle to mutable. If archive code must be disabled, continue serving the ready snapshot read-only.

## Test Matrix and Release Gates

Required automated coverage:

- schema migration and backfill idempotency
- tenant and department-scope isolation for every new endpoint
- lifecycle transition concurrency and partial unique constraints
- legacy requests with no program fields
- cohort auto-enrollment/removal and reassignment history parity
- curriculum freeze and program transfer immutability
- section/assessment destructive-action protection
- every direct and indirect archived-cycle writer
- archive count/checksum/file verification and retry
- snapshot schema-version rendering
- transcript/GPA parity before and after program links
- answerbook upload/access/delete/finalize/archive behavior
- all requested past-record search/filter flows

Required release evidence per phase:

- backend unit/integration tests pass
- backend and frontend builds pass
- migration rehearsal report is attached
- API contract diff is reviewed
- representative desktop/mobile UI is manually verified
- activity logs contain actor/resource/reason for sensitive transitions
- rollback switch/path is demonstrated before production enablement

## Observability and Audit Events

Record at least: `program_created`, `program_status_changed`, `curriculum_activated`, `curriculum_retired`, `program_academic_cycle_created`, `cohort_program_mapped`, `student_program_admitted`, `student_program_transferred`, `stage_attempt_changed`, `student_program_completed`, `cycle_completed`, `cycle_archive_started`, `cycle_archive_failed`, `cycle_archived`, `answerbook_reference_changed`, `answerbook_uploaded`, and `answerbook_deleted`.

Metrics/logs must include archive duration, rows/files snapshotted, checksum failures, lifecycle write denials by endpoint, unmapped cohort/section counts, answerbook upload failures/orphans, past-record query latency, and snapshot schema versions in use. Never log answerbook contents or sensitive student payloads.

## Explicitly Deferred

- full online admissions/application workflow
- multiple simultaneous active program enrollments, double majors, minors, concentrations
- automated prerequisites, equivalency, transfer-credit, degree audit, or graduation audit
- CLO/PLO/OBE/accreditation management
- cross-institution transfer automation
- archived-record mutation or ordinary unarchive
- automatic historical program inference from names, majors, departments, cohorts, or courses
- destructive removal of legacy compatibility fields/data

## Final Definition of Done

The initiative is complete only when department-owned programs and their academic cycles are usable; a student's durable program enrollment demonstrably survives each semester/year until program completion; legacy flows remain compatible; archived cycles are verified immutable snapshots with retained files; all requested past-record paths work; answerbook evidence is optional and correctly authorized; migrations and retries are idempotent; destructive history loss is prevented; audits and metrics are present; and every phase gate above has documented evidence.
