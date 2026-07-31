Audit the current EduVerse codebase and produce an exact, implementation-ready plan for introducing a flexible academic **Programs, Curricula, and Stages** system that works naturally for both schools and universities.

Do not implement anything yet.

First inspect the real repository, database schema, backend services, frontend flows, documentation, and existing terminology. Base every conclusion on actual code. Cite exact repository paths, Prisma models, services, DTOs, components, routes, and relevant symbols.

## Existing conceptual model

EduVerse currently has approximately this academic structure, but verify every detail from the repository:

- A `Course` represents a reusable teachable subject.
- A `Section` delivers one course.
- One course may be delivered through many sections.
- Students may enroll in individual sections.
- A `Cohort` groups sections so students can be enrolled into several related sections together.
- Sections and cohorts belong to an `AcademicCycle`.
- Academic cycles represent delivery periods in which those sections and cohorts operate.
- Student promotion and historical enrollment already exist.
- GPA policies, finalized grades, transcripts, schedules, departments, attendance, evaluations, and other features already depend on parts of this structure.
- EduVerse supports multiple institution types and must not become university-only.

Confirm or correct this understanding before designing anything.

## Core design problem

EduVerse currently records what students are taking during an academic cycle, but it may not have a durable model describing the complete educational pathway they are progressing through.

For a university, examples might be:

- BS Computer Science
- Curriculum/Scheme 2026
- Semester 1 through Semester 8
- Required and elective courses
- Credit and graduation requirements
- Degree awarded after completing the requirements

For a school, the meaning is different:

- A program might represent Primary Education, Secondary Education, a complete School Education pathway, Cambridge O Levels, or another institution-defined pathway.
- Stages may be Grade 1, Grade 8, Year 10, Form 3, or another configurable level.
- Students may leave after a stage and still receive a valid transcript, progress record, promotion certificate, school-leaving certificate, or stage-level award.
- Finishing or leaving a stage must not necessarily mean completing the overall program.
- A grade must not automatically be treated as a program merely because that is easier to implement.

The architecture must therefore distinguish between:

1. The durable educational pathway.
2. A versioned curriculum or scheme governing that pathway.
3. The logical stages within that curriculum.
4. Actual cohorts and sections delivered during particular academic cycles.
5. A student’s admission/enrollment in a pathway and curriculum version.
6. The student’s progression through stages.
7. Intermediate milestones, awards, exit credentials, and final qualifications.

Do not assume all organizations use semesters, credit hours, fixed durations, or graduation-style completion.

## Required audit

### 1. Existing academic domain

Locate and document:

- `Course`
- `Section`
- `Cohort`
- `AcademicCycle`
- Departments or equivalent ownership
- Student-section enrollment
- Student-cohort enrollment
- Promotion history and promotion operations
- Grade records and finalization
- GPA and transcript generation
- Course credit-hour handling
- Lab/theory relationships, if implemented or partially implemented
- Prerequisites, electives, qualifications, programs, curricula, stages, awards, or similar concepts if any already exist
- CSV import/export paths involving these entities
- Schedule, attendance, evaluation, reporting, search, dashboard, AI-tool, authorization, and audit-log dependencies

Explain the current relationships and lifecycle using confirmed schema and code—not assumptions.

### 2. Existing meaning of Cohort

Determine exactly what `Cohort` currently represents in EduVerse.

Answer from the code:

- Is it a student batch, a reusable bundle of sections, a class/grade, an academic-cycle-specific offering, or a mixture of these?
- Does it directly own students, sections, cycle references, promotion state, or historical data?
- Is a cohort expected to survive across academic cycles?
- Is promotion implemented by moving students between cohorts, replacing cohort relationships, creating history, or something else?
- Are cohorts already being used as de facto grades, semesters, programs, or stages?
- Which existing behavior must remain compatible?

This is critical. Do not design Programs until this ambiguity is resolved.

### 3. School and university workflows

Trace or infer from supported code how EduVerse currently handles:

#### School

- Student admission
- Placement in a grade/class
- Enrollment into subjects
- Promotion to the next grade
- Repeating a grade
- Skipping a grade
- Transfer into or out of the institution
- Leaving after completing only part of a broader pathway
- Generating valid academic history for completed grades

#### University

- Admission into a degree or qualification
- Semester/course registration
- Repeating or retaking courses
- Falling behind the expected semester
- Taking courses from different stages
- Changing majors/programs
- Curriculum changes
- Transfers and credit exemptions
- Graduation eligibility

Clearly identify which flows already exist, which are partially represented, and which would become possible only after Programs are added.

## Design goals

Recommend a model that supports these concepts without forcing every organization to use all of them:

- `Program`
- Versioned curriculum/scheme
- Curriculum stages
- Stage course requirements
- Actual stage/cohort offerings per academic cycle
- Student program enrollment
- Student stage progression/history
- Intermediate and final awards
- Exit credentials
- Required, elective, optional, prerequisite, and equivalent courses
- Credit-based, stage-based, competency-based, and flexible progression
- Configurable institution terminology
- Future CLO/PLO and OBE support

Treat these names as conceptual. If the current codebase suggests better names or boundaries, recommend them.

## Dynamic institutional behavior

Evaluate whether Programs need controlled configuration such as:

```ts
structureType:
  | "GRADE_BASED"
  | "TERM_BASED"
  | "CREDIT_BASED"
  | "LEVEL_BASED"
  | "COMPETENCY_BASED"
  | "CUSTOM";

progressionMode:
  | "SEQUENTIAL"
  | "CREDIT_ACCUMULATION"
  | "COMPETENCY_BASED"
  | "FLEXIBLE";

completionMode:
  | "FINAL_STAGE"
  | "REQUIREMENTS"
  | "CREDITS"
  | "MANUAL";
```

These are examples, not mandatory enums. Avoid enums that merely rename the organization type without changing actual behavior.

Determine which differences belong in:

- Program configuration
- Curriculum policy
- Progression policy
- Award requirements
- Organization terminology
- Existing academic-cycle or grading policy
- Application logic rather than persisted enum fields

Avoid adding speculative configuration with no current or near-future consumer.

## Questions the final plan must resolve

1. What should `Program` mean consistently across institutions?
2. Should an organization be allowed to use EduVerse without Programs?
3. Is a Program organization-wide or department-owned?
4. Can a Program have multiple concurrent curriculum versions?
5. How is a student permanently associated with the curriculum version under which they were admitted?
6. What exactly is a Program Stage?
7. Can stages be optional, repeated, skipped, entered midway, or completed out of order?
8. Should school grades and university semesters use the same underlying stage entity?
9. How are existing cohorts connected to stages and academic cycles?
10. Is a cohort an offering of a stage, or can one cohort serve multiple stages/programs?
11. Can multiple cohorts offer the same stage during one cycle?
12. Can a cohort contain sections not defined by its stage curriculum?
13. How are electives and optional subjects represented?
14. How should students take courses from stages other than their nominal current stage?
15. What happens when a student repeats a stage but passes some subjects?
16. What happens when a university student progresses by credits rather than semesters?
17. How are transfers between programs or curriculum versions represented without destroying history?
18. How are program changes, double majors, minors, concentrations, streams, and school subject groups handled—or deliberately deferred?
19. How do intermediate awards differ from final program completion?
20. How does EduVerse issue a school-leaving/progress credential without marking the whole Program complete?
21. Which concepts should affect transcripts immediately?
22. Which concepts are needed later for CLO/PLO ownership?
23. Which settings should org admins control, and which should be restricted to safe presets or validated policies?
24. Which records must be snapshotted or frozen after grades, stages, awards, or graduation are finalized?
25. How should terminology differ in the UI without duplicating backend models?

## Curriculum and delivery separation

Explicitly evaluate a separation like:

```text
Program
  → Curriculum Version
    → Logical Stages
      → Course/requirement definitions

Academic Cycle
  → Cohort or Stage Offering
    → Actual Sections
      → Actual student enrollments and results
```

The curriculum should describe what is expected.

Cohorts, sections, academic cycles, enrollments, and grade records should describe what was actually delivered and completed.

Determine whether this separation fits the existing code. If not, propose a better one and explain why.

Do not make historical transcripts depend entirely on mutable curriculum definitions.

## Compatibility and migration

The plan must preserve existing organizations and academic records.

Investigate and propose:

- Whether Programs should initially be optional.
- How current cohorts and sections continue functioning before migration.
- Whether existing cohorts can be mapped to Program Stages gradually.
- Whether automatic migration is safe or whether admins must explicitly classify existing data.
- How to avoid guessing that a cohort represents a grade or semester.
- How current student enrollments and promotion history can be linked without rewriting history.
- Whether legacy/unclassified delivery should remain supported.
- What happens to existing transcripts and finalized grades.
- How APIs and frontend types remain backward-compatible during rollout.
- How demo/seed data and CSV imports should evolve.

Prefer an incremental migration over a flag-day rewrite.

## Authorization

Inspect the existing role and access-level architecture and recommend who may:

- Create a Program
- Create and activate curriculum versions
- Configure stages and requirements
- Map cohorts/offerings
- Admit or transfer students into Programs
- Change a student’s curriculum
- Record stage completion
- Approve exceptions
- Define awards
- Mark program completion
- View progression and attainment reports

Do not invent new roles unless necessary. Reuse existing EduVerse permissions and access patterns where appropriate.

## UI/UX planning

Locate the existing organization setup, academics, courses, cohorts, sections, cycles, students, enrollments, promotions, and transcript interfaces.

Propose where Programs fit into the current navigation and workflows.

Include minimal interfaces for:

- Program list/details
- Curriculum version editor
- Stage ordering and configuration
- Course/requirement assignment
- Mapping stages to actual cohorts or offerings
- Student Program enrollment
- Student progression view
- Curriculum-version comparison
- Intermediate/final award configuration
- Legacy cohort mapping

The UI should adapt terminology where useful:

- Program / Pathway / Degree
- Curriculum / Scheme of Studies
- Stage / Grade / Semester / Year / Level
- Cohort / Class / Batch
- Award / Certificate / Qualification

However, terminology configuration must not change underlying semantics or create incompatible workflows.

## Scope control

Separate the proposal into:

### Required foundation

Only what is necessary to introduce Programs safely and make them useful with the existing academic model.

### Near-term extensions

Features strongly enabled by the foundation, such as:

- Curriculum requirements
- Student progression
- Graduation or stage-completion checks
- Award milestones
- Program-aware transcripts

### Future extensions

Do not include these in the initial implementation unless existing code makes them cheap and necessary:

- CLO/PLO and OBE
- Accreditation management
- Complex prerequisite engines
- Credit transfer automation
- Double majors and minors
- Advanced elective optimization
- Degree audits
- Curriculum equivalency automation
- Cross-institution transfers

Avoid designing the first migration around every hypothetical future feature.

## Required deliverable

Produce a detailed implementation plan containing:

1. Executive recommendation.
2. Confirmed current academic architecture.
3. Problems and ambiguities in the current model.
4. School-specific requirements.
5. University-specific requirements.
6. Shared domain concepts and institution-specific differences.
7. Recommended final domain model.
8. Proposed Prisma models, relations, constraints, indexes, and deletion behavior.
9. Proposed enums or strategy configuration, with justification for each.
10. How existing Course, Section, Cohort, AcademicCycle, enrollment, promotion, grade, GPA, and transcript models change.
11. Exact backend files and symbols to modify.
12. Exact frontend files, routes, components, hooks, and types to modify.
13. API/DTO design and validation rules.
14. Authorization and tenant-isolation requirements.
15. Migration and backward-compatibility strategy.
16. Seed/demo-data and import/export changes.
17. School workflow examples.
18. University workflow examples.
19. Edge cases and invalid states that must be prevented.
20. Unit, integration, migration, and end-to-end tests.
21. Rollout phases with dependency order.
22. Features explicitly deferred from v1.
23. Risks, unresolved product decisions, and alternatives.
24. Any existing bugs, overloaded concepts, or architectural conflicts found during the audit.

For every phase, list:

- Objective
- Exact files/modules affected
- Schema changes
- Backend changes
- Frontend changes
- Compatibility considerations
- Tests
- Completion criteria

## Important constraints

- Do not implement code.
- Do not create or modify migrations.
- Do not invent filenames, routes, models, or existing behavior.
- Cite actual repository paths and symbols.
- Clearly distinguish confirmed findings from recommendations.
- Do not blindly follow the example schemas in this prompt.
- Do not redesign unrelated EduVerse modules.
- Do not turn Cohort, Stage, Program, and Academic Cycle into duplicate versions of the same concept.
- Do not assume one cohort equals one permanent student batch unless the code confirms it.
- Do not assume university semesters and school grades behave identically merely because both can be displayed as stages.
- Do not make Programs mandatory unless a safe migration and compelling architectural reason exist.
- Preserve historical academic truth even after curricula, program structures, or policies change.
- Prefer the smallest foundation that cleanly supports future curriculum, progression, awards, and CLO/PLO work.
- If the repository contradicts any assumption in this prompt, trust the repository and explain the contradiction.
- If a product decision cannot be derived from the codebase, present the exact decision, realistic options, consequences, and your recommended choice instead of silently guessing.
