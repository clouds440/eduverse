# EduVerse Roles Reshaping Plan

## Goal

Reshape EduVerse organization roles into a cleaner, safer, more scalable access model.

This change introduces:

* `SUB_ADMIN`
* `FINANCE_MANAGER`
* `GUARDIAN`

It also reshapes existing roles:

* `ORG_ADMIN`
* `ORG_MANAGER`
* `TEACHER`
* `STUDENT`

The goal is to separate responsibilities clearly:

```txt
ORG_ADMIN       = organization owner / top-level authority
SUB_ADMIN       = operational data manager
ORG_MANAGER     = academic manager
FINANCE_MANAGER = finance-only operator
TEACHER         = teaching role
STUDENT         = learning role
GUARDIAN        = student-linked observer/support role
```

The current role system has grown organically and now has overlapping access, hidden backend permissions, sidebar clutter, and mixed responsibilities. This plan restructures it in phases so the system can be migrated safely without breaking core academic workflows.

---

# Final Target Role Model

## 1. ORG_ADMIN

The main organization admin.

Responsibilities:

* Manage organization settings.
* Manage sub admins.
* Manage users at the highest level.
* View audit-level finance data.
* View reports.
* Override finalized grades if necessary.
* Perform institution-level corrections.
* Manage core organization setup.

Should NOT need daily academic teaching tools in the admin portal.

Remove/hide from normal Admin sidebar:

* Course materials
* Teacher-style grading views
* Teacher-style attendance tools
* My timetable
* My courses
* My sections
* My students

Admin may still have backend authority for exceptional cases, but the admin UI should focus on management, not teaching.

---

## 2. SUB_ADMIN

Operational data manager under the main admin.

Responsibilities:

* Register and manage students.
* Register and manage teachers.
* Manage managers.
* Manage finance managers.
* Manage courses.
* Manage sections.
* Assign teachers to sections.
* Enroll students into sections.
* Manage schedules.
* Manage cohorts.
* Manage academic cycles.
* Manage promotions.
* View transcript reports.
* Correct finalized grades if allowed by the finalized-grade correction flow.
* View finance transactions for audit only, if desired.
* Email anyone in the org.

Restrictions:

* Cannot manage main admin.
* Cannot create/edit/delete other sub admins.
* Cannot access academic teaching tools like materials upload, assessment creation, daily grading workflows, etc.
* Cannot operate finance unless specifically allowed later.
* Cannot change organization ownership.

Main admin manages sub admins.

---

## 3. ORG_MANAGER

Academic manager.

Responsibilities:

* Monitor academic activity.
* Manage assigned academic sections/students.
* Create/review assessments if section-assigned.
* Review grades.
* Participate in grade finalization flow.
* Manage attendance or academic review where relevant.
* View academic progress and reports.

Restrictions:

* No finance access.
* No organization settings access.
* No teacher account creation/deletion.
* No student registration/deletion unless intentionally retained.
* No cohort/cycle structural management unless explicitly kept.
* No sub admin management.
* No finance manager management.

Important decision:

Managers can participate in finalizing grades because it is still an academic decision, but this should move into a dedicated grade finalization UI instead of requiring managers/admins to enter each section manually.

---

## 4. FINANCE_MANAGER

Dedicated finance role.

Responsibilities:

* Manage financial structures.
* Create manual finance entries.
* Confirm/reject payment claims.
* Mark entries as paid.
* View finance reports.
* Manage student/teacher finance records.
* Handle finance dashboards and transaction views.
* Email allowed to anything in the org only.

Restrictions:

* No academic materials.
* No assessments.
* No grades.
* No attendance.
* No courses/sections management unless read-only labels are needed.
* No org settings.
* No user management except finance-linked record references.

Finance is critical and large enough to deserve its own isolated role.

---

## 5. TEACHER

Teaching-only role.

Responsibilities:

* View assigned sections.
* View assigned students.
* Upload materials for assigned sections.
* Create assessments for assigned sections.
* Grade assigned assessments.
* Mark attendance for assigned sections.
* View own timetable.
* View own profile.
* Communicate with allowed users.

Restrictions:

* Cannot manage schedules.
* Cannot manage users.
* Cannot manage finance.
* Cannot manage academic cycles/cohorts.
* Cannot finalize grades if finalization is moved upward.

Potential change:

Teachers should submit/publish grades, but finalization should move to Manager/Admin/SubAdmin flow.

---

## 6. STUDENT

Student role remains mostly unchanged.

Responsibilities:

* View own courses.
* View own sections.
* View own timetable.
* View assessments.
* Submit work.
* View released grades.
* View attendance.
* View transcript.
* View own finance records.
* Communicate based on chat rules.
* (New permission) Email Finace Managers. This allows communication about fees and issues related to fees.
* (New permission) Initiate chat with own teachers (currently their active teachers from sections they're enrolled in).

Restrictions:

* Cannot access management pages.
* Cannot manage users.
* Cannot initiate unrestricted chats.

---

## 7. GUARDIAN

Student-linked observer/support role.

The product label should be `Guardian`, not `Parent`.

A guardian may be:

* Father
* Mother
* Uncle
* Aunt
* Elder brother
* Elder sister
* Grandparent
* Other

Data model rule:

```txt
One guardian can be linked to many students.
One student can have only one guardian.
```

Responsibilities:

* View linked student profile summary.
* View linked student attendance.
* View linked student grades.
* View linked student timetable.
* View linked student transcript.
* View linked student finance/fees.
* View announcements relevant to linked student.
* Receive student-related notifications.

Allowed:

* Chat with teachers of the linked student(s).
* Email to teachers of the linked students and higher management (sub admins, finance management).

Restrictions:

* Cannot submit assessments.
* Cannot modify academic records.
* Cannot chat freely.
* Cannot access management pages.
* Cannot view unrelated students.

Guardian creation must include relationship information.

Example:

```txt
Guardian: Ahmed Khan
Relationship to student: Uncle
Linked students: Ali Khan, Sara Khan
```

---

# Phase 0: Pre-Implementation Audit

## Goal

Before changing anything, confirm exact current behavior and identify all places where roles are hardcoded.

## Tasks

1. Search backend for all role checks:

   * `ORG_ADMIN`
   * `ORG_MANAGER`
   * `TEACHER`
   * `STUDENT`
   * `SUPER_ADMIN`
   * `PLATFORM_ADMIN`

2. Search frontend for all role checks:

   * Sidebar items
   * Route guards
   * Page redirects
   * Button visibility
   * Form field visibility
   * Action menus

3. Search for all finance access logic.

4. Search for all grade finalization logic.

5. Search for all user creation/editing role logic.

6. Search for all settings access logic.

7. Search for all chat role rules.

8. Produce a short implementation map:

```txt
Feature:
Backend files:
Frontend files:
Role checks:
Known mismatches:
Suggested target roles:
```

## Output

A compact implementation map before coding.

No functional changes yet.

---

# Phase 1: Role Enum and Base Schema Expansion

## Goal

Add new roles safely without immediately changing behavior everywhere.

## New Roles

Add:

```txt
SUB_ADMIN
FINANCE_MANAGER
GUARDIAN
```

Keep existing:

```txt
ORG_ADMIN
ORG_MANAGER
TEACHER
STUDENT
SUPER_ADMIN
PLATFORM_ADMIN
```

## Tasks

1. Update role enum in Prisma/backend/shared types.

2. Update frontend role type definitions.

3. Update auth/session payload typing.

4. Update any role display label helper.

5. Update role badge components.

6. Update role selection components where needed, but do not expose new roles everywhere yet.

7. Run Prisma migration if required.

8. Make sure login/session does not break for new role values.

## Verification

* Existing users can still log in.
* Existing sidebars still load.
* No role enum crash.
* No TypeScript role narrowing crash.
* No Prisma migration issue.

---

# Phase 2: Guardian Data Model

## Goal

Introduce guardian accounts and student linkage.

## Data Model

Create guardian profile model if user profile tables are role-specific.

Suggested structure:

```txt
GuardianProfile
- id
- userId
- organizationId
- phone
- address
- relationshipLabel? // optional default relationship if needed
- createdAt
- updatedAt
```

Student should reference guardian:

```txt
Student.guardianId nullable
```

Because:

```txt
One Guardian -> many Students
One Student -> one Guardian
```

Relationship should probably live on the student-guardian link.

Since each student only has one guardian, simplest:

```txt
Student.guardianId
Student.guardianRelationship
```

Example:

```txt
guardianId = guardian profile id
guardianRelationship = "Uncle"
```

## Tasks

1. Add Guardian profile model.

2. Add nullable guardian relation to Student.

3. Add relationship field:

   * required when assigning a guardian
   * examples: Father, Mother, Uncle, Aunt, Elder Brother, Elder Sister, Other

4. Add migration.

5. Update seed/test data if needed.

6. Update user creation service to support guardian role.

7. Update student create/edit flow to optionally link guardian.

8. Add backend validation:

   * guardian must belong to same organization
   * student can only have one guardian
   * guardian can have many students

## Verification

* Can create guardian.
* Can link guardian to one or more students.
* A student cannot have multiple guardians.
* Guardian cannot see unrelated student data.

---

# Phase 3: Sub Admin Management Flow

## Goal

Allow main admin to create and manage sub admins.

## Rules

Only `ORG_ADMIN` can:

* Create sub admins.
* Edit sub admins.
* Delete/disable sub admins.
* Restore sub admins.
* Change sub admin status.

Sub admin cannot:

* Manage main admin.
* Manage other sub admins.
* Promote anyone to sub admin.
* Demote sub admins.

## Backend Tasks

1. Add user creation support for `SUB_ADMIN`.

2. Add backend role guards:

   * `ORG_ADMIN` only for sub admin creation/management.

3. Add service-level protections:

   * cannot edit main admin from sub admin.
   * cannot delete main admin.
   * cannot sub admin manage sub admin.

4. Ensure organization scoping.

5. Add restore/status update support if consistent with teacher/student flows.

## Frontend Tasks

1. Add Sub Admins page.

2. Add Sub Admin list.

3. Add Create Sub Admin form.

4. Add Edit Sub Admin form.

5. Add Status/restore controls if supported.

6. Add sidebar link only for `ORG_ADMIN`.

## Verification

* Main admin can create sub admin.
* Sub admin can log in.
* Sub admin cannot access sub admin management.
* Sub admin cannot modify main admin.
* Existing admin management remains safe.

---

# Phase 4: Finance Manager Flow

## Goal

Create dedicated finance-only role.

## Rules

Finance manager can:

* View finance dashboard.
* Manage finance structures.
* Create manual finance entries.
* Confirm/reject payment claims.
* Mark finance entries as paid.
* View finance reports.
* View finance-related student/teacher references.

Finance manager cannot:

* Manage courses.
* Manage sections.
* Manage schedules.
* Manage teachers/students except finance-linked display data.
* Manage assessments.
* Manage grades.
* Manage attendance.
* Manage academic cycles.
* Manage cohorts.
* Manage promotions.
* Manage org settings.

## Backend Tasks

1. Add `FINANCE_MANAGER` to finance controller guards.

2. Remove `ORG_MANAGER` from finance management guards.

3. Decide admin/sub admin finance level:

   * Option A: Admin/SubAdmin read-only audit.
   * Option B: Admin full finance, SubAdmin read-only.
   * Recommended:

     * `ORG_ADMIN`: read audit + emergency override if needed.
     * `SUB_ADMIN`: read-only finance audit.
     * `FINANCE_MANAGER`: finance operations.

4. Make finance read/write permissions explicit:

   * finance read audit roles
   * finance write roles

5. Update finance service checks.

6. Update finance statistics access.

7. Update payment claim actions.

## Frontend Tasks

1. Add Finance Manager dashboard/sidebar.

2. Hide all non-finance links.

3. Finance Manager sidebar should include:

   * Overview
   * Finance
   * Transactions
   * Payment Claims
   * Reports
   * Profile Settings
   * Change Password
   * Contact/Mail if supported

4. Remove finance links from Manager sidebar.

5. Make Admin/SubAdmin finance views audit-only if that decision is implemented.

## Verification

* Finance manager can operate finance.
* Manager cannot access finance backend.
* Hidden finance pages are also backend-blocked.
* Student/teacher finance self-access remains unchanged.

---

# Phase 5: Manager Role Reduction

## Goal

Turn Manager into a true academic manager instead of mini-admin.

## Remove From Manager

Remove backend and frontend access to:

* Finance management.
* Organization settings.
* Teacher account creation/edit/delete/restore.
* Student account creation/edit/delete/restore, unless intentionally retained.
* Academic cycle creation/edit/delete/activate, unless intentionally retained.
* Cohort creation/edit/delete, unless intentionally retained.
* Promotions execution, unless intentionally retained.
* GPA policy management.
* Organization-wide admin actions.

## Keep For Manager

Manager should keep:

* Academic dashboard.
* Assigned sections.
* Assigned students.
* Assigned schedules/timetable.
* Assessments for assigned sections.
* Grades for assigned sections.
* Attendance for assigned sections.
* Academic reports.
* Transcript review.
* Grade finalization participation if included in finalization workflow.

## Decision Needed

Decide if Manager can view all academic records or only assigned scope.

Recommended:

```txt
Manager reads broader academic reports.
Manager writes only assigned academic scope.
```

Example:

```txt
Can view grade finalization dashboard for all sections.
Can finalize grades only if allowed by policy.
Can edit regular grades only for assigned sections.
```

## Backend Tasks

1. Remove Manager from non-academic CRUD guards.

2. Remove Manager from finance write guards.

3. Remove Manager from organization settings guards.

4. Remove Manager from teacher management guards.

5. Remove Manager from student management guards if moving those to SubAdmin.

6. Keep/adjust academic service assignment checks.

7. Make sure hidden frontend pages are also backend-blocked.

## Frontend Tasks

1. Rebuild Manager sidebar:

   * Overview
   * Messages
   * My Sections
   * My Students
   * Attendance
   * Timetable
   * Assessments
   * Grades
   * Grade Finalization, if applicable
   * Academic Reports
   * Profile Settings
   * Mail
   * Contact Us
   * Change Password

2. Remove:

   * Finance
   * Teachers
   * Students management
   * Courses management
   * Sections management
   * Academic Cycles management
   * Cohorts management
   * Promotions management
   * Settings
   * GPA Policies

## Verification

* Manager no longer has backend access to removed features.
* Manager sidebar matches backend authority.
* Manager can still perform intended academic work.
* Existing assigned-section filters still work.

---

# Phase 6: Admin/SubAdmin Management Dashboard Restructure

## Goal

Remove teaching clutter from Admin/SubAdmin portals and create clean management dashboards.

## Admin Sidebar Target

Main Admin sidebar:

```txt
Overview
Sub Admins
Users
Teachers
Students
Guardians
Managers
Finance Managers
Courses
Sections
Schedules
Academic Cycles
Cohorts
Promotions
Transcript Reports
Grade Finalization
Finance Audit
GPA Policies
Settings
Messages
Mail
Contact Us
Change Password
```

Optional grouping:

```txt
Management
Academics Setup
Records
Finance Audit
Communication
Settings
```

## Sub Admin Sidebar Target

Sub Admin sidebar:

```txt
Overview
Users
Teachers
Students
Guardians
Managers
Finance Managers
Courses
Sections
Schedules
Academic Cycles
Cohorts
Promotions
Transcript Reports
Grade Finalization
Finance Audit
Messages
Mail
Contact Us
Change Password
```

No:

```txt
Settings
Sub Admin Management
Teaching tools
Course materials
Daily grading by assigned section
Teacher-style attendance
```

## Backend Tasks

1. Add `SUB_ADMIN` to operational management controllers.

2. Exclude `SUB_ADMIN` from:

   * org ownership settings
   * sub admin management
   * main admin mutation
   * finance operations, unless explicitly allowed

3. Allow `SUB_ADMIN` to:

   * manage teachers
   * manage students
   * manage guardians
   * manage managers
   * manage finance managers
   * manage courses
   * manage sections
   * manage schedules
   * manage cohorts
   * manage academic cycles
   * manage promotions
   * view transcript reports
   * use grade finalization/correction flow

## Frontend Tasks

1. Create dashboard layout config per role.

2. Avoid giant conditional sidebars.

3. Prefer centralized sidebar config:

```txt
roleSidebarItems[role]
```

4. Use feature groups and permissions.

5. Ensure Admin/SubAdmin do not see teacher-only pages.

## Verification

* Admin sidebar is management-focused.
* SubAdmin sidebar is management-focused but excludes ownership controls.
* No broken links.
* No frontend-visible page without backend authority.

---

# Phase 7: Grade Finalization Workflow Redesign

## Goal

Move grade finalization out of teacher/section-specific pages into a higher-level audit/finalization flow.

## Current Problem

Finalization currently exists inside academic workflows. Admin/Manager/SubAdmin may need to finalize grades without acting like the assigned teacher or visiting each section manually.

## Target Flow

Create a dedicated Grade Finalization dashboard.

Accessible by:

```txt
ORG_ADMIN
SUB_ADMIN
ORG_MANAGER
```

Potentially:

```txt
ORG_ADMIN = all sections
SUB_ADMIN = all sections
ORG_MANAGER = academic scope/all sections depending on policy
```

## UI Requirements

Grade Finalization Dashboard should show:

* Academic cycle selector.
* Course selector.
* Section selector.
* Teacher selector.
* Status filter:

  * Draft
  * Published
  * Ready for Finalization
  * Finalized
  * Needs Review
* Section summary cards/table:

  * Course
  * Section
  * Teacher
  * Total students
  * Graded students
  * Missing grades
  * Published status
  * Finalized status
  * GPA policy snapshot
  * Last updated by
  * Last updated at

## Actions

For each section/assessment/cycle result group:

* View grade audit.
* View missing grades.
* View grade distribution.
* Finalize.
* Unfinalize/correct if allowed.
* Export/report if supported.

## Backend Tasks

1. Create grade finalization endpoints.

2. Centralize finalization authority:

   * Teachers should publish/submit grades.
   * Managers/SubAdmins/Admins finalize.

3. Decide whether teachers can still finalize.

   * Recommended: remove teacher finalization.
   * Teacher can publish/submit for review.

4. Add service-level checks:

   * finalized grades can only be edited by Admin/SubAdmin, and maybe Manager if intended.
   * all edits after finalization must be logged.

5. Add audit trail:

   * finalizedById
   * finalizedAt
   * lastCorrectedById
   * lastCorrectedAt
   * correctionReason if changing finalized grades

6. Ensure GPA policy lock rules remain intact:

   * academic cycles require GPA policy
   * once finalized grades are pushed, GPA policy cannot change

## Frontend Tasks

1. Build Grade Finalization page.

2. Add to Admin/SubAdmin/Manager sidebar.

3. Remove or hide finalize action from teacher grading page if policy changes.

4. Teacher page should show:

   * Draft
   * Published
   * Submitted for finalization
   * Finalized

## Verification

* Teachers can grade but not improperly finalize.
* Managers/Admins/SubAdmins can finalize from one dashboard.
* Finalized-grade edits are controlled and auditable.
* GPA policy snapshot remains safe.

---

# Phase 8: User Management Restructure

## Goal

Create a unified but role-aware user management system.

## User Types

The system should support management of:

* Sub Admins
* Managers
* Finance Managers
* Teachers
* Students
* Guardians

## Recommended UI

Create a central Users area with tabs:

```txt
Sub Admins
Managers
Finance Managers
Teachers
Students
Guardians
```

But role visibility differs:

```txt
ORG_ADMIN:
- all tabs

SUB_ADMIN:
- Managers
- Finance Managers
- Teachers
- Students
- Guardians

ORG_MANAGER:
- no management tabs, or academic-only student views

FINANCE_MANAGER:
- no user management

TEACHER:
- assigned students only

STUDENT:
- own profile

GUARDIAN:
- linked students
```

## Backend Tasks

1. Clean up user creation services.

2. Avoid using teacher creation flow to create managers if possible.

3. Create clearer role-specific creation methods or one safe generic method with strict role rules.

4. Enforce:

   * only Admin can create SubAdmins
   * Admin/SubAdmin can create Managers
   * Admin/SubAdmin can create FinanceManagers
   * Admin/SubAdmin can create Teachers
   * Admin/SubAdmin can create Students
   * Admin/SubAdmin can create Guardians

5. Prevent lower roles from modifying higher/equal roles.

## Role Hierarchy

Suggested hierarchy:

```txt
ORG_ADMIN       rank 100
SUB_ADMIN       rank 80
FINANCE_MANAGER rank 50
ORG_MANAGER     rank 50
TEACHER         rank 30
GUARDIAN        rank 20
STUDENT         rank 10
```

Mutation rule:

```txt
A user can only manage roles below their rank.
Special exception:
ORG_ADMIN manages SUB_ADMIN.
SUB_ADMIN cannot manage SUB_ADMIN.
```

Do not rely only on rank if exceptions are needed.

## Verification

* No role can modify itself in dangerous ways.
* No sub admin can touch main admin.
* No manager can create teachers if that permission is removed.
* User creation is not scattered across unrelated teacher services.

---

# Phase 9: Guardian Portal

## Goal

Create a useful but tightly scoped Guardian portal.

## Sidebar Target

Guardian sidebar:

```txt
Overview
Linked Students
Attendance
Grades
Timetable
Transcript
Fees & Payments
Announcements
Messages, optional
Profile Settings
Change Password
Contact Us
```

## Dashboard

Guardian Overview should show:

* Linked student selector if more than one.
* Attendance summary.
* Recent grades.
* Upcoming assessments.
* Upcoming schedule.
* Fee/payment summary.
* Recent announcements.

## Backend Scope

Every guardian request must resolve linked students first.

Guardian can only access:

```txt
student.guardianId == currentGuardian.id
```

## Features

Guardian can view:

* Linked student profile summary.
* Linked student attendance.
* Linked student grades.
* Linked student transcript.
* Linked student timetable.
* Linked student finance records.
* Linked student announcements.

Guardian cannot:

* Submit assessments.
* Edit student profile unless explicitly allowed later.
* View unrelated students.
* Access teacher/admin/manager pages.

## Verification

* Guardian with two linked students can switch between them.
* Guardian cannot query another student by ID.
* Student with no guardian works normally.
* Guardian deletion/unlinking does not break student.

---

# Phase 10: Chat and Mail Role Review

## Goal

Simplify communication rules after role restructuring.

## Current Problem

Chat rules are strict and complex.

Current examples:

* Student cannot initiate direct chats.
* Teacher can initiate direct chats only with Admin/Manager.
* Manager/Admin can initiate broad chats.
* Group chat has internal admin/mod/member roles.
* Read-only mode exists.

## Suggested Direction

Separate three systems:

```txt
Chat Creation Rules
Chat Membership Rules
In-Chat Role Rules
```

## Recommended Chat Creation Rules

Student:

* Can DM assigned teachers only, if enabled.
* Can participate in section chats.
* Cannot create groups.
* Cannot DM other students by default. requires enabling.
* Cannot DM admin/subadmin/manager by default.

Guardian:

* Can DM finance/support/admin only if enabled.
* Can receive messages related to linked students.
* Cannot create groups.

Teacher:

* Can DM assigned students.
* Can DM managers/admin/subadmins.
* Can create section chats for assigned sections.

Manager:

* Can DM teachers/students in academic scope.
* Can create academic group chats for assigned sections.

SubAdmin/Admin:

* Can initiate org-level/direct/group chats according to admin rules.

FinanceManager:

* Can mail (not chat message) students/guardians for finance-related communication if enabled.
* Should not have academic group creation power.

## In-Chat Roles

Keep existing:

```txt
Chat Admin
Moderator
Member
Read-only mode
```

Rules:

* Chat Admin manages members and roles.
* Moderator can send in read-only mode.
* Member follows normal send/read rules.
* Read-only mode allows only Admin/Moderator to send.

## Mail

Mirror communication rules where possible, but stricter for bulk messaging.

## Verification

* Chat rules are easier to reason about.
* Students have a safe path to contact teachers.
* Finance managers do not gain academic messaging power.
* Guardians do not gain unrestricted communication.

---

# Phase 11: Backend Permission Cleanup

## Goal

Remove frontend/backend mismatches and hidden access.

## Known Issues To Fix

Current issues include: (if not fixed in other phases already)

* Manager backend settings access while frontend blocks settings.
* Manager finance backend access even though finance should move to FinanceManager.
* Manager currently overlaps heavily with Admin.
* Teacher has some backend access to cohorts/transcripts that may not match frontend.
* Finance controller reads default to WRITE because no class-level READ access exists.
* Announcements bypass global AccessGuard via anonymous access and rely on service checks.

## Tasks

1. Define a backend permission matrix.

2. Update controller role guards.

3. Update service-level checks.

4. Update query-level scoping.

5. Remove Manager from non-academic backend permissions.

6. Add SubAdmin to operational management permissions.

7. Add FinanceManager to finance permissions.

8. Add Guardian to linked-student read permissions.

9. Make settings Admin-only unless SubAdmin is intentionally allowed.

10. Make GPA policy management Admin/SubAdmin depending on product decision.

11. Review `@Access(NONE)` routes.

12. Review announcement anonymous access.

13. Review finance read/write access annotation.

## Verification

* Every frontend visible action has matching backend permission.
* Every backend permission has intentional product reason.
* Hidden frontend links are not the only security layer.
* All data queries are org-scoped and role-scoped.

---

# Phase 12: Frontend Navigation and Route Restructure

## Goal

Make each role feel like it has its own product experience.

## Tasks

1. Centralize route config.

2. Centralize sidebar config.

3. Create role-specific sidebar groups.

4. Remove scattered role checks.

5. Add dashboards for:

   * Admin
   * SubAdmin
   * Manager
   * FinanceManager
   * Teacher
   * Student
   * Guardian

6. Ensure route redirects match backend authority.

7. Remove teaching links from Admin/SubAdmin.

8. Remove finance links from Manager.

9. Add Guardian portal routes.

10. Add FinanceManager portal routes.

## Suggested Dashboard Focus

Admin:

```txt
Org health, approvals, users, audit, settings
```

SubAdmin:

```txt
Operational tasks, registrations, schedules, cycles, promotions
```

Manager:

```txt
Academic monitoring, grades, attendance, assigned sections
```

FinanceManager:

```txt
Payments, claims, finance entries, ledgers
```

Teacher:

```txt
Today’s schedule, assigned sections, assessments, grading
```

Student:

```txt
Upcoming classes, assessments, grades, attendance
```

Guardian:

```txt
Linked students, attendance, grades, fees
```

## Verification

* No broken sidebar links.
* No inaccessible pages shown.
* No allowed backend page hidden accidentally unless intentionally hidden.
* Role switching is not needed because one user has one role.

---

# Phase 13: Docs Update

## Goal

Update documentation so users understand the new role system.

## Docs To Update

1. Role overview.

2. Admin guide.

3. Sub Admin guide.

4. Manager guide.

5. Finance Manager guide.

6. Teacher guide.

7. Student guide.

8. Guardian guide.

9. Grade finalization guide.

10. Finance module guide.

11. User registration guide.

12. Academic cycle/cohort guide.

13. Chat/mail rules guide.

## Documentation Style

Use:

* Tables.
* Role matrices.
* Flow diagrams.
* Step-by-step guides.
* Screenshots when available.
* “Who can do this?” boxes.

## Required Tables

Role vs Feature matrix:

```txt
Feature | Admin | SubAdmin | Manager | FinanceManager | Teacher | Student | Guardian
```

Role responsibilities table:

```txt
Role | Main job | Can manage | Cannot access
```

Grade finalization flow:

```txt
Teacher submits grades -> Manager/Admin/SubAdmin reviews -> Finalize -> Transcript uses GPA snapshot
```

Guardian flow:

```txt
Create guardian -> link student -> guardian views student records
```

Finance role flow:

```txt
Finance manager handles payment claims and finance entries
```

## Verification

* Docs match UI.
* Docs match backend permissions.
* No old Manager finance claims remain.
* No old Admin teaching workflow screenshots remain unless still relevant.

---

# Phase 14: Tests and TDD Updates

## Goal

Add tests for the new access system so future changes do not reopen permission holes.

## Backend Tests

Add tests for:

### Role Guards

* Admin access.
* SubAdmin access.
* Manager reduced access.
* FinanceManager finance-only access.
* Guardian linked-student access.
* Teacher assigned-section access.
* Student self access.

### User Management

* Admin can create SubAdmin.
* SubAdmin cannot create SubAdmin.
* SubAdmin cannot edit Admin.
* SubAdmin can create Teacher/Student/Guardian/Manager/FinanceManager.
* Manager cannot create Teacher if removed.
* FinanceManager cannot create users.

### Finance

* FinanceManager can perform finance actions.
* Manager cannot perform finance actions.
* Teacher/student self finance still works.
* SubAdmin audit-only behavior works if implemented.

### Guardian

* Guardian can view linked student.
* Guardian cannot view unrelated student.
* Guardian can have many linked students.
* Student cannot have multiple guardians.

### Grade Finalization

* Teacher can submit/publish grades.
* Teacher cannot finalize if changed.
* Manager/Admin/SubAdmin can finalize.
* Finalized grade edits require correct role.
* GPA policy snapshot remains locked.

### Settings

* Manager cannot write settings.
* SubAdmin permissions match product decision.
* Admin can write settings.

## Frontend Tests

Add tests for:

* Sidebar items by role.
* Route redirects by role.
* Hidden buttons by role.
* Guardian portal linked-student switcher.
* FinanceManager navigation.
* Grade finalization dashboard visibility.

## Verification

* Tests fail under old mismatched permissions.
* Tests pass under new role model.
* Critical access paths are covered.

---

# Phase 15: Migration and Backfill Strategy

## Goal

Safely move existing users/data into the new model.

## Existing Users

Current roles:

```txt
ORG_ADMIN
ORG_MANAGER
TEACHER
STUDENT
```

Need to add:

```txt
SUB_ADMIN
FINANCE_MANAGER
GUARDIAN
```

## Migration Decisions

1. Existing Admins remain Admins.

2. Existing Managers remain Managers initially.

3. Existing finance-capable Managers should NOT automatically become FinanceManagers unless explicitly migrated.

4. If an institute currently uses Manager for finance, provide manual migration path:

   * Create finance manager account.
   * Remove finance from manager.
   * Assign finance responsibility.

5. Guardians are new and should be created manually or imported later.

## Data Backfill

1. No guardian backfill required unless importing.

2. No sub admin backfill required.

3. No finance manager backfill required.

4. Add safe defaults where schemas require new fields.

## Rollout Option

Use feature flag or staged release if needed:

```txt
roles_v2_enabled
```

But if project is not production-heavy yet, direct migration may be acceptable.

## Verification

* Existing users do not lose login.
* Existing managers may lose finance/admin links intentionally.
* Existing finance data remains intact.
* No orphaned finance operations.
* No broken student records.

---

# Phase 16: Polishing and Tightening

## Goal

Make the system feel intentional, not patched.

## Tasks

1. Rename labels consistently:

   * `ORG_MANAGER` UI label: Manager or Academic Manager
   * `SUB_ADMIN` UI label: Sub Admin
   * `FINANCE_MANAGER` UI label: Finance Manager
   * `GUARDIAN` UI label: Guardian

2. Add helper functions:

   * `getRoleLabel(role)`
   * `canManageRole(actorRole, targetRole)`
   * `getRoleDashboardPath(role)`
   * `getSidebarItemsForRole(role)`

3. Add empty states:

   * No guardians yet.
   * No finance managers yet.
   * No sub admins yet.
   * No grade batches ready to finalize.

4. Improve error messages:

   * “Only the main admin can manage sub admins.”
   * “Finance managers can only access finance records.”
   * “You can only view students linked to your guardian account.”
   * “This grade batch has already been finalized.”

5. Add audit labels:

   * Created by
   * Updated by
   * Finalized by
   * Corrected by

6. Review notification rules:

   * Guardian notifications.
   * Finance manager notifications.
   * Grade finalization notifications.
   * Teacher grade submission notifications.

7. Review mail/chat target rules with new roles.

## Verification

* UI labels are clean.
* Error messages are understandable.
* No old role wording leaks.
* No “Manager as mini-admin” behavior remains unless intentionally kept.

---

# Phase 17: Full Verification Checklist

## Auth

* All roles can log in.
* Blocked/suspended users behave correctly.
* Access level still works.
* Platform roles remain unaffected.

## Admin

* Can manage sub admins.
* Can manage org settings.
* Can view audit/management pages.
* Does not see teacher clutter.

## SubAdmin

* Can manage operational data.
* Cannot manage main admin.
* Cannot manage sub admins.
* Cannot access teaching workflows.
* Cannot operate finance unless explicitly allowed.

## Manager

* Has academic manager tools.
* No finance access.
* No org settings access.
* No user-management access unless intentionally retained.
* Can participate in grade finalization if intended.

## FinanceManager

* Can access finance.
* Cannot access academic modules.
* Cannot access user management.
* Cannot access org settings.

## Teacher

* Can access assigned sections.
* Can upload materials.
* Can create assessments.
* Can grade assigned work.
* Cannot access management/finance.
* Finalization behavior matches new policy.

## Student

* Existing student portal works.
* Student cannot access management pages.
* Student finance self-access works.
* Student transcript still works.

## Guardian

* Can view linked students only.
* Can switch between linked students.
* Cannot view unrelated students.
* Cannot perform student actions.

## Finance

* FinanceManager can operate finance.
* Manager cannot.
* Student/teacher self finance still works.
* Admin/SubAdmin audit behavior works if implemented.

## Grades

* Grade finalization dashboard works.
* Finalized grades are protected.
* Grade corrections are audited.
* GPA policy snapshots remain locked.

## Docs

* Role docs updated.
* User guides updated.
* Admin docs updated.
* Finance docs updated.
* Guardian docs added.

## Tests

* Backend access tests pass.
* Frontend route/sidebar tests pass.
* Guardian scope tests pass.
* Finance role tests pass.
* Grade finalization tests pass.

## Cleanup

* Remove obsolete role checks.
* Remove duplicated sidebar logic.
* Remove frontend-only “security.”
* Remove dead Manager finance code.
* Remove old admin teaching links.
* Confirm no TODOs remain around role reshaping.

---

# Final Notes

This should not be implemented as one giant chaotic commit.

Recommended implementation order:

```txt
1. Add roles safely.
2. Add Guardian model/linking.
3. Add SubAdmin flow.
4. Add FinanceManager flow.
5. Reduce Manager permissions.
6. Restructure sidebars/routes.
7. Build grade finalization dashboard.
8. Update docs/tests.
9. Clean and verify.
```

The most dangerous parts are:

```txt
- Manager permission reduction
- Finance role isolation
- Grade finalization migration
- Guardian data scoping
- Frontend/backend permission mismatch cleanup
```

Do these slowly and test heavily.

The final system should feel like:

```txt
Admin governs.
SubAdmin manages.
Manager supervises academics.
FinanceManager handles money.
Teacher teaches.
Student studies.
Guardian observes/supports.
```
