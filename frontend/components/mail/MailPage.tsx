'use client';

import { useEffect, useState, useMemo } from 'react';
import { MessageSquare, ArrowUpRight, CheckCircle2, XCircle, Tag, Calendar, Filter, Clock, MailPlus, Hash } from 'lucide-react';
import useSWR, { mutate as mutateCache } from 'swr';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { api } from '@/lib/api';
import { MailItem, MailStatus, PaginatedResponse } from '@/types';
import { DataTable, Column } from '@/components/ui/DataTable';
import { MailStatusBadge, MailPriorityBadge, useMailRowClassName } from '@/components/mail/MailStatusBadge';
import { MailDetailsModal } from '@/components/mail/MailDetailsModal';
import { NewMailModal } from '@/components/mail/NewMailModal';
import { SearchBar } from '@/components/ui/SearchBar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import notificationsStore from '@/lib/notificationsStore';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/ui/Button';
import { BrandIcon } from '@/components/ui/Brand';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';

interface MailPageProps {
    localStorageKey?: string;
}

export function MailPage({ localStorageKey = 'edu-mail-limit' }: MailPageProps) {
    const { user, token, loading: authLoading } = useAuth();
    const { state, dispatch } = useGlobal();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const getRowClassName = useMailRowClassName();

    const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
    const [newMailOpen, setNewMailOpen] = useState(false);

    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(localStorageKey);
            return saved ? parseInt(saved, 10) : 10;
        }
        return 10;
    });

    const page = parseInt(searchParams.get('page') || '1', 10);
    const searchQuery = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // SWR for mails data
    const mailsKey = useMemo(() => {
        if (!token) return null;
        return ['mails', {
            page,
            limit: pageSize,
            search: searchQuery,
            status: statusFilter || undefined,
            sortBy,
            sortOrder,
        }] as const;
    }, [token, page, pageSize, searchQuery, statusFilter, sortBy, sortOrder]);

    const { data: paginatedData, error: fetchError, isLoading: fetching, mutate: retryMails } = useSWR<PaginatedResponse<MailItem>>(mailsKey);

    // Sync stats when data loads
    useEffect(() => {
        if (token && paginatedData) {
            api.mail.getUnreadCount(token).then((stats: { total: number; unread: number; countsByStatus: Record<string, number> }) => {
                dispatch({ type: 'STATS_SET_MAIL', payload: stats });
            }).catch(() => { });
        }
    }, [token, paginatedData, dispatch]);

    const { subscribe } = useSocket({
        token: token,
        userId: user?.id || undefined,
        userRole: user?.role || undefined,
        orgId: user?.orgId || undefined
    });

    useEffect(() => {
        if (!authLoading && token) {
            api.notifications.clearCategory('MAIL', token).catch(console.error);
        }
    }, [authLoading, token]);

    useEffect(() => {
        const mid = searchParams.get('mailId');
        if (mid) {
            setSelectedMailId(mid);
        }
    }, [searchParams]);

    useEffect(() => {
        const unsubs = [
            subscribe('unread:update', () => mutateCache(matchesCacheKeyPrefix('mails'))),
            subscribe('mail:new', () => mutateCache(matchesCacheKeyPrefix('mails'))),
            subscribe('mail:message', () => mutateCache(matchesCacheKeyPrefix('mails'))),
            subscribe('mail:update', () => mutateCache(matchesCacheKeyPrefix('mails')))
        ];

        return () => {
            unsubs.forEach(u => u());
        };
    }, [subscribe, mailsKey]);

    const handleMailClick = (mail: MailItem) => {
        setSelectedMailId(mail.id);
        try {
            const { items } = notificationsStore.getAll();
            const notif = items.find(n => n.metadata?.mailId === mail.id || (n.actionUrl && n.actionUrl.includes(mail.id)) || n.metadata?.entityId === mail.id);
            if (notif && token) {
                notificationsStore.markAsReadGuard(notif.id, token).catch(() => { });
            }
        } catch { }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        localStorage.setItem(localStorageKey, String(newSize));
        updateFilters('page', '1');
    };

    const columns = useMemo<Column<MailItem>[]>(() => [
        {
            header: 'Subject',
            sortable: true,
            sortKey: 'subject',
            accessor: (row: MailItem) => (
                <div className="flex items-start gap-3 min-0">
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-foreground leading-tight truncate">{row.subject}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] items-center gap-1 text-muted-foreground font-bold hidden sm:flex">
                                <Hash className="w-2.5 h-2.5" />
                                {row.id.slice(0, 8)}
                            </span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'Sender',
            accessor: (row: MailItem) => (
                <div className="flex items-center gap-3">
                    <BrandIcon
                        variant="user"
                        size="sm"
                        user={row.creator}
                        className="w-8 h-8 rounded-full shadow-sm"
                    />
                    <div className="min-w-0">
                        <p className="text-xs font-black text-foreground truncate max-w-30">{row.creator?.name || row.creator?.email || 'Unknown'}</p>
                        <p className="text-[10px] font-bold text-muted-foreground">{row.creatorRole?.replace('_', ' ') || 'N/A'}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Recipient',
            accessor: (row: MailItem) => (
                <div className="flex items-center gap-2">
                    {row.assignees && row.assignees.length > 0 ? (
                        <>
                            <div className="flex -space-x-2 mr-1">
                                {row.assignees.slice(0, 2).map((a) => (
                                    <div key={a.id} className="w-7 h-7 border-2 border-border rounded-full bg-card/5 shadow-sm">
                                        <BrandIcon variant="user" size="sm" user={a} className="w-full h-full" />
                                    </div>
                                ))}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-foreground truncate max-w-30">
                                    {row.assignees.length > 1
                                        ? `${row.assignees[0].name || row.assignees[0].email} +${row.assignees.length - 1}`
                                        : (row.assignees[0].name || row.assignees[0].email)}
                                </p>
                                <p className="text-[10px] font-bold text-primary/80">
                                    {row.assignees.length > 1 ? 'Multiple' : 'Personal'}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center text-warning text-[10px] font-black text-center leading-none shadow-sm">
                                <span className="scale-75">GRP</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-foreground truncate max-w-30">
                                    {row.targetRole ? row.targetRole.replace('_', ' ') : 'Platform Support'}
                                </p>
                                <p className="text-[10px] font-bold text-warning">Team</p>
                            </div>
                        </>
                    )}
                </div>
            )
        },
        {
            header: 'Category',
            accessor: (row: MailItem) => (
                <span className="flex items-center gap-2 text-[10px] font-black tracking-widest text-primary bg-card/50 px-2 py-1 rounded-lg border border-primary">
                    <Tag className="w-3 h-3" />
                    {row.category.replace('_', ' ')}
                </span>
            )
        },
        {
            header: 'Status',
            sortable: true,
            sortKey: 'status',
            accessor: (row: MailItem) => <MailStatusBadge status={row.status} />
        },
        {
            header: 'Priority',
            accessor: (row: MailItem) => <MailPriorityBadge priority={row.priority} />
        },
        {
            header: 'Messages',
            accessor: (row: MailItem) => (
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full text-[10px] font-black text-muted-foreground min-w-7.5 justify-center">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        {row._count?.messages || 0}
                    </div>
                    {row.unreadCount > 0 && (
                        <span className="bg-dangertext-white px-2 py-0.5 rounded-full text-[9px] font-black animate-in fade-in zoom-in duration-300">
                            {row.unreadCount} new
                        </span>
                    )}
                </div>
            )
        },
        {
            header: 'Date',
            sortable: true,
            sortKey: 'createdAt',
            accessor: (row: MailItem) => (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 opacity-30" />
                    <span className="text-xs font-bold font-mono">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
            )
        }
    ], []);

    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="flex flex-col h-full w-full">
                <div className="bg-card/80 backdrop-blur-2xl p-1 md:p-2 rounded-lg border border-border shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-2 mb-2 shrink-0">
                        <div className="flex flex-1 items-center gap-2 w-full">
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className='flex gap-2 w-full md:w-auto'>
                            <Skeleton className="h-10 w-32" />
                            <Skeleton className="h-10 w-24" />
                        </div>
                    </div>
                    <div className="relative overflow-x-hidden flex-1 min-h-0">
                        <SkeletonTable rows={8} columns={8} />
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError && !paginatedData) {
        return (
            <ErrorState
                error={fetchError}
                onRetry={() => retryMails()}
                className="min-h-80"
                title="Unable to load mail"
                description="The mail list could not be fetched."
            />
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-card/80 backdrop-blur-2xl p-1 md:p-2 rounded-lg border border-border shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-col md:flex-row items-center justify-between gap-2 mb-2 shrink-0">
                    <div className="flex flex-1 items-center gap-2 w-full">
                        <div className="flex w-full gap-2">
                            <SearchBar
                                placeholder="Search mail by subject or content..."
                                value={searchQuery}
                                onChange={(val: string) => updateFilters('search', val)}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className='flex gap-2 w-full md:w-auto'>
                        <div className='w-7/12 sm:w-8/12 md:w-auto'>
                            <CustomSelect
                                options={[
                                    { value: '', label: 'All Statuses', badge: state.stats.mail?.total },
                                    { value: MailStatus.OPEN, label: 'Open', badge: state.stats.mail?.countsByStatus?.[MailStatus.OPEN], icon: Clock, iconClassName: 'text-info' },
                                    { value: MailStatus.IN_PROGRESS, label: 'In Progress', badge: state.stats.mail?.countsByStatus?.[MailStatus.IN_PROGRESS], icon: ArrowUpRight, iconClassName: 'text-warning' },
                                    { value: MailStatus.AWAITING_RESPONSE, label: 'Awaiting Response', badge: state.stats.mail?.countsByStatus?.[MailStatus.AWAITING_RESPONSE], icon: MessageSquare, iconClassName: 'text-primary/80' },
                                    { value: MailStatus.RESOLVED, label: 'Resolved', badge: state.stats.mail?.countsByStatus?.[MailStatus.RESOLVED], icon: CheckCircle2, iconClassName: 'text-success' },
                                    { value: MailStatus.CLOSED, label: 'Closed', badge: state.stats.mail?.countsByStatus?.[MailStatus.CLOSED], icon: XCircle, iconClassName: 'text-muted-foreground' },
                                ]}
                                value={statusFilter}
                                onChange={(val: string) => updateFilters('status', val)}
                                placeholder="Filter Status"
                                icon={Filter}
                            />
                        </div>
                        <div className='w-5/12 sm:w-4/12 md:w-auto'>
                            <Button
                                onClick={() => setNewMailOpen(true)}
                                icon={MailPlus}
                                className="flex w-full"
                            >
                                New Mail
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="relative overflow-x-hidden flex-1 min-h-0">
                    <DataTable
                        columns={columns}
                        data={paginatedData?.data || []}
                        keyExtractor={(row: MailItem) => row.id}
                        isLoading={fetching}
                        onRowClick={handleMailClick}
                        currentPage={paginatedData?.currentPage || 1}
                        totalPages={paginatedData?.totalPages || 1}
                        totalResults={paginatedData?.totalRecords || 0}
                        pageSize={pageSize}
                        onPageChange={(p: number) => updateFilters('page', p.toString())}
                        onPageSizeChange={handlePageSizeChange}
                        getRowClassName={(row: MailItem) => getRowClassName(row.status)}
                        showSerialNumber={false}
                        maxHeight="100%"
                        sortConfig={{ key: sortBy, direction: sortOrder }}
                        onSort={(key: string, direction: 'asc' | 'desc') => {
                            updateFilters('sortBy', key);
                            updateFilters('sortOrder', direction);
                        }}
                    />
                </div>
            </div>

            <MailDetailsModal
                isOpen={!!selectedMailId}
                mailId={selectedMailId}
                onClose={() => {
                    setSelectedMailId(null);
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('mailId');
                    const query = params.toString();
                    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
                }}
                onUpdate={() => mutateCache(matchesCacheKeyPrefix('mails'))}
            />

            <NewMailModal
                isOpen={newMailOpen}
                onClose={() => setNewMailOpen(false)}
                onSuccess={() => {
                    mutateCache(matchesCacheKeyPrefix('mails'));
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Mail sent', type: 'success' } });
                }}
            />
        </div>
    );
}
