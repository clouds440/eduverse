# Online Admissions Deployment Readiness

Date: 2026-08-17

## Verdict

The implementation is code-ready for staging. Production rollout is conditional on applying the four Prisma migrations, passing release environment validation, and completing the isolated database e2e plus staging storage/email smoke tests.

## Final Audit Fixes

- Fixed multipart submissions with documents so the embedded JSON payload is parsed and validated before controller execution.
- Removed organization email templates and internal file storage metadata from public API payloads.
- Made student creation and online-admission linkage atomic, with idempotent final notification retry behavior.
- Revoked document-update tokens whenever an application becomes admitted.
- Prevented document requirement replacement after applications exist for an offering.
- Replaced `Math.random()` references with cryptographic randomness and keyed source-IP fingerprints.
- Aligned document requirement limits with the middleware maximum of 20 files and 50 MB per file.
- Added `HUMAN_VERIFICATION_SECRET` to environment documentation and production validation guidance.

## Verification Completed

- Backend unit tests: 58 suites, 251 tests passed.
- Focused admissions/security/environment tests: 8 suites, 36 tests passed in the final rerun.
- Backend TypeScript compile: passed.
- Backend production build: passed.
- Frontend production build: passed, including all public and admin admissions routes.
- Prisma schema validation: passed.
- Focused semantic ESLint check: passed with Prettier disabled to avoid the repository's existing CRLF formatting mismatch.
- `git diff --check`: passed.

## Required Release Steps

1. Back up the target PostgreSQL database.
2. Set `NODE_ENV=production` and configure `DATABASE_URL`, `JWT_SECRET`, `HUMAN_VERIFICATION_SECRET`, `FRONTEND_URL`, `CLOUDINARY_URL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
3. Run `npm run release:env-check` from `backend`.
4. Run `npm run release:migrate` from `backend` before starting the new backend release.
5. Build and deploy backend and frontend from the same revision.
6. Run `npm run online-admissions:e2e` against an isolated local or CI PostgreSQL instance.
7. In staging, submit an application with required files, request missing documents, use the email update link, reject one application, and convert another to a student.
8. Confirm Cloudinary upload/download/delete behavior and Resend delivery before enabling online admissions for production organizations.

## Known Operational Notes

- The database e2e suite is implemented but was not completed in this workspace at the operator's request. Its runner refuses non-local PostgreSQL hosts by design.
- The repository-wide ESLint command exceeds the local time budget and reports a pre-existing LF/CRLF Prettier mismatch across touched legacy files. Semantic lint for the changed backend surface passes.
- Rate limiting uses the application's current throttler storage. Multi-instance deployments should use a shared throttler store if strict cross-instance limits are required.
- Keep organization online admissions disabled until each public offering, document checklist, applicant email template, object storage, and outbound email configuration has been reviewed.
