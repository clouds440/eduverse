import React from 'react';
import { Pencil, Trash2, Eye, UserPen, Check, X, ShieldAlert, CheckCircle2, MessageSquareText, Send, Loader2, Lock } from 'lucide-react';
import { useAccess } from '@/hooks/useAccess';

export type AdminActionVariant = 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'resolve' | 'reapprove' | 'editMessage' | 'mail' | 'restore' | 'pay' | 'confirm';

export interface AdminAction {
    variant: AdminActionVariant;
    onClick: () => void;
    title?: string;
    loading?: boolean;
    disabled?: boolean;
}

interface TableActionsProps {
    onEdit?: () => void;
    onView?: () => void;
    onDelete?: () => void;
    editTitle?: string;
    deleteTitle?: string;
    isDeleting?: boolean;
    isViewAndEdit?: boolean;
    variant?: 'user' | 'default';
    extraActions?: AdminAction[];
    className?: string;
    showLabels?: boolean;
}

const adminActionConfig: Record<AdminActionVariant, { icon: React.ElementType, color: string, defaultTitle: string }> = {
    approve: { icon: Check, color: 'text-success hover:bg-success/10', defaultTitle: 'Approve' },
    reject: { icon: X, color: 'text-danger hover:bg-danger/10', defaultTitle: 'Reject' },
    suspend: { icon: ShieldAlert, color: 'text-warning hover:bg-warning/10', defaultTitle: 'Suspend' },
    unsuspend: { icon: Check, color: 'text-success hover:bg-success/10', defaultTitle: 'Unsuspend' },
    reapprove: { icon: Check, color: 'text-success hover:bg-success/10', defaultTitle: 'Re-approve' },
    resolve: { icon: CheckCircle2, color: 'text-success hover:bg-success/10', defaultTitle: 'Resolve' },
    editMessage: { icon: MessageSquareText, color: 'text-info hover:bg-info/10', defaultTitle: 'Edit Message' },
    mail: { icon: Send, color: 'text-primary border border-primary/20 hover:bg-primary/10', defaultTitle: 'Send Mail' },
    restore: { icon: Check, color: 'text-success hover:bg-success/10', defaultTitle: 'Restore' },
    pay: { icon: Send, color: 'text-primary hover:bg-primary/10', defaultTitle: 'Mark as Paid' },
    confirm: { icon: CheckCircle2, color: 'text-success hover:bg-success/10', defaultTitle: 'Confirm Payment' }
};

export const TableActions: React.FC<TableActionsProps> = ({
    onEdit,
    onView,
    onDelete,
    editTitle = "View / Edit",
    deleteTitle = "Delete",
    isDeleting = false,
    isViewAndEdit = false,
    variant = 'default',
    extraActions = [],
    className = "",
    showLabels = false
}) => {
    const { canWrite } = useAccess();
    // Select the appropriate icon based on variant
    const EditIcon = variant === 'user' ? UserPen : Pencil;

    return (
        <div className={`flex gap-1 items-center ${className}`}>
            {onView && !isViewAndEdit && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                    className="text-primary cursor-pointer hover:text-primary px-3 py-2.5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-all shadow-xs active:scale-95 group relative flex items-center gap-2"
                    title="View"
                >
                    <Eye className="w-4 h-4" />
                    {showLabels && <span className="text-[10px] font-black tracking-wider text-inherit">View</span>}
                </button>
            )}

            {onEdit && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    className={`text-primary cursor-pointer hover:text-primary px-3 py-2.5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-all shadow-xs active:scale-95 group relative flex items-center gap-2 ${!canWrite ? 'opacity-70 bg-muted/30 border-muted text-muted-foreground' : ''}`}
                    title={canWrite ? editTitle : `${editTitle} (Read-only)`}
                >
                    <div className="flex items-center gap-2">
                        {isViewAndEdit &&
                            <div className="flex items-center gap-1.5 px-0.5 opacity-70">
                                <Eye className="w-4 h-4" /> <span className="text-current/30 text-[10px]">/</span>
                            </div>
                        }
                        {!canWrite ? <Lock className="w-3.5 h-3.5 text-muted-foreground/60 mr-1" /> : <EditIcon className="w-4 h-4" />}
                    </div>
                    {showLabels && <span className="text-[10px] font-black tracking-wider">{editTitle}</span>}
                </button>
            )}

            {extraActions.map((action, idx) => {
                const config = adminActionConfig[action.variant];
                const Icon = config.icon;
                const label = action.title || config.defaultTitle;
                return (
                    <button
                        key={idx}
                        onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                        }}
                        disabled={action.disabled || action.loading || !canWrite}
                        className={`${config.color} cursor-pointer px-3 py-2.5 border border-current/20 rounded-lg transition-all shadow-xs active:scale-95 disabled:opacity-50 group relative flex items-center gap-2`}
                        title={!canWrite ? `${label} (Permission Denied)` : label}
                    >
                        {action.loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Icon className="w-4 h-4" />
                        )}
                        {showLabels && !action.loading && <span className="text-[10px] font-black tracking-wider">{label}</span>}
                    </button>
                );
            })}

            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    disabled={isDeleting || !canWrite}
                    className={`text-danger cursor-pointer hover:bg-danger/20 px-3 py-2.5 border border-danger rounded-lg transition-all shadow-xs active:scale-95 disabled:opacity-50 group flex items-center gap-2 ${!canWrite ? 'hidden' : ''}`}
                    title={canWrite ? deleteTitle : `${deleteTitle} (Permission Denied)`}
                >
                    {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                    {showLabels && !isDeleting && <span className="text-[10px] font-black tracking-wider">{deleteTitle}</span>}
                </button>
            )}
        </div>
    );
};
