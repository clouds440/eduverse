'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    CreditCard,
    FileText,
    Receipt,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import {
    BillingCycle,
    EntryStatus,
    FinancialEntry,
    FinancialStructure,
    Role,
    Transaction,
} from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { FinanceStatusBadge } from '@/components/finance/FinanceStatusBadge';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { ClaimPaidModal } from '@/app/(org)/finance/entries/ClaimPaidModal';
import { DismissiblePanel } from '@/components/ui/DismissiblePanel';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePageActionsHost } from '@/components/ui/PageActionsHost';
import type { ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { fuzzyFilterAndRank } from '@/lib/fuzzySearch';
import { moneySubtract, toMoneyNumber } from '@/lib/money';

const statusTabs = [
    { id: 'DUE', label: 'Due' },
    { id: 'UNVERIFIED', label: 'Awaiting approval' },
    { id: 'PAID', label: 'Paid' },
    { id: 'ALL', label: 'Fee book' },
] as const;

type FeeTab = typeof statusTabs[number]['id'];
const feeTabOptions = statusTabs.map((tab) => ({ value: tab.id, label: tab.label }));

interface StudentFeesViewProps {
    studentId: string;
    viewerRole: Role.STUDENT | Role.GUARDIAN;
    allowClaims?: boolean;
}

function formatDate(value?: string | null) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCycle(cycle: BillingCycle) {
    return cycle.toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

function getEntryBalance(entry: FinancialEntry) {
    return moneySubtract(entry.amount, entry.paidAmount);
}

function isPayable(entry: FinancialEntry) {
    return entry.status !== EntryStatus.PAID
        && entry.status !== EntryStatus.UNVERIFIED
        && entry.status !== EntryStatus.CANCELLED;
}

function FeeViewSkeleton() {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-lg" />
                ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
        </div>
    );
}

export function StudentFeesView({ studentId, viewerRole, allowClaims = true }: StudentFeesViewProps) {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const [activeTab, setActiveTab] = useState<FeeTab>('DUE');
    const [search, setSearch] = useState('');
    const [claimingEntry, setClaimingEntry] = useState<FinancialEntry | null>(null);

    const query = { studentId };
    const structuresKey = token && studentId ? ['student-fee-structures', viewerRole, studentId] as const : null;
    const entriesKey = token && studentId ? ['student-fee-entries', viewerRole, studentId] as const : null;
    const transactionsKey = token && studentId ? ['student-fee-transactions', viewerRole, studentId] as const : null;

    const { data: structures = [], error: structuresError, isLoading: structuresLoading, mutate: mutateStructures } = useSWR(
        structuresKey,
        () => api.finance.getStructures(token!, query)
    );
    const { data: entries = [], error: entriesError, isLoading: entriesLoading, mutate: mutateEntries } = useSWR(
        entriesKey,
        () => api.finance.getEntries(token!, query)
    );
    const { data: transactions = [], error: transactionsError, isLoading: transactionsLoading, mutate: mutateTransactions } = useSWR(
        transactionsKey,
        () => api.finance.getTransactions(token!, query)
    );

    const isLoading = structuresLoading || entriesLoading || transactionsLoading;
    const error = structuresError || entriesError || transactionsError;

    const stats = useMemo(() => {
        const dueEntries = entries.filter((entry) => entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL || entry.status === EntryStatus.OVERDUE);
        const awaitingApproval = entries.filter((entry) => entry.status === EntryStatus.UNVERIFIED);
        const paidEntries = entries.filter((entry) => entry.status === EntryStatus.PAID);
        return {
            dueAmount: dueEntries.reduce((sum, entry) => sum + getEntryBalance(entry), 0),
            awaitingCount: awaitingApproval.length,
            paidAmount: paidEntries.reduce((sum, entry) => sum + toMoneyNumber(entry.paidAmount), 0),
            dueEntries,
            awaitingApproval,
            paidEntries,
        };
    }, [entries]);

    const filteredStructures = useMemo(() => {
        return fuzzyFilterAndRank(structures, search, (structure: FinancialStructure) => [
            structure.title,
            structure.description,
            structure.category,
        ]);
    }, [search, structures]);

    const filteredEntries = useMemo(() => {
        const tabEntries = activeTab === 'DUE'
            ? stats.dueEntries
            : activeTab === 'UNVERIFIED'
                ? stats.awaitingApproval
                : activeTab === 'PAID'
                    ? stats.paidEntries
                    : entries;
        return fuzzyFilterAndRank(tabEntries, search, (entry) => [
            entry.title,
            entry.status,
            entry.structure?.title,
            entry.assignment?.entityName,
        ]);
    }, [activeTab, entries, search, stats]);

    const structureClaimEntries = useMemo(() => {
        const byStructureId = new Map<string, FinancialEntry>();
        entries
            .filter((entry) => entry.structureId && isPayable(entry))
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .forEach((entry) => {
                if (entry.structureId && !byStructureId.has(entry.structureId)) {
                    byStructureId.set(entry.structureId, entry);
                }
        });
        return byStructureId;
    }, [entries]);
    const activeFilters = useMemo<ActiveFilter[]>(() => [
        {
            key: 'feeBookStatus',
            label: 'Fee Book',
            value: statusTabs.find((tab) => tab.id === activeTab)?.label || 'Due',
            onRemove: () => setActiveTab('DUE'),
        },
    ], [activeTab]);
    const pageControls = useMemo(() => (
        <PageControls
            drawerLabel="Fee filters"
            activeFilters={activeFilters}
            leading={<SearchBar placeholder="Search fees or entries..." value={search} onChange={setSearch} mobileMode="expandable" />}
            renderFilters={() => (
                <FilterDrawerGrid>
                    <CustomSelect<FeeTab>
                        value={activeTab}
                        onChange={setActiveTab}
                        options={feeTabOptions}
                        placeholder="Fee book status"
                    />
                </FilterDrawerGrid>
            )}
        />
    ), [activeFilters, activeTab, search]);
    const controlsHosted = usePageActionsHost(error || isLoading ? null : pageControls);

    const handleClaim = async (data: { claimedAmount?: number; paymentMethod?: string; receiptUrl?: string; referenceNumber?: string; note?: string; attachmentFiles?: File[] }) => {
        if (!token || !claimingEntry) return;
        try {
            const { attachmentFiles, ...claimPayload } = data;
            const uploads = await Promise.all(
                (attachmentFiles || []).map((file) => api.files.uploadFile(claimingEntry.organizationId, 'FINANCE_PAYMENT_CLAIM', claimingEntry.id, file, token)),
            );
            const attachmentIds = uploads.map((upload) => upload.id).filter((id): id is string => Boolean(id));
            await api.finance.markEntryPaid(claimingEntry.id, { ...claimPayload, attachmentIds }, token);
            dispatch({
                type: 'TOAST_ADD',
                payload: { message: 'Payment claim submitted for approval', type: 'success' },
            });
            await Promise.all([mutateEntries(), mutateTransactions()]);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to submit payment claim';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            throw error;
        }
    };

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => {
                    mutateStructures();
                    mutateEntries();
                    mutateTransactions();
                }}
                title="Fees could not load"
                description="Fee structures and payment records are unavailable right now."
            />
        );
    }

    if (isLoading) return <FeeViewSkeleton />;

    return (
        <div className="space-y-4">
            <DismissiblePanel title="Fee summary" defaultCollapsedOnMobile>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Card padding="sm" hoverable={false}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Amount Due</p>
                                <FinancialAmount amount={stats.dueAmount} currency={entries[0]?.currency || structures[0]?.currency} className="mt-2 block text-2xl text-warning" />
                            </div>
                            <AlertCircle className="h-5 w-5 text-warning" />
                        </div>
                    </Card>
                    <Card padding="sm" hoverable={false}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Awaiting Approval</p>
                                <p className="mt-2 text-2xl font-black text-info">{stats.awaitingCount}</p>
                            </div>
                            <Clock className="h-5 w-5 text-info" />
                        </div>
                    </Card>
                    <Card padding="sm" hoverable={false}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Confirmed Paid</p>
                                <FinancialAmount amount={stats.paidAmount} currency={entries[0]?.currency || structures[0]?.currency} className="mt-2 block text-2xl text-success" />
                            </div>
                            <CheckCircle className="h-5 w-5 text-success" />
                        </div>
                    </Card>
                </div>
            </DismissiblePanel>

            {!controlsHosted && pageControls}

            <section className="space-y-3">
                <div>
                    <h2 className="text-base font-black text-foreground">Assigned Fee Structures</h2>
                    <p className="text-sm font-medium text-muted-foreground">Fee plans configured by the organization.</p>
                </div>

                {filteredStructures.length === 0 ? (
                    <EmptyState
                        icon={CreditCard}
                        title={structures.length === 0 ? 'No fee structures assigned' : 'No fee structures found'}
                        description={structures.length === 0 ? 'Assigned tuition, exam, transport, or other fee plans will appear here.' : 'Try another fee search.'}
                        size="sm"
                        className="min-h-56"
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                        {filteredStructures.map((structure: FinancialStructure) => {
                            const claimEntry = structureClaimEntries.get(structure.id);
                            return (
                                <Card key={structure.id} padding="sm" hoverable={false}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-foreground">{structure.title}</p>
                                            {structure.description && (
                                                <p className="mt-1 line-clamp-2 text-xs font-medium text-muted-foreground">{structure.description}</p>
                                            )}
                                        </div>
                                        <FinancialAmount amount={structure.amount} currency={structure.currency} className="shrink-0 text-primary" />
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-muted-foreground">Category</p>
                                            <p className="mt-1 text-foreground">{structure.category}</p>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-muted-foreground">Billing</p>
                                            <p className="mt-1 text-foreground">{formatCycle(structure.billingCycle)}</p>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-muted-foreground">Start</p>
                                            <p className="mt-1 text-foreground">{formatDate(structure.startDate)}</p>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-muted-foreground">Ends</p>
                                            <p className="mt-1 text-foreground">{formatDate(structure.endDate)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 border-t border-border/60 pt-3">
                                        {allowClaims && claimEntry ? (
                                            <Button
                                                type="button"
                                                icon={FileText}
                                                onClick={() => setClaimingEntry(claimEntry)}
                                                className="w-full"
                                            >
                                                Claim Paid
                                            </Button>
                                        ) : (
                                            <p className="rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-center text-xs font-bold text-muted-foreground">
                                                No payable entry for this fee right now
                                            </p>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div>
                    <div>
                        <h2 className="text-base font-black text-foreground">Fee Book</h2>
                        <p className="text-sm font-medium text-muted-foreground">Current and previous payment requests.</p>
                    </div>
                </div>

                {filteredEntries.length === 0 ? (
                    <EmptyState
                        icon={Receipt}
                        title="No fee entries found"
                        description="Try another fee book filter or check back when the organization generates entries."
                        size="sm"
                        className="min-h-56"
                    />
                ) : (
                    <div className="space-y-2">
                        {filteredEntries.map((entry: FinancialEntry) => (
                            <Card key={entry.id} padding="sm" hoverable={false}>
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                                            <Receipt className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-black text-foreground">{entry.title}</p>
                                                <FinanceStatusBadge status={entry.status} />
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                                Due {formatDate(entry.dueDate)}
                                                {entry.periodStart && entry.periodEnd ? ` - ${formatDate(entry.periodStart)} to ${formatDate(entry.periodEnd)}` : ''}
                                            </p>
                                            {entry.markedAt && entry.status === EntryStatus.UNVERIFIED && (
                                                <p className="mt-1 text-xs font-bold text-info">Submitted for approval on {formatDate(entry.markedAt)}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-96">
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-xs font-bold text-muted-foreground">Amount</p>
                                            <FinancialAmount amount={entry.amount} currency={entry.currency} className="mt-1 block text-sm text-foreground" />
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-xs font-bold text-muted-foreground">Paid</p>
                                            <FinancialAmount amount={entry.paidAmount} currency={entry.currency} className="mt-1 block text-sm text-success" />
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                                            <p className="text-xs font-bold text-muted-foreground">Balance</p>
                                            <FinancialAmount amount={getEntryBalance(entry)} currency={entry.currency} className="mt-1 block text-sm text-warning" />
                                        </div>
                                    </div>

                                    {entry.status === EntryStatus.PAID ? (
                                        <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs font-black text-success">
                                            <CheckCircle className="h-4 w-4" />
                                            Confirmed
                                        </span>
                                    ) : entry.status === EntryStatus.UNVERIFIED ? (
                                        <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-info/10 px-3 py-2 text-xs font-black text-info">
                                            <Clock className="h-4 w-4" />
                                            Awaiting approval
                                        </span>
                                    ) : allowClaims ? (
                                        <Button
                                            type="button"
                                            icon={FileText}
                                            onClick={() => setClaimingEntry(entry)}
                                            disabled={!isPayable(entry)}
                                            className="lg:w-36"
                                        >
                                            Mark Paid
                                        </Button>
                                    ) : null}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-base font-black text-foreground">Confirmed Transactions</h2>
                {transactions.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle}
                        title="No confirmed transactions"
                        description="Admin-confirmed payments will appear here."
                        size="sm"
                        className="min-h-48"
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {transactions.slice(0, 8).map((transaction: Transaction) => (
                            <div key={transaction.id} className="rounded-lg border border-border/70 bg-card p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-foreground">{transaction.description || 'Confirmed payment'}</p>
                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatDate(transaction.createdAt)}</p>
                                    </div>
                                    <FinancialAmount amount={transaction.amount} currency={transaction.currency} className="text-success" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {claimingEntry && (
                <ClaimPaidModal
                    isOpen={!!claimingEntry}
                    onClose={() => setClaimingEntry(null)}
                    entry={claimingEntry}
                    onSubmit={handleClaim}
                />
            )}
        </div>
    );
}
