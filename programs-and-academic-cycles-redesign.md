Review the current codebase and perform a deep architectural audit of the relationships and workflows involving:

- Programs
- Program stages
- Academic cycles
- Cohorts
- Sections
- Courses
- Departments
- Student program enrollment and progression

The goal is to identify dependency flaws, circular relationships, ownership mistakes, temporal coupling, duplicated responsibilities, and workflows where the system structure fights the user instead of supporting them.

Do not assume the current implementation is correct simply because the database relations or APIs technically work. Evaluate whether the full real-world workflow is coherent, scalable, and usable by a single operator managing the organization.

## Core architectural principle

These concepts should remain independent where they represent different dimensions of the system, but they should be linkable through explicit contextual entities where needed.

In particular:

- A program defines the long-term academic structure and progression path.
- Program stages define stable curriculum positions such as Semester 1, Semester 2, Grade 6, Foundation Year, or Year 3.
- Academic cycles define time periods such as Fall 2026, Spring 2027, or Academic Year 2026–27.
- Cohorts define groups of students progressing or studying together.
- Sections define actual course delivery groups.
- Courses define teachable subjects.
- Departments define organizational ownership or responsibility, but should not unnecessarily control unrelated lifecycle behavior.

Do not directly couple stable structures to changing time periods unless that relationship is genuinely permanent.

For example, a program stage must not permanently belong to one academic cycle. The same stage can be delivered during many cycles, and the same academic cycle can contain students from many stages of the same program.

Where a relationship is contextual or time-bound, introduce or validate an explicit linking entity such as:

- ProgramStageOffering
- ProgramCycleOffering
- StudentStageEnrollment
- CohortProgramStageAssignment
- CourseOffering
- SectionOffering

Use the naming that best fits the existing codebase, but preserve the separation of concerns.

## Intended workflow

The intended operator flow should feel natural and progressive:

1. An administrator creates a department if organizational ownership is needed.
2. The administrator creates a program.
3. The program defines its complete or expandable stage structure independently of academic cycles.
4. Each program stage defines its expected curriculum, including required, elective, and optional courses.
5. Academic cycles are created independently as calendar periods.
6. For an academic cycle, the administrator activates or creates offerings for the relevant program stages.
7. Cohorts are created or activated within the appropriate program, stage, and academic cycle context.
8. Sections are created from the courses being delivered during that cycle.
9. Students are admitted into a program.
10. Students are assigned to a current stage or stage offering.
11. Students may be assigned to a cohort for bulk placement.
12. Cohort assignment may create or suggest section enrollments, but should not destroy manual flexibility.
13. At the end of the cycle, student progression rules determine whether they advance, repeat, pause, transfer, or complete.
14. Historical records must remain intact even when programs, curricula, stages, departments, cohorts, or future cycle configurations change.

The user should not be forced to create entities in an unnatural order merely to satisfy foreign keys.

The system should allow sensible deferred configuration. For example:

- A program may be created before future academic cycles exist.
- Stages may be predefined before they are offered.
- Courses may be attached to a curriculum before sections exist.
- Cohorts may be prepared before all section assignments are complete.
- Academic cycles may be created without immediately configuring every program.
- Departments may own programs without owning the students’ full academic lifecycle.

## Audit requirements

Inspect the actual:

- Database schema
- ORM relations
- Required and optional foreign keys
- Unique constraints
- Cascading deletes
- Service methods
- DTOs and validation
- Controllers and APIs
- UI creation flows
- Wizard steps
- Automation logic
- Enrollment flows
- Progression logic
- Historical records
- Deletion and archival behavior
- Existing migrations
- Naming consistency
- Permission boundaries

Look specifically for:

### Dependency flaws

- Program creation requiring academic cycles unnecessarily
- Program stages being permanently tied to cycles
- Cohorts existing without a clear program, stage, or cycle context
- Cohorts owning data that should belong to program offerings
- Academic cycles containing curriculum definitions
- Departments controlling lifecycle state they should only categorize or own
- Sections being tied directly to programs when course offerings should mediate the relationship
- Student current state overwriting historical state
- A foreign key representing both identity and current operational context
- Required dependencies that should be optional during initial setup
- Optional dependencies that create invalid or ambiguous records
- Circular creation requirements
- Entities that cannot be created until each other already exists
- Duplicate representations of stage, cycle, program, or cohort state
- Relations that prevent reuse across cycles or programs
- Cascade behavior that could erase historical academic data

### Workflow flaws

- The operator having to jump between many unrelated pages to complete one workflow
- Re-entering the same information multiple times
- Manual creation of predictable records
- Needing to switch accounts unnecessarily
- Hidden prerequisites
- Dead-end states
- Partially configured entities that cannot be resumed safely
- Bulk operations missing where they are obviously needed
- Automation that makes irreversible assumptions
- UI labels that expose database structure instead of real-world concepts
- Workflows that technically work but are too fragile to operate at scale

## Expected design behavior

Prefer a model where:

- Stable definitions are separated from operational instances.
- Time-independent structures are separated from time-bound offerings.
- Historical records are immutable or safely versioned.
- Current state is derived from enrollment or progression records where possible.
- Linking tables contain contextual relationships instead of forcing entities to own each other.
- Setup can happen incrementally.
- Sensible defaults and automation reduce repetitive work.
- Operators can override automation.
- Bulk actions exist for common academic operations.
- Invalid states are prevented by domain rules, not merely UI assumptions.
- The same architecture supports both schools and universities.

For schools, stages may represent grades or years.

For universities, stages may represent semesters, terms, levels, or academic years.

Do not hardcode either interpretation into the core model.

## Output format

Produce a detailed architectural audit with the following sections:

1. Current architecture summary
2. Current entity relationship map
3. Intended domain model
4. Dependency flaws found
5. Workflow flaws found
6. Circular or fragile creation flows
7. Historical data risks
8. Incorrect ownership relationships
9. Missing linking entities
10. Suggested schema changes
11. Suggested service and API changes
12. Suggested UI and operator workflow changes
13. Automation opportunities
14. Migration risks
15. Backward compatibility concerns
16. Recommended implementation phases
17. Test scenarios for a complete academic lifecycle

For every flaw found, include:

- The affected files
- The current behavior
- Why it is flawed
- A realistic failure scenario
- The recommended design
- Whether it requires a schema change
- Whether it requires a migration
- Whether it is breaking
- Priority: critical, high, medium, or low

Do not modify the code yet.

First produce an exact implementation plan based on the actual codebase.

The final result should optimize for this principle:

The system should guide the operator through a coherent academic workflow. Independent concepts should remain independent, contextual relationships should be explicit, and the user should never feel like they are wrestling the data model just to perform normal academic operations.
