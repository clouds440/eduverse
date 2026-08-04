# Phase-Based Programs Implementation Plan

Source brief: [programs-implementation.md](programs-implementation.md)

## Purpose and Delivery Rule

This document is the implementation contract for adding department-owned programs, program-specific academic delivery, durable student progression, immutable academic-cycle archives, past-record browsing, future online-admission offerings, and optional answerbook evidence during grading.

This is a high-risk domain change because cycles, cohorts, sections, enrollments, histories, grading, attendance, files, and transcripts are tightly connected. The project is still pre-production and existing development data may be wiped, so implementation uses a clean-slate schema contract rather than compatibility columns, dual writes, or data backfills. Each phase must still pass its dependency gate before the next phase starts.

Programs remain an optional product feature. Every cohort and section must explicitly be `STANDALONE` or `PROGRAM_MAPPED`; optional programs do not imply support for ambiguous records.

## Critical Architecture Decisions

The following corrections are required before implementation starts:

1. `Program` and `AcademicCycle` remain independent organization entities. Add `ProgramAcademicCycle` as the explicit many-to-many association. Do not add `programId`, program sequence, or program lifecycle fields to `AcademicCycle`.
2. A status flag alone cannot guarantee that archives remain "exactly as is." Student names, course names, teachers, rooms, departments, programs, files, and other referenced rows can change. A verified archive snapshot and file-retention lock are required.
3. Archived cycles must be strictly read-only in v1. Do not add a normal unarchive or archived-grade correction endpoint. A future break-glass correction design may create a new archive revision, but it must never overwrite the original revision.
4. Current hard deletes of sections and assessments can cascade through historical records. Before archive rollout, destructive endpoints must be limited to empty draft data; records with delivery activity must be closed/archived instead.
5. Answerbook evidence must use a typed relation to `Grade`. The generic `File.entityType/entityId` fields alone do not provide referential integrity, lifecycle protection, or student/guardian visibility rules.
6. Redundant nullable `academicCycleId` fields must become required where the parent deterministically identifies the cycle, or be removed when they add no query value. All create/update paths must write and validate the final contract from day one; no data backfill is required.
7. `Program.requiredCycleCount` belongs to the program and is server-derived from its ordered, non-retired `ProgramAcademicCycle` associations. Do not keep an independently editable count that can disagree with the relationship array.
8. A numeric cycle-count snapshot is not enough for student continuity. Assignment must copy the exact relationship IDs, shared cycle IDs, sequence, and required flags into `StudentProgramEnrollmentCycle` rows so later program edits affect future assignments only.
9. A program is not assignable merely because cycle relationships exist. Its active curriculum version must target the same immutable program configuration revision, map exactly one `ProgramStage` to every required `ProgramAcademicCycle`, and define that stage's course requirements.

## Target Architecture

```text
Department
  -> Program
     -> requiredCycleCount
     -> ProgramAcademicCycle[] (ordered relationship array)
        -> AcademicCycle (shared institute entity)
     -> CurriculumVersion
        -> ProgramStage -> exact ProgramAcademicCycle
           -> StageCourseRequirement

AcademicCycle
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
     -> StudentProgramEnrollmentCycle[] (immutable assigned cycle plan)
     -> StudentStageAttempt
        -> StudentProgramEnrollmentCycle + ProgramStage + optional Cohort
```

`Program` is the long-lived, hard-defined course offering. `AcademicCycle` is the institute-wide dated semester/year, such as `Fall 2026`. `ProgramAcademicCycle` says that a program uses that shared cycle and gives the relationship its program-specific order. `StudentProgramEnrollment` is the long-lived student assignment and survives completion/archive of each shared cycle until all required program stages are completed, or the student transfers or withdraws.

The archive boundary remains one institute `AcademicCycle`. Archiving `Fall 2026` freezes all delivery in that cycle, including every program association that uses it and all standalone/non-program sections, while leaving the independent program definitions available for future cycles.

## Non-Negotiable Invariants

- Every new row is organization-scoped, and every relation is validated to belong to the same organization.
- A `Program` belongs to exactly one `Department`; a department can own many programs.
- `Program` and `AcademicCycle` have no ownership foreign key between them; both can exist without the other.
- A cycle can be associated with zero, one, or many programs, and a program can use many cycles.
- The same `(organizationId, academicCycleId)` record is reused across programs; never duplicate `Fall 2026` per program.
- The program's current required cycle count always equals the number of ordered, non-retired required `ProgramAcademicCycle` rows.
- Program identity, status, and course configuration never derive from a cycle's lifecycle status. Completing/archiving a shared cycle does not pause, archive, or otherwise mutate any associated program.
- A cycle with no program associations remains fully valid for standalone courses, sections, and organizations that do not use programs.
- A mapped cohort's stage and program-cycle association must point to the cohort's same institute cycle.
- Completing or archiving one academic cycle never closes `StudentProgramEnrollment`.
- A student's program enrollment remains tied to the curriculum version and exact ordered cycle-plan snapshot selected at admission, even when the program is edited later.
- An active curriculum version is the hard definition of the program's offered courses, their required/optional status, and their stage/cycle placement. Editing that course structure for future students requires a new curriculum version.
- `Program` cannot become active/visible for admission or be assigned to a student until one eligible curriculum version covers every current required cycle exactly once and each cycle has its hard-defined course requirements.
- A section remains valid without a program mapping. Explicit standalone/manual delivery is a supported state, not an error.
- Every cohort and section has an explicit `STANDALONE` or `PROGRAM_MAPPED` classification; `UNCLASSIFIED` is not a valid state in the clean schema.
- Section enrollment and existing history tables remain the authoritative evidence of delivered teaching; curriculum models describe expected study.
- Program/curriculum edits never rewrite previous enrollment, grade, transcript, or archive facts.
- `ARCHIVED` is terminal through normal product APIs and all archived data is read-only.
- Archive views render the verified snapshot revision, not mutable live labels.
- Answerbook reference and attachments are optional and are attached to a per-student `Grade`, not to the whole `Assessment`.
- Program-optional API requests must explicitly choose `STANDALONE`; omitted classification/program fields are validation errors on the new contract.
- Every status transition, archive operation, curriculum activation, progression action, and answerbook mutation is auditable.

## Confirmed Current Architecture and Risks

Confirmed in [backend/prisma/schema.prisma](backend/prisma/schema.prisma):

- `Department` owns courses and staff/student scope, but has no programs.
- `AcademicCycle` is currently organization-wide and uses `isActive`; this institute-wide ownership and existing cycle identity are retained.
- `Cohort` requires `academicCycleId`, owns current students/sections, and is deactivated through `isActive`.
- `Section` requires one course and one cycle, can belong to one cohort, and owns most delivery data.
- `Enrollment`, `Assessment`, `Grade`, `Submission`, `SectionSchedule`, `AttendanceSession`, and `CourseMaterial` have nullable cycle links even though their parent normally identifies the cycle.
- `EnrollmentHistory` and `CohortMembershipHistory` preserve movement history, but parent hard deletes can still cascade.
- `Student.cohortId`, `Student.major`, `Student.department`, `primaryDepartmentId`, and `studentDepartments` currently mix placement concepts and do not provide durable program enrollment.
- `Grade` already has draft/published/finalized status and correction metadata.
- `File` is a generic polymorphic record with no database relation to its target and can be physically deleted from storage.
- `OrganizationActivityLog` and `OrganizationActivityService` already support organization audit events.

Confirmed service behavior and affected paths:

- [backend/src/cohorts/cohorts.service.ts](backend/src/cohorts/cohorts.service.ts) assigns students, sections, current cohort pointers, cohort history, and cohort-sourced enrollments.
- [backend/src/reassignment/reassignment.service.ts](backend/src/reassignment/reassignment.service.ts) changes current placement while retaining existing academic history.
- [backend/src/academic-cycles/academic-cycles.service.ts](backend/src/academic-cycles/academic-cycles.service.ts) enforces one active cycle per organization in application code and currently treats deactivation as archive-like. Preserve the one-active-institute-cycle contract while introducing the explicit lifecycle/archive statuses.
- [backend/src/sections/sections.service.ts](backend/src/sections/sections.service.ts) hard-deletes sections; cascading relations make this unsafe after delivery activity exists.
- [backend/src/assessments/assessments.service.ts](backend/src/assessments/assessments.service.ts) hard-deletes assessments and upserts grades.
- [backend/src/attendance/attendance.service.ts](backend/src/attendance/attendance.service.ts) mutates schedules, sessions, and attendance records.
- [backend/src/course-materials/course-materials.service.ts](backend/src/course-materials/course-materials.service.ts) mutates materials and retargets generic file rows.
- [backend/src/preference-windows/preference-windows.service.ts](backend/src/preference-windows/preference-windows.service.ts) and [backend/src/evaluations/evaluations.service.ts](backend/src/evaluations/evaluations.service.ts) write cycle-scoped data that must also obey archive locks.
- [backend/src/copy-forward/copy-forward.service.ts](backend/src/copy-forward/copy-forward.service.ts) copies sections, schedules, and materials but deliberately excludes student results.
- [backend/src/transcripts/transcripts.service.ts](backend/src/transcripts/transcripts.service.ts) derives transcripts from histories, finalized grades, attendance, cohort history, and GPA policy snapshots.
- [backend/src/files/files.service.ts](backend/src/files/files.service.ts) has entity-specific access checks, but no `GRADE_ANSWERBOOK` policy or retention lock.
- The repository currently has student admission dates but no public online-application/program-offering domain. This plan therefore adds a stable admission-safe program-offering contract without pretending an application workflow already exists.

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

- Do not add `programId`, program sequence, association retirement, curriculum, or program status fields to `AcademicCycle`.
- Keep institute-wide unique code and one active cycle per organization. `Fall 2026` remains one reusable record.
- Keep standalone cycle creation unchanged in principle: a cycle may be created, activated, and used without any program association.
- Add lifecycle enum `DRAFT`, `ACTIVE`, `COMPLETED`, `ARCHIVING`, `ARCHIVED`.
- Add required `status`, plus `completedAt`, `completedById`, `archivedAt`, `archivedById`, `archiveReason`, and optional `currentArchiveId`.
- Remove `isActive` and update all callers to use lifecycle status in the same phase; do not implement dual writes.
- Add a PostgreSQL partial unique index for one `ACTIVE` cycle per organization so concurrent requests cannot violate the current institute-wide rule.
- Enforce transitions: `DRAFT -> ACTIVE -> COMPLETED -> ARCHIVING -> ARCHIVED`. Allow `DRAFT <-> ACTIVE` only while no completed delivery rule is violated; do not allow normal transitions out of `ARCHIVED`.
- `COMPLETED` permits only explicitly listed closeout operations such as grade publication/finalization. Everything else is denied.
- `ARCHIVING` immediately freezes writes while snapshot generation and verification run.
- `ARCHIVED` serves the verified snapshot only.
- Program screens filter cycles through `ProgramAcademicCycle`; institute cycle screens continue listing all cycles regardless of program use.
- Do not hard-delete a cycle referenced by program associations, student cycle-plan snapshots, archive revisions, or delivery data. Removing a cycle from one program retires only that association and never changes/deletes the shared cycle.

### Cohort

- Keep required `academicCycleId`. Replace `isActive` with required lifecycle status `ACTIVE`, `CLOSED`, or `ARCHIVED`.
- Add required `programClassificationStatus`: `STANDALONE`, `PROGRAM_MAPPED`, plus nullable `programAcademicCycleId` and `programStageId`.
- Do not add a redundant `curriculumVersionId`; derive it from `programStage`.
- Require both mapping fields for `PROGRAM_MAPPED` and both null for `STANDALONE`; reject omitted classification.
- Validate that `programAcademicCycle.academicCycleId = cohort.academicCycleId`, the stage belongs to that association/program/configuration, and all rows share organization/department scope.
- Do not infer mappings from cohort names/codes.
- Closing a cohort does not close the program or cycle and never deletes history.

### Section

- Keep `courseId`, `academicCycleId`, and optional `cohortId`.
- Add required `programClassificationStatus`: `STANDALONE`, `PROGRAM_MAPPED`; require an explicit choice on every create/import.
- Prefer a `SectionRequirementMapping` join over one requirement foreign key. This allows one delivered section to satisfy multiple valid requirements when manual/cross-program enrollment is used.
- Each mapping links `sectionId`, `stageCourseRequirementId`, and `programAcademicCycleId`; validate section cycle equals the association cycle and requirement course/stage/program all match.
- `PROGRAM_MAPPED` requires a compatible mapped cohort or at least one requirement mapping; `STANDALONE` requires no program mappings.
- Add a non-destructive section lifecycle (`ACTIVE`, `CLOSED`, `ARCHIVED`) or equivalent fields before archive rollout.
- Permit hard deletion only when the cycle is `DRAFT` and the section has no enrollments/history, assessments/grades/submissions, attendance, materials, evaluations, preferences, or archive reference.
- Replace all other delete actions with close/archive behavior.

### Enrollment and History

- Keep `Enrollment` as delivered enrollment truth.
- Make `academicCycleId` required on `Enrollment` and `EnrollmentHistory`. Add nullable `studentProgramEnrollmentId` and `studentStageAttemptId`; they are null only for explicitly standalone delivery.
- Ensure a linked stage attempt belongs to the same student, program, cycle, and compatible stage as the section mapping.
- Preserve the current `[studentId, sectionId]` uniqueness contract.
- Never delete `EnrollmentHistory` or `CohortMembershipHistory` during program transfer.

### Student

- Keep `Student.cohortId` as the current operational placement pointer.
- Add `StudentProgramEnrollment[]` and `StudentProgramEnrollmentCycle[]`. Remove `Student.major` and the free-text `Student.department` from the schema, DTOs, forms, imports, reports, and profiles. `StudentProgramEnrollment` becomes the qualification/program truth and the open enrollment is displayed as the student's major; while it exists, `primaryDepartmentId` is derived from that program's department and cannot conflict with it. Additional department relations remain independent organizational scope.
- A transfer closes the previous enrollment and creates a new record; it never changes the previous program/curriculum identity.
- Program edits never add, remove, reorder, or replace the cycle-plan rows already copied to a student's enrollment.
- Existing student soft deletion must preserve program enrollment, stage attempts, grades, and archive-search identity.
- Snapshot student name, registration number, roll number, and relevant status at archive time so later profile edits do not alter past records.

### Assessments, Grades, and Submissions

- Keep assessments section-scoped and grades per assessment/student.
- Make `academicCycleId` required on assessments, grades, and submissions; write it from the validated section/assessment context and reject mismatches transactionally.
- Add non-destructive assessment retirement/archive behavior once grades or submissions exist.
- Block hard deletion after delivery activity or in `COMPLETED`, `ARCHIVING`, or `ARCHIVED` cycles.
- Add `Grade.answerbookReferenceNumber String?` with trim and maximum-length validation.
- Add `GradeAnswerbookAttachment` as a typed join to `Grade` and `File`; do not rely only on generic entity strings.
- Add answerbook file access, deletion, and retention rules to `FilesService`.
- Snapshot assessment definitions, all grade fields/finalization metadata, submissions, answerbook references, and locked attachment metadata during cycle archive.

### Schedules, Attendance, Materials, Evaluations, Preferences, and Events

- Make deterministic cycle links required on section schedules, attendance sessions, and course materials. Keep already-required cycle links on evaluations/windows/preferences and validate every link against its section/schedule parent.
- Apply the centralized cycle lifecycle check to schedule create/update/delete, attendance session/record writes, material create/update/delete, evaluation windows/evaluations, and preference windows/submissions.
- Reject missing or mismatched cycle IDs at the write boundary; there is no backfill path.
- Snapshot teacher/room display data because those shared entities remain mutable.
- Include academic events overlapping the cycle date range and applicable departments in the archive snapshot; events are not cycle-owned, so only their snapshot is historical.
- Do not copy assessments, grades, submissions, attendance, evaluations, or preferences through copy-forward.

### Transcripts, GPA, Reports, Search, AI, and Imports

- Preserve transcript/GPA calculation behavior through characterization tests while replacing the API contract directly.
- Add program/curriculum/stage labels as optional transcript context; archived transcript rendering must use snapshot values.
- Extend imports only after APIs exist: programs, program-to-cycle associations/order, curricula/stages/requirements, cohort mapping, student program enrollments, and answerbook references.
- Replace import templates/contracts directly: every cohort/section import must provide standalone or program mapping fields; student imports use program enrollment fields instead of `major`/free-text department.
- Add programs and their shared-cycle relationships to global search, filter lookups, AI route context, and reporting only after tenant and authorization tests pass.

## New Domain Models

### Program

Fields:

- `id`, `organizationId`, `departmentId`, `name`, `code`, `description`
- `status`: `DRAFT`, `ACTIVE`, `PAUSED`, `TEACH_OUT`, `ARCHIVED`
- `requiredCycleCount Int`
- `configurationVersion Int @default(1)`
- `structureType`: `GRADE_BASED`, `TERM_BASED`, `CREDIT_BASED`, `LEVEL_BASED`, `CUSTOM`
- `progressionMode`: `SEQUENTIAL`, `CREDIT_ACCUMULATION`, `FLEXIBLE`, `MANUAL`
- `completionMode`: `FINAL_STAGE`, `REQUIREMENTS`, `CREDITS`, `MANUAL`
- optional `durationValue`, `durationUnit`
- admission metadata: `isVisibleForAdmissions`, `admissionsLabel`, `admissionsDescription`, `admissionsSortOrder`
- `createdAt`, `updatedAt`, `archivedAt`, `archivedById`, `archiveReason`

Constraints: unique organization code; required same-organization department. `requiredCycleCount` is written by the service from the number of ordered active required `ProgramAcademicCycle` rows and cannot be patched independently. Structural relationship-array changes increment `configurationVersion`. Teach-out blocks new admissions/curriculum starts but allows already enrolled students to finish. Program archive preserves its last relationship array and derived count exactly; program status blocks future use and never archives/deletes the shared institute cycles.

Lifecycle safety: if admitted/active/on-hold student program enrollments remain, `ARCHIVED` is rejected and the admin must use `TEACH_OUT`; pausing or archiving a program never changes institute-cycle status or automatically retires its relationship rows. Structural edits are rejected after program archive. Hard delete is permitted only for an unused draft whose program-owned dependents can be removed without historical loss; it never deletes an independent `AcademicCycle`.

Admission safety: `isVisibleForAdmissions` can be true only for an `ACTIVE` program with a frozen active default admissions curriculum matching its current configuration revision. Public output must never expose internal notes, audit fields, retired associations, or unrestricted organization data.

### ProgramAcademicCycle

Meaning: ordered, program-specific use of one independent institute academic cycle.

Fields: `id`, `organizationId`, `programId`, `academicCycleId`, `sequence`, `isRequired` (true in v1), status `ACTIVE/RETIRED`, `retiredAt`, `retiredById`, timestamps.

Constraints and rules:

- `@@unique([programId, academicCycleId])`: a program uses the same shared cycle at most once; another program may use it through its own row.
- Add a PostgreSQL partial unique index for active `(programId, sequence)` values.
- Both parents must belong to the same organization. The cycle lifecycle remains independent.
- Use restrictive deletes. Once referenced by curriculum, student plan, delivery, or archive data, retire the association instead of deleting it.
- Re-adding a previously retired program/cycle pair reactivates the same association only when policy allows; it never creates a duplicate relationship row.

### ProgramConfigurationRevision

Meaning: immutable evidence of each saved ordered cycle-array configuration.

Fields: `id`, `organizationId`, `programId`, `version`, `requiredCycleCount`, `cyclesSnapshot Json`, `checksum`, `changeReason`, `createdById`, `createdAt`.

Rules: unique program/version; revision 1 is created with the program; every structural relationship-array update creates the next revision in the same transaction; revisions are append-only and never edited/deleted. The snapshot stores `ProgramAcademicCycle` IDs, shared cycle IDs, sequence, name/code, dates, and relationship retirement state as they were for that version.

### CurriculumVersion

Fields:

- `id`, `organizationId`, `programId`, `programConfigurationRevisionId`, `name`, `code`
- `effectiveFrom`, `effectiveTo`
- `status`: `DRAFT`, `ACTIVE`, `RETIRED`, `ARCHIVED`
- optional cycle/stage terminology used by the UI
- `isDefaultForAdmissions`, `policySnapshot`
- `activatedAt`, `retiredAt`, timestamps

Rules: multiple active versions may serve different batches; use a partial unique index for one admissions default per program; every version targets one immutable program configuration revision; course/stage structure freezes after a student enrollment or delivered mapping references the version. Program course-offering changes create a new curriculum version for future students and never alter the version held by existing students.

### ProgramStage

Fields: `id`, `organizationId`, `curriculumVersionId`, `programAcademicCycleId`, `name`, `code`, `sequence`, optional `stageType`, `isOptional`, `minCredits`, `expectedCredits`, `completionRule`.

Constraints: unique code, sequence, and program-cycle association within a curriculum version; the association must belong to the same program and appear in the targeted configuration revision; sequence changes are blocked after the version is frozen. Required stages must map one-to-one, in the same order, with the revision's relationship array before curriculum activation. Each required stage must define at least one course requirement before the program is assignable.

### StageCourseRequirement

Fields: `id`, `organizationId`, `programStageId`, `courseId`, `requirementType`, optional `groupKey`, `minCourses`, `minCredits`, `sortOrder`, `creditHoursSnapshot`, `notes`.

Rules: use `REQUIRED`, `ELECTIVE`, or `OPTIONAL`; validate elective group rules; keep extra/manual delivered courses valid and label them outside the curriculum plan.

### SectionRequirementMapping

Fields: `id`, `organizationId`, `sectionId`, `stageCourseRequirementId`, `programAcademicCycleId`, timestamps.

Rules: unique section/requirement/program-association tuple; section course equals requirement course; `section.academicCycleId` equals the association's cycle; the requirement stage uses that association; mapping is immutable after cycle archive. Sections with no mapping remain valid standalone delivery.

### StudentProgramEnrollment

Fields:

- `id`, `organizationId`, `studentId`, `programId`, `curriculumVersionId`, `programConfigurationRevisionId`
- status `ADMITTED`, `ACTIVE`, `ON_HOLD`, `TRANSFERRED_OUT`, `WITHDRAWN`, `COMPLETED`, `ARCHIVED`
- required `requiredCycleCountSnapshot`, `programConfigurationVersionSnapshot`, `programCyclePlanSnapshotHash`
- optional `entryProgramAcademicCycleId`, `entryAcademicCycleId`, `entryStageSequence`, `admittedAt`, `startedAt`, `endedAt`, `exitReason`, `metadata`

Rules: program and curriculum version must match; v1 allows at most one open (`ADMITTED`, `ACTIVE`, or `ON_HOLD`) program enrollment per student through a PostgreSQL partial unique index; prior closed records are immutable except audited status closure. This row remains open across semester/year boundaries. `requiredCycleCountSnapshot` is copied from `Program.requiredCycleCount`, and the hash covers the ordered child snapshot rows. Completed-cycle count is derived from completed required child rows rather than maintained as a drift-prone counter. Public online applications remain a separate future domain and do not create this row until an application is accepted.

### StudentProgramEnrollmentCycle

Meaning: the immutable ordered copy of one required program cycle made when a student is assigned to a program.

Fields: `id`, `organizationId`, `studentProgramEnrollmentId`, `programAcademicCycleId`, `academicCycleId`, `programStageId`, `sequenceSnapshot`, `isRequiredSnapshot` (always true in v1), `cycleNameSnapshot`, `cycleCodeSnapshot`, `cycleStartDateSnapshot`, `cycleEndDateSnapshot`, `stageNameSnapshot`, `stageCodeSnapshot`, status `PLANNED/IN_PROGRESS/COMPLETED/FAILED/SKIPPED/WITHDRAWN`, optional `cohortId`, `reason`, `startedAt`, `completedAt`, `resultSnapshot`, timestamps.

Rules: create exactly one row for every active required association in the program's current ordered relationship array in the same transaction as `StudentProgramEnrollment`; unique enrollment/association, enrollment/shared-cycle, and enrollment/sequence; count must equal `requiredCycleCountSnapshot`; rows are never added, removed, or reordered by later program edits. A skipped/credited prior cycle requires an explicit reason and policy authorization.

### StudentStageAttempt

Fields: `id`, `organizationId`, `studentProgramEnrollmentId`, `studentProgramEnrollmentCycleId`, `programStageId`, optional `cohortId`, `attemptNumber`, status, reason, `startedAt`, `completedAt`, `resultSnapshot`.

Rules: each semester/year participation creates an attempt under its snapshotted student cycle row and the same durable program enrollment; repeating creates a new attempt number; stage/program/curriculum/cycle must match; skip/transfer/withdraw statuses require a reason; historical attempts are never moved. Completing/archiving the linked academic cycle does not complete the durable program enrollment.

## Program Creation and Expanding Cycle Array Contract

The program creation form does not ask the user to type an independent cycle count. The cycle array starts empty; the `+` icon appends a row. The form displays `Required cycles: N`, where `N` is the current number of valid rows, and cannot be submitted while `N = 0`.

Each array row has an explicit mode:

- `EXISTING`: select one same-organization cycle. It may already be associated with other programs; it cannot already be selected/active in this program's array. Normal creation excludes `ARCHIVING/ARCHIVED` cycles.
- `NEW`: enter the institute cycle's name, code, and start/end dates inline; the backend creates one independent `AcademicCycle` as `DRAFT`, then creates this program's association to it.

The `+` icon appends the next row and assigns its provisional sequence. A remove icon removes an unsaved row. Reordering, if enabled, updates visible sequence numbers. The submit button is disabled until at least one row is valid, every row has exactly one source, no existing cycle is selected twice, codes/dates are valid, and cycle dates do not violate the chosen program policy.

API contract:

```text
CreateProgramDto
  program fields
  cycles: Array<
    { mode: EXISTING, academicCycleId }
    | { mode: NEW, name, code, startDate, endDate }
  >

UpdateProgramCyclesDto
  expectedConfigurationVersion
  changeReason
  cycles: same ordered discriminated array plus persisted ProgramAcademicCycle identifiers
```

Backend rules:

1. Require at least one cycle row and preserve request order as `ProgramAcademicCycle.sequence = index + 1`.
2. Ignore/reject a client-written `requiredCycleCount`; derive it from the validated array length.
3. Validate department, program code, all existing cycle IDs, new cycle fields, same-organization ownership, duplicate selections/codes, lifecycle eligibility, and date/order policy before mutation. Do not reject an existing cycle merely because another program uses it.
4. In one database transaction, create the program, create any new institute cycles, create ordered `ProgramAcademicCycle` rows for existing/new cycles, persist the derived count, append configuration revision 1, create an initial draft curriculum version targeting revision 1, and scaffold one draft stage per relationship. If any step fails, roll back the program, new cycles, relationships, and curriculum.
5. Use a serializable transaction or optimistic `configurationVersion` check with retry so concurrent edits cannot duplicate this program/cycle pair or overwrite relationship order. Independent programs may concurrently associate the same existing cycle.
6. Create nested new institute cycles as `DRAFT`. Existing `DRAFT`, `ACTIVE`, or `COMPLETED` cycles may be selected when policy/date order permits. Reject new associations to `ARCHIVING/ARCHIVED` cycles in v1; associations that existed before archive remain valid historical facts.
7. Return the complete ordered relationship array, embedded shared cycle summaries, and derived count so the client replaces optimistic state with server truth.
8. Keep the program `DRAFT` until every scaffolded stage has its hard-defined course requirements and the curriculum passes activation validation.
9. For `SEQUENTIAL` programs, require association order to follow increasing cycle start date and reject the same cycle twice; do not reject overlapping institute cycles solely because dates overlap. `FLEXIBLE`/`MANUAL` programs retain explicit order, but still require a unique cycle per program.
10. Authorize each row by mode: associating an existing cycle requires program write access in the selected department, while inline `NEW` additionally requires institute-wide academic-cycle creation permission. Never let a department-scoped program permission implicitly grant global cycle creation.

Program relationship-array edits use a dedicated command rather than the generic metadata patch. Relationships may be added or reordered transactionally for future assignments. Removing a relationship retires `ProgramAcademicCycle`; it never edits, retires, or deletes the independent institute cycle used by other programs/standalone sections. Existing student snapshots do not change. Every structural edit increments `configurationVersion`, recalculates `requiredCycleCount`, appends an immutable `ProgramConfigurationRevision`, creates/scaffolds a new draft curriculum version for that revision (without mutating the previous version), and is audited. New student assignment remains blocked until the new curriculum is complete and activated.

Frontend implementation:

- Add a reusable `ProgramCycleArrayEditor` under `frontend/components/programs/` and use it on create/edit forms.
- Extract the name/code/date inputs and validation shared with [frontend/app/(org)/academic-cycles/create/page.tsx](<frontend/app/(org)/academic-cycles/create/page.tsx>) into an `AcademicCycleFields` component so inline-new rows and standalone cycle creation do not diverge.
- Reuse `react-hook-form` and its `useFieldArray` API, already available through the current dependency; do not hand-maintain parallel field/error arrays.
- Use the Lucide `Plus` icon for append and familiar icon buttons for remove/reorder with tooltips.
- Reuse `RemoteFilterSelect` for institute cycles, showing lifecycle and existing program-use metadata; use `Input` for new-cycle values, `CustomSelect` or a segmented control for row mode, `FormField/FormGrid/FormSection`, `StatusBanner`, `ConfirmDialog`, and existing cycle Zod/date validation patterns.
- Keep rows as an unframed form list; show row-level server validation and focus the newly appended/first invalid row.

## Program Change and Student Multi-Cycle Contract

Program changes follow this rule:

- Program identity/marketing metadata may be edited with audit logging.
- The current ordered `ProgramAcademicCycle` relationship array and its derived required count belong to `Program`; the independent cycles remain institute entities. The hard course offering, stage order, credit rules, and completion rules belong to `CurriculumVersion`.
- Once a curriculum version is referenced by a student program enrollment, cohort, section mapping, or delivered result, it is frozen.
- To change courses/stages, clone the current curriculum version into a new draft, edit it, validate it against the program's current ordered relationship array, activate it, and optionally make it the default for future students.
- To change which shared cycles the program uses or their order, use the dedicated version-checked relationship command above. Recalculate the program count and create/align a curriculum version for future assignments; do not mutate the cycles themselves.
- Existing students stay linked to their original curriculum version, immutable `ProgramConfigurationRevision`, `requiredCycleCountSnapshot`, and child cycle-plan rows. They are not silently upgraded when the program changes.

Student assignment and progression use this exact flow:

1. Select student, program, active curriculum version, entry sequence/stage, and optional entry cohort.
2. In a serializable/version-checked transaction, lock/read the program's current ordered active required `ProgramAcademicCycle` rows and verify their count equals `Program.requiredCycleCount` and their stages align with the selected curriculum.
3. Create `StudentProgramEnrollment(status = ADMITTED)` linked to the current immutable configuration revision, with the program configuration version, required count, and ordered-plan hash. Reject a second open enrollment in v1.
4. Create one immutable `StudentProgramEnrollmentCycle` for every ordered program-cycle association, copying both association and shared cycle identity. Verify the inserted child count/hash before commit.
5. Mark rows before an approved mid-program entry as skipped/credited only with explicit reason and policy authorization; otherwise entry starts at sequence 1.
6. Activation is a separate command. It requires the snapshotted entry cycle to be the organization's `ACTIVE` cycle and any selected cohort to map to the same association/stage; then set the enrollment/entry row to `ACTIVE`/`IN_PROGRESS`, create the first `StudentStageAttempt`, update the operational `Student.cohortId` pointer if applicable, and create/link section enrollments and history in one transaction.
7. When that semester/year ends, complete/fail/repeat the attempt and update only its `StudentProgramEnrollmentCycle`. Leave the parent `StudentProgramEnrollment` status unchanged.
8. Start the next snapshotted cycle by sequence only when that exact shared cycle is institute `ACTIVE`; keep the same program enrollment and move only current cohort/enrollment pointers through existing reassignment/history logic.
9. Repeated attempts remain separate and do not double-count the parent cycle row. Skipped/credited rows count only if the frozen completion policy permits it.
10. Mark the program enrollment `COMPLETED` only after the required snapshotted child rows and frozen course requirements are satisfied, or through an audited manual completion allowed by the frozen policy.
11. Transfer or withdrawal closes the durable enrollment with reason/date and preserves every cycle snapshot, attempt, section enrollment, grade, attendance record, transcript fact, and archive snapshot.

Cycle status transitions must never cascade into `StudentProgramEnrollment.status`. Program progression is an explicit student-domain operation, not a side effect of cycle completion/archive.

### GradeAnswerbookAttachment

Fields: `id`, `organizationId`, `gradeId`, `fileId`, `uploadedById`, `createdAt`.

Rules: unique `fileId`; the linked `File` uses `entityType = GRADE_ANSWERBOOK` and `entityId = grade.id`; only PDF/JPG/JPEG/PNG/WEBP; deletion goes through the grading domain and is blocked for finalized grades and frozen cycles unless a future audited policy explicitly permits it.

### AcademicCycleArchive and Snapshot Indexes

`AcademicCycleArchive` fields: `id`, `organizationId`, `academicCycleId`, `revision`, status `BUILDING/READY/FAILED`, `schemaVersion`, `cutoffAt`, `createdById`, `createdAt`, `completedAt`, `failureReason`, `manifest`, `recordCounts`, `checksum`.

`AcademicCycleArchiveSection` fields: archive ID, source section ID, source department/cohort/course IDs, snapshotted classification status, denormalized search labels, section checksum, and immutable JSON payload. Do not put a single authoritative `programId` on this row because one section can satisfy multiple program requirements.

`AcademicCycleArchiveSectionProgramIndex` fields: archive ID, archive-section ID, `sourceKind` (`COHORT`/`REQUIREMENT_MAPPING`), non-null `sourceMappingId`, `sourceProgramAcademicCycleId`, source program, curriculum, stage, and nullable requirement IDs plus denormalized department/program/curriculum/stage labels. Build rows from both direct `SectionRequirementMapping` records and the section's mapped cohort; enforce unique `(archiveSectionId, sourceKind, sourceMappingId)`. This normalized index makes multi-program sections discoverable under every valid program without duplicating the section payload.

`AcademicCycleArchiveStudentIndex` fields: archive ID, archive-section ID, source student ID, snapshotted name/registration/roll values, normalized search text, and non-program filter dimensions. Program filtering joins through the archived section-program index and snapshotted student enrollment/attempt context instead of storing one lossy program value. This supports direct student search without scanning every JSON payload.

Store schema-versioned payloads so renderers can migrate safely. Preserve every ready revision; `currentArchiveId` points to the authoritative revision.

### Database-Enforcement Checklist

- Keep the existing organization-scoped unique academic-cycle code and add unique `Program(organizationId, code)`.
- Add partial unique `AcademicCycle(organizationId) WHERE status = 'ACTIVE'`; verify duplicate active rows before creating it.
- Add unique `ProgramAcademicCycle(programId, academicCycleId)`, partial unique `(programId, sequence) WHERE status = 'ACTIVE'`, and checks for `sequence > 0` and v1 `isRequired = true`.
- Add unique `ProgramConfigurationRevision(programId, version)`; unique curriculum code per program; partial unique default curriculum per program; and unique stage code, sequence, and program-cycle association per curriculum.
- Add partial unique `StudentProgramEnrollment(studentId) WHERE status IN ('ADMITTED','ACTIVE','ON_HOLD')`; unique student-plan enrollment/association, enrollment/shared-cycle, and enrollment/sequence; and unique stage-attempt number in its enrollment-cycle/stage context.
- Add unique archive `(academicCycleId, revision)`, archive-section `(archiveId, sourceSectionId)`, archive student and section-program index keys, and unique answerbook `fileId`.
- Use composite tenant foreign keys including `organizationId` where Prisma supports them. Where a cross-table equality cannot be expressed as a database constraint, validate it after locking all referenced rows inside the same transaction; never rely on a pre-transaction controller lookup.
- Use `Restrict`/`NoAction` for historical links. Cascades are allowed only for unused draft aggregates proven safe to delete and must never reach shared `AcademicCycle`, delivered records, archive revisions, or locked files.
- Database constraints cannot compare `Program.requiredCycleCount` to association row count or validate snapshot hashes. Enforce both in version-checked transactions and add a read-only integrity query/metric that alerts on drift.

## Archive Scope and Procedure

An archive snapshot includes, at minimum:

- organization/cycle/GPA policy snapshot
- every `ProgramAcademicCycle` association using the shared cycle, associated departments/programs/configuration revisions/curricula/stages/requirements, and standalone/no-program delivery
- cohorts, cohort membership history, sections, courses, teacher assignments, rooms, schedules
- enrolled students, durable student program enrollments, immutable student cycle-plan rows, stage attempts, and enrollment history
- assessments/exam types, grades, finalization/correction metadata, submissions, answerbook references and files
- attendance sessions and records
- course materials and linked files
- evaluation windows/evaluations
- preference windows, options, audiences, submissions, and ranks
- applicable academic events during the cycle date range
- source IDs, timestamps, display values, counts, file hashes, and schema version

Notifications, chat, mail, and finance records are outside the archive unless a future schema explicitly links them to an academic cycle. This boundary must be approved before Phase 7 begins.

Archive sequence:

1. Run preflight integrity checks and produce a report. Block on cross-organization links, cycle mismatches, missing required parents, missing files, unresolved null cycle IDs, or `IN_PROGRESS` student cycle rows/stage attempts that should have been explicitly resolved during closeout.
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
2. Select program or `Standalone / No program` so intentionally standalone delivery is never hidden.
3. Select a shared cycle associated with that program. Cycle search accepts name or code, such as `Fall 2020`; the same result may appear under multiple programs without duplication in storage.
4. Select cohort, section, or a combined cohort/section filter; optionally filter by stage, curriculum version, course, teacher, grade status, attendance status, student status, and finalized-only.
5. Open a section in a read-only control-panel layout with roster, assessments/exams, grades, attendance, schedules, materials, submissions, and applicable evaluations.

Additional entry flows:

- Search student by name, registration number, or roll number; then select cycle -> program/cohort/section.
- Search section by name/code/course; then select cycle if multiple historical matches exist.
- Search cycle directly; then show all associated programs plus standalone sections before narrowing by department/program/cohort/section.
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
- Dynamic arrays: existing `react-hook-form` plus `useFieldArray`, wrapped by the planned reusable `ProgramCycleArrayEditor`; extract shared standalone/inline cycle fields into `AcademicCycleFields`.
- Feedback/state: `Badge`, `StatusBanner`, `EmptyState`, `ErrorState`, `Loading`, `SkeletonTable`, and the existing global toast/processing actions.
- Query behavior: `useUrlQueryState`, `usePersistentPageSize`, `useDebounce`, SWR, and `matchesCacheKeyPrefix` patterns already used by departments/cohorts/sections.
- Lookups: extend [frontend/lib/filterLookups.ts](frontend/lib/filterLookups.ts) for programs, program-filtered academic cycles, curricula, and stages.
- Files: `AttachmentPreviewCard`, [frontend/lib/uploadPolicy.ts](frontend/lib/uploadPolicy.ts), and [frontend/lib/attachmentUtils.ts](frontend/lib/attachmentUtils.ts), with answerbook-specific accept/size helpers.
- Section presentation: refactor `AssessmentList`, `AttendanceSheet`, `SectionSchedules`, and `CourseMaterials` under [frontend/components/sections](frontend/components/sections) into pure display panels plus live mutation wrappers. The pure panels are shared by live and archived pages.

## Phase Dependencies and Promotion Rules

Phases are strictly incremental. A later phase may be designed while an earlier phase is in progress, but its schema/API/UI changes must not merge until every dependency gate is recorded as passing.

| Phase | Depends on | Status | Unlocks |
| --- | --- | --- | --- |
| 0. Clean baseline and safety harness | None | Complete | Schema implementation may begin |
| 1. Final schema foundation | Phase 0 | Complete | Lifecycle and domain services can compile against final tables |
| 2. Cycle lifecycle and write integrity | Phase 1 | Complete | Program APIs can safely reference shared cycles |
| 3. Programs/curricula API | Phase 2 | Complete | Program management UI and mappings |
| 4. Programs management UI | Phase 3 | Implementation and automated gates complete; manual browser verification is user-owned and excluded from this plan | Administrators can create validated structures used by delivery |
| 5. Cohort/section mapping | Phase 4 | Implementation and automated gates complete; manual browser verification is user-owned and excluded from this plan | Student program progression has valid delivery targets |
| 6. Student enrollment/progression | Phase 5 | Implementation and automated gates complete; manual browser verification is user-owned and excluded from this plan | Archive snapshots can include complete program history |
| 7. Archive enforcement/generation | Phase 6 | Implementation and automated gates complete | Past-record reads and answerbook retention are safe |
| 8. Past-record API/UI | Phase 7 | Implementation, authorization tests, and builds complete; performance gate pending; manual browser verification is user-owned | Archived academic history is usable before evidence expansion |
| 9. Answerbook evidence | Phase 8 | Implementation and automated gates complete | Admission/reporting cleanup can validate the complete contract |
| 10. Admissions/reporting/final cleanup | Phase 9 | Implementation and automated gates complete; performance rehearsal remains; manual browser verification is user-owned | First production release candidate |
| 11. Critical-flow verification and hardening | Phase 10 | Pending | Production-readiness signoff |

Promotion rules:

- Each phase is one reviewable vertical increment with its own migration, services, tests, and UI only where listed.
- Database migrations merge before or with all code required by their final non-null contract; there are no compatibility columns or dual-write intervals.
- A failed gate stops promotion. Fix the current phase and rerun all earlier regression gates rather than starting compensating work in a later phase.
- Development databases may be reset between phases. Immediately before the first production release, squash development-only program migrations into a final clean init and rehearse that init on an empty disposable database.
- Rollback before production means reverting the phase and resetting/reseeding development databases. No down migration or preservation of development data is required.

## Phase 0 Readiness Evidence

Completed locally on 2026-08-04:

- Replaced 12 development-era Prisma migrations with one schema-derived [clean init migration](backend/prisma/migrations/20260804145000_init/migration.sql), reset the empty local database, and verified no schema diff. The init is regenerated as development phases change; no compatibility/data migration chain is retained.
- Added read-only [programs-preflight.js](backend/scripts/programs-preflight.js). It reports aggregate row counts, cycle-link/file-integrity violations, and migration drift without mutating source data.
- Added guarded [programs-backup-restore-check.js](backend/scripts/programs-backup-restore-check.js). The local rehearsal restored and compared 20 critical tables in a uniquely named disposable database, then removed the dump and temporary database.
- Added [programs-baseline.characterization.spec.ts](backend/src/common/programs-baseline.characterization.spec.ts) covering cohort enrollment/history, reassignment, destructive section/assessment behavior, finalized-grade correction, transcript filtering, file deletion authorization, and copy-forward exclusions.
- Repaired stale dependency mocks in existing smoke tests and aligned the AI tool-registry expectation with current behavior; production services were not changed.
- `prisma validate`, backend build, frontend build, 28 backend suites/129 tests, migration status, preflight, restore rehearsal, and database/schema diff all pass.
- The local database is intentionally empty: 0 organizations and 0 academic-delivery rows. This satisfies the clean development gate, not a production-data migration rehearsal.

Phase 1 is locally unlocked. No production deployment is authorized until the completed feature set is squashed into the final init and the same empty-database/restore/build/test gates pass in the release environment.

## Phase 1-2 Implementation Evidence

Completed locally on 2026-08-04 as one atomic breaking-contract increment:

- Added the final program, shared-cycle relationship, configuration revision, curriculum/stage, progression, answerbook evidence, and archive snapshot schema in [schema.prisma](backend/prisma/schema.prisma). Programs and academic cycles remain independent; [ProgramAcademicCycle](backend/prisma/schema.prisma) is the reusable many-to-many relationship.
- Folded the Phase 1-2 constraints into the single clean init, including one active institute cycle, active program sequence uniqueness, one default admissions curriculum, one open student program enrollment, positive sequence/count values, date ranges, and cohort classification consistency.
- Removed `AcademicCycle.isActive`, `Cohort.isActive`, `Student.major`, and free-text `Student.department`. Required deterministic cycle IDs and explicit `STANDALONE`/`PROGRAM_MAPPED` classification are now carried through backend DTOs/services, imports, frontend types/forms, reassignment, and copy-forward.
- Implemented the cycle transition matrix and concurrency-safe conditional transitions with serializable retries. Metadata edits and destructive deletes are draft-only; delivered sections are closed and delivered assessments are retired instead of erased.
- Added reusable [academic-cycle-write-policy.ts](backend/src/common/academic-cycle-write-policy.ts) with `SETUP`, `DELIVERY`, and `CLOSEOUT` modes. It accepts either the root Prisma client or a transaction client and is applied across cohort, section, enrollment, schedule, attendance, assessment, grade, submission, material, evaluation, preference, reassignment, and copy-forward writers.
- Updated [programs-preflight.js](backend/scripts/programs-preflight.js) to validate only the clean final contract. It has no legacy-schema or data-migration compatibility path; it now includes program, delivery, progression, archive, and answerbook invariants and reports `readyForPhase10`.
- Added lifecycle/write-policy tests and revised characterization/import tests for the final preservation and classification behavior. All 30 backend suites/143 tests pass.
- Replayed the single clean init from an empty database; `prisma validate`, migration status, schema diff, zero-blocker preflight, backend build, frontend production build, and the 20-table disposable backup/restore comparison all pass.

Phase 3 is locally unlocked. Program APIs must use the schema and lifecycle utilities established here; they must not add cycle ownership to `AcademicCycle` or reintroduce compatibility fields.

## Phase 0: Baseline, Safety Harness, and Decisions

Objective: establish a clean, reproducible development baseline before program schema changes.

Steps:

- Reset development data and establish one clean current-schema init migration.
- Run the read-only preflight report for every cycle-scoped table and require zero integrity blockers/migration drift.
- Add characterization tests for current cohort auto-enrollment/removal, reassignment, section deletion, assessment deletion, grade finalization/correction, transcript generation, file authorization/deletion, and copy-forward exclusions.
- Lock the v1 operational policy before coding: ready archive revisions and locked files have indefinite retention/no automatic purge; each grade permits at most five answerbook attachments; images use the existing 5 MiB image cap; PDFs use the existing 50 MiB document cap; references are trimmed to 100 characters; archive and answerbook roles follow the authorization matrix below. Any policy change requires an explicit plan revision and tests.
- Restore-test the clean database backup in a uniquely named disposable database and compare critical table counts.

Reuse:

- Existing Jest/Nest testing configuration, Prisma test mocks, `OrganizationActivityService`, role/access guards, department-scope helpers, `npm run programs:preflight`, and `npm run programs:restore-check`.
- Existing frontend list-page SWR/error/loading patterns for later smoke-test fixtures.

Exit gate: complete locally. Baseline backend tests and both builds pass; clean init is applied; integrity/migration drift is zero; disposable backup restore is proven; operational policies in this plan are fixed.

## Phase 1: Final Schema Foundation

Objective: replace the clean baseline schema with the complete final programs/archive/evidence structure before exposing new behavior.

Steps:

- Add `ProgramAcademicCycle`, append-only `ProgramConfigurationRevision`, progression (including `StudentProgramEnrollmentCycle`), typed answerbook, archive, and snapshot-index models. Do not add program ownership/order fields to `AcademicCycle`.
- Add final required cycle lifecycle and cohort/section `STANDALONE`/`PROGRAM_MAPPED` classification fields. Make deterministic child cycle links required and remove `AcademicCycle.isActive`, `Cohort.isActive`, `Student.major`, and free-text `Student.department` in the same schema/code phase.
- Add required indexes and explicit `onDelete` behavior. Use `Restrict` for new historical ownership links; do not introduce new cascades that can erase delivered history.
- Add custom PostgreSQL partial unique indexes for one active institute cycle per organization, active program-association sequence uniqueness, one default admissions curriculum per program, and one open student program enrollment (`ADMITTED`/`ACTIVE`/`ON_HOLD`) in v1.
- Generate Prisma client; never edit generated client files manually.
- Add mirrored backend/frontend enums and TypeScript interfaces; update all existing compile-time callers to the final required fields.
- Do not expose new program endpoints yet.

Reuse:

- `normalizeEntityCode` for all new codes, existing timestamp/UUID conventions, and existing enums/types layout.
- Frontend types in [frontend/types/index.ts](frontend/types/index.ts) and [frontend/types/enums.ts](frontend/types/enums.ts).

Tests and gate: reset an empty disposable database from the clean init plus Phase 1 migration, verify database/schema diff is empty, run all characterization tests and both builds, and inspect every destructive foreign key. Rollback is branch revert plus development-database reset/reseed.

## Phase 2: Cycle Lifecycle and Write Integrity

Objective: implement institute-cycle lifecycle and final write contracts before programs or archives depend on them.

Steps:

- Replace all active-cycle reads/writes with required lifecycle `status`; there is no `isActive` reader or writer after this phase.
- Require explicit `STANDALONE` or `PROGRAM_MAPPED` on cohort/section create, update, copy-forward, and imports; omitted classification is rejected.
- Update every enrollment/material/schedule/assessment/grade/submission/attendance/history writer to supply the required cycle ID from its validated parent in the same transaction.
- Reject parent/cycle, course, organization, cohort, and schedule mismatches before mutation.
- Use the shared `assertAcademicCycleWritable` policy with `SETUP`, `DELIVERY`, and `CLOSEOUT` modes. It accepts the root Prisma client or a Prisma transaction client; archive entry later adds the explicit archive lock after it owns the archive transaction.
- Keep active-cycle lookups organization-wide. Program screens later join/filter the same active cycle through `ProgramAcademicCycle`; standalone screens use the organization active cycle directly.
- Add lifecycle tests for concurrent organization activation and every allowed/denied transition.

Reuse:

- Existing cycle service transaction style, Prisma transactions, pagination/report helpers, and `OrganizationActivityService.record`.
- Existing cycle list `DataTable`, status `Badge`, `ConfirmDialog`, `StatusBanner`, and global toast/processing state.

Gate: every write supplies required cycle/classification values; lifecycle transition concurrency and the one-active-cycle database constraint pass; preflight reports zero mismatches; current cycle/cohort/section workflows pass against the breaking final contract.

## Phase 3: Programs, Curricula, and Shared-Cycle Relationships API

Objective: implement the structural domain after cycle lifecycle is authoritative.

Files/modules:

- Add `backend/src/programs/programs.module.ts`, controller, service, DTOs, and tests.
- Keep [backend/src/academic-cycles](backend/src/academic-cycles) independent and add program relationship commands/queries in the programs module.
- Register modules in [backend/src/app.module.ts](backend/src/app.module.ts).
- Add client methods to [frontend/lib/api.ts](frontend/lib/api.ts).

Steps:

- CRUD programs; activate/pause/archive with transition validation.
- CRUD curriculum versions, stages, requirements; activate/retire/freeze with transactional checks.
- Implement transactional program creation with the ordered discriminated `cycles[]` DTO: associate existing institute cycles or create new draft institute cycles inline, create ordered `ProgramAcademicCycle` rows, derive `requiredCycleCount`, append revision 1, and scaffold the revision's draft curriculum/stages.
- Implement a dedicated version-checked relationship-array edit command; generic program metadata updates cannot mutate association/order/count.
- Add a paginated institute-cycle lookup filtered by organization/search/lifecycle and excluding cycles already selected by the same program. Include program-use counts; cycles used by other programs and cycles with no program use remain selectable.
- Suggested routes: `POST /org/programs`, `GET /org/programs/eligible-cycles`, `PUT /org/programs/:id/cycles`, and `GET /org/programs/:id/configuration-revisions`.
- List a program's cycles through `ProgramAcademicCycle`; list an institute cycle's associated programs through the reverse relation.
- Enforce tenant, department scope, inactive department, duplicate code, frozen curriculum, course department/org, and lifecycle rules.
- Block curriculum/program activation and student assignment unless the selected curriculum targets the intended configuration revision, maps every required cycle exactly once in order, and gives every required stage its course requirements.
- Return paginated/filterable DTOs; do not leak raw unrestricted Prisma includes.
- If an inline `NEW` cycle conflicts with an existing organization cycle code, return a row-level conflict containing the eligible existing cycle ID/summary so the user can switch that row to `EXISTING`; never create a duplicate or silently attach it.
- Log create/update/status/activation/retirement, shared-cycle association add/reactivate/retire/reorder, new institute-cycle creation, and configuration revision actions.
- Prevent hard deletion after any dependent record exists.

Reuse:

- Backend code normalization, pagination/search, department-scope helpers, guards/decorators, activity logging, and Prisma transaction patterns.
- Frontend `api` request/error/upload helpers only; UI remains flagged off in this phase.

Gate: API integration tests cover mixed existing/new array creation, shared-cycle reuse by multiple programs, valid zero-program cycles, duplicate same-program selection, inline-new code conflicts, curriculum/stage scaffolding, activation rejection for missing cycle courses, complete transaction rollback, concurrent configuration edits, derived count/order, cross-organization attacks, selected-department scope, freeze rules, and explicit standalone behavior.

## Phase 4: Programs Management UI

Objective: let authorized admins manage structure without touching live delivery.

Routes:

- `frontend/app/(org)/programs/page.tsx`
- `frontend/app/(org)/programs/create/page.tsx`
- `frontend/app/(org)/programs/[id]/page.tsx`
- `frontend/app/(org)/programs/[id]/edit/page.tsx`
- components under `frontend/components/programs/`

Steps:

- Build program list/detail/form, curriculum tabs, ordered stages, course requirements, admission visibility, and the program's ordered expanding academic-cycle editor.
- The create form starts with an empty required-cycle area and an icon-only `+` append control. Every appended row selects `Use existing` or `Create new`; the visible required count updates from valid rows, is read-only, and submission requires at least one row.
- Show `Create new` only to actors with institute-cycle creation permission and identify it as an institute-wide cycle in the row label/tooltip; all other authorized program editors can still select eligible existing shared cycles.
- Reuse the same `ProgramCycleArrayEditor` on edit, with confirmation and server-provided mutability/retirement state for persisted rows.
- Keep standalone academic-cycle creation independent and fully usable without a program. Optionally provide an `Associate with programs` multi-select after cycle creation, but call the same relationship command and never make association a prerequisite for cycle activation or delivery.
- Add Programs between Departments and Courses in [frontend/lib/orgSidebar.ts](frontend/lib/orgSidebar.ts).
- Add programs to [frontend/components/global-search/searchIndex.ts](frontend/components/global-search/searchIndex.ts).
- Extend `filterLookups.ts` and API types for remote program/curriculum/stage/cycle selectors.
- Add Zod discriminated-union validation for `cycles[]`, row-level API errors, and typed request/response models in the existing schemas/types/API files.
- Show frozen/archived states and disable prohibited controls based on server capabilities, not duplicated client-only rules.

Reuse:

- `PageShell`, `PageHeader`, `PageTabs`, `ResourcePanel`, `ResourceToolbar`, `DataTable`, `PageControls`, `FilterDrawerGrid`, `RemoteFilterSelect`, `FormLayout` components, `CustomSelect`, `Toggle`, `Badge`, `StatusBanner`, `ConfirmDialog`, `EmptyState`, `ErrorState`, and skeletons.
- Existing `react-hook-form`/Zod patterns plus `useFieldArray`; Lucide `Plus`, remove, and reorder icons; the extracted `AcademicCycleFields` and shared cycle date/code validation.
- `useUrlQueryState`, `usePersistentPageSize`, `useDebounce`, SWR cache invalidation, existing department/course list patterns, and `useAccess`.

Gate: component/E2E flow clicks `+` repeatedly, mixes existing and inline-new cycles, reuses one shared cycle across two programs, displays the derived count/order, creates department program -> relationships -> aligned curriculum/stages/requirements, safely edits the array without changing the shared cycle, creates and activates a zero-program standalone cycle, and verifies narrow/mobile, row-error, keyboard, and unauthorized states.

## Phase 3-4 Implementation Evidence

Implemented locally on 2026-08-04 as one API/UI increment because Phase 4 directly depends on Phase 3:

- Added the `ProgramsModule`, scoped controller, DTOs, and transactional service. Program creation supports mixed existing and inline-new institute cycles, reuses one cycle across programs, derives `requiredCycleCount`, writes revision 1/checksum, and scaffolds a draft curriculum, ordered stages, and course requirements atomically.
- Added version-checked atomic configuration replacement. It retires/reactivates shared-cycle associations safely during reorder, appends a configuration revision, creates the next draft curriculum, and commits metadata plus cycle-array edits together so the UI cannot partially save.
- Added program/curriculum lifecycle validation, current-revision/default-curriculum activation checks, department/course/organization scope enforcement, paginated eligible-cycle lookup with program-use counts, reverse program associations on cycle detail, activity records for core commands, and dependency-aware archive/delete rules.
- Added Programs list/create/detail/edit routes, navigation/global search, typed API/models, Zod discriminated cycle validation, row-level server errors, remote program/curriculum/stage/cycle lookups, and the reusable `ProgramCycleArrayEditor` with icon-only add/remove/reorder controls.
- Updated `programs-preflight.js` with program department, relationship tenant, derived count, current revision, stage association, course department, archive pointer/index/count, file-lock, and answerbook-integrity checks. It reports zero blockers and `readyForPhase10: true` on the empty clean database.
- Added `programs.service.spec.ts`; all 31 backend suites/148 tests pass. Backend and frontend production builds pass, Prisma schema/migration/drift checks pass, and the running frontend returns HTTP 200 for `/programs`.

Strict gate status:

- Phase 3 is complete.
- Phase 4 implementation, type-check, production build, and route smoke checks are complete.
- Manual browser verification is user-owned and excluded from this implementation plan. No Playwright/browser dependency or automated browser gate is required for these phases.
- Phases 5 and 6 were folded into one implementation increment because mapped delivery must exist before program admission/progression can assign a stage. The open `StudentProgramEnrollment` is the student's major and atomically derives `Student.primaryDepartmentId` during admission and enrollment-management transfer.

## Phase 5: Cohort and Section Mapping

Objective: connect curriculum expectations to actual cycle delivery.

Affected files include cohort/section DTOs and services, [frontend/components/cohorts/CohortFormPage.tsx](frontend/components/cohorts/CohortFormPage.tsx), and section create/edit pages.

Steps:

- Selecting an academic cycle does not determine one program. After cycle selection, offer an explicit optional mode: `Standalone / No program` or one of the active `ProgramAcademicCycle` associations for that shared cycle, filtered by organization and department scope.
- For a `PROGRAM_MAPPED` cohort, require `programAcademicCycleId` and `programStageId` together. Validate that the association points to `cohort.academicCycleId`, the stage points to that exact association, and the program/curriculum/configuration revision is eligible. For `STANDALONE` cohorts, require both fields to be null.
- Add section requirement mappings; prefilter requirements by the selected program-cycle association, cohort stage, and course while retaining manual/standalone sections. A shared cycle may therefore contain sections for several programs plus sections for no program.
- Keep all mapping writes in the same transaction as cohort/section updates and auto-enrollment changes.
- Add a `Standalone / No program` badge and filter alongside program filters.
- Update copy-forward so source and target are independent institute cycles. The caller must explicitly choose `STANDALONE` or select an eligible target `ProgramAcademicCycle` for the same program and a compatible target stage/requirement; never infer classification from the cycle, silently carry the source association, or map into another program.
- Replace unsafe section deletion as described in preparation.

Reuse:

- Existing cohort transaction/auto-enrollment helpers, `validateAcademicPlacement`, department scope, code normalization, room validation, and lifecycle service.
- `CohortFormPage`, section forms, `RemoteFilterSelect`, `CustomSelect`, `CustomMultiSelect`, `FormSection`, `StatusBanner`, `CourseSectionLabel`, and existing section color/room helpers.

Gate: tests cover program-mapped/standalone cohorts, one shared cycle mapped to multiple programs, a cycle with standalone delivery only, mixed program and standalone sections in one cycle, multiple cohorts per stage, missing-classification and mismatched association/stage/cycle rejection, copy-forward behavior, and cohort auto-enrollment parity.

## Phase 6: Student Program Enrollment and Progression

Objective: add durable program and stage history without replacing current placement fields.

Affected areas: student service/controller and DTOs, enrollment and reassignment services, student forms, enrollment page, profile overview, transcripts.

Steps:

- Treat the student's one open `StudentProgramEnrollment` as the student's **major**. Do not restore `Student.major` or store a copied/free-text program name on `Student`; all major labels and filters resolve through the durable enrollment and its program snapshot/current display metadata.
- Add an optional program selector to student admission/create. When selected, validate the active/default curriculum and create the student plus durable program enrollment atomically. Derive and set `Student.primaryDepartmentId` from `Program.departmentId` in that same transaction; clients cannot submit a conflicting primary department. Additional department memberships remain independent and may still be selected.
- Add a Major/Program section to student enrollment-management edit. Assigning a first program uses the admit command; changing it uses the transfer command and preserves the old enrollment; clearing it requires an explicit withdraw/remove-major command and reason. Never replace or delete program history through a generic student patch.
- Whenever a program transfer changes the major, update `Student.primaryDepartmentId` to the new program's department in the transfer transaction. Withdrawal without a replacement leaves the last department only when explicitly confirmed; otherwise require a replacement primary department so department scope never becomes ambiguous.
- Return `majorProgram` and its derived primary department in student list/detail/profile responses, add program/major filters, and show the real program on admission review and enrollment edit. Standalone students continue to have no major and may choose their primary department directly.
- Assigning/admitting a student creates one durable `StudentProgramEnrollment(ADMITTED)` plus the full ordered `StudentProgramEnrollmentCycle[]` snapshot using an active frozen curriculum that targets the selected program configuration revision. This is the primary proof that the student belongs to the program before and across cycle activation boundaries.
- Add explicit admit, activate, hold, withdraw, transfer, complete, repeat, and skip commands. Do not expose generic arbitrary status patching.
- Create stage attempts when assigning a program-enrolled student to a compatible mapped cohort; require an explicit choice if no deterministic match exists.
- Link new cohort/manual enrollments and history rows to the selected stage attempt where valid.
- At the next semester/year, activate the next snapshotted cycle row and create its `StudentStageAttempt` under the same `StudentProgramEnrollment`; never rebuild the plan or create a new program enrollment merely because the academic cycle changed.
- Completing or archiving a cycle never auto-closes stage attempts or the parent program enrollment. Cycle closeout must explicitly resolve the cycle's attempts/plan rows first; lifecycle preflight blocks completion/archive while required rows remain `IN_PROGRESS`.
- Compute progress from completed required `StudentProgramEnrollmentCycle` rows versus `requiredCycleCountSnapshot`, with attempts retained but not double-counted. Skipped/credited stages follow the frozen curriculum completion rule.
- Transfer closes old program enrollment/stage attempt, preserves every old record, then opens the new program enrollment in one transaction.
- Stage completion stores a result snapshot and actor/reason; it does not recompute or move grades.
- Program completion validates the frozen curriculum requirements and required cycle count, writes a final result snapshot, and then closes the durable enrollment. Program metadata or newer curriculum versions are not consulted for that decision.
- Add program/stage context to transcript responses and update all consumers under transcript/GPA regression tests.

Reuse:

- Existing student soft-delete behavior, cohort membership history, enrollment history, reassignment transactions, notification service, transcript/GPA services, department scope, and activity logging.
- `StudentForm`, enrollment page controls, profile `Overview`, `PageTabs`, `Badge`, `StatusBanner`, `DataTable`, `ModalForm`, `ConfirmDialog`, remote selectors, and form components.

Gate: assignment copies the exact ordered cycle array and survives later program add/remove/reorder edits; admission persists across at least two completed/archived cycles; admit/transfer/repeat/skip/withdraw/completion scenarios, concurrent assignment/configuration edits, selected-department scope, standalone students, and transcript snapshots all pass.

## Phase 5-6 Implementation Evidence

Implemented locally on 2026-08-04 as one dependent delivery/progression increment:

- Cohorts now require explicit `STANDALONE` or exact active `ProgramAcademicCycle` plus current active stage mapping. Sections use normalized `SectionRequirementMapping` rows validated against organization, institute cycle, course, association, stage, and current configuration.
- Cohort and section create/edit pages expose the same explicit classification and shared-cycle delivery options. Lists include program/standalone badges and filters. Copy-forward requires an explicit standalone or source/target program relationship and maps target requirements by course without inferring ownership from the institute cycle.
- Program-mapped cohort placement and manual section enrollment call the complete `StudentProgramEnrollmentsService` progression boundary and write `Enrollment` plus `EnrollmentHistory` links to the durable program enrollment and stage attempt in the same transaction. Reassignment uses the same boundary.
- Student admission optionally assigns a hard-defined program as the durable major, derives the primary department atomically, and rejects conflicting department input. Generic student updates cannot replace the major.
- Enrollment management now owns admit, transfer, hold/resume, withdraw with explicit department retention/replacement, cycle activation, complete/skip/repeat, and final program completion. Every admission snapshots the full ordered program-cycle/stage plan and configuration checksum.
- Student list/detail/public profile/transcript responses include major and progression context. The roster exposes a major column/filter, and student/public profile overviews show snapshotted cycle progress.
- Reusable backend pieces: `StudentProgramEnrollmentsService`, `assertAcademicCycleWritable`, exact cohort/section mapping validators, existing enrollment/reassignment transactions, department scope, and transcript projections. Reusable frontend pieces: `StudentForm`, `CohortFormPage`, section forms, `RemoteFilterSelect`, `CustomSelect`, `Badge`, `PageTabs`, `StatusBanner`, and URL-backed list filters.
- Added `program-delivery-mapping.spec.ts` and `student-program-enrollments.service.spec.ts`. The complete backend suite passed before Phase 7 promotion, both production builds passed, Prisma validated, and the clean database had zero preflight blockers.

Gate status: Phase 5 and Phase 6 implementation and automated service/build gates are complete. Manual browser verification is user-owned and excluded from this implementation gate.

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

- `assertAcademicCycleWritable` from Phase 2, Prisma transactions, existing file hash metadata, `OrganizationActivityService`, pagination utilities, and current service ownership checks.
- Existing cycle page `DataTable`, `Badge`, `ConfirmDialog`, `StatusBanner`, loading state, and toast actions for archive progress/error UI.

Gate: a write-denial matrix proves every endpoint rejects `ARCHIVING/ARCHIVED`; source/snapshot counts and checksums match; file deletion is denied; failed archive retry is idempotent.

## Phase 8: Past Records API and Read-Only UI

Objective: expose archived snapshots through all requested navigation flows.

Backend:

- Add `backend/src/past-records/past-records.module.ts`, controller, service, DTOs, and tests.
- Add endpoints for filter options, section results, section detail, student search, section search, and cycle search.
- Query `currentArchiveId`, section indexes, and the normalized archive section-program index only for archived cycles. Return `archiveRevision`, `schemaVersion`, and source mode.
- Apply role, guardian/student ownership, teacher assignment snapshot, and department scope on every query.

Frontend:

- Add `frontend/app/(org)/past-records/page.tsx` and section/student drill-down routes as needed.
- Keep archive presentation wholly owned by `ArchiveSectionView`. Reuse existing primitives, but do not extract fragments from live section components unless an entire display domain can move to a pure shared module with both live and archive callers migrated in the same phase.
- Persist filters in URL; use server pagination and remote search; include `Standalone / No program`.
- Add Past Records navigation and global-search entries.

Reuse:

- Backend pagination, normalized/fuzzy search, department scope, access guards, and transcript query patterns.
- `PageShell`, `PageHeader`, `PageTabs`, `ResourcePanel`, `ResourceToolbar`, `DataTable`, `PageControls`, `FilterDrawerGrid`, `RemoteFilterSelect`, `SearchBar`, `Pagination`, `Badge`, `StatusBanner`, `EmptyState`, `ErrorState`, and skeletons.
- `ArchiveSectionView` for the complete read-only archive presentation boundary; `useUrlQueryState`, `usePersistentPageSize`, and `useDebounce` for list behavior.

Gate: every requested flow works against snapshot data; no archive page sends mutations; direct student/section/cycle searches are paginated and scoped; performance is measured on synthetic production-scale volumes.

## Phase 7-8 Implementation Evidence

Implemented locally on 2026-08-04 as one archive/read-model increment, with complete ownership boundaries:

- Added `AcademicCycleArchivesModule`. It exclusively owns `COMPLETED -> ARCHIVING -> ARCHIVED`, unresolved-progression preflight, revision creation, per-section snapshot generation, normalized program/student indexes, deterministic section/manifest checksums, source/snapshot count comparison, referenced-file SHA-256 enforcement, final file locking, activity logging, status inspection, verification, and idempotent retry of failed partial revisions.
- `ARCHIVED` remains terminal. The shared lifecycle policy denies setup, delivery, and closeout mutations during `ARCHIVING/ARCHIVED`; program stage activation/completion/skip/repeat now re-checks that policy inside its transaction. Institute-cycle completion rejects unresolved in-progress student program cycles.
- `File.lockedByArchiveId/lockedAt` are owned by the archive revision. Generic file deletion rejects a lock before contacting storage, while authorized metadata/download reads remain available.
- Added `PastRecordsModule`. It reads only ready `currentArchiveId` snapshots and normalized indexes. One authorization resolver applies organization, department scope, snapshotted teacher assignment, student ownership, and guardian links to cycles, options, sections, section detail, student search, and student history.
- Student/guardian archive detail is reduced to linked student enrollment, grade, submission, and attendance rows. Evaluation records are retained in the immutable snapshot but omitted from past-record responses; storage `publicId` and lock internals are removed from every returned file projection.
- Added `/past-records` with URL-persisted section/student/cycle search modes and department/program/cohort/delivery filters, plus `/past-records/sections/[id]` with read-only students, assessments/exams, attendance, schedules, and materials panels. Academic cycles expose Archive/Retry/View Records commands. Past Records is available through role-appropriate navigation and global search.
- Reusable backend pieces: Prisma transactions, `OrganizationActivityService`, `getDepartmentScope`, pagination helpers, normalized archive indexes, and lifecycle policy. Reusable frontend pieces: `PageShell`, `PageHeader`, `PageTabs`, `ResourcePanel`, `DataTable`, `PageControls`, `FilterDrawerGrid`, `SearchBar`, `CustomSelect`, `Badge`, URL state, and persistent page sizing. Archive presentation is wholly owned by `ArchiveSectionView`; live section components were not partially extracted.
- Added archive generation/verification/retry and referenced-file checksum tests, past-record scope/redaction tests, file-lock deletion tests, and unresolved-cycle completion coverage. All 36 backend suites/173 tests pass. Backend and frontend production builds pass, including 131 frontend routes.
- Regenerated and applied the single clean init at `backend/prisma/migrations/20260804145000_init/migration.sql`. Prisma validation, migration status, database/schema diff, and the expanded archive/answerbook-aware preflight pass with zero blockers and `readyForPhase10: true` on the intentionally empty development database.

Gate status: Phase 7 implementation and automated integrity gates are complete. Phase 8 implementation, authorization tests, type-check, and production build are complete. Synthetic production-volume measurement remains pending. Manual browser verification is user-owned and excluded from this implementation gate.

## Phase 9: Answerbook Evidence at Grading

Objective: add optional reference numbers and PDF/image evidence safely.

Affected areas: Prisma schema from Phase 1, `UpdateGradeDto`, assessment grade saving, the dedicated `GradeEvidenceModule`, file policy/service, grading forms, released-grade views, archived-record downloads, types/API/Zod schemas.

Steps:

- Extend grade update DTO/response with optional normalized reference number.
- Add a grade-domain upload endpoint that first validates assessment, student enrollment, actor permission, grade/cycle state, file count, file type, and size.
- Save/update the grade first so a real grade ID exists; upload the file; then lock/re-read the grade and attachment count, repeat permission/lifecycle checks, and create `GradeAnswerbookAttachment` in a transaction. If the DB link fails or a concurrent upload reaches the five-file cap first, delete the just-uploaded object or record it for idempotent cleanup.
- Add list/download/delete endpoints through grade authorization. Do not let callers create arbitrary `GRADE_ANSWERBOOK` generic targets.
- Teachers can manage evidence only where they can grade. Students/guardians can view only their linked student's evidence when the grade is `PUBLISHED` or `FINALIZED`. Org admins/managers follow existing grading authority and department scope.
- Finalized grades and `COMPLETED` cycles follow existing correction rules for the reference field; attachment replacement after finalization is denied in v1. `ARCHIVING/ARCHIVED` always deny changes.
- Keep bulk grading marks/status only. Evidence remains per-student in the individual grading flow to avoid ambiguous file-to-student mapping.
- Lock answerbook files during archive and include hashes/metadata in snapshots.

Reuse:

- Backend `FilesService`, `classifyAndValidateUpload`, grade permission/finalization checks, section teacher/enrollment access patterns, lifecycle service, and activity logging.
- `GradingForm`, `Input`, `Textarea`, `Button`, `Modal`, `Label`, `AttachmentPreviewCard`, global toast/processing state, `api.uploadFile` internals, upload-policy extension helpers, and attachment type helpers.

Gate: reference-only/file-only/both/neither, unsupported/oversize files, partial upload failure, unauthorized access, published visibility, finalization, archive lock, and cleanup behavior are tested.

## Phase 9 Implementation Evidence

Implemented locally on 2026-08-04 as a complete grading-evidence domain:

- Added `GradeEvidenceModule`. It exclusively owns attachment authorization, listing, upload, download, deletion, five-file concurrency enforcement, lifecycle/finalization checks, detached-upload cleanup retries, public projections, and attachment audit events. Generic `/files` upload, metadata, download, and deletion paths explicitly reject `GRADE_ANSWERBOOK`; trusted storage operations are available only to the domain service.
- Extended ordinary grade saving with a trimmed, nullable, 100-character answerbook reference. Finalized-grade corrections continue to require the existing correction reason and permitted role; reference updates are audited without changing attachment immutability.
- Enforced PDF/JPG/JPEG/PNG/WEBP only, the existing 50 MiB PDF and 5 MiB image limits, student enrollment, teacher assignment, manager/sub-admin department scope, released-only student/guardian reads, and `ARCHIVING/ARCHIVED` write denial. A grade-level database lock rechecks all mutable invariants before linking each uploaded file.
- Added grading UI for optional references and up to five per-student files. Uploads occur only after a grade ID exists; successful files are removed from the pending queue individually so a partial failure can retry without duplicating completed uploads. Finalized evidence is read-only.
- Added reusable `GradeEvidenceReadOnly` rendering to student and guardian released-grade views. `AttachmentPreviewCard` now fetches protected image previews with authentication and supports compact downloads.
- Added an archive-scoped answerbook download route using snapshotted Phase 8 authorization. Archive generation already snapshots answerbook references/file metadata and locks every referenced file; past-record views no longer depend on current teacher assignment or generic file access.
- Expanded preflight with relationship, five-file limit, detached-file, extension, and size checks. The existing clean init already contains the Phase 9 schema, so no compatibility or data migration was added and database/schema diff remains empty.
- All 39 backend suites/196 tests pass. Backend and frontend production builds pass with 131 frontend routes. Prisma validation, migration status, database/schema diff, and preflight pass with zero blockers and `readyForPhase10: true`.

Gate status: Phase 9 implementation and automated gates are complete. The synthetic-volume benchmark remains a release check. Manual browser verification is user-owned and excluded from this implementation gate.

## Phase 10: Admissions Hooks, Reporting, and Release Finalization

Objective: complete all program-facing contracts and prepare the first production release candidate.

Steps:

- Add an admission-safe offering endpoint/DTO now (for example `GET /public/organizations/:slug/program-offerings`) so a later online application UI consumes a stable contract instead of raw program CRUD responses. An offering references `Program.id`, its default `CurriculumVersion.id`, current configuration revision, required cycle count, department summary, and eligible entry `ProgramAcademicCycle`/shared-cycle summaries; department is a filter, not the selected qualification.
- Return only programs that pass the admission-safety invariant. Deduplicate shared cycles by `AcademicCycle.id`, preserve program-specific sequence on each offering, and never infer one owning program from a cycle.
- When the actual application record is implemented, persist/snapshot the selected `programId`, `curriculumVersionId`, `programConfigurationRevisionId`, and optional entry `programAcademicCycleId`/`academicCycleId`; later program or cycle edits must not rewrite an already submitted application.
- Update AI route/source files, reporting, dashboard counts, filter lookups, exports, docs, and global search.
- Replace import templates with explicit standalone/program classification and program/curriculum/stage columns; dedicated imports require preview/validation and row-level errors.
- Run repository-wide searches proving removed fields (`AcademicCycle.isActive`, `Cohort.isActive`, `Student.major`, and free-text `Student.department`) have no readers, writers, DTOs, imports, or UI controls.
- Squash all development-only migrations into the final release init, reset/reseed every non-production environment, and rerun the complete phase-gate suite before the first production deployment.

Reuse:

- Existing imports validation/preview in [backend/src/imports](backend/src/imports) and [frontend/components/imports](frontend/components/imports), CSV utilities, global search index, AI route sources, transcript PDF utilities, and common list/filter components.

Gate: admission output contains no internal/private fields, rejects draft/paused/teach-out/archived or structurally incomplete programs, represents a shared entry cycle correctly under multiple programs, and exposes no standalone cycle as a program offering; final import templates pass; removed-field searches are empty; the final clean init reproduces the schema with no diff.

## Phase 10 Implementation Evidence

Implemented locally on 2026-08-04 as the final program-facing contract pass:

- Added the public `GET /public/organizations/:slug/program-offerings` boundary in a dedicated read-only module. Organizations now receive a normalized unique slug at registration. The service selects only approved organizations and active, admissions-visible programs in active departments, then explicitly projects applicant-safe organization, department, program, current revision, default curriculum, duration, and eligible shared-cycle fields.
- Admission output revalidates the current configuration revision, derived required-cycle count and contiguous sequence, exact current curriculum stage coverage, and required-stage course requirements. Draft, paused, teach-out, archived, inactive-department, stale-revision, missing-curriculum, and structurally incomplete records never become offerings. Standalone cycles cannot enter the response because the projection begins from program-cycle associations.
- Expanded the signed CSV preview/confirmation pipeline for students, cohorts, and sections with explicit `programClassificationStatus`, `programCode`, `curriculumCode`, `stageCode`, and student entry-cycle columns. Resolution is organization-scoped and requires the active default curriculum/current program revision. Student imports feed the existing atomic admission transaction, cohort imports resolve the exact cycle/stage mapping, and section imports resolve matching stage course requirements. Standalone rows reject stray program columns with row-level errors.
- Added program counts to the admin dashboard, program navigation and major-management flows to the AI sources, and a complete Programs and Student Majors documentation page. Existing program-aware transcript/past-record projections, URL filter lookups, exports, and global search remain the shared reporting and discovery paths rather than parallel implementations.
- Added `programs-removed-fields-check.js`, which verifies the Prisma model contract and scans backend/frontend source for readers or writers of `AcademicCycle.isActive`, `Cohort.isActive`, `Student.major`, and `Student.department`. It passed across 783 source files. Preflight now also blocks missing organization slugs and unsafe admissions-visible program structures.
- Updated the single clean init with the organization slug, reset the development database from that init, and confirmed migration status and database/schema diff are clean. The local disposable backup/restore parity check compared 20 tables with zero mismatches.
- All 40 backend suites/207 tests pass. Backend and frontend production builds pass with 132 frontend routes. Prisma validation, migration status, zero schema diff, removed-field proof, restore parity, and preflight all pass with zero blockers and `readyForRelease: true`.

Gate status: Phase 10 implementation and automated gates are complete. The synthetic-volume benchmark remains an explicit pre-production release rehearsal. Manual browser verification is user-owned and excluded from this implementation gate.

## Phase 11: Critical-Flow Verification and Hardening

Objective: verify the release candidate as a populated, multi-role system; find and fix integration defects across the main academic flows; and produce auditable evidence that critical APIs, authorization boundaries, immutable history, failure recovery, and performance behave correctly together.

This is a verification and hardening phase, not a new feature phase. Do not add compatibility fields, speculative abstractions, or broad refactors. Every discovered defect must first receive the narrowest failing automated regression test that reproduces it. Fix the defect in the module that fully owns the invariant, rerun the affected flow, then rerun the complete release gate. If a defect reveals a missing cross-domain contract, extract a complete reusable validator/service only when it can own that contract end to end.

### Phase 11A: Deterministic Release Scenario

Build one repeatable disposable release scenario against the single clean init. The fixture/setup utility may create test data, but it is not a data-migration or compatibility script and must refuse non-local/non-disposable targets.

Create at least:

- two approved organizations with different slugs, plus one pending or suspended organization for public/access rejection
- organization A roles: org admin, department-scoped sub admin, manager, assigned teacher, unassigned teacher, student, linked guardian, unrelated guardian, and finance manager
- organization B equivalents needed for tenant-isolation attempts
- two active departments and one inactive department in organization A
- shared institute cycles including one active cycle, later draft cycles, one completed cycle ready to archive, and one standalone-only cycle
- two active programs in different departments sharing at least one `AcademicCycle`, each with a current configuration revision, active admissions-default curriculum, complete stages, and course requirements
- draft, paused, teach-out, archived, inactive-department, stale-revision, missing-default-curriculum, and structurally incomplete program records for negative offering tests
- standalone and program-mapped cohorts/sections in the same institute cycle, with assigned/unassigned teachers and enrolled/non-enrolled students
- one student admitted to a program with a copied cycle plan, one standalone student, one transferred/withdrawn historical program record, and one organization-B student
- assessments, draft and finalized grades, attendance, schedules, materials, transcript data, answerbook reference/files, and a completed cycle that can produce a real archive and past-record index

The scenario must expose stable aliases/IDs to tests without hard-coding database UUIDs. Setup and teardown must be idempotent, isolate each run, and leave the developer database clean when finished.

Reuse: the clean init, Prisma test helpers, existing DTO factories in service specs, `programs-preflight.js`, `programs-backup-restore-check.js`, upload-policy helpers, archive checksum utilities, and existing local-target safety checks.

Gate: scenario setup succeeds from an empty database, a second setup does not create uncontrolled duplicates, teardown removes only scenario-owned data, preflight remains at zero blockers, and schema diff remains empty.

### Phase 11B: Critical API and Authorization Matrix

Exercise critical endpoints through Nest HTTP integration tests so guards, decorators, DTO validation, controller routing, and service invariants are verified together rather than only through direct service calls.

Cover these API groups:

- institute cycles: `POST/GET /org/academic-cycles`, `GET /active`, `GET/PATCH/DELETE /:id`, and `PATCH /:id/status`
- program structure: `POST/GET /org/programs`, eligible cycles, delivery options, program detail/update/cycle-array replacement/status/revisions, curricula, stages, and requirements
- public admissions: `GET /public/organizations/:slug/program-offerings`
- student major lifecycle: list, admit, transfer, hold, resume, withdraw, activate/complete/skip/repeat cycle, and complete program under `/org/students/:studentId/program-enrollments`
- delivery: student create/update, cohort create/update/membership/section links, section create/update, and direct/bulk/transfer/withdraw enrollment routes
- grading evidence: ordinary grade/reference update plus answerbook list/upload/download/delete under `/org/grades/:gradeId`
- archive and past records: start/status/verify archive, past-record options/cycles/students/sections/detail, and archived answerbook download
- reports/imports: student transcript, cycle report, CSV template/structure/validate/confirm/error report, and monthly-attendance import lifecycle

For every applicable endpoint, assert:

- unauthenticated rejection except the intentionally public offerings endpoint
- role denial and permitted-role success
- organization-B IDs cannot be read, linked, mutated, downloaded, or distinguished through error details
- department-scoped users cannot cross their configured departments
- teacher assignment, student ownership, and guardian linkage are enforced server-side
- malformed IDs, invalid enums, missing required fields, extra mapping fields on standalone requests, stale configuration versions, and invalid lifecycle transitions return stable 4xx responses rather than 500s
- public responses contain only the documented projection and protected endpoints do not become public through controller ordering or metadata mistakes

Reuse: Nest testing module and `supertest`, JWT/session test factories, `RolesGuard`, `AccessGuard`, `OrgId`, department-scope helpers, existing controller specs, import-session signing, and the Phase 11A aliases.

Gate: the complete positive/negative matrix passes, no cross-tenant response returns another tenant's existence or metadata, no expected validation failure produces a 500, and every public/protected route classification is asserted.

### Phase 11C: Main Academic Flow Rehearsals

Verify these flows from API entry to persisted result and user-facing read model:

1. Create shared cycles, create two programs that reuse them, activate complete curricula/programs, and confirm one shared cycle appears under both offerings with distinct program association IDs.
2. Create and deliver a standalone course in a cycle that has no program relationship; confirm no program offering or major is inferred.
3. Admit a student to a major during student creation and through enrollment management; confirm primary department derivation, exact configuration/curriculum/cycle-plan snapshots, and survival across later program configuration edits.
4. Create mapped cohorts and sections, reject mismatched program/curriculum/stage/course combinations, and verify program students enter mapped delivery only through valid progression.
5. Progress a student through activate, complete, skip, repeat, hold/resume, transfer, withdraw, and completion paths as applicable; assert history is append-only and prior snapshots never change.
6. Record attendance, assessments, draft/final grades, answerbook reference/files, and transcript output; assert program labels enrich reporting without changing GPA or grade calculations.
7. Complete and archive a cycle, verify checksum/count/file locks, then execute every past-record flow: department to program to cohort/section filters, direct student search, direct section search, direct cycle search, section detail, and archived answerbook download.
8. Validate and confirm standalone and program-mapped student/cohort/section imports; verify signed preview sessions, row-level errors, duplicate handling, stale-session rejection, and no partial relationship corruption.

Reuse: `ProgramsService`, `StudentProgramEnrollmentsService`, `CohortsService`, `SectionsService`, `TranscriptsService`, `GradeEvidenceService`, `AcademicCycleArchivesService`, `PastRecordsService`, `ImportsService`, archive snapshot projections, and existing DTO/import normalizers. Do not reproduce their business logic in the test harness.

Gate: every rehearsal has database assertions and API/read-model assertions, historical snapshots remain byte-for-byte stable after live configuration changes, transcript/GPA values match before and after program links, and archive/past-record reads no longer depend on mutable live assignments.

### Phase 11D: Concurrency, Failure Recovery, and Security Hardening

Run controlled competing requests and injected failures for:

- two admins activating institute cycles concurrently
- two program cycle-array updates using the same configuration version
- concurrent student major admission/transfer attempts for one student
- concurrent activation/completion/repeat of the same student program cycle
- concurrent cohort/section membership changes and duplicate enrollment requests
- concurrent answerbook uploads at the five-file boundary and deletion/upload races
- archive start/retry/verify races, failure after partial snapshot work, and file-lock consistency
- import confirmation replay, expired/tampered session signatures, and confirm requests from a different user/organization
- public offering requests for unknown, pending, suspended, or malformed organization slugs

Assert transaction rollback, unique/lock behavior, idempotent retries where supported, stable conflict responses, no orphan files or partial archive indexes, no duplicate open major, and no mutation after `ARCHIVING`/`ARCHIVED` write denial begins. Logs must exclude passwords, tokens, answerbook contents, signed import payloads, and sensitive student bodies.

Reuse: serializable transaction retry helpers, database locks already owned by progression/evidence/archive services, `classifyAndValidateUpload`, import HMAC/session utilities, activity logging, and preflight orphan/integrity checks.

Gate: repeated concurrency runs produce no invariant violations, injected failures recover or roll back as designed, preflight remains clean after each batch, and sensitive values are absent from captured logs.

### Phase 11E: Performance, Bug-Fix Loop, and Final Signoff

Run a deterministic synthetic-volume profile sized to reveal query and snapshot problems without pretending to be a production load test. Include multiple departments/programs/shared cycles, thousands of students/enrollments/grades/attendance rows, representative answerbook metadata, and a large archive.

Measure and record:

- program list/detail/delivery-option and public-offering query count and latency
- student list with program filter and student major-history latency
- archive duration, rows/files snapshotted, checksum duration, retry behavior, and memory high-water mark
- past-record options/search/section-detail latency across department/program/cycle/cohort/section filters
- import validation/confirmation throughput and error-report generation
- transcript/cycle-report latency and any N+1 query evidence
- clean init/reset duration and backup/restore parity duration

Inspect query plans for the slowest critical queries and add indexes only when measurements and plans demonstrate a real need. Any index/schema correction remains part of the single clean init because production has not started. Do not add caching to conceal an unbounded or N+1 query.

Bug handling and closure rules:

- `P0`: data loss, cross-tenant access, authentication bypass, archive corruption, or history mutation; stop all other work and fix immediately
- `P1`: critical flow cannot complete, incorrect major/progression/GPA, evidence authorization failure, or nonrecoverable 500; blocks Phase 11
- `P2`: incorrect validation, filter/import inconsistency, recoverable workflow defect, or serious responsive issue; fix before signoff unless explicitly accepted with an owner and deadline
- `P3`: cosmetic or low-impact issue; may be recorded for later only when it does not obscure state, authorization, or data correctness
- every fixed P0-P2 issue requires a regression test at the lowest reliable layer plus the affected end-to-end/API rehearsal
- avoid drive-by refactors; a hardening fix may refactor only the complete owning logic needed to remove the defect safely

Final gate:

- Phase 11A-E gates pass on a clean disposable database and after the populated rehearsal
- all backend tests, both production builds, Prisma validation, migration status, zero schema diff, removed-field proof, preflight, and backup/restore parity pass again
- critical API matrix, performance report, discovered-bug ledger, and resolved/deferred decisions are recorded
- no open P0/P1 issues; no unaccepted P2 issues
- the final plan ledger records exact test counts, route/build counts, scenario scale, timings, and any residual risk without describing an unrun check as passing

Gate status: complete for the automated Phase 11 scope. Phases 11A-E pass against the clean disposable database, the populated release scenario, and the final repository-wide gates. Browser workflow verification is user-owned and intentionally omitted; it is not a hidden Phase 11 prerequisite and no browser result is represented as passing here. There are no open P0/P1 issues or accepted-but-unresolved P2 issues in this phase.

### Phase 11 Progress Evidence

Completed locally on 2026-08-04:

- **11A complete:** `phase11-critical-api-check.js` is a local-only disposable PostgreSQL runner. It requires explicit `--apply`, rejects non-local hosts, creates a unique database, applies `20260804145000_init`, invokes repository-installed Prisma/Jest entrypoints, runs populated preflight, and drops the database in `finally`. The idempotent fixture provides stable aliases for three organizations; organization, department, assignment, ownership, and guardian roles; active/inactive departments; shared, standalone, completed, and archived cycles; complete and negative-case programs; mapped and standalone delivery; active and historical majors; grades, attendance, schedules, materials, answerbook evidence, and archive indexes.
- **11B complete:** the dedicated real-`AppModule` HTTP lane uses global DTO validation, signed JWTs, persisted sessions, and the local `phase11-files.service.ts` upload replacement. It verifies public/protected route boundaries, organization and department isolation, explicit sub-admin department assignments, institute-cycle write restrictions, offering projection, major admission, delivery mappings, progression, imports, grading evidence, archive/past-record access, guardian/teacher ownership, stable 4xx validation, and tenant-safe failures.
- **11C complete:** the rehearsal creates two programs that share institute cycles, delivers mapped and standalone sections without inferring a major, admits and progresses students through hold/resume/complete/repeat/skip/transfer/withdraw/program-completion paths, proves copied program snapshots remain byte-for-byte stable after later program changes, exercises answerbook reference/files, archives a completed cycle, verifies checksum/count/file locks, and reads archived records by cycle, student, section, program, and linked guardian context.
- **11D complete:** controlled races cover duplicate major admission, same-version program updates, institute-cycle activation, student-cycle activation/completion, five-file answerbook upload limits, and archive start. Expected losers return conflict responses, no race returns an unhandled 500, and post-race preflight reports no duplicate open major, orphan evidence file, partial archive index, or other blocker.
- **11E complete:** the deterministic profile contains 1,000 students, 1,005 student-program records, 2,010 snapshotted program cycles, 1,001 grades, and 1,001 attendance records. Recorded timings were: archive `186.41 ms`, synthetic seed `3,496.05 ms`, program list `10.62 ms`, program-filtered student list `81.46 ms`, transcript `47.31 ms`, cycle report `101.58 ms`, past-record search `18.54 ms`, and public offerings `18.33 ms`; process RSS high-water reading was `473.36 MB`. No measured read justified an additional index or cache.
- **Final automated gate:** the Phase 11 HTTP suite passed 19/19 tests in 13.64 seconds and populated preflight reported 0 blocker checks, 0 pending/failed/database-only migrations, and `readyForRelease: true`. The complete backend lane passed 42 suites/211 tests. Backend and frontend production builds passed; the frontend emitted 132 routes. Prisma validation, migration status, zero schema diff, the 787-file removed-field scan, and disposable backup/restore parity across 20 critical tables all passed.

Reusable Phase 11 utilities and complete owning modules:

- `runSerializableTransaction` centralizes bounded retry and stable conflict mapping for PostgreSQL/Prisma serialization and uniqueness races. Programs, institute cycles, student progression, grade evidence, and archives reuse it rather than owning partial retry variants.
- `stableJsonStringify` provides recursive canonical JSON serialization for archive manifests/checksums and their regression tests.
- `phase11-release-scenario.ts` owns deterministic fixture construction and stable aliases; `phase11-critical-api-check.js` owns disposable-database safety and lifecycle; `phase11-files.service.ts` owns test-only local file behavior without changing production upload logic.
- Existing department-scope helpers remain the read-scope authority. `ProgramsService.assertProgramWriteScope` owns the stricter explicit-assignment rule for every sub-admin program write, including curriculum, stage, requirement, lifecycle, and cycle-array operations.

Resolved defect ledger:

- **P1 authorization:** sub-admin program writes could follow a broad department scope and reach an unassigned department. Program write authorization now requires an explicit `SubAdminDepartment` assignment for the source and target department; organization admins retain organization-wide program control. One HTTP regression traverses every nested program write path.
- **P1 authorization:** the institute-cycle controller exposed global cycle writes to sub-admins although cycles are organization-wide. Create/update/status/delete are now organization-admin-only, while permitted reads remain scoped.
- **P1 archive verification:** semantically identical PostgreSQL `jsonb` key reordering could make a newly built archive fail its own checksum. Canonical JSON serialization now makes write-time and verify-time checksums stable.
- **P1 concurrency:** raw adapter serialization/unique errors escaped several critical transactions as 500 responses. The shared retry utility now recognizes Prisma and adapter error shapes, retries bounded serialization conflicts, and maps exhausted/unique races to `409 Conflict`.
- **P2 program form:** `/programs/create` inherited `PageShell` overflow hiding and could not scroll. The form now owns an overflow scroll container, uses concise explanation headers before identity, progression, curriculum/cycle, and admissions areas, improves empty-stage guidance, and hides inline institute-cycle creation from sub-admins. Focused lint and the frontend production build pass.

## Phase 12: Release Candidate Certification and Production Launch

Objective: certify one immutable release candidate against production configuration and deployment behavior, complete narrow scalability/clean-code refactors discovered by the audit, rehearse staging and recovery, and produce an explicit human go/no-go record. Phase 12 is feature-frozen: only release-blocking fixes with regression coverage may change the candidate.

### Phase 12A: Release Freeze and Architecture Audit

- Review repository, dependency, container, environment, migration, runtime-startup, health, authorization, file-storage, real-time, and observability boundaries.
- Measure coupling in the new program/cycle/progression/archive modules and extract only complete ownership contracts; do not split a business invariant between old and new services merely to reduce line counts.
- Record process-local or provider-dependent constraints that cannot be solved honestly without new infrastructure.

Status: complete. The audit found secret-bearing files entering Docker context, `DATABASE_URL` passed as an image build argument, per-replica migration execution, divergent HTTP/WebSocket/auth origin rules, unconditional startup admin work, implicit database-pool sizing, missing health probes, process-local real-time presence/rate limiting, and no executable production runbook.

### Phase 12B: Scalability and Clean-Code Refactor

- Centralize exact origin parsing/matching and reuse it for HTTP CORS, WebSocket CORS, and sensitive auth-origin checks.
- Centralize typed production environment validation with numeric bounds, HTTPS/cookie/JWT requirements, conditional integration/bootstrap requirements, and a built-artifact CLI.
- Make database pool sizing explicit per replica.
- Make first-super-admin provisioning explicit, one-time, transaction-serialized, and free of repeated password hashing after creation.
- Add minimal public liveness and database readiness endpoints without exposing infrastructure details.
- Replace the container boundary with multi-stage, non-root backend/frontend images; exclude secrets and local artifacts; retain automatic Prisma migration startup for the existing single-replica Northflank deployment; add health checks. Move migrations to a release job before enabling multiple backend replicas.

Status: implementation complete. New focused tests cover origin matching, environment validation, pool sizing, bootstrap behavior, and health failure redaction. Horizontal backend scaling remains intentionally disabled for launch until Socket.IO and throttling receive tested shared stores; initial production must run one backend replica.

### Phase 12C: Security, Configuration, and Dependency Audit

- Scan tracked source and container definitions for credential/private-key patterns and unsafe production defaults.
- Audit production dependencies, CORS/origin behavior, auth cookies, startup credentials, upload/storage settings, database limits, and optional integrations.
- Verify real production values only through the platform secret manager and `npm run release:env-check`; never commit or print values.

Status: local code/dependency audit complete. Backend and frontend production dependency audits report zero known vulnerabilities at the high-severity gate, tracked secret-pattern scans are clean, and `.env.example` inventories are present. Actual production secrets, domains, TLS, storage, mail, OAuth, push, AI, billing, and alerting remain external go/no-go checks because their credentials are not available in this workspace.

### Phase 12D: Automated Staging and Release Rehearsal

- Rerun clean init, migration status/diff, critical APIs, populated preflight, concurrency, performance, restore parity, all tests, lint, and both builds from the frozen candidate.
- Build and scan backend/frontend images, deploy them to production-like staging, run migration exactly once, verify probes, restart persistence, and restore a staging backup.

Status: local automated rehearsal complete. The critical HTTP lane passed 20/20 scenarios, including health probes, against the disposable clean init with zero preflight blockers. The full backend passed 47 suites/228 tests; backend and frontend production builds passed; frontend lint passed; both production dependency audits reported zero vulnerabilities; Prisma validation, migration status, zero schema diff, the 797-file removed-field scan, and 20-table restore parity passed. Backend-wide lint was made non-mutating and narrowed away from generated Prisma output, but its final rerun was stopped at the user's request and is not represented as passing. Container-image build/scan and deployed staging rehearsal require Docker/deployment infrastructure not installed or connected in this workspace.

### Phase 12E: Manual UAT and Operational Signoff

- The user-owned browser pass covers all roles, assigned/unassigned department permissions, full program creation scrolling/stages, shared/standalone cycles, student major/progression, delivery, grading evidence, archives, past records, and error/responsive states.
- Named release/database/infrastructure/UAT owners complete the go/no-go record in `production-release-runbook.md`.

Status: checklist prepared; manual execution intentionally remains user-owned and is not represented as complete.

### Phase 12F: Production Deployment and Observation

- Validate the exact production environment inside the built artifact, record immutable image digests and backups, run the migration job once, run preflight, deploy one healthy backend replica and the frontend, perform tenant/permission/public/file/WebSocket smoke tests, and observe logs/errors/resources.
- Rollback before real data may recreate the empty database. Once real data exists, preserve it and use schema-compatible image rollback or a forward fix; archived data never becomes mutable.

Gate: production is no-go until all automated evidence is green, images/staging are certified, manual UAT passes, external integrations and monitoring are verified, there are no open P0/P1 or unaccepted P2 issues, and every named approval field in `production-release-runbook.md` is complete.

Phase 12 local status: complete. Production status: **NO-GO pending external certification**. Required remaining actions are the backend lint rerun, immutable container build/scan, production-like staging migration/restart/restore rehearsal, real production environment and integration validation, user-owned browser UAT, monitoring/alert verification, and signed go/no-go record. Initial production is limited to one backend replica until shared Socket.IO and throttling stores are implemented and tested.

## Authorization Matrix

- `ORG_ADMIN`: full institute-cycle lifecycle, program/curriculum, program-cycle relationship, progression, archive, and past-record access within the organization.
- `SUB_ADMIN`: manage programs, curricula, relationships to existing cycles, progression, and permitted records only within configured department scope. Institute-cycle create/activate/complete/archive and inline-new-cycle actions are denied unless a separate existing global permission explicitly grants them.
- `ORG_MANAGER`: read by default; progression approval/archive permission must be explicitly granted by existing product semantics before enabling writes.
- `TEACHER`: view program context and live/past records only for assigned sections; grade and answerbook actions follow assignment and lifecycle rules.
- `STUDENT`: view own active/history records and released answerbooks only.
- `GUARDIAN`: view linked student's permitted records and released answerbooks only.
- `FINANCE_MANAGER`: no academic structure/archive write access; no access unless an existing finance workflow needs a program label.
- Platform roles follow existing organization-access rules and every action remains audited.

Client-side hiding is convenience only. Controllers/services must enforce role, organization, department scope, ownership/assignment, and lifecycle independently.

## Migration, Deployment, and Rollback Runbook

1. During development, create one forward migration per phase and reset/reseed local/test databases whenever a breaking schema phase lands.
2. For every phase, apply migrations to an empty disposable database, run `prisma validate`, verify database/schema diff is empty, run preflight, all tests, and both builds.
3. Do not create data-migration or compatibility scripts. Fixtures and seed data are regenerated against the new schema.
4. Retain `programs-preflight.js` and `programs-backup-restore-check.js` as verification utilities, not migration scripts. The preflight opens a read-only source transaction; the restore check writes only to a uniquely named local disposable database and deletes it after comparison. Neither rewrites source rows.
5. Before the first production release, squash the clean baseline plus all program-phase migrations into one final init migration and reset every non-production environment against it.
6. Run `npm run programs:restore-check` and a synthetic production-scale seed against the final init; record migration duration, query plans, archive duration, and snapshot/file counts.
7. Perform one full dress rehearsal: create shared cycles and multiple programs, admit/progress students, deliver standalone and mapped sections, archive a completed cycle, verify past-record searches and answerbook retention, then wipe the rehearsal database.
8. Deploy the final schema and application together to the empty production database; seed only required platform/configuration records, never development demo records.
9. Before real data exists, rollback means reverting the release and recreating the empty database from the prior init. After real data exists, use forward-only migrations and backups under a separately approved production migration policy.
10. Never roll back an `ARCHIVED` cycle to mutable state. Any future correction creates an append-only archive revision.

## Test Matrix and Release Gates

Required automated coverage:

- clean init reproducibility, migration status, zero schema diff, reset/reseed, and disposable restore parity
- program create rejects zero rows and accepts one/many rows, mixed existing/new modes, server-derived count/order, duplicate same-program selection, inline-new code conflict, shared-cycle reuse, mode-specific authorization, and full rollback
- independent cycle create/activate/deliver with zero program associations and mixed standalone/program delivery in one cycle
- program cycle-array add/remove/reorder concurrency, immutable configuration revisions, and existing student-plan isolation
- student assignment atomically copies the exact cycle plan/count/hash and rejects configuration drift
- tenant and department-scope isolation for every new endpoint
- lifecycle transition concurrency and partial unique constraints
- missing classification/program relationship validation and explicit standalone requests
- cohort auto-enrollment/removal and reassignment history parity
- curriculum freeze and program transfer immutability
- section/assessment destructive-action protection
- every direct and indirect archived-cycle writer
- archive count/checksum/file verification and retry
- snapshot schema-version rendering
- transcript/GPA parity before and after program links
- answerbook upload/access/delete/finalize/archive behavior
- all requested past-record search/filter flows
- admission-safe offering eligibility, shared-cycle reuse, DTO stability, and submitted-application snapshot contract tests when that model is introduced

Required release evidence per phase:

- backend unit/integration tests pass
- backend and frontend builds pass
- migration rehearsal report is attached
- API contract diff is reviewed
- activity logs contain actor/resource/reason for sensitive transitions
- clean database reset/reseed and release rollback path are demonstrated before production enablement

## Observability and Audit Events

Record at least: `program_created`, `program_status_changed`, `program_cycle_associated`, `program_cycle_association_reactivated`, `program_cycle_association_retired`, `program_cycle_array_changed`, `program_configuration_revision_created`, `academic_cycle_created`, `curriculum_activated`, `curriculum_retired`, `cohort_program_mapped`, `student_program_admitted`, `student_program_cycle_plan_snapshotted`, `student_program_transferred`, `stage_attempt_changed`, `student_program_completed`, `cycle_completed`, `cycle_archive_started`, `cycle_archive_failed`, `cycle_archived`, `answerbook_reference_changed`, `answerbook_uploaded`, and `answerbook_deleted`.

Metrics/logs must include program-create transaction failures, duplicate/invalid association conflicts, inline-new cycle-code conflicts, configuration-version conflicts, program/current-array count mismatches, student cycle-plan snapshot mismatches, archive duration, rows/files snapshotted, checksum failures, lifecycle write denials by endpoint, standalone/program-mapped cohort and section counts, answerbook upload failures/orphans, past-record query latency, and snapshot schema versions in use. Never log answerbook contents or sensitive student payloads.

## Explicitly Deferred

- full online admissions/application workflow
- multiple simultaneous active program enrollments, double majors, minors, concentrations
- automated prerequisites, equivalency, transfer-credit, degree audit, or graduation audit
- CLO/PLO/OBE/accreditation management
- cross-institution transfer automation
- archived-record mutation or ordinary unarchive
- retroactively associating/classifying an already `ARCHIVED` cycle; this requires a separately designed append-only archive revision workflow

## Final Definition of Done

The initiative is complete only when program creation supports a transactional `+`-driven ordered relationship array mixing eligible existing and inline-new institute cycles; one cycle can be reused by many programs without duplication; a cycle with zero programs can still be activated and deliver standalone courses; every cohort/section is explicitly standalone or program-mapped; the server-derived count always matches the program's association array; configuration revisions preserve later program changes; a student's exact association/cycle plan is snapshotted and demonstrably survives every semester/year until program completion; archiving one shared cycle freezes all program-aware and standalone delivery in verified immutable snapshots with retained files; all requested past-record paths work; answerbook evidence is optional and correctly authorized; the final clean init reproduces the complete schema; destructive history loss is prevented; audits and metrics are present; and every phase gate above has documented evidence.
