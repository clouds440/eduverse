# Current Roles

Role names below use product labels with current enum mapping:
- Admin = `ORG_ADMIN`
- Manager = `ORG_MANAGER`
- Teacher = `TEACHER`
- Student = `STUDENT`

## ADMIN

Sidebar:
- Overview
- Messages
- Courses
- Academic Cycles
- Cohorts
- Sections
- Teachers
- Students
- Attendance
- Schedules
- Transcripts
- Promotions
- Finance
- GPA Policies
- Settings
- Mail
- Contact Us
- Change Password

Permissions:
- Create, edit, delete Courses
- Create, edit, delete Academic Cycles; activate cycles
- Create, edit, delete Cohorts; add/remove cohort students and sections
- Create, edit, delete Sections
- Create, edit, delete Teachers
- Create Managers by creating a teacher profile with manager role
- Edit Manager/Teacher profiles, including role changes between Teacher and Manager
- Restore deleted Teachers
- Create, edit, delete Students
- Restore deleted Students
- Edit student registration number and roll number
- Create, edit, delete Schedules
- Create attendance sessions and mark attendance
- View Assessments and Grades
- Edit grades, including finalized grades
- Publish and finalize grades
- View all submissions for an assessment
- View student transcripts
- View academic-cycle transcript reports
- Promote students
- Create, edit, delete GPA Policies; set default GPA policy
- Create and edit Finance structures
- Create manual Finance entries
- Confirm or reject Finance payment claims
- Mark accessible Finance entries as paid
- Update organization settings, logo, and reapply organization
- Update any org user avatar
- Create organization-wide, role-based, and section announcements subject to target rules
- Create mail; manage accessible mail status through mail service
- Create direct and group chats; chat service still applies participant and org isolation rules

Data Scope:
- All organization data for courses, cycles, cohorts, sections, teachers, students, attendance, schedules, transcripts, promotions, finance, and settings
- All assessments and grades in the organization
- All section students when viewing sections or attendance
- Finance is scoped to own organization unless `SUPER_ADMIN`
- Chat and mail are scoped by service-specific participant/recipient rules
- Access level/status guard can reduce or block access regardless of role

Implementation Notes:
- Backend enforced: broad Admin access is mostly via `@Roles(Role.ORG_ADMIN, ...)` in org controllers plus org-id filtering in services.
- Backend enforced: only Admin can write GPA policies.
- Backend enforced: only Admin can update finalized grades.
- Backend enforced: Admin cannot create assessments; the controller allows Manager/Teacher and the service rejects `ORG_ADMIN`.
- Mixed: Admin sees settings page in frontend and backend allows Admin/Manager settings writes.
- Query filtering: org data is filtered by `organizationId` or `@OrgId()` in services.

## MANAGER

Sidebar:
- Overview
- Messages
- Courses
- Academic Cycles
- Cohorts
- Sections
- Teachers
- Students
- Attendance
- Schedules
- Transcripts
- Promotions
- Finance
- Timetable
- Grades
- Profile Settings
- Mail
- Contact Us
- Change Password

Permissions:
- Create, edit, delete Courses
- Create, edit, delete Academic Cycles; activate cycles
- Create, edit, delete Cohorts; add/remove cohort students and sections
- Include/exclude enrollments in cohorts
- Create, edit, delete Sections
- Create Teachers
- Edit and delete Teacher profiles
- Restore deleted Teachers
- Cannot create Managers
- Cannot modify Admin profiles
- Cannot modify other Manager profiles
- Cannot change status for self or other Managers
- Cannot delete Admin or Manager profiles
- Create, edit, delete Students
- Restore deleted Students
- Cannot edit student registration number or roll number
- Create, edit, delete Schedules
- Create attendance sessions and mark attendance
- Create Assessments only for sections where assigned as a teacher
- Edit/delete Assessments only for sections where assigned as a teacher
- View all org Assessments
- Update Grades only for sections where assigned as a teacher
- Cannot update finalized grades
- Publish and finalize grades
- View all submissions for an assessment
- View student transcripts
- View academic-cycle transcript reports
- Promote students
- Read GPA policies through backend
- Cannot create, edit, delete, or set default GPA policies
- Create and edit Finance structures
- Create manual Finance entries
- Confirm or reject Finance payment claims
- Mark accessible Finance entries as paid
- Backend allows organization settings, logo, and reapply writes
- Frontend redirects Manager away from Settings and GPA Policies pages
- Update any org user avatar
- Create section announcements; cannot create organization-wide announcements
- Create role announcements except cannot target Org Admin, Platform Admin, or Super Admin
- Create mail with restrictions on large groups and Manager targets
- Create direct and group chats; chat service applies participant and org isolation rules

Data Scope:
- Management pages generally show all organization data
- Teacher-like academic actions are section-assignment scoped
- Timetable/profile are based on Manager's teacher profile
- Finance management views are organization-wide
- Access level/status guard can reduce or block access regardless of role

Implementation Notes:
- Backend enforced: Manager is included with Admin in most academic CRUD controllers.
- Backend enforced: Manager-specific teacher-profile restrictions are in `teacher.service.ts`.
- Backend enforced: assessment and grade writes require assigned section.
- Frontend only: Settings and GPA Policies are hidden/redirected for Manager, but backend settings writes are allowed to Manager.
- Mixed: Manager has management sidebar plus teacher academic sidebar items.
- Query filtering: Manager's "my students/courses/sections" filters exist in frontend, but default management pages can query all org records.

## TEACHER

Sidebar:
- Overview
- Messages
- My Courses
- My Sections
- My Students
- Attendance
- Timetable
- Grades
- Profile Settings
- Mail
- Contact Us
- Change Password

Permissions:
- View own/assigned Courses through `my` filtering
- View assigned Sections
- View assigned Students
- View own Teacher profile
- Update own profile fields allowed by profile endpoint
- Upload own avatar
- Create Assessments only for assigned sections
- Edit/delete Assessments only for assigned sections
- View Assessments only for assigned sections
- Update Grades only for assigned sections
- Cannot update finalized grades
- Publish and finalize grades
- View submissions for accessible assessments
- Create attendance sessions and mark attendance only for assigned sections
- View attendance only for assigned sections
- View timetable from teacher assignments
- View Cohorts through backend
- Include/exclude enrollments in cohorts through backend
- View student transcripts through backend; frontend transcript search is available for non-students
- Read own Finance structures, entries, transactions, and stats for teacher-linked finance records
- Mark own Finance entries as paid
- Create section announcements only for assigned sections
- Cannot create organization-wide or role-based announcements
- Create mail, but cannot target Org Admin, Platform Admin, or Super Admin
- Search chat users among Org Admins, Org Managers, and assigned-section Students
- Initiate direct chats only with Org Admins or Org Managers
- Create group chats with service-level restrictions

Data Scope:
- Assigned sections
- Students enrolled in assigned sections
- Courses with assigned sections
- Own teacher profile
- Own teacher-linked finance records
- Own chat/mail participation and allowed contacts
- Access level/status guard can reduce or block access regardless of role

Implementation Notes:
- Backend enforced: section ownership checks exist for attendance, assessments, grades, course materials, chat search, and student attendance/profile access.
- Backend enforced: teacher direct-chat and mail target restrictions.
- Frontend only: Teacher list route redirect; many buttons hidden when not allowed.
- Query filtering: `my=true` is used for courses, sections, students, and grade-section lists.

## STUDENT

Sidebar:
- Overview
- Messages
- My Courses
- Assessments
- Grades
- Attendance
- Timetable
- Transcript
- Fees & Payments
- Profile Settings
- Mail
- Change Password

Permissions:
- View own Student portal
- Update own profile fields allowed by profile endpoint
- View own enrolled Courses/Sections through portal
- View own Assessments for enrolled sections
- Submit own Assessment once before deadline and before grade release/finalization
- View own Grades and released/final grades
- View own Attendance
- View own Timetable
- View own Transcript
- View own Finance structures, entries, transactions, and stats
- Mark own Finance entries as paid
- View announcements targeted to global, org, own role, or enrolled sections
- Participate in existing chats; cannot search users or initiate direct chats
- Cannot create mail
- Cannot access management lists except allowed shared pages

Data Scope:
- Own student record
- Own enrollments/sections/courses
- Own grades, submissions, attendance, timetable, transcript
- Own student-linked finance records
- Own chat participation
- Access level/status guard can reduce or block access regardless of role

Implementation Notes:
- Backend enforced: student profile, transcript, attendance, finance, assessment, submission, and grade filters.
- Frontend enforced: AuthContext redirects students away from non-student management routes.
- Query filtering: student services filter by `userId`, enrolled sections, or derived `studentId`.

# Access Level / Account Status

Backend model:
- `AccessLevel.NONE = 0`
- `AccessLevel.READ = 1`
- `AccessLevel.WRITE = 2`

User status mapping:
- `ACTIVE` => WRITE
- `ON_LEAVE` => WRITE
- `SUSPENDED` => READ
- `ALUMNI` => NONE
- `EMERITUS` => NONE
- `DELETED` => NONE
- Unknown/default => NONE

Organization status mapping:
- `APPROVED` => WRITE
- `PENDING` => NONE
- `REJECTED` => NONE
- `SUSPENDED` => NONE
- Unknown/default => NONE

Backend resolution:
- Final access is the most restrictive level: `Math.min(userAccess, orgAccess)`.
- If no organization status exists, final access equals user access.
- Platform roles (`SUPER_ADMIN`, `PLATFORM_ADMIN`) bypass the access-level guard.
- `JwtStrategy` loads fresh `user.status` and `organization.status` into `req.user` on each authenticated request.
- Login/session tokens also include `status`, `userStatus`, and calculated `accessLevel` for frontend display/routing.

Backend guard behavior:
- `AccessGuard` is registered globally in `app.module.ts`.
- Public routes bypass the guard.
- `@AnonymousAccess()` bypasses the guard.
- `@Access(AccessLevel.NONE)` explicitly bypasses status-based restrictions.
- If a route has no `@Access(...)`, it defaults to requiring WRITE.
- Routes marked `@Access(READ)` require final access >= READ.
- Routes marked `@Access(WRITE)` require final access >= WRITE.
- When final access is lower than required, backend throws `ForbiddenException`.
- For non-approved organization status, the error says the organization account is restricted.
- For suspended user status, the error says the account is suspended.

Current backend access annotations:
- Most org read controllers/classes use `@Access(READ)`.
- Most mutations use `@Access(WRITE)`.
- Settings, logo, reapply, mail, password/session endpoints use `@Access(NONE)`, so they can run even when org/user status would otherwise block normal access.
- Announcements controller has `@AnonymousAccess()`, so the status guard is bypassed for announcement reads/writes; service-level role checks still apply.
- Finance controller has no class-level `@Access(READ)`, so its read endpoints inherit the default WRITE requirement.

Frontend access-level behavior:
- The frontend trusts `user.accessLevel` from the JWT/session payload.
- `useAccess()` exposes `canRead`, `canWrite`, and `isBlocked`, but broad app enforcement is mainly in layouts/pages rather than this hook.
- `DashboardLayout` shows a Read-Only banner when `user.accessLevel === 1`.
- Org layout treats `accessLevel >= 1` as approved enough to show normal org navigation.
- Org layout treats `accessLevel === 0` as blocked for normal org pages.
- When blocked, org layout shows status overlays for `PENDING`, `REJECTED`, or `SUSPENDED` organization states.
- For blocked orgs, org layout allows only paths beginning with `/settings`, `/change-password`, `/mail`, or `/contact`.
- For non-approved orgs, sidebar links are reduced to Settings only for Admin; other links are hidden.
- For `SUSPENDED` user status, frontend shows Read-Only mode banners but does not remove all write buttons globally.
- For `ALUMNI` or `EMERITUS`, org layout shows an account-retired panel with Mail and Security Settings links.
- Frontend access-level display is not the source of truth; backend `AccessGuard` enforces write/read blocking.

# Feature Matrix

| Feature | Admin | Manager | Teacher | Student |
|---|---|---|---|---|
| Students | C/R/E/D/Restore; edit reg/roll | C/R/E/D/Restore; reg/roll locked | R assigned; view/edit page is watch mode | R/E self profile fields |
| Teachers | C/R/E/D/Restore; create/edit Managers | C/R/E/D/Restore Teachers; cannot create/edit/delete Managers/Admins | R self | None |
| Courses | C/R/E/D all | C/R/E/D all | R assigned | R enrolled |
| Sections | C/R/E/D all | C/R/E/D all | R assigned | R enrolled |
| Timetable | R via org routes | R own teaching schedule | R own teaching schedule | R own schedule |
| Schedules | C/R/E/D all | C/R/E/D all | R assigned | R enrolled |
| Materials | R all; write allowed by service role rules | R/write by service role rules | R/write assigned by service role rules | R enrolled |
| Assessments | R all; no create | C/E/D assigned; R all | C/R/E/D assigned | R enrolled; submit own |
| Attendance | C/R/E all sections | C/R/E all sections | C/R/E assigned | R own/enrolled |
| Grades | R/E all; E finalized | R all; E assigned; cannot E finalized | R/E assigned; cannot E finalized | R own released/final |
| Finance | C/R/E structures; C entries; confirm/reject claims; mark paid | C/R/E structures; C entries; confirm/reject claims; mark paid | R own teacher finance; mark own paid | R own student finance; mark own paid |
| Cohorts | C/R/E/D; manage students/sections/enrollments | C/R/E/D; manage students/sections/enrollments | R; include/exclude enrollments via backend | None |
| Academic Cycles | C/R/E/D; activate | C/R/E/D; activate | R | R backend; frontend redirects list page |
| Promotions | C/action | C/action | None | None |
| Transcripts | R student; R cycle reports | R student; R cycle reports | R student transcript backend | R self |
| Reports | R insights; R cycle transcript reports | R insights; R cycle transcript reports | R own insights | R own insights |
| Organization Settings | R/E backend and frontend | R/E backend; frontend redirects | R backend; frontend redirects | R backend; frontend redirects |
| GPA Policies | C/R/E/D/default | R backend only; frontend redirects | None | None |
| Announcements | C org/role/section | C role/section with restrictions; no org-wide | C assigned-section only | R only |
| Chat | C/R/E participant-scoped | C/R/E participant-scoped | Restricted create/search; participant-scoped | Participate only; cannot initiate direct/search |
| Mail | C/R/E service-scoped | C/R/E service-scoped with group restrictions | C/R/E service-scoped with target restrictions | Cannot create; reads only if participant/targeted |

Legend:
- C = Create/action
- R = Read/View
- E = Edit/Update
- D = Delete

# Special Rules

- Role guard: `RolesGuard` allows required roles and always allows `SUPER_ADMIN`.
- Status/access guard: `AccessGuard` blocks by final access level unless route is public, anonymous, platform role, or `@Access(NONE)`.
- Organization scope: most org data is constrained by `@OrgId()` or explicit `organizationId`.
- Course `my=true`: limits courses to sections taught by the current user.
- Section `my=true`: limits sections to current teacher assignments or current student enrollments.
- Student `my=true`: limits students to sections taught by the current user.
- Student profile access: Students can only view their own student profile.
- Teacher profile access: Teachers can only view their own teacher profile.
- Student attendance: Students can only view own/enrolled attendance.
- Teacher attendance: Teachers can only access assigned sections.
- Assessment reads: Students are limited to enrolled sections; Teachers are limited to assigned sections; Managers can view all org assessments.
- Assessment writes: Manager/Teacher must be assigned to the section; Admin cannot create assessments.
- Grade writes: Manager/Teacher must be assigned to the section; only Admin can edit finalized grades.
- Submissions: Students can submit only as themselves; one submission per assessment; blocked after deadline or after grade release/finalization.
- Finance reads: Students are forced to own `studentId`; Teachers are forced to own `teacherId`; Admin/Manager are organization-wide.
- Finance writes: structures, manual entries, confirmations, and claim rejections require Admin/Manager/Super Admin; mark-paid is allowed for own accessible entry.
- Manager teacher-management restrictions: cannot create Managers; cannot modify/delete Admins or other Managers; cannot change status for self or Managers.
- Manager student edit restriction: registration number and roll number are removed server-side unless requester is Admin.
- Organization settings mismatch: backend allows Admin and Manager for settings/logo/reapply; frontend only exposes/permits Admin settings page.
- GPA policy mismatch: backend allows Admin and Manager to read policies; frontend only exposes Admin page and fetch.
- Announcements: Students cannot create; Teachers can only target assigned sections; Managers cannot create org-wide announcements or target Admins.
- Mail: Students cannot create; Managers cannot send to large groups or Managers; Teachers cannot target Org Admin, Platform Admin, or Super Admin.
- Chat: Students cannot search or initiate direct chats; no direct chats with students; Teachers can initiate direct chats only with Admin/Manager.

# Role Implementation

Backend enforced:
- `backend/src/auth/roles.guard.ts`: endpoint role allow-list enforcement.
- `backend/src/common/access-control/access.guard.ts`: global access-level/status enforcement.
- `backend/src/common/access-control/access.utils.ts`: status-to-access mapping and restrictive resolution.
- `backend/src/auth/jwt.strategy.ts`: request user context loaded from DB, including current user/org status.
- `backend/src/org/org.controller.ts`: org courses, sections, settings, profile, assessments, schedules, attendance, timetable.
- `backend/src/students/student.controller.ts` and `student.service.ts`: student CRUD, restore, self/assigned restrictions, registration/roll locks.
- `backend/src/teacher/teacher.controller.ts` and `teacher.service.ts`: teacher/manager CRUD and Manager-specific restrictions.
- `backend/src/academic-cycles/academic-cycles.controller.ts`: cycle roles and write restrictions.
- `backend/src/cohorts/cohorts.controller.ts`: cohort roles and enrollment actions.
- `backend/src/gpa/gpa-policies.controller.ts`: Admin-only GPA policy writes.
- `backend/src/promotions/promotions.controller.ts`: Admin/Manager promotion action.
- `backend/src/transcripts/transcripts.controller.ts`: transcript self check and cycle report roles.
- `backend/src/assessments/assessments.service.ts`: assigned-section checks, student filters, finalized-grade rule.
- `backend/src/attendance/attendance.service.ts`: assigned/enrolled section access.
- `backend/src/course-materials/course-materials.service.ts`: role and assignment checks for materials.
- `backend/src/finance/finance.controller.ts` and `finance.service.ts`: management writes and student/teacher finance scoping.
- `backend/src/announcements/announcements.service.ts`: target-type and role restrictions.
- `backend/src/mail/mail.service.ts`: mail creation, recipient, target role, and org-status restrictions.
- `backend/src/chat/chat.service.ts`: chat search/initiation/participant restrictions.

Frontend only:
- `frontend/app/(org)/layout.tsx`: role-specific sidebar and blocked-org overlays.
- `frontend/context/AuthContext.tsx`: route redirects for Student, Teacher, Manager, platform roles, and first-login password change.
- Page-level redirects/hiding in org pages such as settings, GPA policies, teachers, students, courses, sections, academic cycles, cohorts, promotions, fees, finance.
- Component-level button/action visibility in lists, forms, tables, and modals.
- `frontend/hooks/useAccess.ts`: exposes access booleans but does not globally enforce them.
- `frontend/components/ui/DashboardLayout.tsx`: read-only banner for `accessLevel === 1`.

Mixed:
- Sidebar visibility is frontend-only, but many linked actions also have backend role guards.
- Settings access is mixed with a mismatch: frontend Admin-only, backend Admin/Manager.
- GPA policy access is mixed with a mismatch: frontend Admin-only, backend read Admin/Manager and writes Admin-only.
- Student/Teacher route protection is mixed: frontend redirects plus backend self/assignment checks.
- Finance UI hides management actions for Teacher/Student, and backend enforces management roles for management mutations.

# Manager Analysis

Permissions that are NOT strictly academic:
- Finance structures, entries, confirmations, payment claim rejection, and finance stats.
- Organization settings/logo/reapply through backend.
- Teacher account creation, edit, delete, restore.
- Student account creation, edit, delete, restore.
- User avatar updates for any org user.
- Mail management/status interactions.
- Chat group and participant management where service permits.

Permissions that overlap heavily with Admin:
- Courses C/R/E/D
- Academic Cycles C/R/E/D/activate
- Cohorts C/R/E/D and membership/section management
- Sections C/R/E/D
- Teachers C/R/E/D/restore for non-Admin/non-Manager teachers
- Students C/R/E/D/restore, except registration and roll number edit lock
- Schedules C/R/E/D
- Attendance create/mark/read
- Finance management
- Promotions
- Transcript cycle reports
- Organization settings backend writes

Permissions that would naturally belong to a future Sub Admin role:
- Finance management
- Organization settings/logo/reapply backend access
- User/account management for teachers and students
- Academic-cycle, cohort, section, course, and schedule management
- Promotions
- Transcript cycle reports
- Mail and announcement administrative targeting
