# ADR 0002: Separate Program Catalog From Campus Configuration

- Status: Accepted for implementation
- Date: August 19, 2026
- Scope: Programs redesign

## Context

The current `Program` requires a Campus Organization, Department, curriculum structure, progression rules, and Campus courses. Those requirements are valid for managed academic delivery but not for every degree, diploma, course, bootcamp, workshop, or tutoring product that admissions may list.

## Decision

Make `Program` the provider-owned educational product and move Campus-only academic policy behind optional `CampusProgramConfiguration`.

- Generic identity includes type, subject, credential, duration, language, and descriptive content.
- Campus configuration retains department, structure, progression, completion, passing, and attendance rules.
- Curriculum revisions, stages, and course requirements remain strict Campus models.
- Campus enrollment operations reject programs without a valid Campus configuration.
- Program creation does not configure admissions publication, forms, documents, fees, or application windows.

## Consequences

- Standalone programs become valid without Campus scaffolding.
- Existing Campus behavior is preserved through a binding rather than weakened with null checks.
- Program services must be split into catalog and Campus configuration responsibilities.
- Campus operational services resolve organization and department ownership through the configuration binding.

## Rejected Alternatives

- Keep one required Campus-shaped Program for every educational product.
- Create an unrelated marketplace-only program model.
- Infer Campus configuration from optional fields spread across Program.
