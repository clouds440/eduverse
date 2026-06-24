'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Plus, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { AcademicCycle, ApiError, Cohort, Role } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { DocsLink } from '@/components/ui/DocsLink';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

export default function CohortsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const academicCycleId = getStringParam('academicCycleId');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-cohorts-limit', 10);

    const cohortParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        academicCycleId: academicCycleId || undefined,
    };

    const cohortsKey = token ? ['cohorts', cohortParams] as const : null;
    const { data: fetchedData, isLoading: isFetching, error: cohortsError, mutate: mutateCohorts } = useSWR<
        { data: Cohort[]; totalPages: number; totalRecords: number }
    >(cohortsKey);

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCohort, setDeletingCohort] = useState<Cohort | null>(null);

    const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    useEffect(() => {
        if (user?.role === Role.STUDENT) {
            router.replace(`/students/${user.id}`);
        }
    }, [router, user]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const handleDeleteConfirm = async () => {
        if (!deletingCohort || !token) return;

        try {
            await api.cohorts.deleteCohort(deletingCohort.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Cohort deleted successfully', type: 'success' } });
            setDeleteDialogOpen(false);
            mutate(matchesCacheKeyPrefix('cohorts'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error deleting cohort';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        }
    };

    const activeFilters: ActiveFilter[] = [
        ...(searchTerm ? [{
            key: 'search',
            label: 'Search',
            value: searchTerm,
            onRemove: () => updateQueryParams({ search: undefined, page: 1 }),
        }] : []),
        ...(academicCycleId ? [{
            key: 'academicCycleId',
            label: 'Cycle',
            value: (() => {
                const cycle = cyclesData?.data?.find((item) => item.id === academicCycleId);
                return cycle ? (cycle.code ? `${cycle.code} - ${cycle.name}` : cycle.name) : 'Selected cycle';
            })(),
            onRemove: () => updateQueryParams({ academicCycleId: undefined, page: 1 }),
        }] : []),
    ];

    const columns = useMemo<Column<Cohort>[]>(() => [
        {
            header: 'Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{row.name}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-wider text-muted-foreground">{row.code}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Academic Cycle',
            accessor: (row) => row.academicCycle ? (row.academicCycle.code ? `${row.academicCycle.code} - ${row.academicCycle.name}` : row.academicCycle.name) : 'N/A',
        },
        {
            header: 'Students',
            accessor: (row) => (
                <span className="inline-flex min-w-12 items-center justify-center rounded-md bg-muted px-2 py-1 text-xs font-black text-foreground">
                    {row._count?.students || 0}
                </span>
            ),
        },
        {
            header: 'Sections',
            accessor: (row) => (
                <span className="inline-flex min-w-12 items-center justify-center rounded-md bg-muted px-2 py-1 text-xs font-black text-foreground">
                    {row._count?.sections || 0}
                </span>
            ),
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (row) => (
                <TableActions
                    onEdit={isAdmin ? () => router.push(`/cohorts/edit/${row.id}?returnTo=/cohorts`) : undefined}
                    onView={() => router.push(`/cohorts/${row.id}`)}
                    onDelete={isAdmin ? () => {
                        setDeletingCohort(row);
                        setDeleteDialogOpen(true);
                    } : undefined}
                    editTitle="Edit Cohort"
                    deleteTitle="Delete Cohort"
                    variant="default"
                    isViewAndEdit={false}
                />
            ),
        },
    ], [isAdmin, router]);

    if (cohortsError) {
        return <ErrorState error={cohortsError} onRetry={() => mutateCohorts()} />;
    }

    return (
        <PageShell>
            <PageHeader
                title="Cohorts"
                description={<>Group students and sections by academic cycle for cleaner enrollment workflows. <DocsLink href="/docs/cohorts-promotions#cohorts">Read cohort docs</DocsLink></>}
                icon={Users}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Cohorts' },
                ]}
                actions={(
                    <PageControls
                    activeFilters={activeFilters}
                    leading={(
                        <SearchBar
                            value={searchTerm}
                            onChange={(value) => updateQueryParams({ search: value, page: 1 })}
                            placeholder="Search cohorts or codes..."
                            mobileMode="expandable"
                        />
                    )}
                    actions={isAdmin ? (
                        <Button
                            onClick={() => router.push('/cohorts/create')}
                            icon={Plus}
                            className="shrink-0"
                        >
                            New Cohort
                        </Button>
                    ) : undefined}
                    renderFilters={() => (
                        <FilterDrawerGrid>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Academic Cycle
                                </Label>
                                <CustomSelect
                                    options={[
                                        { label: 'All Academic Cycles', value: '' },
                                        ...(cyclesData?.data?.map((cycle) => ({ value: cycle.id, label: cycle.code ? `${cycle.code} - ${cycle.name}` : cycle.name })) || []),
                                    ]}
                                    value={academicCycleId}
                                    onChange={(value) => updateQueryParams({ academicCycleId: value, page: 1 })}
                                    placeholder="Filter Cycle"
                                />
                            </div>
                        </FilterDrawerGrid>
                    )}
                    />
                )}
            />
            <ResourcePanel>

                <div className="relative min-h-0 flex-1 overflow-x-hidden">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={(row) => router.push(`/cohorts/${row.id}`)}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle="No cohorts found"
                        emptyDescription={searchTerm || activeFilters.length > 0 ? 'Adjust the search or filters to broaden the result set.' : 'Create a cohort to group students and sections.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Delete Cohort <strong>{deletingCohort?.name}</strong></>}
                description="Are you sure you want to delete this cohort? This action cannot be undone."
                confirmText="Yes, Delete"
                isDestructive={true}
            />
        </PageShell>
    );
}
