**Detailed Phase Plan**

**Phase 0: Baseline Check**

- Confirm current branch state with `git status`.
- Run quick baseline validation before edits:
  - `npx prisma validate`
  - `npx prisma generate`
  - backend build/tests where feasible
  - frontend build/typecheck where feasible
- Purpose: separate existing failures from feature regressions.

**Phase 1: Architecture Characterization**

- Trace current behavior in:
  - `backend/prisma/schema.prisma`
  - `backend/src/courses/courses.service.ts`
  - `backend/src/sections/sections.service.ts`
  - `backend/src/assessments/assessments.service.ts`
  - `backend/src/gpa/gpa.service.ts`
  - `backend/src/transcripts/transcripts.service.ts`
  - `backend/src/academic-cycles/academic-cycles.service.ts`
  - `backend/src/academic-cycle-archives/academic-cycle-archives.service.ts`
  - frontend course/section/grade/transcript pages
- Document the current flow:
  - `Assessment` belongs to one `Section`
  - `Grade` belongs to assessment + student
  - gradebook computes per-section weighted percentage
  - transcript reads `EnrollmentHistory`
  - transcript only uses `FINALIZED` grades
  - transcript currently treats each section as a GPA course input
  - `GpaService` maps percentage to letter grade/GPA using cycle policy snapshot
- Gate: no implementation until this flow is confirmed in code and tests.

**Phase 2: Database Model**

- Add a thin aggregation layer above sections.
- Proposed Prisma models:
  - `CourseResultScheme`
    - `id`
    - `organizationId`
    - `courseId`
    - `academicCycleId`
    - `name`
    - `status`
    - `createdById`
    - timestamps
  - `CourseResultComponent`
    - `id`
    - `schemeId`
    - `componentType`: `THEORY | LAB`
    - `label`
    - `weight`
    - `sortOrder`
  - `CourseResultComponentSection`
    - `id`
    - `componentId`
    - `sectionId`
- Why this model:
  - sections remain independent
  - no parent/child section relationship
  - supports multiple theory/lab sections in one course/cycle
  - student aggregation uses the student’s own enrolled component sections
- Constraints/indexes:
  - unique scheme per `organizationId + courseId + academicCycleId`
  - unique component type per scheme
  - unique section assignment per scheme
  - indexes on org, course, cycle, section
- Gate: Prisma validates and generated client compiles.

**Phase 3: Backend Configuration API**

- Add DTOs for scheme create/update:
  - components with `componentType`, `weight`, `sectionIds`, optional label/sort order
- Add service, likely `backend/src/course-result-schemes`.
- Endpoints under existing org API style:
  - `GET /org/courses/:courseId/result-schemes?academicCycleId=...`
  - `PUT /org/courses/:courseId/result-schemes/:academicCycleId`
  - maybe `DELETE /org/course-result-schemes/:id`
- Validation:
  - caller must be `ORG_ADMIN` or `SUB_ADMIN`
  - department scope must include course
  - cycle must belong to org
  - cycle must be writable for setup
  - all sections belong to same org/course/cycle
  - weights total exactly `100`
  - no duplicate component type
  - no duplicate section across components
  - reject edits if finalized dependent grades already exist, unless current academic-cycle policy allows correction
- Gate: config APIs pass unit/integration tests.

**Phase 4: Section Safety Rules**

- Extend section update/delete protections:
  - prevent moving a section’s `courseId` or `academicCycleId` if it is part of a result scheme
  - prevent hard delete of a section linked to a scheme
  - allow close/archive behavior consistent with current section lifecycle
- Add scheme metadata to section/course reads as optional fields where useful.
- Gate: existing section behavior remains unchanged for unlinked sections.

**Phase 5: Result Aggregation Service**

- Create a reusable backend helper/service, for example `CourseResultAggregationService`.
- Input:
  - finalized per-section student result data
  - course/cycle result schemes
  - current enrollment history
  - GPA policy snapshot
- Output:
  - normal course rows for courses without schemes
  - aggregated course rows for configured Theory/Lab courses
  - component breakdown rows for transcript display
- Rules:
  - theory/lab section result calculation remains unchanged
  - aggregate only sections the same student is actually enrolled in/history-linked to
  - if required component missing, mark aggregate incomplete or `N/A`
  - do not combine another student’s lab result
  - one GPA course input per final course result
- Gate: aggregation unit tests cover 75/25, 70/30, missing lab, mismatched cycle, duplicate component enrollment.

**Phase 6: Transcript Integration**

- Modify `backend/src/transcripts/transcripts.service.ts`.
- Current section map should first compute independent section results exactly as now.
- Then transform transcript rows:
  - no scheme: keep current section row
  - scheme: group component sections into one course-level row
  - attach optional `components`
- Example backend DTO shape:
  - `resultKind: 'SECTION' | 'COMPONENT_AGGREGATE'`
  - `totalPercentage`
  - `letterGrade`
  - `gradePoints`
  - `qualityPoints`
  - `components: [{ componentType, label, weight, sectionId, sectionName, totalPercentage, letterGrade }]`
- Feed only final aggregate rows into `GpaService.calculateCourses`.
- Gate: normal non-lab transcript output remains compatible.

**Phase 7: Historical Consistency**

- Inspect finalized-grade and archive behavior before deciding final persistence.
- Preferred rule:
  - block scheme/weight edits after finalized grades exist for any linked section in the cycle
  - archive should include component scheme/config snapshot
- If mutable corrections are already allowed, persist enough scheme metadata in archive/read model so old transcripts do not silently change.
- Gate: test that changing live config cannot alter finalized/published transcript behavior.

**Phase 8: Frontend Admin UI**

- Add admin configuration UI near course or section management.
- Likely files:
  - `frontend/app/(org)/courses/page.tsx`
  - maybe course detail/modal components if present
  - `frontend/app/(org)/sections/page.tsx`
  - `frontend/components/sections/SectionFormPage.tsx`
  - `frontend/lib/api.ts`
  - `frontend/types/index.ts`
- UI behavior:
  - choose academic cycle
  - enable Theory/Lab result scheme
  - select sections for Theory and Lab
  - set weights with numeric inputs
  - show validation total
  - preserve normal section creation/editing
- Gate: frontend build/typecheck passes.

**Phase 9: Transcript UI/PDF**

- Extend transcript page and PDF rendering:
  - overall row shows final course result
  - component rows show Theory/Lab breakdown underneath
- Files:
  - `frontend/app/(org)/transcripts/page.tsx`
  - `frontend/lib/pdf/transcript.ts`
  - `frontend/types/index.ts`
- Keep old transcript rows working when `components` is absent.
- Gate: transcript for normal course visually unchanged; lab course shows breakdown.

**Phase 10: Tests**

- Backend tests:
  - scheme validation
  - section lock behavior
  - transcript aggregation
  - GPA input uses aggregate not both component sections
  - historical/finalized edit blocking
- Frontend tests/build:
  - typecheck
  - build
  - targeted component checks if existing test pattern supports it
- Verification commands:
  - `npx prisma validate`
  - `npx prisma generate`
  - backend tests/build
  - frontend build/typecheck
  - relevant lint if configured

**Phase 11: Final Critique Before Implementation**

- Confirm:
  - independent sections preserved
  - no nested lab section
  - no duplicate grading engine
  - no fake records for normal courses
  - no cross-student aggregation
  - no cross-cycle aggregation
  - finalized records protected
  - Program/Cohort/Cycle mappings still respected

**Implementation Order**

1. Prisma models and generated client.
2. Backend scheme service/endpoints.
3. Section/course safety validation.
4. Aggregation service.
5. Transcript service integration.
6. Frontend API/types.
7. Admin configuration UI.
8. Transcript UI/PDF.
9. Tests and verification.
