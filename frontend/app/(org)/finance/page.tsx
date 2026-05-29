'use client';

import React from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { Activity, AlertCircle, ArrowDownCircle, ArrowUpCircle, CheckCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { TransactionType } from '@/types';

interface StatCardProps {
    title: string;
    amount: number;
    icon: React.ElementType;
    colorClass: string;
    linkHref: string;
}

function StatCard({ title, amount, icon: Icon, colorClass, linkHref }: StatCardProps) {
    return (
        <Link href={linkHref} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <p className="text-sm font-bold text-muted-foreground">{title}</p>
                    <FinancialAmount amount={amount} className={`text-3xl ${colorClass}`} />
                </div>
                <div className={`p-3 rounded-xl ${colorClass.replace('text-', 'bg-').replace('/10', '')}/10`}>
                    <Icon className={`w-6 h-6 ${colorClass}`} />
                </div>
            </div>
            <div className="mt-4 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                View Details →
            </div>
        </Link>
    );
}

export default function FinanceOverviewPage() {
    const { token } = useAuth();

    const { data: stats, error, isLoading } = useSWR(
        token ? ['finance/stats', token] : null,
        ([, t]) => api.finance.getStats(t)
    );

    if (error) return <div className="text-danger p-6 font-bold">Failed to load finance overview.</div>;
    if (isLoading || !stats) return <div className="p-6">Loading dashboard...</div>;

    const netIncome = stats.totalCollectedIncome - stats.totalSalaryExpenses;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Collected Income"
                    amount={stats.totalCollectedIncome}
                    icon={ArrowUpCircle}
                    colorClass="text-success"
                    linkHref="/finance/transactions"
                />
                <StatCard
                    title="Total Overdue"
                    amount={stats.overdueAmount}
                    icon={AlertCircle}
                    colorClass="text-danger"
                    linkHref="/finance/entries?tab=OVERDUE"
                />
                <StatCard
                    title="Pending Confirmations"
                    amount={stats.pendingConfirmations}
                    icon={CheckCircle}
                    colorClass="text-warning"
                    linkHref="/finance/entries?tab=UNVERIFIED"
                />
                <StatCard
                    title="Total Salary Expenses"
                    amount={stats.totalSalaryExpenses}
                    icon={ArrowDownCircle}
                    colorClass="text-info"
                    linkHref="/finance/transactions"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Insight */}
                <div className="lg:col-span-2 bg-linear-to-br from-primary to-primary/80 rounded-3xl p-8 text-primary-foreground shadow-xl relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <TrendingUp className="w-48 h-48" />
                    </div>
                    <h3 className="text-lg font-bold opacity-80 mb-2">Net Health</h3>
                    <FinancialAmount amount={netIncome} className="text-5xl lg:text-6xl" />
                    <p className="mt-4 font-semibold opacity-90">
                        {netIncome >= 0
                            ? 'Your financial system is operating at a surplus.'
                            : 'Your system expenses currently exceed your collected income.'}
                    </p>
                </div>

                {/* Recent Transactions List */}
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-primary" />
                        <h3 className="font-black text-lg">Recent Transactions</h3>
                    </div>

                    <div className="space-y-4 flex-1">
                        {stats.recentTransactions.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No recent transactions found.</p>
                        ) : (
                            stats.recentTransactions.map(t => (
                                <div key={t.id} className="flex justify-between items-center pb-4 border-b border-border/50 last:border-0">
                                    <div>
                                        <p className="font-bold text-sm truncate max-w-37.5">{t.description || 'System Payment'}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">{new Date(t.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <FinancialAmount
                                        amount={t.amount}
                                        currency={t.currency}
                                        className={t.type === TransactionType.INCOME ? 'text-success' : 'text-danger'}
                                    />
                                </div>
                            ))
                        )}
                    </div>

                    <Link href="/finance/transactions" className="mt-4 pt-4 border-t border-border text-center text-sm font-bold text-primary hover:underline block">
                        View All Audit Logs →
                    </Link>
                </div>
            </div>
        </div>
    );
}
