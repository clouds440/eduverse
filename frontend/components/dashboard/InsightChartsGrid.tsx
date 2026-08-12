'use client';

import type { ReactNode } from 'react';
import { Role, type DashboardInsights } from '@/types';
import {
  COLORS,
  CompletionBarChart,
  GroupedBarChart,
  InsightBarChart,
  InsightLineChart,
  InsightPieChart,
  MoneyFlowChart,
  MultiLineChart,
  PerformanceChart,
} from '@/components/charts/ChartComponents';

type InsightCharts = DashboardInsights['charts'];
type TopMonths = NonNullable<InsightCharts>['topMonths'];

function hasPositiveValue(data: unknown[] | undefined, keys: string[]) {
  return Boolean(data?.some((item) => {
    const row = item as Record<string, unknown>;
    return keys.some((key) => Number(row[key] || 0) > 0);
  }));
}

function hasPositivePie(data: Array<{ value: number }> | undefined) {
  return Boolean(data?.some((item) => Number(item.value || 0) > 0));
}

function trendValueKeys(data: unknown[] | undefined) {
  return Object.keys((data?.[0] as Record<string, unknown> | undefined) || {}).filter((key) => key !== 'label');
}

function hasTopMonthValue(topMonths: TopMonths | undefined) {
  if (!topMonths) return false;
  return [
    topMonths.highestIncomeMonth,
    topMonths.highestExpenseMonth,
    topMonths.bestNetFlowMonth,
    topMonths.worstNetFlowMonth,
  ].some((month) => Math.abs(Number(month?.amount || 0)) > 0);
}

function ChartPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border/70 bg-background/60 p-3 shadow-xs sm:p-4 ${className}`}>
      {children}
    </section>
  );
}

function formatChartAmount(amount: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
}

function TopMonthCards({ charts }: { charts: InsightCharts }) {
  const topMonths = charts?.topMonths;
  if (!topMonths) return null;

  const cards = [
    { label: 'Highest Income', value: topMonths.highestIncomeMonth },
    { label: 'Highest Expense', value: topMonths.highestExpenseMonth },
    { label: 'Best Net Flow', value: topMonths.bestNetFlowMonth },
    { label: 'Worst Net Flow', value: topMonths.worstNetFlowMonth },
  ];

  return (
    <ChartPanel>
      <div className="mb-3">
        <h4 className="text-sm font-black tracking-tight text-foreground">Top Months</h4>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Cash-flow highlights from confirmed transactions</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-border/70 bg-card/70 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{card.label}</p>
            <p className="mt-2 truncate text-sm font-black text-foreground">{card.value?.label || 'No data'}</p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              {card.value ? formatChartAmount(card.value.amount) : '0'}
            </p>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

export function hasInsightCharts(role: string, charts: InsightCharts) {
  if (!charts) return false;

  if (
    hasPositiveValue(charts.moneyFlowTrend, ['income', 'expense', 'netFlow']) ||
    hasPositiveValue(charts.incomeSources, ['amount']) ||
    hasPositiveValue(charts.expenseSources, ['amount']) ||
    hasPositiveValue(charts.incomeSourceTrend, trendValueKeys(charts.incomeSourceTrend)) ||
    hasPositiveValue(charts.expenseSourceTrend, trendValueKeys(charts.expenseSourceTrend)) ||
    hasPositiveValue(charts.departmentFinance, ['expectedAmount', 'collectedAmount', 'pendingAmount', 'overdueAmount']) ||
    hasPositivePie(charts.collectionHealth?.chartData.map((item) => ({ value: item.amount }))) ||
    hasTopMonthValue(charts.topMonths)
  ) {
    return true;
  }

  const hasAdminCharts = Boolean(
    hasPositiveValue(charts.cycleComparison, ['students', 'sections', 'cohorts', 'programOfferings', 'assessments', 'attendanceSessions']) ||
    hasPositiveValue(charts.programCoverage, ['activeEnrollments', 'openOfferings', 'mappedSections', 'activeCurricula']) ||
    hasPositiveValue(charts.sectionRelationships, ['components', 'linkedSections', 'enrolledStudents']) ||
    hasPositiveValue(charts.enrollmentTrend, ['value']) ||
    hasPositiveValue(charts.mailStatus, ['count']) ||
    hasPositiveValue(charts.sectionCapacity, ['enrolled']) ||
    hasPositiveValue(charts.teacherWorkload, ['sections', 'students', 'weeklySlots']) ||
    hasPositiveValue(charts.departmentActivity, ['courses', 'sections', 'students', 'teachers']) ||
    hasPositiveValue(charts.departmentPerformance, ['averageGradePercent', 'attendanceRatePercent']) ||
    hasPositiveValue(charts.roomUsage, ['scheduledSlots']) ||
    hasPositiveValue(charts.buildingUsage, ['scheduledSlots']),
  );
  const hasTeacherCharts = hasPositiveValue(charts.assessmentCompletion, ['completed', 'total']);
  const hasStudentCharts = hasPositiveValue(charts.studentPerformance, ['grade', 'attendance']);

  if (hasAdminCharts || role === Role.ORG_ADMIN || role === Role.SUB_ADMIN) {
    return Boolean(
      hasPositiveValue(charts.enrollmentTrend, ['value']) ||
      hasPositiveValue(charts.cycleComparison, ['students', 'sections', 'cohorts', 'programOfferings', 'assessments', 'attendanceSessions']) ||
      hasPositiveValue(charts.programCoverage, ['activeEnrollments', 'openOfferings', 'mappedSections', 'activeCurricula']) ||
      hasPositiveValue(charts.sectionRelationships, ['components', 'linkedSections', 'enrolledStudents']) ||
      hasPositiveValue(charts.attendanceTrend, ['value']) ||
      hasPositiveValue(charts.mailStatus, ['count']) ||
      hasPositiveValue(charts.sectionCapacity, ['enrolled']) ||
      hasPositiveValue(charts.teacherWorkload, ['sections', 'students', 'weeklySlots']) ||
      hasPositiveValue(charts.departmentActivity, ['courses', 'sections', 'students', 'teachers']) ||
      hasPositiveValue(charts.departmentPerformance, ['averageGradePercent', 'attendanceRatePercent']) ||
      hasPositiveValue(charts.roomUsage, ['scheduledSlots']) ||
      hasPositiveValue(charts.buildingUsage, ['scheduledSlots']),
    );
  }

  if (hasTeacherCharts || role === Role.TEACHER || role === Role.ORG_MANAGER) {
    return Boolean(
      hasPositiveValue(charts.attendanceTrend, ['value']) ||
      hasPositiveValue(charts.gradeDistribution, ['count']) ||
      hasPositiveValue(charts.assessmentCompletion, ['completed', 'total']),
    );
  }

  if (hasStudentCharts || role === Role.STUDENT || role === Role.GUARDIAN) {
    return Boolean(
      hasPositiveValue(charts.attendanceTrend, ['value']) ||
      hasPositiveValue(charts.gradeDistribution, ['count']) ||
      hasPositiveValue(charts.studentPerformance, ['grade', 'attendance']),
    );
  }

  return false;
}

export function InsightChartsGrid({ role, charts }: { role: string; charts: InsightCharts }) {
  if (!charts) return null;

  if (
    hasPositiveValue(charts.moneyFlowTrend, ['income', 'expense', 'netFlow']) ||
    hasPositiveValue(charts.incomeSources, ['amount']) ||
    hasPositiveValue(charts.expenseSources, ['amount']) ||
    hasPositiveValue(charts.incomeSourceTrend, trendValueKeys(charts.incomeSourceTrend)) ||
    hasPositiveValue(charts.expenseSourceTrend, trendValueKeys(charts.expenseSourceTrend)) ||
    hasPositiveValue(charts.departmentFinance, ['expectedAmount', 'collectedAmount', 'pendingAmount', 'overdueAmount']) ||
    hasPositivePie(charts.collectionHealth?.chartData.map((item) => ({ value: item.amount }))) ||
    hasTopMonthValue(charts.topMonths)
  ) {
    return (
      <div className="space-y-6">
        {hasPositiveValue(charts.moneyFlowTrend, ['income', 'expense', 'netFlow']) && (
          <ChartPanel>
            <MoneyFlowChart data={charts.moneyFlowTrend ?? []} title="Money Flow Trend" />
          </ChartPanel>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.incomeSources, ['amount']) && (
            <ChartPanel>
              <InsightBarChart data={charts.incomeSources ?? []} dataKey="amount" nameKey="source" title="Income Sources" color={COLORS.success} horizontal disableHover />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.expenseSources, ['amount']) && (
            <ChartPanel>
              <InsightBarChart data={charts.expenseSources ?? []} dataKey="amount" nameKey="source" title="Expense Sources" color={COLORS.danger} horizontal disableHover />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.incomeSourceTrend, trendValueKeys(charts.incomeSourceTrend)) && (
            <ChartPanel>
              <MultiLineChart data={charts.incomeSourceTrend ?? []} title="Income Source Trend" />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.expenseSourceTrend, trendValueKeys(charts.expenseSourceTrend)) && (
            <ChartPanel>
              <MultiLineChart data={charts.expenseSourceTrend ?? []} title="Expense Source Trend" />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositivePie(charts.collectionHealth?.chartData.map((item) => ({ value: item.amount }))) && (
            <ChartPanel>
              <InsightPieChart data={charts.collectionHealth!.chartData.map((item) => ({ name: item.status, value: item.amount }))} title="Collection Health" />
            </ChartPanel>
          )}
          {hasTopMonthValue(charts.topMonths) && <TopMonthCards charts={charts} />}
        </div>
        {hasPositiveValue(charts.departmentFinance, ['expectedAmount', 'collectedAmount', 'pendingAmount', 'overdueAmount']) && (
          <ChartPanel>
            <GroupedBarChart
              data={charts.departmentFinance ?? []}
              nameKey="department"
              title="Finance by Department"
              horizontal
              valueFormatter={(value) => formatChartAmount(value)}
              bars={[
                { key: 'expectedAmount', name: 'Expected', color: COLORS.info },
                { key: 'collectedAmount', name: 'Collected', color: COLORS.success },
                { key: 'pendingAmount', name: 'Pending', color: COLORS.warning },
                { key: 'overdueAmount', name: 'Overdue', color: COLORS.danger },
              ]}
            />
          </ChartPanel>
        )}
      </div>
    );
  }

  const hasAdminCharts = Boolean(
    hasPositiveValue(charts.cycleComparison, ['students', 'sections', 'cohorts', 'programOfferings', 'assessments', 'attendanceSessions']) ||
    hasPositiveValue(charts.programCoverage, ['activeEnrollments', 'openOfferings', 'mappedSections', 'activeCurricula']) ||
    hasPositiveValue(charts.sectionRelationships, ['components', 'linkedSections', 'enrolledStudents']) ||
    hasPositiveValue(charts.enrollmentTrend, ['value']) ||
    hasPositiveValue(charts.attendanceTrend, ['value']) ||
    hasPositiveValue(charts.mailStatus, ['count']) ||
    hasPositiveValue(charts.sectionCapacity, ['enrolled']) ||
    hasPositiveValue(charts.teacherWorkload, ['sections', 'students', 'weeklySlots']) ||
    hasPositiveValue(charts.departmentActivity, ['courses', 'sections', 'students', 'teachers']) ||
    hasPositiveValue(charts.departmentPerformance, ['averageGradePercent', 'attendanceRatePercent']) ||
    hasPositiveValue(charts.roomUsage, ['scheduledSlots']) ||
    hasPositiveValue(charts.buildingUsage, ['scheduledSlots']),
  );
  const hasTeacherCharts = Boolean(
    hasPositiveValue(charts.attendanceTrend, ['value']) ||
    hasPositiveValue(charts.gradeDistribution, ['count']) ||
    hasPositiveValue(charts.assessmentCompletion, ['completed', 'total']),
  );
  const hasStudentCharts = Boolean(
    hasPositiveValue(charts.attendanceTrend, ['value']) ||
    hasPositiveValue(charts.gradeDistribution, ['count']) ||
    hasPositiveValue(charts.studentPerformance, ['grade', 'attendance']),
  );

  if (hasAdminCharts || role === Role.ORG_ADMIN || role === Role.SUB_ADMIN) {
    return (
      <div className="space-y-6">
        {hasPositiveValue(charts.cycleComparison, ['students', 'sections', 'cohorts', 'programOfferings', 'assessments', 'attendanceSessions']) && (
          <ChartPanel>
            <GroupedBarChart
              data={charts.cycleComparison ?? []}
              nameKey="cycle"
              title="Cycle Comparison"
              horizontal
              bars={[
                { key: 'students', name: 'Students', color: COLORS.info },
                { key: 'sections', name: 'Sections', color: COLORS.success },
                { key: 'cohorts', name: 'Cohorts', color: COLORS.warning },
                { key: 'programOfferings', name: 'Program Offerings', color: COLORS.purple },
                { key: 'assessments', name: 'Assessments', color: COLORS.primary },
                { key: 'attendanceSessions', name: 'Attendance Sessions', color: COLORS.teal },
              ]}
            />
          </ChartPanel>
        )}
        {hasPositiveValue(charts.programCoverage, ['activeEnrollments', 'openOfferings', 'mappedSections', 'activeCurricula']) && (
          <ChartPanel>
            <GroupedBarChart
              data={charts.programCoverage ?? []}
              nameKey="program"
              title="Program Coverage"
              horizontal
              bars={[
                { key: 'activeEnrollments', name: 'Active Enrollments', color: COLORS.info },
                { key: 'openOfferings', name: 'Open Offerings', color: COLORS.success },
                { key: 'mappedSections', name: 'Mapped Sections', color: COLORS.warning },
                { key: 'activeCurricula', name: 'Active Curricula', color: COLORS.purple },
              ]}
            />
          </ChartPanel>
        )}
        {hasPositiveValue(charts.sectionRelationships, ['components', 'linkedSections', 'enrolledStudents']) && (
          <ChartPanel>
            <GroupedBarChart
              data={charts.sectionRelationships ?? []}
              nameKey="course"
              title="Section Relationship Coverage"
              horizontal
              bars={[
                { key: 'components', name: 'Components', color: COLORS.primary },
                { key: 'linkedSections', name: 'Linked Sections', color: COLORS.success },
                { key: 'enrolledStudents', name: 'Student Links', color: COLORS.info },
              ]}
            />
          </ChartPanel>
        )}
        {hasPositiveValue(charts.enrollmentTrend, ['value']) && (
          <ChartPanel>
            <InsightLineChart data={charts.enrollmentTrend ?? []} title="New Student Trend" color={COLORS.info} />
          </ChartPanel>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.attendanceTrend, ['value']) && (
            <ChartPanel>
              <InsightLineChart data={charts.attendanceTrend ?? []} title="Attendance Coverage %" color={COLORS.success} />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.mailStatus, ['count']) && (
            <ChartPanel>
              <InsightPieChart data={(charts.mailStatus ?? []).map((item) => ({ name: item.status, value: item.count }))} title="Mail Status Distribution" />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.sectionCapacity, ['enrolled']) && (
            <ChartPanel>
              <InsightBarChart data={charts.sectionCapacity ?? []} dataKey="enrolled" nameKey="name" title="Largest Sections" color={COLORS.purple} disableHover />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.teacherWorkload, ['sections', 'students', 'weeklySlots']) && (
            <ChartPanel>
              <InsightBarChart data={charts.teacherWorkload ?? []} dataKey="weeklySlots" nameKey="name" title="Teaching Load" color={COLORS.warning} horizontal disableHover />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.departmentActivity, ['courses', 'sections', 'students', 'teachers']) && (
            <ChartPanel>
              <GroupedBarChart
                data={charts.departmentActivity ?? []}
                nameKey="department"
                title="Department Academic Footprint"
                horizontal
                bars={[
                  { key: 'students', name: 'Students', color: COLORS.info },
                  { key: 'teachers', name: 'Teachers', color: COLORS.warning },
                  { key: 'sections', name: 'Sections', color: COLORS.success },
                  { key: 'courses', name: 'Courses', color: COLORS.purple },
                ]}
              />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.departmentPerformance, ['averageGradePercent', 'attendanceRatePercent']) && (
            <ChartPanel>
              <GroupedBarChart
                data={charts.departmentPerformance ?? []}
                nameKey="department"
                title="Department Performance in Window"
                horizontal
                valueFormatter={(value) => `${value.toFixed(1)}%`}
                bars={[
                  { key: 'averageGradePercent', name: 'Avg Grade', color: COLORS.primary },
                  { key: 'attendanceRatePercent', name: 'Attendance', color: COLORS.success },
                ]}
              />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.roomUsage, ['scheduledSlots']) && (
            <ChartPanel>
              <InsightBarChart data={charts.roomUsage ?? []} dataKey="scheduledSlots" nameKey="room" title="Room Usage" color={COLORS.teal} horizontal disableHover />
            </ChartPanel>
          )}
        </div>
        {hasPositiveValue(charts.buildingUsage, ['scheduledSlots']) && (
          <ChartPanel>
            <InsightBarChart
              data={charts.buildingUsage ?? []}
              dataKey="scheduledSlots"
              nameKey="building"
              title="Building Scheduled Slots"
              color={COLORS.orange}
              horizontal
              disableHover
              categoryAxisWidth={132}
              height={Math.max(320, (charts.buildingUsage ?? []).length * 42)}
            />
          </ChartPanel>
        )}
      </div>
    );
  }

  if (hasTeacherCharts || role === Role.TEACHER || role === Role.ORG_MANAGER) {
    return (
      <div className="space-y-6">
        {hasPositiveValue(charts.attendanceTrend, ['value']) && (
          <ChartPanel>
            <InsightLineChart data={charts.attendanceTrend ?? []} title="Attendance Follow-Through Trend" color={COLORS.success} />
          </ChartPanel>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.gradeDistribution, ['count']) && (
            <ChartPanel>
              <InsightPieChart data={(charts.gradeDistribution ?? []).map((item) => ({ name: item.range, value: item.count }))} title="Grade Distribution" />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.assessmentCompletion, ['completed', 'total']) && (
            <ChartPanel>
              <CompletionBarChart data={charts.assessmentCompletion ?? []} title="Assessment Completion Rates" />
            </ChartPanel>
          )}
        </div>
      </div>
    );
  }

  if (hasStudentCharts || role === Role.STUDENT || role === Role.GUARDIAN) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hasPositiveValue(charts.attendanceTrend, ['value']) && (
            <ChartPanel>
              <InsightLineChart data={charts.attendanceTrend ?? []} title="Attendance Trend" color={COLORS.success} />
            </ChartPanel>
          )}
          {hasPositiveValue(charts.gradeDistribution, ['count']) && (
            <ChartPanel>
              <InsightPieChart data={(charts.gradeDistribution ?? []).map((item) => ({ name: item.range, value: item.count }))} title="Grade Distribution" />
            </ChartPanel>
          )}
        </div>
        {hasPositiveValue(charts.studentPerformance, ['grade', 'attendance']) && (
          <ChartPanel>
            <PerformanceChart data={charts.studentPerformance ?? []} title="Performance by Subject" />
          </ChartPanel>
        )}
      </div>
    );
  }

  return null;
}
