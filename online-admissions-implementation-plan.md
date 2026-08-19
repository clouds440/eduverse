# Online Admissions Implementation Plan

## Current Codebase Findings

This plan is based on the current repository state as of 2026-08-17.

Existing foundations to reuse:

- `Program` already has admissions-facing fields in `backend/prisma/schema.prisma`: `isVisibleForAdmissions`, `admissionsLabel`, `admissionsDescription`, and `admissionsSortOrder`.
- `ProgramOffering` already models a concrete intake/cycle with lifecycle status, open/close dates, capacity, and stage offerings.
- `backend/src/program-offerings/program-offerings.controller.ts` already exposes a public route: `GET /public/organizations/:slug/program-offerings`.
- `ProgramOfferingsService.list()` already filters approved organizations, active programs, active departments, visible admissions programs, open offerings, eligible academic cycles, and structurally complete curricula.
- `frontend/components/programs/ProgramForm.tsx` already includes an "Online admissions" section for program-level public visibility.
- `PATCH /org/programs/:id` and `ProgramsService.update()` already support admissions metadata updates without replacing program structure.
- `frontend/components/forms/StudentForm.tsx` is the right source of truth for admission form fields, validation shape, and student creation defaults.
- `StudentService.createStudent()` already handles final in-org admission, department scoping, user creation, student profile creation, and program enrollment.
- `FilesService` and the `File` table already support authenticated document storage, metadata, download, deletion, hashing, file classification, and Cloudinary storage.
- Department scoping exists through `common/department-scope.ts` and must be applied to admin review lists.
- Public endpoints are supported through `@Public()` and global guards already respect public metadata.

Important gap:

- The repository has public program offering discovery, but does not yet have an online admission submission entity, public submission flow, required document definitions, department review portal, status workflow, or conversion from online submission to final student admission.

Audit corrections from a second pass:

- The existing public `GET /public/organizations/:slug/program-offerings` endpoint is useful but not sufficient. It only works after an organization is already selected; the requested first step needs a new all-organization public browser endpoint.
- `StudentForm.tsx` can guide the field layout, but the public application form must have its own schema. The current `studentCreateSchema` requires password, registration number, roll number, status, and final login email semantics that do not belong in unauthenticated public submission.
- `CreateStudentDto` has `entryStageId`, but `frontend/types.CreateStudentRequest` currently does not. Conversion planning must include fixing the frontend type before passing an entry stage from online admission to final admission.
- `ProgramOffering` is the correct target for applications. Implemented conversion now passes the selected offering into `StudentProgramEnrollmentsService.admitInTransaction()` so enrollment snapshots use the exact offering curriculum rather than whichever curriculum is currently the program default.
- Public file upload cannot reuse `api.files.uploadFile` or generic `/files` because it requires JWT auth. The frontend also needs a public `uploadFormData` helper because the current helper requires a token argument.
- `FilesService.saveFile()` creates `File` rows outside the caller's transaction and requires `entityId`. The online submission service must explicitly handle partial failures and cleanup, or add a transaction-aware file persistence helper.
- Prisma relation examples below must be implemented with back-relations on existing models (`Organization`, `ProgramOffering`, `Department`, `Program`, `AcademicCycle`, `Student`, and `File`) or Prisma generation will fail.
- `OrgService.getSettings()`, `OrgService.updateSettings()`, `UpdateSettingsDto`, `frontend/components/settings/organization/types.ts`, `useOrganizationSettingsForm()`, and `organization-settings-tabs.ts` must all be updated together for the organization toggle. Adding only a column is not enough.
- Do not add document requirements only into `ProgramOfferingModal.tsx` if that makes the modal too dense. A dedicated requirements panel or secondary drawer from the offering detail/edit UI is acceptable and likely cleaner.
- Avoid forcing full program structure replacement when only admissions visibility/label/description changes. Use existing `PATCH /org/programs/:id` from the frontend for admissions metadata-only changes.

## Product Shape

Online admissions should be built as a two-part workflow:

1. Public applicant flow with no login:
   - Browse organizations that currently accept online admissions.
   - See program-code tags for each organization.
   - Select one organization.
   - Select an online-admission-enabled program offering.
   - Fill a student admission form similar to `StudentForm.tsx`.
   - Upload required documents defined by admins for that program offering.
   - Submit and receive email updates.

2. Admin review flow inside an organization:
   - Department-scoped admins see submissions for departments they can manage.
   - Staff filter by status, department, program, offering/cycle, search text, date, and missing documents.
   - Staff review the submitted form and documents.
   - Staff can request updates, accept, reject, or convert to an admitted student.
   - On conversion, the in-org student admission form is prefilled from submission data and remains editable before final admission.
   - Rejected submissions remain in history and appear under the rejected status tab.

## Core Design Decisions

### 1. Organization-Level Toggle

Add an organization setting:

- `Organization.onlineAdmissionsEnabled Boolean @default(false)`

Reason:

- The user asked for active online admissions to be toggled by admin in org settings.
- The public organization list should only show approved organizations where this toggle is enabled and at least one eligible online admission offering exists.

Frontend settings:

- Add an "Admissions" settings tab or an "Online admissions" section in organization settings.
- Recommended: add a dedicated `admissions` tab because required documents and portal behavior will likely grow over time.
- Fields:
  - `onlineAdmissionsEnabled`
  - Optional later: public admissions message, reply-to email override, auto-confirmation template, application close behavior.

Files to update together:

- `backend/src/org/dto/update-settings.dto.ts`: add `@IsBoolean() @IsOptional() onlineAdmissionsEnabled?: boolean`.
- `backend/src/org/org.service.ts`: include `onlineAdmissionsEnabled` in `getSettings()`, `updateSettings()` data, and update select/return payloads.
- `frontend/types/index.ts`: add the field to `Organization` and `UpdateOrgSettingsRequest`.
- `frontend/components/settings/organization/types.ts`: add the field to `OrganizationSettingsFormData` and possible errors.
- `frontend/components/settings/organization/hooks/useOrganizationSettingsForm.ts`: load/save the field and include it in dirty counts.
- `frontend/components/settings/organization/organization-settings-tabs.ts`: add an `admissions` tab if using the dedicated-tab approach.
- `frontend/components/settings/organization/OrganizationSettingsPage.tsx`: render the admissions tab and include its dirty count.

### 2. Program Offering Is the Application Target

Online applications should target `ProgramOffering`, not only `Program`.

Reason:

- A program is durable curriculum structure.
- A program offering is the concrete intake for a cycle, with open/close dates and capacity.
- The existing public offerings endpoint already models eligible entry cycles.

Keep `Program.isVisibleForAdmissions` as the broad public publishing toggle.

Add offering-level controls:

- `ProgramOffering.onlineAdmissionEnabled Boolean @default(false)`
- `ProgramOffering.onlineAdmissionInstructions String?`

This makes a program visible generally, while each cycle/intake decides whether applications are accepted online.

Conversion resolution:

- Manual student admission still uses the program's active default admissions curriculum.
- Online-admission conversion supplies `programOfferingId`; the enrollment service validates that the offering belongs to the organization and program, then snapshots its exact curriculum and configuration revision inside the student-creation transaction.
- Final `ADMITTED` linkage still verifies the created student's open enrollment matches the submission program and offering curriculum.

Eligibility rule for public application:

- Organization is `APPROVED`.
- Organization has `onlineAdmissionsEnabled = true`.
- Department is active.
- Program is `ACTIVE`.
- Program has `isVisibleForAdmissions = true`.
- Program offering is `OPEN`.
- Program offering has `onlineAdmissionEnabled = true`.
- Current time is within `opensAt` and `closesAt` when those dates are set.
- Capacity is not exceeded if capacity enforcement is included in the phase.
- The selected offering's curriculum is still eligible for admission conversion, or the UI clearly warns that conversion will require admin resolution if the program configuration changed.

### 3. Required Documents Belong to the Offering

Documents should be defined on the program offering, not only program.

Reason:

- Required documents often vary by intake/cycle or policy year.
- Program-level defaults can be added later, but offering-level requirements are enough for the first complete feature.

Add model:

```prisma
model OnlineAdmissionDocumentRequirement {
  id                String   @id @default(uuid())
  organizationId    String
  programOfferingId String
  label             String
  description       String?
  isRequired        Boolean  @default(true)
  sortOrder         Int      @default(0)
  acceptedMimeTypes Json?
  maxFileSizeBytes  Int?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  programOffering ProgramOffering @relation(fields: [programOfferingId], references: [id], onDelete: Cascade)
  uploads         OnlineAdmissionDocumentUpload[]

  @@index([organizationId])
  @@index([programOfferingId, sortOrder])
}
```

Required back-relations:

- `Organization.onlineAdmissionDocumentRequirements OnlineAdmissionDocumentRequirement[]`
- `ProgramOffering.onlineAdmissionDocumentRequirements OnlineAdmissionDocumentRequirement[]`

Admin UI:

- Extend program offering administration with a document requirements editor. This can live in `ProgramOfferingModal.tsx` only if it remains usable; otherwise add a dedicated requirements drawer/panel from the program detail or offering list.
- Each row: label, optional description, required toggle, accepted file types, max file size.
- Keep labels applicant-facing, e.g. "CNIC or B-Form", "Previous transcript", "Passport-size photo".

### 4. Submission Is Separate From Student

Do not create `Student` or `User` during public submission.

Reason:

- The user specified no login required yet.
- The applicant email is for updates only.
- The organization later decides the final student login email.
- Admins must be able to edit before final admission.

Add status enum:

```prisma
enum OnlineAdmissionSubmissionStatus {
  SUBMITTED
  UNDER_REVIEW
  NEEDS_UPDATE
  ACCEPTED
  ADMITTED
  REJECTED
  WITHDRAWN
}
```

Add model:

```prisma
model OnlineAdmissionSubmission {
  id                   String                          @id @default(uuid())
  publicReference      String                          @unique
  organizationId       String
  departmentId         String
  programId            String
  programOfferingId    String
  academicCycleId      String
  status               OnlineAdmissionSubmissionStatus @default(SUBMITTED)
  applicantEmail       String
  applicantName        String
  applicantPhone       String?
  formData             Json
  sourceIpHash         String?
  userAgent            String?
  submittedAt          DateTime                        @default(now())
  updatedAt            DateTime                        @updatedAt
  reviewedById         String?
  reviewedAt           DateTime?
  decisionReason       String?
  admittedStudentId    String?

  organization      Organization      @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  department        Department        @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  program           Program           @relation(fields: [programId], references: [id], onDelete: Restrict)
  programOffering   ProgramOffering   @relation(fields: [programOfferingId], references: [id], onDelete: Restrict)
  academicCycle     AcademicCycle     @relation(fields: [academicCycleId], references: [id], onDelete: Restrict)
  admittedStudent   Student?          @relation(fields: [admittedStudentId], references: [id], onDelete: SetNull)
  documentUploads   OnlineAdmissionDocumentUpload[]
  statusEvents      OnlineAdmissionStatusEvent[]

  @@index([organizationId, status, submittedAt])
  @@index([departmentId, status])
  @@index([programOfferingId, status])
  @@index([applicantEmail])
}
```

Required back-relations:

- `Organization.onlineAdmissionSubmissions OnlineAdmissionSubmission[]`
- `Department.onlineAdmissionSubmissions OnlineAdmissionSubmission[]`
- `Program.onlineAdmissionSubmissions OnlineAdmissionSubmission[]`
- `ProgramOffering.onlineAdmissionSubmissions OnlineAdmissionSubmission[]`
- `AcademicCycle.onlineAdmissionSubmissions OnlineAdmissionSubmission[]`
- `Student.onlineAdmissionSubmissions OnlineAdmissionSubmission[]` or a named optional one-to-one/list relation such as `admittedFromOnlineSubmissions`.

Important conversion index:

- Add `@@unique([admittedStudentId])` only if one admitted student can come from only one online submission and `admittedStudentId` remains nullable. Otherwise keep it as an indexed nullable field.
- Add a separate duplicate-prevention unique index only after product policy is clear. For example, do not prematurely add `@@unique([programOfferingId, applicantEmail])` if multiple applications per email may be allowed for siblings or repeated attempts.

Use `formData Json` for the first implementation to preserve the public submission exactly as entered. Later, if reporting needs grow, frequently queried fields can be promoted to columns.

Form data should include:

- name
- email
- phone
- fatherName
- age
- gender
- address
- emergencyContact
- bloodGroup
- desired program/offering IDs
- optional guardian fields only if product wants them in the public form later
- any future custom fields

### 5. Document Uploads Attach to Submission Requirements

Add model:

```prisma
model OnlineAdmissionDocumentUpload {
  id                    String   @id @default(uuid())
  organizationId        String
  submissionId          String
  requirementId         String
  fileId                String
  labelSnapshot         String
  createdAt             DateTime @default(now())

  organization Organization                       @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  submission   OnlineAdmissionSubmission          @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  requirement  OnlineAdmissionDocumentRequirement @relation(fields: [requirementId], references: [id], onDelete: Restrict)
  file         File                               @relation(fields: [fileId], references: [id], onDelete: Restrict)

  @@unique([submissionId, requirementId])
  @@index([organizationId])
  @@index([fileId])
}
```

Required back-relations:

- `Organization.onlineAdmissionDocumentUploads OnlineAdmissionDocumentUpload[]`
- `File.onlineAdmissionDocumentUploads OnlineAdmissionDocumentUpload[]`

Use `@@unique([submissionId, requirementId])` only if one file per requirement is the desired first-scope behavior. If the product chooses multiple files per requirement, replace it with a non-unique index and add a `sortOrder` field.

File handling:

- Add a public upload flow specific to online admissions rather than exposing generic `/files`.
- For phase 1, use a public `multipart/form-data` submission endpoint that accepts one JSON payload field plus document files.
- Do not use authenticated `POST /files`; it is guarded and validates the user's organization.
- Save files only after validating the target offering, organization toggle, required document definitions, file labels, file count, size, and MIME/extension rules.
- Add an online-admissions-specific file entity type such as `ONLINE_ADMISSION_DOCUMENT`.
- Existing upload policy allows common document/image extensions by default, but accepted MIME/type constraints from each requirement must be enforced before calling `FilesService`.
- Use `FilesService.saveManagedFile()` only if it is generalized beyond `GRADE_ANSWERBOOK_ENTITY_TYPE`; otherwise add a dedicated `saveSystemFile()` / `saveOnlineAdmissionFile()` method.
- Use that same entity type consistently for these files; store the submission id in `File.entityId`.
- Use `uploadedBy` as a dedicated system user if available, or add nullable support for public uploads only if the existing `File.uploadedBy` contract is updated carefully.

Atomicity and cleanup:

- `File.entityId` is required, and `FilesService.persistFile()` currently creates its own `File` row and uploads to Cloudinary outside the caller transaction.
- Generate the submission id in the service before upload so every file can use the future submission id as `entityId`.
- Recommended first implementation:
  - Validate all inputs.
  - Create the submission row with generated id and status `SUBMITTED`.
  - Upload all files and create `File` rows.
  - Create `OnlineAdmissionDocumentUpload` rows and the initial status event in a transaction.
  - If any upload or DB step fails, delete any created `File` rows and Cloudinary assets through `FilesService.deleteManagedFile()` or a new cleanup helper, then delete/mark the submission as failed.
- Better long-term implementation:
  - Add a transaction-aware file persistence path that separates Cloudinary upload from `File` row creation and can accept a Prisma transaction client.

Security note:

- Do not allow public download of uploaded files.
- Admin downloads go through authenticated file download after department-scope checks on the parent submission.
- The generic authenticated `/files/:id/download` endpoint only checks file-level organization access. Add an online-admissions document download endpoint that first checks submission department scope, then streams the file through `FilesService.getDownloadPayload()` or a managed equivalent.

### 6. Status History

Add immutable status events:

```prisma
model OnlineAdmissionStatusEvent {
  id           String                          @id @default(uuid())
  submissionId String
  fromStatus   OnlineAdmissionSubmissionStatus?
  toStatus     OnlineAdmissionSubmissionStatus
  note         String?
  actorUserId  String?
  actorType    String                          @default("ADMIN")
  createdAt    DateTime                        @default(now())

  submission OnlineAdmissionSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@index([submissionId, createdAt])
}
```

Reason:

- Rejections must remain auditable.
- Email updates should correspond to status changes.
- Staff should see what happened without overwriting history.

## Backend Implementation Phases

### [x] Phase 1: Database and Types

Tasks:

- Add Prisma enum `OnlineAdmissionSubmissionStatus`.
- Add `Organization.onlineAdmissionsEnabled`.
- Add `ProgramOffering.onlineAdmissionEnabled` and `onlineAdmissionInstructions`.
- Add required document, submission, upload, and status event models.
- Add relations and back-relations to `Organization`, `ProgramOffering`, `Department`, `Program`, `AcademicCycle`, `Student`, and `File`.
- Decide one-file-per-requirement for v1 and encode it with `@@unique([submissionId, requirementId])`; otherwise remove that unique before migration.
- Add indexes for the actual portal filters: `organizationId/status/submittedAt`, `departmentId/status`, `programId/status`, `programOfferingId/status`, `academicCycleId/status`, and `applicantEmail`.
- Create Prisma migration.
- Run:
  - `npx prisma generate`
  - `npm run prisma:validate`
  - backend build/tests targeted to Prisma service startup.

Acceptance:

- Migration applies cleanly.
- Prisma client generates.
- Existing tests still compile.

### [x] Phase 2: Shared DTOs and Validation

Create `backend/src/online-admissions/dto`.

DTOs:

- `PublicOnlineAdmissionsQueryDto`
  - search
  - departmentId
  - programCode
  - page
  - limit
- `CreateOnlineAdmissionSubmissionDto`
  - parsed from a JSON field inside multipart form data
  - programOfferingId
  - applicantEmail
  - applicantName
  - applicantPhone
  - formData fields matching public student form
- `UpdateOnlineAdmissionSettingsDto`
  - org toggle fields
- `UpsertOnlineAdmissionDocumentRequirementDto`
  - label
  - description
  - isRequired
  - sortOrder
  - acceptedMimeTypes
  - maxFileSizeBytes
- `UpdateOnlineAdmissionSubmissionStatusDto`
  - status
  - note/decisionReason
- `ConvertOnlineAdmissionSubmissionDto`
  - final student fields matching `CreateStudentDto`
  - final login email
  - password
  - registrationNumber
  - rollNumber
  - admissionDate
  - optional entryStageId
  - must also be added to `frontend/types.CreateStudentRequest` or represented in a conversion-specific request type

Validation rules:

- Required document labels must be non-empty and unique per offering after trimming.
- Public submit must include applicant email, applicant name, and all required documents.
- Public submit must not accept internal final-admission fields: password, status, registrationNumber, rollNumber, final login email, department assignments, or admissionDate.
- Public submit must reject closed/disabled/non-public offerings.
- Public submit must reject orgs where `onlineAdmissionsEnabled` is false.
- Public submit must reject files whose uploaded requirement key/id does not belong to the selected offering.
- Admin status transitions should be controlled, e.g.:
  - `SUBMITTED -> UNDER_REVIEW | REJECTED`
  - `UNDER_REVIEW -> NEEDS_UPDATE | ACCEPTED | REJECTED`
  - `NEEDS_UPDATE -> UNDER_REVIEW | REJECTED`
  - `ACCEPTED -> ADMITTED | REJECTED`
  - `ADMITTED` terminal
  - `REJECTED` terminal unless a future reopen action is added.

### [x] Phase 3: Online Admissions Module

Create:

- `backend/src/online-admissions/online-admissions.module.ts`
- `backend/src/online-admissions/online-admissions.service.ts`
- `backend/src/online-admissions/public-online-admissions.controller.ts`
- `backend/src/online-admissions/admin-online-admissions.controller.ts`

Register module in `backend/src/app.module.ts`.

Module dependencies:

- Import `PrismaModule`.
- Import `FilesModule` for upload/download/cleanup.
- Import `StudentModule`; `StudentService` is already exported by `backend/src/students/student.module.ts`.
- Import `StudentProgramEnrollmentsModule`; `StudentProgramEnrollmentsService` is already exported and is needed if adding offering-aware admission.
- Import email infrastructure used by current flows: `SecurityModule` for `EmailService` and `EmailTemplatesModule` for template construction. Import `MailModule` only if submissions should also create in-app mail/tickets.
- If circular dependencies appear between `StudentService` and online admissions conversion, keep conversion orchestration in `OnlineAdmissionsService` and call `StudentService.createStudent()` rather than injecting online admissions into student services.
- `FilesModule` registers Multer memory storage with `files: 1`; the public submission endpoint must define its own interceptor limits for multiple required documents.

Public endpoints:

- `GET /public/online-admissions/organizations`
  - returns approved organizations with online admissions enabled and at least one eligible offering.
  - each organization includes `id`, `name`, `slug`, `location`, `logoUrl`, and program code tags.
- `GET /public/online-admissions/organizations/:slug`
  - returns organization profile and eligible offerings grouped by department/program.
- `GET /public/online-admissions/offerings/:id`
  - returns offering details, public program details, academic cycle, instructions, and document requirements.
- `POST /public/online-admissions/offerings/:id/submissions`
  - accepts public application and files.
  - should use `FileFieldsInterceptor` or `AnyFilesInterceptor`, not JSON body parsing alone.
  - must set route-specific file count and total size limits because the generic file upload module is configured for one file.
  - must remain throttled; use a stricter `@Throttle()` policy if needed rather than `@SkipThrottle()`.
  - creates submission, stores files, creates upload rows, status event, and sends confirmation email.

Admin endpoints:

- `GET /org/online-admissions`
  - paginated list with filters: status, departmentId, programId, programOfferingId, academicCycleId, search, submittedFrom, submittedTo, missingDocuments.
- `GET /org/online-admissions/:id`
  - full detail with form data, documents, history, program/offering/cycle, and applicant contact.
- `PATCH /org/online-admissions/:id/status`
  - status changes, note/reason, email notification.
- `POST /org/online-admissions/:id/convert`
  - creates actual student through `StudentService.createStudent()` after mapping submission fields and validating department scope.
  - validates the offering curriculum can still be admitted, or uses the new offering-aware admission service.
  - sets submission status to `ADMITTED`.
  - stores `admittedStudentId`.
- `GET /org/program-offerings/:id/online-admission-requirements`
- `PUT /org/program-offerings/:id/online-admission-requirements`
  - replaces requirement list atomically.
- Extend `PATCH /org/program-offerings/:id`
  - supports `onlineAdmissionEnabled` and `onlineAdmissionInstructions`.
  - update `backend/src/program-offerings/dto/program-offering.dto.ts`, `AdminProgramOfferingsService.update()`, frontend `ProgramOffering`, and `CreateProgramOfferingRequest`/update payload types.

Department scope:

- For sub-admins, filter submissions by `program.departmentId` / `submission.departmentId`.
- `ORG_ADMIN` can see all organization submissions.
- `ORG_MANAGER` can read if current app access rules allow read access, but status/conversion should stay `ORG_ADMIN` and `SUB_ADMIN` unless product says otherwise.

### [x] Phase 4: Email Notifications

Use existing mail/email infrastructure.

Events:

- Submission received:
  - sent to applicant email.
  - includes reference number and organization/program names.
- Status changed:
  - `UNDER_REVIEW`, `NEEDS_UPDATE`, `ACCEPTED`, `REJECTED`, `ADMITTED`.
  - include staff note when appropriate.
- Optional internal notification:
  - notify org admins/sub-admins of new submission.

Implementation:

- Add templates under `backend/src/common/email-templates`.
- Keep applicant emails plain and non-login-oriented.
- Do not include secure document download links in public emails.

### [x] Phase 5: Conversion to Student Admission

Map submission to `CreateStudentDto`:

- `name` from formData/applicantName.
- `email` from admin-selected final login email, not necessarily applicant email.
- `phone` from formData/applicantPhone.
- `fatherName`, `age`, `gender`, `address`, `emergencyContact`, `bloodGroup` from formData.
- `programId` from submission.
- `primaryDepartmentId` from submission department/program department.
- `departmentIds` should include the program department and any admin-selected extra departments.
- `registrationNumber`, `rollNumber`, `password`, and `admissionDate` are entered by admin during final conversion.
- `entryStageId` optional, defaulting to the program admission service behavior.

UI behavior:

- The detail page has "Admit student".
- Clicking it opens a final admission modal/page prefilled from submission data.
- Reuse validation from `StudentForm.tsx`/`frontend/lib/schemas.ts`.
- Admin can edit before final submit.
- After conversion:
  - navigate to admitted student profile or show a link.
  - lock conversion action.
  - keep submission in `ADMITTED` status with history and documents.

## Frontend Implementation Phases

### [x] Phase 6: Types and API Client

Update `frontend/types/index.ts`:

- `OnlineAdmissionSubmissionStatus`
- `OnlineAdmissionOrganizationSummary`
- `OnlineAdmissionProgramOfferingPublic`
- `OnlineAdmissionDocumentRequirement`
- `OnlineAdmissionSubmission`
- `OnlineAdmissionStatusEvent`
- request/response types for create, status update, conversion.

Update `frontend/lib/api.ts`:

- Add or loosen a multipart helper so public endpoints can submit `FormData` without a token. The current `uploadFormData()` signature expects `token: string`.
- `api.publicOnlineAdmissions.listOrganizations`
- `api.publicOnlineAdmissions.getOrganization`
- `api.publicOnlineAdmissions.getOffering`
- `api.publicOnlineAdmissions.submit`
- `api.onlineAdmissions.list`
- `api.onlineAdmissions.get`
- `api.onlineAdmissions.updateStatus`
- `api.onlineAdmissions.convert`
- `api.programOfferings.getOnlineAdmissionRequirements`
- `api.programOfferings.updateOnlineAdmissionRequirements`

### [x] Phase 7: Public Admissions Portal

Routes:

- `frontend/app/admissions/page.tsx`
  - public organization browser.
- `frontend/app/admissions/[slug]/page.tsx`
  - organization detail and program/offering picker.
- `frontend/app/admissions/[slug]/[offeringId]/page.tsx`
  - application form and document uploads.
- Optional success page:
  - `frontend/app/admissions/submitted/[reference]/page.tsx`
  - Only show reference and next steps. Do not expose private data from reference alone.

Design requirements:

- First screen is the usable organization browser, not a marketing landing page.
- Organization list:
  - search
  - location
  - program-code tags
  - availability/status badge
  - select action
- Organization detail:
  - compact org header with logo/name/location.
  - program cards/list grouped by department.
  - each offering shows cycle, open/close date, required document count, and status.
- Application form:
  - use the same field grouping as `StudentForm.tsx`.
  - hide internal-only fields: registration number, roll number, password, status, admission date, guardian assignment, departments.
  - include applicant update email clearly.
  - document upload section generated from offering requirements.
  - submit button disabled until required fields/documents are complete.

Suggested components:

- `frontend/components/online-admissions/PublicAdmissionsOrgBrowser.tsx`
- `frontend/components/online-admissions/PublicAdmissionsOfferingPicker.tsx`
- `frontend/components/online-admissions/PublicAdmissionForm.tsx`
- `frontend/components/online-admissions/RequiredDocumentUploader.tsx`

### [x] Phase 8: Admin Admissions Portal

Routes:

- `frontend/app/(org)/online-admissions/page.tsx`
  - list/portal.
- `frontend/app/(org)/online-admissions/[id]/page.tsx`
  - detail/review.

Navigation:

- Add "Online Admissions" to org sidebar/navigation for `ORG_ADMIN` and `SUB_ADMIN`.
- Optionally allow read-only for `ORG_MANAGER` depending on app access policy.
- Add `"online-admissions"` to `DASHBOARD_MODULES` in `frontend/lib/constants.ts`; otherwise `/online-admissions` will be treated as a public page by `DashboardMainWrapper`.
- Add a sidebar item in `frontend/lib/orgSidebar.ts`, likely near `Programs` or `Users`, with `roles: ADMIN_ROLES`.

List portal:

- Use status tabs:
  - New
  - Under review
  - Needs update
  - Accepted
  - Admitted
  - Rejected
  - All
- Filters:
  - search applicant name/email/reference
  - department
  - program
  - offering/cycle
  - date range
  - missing required documents
- Table/card columns:
  - reference
  - applicant
  - program code/name
  - department
  - submitted date
  - document completion
  - status
  - last update

Detail page:

- Header: applicant, reference, status, program/offering/cycle.
- Actions: mark under review, request update, accept, reject, admit student.
- Form data preview grouped like student profile.
- Documents panel with required labels, uploaded file metadata, and download buttons.
- Timeline/status history.
- Decision note/reason modal for status changes.

Conversion UI:

- Use a dedicated `AdmitOnlineSubmissionForm` component.
- Prefer extracting reusable field pieces from `StudentForm.tsx` rather than modifying `StudentForm.tsx` into a fragile mega-component in the first pass.
- Prefill public fields and keep admin-required final fields empty:
  - final login email
  - password
  - registration number
  - roll number
  - admission date
  - optional extra departments
  - optional entry stage
- Make it clear that applicant email and final login email are separate fields. `User.email` is globally unique in the current schema, so conversion must surface conflicts from `StudentService.createStudent()` cleanly.
- Supply the submission's `programOfferingId` to student creation so conversion uses the offering curriculum even when the program's default admissions curriculum has changed.

### [x] Phase 9: Program Offering Admin Enhancements

Update `frontend/components/programs/ProgramOfferingModal.tsx`:

- Add toggle: "Accept online applications".
- Add public instructions textarea.
- Add document requirements editor.
- Keep `Program.isVisibleForAdmissions` on `ProgramForm.tsx`; the offering toggle determines whether a specific intake accepts online applications.

Update offering readiness:

- Add warning/blocker if online admission enabled but no required document definitions exist.
- Add warning if online admission enabled but program is not visible for admissions.
- Add warning if online admission enabled but organization online admissions are disabled.

## Testing Plan

### Backend Unit Tests

Add tests for `OnlineAdmissionsService`:

- Public organization list excludes:
  - disabled orgs
  - unapproved orgs
  - orgs with no eligible offerings
  - inactive departments
  - programs not visible for admissions
  - offerings not open
  - offerings outside date window
- Public offering detail returns requirements.
- Public submission rejects missing required documents.
- Public submission rejects unknown requirement ids and duplicate files for one-file requirements.
- Public submission cleans up created files/submission state when a later file or DB write fails.
- Public submission creates:
  - submission
  - document upload rows
  - status event
  - email notification call.
- Admin list enforces department scope.
- Status transitions reject invalid moves.
- Rejected submissions remain queryable.
- Conversion calls `StudentService.createStudent()` with mapped data and sets status to `ADMITTED`.
- Conversion blocks or uses offering-aware admission when the offering curriculum no longer matches the active default admissions curriculum.

### Backend Controller/E2E Tests

Add focused e2e specs:

- unauthenticated applicant can list organizations and submit.
- unauthenticated applicant cannot access admin routes.
- sub-admin only sees submissions in assigned departments.
- admin can reject and then see submission in rejected filter.
- admin can admit from accepted submission.

### Frontend Tests/Checks

Minimum:

- TypeScript build.
- API type compile.
- Component tests if the existing frontend test stack supports them.

Manual QA:

- Public browser empty state.
- Public browser with multiple orgs and program tags.
- Applying to an offering with 1 required and 1 optional document.
- Submit failure states: missing fields, missing document, closed offering.
- Admin list filters and status tabs.
- `/online-admissions` renders in dashboard mode after adding it to `DASHBOARD_MODULES`.
- Reject flow.
- Admit flow and final student record.
- File download from admin detail.
- Mobile layouts for public form and admin portal.
- Human verification loads and refreshes on public admission and organization registration.
- Incorrect, expired, reused, and cross-purpose challenges are rejected without losing entered form fields.
- Login remains challenge-free normally and requests verification after three failed attempts within fifteen minutes.
- Customized submission/status subjects and bodies replace supported placeholders and render user/admin text as escaped content.
- Empty email-template fields fall back to the branded platform defaults.

## Rollout Plan

### [x] Phase A: Data and Admin Configuration

Ship schema, org setting, offering-level toggle, and document requirement editor behind disabled defaults.

Default behavior:

- Existing orgs have `onlineAdmissionsEnabled = false`.
- Existing offerings have `onlineAdmissionEnabled = false`.
- No public submissions are possible until admins explicitly enable both.

### [x] Phase B: Public Discovery and Submission

Ship public `/admissions` browser and submission flow.

At this point:

- Applicants can submit.
- Admins may receive submissions through a basic list/detail.
- Conversion can still be hidden until Phase C if needed.

### [x] Phase C: Review Portal and Conversion

Ship full admin portal, status workflow, email status updates, and conversion to student.

### [x] Phase D: Polish and Operational Controls

Add:

- [x] Duplicate prevention by normalized applicant email + offering for all non-rejected/non-withdrawn submissions, backed by a partial unique database index.
- [x] Tighter public rate limits for submission, update upload, update-link reads, and discovery endpoints.
- [x] Reusable first-party human verification with purpose-bound, expiring, single-use challenges for admissions and organization registration, plus risk-triggered login use after repeated failures.
- [x] Department-scoped CSV application export using the same filters as the review portal.
- [x] Reusable branded online-admission email templates with text and HTML output.
- [x] Organization-editable admission email subjects and bodies using a constrained plain-text placeholder policy inside the branded email shell.
- [x] Applicant update/resubmission links for `NEEDS_UPDATE`, with expiring one-time tokens.
- [x] Date-range and missing-required-document portal filters with document completion counts.
- [x] Admission-specific document downloads that authorize against the parent submission's department scope.
- [x] Initial-submission cleanup when file persistence fails after the database record is created.

## Migration and Backfill Notes

- Add nullable/defaulted columns first to avoid disrupting existing data.
- Backfill `Organization.onlineAdmissionsEnabled = false`.
- Backfill `ProgramOffering.onlineAdmissionEnabled = false`.
- Do not infer online-enabled offerings from existing `Program.isVisibleForAdmissions`; program visibility is not the same as accepting applications.
- Existing public `GET /public/organizations/:slug/program-offerings` can either remain for compatibility or be internally reused by the new online admissions service.

## Open Product Questions

- Resolved: one active application per normalized email and offering. Reapplication is allowed after rejection or withdrawal.
- Resolved: `NEEDS_UPDATE` sends an expiring secure link for document resubmission; it does not expose unrestricted form editing.
- Should documents support multiple files per requirement, or one file per requirement?
- Should program offering capacity count only `ADMITTED` students or all non-rejected submissions?
- Should accepted submissions automatically reserve capacity?
- Should org managers have read-only access to the online admissions portal?
- Should final admission documents be copied/linked onto the created student record after conversion?

## Recommended Initial Scope

For the first complete implementation, keep the scope tight:

- Organization admissions toggle.
- Offering admissions toggle.
- Offering-level required document labels.
- Public org browser.
- Public offering selection and submission.
- One file per document requirement.
- Email confirmation and status emails.
- Admin list/detail with status tabs and filters.
- Reject and admit conversion.
- No applicant login.
- Applicant document resubmission through a one-time `NEEDS_UPDATE` email link; no unrestricted form editing.

This delivers the full end-to-end flow requested while leaving advanced applicant self-service and template customization for later phases.

## Phase-by-Phase Reuse Map

This section records existing code to reuse or extract before implementation starts. The goal is to avoid duplicating working patterns that already exist in the repo.

### [x] Phase 1: Database and Types

Reuse:

- `backend/prisma/schema.prisma` relation/index style from `GradeAnswerbookAttachment`, `FinancialEntry`, and program models.
- Existing enum placement near program/student lifecycle enums.
- Existing `File` model relation pattern from `GradeAnswerbookAttachment`.
- Existing Prisma scripts:
  - `npx prisma generate`
  - `npm run prisma:validate`

Extract or avoid:

- Do not invent separate file metadata storage. Link online admission document uploads to existing `File`.
- Do not add duplicate status strings in JSON only. Use a Prisma enum for queryable status filters and history consistency.
- Keep `formData Json` for submitted public fields in v1, but promote only fields that the portal filters need.

### [x] Phase 2: DTOs and Validation

Reuse:

- DTO style from:
  - `backend/src/program-offerings/dto/program-offering.dto.ts`
  - `backend/src/org/dto/create-student.dto.ts`
  - `backend/src/org/dto/update-settings.dto.ts`
- `class-validator` decorators already used throughout the backend.
- Existing phone/email/date validation expectations from student/org DTOs.
- `backend/src/common/offering-lifecycle.ts` pattern for legal status transitions.

Extract or add:

- Add an `ONLINE_ADMISSION_SUBMISSION_TRANSITIONS` map beside existing offering transition maps, or create `backend/src/online-admissions/online-admission-lifecycle.ts` if keeping it local is cleaner.
- Add a public application DTO that intentionally excludes `password`, `registrationNumber`, `rollNumber`, `status`, `admissionDate`, and department assignment fields.
- Add a reusable requirement-label normalizer for trimming and duplicate checks.

Avoid:

- Do not reuse `CreateStudentDto` for public submission. It represents final in-org student creation.
- Do not reuse `studentCreateSchema` for the public form. It requires internal final-admission fields.

### [x] Phase 3: Online Admissions Backend Module

Reuse:

- Pagination:
  - `getPaginationOptions`
  - `formatPaginatedResponse`
  - `PaginationOptions`
- Department scope:
  - `getDepartmentScope`
  - `assertDepartmentInScope`
  - `assertDepartmentIdsBelongToOrg`
- Offering logic:
  - `ProgramOfferingsService.list()` eligibility rules as a starting point.
  - `AdminProgramOfferingsService.readiness()` for readiness/blocker style.
- Student conversion:
  - `StudentService.createStudent()` for final student/user creation.
  - `StudentProgramEnrollmentsService.resolveAdmissionDepartment()` and possibly a new offering-aware admission method.
- File handling:
  - `FilesService`
  - `classifyAndValidateUpload`
  - `file-upload-policy.ts` constants and extension checks.
- Email:
  - `EmailService` from `SecurityModule`
  - `EmailTemplateService` facade
  - existing public-contact email template structure as a model for pure template functions.
- Activity/audit:
  - `OrganizationActivityLogRecordInput`
  - `OrganizationActivityService.record()` if the module imports `ActivityLogsModule`, or direct `organizationActivityLog.create` only if the existing activity service cannot fit.

Extract or add:

- Extract shared public-offering eligibility into a backend helper so `ProgramOfferingsService` and `OnlineAdmissionsService` do not drift.
- Add an online-admission-specific file save/cleanup helper instead of stretching generic `/files`.
- Add an online-admission-specific scoped file download method that checks the submission first, then delegates streaming to `FilesService`.
- Add an `OnlineAdmissionReference` generator helper for public references.

Avoid:

- Do not let public upload use generic authenticated `/files`.
- Do not rely on `FilesModule` Multer defaults for public submit; it is configured for one file.
- Do not duplicate department scoping logic by hand.

### [x] Phase 4: Email Notifications

Reuse:

- `backend/src/common/email-templates/*` pure template pattern.
- `EmailTemplateService` as the service-facing facade.
- `EmailService.send()` for outbound email.
- `MailService.getAppBaseUrl()` pattern for deriving app links if needed.
- Existing public contact submitted/reply templates as closest examples.

Extract or add:

- Add `online-admission-email.template.ts`.
- Add `buildOnlineAdmissionSubmittedEmail()` and `buildOnlineAdmissionStatusEmail()` to `EmailTemplateService`.
- Add a small email-copy helper that maps status to subject/body text so status logic does not leak into templates.

Avoid:

- Do not create applicant login links in these emails.
- Do not include private document download URLs.

### [x] Phase 5: Conversion to Student Admission

Reuse:

- `StudentService.createStudent()` for creating the final student.
- `CreateStudentDto` mapping and validation rules for final admission.
- `studentCreateSchema` only for the final admin conversion form, not the public applicant form.
- `StudentForm.tsx` default-value logic and field grouping as the source for extracted reusable pieces.
- `StudentProgramEnrollmentsService.admitInTransaction()` behavior, with the curriculum caveat already documented.

Extract or add:

- Extract student identity/contact/personal field groups from `StudentForm.tsx` into smaller components or config functions:
  - `StudentIdentityFields`
  - `StudentPersonalFields`
  - `StudentContactFields`
  - `StudentGuardianLinkFields` if needed later
- Add a conversion-specific schema that extends final student creation with `entryStageId` and keeps applicant email separate from final login email.
- Update `frontend/types.CreateStudentRequest` to include `entryStageId?: string`.

Avoid:

- Do not make `StudentForm.tsx` accept too many modes if it becomes hard to reason about.
- Do not silently admit into a different curriculum than the offering the applicant selected.

### [x] Phase 6: Frontend Types and API Client

Reuse:

- `frontend/lib/api.ts` request patterns:
  - `request<T>()`
  - `buildQueryString()`
  - `uploadFormData<T>()`
  - `ApiRequestError`
- Existing `PaginatedResponse<T>` type.
- Existing `ProgramOffering`, `Program`, `Department`, `AcademicCycle`, and `Attachment` types as building blocks.
- Existing frontend enum style near program/student enums.

Extract or add:

- Loosen or overload `uploadFormData<T>()` so public multipart endpoints can omit the token.
- Add `onlineAdmissions` and `publicOnlineAdmissions` API groups rather than mixing these methods into `org` or `programOfferings`.
- Add conversion-specific request/response types instead of overloading `CreateStudentRequest` too far.

Avoid:

- Do not hand-build query strings in new API methods. Use `buildQueryString()`.
- Do not type uploaded documents as loose `any`; reuse `Attachment`-like fields where possible.

### [x] Phase 7: Public Admissions Portal

Reuse:

- Public shell behavior from root-level pages under `frontend/app/*`.
- `DashboardMainWrapper` already treats root-level non-dashboard routes as public.
- UI primitives:
  - `Button`
  - `Badge`
  - `Input`
  - `Textarea`
  - `CustomSelect`
  - `Toggle`
  - `StatusBanner`
  - `Loading`
  - `EmptyState`
  - `ErrorState`
- Form layout:
  - `FormSection`
  - `FormGrid`
  - `FormField`
  - `FORM_INPUT_CLASS`
- Upload helpers:
  - `GENERIC_UPLOAD_ACCEPT`
  - `isGenericUploadAllowed`
  - `getFileExtension`
  - `formatBytes`
- Attachment preview:
  - `AttachmentPreviewCard`
  - `getAttachmentPreviewKind`
- Org visuals:
  - `OrgLogoOrIcon`
  - `Brand`

Extract or add:

- Add `PublicStudentApplicationFields` using the extracted student field groups but with public-only schema.
- Add `RequiredDocumentUploader` using existing upload policy helpers and `AttachmentPreviewCard` for selected-file previews.
- Add an `AdmissionsOrganizationCard` that reuses `Badge` for program-code tags.
- Add a `PublicAdmissionsStatusBanner` only if `StatusBanner` cannot cover the needed copy/layout.

Avoid:

- Do not build another upload preview UI from scratch.
- Do not make this a marketing landing page; reuse app controls but keep the first screen as the organization browser.

### [x] Phase 8: Admin Admissions Portal

Reuse:

- `PageShell`, `PageHeader`, `PageTabs`, and `ResourceToolbar` from `PageShell.tsx`.
- `PageControls` and `FilterDrawerGrid` from `FilterDrawerToolbar.tsx`.
- `DataTable` for desktop table and mobile cards.
- `TableActions` for row actions where icon vocabulary fits.
- `RemoteFilterSelect` for department/program/offering filters.
- `SearchBar`.
- `useUrlQueryState` for filter state in the URL.
- `usePersistentPageSize` for page size.
- `Badge` for statuses and document completion.
- `ModalForm`, `Modal`, and `ConfirmDialog` for status decisions and rejection/acceptance actions.
- `AttachmentPreviewCard` and `downloadFile()` for document review.
- Existing student/teacher list pages as implementation examples:
  - `frontend/app/(org)/users/students/page.tsx`
  - `frontend/app/(org)/users/teachers/page.tsx`
  - `frontend/components/mail/MailPage.tsx`

Extract or add:

- Add `OnlineAdmissionStatusBadge` following `MailStatusBadge`.
- Add `OnlineAdmissionDecisionModal` using `ModalForm`.
- Add `OnlineAdmissionDocumentChecklist` using `AttachmentPreviewCard`.
- Add a small `buildOnlineAdmissionActiveFilters()` helper, modelled after list pages, if filter chip code gets noisy.

Avoid:

- Do not create one-off filter drawers or pagination controls.
- Do not bypass `useUrlQueryState`; portal filters should be shareable/bookmarkable.

### [x] Phase 9: Program Offering Admin Enhancements

Reuse:

- `ProgramOfferingModal.tsx` existing state/reset/save structure.
- `programOfferingStatusOptions()` and `programStageOfferingStatusOptions()` from `frontend/lib/offeringLifecycle.ts`.
- `AdminProgramOfferingsService.update()` lifecycle and readiness checks.
- `CustomSelect`, `Input`, `Textarea`, `Toggle`, `Label`, and `ModalForm`.
- `StatusBanner` for readiness warnings/blockers if surfaced in the UI.

Extract or add:

- Add `ProgramOfferingOnlineAdmissionSettings` component for:
  - accept-online toggle
  - instructions
  - document requirement editor trigger/summary
- Add `DocumentRequirementEditor` as a reusable component so requirements can be managed from the modal or a future detail page.
- Add a small `normalizeDocumentRequirementDrafts()` frontend helper mirroring backend duplicate/trim behavior.

Avoid:

- Do not overload the offering modal if it becomes visually dense. Keep requirements in a nested drawer or separate panel.
- Do not duplicate lifecycle option maps for online admissions; use the same pattern as existing offering lifecycle code.

### [x] Phase 10: Testing

- [x] Focused service tests for required uploads, persistence cleanup, duplicate blocking, closed offerings, update-token expiry, invalid status transitions, department scope, missing-document filtering, scoped downloads, and admission linkage.
- [x] Human-verification service/controller tests and online-admission controller delegation/streaming tests.
- [x] Prisma validation and backend/frontend production builds.
- [x] Controller-level coverage for public submission metadata, admin filtering, scoped document streaming, and challenge-purpose validation.
- [x] Database-backed e2e coverage for unauthenticated public submission, authenticated admin boundaries, department scope, rejection retention, CSV export, and conversion, implemented in `backend/test/online-admissions.e2e-spec.ts` with the guarded disposable-database runner `backend/scripts/online-admissions-e2e-check.js`.
- [x] Documented browser QA matrix for public discovery/submission, challenge refresh/error/expiry, organization registration, risk-triggered login, email-template placeholders, admin filters, rejection, document updates, and conversion.

Execution note: the e2e runner refuses non-local database hosts and always drops its temporary database. Its latest local execution was stopped before Jest completed at the operator's request; the focused test suites, Prisma validation, and backend/frontend production builds are the completed verification baseline for this phase.

### [x] Final Release-Candidate Audit

- [x] Multipart applications parse and validate their JSON payload before service execution, including submissions with required files.
- [x] Public offering and update-link payloads omit internal email-template configuration and storage metadata.
- [x] Student creation and online-admission linkage commit atomically; retrying the final admission notification is idempotent.
- [x] Admission finalization revokes outstanding applicant update tokens.
- [x] Document requirements become immutable after the first submission so later edits cannot change an applicant's checklist retroactively.
- [x] Public references use cryptographic randomness and stored source-IP fingerprints use keyed HMAC hashing.
- [x] Requirement count and configured file-size limits match the upload middleware limits.
- [x] `HUMAN_VERIFICATION_SECRET` is documented and covered by production environment validation.
- [x] Full backend unit regression suite: 58 suites and 251 tests passed.
- [x] Backend TypeScript compile, backend production build, frontend production build, Prisma validation, focused semantic lint, and `git diff --check` passed.

Deployment gate:

- Run `npm run release:env-check` with the production environment.
- Back up the target PostgreSQL database, then run `npm run release:migrate` before starting the new application image.
- Configure `HUMAN_VERIFICATION_SECRET`, `FRONTEND_URL`, `CLOUDINARY_URL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in production.
- Run `npm run online-admissions:e2e` against an isolated local or CI PostgreSQL instance; the suite is deliberately blocked from shared/non-local database hosts.
- Perform staging smoke tests with real object storage and email delivery before enabling an organization's public admissions toggle.

Reuse:

- Backend spec style from:
  - `backend/src/program-offerings/program-offerings.service.spec.ts`
  - `backend/src/students/student.service.ts` related specs where applicable
  - `backend/src/academic-cycles/academic-cycles.service.spec.ts` for pagination/search patterns
  - `backend/src/grade-evidence/grade-evidence.service.spec.ts` for managed file behavior
- E2E style from:
  - `backend/test/phase11-critical-api.e2e-spec.ts`
  - `backend/test/app.e2e-spec.ts`
- Existing Jest configs.
- Existing frontend build/typecheck commands already approved in this workspace.

Extract or add:

- Add factory helpers for online admission fixtures:
  - approved org with online admissions enabled
  - active department
  - active program visible for admissions
  - open online-enabled program offering
  - document requirements
- Add reusable status transition test table.
- Add file cleanup mocks around `FilesService`/Cloudinary.

Avoid:

- Do not rely only on happy-path public submission tests. Missing documents, unknown requirement ids, closed offerings, scope filtering, and conversion curriculum mismatch are the important regression traps.
