'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, BadgeCheck, Building2, FileUp } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { usePathname, useRouter } from 'next/navigation';
import { BadgeVariant, Department, Teacher, Role, TeacherStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { TableActions } from '@/components/ui/TableActions';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { NewMailModal } from '@/components/mail/NewMailModal';
import { BrandIcon } from '@/components/ui/Brand';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Toggle } from '@/components/ui/Toggle';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { formatCourseSectionLabel, formatDepartmentLabel, getSectionSurfaceStyle } from '@/lib/utils';
import { CsvImportModal } from '@/components/imports/CsvImportModal';

interface TeacherParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    status?: string;
    deleted?: boolean;
    departmentId?: string;
}

export default function TeachersPage() {
    const { token, user } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { getBooleanParam, getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const { dispatch } = useGlobal();

    // We no longer need local paginatedData state as fetchedData is used directly
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [newMailOpen, setNewMailOpen] = useState(false);
    const [initialTargetId, setInitialTargetId] = useState<string | undefined>(undefined);
    const [initialSubject, setInitialSubject] = useState<string | undefined>(undefined);

    // URL State
    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const statusFilter = getStringParam('status');
    const isDeletedView = getBooleanParam('deleted');
    const showEmeritus = getBooleanParam('showEmeritus');
    const roleFilter = getStringParam('role');
    const departmentId = getStringParam('departmentId');
    const isManagersView = roleFilter === 'managers';
    const routeBase = pathname.startsWith('/users/teachers') ? '/users/teachers' : '/teachers';
    const [pageSize, setPageSize] = usePersistentPageSize('edu-teachers-limit', 10);
    const canManageTeachers = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

    const teacherParams = useMemo<TeacherParams>(() => ({
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        status: isDeletedView ? undefined : (statusFilter || (showEmeritus ? undefined : 'ACTIVE,SUSPENDED,ON_LEAVE')),
        deleted: isDeletedView,
        departmentId: departmentId || undefined,
    }), [page, pageSize, searchTerm, sortBy, sortOrder, statusFilter, showEmeritus, isDeletedView, departmentId]);
    const { data: departmentsData } = useSWR<{ data: Department[] }>(token ? ['departments', { limit: 1000, isActive: true }] as const : null);

    // SWR for teachers data - replaces usePaginatedData
    const teachersKey = useMemo(() => {
        if (!token) return null;
        return ['teachers', isManagersView ? 'managers' : 'faculty', teacherParams] as const;
    }, [isManagersView, token, teacherParams]);
    const { data: fetchedData, isLoading: isFetching, error: teachersError, mutate: mutateTeachers } = useSWR<
        { data: Teacher[]; totalPages: number; totalRecords: number }
    >(teachersKey, () => isManagersView
        ? api.org.getManagers(token!, teacherParams)
        : api.org.getTeachers(token!, teacherParams)
    );

    useEffect(() => {
        if (user && !canManageTeachers) {
            if (user.role === Role.TEACHER) {
                router.replace(`/teachers/${user.id}`);
            } else if (user.role === Role.STUDENT) {
                router.replace(`/students/${user.id}`);
            } else {
                router.replace('/');
            }
        }
    }, [user, canManageTeachers, router, pathname]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    // We no longer need fetchData locally as it's handled by the hook

    const handleDeleteConfirm = async () => {
        if (!deletingTeacher || !token) return;
        try {
            await api.org.deleteTeacher(deletingTeacher.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Teacher removed from organization', type: 'success' } });
            setDeleteDialogOpen(false);
            // Invalidate all teachers-related cache keys
            mutate(matchesCacheKeyPrefix('teachers'));
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : 'Failed to delete teacher', type: 'error' } });
        }
    };

    const handleRestore = useCallback(async (id: string) => {
        if (!token) return;
        try {
            await api.org.restoreTeacher(id, TeacherStatus.ACTIVE, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Teacher restored successfully', type: 'success' } });
            mutate(matchesCacheKeyPrefix('teachers'));
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : 'Failed to restore teacher', type: 'error' } });
        }
    }, [dispatch, token]);

    const columns = useMemo<Column<Teacher>[]>(() => [
        {
            header: 'Teacher',
            sortable: true,
            sortKey: 'name',
            accessor: (row: Teacher) => (
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0 flex items-center justify-center">
                        <BrandIcon variant="user" size="sm" user={row.user} className="w-10 h-10 shadow-sm" />
                        {(row.user.role === Role.ORG_ADMIN || row.user.role === Role.ORG_MANAGER) && (
                            <div
                                className={`absolute -bottom-1 -right-1 p-0.5 rounded-full bg-background shadow-sm border z-20 ${row.user.role === Role.ORG_ADMIN
                                    ? 'text-warning border-warning/20'
                                    : 'text-info border-info/30'
                                    }`}
                                title={row.user.role === Role.ORG_ADMIN ? 'Administrator' : 'Manager'}
                            >
                                <BadgeCheck className="w-3.5 h-3.5" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <div className="font-semibold text-card-foreground">{row.user.name || 'No Name'}</div>
                        <div className="text-sm text-muted-foreground">{row.user.email}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Status',
            sortable: true,
            sortKey: 'status',
            badge: true,
            accessor: (row: Teacher) => {
                const status = row.status || TeacherStatus.ACTIVE;
                const config: Record<TeacherStatus, { label: string; variant: BadgeVariant }> = {
                    [TeacherStatus.ACTIVE]: { label: 'Active', variant: 'success' },
                    [TeacherStatus.SUSPENDED]: { label: 'Suspended', variant: 'error' },
                    [TeacherStatus.ON_LEAVE]: { label: 'On Leave', variant: 'warning' },
                    [TeacherStatus.EMERITUS]: { label: 'Emeritus', variant: 'secondary' },
                    [TeacherStatus.DELETED]: { label: 'Deleted', variant: 'neutral' },
                };
                const { label, variant } = config[status];
                return (
                    <Badge variant={variant}>
                        {label}
                    </Badge>
                );
            }
        },
        {
            header: 'Role & Subject',
            sortable: true,
            sortKey: 'designation',
            accessor: (row: Teacher) => (
                <div className="flex flex-col">
                    <span className="font-medium text-card-foreground/80">{row.designation || <span className="text-muted-foreground/30 italic">No Designation</span>}</span>
                    <span className="text-sm text-muted-foreground">{row.subject || 'No Subject'}</span>
                </div>
            )
        },
        {
            header: isManagersView ? 'Scope' : 'Departments',
            sortable: false,
            accessor: (row: Teacher) => {
                const departmentLinks = isManagersView ? row.managerDepartments : row.teacherDepartments;
                return departmentLinks?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {departmentLinks.slice(0, 2).map((entry) => (
                            <Badge
                                key={entry.departmentId}
                                variant="primary"
                                size="sm"
                                style={entry.department.color ? { borderColor: `${entry.department.color}55`, backgroundColor: `${entry.department.color}18`, color: entry.department.color } : undefined}
                            >
                                {formatDepartmentLabel(entry.department)}
                            </Badge>
                        ))}
                        {departmentLinks.length > 2 && <Badge variant="neutral" size="sm">+{departmentLinks.length - 2}</Badge>}
                    </div>
                ) : <span className="text-muted-foreground/30 italic">{isManagersView ? 'All departments' : 'Unassigned'}</span>;
            },
        },
        {
            header: 'Assigned Sections',
            sortable: false,
            badge: true,
            accessor: (row: Teacher) => {
                const sectionsList = row.sections || [];
                return sectionsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-50">
                        {sectionsList.slice(0, 1).map(sec => (
                            <Badge
                                key={sec?.id || sec?.name}
                                variant="neutral"
                                size="sm"
                                className="truncate max-w-37.5"
                                title={formatCourseSectionLabel({ courseName: sec?.course?.name, sectionName: sec?.name })}
                                style={getSectionSurfaceStyle(sec, '18', '55')}
                            >
                                <CourseSectionLabel section={sec} className="truncate" />
                            </Badge>
                        ))}
                        {sectionsList.length > 1 && (
                            <Badge variant="neutral" size="sm" className="truncate max-w-37.5" title="Click to view all sections">
                                +{sectionsList.length - 1} more
                            </Badge>
                        )}
                    </div>
                ) : <span className="text-muted-foreground/30 italic">Unassigned</span>;
            }
        },
        {
            header: 'Contact',
            sortable: true,
            sortKey: 'phone',
            accessor: (row: Teacher) => row.user.phone || <span className="text-muted-foreground/30 italic">-</span>
        },
        {
            header: 'Actions',
            width: 200,
            accessor: (row: Teacher) => (
                <TableActions
                    onEdit={isDeletedView ? undefined : () => router.push(`${routeBase}/edit/${row.id}`)}
                    onDelete={isDeletedView ? undefined : () => {
                        setDeletingTeacher(row);
                        setDeleteDialogOpen(true);
                    }}
                    variant="user"
                    isViewAndEdit={!isDeletedView}
                    extraActions={[
                        ...(isDeletedView ? [
                            {
                                variant: 'restore' as const,
                                title: 'Restore',
                                onClick: () => handleRestore(row.id)
                            }
                        ] : [
                            {
                                variant: 'mail' as const,
                                title: 'Send Mail',
                                onClick: () => {
                                    setInitialTargetId(row.user.id);
                                    setInitialSubject(`Inquiry regarding ${row.user.name}`);
                                    setNewMailOpen(true);
                                }
                            }
                        ])
                    ]}
                />
            )
        }
    ], [isDeletedView, router, handleRestore, isManagersView]);

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
        ...(showEmeritus ? [{
            key: 'showEmeritus',
            label: 'Include',
            value: 'Emeritus',
            onRemove: () => updateQueryParams({ showEmeritus: undefined, page: 1 }),
        }] : []),
        ...(isManagersView ? [{
            key: 'role',
            label: 'Role',
            value: 'Managers',
            onRemove: () => updateQueryParams({ role: undefined, page: 1 }),
        }] : []),
        ...(departmentId ? [{
            key: 'departmentId',
            label: 'Department',
            value: departmentsData?.data?.find((department) => department.id === departmentId)?.name || 'Selected department',
            onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }),
        }] : []),
    ];

    const filters = (
        <FilterDrawerGrid>
            {!isDeletedView && (
                <>
                    <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">
                            Status
                        </label>
                        <CustomSelect
                            options={[
                                { label: 'All Statuses', value: '' },
                                { label: 'Active', value: TeacherStatus.ACTIVE },
                                { label: 'Suspended', value: TeacherStatus.SUSPENDED },
                                { label: 'On Leave', value: TeacherStatus.ON_LEAVE },
                            ]}
                            value={statusFilter}
                            onChange={(val) => updateQueryParams({ status: val, page: 1 })}
                            placeholder="Filter Status"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">
                            Department
                        </label>
                        <CustomSelect
                            options={[
                                { label: 'All Departments', value: '', icon: Building2 },
                                ...(departmentsData?.data?.map((department) => ({
                                    value: department.id,
                                    label: formatDepartmentLabel(department),
                                    icon: Building2,
                                })) || []),
                            ]}
                            value={departmentId}
                            onChange={(val) => updateQueryParams({ departmentId: val, page: 1 })}
                            placeholder="All Departments"
                            searchable
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/50 px-3 py-2">
                        <span className="text-sm font-medium">Show Emeritus</span>
                        <Toggle
                            checked={showEmeritus}
                            onCheckedChange={(val) => updateQueryParams({ showEmeritus: val ? 'true' : undefined, page: 1 })}
                        />
                    </div>

                    <button
                        onClick={() => updateQueryParams({ deleted: 'true', page: 1, status: undefined, showEmeritus: undefined })}
                        className="cursor-pointer text-left text-xs font-bold tracking-tighter text-muted-foreground/60 hover:text-primary hover:underline"
                    >
                        {isManagersView ? 'View Deleted Managers' : 'View Deleted Faculty'}
                    </button>
                </>
            )}
        </FilterDrawerGrid>
    );


    if (teachersError) {
        return <ErrorState error={teachersError} onRetry={() => mutateTeachers()} />;
    }

    return (
        <PageShell>
            <PageHeader
                title={isDeletedView ? (isManagersView ? 'Deleted Managers' : 'Deleted Faculty') : (isManagersView ? 'Managers' : 'Faculty')}
                description={isManagersView ? 'Create and maintain academic manager accounts with section-based academic scope.' : 'Search and maintain faculty records while preserving existing role and restore flows.'}
                icon={UserPlus}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Users', href: '/users' },
                    { label: isDeletedView ? (isManagersView ? 'Deleted Managers' : 'Deleted Faculty') : (isManagersView ? 'Managers' : 'Faculty') },
                ]}
                meta={isDeletedView ? <Badge variant="neutral" size="sm">Archive</Badge> : undefined}
                actions={(
                    <PageControls
                    drawerLabel={isManagersView ? 'Manager filters' : 'Faculty filters'}
                    leading={<SearchBar value={searchTerm} onChange={(val) => updateQueryParams({ search: val, page: 1 })} placeholder={isManagersView ? 'Search managers...' : 'Search faculty...'} mobileMode="expandable" />}
                    renderFilters={() => filters}
                    showDrawer={!isDeletedView}
                    activeFilters={activeFilters}
                    actions={(
                        <>
                            {isDeletedView && (
                            <button
                                onClick={() => updateQueryParams({ deleted: undefined, page: 1 })}
                                className="shrink-0 cursor-pointer whitespace-nowrap text-xs font-bold tracking-tighter text-primary hover:text-primary hover:underline"
                            >
                                {isManagersView ? 'Back to Active Managers' : 'Back to Active Faculty'}
                            </button>
                        )}

                        {canManageTeachers && !isDeletedView && (
                            <>
                                {!isManagersView && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => setImportOpen(true)}
                                        icon={FileUp}
                                        className="shrink-0 whitespace-nowrap"
                                    >
                                        Import CSV
                                    </Button>
                                )}
                                <Button
                                    onClick={() => router.push(isManagersView ? `${routeBase}/add?role=manager` : `${routeBase}/add`)}
                                    icon={UserPlus}
                                    className="shrink-0 whitespace-nowrap"
                                >
                                    {isManagersView ? 'Add Manager' : 'Add Teacher'}
                                </Button>
                            </>
                        )}
                        </>
                    )}
                    />
                )}
            />
            <ResourcePanel>

                <div className="relative overflow-x-hidden flex-1 min-h-0">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={(row) => {
                            if (canManageTeachers) {
                                if (user?.id === row.userId) {
                                    router.push(`/teachers/${row.userId}/profile`);
                                } else {
                                    router.push(`${routeBase}/edit/${row.id}`);
                                }
                            }
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
                        emptyTitle={isDeletedView ? 'No deleted faculty' : 'No faculty found'}
                        emptyDescription={searchTerm || activeFilters.length > 0 ? 'Adjust the search or filters to broaden the result set.' : undefined}
                    />
                </div>
            </ResourcePanel>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Remove Faculty Member <strong>{deletingTeacher?.user?.name}</strong></>}
                description={<>Are you really sure you want to remove <strong>{deletingTeacher?.user?.email}</strong>?</>}
                confirmText="Delete"
                isDestructive={true}
            />

            <NewMailModal
                isOpen={newMailOpen}
                onClose={() => {
                    setNewMailOpen(false);
                    setInitialTargetId(undefined);
                    setInitialSubject(undefined);
                }}
                initialTargetId={initialTargetId}
                initialSubject={initialSubject}
                onSuccess={() => {
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Mail sent successfully', type: 'success' } });
                }}
            />
            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="teachers"
                title="Teachers"
                cachePrefix="teachers"
            />
        </PageShell>
    );
}
