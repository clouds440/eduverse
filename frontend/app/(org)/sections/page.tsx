'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Layers, Plus } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { usePathname, useRouter } from 'next/navigation';
import { Section, Role, AcademicCycle } from '@/types';
import { TableActions } from '@/components/ui/TableActions';
import { Label } from '@/components/ui/Label';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useGlobal } from '@/context/GlobalContext';
import { Toggle } from '@/components/ui/Toggle';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { PageHeader, PageShell, ResourcePanel, ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';

interface SectionParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    my?: boolean;
    academicCycleId?: string;
}

export default function SectionsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();

    const pathname = usePathname();
    const router = useRouter();
    const { searchParams, getBooleanParam, getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    // URL State
    const page = getNumberParam('page', 1);
    const searchTerm = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const showOnlyMySections = getBooleanParam('my');
    const academicCycleId = getStringParam('academicCycleId');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-sections-limit', 10);

    const sectionParams: SectionParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        my: showOnlyMySections || undefined,
        academicCycleId: academicCycleId || undefined
    };

    // SWR for sections data - replaces usePaginatedData
    const sectionsKey = token ? ['sections', sectionParams] as const : null;
    const { data: fetchedData, isLoading: isFetching, error: sectionsError, mutate: mutateSections } = useSWR<
        { data: Section[]; totalPages: number; totalRecords: number }
    >(sectionsKey);

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    useEffect(() => {
        if (user && user.role === Role.STUDENT) {
            router.replace(`/students/${user.id}`);
        }
    }, [user, router, pathname]);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingSection, setDeletingSection] = useState<Section | null>(null);
    const queryString = searchParams.toString();
    const currentListPath = queryString ? `${pathname}?${queryString}` : pathname;

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const handleDeleteConfirm = async () => {
        if (!deletingSection || !token) return;
        try {
            await api.org.deleteSection(deletingSection.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section deleted successfully', type: 'success' } });
            setDeleteDialogOpen(false);
            mutate(matchesCacheKeyPrefix('sections'));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error deleting section';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        }
    };

    const columns = [
        {
            header: 'Section Name',
            sortable: true,
            sortKey: 'name',
            accessor: (row: Section) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-card-foreground">{row.name}</span>
                    <span className="text-sm font-medium text-primary">{row.course?.name || 'No Course'}</span>
                </div>
            )
        },
        {
            header: 'Assigned Teachers',
            sortable: false,
            accessor: (row: Section) => (
                <div className="flex flex-wrap gap-1">
                    {row.teachers && row.teachers.length > 0 ? (
                        row.teachers.map((teacher, idx) => (
                            <Badge key={idx} variant="primary" size="sm">
                                {teacher.user.name}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-muted-foreground/50 text-sm italic">No teachers</span>
                    )}
                </div>
            )
        },
        {
            header: 'Enrolled Students',
            sortable: false,
            accessor: (row: Section) => {
                const studentsList = row.students || [];
                return studentsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-50">
                        <Badge variant="primary" size="sm" className="truncate max-w-37.5" title='Click edit icon to view all'>
                            {studentsList.length === 1 ? '1 Student' : studentsList.length + ' Students'}
                        </Badge>
                    </div>
                ) : <span className="text-muted-foreground/30 italic">No students</span>;
            }
        },
        {
            header: 'Placement',
            sortable: true,
            sortKey: 'academicCycleId',
            accessor: (row: Section) => (
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground truncate max-w-40">{row.academicCycle?.name || 'No Cycle'}</span>
                    {row.cohort && (
                        <span className="text-[10px] text-primary font-black uppercase tracking-widest">{row.cohort.name}</span>
                    )}
                </div>
            )
        },
        {
            header: 'Room',
            sortable: true,
            sortKey: 'room',
            accessor: (row: Section) => row.room || <span className="text-muted-foreground/50 italic">TBD</span>
        },
        {
            header: 'Actions',
            width: 210,
            accessor: (row: Section) => {
                const isAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;
                return (
                    <TableActions
                        onEdit={isAdmin ? () => {
                            router.push(`/sections/edit/${row.id}?returnTo=${encodeURIComponent(currentListPath)}`);
                        } : undefined}
                        onView={() => {
                            router.push(`/sections/${row.id}`);
                        }}
                        onDelete={isAdmin ? () => {
                            setDeletingSection(row);
                            setDeleteDialogOpen(true);
                        } : undefined}
                        editTitle="Edit Section"
                        deleteTitle="Delete Section"
                        variant="default"
                        isViewAndEdit={isAdmin}
                    />
                );
            }
        }
    ];

    const activeFilters: ActiveFilter[] = [
        ...(showOnlyMySections ? [{
            key: 'my',
            label: 'Scope',
            value: 'My sections',
            onRemove: () => updateQueryParams({ my: undefined, page: 1 }),
        }] : []),
        ...(academicCycleId ? [{
            key: 'academicCycleId',
            label: 'Cycle',
            value: cyclesData?.data?.find((cycle) => cycle.id === academicCycleId)?.name || 'Selected cycle',
            onRemove: () => updateQueryParams({ academicCycleId: undefined, page: 1 }),
        }] : []),
    ];


    if (sectionsError) {
        return <ErrorState error={sectionsError} onRetry={() => {
            mutateSections();
        }} />;
    }

    return (
        <PageShell>
            <PageHeader
                title="Sections"
                description="Search and maintain class sections while preserving course, cycle, and enrollment behavior."
                icon={Layers}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Sections' },
                ]}
            />
            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 bg-card/80 p-3 sm:p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex-1">
                        <SearchBar value={searchTerm} onChange={(val) => updateQueryParams({ search: val, page: 1 })} placeholder="Search by section name, room..." />
                    </div>

                    <div className='flex w-full md:w-auto gap-2 justify-between'>
                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
                            <Drawer position='left'>
                                <div className="flex flex-col gap-6">
                                    {/* My Sections Toggle */}
                                    {user?.role === Role.ORG_MANAGER && (
                                        <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-border">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold uppercase tracking-wider">My Sections</span>
                                                <span className="text-[10px] text-muted-foreground">Only show sections assigned to me</span>
                                            </div>
                                            <Toggle
                                                checked={showOnlyMySections}
                                                onCheckedChange={(checked) => updateQueryParams({ my: checked, page: 1 })}
                                            />
                                        </div>
                                    )}

                                    {/* Academic Cycle Filter */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filter by Academic Cycle</Label>
                                        <CustomSelect
                                            options={[
                                                { label: 'All Academic Cycles', value: '' },
                                                ...(cyclesData?.data?.map(cycle => ({ value: cycle.id, label: cycle.name })) || [])
                                            ]}
                                            value={academicCycleId}
                                            onChange={(val) => updateQueryParams({ academicCycleId: val, page: 1 })}
                                            placeholder="All Cycles"
                                        />
                                    </div>
                                </div>
                            </Drawer>
                        )}

                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
                            <Button
                                onClick={() => router.push('/sections/create')}
                                icon={Plus}
                                className="w-auto shadow-lg shadow-primary/10"
                            >
                                New Section
                            </Button>
                        )}
                    </div>
                </div>
                </div>

                <ResourceToolbar activeFilters={activeFilters} className="border-t border-border/60" />

                <div className="relative overflow-x-hidden flex-1 min-h-0">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={(row) => router.push(`/sections/${row.id}`)}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(p) => updateQueryParams({ page: p })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle="No sections found"
                        emptyDescription={searchTerm || activeFilters.length > 0 ? 'Adjust the search or filters to broaden the result set.' : undefined}
                    />
                </div>
            </ResourcePanel>

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={<>Delete Section <strong>{deletingSection?.name}</strong></>}
                description={<>Are you sure you want to delete <strong>{deletingSection?.name}</strong>?</>}
                confirmText="Yes, Delete Section"
                isDestructive={true}
            />
        </PageShell>
    );
}
