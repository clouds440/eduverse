# Programs and Academic Cycles Redesign Audit

Status: implemented; automated release verification in progress.

## Implementation checkpoint

### Gate A: Backend domain cutover - complete (August 10, 2026)

- Folded backend foundations from Phases 0-4: stable program/curriculum stages, independent academic cycles, program and stage offerings, stable cohorts and cohort offerings, many-to-many section delivery links, long-lived student majors, actual stage enrollments, and historical cohort memberships.
- Removed the old Prisma entities and write contracts for `ProgramAcademicCycle`, `StudentProgramEnrollmentCycle`, `StudentStageAttempt`, and `CohortMembershipHistory`.
- Updated backend consumers, imports, public admissions offerings, copy-forward, reassignment, transcript reads, and archive schema version 2 to use the new identities.
- Removed the organization-wide single-active-cycle restriction.
- Rebuilt the single development init migration from the redesigned schema; no compatibility migration or data backfill was added.
- Verification: Prisma schema validation, backend production build (including docs compilation), and focused program/admission/archive domain tests pass.

### Gate B: Operator workflows and progression - complete (August 10, 2026)

- Rebuilt Program, Program Offering, Cohort Offering, Section Mapping, Student Placement, and Past Records workflows against the redesigned contracts.
- Added lifecycle/readiness controls, durable major and stage timelines, evidence-based progression previews, policy snapshots, overrides, and atomic stage advancement.
- Added sequential, credit-accumulation, flexible, and manual evaluators plus final-stage, requirements, credits, and manual completion evaluation.
- Added a department-scoped progression workbench with preview, row-level outcomes, explicit overrides, immutable decisions, and idempotent apply requests.
- Updated imports, public admissions offerings, archive schema/indexes, clean init migration, stale-field checks, and operator documentation.

### Gate C: Automated hardening - complete (August 10, 2026)

- Full backend suite passes (50 suites, 219 tests), including academic identity, progression evidence, evaluator, authorization, archive, import, and bulk idempotency coverage.
- Backend and frontend production builds pass; the frontend emits the progression workbench and student enrollment routes successfully.
- Database preflight checks stable/temporal tenant consistency, pinned progression policy validity, progression decision targets, archive readiness, and bulk-operation ledger state.
- Browser acceptance remains intentionally manual and is not a release blocker requested from this implementation pass.

Date: August 2026

## Executive decision

The current programs implementation should not be extended in place. Its central relation is backwards: `ProgramStage` is required to belong to one `ProgramAcademicCycle`, which makes a stable curriculum position depend on a calendar period. That decision propagates into program creation, curriculum activation, admissions, cohorts, section mapping, progression, imports, public offerings, and archives.

The replacement must make curriculum stages stable and introduce explicit time-bound offerings:

```text
Program
  -> CurriculumVersion
    -> ProgramStage
      -> StageCourseRequirement

AcademicCycle
  -> ProgramOffering (Program + CurriculumVersion + AcademicCycle)
    -> ProgramStageOffering (ProgramOffering + ProgramStage)
      -> SectionProgramMapping (ProgramStageOffering + requirement + Section)
      -> CohortOffering (Cohort + ProgramStageOffering, or standalone cycle context)

Student
  -> StudentProgramEnrollment (long-lived major)
    -> StudentStageEnrollment (one actual stage attempt in one stage offering)
      -> Enrollment (optional link to delivered sections)
    -> StudentProgressionDecision
```

This is an intentionally breaking redesign. The project currently has one clean init migration and the stated data policy permits development data to be wiped. The implementation should therefore replace the init schema and reset non-production databases instead of adding compatibility tables, backfill scripts, dual reads, or transitional API behavior.

## 1. Current architecture summary

The current implementation has five layers, but two of them are conflated:

1. `Program` stores department ownership, progression/completion metadata, an exact `requiredCycleCount`, admissions visibility, and a configuration version.
2. `ProgramAcademicCycle` stores an ordered list of real institute academic cycles for the program. Its `sequence` is treated as the program progression sequence.
3. `CurriculumVersion` belongs to a `ProgramConfigurationRevision`; each `ProgramStage` belongs both to the curriculum and to exactly one `ProgramAcademicCycle`.
4. `Cohort` and `SectionRequirementMapping` repeat that program-cycle-stage context for delivery.
5. `StudentProgramEnrollment` snapshots the complete program cycle array at admission into `StudentProgramEnrollmentCycle` rows. Progression operates on those pre-created calendar rows.

Academic cycles themselves are institute records and can be shared by programs, which is correct. The error is that the program's stable stage sequence is represented by an ordered list of those real cycles. The code consequently assumes:

- one program stage equals one academic cycle;
- one program can expose at most one stage in a given cycle;
- all future cycles are known when a program is created;
- all future student cycle placements are known at admission;
- repeating a stage means reopening the same student-cycle row;
- changing the program structure means replacing its cycle array.

The archive implementation is comparatively strong: it creates checksummed cycle snapshots and locks referenced files. It must be extended to snapshot the new offering and progression entities, and decoupled from required live source records.

## 2. Current entity relationship map

```text
Organization
  -> Department
    -> Program (required departmentId)
      -> ProgramConfigurationRevision
        -> CurriculumVersion
          -> ProgramStage
            -> StageCourseRequirement -> Course
      -> ProgramAcademicCycle -> AcademicCycle

ProgramStage
  -> required ProgramAcademicCycle  [incorrect stable-to-temporal ownership]

AcademicCycle
  -> Cohort
     -> optional ProgramAcademicCycle
     -> optional ProgramStage
     -> Student.cohortId (single current pointer)
  -> Section -> Course
     -> optional Cohort (one cohort only)
     -> SectionRequirementMapping
        -> ProgramAcademicCycle
        -> StageCourseRequirement -> ProgramStage

Student
  -> StudentProgramEnrollment -> Program + CurriculumVersion + configuration revision
     -> StudentProgramEnrollmentCycle
        -> ProgramAcademicCycle + AcademicCycle + ProgramStage + optional Cohort
        -> StudentStageAttempt
     -> Enrollment -> Section

AcademicCycle
  -> AcademicCycleArchive
     -> AcademicCycleArchiveSection -> required live Section
     -> AcademicCycleArchiveStudentIndex -> required live Student
     -> program indexes and immutable payload JSON
```

Important current constraints:

- `ProgramAcademicCycle`: unique `(programId, academicCycleId)`.
- `ProgramStage`: unique `(curriculumVersionId, programAcademicCycleId)`.
- `StudentProgramEnrollmentCycle`: unique enrollment plus academic cycle, program academic cycle, and sequence.
- `Enrollment`: unique `(studentId, sectionId)`.
- `Cohort` and `Section` each require one academic cycle.
- Most program-domain foreign keys use `onDelete: Restrict`; core `Course`, `Section`, `Student`, and department support models still contain several cascades.

## 3. Intended domain model

### Stable definitions

- `Department`: organizational ownership and permission scope. It does not define progression.
- `Course`: reusable teachable subject. Its department is optional ownership, not an eligibility wall.
- `Program`: durable course offering/qualification and long-term student major.
- `CurriculumVersion`: immutable-on-activation version of a program curriculum.
- `ProgramStage`: stable ordered curriculum position inside a curriculum version. It has no academic cycle foreign key.
- `StageCourseRequirement`: required, elective, or optional course expectation for a stage.
- `Cohort`: durable named group identity. It has no required cycle or current stage.

### Time-bound operational context

- `AcademicCycle`: institute calendar period. Multiple programs and multiple stages of one program may use it.
- `ProgramOffering`: activation of one program/curriculum version in one academic cycle.
- `ProgramStageOffering`: activation of one stable program stage within a program offering.
- `CohortOffering`: activation/placement of a cohort in an academic cycle, optionally against a program stage offering. A null stage offering means standalone grouping.
- `Section`: actual course delivery group in an academic cycle.
- `SectionProgramMapping`: declares which stage requirement(s) and stage offering(s) a section satisfies. A section can serve multiple cohorts or programs.
- `CohortOfferingSection`: many-to-many section suggestion/assignment for a cohort offering.

### Student history

- `StudentProgramEnrollment`: long-lived major, pinned to a curriculum version. It may be created before a cycle offering exists.
- `StudentStageEnrollment`: an actual attempt at a stage in a specific stage offering. Repeating later creates another row; it never mutates the old attempt into a new period.
- `StudentCohortMembership`: dated membership in a cohort offering. Current cohort is derived from the open membership.
- `StudentProgressionDecision`: auditable outcome such as advance, repeat, pause, transfer, or complete, with source attempt, target stage, optional target offering, reason, actor, and policy/result snapshot.
- `Enrollment`: actual section registration, optionally attributable to a student stage enrollment and source cohort membership.

### Domain invariants

1. A program, curriculum, and stages can exist without any academic cycle.
2. A cycle can exist without any program offering.
3. A program stage can be offered in many cycles.
4. One cycle can offer many stages of the same program.
5. Admission does not create future calendar records.
6. An in-progress stage enrollment must reference an open stage offering in an open academic cycle.
7. Historical attempts, decisions, memberships, and archives are append-only after closeout.
8. Automation suggests or creates predictable records but every bulk action has preview, conflict reporting, and explicit override behavior.

## 4. Dependency flaws found

### F-01: Program stages permanently depend on academic cycles

- **Priority:** Critical
- **Affected files:** `backend/prisma/schema.prisma:2430`, `backend/prisma/schema.prisma:2511`, `backend/src/programs/programs.service.ts:388`, `backend/src/programs/dto/curriculum.dto.ts:47`, `frontend/types/index.ts:3532`, `frontend/components/programs/ProgramCycleArrayEditor.tsx:50`
- **Current behavior:** Every `ProgramStage` requires `programAcademicCycleId`. One cycle row is created or selected for each stage.
- **Why flawed:** A stage is a stable curriculum position; an academic cycle is a calendar period. Their lifetimes and cardinalities differ.
- **Failure scenario:** Semester 1 is first offered in Fall 2026. The next intake also needs Semester 1 in Fall 2027, but the stage is permanently attached to Fall 2026.
- **Recommended design:** Remove `programAcademicCycleId` from `ProgramStage`. Add `ProgramOffering` and `ProgramStageOffering`.
- **Schema change:** Yes.
- **Migration:** Yes, through clean-init schema replacement.
- **Breaking:** Yes.

### F-02: Program creation requires real current/future academic cycles

- **Priority:** Critical
- **Affected files:** `backend/src/programs/dto/program.dto.ts:87`, `backend/src/programs/programs.service.ts:232`, `backend/src/programs/programs.service.ts:325`, `backend/src/programs/programs.service.ts:554`, `frontend/lib/schemas.ts:242`, `frontend/components/programs/ProgramForm.tsx:277`
- **Current behavior:** `CreateProgramDto` requires at least one cycle; each row either selects or creates an institute cycle and embeds a stage.
- **Why flawed:** Long-lived program structure cannot be defined until calendar records exist. Inline cycle creation also puts institute calendar administration inside program setup.
- **Failure scenario:** An administrator defines a four-year program before next year's calendar is approved. The program cannot be saved without inventing future cycles and dates.
- **Recommended design:** `POST /org/programs` creates only program metadata. Curriculum and stage setup is resumable. Offerings are configured later from a cycle workspace.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-03: Required cycle count, stage count, and duration are duplicated

- **Priority:** High
- **Affected files:** `backend/prisma/schema.prisma:2391`, `backend/prisma/schema.prisma:2458`, `backend/src/programs/programs.service.ts:473`, `backend/src/programs/programs.service.ts:953`, `frontend/types/index.ts:3580`
- **Current behavior:** `Program.requiredCycleCount`, revision `requiredCycleCount`, cycle snapshot length, association sequences, and stage sequences all represent the same expected progression length.
- **Why flawed:** These values can diverge and incorrectly imply that duration in cycles is identical to number of stages.
- **Failure scenario:** A credit-based student takes two stages' courses in one term or repeats a stage. The stored cycle count no longer represents duration or completion.
- **Recommended design:** Derive stage count from the curriculum. Keep optional estimated duration as descriptive metadata. Completion comes from explicit rules and progression decisions.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-04: One program can expose only one stage in a cycle

- **Priority:** Critical
- **Affected files:** `backend/prisma/schema.prisma:2452`, `backend/prisma/schema.prisma:2537`, `backend/src/programs/programs.service.ts:433`, `backend/src/programs/programs.service.ts:756`
- **Current behavior:** There is one `ProgramAcademicCycle` per program/cycle and one stage per curriculum/association.
- **Why flawed:** Universities and schools commonly teach multiple intakes or grades of the same program in the same institute cycle.
- **Failure scenario:** In Fall 2027, one BSCS intake is in Semester 1 while another is in Semester 3. Only one of those stages can map to the BSCS/Fall 2027 association.
- **Recommended design:** One `ProgramOffering` per program/curriculum/cycle with many `ProgramStageOffering` rows.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-05: Admission pre-allocates the student's entire future calendar

- **Priority:** Critical
- **Affected files:** `backend/prisma/schema.prisma:2587`, `backend/prisma/schema.prisma:2633`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:78`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:162`, `backend/src/org/dto/create-student.dto.ts:17`, `frontend/app/(org)/users/students/edit/[id]/enrollment/page.tsx:270`
- **Current behavior:** Admission copies every active program-cycle association into future `StudentProgramEnrollmentCycle` rows, including dates and one stage per cycle.
- **Why flawed:** Future calendars, breaks, transfer credit, repeats, pauses, and offering availability are unknown at admission.
- **Failure scenario:** A student pauses for one year. Their Spring 2027 and Fall 2027 plan rows remain fixed even though the student resumes in Fall 2028.
- **Recommended design:** Admission stores program, curriculum version, and optional entry stage only. Create a `StudentStageEnrollment` when the student is placed into a real stage offering.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-06: Repeat reuses the old cycle instead of scheduling a new attempt

- **Priority:** Critical
- **Affected files:** `backend/src/student-program-enrollments/student-program-enrollments.service.ts:1013`, `backend/prisma/schema.prisma:2666`, `frontend/app/(org)/users/students/edit/[id]/enrollment/page.tsx:290`, `backend/src/common/academic-cycle-write-policy.ts:9`
- **Current behavior:** Repeat creates another `StudentStageAttempt` under the same student cycle row and requires the original academic cycle to accept delivery writes.
- **Why flawed:** A repeated stage normally occurs in a later cycle. Completed or archived cycles are immutable and cannot host a new delivery attempt.
- **Failure scenario:** A student fails Fall 2026 after the cycle is completed. In Spring 2027, Repeat still targets Fall 2026 and is rejected by the cycle write policy.
- **Recommended design:** A repeat decision points to the same stable stage and later creates a new `StudentStageEnrollment` against a different stage offering.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-07: Cohort identity and cycle placement are the same record

- **Priority:** High
- **Affected files:** `backend/prisma/schema.prisma:2219`, `backend/prisma/schema.prisma:804`, `backend/src/cohorts/cohorts.service.ts:119`, `backend/src/cohorts/cohorts.service.ts:309`, `frontend/components/cohorts/CohortFormPage.tsx:24`
- **Current behavior:** A cohort requires `academicCycleId` and optionally owns program association and stage fields. `Student.cohortId` is a single mutable current pointer.
- **Why flawed:** A durable group may progress through cycles. Current placement overwrites student state, while the cohort record itself cannot be reused naturally.
- **Failure scenario:** "BSCS Intake 2026 A" moves from Semester 1 in Fall 2026 to Semester 2 in Spring 2027. The operator must mutate or recreate the cohort and reconcile every student and section.
- **Recommended design:** Keep `Cohort` stable. Add `CohortOffering` and `StudentCohortMembership`; derive current placement from open memberships.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-08: Section mapping lacks a stage-offering context

- **Priority:** High
- **Affected files:** `backend/prisma/schema.prisma:737`, `backend/prisma/schema.prisma:2567`, `backend/src/sections/sections.service.ts:60`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:802`, `frontend/app/(org)/sections/create/page.tsx:326`
- **Current behavior:** A section is marked `STANDALONE` or `PROGRAM_MAPPED`; mapped sections point to requirements plus `ProgramAcademicCycle`.
- **Why flawed:** The mapping cannot distinguish two stage offerings of the same program in one cycle and duplicates classification state that is derivable from mappings.
- **Failure scenario:** One shared Calculus section serves Semester 1 students from two curricula and a standalone learner group. The binary classification and one program-cycle context cannot express the real delivery.
- **Recommended design:** Keep Section as the delivery group. Add many `SectionProgramMapping` rows referencing a `ProgramStageOffering` and requirement. Derive standalone status from no mappings.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-09: Section-to-cohort ownership is too rigid

- **Priority:** High
- **Affected files:** `backend/prisma/schema.prisma:737`, `backend/src/cohorts/cohorts.service.ts:387`, `backend/src/sections/sections.service.ts:354`, `frontend/components/cohorts/CohortFormPage.tsx:112`
- **Current behavior:** `Section.cohortId` permits one cohort, while cohort updates also connect and disconnect sections as if the cohort owns them.
- **Why flawed:** Shared lectures, cross-listed sections, electives, and manual overrides routinely serve multiple cohorts.
- **Failure scenario:** Two cohorts attend the same lecture but separate tutorials. The lecture can be attached to only one cohort, so automation enrolls only half the students.
- **Recommended design:** Add `CohortOfferingSection` many-to-many links with `AUTO`, `SUGGESTED`, or `MANUAL` source and preserve direct manual student enrollment.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-10: Department ownership is an academic eligibility wall

- **Priority:** High
- **Affected files:** `backend/src/programs/programs.service.ts:296`, `backend/prisma/schema.prisma:504`, `backend/prisma/schema.prisma:2391`, `frontend/components/programs/ProgramForm.tsx:217`
- **Current behavior:** Every stage course must have the same department as the program. Program ownership also drives the student's primary department.
- **Why flawed:** Department ownership is useful for responsibility and permissions, but interdisciplinary programs consume courses owned by other departments.
- **Failure scenario:** A Business Analytics program owned by Business needs Statistics from Mathematics and Programming from Computing. The curriculum validator rejects both.
- **Recommended design:** Keep one owning department on Program. Permit requirements from any organization course, with optional explicit cross-department approval/visibility policy. Derive a student's default primary department from the major but allow audited override where policy permits.
- **Schema change:** Possibly for a `ProgramCourseDepartmentApproval` policy; removal of the current service restriction is required.
- **Migration:** Yes if the approval entity is added; otherwise no data conversion.
- **Breaking:** Yes for validation and permission behavior.

### F-11: Only one academic cycle may be active organization-wide

- **Priority:** High
- **Affected files:** `backend/src/academic-cycles/academic-cycles.service.ts:115`, `backend/src/academic-cycles/academic-cycles.service.ts:343`, `backend/src/academic-cycles/academic-cycles.service.ts:427`, `backend/src/cohorts/cohorts.service.ts:211`, `frontend/app/(org)/academic-cycles/page.tsx:489`
- **Current behavior:** Creating or activating a cycle fails if any other cycle is active; several queries assume one active cycle.
- **Why flawed:** Annual school periods, university terms, short courses, makeup periods, and overlapping campuses can coexist.
- **Failure scenario:** Academic Year 2026-27 remains active while Fall 2026 and an eight-week certificate term also need delivery writes.
- **Recommended design:** Permit multiple open cycles. Replace `getActiveCycle` assumptions with explicit cycle selection and an optional organization `defaultAcademicCycleId` convenience setting.
- **Schema change:** Small, if a default-cycle pointer is added.
- **Migration:** Yes through clean init.
- **Breaking:** Yes for APIs and UI queries that assume a singleton.

### F-12: Department authorization is not enforced across cohort and progression writes

- **Priority:** Critical
- **Affected files:** `backend/src/cohorts/cohorts.controller.ts:30`, `backend/src/cohorts/cohorts.service.ts:119`, `backend/src/student-program-enrollments/student-program-enrollments.controller.ts:28`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:319`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:420`
- **Current behavior:** Program CRUD applies department scope, but cohort create/list/get/delete do not receive the actor. Most hold/resume/withdraw/activate/complete/repeat operations receive only `actorId` and do not assert department scope. Transfer validates the target program department, not necessarily the student's current/source department.
- **Why flawed:** Controller role checks distinguish role type but not the sub-admin's assigned departments.
- **Failure scenario:** A sub-admin who obtains a student, enrollment, or cohort ID outside their department can alter progression or cohort state.
- **Recommended design:** Introduce one reusable `AcademicScopePolicy` and pass the actor to every academic read/write service. Validate all involved departments, including source and target on transfers and cross-department mappings.
- **Schema change:** No, unless explicit cross-department grants are added.
- **Migration:** No for policy enforcement.
- **Breaking:** Yes for currently over-permissive requests.

### F-13: Configuration revisions reuse mutable temporal identities

- **Priority:** High
- **Affected files:** `backend/src/programs/programs.service.ts:388`, `backend/src/programs/programs.service.ts:855`, `backend/prisma/schema.prisma:2430`, `backend/prisma/schema.prisma:2458`
- **Current behavior:** Reconfiguring cycles retires all associations, then upserts by `(programId, academicCycleId)` and can reactivate/resequence the same rows. A new curriculum is tied to the new configuration revision.
- **Why flawed:** Old and new configurations can refer to the same mutable association identity even though its sequence and status change. Curriculum versioning is also unnecessarily coupled to cycle-plan versioning.
- **Failure scenario:** An old student's snapshot points to an association later reactivated at a different sequence, making live joins disagree with stored snapshots and archive indexes.
- **Recommended design:** Curriculum versions own stable stages and become immutable when active. Offerings are append-only contextual records. Revisions snapshot program policy only, not future cycle arrays.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-14: Progression modes are metadata, not implemented domain behavior

- **Priority:** Critical
- **Affected files:** `backend/prisma/schema.prisma:2314`, `backend/prisma/schema.prisma:2321`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:877`, `backend/src/student-program-enrollments/student-program-enrollments.service.ts:1106`, `frontend/app/(org)/users/students/edit/[id]/enrollment/page.tsx:270`
- **Current behavior:** Completion counts required cycle rows. `progressionMode` and `completionMode` do not choose different evaluators. There is no first-class advance/fail decision record, and `completeCycle` always marks an attempt completed.
- **Why flawed:** Sequential, credit accumulation, flexible, requirements-based, and manual programs require different eligibility and completion calculations.
- **Failure scenario:** A credit-based student reaches the required credits without completing every predefined cycle row but cannot complete the program. Conversely, a skipped row may count as completed without satisfying course requirements.
- **Recommended design:** Add pluggable progression/completion evaluators that return recommendations and blockers, plus an immutable `StudentProgressionDecision` for the operator's final action and override reason.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Yes.

### F-15: Imports and public offerings duplicate the invalid cycle-first contract

- **Priority:** High
- **Affected files:** `backend/src/imports/imports.service.ts:900`, `backend/src/program-offerings/program-offerings.service.ts:20`, `backend/src/program-offerings/program-offerings.service.spec.ts:22`, `frontend/lib/api.ts:1446`
- **Current behavior:** Imports resolve a stage through program + curriculum + academic cycle. Public admissions only expose programs whose exact cycle count and one-stage-per-cycle map is complete.
- **Why flawed:** Secondary interfaces harden the wrong model and will silently reintroduce it if only core CRUD is redesigned.
- **Failure scenario:** A valid program with stages but no future offering cannot be imported or advertised, even though admissions should be able to accept a student before timetable placement.
- **Recommended design:** Imports resolve stable program/curriculum/stage independently, with optional offering columns for immediate placement. Public offerings separate program availability from optional entry-cycle/stage-offering availability.
- **Schema change:** Indirectly, through the new offering entities.
- **Migration:** API/import template replacement only; clean init for schema.
- **Breaking:** Yes.

### F-16: Historical archives do not fully own offering/progression history

- **Priority:** High
- **Affected files:** `backend/prisma/schema.prisma:2723`, `backend/prisma/schema.prisma:2752`, `backend/prisma/schema.prisma:2816`, `backend/src/academic-cycle-archives/academic-cycle-archives.service.ts:296`, `backend/src/past-records/past-records.service.ts:72`
- **Current behavior:** Section payloads and program labels are snapshotted, but archive section/student indexes retain required `Restrict` relations to live Section and Student records. There is no complete first-class snapshot of offering state and progression decisions.
- **Why flawed:** An immutable archive should remain readable from its own data and should describe why a student was in a stage, not only which section data happened to reference them.
- **Failure scenario:** Future cleanup cannot remove an obsolete live student/section because an archive requires it; alternatively, a progression decision not represented in section payloads is absent from Past Records.
- **Recommended design:** Store immutable source keys and labels without required live relations, snapshot program offerings, stage offerings, cohort offerings, stage enrollments, decisions, and section mappings, and index them for Past Records.
- **Schema change:** Yes.
- **Migration:** Yes.
- **Breaking:** Internal archive schema version increment.

## 5. Workflow flaws found

1. Program creation is a large all-or-nothing form containing program metadata, curriculum metadata, stages, courses, existing/new academic cycles, and admissions settings.
2. The operator must activate the curriculum, then activate the program, then activate the institute cycle, then create mapped cohorts/sections, then activate each student's preplanned cycle.
3. Programs cannot be saved as useful drafts before cycles exist, despite having a DRAFT status.
4. Cohort creation displays every student and section while mapped cohorts reject adding students during creation. This produces a visible option that the API forbids.
5. Section creation exposes internal "program association" and requirement IDs rather than a natural "this section fulfills these stage offerings" workflow.
6. Student progression is performed one student and one cycle row at a time. There is no cohort/cycle progression workbench, readiness report, bulk decision preview, or partial-failure report.
7. Assignment of a cohort may automatically activate a program cycle and enroll sections, but the operator does not receive a preview of records that will be created.
8. Manual section overrides exist, but their interaction with later cohort updates is difficult to predict because section ownership and enrollment source are spread across Cohort, Section, Enrollment, and exclusion flags.
9. Import templates require operators to understand the same fragile compound mapping used by the database.
10. Program status and curriculum status have hidden activation prerequisites surfaced only after an action fails.

## 6. Circular or fragile creation flows

### Current cycle

```text
Create Program
  requires AcademicCycle(s)
  requires Stage per AcademicCycle
  requires Course requirements
  creates draft Curriculum

Activate Curriculum
  requires exact stage-to-cycle coverage

Activate Program
  requires current active default Curriculum

Create Program-mapped Cohort
  requires active Program + active Curriculum + ProgramAcademicCycle + matching Stage

Create Program-mapped Section
  requires AcademicCycle + requirement mapping
  and may require a compatible mapped Cohort

Admit Student
  requires active Program + exact complete cycle plan + active default Curriculum

Place Student in Cohort
  requires pre-created StudentProgramEnrollmentCycle matching cycle + association + stage
```

There is no direct database cycle, but there is an operator dependency loop: delivery cannot be prepared until the program/curriculum/cycle mapping is complete, while the mapping forces real cycles to be chosen before future delivery is known.

### Replacement flow

```text
Department (optional organizational prerequisite)
  -> Program draft
    -> Curriculum draft
      -> Stages and requirements
        -> Activate curriculum/program when structurally ready

AcademicCycle draft (independent)
  -> Create ProgramOffering(s)
    -> Select ProgramStageOffering(s)
      -> Prepare CohortOffering(s)
      -> Create/map Sections

Student admission (can occur after program activation)
  -> optional immediate stage-offering placement
  -> optional cohort placement
  -> suggested section enrollments with operator preview
```

Every step can be saved and resumed. Missing later setup is shown as readiness work, not as a failed earlier entity creation.

## 7. Historical data risks

- Reusing `ProgramAcademicCycle` identities across configuration revisions allows live association metadata to drift from historical joins.
- `StudentProgramEnrollmentCycle` snapshots protect labels/dates but encode a future plan as historical fact before delivery occurs.
- `Student.cohortId` and cohort mutation represent current state separately from history and can disagree with open membership rows.
- A cohort cycle change updates open `CohortMembershipHistory.academicCycleId`, rewriting what should be historical context.
- A repeated attempt remains under the original academic cycle and can misstate when the repeat occurred.
- Archive source indexes require live Student and Section rows; the snapshot is not fully independent.
- Archive program context is inferred from cohort or section requirement mappings. Progression decisions without section presence can be omitted.
- Program completion stores a generic JSON result but not the rule evaluation, credits/requirements considered, overrides, or source decision chain.

Required remedy: activated definitions are immutable, operational records are append-only after closeout, current state is derived, and cycle archives snapshot all contextual entities plus policy/result evidence.

## 8. Incorrect ownership relationships

| Current owner | Owned data | Correct owner/context |
|---|---|---|
| `ProgramAcademicCycle` | Program stage sequence | `CurriculumVersion -> ProgramStage` |
| `ProgramConfigurationRevision` | Future cycle array | `ProgramOffering` records created per cycle |
| `Cohort` | Academic cycle and stage placement | `CohortOffering` |
| `Student` | Single current cohort | Open `StudentCohortMembership` |
| `StudentProgramEnrollment` at admission | Entire future cycle plan | Actual `StudentStageEnrollment` rows as delivery occurs |
| Old student-cycle row | Repeat attempt | New stage enrollment in a later stage offering |
| `Section` | One cohort | Many `CohortOfferingSection` links |
| Program department | Eligibility of every curriculum course | Ownership/permission scope plus explicit sharing policy |
| Live Student/Section | Archive identity | Archive-owned immutable source keys and snapshots |

## 9. Missing linking entities

### `ProgramOffering`

Fields: `id`, `organizationId`, `programId`, `curriculumVersionId`, `academicCycleId`, `status`, `opensAt`, `closesAt`, `capacity`, `notes`, audit fields.

Constraints:

- unique `(programId, curriculumVersionId, academicCycleId)`;
- curriculum must belong to program and organization;
- activated curriculum required before offering becomes OPEN;
- closing is blocked by unresolved stage enrollments unless an explicit closeout decision resolves them.

### `ProgramStageOffering`

Fields: `id`, `organizationId`, `programOfferingId`, `programStageId`, `status`, optional dates/capacity/instructor coordinator, audit fields.

Constraints:

- unique `(programOfferingId, programStageId)`;
- stage curriculum must equal offering curriculum;
- multiple stages of one program may be offered in one cycle;
- the same stage may appear in many program offerings over time.

### `CohortOffering`

Fields: `id`, `organizationId`, `cohortId`, `academicCycleId`, nullable `programStageOfferingId`, `status`, capacity, audit fields.

Constraints:

- stage offering cycle must equal cohort offering cycle;
- null `programStageOfferingId` means standalone context;
- one open placement per cohort/cycle by default, with an explicit split mode only if later required.

### `CohortOfferingSection`

Fields: `cohortOfferingId`, `sectionId`, `source`, `isDefault`, audit fields.

Constraints: section cycle must match cohort offering cycle; many cohorts may share one section.

### `SectionProgramMapping`

Fields: `sectionId`, `programStageOfferingId`, `stageCourseRequirementId`, mapping status, audit fields.

Constraints: section course must equal requirement course; requirement stage must equal stage offering stage; section cycle must equal offering cycle.

### `StudentStageEnrollment`

Fields: `id`, `studentProgramEnrollmentId`, `programStageId`, `programStageOfferingId`, `attemptNumber`, `status`, optional `cohortOfferingId`, started/completed timestamps, result/rule snapshots, actor IDs.

Constraints:

- stage must belong to the enrollment curriculum;
- stage offering must offer that stage;
- one in-progress stage enrollment per student program enrollment unless the program explicitly permits concurrent stages;
- repeats create new rows and never reopen closed rows.

### `StudentCohortMembership`

Fields: `studentId`, `cohortOfferingId`, `studentStageEnrollmentId`, joined/left timestamps, source, reason, actor IDs.

### `StudentProgressionDecision`

Fields: source stage enrollment, outcome enum, target stage, nullable target offering, recommendation snapshot, result snapshot, override flag/reason, actor, decidedAt.

Outcomes: `ADVANCE`, `REPEAT`, `PAUSE`, `TRANSFER`, `COMPLETE`, `WITHDRAW`, `REMAIN`.

## 10. Suggested schema changes

1. Remove `Program.requiredCycleCount` and cycle-plan fields from `ProgramConfigurationRevision`.
2. Keep optional descriptive duration fields; do not use them as completion truth.
3. Remove `ProgramAcademicCycle`; replace it with `ProgramOffering` and `ProgramStageOffering`.
4. Remove `ProgramStage.programAcademicCycleId`; keep unique stage code and sequence within curriculum.
5. Make activated `CurriculumVersion`, `ProgramStage`, and `StageCourseRequirement` immutable. New changes require cloning to a new draft curriculum version.
6. Replace `SectionRequirementMapping` with `SectionProgramMapping` referencing stage offerings.
7. Remove `Section.programClassificationStatus`; derive classification from mappings.
8. Remove `Section.cohortId`; add `CohortOfferingSection`.
9. Remove cycle/stage/program fields from `Cohort`; add stable Cohort plus CohortOffering.
10. Remove `Student.cohortId`; derive current membership.
11. Replace `StudentProgramEnrollmentCycle` and `StudentStageAttempt` with actual `StudentStageEnrollment` attempts and `StudentProgressionDecision`.
12. Keep `StudentProgramEnrollment` pinned to one curriculum version. Replace entry cycle/association fields with optional `entryStageId`; stage placement is a separate action.
13. Change Enrollment links to optional `studentStageEnrollmentId` and optional `studentCohortMembershipId`; retain `source` and manual exclusion semantics.
14. Permit cross-department course requirements, optionally guarded by explicit approval records.
15. Remove the singleton active-cycle invariant. Add optional `Organization.defaultAcademicCycleId` if the UI needs a default.
16. Add composite/transactional organization integrity checks for every contextual link. Prisma relations alone do not guarantee duplicated `organizationId` values agree.
17. Make archive source relations optional or remove them; retain immutable source keys and full snapshot labels.
18. Increment archive schema version and include offering, cohort membership, stage enrollment, and progression decision snapshots.
19. Use `Restrict` for referenced academic history, `SetNull` for optional live convenience links, and explicit service-led archival instead of cascade delete for academic records.

## 11. Suggested service and API changes

### Program definitions

- `POST /org/programs`: create basic draft program without cycles/curriculum requirement.
- `PATCH /org/programs/:id`: edit metadata and department ownership with history-aware rules.
- `POST /org/programs/:id/curricula`: create or clone a draft curriculum.
- `POST /org/curricula/:id/stages`: create stable stage without cycle fields.
- `POST /org/stages/:id/requirements`: attach organization courses.
- `GET /org/programs/:id/readiness`: return structured blockers and next actions.
- `POST /org/curricula/:id/activate`: validate stage/requirement structure and atomically activate.

Remove `eligible-cycles`, `replaceCycles`, and all DTO fields that embed stages under cycle rows.

### Cycle offerings

- `GET /org/academic-cycles/:cycleId/offerings`.
- `POST /org/academic-cycles/:cycleId/program-offerings` with program and curriculum.
- `POST /org/program-offerings/:id/stages/bulk` to activate selected stages.
- `PATCH /org/program-offerings/:id/status` and stage-offering status endpoints.
- `GET /org/academic-cycles/:cycleId/delivery-options` returns stage offerings, requirements, cohorts, capacity, and readiness.
- Add clone-from-previous-cycle preview/apply endpoints with idempotency keys.

### Cohorts and sections

- Cohort CRUD manages stable identity only.
- Cohort offering endpoints manage cycle/stage placement.
- Section mapping endpoints add/remove stage offering requirements.
- Cohort-section endpoints are many-to-many and return automation impact previews.
- All bulk operations return `{created, updated, skipped, conflicts, warnings}` rather than failing without row-level context.

### Student program lifecycle

- Admission DTO: `{programId, curriculumVersionId?, entryStageId?}`. No future cycle plan.
- Placement DTO: `{programStageOfferingId, cohortOfferingId?}` creates a stage enrollment.
- Progression preview endpoint evaluates grades, credits, requirements, attendance policy if configured, and existing decisions.
- Decision endpoint records outcome and optionally places into an existing target offering.
- Bulk progression endpoint works by stage offering/cohort with preview and per-student overrides.
- Transfer validates scope for source and target programs, closes current stage state, preserves all history, and opens the target major.
- Completion delegates to the configured evaluator and records the exact evidence and override.

### Shared policies and utilities

- `AcademicScopePolicy`: one source for role and department authorization.
- `AcademicLinkValidator`: validates organization, program, curriculum, stage, offering, cycle, cohort, course, and section consistency.
- `LifecycleStateMachine`: reusable transition matrices and immutable-state checks.
- `ProgressionEvaluatorRegistry`: sequential, credit, flexible, and manual evaluators.
- `AcademicSnapshotBuilder`: versioned archive and decision snapshots.
- `BulkOperationRunner`: dry run, idempotency, conflict collection, and partial result reporting.

## 12. Suggested UI and operator workflow changes

### Program workspace

Replace the single creation form with a resumable workspace:

1. **Overview:** name, code, owner department, structure, progression/completion policies, admissions metadata.
2. **Curriculum:** curriculum versions, stable stage builder, course requirements, validation.
3. **Offerings:** cycles in which stages are currently/past/future offered.
4. **Students:** admitted, active, on hold, completed, and transferred students.
5. **Readiness:** blockers with direct actions, not failed status-transition messages.

The first save should require only name, code, department, and structure type.

### Academic cycle workspace

Use the cycle page as the operational setup hub:

1. Select programs/curricula to offer.
2. Select one or more stages from each program.
3. Create/activate cohort offerings.
4. Generate suggested sections from required courses.
5. Assign teachers, rooms, and schedules.
6. Preview cohort-to-section automation.
7. Open delivery when readiness checks pass.

### Student admission and progression

- Admission selects program and curriculum; entry stage is optional and cycle placement is optional.
- A single "Place for cycle" action selects stage offering, cohort offering, and suggested sections together.
- The individual student page shows chronological stage attempts and progression decisions, not a fixed future cycle list.
- Add a cycle/stage "Progression workbench" for bulk advance/repeat/pause/complete decisions.
- Automation preview must show section enrollments to add/remove and preserve manual overrides.

### Reusable frontend modules

- `ProgramOverviewForm`
- `CurriculumVersionEditor`
- `ProgramStageBuilder`
- `ProgramReadinessPanel`
- `AcademicContextPicker`
- `ProgramOfferingBuilder`
- `StageOfferingSelector`
- `CohortOfferingEditor`
- `SectionProgramMappingEditor`
- `AutomationImpactPreview`
- `StudentStageTimeline`
- `ProgressionWorkbench`
- `BulkOperationResults`

Each module must own its complete domain action. Do not extract presentation fragments while leaving validation and API orchestration split across unrelated pages.

## 13. Automation opportunities

1. Clone selected program/stage offerings from a prior cycle without copying student state.
2. Generate draft sections from stage course requirements, with merge suggestions for shared courses.
3. Suggest cohort sections from required courses and capacity.
4. Place a whole cohort into a stage offering with a dry-run impact report.
5. Suggest section enrollments while preserving manual additions and exclusions.
6. Evaluate progression eligibility in bulk and show blockers/evidence.
7. Create next-cycle placements only after operator confirmation; never assume the next chronological cycle.
8. Flag admitted students without stage placement, open offerings without sections, sections without teachers/rooms, and cohorts over capacity.
9. Provide idempotent retry for all bulk creation and progression actions.
10. Archive preflight should report unresolved stage enrollments, unfinalized grades, missing checksums, and orphaned mappings in one actionable report.

## 14. Migration risks

The repository contains one init migration: `backend/prisma/migrations/20260804145000_init/migration.sql`. Per the project's stated no-backward-compatibility policy, the safest implementation is:

1. Freeze schema-changing work while the redesign lands.
2. Update `schema.prisma` and regenerate the single init migration.
3. Do not add program backfill scripts, compatibility views, dual-write services, or old/new DTO unions.
4. Reset disposable local, CI, staging, and development databases.
5. Deploy backend and frontend from the same commit after database reset.
6. Verify the database role owns/has privileges on `public` before Prisma deploy.
7. Seed a complete lifecycle fixture for both school and university models.

Risks even with a reset:

- generated Prisma client and frontend contracts can drift;
- archive payload schema readers must change with writers;
- imports and public admissions can retain old fields unnoticed;
- hidden singleton-active-cycle assumptions exist outside program modules;
- clean init SQL must be tested against an empty PostgreSQL database, not only Prisma mocks;
- API deployment before frontend deployment will break old forms immediately.

## 15. Backward compatibility concerns

Backward compatibility is intentionally not required for existing development data, but coordinated contract replacement is required.

Remove rather than deprecate:

- `ProgramAcademicCycle` and `StudentProgramEnrollmentCycle` contracts;
- cycle arrays inside program create/update requests;
- `programAcademicCycleId` from stages, cohorts, sections, imports, and frontend types;
- `entryAcademicCycleId` as a required admission mapping;
- `requiredCycleCount` completion logic;
- `ProgramClassificationStatus` stored on Cohort/Section when it is derivable;
- old public offering payloads and import columns.

The release must update backend DTOs/controllers, shared/frontend types, API client, UI, imports, tests, docs, seed data, and init migration in the same staged branch. Do not ship adapters that make both models writable.

## 16. Recommended implementation phases

### Phase 0: Contract lock and executable characterization

- Record this audit as the approved target model.
- Add failing domain tests for program-before-cycle, multiple stages in one cycle, later-cycle repeat, and deferred admission placement.
- Inventory every old field with a compile-time/search gate.
- Define enums, lifecycle matrices, and permission matrix.
- Reusable modules: `AcademicScopePolicy`, `AcademicLinkValidator`, test fixture builders.
- Exit gate: agreed schema diagram and failing target tests; no production logic changed.

### Phase 1: Stable definitions

- Rewrite Program, CurriculumVersion, ProgramStage, and StageCourseRequirement schema.
- Remove cycle arrays and required cycle count.
- Implement resumable program and curriculum APIs.
- Make activated curricula immutable and add clone-to-draft.
- Rebuild Program workspace Overview/Curriculum/Readiness.
- Reusable modules: stage validator, curriculum readiness evaluator, curriculum clone utility, stage builder components.
- Depends on: Phase 0.

### Phase 2: Academic-cycle offerings

- Add ProgramOffering and ProgramStageOffering.
- Remove singleton active-cycle restriction and add explicit/default cycle selection.
- Implement cycle offering CRUD, lifecycle, bulk stage activation, and delivery options.
- Build cycle setup workspace and offering builder.
- Reusable modules: lifecycle state machine, academic context picker, offering readiness panel.
- Depends on: Phase 1.

### Phase 3: Cohort and section delivery context

- Split stable Cohort from CohortOffering.
- Add CohortOfferingSection and SectionProgramMapping.
- Remove Section cohort/classification fields and old requirement mapping.
- Support shared sections and standalone sections naturally.
- Add previewable cohort-section automation.
- Reusable modules: delivery link validator, mapping editor, automation impact preview, bulk runner.
- Depends on: Phase 2.

### Phase 4: Student major and actual stage enrollment

- Keep StudentProgramEnrollment long-lived and curriculum-pinned.
- Replace future cycle plans with StudentStageEnrollment and StudentCohortMembership.
- Update admission, student creation, transfer, hold, resume, and placement APIs.
- Remove Student.cohortId and derive current state.
- Build StudentStageTimeline and "Place for cycle" flow.
- Reusable modules: student academic-state query, placement service, membership service.
- Depends on: Phases 1-3.

### Phase 5: Progression engine and bulk operations

- Add StudentProgressionDecision.
- Implement sequential, credit, flexible, requirements, and manual evaluators.
- Implement advance/repeat/pause/transfer/complete with immutable decisions.
- Build cycle/stage progression workbench with dry run and per-student override.
- Reusable modules: evaluator registry, evidence snapshot builder, bulk result component.
- Depends on: Phase 4.

### Phase 6: Permissions and cross-department behavior

- Apply AcademicScopePolicy to every program, offering, cohort, section, enrollment, progression, import, and archive endpoint.
- Validate source and target scope for transfers.
- Permit cross-department course requirements under an explicit policy.
- Add negative authorization tests for every role and nested write.
- Reusable modules: policy guards and scoped query builders established in Phase 0.
- Depends on: Phases 1-5 so no endpoint remains half-owned.

### Phase 7: Imports, admissions offerings, archive, and Past Records

- Replace import templates/resolvers with stable-stage and optional-offering columns.
- Separate public program availability from immediate cycle placement availability.
- Extend archive schema and snapshot builders for all new context and decisions.
- Remove required archive-to-live Student/Section dependencies.
- Update Past Records filters and detail views for program, stage, offering, cohort, and progression history.
- Reusable modules: typed import resolvers, archive schema version adapters, snapshot indexes.
- Depends on: Phases 2-6.

### Phase 8: Clean init migration and coordinated cutover

- Regenerate Prisma client and rewrite the single clean init migration.
- Reset all disposable environments; do not run legacy backfills.
- Update seeds with school and university lifecycle fixtures.
- Remove old types, routes, components, tests, scripts, and documentation references.
- Run database constraint tests, backend tests/build, frontend build, docs build, and critical API harness.
- Depends on: Phases 1-7.

### Phase 9: Hardening gate

- Concurrency tests for offering setup, bulk placement, progression, and archive.
- Idempotency/retry tests for bulk APIs.
- Cross-tenant and department-scope penetration tests.
- Archive checksum and future-definition-change tests.
- Query/index review using realistic volumes.
- Operator acceptance checklist may be executed manually; automated API and domain verification remains mandatory.
- Depends on: Phase 8.

## 17. Test scenarios for a complete academic lifecycle

1. Create a department and program before any academic cycle exists.
2. Save an incomplete program draft, return later, add a curriculum, stages, and requirements, then activate it.
3. Use courses from the owning and another department under the configured sharing policy.
4. Create an institute cycle with no program offering.
5. Offer multiple programs in one cycle.
6. Offer Semester 1 and Semester 3 of the same program in the same cycle.
7. Offer the same Semester 1 stage again in a later cycle without duplicating the stable stage.
8. Create a durable cohort, then activate it for successive stage offerings across cycles.
9. Create one section shared by two cohorts and multiple stage offerings.
10. Create a standalone course section and enroll a student with no major.
11. Admit a student into a program before an appropriate stage offering exists.
12. Later place that student into a stage offering and cohort; preview and accept suggested sections.
13. Manually exclude one suggested section and add another; rerun cohort automation without losing overrides.
14. Bulk-place a cohort with one ineligible student and receive row-level success/conflict results.
15. Complete a stage and advance the student into a later offering.
16. Fail a stage, archive the original cycle, and repeat the same stable stage in a new cycle.
17. Put a student on hold across cycles and resume without pre-existing future cycle rows.
18. Transfer a student between programs/departments while retaining the complete source history.
19. Complete sequential, credit-based, flexible, and manual programs using their own evaluators.
20. Override a recommendation with a required reason and preserved evidence snapshot.
21. Run two overlapping active/open academic cycles and select the intended cycle explicitly in delivery flows.
22. Archive a cycle and verify offerings, cohorts, sections, assessments, grades, attendance, answerbooks, stage attempts, and progression decisions.
23. Change future program/curriculum/department labels and verify archived records remain byte-for-byte and label-for-label unchanged.
24. Delete or archive unused live definitions and verify Past Records remains readable without required live source rows.
25. Verify Org Admin access across all departments.
26. Verify a Sub Admin can manage programs and delivery only inside assigned departments, including nested offering and progression writes.
27. Verify cross-department transfers and course mappings require all applicable scopes/approvals.
28. Verify teacher, student, and guardian historical views expose only assigned/self/linked records.
29. Retry bulk setup/progression requests with the same idempotency key and verify no duplicate records.
30. Race two curriculum activations, student placements, progression decisions, and archive attempts and verify one consistent winner.

## Final recommendation

Do not start by patching the current Program form or adding another relation to `ProgramAcademicCycle`. Start with Phase 0 tests and Phase 1 stable-definition schema. Later phases must depend on those stable identities. The decisive design rule is:

> Programs and stages define what a learner progresses through. Academic cycles and offerings define when it is delivered. Student stage enrollments and progression decisions record what actually happened.

## Implementation checkpoint: Gate 2 complete (2026-08-10)

Completed in this gate:

- Replaced frontend program-cycle contracts with stable program stages and course requirements.
- Rebuilt program create/edit around an ordered stage editor; program setup no longer creates or selects institute cycles.
- Added program offering creation that joins a program curriculum and selected stages to one institute academic cycle.
- Rebuilt cohorts as durable identities with separate cycle-specific cohort offerings, memberships, and section assignments.
- Rebuilt section create/edit around optional `ProgramStageOffering` mappings and matching course requirements.
- Rebuilt student major management around durable program enrollment plus cycle-specific stage attempts and optional cohort placement.
- Rebuilt copy-forward and reassignment selectors around stage-offering and cohort-offering IDs.
- Updated profile, student overview, academic-cycle counts, announcements, chat, filters, and section projections to consume the new relationships.
- Removed the remaining internal `replaceCycles` alias; structure replacement is named consistently in the controller, service, client, and DTO.

Verification at this checkpoint:

- Frontend `npx tsc --noEmit --pretty false`: passed.
- Backend `npx tsc -p tsconfig.build.json --noEmit --pretty false`: passed before the final naming-only cleanup and is rerun below as the closing check.
- Optimized Next.js build reached bundling but could not be certified locally: sandboxed execution could not fetch the existing Google fonts, and the network-enabled retry hung without diagnostics and was terminated. This is an environment/network gate, not a reported application compile error.
- Browser workflow verification remains intentionally deferred to the user.

Stop gate:

- Do not begin progression-engine expansion, import/archive redesign, or hardening phases until this checkpoint is reviewed and confirmed.
