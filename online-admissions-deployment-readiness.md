# Online Admissions Deployment Readiness

Date: 2026-08-19

## Verdict

The implementation is code-ready for staging. Production rollout is conditional on applying all pending Prisma migrations, passing release environment validation, and completing the isolated database e2e plus staging storage/email smoke tests.

## Final Audit Fixes

- Fixed multipart submissions with documents so the embedded JSON payload is parsed and validated before controller execution.
- Removed organization email templates and internal file storage metadata from public API payloads.
- Made student creation and online-admission linkage atomic, with idempotent final notification retry behavior.
- Revoked document-update tokens whenever an application becomes admitted.
- Prevented document requirement replacement after applications exist for an offering.
- Replaced `Math.random()` references with cryptographic randomness and keyed source-IP fingerprints.
- Aligned document requirement limits with the middleware maximum of 20 files and 50 MB per file.
- Replaced the custom database-backed arithmetic challenge with reusable Cap proof-of-work verification for admissions, organization registration, and suspicious login attempts.

## Verification Completed

- Backend unit tests: 59 suites, 257 tests passed.
- Focused Cap and online-admissions tests: 5 suites, 27 tests passed.
- Backend TypeScript compile: passed.
- Backend production build: passed.
- Frontend production build: passed, including all public and admin admissions routes.
- Prisma schema validation: passed.
- Focused semantic ESLint check: passed with Prettier disabled to avoid the repository's existing CRLF formatting mismatch.
- `git diff --check`: passed.

## Required Release Steps

1. Back up the target PostgreSQL database.
2. Set `NODE_ENV=production` and configure `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CLOUDINARY_URL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
3. Run `npm run release:env-check` from `backend`.
4. Run `npm run release:migrate` from `backend` before starting the new backend release.
5. Build and deploy backend and frontend from the same revision.
6. Run `npm run online-admissions:e2e` against an isolated local or CI PostgreSQL instance.
7. In staging, submit an application with required files, request missing documents, use the email update link, reject one application, and convert another to a student.
8. Confirm Cloudinary upload/download/delete behavior and Resend delivery before enabling online admissions for production organizations.

## Known Operational Notes

- The database e2e suite is implemented but was not completed in this workspace at the operator's request. Its runner refuses non-local PostgreSQL hosts by design.
- The production launcher and Docker image now run `prisma migrate deploy` before Nest starts. An explicit release migration remains recommended so migration failures stop the release before traffic is shifted.
- Northflank provisions `public` under a database-owner role while the injected application role can create objects inside that schema but cannot create schemas at database scope. The baseline migration intentionally omits Prisma's redundant `CREATE SCHEMA IF NOT EXISTS "public"`; do not regenerate that statement into the baseline.
- Cap currently keeps short-lived challenge and verification-token state in backend memory. Run one API replica until shared Cap storage is configured; restarts invalidate outstanding CAPTCHA tokens without affecting application data.
- The repository-wide ESLint command exceeds the local time budget and reports a pre-existing LF/CRLF Prettier mismatch across touched legacy files. Semantic lint for the changed backend surface passes.
- Rate limiting uses the application's current throttler storage. Multi-instance deployments should use a shared throttler store if strict cross-instance limits are required.
- Keep organization online admissions disabled until each public offering, document checklist, applicant email template, object storage, and outbound email configuration has been reviewed.
