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
import { PageShell, PageTabs, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { FinanceTargetType, PayrollRosterRow, Role } from '@/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePageActionsHost } from '@/components/ui/PageActionsHost';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { BrandIcon } from '@/components/ui/Brand';

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
    if (row.targetType === FinanceTargetType.TEACHER) return `/teacher/${row.user.id}/profile`;
    if (row.targetType === FinanceTargetType.SUB_ADMIN) return `/sub-admin/${row.user.id}/profile`;
    return `/finance-manager/${row.user.id}/profile`;
}

function StaffIdentity({ row }: { row: PayrollRosterRow }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <BrandIcon
                variant="user"
                size="md"
                user={row.user}
                initialsFallback
                imageLoading="lazy"
            />
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
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-payroll-limit', 10);

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

    const rows = useMemo(() => data || [], [data]);
    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((row) => [
            row.user.name,
            row.user.email,
            row.user.role,
        ].some((value) => String(value || '').toLowerCase().includes(query)));
    }, [rows, search]);
    const activeFilters = useMemo<ActiveFilter[]>(() => (
        search ? [{
            key: 'search',
            label: 'Search',
            value: search,
            onRemove: () => {
                setSearch('');
                setPage(1);
            },
        }] : []
    ), [search]);
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [currentPage, filteredRows, pageSize]);
    const handlePageSizeChange = (nextSize: number) => {
        setPageSize(nextSize);
        setPage(1);
    };
    const pageControls = useMemo(() => (
        <PageControls
            drawerLabel="Payroll filters"
            activeFilters={activeFilters}
            showDrawer={false}
            leading={(
                <SearchBar
                    value={search}
                    onChange={(value) => {
                        setSearch(value);
                        setPage(1);
                    }}
                    placeholder="Search by user name"
                    delay={300}
                    mobileMode="expandable"
                />
            )}
            renderFilters={() => null}
        />
    ), [activeFilters, search]);
    const controlsHosted = usePageActionsHost(pageControls);

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    const canView = user?.role === Role.ORG_ADMIN || user?.role === Role.FINANCE_MANAGER || user?.role === Role.SUB_ADMIN;

    return (
        <PageShell>
            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 bg-card/95">
                    <PageTabs
                        ariaLabel="Payroll role tabs"
                        items={tabs}
                        activeValue={activeTab}
                        onValueChange={(value) => {
                            setActiveTab(value as PayrollTab);
                            setPage(1);
                        }}
                        tone="panel"
                        size="sm"
                    />
                </div>
                {!controlsHosted && <div className="shrink-0 border-b border-border/60 bg-card/95">{pageControls}</div>}

                <div className="min-h-0 flex-1">
                    {!canView ? (
                        <EmptyState icon={WalletCards} title="Payroll is not available" description="Your role does not have payroll roster access." />
                    ) : isLoading ? (
                        <Loading text="Loading payroll roster..." />
                    ) : error ? (
                        <ErrorState error={error} onRetry={() => mutate()} title="Payroll could not load" />
                    ) : (
                        <DataTable
                            data={paginatedRows}
                            columns={columns}
                            keyExtractor={(row) => `${row.targetType}:${row.teacherId || row.employeeUserId || row.user.id}`}
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalResults={filteredRows.length}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={handlePageSizeChange}
                            maxHeight="100%"
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
