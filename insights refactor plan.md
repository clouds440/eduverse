Refactor the existing insights backend and add finance insights.

Context:
There is currently one giant `InsightsService` handling multiple roles directly: admin/sub-admin, teacher/manager, and student. It also contains shared utilities, date formatting, chart shaping, activity shaping, attendance coverage logic, grade calculations, and role routing in the same service. This needs to be refactored before adding finance insights.

Goal:
Create a scalable insights architecture where each role has its own insight builder, shared response types are reused, shared utilities live in helper/util files, and finance insights are added using the same dashboard structure as the existing overview pages.

Strict rules:

* Follow the existing NestJS architecture, Prisma patterns, DTO/controller/service style, auth guards, module structure, and naming conventions.
* Do not use `any`.
* Do not break existing admin, teacher, manager, or student overview behavior.
* Keep frontend calculations minimal.
* Return all chart data already processed and directly usable in Recharts.
* Scope all data by authenticated user's organization.
* Keep role permissions consistent with the existing system.
* Preserve the existing dashboard UX structure: headline, summaryCards, spotlight, groups, recentActivity, charts.
* Do not create one giant service again.
* Shared logic must live in util/helper files, not inside one mega service.

Refactor required:
Replace the current giant insights service with this structure or the closest structure matching the existing project conventions:

```txt
insights/
  insights.module.ts
  insights.controller.ts
  insights.service.ts

  dto/
    insights-query.dto.ts
    insights-response.dto.ts

  shared/
    insights.types.ts
    insights-date.util.ts
    insights-format.util.ts
    insights-chart.util.ts
    insights-activity.util.ts

  builders/
    admin-insights.builder.ts
    teacher-insights.builder.ts
    student-insights.builder.ts
    guardian-insights.builder.ts
    finance-insights.builder.ts
```

Responsibilities:

* `InsightsService`

  * Only validates role/access and delegates to the correct builder.
  * Must not contain role-specific dashboard-building logic.
* Each builder

  * Owns only one role/domain.
  * Fetches its required data.
  * Returns the shared `DashboardInsightsResponse` shape.
* Shared utilities

  * Move reusable date formatting, percentage formatting, activity sorting, trend filling, chart data shaping, and common insight helpers into shared util files.
* Shared types

  * Keep one shared dashboard contract for all overview pages.

Shared response contract:
Use a common response shape for all insights:

```ts
export interface DashboardInsightCard {
  id: string;
  label: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: InsightTone;
}

export interface DashboardInsightItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  href?: string;
  badge?: string;
  tone?: InsightTone;
}

export interface DashboardInsightGroup {
  id: string;
  title: string;
  description?: string;
  items: DashboardInsightItem[];
}

export interface DashboardInsightActivity {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  href?: string;
  tone?: InsightTone;
}

export interface DashboardInsightsResponse<TCharts = unknown> {
  role: string;
  headline: {
    eyebrow?: string;
    title: string;
    subtitle: string;
  };
  summaryCards: DashboardInsightCard[];
  spotlight: DashboardInsightItem | null;
  groups: DashboardInsightGroup[];
  recentActivity: DashboardInsightActivity[];
  charts?: TCharts;
}
```

Important:

* Prefer typed chart interfaces per builder instead of dumping every possible chart into one global `charts` type.
* For example: `AdminInsightCharts`, `TeacherInsightCharts`, `StudentInsightCharts`, `GuardianInsightCharts`, `FinanceInsightCharts`.
* Avoid one global charts object containing unrelated optional properties for every role.

Keep/adopt these good patterns from the current service:

* `headline`, `summaryCards`, `spotlight`, `groups`, `recentActivity`, and `charts`.
* Summary cards with `tone`, `detail`, and `href`.
* Spotlight for the most urgent/important item.
* Groups for action-focused insight lists like "Needs attention", "Upcoming", "Risk signals", "Hotspots".
* Recent activity sorted descending and limited.
* Backend-generated chart data.
* Filled missing date intervals so Recharts does not break.
* Safe empty arrays/nulls when there is no data.
* Numeric chart values should be numbers, not formatted strings.
* Display/card values may be formatted strings where appropriate.

Fix these bad patterns from the current service:

* Do not keep admin, teacher, student, guardian, and finance insight logic in one service.
* Do not keep shared helpers as private methods inside one role service.
* Do not mix role routing with analytics building.
* Do not use one giant optional `charts` object shared by every role.
* Do not duplicate date/chart/activity helper logic inside each builder.
* Do not make the frontend group, sort, aggregate, compare, or reshape finance data.

Existing role builders:
Refactor the existing logic into:

* `AdminInsightsBuilder`

  * Handles ORG_ADMIN and SUB_ADMIN.
* `TeacherInsightsBuilder`

  * Handles TEACHER and ORG_MANAGER if current behavior intentionally shares the same overview.
* `StudentInsightsBuilder`

  * Handles STUDENT.
* `GuardianInsightsBuilder`

  * Add if guardian overview exists or prepare a clean builder stub if not implemented yet.
  * Guardian insights should focus on linked students, attendance risk, grade risk, pending assessments, recent activity, and upcoming classes/deadlines.

Finance insights:
Add `FinanceInsightsBuilder`.

Access:

* FINANCE_MANAGER must access finance insights.
* ORG_ADMIN and SUB_ADMIN may access finance insights if existing finance permissions allow audit/view access.
* Do not expose finance insights to teacher, student, or guardian unless explicitly allowed by existing permissions.

Endpoint:
Either:

* Add `GET /finance/insights`
  or
* Add role/domain-aware endpoint matching the existing route style.

Use the existing project route pattern. Do not invent an inconsistent route if there is already an insights endpoint convention.

Finance query params:

```ts
from?: string;      // ISO date
to?: string;        // ISO date
interval?: "monthly" | "weekly" | "daily"; // default monthly
currency?: string;
```

Default date range:

* If no range is provided, use the current academic/financial year if available.
* Otherwise default to the last 12 months.

Finance response:
Finance insights must use the same shared dashboard response structure:

```ts
DashboardInsightsResponse<FinanceInsightCharts>
```

Finance summary cards:
Return:

* totalIncome
* totalExpense
* netFlow
* profitMarginPercent
* incomeChangePercent compared to previous equal period
* expenseChangePercent compared to previous equal period
* netFlowChangePercent compared to previous equal period
* pendingIncomeAmount if available
* overdueIncomeAmount if available
* pendingExpenseAmount if available
* topIncomeSource
* topExpenseSource

Summary cards should include:

* Income
* Expenses
* Net Flow
* Profit Margin
* Pending/Overdue if data exists

Finance spotlight:
Return the most important finance signal:
Priority order:

1. Negative net flow
2. Sharp expense increase
3. Low collection rate
4. High overdue amount
5. Best net flow month
6. Highest income source

Finance groups:
Return useful action groups:

1. `cash-flow-alerts`

   * Negative net flow
   * Expense spike
   * Income drop
   * Overdue amount
2. `top-sources`

   * Top income sources
   * Top expense sources
3. `collection-health`

   * Pending and overdue payment items if available

Finance recentActivity:
Return latest 10 confirmed finance entries:

```ts
{
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  href?: string;
  tone?: InsightTone;
}
```

Finance charts:
Create typed chart response:

```ts
export interface FinanceInsightCharts {
  moneyFlowTrend: Array<{
    label: string;
    income: number;
    expense: number;
    netFlow: number;
  }>;

  incomeSources: Array<{
    source: string;
    amount: number;
    percentage: number;
  }>;

  expenseSources: Array<{
    source: string;
    amount: number;
    percentage: number;
  }>;

  incomeSourceTrend: Array<{
    label: string;
    [sourceName: string]: string | number;
  }>;

  expenseSourceTrend: Array<{
    label: string;
    [sourceName: string]: string | number;
  }>;

  topMonths: {
    highestIncomeMonth: {
      label: string;
      amount: number;
    } | null;
    highestExpenseMonth: {
      label: string;
      amount: number;
    } | null;
    bestNetFlowMonth: {
      label: string;
      amount: number;
    } | null;
    worstNetFlowMonth: {
      label: string;
      amount: number;
    } | null;
  };

  collectionHealth?: {
    collectedAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    collectionRatePercent: number;
    chartData: Array<{
      status: "Collected" | "Pending" | "Overdue";
      amount: number;
    }>;
  };

  chartRecommendations: {
    moneyFlowTrend: "ComposedChart";
    incomeSources: "BarChart";
    expenseSources: "BarChart";
    incomeSourceTrend: "LineChart";
    expenseSourceTrend: "LineChart";
    collectionHealth?: "RadialBarChart" | "PieChart";
    topMonths: "BarChart" | "Cards";
  };
}
```

Chart choices:

* Money flow trend: Recharts `ComposedChart`

  * income as bar
  * expense as bar
  * netFlow as line
* Income sources: Recharts `BarChart`
* Expense sources: Recharts `BarChart`
* Income source trend: Recharts `LineChart`
* Expense source trend: Recharts `LineChart`
* Collection health: Recharts `RadialBarChart` or `PieChart`
* Top months: cards or small `BarChart`

Finance data rules:

* Use confirmed/actual finance entries for actual income, expenses, net flow, and trends.
* Do not mix pending/due/overdue amounts into actual cash flow.
* If pending/due/overdue records exist, return them separately in summary, groups, or collectionHealth.
* Use Prisma aggregation/grouping where practical.
* Fill missing intervals with zero values.
* Sort source comparisons descending by amount.
* Limit source trend lines to top 5 sources.
* Return numbers as numbers in charts.
* Return currency separately where needed, not embedded into chart values.
* Return clean labels:

  * monthly: `"Jan 2026"`
  * weekly: `"2026-W24"` or a clean date range
  * daily: `"2026-06-15"`

Finance alerts:
Generate backend insight items, not frontend calculations:

* Expenses increased sharply compared to previous period.
* Net flow is negative.
* One expense source dominates total expenses.
* Collection rate is low.
* Income dropped compared to previous period.
* Highest expense month.
* Best net flow month.

Frontend integration:

* Update finance overview frontend only if needed.
* Do not duplicate backend calculations in frontend.
* Use returned chart data directly in Recharts.
* Follow the visual style of existing admin, teacher, and student overview pages.
* Use the same card style, spacing, typography, loading states, empty states, and error states.
* Use the chart recommendations from the backend response.

Testing/checks:

* Existing admin insights still work.
* Existing teacher/manager insights still work.
* Existing student insights still work.
* Guardian insights are either implemented or cleanly separated as a stub/placeholder if data model is incomplete.
* Finance insights work for valid finance roles.
* Unauthorized roles receive Forbidden.
* Empty finance data returns safe empty arrays/nulls.
* Missing intervals are filled.
* Date comparisons use previous equal period.
* No `any` is introduced.
* TypeScript compiles.
* Prisma queries are organization-scoped.
