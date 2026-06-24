import { Injectable } from '@nestjs/common';
import { EntryStatus, FinanceTargetType, TransactionType } from '@/prisma/prisma-client';
import { InsightTone, Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildIntervalLabels,
  getIntervalLabel,
  getMonthLabel,
  previousEqualRange,
  resolveInsightDateRange,
  type InsightInterval,
} from '../shared/insights-date.util';
import type { FinanceInsightsQueryDto } from '../dto/insights-query.dto';
import { sortActivities } from '../shared/insights-activity.util';
import { formatCurrency, formatPercent, labelize } from '../shared/insights-format.util';
import type {
  DashboardInsightActivity,
  DashboardInsightItem,
  DashboardInsightsResponse,
  InsightsUser,
} from '../shared/insights.types';
import { getDepartmentFinanceInsights } from '../helpers/department-finance-insights.helper';

export type FinanceInsightsQuery = FinanceInsightsQueryDto;

export interface FinanceSourcePoint {
  source: string;
  amount: number;
  percentage: number;
}

export interface FinanceSourceTrendPoint {
  label: string;
  [sourceName: string]: string | number;
}

export interface FinanceInsightCharts {
  moneyFlowTrend: Array<{
    label: string;
    income: number;
    expense: number;
    netFlow: number;
  }>;
  incomeSources: FinanceSourcePoint[];
  expenseSources: FinanceSourcePoint[];
  incomeSourceTrend: FinanceSourceTrendPoint[];
  expenseSourceTrend: FinanceSourceTrendPoint[];
  topMonths: {
    highestIncomeMonth: { label: string; amount: number } | null;
    highestExpenseMonth: { label: string; amount: number } | null;
    bestNetFlowMonth: { label: string; amount: number } | null;
    worstNetFlowMonth: { label: string; amount: number } | null;
  };
  collectionHealth?: {
    collectedAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    collectionRatePercent: number;
    chartData: Array<{
      status: 'Collected' | 'Pending' | 'Overdue';
      amount: number;
    }>;
  };
  departmentFinance?: Array<{
    departmentId: string;
    department: string;
    expectedAmount: number;
    collectedAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    collectionRatePercent: number;
    estimated: boolean;
  }>;
  chartRecommendations: {
    moneyFlowTrend: 'ComposedChart';
    incomeSources: 'BarChart';
    expenseSources: 'BarChart';
    incomeSourceTrend: 'LineChart';
    expenseSourceTrend: 'LineChart';
    collectionHealth?: 'RadialBarChart' | 'PieChart';
    topMonths: 'BarChart' | 'Cards';
  };
}

type FinanceTransaction = Awaited<ReturnType<FinanceInsightsBuilder['getTransactions']>>[number];
type FinanceEntry = Awaited<ReturnType<FinanceInsightsBuilder['getEntriesForHealth']>>[number];

function moneyNumber(value: unknown): number {
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString(): string }).toString());
  }
  return Number(value || 0);
}

@Injectable()
export class FinanceInsightsBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    orgId: string,
    user: InsightsUser,
    query: FinanceInsightsQuery = {},
  ): Promise<DashboardInsightsResponse<FinanceInsightCharts>> {
    const selectedRange = this.resolveRange(query);
    const { from, to } = selectedRange;
    const interval = query.interval || selectedRange.interval;
    const organization = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { currency: true } });
    const currency = query.currency || organization?.currency || 'USD';
    const { previousFrom, previousTo } = previousEqualRange(from, to);

    const [transactions, previousTransactions, entries, recentEntries, departmentFinanceInsights] = await Promise.all([
      this.getTransactions(orgId, from, to, currency),
      this.getTransactions(orgId, previousFrom, previousTo, currency),
      this.getEntriesForHealth(orgId, currency),
      this.getRecentConfirmedEntries(orgId, currency),
      getDepartmentFinanceInsights(this.prisma, orgId, currency),
    ]);

    const totalIncome = this.sumTransactions(transactions, TransactionType.INCOME);
    const totalExpense = this.sumTransactions(transactions, TransactionType.EXPENSE);
    const previousIncome = this.sumTransactions(previousTransactions, TransactionType.INCOME);
    const previousExpense = this.sumTransactions(previousTransactions, TransactionType.EXPENSE);
    const netFlow = totalIncome - totalExpense;
    const previousNetFlow = previousIncome - previousExpense;
    const profitMarginPercent = totalIncome > 0 ? (netFlow / totalIncome) * 100 : 0;
    const incomeChangePercent = this.changePercent(totalIncome, previousIncome);
    const expenseChangePercent = this.changePercent(totalExpense, previousExpense);
    const netFlowChangePercent = this.changePercent(netFlow, previousNetFlow);

    const collection = this.getCollectionHealth(entries, totalIncome);
    const sourceSummary = this.getSourceSummaries(transactions);
    const moneyFlowTrend = this.getMoneyFlowTrend(transactions, from, to, interval);
    const topMonths = this.getTopMonths(transactions);
    const incomeSourceTrend = this.getSourceTrend(transactions, TransactionType.INCOME, sourceSummary.incomeSources, from, to, interval);
    const expenseSourceTrend = this.getSourceTrend(transactions, TransactionType.EXPENSE, sourceSummary.expenseSources, from, to, interval);

    const spotlight = this.getSpotlight({
      currency,
      netFlow,
      expenseChangePercent,
      collectionRatePercent: collection.collectionRatePercent,
      overdueAmount: collection.overdueAmount,
      bestNetFlowMonth: topMonths.bestNetFlowMonth,
      topIncomeSource: sourceSummary.incomeSources[0],
      topExpenseSource: sourceSummary.expenseSources[0],
    });

    const recentActivity = sortActivities(
      recentEntries.map((entry) => this.toRecentActivity(entry, currency)),
      10,
    );

    return {
      role: user.role || Role.FINANCE_MANAGER,
      filters: {
        selectedRange: selectedRange.range,
        interval,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      headline: {
        eyebrow: 'Finance Insights',
        title: 'Finance overview',
        subtitle: `Track confirmed cash flow, collection health, source concentration, and ledger movement for the selected ${selectedRange.range} window.`,
      },
      summaryCards: [
        {
          id: 'income',
          label: 'Income',
          value: formatCurrency(totalIncome, currency),
          detail: `${formatPercent(incomeChangePercent, 1)} vs previous period`,
          href: '/finance/transactions?type=INCOME',
          tone: incomeChangePercent >= 0 ? InsightTone.SUCCESS : InsightTone.WARNING,
        },
        {
          id: 'expenses',
          label: 'Expenses',
          value: formatCurrency(totalExpense, currency),
          detail: `${formatPercent(expenseChangePercent, 1)} vs previous period`,
          href: '/finance/transactions?type=EXPENSE',
          tone: expenseChangePercent > 20 ? InsightTone.WARNING : InsightTone.INFO,
        },
        {
          id: 'net-flow',
          label: 'Net Flow',
          value: formatCurrency(netFlow, currency),
          detail: `${formatPercent(netFlowChangePercent, 1)} vs previous period`,
          href: '/finance/transactions',
          tone: netFlow >= 0 ? InsightTone.SUCCESS : InsightTone.DANGER,
        },
        {
          id: 'profit-margin',
          label: 'Profit Margin',
          value: formatPercent(profitMarginPercent, 1),
          detail: `${formatCurrency(collection.pendingIncomeAmount + collection.overdueAmount, currency)} pending or overdue`,
          href: '/finance/entries',
          tone:
            profitMarginPercent >= 25
              ? InsightTone.SUCCESS
              : profitMarginPercent >= 0
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
        {
          id: 'collection-rate',
          label: 'Collection Rate',
          value: formatPercent(collection.collectionRatePercent, 1),
          detail: `${formatCurrency(collection.overdueAmount, currency)} overdue`,
          href: '/finance/entries',
          tone:
            collection.collectionRatePercent >= 85
              ? InsightTone.SUCCESS
              : collection.collectionRatePercent >= 70
                ? InsightTone.WARNING
                : InsightTone.DANGER,
        },
      ],
      spotlight,
      groups: [
        {
          id: 'cash-flow-alerts',
          title: 'Cash-flow alerts',
          description: 'Backend-generated signals from confirmed transactions and collectible entries.',
          items: this.getCashFlowAlerts(currency, {
            netFlow,
            incomeChangePercent,
            expenseChangePercent,
            overdueAmount: collection.overdueAmount,
            collectionRatePercent: collection.collectionRatePercent,
            highestExpenseMonth: topMonths.highestExpenseMonth,
            bestNetFlowMonth: topMonths.bestNetFlowMonth,
            topIncomeSource: sourceSummary.incomeSources[0],
            topExpenseSource: sourceSummary.expenseSources[0],
          }),
        },
        {
          id: 'top-sources',
          title: 'Top sources',
          description: 'Largest income and expense contributors in the selected period.',
          items: [
            ...sourceSummary.incomeSources.slice(0, 3).map((source) => this.toSourceItem(source, currency, 'income')),
            ...sourceSummary.expenseSources.slice(0, 3).map((source) => this.toSourceItem(source, currency, 'expense')),
          ],
        },
        {
          id: 'collection-health',
          title: 'Collection health',
          description: 'Open receivables and payable records separated from actual cash flow.',
          items: this.getCollectionItems(collection, currency),
        },
        ...(departmentFinanceInsights.group ? [departmentFinanceInsights.group] : []),
      ],
      recentActivity,
      charts: {
        moneyFlowTrend,
        incomeSources: sourceSummary.incomeSources,
        expenseSources: sourceSummary.expenseSources,
        incomeSourceTrend,
        expenseSourceTrend,
        topMonths,
        collectionHealth: {
          collectedAmount: totalIncome,
          pendingAmount: collection.pendingIncomeAmount,
          overdueAmount: collection.overdueAmount,
          collectionRatePercent: collection.collectionRatePercent,
          chartData: [
            { status: 'Collected', amount: totalIncome },
            { status: 'Pending', amount: collection.pendingIncomeAmount },
            { status: 'Overdue', amount: collection.overdueAmount },
          ],
        },
        departmentFinance: departmentFinanceInsights.chart,
        chartRecommendations: {
          moneyFlowTrend: 'ComposedChart',
          incomeSources: 'BarChart',
          expenseSources: 'BarChart',
          incomeSourceTrend: 'LineChart',
          expenseSourceTrend: 'LineChart',
          collectionHealth: 'PieChart',
          topMonths: 'Cards',
        },
      },
    };
  }

  private resolveRange(query: FinanceInsightsQuery) {
    return resolveInsightDateRange(query);
  }

  private getTransactions(orgId: string, from: Date, to: Date, currency: string) {
    return this.prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        currency,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        relatedEntry: {
          include: {
            structure: { select: { title: true, targetType: true, category: true, currency: true } },
            assignment: { select: { targetType: true, entityName: true, sourceType: true } },
            student: { select: { user: { select: { name: true } }, registrationNumber: true } },
            teacher: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });
  }

  private getEntriesForHealth(orgId: string, currency: string) {
    return this.prisma.financialEntry.findMany({
      where: {
        organizationId: orgId,
        status: { not: EntryStatus.CANCELLED },
        OR: [
          { structure: { currency } },
          { structureId: null },
        ],
      },
      include: {
        structure: { select: { currency: true, targetType: true, title: true, category: true } },
        assignment: { select: { targetType: true, entityName: true } },
      },
    });
  }

  private getRecentConfirmedEntries(orgId: string, currency: string) {
    return this.prisma.financialEntry.findMany({
      where: {
        organizationId: orgId,
        status: EntryStatus.PAID,
        confirmedByAdmin: true,
        OR: [
          { structure: { currency } },
          { structureId: null },
        ],
      },
      include: {
        structure: { select: { currency: true, targetType: true, title: true, category: true } },
        assignment: { select: { targetType: true, entityName: true } },
        student: { select: { user: { select: { name: true } }, registrationNumber: true } },
        teacher: { select: { user: { select: { name: true } } } },
      },
      orderBy: [{ confirmedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
    });
  }

  private sumTransactions(transactions: FinanceTransaction[], type: TransactionType) {
    return transactions
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + moneyNumber(transaction.amount), 0);
  }

  private changePercent(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  private sourceName(transaction: FinanceTransaction) {
    return transaction.relatedEntry?.structure?.title
      || transaction.relatedEntry?.assignment?.entityName
      || labelize(transaction.category);
  }

  private getSourceSummaries(transactions: FinanceTransaction[]) {
    const income = this.getSources(transactions, TransactionType.INCOME);
    const expense = this.getSources(transactions, TransactionType.EXPENSE);
    return {
      incomeSources: income,
      expenseSources: expense,
    };
  }

  private getSources(transactions: FinanceTransaction[], type: TransactionType): FinanceSourcePoint[] {
    const totals = new Map<string, number>();
    const filtered = transactions.filter((transaction) => transaction.type === type);
    const totalAmount = filtered.reduce((sum, transaction) => sum + moneyNumber(transaction.amount), 0);

    filtered.forEach((transaction) => {
      const source = this.sourceName(transaction);
      totals.set(source, (totals.get(source) || 0) + moneyNumber(transaction.amount));
    });

    return Array.from(totals.entries())
      .map(([source, amount]) => ({
        source,
        amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private getMoneyFlowTrend(
    transactions: FinanceTransaction[],
    from: Date,
    to: Date,
    interval: InsightInterval,
  ) {
    const rows = new Map(buildIntervalLabels(from, to, interval).map((label) => [
      label,
      { label, income: 0, expense: 0, netFlow: 0 },
    ]));

    transactions.forEach((transaction) => {
      const label = getIntervalLabel(transaction.createdAt, interval);
      const row = rows.get(label);
      if (!row) return;
      const amount = moneyNumber(transaction.amount);
      if (transaction.type === TransactionType.INCOME) row.income += amount;
      if (transaction.type === TransactionType.EXPENSE) row.expense += amount;
      row.netFlow = row.income - row.expense;
    });

    return Array.from(rows.values());
  }

  private getSourceTrend(
    transactions: FinanceTransaction[],
    type: TransactionType,
    sources: FinanceSourcePoint[],
    from: Date,
    to: Date,
    interval: InsightInterval,
  ): FinanceSourceTrendPoint[] {
    const topSources = sources.slice(0, 5).map((source) => source.source);
    const rows = new Map<string, FinanceSourceTrendPoint>();

    buildIntervalLabels(from, to, interval).forEach((label) => {
      const row: FinanceSourceTrendPoint = { label };
      topSources.forEach((source) => {
        row[source] = 0;
      });
      rows.set(label, row);
    });

    transactions
      .filter((transaction) => transaction.type === type && topSources.includes(this.sourceName(transaction)))
      .forEach((transaction) => {
        const label = getIntervalLabel(transaction.createdAt, interval);
        const row = rows.get(label);
        if (!row) return;
        const source = this.sourceName(transaction);
        row[source] = Number(row[source] || 0) + moneyNumber(transaction.amount);
      });

    return Array.from(rows.values());
  }

  private getTopMonths(transactions: FinanceTransaction[]) {
    const rows = new Map<string, { label: string; income: number; expense: number; netFlow: number }>();

    transactions.forEach((transaction) => {
      const label = getMonthLabel(transaction.createdAt);
      const row = rows.get(label) || { label, income: 0, expense: 0, netFlow: 0 };
      const amount = moneyNumber(transaction.amount);
      if (transaction.type === TransactionType.INCOME) row.income += amount;
      if (transaction.type === TransactionType.EXPENSE) row.expense += amount;
      row.netFlow = row.income - row.expense;
      rows.set(label, row);
    });

    const values = Array.from(rows.values());
    if (values.length === 0) {
      return {
        highestIncomeMonth: null,
        highestExpenseMonth: null,
        bestNetFlowMonth: null,
        worstNetFlowMonth: null,
      };
    }

    return {
      highestIncomeMonth: this.pickMonth(values, 'income', 'desc'),
      highestExpenseMonth: this.pickMonth(values, 'expense', 'desc'),
      bestNetFlowMonth: this.pickMonth(values, 'netFlow', 'desc'),
      worstNetFlowMonth: this.pickMonth(values, 'netFlow', 'asc'),
    };
  }

  private pickMonth(
    values: { label: string; income: number; expense: number; netFlow: number }[],
    key: 'income' | 'expense' | 'netFlow',
    direction: 'asc' | 'desc',
  ) {
    const sorted = [...values].sort((a, b) => direction === 'desc' ? b[key] - a[key] : a[key] - b[key]);
    const month = sorted[0];
    return month ? { label: month.label, amount: month[key] } : null;
  }

  private getCollectionHealth(entries: FinanceEntry[], collectedAmount: number) {
    const now = new Date();
    const pendingExpenseStatuses: EntryStatus[] = [
      EntryStatus.PENDING,
      EntryStatus.PARTIAL,
      EntryStatus.UNVERIFIED,
      EntryStatus.OVERDUE,
    ];
    const pendingIncomeStatuses: EntryStatus[] = [
      EntryStatus.PENDING,
      EntryStatus.PARTIAL,
      EntryStatus.UNVERIFIED,
    ];
    let pendingIncomeAmount = 0;
    let overdueAmount = 0;
    let pendingExpenseAmount = 0;

    entries.forEach((entry) => {
      const outstanding = Math.max(moneyNumber(entry.amount) - moneyNumber(entry.paidAmount), 0);
      if (outstanding <= 0) return;

      if (this.entryIsExpense(entry)) {
        if (pendingExpenseStatuses.includes(entry.status)) {
          pendingExpenseAmount += outstanding;
        }
        return;
      }

      if (entry.status === EntryStatus.OVERDUE || entry.dueDate < now) {
        overdueAmount += outstanding;
      } else if (pendingIncomeStatuses.includes(entry.status)) {
        pendingIncomeAmount += outstanding;
      }
    });

    const collectible = collectedAmount + pendingIncomeAmount + overdueAmount;
    const collectionRatePercent = collectible > 0 ? (collectedAmount / collectible) * 100 : 100;

    return {
      pendingIncomeAmount,
      overdueAmount,
      pendingExpenseAmount,
      collectionRatePercent,
    };
  }

  private entryIsExpense(entry: FinanceEntry) {
    const targetType = entry.assignment?.targetType || entry.structure?.targetType;
    return targetType === FinanceTargetType.TEACHER || targetType === FinanceTargetType.OTHER_EXPENSE || Boolean(entry.teacherId);
  }

  private getSpotlight(input: {
    currency: string;
    netFlow: number;
    expenseChangePercent: number;
    collectionRatePercent: number;
    overdueAmount: number;
    bestNetFlowMonth: { label: string; amount: number } | null;
    topIncomeSource: FinanceSourcePoint | undefined;
    topExpenseSource: FinanceSourcePoint | undefined;
  }): DashboardInsightItem | null {
    if (input.netFlow < 0) {
      return {
        id: 'negative-net-flow',
        title: 'Net flow is negative',
        description: 'Confirmed expenses are currently higher than confirmed income.',
        meta: formatCurrency(input.netFlow, input.currency),
        href: '/finance/transactions',
        badge: 'Cash-flow risk',
        tone: InsightTone.DANGER,
      };
    }

    if (input.expenseChangePercent >= 25) {
      return {
        id: 'expense-spike',
        title: 'Expenses increased sharply',
        description: 'Confirmed expenses rose against the previous equal period.',
        meta: formatPercent(input.expenseChangePercent, 1),
        href: '/finance/transactions?type=EXPENSE',
        badge: 'Expense spike',
        tone: InsightTone.WARNING,
      };
    }

    if (input.collectionRatePercent < 70) {
      return {
        id: 'low-collection-rate',
        title: 'Collection rate is low',
        description: 'Open receivables are weighing on the current collection picture.',
        meta: formatPercent(input.collectionRatePercent, 1),
        href: '/finance/entries',
        badge: 'Collection risk',
        tone: InsightTone.WARNING,
      };
    }

    if (input.topIncomeSource && input.topIncomeSource.percentage >= 60) {
      return {
        id: 'income-concentration',
        title: `${input.topIncomeSource.source} dominates income`,
        description: 'One source carries most confirmed income in the selected period.',
        meta: formatPercent(input.topIncomeSource.percentage, 1),
        href: '/finance/transactions?type=INCOME',
        badge: 'Concentration',
        tone: InsightTone.WARNING,
      };
    }

    if (input.topExpenseSource && input.topExpenseSource.percentage >= 60) {
      return {
        id: 'expense-concentration',
        title: `${input.topExpenseSource.source} dominates expenses`,
        description: 'One expense source is carrying most confirmed outflow.',
        meta: formatPercent(input.topExpenseSource.percentage, 1),
        href: '/finance/transactions?type=EXPENSE',
        badge: 'Concentration',
        tone: InsightTone.WARNING,
      };
    }

    if (input.overdueAmount > 0) {
      return {
        id: 'overdue-income',
        title: 'Overdue income needs follow-up',
        description: 'Past-due receivables are still outstanding.',
        meta: formatCurrency(input.overdueAmount, input.currency),
        href: '/finance/entries?tab=OVERDUE',
        badge: 'Overdue',
        tone: InsightTone.DANGER,
      };
    }

    if (input.bestNetFlowMonth) {
      return {
        id: 'best-net-flow-month',
        title: `${input.bestNetFlowMonth.label} led net flow`,
        description: 'Best confirmed cash-flow month in the selected range.',
        meta: formatCurrency(input.bestNetFlowMonth.amount, input.currency),
        href: '/finance/transactions',
        badge: 'Best month',
        tone: InsightTone.SUCCESS,
      };
    }

    if (input.topIncomeSource) {
      return {
        id: 'top-income-source',
        title: `${input.topIncomeSource.source} leads income`,
        description: 'Largest confirmed income source in the selected range.',
        meta: formatCurrency(input.topIncomeSource.amount, input.currency),
        href: '/finance/transactions?type=INCOME',
        badge: 'Top source',
        tone: InsightTone.INFO,
      };
    }

    return null;
  }

  private getCashFlowAlerts(
    currency: string,
    input: {
      netFlow: number;
      incomeChangePercent: number;
      expenseChangePercent: number;
      overdueAmount: number;
      collectionRatePercent: number;
      highestExpenseMonth: { label: string; amount: number } | null;
      bestNetFlowMonth: { label: string; amount: number } | null;
      topIncomeSource: FinanceSourcePoint | undefined;
      topExpenseSource: FinanceSourcePoint | undefined;
    },
  ) {
    const alerts: DashboardInsightItem[] = [];

    if (input.netFlow < 0) {
      alerts.push({
        id: 'cash-flow-negative',
        title: 'Negative net flow',
        description: 'Confirmed expenses exceeded confirmed income.',
        meta: formatCurrency(input.netFlow, currency),
        href: '/finance/transactions',
        badge: 'Risk',
        tone: InsightTone.DANGER,
      });
    }

    if (input.expenseChangePercent >= 25) {
      alerts.push({
        id: 'expenses-up',
        title: 'Expense spike',
        description: 'Expenses are sharply above the previous equal period.',
        meta: formatPercent(input.expenseChangePercent, 1),
        href: '/finance/transactions?type=EXPENSE',
        badge: 'Spike',
        tone: InsightTone.WARNING,
      });
    }

    if (input.incomeChangePercent <= -20) {
      alerts.push({
        id: 'income-down',
        title: 'Income dropped',
        description: 'Confirmed income is below the previous equal period.',
        meta: formatPercent(input.incomeChangePercent, 1),
        href: '/finance/transactions?type=INCOME',
        badge: 'Drop',
        tone: InsightTone.WARNING,
      });
    }

    if (input.overdueAmount > 0) {
      alerts.push({
        id: 'overdue-open',
        title: 'Overdue receivables',
        description: 'Past-due income entries are still outstanding.',
        meta: formatCurrency(input.overdueAmount, currency),
        href: '/finance/entries?tab=OVERDUE',
        badge: 'Overdue',
        tone: InsightTone.DANGER,
      });
    }

    if (input.collectionRatePercent < 70) {
      alerts.push({
        id: 'collection-low',
        title: 'Low collection rate',
        description: 'Collected income is low compared with open receivables.',
        meta: formatPercent(input.collectionRatePercent, 1),
        href: '/finance/entries',
        badge: 'Collection',
        tone: InsightTone.WARNING,
      });
    }

    if (input.topIncomeSource && input.topIncomeSource.percentage >= 60) {
      alerts.push({
        id: 'income-concentration',
        title: 'Income is concentrated',
        description: `${input.topIncomeSource.source} is the dominant confirmed income source.`,
        meta: formatPercent(input.topIncomeSource.percentage, 1),
        href: '/finance/transactions?type=INCOME',
        badge: 'Concentration',
        tone: InsightTone.WARNING,
      });
    }

    if (input.topExpenseSource && input.topExpenseSource.percentage >= 60) {
      alerts.push({
        id: 'expense-concentration',
        title: 'Expenses are concentrated',
        description: `${input.topExpenseSource.source} is the dominant confirmed expense source.`,
        meta: formatPercent(input.topExpenseSource.percentage, 1),
        href: '/finance/transactions?type=EXPENSE',
        badge: 'Concentration',
        tone: InsightTone.WARNING,
      });
    }

    if (input.highestExpenseMonth) {
      alerts.push({
        id: 'highest-expense-month',
        title: `${input.highestExpenseMonth.label} had the highest expenses`,
        description: 'Review source concentration for this period.',
        meta: formatCurrency(input.highestExpenseMonth.amount, currency),
        href: '/finance/transactions?type=EXPENSE',
        badge: 'Peak expense',
        tone: InsightTone.INFO,
      });
    }

    if (input.bestNetFlowMonth) {
      alerts.push({
        id: 'best-flow-month',
        title: `${input.bestNetFlowMonth.label} had the best net flow`,
        description: 'Use this month as a baseline for cash-flow review.',
        meta: formatCurrency(input.bestNetFlowMonth.amount, currency),
        href: '/finance/transactions',
        badge: 'Best flow',
        tone: InsightTone.SUCCESS,
      });
    }

    return alerts.slice(0, 6);
  }

  private toSourceItem(source: FinanceSourcePoint, currency: string, kind: 'income' | 'expense'): DashboardInsightItem {
    return {
      id: `${kind}:${source.source}`,
      title: source.source,
      description: `${kind === 'income' ? 'Income' : 'Expense'} source`,
      meta: `${formatCurrency(source.amount, currency)} (${formatPercent(source.percentage, 1)})`,
      href: `/finance/transactions?type=${kind === 'income' ? 'INCOME' : 'EXPENSE'}`,
      badge: kind === 'income' ? 'Income' : 'Expense',
      tone: kind === 'income' ? InsightTone.SUCCESS : InsightTone.WARNING,
    };
  }

  private getCollectionItems(
    collection: {
      pendingIncomeAmount: number;
      overdueAmount: number;
      pendingExpenseAmount: number;
      collectionRatePercent: number;
    },
    currency: string,
  ) {
    return [
      {
        id: 'pending-income',
        title: 'Pending income',
        description: 'Receivables not yet confirmed as collected.',
        meta: formatCurrency(collection.pendingIncomeAmount, currency),
        href: '/finance/entries?tab=PENDING',
        badge: 'Pending',
        tone: collection.pendingIncomeAmount > 0 ? InsightTone.WARNING : InsightTone.SUCCESS,
      },
      {
        id: 'overdue-income',
        title: 'Overdue income',
        description: 'Receivables past their due date.',
        meta: formatCurrency(collection.overdueAmount, currency),
        href: '/finance/entries?tab=OVERDUE',
        badge: 'Overdue',
        tone: collection.overdueAmount > 0 ? InsightTone.DANGER : InsightTone.SUCCESS,
      },
      {
        id: 'pending-expense',
        title: 'Pending expenses',
        description: 'Payables still open in the ledger.',
        meta: formatCurrency(collection.pendingExpenseAmount, currency),
        href: '/finance/entries',
        badge: 'Payables',
        tone: collection.pendingExpenseAmount > 0 ? InsightTone.INFO : InsightTone.SUCCESS,
      },
      {
        id: 'collection-rate',
        title: 'Collection rate',
        description: 'Collected income against collected plus open receivables.',
        meta: formatPercent(collection.collectionRatePercent, 1),
        href: '/finance/entries',
        badge: 'Rate',
        tone:
          collection.collectionRatePercent >= 85
            ? InsightTone.SUCCESS
            : collection.collectionRatePercent >= 70
              ? InsightTone.WARNING
              : InsightTone.DANGER,
      },
    ];
  }

  private toRecentActivity(entry: Awaited<ReturnType<FinanceInsightsBuilder['getRecentConfirmedEntries']>>[number], currency: string): DashboardInsightActivity {
    const isExpense = this.entryIsExpense(entry);
    const person = entry.student?.user.name || entry.student?.registrationNumber || entry.teacher?.user.name || entry.assignment?.entityName;
    return {
      id: `finance-entry:${entry.id}`,
      title: isExpense ? 'Expense confirmed' : 'Income confirmed',
      description: person ? `${entry.title} - ${person}` : entry.title,
      createdAt: (entry.confirmedAt || entry.updatedAt).toISOString(),
      href: '/finance/entries?tab=PAID',
      tone: isExpense ? InsightTone.WARNING : InsightTone.SUCCESS,
    };
  }
}
