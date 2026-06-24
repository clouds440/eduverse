'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { CalendarDays, Clock, Receipt, Wallet, WalletCards } from 'lucide-react';
import { api } from '@/lib/api';
import { EntryStatus, FinancialEntry, FinancialStructure, TeacherFinanceOverview } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { FinanceStatusBadge } from '@/components/finance/FinanceStatusBadge';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { BillingCycleBadge } from '@/components/finance/BillingCycleBadge';
import { moneySubtract, toMoneyNumber } from '@/lib/money';

function formatDate(value?: string | null) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
}

function labelize(value?: string | null) {
    if (!value) return 'N/A';
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatCard({ label, value, detail, tone = 'neutral' }: { label: string; value: React.ReactNode; detail?: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }) {
    const toneClass = {
        neutral: 'border-border/70 bg-card text-foreground',
        primary: 'border-primary/20 bg-primary/10 text-primary',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        danger: 'border-danger/20 bg-danger/10 text-danger',
    }[tone];

    return (
        <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
            <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
            <div className="mt-2 text-2xl font-black">{value}</div>
            {detail && <p className="mt-1 text-xs font-semibold opacity-75">{detail}</p>}
        </div>
    );
}

export default function TeacherFinancePage() {
    const { token } = useAuth();
    const { data, error, isLoading, mutate } = useSWR<TeacherFinanceOverview>(
        token ? ['teacher-finance-overview', token] : null,
        ([, t]) => api.finance.getMyPayroll(t as string)
    );

    const entryColumns = useMemo<Column<FinancialEntry>[]>(() => [
        {
            header: 'Entry',
            accessor: (entry) => (
                <div className="min-w-0">
                    <p className="truncate font-black text-foreground">{entry.title}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">Due {formatDate(entry.dueDate)}</p>
                </div>
            ),
            width: 260,
        },
        {
            header: 'Period',
            accessor: (entry) => `${formatDate(entry.periodStart)} - ${formatDate(entry.periodEnd)}`,
            width: 220,
        },
        {
            header: 'Amount',
            accessor: (entry) => <FinancialAmount amount={entry.amount} currency={entry.currency} />,
            width: 140,
        },
        {
            header: 'Received',
            accessor: (entry) => <FinancialAmount amount={entry.paidAmount} currency={entry.currency} className="text-success" />,
            width: 140,
        },
        {
            header: 'Balance',
            accessor: (entry) => <FinancialAmount amount={moneySubtract(entry.amount, entry.paidAmount)} currency={entry.currency} className={entry.status === EntryStatus.PAID ? 'text-muted-foreground' : 'text-warning'} />,
            width: 140,
        },
        {
            header: 'Status',
            accessor: (entry) => <FinanceStatusBadge status={entry.status} />,
            badge: true,
            width: 130,
        },
    ], []);

    const structureColumns = useMemo<Column<FinancialStructure>[]>(() => [
        {
            header: 'Assigned Salary',
            accessor: (structure) => (
                <div className="min-w-0">
                    <p className="truncate font-black text-foreground">{structure.title}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">{labelize(structure.category)}</p>
                </div>
            ),
            width: 260,
        },
        {
            header: 'Cycle',
            accessor: (structure) => <BillingCycleBadge cycle={structure.billingCycle} />,
            badge: true,
            width: 140,
        },
        {
            header: 'Amount',
            accessor: (structure) => <FinancialAmount amount={structure.amount} currency={structure.currency} />,
            width: 150,
        },
        {
            header: 'Active From',
            accessor: (structure) => formatDate(structure.startDate),
            width: 140,
        },
        {
            header: 'Ends',
            accessor: (structure) => formatDate(structure.endDate),
            width: 140,
        },
        {
            header: 'Status',
            accessor: (structure) => <Badge variant={structure.isActive ? 'success' : 'neutral'}>{structure.isActive ? 'Active' : 'Inactive'}</Badge>,
            badge: true,
            width: 120,
        },
    ], []);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    return (
        <PageShell>
            <PageHeader
                title="My Finance"
                description="Review assigned salary, received payments, balances, and overdue salary records. This panel is read-only."
                icon={Wallet}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'My Finance' },
                ]}
                meta={data ? <Badge variant="neutral" size="sm">{data.summary.entryCount} entries</Badge> : undefined}
            />

            <ResourcePanel className="overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                {isLoading ? (
                    <Loading text="Loading finance overview..." />
                ) : error ? (
                    <ErrorState error={error} onRetry={() => mutate()} title="Teacher finance could not load" />
                ) : !data ? (
                    <EmptyState icon={WalletCards} title="No finance records" description="Salary assignments and entries will appear here when available." />
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <StatCard label="Assigned Salary" value={<FinancialAmount amount={data.summary.assignedSalaryAmount} currency={data.summary.currency} />} detail={`${data.summary.activeStructureCount} active assignment${data.summary.activeStructureCount === 1 ? '' : 's'}`} tone="primary" />
                            <StatCard label="Received" value={<FinancialAmount amount={data.summary.receivedAmount} currency={data.summary.currency} />} detail={`${data.summary.paidCount} paid entries`} tone="success" />
                            <StatCard label="Outstanding" value={<FinancialAmount amount={data.summary.balanceAmount} currency={data.summary.currency} />} detail={`${data.summary.pendingCount} pending entries`} tone="warning" />
                            <StatCard label="Overdue" value={<FinancialAmount amount={data.summary.overdueAmount} currency={data.summary.currency} />} detail={`${data.summary.overdueCount} overdue entries`} tone={toMoneyNumber(data.summary.overdueAmount) > 0 ? 'danger' : 'neutral'} />
                        </div>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h2 className="text-sm font-black uppercase tracking-wide text-foreground">Recent Salary Entries</h2>
                            </div>
                            <DataTable
                                data={data.recentEntries}
                                columns={entryColumns}
                                keyExtractor={(entry) => entry.id}
                                currentPage={1}
                                totalPages={1}
                                totalResults={data.recentEntries.length}
                                pageSize={Math.max(data.recentEntries.length, 5)}
                                onPageChange={() => { }}
                                showSerialNumber
                                emptyTitle="No salary entries"
                                emptyDescription="Generated salary entries will appear here."
                            />
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h2 className="text-sm font-black uppercase tracking-wide text-foreground">Assigned Salary Structures</h2>
                            </div>
                            <DataTable
                                data={data.structures}
                                columns={structureColumns}
                                keyExtractor={(structure) => structure.id}
                                currentPage={1}
                                totalPages={1}
                                totalResults={data.structures.length}
                                pageSize={Math.max(data.structures.length, 5)}
                                onPageChange={() => { }}
                                showSerialNumber
                                emptyTitle="No assigned salary"
                                emptyDescription="Active salary structures assigned to you will appear here."
                            />
                        </section>

                        {data.overdueEntries.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-danger" aria-hidden="true" />
                                    <h2 className="text-sm font-black uppercase tracking-wide text-foreground">Overdue Salary Entries</h2>
                                </div>
                                <DataTable
                                    data={data.overdueEntries}
                                    columns={entryColumns}
                                    keyExtractor={(entry) => entry.id}
                                    currentPage={1}
                                    totalPages={1}
                                    totalResults={data.overdueEntries.length}
                                    pageSize={Math.max(data.overdueEntries.length, 5)}
                                    onPageChange={() => { }}
                                    showSerialNumber
                                    emptyTitle="No overdue entries"
                                />
                            </section>
                        )}
                    </div>
                )}
            </ResourcePanel>
        </PageShell>
    );
}
