# EduVerse Copilot V1 Improvement Plan

## Summary

EduVerse Copilot V1 is now functionally complete: premium-gated, role-aware, permission-aware, schedule-aware, tool-backed, conversation-aware, and integrated with AI Credits, usage, subscriptions, docs, flows, routes, and dashboards.

The next improvement pass should focus on making Copilot feel dependable in real school workflows: better role-specific answers, broader general-purpose tools, less hallucination, lower token cost, faster responses, clearer UI states, and more useful admin/student/teacher/manager experiences.

## Priority Improvements

### P0: Reliability And Answer Quality

- Add an answer policy layer that classifies requests before tool planning:
  - capability/about-Copilot questions
  - workflow/how-to questions
  - live-data questions
  - mixed workflow + live-data questions
  - off-topic questions
- For each class, inject a compact response contract so the model knows whether to explain, analyze, compare, plan, or ask one question.
- Add post-response validation before returning the answer:
  - block internal tool names
  - block raw IDs/UUIDs
  - detect unnecessary final questions
  - detect “I don’t have info” when tool results were successful
  - detect claims that contradict tool result status
- Add a “known facts” summary block after tool execution so the model cannot ask for facts already returned by tools.
- Add a “missing facts” summary block only when required inputs are actually missing.
- Add role-specific answer templates for high-value patterns:
  - student study plan
  - teacher daily briefing
  - manager workload summary
  - org admin health/usage summary
  - workflow guidance
  - enrollment/course-load decision
- Keep templates as response guidance, not hardcoded final answers.

### P1: Tool System Improvements

- Introduce a general `getEduVerseContext` orchestration tool.
  - Input: `intent`, `search`, `entities`, `dateRange`, `include`.
  - Output: clearly separated sections for entities, schedules, academic records, deadlines, attendance, evaluations, operations, finance, docs, flows, and routes.
  - Purpose: reduce duplicate tool calls and make complex prompts easier for low-cost models.
- Add a general `getEntityRelationshipContext` tool.
  - Resolves and returns relationships between users, roles, departments, courses, sections, cohorts, academic cycles, rooms, schedules, assessments, and enrollments.
  - This should answer questions like “what is this teacher connected to?” or “what does this student currently take?” without needing many one-off tools.
- Add a general `getAcademicPlanningContext` tool.
  - For students: enrolled sections, weak courses, deadlines, schedule blocks, attendance risk.
  - For staff: assigned sections, grading load, schedule load, students needing attention.
  - For admins/managers: departments, sections, staffing, bottlenecks, risk summaries.
- Add a general `getEnrollmentFeasibilityContext` tool.
  - Checks current course/section load, schedule conflicts, capacity, prerequisites if available, academic cycle/cohort/section fit, and recent performance.
  - This supports “should Ali take English Literature?” without creating a specific one-off tool.
- Add a general `getCommunicationContext` tool.
  - Searches visible mail, announcements, notification-style records, and formal communication references.
  - Keep read-only and scoped.
- Add a general `getPolicyContext` tool.
  - Returns relevant academic, GPA, attendance, grading, enrollment, finance, evaluation, and platform-policy docs/flows.
  - Useful for “what is the rule for…” questions.
- Improve existing docs/flows/routes retrieval:
  - allow one request to return docs + flows + routes together
  - return “concept explanation” and “how to do it” separately
  - prefer related sections from the same docs page when a strong match is found
  - add result confidence and “why this matched” metadata internally
- Make planner receive only role-eligible tool descriptions instead of every tool.
- Add per-tool result size budgets and a common truncation policy.

### P1: Role-Specific Improvements

- Student:
  - improve study plans using schedule, deadlines, weak courses, and free slots together
  - add “why am I at risk?” explanations for attendance, grades, deadlines, and workload
  - add “what should I do next?” prioritization
  - add course-load guidance before enrollment decisions
- Teacher:
  - add morning briefing mode: next class, today’s classes, pending grading, attendance reminders, students needing attention
  - add weekly teaching summary with load, room movement, gaps, and grading pressure
  - add class prep suggestions from course/section/material/assessment context
- Manager:
  - add department/section workload review
  - add schedule bottleneck and staffing concern explanations
  - add trend summaries for attendance, evaluations, grades, and workload
  - add “what should we do?” recommendations with evidence and caveats
- Org Admin:
  - add organization health summary beyond AI usage
  - add setup/configuration guidance using docs + flows + live org context
  - add AI usage recommendations: role caps, student enablement warnings, top usage patterns
  - add operational anomaly summaries: unscheduled sections, overloaded teachers, empty rooms, missing configuration

### P1: New V1 Features

- Add “Briefing Cards” on Copilot home:
  - student: today’s plan
  - teacher: today’s teaching briefing
  - manager: academic activity snapshot
  - org admin: organization health snapshot
  - These should be generated only on click, not automatically.
- Add “Answer Mode” chips above input when useful:
  - Explain
  - Plan
  - Compare
  - Summarize
  - Find
  - Guide me step by step
- Add “Sources used” as user-friendly labels, not tool names:
  - Docs
  - Workflow guide
  - Schedule
  - Grades
  - Attendance
  - Enrollment
  - Organization settings
- Add “Use this answer” actions for supported response types:
  - copy checklist
  - open related page
  - start a new chat from this topic
  - save as note later if notes exist
- Add “What changed?” follow-up support:
  - compare current tool result with previous conversation context where safe
  - useful for schedules, credits, grading load, and usage dashboards
- Add super-admin-only Copilot quality dashboard:
  - failed tool calls
  - denied tool calls
  - average latency
  - credit usage by answer type
  - most common user intents
  - provider failures

## Optimization Plan

### Token And Cost

- Replace the single large system prompt with layered prompt fragments:
  - always-on safety/identity rules
  - role capability fragment
  - request-class fragment
  - tool-result instruction fragment
- Do not send the full tool manifest to the planner.
  - Send a compact, role-filtered, intent-filtered tool list.
- Skipped: planner LLM bypass for deterministic cases. This is intentionally not implemented because it can choose the wrong path and return a weaker answer.
- Cache docs, routes, and flows search results by normalized query.
- Cache generated suggested prompts per session and role.
- Reduce conversation context:
  - keep last few turns verbatim
  - summarize older turns into durable memory
  - store tool request keys separately
  - never resend large assistant responses when a summary is enough
- Track estimated credits by request class so expensive flows can be optimized first.

### Speed

- Execute independent tools in parallel.
- Add tool timeouts and partial-result behavior.
- Stream status updates by real stage:
  - Thinking
  - Getting context
  - Checking records
  - Writing response
- Return partial useful answers when one non-critical tool fails.
- Keep model planning in the loop for routing-sensitive queries; use deterministic hints only to narrow eligible tools.
- Prefer aggregate tools for complex prompts instead of 5-8 separate model-planned tools.

### Reliability

- Add structured tool result diagnostics:
  - target found / target missing
  - target found but child records missing
  - permission denied
  - empty result
  - partial result
- Teach model to distinguish:
  - “teacher not found”
  - “teacher found but no schedule”
  - “schedule found but no room”
  - “student found but no graded assessments”
- Add integration tests for real prompt examples:
  - “How do I enroll a student in Summer 2026?”
  - “What can you do?”
  - “Which courses have highest enrollment this semester?”
  - “Tell me about Ahmad Farooq’s schedule.”
  - “Should Ali Raza take English Literature?”
  - “What are my weak courses and make a study plan around July 14?”
- Add snapshot-style tests for prompts sent to the model.

## UI And Layout Improvements

- Copilot home should feel more like a role dashboard:
  - primary role briefing card
  - credits status as secondary
  - suggested “Need ideas?” as a quiet action
  - clear entry points for Usage and Subscription only when relevant
- Improve empty state per role:
  - student: “Plan my study day”
  - teacher: “Prepare for today”
  - manager: “Review academic activity”
  - org admin: “Check organization health”
- Add a compact “sources used” row under assistant answers.
- Improve processing UI:
  - show one natural status label at a time
  - avoid robotic wording
  - no fake progress if the request is blocked before provider call
- Improve chat history:
  - group by recent dates
  - show title, credit total, last updated, and first user prompt preview
  - add search/filter later if history grows
- Improve docked mode:
  - clearer resize handle
  - preserve width per device
  - collapse history overlay gracefully inside docked layout
- Improve mobile:
  - make the panel feel like a native full-screen assistant
  - keep input reachable above keyboard
  - hide dock controls
  - keep close/dismiss obvious
- Improve message bubbles:
  - wider assistant responses for long markdown
  - better code block spacing
  - copy button should stay subtle
  - avoid large avatar/icon repetition in dense chats
- Add a “related actions” strip after workflow answers:
  - Open Students
  - Open Sections
  - Open AI Usage
  - Open Settings
  - Use only safe internal routes from backend route context.

## Test Plan

- Backend unit tests:
  - request classification
  - role-scoped capability context
  - deterministic routing skips planner where expected
  - aggregate context tool output contracts
  - entity-found-but-child-missing cases
  - post-response validator blocks tool names and raw IDs
- Backend integration tests:
  - complex multi-tool student planning prompt
  - workflow + docs + route + live DB prompt
  - teacher/manager lookup across shared user roles
  - credit exhaustion and hardcoded top-up response
  - docs/flows combined retrieval
- Frontend tests:
  - role-specific home cards
  - no subscription vs zero credits states
  - suggested prompts click-to-generate only
  - docked/floating persistence
  - history load/delete/rename
  - source labels display without tool names
- Manual QA prompts:
  - ask capabilities as each role
  - ask off-topic questions
  - ask vague entity names
  - ask for workflows
  - ask for live academic analysis
  - ask follow-ups that rely on previous context

## Assumptions

- Copilot remains read-only in V1.
- No autonomous mutations, approvals, or “apply this change” actions are added in this pass.
- Existing permissions remain the source of truth.
- Personal subscriptions unlock Copilot only, not extra data.
- General tools are preferred over one-off scenario tools.
- The improvement plan should become `COPILOT_V1_IMPROVEMENTS.md` when implementation mode resumes.
