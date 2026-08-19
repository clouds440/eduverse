# ADR 0004: Version Published Admissions Configuration

- Status: Accepted for implementation
- Date: August 19, 2026
- Scope: Forms, documents, fees, consent, and applications

## Context

The public application form is hard-coded, document requirements are mutable offering children, and answers are stored as unversioned JSON. An administrator must be able to improve a form without changing what an existing applicant was asked, accepted, or shown.

## Decision

Application forms and applicant-facing offering configuration are draftable and published as immutable versions.

- A server-owned schema allowlist defines supported form fields and validation.
- The backend validates answers against the exact published form version.
- Document requirements belong to a version and uploads snapshot their policy.
- Published offering versions snapshot fees, funding, eligibility, consent, and public details.
- Submissions reference the form and publication versions used at submission time.
- Additional document requests are separate records and do not mutate the original version.

## Consequences

- Historical submissions remain auditable and renderable.
- Preview and public rendering can share one schema renderer.
- Publishing requires validation and explicit readiness checks.
- Storage grows by immutable metadata versions but avoids destructive edits.

## Rejected Alternatives

- Continue storing only arbitrary `formData` without a schema reference.
- Mutate document requirements in place.
- Snapshot only labels while losing validation, consent, and fee context.
- Allow provider-supplied executable JavaScript or HTML in forms.
