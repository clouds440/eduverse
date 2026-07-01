'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, Receipt, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { BillingCycle, FinanceCategory, FinancialEntry, FinanceTab, FinanceTargetType, Role, EntryStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageTabs, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { useGlobal } from '@/context/GlobalContext';
import { FinancialAmount } from '@/components/finance/FinancialAmount';
import { TableActions } from '@/components/ui/TableActions';
import { FinanceStatusBadge } from '@/components/finance/FinanceStatusBadge';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { ClaimPaidModal } from './ClaimPaidModal';
import { ConfirmPaymentModal } from './ConfirmPaymentModal';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BillingCycleBadge } from '@/components/finance/BillingCycleBadge';
import { FinanceFilterGrid, FinanceFilterToolbar } from '../_components/FinanceFilterToolbar';
import { FinanceAttachments } from '@/components/finance/FinanceAttachments';
import { compareMoney } from '@/lib/money';

function labelize(value: string) {
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTargetLabel(entry: FinancialEntry) {
    if (entry.student?.user) return entry.student.user.name || entry.student.user.email;
    if (entry.teacher?.user) return entry.teacher.user.name || entry.teacher.user.email;
    if (entry.assignment?.student?.user) return entry.assignment.student.user.name || entry.assignment.student.user.email;
    if (entry.assignment?.teacher?.user) return entry.assignment.teacher.user.name || entry.assignment.teacher.user.email;
    if (entry.assignment?.entityName) return entry.assignment.entityName;
    return 'Unassigned target';
}

const tabLabels: Record<FinanceTab, string> = {
    [FinanceTab.ALL]: 'All',
    [FinanceTab.PENDING]: 'Pending',
    [FinanceTab.OVERDUE]: 'Overdue',
    [FinanceTab.UNVERIFIED]: 'Unverified',
    [FinanceTab.PAID]: 'Paid',
};

export default function EntriesPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const activeTab = (getStringParam('tab', FinanceTab.ALL) as FinanceTab);
    const page = getNumberParam('page', 1);
    const sortBy = getStringParam('sortBy', 'dueDate');
    const sortOrder = (getStringParam('sortOrder', 'desc') as 'asc' | 'desc');
    const targetType = getStringParam('targetType', '');
    const category = getStringParam('category', '');
    const billingCycle = getStringParam('billingCycle', '');
    const search = getStringParam('search', '');
    const dueFrom = getStringParam('dueFrom', '');
    const dueTo = getStringParam('dueTo', '');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-finance-entries-limit', 10);

    const [claimingEntry, setClaimingEntry] = useState<FinancialEntry | null>(null);
    const [confirmingEntry, setConfirmingEntry] = useState<FinancialEntry | null>(null);
    const [cancellingEntry, setCancellingEntry] = useState<FinancialEntry | null>(null);
    const [cancellationReason, setCancellationReason] = useState('');

    const { data: entriesRes, error, mutate, isLoading } = useSWR(
        token ? ['finance/entries', token, page, pageSize, targetType, category, billingCycle, search, dueFrom, dueTo] : null,
        ([, t]) => api.finance.getEntriesPage(t as string, {
            page,
            limit: pageSize,
            targetType: targetType || undefined,
            category: category || undefined,
            billingCycle: billingCycle || undefined,
            search: search || undefined,
            dueFrom: dueFrom || undefined,
            dueTo: dueTo || undefined,
        })
    );
    const entries = useMemo(() => entriesRes?.data || [], [entriesRes?.data]);

    const isManagement = user?.role === Role.ORG_ADMIN || user?.role === Role.FINANCE_MANAGER;
    const canSelfClaim = user?.role === Role.STUDENT || user?.role === Role.TEACHER || user?.role === Role.GUARDIAN;

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const filteredEntries = useMemo(() => {
        if (activeTab === FinanceTab.ALL) return entries;
        if (activeTab === FinanceTab.PENDING) return entries.filter(entry => entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL);
        if (activeTab === FinanceTab.OVERDUE) return entries.filter(entry => entry.status === EntryStatus.OVERDUE);
        if (activeTab === FinanceTab.UNVERIFIED) return entries.filter(entry => entry.status === EntryStatus.UNVERIFIED);
        if (activeTab === FinanceTab.PAID) return entries.filter(entry => entry.status === EntryStatus.PAID);
        return entries;
    }, [activeTab, entries]);

    const tabCounts = useMemo(() => {
        const source = entries || [];
        return {
            [FinanceTab.ALL]: source.length,
            [FinanceTab.PENDING]: source.filter(entry => entry.status === EntryStatus.PENDING || entry.status === EntryStatus.PARTIAL).length,
            [FinanceTab.OVERDUE]: source.filter(entry => entry.status === EntryStatus.OVERDUE).length,
            [FinanceTab.UNVERIFIED]: source.filter(entry => entry.status === EntryStatus.UNVERIFIED).length,
            [FinanceTab.PAID]: source.filter(entry => entry.status === EntryStatus.PAID).length,
        };
    }, [entries]);

    const uploadFinanceAttachments = async (entry: FinancialEntry, files: File[] = [], entityType: string) => {
        if (!token || files.length === 0) return [];
        const uploads = await Promise.all(
            files.map((file) => api.files.uploadFile(entry.organizationId, entityType, entry.id, file, token)),
        );
        return uploads.map((upload) => upload.id).filter((id): id is string => Boolean(id));
    };

    const handleClaim = async (data: { claimedAmount?: number; paymentMethod?: string; receiptUrl?: string; referenceNumber?: string; note?: string; attachmentFiles?: File[] }) => {
        if (!token || !claimingEntry) return;
        try {
            const { attachmentFiles, ...claimPayload } = data;
            const attachmentIds = await uploadFinanceAttachments(claimingEntry, attachmentFiles, 'FINANCE_PAYMENT_CLAIM');
            await api.finance.markEntryPaid(claimingEntry.id, { ...claimPayload, attachmentIds }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Payment claim submitted', type: 'success' } });
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to submit claim';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            throw error;
        }
    };

    const handleConfirm = async (data: { paidAmount?: number; claimId?: string; attachmentFiles?: File[] }) => {
        if (!token || !confirmingEntry) return;
        try {
            const { attachmentFiles, ...confirmPayload } = data;
            const attachmentIds = await uploadFinanceAttachments(confirmingEntry, attachmentFiles, 'FINANCE_PAYMENT_CONFIRMATION');
            await api.finance.confirmEntry(confirmingEntry.id, { ...confirmPayload, attachmentIds }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Payment confirmed securely', type: 'success' } });
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to confirm payment';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
            throw error;
        }
    };

    const handleCancelEntry = async () => {
        if (!token || !cancellingEntry) return;
        try {
            await api.finance.cancelEntry(cancellingEntry.id, { reason: cancellationReason.trim() || undefined }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Entry cancelled', type: 'success' } });
            setCancellationReason('');
            mutate();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to cancel entry';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        }
    };

    const columns = useMemo<Column<FinancialEntry>[]>(() => [
        {
            header: 'Entry',
            sortable: true,
            sortKey: 'title',
            accessor: (entry) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <Receipt className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{entry.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {getTargetLabel(entry)} • Due {new Date(entry.dueDate).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Target',
            sortable: true,
            sortKey: 'studentId',
            accessor: (entry) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{getTargetLabel(entry)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {labelize(entry.assignment?.targetType || (entry.teacherId ? FinanceTargetType.TEACHER : FinanceTargetType.STUDENT))}
                    </p>
                </div>
            ),
        },
        {
            header: 'Category',
            badge: true,
            accessor: (entry) => <Badge variant="neutral" size="sm">{entry.structure?.category ? labelize(entry.structure.category) : 'Manual'}</Badge>,
        },
        {
            header: 'Cycle',
            badge: true,
            accessor: (entry) => entry.structure?.billingCycle ? <BillingCycleBadge cycle={entry.structure.billingCycle} /> : <Badge variant="neutral" size="sm">Manual</Badge>,
        },
        {
            header: 'Amount',
            sortable: true,
            sortKey: 'amount',
            accessor: (entry) => <FinancialAmount amount={entry.amount} currency={entry.currency} />,
        },
        {
            header: 'Paid',
            sortable: true,
            sortKey: 'paidAmount',
            accessor: (entry) => <FinancialAmount amount={entry.paidAmount} currency={entry.currency} className="text-muted-foreground" />,
        },
        {
            header: 'Claim',
            accessor: (entry) => {
                const claim = entry.claims?.[0];
                if (!claim) return <span className="text-xs font-semibold text-muted-foreground">No claim</span>;
                return (
                    <div className="text-xs font-semibold text-muted-foreground">
                        <div>{labelize(claim.status)} • {claim.paymentMethod || 'Method n/a'}</div>
                        <div>{new Date(claim.claimedAt).toLocaleDateString()}</div>
                        <FinanceAttachments attachments={claim.attachments} compact />
                    </div>
                );
            },
        },
        {
            header: 'Attachments',
            accessor: (entry) => entry.attachments?.length
                ? <FinanceAttachments attachments={entry.attachments} compact />
                : <span className="text-xs font-semibold text-muted-foreground">None</span>,
        },
        {
            header: 'Status',
            badge: true,
            accessor: (entry) => <FinanceStatusBadge status={entry.status} />,
        },
        {
            header: 'Source',
            badge: true,
            accessor: (entry) => <Badge variant="neutral" size="sm">{entry.source}</Badge>,
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (entry) => {
                const canCancel = isManagement
                    && entry.status !== EntryStatus.CANCELLED
                    && entry.status !== EntryStatus.PAID
                    && compareMoney(entry.paidAmount, 0) <= 0
                    && !(entry.transactions?.length);

                if (entry.status === EntryStatus.PAID) {
                    return (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Fully paid
                        </span>
                    );
                }

                return (
                    <TableActions
                        isViewAndEdit={false}
                        extraActions={[
                            ...(canSelfClaim && entry.status !== EntryStatus.UNVERIFIED ? [{
                                variant: 'pay' as const,
                                title: 'Mark as Paid',
                                onClick: () => setClaimingEntry(entry),
                            }] : []),
                            ...(isManagement ? [{
                                variant: 'confirm' as const,
                                title: 'Confirm Payment',
                                onClick: () => setConfirmingEntry(entry),
                            }] : []),
                            ...(canCancel ? [{
                                variant: 'reject' as const,
                                title: 'Cancel Entry',
                                onClick: () => {
                                    setCancellationReason('');
                                    setCancellingEntry(entry);
                                },
                            }] : []),
                        ]}
                    />
                );
            },
        },
    ], [canSelfClaim, isManagement]);

    const sortedAndFilteredEntries = useMemo(() => {
        const result = [...filteredEntries];
        result.sort((a, b) => {
            const valA = a[sortBy as keyof FinancialEntry];
            const valB = b[sortBy as keyof FinancialEntry];
            if (valA === undefined || valB === undefined || valA === null || valB === null) return 0;
            if (sortBy === 'amount' || sortBy === 'paidAmount') {
                return sortOrder === 'asc'
                    ? compareMoney(valA as string, valB as string)
                    : compareMoney(valB as string, valA as string);
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [filteredEntries, sortBy, sortOrder]);

    const paginatedEntries = useMemo(() => {
        return sortedAndFilteredEntries;
    }, [sortedAndFilteredEntries]);

    const activeFilters: ActiveFilter[] = activeTab !== FinanceTab.ALL
        ? [{
            key: 'tab',
            label: 'Status',
            value: tabLabels[activeTab] || activeTab,
            onRemove: () => updateQueryParams({ tab: undefined, page: 1 }),
        }]
        : [];

    activeFilters.push(
        ...(targetType ? [{ key: 'targetType', label: 'Target', value: labelize(targetType), onRemove: () => updateQueryParams({ targetType: undefined, page: 1 }) }] : []),
        ...(category ? [{ key: 'category', label: 'Category', value: labelize(category), onRemove: () => updateQueryParams({ category: undefined, page: 1 }) }] : []),
        ...(billingCycle ? [{ key: 'billingCycle', label: 'Cycle', value: labelize(billingCycle), onRemove: () => updateQueryParams({ billingCycle: undefined, page: 1 }) }] : []),
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(dueFrom ? [{ key: 'dueFrom', label: 'From', value: dueFrom, onRemove: () => updateQueryParams({ dueFrom: undefined, page: 1 }) }] : []),
        ...(dueTo ? [{ key: 'dueTo', label: 'To', value: dueTo, onRemove: () => updateQueryParams({ dueTo: undefined, page: 1 }) }] : []),
    );

    const renderFilters = (mode: 'desktop' | 'mobile') => (
        <FinanceFilterGrid mode={mode}>
            <Input icon={Search} value={search} onChange={(event) => updateQueryParams({ search: event.target.value || undefined, page: 1 })} placeholder="Search target or entry" />
            <CustomSelect value={targetType} onChange={(value) => updateQueryParams({ targetType: value || undefined, page: 1 })} options={[{ value: '', label: 'All targets' }, ...Object.values(FinanceTargetType).map((value) => ({ value, label: labelize(value) }))]} />
            <CustomSelect value={category} onChange={(value) => updateQueryParams({ category: value || undefined, page: 1 })} options={[{ value: '', label: 'All categories' }, ...Object.values(FinanceCategory).map((value) => ({ value, label: labelize(value) }))]} searchable />
            <CustomSelect value={billingCycle} onChange={(value) => updateQueryParams({ billingCycle: value || undefined, page: 1 })} options={[{ value: '', label: 'All cycles' }, ...Object.values(BillingCycle).map((value) => ({ value, label: labelize(value) }))]} />
            <div className="space-y-1">
                {mode === 'mobile' && <span className="text-xs font-black uppercase text-muted-foreground">Due from</span>}
                <Input type="date" value={dueFrom} onChange={(event) => updateQueryParams({ dueFrom: event.target.value || undefined, page: 1 })} />
            </div>
            <div className="space-y-1">
                {mode === 'mobile' && <span className="text-xs font-black uppercase text-muted-foreground">Due to</span>}
                <Input type="date" value={dueTo} onChange={(event) => updateQueryParams({ dueTo: event.target.value || undefined, page: 1 })} />
            </div>
        </FinanceFilterGrid>
    );

    if (error) {
        return (
            <ErrorState
                error={error}
                onRetry={() => mutate()}
                title="Financial entries could not load"
                description="Invoices, salary entries, and payment claims are unavailable right now."
            />
        );
    }

    return (
        <ResourcePanel>
            <FinanceFilterToolbar
                drawerLabel="Entry filters"
                renderFilters={renderFilters}
                activeFilters={activeFilters}
                leading={(
                    <PageTabs
                        ariaLabel="Finance entry status"
                        items={Object.values(FinanceTab).map((tab) => ({ value: tab, label: tabLabels[tab], count: tabCounts[tab] }))}
                        activeValue={activeTab}
                        onValueChange={(tab) => updateQueryParams({ tab: tab === FinanceTab.ALL ? undefined : tab, page: 1 })}
                        size="sm"
                        tone="panel"
                        className="w-full lg:w-auto"
                    />
                )}
            />

            <div className="relative min-h-0 flex-1 overflow-x-hidden">
                <DataTable
                    data={paginatedEntries}
                    columns={columns}
                    keyExtractor={(entry) => entry.id}
                    onRowClick={(entry) => isManagement && entry.status !== EntryStatus.PAID ? setConfirmingEntry(entry) : undefined}
                    isLoading={isLoading}
                    showSerialNumber
                    currentPage={page}
                    totalPages={entriesRes?.totalPages || 1}
                    totalResults={entriesRes?.totalRecords || 0}
                    pageSize={pageSize}
                    onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                    onPageSizeChange={handlePageSizeChange}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                    maxHeight="100%"
                    emptyTitle="No financial entries found"
                    emptyDescription={activeTab !== FinanceTab.ALL ? 'Try another status tab to review additional entries.' : 'Entries will appear when structures generate billing or salary records.'}
                    mobileDetailLimit={3}
                />
            </div>

            {claimingEntry && (
                <ClaimPaidModal
                    isOpen={!!claimingEntry}
                    onClose={() => setClaimingEntry(null)}
                    entry={claimingEntry}
                    onSubmit={handleClaim}
                />
            )}

            {confirmingEntry && (
                <ConfirmPaymentModal
                    isOpen={!!confirmingEntry}
                    onClose={() => setConfirmingEntry(null)}
                    entry={confirmingEntry}
                    onConfirm={handleConfirm}
                />
            )}

            {cancellingEntry && (
                <ConfirmDialog
                    isOpen={!!cancellingEntry}
                    onClose={() => {
                        setCancellingEntry(null);
                        setCancellationReason('');
                    }}
                    onConfirm={handleCancelEntry}
                    title="Cancel entry"
                    description="This will cancel the unpaid entry and reject any pending payment claims on it. Paid entries must be corrected through reversals or refunds."
                    confirmText="Cancel entry"
                    isDestructive
                >
                    <Textarea
                        value={cancellationReason}
                        onChange={(event) => setCancellationReason(event.target.value)}
                        placeholder="Optional reason"
                        className="min-h-24"
                    />
                </ConfirmDialog>
            )}
        </ResourcePanel>
    );
}
