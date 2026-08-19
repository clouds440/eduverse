# ADR 0003: Separate Public Offering From Campus Delivery Binding

- Status: Accepted for implementation
- Date: August 19, 2026
- Scope: Program offerings and online admissions

## Context

The current `ProgramOffering` simultaneously represents a public application intake and a Campus delivery instance. It requires an Academic Cycle and Curriculum Version, while public applicants need delivery mode, location, fees, eligibility, dates, and application configuration.

## Decision

Use `ProgramOffering` as the provider-owned intake/enrollment opportunity and attach optional Campus delivery data through `CampusProgramOfferingBinding`.

- Public offering data does not require an Academic Cycle or curriculum.
- Campus binding references Organization, Academic Cycle, and Curriculum Version.
- Public admissions readiness and Campus delivery readiness are separate policies.
- Campus Student conversion is available only through a valid Campus binding.
- Existing offering IDs are preserved where practical.

## Consequences

- Standalone and Campus-backed offerings share one public/application contract.
- Delivery-mode variants no longer require fake cycles.
- Stage offering services must enforce the presence and consistency of a Campus binding.
- Provider-neutral public routes are canonical from the first release of the redesigned contract.

## Rejected Alternatives

- Make Academic Cycle and Curriculum nullable directly and scatter checks through current services.
- Maintain separate Campus and public offering tables with unrelated identities.
- Store public listing details only as unvalidated JSON.
