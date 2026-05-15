'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, BadgeCheck } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchBar } from '@/components/ui/SearchBar';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Teacher, Role, TeacherStatus } from '@/types';
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
import { Drawer } from '@/components/ui/Drawer';

interface TeacherParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    status?: string;
    deleted?: boolean;
}

export default function TeachersPage() {
    const { token, user } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { dispatch } = useGlobal();

    // We no longer need local paginatedData state as fetchedData is used directly
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
    const [newMailOpen, setNewMailOpen] = useState(false);
    const [initialTargetId, setInitialTargetId] = useState<string | undefined>(undefined);
    const [initialSubject, setInitialSubject] = useState<string | undefined>(undefined);

    // URL State
    const page = parseInt(searchParams.get('page') || '1', 10);
    const searchTerm = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const statusFilter = searchParams.get('status') || '';
    const isDeletedView = searchParams.get('deleted') === 'true';
    const showEmeritus = searchParams.get('showEmeritus') === 'true';
    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('edu-teachers-limit');
            return saved ? parseInt(saved, 10) : 10;
        }
        return 10;
    });

    const teacherParams: TeacherParams = {
        page,
        limit: pageSize,
        search: searchTerm,
        sortBy,
        sortOrder,
        status: isDeletedView ? undefined : (statusFilter || (showEmeritus ? undefined : 'ACTIVE,SUSPENDED,ON_LEAVE')),
        deleted: isDeletedView,
    };

    // SWR for teachers data - replaces usePaginatedData
    const teachersKey = token ? ['teachers', teacherParams] as const : null;
    const { data: fetchedData, isLoading: isFetching, error: teachersError, mutate: mutateTeachers } = useSWR<
        { data: Teacher[]; totalPages: number; totalRecords: number }
    >(teachersKey);

    useEffect(() => {
        if (user && user.role !== Role.ORG_ADMIN && user.role !== Role.ORG_MANAGER) {
            if (user.role === Role.TEACHER) {
                router.replace(`/teachers/${user.id}`);
            } else if (user.role === Role.STUDENT) {
                router.replace(`/students/${user.id}`);
            } else {
                router.replace('/');
            }
        }
    }, [user, router, pathname]);

    const updateQueryParams = (updates: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '') {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        localStorage.setItem('edu-teachers-limit', String(newSize));
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

    const handleRestore = async (id: string) => {
        if (!token) return;
        try {
            await api.org.restoreTeacher(id, TeacherStatus.ACTIVE, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Teacher restored successfully', type: 'success' } });
            mutate(matchesCacheKeyPrefix('teachers'));
        } catch (err: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: err instanceof Error ? err.message : 'Failed to restore teacher', type: 'error' } });
        }
    };

    const columns: Column<Teacher>[] = [
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
            accessor: (row: Teacher) => {
                const status = row.status || TeacherStatus.ACTIVE;
                const config: Record<TeacherStatus, { label: string; variant: 'success' | 'error' | 'warning' | 'secondary' | 'neutral' }> = {
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
            header: 'Assigned Sections',
            sortable: false,
            accessor: (row: Teacher) => {
                const sectionsList = row.sections || [];
                return sectionsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-50">
                        {sectionsList.map(sec => (
                            <Badge key={sec?.id || Math.random()} variant="neutral" size="sm" className="truncate max-w-37.5" title={sec?.name}>
                                {sec?.name || 'Unknown'}
                            </Badge>
                        ))}
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
                    onEdit={isDeletedView ? undefined : () => router.push(`/teachers/edit/${row.id}`)}
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
    ];


    if (teachersError) {
        return <ErrorState error={teachersError} onRetry={() => mutateTeachers()} />;
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-card/80 backdrop-blur-2xl rounded-lg shadow-xl border border-border p-1 md:p-2 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="mb-2 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
                    <div className="flex-1 w-full">
                        <SearchBar value={searchTerm} onChange={(val) => updateQueryParams({ search: val, page: 1 })} placeholder="Search faculty..." />
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
                                                { label: 'Active', value: TeacherStatus.ACTIVE },
                                                { label: 'Suspended', value: TeacherStatus.SUSPENDED },
                                                { label: 'On Leave', value: TeacherStatus.ON_LEAVE },
                                            ]}
                                            value={statusFilter}
                                            onChange={(val) => updateQueryParams({ status: val, page: 1 })}
                                            placeholder="Filter Status"
                                        />
                                    </div>

                                    {/* Show Emeritus Toggle */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Show Emeritus</span>
                                        <Toggle
                                            checked={showEmeritus}
                                            onCheckedChange={(val) => updateQueryParams({ showEmeritus: val ? 'true' : undefined, page: 1 })}
                                        />
                                    </div>

                                    {/* View Deleted Faculty */}
                                    <button
                                        onClick={() => updateQueryParams({ deleted: isDeletedView ? undefined : 'true', page: 1, status: undefined, showEmeritus: undefined })}
                                        className={`text-xs font-bold tracking-tighter hover:underline hover:text-primary cursor-pointer ${isDeletedView ? 'text-primary' : 'text-muted-foreground/40'
                                            }`}
                                    >
                                        {isDeletedView ? '← Back to Active Faculty' : 'View Deleted Faculty'}
                                    </button>
                                </div>
                            </Drawer>
                        )}

                        {isDeletedView && (
                            <button
                                onClick={() => updateQueryParams({ deleted: undefined, page: 1 })}
                                className={`text-xs font-bold tracking-tighter hover:underline hover:text-primary cursor-pointer ${isDeletedView ? 'text-primary' : 'text-muted-foreground/40'
                                    }`}
                            >
                                ← Back to Active Faculty
                            </button>
                        )}

                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && !isDeletedView && (
                            <Button
                                onClick={() => router.push('/teachers/add')}
                                icon={UserPlus}
                                className="shrink-0"
                            >
                                Add Teacher
                            </Button>
                        )}
                    </div>
                </div>

                <div className="relative overflow-x-hidden flex-1 min-h-0">
                    <DataTable
                        data={fetchedData?.data || []}
                        columns={columns}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={(row) => {
                            if (user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) {
                                if (user?.id === row.userId) {
                                    router.push(`/teachers/${row.userId}/profile`);
                                } else {
                                    router.push(`/teachers/edit/${row.id}`);
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
                    />
                </div>
            </div>

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
        </div>
    );
}
