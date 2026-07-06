'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Building2, FileUp, UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { useGlobal } from '@/context/GlobalContext';
import { DataTable, Column } from '@/components/ui/DataTable';
import { BadgeVariant, Department, Role, Student, Section, StudentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { TableActions } from '@/components/ui/TableActions';
import { CustomSelect } from '@/components/ui/CustomSelect';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { Badge } from '@/components/ui/Badge';
import { BrandIcon } from '@/components/ui/Brand';
import { Toggle } from '@/components/ui/Toggle';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { formatCourseSectionLabel, formatDepartmentLabel } from '@/lib/utils';
import { CsvImportModal } from '@/components/imports/CsvImportModal';
import { usePasswordResetLinkAction } from '@/hooks/usePasswordResetLinkAction';
import { UserCommsAction } from '@/components/communication/UserCommsAction';

interface StudentParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    my?: boolean;
    sectionId?: string;
    status?: string;
    deleted?: boolean;
    cohortId?: string;
    departmentId?: string;
}

export default function StudentsPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const { getBooleanParam, getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const { dispatch } = useGlobal();

    // Redundant paginatedData state removed
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    // SWR for sections (for filter dropdown) - reduced limit for performance
    const sectionsKey = token && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER)
        ? ['sections', { my: user.role === Role.TEACHER, limit: 50 }] as const
        : null;
    const { data: sectionsData } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = sectionsData?.data || [];

    const canManageStudents = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const canViewStudentDetails = canManageStudents || user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER;
    const isScopedStudentRoster = user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER;
    const routeBase = '/users/students';
    const { generatePasswordResetLink, generatingResetUserId } = usePasswordResetLinkAction(token);

    // URL State
    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const showOnlyMyStudents = getBooleanParam('my');
    const sectionId = getStringParam('sectionId');
    const statusFilter = getStringParam('status');
    const isDeletedView = getBooleanParam('deleted');
    const showAlumni = getBooleanParam('showAlumni');
    const cohortId = getStringParam('cohortId');
    const departmentId = getStringParam('departmentId');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-students-limit', 10);
    const pageBreadcrumbs = [
        { label: 'Organization' },
        { label: 'Users', href: '/users' },
        { label: isDeletedView ? 'Deleted Students' : 'Students' },
    ];

    const studentParams: StudentParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        my: isScopedStudentRoster ? true : showOnlyMyStudents,
        sectionId: sectionId || undefined,
        cohortId: cohortId || undefined,
        departmentId: departmentId || undefined,
        status: isDeletedView ? undefined : (statusFilter || (showAlumni ? undefined : 'ACTIVE,SUSPENDED')),
        deleted: isDeletedView,
    };

    // SWR for students data - replaces usePaginatedData
    const studentsKey = token ? ['students', studentParams] as const : null;
    const { data: fetchedData, isLoading: isFetching } = useSWR<
        { data: Student[]; totalPages: number; totalRecords: number }
    >(studentsKey);

    const cohortsKey = token && canManageStudents
        ? ['cohorts', { limit: 100 }] as const
        : null;
    const { data: cohortsData } = useSWR<{ data: { id: string, name: string }[] }>(cohortsKey);
    const cohorts = cohortsData?.data || [];
    const departmentsKey = token && canManageStudents ? ['departments', { limit: 1000, isActive: true }] as const : null;
    const { data: departmentsData } = useSWR<{ data: Department[] }>(departmentsKey);

    useEffect(() => {
        if (user && user.role === Role.STUDENT) {
            router.replace(`/student/${user.id}`);
        }
    }, [user, router]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    // Redundant students variable removed. Using fetchedData directly.

    const columns: Column<Student>[] = [
        {
            header: 'Student Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row: Student) => (
                <div className="flex items-center gap-3">
                    <BrandIcon variant="user" size="sm" user={row.user} className="w-10 h-10 shadow-sm" />
                    <span className="font-semibold text-card-foreground">{row.user.name || 'N/A'}</span>
                </div>
            )
        },
        {
            header: 'Status',
            sortable: true,
            sortKey: 'status',
            badge: true,
            accessor: (row: Student) => {
                const status = row.status || StudentStatus.ACTIVE;
                const config: Record<StudentStatus, { label: string; variant: BadgeVariant }> = {
                    [StudentStatus.ACTIVE]: { label: 'Active', variant: 'success' },
                    [StudentStatus.SUSPENDED]: { label: 'Suspended', variant: 'error' },
                    [StudentStatus.ALUMNI]: { label: 'Alumni', variant: 'secondary' },
                    [StudentStatus.DELETED]: { label: 'Deleted', variant: 'neutral' },
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
            header: 'Reg / Roll No.',
            sortable: true,
            sortKey: 'registrationNumber',
            accessor: (row: Student) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-card-foreground">{row.registrationNumber || '-'}</span>
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/40 leading-none mt-1">
                        Roll: {row.rollNumber || '-'}
                    </span>
                </div>
            )
        },
        {
            header: 'Major / Course',
            sortable: true,
            sortKey: 'major',
            accessor: (row: Student) => row.major || '-'
        },
        {
            header: 'Department',
            sortable: false,
            accessor: (row: Student) => {
                const primaryDepartmentId = row.primaryDepartmentId || row.primaryDepartment?.id;
                const extraDepartments = (row.studentDepartments || []).filter(
                    (entry) => entry.departmentId !== primaryDepartmentId
                );
                return row.primaryDepartment || extraDepartments.length ? (
                    <div className="flex flex-wrap gap-1">
                        {row.primaryDepartment && (
                            <Badge
                                variant="primary"
                                size="sm"
                                title={formatDepartmentLabel(row.primaryDepartment)}
                                color={row.primaryDepartment.color}
                            >
                                {row.primaryDepartment.code || row.primaryDepartment.name || 'Dept'}
                            </Badge>
                        )}
                        {extraDepartments.slice(0, row.primaryDepartment ? 1 : 2).map((entry) => (
                            <Badge key={entry.departmentId} variant="neutral" size="sm" title={formatDepartmentLabel(entry.department)} color={entry.department.color}>
                                {entry.department.code || entry.department.name || 'Dept'}
                            </Badge>
                        ))}
                        {extraDepartments.length > (row.primaryDepartment ? 1 : 2) && (
                            <Badge variant="neutral" size="sm">+{extraDepartments.length - (row.primaryDepartment ? 1 : 2)}</Badge>
                        )}
                    </div>
                ) : <span className="text-muted-foreground/30 italic">Unassigned</span>;
            },
        },
        {
            header: 'Cohort',
            sortable: false,
            badge: true,
            accessor: (row: Student) => row.cohort?.name || <span className="text-muted-foreground/30 italic">Independent</span>
        },
        {
            header: 'Contact',
            sortable: true,
            sortKey: 'email',
            accessor: (row: Student) => (
                <div className="flex flex-col">
                    <span className="text-card-foreground/80">{row.user.phone || 'No phone'}</span>
                    <span className="text-xs text-muted-foreground/40">{row.user.email}</span>
                </div>
            )
        },
        {
            header: 'Enrolled Sections',
            sortable: false,
            accessor: (row: Student) => {
                const sectionsList = row.enrollments?.map(e => e.section) || [];
                return sectionsList.length > 0 && sectionsList.length < 2 ? (
                    <div className="flex flex-wrap gap-1 max-w-50">
                        {sectionsList.map(sec => (
                            <span key={sec?.id || sec?.name} title={formatCourseSectionLabel({ courseName: sec?.course?.name, sectionName: sec?.name })}>
                                <Badge variant="neutral" size="sm" className="truncate max-w-37.5" color={sec?.color}>
                                    <CourseSectionLabel section={sec} className="truncate" />
                                </Badge>
                            </span>
                        ))}
                    </div>
                ) : sectionsList.length >= 2 ? (
                    <div className="flex flex-wrap gap-1 max-w-50">
                        {sectionsList.slice(0, 1).map(sec => (
                            <span key={sec?.id || sec?.name} title={formatCourseSectionLabel({ courseName: sec?.course?.name, sectionName: sec?.name })}>
                                <Badge variant="neutral" size="sm" className="truncate max-w-37.5" color={sec?.color}>
                                    <CourseSectionLabel section={sec} className="truncate" />
                                </Badge>
                            </span>
                        ))}
                        <Badge variant="neutral" size="sm" className="truncate max-w-37.5" title='Click to view all sections'>
                            +{sectionsList.length - 1} more
                        </Badge>
                    </div>
                ) : <span className="text-muted-foreground/30 italic">Not enrolled</span>;
            }
        },
        {
            header: 'Enrolled On',
            sortable: true,
            sortKey: 'createdAt',
            accessor: (row: Student) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'
        },
        {
            header: 'Last Updated',
            sortable: true,
            sortKey: 'updatedAt',
            accessor: (row: Student) => row.updatedBy ? (
                <div className="flex flex-col whitespace-nowrap">
                    <span className="font-medium text-foreground">{row.updatedBy}</span>
                    <span className="text-xs text-muted-foreground">{new Date(row.updatedAt || '').toLocaleDateString()}</span>
                </div>
            ) : <span className="text-muted-foreground/30 italic text-sm text-center">Never</span>
        },
        {
            header: 'Actions',
            width: 150,
            accessor: (row: Student) => {
                return (
                    <div className="flex items-center gap-1">
                        <TableActions
                            onEdit={isDeletedView || !canManageStudents ? undefined : () => router.push(`${routeBase}/edit/${row.id}`)}
                            onView={isDeletedView || !canViewStudentDetails ? undefined : () => router.push(`/profiles/${row.user.id}`)}
                            onDelete={isDeletedView || !canManageStudents ? undefined : () => handleDeleteClick(row.id)}
                            variant="user"
                            extraActions={isDeletedView ? (
                                canManageStudents ? [
                                    {
                                        variant: 'restore' as const,
                                        title: 'Restore',
                                        onClick: () => handleRestore(row.id)
                                    }
                                ] : []
                            ) : [
                                ...(canManageStudents ? [{
                                    variant: 'passwordReset' as const,
                                    title: 'Copy Password Reset Link',
                                    loading: generatingResetUserId === row.user.id,
                                    onClick: () => generatePasswordResetLink(row.user.id),
                                }] : []),
                            ]}
                        />
                        {!isDeletedView && (
                            <UserCommsAction
                                targetUserId={row.user.id}
                                targetName={row.user.name}
                                targetEmail={row.user.email}
                                initialSubject={`Inquiry regarding ${row.user.name}`}
                                mailEnabled
                            />
                        )}
                    </div>
                );
            }
        }
    ];

    const handleDeleteClick = (studentId: string) => {
        const student = fetchedData?.data.find((s: Student) => s.id === studentId);
        if (student) {
            setSelectedStudent(student);
            setIsDeleteDialogOpen(true);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!selectedStudent || !token) return;
        try {
            await api.org.deleteStudent(selectedStudent.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Student removed successfully', type: 'success' } });
            setIsDeleteDialogOpen(false);
            // Invalidate all students-related cache keys
            mutate(matchesCacheKeyPrefix('students'));
        } catch (error: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to delete student', type: 'error' } });
        }
    };

    const handleRestore = async (id: string) => {
        if (!token) return;
        try {
            await api.org.restoreStudent(id, StudentStatus.ACTIVE, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Student restored successfully', type: 'success' } });
            mutate(matchesCacheKeyPrefix('students'));
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : 'Failed to restore student', type: 'error' } });
        }
    };

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
        ...(cohortId ? [{
            key: 'cohort',
            label: 'Cohort',
            value: cohorts.find((cohort) => cohort.id === cohortId)?.name || 'Selected cohort',
            onRemove: () => updateQueryParams({ cohortId: undefined, page: 1 }),
        }] : []),
        ...(departmentId ? [{
            key: 'department',
            label: 'Department',
            value: departmentsData?.data?.find((department) => department.id === departmentId)?.name || 'Selected department',
            onRemove: () => updateQueryParams({ departmentId: undefined, page: 1 }),
        }] : []),
        ...(sectionId ? [{
            key: 'section',
            label: 'Section',
            value: sections.find((section) => section.id === sectionId)?.name || 'Selected section',
            onRemove: () => updateQueryParams({ sectionId: undefined, page: 1 }),
        }] : []),
        ...(showAlumni ? [{
            key: 'showAlumni',
            label: 'Include',
            value: 'Alumni',
            onRemove: () => updateQueryParams({ showAlumni: undefined, page: 1 }),
        }] : []),
        ...(showOnlyMyStudents ? [{
            key: 'my',
            label: 'Scope',
            value: 'My students',
            onRemove: () => updateQueryParams({ my: undefined, page: 1 }),
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
                                { label: 'Active', value: StudentStatus.ACTIVE },
                                { label: 'Suspended', value: StudentStatus.SUSPENDED },
                            ]}
                            value={statusFilter}
                            onChange={(val) => updateQueryParams({ status: val, page: 1 })}
                            placeholder="Filter Status"
                        />
                    </div>

                    {canManageStudents && (
                        <div>
                            <label className="text-xs font-bold text-muted-foreground mb-1 block">
                                Cohort
                            </label>
                            <CustomSelect
                                options={[
                                    { label: 'All Cohorts', value: '' },
                                    ...cohorts.map((c) => ({ value: c.id, label: c.name })),
                                ]}
                                value={cohortId}
                                onChange={(val) => updateQueryParams({ cohortId: val, page: 1 })}
                                placeholder="Filter Cohort"
                            />
                        </div>
                    )}

                    {canManageStudents && (
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
                    )}

                    <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/50 px-3 py-2">
                        <span className="text-sm font-medium">Show Alumni</span>
                        <Toggle
                            checked={showAlumni}
                            onCheckedChange={(val) =>
                                updateQueryParams({ showAlumni: val ? 'true' : undefined, page: 1 })
                            }
                        />
                    </div>

                    {(user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER) && (
                        <div>
                            <label className="text-xs font-bold text-muted-foreground mb-1 block">
                                Section
                            </label>
                            <CustomSelect
                                value={sectionId}
                                onChange={(val) => updateQueryParams({ sectionId: val, page: 1 })}
                                options={[
                                    { value: '', label: 'All My Sections' },
                                    ...sections.map((sec) => ({
                                        value: sec.id,
                                        label: formatCourseSectionLabel({ courseName: sec.course?.name, sectionName: sec.name }),
                                    })),
                                ]}
                                placeholder="All My Sections"
                            />
                        </div>
                    )}

                    {user?.role === Role.ORG_MANAGER && canManageStudents && (
                        <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/50 px-3 py-2">
                            <span className="text-sm font-medium">My Students</span>
                            <Toggle
                                checked={showOnlyMyStudents}
                                onCheckedChange={(checked) => updateQueryParams({ my: checked, page: 1 })}
                            />
                        </div>
                    )}

                    {canManageStudents && (
                        <button
                            type="button"
                            onClick={() =>
                                updateQueryParams({
                                    deleted: 'true',
                                    page: 1,
                                    status: undefined,
                                    showAlumni: undefined,
                                    sectionId: undefined,
                                })
                            }
                            className="cursor-pointer text-left text-xs font-bold tracking-tighter text-muted-foreground/60 hover:text-primary hover:underline"
                        >
                            View Deleted Students
                        </button>
                    )}
                </>
            )}
        </FilterDrawerGrid>
    );


    return (
        <PageShell>
            <PageHeader
                title={isDeletedView ? 'Deleted Students' : 'Students'}
                description="Find, filter, and manage student records while keeping saved links intact."
                icon={UserPlus}
                breadcrumbs={pageBreadcrumbs}
                meta={isDeletedView ? <Badge variant="neutral" size="sm">Archive</Badge> : undefined}
                actions={(
                    <PageControls
                    drawerLabel="Student filters"
                    leading={(
                        <SearchBar
                            value={searchTerm}
                            onChange={(val) => updateQueryParams({ search: val, page: 1 })}
                            placeholder="Search students..."
                            mobileMode="expandable"
                        />
                    )}
                    renderFilters={() => filters}
                    showDrawer={!isDeletedView}
                    activeFilters={activeFilters}
                    actions={(
                        <>
                            {isDeletedView && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateQueryParams({
                                            deleted: undefined,
                                            page: 1,
                                        })
                                    }
                                    className="shrink-0 cursor-pointer whitespace-nowrap text-xs font-bold tracking-tighter text-primary hover:text-primary hover:underline"
                                >
                                    Back to Active Students
                                </button>
                            )}

                            {!isDeletedView && canManageStudents && (
                                <>
                                    <Button
                                        variant="secondary"
                                        onClick={() => setImportOpen(true)}
                                        icon={FileUp}
                                        className="shrink-0 whitespace-nowrap"
                                    >
                                        Import CSV
                                    </Button>
                                    <Button
                                        onClick={() => router.push(`${routeBase}/add`)}
                                        icon={UserPlus}
                                        className="shrink-0 whitespace-nowrap"
                                    >
                                        Add Student
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
                            if (canViewStudentDetails) router.push(`/profiles/${row.user.id}`);
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
                        emptyTitle={isDeletedView ? 'No deleted students' : 'No students found'}
                        emptyDescription={searchTerm || activeFilters.length > 0 ? 'Adjust the search or filters to broaden the result set.' : undefined}
                    />
                </div>
            </ResourcePanel>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Remove Student <strong>{selectedStudent?.user?.name}</strong></>}
                description={<>Are you sure you want to completely remove <strong>{selectedStudent?.user?.name || 'this student'}</strong>? This will also delete their login account.</>}
                confirmText="Yes, Remove Student"
                isDestructive={true}
            />

            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="students"
                title="Students"
                cachePrefix="students"
            />
        </PageShell>
    );
}
