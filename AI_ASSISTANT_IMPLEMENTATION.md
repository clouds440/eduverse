# EduVerse AI Copilot Implementation Plan

Status: Implementation in progress. Phases 0 through 21 are complete.

## Purpose

Introduce EduVerse AI Copilot as a premium productivity addon, not a generic chatbot.

The Copilot is a role-aware, permission-aware, schedule-aware, read-only assistant that helps each user work better inside EduVerse. It should feel like a contextual academic and operations copilot, backed by safe backend tools and existing EduVerse permissions.

The core split stays strict:

- Backend: Copilot brain, provider abstraction, permissions, subscriptions, AI Credits, tools, audit, docs retrieval, route awareness, schedule-aware context.
- Frontend: Copilot button, panel, markdown rendering, suggested prompts, navigation UX, subscription/settings UI, usage dashboards.

## Phase Status

- [x] Phase 0: Architecture baseline and module boundaries
- [x] Phase 1: Complete Copilot implementation plan and review
- [x] Phase 2: Premium addon persistence for org and personal subscriptions
- [x] Phase 3: AI Credits, role access policy, per-role monthly credit caps
- [x] Phase 4: Backend entitlement, credit accounting, and audit module
- [x] Phase 5: Org admin subscription, access policy, and settings APIs
- [x] Phase 6: Personal subscription and personal usage APIs
- [x] Phase 7: Minimal org admin subscription/settings UI
- [x] Phase 8: Organization and personal usage dashboards
- [x] Phase 9: Server-side docs and route search sources
- [x] Phase 10: Schedule-aware backend tools
- [x] Phase 11: Read-only academic, insights, evaluations, and finance tools
- [x] Phase 12: LangChain/provider abstraction
- [x] Phase 13: Global frontend Copilot shell
- [x] Phase 14: Role-specific Copilot home states and suggested prompts
- [x] Phase 15: Contextual follow-up and conversation memory
- [x] Phase 16: Streaming Copilot UX
- [x] Phase 17: Tests and rollout hardening
- [x] Phase 18: Cross-role performance intelligence tools and automatic Copilot context collection
- [x] Phase 19: Real LangChain/Gemini provider, Lemon Squeezy billing, and conversation retention cleanup
- [x] Phase 20: Separate AI usage, settings, and subscription flows
- [x] Phase 21: Public docs and TDD refresh for AI role capabilities and payment flows

## Current System Findings

- Backend is NestJS with global guards: throttling, JWT auth, roles, and access-level checks.
- `AccessLevel.READ` already supports read-only routes for restricted users.
- Domain services already contain useful scoped logic for courses, sections, insights, evaluations, finance, campus navigation, attendance, schedules, and organization settings.
- Department scope helpers already exist in `backend/src/common/department-scope.ts`.
- Common pagination, fuzzy search, and response utilities already exist in `backend/src/common/utils.ts`.
- Frontend is Next.js with global providers, central `api` wrapper, auth context, UI context, markdown renderer, route helpers, sidebar metadata, and reusable UI primitives.
- Docs search currently lives frontend-side in `frontend/app/docs/_data/docs.ts`; Copilot needs a backend-side docs source.
- There is no complete AI module yet, so boundaries can be introduced cleanly.

## Product Positioning

Do not frame this feature as "chatbot" in product UI.

Use:

- EduVerse AI Copilot
- Copilot
- Study Copilot for students
- Teaching Copilot for teachers
- Academic Operations Copilot for managers
- Admin Copilot for organization admins

Avoid:

- generic chatbot
- bot
- ask anything with no guardrails

The feature should emphasize productivity, planning, insight, schedule awareness, and role-specific guidance.

## Role-Specific Copilot Experience

The Copilot should adapt its tone, suggested actions, available tools, and default context by role.

### Student

Primary mode: study coach and personal academic planner.

Capabilities:

- study coach
- schedule-aware planner
- deadline assistant
- attendance advisor
- course guidance
- evaluation explanations
- personalized study plans
- weak-course explanation
- transcript and grade guidance where allowed

Examples:

- "What should I study today?"
- "What classes do I have tomorrow?"
- "Create a study plan around my schedule."
- "Why is my attendance at risk?"
- "Explain my weakest course."

### Teacher

Primary mode: teaching workload and preparation assistant.

Capabilities:

- morning briefing
- today's classes
- next class summary
- weekly schedule overview
- pending grading
- attendance reminders
- workload assistant
- teaching preparation suggestions
- students needing attention, using permitted academic signals only

Examples:

- "What do I teach next?"
- "Summarize my week."
- "What grading is pending?"
- "Which students need attention?"

### Manager

Primary mode: academic operations and department oversight assistant.

Capabilities:

- organization or department summary within scope
- workload analysis
- staffing concerns
- attendance trends
- evaluation trends
- schedule bottlenecks
- overloaded teacher detection
- academic activity summaries

Examples:

- "Summarize today's academic activity."
- "Show workload issues."
- "Which departments need attention?"
- "Identify scheduling bottlenecks."

### Org Admin

Primary mode: organization health, configuration, and AI operations assistant.

Capabilities:

- organization health
- AI usage
- AI Credits and estimated cost
- subscription management guidance
- feature configuration
- high-level operational insights
- role access policy review

Examples:

- "How much AI usage do we have left?"
- "Which roles are using Copilot most?"
- "Show organization health."
- "Should we enable Copilot for students?"

## Schedules as a Primary Data Source

Schedules must be a first-class Copilot data source, not an optional secondary tool.

Schedule-backed experiences:

- Student: classes today/tomorrow, study plan around class blocks, attendance risk around scheduled sessions.
- Teacher: next class, today's teaching blocks, weekly overview, schedule conflicts, preparation suggestions.
- Manager: overloaded teachers, undercovered sections, room/time bottlenecks, schedule density by department.
- Org Admin: organization-level schedule health and bottlenecks where useful.

Initial schedule tools:

- `getMyTodaySchedule`
- `getMyTomorrowSchedule`
- `getMyWeeklySchedule`
- `getNextClass`
- `getScheduleSummary`
- `getTeacherScheduleLoad`
- `getScheduleBottlenecks`

Tool rules:

- Use existing schedule/attendance/section services where possible.
- Never expose schedules outside existing role scope.
- Return compact DTOs with dates, times, sections, courses, teachers, rooms, and links.
- Avoid returning full schedules for entire organizations unless the role and scope allow it and the result is summarized.

## Non-Negotiable Rules

- Copilot is read-only forever.
- Copilot must never directly mutate data.
- Copilot must never bypass guards, role checks, org scope, department scope, student/guardian restrictions, or evaluation privacy rules.
- Copilot must never expose raw Prisma models.
- Copilot must never expose reviewer identity or raw confidential reviews.
- Copilot is disabled for unsupported users: suspended, deleted, alumni, emeritus, or any status not explicitly allowed.
- Personal AI subscriptions do not grant extra data access. They only unlock Copilot availability for the purchasing user.
- Frontend must not contain provider logic, tool policy, prompts, or domain-data assembly for Copilot answers.

## Subscription Model

Support two subscription sources.

### 1. Organization Subscription

Managed by `ORG_ADMIN`.

Organization subscription provides:

- monthly organization AI Credits
- role-based Copilot enablement
- per-role monthly credit caps
- organization usage dashboard
- estimated cost dashboard

The org admin can enable Copilot independently for:

- sub admins
- managers
- finance managers
- teachers
- students
- guardians

Important rules:

- If a role is disabled by org policy, users in that role cannot use org-funded Copilot.
- If the organization runs out of AI Credits, org-funded Copilot is unavailable to everyone.
- Users with personal subscriptions may continue using personal AI Credits, with normal permissions.
- Organization credits are used first when org access is enabled and credits are available.
- Personal credits are used only when org credits are unavailable, org access is disabled for that user, or the user chooses personal usage if that option is later exposed.

### 2. Personal Subscription

Managed by individual users.

Personal subscription provides:

- monthly personal AI Credits
- Copilot availability for the purchasing user only
- personal usage dashboard

Important rules:

- A personal subscription can unlock Copilot for a user even if the organization has disabled Copilot.
- A personal subscription can unlock Copilot for a user if the organization has no AI subscription.
- The user still only sees data permitted by their existing role and scope.
- The user never gains access to organization AI admin features unless they are already `ORG_ADMIN`.

## AI Credits Model

Avoid exposing provider tokens in product UI.

Use AI Credits as the user-facing quota unit.

Credit rules:

- Organization subscriptions receive monthly AI Credits.
- Personal subscriptions receive monthly AI Credits.
- Internally, AI Credits map to provider token usage and provider costs.
- Credit estimation can be approximate in v1.
- Provider tokens remain internal telemetry only.

Org admin controls:

- monthly credits per student
- monthly credits per teacher
- monthly credits per sub admin
- monthly credits per manager
- monthly credits per finance manager
- monthly credits per guardian

Usage priority:

1. Use organization credits first when the user is eligible for org-funded Copilot.
2. If org credits are exhausted or org role access is disabled, use personal credits if the user has an active personal subscription.
3. If neither source is available, block Copilot and explain why.

Limit behavior:

- Hard-limit plans block when credits reach zero.
- Soft-limit plans may allow overage if the subscription source supports it.
- Soft-limit overage must be visible in admin or personal dashboards.

## AI Dashboard Requirements

### Organization Dashboard

Visible to `ORG_ADMIN`.

Show:

- active organization plan
- current billing/credit period
- credits used
- credits remaining
- estimated monthly usage
- most active users
- AI usage trends
- feature/tool usage
- denied tool calls
- estimated cost
- role-level usage
- role-level credit caps
- overage state

### Personal Dashboard

Visible to each subscribed user.

Show:

- active personal plan
- current period
- credits used
- credits remaining
- estimated monthly usage
- recent personal Copilot usage

Do not show "most active users" or organization trends on the personal dashboard.

## AI Billing Process

AI subscription billing is separate from school finance payments.

School finance payments:

- Cover student fees, payroll, and other organization finance records.
- Use internal payment claims, staff verification, transactions, and finance audit logs.
- Do not unlock EduVerse AI Copilot.

AI subscription billing:

- Covers premium Copilot packages for organizations and individual users.
- Uses hosted checkout and a billing portal.
- Uses signed subscription webhooks to sync plan, status, credit period, monthly AI Credits, and billing portal links.
- Must not crash app startup when billing env values are missing. Checkout, portal, and webhook actions should fail with clear configuration errors instead.

Current provider implementation:

- Lemon Squeezy hosted checkout.
- Lemon Squeezy customer portal links when available.
- Signed webhook validation with `X-Signature` over the raw request body.
- Supported events include subscription created, updated, cancelled, resumed, expired, paused, unpaused, payment success/failure/recovered/refunded, plan changed, order created, and order refunded.

Required env:

- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMON_SQUEEZY_WEBHOOK_SECRET`
- `LEMON_SQUEEZY_AI_ORG_STARTER_VARIANT_ID`
- `LEMON_SQUEEZY_AI_ORG_GROWTH_VARIANT_ID`
- `LEMON_SQUEEZY_AI_ORG_SCALE_VARIANT_ID`
- `LEMON_SQUEEZY_AI_PERSONAL_STARTER_VARIANT_ID`
- `LEMON_SQUEEZY_AI_PERSONAL_GROWTH_VARIANT_ID`
- `LEMON_SQUEEZY_AI_PERSONAL_SCALE_VARIANT_ID`

## Data Model Plan

Add AI-specific persistence without mixing AI billing state into auth.

### `AISubscription`

Represents both org and personal subscriptions.

- `id`
- `ownerType`: `ORGANIZATION` or `USER`
- `organizationId`
- `userId`
- `plan`
- `status`
- `monthlyCredits`
- `limitMode`: `HARD` or `SOFT`
- `currentPeriodStart`
- `currentPeriodEnd`
- `createdAt`
- `updatedAt`

Constraints:

- Organization subscription has `ownerType = ORGANIZATION`, `organizationId` set, `userId` null.
- Personal subscription has `ownerType = USER`, `userId` set, `organizationId` optional for reporting context.

### `AIOrgAccessPolicy`

Controls org-funded Copilot access by role.

- `id`
- `organizationId`
- `allowSubAdmins`
- `allowManagers`
- `allowFinanceManagers`
- `allowTeachers`
- `allowStudents`
- `allowGuardians`
- `createdAt`
- `updatedAt`

### `AIRoleCreditPolicy`

Monthly per-user caps by role for org-funded usage.

- `id`
- `organizationId`
- `role`
- `monthlyCredits`
- `createdAt`
- `updatedAt`

### `AIUsage`

Tracks monthly usage per subscription source and user.

- `id`
- `subscriptionId`
- `sourceType`: `ORGANIZATION` or `PERSONAL`
- `organizationId`
- `userId`
- `role`
- `periodStart`
- `periodEnd`
- `creditUsed`
- `providerTokenEstimate`
- `estimatedCost`
- `overageCredits`
- `createdAt`
- `updatedAt`

### `AIToolCallLog`

Operational telemetry only. Do not store prompt or answer content by default.

- `id`
- `userId`
- `orgId`
- `subscriptionId`
- `sourceType`
- `toolName`
- `allowed`
- `latencyMs`
- `creditEstimate`
- `providerTokenEstimate`
- `createdAt`

### `AIConversation`

Needed for contextual follow-up.

- `id`
- `userId`
- `organizationId`
- `subscriptionId`
- `title`
- `createdAt`
- `updatedAt`
- `expiresAt`

### `AIMessage`

Stores enough conversation context for follow-up.

- `id`
- `conversationId`
- `role`: `USER`, `ASSISTANT`, `SYSTEM`, `TOOL`
- `content`
- `metadata`
- `createdAt`

Privacy rules:

- Do not store raw confidential tool payloads unless explicitly safe.
- Consider summarizing older turns to reduce storage and context size.
- Add retention policy before production rollout.

### Optional Later

- `AIProviderUsage`
- `AIBillingEvent`
- `AICreditAdjustment`

## Backend Module Plan

Create `backend/src/ai`.

Suggested files:

- `ai.module.ts`
- `ai.controller.ts`
- `ai.service.ts`
- `ai-entitlement.service.ts`
- `ai-subscription.service.ts`
- `ai-credit.service.ts`
- `ai-usage.service.ts`
- `ai-audit.service.ts`
- `ai-conversation.service.ts`
- `ai-provider.service.ts`
- `ai-tool-registry.service.ts`
- `ai.types.ts`
- `ai.constants.ts`
- `dto/ai-chat.dto.ts`
- `dto/ai-subscription.dto.ts`
- `dto/ai-org-access-policy.dto.ts`
- `dto/ai-role-credit-policy.dto.ts`
- `dto/ai-usage.dto.ts`
- `tools/*.tool.ts`
- `mappers/*.mapper.ts`

## Backend Endpoint Plan

All endpoints are authenticated.

### Copilot Use

- `POST /ai/copilot/chat`
  - Eligible users only.
  - Requires org or personal entitlement.
  - Requires available AI Credits or soft-limit allowance.
  - Uses LangChain and backend tools.
  - Returns markdown answer and conversation id.

- `POST /ai/copilot/chat/stream`
  - Same checks as `/ai/copilot/chat`.
  - Streams assistant tokens and tool status.
  - Can be added after non-streaming v1 works.

### Entitlement

- `GET /ai/entitlement`
  - Returns whether current user can use Copilot.
  - Includes selected funding source: organization, personal, or none.
  - Includes denial reason if unavailable.

### Organization Admin

- `GET /ai/org/settings`
  - `ORG_ADMIN` only.
  - Returns org subscription, role access policy, role credit caps, current usage, plans, and dashboard link state.

- `PATCH /ai/org/access-policy`
  - `ORG_ADMIN` only.
  - Updates role enablement.

- `PATCH /ai/org/role-credit-policy`
  - `ORG_ADMIN` only.
  - Updates per-role monthly credit caps.

- `PATCH /ai/org/subscription`
  - `ORG_ADMIN` only.
  - Legacy development-only plan update route.
  - Production subscription changes should use checkout and portal routes.

- `POST /ai/billing/org/checkout`
  - `ORG_ADMIN` only.
  - Creates a hosted checkout URL for an organization AI plan.

- `POST /ai/billing/org/portal`
  - `ORG_ADMIN` only.
  - Returns the billing portal URL for an existing organization AI subscription when available.

- `GET /ai/org/usage`
  - `ORG_ADMIN` only.
  - Returns org dashboard data.

### Personal Subscription

- `GET /ai/personal/subscription`
  - Returns personal subscription and usage for current user.

- `PATCH /ai/personal/subscription`
  - Legacy development-only plan update route.
  - Production subscription changes should use checkout and portal routes.

- `POST /ai/billing/personal/checkout`
  - Creates a hosted checkout URL for a personal AI plan.

- `POST /ai/billing/personal/portal`
  - Returns the billing portal URL for an existing personal AI subscription when available.

- `GET /ai/personal/usage`
  - Returns personal dashboard data.

### Billing Webhook

- `POST /ai/billing/webhook`
  - Public billing-provider callback.
  - Must use the raw request body for signature validation.
  - Must validate the `X-Signature` HMAC before reading subscription data.
  - Syncs local `AISubscription` records from subscription events.
  - Stores external customer, subscription, variant, and portal identifiers.

## Entitlement and Credit Flow

For every Copilot prompt:

1. Authenticate user.
2. Require org context where relevant.
3. Reject unsupported user statuses.
4. Load organization subscription and role access policy.
5. Load personal subscription.
6. Determine funding source:
   - Use org subscription if active, role is enabled, role cap allows usage, and org credits remain.
   - Otherwise use personal subscription if active and personal credits remain.
   - Otherwise deny.
7. Check credit availability.
8. If credits are exhausted:
   - Hard-limit source: reject prompt.
   - Soft-limit source: allow prompt and mark overage.
9. Run LangChain.
10. Record usage by org, user, role, subscription, and source type.
11. Record tool-call audit logs.
12. Return assistant answer and updated credit state.

## Contextual Follow-Up

Copilot should retain enough conversation context to answer natural follow-ups.

Example:

1. User: "What are my weakest courses?"
2. Copilot uses insights and grade tools.
3. User: "Make me a study plan."
4. Copilot understands "weakest courses" from the previous turn and builds the study plan around those courses and the user's schedule.

Implementation plan:

- Store conversation id on the frontend and backend.
- Send recent conversation turns with each request.
- Store or generate compact conversation summaries for older turns.
- Preserve tool result summaries, not full raw payloads.
- Keep context role-aware and permission-aware on every request.
- Re-check permissions for follow-up tool calls.

## Tool Result Contract

Every tool returns the same envelope:

```ts
export type AIToolResult<T> = {
  ok: boolean;
  code?: "PERMISSION_DENIED" | "NOT_FOUND" | "UNAVAILABLE";
  message?: string;
  data?: T;
};
```

Rules:

- Expected failures return an envelope.
- Unexpected failures can be caught by the tool registry and converted to `UNAVAILABLE`.
- The LLM receives compact envelopes, not thrown Nest exceptions.
- Tool results must be compact DTOs.

## Tool Audit Flow

The tool registry wraps every tool execution:

1. Start timer.
2. Execute tool.
3. Convert expected failure into `AIToolResult`.
4. Estimate AI Credits and provider tokens.
5. Write `AIToolCallLog`.
6. Return result envelope.

Audit must happen for allowed, denied, not found, and unavailable results.

## Initial Tool Set

Use existing services wherever possible.

Core:

- `getCurrentPermissions`
- `searchDocs`
- `searchRoutes`

Schedules:

- `getMyTodaySchedule`
- `getMyTomorrowSchedule`
- `getMyWeeklySchedule`
- `getNextClass`
- `getTeacherScheduleLoad`
- `getScheduleBottlenecks`

Academic:

- `getMyInsights`
- `listCourses`
- `listSections`
- `getSectionDetails`
- `getPendingDeadlines`
- `getPendingGrading`
- `getAttendanceRisk`
- `searchAcademicEntities`
- `getTeacherPerformanceProfile`
- `getCoursePerformanceProfile`
- `getStudentPerformanceProfile`
- `getDepartmentPerformanceProfile`
- `getOrganizationHealthProfile`
- `getStudentsNeedingAttention`

Evaluations:

- `getTeacherEvaluationSummary`
- `getCourseEvaluationSummary`

AI admin:

- `getAIUsageSummary`
- `getAICreditStatus`
- `getAIRoleAccessPolicy`

Tool boundaries:

- Tools must not expose raw service results if those payloads are large or sensitive.
- Tools should call existing scoped services or add scoped read wrappers.
- Avoid direct Prisma usage inside tools unless no service exists and the new code reproduces existing access rules.

## Suggested Prompts

Suggested prompts should be role-specific and appear in the Copilot panel/home state.

### Student

- What should I study today?
- What classes do I have tomorrow?
- What deadlines are coming up?
- Why is my attendance at risk?
- Explain my weakest course.

### Teacher

- What do I teach next?
- Summarize my week.
- What grading is pending?
- Which students need attention?

### Manager

- Summarize today's academic activity.
- Show workload issues.
- Which departments need attention?
- Identify scheduling bottlenecks.

### Org Admin

- Show AI usage this month.
- How many AI Credits are left?
- Which roles use Copilot most?
- Summarize organization health.
- Should we enable Copilot for students?

## Existing Reusable Modules

Backend:

- `InsightsService`
- `CoursesService`
- `SectionsService`
- `EvaluationsService`
- `AttendanceService`
- schedule-related section/attendance services
- `CampusNavigationService`
- `FinanceInsightsBuilder` through existing finance insights path/service
- `getDepartmentScope`
- `courseDepartmentScopeWhere`
- `sectionDepartmentScopeWhere`
- `teacherDepartmentScopeWhere`
- `studentDepartmentScopeWhere`
- `formatPaginatedResponse`
- `getPaginationOptions`
- `fuzzyFilterAndRank`
- `normalizeSearchText`
- existing guards and role decorators

Frontend:

- `frontend/lib/api.ts`
- `MarkdownRenderer`
- `safeUrl`
- `Button`
- `Drawer`
- `Modal`
- `PageShell`
- `PageTabs`
- `Badge`
- `Toggle`
- `AuthContext`
- `GlobalContext`
- `UIContext`
- `BackNavigationContext`
- `orgSidebar`
- `routes`
- `fuzzySearch`

## LangChain Architecture

Backend only.

Request lifecycle:

1. User prompt enters `/ai/copilot/chat`.
2. Entitlement and AI Credit checks run.
3. `AIService` builds a compact role-specific system prompt.
4. Recent conversation context and compact summaries are attached.
5. LangChain receives available tool definitions.
6. Model decides whether a tool is needed.
7. Tool registry executes approved backend tools.
8. Tool result envelopes are returned to the model.
9. Model produces markdown response.
10. Usage and audit telemetry are recorded.
11. Frontend renders response.

Do not preload large data into the prompt. Use tools only when needed.

## Provider Abstraction Plan

Create `AIProviderService` so provider changes are localized.

Provider interface:

- `chat(input)`
- `stream(input)`
- `estimateProviderTokens(input)`
- `estimateCredits(input)`
- `getProviderName()`

Current implementation:

- LangChain-backed external model provider.
- Gemini adapter via `@langchain/google-genai`.
- General env naming: `AI_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE`, and `AI_MAX_RETRIES`.
- No local AI fallback. Copilot requires an external model API key.

Potential later adapters:

- Claude
- Groq
- DeepSeek
- OpenRouter

Do not spread provider SDK imports throughout tools or controllers.

## Server-Side Docs Search Plan

Copilot needs backend-side docs retrieval.

Options:

1. Move docs source into a shared package or JSON file consumed by both backend and frontend.
2. Duplicate only the docs search index server-side for v1, then refactor to shared source later.

Preferred v1:

- Create backend docs data/search module using the same content model.
- Keep frontend docs UI unchanged initially.
- Add `searchDocs` tool that returns compact results:
  - title
  - section
  - snippet
  - href
  - tags

Do not embed all docs into prompts.

## Route Awareness Plan

Copilot should not hallucinate routes.

Backend should expose a route search tool from server-owned route metadata.

Route result DTO:

- `label`
- `href`
- `roles`
- `description`
- `module`

Frontend should render internal links using Next navigation, not full page reloads.

## Evaluation Privacy Plan

Teacher summaries must include:

- teacher name
- averages
- counts
- strengths
- concerns
- trends

Must not include:

- reviewer identity
- raw confidential reviews
- hidden/private feedback unless already allowed by existing policy
- raw evaluation rows

Course summaries should expose only information intended to be public to that role.

## Frontend Architecture

Create frontend Copilot surface in a clearly separated folder.

Suggested files:

- `frontend/components/ai/AICopilotProvider.tsx`
- `frontend/components/ai/AICopilotButton.tsx`
- `frontend/components/ai/AICopilotPanel.tsx`
- `frontend/components/ai/AICopilotHome.tsx`
- `frontend/components/ai/AIMessageList.tsx`
- `frontend/components/ai/AIMessageInput.tsx`
- `frontend/components/ai/AISuggestedPrompts.tsx`
- `frontend/components/ai/AIUsageSummary.tsx`
- `frontend/components/ai/AIOrgSubscriptionSettings.tsx`
- `frontend/components/ai/AIPersonalSubscriptionSettings.tsx`
- `frontend/components/ai/AIOrgDashboard.tsx`
- `frontend/components/ai/AIPersonalDashboard.tsx`
- `frontend/lib/ai.ts` if helpers are needed

Keep Copilot UI separate from chat/mail modules.

## Global Copilot State

State belongs globally because the Copilot should stay open while navigating.

Global state:

- open/closed
- current conversation id
- current conversation messages
- conversation summaries if provided by backend
- loading
- streaming
- pending tool calls
- abort controller
- scroll position
- selected suggested prompt
- entitlement state
- credit state
- active funding source

Do not put domain data in frontend Copilot state.

## Copilot UI Plan

Desktop:

- Floating Copilot button.
- Non-intrusive placement.
- Keyboard accessible.
- Side panel or popover panel.
- Role-specific home state with suggested prompts.

Mobile:

- Full-screen drawer or bottom sheet.
- Must not overlap bottom navigation or critical controls.

States:

- loading entitlement
- disabled because no subscription
- disabled because role is not enabled by org
- personal subscription available
- org credits exhausted
- personal credits exhausted
- streaming response
- tool running
- error/retry
- cancelled request

## Org Admin Subscription UI

Location:

- Dedicated `/ai/subscription` flow, linked from AI Usage.
- Organization AI settings stay in organization settings and are visible only when an active org AI subscription exists.

Includes:

- current org subscription status
- available org plans
- monthly org AI Credits
- current period usage
- estimated monthly usage
- upgrade/downgrade CTA
- hosted checkout action
- billing portal action when available

Organization AI settings include:

- role enablement toggles
- per-role monthly credit caps
- warning when enabling students or guardians
- link back to usage and subscription flows

## Personal Subscription UI

Location:

- Dedicated `/ai/subscription` flow, linked from AI Usage and Copilot disabled states.

Includes:

- current personal subscription status
- available personal plans
- personal monthly AI Credits
- credits used and remaining
- current period
- hosted checkout action
- billing portal action when available

## Usage Dashboard UI

### Organization Dashboard

Org admin only.

Show:

- current org plan
- period start/end
- AI Credits quota
- AI Credits used
- AI Credits remaining
- usage percentage
- estimated monthly usage
- estimated cost
- overage status
- top users
- role-level usage
- feature/tool usage
- denied tool-call counts
- usage trends

### Personal Dashboard

Current user only.

Show:

- current personal plan
- period start/end
- AI Credits quota
- AI Credits used
- AI Credits remaining
- estimated monthly usage
- recent personal usage

Keep dashboards simple and operational, not decorative.

## Markdown and Links

Use existing `MarkdownRenderer`.

Need one frontend enhancement:

- Internal EduVerse links in Copilot messages should use Next router navigation instead of full reloads.

Backend must only return safe internal links from route/docs tools.

## Optimization Strategy

- Tool calling instead of context dumping.
- Compact DTOs.
- Pagination and limits on every list tool.
- Result AI Credit and provider token estimates.
- Request cancellation.
- Timeouts for tools and provider calls.
- Rate limiting by org and user.
- Cache docs/route search results.
- Do not preload insights.
- Do not preload full schedules when summaries are enough.
- Do not send raw evaluation data to LLM.
- Summarize old conversation context.

## Testing Strategy

Backend:

- Entitlement service tests.
- Organization subscription tests.
- Personal subscription tests.
- Hosted checkout payload tests for organization and personal AI plans.
- Billing portal link tests.
- Billing webhook signature validation tests using raw request body and `X-Signature`.
- Billing webhook event sync tests for created, updated, cancelled, resumed, expired, paused, and unpaused subscriptions.
- Missing billing env tests to ensure app startup does not crash and billing actions return clear configuration errors.
- Role access policy tests.
- Per-role credit cap tests.
- Org credits first, personal credits fallback tests.
- Hard-limit and soft-limit behavior tests.
- Tool result envelope tests.
- Tool audit logging tests.
- Conversation follow-up tests.
- Role/scope tests for each tool.
- Schedule tool tests.
- Docs search tests.
- Route search tests.

Frontend:

- Copilot naming and role-specific home state.
- Settings AI Copilot tab visibility.
- AI usage, AI settings, and AI subscription separation.
- AI subscription checkout and portal states.
- Role toggle UI.
- Student/guardian warning.
- Per-role credit cap UI.
- Org dashboard rendering.
- Personal dashboard rendering.
- Assistant disabled states.
- Suggested prompts by role.
- AI-generated suggested questions hidden when unavailable.
- Conversation history list, load, and title edit states.
- Public docs entries for AI role capabilities and payment/billing process.
- Internal markdown link navigation.

E2E:

- Org without subscription cannot use org-funded Copilot.
- User with personal subscription can use Copilot when org has no subscription.
- Personal subscription does not grant extra data access.
- Org admin can enable/disable roles.
- Student blocked until student role enabled or personal subscription active.
- Org credits are used before personal credits.
- Org credit exhaustion blocks org-funded users.
- Personal credits still work after org credits are exhausted.
- Schedule follow-up works.
- Tool permission denial is explained naturally.
- Organization AI checkout unlocks Copilot after billing webhook sync.
- Personal AI checkout unlocks only the purchasing user after billing webhook sync.
- Billing portal link opens only after a subscription exists.
- School finance payment claims do not affect AI subscription state.

## Rollout Strategy

1. Finalize and approve this plan.
2. Ship hidden backend persistence and entitlement foundation.
3. Add org and personal subscription APIs.
4. Add org access policy and per-role credit caps.
5. Enable org-admin Copilot settings UI for internal testing.
6. Enable personal subscription UI for internal testing.
7. Enable org and personal dashboards.
8. Add docs and route tools.
9. Add schedule tools.
10. Add insights/evaluation/course/section tools.
11. Enable role-specific Copilot shell for staff on test orgs.
12. Enable student and guardian role toggles.
13. Add billing provider integration.
14. Add public docs for AI role capabilities and payment flow.
15. Gradually roll out by organization.

## Risks

- Tool permission gaps if tools call unscoped service methods.
- Credit estimates may not match provider cost perfectly.
- Student and guardian usage can consume org credits quickly.
- Personal subscriptions can create support confusion if org policy is disabled.
- Docs source duplication can drift.
- Provider outage or missing AI API key disables Copilot because there is intentionally no local AI fallback.
- Evaluation summaries can accidentally expose sensitive feedback if mappers are not strict.
- Soft-limit plans need clear overage communication.
- Conversation memory can accidentally retain sensitive tool details without summarization and retention rules.
- Schedule tools can return too much data unless summaries and limits are strict.

## Open Questions

- What are final org plan names, prices, and AI Credit amounts?
- What are final personal plan names, prices, and AI Credit amounts?
- Which org plans use hard limit versus soft limit?
- Which personal plans use hard limit versus soft limit?
- Should org admins be able to disable personal subscriptions for compliance, or must personal subscriptions always work with existing permissions?
- Should `SUB_ADMIN` view org AI dashboard read-only, or only `ORG_ADMIN`?
- Should teachers/managers get org-funded Copilot by default when the org subscribes?
- Should guardians have separate warnings and caps from students?
- What is the AI Credit to provider token conversion policy?
- Should conversation history persist across sessions or expire quickly?
- What retention period should apply to Copilot conversations?
- Should overage billing be automatic or require admin approval?

## Stop Point

Phase 0 through Phase 17 implementation notes:

- Phase 0 confirmed the backend/frontend separation: backend owns Copilot intelligence, permissions, subscriptions, credits, tools, audit, docs retrieval, and provider integration; frontend owns Copilot UX.
- Phase 1 produced this Copilot-focused implementation plan and tracker.
- Phase 2 added the Prisma persistence foundation for organization and personal subscriptions, role-based org access policy, per-role credit caps, per-user usage, tool-call audit, and conversation/message storage for contextual follow-up.
- Phase 3 added backend defaults and services for AI Credit plan limits, role access policy, per-role monthly credit caps, and current billing-period handling.
- Phase 4 added backend entitlement resolution, organization-first/personal-fallback source selection, usage accounting, audit service wiring, and the `AIModule`.
- Phase 5 added org-admin AI Copilot settings APIs for organization subscriptions, role access policy updates, per-role credit cap updates, entitlement reads, and org usage summaries.
- Phase 6 added authenticated personal AI subscription and personal usage APIs. Personal subscriptions stay scoped to the purchasing user and do not change permission rules.
- Phase 7 added a minimal org-admin AI Copilot settings UI under organization settings, with plan selection, role access toggles, per-role monthly credit controls, and a lightweight usage dashboard.
- Phase 8 added a dedicated `/ai` dashboard route, separated frontend AI dashboard components, organization usage analytics for org admins, personal usage analytics for every Copilot-capable role, and sidebar navigation.
- Phase 9 added backend-owned docs and route search sources, role-filtered route metadata, compact docs search results, search endpoints, and audited `searchDocs`/`searchRoutes` AI tool registration.
- Phase 10 added audited schedule-aware tools for today, tomorrow, weekly schedule, next class, teacher schedule load, and schedule bottleneck summaries using existing timetable access rules where possible.
- Phase 11 added audited read-only tools for current permissions, role-aware insights, courses, sections, section details, deadlines, pending grading, attendance risk, evaluation summaries, finance summaries, AI usage, AI credits, and AI role access policy.
- Phase 12 added the backend provider abstraction, initial placeholder provider path, LangChain adapter seam, role-aware prompt construction, non-streaming `/ai/copilot/chat` endpoint, entitlement checks, provider token/credit estimates, and usage recording.
- Phase 13 added the global frontend Copilot shell: a persistent provider in the org layout, floating Copilot button, responsive side/fullscreen panel, optimistic message state, cancellation, retry, entitlement refresh, and `/ai/copilot/chat` API integration.
- Phase 14 added role-specific Copilot home states and suggested prompts for students, teachers, managers, and org admins, with credit/source status, subscription-aware disabled states, and separated frontend AI helpers/components.
- Phase 15 added backend-owned Copilot conversation memory with owned conversation lookup, expiry, message persistence, compact older-turn summaries, current-turn de-duplication, and session-scoped frontend conversation id restore.
- Phase 16 added a streaming Copilot path with `POST /ai/copilot/chat/stream`, server-sent events, frontend SSE parsing, progressive assistant message rendering, stop handling, and complete response reconciliation.
- Phase 17 added focused backend tests for conversation compaction and the chat lifecycle, fixed provider adapter initialization order for runtime/test safety, and verified backend and frontend production builds.
- Phase 18 added audited, permission-scoped performance/profile tools for teachers, courses, students, departments, organization health, academic entity search, and students needing attention. It also added automatic backend tool-context collection for schedule, deadline, workload, performance, improvement, AI usage, docs, and route prompts so Copilot answers are grounded in actual EduVerse data.
- Phase 19 replaced the placeholder provider with a real LangChain Gemini provider path, added model-driven backend tool planning with deterministic fallback routing, added general AI model env configuration, installed real LangChain/Gemini dependencies, added Lemon Squeezy checkout/portal/webhook billing integration with durable Lemon Squeezy subscription fields, wired org and personal billing UI flows to Lemon Squeezy, and added scheduled deletion of expired Copilot conversations.
- Phase 20 separated AI usage, org settings, and subscription management into distinct frontend flows. `/ai` is now a gated usage dashboard with a link to subscriptions, `/ai/subscription` owns org and personal package checkout/portal actions, org settings only shows AI role/credit configuration when an active org AI subscription exists, and the Copilot disabled state points users to subscribe. The Copilot composer was restyled to match the main chat input pattern without chat-only attachments/features.
- Phase 21 updated user-facing docs for AI Copilot role capabilities and payment/billing process, kept public AI docs provider-neutral, added the new docs pages to navigation, and refreshed the TDD with the current checkout, portal, webhook, provider, and test coverage requirements.

Next implementation phase: production rollout polish, provider observability, Lemon Squeezy webhook end-to-end testing, and deeper role/scope test coverage.
