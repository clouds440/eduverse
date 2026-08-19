'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BookOpen, Building2, CalendarRange, Download, FileCheck2, Layers, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { AcademicCycle, BadgeVariant, Department, OnlineAdmissionSubmission, OnlineAdmissionSubmissionStatus, Program, ProgramOffering } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell, PageTabs, ResourcePanel, ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { RemoteFilterSelect } from '@/components/ui/RemoteFilterSelect';
import { TableActions } from '@/components/ui/TableActions';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { downloadFile } from '@/lib/utils';

const statusOptions: Array<{ value: OnlineAdmissionSubmissionStatus | ''; label: string }> = [
    { value: '', label: 'All statuses' },
    { value: 'SUBMITTED' as OnlineAdmissionSubmissionStatus, label: 'Submitted' },
    { value: 'UNDER_REVIEW' as OnlineAdmissionSubmissionStatus, label: 'Under review' },
    { value: 'NEEDS_UPDATE' as OnlineAdmissionSubmissionStatus, label: 'Needs update' },
    { value: 'ACCEPTED' as OnlineAdmissionSubmissionStatus, label: 'Accepted' },
    { value: 'ADMITTED' as OnlineAdmissionSubmissionStatus, label: 'Admitted' },
    { value: 'REJECTED' as OnlineAdmissionSubmissionStatus, label: 'Rejected' },
    { value: 'WITHDRAWN' as OnlineAdmissionSubmissionStatus, label: 'Withdrawn' },
];

const statusConfig: Record<OnlineAdmissionSubmissionStatus, { label: string; variant: BadgeVariant }> = {
    SUBMITTED: { label: 'Submitted', variant: 'primary' },
    UNDER_REVIEW: { label: 'Under review', variant: 'info' },
    NEEDS_UPDATE: { label: 'Needs update', variant: 'warning' },
    ACCEPTED: { label: 'Accepted', variant: 'success' },
    ADMITTED: { label: 'Admitted', variant: 'success' },
    REJECTED: { label: 'Rejected', variant: 'error' },
    WITHDRAWN: { label: 'Withdrawn', variant: 'neutral' },
};

function statusBadge(status: OnlineAdmissionSubmissionStatus) {
    const config = statusConfig[status] || { label: status, variant: 'neutral' as BadgeVariant };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function OnlineAdmissionsPage() {
    const { token } = useAuth();
    const router = useRouter();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const [pageSize, setPageSize] = usePersistentPageSize('edu-online-admissions-limit', 10);

    const page = getNumberParam('page', 1);
    const search = getStringParam('search');
    const status = getStringParam('status') as OnlineAdmissionSubmissionStatus | '';
    const sortBy = getStringParam('sortBy', 'submittedAt');
    const sortOrder = getStringParam('sortOrder', 'desc') as 'asc' | 'desc';
    const departmentId = getStringParam('departmentId');
    const programId = getStringParam('programId');
    const academicCycleId = getStringParam('academicCycleId');
    const programOfferingId = getStringParam('programOfferingId');
    const submittedFrom = getStringParam('submittedFrom');
    const submittedTo = getStringParam('submittedTo');
    const missingRequiredDocuments = getStringParam('missingRequiredDocuments') === 'true';
    const params = { page, limit: pageSize, search, status: status || undefined, sortBy, sortOrder, departmentId, programId, academicCycleId, programOfferingId, submittedFrom, submittedTo, missingRequiredDocuments: missingRequiredDocuments || undefined };
    const { data, isLoading } = useSWR(token ? ['online-admissions', params] : null, () => api.onlineAdmissions.list(token!, params));
    const statusCounts = data?.statusCounts || {};

    const activeFilters: ActiveFilter[] = useMemo(() => [
        ...(search ? [{ key: 'search', label: 'Search', value: search, onRemove: () => updateQueryParams({ search: undefined, page: 1 }) }] : []),
        ...(status ? [{ key: 'status', label: 'Status', value: statusConfig[status]?.label || status, onRemove: () => updateQueryParams({ status: undefined, page: 1 }) }] : []),
        ...(departmentId ? [{ key: 'departmentId', label: 'Department', value: 'Selected', onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }) }] : []),
        ...(programId ? [{ key: 'programId', label: 'Program', value: 'Selected', onRemove: () => updateQueryParams({ programId: undefined, programOfferingId: undefined, page: 1 }) }] : []),
        ...(academicCycleId ? [{ key: 'academicCycleId', label: 'Cycle', value: 'Selected', onRemove: () => updateQueryParams({ academicCycleId: undefined, programOfferingId: undefined, page: 1 }) }] : []),
        ...(programOfferingId ? [{ key: 'programOfferingId', label: 'Offering', value: 'Selected', onRemove: () => updateQueryParams({ programOfferingId: undefined, page: 1 }) }] : []),
        ...(submittedFrom ? [{ key: 'submittedFrom', label: 'From', value: submittedFrom, onRemove: () => updateQueryParams({ submittedFrom: undefined, page: 1 }) }] : []),
        ...(submittedTo ? [{ key: 'submittedTo', label: 'To', value: submittedTo, onRemove: () => updateQueryParams({ submittedTo: undefined, page: 1 }) }] : []),
        ...(missingRequiredDocuments ? [{ key: 'missingRequiredDocuments', label: 'Documents', value: 'Missing required', onRemove: () => updateQueryParams({ missingRequiredDocuments: undefined, page: 1 }) }] : []),
    ], [academicCycleId, departmentId, missingRequiredDocuments, programId, programOfferingId, search, status, submittedFrom, submittedTo, updateQueryParams]);

    const columns: Column<OnlineAdmissionSubmission>[] = [
        {
            header: 'Applicant',
            sortable: true,
            sortKey: 'applicantName',
            accessor: (row) => (
                <div className="flex flex-col">
                    <span className="font-black text-card-foreground">{row.applicantName}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{row.applicantEmail}</span>
                </div>
            ),
        },
        {
            header: 'Status',
            sortKey: 'status',
            sortable: true,
            badge: true,
            accessor: (row) => statusBadge(row.status),
        },
        {
            header: 'Reference',
            sortable: true,
            sortKey: 'publicReference',
            accessor: 'publicReference',
        },
        {
            header: 'Program',
            accessor: (row) => `${row.program?.code || ''} ${row.program?.name || 'Program'}`.trim(),
        },
        {
            header: 'Documents',
            accessor: (row) => {
                const required = row.requiredDocumentCount || 0;
                const uploaded = row.uploadedRequiredDocumentCount || 0;
                return <Badge variant={uploaded < required ? 'warning' : 'success'}>{uploaded}/{required} required</Badge>;
            },
        },
        {
            header: 'Submitted',
            sortable: true,
            sortKey: 'submittedAt',
            accessor: (row) => (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <CalendarRange className="h-4 w-4" aria-hidden="true" />
                    {new Date(row.submittedAt).toLocaleDateString()}
                </span>
            ),
        },
        {
            header: 'Actions',
            width: 110,
            accessor: (row) => <TableActions onView={() => router.push(`/online-admissions/${row.id}`)} />,
        },
    ];

    return (
        <PageShell className="overflow-y-auto custom-scrollbar">
            <PageHeader
                title="Online Admissions"
                description="Review public applications and move decisions through the admissions queue."
                icon={FileCheck2}
                breadcrumbs={[{ label: 'Online Admissions' }]}
            />
            <PageTabs
                ariaLabel="Online admission status"
                activeValue={status || 'ALL'}
                onValueChange={(value) => updateQueryParams({ status: value === 'ALL' ? undefined : value, page: 1 })}
                items={[
                    { value: 'ALL', label: 'All', count: data?.totalRecords || 0 },
                    { value: 'SUBMITTED', label: 'Submitted', count: statusCounts.SUBMITTED || 0 },
                    { value: 'UNDER_REVIEW', label: 'Review', count: statusCounts.UNDER_REVIEW || 0 },
                    { value: 'ACCEPTED', label: 'Accepted', count: statusCounts.ACCEPTED || 0 },
                    { value: 'REJECTED', label: 'Rejected', count: statusCounts.REJECTED || 0 },
                ]}
            />
            <ResourcePanel>
                <ResourceToolbar
                    search={<Input icon={Search} value={search} onChange={(event) => updateQueryParams({ search: event.target.value, page: 1 })} placeholder="Search name, email, phone, or reference" />}
                    filters={(
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <CustomSelect value={status} onChange={(value) => updateQueryParams({ status: value || undefined, page: 1 })} options={statusOptions} />
                            <RemoteFilterSelect<Department>
                                cacheKey="online-admissions-departments"
                                value={departmentId}
                                onChange={(value) => updateQueryParams({ departmentId: value || undefined, page: 1 })}
                                placeholder="Department"
                                allLabel="All departments"
                                icon={Building2}
                                fetchOptions={(query) => api.org.getDepartments(token!, { search: query, limit: 20, isActive: true }).then((result) => result.data)}
                                mapOption={(department) => ({ value: department.id, label: department.code ? `${department.code} - ${department.name}` : department.name })}
                            />
                            <RemoteFilterSelect<Program>
                                cacheKey="online-admissions-programs"
                                value={programId}
                                onChange={(value) => updateQueryParams({ programId: value || undefined, programOfferingId: undefined, page: 1 })}
                                placeholder="Program"
                                allLabel="All programs"
                                icon={BookOpen}
                                fetchOptions={(query) => api.programs.getPrograms(token!, { search: query, limit: 20 }).then((result) => result.data)}
                                mapOption={(program) => ({ value: program.id, label: `${program.code} - ${program.name}` })}
                            />
                            <RemoteFilterSelect<AcademicCycle>
                                cacheKey="online-admissions-cycles"
                                value={academicCycleId}
                                onChange={(value) => updateQueryParams({ academicCycleId: value || undefined, programOfferingId: undefined, page: 1 })}
                                placeholder="Cycle"
                                allLabel="All cycles"
                                icon={CalendarRange}
                                fetchOptions={(query) => api.academicCycles.getCycles(token!, { search: query, limit: 20 }).then((result) => result.data)}
                                mapOption={(cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name}` })}
                            />
                            <RemoteFilterSelect<ProgramOffering>
                                cacheKey={`online-admissions-offerings-${programId}-${academicCycleId}`}
                                value={programOfferingId}
                                onChange={(value) => updateQueryParams({ programOfferingId: value || undefined, page: 1 })}
                                placeholder="Offering"
                                allLabel="All offerings"
                                icon={Layers}
                                disabled={!programId && !academicCycleId}
                                minSearchLength={0}
                                fetchOptions={() => api.programOfferings.list(token!, { programId: programId || undefined, academicCycleId: academicCycleId || undefined })}
                                mapOption={(offering) => ({ value: offering.id, label: `${offering.program.code} - ${offering.academicCycle.code}` })}
                            />
                            <Input type="date" aria-label="Submitted from" title="Submitted from" value={submittedFrom} onChange={(event) => updateQueryParams({ submittedFrom: event.target.value || undefined, page: 1 })} />
                            <Input type="date" aria-label="Submitted to" title="Submitted to" value={submittedTo} onChange={(event) => updateQueryParams({ submittedTo: event.target.value || undefined, page: 1 })} />
                            <CustomSelect
                                value={missingRequiredDocuments ? 'true' : ''}
                                onChange={(value) => updateQueryParams({ missingRequiredDocuments: value || undefined, page: 1 })}
                                options={[{ value: '', label: 'All document states' }, { value: 'true', label: 'Missing required documents' }]}
                            />
                        </div>
                    )}
                    actions={(
                        <Button
                            icon={Download}
                            variant="secondary"
                            size="sm"
                            onClick={() => token && downloadFile(api.onlineAdmissions.exportUrl(params), 'online-admissions.csv', token)}
                        >
                            Export
                        </Button>
                    )}
                    activeFilters={activeFilters}
                />
                <DataTable
                    data={data?.data || []}
                    columns={columns}
                    keyExtractor={(row) => row.id}
                    currentPage={page}
                    totalPages={data?.totalPages || 1}
                    totalResults={data?.totalRecords || 0}
                    pageSize={pageSize}
                    onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                    onPageSizeChange={(size) => { setPageSize(size); updateQueryParams({ page: 1 }); }}
                    sortConfig={{ key: sortBy, direction: sortOrder }}
                    onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction, page: 1 })}
                    isLoading={isLoading}
                    showSerialNumber={false}
                    emptyTitle="No online admissions found"
                    emptyDescription="New public applications will appear here."
                />
            </ResourcePanel>
        </PageShell>
    );
}
