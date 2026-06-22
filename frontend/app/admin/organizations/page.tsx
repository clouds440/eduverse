'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { ShieldOff, ShieldAlert, ShieldCheck, Building2, MapPin, Mail, Calendar, LucideIcon, Tag, Phone, Info, Hash, Clock, GraduationCap, BookOpen, School, Library, MonitorPlay, Pencil, Send } from 'lucide-react';
import { api } from '@/lib/api';
import statsStore from '@/lib/statsStore';
import { Organization, OrgStatus } from '@/types';
import { getPublicUrl } from '@/lib/utils';
import { TableActions, AdminAction } from '@/components/ui/TableActions';
import { ModalForm } from '@/components/ui/ModalForm';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { DataField, useUI } from '@/context/UIContext';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import useSWR, { mutate as mutateCache } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Loading } from '@/components/ui/Loading';
import { NewMailModal } from '@/components/mail/NewMailModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader, PageShell, ResourcePanel, ResourceToolbar, type ActiveFilter } from '@/components/ui/PageShell';
import { usePersistentPageSize } from '@/hooks/usePersistentPageSize';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { Badge } from '@/components/ui/Badge';

interface AdminOrgParams {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    status: OrgStatus | 'ALL';
    type: string;
}

export default function OrganizationsPage() {
    const { user, token, loading } = useAuth();
    const { state, dispatch } = useGlobal();
    const { getNumberParam, getStringParam, updateQueryParams } = useUrlQueryState();

    const { openViewModal } = useUI();
    const actionLoading = Object.keys(state.ui.processing).length > 0;
    const stats = state.stats.admin;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [operatingOrg, setOperatingOrg] = useState<{ id: string, name: string, email: string, adminUserId: string, statusHistory?: Organization['statusHistory'] } | null>(null);
    const [modalMode, setModalMode] = useState<'REJECT' | 'SUSPEND' | 'EDIT_MESSAGE'>('REJECT');
    const [reason, setReason] = useState('');

    const [newMailOpen, setNewMailOpen] = useState(false);
    const [initialTargetId, setInitialTargetId] = useState<string | undefined>(undefined);
    const [initialSubject, setInitialSubject] = useState<string | undefined>(undefined);

    const [pageSize, setPageSize] = usePersistentPageSize('edu-admin-orgs-limit', 10);

    const activeStatusTab = (getStringParam('status', 'ALL') as OrgStatus | 'ALL');
    const page = getNumberParam('page', 1);
    const searchQuery = getStringParam('search');
    const sortBy = getStringParam('sortBy', 'name');
    const sortOrder = (getStringParam('sortOrder', 'asc') as 'asc' | 'desc');
    const orgTypeFilter = getStringParam('type', 'ALL');

    // URL State
    const orgParams: AdminOrgParams = {
        page,
        limit: pageSize,
        search: searchQuery,
        sortBy,
        sortOrder,
        status: activeStatusTab,
        type: orgTypeFilter,
    };

    // SWR for organizations data - replaces usePaginatedData
    const orgsKey = token ? ['admin-organizations', {
        ...orgParams,
        status: orgParams.status === 'ALL' ? undefined : orgParams.status
    }] as const : null;
    const { data: fetchedData, error: fetchError, isLoading: isFetching, mutate: retryOrganizations } = useSWR<
        { data: Organization[]; totalPages: number; totalRecords: number; counts?: Record<string, number> }
    >(orgsKey);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        updateQueryParams({ page: 1 });
    };

    const handleApprove = async (org: Organization) => {
        if (!token) return;
        if (!org.contactEmailVerifiedAt) {
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: `${org.name} cannot be approved until its contact email is verified`,
                    type: 'error'
                }
            });
            return;
        }

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `approve-${org.id}` });
            await api.admin.approveOrganization(org.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: `${org.name} approved successfully`, type: 'success' } });
            mutateCache(matchesCacheKeyPrefix('admin-organizations'));
            // Also refresh admin stats
            if (token) {
                statsStore.fetchAll(token).then(({ admin }) => {
                    if (admin) dispatch({ type: 'STATS_SET_ADMIN', payload: admin });
                }).catch(console.error);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to approve organization';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `approve-${org.id}` });
        }
    };

    const handleOpenModal = (row: Organization, mode: 'REJECT' | 'SUSPEND' | 'EDIT_MESSAGE') => {
        setOperatingOrg({ id: row.id, name: row.name, email: row.email, adminUserId: row.adminUserId || '', statusHistory: row.statusHistory });
        setModalMode(mode);
        const lastMessage = row.statusHistory && row.statusHistory.length > 0 ? row.statusHistory[row.statusHistory.length - 1].message : '';
        setReason(lastMessage || '');
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!operatingOrg || !token) return;

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `${modalMode.toLowerCase()}-${operatingOrg.id}` });
            if (modalMode === 'REJECT') {
                await api.admin.rejectOrganization(operatingOrg.id, reason, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: `${operatingOrg.name} rejected`, type: 'info' } });
                mutateCache(matchesCacheKeyPrefix('admin-organizations'));
            } else if (modalMode === 'SUSPEND') {
                await api.admin.suspendOrganization(operatingOrg.id, reason, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: `${operatingOrg.name} suspended`, type: 'info' } });
                mutateCache(matchesCacheKeyPrefix('admin-organizations'));
            } else {
                if (activeStatusTab === OrgStatus.REJECTED) {
                    await api.admin.rejectOrganization(operatingOrg.id, reason, token);
                } else {
                    await api.admin.suspendOrganization(operatingOrg.id, reason, token);
                }
                dispatch({ type: 'TOAST_ADD', payload: { message: `Status message updated for ${operatingOrg.name}`, type: 'success' } });
                mutateCache(matchesCacheKeyPrefix('admin-organizations'));
            }
            setIsModalOpen(false);
            setOperatingOrg(null);
            setReason('');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : `Failed to ${modalMode.toLowerCase()} organization`;
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `${modalMode.toLowerCase()}-${operatingOrg.id}` });
        }
    };

    const handleSendMail = (org: Organization) => {
        setInitialTargetId(org.adminUserId);
        setInitialSubject(`Inquiry regarding ${org.name}`);
        setNewMailOpen(true);
    };

    const dynamicCounts = fetchedData?.counts || stats;

    const statusTabs: { id: OrgStatus | 'ALL', label: string, icon: LucideIcon, color: string, bg: string, count?: number }[] = [
        { id: 'ALL', label: 'All Orgs', icon: Building2, color: 'text-primary', bg: 'bg-primary/40', count: (dynamicCounts?.PENDING || 0) + (dynamicCounts?.APPROVED || 0) + (dynamicCounts?.REJECTED || 0) + (dynamicCounts?.SUSPENDED || 0) },
        { id: OrgStatus.PENDING, label: 'Pending', icon: ShieldAlert, color: 'text-warning', bg: 'bg-warning/40', count: dynamicCounts?.PENDING },
        { id: OrgStatus.APPROVED, label: 'Approved', icon: ShieldCheck, color: 'text-success', bg: 'bg-success/40', count: dynamicCounts?.APPROVED },
        { id: OrgStatus.REJECTED, label: 'Rejected', icon: ShieldOff, color: 'text-danger', bg: 'bg-danger/40', count: dynamicCounts?.REJECTED },
        { id: OrgStatus.SUSPENDED, label: 'Suspended', icon: ShieldAlert, color: 'text-muted-foreground', bg: 'bg-muted', count: dynamicCounts?.SUSPENDED },
    ];

    const columns: Column<Organization>[] = [
        {
            header: 'Organization',
            sortable: true,
            sortKey: 'name',
            accessor: (row) => (
                <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-10 h-10 ${row.logoUrl ? 'bg-transparent' : 'bg-card/5'} rounded-lg flex items-center justify-center text-primary shrink-0`}>
                        {row.logoUrl ? (
                            <Image src={getPublicUrl(row.logoUrl)} alt="Org Logo/Icon" width={40} height={40} className="w-10 h-10 bg-transparent rounded-full object-contain" />
                        ) : (
                            <Building2 className="w-5 h-5" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-foreground leading-tight">{row.name.slice(0, 20)}{row.name.length > 20 ? '...' : ''}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground tracking-widest">{row.type.replace('_', ' ')}</span>
                            <span className={`text-[9px] font-black px-2 rounded-full ${row.status === OrgStatus.APPROVED ? 'bg-success/10 text-success border border-success/20' :
                                row.status === OrgStatus.PENDING ? 'bg-warning/10 text-warning border border-warning/20' :
                                    row.status === OrgStatus.REJECTED ? 'bg-danger/10 text-danger border border-danger/20' :
                                        row.status === OrgStatus.SUSPENDED ? 'bg-muted text-muted-foreground border border-border' :
                                            'bg-muted text-muted-foreground border border-border'
                                }`}>
                                {row.status.replace('_', ' ')}
                            </span>
                        </div>
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
                        <MapPin className="w-3 h-3 text-primary/80" />
                        {row.location || 'N/A'}
                    </div>
                    <div className="flex items-center text-xs font-medium text-muted-foreground gap-1.5">
                        <Mail className="w-3 h-3 text-primary/80" />
                        {row.email || 'N/A'}
                    </div>
                    <Badge
                        variant={row.contactEmailVerifiedAt ? 'success' : 'warning'}
                        size="xs"
                        shape="pill"
                        icon={row.contactEmailVerifiedAt ? ShieldCheck : ShieldAlert}
                        title={row.contactEmailVerifiedAt ? 'Contact email verified' : 'Contact email must be verified before approval'}
                    >
                        {row.contactEmailVerifiedAt ? 'Contact verified' : 'Contact unverified'}
                    </Badge>
                </div>
            )
        },
        {
            header: 'Created On',
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
            width: 250,
            accessor: (row: Organization) => {
                const getActions = (): AdminAction[] => {
                    const actions: AdminAction[] = [];

                    const effectiveStatus = activeStatusTab === 'ALL' ? row.status : activeStatusTab;
                    const contactVerified = Boolean(row.contactEmailVerifiedAt);
                    const blockedApprovalTitle = 'Contact email must be verified before approval';

                    if (effectiveStatus === OrgStatus.PENDING) {
                        actions.push({
                            variant: 'approve',
                            onClick: () => handleApprove(row),
                            loading: state.ui.processing[`approve-${row.id}`],
                            disabled: !contactVerified,
                            title: contactVerified ? 'Approve' : blockedApprovalTitle
                        });
                        actions.push({
                            variant: 'reject',
                            onClick: () => handleOpenModal(row, 'REJECT'),
                            loading: state.ui.processing[`reject-${row.id}`]
                        });
                    } else if (effectiveStatus === OrgStatus.APPROVED) {
                        actions.push({
                            variant: 'suspend',
                            onClick: () => handleOpenModal(row, 'SUSPEND'),
                            loading: state.ui.processing[`suspend-${row.id}`]
                        });
                    } else if (effectiveStatus === OrgStatus.REJECTED) {
                        actions.push({
                            variant: 'reapprove',
                            onClick: () => handleApprove(row),
                            loading: state.ui.processing[`approve-${row.id}`],
                            disabled: !contactVerified,
                            title: contactVerified ? 'Re-approve' : blockedApprovalTitle
                        });
                    } else if (effectiveStatus === OrgStatus.SUSPENDED) {
                        actions.push({
                            variant: 'unsuspend',
                            onClick: () => handleApprove(row),
                            loading: state.ui.processing[`approve-${row.id}`],
                            disabled: !contactVerified,
                            title: contactVerified ? 'Unsuspend' : blockedApprovalTitle
                        });
                    }

                    if (row.status === OrgStatus.REJECTED || row.status === OrgStatus.SUSPENDED) {
                        actions.push({
                            variant: 'editMessage',
                            onClick: () => handleOpenModal(row, 'EDIT_MESSAGE'),
                            title: 'Edit Status Message'
                        });
                    }

                    return actions;
                };

                return (
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => handleSendMail(row)}
                                className="py-0 px-2 bg-card/5 border border-primary/20 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all cursor-pointer"
                                title="Send Mail"
                                aria-label={`Send mail to ${row.name}`}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                            <TableActions
                                extraActions={getActions()}
                            />
                        </div>
                    </div>
                );
            }
        }
    ];

    if ((loading || (!user && !loading)) || (isFetching && !fetchedData)) {
        return <Loading className="h-full" text="Loading Organizations..." size="lg" icon={Building2} />;
    }

    if (fetchError && !fetchedData) {
        return (
            <ErrorState
                error={fetchError}
                onRetry={() => retryOrganizations()}
                className="min-h-80"
                title="Unable to load organizations"
                description="The organization list could not be fetched."
            />
        );
    }

    const activeFilters: ActiveFilter[] = [
        ...(searchQuery ? [{
            key: 'search',
            label: 'Search',
            value: searchQuery,
            onRemove: () => updateQueryParams({ search: undefined, page: 1 }),
        }] : []),
        ...(activeStatusTab !== 'ALL' ? [{
            key: 'status',
            label: 'Status',
            value: statusTabs.find((tab) => tab.id === activeStatusTab)?.label || activeStatusTab,
            onRemove: () => updateQueryParams({ status: undefined, page: 1 }),
        }] : []),
        ...(orgTypeFilter !== 'ALL' ? [{
            key: 'type',
            label: 'Type',
            value: orgTypeFilter.replace('_', ' '),
            onRemove: () => updateQueryParams({ type: undefined, page: 1 }),
        }] : []),
    ];

    const handleViewOrg = (org: Organization) => {
        const viewFields: DataField[] = [
            { label: 'Organization ID', value: org.id, icon: Hash, fullWidth: true },
            { label: 'Organization Name', value: org.name, icon: org.logoUrl ? org.logoUrl : Building2 },
            { label: 'Location', value: org.location, icon: MapPin },
            { label: 'Type', value: org.type, icon: Tag },
            { label: 'Contact Email', value: org.email, icon: Mail },
            {
                label: 'Contact Verification',
                value: org.contactEmailVerifiedAt
                    ? `Verified ${new Date(org.contactEmailVerifiedAt).toLocaleString()}`
                    : 'Not verified',
                icon: org.contactEmailVerifiedAt ? ShieldCheck : ShieldAlert
            },
            { label: 'Phone Number', value: org.phone || 'N/A', icon: Phone },
            { label: 'Created At', value: new Date(org.createdAt).toLocaleString(), icon: Calendar },
        ];

        openViewModal({
            title: "Organization Details",
            subtitle: org.name || 'Entity Information',
            fields: viewFields,
            body: (
                <div className="space-y-6">
                    <div className="flex items-center gap-3 text-[11px] font-black opacity-80 tracking-[0.25em] uppercase">
                        <Clock className="w-4 h-4 text-primary" />
                        Verification Status History
                    </div>

                    {org.statusHistory && org.statusHistory.length > 0 ? (
                        <div className="space-y-4 max-h-160 overflow-y-auto pr-6 custom-scrollbar">
                            {[...org.statusHistory].reverse().map((entry, idx) => (
                                <div key={idx} className="relative pl-8 border-l-2 border-primary/10 last:border-l-0 pb-10 last:pb-2">
                                    <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full bg-card border-4 border-primary/20 flex items-center justify-center shadow-sm">
                                        <div className={`w-2 h-2 rounded-full ${entry.status === OrgStatus.APPROVED ? 'bg-success' :
                                            entry.status === OrgStatus.REJECTED ? 'bg-danger' :
                                                'bg-warning'
                                            }`} />
                                    </div>

                                    <div className="bg-card-text/[0.03] rounded-2xl p-6 border border-border shadow-sm relative transition-all hover:bg-card-text/[0.05]">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[10px] font-black tracking-[0.2em] px-4 py-1.5 rounded-lg shadow-sm ${entry.status === OrgStatus.APPROVED ? 'bg-success text-white' :
                                                    entry.status === OrgStatus.REJECTED ? 'bg-danger text-white' :
                                                        'bg-warning text-white'
                                                    }`}>
                                                    {entry.status}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black opacity-30 tracking-widest leading-none mb-1 uppercase">Decision Date</span>
                                                    <span className="text-xs font-bold opacity-80">
                                                        {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:items-end">
                                                <span className="text-[10px] font-black opacity-30 tracking-widest leading-none mb-1 text-left md:text-right uppercase">Reviewed By</span>
                                                <span className="text-xs font-bold opacity-90 tracking-tight">
                                                    {entry.adminName} <span className="opacity-40 ml-1 font-black">({entry.adminRole})</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-background/50 rounded-xl p-6 border border-border/50">
                                            <div className="text-[10px] font-black opacity-20 tracking-[0.2em] uppercase mb-3">Official Communication</div>
                                            <MarkdownRenderer
                                                content={entry.message}
                                                className="text-sm! leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center bg-card-text/[0.02]">
                            <Clock className="w-10 h-10 opacity-10 mb-4" />
                            <p className="text-sm font-bold opacity-30 tracking-tight">No verification history available for this entity.</p>
                        </div>
                    )}
                </div>
            )
        });
    };

    return (
        <PageShell>
            <PageHeader
                title="Organizations"
                description="Review organization access, verification state, and platform communications."
                icon={Building2}
                breadcrumbs={[
                    { label: 'Admin' },
                    { label: 'Organizations' },
                ]}
                meta={fetchedData?.totalRecords !== undefined ? (
                    <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-1 text-xs font-black text-muted-foreground">
                        {fetchedData.totalRecords} total
                    </span>
                ) : undefined}
            />
            <ResourcePanel>
                {/* Top controls - fully responsive */}
                <div className="p-4 space-y-1 border-b border-border/40">
                    {/* Mobile: status dropdown (visible only on small screens) */}
                    <div className="block md:hidden w-full">
                        <CustomSelect
                            value={activeStatusTab}
                            onChange={(val) => updateQueryParams({ status: val as OrgStatus | 'ALL', page: 1 })}
                            options={statusTabs.map(tab => ({ value: tab.id, label: `${tab.label} (${tab.count || 0})`, icon: tab.icon }))}
                            className="w-full"
                            placeholder="Select Status"
                        />
                    </div>

                    {/* Tablet/Desktop: status tabs (horizontally scrollable, no wrap) */}
                    <div className="hidden md:flex overflow-x-auto gap-1 scrollbar-thin">
                        {statusTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => updateQueryParams({ status: tab.id, page: 1 })}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-1 whitespace-nowrap shadow-sm border border-border/50
                ${activeStatusTab === tab.id
                                        ? `${tab.bg} text-foreground shadow-md`
                                        : 'bg-card/40 text-muted-foreground hover:bg-card/60 hover:text-foreground'
                                    }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeStatusTab === tab.id ? tab.color : 'opacity-50'}`} />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all
                  ${activeStatusTab === tab.id
                                            ? `${tab.bg} text-white shadow-sm`
                                            : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Filters row: column on mobile, row on sm+ */}
                    <div className="flex flex-col sm:flex-row gap-1 items-stretch sm:items-center">
                        <div className="w-full sm:w-64">
                            <CustomSelect
                                value={orgTypeFilter}
                                onChange={(val) => updateQueryParams({ type: val, page: 1 })}
                                options={[
                                    { value: 'ALL', label: 'All Org Types' },
                                    { value: 'KINDERGARTEN', label: 'Kindergarten', icon: Pencil },
                                    { value: 'PRE_SCHOOL', label: 'Pre-School', icon: Pencil },
                                    { value: 'PRIMARY_SCHOOL', label: 'Primary School', icon: BookOpen },
                                    { value: 'MIDDLE_SCHOOL', label: 'Middle School', icon: BookOpen },
                                    { value: 'HIGH_SCHOOL', label: 'High School', icon: School },
                                    { value: 'COLLEGE', label: 'College', icon: Library },
                                    { value: 'UNIVERSITY', label: 'University', icon: GraduationCap },
                                    { value: 'VOCATIONAL_SCHOOL', label: 'Vocational School', icon: Building2 },
                                    { value: 'INSTITUTE', label: 'Institute', icon: Building2 },
                                    { value: 'ACADEMY', label: 'Academy', icon: Building2 },
                                    { value: 'TUTORING_CENTER', label: 'Tutoring Center', icon: BookOpen },
                                    { value: 'ONLINE_SCHOOL', label: 'Online School', icon: MonitorPlay },
                                    { value: 'OTHER', label: 'Other', icon: Info },
                                ]}
                                className="w-full"
                                placeholder="Org Type"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <SearchBar
                                value={searchQuery}
                                onChange={(val) => updateQueryParams({ search: val, page: 1 })}
                                placeholder="Search organizations..."
                                className="max-w-full md:max-w-sm"
                            />
                        </div>
                    </div>
                </div>

                <ResourceToolbar activeFilters={activeFilters} />

                {/* Data Table - with horizontal scroll on small screens */}
                <div className="flex-1 min-h-0 overflow-x-auto">
                    <DataTable
                        columns={columns}
                        data={fetchedData?.data || []}
                        keyExtractor={(row) => row.id}
                        isLoading={isFetching}
                        onRowClick={handleViewOrg}
                        currentPage={page}
                        totalPages={fetchedData?.totalPages || 1}
                        totalResults={fetchedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(p) => updateQueryParams({ page: p })}
                        onPageSizeChange={handlePageSizeChange}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key, direction) => updateQueryParams({ sortBy: key, sortOrder: direction })}
                        emptyTitle="No organizations found"
                        emptyDescription={searchQuery || activeStatusTab !== 'ALL' || orgTypeFilter !== 'ALL'
                            ? 'Adjust the filters to broaden the organization review queue.'
                            : 'Organizations will appear here when they register on the platform.'}
                        mobileDetailLimit={3}
                    />
                </div>
            </ResourcePanel>

            {/* Modals - responsive sizing */}
            <ModalForm
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setOperatingOrg(null);
                    setReason('');
                }}
                onSubmit={handleModalSubmit}
                title={modalMode === 'REJECT' ? `Reject ${operatingOrg?.name}` : modalMode === 'SUSPEND' ? `Suspend ${operatingOrg?.name}` : 'Edit Status Message'}
                submitText={modalMode === 'REJECT' ? 'Confirm Rejection' : modalMode === 'SUSPEND' ? 'Confirm Suspension' : 'Update Message'}
                variant={modalMode === 'REJECT' ? 'danger' : modalMode === 'SUSPEND' ? 'warning' : 'primary'}
                isSubmitting={actionLoading}
                maxWidth="max-w-[95vw] sm:max-w-2xl md:max-w-3xl"
            >
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground font-medium">
                        {modalMode === 'EDIT_MESSAGE'
                            ? 'Update the administrative notice for this organization. They will see this message on their dashboard.'
                            : `Please provide a detailed reason for ${modalMode === 'REJECT' ? 'rejecting' : 'suspending'} this organization. This will be shown to the organization administrators.`
                        }
                    </p>
                    <MarkdownEditor
                        value={reason}
                        onChange={setReason}
                        placeholder={`Enter ${modalMode === 'EDIT_MESSAGE' ? 'new status message' : 'reason for ' + modalMode?.toLowerCase()}...`}
                        rows={10}
                        orgData={{
                            name: operatingOrg?.name || '',
                            id: operatingOrg?.id || '',
                            email: operatingOrg?.email || '',
                            admin: user?.name || 'Platform Administrator',
                            role: user?.role || 'Administrator',
                            date: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
                            signature: 'EduVerse @ Support Team'
                        }}
                        templates={[
                            {
                                label: 'Violation of Terms',
                                content: '# Access Suspended\n\nDear Admin of **{{name}}**,\n\nWe are writing to inform you that your organization\'s access has been suspended due to a **violation of our Terms of Service**.\n\nSpecifically: [Enter violation details here]\n\n**Organization ID:** {{id}}'
                            },
                            {
                                label: 'Missing Required Info',
                                content: '# Information Required\n\nYour application for **{{name}}** is currently on hold as some **critical information is missing**.\n\nPlease provide: \n1. [Item 1]\n2. [Item 2]\n\nSubmit the missing documents via your settings page to proceed.'
                            },
                            {
                                label: 'Identity Verification',
                                content: '# Verification Required\n\nTo ensure the security of our platform, we require **further identity verification** for **{{name}}**.\n\nPlease upload a valid institutional certificate or government-issued document showing your organization\'s status.'
                            },
                            {
                                label: 'Suspect Unusual Activity',
                                content: '# Security Notice\n\nDear **{{name}}**,\n\nOur system has detected **suspicious activity** originating from your account. As a security precaution, we have temporarily restricted access.\n\nDetails: [Enter details here]\n\n**ID Reference:** {{id}}'
                            },
                            {
                                label: 'Unauthorized Access Detected',
                                content: '# Unauthorized Access Warning\n\nDear **{{name}}**,\n\nWe have detected **unauthorized access attempts** to your organization dashboard. To protect your data, we have suspended the account.\n\nPlease contact support to verify your identity.'
                            },
                            {
                                label: 'Policy Compliance Check',
                                content: '# Compliance Notice\n\nYour organization **{{name}}** is currently under a **routine policy compliance check**.\n\nThis is a standard procedure and usually takes 2-3 business days. No further action is required from your side at this moment.'
                            }
                        ]}
                    />
                </div>
            </ModalForm>

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
        </PageShell>
    );
}
