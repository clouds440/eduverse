# Online Admissions Redesign Baseline

**Recorded:** August 19, 2026  
**Purpose:** Lock current behavior and define repeatable measurements before provider-ownership migration.

## Current Endpoint Contract

Public endpoints:

- `GET /public/online-admissions/organizations`
- `GET /public/online-admissions/organizations/:slug`
- `GET /public/online-admissions/offerings/:id`
- `POST /public/online-admissions/offerings/:id/submissions`
- `GET /public/online-admissions/submissions/update/:token`
- `POST /public/online-admissions/submissions/update/:token/documents`

Campus administration endpoints:

- `GET /org/online-admissions`
- `GET /org/online-admissions/export.csv`
- `GET /org/online-admissions/:id`
- `GET /org/online-admissions/:id/documents/:fileId/download`
- `PATCH /org/online-admissions/:id/status`
- `PATCH /org/online-admissions/:id/admit`
- `GET /org/program-offerings/:id/online-admission-requirements`
- `PUT /org/program-offerings/:id/online-admission-requirements`

Current contract invariants:

- Public discovery returns approved, admissions-enabled organizations with eligible open offerings.
- Public offering payloads omit email-template configuration and storage metadata.
- Public submission derives organization, department, program, offering, and cycle from the selected offering.
- Required uploads are validated by requirement ID, MIME type, and size.
- Active duplicate applications are blocked by normalized applicant email and offering.
- Admin reads are Organization and Department scoped.
- `ADMITTED` requires a linked Campus Student enrollment matching the selected offering curriculum.
- Rejected submissions remain queryable and exportable.

## Regression Commands

No database:

```powershell
npm test -- --runInBand online-admissions.service.spec.ts online-admissions.controllers.spec.ts
npm run online-admissions-redesign:guard
```

Disposable database only:

```powershell
npm run online-admissions:e2e
npm run online-admissions-redesign:preflight -- --apply --output=online-admissions-redesign-preflight.json
```

Never run the preflight against production merely to satisfy a development checklist. Capture a staging or sanitized production-clone report before the first ownership migration.

## Query Baseline

The preflight records row counts, integrity checks, and PostgreSQL plan cost for these current hot paths:

1. Public organization discovery with at least one eligible offering.
2. Public offering detail lookup.
3. Campus applicant inbox ordered by submission time.
4. Active duplicate-application lookup.

Add `--analyze` only on a disposable or approved staging database. This records actual planning/execution time and row counts. The command refuses `--analyze` unless `ONLINE_ADMISSIONS_ALLOW_ANALYZE=true` is explicitly set.

Required report metadata:

- Timestamp and redacted database host/name.
- Relevant table counts.
- Integrity-check counts and severity.
- Query plan total cost and estimated rows.
- Actual planning/execution time only when explicitly enabled.

## Baseline Acceptance

Before Phase 1 schema deployment:

- All blocker integrity checks must be zero or have an approved remediation script.
- Query plans must use indexed access for offering ID and duplicate lookup.
- Applicant inbox and public discovery plans must be reviewed against production-like row counts.
- The report must be retained with deployment evidence, not committed if it contains sensitive database metadata.
