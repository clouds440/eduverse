'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
    Activity,
    AlertCircle,
    ArrowDownCircle,
    ArrowRight,
    ArrowUpCircle,
    CheckCircle,
    TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ResourcePanel } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TransactionType } from '@/types';

interface StatCardProps {
    title: string;
    amount: number;
    icon: React.ElementType<{ className?: string }>;
    tone: 'success' | 'danger' | 'warning' | 'info';
    href: string;
    description: string;
}

const toneClasses: Record<StatCardProps['tone'], { text: string; bg: string; border: string }> = {
    success: { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
    danger: { text: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' },
    warning: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/25' },
    info: { text: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
};

function StatCard({ title, amount, icon: Icon, tone, href, description }: StatCardProps) {
    const toneClass = toneClasses[tone];

    return (
        <Link
            href={href}
            className="group flex min-h-36 flex-col justify-between rounded-lg border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/45 hover:bg-background/45"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</p>
                    <FinancialAmount amount={amount} className={`mt-2 block text-2xl ${toneClass.text}`} />
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${toneClass.border} ${toneClass.bg} ${toneClass.text}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs font-semibold text-muted-foreground">
                <span className="min-w-0 truncate">{description}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
        </Link>
    );
}

function FinanceOverviewSkeleton() {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-3">
                                <Skeleton className="h-3 w-32 rounded-md" />
                                <Skeleton className="h-8 w-40 rounded-md" />
                            </div>
                            <Skeleton className="h-10 w-10 rounded-md" />
                        </div>
                        <Skeleton className="mt-5 h-4 w-full rounded-md" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <Skeleton className="h-64 rounded-lg xl:col-span-2" />
                <Skeleton className="h-64 rounded-lg" />
            </div>
        </div>
    );
}

export default function FinanceOverviewPage() {
    const { token } = useAuth();

    const { data: stats, error, isLoading, mutate } = useSWR(
        token ? ['finance/stats', token] : null,
        ([, t]) => api.finance.getStats(t as string)
    );

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Finance overview could not load"
                description="The ledger summary is temporarily unavailable."
            />
        );
    }

    if (isLoading || !stats) {
        return <FinanceOverviewSkeleton />;
    }

    const netIncome = stats.totalCollectedIncome - stats.totalSalaryExpenses;
    const netVariant = netIncome >= 0 ? 'success' : 'warning';

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Collected Income"
                    amount={stats.totalCollectedIncome}
                    icon={ArrowUpCircle}
                    tone="success"
                    href="/finance/transactions"
                    description="Confirmed incoming payments"
                />
                <StatCard
                    title="Overdue"
                    amount={stats.overdueAmount}
                    icon={AlertCircle}
                    tone="danger"
                    href="/finance/entries?tab=OVERDUE"
                    description="Entries past due date"
                />
                <StatCard
                    title="Pending Review"
                    amount={stats.pendingConfirmations}
                    icon={CheckCircle}
                    tone="warning"
                    href="/finance/entries?tab=UNVERIFIED"
                    description="Claims awaiting confirmation"
                />
                <StatCard
                    title="Salary Expenses"
                    amount={stats.totalSalaryExpenses}
                    icon={ArrowDownCircle}
                    tone="info"
                    href="/finance/transactions"
                    description="Confirmed outgoing salary records"
                />
            </div>

            <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-3">
                <StatusBanner
                    title="Net ledger health"
                    variant={netVariant}
                    icon={TrendingUp}
                    className="xl:col-span-2"
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <FinancialAmount amount={netIncome} className="text-4xl text-current sm:text-5xl" />
                            <p className="mt-2 max-w-2xl text-sm font-semibold text-current/80">
                                {netIncome >= 0
                                    ? 'Collected income currently covers confirmed salary expenses.'
                                    : 'Confirmed salary expenses currently exceed collected income.'}
                            </p>
                        </div>
                        <Link
                            href="/finance/transactions"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-current/20 px-3 py-2 text-xs font-black text-current transition-colors hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                            Audit transactions
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </StatusBanner>

                <ResourcePanel className="min-h-72 flex-none">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-card/80 p-4">
                        <div className="flex min-w-0 items-center gap-2">
                            <Activity className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                            <h2 className="truncate text-base font-black">Recent Transactions</h2>
                        </div>
                        <Link href="/finance/transactions" className="text-xs font-black text-primary hover:underline">
                            View all
                        </Link>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                        {stats.recentTransactions.length === 0 ? (
                            <EmptyState
                                icon={Activity}
                                title="No recent transactions"
                                description="Confirmed payments and expenses will appear here."
                                size="sm"
                                className="min-h-56"
                            />
                        ) : (
                            <div className="space-y-2">
                                {stats.recentTransactions.map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="rounded-lg border border-border/60 bg-background/45 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-foreground">
                                                    {transaction.description || 'System payment'}
                                                </p>
                                                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {new Date(transaction.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <FinancialAmount
                                                amount={transaction.amount}
                                                currency={transaction.currency}
                                                className={transaction.type === TransactionType.INCOME ? 'text-success' : 'text-danger'}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ResourcePanel>
            </div>
        </div>
    );
}
