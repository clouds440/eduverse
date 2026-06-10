'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BadgeVariant, PaginatedResponse, Role, User, UserStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { matchesCacheKeyPrefix, CacheKeyPrefix } from '@/lib/swr';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader, PageShell, ResourcePanel, ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { BrandIcon } from '@/components/ui/Brand';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

interface RoleAccountParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    status?: string;
    deleted?: boolean;
}

interface RoleAccountListPageProps {
    labelSingular: string;
    labelPlural: string;
    description: string;
    routeBase: string;
    cacheKeyPrefix: CacheKeyPrefix;
    pageSizeKey: string;
    getAccounts: (token: string, params: RoleAccountParams) => Promise<PaginatedResponse<User>>;
    restoreAccount: (id: string, status: string, token: string) => Promise<{ message: string }>;
    deleteAccount: (id: string, token: string) => Promise<void>;
    allowedRoles?: Role[];
}

const statusConfig: Record<UserStatus, { label: string; variant: BadgeVariant }> = {
    [UserStatus.ACTIVE]: { label: 'Active', variant: 'success' },
    [UserStatus.SUSPENDED]: { label: 'Suspended', variant: 'error' },
    [UserStatus.ON_LEAVE]: { label: 'On Leave', variant: 'warning' },
    [UserStatus.ALUMNI]: { label: 'Alumni', variant: 'secondary' },
    [UserStatus.EMERITUS]: { label: 'Emeritus', variant: 'secondary' },
    [UserStatus.DELETED]: { label: 'Deleted', variant: 'neutral' },
};

export default function RoleAccountListPage({
    labelSingular,
    labelPlural,
    description,
    routeBase,
    cacheKeyPrefix,
    pageSizeKey,
    getAccounts,
    restoreAccount,
    deleteAccount,
    allowedRoles = [Role.ORG_ADMIN],
}: RoleAccountListPageProps) {
    const { token, user } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const { getBooleanParam, getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState<User | null>(null);

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const statusFilter = getStringParam('status');
    const isDeletedView = getBooleanParam('deleted');
    const [pageSize, setPageSize] = usePersistentPageSize(pageSizeKey, 10);

    const hasAccess = !!user?.role && allowedRoles.includes(user.role);

    useEffect(() => {
        if (user && !hasAccess) {
            router.replace('/overview');
        }
    }, [hasAccess, router, user]);

    const accountParams = useMemo<RoleAccountParams>(() => ({
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        status: isDeletedView ? undefined : statusFilter,
        deleted: isDeletedView,
    }), [page, pageSize, searchTerm, sortBy, sortOrder, statusFilter, isDeletedView]);

    const accountsKey = useMemo(() => {
        if (!token || !hasAccess) return null;
        return [cacheKeyPrefix, accountParams] as const;
    }, [accountParams, cacheKeyPrefix, hasAccess, token]);

    const { data: fetchedData, isLoading, error, mutate: mutateAccounts } = useSWR<PaginatedResponse<User>>(
        accountsKey,
        () => getAccounts(token!, accountParams)
    );

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const handleDeleteConfirm = async () => {
        if (!deletingAccount || !token) return;

        try {
            await deleteAccount(deletingAccount.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: `${labelSingular} removed from organization`, type: 'success' } });
            setDeleteDialogOpen(false);
            mutate(matchesCacheKeyPrefix(cacheKeyPrefix));
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : `Failed to delete ${labelSingular.toLowerCase()}`, type: 'error' } });
        }
    };

    const handleRestore = useCallback(async (id: string) => {
        if (!token) return;
        try {
            await restoreAccount(id, UserStatus.ACTIVE, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: `${labelSingular} restored successfully`, type: 'success' } });
            mutate(matchesCacheKeyPrefix(cacheKeyPrefix));
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : `Failed to restore ${labelSingular.toLowerCase()}`, type: 'error' } });
        }
    }, [cacheKeyPrefix, dispatch, labelSingular, restoreAccount, token]);

    const columns = useMemo<Column<User>[]>(() => [
        {
            header: labelSingular,
            sortable: true,
            sortKey: 'name',
            accessor: (row: User) => (
                <div className="flex items-center gap-3">
                    <BrandIcon variant="user" size="sm" user={row} className="w-10 h-10 shadow-sm" />
                    <div className="flex flex-col">
                        <div className="font-semibold text-card-foreground">{row.name || 'No Name'}</div>
                        <div className="text-sm text-muted-foreground">{row.email}</div>
                    </div>
                </div>
            ),
        },
        {
            header: 'Status',
            sortable: true,
            sortKey: 'status',
            badge: true,
            accessor: (row: User) => {
                const status = row.status || UserStatus.ACTIVE;
                const { label, variant } = statusConfig[status] || statusConfig[UserStatus.ACTIVE];
                return <Badge variant={variant}>{label}</Badge>;
            },
        },
        {
            header: 'Phone',
            sortable: true,
            sortKey: 'phone',
            accessor: (row: User) => row.phone || <span className="text-muted-foreground/30 italic">-</span>,
        },
        {
            header: 'Created',
            sortable: true,
            sortKey: 'createdAt',
            accessor: (row: User) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : <span className="text-muted-foreground/30 italic">-</span>,
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (row: User) => (
                <TableActions
                    onEdit={isDeletedView ? undefined : () => router.push(`${routeBase}/edit/${row.id}`)}
                    onDelete={isDeletedView ? undefined : () => {
                        setDeletingAccount(row);
                        setDeleteDialogOpen(true);
                    }}
                    variant="user"
                    isViewAndEdit={!isDeletedView}
                    extraActions={isDeletedView ? [
                        {
                            variant: 'restore' as const,
                            title: 'Restore',
                            onClick: () => handleRestore(row.id),
                        },
                    ] : []}
                />
            ),
        },
    ], [handleRestore, isDeletedView, labelSingular, routeBase, router]);

    const activeFilters: ActiveFilter[] = [
        ...(isDeletedView ? [{
            key: 'deleted',
            label: 'View',
            value: 'Deleted',
            onRemove: () => updateQueryParams({ deleted: undefined, page: 1 }),
        }] : []),
        ...(statusFilter ? [{
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onRemove: () => updateQueryParams({ status: undefined, page: 1 }),
        }] : []),
    ];

    if (!hasAccess) {
        return null;
    }

    if (error) {
        return <ErrorState error={error} onRetry={() => mutateAccounts()} />;
    }

    return (
        <PageShell>
            <PageHeader
                title={isDeletedView ? `Deleted ${labelPlural}` : labelPlural}
                description={description}
                icon={ShieldCheck}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: isDeletedView ? `Deleted ${labelPlural}` : labelPlural },
                ]}
                meta={isDeletedView ? <Badge variant="neutral" size="sm">Archive</Badge> : undefined}
            />

            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 bg-card/80 p-3 sm:p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="w-full flex-1">
                            <SearchBar value={searchTerm} onChange={(val) => updateQueryParams({ search: val, page: 1 })} placeholder={`Search ${labelPlural.toLowerCase()}...`} />
                        </div>

                        <div className="flex w-full justify-between gap-2 md:w-auto">
                            {!isDeletedView && (
                                <Drawer position="left">
                                    <div className="flex flex-col gap-8">
                                        <div>
                                            <label className="mb-1 block text-xs font-bold text-muted-foreground">
                                                Status
                                            </label>
                                            <CustomSelect
                                                options={[
                                                    { label: 'All Statuses', value: '' },
                                                    { label: 'Active', value: UserStatus.ACTIVE },
                                                    { label: 'Suspended', value: UserStatus.SUSPENDED },
                                                    { label: 'On Leave', value: UserStatus.ON_LEAVE },
                                                ]}
                                                value={statusFilter}
                                                onChange={(val) => updateQueryParams({ status: val, page: 1 })}
                                                placeholder="Filter Status"
                                            />
                                        </div>

                                        <button
                                            onClick={() => updateQueryParams({ deleted: 'true', page: 1, status: undefined })}
                                            className="cursor-pointer text-xs font-bold tracking-tighter text-muted-foreground/40 hover:text-primary hover:underline"
                                        >
                                            View Deleted {labelPlural}
                                        </button>
                                    </div>
                                </Drawer>
                            )}

                            {isDeletedView && (
                                <button
                                    onClick={() => updateQueryParams({ deleted: undefined, page: 1 })}
                                    className="cursor-pointer text-xs font-bold tracking-tighter text-primary hover:text-primary hover:underline"
                                >
                                    Back to Active {labelPlural}
                                </button>
                            )}

                            {!isDeletedView && (
                                <Button
                                    onClick={() => router.push(`${routeBase}/add`)}
                                    icon={UserPlus}
                                    className="shrink-0"
                                >
                                    Add {labelSingular}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <ResourceToolbar activeFilters={activeFilters} className="border-t border-border/60" />

                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isLoading}
                        onRowClick={(row) => {
                            if (!isDeletedView) router.push(`${routeBase}/edit/${row.id}`);
                        }}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        showSerialNumber
                        onPageChange={(p) => updateQueryParams({ page: p })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle={isDeletedView ? `No deleted ${labelPlural.toLowerCase()}` : `No ${labelPlural.toLowerCase()} found`}
                        emptyDescription={searchTerm || activeFilters.length > 0 ? 'Adjust the search or filters to broaden the result set.' : undefined}
                    />
                </div>
            </ResourcePanel>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Remove {labelSingular} <strong>{deletingAccount?.name}</strong></>}
                description={<>Are you sure you want to remove <strong>{deletingAccount?.email}</strong>?</>}
                confirmText="Delete"
                isDestructive
            />
        </PageShell>
    );
}
