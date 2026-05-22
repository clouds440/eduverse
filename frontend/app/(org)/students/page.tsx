'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { useGlobal } from '@/context/GlobalContext';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Role, Student, Section, StudentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { TableActions } from '@/components/ui/TableActions';
import { CustomSelect } from '@/components/ui/CustomSelect';
import useSWR, { mutate } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { Badge } from '@/components/ui/Badge';
import { NewMailModal } from '@/components/mail/NewMailModal';
import { BrandIcon } from '@/components/ui/Brand';
import { Toggle } from '@/components/ui/Toggle';
import { Drawer } from '@/components/ui/Drawer';

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
}

export default function StudentsPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { dispatch } = useGlobal();

    // Redundant paginatedData state removed
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    // SWR for sections (for filter dropdown) - reduced limit for performance
    const sectionsKey = token && (user?.role === Role.TEACHER || user?.role === Role.ORG_MANAGER)
        ? ['sections', { my: user.role === Role.TEACHER, limit: 50 }] as const
        : null;
    const { data: sectionsData } = useSWR<{ data: Section[] }>(sectionsKey);
    const sections = sectionsData?.data || [];

    const [newMailOpen, setNewMailOpen] = useState(false);
    const [initialTargetId, setInitialTargetId] = useState<string | undefined>(undefined);
    const [initialSubject, setInitialSubject] = useState<string | undefined>(undefined);

    // URL State
    const page = parseInt(searchParams.get('page') || '1', 10);
    const searchTerm = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const showOnlyMyStudents = searchParams.get('my') === 'true';
    const sectionId = searchParams.get('sectionId') || '';
    const statusFilter = searchParams.get('status') || '';
    const isDeletedView = searchParams.get('deleted') === 'true';
    const showAlumni = searchParams.get('showAlumni') === 'true';
    const cohortId = searchParams.get('cohortId') || '';
    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('edu-students-limit');
            return saved ? parseInt(saved, 10) : 10;
        }
        return 10;
    });

    const studentParams: StudentParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        my: user?.role === Role.TEACHER ? true : showOnlyMyStudents,
        sectionId: sectionId || undefined,
        cohortId: cohortId || undefined,
        status: isDeletedView ? undefined : (statusFilter || (showAlumni ? undefined : 'ACTIVE,SUSPENDED')),
        deleted: isDeletedView,
    };

    // SWR for students data - replaces usePaginatedData
    const studentsKey = token ? ['students', studentParams] as const : null;
    const { data: fetchedData, isLoading: isFetching } = useSWR<
        { data: Student[]; totalPages: number; totalRecords: number }
    >(studentsKey);

    const cohortsKey = token && (user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER)
        ? ['cohorts', { limit: 100 }] as const
        : null;
    const { data: cohortsData } = useSWR<{ data: { id: string, name: string }[] }>(cohortsKey);
    const cohorts = cohortsData?.data || [];

    useEffect(() => {
        if (user && user.role === Role.STUDENT) {
            router.replace(`/students/${user.id}`);
        }
    }, [user, router]);

    const updateQueryParams = (updates: Record<string, string | number | undefined | boolean>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '' || value === false) {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        localStorage.setItem('edu-students-limit', String(newSize));
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
                const config: Record<StudentStatus, { label: string; variant: 'success' | 'error' | 'secondary' | 'neutral' }> = {
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
                            <span key={sec?.id || Math.random()} title={sec?.name}>
                                <Badge variant="neutral" size="sm" className="truncate max-w-37.5">
                                    {sec?.name || 'Unknown'}
                                </Badge>
                            </span>
                        ))}
                    </div>
                ) : sectionsList.length >= 2 ? (
                    <div className="flex flex-wrap gap-1 max-w-50">
                        {sectionsList.slice(0, 1).map(sec => (
                            <span key={sec?.id || Math.random()} title={sec?.name}>
                                <Badge variant="neutral" size="sm" className="truncate max-w-37.5">
                                    {sec?.name || 'Unknown'}
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
                const isManagerOrAdmin = user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER;
                return (
                    <TableActions
                        onEdit={isDeletedView || !isManagerOrAdmin ? undefined : () => router.push(`/students/edit/${row.id}`)}
                        onView={isDeletedView || user?.role !== Role.TEACHER ? undefined : () => router.push(`/students/edit/${row.id}`)}
                        onDelete={isDeletedView || !isManagerOrAdmin ? undefined : () => handleDeleteClick(row.id)}
                        variant="user"
                        isViewAndEdit={!isDeletedView && isManagerOrAdmin}
                        extraActions={isDeletedView ? [
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
                        ]}
                    />
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


    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-1 md:p-2 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="mb-2 flex flex-col gap-4 shrink-0">
                    {/* Unified Responsive Layout */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            <div className="flex-1 min-w-48">
                                <SearchBar
                                    value={searchTerm}
                                    onChange={(val) => updateQueryParams({ search: val, page: 1 })}
                                    placeholder="Search students..."
                                />
                            </div>
                        </div>
                        <div className='flex w-full md:w-auto gap-2 justify-between'>
                            {!isDeletedView && (
                                <Drawer position='left'>
                                    <div className="flex flex-col gap-8">
                                        {/* Status Filter */}
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

                                        {/* Cohort Filter */}
                                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
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

                                        {/* Show Alumni Toggle */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Show Alumni</span>
                                            <Toggle
                                                checked={showAlumni}
                                                onCheckedChange={(val) =>
                                                    updateQueryParams({ showAlumni: val ? 'true' : undefined, page: 1 })
                                                }
                                            />
                                        </div>

                                        {/* Section Select (if role allows) */}
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
                                                        ...sections.map((sec) => ({ value: sec.id, label: sec.name })),
                                                    ]}
                                                    placeholder="All My Sections"
                                                />
                                            </div>
                                        )}

                                        {/* My Students Toggle (if ORG_MANAGER) */}
                                        {user?.role === Role.ORG_MANAGER && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">My Students</span>
                                                <Toggle
                                                    checked={showOnlyMyStudents}
                                                    onCheckedChange={(checked) => updateQueryParams({ my: checked, page: 1 })}
                                                />
                                            </div>
                                        )}

                                        {/* View Deleted Students */}
                                        <button
                                            onClick={() =>
                                                updateQueryParams({
                                                    deleted: isDeletedView ? undefined : 'true',
                                                    page: 1,
                                                    status: undefined,
                                                    showAlumni: undefined,
                                                    sectionId: undefined,
                                                })
                                            }
                                            className={`text-xs font-bold tracking-tighter hover:underline hover:text-primary cursor-pointer ${isDeletedView ? 'text-primary' : 'text-muted-foreground/40'
                                                }`}
                                        >
                                            {isDeletedView ? '← Back to Active Students' : 'View Deleted Students'}
                                        </button>
                                    </div>
                                </Drawer>
                            )}

                            {isDeletedView && (
                                <button
                                    onClick={() =>
                                        updateQueryParams({
                                            deleted: undefined,
                                            page: 1,
                                        })
                                    }
                                    className={`text-xs font-bold tracking-tighter hover:underline hover:text-primary cursor-pointer ${isDeletedView ? 'text-primary' : 'text-muted-foreground/40'
                                        }`}
                                >
                                    ← Back to Active Students
                                </button>
                            )}

                            {!isDeletedView && (user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
                                <Button
                                    onClick={() => router.push('/students/add')}
                                    icon={UserPlus}
                                    className="shrink-0"
                                >
                                    Add Student
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative overflow-x-hidden flex-1 min-h-0">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={(row) => {
                            router.push(`/students/edit/${row.id}`);
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
                    />
                </div>
            </div>

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
        </div>
    );
}
