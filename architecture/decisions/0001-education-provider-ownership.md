# ADR 0001: Education Provider Ownership

- Status: Accepted for implementation
- Date: August 19, 2026
- Scope: Programs and online admissions redesign

## Context

Programs, offerings, submissions, requirements, and files currently require an EduVerse Campus `Organization`. A future education provider may need to publish a course and receive applications without adopting Campus. Reusing an educator ID as `organizationId`, adding polymorphic IDs, or making organization relations broadly nullable would remove referential integrity and weaken tenant isolation.

## Decision

Introduce `EducationProvider` as the required owner of catalog and admissions records.

- Every Campus Organization is linked to one provider.
- A provider may exist without an Organization.
- Catalog and admissions authorization uses `providerId`.
- Campus operational records retain strict `organizationId` relations.
- Existing organization roles are adapted to provider capabilities during migration.
- Direct provider memberships are added for future standalone owners.

## Consequences

- Provider ownership is required from the first write in a clean database.
- Standalone providers do not need fake organizations, departments, cycles, or administrators.
- Services must validate provider/organization consistency while both ownership fields exist.
- Public file ownership and reviewer authorization must become provider-aware.

## Rejected Alternatives

- Store educator IDs in `organizationId`.
- Use `ownerType + ownerId` without foreign keys.
- Make all Organization relations optional.
- Create hidden fake Organizations for standalone providers.
