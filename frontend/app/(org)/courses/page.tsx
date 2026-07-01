'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { BookOpen, Building2, Clock3, FileUp, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { ApiError, Course, Department, Role } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ModalForm } from '@/components/ui/ModalForm';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { DocsLink } from '@/components/ui/DocsLink';
import { SearchBar } from '@/components/ui/SearchBar';
import { TableActions } from '@/components/ui/TableActions';
import { Textarea } from '@/components/ui/Textarea';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { formatDepartmentLabel } from '@/lib/utils';
import { CsvImportModal } from '@/components/imports/CsvImportModal';

interface CourseParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    my?: boolean;
    departmentId?: string;
}

export default function CoursesPage() {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const router = useRouter();
    const { getBooleanParam, getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const isProcessing = state.ui.processing['course-edit'];

    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const showOnlyMyCourses = getBooleanParam('my');
    const departmentId = getStringParam('departmentId');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-courses-limit', 10);

    const courseParams: CourseParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        my: user?.role === Role.TEACHER ? true : (showOnlyMyCourses || undefined),
        departmentId: departmentId || undefined,
    };

    const coursesKey = token ? ['courses', courseParams] as const : null;
    const { data: fetchedData, isLoading: isFetching, error: coursesError, mutate: mutateCourses } = useSWR<
        { data: Course[]; totalPages: number; totalRecords: number }
    >(coursesKey);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [editFormData, setEditFormData] = useState({ name: '', code: '', description: '', creditHours: '3', departmentId: '' });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
    const { data: departmentsData } = useSWR<{ data: Department[] }>(token ? ['departments', { limit: 1000, isActive: true }] as const : null);

    const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const isTeacher = user?.role === Role.TEACHER;

    useEffect(() => {
        if (user?.role === Role.STUDENT) {
            router.replace(`/student/${user.id}`);
        }
    }, [router, user]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const openCourseModal = (course: Course) => {
        setEditingCourse(course);
        setEditFormData({
            name: course.name,
            code: course.code || '',
            description: course.description || '',
            creditHours: String(course.creditHours ?? 3),
            departmentId: course.departmentId || '',
        });
        setEditModalOpen(true);
    };

    const handleEditSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!editingCourse || !token) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'course-edit' });
        try {
            await api.org.updateCourse(editingCourse.id, {
                name: editFormData.name,
                code: editFormData.code,
                description: editFormData.description,
                creditHours: Number(editFormData.creditHours),
                departmentId: editFormData.departmentId || null,
            }, token);
            setEditModalOpen(false);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Course updated successfully', type: 'success' } });
            mutate(matchesCacheKeyPrefix('courses'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error updating course';
            const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'course-edit' });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingCourse || !token) return;

        try {
            await api.org.deleteCourse(deletingCourse.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Course deleted successfully', type: 'success' } });
            setDeleteDialogOpen(false);
            mutate(matchesCacheKeyPrefix('courses'));
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const rawMessage = apiError?.response?.data?.message || apiError?.message || 'Error deleting course';
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
        ...(showOnlyMyCourses ? [{
            key: 'my',
            label: 'Scope',
            value: 'My courses',
            onRemove: () => updateQueryParams({ my: undefined, page: 1 }),
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
            {isAdmin && (
                <div>
                    <Label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</Label>
                    <CustomSelect
                        value={departmentId}
                        onChange={(value) => updateQueryParams({ departmentId: value, page: 1 })}
                        icon={Building2}
                        options={[
                            { value: '', label: 'All Departments' },
                            ...(departmentsData?.data?.map((department) => ({
                                value: department.id,
                                label: formatDepartmentLabel(department),
                            })) || []),
                        ]}
                        placeholder="All Departments"
                        searchable
                    />
                </div>
            )}
        </FilterDrawerGrid>
    );

    const columns = useMemo<Column<Course>[]>(() => [
        {
            header: 'Course Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{row.name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{row.code} - Course record</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Description',
            sortable: true,
            sortKey: 'description',
            accessor: (row) => row.description || <span className="text-muted-foreground/50 italic">No description</span>,
        },
        {
            header: 'Department',
            sortable: true,
            sortKey: 'departmentId',
            accessor: (row) => row.department ? (
                <Badge
                    variant="primary"
                    size="sm"
                    style={row.department.color ? { borderColor: `${row.department.color}55`, backgroundColor: `${row.department.color}18`, color: row.department.color } : undefined}
                >
                    {formatDepartmentLabel(row.department)}
                </Badge>
            ) : <span className="text-muted-foreground/50 italic">Unassigned</span>,
        },
        {
            header: 'Credits',
            sortable: true,
            sortKey: 'creditHours',
            accessor: (row) => (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2 py-1 text-xs font-black text-foreground">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                    {row.creditHours ?? 3}
                </span>
            ),
        },
        {
            header: 'Last Updated',
            sortable: true,
            sortKey: 'updatedAt',
            accessor: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium text-card-foreground/80">{row.updatedBy || 'System'}</span>
                    <span className="text-xs text-muted-foreground/50">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'Never'}
                    </span>
                </div>
            ),
        },
        {
            header: 'Actions',
            width: 180,
            accessor: (row) => (
                <TableActions
                    onEdit={isAdmin ? () => openCourseModal(row) : undefined}
                    onView={isTeacher ? () => openCourseModal(row) : undefined}
                    onDelete={isAdmin ? () => {
                        setDeletingCourse(row);
                        setDeleteDialogOpen(true);
                    } : undefined}
                    editTitle="Edit Course"
                    deleteTitle="Delete Course"
                    variant="default"
                    isViewAndEdit={isAdmin}
                />
            ),
        },
    ], [isAdmin, isTeacher]);

    if (coursesError) {
        return <ErrorState error={coursesError} onRetry={() => mutateCourses()} />;
    }

    return (
        <PageShell>
            <PageHeader
                title="Courses"
                description={<>Search and maintain course records used by sections, grading, and materials. <DocsLink href="/docs/courses-sections#course-records">Read course docs</DocsLink></>}
                icon={BookOpen}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Courses' },
                ]}
                actions={(
                    <PageControls
                    drawerLabel="Course filters"
                    leading={(
                        <SearchBar
                            value={searchTerm}
                            onChange={(value) => updateQueryParams({ search: value, page: 1 })}
                            placeholder="Search by name, code, or description..."
                            mobileMode="expandable"
                        />
                    )}
                    renderFilters={() => filters}
                    showDrawer={isAdmin}
                    activeFilters={activeFilters}
                    actions={(
                        <>
                            {isAdmin && (
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
                                        onClick={() => router.push('/courses/create')}
                                        icon={Plus}
                                        className="shrink-0 whitespace-nowrap"
                                    >
                                        Create Course
                                    </Button>
                                </>
                            )}
                        </>
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
                        onRowClick={openCourseModal}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(nextPage) => updateQueryParams({ page: nextPage })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle="No courses found"
                        emptyDescription={searchTerm || activeFilters.length > 0 ? 'Adjust the search or filters to broaden the result set.' : 'Create a course to begin organizing sections and materials.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title="Update Course Information"
                onSubmit={handleEditSubmit}
                isSubmitting={isProcessing}
                loadingId="course-edit"
                submitText="Save Changes"
                showSubmit={isAdmin}
            >
                <div className="space-y-6 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="courseName">Course Name *</Label>
                        <Input
                            id="courseName"
                            type="text"
                            required
                            value={editFormData.name}
                            onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })}
                            placeholder="e.g. Mathematics"
                            icon={BookOpen}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="courseCode">Course Code *</Label>
                        <Input
                            id="courseCode"
                            type="text"
                            required
                            value={editFormData.code}
                            onChange={(event) => setEditFormData({ ...editFormData, code: event.target.value })}
                            placeholder="e.g. MATH-101"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="courseCreditHours">Credit Hours *</Label>
                        <Input
                            id="courseCreditHours"
                            type="number"
                            min={0.01}
                            step="0.5"
                            required
                            value={editFormData.creditHours}
                            onChange={(event) => setEditFormData({ ...editFormData, creditHours: event.target.value })}
                            placeholder="3"
                            icon={Clock3}
                        />
                        <p className="text-xs font-semibold text-muted-foreground">
                            Credit hours can affect weighted GPA and transcript totals. <DocsLink href="/docs/courses-sections#course-credit-hours">Credit details</DocsLink>
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="courseDepartment">Department</Label>
                        <CustomSelect
                            value={editFormData.departmentId}
                            onChange={(value) => setEditFormData({ ...editFormData, departmentId: value })}
                            icon={Building2}
                            options={[
                                { value: '', label: 'No Department' },
                                ...(departmentsData?.data?.map((department) => ({
                                    value: department.id,
                                    label: formatDepartmentLabel(department),
                                })) || []),
                            ]}
                            placeholder="Select department..."
                            searchable
                            disabled={!isAdmin}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={editFormData.description}
                            onChange={(event) => setEditFormData({ ...editFormData, description: event.target.value })}
                            placeholder="Briefly describe this course..."
                            rows={5}
                        />
                    </div>
                </div>
            </ModalForm>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Delete Course <strong>{deletingCourse?.name}</strong></>}
                description={<>Are you sure you want to delete <strong>{deletingCourse?.name}</strong>? This action cannot be undone.</>}
                confirmText="Yes, Delete Course"
                isDestructive={true}
            />
            <CsvImportModal
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                entity="courses"
                title="Courses"
                cachePrefix="courses"
            />
        </PageShell>
    );
}



