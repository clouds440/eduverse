# Programs and Online Admissions Restructure Plan

**Status:** Proposed architecture and phased implementation plan  
**Prepared:** August 19, 2026  
**Scope:** Programs, program offerings, online admissions configuration, public applications, and provider ownership  
**Reference:** `Eduverse_Discover_Proposal_Updated.docx` was used as product reference only. Its contents are not treated as implementation instructions.

## 1. Objective

Reshape Programs and Online Admissions so that:

- A program can represent a degree, diploma, certificate, professional course, short course, bootcamp, workshop, tutoring product, coaching product, or another educational product.
- A concrete offering can carry the complete information a student needs: intake, dates, deadline, study mode, location, schedule, capacity, eligibility, fees, funding, documents, and application instructions.
- Online admissions are configured in a dedicated Admissions workspace, not during program creation.
- Existing EduVerse Campus organizations continue to create operational academic programs, curricula, stages, offerings, and student enrollments.
- Programs and applications are owned by a generic education provider, not by an overloaded or nullable `organizationId`.
- A future standalone educator or education provider can own programs and receive applications without first having an EduVerse Campus organization account.
- The public application APIs can serve the existing EduVerse frontend or a separate `discover.eduverse.com` frontend.
- The structure is ready for future Discover search and publication without implementing Discover-specific profiles, reviews, ratings, promotions, or marketplace features now.

## 2. Firm Scope Boundary

### Included

- Generic education-provider ownership for programs, offerings, files, forms, and applications.
- Generalized program and offering data.
- Separate Campus operational bindings.
- Dedicated Admissions setup and applicant-management workflows.
- Reusable and versioned application forms.
- Offering-specific documents, fees, scholarships/funding, eligibility requirements, dates, and delivery information.
- Public program/offering browsing and no-login application flow.
- Email-based application reference and update flow.
- Campus conversion from an accepted application to a student enrollment when a Campus binding exists.
- Contracts and API boundaries suitable for a separately deployed frontend or backend.
- Migration and compatibility strategy for the implementation already in production.

### Explicitly Deferred

- The branded EduVerse Discover product or homepage.
- Public provider storefront/profile design beyond the minimum provider data required by admissions.
- Comparison, saved programs, recommendations, ratings, reviews, verified completion, and moderation.
- Sponsored listings, marketplace billing, lead monetization, and advertising.
- Full standalone-provider registration, identity verification, or payout onboarding.
- Tuition collection or application-fee payment processing.
- Course delivery for standalone educators.

The data and APIs must leave clean extension points for these features, but none should expand the implementation scope of this restructure.

## 3. Current Implementation Findings

### 3.1 Program Coupling

The current `Program` model is an EduVerse Campus academic configuration, not a general education listing:

- `organizationId` is required.
- `departmentId` is required.
- Structure, progression, completion, passing, and attendance policies are required or assumed.
- Program creation requires a curriculum and at least one stage.
- Stage requirements reference Campus `Course` records owned by the same organization.
- Program services and department authorization consistently scope by `organizationId` and `departmentId`.

This works for Campus delivery but cannot represent a standalone tutor's short course without manufacturing an Organization, Department, Academic Cycle, curriculum, stages, and courses.

### 3.2 Offering Coupling

The current `ProgramOffering` is also Campus-specific:

- `organizationId`, `curriculumVersionId`, and `academicCycleId` are required.
- The unique identity is based on program, curriculum version, and academic cycle.
- Stage offerings are expected for delivery readiness.
- Public application controls, instructions, and documents are embedded in `ProgramOfferingModal.tsx` alongside curriculum and stage-delivery controls.

This conflates two concerns:

1. A public intake/application opportunity.
2. A Campus delivery instance tied to an academic cycle and curriculum.

### 3.3 Admissions Coupling

The current online admission flow is functional but organization-bound:

- Every submission requires organization, department, program, offering, and academic cycle IDs.
- Every document requirement and document upload requires `organizationId`.
- Public file upload resolves an Org Admin/Sub Admin as a synthetic upload owner.
- Admin filtering and conversion assume Campus departments, cycles, and students.
- Applicant answers are stored in unversioned `formData` JSON.
- The public form is hard-coded in `frontend/app/admissions/[slug]/[offeringId]/page.tsx`.
- Required documents are versionless and cannot be safely replaced after submissions exist.

### 3.4 Existing Strengths to Preserve

- Program configuration revisions and curriculum snapshots.
- Offering lifecycle/readiness patterns.
- Department-scoped Campus authorization.
- Submission references, status history, email notifications, update links, CAPTCHA, and no-login applications.
- Required-document MIME and size validation.
- Applicant document review/download controls.
- Exact-offering conversion into Campus student admission.
- Existing public `/admissions` entry point and admin applicant portal.

## 4. Non-Negotiable Architecture Decisions

### 4.1 Use a Real Provider Foreign Key

Introduce an `EducationProvider` domain owner. Do not place an educator ID into `organizationId`, do not use a polymorphic string in `organizationId`, and do not make every organization relation nullable.

`EducationProvider` represents the party that owns programs and receives applications. It may be linked to:

- An existing EduVerse Campus `Organization`.
- A future standalone institution, academy, company, or educator account.

Every Campus organization gets one provider record. A standalone provider gets a provider record without an Organization. Public and admissions records use `providerId` as their tenant boundary.

### 4.2 Separate Catalog Identity From Campus Delivery

The target `Program` is the stable, provider-owned educational product. Campus-only academic configuration moves behind an optional one-to-one `CampusProgramConfiguration`.

- Generic program data must not require a department, curriculum, stage, or Campus course.
- A Campus-delivered program has a Campus configuration and can use the existing curriculum/progression system.
- A standalone program can exist without a Campus configuration.
- Existing Campus student enrollment remains legal only for a program with a valid Campus configuration.

### 4.3 Separate Public Offering From Campus Offering Binding

The target `ProgramOffering` is a concrete intake or enrollment opportunity. It owns public/admissions data and does not require an Academic Cycle or curriculum.

An optional `CampusProgramOfferingBinding` links it to:

- `organizationId`
- `academicCycleId`
- `curriculumVersionId`
- Campus stage offerings and delivery readiness

This allows the same application engine to support both Campus-backed and standalone offerings.

### 4.4 Keep Admissions Out of Program Creation

Program creation and editing define the educational product and, for Campus programs, its academic structure. They do not configure:

- Public application visibility.
- Application dates.
- Forms.
- Required documents.
- Fees or scholarships.
- Intake capacity.
- Applicant instructions.
- Submission workflows.

All of those belong to a dedicated Admissions Setup workspace. The existing Online Admissions section must be removed from `ProgramForm.tsx`, and online-admission controls must be removed from the Campus delivery-offering modal.

### 4.5 Version Anything an Applicant Relies On

Published forms, document requirements, consent text, fees shown during application, and public offering details must not mutate underneath an existing submission.

- Draft changes are editable.
- Publishing creates an immutable version.
- New submissions use the current published version.
- Existing submissions retain references and snapshots from the version they used.

### 4.6 Keep Public Consumers Behind Stable APIs

The public frontend must consume versioned HTTP contracts. It must not depend on Campus React components, database access, or `/org/*` endpoints.

This permits:

- The current frontend to host `/admissions` now.
- A separate `discover.eduverse.com` frontend later.
- A public admissions backend to be extracted later without changing browser contracts.

## 5. Target Domain Model

The names below describe the intended ownership and boundaries. Exact Prisma naming may be adjusted during implementation, but the relations and invariants are required.

### 5.1 EducationProvider

Minimum core fields:

- `id`
- `kind`: `INSTITUTION`, `ACADEMY`, `TRAINING_PROVIDER`, `ONLINE_PROVIDER`, `EDUCATOR`, `OTHER`
- `displayName`
- `slug`
- `status`: `DRAFT`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`
- `campusOrganizationId?` with a unique relation to `Organization`
- `defaultCurrency?`
- `timezone?`
- `contactEmail?`
- `createdAt`, `updatedAt`

Rules:

- One Campus Organization has at most one provider.
- A provider does not need an Organization.
- Provider status is the ownership/access lifecycle, not future Discover verification.
- Verification badges and public profile fields remain deferred extensions.

### 5.2 Provider Membership and Authorization

Introduce a provider authorization boundary rather than relying on `User.organizationId` forever:

- `EducationProviderMembership`
- `providerId`
- `userId`
- role: `OWNER`, `ADMIN`, `PROGRAM_MANAGER`, `ADMISSIONS_MANAGER`, `REVIEWER`, `VIEWER`
- status and timestamps

Campus adapter behavior:

- Existing Org Admin/Sub Admin/Manager permissions map into provider capabilities.
- Existing department scopes continue to apply to Campus-backed programs.
- Standalone memberships do not require a Campus role or department.
- Domain services authorize capabilities against a `ProviderActorContext`.

Do not migrate all authentication in the first phase. Add an adapter that derives provider permissions from current organization roles, then introduce direct provider memberships when standalone onboarding is implemented.

### 5.3 Program

Provider-owned catalog fields:

- `id`, `providerId`
- `name`, `code`, `slug`
- `programType`: `DEGREE`, `DIPLOMA`, `CERTIFICATE`, `COURSE`, `SHORT_COURSE`, `BOOTCAMP`, `WORKSHOP`, `TUTORING`, `COACHING`, `CLASS`, `OTHER`
- `credentialType?` and `credentialAwarded?`
- `summary`
- `description`
- `subjectAreaId?` and provider-defined tags
- `educationLevel?`
- `languageCodes[]`
- default duration value/unit
- `targetAudience?`
- `learningOutcomes?`
- `entryOverview?`
- `awardingBody?`
- `accreditationSummary?`
- lifecycle status: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`
- timestamps and archive metadata

Rules:

- `providerId + code` is unique.
- Program type does not determine whether a curriculum is required.
- Public visibility is not a field toggled during creation. Publication is controlled by Admissions/Public Offering setup.
- Searchable/filterable attributes use structured columns or relations. Long presentation content may use sanitized rich text.

### 5.4 CampusProgramConfiguration

Campus-only fields migrated from the current Program model:

- `programId` unique
- `organizationId`
- `departmentId`
- `configurationVersion`
- `structureType`
- `progressionMode`
- `completionMode`
- passing and attendance policies
- archive/configuration metadata where operationally relevant

Existing `ProgramConfigurationRevision`, `CurriculumVersion`, `ProgramStage`, and `StageCourseRequirement` remain Campus operational models and retain `organizationId` for tenant isolation. They must validate that their parent program has a matching Campus configuration.

### 5.5 ProgramOffering

Provider-owned intake fields:

- `id`, `providerId`, `programId`
- provider-facing code and optional public slug
- `intakeName` such as "Fall 2027" or "April Weekend Cohort"
- lifecycle: `DRAFT`, `PUBLISHED`, `OPEN`, `CLOSED`, `CANCELLED`, `ARCHIVED`
- application open/close timestamps
- teaching start/end timestamps
- timezone
- capacity and optional waitlist behavior
- delivery mode: `ON_CAMPUS`, `ONLINE`, `HYBRID`, `FLEXIBLE`
- attendance mode: `FULL_TIME`, `PART_TIME`, `SELF_PACED`, `SCHEDULED`, `OTHER`
- location reference or structured location snapshot
- schedule summary
- duration override
- language overrides
- public summary and detailed instructions
- contact channel
- supported actions: `APPLY`, `ENROLL_INTEREST`, `REQUEST_INFO`
- timestamps

Rules:

- An offering may exist without an Academic Cycle.
- Dates use provider timezone and are returned to clients in ISO format with timezone context.
- Public eligibility is calculated by a shared policy, not duplicated in controllers.
- Capacity and application counts are separate; the policy must explicitly define whether pending applications reserve capacity.

### 5.6 CampusProgramOfferingBinding

Optional one-to-one binding:

- `programOfferingId` unique
- `organizationId`
- `academicCycleId`
- `curriculumVersionId`
- Campus delivery status/readiness metadata

Existing `ProgramStageOffering` records attach through this binding or remain attached to `ProgramOffering` with an invariant that they only exist when a binding exists. The implementation phase must choose one relation shape and enforce it in both Prisma and services.

### 5.7 Offering Locations

Support online, one or multiple physical locations, and future filtering:

- `ProviderLocation`: reusable provider location/address with coordinates optional.
- `ProgramOfferingLocation`: offering-to-location relation.
- Online offerings need no fake physical location.
- Hybrid offerings may link physical locations and include online delivery metadata.

Do not store the only location representation as one free-text string. Preserve a display label while keeping city, region, country, postal code, and coordinates separately where available.

### 5.8 Fees and Funding

Public fees must not reuse `FinancialStructure` directly. That model creates operational ledgers for known Campus people; public fee disclosure is catalog data.

Add `ProgramOfferingFee`:

- `providerId`, `programOfferingId`
- fee type: `TUITION`, `APPLICATION`, `REGISTRATION`, `EXAM`, `MATERIAL`, `TECHNOLOGY`, `OTHER`
- title and description
- amount as `Decimal`, currency as ISO code
- optional minimum/maximum amount for ranges
- basis: `TOTAL`, `PER_CREDIT`, `PER_COURSE`, `PER_TERM`, `PER_MONTH`, `PER_SESSION`, `OTHER`
- frequency/payment schedule summary
- required, refundable, and tax-included flags
- due timing or due-date description
- sort order

Add `ProgramOfferingFundingOption` for scholarships, discounts, financial aid, or installment information:

- type, title, description
- amount or percentage when structured
- eligibility summary
- application URL or instructions
- deadline

Rules:

- Every offering has one display currency even when individual fee lines are absent.
- "Contact provider" or "Free" are explicit fee-display states, not magic zero/null combinations.
- Public APIs return both structured fee lines and a computed display summary.
- Future payment processing references these records but does not mutate their historical application snapshots.

### 5.9 Eligibility and Admission Requirements

Add structured `ProgramAdmissionRequirement` defaults and offering-level overrides:

- category: `ACADEMIC`, `PREREQUISITE`, `AGE`, `LANGUAGE`, `EXPERIENCE`, `LOCATION`, `IDENTITY`, `OTHER`
- title, description
- required flag
- structured value/operator when filterable
- sort order
- source level: program default or offering override

The effective requirement list is materialized into the published offering version. Requirements shown publicly must not be inferred only from document labels.

### 5.10 Application Configuration and Form Versions

Create a dedicated admissions configuration model:

- `AdmissionApplicationTemplate`: reusable provider-owned template.
- `AdmissionApplicationTemplateVersion`: immutable published form definition.
- `ProgramOfferingApplicationConfig`: binds an offering to a published form version and workflow settings.

Form version content:

- Stable schema version.
- Ordered sections.
- Fields with stable keys.
- Supported field types: short text, long text, email, phone, date, number, select, multi-select, radio, checkbox, address, consent, and document upload.
- Label, help text, placeholder, required flag, options, validation rules, conditional visibility, and sort order.
- Canonical mapping target where applicable, such as applicant name, email, phone, date of birth, address, guardian name, or emergency contact.
- Consent/privacy text and version.

Implementation rule:

- Store form definitions as a versioned, validated schema plus UI schema rather than arbitrary executable configuration.
- Validate schemas at write time against a server-owned allowlist.
- Validate answers again on the backend against the exact published version.
- Never trust frontend-only required checks.
- No custom JavaScript, HTML, or regular expressions supplied directly by providers.

The existing StudentForm fields can seed a default Campus Admissions template, but the public application page must render from the published form schema. Canonical mappings allow accepted applications to prefill `StudentForm.tsx` safely without forcing every provider to use the same questions.

### 5.11 Document Requirements

Document requirements belong to the published application configuration version, not directly to a mutable offering:

- Stable requirement key and ID.
- Label and description.
- Required flag.
- Accepted MIME types and extensions.
- Maximum size and file-count limits.
- Expiry-date requirement if applicable.
- Sort order.
- Optional document category.

Uploads snapshot the label and validation policy used at submission time. A new requirement version applies only to new submissions unless an administrator explicitly requests an additional document from an existing applicant.

Support an application-level `AdditionalDocumentRequest` for post-submission requests rather than mutating the original form version.

### 5.12 Published Offering Versions

Add an immutable `ProgramOfferingPublicationVersion` or equivalent snapshot containing:

- Public program and offering fields.
- Effective eligibility requirements.
- Fee and funding snapshots.
- Application action configuration.
- Application form version ID.
- Document requirement version IDs.
- Publication timestamp and publisher.

`ProgramOffering.currentPublishedVersionId` identifies what new visitors see. Search indexes and separate frontends consume publication versions, not mutable drafts.

### 5.13 OnlineAdmissionSubmission

Generalize submission ownership:

- Required: `providerId`, `programId`, `programOfferingId`, publication version ID, application form version ID.
- Optional Campus routing: `organizationId`, `departmentId`, `academicCycleId` or the Campus offering binding ID.
- Intent: `APPLY`, `ENROLL_INTEREST`, `REQUEST_INFO`.
- Indexed applicant name, normalized email, and phone.
- Answers JSON validated against the referenced form version.
- Consent-version snapshot.
- Status and immutable status history.
- Source channel and public reference.
- Update-token hash and expiry.
- Optional admitted Campus student ID.
- Optional external enrollment reference for standalone-provider workflows later.

Rules:

- A standalone submission must not require Organization, Department, Academic Cycle, or Student.
- Campus routing values are derived from the binding, never trusted from public request bodies.
- Duplicate policy is provider/offering/intent aware.
- Conversion to Campus Student is available only when the offering has a valid Campus binding.
- Accepted standalone applications remain valid admissions records without creating fake Campus students.

### 5.14 Files and Upload Ownership

Remove the requirement to find an Org Admin as the uploader for a public application.

Target file ownership must include:

- `providerId` as tenant boundary.
- optional `organizationId` for Campus compatibility.
- entity type and entity ID.
- uploader principal type: public applicant, provider member, Campus user, or system.
- scan status, hash, MIME type, size, and storage metadata.

Download authorization must resolve through submission/provider access. Storage paths and API responses must not expose raw provider or applicant secrets. Separate public frontends receive signed/authorized download responses through the API.

## 6. Target User Experience

### 6.1 Program Workspace

Program creation becomes focused and type-aware:

1. Choose program type.
2. Enter identity, subject, description, duration, language, and credential details.
3. For a Campus program, configure department and academic structure in a Campus configuration step.
4. Save as draft or activate the operational program.

The form adapts to program type:

- A degree may need a full curriculum and stages.
- A short course may use a lightweight outline.
- A standalone listing does not need Campus structure.

There is no Online Admissions section in this form.

### 6.2 Admissions Setup Workspace

Create a dedicated route such as `/online-admissions/setup` with these views:

- **Overview:** draft, ready, open, closed, and blocked offerings.
- **Listings:** choose a program and create/manage admissions offerings.
- **Forms:** create, clone, version, preview, and publish application templates.
- **Applicants:** existing review portal.
- **Settings:** provider-level email defaults, public availability, and admissions policies.

Offering setup uses a clear staged editor:

1. Program and intake identity.
2. Delivery mode, dates, location, schedule, and capacity.
3. Public description and eligibility requirements.
4. Fees and funding.
5. Application action and form selection.
6. Required documents.
7. Campus binding, if applicable.
8. Preview, readiness report, and publish/open controls.

Draft progress is saved between steps. A readiness report identifies exact blockers. Publishing and opening are separate actions so a listing can be visible before applications open if desired later.

### 6.3 Provider Listing Workflow

For an existing Campus organization:

1. The system provisions its EducationProvider record.
2. Admin creates or selects a program.
3. Admin opens Admissions Setup and creates a listing/intake.
4. Admin adds details, fees, requirements, form, and documents.
5. Admin links the intake to Campus cycle/curriculum where relevant.
6. Admin previews and publishes.
7. Admin opens applications.

For a future standalone provider:

1. Provider onboarding creates EducationProvider and membership records without Organization.
2. The same Program and Admissions Setup contracts/components are used.
3. Campus-binding steps are absent.
4. Applications enter the provider applicant inbox.
5. No Campus student is created unless the provider later adopts Campus and links/migrates the offering.

### 6.4 Student Application Flow

The public flow should be program-first while retaining provider browsing:

1. Browse/search open program offerings.
2. Filter by program type, subject, provider, location, delivery mode, fee range, intake, and deadline.
3. Open an offering detail page containing all decision information.
4. Select Apply, Enroll Interest, or Request Info when enabled.
5. Complete the versioned form.
6. Upload required documents.
7. Review entered information, fee disclosure, privacy consent, and selected offering.
8. Complete CAPTCHA and submit.
9. Receive a reference and email update link; no account is required.
10. Supply requested updates/documents through the secure link.

The initial implementation can keep the existing `/admissions` URL. Route and API contracts should not include an organization slug as the only possible owner identity.

### 6.5 Applicant Review and Conversion

The applicant portal keeps the existing filters and adds provider-neutral behavior:

- Filter by program type, program, offering/intake, action, status, submission date, and document completeness.
- Campus users additionally filter by department and academic cycle.
- Standalone providers do not see irrelevant Campus filters.
- Reviewer sees the exact form, document, fee, and offering snapshots accepted by the applicant.
- Canonically mapped answers prefill the Campus Student form.
- Unmapped answers remain visible as application data and are not silently discarded.
- Admission conversion validates the Campus binding and snapshots the exact curriculum.
- Rejected, withdrawn, and admitted records remain retained according to policy.

## 7. API and Deployment Boundary

### 7.1 Shared Contracts

Create a framework-neutral contracts package, for example `packages/programs-admissions-contracts`, containing:

- Versioned request/response DTO schemas.
- Public enums and discriminated unions.
- Form schema and answer validation schemas.
- Pagination/filter contracts.
- No NestJS, Prisma, Next.js, or browser-only imports.

Generate or infer backend and frontend types from the same runtime schemas where practical.

### 7.2 Domain Services

Refactor business logic behind provider-oriented services:

- `ProgramsCatalogService`
- `ProgramOfferingsService`
- `AdmissionsConfigurationService`
- `AdmissionsSubmissionService`
- `AdmissionsReviewService`
- `CampusAdmissionsBridgeService`

Controllers are adapters. `/org/*` controllers resolve the organization's provider context and call the same domain services as future provider controllers.

### 7.3 Public API

Introduce versioned public routes, while maintaining current routes during migration:

- `GET /v1/public/program-offerings`
- `GET /v1/public/program-offerings/:id-or-slug`
- `GET /v1/public/providers/:slug/program-offerings`
- `GET /v1/public/application-configurations/:publishedVersionId`
- `POST /v1/public/program-offerings/:id/applications`
- `GET/POST /v1/public/applications/update/:token`

Public responses expose publication snapshots and never internal notes, storage paths, reviewer identity, email templates, or Campus configuration details.

### 7.4 Separate Frontend Readiness

For a future `discover.eduverse.com` frontend:

- Allow multiple configured CORS origins rather than one frontend assumption. The current comma-separated `FRONTEND_URL` policy is a usable starting point but should be renamed/configured clearly.
- Use separate environment variables for Campus, Admissions, and future Discover canonical URLs.
- Generate email links using the owning channel's configured public URL, not one global `FRONTEND_URL`.
- Keep CAPTCHA endpoints and cookies/tokens compatible with cross-origin deployment.
- Prefer bearer/update tokens over dependence on same-site Campus sessions for public applicants.
- Use API-owned signed file access.
- Add cache headers/ETags for public publication records.

### 7.5 Separate Backend Readiness

Do not split the backend during the first restructure. Create an extractable module boundary first:

- No direct imports from admissions into React/frontend code.
- No public controller access to Prisma outside domain services.
- Publish domain events through an outbox for offering publication, application submission, status change, and Campus conversion.
- Search indexing and future Discover synchronization consume events or versioned APIs.
- If extracted later, IDs remain globally unique and public contracts stay unchanged.

## 8. Migration Strategy

The migration must be additive and reversible at each deployment boundary. Do not reset production data and do not replace the existing initial migration.

### Stage 1: Add Ownership Without Behavior Change

- Add EducationProvider and provider-membership foundations.
- Provision one provider per existing Organization.
- Add nullable `providerId` to Program, ProgramOffering, submissions, requirements, uploads, and relevant files.
- Backfill from Organization-to-provider mapping.
- Add indexes and consistency checks.
- Dual-write organization and provider ownership.
- Reject writes where provider and organization mapping disagree.
- Make provider IDs non-null where the target model requires them only after verification.

### Stage 2: Add Generic Catalog and Admissions Data

- Add program type and generic catalog fields.
- Backfill existing programs with a conservative type such as `DEGREE` or `OTHER` based on explicit admin confirmation; do not guess from names in production migrations.
- Add offering intake, delivery, location, fee, funding, eligibility, and publication-version models.
- Add form template/version models and map the existing hard-coded form to a default version.
- Add submission references to form/publication versions.
- Continue serving old response shapes through compatibility mappers.

### Stage 3: Introduce Campus Bindings

- Create CampusProgramConfiguration and CampusProgramOfferingBinding for all existing records.
- Dual-read/dual-write old fields and binding fields.
- Update services incrementally to resolve Campus data through bindings.
- Add database checks/tests that Campus curriculum/stage records match the binding organization.
- Move public and admissions services to provider-owned models first.
- Move student progression/delivery services only after compatibility tests pass.

### Stage 4: Remove Legacy Coupling

- Stop writing admissions fields on Program and Campus delivery fields on generic ProgramOffering.
- Remove ProgramForm admissions controls.
- Remove admissions controls/documents from ProgramOfferingModal.
- Make generic services independent of `organizationId`.
- Retain organization IDs only on Campus operational models and optional submission routing snapshots.
- Remove deprecated fields only after telemetry confirms no old client usage.

## 9. Implementation Phases

### [ ] Phase 0: Architecture Contracts and Safety Harness

- Write architecture decision records for provider ownership, Program/Campus split, Offering/Campus split, and versioned forms.
- Create current-data preflight scripts and relation-count reports.
- Add contract tests around current public admissions payloads and Campus conversion.
- Record baseline query performance and endpoint behavior.
- Freeze new admissions fields from being added directly to Program during this work.

Exit criteria:

- Target relations are agreed and represented in diagrams/ADRs.
- Existing behavior has regression coverage.
- Migration preflight can detect inconsistent organization/program/offering records.

### [ ] Phase 1: Provider Ownership Foundation

- Add EducationProvider and organization link.
- Backfill provider records for every Organization.
- Add provider actor context and organization-role adapter.
- Add provider IDs to program/admissions records and dual-write them.
- Update file service to accept public-applicant/system upload principals without a fake Org Admin uploader.
- Add tenant-isolation tests for Campus and standalone-shaped provider fixtures.

Exit criteria:

- Every existing program, offering, and submission resolves exactly one provider.
- Current Campus UI and APIs behave unchanged.
- Public document submission no longer depends on an Org Admin upload owner.

### [ ] Phase 2: Generic Program Catalog

- Add program type, subject, credential, language, description, audience, outcomes, and generic duration fields.
- Build type-aware Program DTOs and validation.
- Introduce CampusProgramConfiguration and migrate operational fields.
- Refactor Program services into catalog and Campus configuration services.
- Remove online-admissions controls from ProgramForm.
- Preserve revision/curriculum behavior for Campus programs.
- Add lightweight standalone program fixtures and service tests.

Exit criteria:

- A valid program can exist without Organization, Department, curriculum, stage, Academic Cycle, or Campus Course.
- A Campus degree retains all existing progression and enrollment behavior.
- Program create/edit contains no public admissions configuration.

### [ ] Phase 3: Generic Program Offerings and Campus Binding

- Add general intake, delivery, date, location, schedule, capacity, and action fields.
- Introduce CampusProgramOfferingBinding.
- Move curriculum/cycle/stage readiness into Campus binding services.
- Split public listing readiness from Campus delivery readiness.
- Preserve existing ProgramOffering IDs where feasible to avoid breaking submissions and enrollments.
- Add compatibility API mappers.

Exit criteria:

- A standalone online course offering can exist and open applications without an Academic Cycle.
- A Campus offering still binds to exact curriculum and cycle.
- Public readiness and Campus delivery readiness report separate blocker sets.

### [ ] Phase 4: Admissions Configuration and Versioned Form Builder

- Add templates, immutable form versions, canonical mappings, and server validation.
- Seed a default Campus application template based on StudentForm fields.
- Build reusable form renderer shared by preview and public application pages.
- Build Admissions Forms list/editor/preview/publish UI.
- Add versioned document requirements and post-submission additional-document requests.
- Store exact form and requirement versions on submissions.

Exit criteria:

- Admin can configure an application without editing a Program.
- Public application renders entirely from server-provided form schema.
- Existing submissions remain renderable after a form changes.
- Canonically mapped fields can prefill StudentForm.

### [ ] Phase 5: Rich Admissions Listing Setup

- Build dedicated Admissions Setup workspace.
- Add offering details, study modes, locations, deadlines, fees, funding, eligibility, documents, and form selection.
- Add draft autosave, preview, readiness, publish, open, close, clone, and archive flows.
- Move existing online-admission toggles/instructions/documents out of ProgramOfferingModal.
- Keep provider-level admissions enablement and email defaults in Admissions Settings.

Exit criteria:

- An admin can configure every student-facing field required by this plan from Admissions Setup.
- Program creation remains independent.
- Published snapshots are immutable and complete.

### [ ] Phase 6: Provider-Neutral Public Admissions Portal

- Change the public browser from organization-first only to program/offering-first discovery, while retaining provider pages.
- Add filters for type, subject, location, online availability, fee range, intake, and deadline.
- Add complete offering detail and fee/requirement disclosure.
- Render dynamic forms and versioned documents.
- Keep no-login submit, CAPTCHA, email reference, and secure update links.
- Remove organization slug as a required ownership assumption from routes/contracts.
- Maintain redirects/compatibility for existing `/admissions/:organizationSlug/:offeringId` links.

Exit criteria:

- Campus and standalone-shaped offerings appear through the same public contracts.
- A student can make an informed application from structured listing data.
- Old public admissions links remain valid.

### [ ] Phase 7: Provider-Neutral Applicant Operations

- Refactor applicant inbox filters and permissions around provider context.
- Show Campus-only filters conditionally.
- Render submissions against their historical form/publication versions.
- Preserve status history, document requests, emails, exports, and rejections.
- Keep Campus student conversion behind CampusAdmissionsBridgeService.
- Add provider acceptance/enrollment outcome fields that do not require a Student record.

Exit criteria:

- A provider can review applications without an Organization.
- Campus admins retain department scoping and exact curriculum conversion.
- No applicant answer or historical disclosure is lost during migration.

### [ ] Phase 8: Public API and Separate Frontend Hardening

- Publish versioned contracts package and `/v1/public` routes.
- Add multi-frontend URL configuration and CORS tests.
- Add API pagination, filter validation, cache policy, and rate limiting.
- Add publication and application domain events/outbox.
- Document integration for a separate frontend.
- Verify public APIs without importing Campus-only modules.

Exit criteria:

- A fresh frontend can browse and submit applications using only published contracts.
- Email/update URLs route to the configured public frontend.
- Backend extraction is possible without changing entity IDs or browser contracts.

### [ ] Phase 9: Legacy Removal and Production Rollout

- Run dual-read comparison telemetry.
- Backfill and validate all provider/form/publication references.
- Remove deprecated Program admissions fields and Offering organization/cycle assumptions only when unused.
- Remove old hard-coded public form.
- Update docs, AI context tools, global search, routes, permissions, exports, and deployment checks.
- Roll out behind per-provider feature flags with rollback paths.

Exit criteria:

- No production record depends solely on deprecated fields.
- Full tests, migrations, preflight, backups, and rollback rehearsal pass.
- Current Campus admissions and provider-neutral admissions both pass end-to-end checks.

## 10. Code Impact Map

### Backend

Primary areas:

- `backend/prisma/schema.prisma`
- `backend/src/programs/*`
- `backend/src/program-offerings/*`
- `backend/src/online-admissions/*`
- `backend/src/student-program-enrollments/*`
- `backend/src/files/*`
- `backend/src/common/department-scope.ts`
- `backend/src/common/offering-lifecycle.ts`
- `backend/src/common/origin-policy.ts`
- `backend/src/ai/ai-online-admissions-tools.service.ts`

New likely modules:

- `education-providers`
- `program-catalog`
- `admissions-configuration`
- `admissions-publications`
- `campus-admissions-bridge`
- shared provider actor/permission utilities

### Frontend

Primary areas:

- `frontend/components/programs/ProgramForm.tsx`
- `frontend/components/programs/ProgramOfferingModal.tsx`
- `frontend/app/(org)/programs/*`
- `frontend/app/(org)/online-admissions/*`
- `frontend/app/admissions/*`
- `frontend/components/forms/StudentForm.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `frontend/lib/orgSidebar.ts`
- `frontend/components/global-search/searchIndex.ts`

New likely components:

- Program type selector and type-aware details editor.
- Admissions setup shell and readiness panel.
- Offering details, location, fee, funding, eligibility, and document editors.
- Application form builder, preview, and schema renderer.
- Published offering preview.
- Historical submission renderer.

### Shared Packages

- Add runtime contracts for program catalog, public offering, form schema, application answers, and filters.
- Keep UI components outside the contracts package.

## 11. Reuse Plan

Reuse rather than rewrite:

- Existing program revision and curriculum services for CampusProgramConfiguration.
- Existing offering lifecycle helpers as the basis for separate publication and delivery lifecycles.
- Existing readiness result shape with distinct `publicAdmissions` and `campusDelivery` sections.
- Existing StudentForm default values and field mappings to seed the default application template.
- Existing CapVerification component.
- Existing document MIME/size checks and FilesService scanning.
- Existing status email templates, update-token hashing, and reference generation.
- Existing applicant filters, status tabs, CSV export, and document review UI.
- Existing department-scope helpers inside the Campus authorization adapter.
- Existing `PageShell`, `PageTabs`, `ResourcePanel`, `ResourceToolbar`, `RemoteFilterSelect`, form controls, and status components.

Extract before reuse where needed:

- Shared form-field definitions and canonical Student mapping from StudentForm.
- Shared public-offering eligibility policy currently duplicated across offering/admissions queries.
- Provider-aware file ownership and download authorization.
- Public URL generation by channel.
- Offering fee-summary formatter shared by APIs and frontend.

## 12. Validation, Security, and Privacy

- Enforce provider tenant scope on every write/read; organization scope alone is insufficient for new models.
- Derive provider, program, offering, and Campus routing relations server-side.
- Validate dynamic form schemas at publish time and answers at submit time.
- Sanitize rich text and reject executable content.
- Rate-limit browse-sensitive endpoints, submissions, update-token checks, and uploads appropriately.
- Keep CAPTCHA on public submission and suspicious update behavior.
- Preserve anti-duplicate and anti-spam controls.
- Virus/scan uploaded files and block unapproved files from reviewers.
- Encrypt or tightly protect sensitive applicant fields according to current platform capabilities.
- Add consent version, privacy notice version, retention policy, and deletion/anonymization workflow.
- Never expose internal reviewer notes, storage paths, or provider settings publicly.
- Audit publication, form changes, status changes, document requests, downloads, and conversions.

## 13. Testing Strategy

### Model and Migration Tests

- One provider per Campus organization.
- Standalone provider with no Organization.
- Provider/program/offering ownership consistency.
- Existing IDs and submission relations survive migration.
- Dual-write mismatch detection.
- Backfill idempotency and rollback rehearsal.

### Program Tests

- Campus degree with curriculum and stages.
- Standalone short course without Campus configuration.
- Program-type validation.
- Provider isolation and code uniqueness.
- Campus-only operations reject programs without Campus configuration.

### Offering Tests

- On-campus, online, and hybrid offerings.
- Offering with and without Campus binding.
- Date/deadline/timezone validation.
- Fee ranges, free offerings, contact-for-price, and multiple fee lines.
- Eligibility/default override resolution.
- Separate public and delivery readiness.
- Immutable publication versions.

### Form and Document Tests

- Schema allowlist and malformed schema rejection.
- Required/conditional fields.
- Canonical mappings.
- Historical versions render after changes.
- Document type, size, count, replacement, and additional requests.
- Backend answer validation cannot be bypassed by raw requests.

### Submission Tests

- Campus and standalone provider applications.
- Apply, interest, and request-info intents.
- Duplicate policy.
- CAPTCHA, rate limits, update-token expiry, and email links.
- Provider and department reviewer scope.
- Rejection retention.
- Campus conversion uses exact bound curriculum.
- Standalone acceptance does not require or create a Student.

### Contract and Deployment Tests

- Old and new public routes during compatibility period.
- Separate-origin CORS and preflight.
- Public payload redaction.
- Contract compatibility between current frontend and a sample independent client.
- Email URL generation for Campus Admissions and future Discover hosts.
- Signed document access across origins.

## 14. Readiness and Publication Rules

An offering cannot publish until it has:

- Active provider.
- Active, complete program catalog record.
- Program and offering display names/types.
- Delivery mode.
- Start/intake information or an explicit self-paced state.
- Application action.
- Published form version for Apply actions.
- Valid deadline window.
- Explicit fee display state and currency.
- Complete required-document policy.
- Privacy/consent version.
- At least one contact path.
- Valid Campus binding when Campus conversion is enabled.

Opening applications additionally requires:

- Current time inside the allowed window.
- Available capacity or allowed waitlist/unlimited setting.
- Public provider/admissions enablement.
- CAPTCHA/backend health.
- Valid email delivery configuration.

Readiness returns machine-readable blocker codes plus user-facing messages. The public API uses the same policy as admin preview and publication.

## 15. Decisions Locked by This Plan

- Provider ownership is explicit through `providerId`.
- An educator ID is never stored in an `organizationId` field.
- Organization relations remain strict on Campus operational data.
- Programs are generic educational products; Campus structure is optional configuration.
- Offerings are generic intakes; Campus cycle/curriculum is an optional binding.
- Admissions configuration is separate from program creation.
- Forms and applicant-facing configurations are versioned.
- Public fees are structured catalog data, separate from Campus finance ledgers.
- Public applications do not require login.
- Campus Student conversion is optional and binding-dependent.
- Public APIs are designed for independently deployed clients.
- Discover-only marketplace features remain out of scope.

## 16. Product Decisions Required Before Their Phase

These do not block Phase 0 or Phase 1, but must be resolved before the named phase:

- Before Phase 2: final program type and education-level taxonomy.
- Before Phase 3: whether one offering may carry multiple delivery modes/locations or whether each variant is a separate offering.
- Before Phase 4: approved dynamic field types, conditional-logic limits, and applicant-data retention period.
- Before Phase 5: fee disclosure rules, supported currencies, and whether application fees are display-only.
- Before Phase 6: canonical public URL shape and whether closed-but-published offerings remain browsable.
- Before Phase 7: standalone provider workflow statuses after acceptance.
- Before Phase 8: whether the first separate public frontend uses the same backend directly or a thin BFF.

## 17. Recommended Execution Order

Implement Phases 0 through 3 before redesigning the public pages. The ownership and Campus-binding boundaries must exist before a new UI starts depending on richer records. Then implement versioned forms and Admissions Setup before switching public submission to the new contracts. Keep compatibility adapters until applicant conversion, email update links, and historical submissions are verified against migrated production-like data.

The first visible product milestone should be:

1. Program creation without admissions controls.
2. A dedicated Admissions Setup workspace.
3. Rich Campus-backed listings using provider-owned models.
4. Dynamic versioned applications.
5. Existing applicant review and Campus conversion preserved.

Standalone-provider UI can follow on the same contracts without another Programs or Admissions redesign.
