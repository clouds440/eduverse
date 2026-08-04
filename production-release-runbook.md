# Production Release Runbook

## Purpose

This runbook certifies and deploys one immutable EduVerse release candidate. Feature work is frozen during this pass. Only release-blocking fixes may change the candidate, and every such fix requires the affected regression suite and the complete final gate to run again.

## Current Deployment Constraint

Run exactly one backend application replica for the initial release. Socket.IO rooms/presence and Nest throttling currently use process-local state. Multiple backend replicas require a separately tested shared Socket.IO adapter and distributed rate-limit store. Database connection pooling is configurable per instance, but it does not make process-local real-time state distributed.

## Required Owners

- Release owner: selects the exact commit and records go/no-go approval.
- Database owner: confirms backup, restore point, migration, and preflight output.
- Infrastructure owner: confirms domains, TLS, secrets, storage, health probes, logs, and rollback controls.
- UAT owner: completes the browser role/workflow matrix and records failures.

One person may hold multiple roles, but every item must have a named owner before production traffic is enabled.

## Release Candidate Freeze

- Record the commit SHA, release version, UTC build time, and image digests.
- Confirm the worktree used to build the candidate contains no uncommitted changes.
- Review the candidate diff for debug routes, console logging of sensitive payloads, temporary fixtures, demo accounts, and local URLs.
- Confirm `backend/prisma/migrations` contains the approved single clean init.
- Confirm `.dockerignore` excludes all `.env` files, dependencies, local builds, logs, uploads, and repository metadata.
- Build backend and frontend images from the repository root; never pass `DATABASE_URL` or another secret as a Docker build argument.

## Production Environment

Use [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example) as the variable inventory. Store real values in the deployment platform's secret manager, never in the repository or image.

Backend requirements:

- `NODE_ENV=production`
- PostgreSQL `DATABASE_URL` with production credentials and the provider's required TLS settings
- random `JWT_SECRET` of at least 32 characters
- exact comma-separated HTTPS origins in `FRONTEND_URL`; wildcard and implicit preview origins are not accepted
- `AUTH_COOKIE_SECURE=true` and an intentional `AUTH_COOKIE_SAME_SITE`/`AUTH_COOKIE_DOMAIN` combination
- `DATABASE_POOL_MAX` sized so all running instances and release jobs remain below the database connection limit
- production Cloudinary credentials and, when enabled, email, OAuth, push, AI, and billing credentials
- `BOOTSTRAP_SUPER_ADMIN=false` during ordinary startup

For first installation only, set `BOOTSTRAP_SUPER_ADMIN=true` with strong bootstrap credentials, start one backend instance, verify the account, and immediately return the flag and bootstrap password secret to disabled/removed state. The bootstrap is transaction-serialized, but it is not an ordinary seed mechanism.

Run inside the built backend artifact:

```bash
npm run release:env-check
```

Any error is a no-go. Missing optional integration warnings require either configured credentials or a written decision that the related feature is disabled for launch.

Frontend public variables are embedded during `docker build`; verify production HTTPS values before building. Changing a `NEXT_PUBLIC_*` value requires rebuilding the frontend image.

## Automated Certification

Run from a fresh checkout of the selected commit:

```bash
cd backend
npm ci
npm audit --omit=dev --audit-level=high
npm run prisma:validate
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
npm run programs:removed-fields-check
npm test -- --runInBand
npm run phase11:critical-api
npm run programs:restore-check
npm run build

cd ../frontend
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run build
```

Required results:

- no high/critical production dependency advisory
- all tests and critical API scenarios pass
- schema validates, migration status is current, and schema diff is empty
- populated preflight has zero blockers and `readyForRelease: true`
- backup/restore comparison has zero mismatches
- both production builds succeed
- no open P0/P1 or unaccepted P2 issue

Build the images only after those commands pass:

```bash
docker build --pull --tag eduverse-backend:<commit> -f Dockerfile .
docker build --pull --tag eduverse-frontend:<commit> -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.example.com .
```

Scan both images with the deployment platform's image scanner and record image digests. A mutable tag such as `latest` is not sufficient release evidence.

## Staging Dress Rehearsal

1. Provision a production-like staging database, storage account/folder, and exact domain/TLS topology.
2. Start from an empty database.
3. Start the single backend replica; its container runs `npm run release:migrate` before starting the application. Confirm migration success in the startup logs.
4. Enable bootstrap only long enough to create the initial staging platform administrator.
5. Start backend and frontend from the immutable candidate images.
6. Verify `/health/live` and `/health/ready`; only readiness may receive traffic.
7. Run `npm run programs:preflight` against staging.
8. Execute the critical API matrix against the deployed backend.
9. Create realistic departments, shared/standalone cycles, programs, curricula, courses, students, mapped/standalone delivery, grades, attendance, evidence, and archives.
10. Restart the services and verify database rows, archive checksums, files, sessions, and scheduled behavior remain intact.
11. Back up staging, restore into a separate database, and run preflight against the restored copy.
12. Record migration duration, startup duration, health transition time, archive duration, response timings, and restore duration.

## Manual Browser UAT

The UAT owner runs this section manually on desktop and mobile. Record pass/fail, tested role, browser, viewport, and issue ID for each failure.

- Organization admin: all department, cycle, program, curriculum, course, cohort, section, student, archive, and past-record operations.
- Assigned sub-admin: program reads and every permitted program write inside assigned departments.
- Unassigned sub-admin: denied program creation, metadata changes, lifecycle changes, cycle-array changes, curricula, stages, and requirements outside assigned departments.
- Sub-admin global-cycle restriction: institute-cycle create/update/status/delete and inline-new-cycle actions remain unavailable and denied.
- Teacher: assigned section, attendance, assessment, grading, answerbook reference/files, and denial outside assignments.
- Student: own major, cycle progress, grades, transcript, and released evidence only.
- Linked/unrelated guardians: linked historical/active reads succeed; unrelated reads and downloads fail safely.
- Finance manager: finance workflows work while academic structure/archive writes remain denied.
- Program creation: full scrolling, explanation blocks, validation, empty/add/reorder/remove stage behavior, department change reset, shared-cycle selection, course requirements, admissions toggle, error recovery, and mobile layout.
- Academic flow: shared cycles across programs, standalone delivery without inferred major, admission-derived main department, progression, transfer/withdrawal, archive, and every past-record search route.
- UI states: loading, empty, validation, conflict, permission denied, expired session, offline/retry, long names, and narrow viewport.

Any P0/P1 or unaccepted P2 result invalidates the candidate. Fixes require a new commit, rebuilt images, affected regression coverage, and a complete automated rerun.

## Production Deployment

1. Announce the release window and stop uncoordinated writes if the environment has started receiving real data.
2. Confirm database and file-storage backups and record their identifiers.
3. Validate production environment variables from the candidate backend image.
4. Deploy one backend replica. Its startup command applies pending Prisma migrations before starting NestJS; stop if migration execution fails.
5. Run `npm run programs:preflight`; stop on any blocker.
6. Wait for `/health/ready` before routing traffic.
7. Deploy the frontend image and verify asset/API/WebSocket origins.
8. Route traffic only after both services are healthy.
9. Run the post-deployment smoke tests below.
10. Watch authentication failures, 4xx/5xx rates, database pool utilization, archive failures, upload failures, latency, CPU, and memory through the observation window.

## Post-Deployment Smoke Test

- liveness and readiness probes return minimal successful responses
- platform and organization login/session refresh/logout work over HTTPS
- organization A cannot access an organization B identifier
- organization admin can read and update an allowed program
- assigned sub-admin can update its department program
- unassigned sub-admin receives a safe denial for the same operation
- public program offerings expose only the safe projection
- one non-destructive file upload/download path works
- WebSocket authentication and one notification event work
- logs and error tracking contain no credentials, tokens, answerbook contents, or student request bodies

Use a designated production verification organization. Do not create disposable records in a real academic organization.

## Rollback

Before real data exists, rollback may restore the previous image and recreate the empty database from the approved prior init. Once any real user or academic data exists, destructive database recreation is forbidden.

For a data-bearing system:

- stop traffic or affected writes
- preserve database and file backups
- roll back application images only when the previous application is schema-compatible
- otherwise keep the database intact and deploy a forward fix
- never mutate or roll back an archived cycle to a writable state
- rerun health checks, preflight, tenant/permission smoke tests, and archive verification after recovery

## Go/No-Go Record

- Commit SHA:
- Backend image digest:
- Frontend image digest:
- Migration ID/status:
- Database backup ID:
- File-storage backup ID:
- Automated gate result:
- Dependency audit result:
- Staging rehearsal result:
- Manual browser UAT result:
- Open risks/accepted P2 issues:
- Release owner approval and UTC time:
- Database owner approval and UTC time:
- Infrastructure owner approval and UTC time:
- UAT owner approval and UTC time:

Production is a no-go while any required field is blank.

The automatic migration startup is intentional for the initial single-replica Northflank deployment. Before enabling multiple backend replicas, move `npm run release:migrate` into a Northflank release job and override the application service command to `node dist/main.js` so migration ownership remains singular.
