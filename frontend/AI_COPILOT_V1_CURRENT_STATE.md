# EduVerse Copilot V1 Current State

This document summarizes the currently implemented EduVerse Copilot V1 so it can be shared with another AI chat when discussing capabilities, gaps, and V2 design.

## Product Positioning

EduVerse Copilot is implemented as a premium, role-aware AI copilot inside EduVerse. It is not positioned as a generic chatbot. It answers using the user's current role, organization context, permissions, subscription access, AI Credit balance, docs, workflows, routes, and read-only backend data tools.

V1 is read-only. It can explain, summarize, analyze, recommend, guide users through flows, and fetch context. It does not create, update, delete, approve, enroll, grade, message, or mutate records.

## Access And Subscription Model

- AI access is subscription gated.
- Organization subscriptions can enable Copilot for selected roles.
- Personal subscriptions unlock Copilot only for the purchasing user.
- Personal access does not grant extra data permissions.
- Organization credits are used before personal credits when applicable.
- AI Credits are exposed to users instead of provider tokens.
- Monthly credit balances are tracked for org, role, and personal usage.
- Credit exhaustion is handled as an in-chat assistant response with a top-up link.
- Subscription and top-up flow lives at `/ai/subscription`.
- Lemon Squeezy handles checkout, billing portal, subscriptions, and webhooks.
- Admin AI settings and usage are separate from AI subscription flow.

## Current UI

### Floating And Docked Copilot

Files:
- `frontend/components/ai/AICopilotProvider.tsx`
- `frontend/components/ai/AICopilotButton.tsx`
- `frontend/components/ai/AICopilotPanel.tsx`

Implemented behavior:
- Floating sparkle button opens Copilot.
- Button is dismissible.
- Icon fill indicates availability.
- Panel can float or dock to the right on desktop.
- Docked mode is not available on mobile.
- Docked width is resizable and persisted.
- Docked panel is rendered inside the dashboard body dock host, below the navbar.
- Panel actions can collapse to preserve header space.
- Conversation ID is persisted per user in session storage.
- If the provider remounts and has a stored conversation ID but no local messages, it silently reloads messages from DB.

### Home State

File:
- `frontend/components/ai/AICopilotHome.tsx`

Implemented behavior:
- Role-aware hero copy.
- Subscription locked state.
- Zero-credit state is different from no-subscription state.
- Low-credit warning.
- Usage and subscription shortcuts only when relevant.
- Role-aware quick action cards, triggered only when clicked.
- No automatic suggested prompt generation on panel open.

### Chat UI

Files:
- `frontend/components/ai/AIMessageInput.tsx`
- `frontend/components/ai/AIMessageList.tsx`
- `frontend/components/ai/AISuggestedPrompts.tsx`

Implemented behavior:
- Input style follows the existing chat composer pattern.
- Send button only appears when text exists.
- Stop button only appears while a provider request is actually running.
- Errors are shown in the panel, not as toasts.
- AI and user messages have copy buttons.
- Markdown is rendered in assistant responses.
- Code blocks use the existing markdown/code rendering stack.
- Suggested prompts are generated only after clicking "Show suggested prompts".
- Suggested prompts are capped to 3 and shown in a compact horizontal scroller.
- Assistant responses can show user-friendly source labels and related actions.
- Internal tool names and record IDs are not shown to users.

### Chat History

Files:
- `frontend/components/ai/AICopilotPanel.tsx`
- `backend/src/ai/ai-conversation.service.ts`

Implemented behavior:
- Conversations are stored in DB.
- Users can load previous Copilot chats.
- Chat titles default to the first user message.
- Titles are editable.
- Chats can be permanently deleted with confirmation.
- History opens as a sidebar overlay on top of the Copilot panel.
- History shows title, message count, credit total, and grouped date sections.
- Retry avoids duplicating the same user message repeatedly.
- Assistant error replies are also stored so history does not look abandoned.

## Current Role Capabilities

The copilot uses JWT role directly and does not ask the LLM to infer role.

### Student

- Study coach.
- Schedule-aware planner.
- Deadline helper.
- Attendance risk explanations.
- Course guidance.
- Evaluation and grade explanations.
- Weak course analysis.
- Personalized study plan support using schedule, deadlines, and performance context.

### Teacher

- Next class and daily schedule context.
- Weekly teaching summary.
- Pending grading.
- Attendance reminders.
- Students needing attention.
- Workload and teaching preparation support.

### Manager

- Academic activity summaries.
- Department and section workload review.
- Staffing and schedule bottleneck explanations.
- Attendance, evaluation, grade, and workload trend summaries.
- Recommendations based on visible operational data.

### Org Admin

- Organization health summaries.
- Copilot usage and AI Credits.
- Role access and configuration guidance.
- Subscription management support.
- Operational anomaly summaries where context exists.

### Super Admin

- Platform-level Copilot quality dashboard.
- This is separate from org admin usage dashboards.

## Backend Architecture

Main files:
- `backend/src/ai/ai.module.ts`
- `backend/src/ai/ai.controller.ts`
- `backend/src/ai/ai.service.ts`
- `backend/src/ai/ai-provider.service.ts`
- `backend/src/ai/ai-tool-registry.service.ts`
- `backend/src/ai/ai.types.ts`

The backend owns:
- LLM provider calls.
- Planner/tool selection.
- Permission checks.
- Tool execution.
- Docs, flows, and route retrieval.
- Conversation persistence.
- Credits and subscription enforcement.
- Audit logs.
- Usage dashboards.
- Billing integration.

The frontend owns:
- Floating button.
- Copilot panel.
- Message rendering.
- Markdown display.
- History UI.
- Settings, usage, and subscription pages.

## LLM And Libraries

Backend libraries:
- LangChain core: `@langchain/core`
- LangChain OpenAI adapter: `@langchain/openai`
- Provider class: `ChatOpenAI`
- OpenRouter-compatible API base URL through `AI_API_BASE_URL`
- Model configured through `AI_MODEL`

The provider is intentionally environment-driven:
- `AI_API_KEY`
- `AI_API_BASE_URL`
- `AI_MODEL`

There is no local AI fallback. Copilot requires an external LLM API key and configured model.

Frontend libraries used around AI UI:
- React and Next.js app router.
- SWR for admin quality dashboard fetches.
- Existing Markdown renderer.
- Lucide icons.
- Existing EduVerse UI components such as `Button`, `Badge`, `ConfirmDialog`, `PageShell`, `ResourcePanel`, and `Loading`.

Billing:
- Lemon Squeezy API and webhooks.
- Variant IDs are configured in backend env.
- Display prices are frontend/product UI concerns, while real pricing lives in Lemon Squeezy.

## Tool System

Core registry:
- `backend/src/ai/ai-tool-registry.service.ts`

Tools return a common envelope:

```ts
type AIToolResult<T> = {
  ok: boolean;
  code?: "PERMISSION_DENIED" | "NOT_FOUND" | "UNAVAILABLE";
  message?: string;
  data?: T;
};
```

Tool calls are audited with:
- user ID
- org ID
- tool name
- allowed or denied
- latency
- estimated credits/tokens
- timestamp

### General Context Tools

File:
- `backend/src/ai/ai-context-tools.service.ts`

Implemented tools:
- `getEduVerseContext`
- `getEntityRelationshipContext`
- `getAcademicPlanningContext`
- `getEnrollmentFeasibilityContext`
- `getPolicyContext`
- `getCommunicationContext`

These tools are meant to reduce one-off scenario tools. They orchestrate existing tools and return separated context sections so the response model can combine data across docs, flows, routes, schedules, academic records, operations, communication, finance, relationships, planning, and enrollment feasibility.

### Domain Tool Files

- `ai-academic-tools.service.ts`
- `ai-performance-tools.service.ts`
- `ai-schedule-tools.service.ts`
- `ai-operations-tools.service.ts`
- `ai-entity-resolver.service.ts`
- `ai-knowledge.service.ts`
- `ai-routes.source.ts`
- `ai-flows.source.ts`

Available context includes:
- entity fuzzy resolution
- docs search
- workflow search
- route search
- schedule context
- academic performance profiles
- enrollment ranking
- pending deadlines
- pending grading
- attendance risk
- students needing attention
- operations context for calendar, rooms/buildings, announcements, and preference windows
- communication context for visible mail and announcements
- AI credit status and usage summaries

## Planning And Response Approach

V1 uses a two-step approach:

1. Planner/tool selection decides what backend context is needed.
2. Response generation answers using the selected tool results and recent conversation context.

The planner is intentionally kept in the loop for routing-sensitive queries. Deterministic hints can narrow eligible tools, but the planner is not skipped for apparently simple cases because that can produce wrong answers.

Request classes include:
- capability/about-Copilot
- workflow/how-to
- live-data
- mixed workflow plus live-data
- credit-status
- off-topic
- general

The backend injects compact response contracts based on request class.

## Response Safety And Quality Rules

Implemented response controls:
- Copilot refers to itself as "EduVerse Copilot" and uses "I".
- Tool names must not be revealed.
- Raw record IDs and UUIDs are stripped from tool payloads and sanitized from final answers.
- Known facts are summarized after tool execution so the model should not ask for information it already has.
- Missing facts are explicitly separated from known facts.
- Final clarifying questions are removed when they are not needed.
- Empty results should distinguish between:
  - target not found
  - target found but child records missing
  - permission denied
  - partial or unavailable result
- Off-topic questions are redirected back to EduVerse.
- Internal source names are converted into user-friendly labels like Docs, Workflow guide, Schedule, Academic records, Enrollment, Operations, Communication, Finance, and AI Credits.

## Conversation Context

Files:
- `backend/src/ai/ai-conversation.service.ts`
- `frontend/components/ai/AICopilotProvider.tsx`

Implemented behavior:
- Conversations are persisted in DB.
- Recent messages are sent to the model.
- The full history is not blindly resent.
- Follow-ups can rely on recent context.
- Message metadata stores provider, usage, request kind, source labels, related actions, and error markers.
- On frontend remount, selected conversation messages are rehydrated from DB.

## Credits, Usage, And Dashboards

Files:
- `backend/src/ai/ai-credit.service.ts`
- `backend/src/ai/ai-usage.service.ts`
- `backend/src/ai/ai-settings.service.ts`
- `frontend/components/ai/AIUsageDashboard.tsx`
- `frontend/components/ai/AIOrgDashboard.tsx`
- `frontend/components/ai/AIPersonalDashboard.tsx`
- `frontend/app/(org)/ai/page.tsx`
- `frontend/app/admin/copilot-quality/page.tsx`

Implemented dashboards:
- Personal usage.
- Organization usage.
- Credits used and remaining.
- Estimated monthly usage.
- Top users for org admins.
- Usage trends for org admins.
- Feature/tool usage.
- Estimated cost using preferred/saved currency where applicable.
- Super-admin-only Copilot quality dashboard.

Super admin quality dashboard includes:
- failed/denied tool calls
- average latency
- credit usage by answer type
- common user intents
- provider failures
- tool health

## Docs, Flows, And Routes

Shared docs package:
- `packages/docs`

Backend AI can search:
- docs/concepts
- workflows/flows
- routes/navigation

Frontend docs also use shared package data. This avoids duplicating docs between frontend and backend.

Docs explain what concepts are. Flows explain how to do tasks step by step. Routes explain where things live in the product.

## File Structure Summary

Backend AI:

```text
backend/src/ai/
  ai.module.ts
  ai.controller.ts
  ai.service.ts
  ai-provider.service.ts
  ai-tool-registry.service.ts
  ai-context-tools.service.ts
  ai-academic-tools.service.ts
  ai-performance-tools.service.ts
  ai-schedule-tools.service.ts
  ai-operations-tools.service.ts
  ai-entity-resolver.service.ts
  ai-knowledge.service.ts
  ai-conversation.service.ts
  ai-credit.service.ts
  ai-entitlement.service.ts
  ai-subscription.service.ts
  ai-billing.service.ts
  ai-settings.service.ts
  ai-usage.service.ts
  ai-audit.service.ts
  ai.types.ts
  ai.constants.ts
  dto/
```

Frontend AI:

```text
frontend/components/ai/
  AICopilotProvider.tsx
  AICopilotButton.tsx
  AICopilotPanel.tsx
  AICopilotHome.tsx
  AIMessageInput.tsx
  AIMessageList.tsx
  AISuggestedPrompts.tsx
  AIUsageDashboard.tsx
  AIOrgDashboard.tsx
  AIPersonalDashboard.tsx
```

Pages:

```text
frontend/app/(org)/ai/page.tsx
frontend/app/(org)/ai/subscription/page.tsx
frontend/app/admin/copilot-quality/page.tsx
```

Shared docs:

```text
packages/docs/
```

## Code Practices Applied

- Backend and frontend concerns are separated.
- Backend owns AI brain, permissions, tools, billing, usage, and context.
- Frontend owns UI, chat experience, markdown, history, and settings screens.
- Tools use a consistent `AIToolResult<T>` envelope.
- Tool audit logs are recorded without storing message contents.
- Provider configuration is env-driven.
- No local AI fallback.
- Existing app utilities and UI primitives are reused.
- Existing shared docs package is reused by frontend and backend.
- AI tools are read-only in V1.
- General-purpose tools are preferred over one-off scenario tools.
- IDs and internal tool names are removed from model-facing and user-facing payloads.
- Build verification has been run after the latest AI changes.

## Known V1 Boundaries

- Copilot cannot mutate records.
- Copilot cannot perform approvals or enrollment actions.
- Copilot depends on the configured external LLM.
- Some quality telemetry is approximate because tool logs currently store allowed/denied, not detailed result codes for every failure type.
- Older conversation memory is not yet summarized into durable long-term memory.
- Planner and response quality still depend on the selected model's reasoning strength.
- Tool coverage is broad but should be expanded only when new durable domain entities or workflows are added.

