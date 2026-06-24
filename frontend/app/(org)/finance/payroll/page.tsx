'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Mail, UserRound, Users, WalletCards } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageShell, PageTabs, ResourcePanel } from '@/components/ui/PageShell';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { FinanceTargetType, PayrollRosterRow, Role } from '@/types';

type PayrollTab = FinanceTargetType.TEACHER | FinanceTargetType.SUB_ADMIN | FinanceTargetType.FINANCE_MANAGER;

const tabs = [
    { value: FinanceTargetType.TEACHER, label: 'Teachers', icon: Users },
    { value: FinanceTargetType.SUB_ADMIN, label: 'Sub Admins', icon: UserRound },
    { value: FinanceTargetType.FINANCE_MANAGER, label: 'Finance Managers', icon: WalletCards },
] as const;

function labelize(value?: string | null) {
    if (!value) return 'N/A';
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function profileHref(row: PayrollRosterRow) {
    if (row.targetType === FinanceTargetType.TEACHER) return `/teachers/${row.user.id}/profile`;
    if (row.targetType === FinanceTargetType.SUB_ADMIN) return `/sub-admins/${row.user.id}/profile`;
    return `/finance-managers/${row.user.id}/profile`;
}

function StaffIdentity({ row }: { row: PayrollRosterRow }) {
    const initials = (row.user.name || row.user.email || '?')
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-primary/10 text-xs font-black text-primary">
                {row.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : initials}
            </div>
            <div className="min-w-0">
                <Link href={profileHref(row)} className="truncate font-black text-foreground transition-colors hover:text-primary">
                    {row.user.name || row.user.email}
                </Link>
                <p className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{row.user.email}</span>
                </p>
            </div>
        </div>
    );
}

export default function FinancePayrollPage() {
    const { token, user } = useAuth();
    const [activeTab, setActiveTab] = useState<PayrollTab>(FinanceTargetType.TEACHER);

    const { data, error, isLoading, mutate } = useSWR<PayrollRosterRow[]>(
        token ? ['finance/payroll', token, activeTab] : null,
        ([, t, targetType]) => api.finance.getPayroll(t as string, { targetType: targetType as PayrollTab })
    );

    const columns = useMemo<Column<PayrollRosterRow>[]>(() => [
        {
            header: 'Profile',
            accessor: (row) => <StaffIdentity row={row} />,
            width: 280,
        },
        {
            header: 'Role',
            accessor: (row) => <Badge variant="neutral">{labelize(row.user.role)}</Badge>,
            badge: true,
            width: 150,
        },
        {
            header: 'Status',
            accessor: (row) => <Badge variant={row.user.status === 'ACTIVE' ? 'success' : 'neutral'}>{labelize(row.user.status)}</Badge>,
            badge: true,
            width: 120,
        },
        {
            header: 'Assigned',
            accessor: (row) => <FinancialAmount amount={row.summary.assignedSalaryAmount} currency={row.summary.currency} />,
            width: 140,
        },
        {
            header: 'Received',
            accessor: (row) => <FinancialAmount amount={row.summary.receivedAmount} currency={row.summary.currency} className="text-success" />,
            width: 140,
        },
        {
            header: 'Outstanding',
            accessor: (row) => <FinancialAmount amount={row.summary.balanceAmount} currency={row.summary.currency} className={row.summary.balanceAmount > 0 ? 'text-warning' : 'text-muted-foreground'} />,
            width: 150,
        },
        {
            header: 'Entries',
            accessor: (row) => `${row.summary.entryCount} total / ${row.summary.pendingCount} pending / ${row.summary.overdueCount} overdue`,
            width: 220,
        },
    ], []);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    const rows = data || [];
    const canView = user?.role === Role.ORG_ADMIN || user?.role === Role.FINANCE_MANAGER || user?.role === Role.SUB_ADMIN;

    return (
        <PageShell className="p-2 sm:p-3">
            <ResourcePanel>
                <div className="shrink-0">
                    <PageTabs
                        ariaLabel="Payroll role tabs"
                        items={tabs}
                        activeValue={activeTab}
                        onValueChange={(value) => setActiveTab(value as PayrollTab)}
                        tone="panel"
                        size="sm"
                    />
                </div>

                <div className="min-h-0 flex-1 p-3">
                    {!canView ? (
                        <EmptyState icon={WalletCards} title="Payroll is not available" description="Your role does not have payroll roster access." />
                    ) : isLoading ? (
                        <Loading text="Loading payroll roster..." />
                    ) : error ? (
                        <ErrorState error={error} onRetry={() => mutate()} title="Payroll could not load" />
                    ) : (
                        <DataTable
                            data={rows}
                            columns={columns}
                            keyExtractor={(row) => `${row.targetType}:${row.teacherId || row.employeeUserId || row.user.id}`}
                            currentPage={1}
                            totalPages={1}
                            totalResults={rows.length}
                            pageSize={Math.max(rows.length, 10)}
                            onPageChange={() => { }}
                            showSerialNumber
                            emptyTitle="No payroll assignments"
                            emptyDescription="Assigned structures for this staff group will appear here."
                        />
                    )}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
