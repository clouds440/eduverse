# EduVerse Departments, Buildings, and Rooms Implementation Plan

## Goal

Introduce proper organization-defined `Departments`, `Buildings`, and `Rooms` into EduVerse.

This replaces loose text-based grouping/location fields with structured DB entities that can support:

* Department-based grouping and scoped access.
* Building and room management.
* Accurate schedule room conflict detection.
* Cleaner timetable display.
* Room capacity/type metadata.
* Future reporting, filtering, and audit flows.

Current state:

* Sections currently have an optional `room` string.
* Schedules currently have their own `room` field.
* Real room conflict detection currently relies on schedule-level room data.
* A schedule belongs to a section.
* Schedule room overrides section room in practice.

Target direction:

```txt
Department = academic/admin grouping and scope layer
Building = physical campus/building/location container
Room = physical teaching/location unit
Schedule = section + teacher + room + time
```

---

# Core Design Decisions

## 1. Departments

Departments are organization-defined entities used for grouping, filtering, reporting, and scoped access.

Examples:

```txt
Computer Science
English
Commerce
Science
Hifz
Diploma Programs
```

Departments should not replace:

* Courses
* Sections
* Cohorts
* Academic cycles
* Enrollments

Departments answer:

```txt
Which academic/administrative scope does this belong to?
```

## 2. Buildings

Buildings represent physical or logical campus locations.

Examples:

```txt
Main Block
Science Block
Girls Campus
Evening Campus
Admin Building
```

Buildings should not be used as the main permission system.

Buildings answer:

```txt
Where is this room physically located?
```

## 3. Rooms

Rooms belong to buildings.

Examples:

```txt
Main Block • Room 101
Science Block • Lab 2
Girls Campus • Hall A
```

Room numbers/names can repeat across buildings, but not inside the same building.

Allowed:

```txt
Main Block • 101
Science Block • 101
```

Not allowed:

```txt
Main Block • 101
Main Block • 101
```

## 4. Building and Department Relationship

A building can be associated with one or more departments.

A department can be associated with one or more buildings.

This should be optional and used for:

* Filtering
* Reporting
* UI suggestions
* Room selection narrowing

It should not be the primary authority source for department permissions.

Recommended relationship:

```txt
BuildingDepartment
- buildingId
- departmentId
```

Example:

```txt
Science Block -> Science Department
Science Block -> Computer Science Department

Main Block -> English Department
Main Block -> Commerce Department
```

Important:

A room belongs to a building, not directly to a department.

A department can use many buildings.

A building can host many departments.

Schedules choose rooms directly.

---

# Suggested Data Model

## Department

```prisma
model Department {
  id             String   @id @default(uuid())
  organizationId String

  name           String
  code           String?
  description    String?
  color          String?
  isActive       Boolean  @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, name])
  @@unique([organizationId, code])
  @@index([organizationId])
}
```

Notes:

* `code` should be optional.
* `color` is useful for filters, tags, reports, and charts.
* Allow inactive departments instead of hard deleting if used by historical records.

---

## Building

```prisma
model Building {
  id             String   @id @default(uuid())
  organizationId String

  name           String
  code           String?
  address        String?
  description    String?
  isActive       Boolean  @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, name])
  @@unique([organizationId, code])
  @@index([organizationId])
}
```

Notes:

* `code` can be used for short labels like `SCI`, `MAIN`, `ADM`.
* `address` is optional because some institutes may only have blocks inside one campus.

---

## Room

```prisma
model Room {
  id             String   @id @default(uuid())
  organizationId String
  buildingId     String

  name           String
  floor          String?
  type           RoomType?
  capacity       Int?
  description    String?
  isActive       Boolean  @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  building       Building     @relation(fields: [buildingId], references: [id], onDelete: Cascade)

  @@unique([organizationId, buildingId, name])
  @@index([organizationId])
  @@index([buildingId])
}
```

Suggested enum:

```prisma
enum RoomType {
  CLASSROOM
  LAB
  AUDITORIUM
  OFFICE
  LIBRARY
  HALL
  OTHER
}
```

Notes:

* `capacity` should warn during scheduling, not hard-block in v1.
* `floor` should be string, not number, because floors can be `Ground`, `Basement`, `Mezzanine`, etc.

---

## BuildingDepartment

```prisma
model BuildingDepartment {
  id             String @id @default(uuid())
  organizationId String
  buildingId     String
  departmentId   String

  building       Building   @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  department     Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@unique([buildingId, departmentId])
  @@index([organizationId])
  @@index([buildingId])
  @@index([departmentId])
}
```

Notes:

* Keep this optional.
* Do not require every building to belong to a department.
* Do not require every department to have a building.

---

# Entity Department Assignment Strategy

## Direct department grouping

Entities that naturally belong to departments should support department assignment.

Recommended:

```txt
Course -> one or more departments, or one primary department
Section -> derived from course, or explicit if needed
Teacher -> one or more departments
Student -> one primary department plus optional additional departments
Manager/SubAdmin -> department scope: ALL or selected departments
```

## Recommended v1 choice

Keep it practical:

```txt
Course.departmentId required or optional initially
TeacherDepartment many-to-many
StudentDepartment many-to-many or primary + extra
ManagerDepartment many-to-many
SubAdminDepartment many-to-many
```

For `Course`, one owning department is usually cleanest.

For `Teacher`, `Student`, `Manager`, and `SubAdmin`, many-to-many is more practical.

## Scope type

For scoped management roles:

```prisma
enum DepartmentScopeType {
  ALL
  SELECTED
}
```

Use this for:

```txt
SUB_ADMIN
ORG_MANAGER
```

Potentially later:

```txt
FINANCE_MANAGER
```

But finance should not become department-scoped in v1 unless needed.

---

# Room Migration Strategy

## Current section room field

Current:

```txt
Section.room: string?
```

Recommended:

* Do not remove immediately.
* Keep it temporarily for backward compatibility.
* Add optional `defaultRoomId` to Section only if useful.

Suggested:

```txt
Section.defaultRoomId optional
```

Purpose:

* Provides default room suggestion when creating schedules for that section.
* Does not control conflict logic.
* Does not override schedule room.

Important:

Schedule-level room remains the actual room for timetable and conflict checks.

## Current schedule room field

Current:

```txt
Schedule.room: string
```

Target:

```txt
Schedule.roomId: string
```

Migration approach:

1. Add nullable `roomId` first.
2. Keep old `room` string temporarily.
3. Update schedule create/edit UI to use `roomId`.
4. Update conflict logic to prefer `roomId`.
5. Once stable, make `Schedule.roomId` required.
6. Later remove old `Schedule.room` string.

---

# Phase 0: Pre-Implementation Audit

## Goal

Map all existing room, schedule, section, and role-scope logic before editing.

## Tasks

1. Search backend for:

   * `room`
   * `section.room`
   * `schedule.room`
   * schedule conflict checks
   * timetable generation
   * section create/edit DTOs
   * schedule create/edit DTOs

2. Search frontend for:

   * section room fields
   * schedule room input fields
   * timetable room display
   * schedule forms
   * section forms
   * filters/search involving room

3. Search role/scope logic for:

   * admin
   * sub admin
   * manager
   * teacher
   * student
   * finance manager
   * guardian

4. Produce a compact implementation map:

```txt
Feature:
Backend files:
Frontend files:
Current field:
Target field:
Risk:
Migration notes:
```

## Output

Before coding, produce a short audit and plan.

No functional changes yet.

---

# Phase 1: Add Base Models Safely

## Goal

Add Departments, Buildings, Rooms, and BuildingDepartment without forcing them into existing flows yet.

## Backend Tasks

1. Add Prisma models:

   * Department
   * Building
   * Room
   * BuildingDepartment

2. Add `RoomType` enum.

3. Add migrations.

4. Add basic CRUD modules/controllers/services for:

   * Departments
   * Buildings
   * Rooms

5. Add organization scoping to all queries.

6. Add validation:

   * Department name unique per org.
   * Department code unique per org if provided.
   * Building name unique per org.
   * Building code unique per org if provided.
   * Room name unique inside same building.
   * Room capacity must be positive if provided.
   * Room building must belong to same organization.
   * BuildingDepartment relation must stay inside same organization.

7. Add soft-disable behavior via `isActive`.

## Frontend Tasks

1. Add management pages:

   * Departments
   * Buildings
   * Rooms

2. Add create/edit/delete or activate/deactivate flows.

3. Add simple tables with search/filter.

4. Add display helpers:

   * `formatDepartmentLabel`
   * `formatBuildingLabel`
   * `formatRoomLabel`

Suggested room label:

```txt
Building Name • Room Name
```

Example:

```txt
Science Block • Lab 2
```

## Verification

* Admin/SubAdmin can create departments.
* Admin/SubAdmin can create buildings.
* Admin/SubAdmin can create rooms.
* Duplicate room names are allowed across buildings.
* Duplicate room names are blocked inside the same building.
* Inactive rooms do not appear in new schedule selectors by default.

---

# Phase 2: Building and Department Relationship

## Goal

Allow buildings to be associated with departments for filtering and reporting.

## Backend Tasks

1. Add endpoints to assign/remove departments from a building.

2. Add building response with departments included where useful.

3. Add department response with buildings included where useful.

4. Validate:

   * building belongs to org
   * department belongs to org
   * duplicate assignment blocked

## Frontend Tasks

1. In Building create/edit form:

   * allow selecting departments
   * use multi-select
   * optional field

2. In Building list/detail:

   * show department chips

3. In Room list:

   * allow filtering rooms by building
   * allow filtering buildings by department
   * optionally show derived department chips from building

## Verification

* A building can belong to multiple departments.
* A department can have multiple buildings.
* Rooms can be filtered by department through building relationship.
* No permission logic depends only on building-department relationship.

---

# Phase 3: Department Assignment to Academic Entities

## Goal

Start using departments as real grouping/scope metadata.

## Backend Tasks

Add department assignment support to relevant entities.

Recommended v1:

### Course

Add:

```txt
Course.departmentId optional initially
```

Later this may become required.

### Teacher

Add many-to-many:

```txt
TeacherDepartment
```

### Student

Add either:

Option A:

```txt
Student.primaryDepartmentId
StudentDepartment
```

Option B:

```txt
StudentDepartment only
```

Recommended:

```txt
Student.primaryDepartmentId optional
StudentDepartment for extra departments
```

### Manager/SubAdmin

Add department scope:

```txt
departmentScopeType: ALL | SELECTED
ManagerDepartment
SubAdminDepartment
```

## Frontend Tasks

1. Add department selector to Course form.

2. Add department selector to Teacher form.

3. Add department selector to Student form.

4. Add department scope selector to Manager/SubAdmin form:

   * All Departments
   * Selected Departments

5. Use existing `CustomSelect.tsx` or multi-select pattern.

6. Add department chips in list/detail pages.

## Verification

* Courses can be grouped by department.
* Teachers can be assigned to multiple departments.
* Students can be assigned to primary and extra departments.
* Managers/SubAdmins can be scoped to all or selected departments.
* Existing records without departments do not break.

---

# Phase 4: Department Scope Enforcement

## Goal

Use departments to restrict SubAdmin and Manager access where appropriate.

## Core Principle

If an entity naturally has department ownership, enforce directly.

If an entity does not naturally belong to a department, derive scope through related entities.

## Direct department enforcement

Directly enforce scope for:

```txt
Courses
Teachers
Students
Managers
Sections through Course
Schedules through Section -> Course
```

## Derived department enforcement

Derive scope for:

```txt
Guardians -> linked students
Materials -> section -> course
Assessments -> section -> course
Grades -> student/section/course
Transcripts -> student
Attendance -> section/course/student
Finance -> target student/teacher, audit later
Announcements -> target audience
Chat/Mail -> participants/context
```

## Backend Tasks

1. Create centralized department scope helper.

Suggested helper responsibilities:

```txt
getUserDepartmentScope(userId)
isAllDepartments(user)
getScopedDepartmentIds(user)
canAccessDepartment(user, departmentId)
applyDepartmentScopeToQuery(user, entityType)
```

2. Enforce scope for Manager and SubAdmin in services.

3. Admin remains org-wide.

4. Teacher remains assigned-section scoped.

5. Student remains self-scoped.

6. Guardian remains linked-student scoped.

7. FinanceManager remains finance-only.

## Important access rules

### SubAdmin

Can manage operational records inside their department scope.

Can manage all if `departmentScopeType = ALL`.

Cannot manage:

```txt
ORG_ADMIN
Other SUB_ADMINs
Organization ownership/settings, unless intentionally allowed
```

### Manager

Can manage academic records inside their department scope.

Can view broader academic dashboards only if intentionally allowed.

Cannot manage:

```txt
Finance
Org settings
Sub admins
Finance managers
Non-academic operations
```

## Verification

* Department-scoped SubAdmin cannot modify out-of-scope students.
* Department-scoped Manager cannot modify out-of-scope sections.
* ALL-scoped Manager/SubAdmin can access all departments.
* Admin remains org-wide.
* Teacher assigned-section logic still works.

---

# Phase 5: Room Integration With Schedules

## Goal

Move schedule room logic from text strings to structured `Room`.

## Backend Tasks

1. Add `roomId` to Schedule as nullable first.

2. Keep old `room` string temporarily.

3. Update schedule create DTO:

   * accept `roomId`
   * validate room belongs to org
   * validate room is active
   * validate room exists

4. Update schedule edit DTO:
- allow changing the selected room by accepting `roomId`
- `roomId` must be an existing Room UUID from the same organization
- users do not manually enter roomId
- frontend must use a Room selector/dropdown
- room display should use building + room label, not UUID

5. Update schedule responses:

   * include room
   * include room.building

6. Update conflict logic:

   * use `roomId` when available

7. Update room conflict check:

```txt
Same roomId
Same day
Overlapping time
Same active academic context/org
```

8. Keep teacher conflict logic using required `teacherId`.

9. Keep section/student timetable logic unchanged except for room display.

10. Add capacity warning:

* compare room.capacity with section/enrolled students
* warn only
* do not hard block in v1

## Frontend Tasks

1. Replace schedule room text input with room selector.

2. Room selector should show:

```txt
Building Name • Room Name
```

3. Allow filtering rooms by:

   * building
   * department through building relationship, if useful
   * room type

4. When section has `defaultRoomId`, prefill schedule room.

5. Show room capacity warning if available.

6. Timetable display should show:

```txt
Course • Section
Teacher
Building • Room
Time
```

## Verification

* Schedule can select structured room.
* Room conflict uses `roomId`.
* Same room name in different buildings does not conflict.
* Same room in same time slot conflicts.
* Timetable displays proper building + room.
* Old schedules still display fallback room string until migrated.

---

# Phase 6: Optional Section Default Room

## Goal

Replace section-level room string with optional default room relationship.

## Current

```txt
Section.room: string?
```

## Target

```txt
Section.defaultRoomId: string?
```

## Meaning

Section default room is only a suggestion/default.

It does not override schedule-level room.

Schedule room remains the source of truth.

## Backend Tasks

1. Add `defaultRoomId` to Section as nullable.

2. Keep old `Section.room` string temporarily.

3. Update section create/edit DTO:

   * allow `defaultRoomId`

4. Validate:

   * room belongs to org
   * room is active

5. Update section responses:

   * include defaultRoom
   * include defaultRoom.building

## Frontend Tasks

1. Replace section room text input with optional default room selector.

2. Label clearly:

```txt
Default Room
Used as a suggestion when creating schedules.
Schedules can still use a different room.
```

3. Show default room in section detail/list if useful.

## Verification

* Section can have default room.
* Creating schedule for section preselects default room.
* Schedule can override default room.
* Conflict logic still uses schedule room.

---

# Phase 7: Remove Old Room String Usage

## Goal

After schedule and section room migration is stable, remove old string dependency.

## Backend Tasks

1. Replace remaining `schedule.room` reads with `schedule.roomId`.

2. Replace remaining `section.room` reads with `section.defaultRoomId`.

3. Remove fallback logic after confirming migration is safe.

4. Make `Schedule.roomId` required if every schedule must have a room.

Recommended:

```txt
Schedule.roomId required
Section.defaultRoomId optional
```

5. Remove old `room` string fields later.

## Frontend Tasks

1. Remove old room text input logic.

2. Remove fallback display.

3. Ensure all schedule forms require room selection.

## Verification

* No code references old `Schedule.room`.
* No code references old `Section.room`.
* Conflict logic only uses `roomId`.
* All schedules have roomId.

---

# Phase 9: UI and Navigation Restructure

## Goal

Expose Departments, Buildings, and Rooms cleanly in the management UI.

## Suggested Navigation

For Admin/SubAdmin:

```txt
Organization Setup
- Departments
- Buildings
- Rooms
```

or:

```txt
Academic Setup
- Departments
- Courses
- Sections

Campus Setup
- Buildings
- Rooms
```

Recommended:

```txt
Setup
- Departments
- Buildings & Rooms
```

## Pages

### Departments page

* List departments
* Create department
* Edit department
* Disable/enable department
* Search by name/code
* Show color/code

### Buildings page

* List buildings
* Create building
* Edit building
* Disable/enable building
* Assign departments
* Show department chips

### Rooms page

* List rooms
* Create room
* Edit room
* Disable/enable room
* Filter by building
* Filter by department through building
* Filter by room type

## Verification

* Management pages are not noisy.
* Common setup flow is obvious.
* Room creation requires building.
* Buildings can be associated with departments.

---

# Phase 10: Reports, Filters, and Timetable Display

## Goal

Make departments and rooms useful beyond CRUD.

## Add filters where useful

Departments:

```txt
Courses
Sections
Teachers
Students
Schedules
Reports
Grade finalization dashboard
Attendance reports
```

Buildings/Rooms:

```txt
Schedules
Timetable
Room usage report
Room conflict report
```

## Timetable display

Display room consistently:

```txt
Science Block • Lab 2
```

Compact display:

```txt
SCI • Lab 2
```

Only use compact display if building code exists.

Suggested helper:

```ts
formatRoomLabel(room)
```

Rules:

```txt
If building code exists:
SCI • Lab 2

Else:
Science Block • Lab 2
```

## Verification

* Filters are useful but not excessive.
* Timetable cards stay readable.
* Room labels are consistent across pages.

---

# Phase 12: Tests (Manual testing scope and cases. NOT FOR AGENT)

## Backend tests

Add tests for:

### Department

* Create department.
* Duplicate department name blocked per org.
* Same name allowed in different org.
* Code uniqueness works.
* Disable department.

### Building

* Create building.
* Duplicate building name blocked per org.
* Assign multiple departments.
* Remove department from building.
* Same building name allowed in different org.

### Room

* Create room inside building.
* Duplicate room name blocked inside same building.
* Same room name allowed in different buildings.
* Room belongs to org.
* Room capacity validation.
* Room type validation.

### Schedule conflict

* Same roomId overlapping time conflicts.
* Same room name in different buildings does not conflict.
* Different room same time allowed if teacher/section constraints allow.
* Teacher conflict still works.
* Old room fallback works during migration phase, if fallback remains.

### Department scope

* Scoped SubAdmin cannot manage out-of-scope course/section/student.
* ALL-scoped SubAdmin can manage all.
* Scoped Manager follows academic scope.
* Admin bypasses department scope.

## Frontend tests

Add tests for:

* Room selector display.
* Building department selector.
* Schedule form requires room.
* Section default room prefill.
* Timetable room display.
* Department filters.

---

# Phase 13: Documentation

## Update docs

Add docs for:

1. Departments

Explain:

```txt
Departments are used for grouping, scope, filtering, and reports.
They do not replace courses, sections, cohorts, or cycles.
```

2. Buildings and Rooms

Explain:

```txt
Buildings contain rooms.
Rooms are used in schedules and conflict checks.
```

3. Schedule room behavior

Explain:

```txt
Section default room is only a suggestion.
Schedule room is the actual room used for timetable and conflicts.
```

4. Department scoped users

Explain:

```txt
SubAdmins and Managers may be scoped to all departments or selected departments.
```

5. Building-department links

Explain:

```txt
Buildings can be associated with departments for filtering/reporting.
This does not make buildings the main permission source.
```

---

# Phase 14: Final Cleanup

## Tasks

1. Remove old unused room string logic when migration is complete.

2. Remove duplicate room display helpers.

3. Centralize label helpers:

   * `formatDepartmentLabel`
   * `formatBuildingLabel`
   * `formatRoomLabel`

4. Centralize department scope helpers.

5. Review sidebar links.

6. Review DTO validation.

7. Review schedule conflict logic.

8. Review timetable response shape.

9. Review old section room references.

10. Review docs and tests.

## Final verification checklist

```txt
Departments can be created and assigned.
Buildings can be created and linked to departments.
Rooms can be created inside buildings.
Room names can repeat across buildings.
Room conflicts use roomId.
Schedule room overrides section default room.
Section default room only preselects/suggests.
Timetable displays proper building + room.
SubAdmin/Manager department scope works.
Existing records do not break.
Old room strings are migrated or safely handled.
Docs match the final UI.
Tests cover conflict and scope rules.
```

---

# Recommended Implementation Order

```txt
1. Audit current room/schedule/section logic.
2. Add Department, Building, Room base models.
3. Add CRUD APIs and UI.
4. Add building-department relationship.
5. Add department assignment/scope gradually.
6. Add schedule.roomId while keeping old room string fallback.
7. Update schedule conflict logic to use roomId.
8. Add section.defaultRoomId as suggestion only.
9. Replace old room UI and old room reads.
10. Add filters/reports/docs/tests.
12. Remove old string fields after stability.
```

---

# Key Rule

Do not make departments, buildings, and rooms fight each other.

Keep their jobs separate:

```txt
Department = academic/admin scope and grouping
Building = physical location group
Room = actual schedulable space
Section = academic group of students
Schedule = section + teacher + room + time
```

This keeps the model flexible enough for:

* Same room number in different buildings.
* Buildings shared by multiple departments.
* Departments spread across multiple buildings.
* Visiting teachers.
* Cross-department students.
* Department-scoped managers and sub admins.
* Real room conflict detection.
