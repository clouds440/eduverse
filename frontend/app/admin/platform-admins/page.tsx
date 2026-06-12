'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Users, Mail, MessageSquare, Calendar, UserPlus, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError, PlatformAdmin, PaginatedResponse, Role } from '@/types';
import { TableActions } from '@/components/ui/TableActions';
import { ModalForm } from '@/components/ui/ModalForm';
import { SearchBar } from '@/components/ui/SearchBar';
import { useGlobal } from '@/context/GlobalContext';
import { DataTable, Column } from '@/components/ui/DataTable';
import useSWR, { mutate as mutateCache } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { Button } from '@/components/ui/Button';
import PasswordStrength from '@/components/ui/PasswordStrength';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageHeader, PageShell, ResourcePanel, ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { getRoleLabel } from '@/lib/roles';

interface PlatformAdminParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

export default function PlatformAdminsPage() {
    const { user, token, loading } = useAuth();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();
    const { state, dispatch } = useGlobal();
    const actionLoading = Object.keys(state.ui.processing).length > 0;

    // URL State
    const page = getNumberParam('page', 1);
    const searchQuery = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const [pageSize, setPageSize] = usePersistentPageSize('edu-admin-admins-limit', 10);

    const adminParams: PlatformAdminParams = {
        page,
        limit: pageSize,
        search: searchQuery,
        sortBy,
        sortOrder,
    };

    // SWR for platform admins data - replaces usePaginatedData
    const adminsKey = token ? ['platform-admins', adminParams] as const : null;
    const { data: fetchedData, error: fetchError, isLoading: fetching, mutate: retryAdmins } = useSWR<
        PaginatedResponse<PlatformAdmin>
    >(adminsKey);

    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [adminModalMode, setAdminModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
    const [operatingAdmin, setOperatingAdmin] = useState<PlatformAdmin | null>(null);
    const [adminFormData, setAdminFormData] = useState({ name: '', email: '', password: '', phone: '' });
    const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; password?: string; phone?: string; general?: string }>({});

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const paginatedData = fetchedData || null;

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const handleOpenAdminModal = (mode: 'CREATE' | 'EDIT', admin: PlatformAdmin | null = null) => {
        setAdminModalMode(mode);
        setOperatingAdmin(admin);
        setFormErrors({});
        if (mode === 'EDIT' && admin) {
            setAdminFormData({ name: admin.name, email: admin.email, password: '', phone: admin.phone || '' });
        } else {
            setAdminFormData({ name: '', email: '', password: '', phone: '' });
        }
        setIsAdminModalOpen(true);
    };

    const handleAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setFormErrors({});
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'platform-admin-submit' });
            if (adminModalMode === 'CREATE') {
                await api.admin.createPlatformAdmin(adminFormData, token);
                mutateCache(matchesCacheKeyPrefix('platform-admins'));
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Platform Admin created successfully', type: 'success' } });
            } else if (operatingAdmin) {
                await api.admin.updatePlatformAdmin(operatingAdmin.id, {
                    name: adminFormData.name,
                    phone: adminFormData.phone,
                    ...(adminFormData.password ? { password: adminFormData.password } : {})
                }, token);
                mutateCache(matchesCacheKeyPrefix('platform-admins'));
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Platform Admin updated successfully', type: 'success' } });
            }
            setIsAdminModalOpen(false);
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const message = apiError.response?.data?.message || apiError.message || 'Failed to save admin';
            const newErrors: typeof formErrors = {};

            if (Array.isArray(message)) {
                message.forEach((m: string) => {
                    const msg = m.toLowerCase();
                    if (msg.includes('name')) newErrors.name = m;
                    else if (msg.includes('email')) newErrors.email = m;
                    else if (msg.includes('password')) newErrors.password = m;
                    else if (msg.includes('phone')) newErrors.phone = m;
                    else newErrors.general = m;
                });
            } else {
                const msgStr = message;
                if (msgStr.toLowerCase().includes('name')) newErrors.name = msgStr;
                else if (msgStr.toLowerCase().includes('email')) newErrors.email = msgStr;
                else if (msgStr.toLowerCase().includes('password')) newErrors.password = msgStr;
                else if (msgStr.toLowerCase().includes('phone')) newErrors.phone = msgStr;
                else newErrors.general = msgStr;
            }
            setFormErrors(newErrors);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'platform-admin-submit' });
        }
    };

    const handleDeleteAdmin = (admin: PlatformAdmin) => {
        setOperatingAdmin(admin);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!operatingAdmin || !token) return;

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `platform-admin-delete-${operatingAdmin.id}` });
            await api.admin.deletePlatformAdmin(operatingAdmin.id, token);
            mutateCache(matchesCacheKeyPrefix('platform-admins'));
            dispatch({ type: 'TOAST_ADD', payload: { message: `${operatingAdmin.name} deleted successfully`, type: 'success' } });
            setIsDeleteModalOpen(false);
            setOperatingAdmin(null);
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to delete admin', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `platform-admin-delete-${operatingAdmin.id}` });
        }
    };

    const platformAdmins = paginatedData?.data || [];
    const activeFilters: ActiveFilter[] = [
        ...(searchQuery ? [{
            key: 'search',
            label: 'Search',
            value: searchQuery,
            onRemove: () => updateQueryParams({ search: undefined, page: 1 }),
        }] : []),
    ];

    const columns = useMemo<Column<PlatformAdmin>[]>(() => [
        {
            header: 'Administrator',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-sm flex items-center justify-center text-primary shrink-0">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-foreground leading-tight wrap-break-word">{row.name}</h4>
                        <span className="text-[10px] font-bold text-muted-foreground tracking-widest block mt-0.5">{getRoleLabel(row.role)}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Contact Info',
            sortable: true,
            sortKey: 'email',
            accessor: (row) => (
                <div className="space-y-1">
                    <div className="flex items-center text-xs font-medium text-muted-foreground gap-1.5">
                        <Mail className="w-3 h-3 text-primary/80" />
                        {row.email}
                    </div>
                    {row.phone && (
                        <div className="flex items-center text-xs font-medium text-muted-foreground gap-1.5">
                            <MessageSquare className="w-3 h-3 text-primary/80" />
                            {row.phone}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Added On',
            sortable: true,
            sortKey: 'createdAt',
            accessor: (row) => (
                <div className="flex items-center text-xs font-medium text-muted-foreground gap-1.5 opacity-80">
                    <Calendar className="w-3 h-3" />
                    {new Date(row.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
            )
        },
        {
            header: 'Actions',
            width: 150,
            accessor: (row) => {
                if (row.id === user?.id) return <span className="text-xs text-muted-foreground">Current User</span>;
                return (
                    <TableActions
                        onEdit={() => handleOpenAdminModal('EDIT', row)}
                        onDelete={() => handleDeleteAdmin(row)}
                        isDeleting={actionLoading && operatingAdmin?.id === row.id}
                        isViewAndEdit={true}
                        variant="user"
                    />
                )
            }
        }
    ], [user?.id, actionLoading, operatingAdmin]);

    if (loading || (!user && !loading)) {
        return <Loading className="h-full" text="Loading platform admins..." size="lg" icon={Users} />;
    }

    if (fetchError && !fetchedData) {
        return (
            <ErrorState
                error={fetchError}
                onRetry={() => retryAdmins()}
                className="min-h-80"
                title="Unable to load platform admins"
                description="The platform admin list could not be fetched."
            />
        );
    }

    if (user?.role !== Role.SUPER_ADMIN) {
        return <div className="p-8 text-center text-muted-foreground">Access Restricted</div>;
    }

    return (
        <PageShell>
            <PageHeader
                title="Platform Admins"
                description="Manage platform administrators without changing role or security flows."
                icon={Users}
                breadcrumbs={[
                    { label: 'Admin' },
                    { label: 'Platform Admins' },
                ]}
                meta={paginatedData?.totalRecords !== undefined ? (
                    <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-1 text-xs font-black text-muted-foreground">
                        {paginatedData.totalRecords} total
                    </span>
                ) : undefined}
            />
            <ResourcePanel>
                <div className="flex flex-col gap-3 border-b border-border/60 bg-card/80 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1 md:max-w-xl">
                        <SearchBar
                            value={searchQuery}
                            onChange={(val) => updateQueryParams({ search: val, page: 1 })}
                            placeholder="Search admins by name or email..."
                        />
                    </div>
                    <Button
                        icon={UserPlus}
                        variant="primary"
                        type='button'
                        title='Add New Admin Profile'
                        onClick={() => handleOpenAdminModal('CREATE')}
                    >
                        Add Admin
                    </Button>
                </div>

                <ResourceToolbar activeFilters={activeFilters} />

                <div className="flex-1 min-h-0">
                    <DataTable
                        columns={columns}
                        data={platformAdmins}
                        keyExtractor={(row) => row.id}
                        onRowClick={(row) => handleOpenAdminModal('EDIT', row)}
                        isLoading={fetching}
                        currentPage={paginatedData?.currentPage || 1}
                        totalPages={paginatedData?.totalPages || 1}
                        totalResults={paginatedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(p) => updateQueryParams({ page: p })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle="No platform admins found"
                        emptyDescription={searchQuery ? 'Clear or adjust the search to broaden the result set.' : 'Create a platform admin to delegate operations safely.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>

            <ModalForm
                isOpen={isAdminModalOpen}
                onClose={() => setIsAdminModalOpen(false)}
                onSubmit={handleAdminSubmit}
                title={adminModalMode === 'CREATE' ? 'Add New Platform Admin' : `Edit ${operatingAdmin?.name}`}
                submitText={adminModalMode === 'CREATE' ? 'Create Admin' : 'Save Changes'}
                isSubmitting={actionLoading}
                loadingId="platform-admin-submit"
            >
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground tracking-wider block ml-1">Full Name</label>
                        <Input
                            type="text"
                            required
                            value={adminFormData.name}
                            onChange={e => setAdminFormData(prev => ({ ...prev, name: e.target.value }))}
                            error={!!formErrors.name}
                            icon={Users}
                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            placeholder="John Doe"
                        />
                        {formErrors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.name}</p>}
                    </div>
                    {adminModalMode === 'CREATE' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-wider block ml-1">Email Address</label>
                            <Input
                                type="email"
                                required
                                value={adminFormData.email}
                                onChange={e => setAdminFormData(prev => ({ ...prev, email: e.target.value }))}
                                error={!!formErrors.email}
                                icon={Mail}
                                className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                                placeholder="john@example.com"
                            />
                            {formErrors.email && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.email}</p>}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground tracking-wider block ml-1">Phone (Optional)</label>
                        <Input
                            type="tel"
                            autoComplete='off'
                            value={adminFormData.phone}
                            onChange={e => setAdminFormData(prev => ({ ...prev, phone: e.target.value }))}
                            error={!!formErrors.phone}
                            icon={MessageSquare}
                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            placeholder="+1 (555) 000-0000"
                        />
                        {formErrors.phone && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground tracking-wider block ml-1">
                            {adminModalMode === 'CREATE' ? 'Password' : 'New Password (Optional)'}
                        </label>
                        <Input
                            type="password"
                            required={adminModalMode === 'CREATE'}
                            value={adminFormData.password}
                            onChange={e => setAdminFormData(prev => ({ ...prev, password: e.target.value }))}
                            error={!!formErrors.password}
                            icon={Lock}
                            className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                            placeholder="••••••••"
                        />
                        {formErrors.password && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.password}</p>}
                        <PasswordStrength password={adminFormData.password} className="mt-2" />
                    </div>
                    {formErrors.general && <p className="mt-2 text-sm text-danger font-bold text-center">{formErrors.general}</p>}
                </div>
            </ModalForm>

            <ModalForm
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onSubmit={handleConfirmDelete}
                title="Confirm Deletion"
                submitText="Permanently Delete"
                variant="danger"
                isSubmitting={actionLoading}
                loadingId="platform-admin-delete"
            >
                <div>
                    <p className="text-sm font-medium text-foreground">
                        Are you sure you want to remove <strong>{operatingAdmin?.name}</strong> from Platform Admins?
                    </p>
                    <p className="text-xs text-danger mt-2">This action cannot be undone.</p>
                </div>
            </ModalForm>
        </PageShell>
    );
}
