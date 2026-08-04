'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { GraduationCap, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Department, PaginatedResponse, Program, ProgramStatus, Role } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

function statusVariant(status: ProgramStatus) {
    if (status === ProgramStatus.ACTIVE) return 'success' as const;
    if (status === ProgramStatus.DRAFT) return 'neutral' as const;
    if (status === ProgramStatus.ARCHIVED) return 'error' as const;
    return 'warning' as const;
}

export default function ProgramsPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-programs-limit', 10);
    const page = getNumberParam('page', 1);
    const search = getStringParam('search');
    const status = getStringParam('status') as ProgramStatus | '';
    const departmentId = getStringParam('departmentId');
    const params = { page, limit: pageSize, search, status: status || undefined, departmentId: departmentId || undefined };
    const { data, isLoading, error, mutate } = useSWR<PaginatedResponse<Program>>(
        token ? ['programs', params] : null,
        () => api.programs.getPrograms(token!, params),
    );
    const { data: departments } = useSWR<PaginatedResponse<Department>>(
        token ? ['departments', { limit: 1000, isActive: true }] as const : null,
    );
    const canManage = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const activeFilters: ActiveFilter[] = [
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(status ? [{ key: 'status', label: 'Status', value: status.replaceAll('_', ' '), onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'department', label: 'Department', value: departments?.data.find((item) => item.id === departmentId)?.name || 'Selected', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
    ];
    const columns = useMemo<Column<Program>[]>(() => [
        {
            header: 'Program',
            accessor: (row) => <div className="min-w-0"><p className="truncate text-sm font-black">{row.name}</p><p className="truncate text-xs text-muted-foreground">{row.code}</p></div>,
        },
        { header: 'Department', accessor: (row) => <span className="text-sm font-semibold">{row.department.code} - {row.department.name}</span> },
        { header: 'Cycles', accessor: (row) => <span className="tabular-nums text-sm font-bold">{row.requiredCycleCount}</span> },
        { header: 'Students', accessor: (row) => <span className="tabular-nums text-sm font-bold">{row._count?.studentEnrollments || 0}</span> },
        { header: 'Status', badge: true, accessor: (row) => <Badge variant={statusVariant(row.status)} size="sm">{row.status.replaceAll('_', ' ')}</Badge> },
        {
            header: 'Actions',
            width: 100,
            accessor: (row) => <TableActions onView={() => router.push(`/programs/${row.id}`)} onEdit={canManage && [ProgramStatus.DRAFT, ProgramStatus.PAUSED].includes(row.status) ? () => router.push(`/programs/${row.id}/edit`) : undefined} />,
        },
    ], [canManage, router]);
    if (error) return <ErrorState error={error} onRetry={() => mutate()} />;

    return (
        <PageShell>
            <PageHeader
                title="Programs"
                description="Department-owned course offerings with ordered institute cycles and versioned curricula."
                icon={GraduationCap}
                breadcrumbs={[{ label: 'Organization' }, { label: 'Academic' }, { label: 'Programs' }]}
                actions={<PageControls
                    activeFilters={activeFilters}
                    leading={<SearchBar value={search} onChange={(value) => updateQueryParams({ search: value, page: 1 })} placeholder="Search programs..." mobileMode="expandable" />}
                    actions={canManage ? <Button icon={Plus} onClick={() => router.push('/programs/create')}>New Program</Button> : undefined}
                    renderFilters={() => <FilterDrawerGrid>
                        <div className="space-y-2"><Label>Status</Label><CustomSelect value={status} onChange={(value) => updateQueryParams({ status: value || undefined, page: 1 })} options={[{ value: '', label: 'All statuses' }, ...Object.values(ProgramStatus).map((value) => ({ value, label: value.replaceAll('_', ' ') }))]} /></div>
                        <div className="space-y-2"><Label>Department</Label><CustomSelect value={departmentId} onChange={(value) => updateQueryParams({ departmentId: value || undefined, page: 1 })} searchable options={[{ value: '', label: 'All departments' }, ...(departments?.data || []).map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }))]} /></div>
                    </FilterDrawerGrid>}
                />}
            />
            <ResourcePanel>
                <DataTable
                    data={data?.data || []}
                    columns={columns}
                    keyExtractor={(row) => row.id}
                    isLoading={isLoading}
                    currentPage={page}
                    totalPages={data?.totalPages || 1}
                    totalResults={data?.totalRecords || 0}
                    pageSize={pageSize}
                    onPageChange={(next) => updateQueryParams({ page: next })}
                    onPageSizeChange={(next) => { setPageSize(next); updateQueryParams({ page: 1 }); }}
                    emptyTitle="No programs found"
                />
            </ResourcePanel>
        </PageShell>
    );
}
