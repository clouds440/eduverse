# Frontend Renovation Master Plan

Date: 2026-05-28

Scope: `frontend/` source for the EduVerse Next.js application.

Primary goal: fully modernize the frontend while preserving backend behavior, API contracts, auth/session behavior, role permissions, data models, and business logic.

Hard exclusions:

- Do not renovate, restructure, or directly edit `frontend/components/chat/ChatLayout.tsx`.
- Do not renovate, restructure, or directly edit `frontend/components/ui/DashboardLayout.tsx`.
- Do not modify chat functionality. Routes that render chat are integration boundaries only.
- Preserve all existing backend flows and request/response contracts.
- Do not introduce `any` types.

Execution rule for agents:

- Execute one implementation phase at a time.
- Before editing in a phase, inspect affected files again because the worktree may have changed.
- `frontend/components/sections/AttendanceSheet.tsx` currently has local modifications. Any future phase touching attendance must read the file carefully first and avoid overwriting unrelated user work.
- Run `npm run build` after each implementation phase when practical. Run `npm run lint` and document existing failures if unrelated lint issues remain.

---

## Audit Sequence Required Before Implementation

This plan was created after the required inspection order below. Future implementation agents should repeat the same order in a scoped way before each phase.

### Phase 0 - Full Frontend Audit

Inspected:

- All `frontend/app/**/page.tsx` routes.
- Root layout, org layout, admin layout, `Navbar`, `DashboardMainWrapper`, providers, global CSS, Tailwind config, Next config.
- Navigation patterns for public, auth, admin, org, finance, mail, and chat routes.

Key findings:

- The app is a Next 16 / React 19 frontend with Tailwind 4, SWR, React Hook Form, Zod, Recharts, Socket.IO, markdown tooling, and PWA helpers.
- Most app routes are client components, including many data-heavy tables and detail pages.
- Public/auth pages use marketing-style visuals, large blur/gradient layers, and glass surfaces. Dashboard pages also inherit some of that decorative styling, which makes operational areas feel heavier than necessary.
- Root layout mounts large animated blur backgrounds globally, including on data-heavy authenticated pages.
- `DashboardLayout.tsx` is central to navigation and scroll behavior, but it is excluded from renovation. Improvements must work around it using page shells, wrappers, and non-invasive integration.
- Several routes use URL query state for search, pagination, filters, sort, and selected records. The pattern is duplicated across many pages.
- The app already has some PWA/viewport handling, back stack behavior, safe-area handling, service worker assets, and push helpers.

### Phase 1 - Component System Audit

Inspected:

- `Button`, `Input`, `Textarea`, `Card`, `Badge`, `Modal`, `ModalForm`, `DataTable`, `Pagination`, `Drawer`, `CustomSelect`, `CustomMultiSelect`, `SearchBar`, `Loading`, `Skeleton`, `ErrorState`, `Toast`, `FormLayout`, `TableActions`, `Brand`, upload and markdown components.

Key findings:

- Shared components exist, but many primitives carry heavy visual defaults: `rounded-2xl`, `rounded-3xl`, large shadows, gradients, blur, animated hover lift, and oversized spacing.
- `Button`, `Input`, `SearchBar`, `Card`, `Modal`, and select controls have styling baked directly into components instead of using a clear token contract.
- `DataTable` has a useful mobile-card fallback, sorting, pagination, loading overlay, row expansion, and column resizing. It needs stronger empty/error state integration, stable mobile density rules, and accessibility refinements.
- `Drawer` behaves more like an anchored popover than a true mobile drawer; it lacks an overlay, focus management, and full-height mobile behavior.
- `CustomSelect` and `CustomMultiSelect` use portals and positioning logic, but keyboard/listbox semantics should be strengthened.
- `Modal` has a portal, body lock count, and back-stack integration, but lacks a complete focus trap, Escape/backdrop interaction policy, and consistent full-screen mobile mode.
- `FormLayout` is a promising newer system and should become the preferred path for complex forms.

### Phase 2 - Forms / Modals / Utilities Audit

Inspected:

- React Hook Form/Zod forms, manual form pages, modal forms, confirmation dialogs, upload/crop flows, toast handling, markdown editor/renderer, SWR provider, query state patterns, auth/global/UI contexts.

Key findings:

- Student and teacher forms already use `FormLayout`, React Hook Form, Zod, structured sections, and strong typing.
- Older forms and modal flows still use ad hoc local state and repeated submit/error logic.
- Several complex CRUD edits are still in modals even when they involve multi-field forms, multi-selects, file upload, markdown, or enrollment changes.
- Confirmation dialogs remain useful for destructive or single-step decisions.
- Loading, empty, error, success, and disabled states exist, but implementation is inconsistent. Some pages return plain text errors while others use `ErrorState`.
- SWR is centralized for many keys, but finance pages and some detail flows bypass the global fetcher. Some pages fetch broad lists client-side, then sort/filter/paginate locally.
- Repeated helpers should be introduced only where they remove real duplication: query state, persistent page size, page headers, empty states, table toolbar, resource shell, and mutation feedback.

### Phase 3 - Page-Specific Custom Component Audit

Inspected representative high-impact pages and custom components:

- Admin organizations, platform admins, audit logs.
- Org students, teachers, sections, courses, cohorts, academic cycles.
- Attendance landing and section attendance workbook.
- Finance overview, entries, transactions, structures.
- Org settings, mail page, public landing, auth, contact, docs.
- Section-level `AssessmentList`, `CourseMaterials`, `SectionSchedules`, and large student profile subcomponents.

Key findings:

- Record-list pages share the same real workflow but reimplement filters, URL state, page-size persistence, wrapper surfaces, and action placement.
- Students/teachers/sections pages already have a similar table-plus-toolbar layout, making them good first targets for shared page scaffolding.
- Admin organizations has high business value and high visual/interaction complexity: tabs, filters, details modal, mail compose, status actions, markdown message templates.
- Settings is closer to the target design than many pages and can become a reference for form layout.
- Attendance has more modern mobile-first work in progress and should be treated carefully.
- Finance is functionally useful but visually lighter and less consistent with other modules. Entries/transactions/structures do client-side sorting/pagination and plain error states.
- Mail is robust but modal-heavy; a dedicated thread route would improve deep linking and mobile orientation.
- Public/auth pages are polished but trend toward decorative visual layers, large gradients, and excessive radius/shadows.

---

## Frontend Inventory

### Stack And Shared Runtime

- Framework: Next.js app router.
- UI: React 19, Tailwind 4, `lucide-react`.
- Data: SWR with typed central fetcher plus some route-specific fetchers.
- Forms: React Hook Form, Zod, some manual state forms.
- Charts/content: Recharts, `marked`, Prism, Mermaid.
- Realtime: Socket.IO via `useSocket`.
- PWA: manifest, service worker, offline page, install prompt, push notification helpers.

### Layout Boundaries

- `frontend/app/layout.tsx`: root shell, global providers, navbar, app background, PWA prompt.
- `frontend/components/DashboardMainWrapper.tsx`: public vs dashboard scroll shell and route scroll reset.
- `frontend/app/(org)/layout.tsx`: org role navigation, org status overlays, verification banner, stats/socket refresh.
- `frontend/app/admin/layout.tsx`: admin navigation, stats/socket refresh.
- `frontend/components/ui/DashboardLayout.tsx`: excluded from direct renovation.
- `frontend/components/chat/ChatLayout.tsx`: excluded from direct renovation.

### Current Route Inventory

Public and auth routes:

| Route | Current role | Renovation strategy |
|---|---|---|
| `/` | Marketing homepage with dashboard mockups, multiple sections, gradients/blurs | Keep as public landing but reduce decorative layers, improve first viewport, preserve dashboard mockup as real product signal, tighten copy density |
| `/login` | Login form with device metadata and auth flow | Move to shared auth shell, reduce visual noise, improve mobile keyboard behavior and error placement |
| `/register` | Organization registration, logo upload, Zod validation | Reflow mobile-first, convert to clear step/section layout without changing payload |
| `/forgot-password` | Password recovery shell | Align with auth shell and feedback states |
| `/reset-password` | Reset form shell | Align with auth shell and verification states |
| `/contact` | Auth-gated support mail flow | Keep as page, improve logged-out gate, success state, and form hierarchy |
| `/docs` | Long static docs page with accordions | Convert to cleaner docs layout with mobile contents/nav and less repeated card styling |
| `/about`, `/pricing`, `/blog`, `/careers` | Public information pages | Standardize public page shell, section rhythm, typography, and CTAs |
| `/privacy`, `/terms` | Legal content | Keep restrained, readable, text-first, low-decoration |
| `/offline` | PWA offline fallback | Keep lightweight and brand-consistent |

Admin routes:

| Route | Current role | Renovation strategy |
|---|---|---|
| `/admin` | Redirect/entry | Keep behavior, no major UI |
| `/admin/organizations` | Main platform review table and organization actions | High-priority redesign using shared record-page shell, status segmented control, stronger details route/panel strategy |
| `/admin/platform-admins` | Platform admin CRUD table and modal form | Standardize record toolbar/table/actions; consider dedicated create/edit pages only if form complexity grows |
| `/admin/logs` | Audit logs table | Optimize scanability, filters, copy action, dense table presentation |
| `/admin/settings` | Admin settings | Align with settings/form shell |
| `/admin/change-password` | Password form | Align with auth/security form shell |
| `/admin/mail` | Mail page wrapper | Do not alter mail backend flow; share mail renovation with org mail |
| `/admin/chat` | Chat wrapper | Do not renovate chat functionality or `ChatLayout.tsx` |

Org operational routes:

| Route | Current role | Renovation strategy |
|---|---|---|
| `/overview` | Role-aware insights dashboard | Keep `InsightsOverview` data, reduce nested card feel, create compact dashboard metric/list patterns |
| `/students` | Student list, filters, mail action, deleted/alumni views | First record-page migration target; standardize toolbar, filters, mobile cards, empty states |
| `/students/add`, `/students/edit/[id]` | Student forms | Preserve API payloads; refine `FormLayout`, sticky actions, mobile section flow |
| `/students/[userId]` | Student portal with tabs/subcomponents | Improve tab orientation, mobile hierarchy, per-tab empty/loading states |
| `/teachers` | Teacher list, filters, mail action, deleted/emeritus views | Same record-page shell as students |
| `/teachers/add`, `/teachers/edit/[id]` | Teacher forms | Align with student form patterns; preserve permissions and manager rules |
| `/teachers/[userId]`, `/teachers/[userId]/profile` | Teacher dashboard/profile | Improve dashboard density and profile form orientation |
| `/courses` | Course list with edit modal | Use record-page shell; evaluate edit modal to edit page migration |
| `/courses/create` | Course create page | Align to shared form shell |
| `/cohorts` | Cohort list with edit modal and drawer filters | Use record-page shell; consider edit page for assignments |
| `/cohorts/create`, `/cohorts/[id]` | Cohort create/detail | Align form and detail pages with shared page shell |
| `/sections` | Section list with edit modal and enrollment changes | Strong candidate for edit modal to dedicated page |
| `/sections/create`, `/sections/[id]` | Section create/detail | Standardize form/detail and section tabs |
| `/sections/[id]/assessments/[assessmentId]` | Assessment grading detail | Improve grading table/mobile flow; keep bulk grading modal for batch action |
| `/course-materials/[id]` | Section material page wrapper | Renovate alongside `CourseMaterials` component |
| `/academic-cycles` | Cycle list with create/edit modal and confirm dialogs | Use record shell; keep activate/delete confirmations, consider page-based create/edit consistency |
| `/academic-cycles/create` | Cycle create page | Align with shared form shell |
| `/attendance` | Attendance section picker | Already closer to target; polish empty/loading/search |
| `/attendance/[sectionId]` | Attendance workbook | Preserve business logic; improve only after careful re-read of modified `AttendanceSheet.tsx` |
| `/grades` | Grade section picker | Align with attendance/schedules picker pattern |
| `/schedules` | Schedule overview | Standardize grouped list/card/table density |
| `/timetable` | Timetable view | Improve responsive schedule density and empty states |
| `/transcripts` | Transcript search/selection | Improve search, selection state, export/readability |
| `/promotions` | Promotion workflow | Preserve business logic; break into clear stepper-like page sections if needed |
| `/settings` | Org settings and sessions | Use as form-design reference; remove duplicated local section component if shared `FormSection` covers it |
| `/change-password` | Password form | Align with auth/security form shell |
| `/mail` | Mail list/detail modal | Move toward route-backed thread detail while preserving `MailPage` behavior |
| `/chat` | Chat wrapper | Excluded from renovation |

Finance routes:

| Route | Current role | Renovation strategy |
|---|---|---|
| `/finance` | Finance dashboard | Make operational dashboard denser, reduce gradient hero, improve loading/error |
| `/finance/structures` | Structures table and create/edit modal | Consider dedicated create/edit route or full-screen sheet for target selection |
| `/finance/entries` | Entries with tab filtering and payment modals | Keep claim/confirm as modals; improve tabs, table, mobile, plain error state |
| `/finance/transactions` | Immutable transaction table | Improve audit trail notice, filtering, date formatting, empty/loading states |

Page-level custom components:

| Component | Current role | Renovation strategy |
|---|---|---|
| `AssessmentList` | Section assessment CRUD, submissions, grading entry | Move create/edit to page or full-screen mobile sheet if fields grow; keep quick student submit modal where useful |
| `CourseMaterials` | Material list, upload/edit/view/delete | Consider upload/edit dedicated flow for file-heavy UX; standardize material cards |
| `SectionSchedules` | Section schedule CRUD | Keep modal for quick schedule edits if compact; improve validation and empty states |
| `AttendanceSheet` | Large attendance workbook | Preserve current logic; phase separately with high caution |
| `MailPage`, `MailDetailsModal`, `NewMailModal` | Mail list, detail, compose | Prefer route-backed detail page; compose can remain modal/sheet |

---

## Major UX/UI Problems Identified

1. Visual density is inconsistent.
   - Some dashboard pages are dense and table-oriented, while others use large card/hero treatments.
   - Many components default to large radius, heavy shadow, gradients, and blur even in operational contexts.

2. Public page aesthetics bleed into app surfaces.
   - Global background effects and glass utilities make data-heavy pages feel less stable and less professional.
   - Auth/public pages use decorative blurred shapes and grid overlays heavily.

3. Information architecture is uneven.
   - Record pages repeat search, filters, status toggles, page-size storage, sort, and actions with small differences.
   - Some pages bury important filters in popover-like drawers with no persistent active-filter summary.
   - Detail views are often modal-based, which weakens orientation and deep linking.

4. Mobile-first behavior is partial.
   - `DataTable` has mobile cards, but toolbars, filters, modals, drawers, and finance tabs are not consistently mobile-native.
   - Some mobile flows still feel like scaled desktop layouts.

5. Feedback states are inconsistent.
   - There are good skeletons and `ErrorState`, but several pages still show plain text loading/errors.
   - Empty states are often generic or absent.
   - Success state patterns differ between forms, toasts, and modal submissions.

6. Performance risks are visible.
   - Many client components are large.
   - Heavy markdown/editor/chart/PWA code can affect pages that do not always need it.
   - Large animated blur layers are globally mounted.
   - Some routes fetch full lists and sort/filter client-side.

7. Accessibility needs a systematic pass.
   - Custom selects, drawers, modals, icon-only table actions, and toast/live regions need stronger semantics.
   - Focus trapping and Escape behavior should be consistent.
   - Touch targets are often adequate but visual spacing varies.

---

## Proposed Architecture Improvements

Add only low-level reusable pieces that remove clear duplication:

| Improvement | Proposed location | Reason |
|---|---|---|
| `PageShell` | `frontend/components/ui/PageShell.tsx` | Standard page width, padding, gap, scroll-safe structure |
| `PageHeader` | `frontend/components/ui/PageHeader.tsx` | Standard title, subtitle, status badges, primary/secondary actions |
| `Toolbar` / `ResourceToolbar` | `frontend/components/ui/Toolbar.tsx` | Consistent search, filters, active-filter chips, view controls |
| `EmptyState` | `frontend/components/ui/EmptyState.tsx` | Replace repeated generic empty text |
| `StatusBanner` | `frontend/components/ui/StatusBanner.tsx` | Consistent warning/error/success/info banners |
| `useUrlQueryState` | `frontend/hooks/useUrlQueryState.ts` | Remove duplicated URLSearchParams update code |
| `usePersistentPageSize` | `frontend/hooks/usePersistentPageSize.ts` | Remove repeated localStorage page-size code |
| `useMutationFeedback` | `frontend/hooks/useMutationFeedback.ts` | Normalize processing IDs, toasts, mutate, and errors |
| `RecordPageShell` | `frontend/components/ui/RecordPageShell.tsx` | Only if at least 3 record pages need the same layout |
| `ModalPolicy` docs | `frontend/FRONTEND_RENOVATION_MASTER_PLAN.md` or follow-up | Prevent modal sprawl and nested flows |

Architectural guardrails:

- Keep API wrapper signatures and backend payloads unchanged unless backend work is explicitly requested later.
- Do not add a large design-system package. Use existing Tailwind/CSS variables and small primitives.
- Prefer composition over deep generic abstractions.
- Keep table/data state typed and resource-specific where business rules differ.
- Avoid changes that require modifying `DashboardLayout.tsx`.

---

## Design System Improvements

### Visual Direction

Target feel: premium, structured, fast, operational, mobile-first, and restrained.

Standards:

- Cards: use 8px radius by default for operational repeated items. Larger radius only for modals or major public hero surfaces.
- Shadows: subtle by default. Use strong elevation only for overlays and focused popovers.
- Gradients: avoid routine use in dashboards. Keep gradients limited to public hero/brand moments.
- Blur/glass: avoid on data-heavy app surfaces except nav overlays or deliberate modal backdrops.
- Typography: reserve hero-scale type for public hero pages only. Dashboard pages use compact H1/H2 and strong table/list hierarchy.
- Spacing: use smaller, consistent mobile-first spacing. Increase only where the viewport and content justify it.
- Color: keep the brand primary as accent, not a full-page wash. Avoid one-note purple/blue dominance.

### Token Contract

Foundation phase should define and document:

- Surface tokens: page, panel, raised, inset, overlay.
- Text tokens: primary, secondary, muted, danger, success, warning, info.
- Border tokens: default, subtle, strong, focus.
- Radius tokens: `sm`, `md`, `lg`, `xl`, `full`, with operational default at `lg` or below.
- Shadow tokens: none, sm, md, overlay.
- Motion tokens: 120ms, 180ms, 240ms, reduced-motion no-op.

### Component Standards

- Buttons use size variants and icon positions instead of ad hoc `px` and `py` props.
- Inputs, textareas, selects, and search fields share height, radius, focus, disabled, and error states.
- Tables use consistent mobile card rules, empty states, loading skeletons, and action grouping.
- Toolbars expose active filters on mobile and desktop.
- Modals become full-screen or bottom-sheet style on mobile when content is complex.
- Drawers behave like drawers on mobile and popovers on desktop only when the interaction is small.

---

## Component Refactor Strategy

Refactor shared primitives before touching pages:

1. Create a compatibility layer.
   - Keep old props working where possible.
   - Add variants/sizes gradually.
   - Avoid breaking every caller in one commit.

2. Stabilize primitives in this order:
   - `Button`
   - `Input` / `Textarea` / `Label`
   - `Badge`
   - `Loading` / `Skeleton` / `ErrorState` / new `EmptyState`
   - `Modal` / `ConfirmDialog` / `ModalForm`
   - `CustomSelect` / `CustomMultiSelect`
   - `SearchBar`
   - `DataTable` / `Pagination` / `TableActions`
   - `Card` and dashboard metric/list primitives

3. Replace repeated page wrappers only after the primitive behavior is stable.

4. Keep `FormLayout` as the baseline for complex form pages.

5. Do not refactor chat components.

---

## Modal-To-Page Migration Recommendations

Keep modals for:

- Destructive confirmations.
- Single-decision state changes such as approve, reject, suspend, activate, restore, confirm.
- Short, low-risk forms with under 4 fields.
- Quick payment claim/confirmation if the user benefits from staying in context.
- Read-only "peek" details where no deep link is needed.

Migrate or strongly consider migrating to dedicated pages:

| Current modal/flow | Recommendation | Reason |
|---|---|---|
| Section edit in `/sections` | Move to `/sections/[id]/edit` or `/sections/[id]/settings` | Editing identity, course/cycle/cohort, room, and enrollments is too complex for a modal |
| Course edit in `/courses` | Consider `/courses/[id]/edit` | Existing create page suggests symmetry; descriptions can grow |
| Cohort edit in `/cohorts` | Move to dedicated edit page if assignments remain in form | Student/section assignment benefits from full viewport and route history |
| Academic cycle create/edit modal | Prefer page consistency if cycle details expand | Existing `/academic-cycles/create` already exists |
| Assessment create/edit in `AssessmentList` | Prefer dedicated assessment create/edit page for teachers | File/link/submission settings and grading context need orientation |
| Course material upload/edit | Prefer dedicated upload/edit route or full-screen mobile sheet | File upload, video link, metadata, and view/edit modes are too dense for small modals |
| Finance structure modal | Consider dedicated create/edit page | Target user selection and recurring billing deserve more space |
| Mail details modal | Migrate toward route-backed `/mail/[mailId]` or split detail route | Improves deep linking, browser back, mobile reading, and notification routing |
| Global `DataViewModal` | Keep for quick read-only details | It is useful when action complexity is low |
| Chat modals | Do not modify | Chat is excluded |

---

## Performance Optimization Plan

1. Reduce global visual work.
   - Remove or disable large animated blur backgrounds on authenticated dashboard routes.
   - Keep reduced-motion handling.
   - Ensure public pages still have a branded first viewport without heavy compositing.

2. Split heavy client code.
   - Lazy-load `MarkdownEditor`, Mermaid/Prism-heavy markdown rendering, chart components, image cropper, and PWA install prompt where possible.
   - Keep chat excluded from renovation.

3. Normalize SWR use.
   - Prefer central SWR fetcher keys for app data.
   - Avoid duplicate manual fetches when SWR data already exists.
   - Keep `keepPreviousData` for table transitions.
   - Document keys before changing cache invalidation.

4. Reduce client-side full-list processing.
   - Keep current backend contracts.
   - Where endpoints are unpaginated, memoize sorting/filtering and avoid unnecessary recompute.
   - Where paginated endpoints already exist, use server params consistently.

5. Make tables stable.
   - Avoid layout shifts in table headers, rows, mobile cards, pagination, and loading overlays.
   - Consider virtualization only if server pagination cannot protect large views.

6. Improve asset behavior.
   - Use stable dimensions for logos, avatars, and public assets.
   - Prioritize only true above-the-fold assets.
   - Lazy-load noncritical public visuals and dashboard charts.

7. Verify route classes.
   - Public/auth: first contentful paint, LCP, CLS, mobile keyboard.
   - Admin/list pages: idle CPU/network, table scroll, filter changes.
   - Finance/attendance: interaction responsiveness.
   - Mail: list-to-detail transition and attachment-heavy threads.

---

## Accessibility Improvements

Minimum standards:

- Every interactive icon-only button has an accessible name.
- Modal, drawer, select, and menu controls support keyboard use.
- Modals trap focus, restore focus, and close through Escape/back behavior according to a shared policy.
- Custom select/multi-select use listbox/option semantics or an accessible equivalent.
- Toasts use a live region with an appropriate politeness level.
- Errors are associated with fields through `aria-describedby` where practical.
- Disabled/read-only states are visually and semantically distinct.
- Focus rings are visible and consistent.
- Touch targets are at least 44px where possible on mobile.
- Respect `prefers-reduced-motion`.
- Verify org-custom primary colors remain readable against surfaces.

---

## Ordered Implementation Phases

### Implementation Phase 1 - Foundation Safety And Visual Contract

Objective:

- Establish the renovation rules, token contract, page-shell direction, and non-invasive constraints before changing shared primitives.

Affected routes/components:

- `frontend/app/globals.css`
- `frontend/tailwind.config.js`
- `frontend/app/layout.tsx`
- `frontend/components/DashboardMainWrapper.tsx`
- Documentation files only if needed
- Exclusions remain untouched: `ChatLayout.tsx`, `DashboardLayout.tsx`

Reasoning:

- The current frontend mixes decorative public styling with operational app surfaces. A foundation pass prevents later pages from drifting into inconsistent visual choices.

Implementation notes:

- Define CSS variables for surfaces, text, borders, radius, shadows, and motion.
- Document operational default radius at 8px or less.
- Keep existing theme color behavior and org accent support.
- Reduce global animated background cost for dashboard routes without changing dashboard layout internals.
- Keep public pages visually branded, but do not make root layout carry public decoration into every authenticated route.

Architectural considerations:

- Do not move routing or auth logic.
- Keep class changes additive and reversible.
- Avoid requiring changes in excluded layout components.

Incremental execution:

1. Add token definitions and comments.
2. Add a route-aware/global class strategy if needed.
3. Update only root-level visual background behavior.
4. Verify public, auth, org, and admin shells still render.

Risk:

- Medium. Root visuals touch all routes.

Estimated impact:

- UX: High
- Maintainability: High
- Performance: Medium

### Implementation Phase 2 - Shared Primitive System

Objective:

- Normalize core UI primitives while keeping callers compatible.

Affected routes/components:

- `Button`, `Input`, `Textarea`, `Label`, `Badge`, `Card`
- `Loading`, `Skeleton`, `ErrorState`, new `EmptyState`, optional `StatusBanner`
- `Toast`

Reasoning:

- Most visual inconsistency originates in shared primitives with heavy hardcoded styles.

Implementation notes:

- Add `size` and `variant` props where missing.
- Reduce default radius/shadow.
- Keep old props like `loadingId`, `loadingText`, and icon support during transition.
- Add accessible names for icon-only paths.
- Make disabled, loading, active, and focus states consistent.

Architectural considerations:

- Maintain backward compatibility first; migrate call sites in later phases.
- Do not introduce a third-party UI kit.

Incremental execution:

1. Refactor `Button` with compatible defaults.
2. Refactor inputs and textareas.
3. Add `EmptyState` and improve `ErrorState`.
4. Lightly normalize `Badge`, `Card`, `Loading`, `Toast`.
5. Build and visually spot-check key pages.

Risk:

- Medium. These components are widely used.

Estimated impact:

- UX: High
- Maintainability: High
- Performance: Low

### Implementation Phase 3 - Overlay, Select, Table, And Feedback Systems

Objective:

- Make high-use interaction surfaces mobile-friendly, accessible, and consistent.

Affected routes/components:

- `Modal`, `ModalForm`, `ConfirmDialog`, `DataViewModal`
- `Drawer`
- `CustomSelect`, `CustomMultiSelect`
- `DataTable`, `Pagination`, `TableActions`, `SearchBar`

Reasoning:

- Tables, filters, selects, dialogs, and action buttons carry most daily workflows. Renovating pages before these systems would duplicate effort.

Implementation notes:

- Add focus trap and Escape handling to modals.
- Make mobile modals full-height or sheet-like for complex content.
- Turn `Drawer` into a true mobile filter panel while preserving desktop anchored behavior.
- Add active-filter display support to toolbars.
- Improve `DataTable` empty state, loading state, mobile detail density, and action semantics.
- Keep table API compatible.

Architectural considerations:

- Do not change business actions.
- Preserve `useBackStackEntry` behavior.
- Test portal positioning and scroll locking carefully.

Incremental execution:

1. Improve `Modal` and `ConfirmDialog`.
2. Improve `Drawer` as filter panel.
3. Improve selects keyboard/ARIA behavior.
4. Improve table feedback/action semantics.
5. Build and test at mobile and desktop widths.

Risk:

- Medium to high. Overlays and selects are subtle interaction surfaces.

Estimated impact:

- UX: High
- Maintainability: High
- Performance: Medium

### Implementation Phase 4 - Page Shells, Query State, And Record Toolbars

Objective:

- Remove repeated page scaffolding and URL-state logic from record-list pages.

Affected routes/components:

- New `PageShell`, `PageHeader`, `Toolbar` or `ResourceToolbar`
- New `useUrlQueryState`, `usePersistentPageSize`
- First adopters: `/students`, `/teachers`, `/sections`

Reasoning:

- Students, teachers, and sections repeat nearly identical patterns. They are ideal for proving shared systems without covering the whole app.

Implementation notes:

- Keep query parameter names stable.
- Keep localStorage page-size keys stable.
- Preserve table columns, API params, role rules, restore/delete/mail actions.
- Add active filter chips and clearer mobile filter summary.
- Use shared empty/error/loading states.

Architectural considerations:

- Keep hooks small and typed.
- Avoid a generic resource abstraction that hides business-specific behavior.

Incremental execution:

1. Build shell/hooks using existing pages as examples.
2. Migrate `/students`.
3. Migrate `/teachers`.
4. Migrate `/sections`.
5. Compare behavior with old query URLs and role flows.

Risk:

- Medium. Query-state regressions can affect navigation and saved links.

Estimated impact:

- UX: High
- Maintainability: High
- Performance: Low to medium

### Implementation Phase 5 - Navigation And Flow Orientation

Objective:

- Improve user orientation and flow clarity without editing excluded layouts.

Affected routes/components:

- `Navbar`
- `DashboardMainWrapper`
- `app/(org)/layout.tsx`
- `app/admin/layout.tsx`
- Page-level headers and breadcrumbs/status banners
- Do not edit `DashboardLayout.tsx`

Reasoning:

- Navigation clarity depends on page headers, route context, status banners, and mobile flow, not only the sidebar. Since `DashboardLayout.tsx` is excluded, page-level orientation must do the work.

Implementation notes:

- Add consistent page headers to major pages.
- Make org status/contact verification/read-only messages compact and task-oriented.
- Add page-level breadcrumb/back affordances where users enter deep flows.
- Keep navbar public/auth/app behavior stable.
- Improve mobile orientation when entering detail routes.

Architectural considerations:

- Avoid conflicting with active-link logic inside `DashboardLayout.tsx`.
- Do not add nested navigation stacks.

Incremental execution:

1. Define page header and status banner patterns.
2. Apply to admin list pages.
3. Apply to org record pages.
4. Apply to detail/form pages.
5. Verify mobile back behavior.

Risk:

- Medium. Layout spacing can conflict with dashboard scroll containers.

Estimated impact:

- UX: High
- Maintainability: Medium
- Performance: Low

### Implementation Phase 6 - Modal-To-Page Flow Cleanup

Objective:

- Move complex modal flows to dedicated pages only where UX improves, while keeping quick modals where they are faster.

Affected routes/components:

- `/sections`, `/sections/[id]`, new section edit route if implemented
- `/courses`, `/cohorts`, `/academic-cycles`
- `AssessmentList`
- `CourseMaterials`
- `/finance/structures`
- `MailPage` and mail detail routing
- Do not touch chat modals

Reasoning:

- Complex modals reduce orientation, make mobile cramped, and weaken URL/back behavior. Dedicated pages help when a form has multiple sections, file upload, markdown, enrollment, or long selection.

Implementation notes:

- Start with section edit because it combines record identity and enrollment changes.
- Preserve modal confirmations for destructive actions.
- Preserve existing API payloads.
- Add redirects/back behavior from old entry points.
- Use route query compatibility if users have links with modal-style params.

Architectural considerations:

- Avoid deeply nested routes.
- Keep create/edit forms close to current module ownership.
- Do not migrate every modal mechanically.

Incremental execution:

1. Migrate one complex flow and validate.
2. Document pattern.
3. Apply to other complex flows based on value/risk.
4. Leave compact modals intact.

Execution pattern established:

- Section editing is the first modal-to-page migration target.
- Dedicated edit routes should preserve existing API payloads, mutation order, cache invalidation, and permission checks.
- List/detail entry points should pass a safe `returnTo` route so cancel/save behavior respects where the user came from.
- Keep destructive confirmations as modals; only move multi-step, multi-field, or selection-heavy flows to pages.

Risk:

- High. Flow migrations affect route history and user expectations.

Estimated impact:

- UX: High
- Maintainability: Medium to high
- Performance: Low

### Implementation Phase 7 - Admin And Record Page Redesigns

Objective:

- Modernize high-volume admin and management pages using the shared systems.

Affected routes/components:

- `/admin/organizations`
- `/admin/platform-admins`
- `/admin/logs`
- `/students`
- `/teachers`
- `/sections`
- `/courses`
- `/cohorts`
- `/academic-cycles`

Reasoning:

- These pages are core operational surfaces. Improving density, scanning, filters, and actions has high daily value.

Implementation notes:

- Use a consistent record page shell.
- Use segmented controls or tabs only when they represent meaningful states.
- Show active filters clearly.
- Standardize delete/restore/mail/action placement.
- Improve table mobile cards and empty states.
- Keep all API calls and role gates intact.

Architectural considerations:

- Admin organization actions are sensitive; preserve loading IDs and cache invalidation.
- Avoid batching unrelated record pages in one commit.

Incremental execution:

1. Admin logs as low-risk table refinement.
2. Platform admins.
3. Admin organizations.
4. Org courses/cohorts/academic cycles.
5. Org students/teachers/sections if not already migrated in Phase 4.

Risk:

- Medium to high depending on page.

Estimated impact:

- UX: High
- Maintainability: High
- Performance: Medium

Phase 7 execution status:

- Completed: `/admin/logs`, `/admin/platform-admins`, `/admin/organizations`.
- Completed: `/students`, `/teachers`, `/sections` through the earlier shared record-page migration.
- Completed: `/courses`, `/cohorts`, `/academic-cycles` catch-up pass with shared page shell, URL query state, persisted page size, active filters, empty states, and mobile table-card limits.
- Preserved: existing API calls, cache invalidation keys, role gates, confirm dialogs, and edit/create routes.

### Implementation Phase 8 - Academic, Attendance, And Student/Teacher Portals

Objective:

- Improve academic workflows and role portals while preserving grading, attendance, materials, and profile logic.

Affected routes/components:

- `/overview`
- `/attendance`, `/attendance/[sectionId]`
- `/grades`
- `/schedules`
- `/timetable`
- `/transcripts`
- `/promotions`
- `/sections/[id]`
- `/sections/[id]/assessments/[assessmentId]`
- `/students/[userId]` and its `_components`
- `/teachers/[userId]`, `/teachers/[userId]/profile`
- `AssessmentList`, `CourseMaterials`, `SectionSchedules`, `AttendanceSheet`

Reasoning:

- Academic flows carry the most business logic. They should be renovated after shared systems are stable.

Implementation notes:

- Treat attendance as high caution because `AttendanceSheet.tsx` has active local modifications.
- Keep grading and attendance calculations untouched unless a specific bug is found.
- Improve page headers, tab clarity, empty states, and mobile controls.
- Use compact metric/list primitives instead of large decorative cards.
- Keep bulk grading modal if it remains faster than a page.

Architectural considerations:

- Avoid refactoring calculations and rendering at the same time.
- Preserve role-specific read/write permissions.
- Verify teacher, student, manager, and org admin views separately.

Incremental execution:

1. Overview/insights visual shell.
2. Schedules/timetable/grades/transcripts/promotion page shells.
3. Section detail modules.
4. Student/teacher portal tabs.
5. Attendance workbook last, with extra verification.

Risk:

- High. Business logic density is high.

Estimated impact:

- UX: High
- Maintainability: Medium
- Performance: Medium

Phase 8 execution status:

- Completed: `/overview`, academic picker/workflow pages, schedules/timetable/transcripts/promotions shells, section detail modules, assessment grading detail, student/teacher portal tabs, and attendance surfaces.
- Preserved: grading and attendance calculations, role-specific read/write permissions, profile logic, attendance workbook behavior, and existing API payloads.
- Verified direction: Phase 9 should continue using shared page shells, compact operational cards, consistent empty/error/loading states, and mobile-first controls.

### Implementation Phase 9 - Finance, Mail, Settings, And Auth/Public Pages

Objective:

- Bring specialized flows into the same product language while respecting their distinct usage patterns.

Affected routes/components:

- `/finance`, `/finance/structures`, `/finance/entries`, `/finance/transactions`
- `/mail`, `/admin/mail`, `MailPage`, `MailDetailsModal`, `NewMailModal`
- `/settings`, `/change-password`, `/admin/change-password`, `SessionManagement`
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/`, `/docs`, `/contact`, `/about`, `/pricing`, `/blog`, `/careers`, `/privacy`, `/terms`

Reasoning:

- Finance and mail are high-value workflows with specific UX needs. Public/auth pages should be polished but not decorative-heavy.

Implementation notes:

- Finance: add consistent loading/error/empty states, compact stat cards, mobile tabs, and audit-friendly table layouts.
- Mail: preserve backend flow; consider route-backed detail pages for orientation.
- Settings: align local `SettingsSection` with shared `FormSection` if it reduces duplication.
- Auth: create shared auth shell and remove excessive blur layers.
- Public pages: keep product-focused assets, reduce repeated cards and large decorative backgrounds.

Architectural considerations:

- Mail has socket/stat side effects; preserve mutate and notification clearing.
- Auth forms must preserve device metadata and session behavior.
- Public pages should not import heavy dashboard-only code unnecessarily.

Incremental execution:

1. Finance.
2. Settings/security forms.
3. Mail route/detail improvements.
4. Auth shell.
5. Public pages.

Risk:

- Medium to high for mail/auth, medium for finance/public.

Estimated impact:

- UX: High
- Maintainability: Medium
- Performance: Medium to high

Phase 9 execution status:

- Completed first pass: finance overview, structures, entries, and transactions now use shared operational panels, compact summary cards, consistent empty/error/loading states, mobile tabs, and audit-friendly transaction tables.
- Next: settings/security forms, mail orientation/detail improvements, auth shell, and public pages.

### Implementation Phase 10 - Final Performance, Accessibility, And Polish

Objective:

- Verify the renovated frontend, remove remaining inconsistency, and optimize perceived performance.

Affected routes/components:

- All renovated frontend routes except excluded chat internals and excluded dashboard layout internals.
- `next.config.ts` only if asset/header changes are needed.
- `globals.css`, shared UI, providers, lazy imports.

Reasoning:

- Polish should follow functional renovation so it can optimize the real final surfaces.

Implementation notes:

- Run build and lint.
- Profile representative routes: `/`, `/login`, `/admin/organizations`, `/students`, `/attendance/[sectionId]`, `/finance`, `/mail`.
- Check mobile widths: 360px, 390px, 768px, 1024px, 1440px.
- Check PWA standalone safe-area and keyboard flows.
- Audit tab order, focus rings, Escape/back behavior, contrast, reduced motion, and text overflow.
- Remove unused local helper components only after pages are migrated.

Architectural considerations:

- Do not clean unrelated code in excluded files.
- Prefer measured optimizations over speculative rewrites.

Incremental execution:

1. Run automated checks.
2. Run visual/mobile QA.
3. Fix performance hotspots.
4. Fix accessibility gaps.
5. Remove obsolete code and update docs.

Risk:

- Low to medium. Cleanup can accidentally touch broad files if not scoped.

Estimated impact:

- UX: Medium to high
- Maintainability: High
- Performance: High

Phase 10 execution status:

- Started cleanup and verification pass after Phase 9.
- Fixed PWA install prompt recurrence by re-checking dismissal state on each install event, adding a 30-day dismissal cooldown, and persisting native prompt dismissals.
- Cleared non-chat lint warnings from shared selects, modal cleanup, offline queue, cohort/teacher/section cleanup, and stale academic imports.
- Preserved: `ChatLayout.tsx`, dashboard layout internals, backend contracts, chat functionality, and existing business logic.

---

## Risk Assessment Summary

| Phase | Main risk | Mitigation |
|---|---|---|
| 1 | Global visual changes affect all pages | Keep changes small, route-aware, and reversible |
| 2 | Primitive changes break many call sites | Maintain compatibility props and migrate gradually |
| 3 | Overlays/selects regress keyboard/mobile behavior | Test each interaction manually on mobile and desktop |
| 4 | Query-state bugs break saved links | Preserve param names and add before/after URL checks |
| 5 | Page headers conflict with dashboard scroll shell | Test in org/admin layouts at multiple widths |
| 6 | Modal-to-page migrations alter user flow | Migrate only complex flows with clear UX benefit |
| 7 | Admin actions are sensitive | Preserve loading IDs, role checks, mutation behavior |
| 8 | Academic logic is dense | Avoid logic changes; separate visual work from behavior |
| 9 | Mail/auth have side effects | Preserve sockets, notifications, device metadata, session flow |
| 10 | Cleanup touches too much | Scope cleanup to migrated code and verify build |

---

## Impact Expectations

| Area | Expected UX impact | Expected maintainability impact | Expected performance impact |
|---|---|---|---|
| Design tokens and primitives | High | High | Low |
| Data table and record shell | High | High | Medium |
| Modal-to-page migrations | High | Medium | Low |
| Navigation/orientation | High | Medium | Low |
| Academic workflow polish | High | Medium | Medium |
| Finance/mail redesign | High | Medium | Medium |
| Public/auth polish | Medium | Medium | Medium |
| Final lazy loading and visual cleanup | Medium | Medium | High |

---

## Verification Checklist Per Phase

Use this checklist after every implementation phase:

- `git status --short` reviewed before and after.
- Excluded files unchanged unless the user explicitly allowed it.
- Backend API contracts unchanged.
- Chat behavior untouched.
- No `any` types introduced.
- No obvious horizontal overflow at mobile widths.
- Touch targets remain usable.
- Loading, empty, error, success, and disabled states are present for changed flows.
- Build runs or failure is documented.
- Lint runs or pre-existing unrelated failures are documented.
- Role-based access checked for affected routes.
- Query params and browser back behavior checked for affected routes.

---

## Success Criteria

The renovation is complete when:

1. Public, auth, admin, org, finance, mail, academic, attendance, and portal routes follow a consistent product language.
2. Mobile layouts are first-class and do not feel like compressed desktop screens.
3. Operational pages are dense, scannable, and low-clutter.
4. Complex flows have dedicated pages where pages improve orientation, while quick modals remain quick.
5. Loading, empty, error, success, and disabled states are consistently available.
6. Heavy decorative work and unnecessary client work are reduced.
7. Shared components are reusable without being over-abstracted.
8. Accessibility basics are verified across custom controls and overlays.
9. Existing backend behavior, role permissions, and business logic continue to work.
10. `ChatLayout.tsx` and `DashboardLayout.tsx` remain unrenovated integration boundaries.
