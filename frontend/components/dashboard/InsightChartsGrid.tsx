'use client';

import type { ReactNode } from 'react';
import { Role, type DashboardInsights } from '@/types';
import {
  COLORS,
  CompletionBarChart,
  InsightBarChart,
  InsightLineChart,
  InsightPieChart,
  MoneyFlowChart,
  MultiLineChart,
  PerformanceChart,
} from '@/components/charts/ChartComponents';

type InsightCharts = DashboardInsights['charts'];

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
    charts.moneyFlowTrend?.length ||
    charts.incomeSources?.length ||
    charts.expenseSources?.length ||
    charts.incomeSourceTrend?.length ||
    charts.expenseSourceTrend?.length ||
    charts.collectionHealth?.chartData.length ||
    charts.topMonths
  ) {
    return true;
  }

  const hasAdminCharts = Boolean(
    charts.enrollmentTrend?.length ||
    charts.mailStatus?.length ||
    charts.sectionCapacity?.length ||
    charts.teacherWorkload?.length,
  );
  const hasTeacherCharts = Boolean(charts.assessmentCompletion?.length);
  const hasStudentCharts = Boolean(charts.studentPerformance?.length);

  if (hasAdminCharts || role === Role.ORG_ADMIN || role === Role.SUB_ADMIN) {
    return Boolean(
      charts.enrollmentTrend?.length ||
      charts.attendanceTrend?.length ||
      charts.mailStatus?.length ||
      charts.sectionCapacity?.length ||
      charts.teacherWorkload?.length,
    );
  }

  if (hasTeacherCharts || role === Role.TEACHER || role === Role.ORG_MANAGER) {
    return Boolean(
      charts.attendanceTrend?.length ||
      charts.gradeDistribution?.length ||
      charts.assessmentCompletion?.length,
    );
  }

  if (hasStudentCharts || role === Role.STUDENT || role === Role.GUARDIAN) {
    return Boolean(
      charts.attendanceTrend?.length ||
      charts.gradeDistribution?.length ||
      charts.studentPerformance?.length,
    );
  }

  return false;
}

export function InsightChartsGrid({ role, charts }: { role: string; charts: InsightCharts }) {
  if (!charts) return null;

  if (
    charts.moneyFlowTrend?.length ||
    charts.incomeSources?.length ||
    charts.expenseSources?.length ||
    charts.incomeSourceTrend?.length ||
    charts.expenseSourceTrend?.length ||
    charts.collectionHealth?.chartData.length ||
    charts.topMonths
  ) {
    return (
      <div className="space-y-6">
        {charts.moneyFlowTrend && charts.moneyFlowTrend.length > 0 && (
          <ChartPanel>
            <MoneyFlowChart data={charts.moneyFlowTrend} title="Money Flow Trend" />
          </ChartPanel>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {charts.incomeSources && charts.incomeSources.length > 0 && (
            <ChartPanel>
              <InsightBarChart data={charts.incomeSources} dataKey="amount" nameKey="source" title="Income Sources" color={COLORS.success} horizontal disableHover />
            </ChartPanel>
          )}
          {charts.expenseSources && charts.expenseSources.length > 0 && (
            <ChartPanel>
              <InsightBarChart data={charts.expenseSources} dataKey="amount" nameKey="source" title="Expense Sources" color={COLORS.danger} horizontal disableHover />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {charts.incomeSourceTrend && charts.incomeSourceTrend.length > 0 && (
            <ChartPanel>
              <MultiLineChart data={charts.incomeSourceTrend} title="Income Source Trend" />
            </ChartPanel>
          )}
          {charts.expenseSourceTrend && charts.expenseSourceTrend.length > 0 && (
            <ChartPanel>
              <MultiLineChart data={charts.expenseSourceTrend} title="Expense Source Trend" />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {charts.collectionHealth && charts.collectionHealth.chartData.length > 0 && (
            <ChartPanel>
              <InsightPieChart data={charts.collectionHealth.chartData.map((item) => ({ name: item.status, value: item.amount }))} title="Collection Health" />
            </ChartPanel>
          )}
          <TopMonthCards charts={charts} />
        </div>
      </div>
    );
  }

  const hasAdminCharts = Boolean(
    charts.enrollmentTrend?.length ||
    charts.mailStatus?.length ||
    charts.sectionCapacity?.length ||
    charts.teacherWorkload?.length,
  );
  const hasTeacherCharts = Boolean(charts.assessmentCompletion?.length);
  const hasStudentCharts = Boolean(charts.studentPerformance?.length);

  if (hasAdminCharts || role === Role.ORG_ADMIN || role === Role.SUB_ADMIN) {
    return (
      <div className="space-y-6">
        {charts.enrollmentTrend && charts.enrollmentTrend.length > 0 && (
          <ChartPanel>
            <InsightLineChart data={charts.enrollmentTrend} title="Student Enrollment Trend" color={COLORS.info} />
          </ChartPanel>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {charts.attendanceTrend && charts.attendanceTrend.length > 0 && (
            <ChartPanel>
              <InsightLineChart data={charts.attendanceTrend} title="Attendance Coverage Trend" color={COLORS.success} />
            </ChartPanel>
          )}
          {charts.mailStatus && charts.mailStatus.length > 0 && (
            <ChartPanel>
              <InsightPieChart data={charts.mailStatus.map((item) => ({ name: item.status, value: item.count }))} title="Mail Status Distribution" />
            </ChartPanel>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {charts.sectionCapacity && charts.sectionCapacity.length > 0 && (
            <ChartPanel>
              <InsightBarChart data={charts.sectionCapacity} dataKey="enrolled" nameKey="name" title="Section Capacity" color={COLORS.purple} disableHover />
            </ChartPanel>
          )}
          {charts.teacherWorkload && charts.teacherWorkload.length > 0 && (
            <ChartPanel>
              <InsightBarChart data={charts.teacherWorkload} dataKey="sections" nameKey="name" title="Teacher Workload" color={COLORS.warning} horizontal disableHover />
            </ChartPanel>
          )}
        </div>
      </div>
    );
  }

  if (hasTeacherCharts || role === Role.TEACHER || role === Role.ORG_MANAGER) {
    return (
      <div className="space-y-6">
        {charts.attendanceTrend && charts.attendanceTrend.length > 0 && (
          <ChartPanel>
            <InsightLineChart data={charts.attendanceTrend} title="Attendance Follow-Through Trend" color={COLORS.success} />
          </ChartPanel>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {charts.gradeDistribution && charts.gradeDistribution.length > 0 && (
            <ChartPanel>
              <InsightPieChart data={charts.gradeDistribution.map((item) => ({ name: item.range, value: item.count }))} title="Grade Distribution" />
            </ChartPanel>
          )}
          {charts.assessmentCompletion && charts.assessmentCompletion.length > 0 && (
            <ChartPanel>
              <CompletionBarChart data={charts.assessmentCompletion} title="Assessment Completion Rates" />
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
          {charts.attendanceTrend && charts.attendanceTrend.length > 0 && (
            <ChartPanel>
              <InsightLineChart data={charts.attendanceTrend} title="Attendance Trend" color={COLORS.success} />
            </ChartPanel>
          )}
          {charts.gradeDistribution && charts.gradeDistribution.length > 0 && (
            <ChartPanel>
              <InsightPieChart data={charts.gradeDistribution.map((item) => ({ name: item.range, value: item.count }))} title="Grade Distribution" />
            </ChartPanel>
          )}
        </div>
        {charts.studentPerformance && charts.studentPerformance.length > 0 && (
          <ChartPanel>
            <PerformanceChart data={charts.studentPerformance} title="Performance by Subject" />
          </ChartPanel>
        )}
      </div>
    );
  }

  return null;
}
