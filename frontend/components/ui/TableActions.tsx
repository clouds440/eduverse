import React from 'react';
import { Pencil, Trash2, Eye, UserPen, Check, X, ShieldAlert, CheckCircle2, MessageSquareText, Send, Loader2, Lock, Users } from 'lucide-react';
import { useAccess } from '@/hooks/useAccess';
import { cn } from '@/lib/utils';

export type AdminActionVariant = 'approve' | 'reject' | 'suspend' | 'unsuspend' | 'resolve' | 'reapprove' | 'editMessage' | 'mail' | 'restore' | 'pay' | 'confirm' | 'link';

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
    confirm: { icon: CheckCircle2, color: 'text-success hover:bg-success/10', defaultTitle: 'Confirm Payment' },
    link: { icon: Users, color: 'text-info border border-info/20 hover:bg-info/10', defaultTitle: 'Link Students' }
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
    const actionButtonClass = "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border p-2 text-sm shadow-xs transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <div className={`flex gap-1 items-center ${className}`} role="group" aria-label="Row actions">
            {onView && !isViewAndEdit && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                    className={cn(actionButtonClass, "cursor-pointer border-primary/25 text-primary hover:bg-primary/10")}
                    title="View"
                    aria-label="View"
                >
                    <Eye className="w-4 h-4" aria-hidden="true" />
                    {showLabels && <span className="text-[10px] font-black tracking-wider text-inherit">View</span>}
                </button>
            )}

            {onEdit && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    className={cn(actionButtonClass, "cursor-pointer border-primary/25 text-primary hover:bg-primary/10", !canWrite && "border-muted bg-muted/30 text-muted-foreground opacity-70")}
                    title={canWrite ? editTitle : `${editTitle} (Read-only)`}
                    aria-label={canWrite ? editTitle : `${editTitle} (Read-only)`}
                >
                    <div className="flex items-center gap-2">
                        {isViewAndEdit &&
                            <div className="flex items-center gap-1.5 px-0.5 opacity-70">
                                <Eye className="w-4 h-4" aria-hidden="true" /> <span className="text-current/30 text-[10px]">/</span>
                            </div>
                        }
                        {!canWrite ? <Lock className="w-3.5 h-3.5 text-muted-foreground/60 mr-1" aria-hidden="true" /> : <EditIcon className="w-4 h-4" aria-hidden="true" />}
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
                        type="button"
                        key={idx}
                        onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                        }}
                        disabled={action.disabled || action.loading || !canWrite}
                        className={cn(actionButtonClass, config.color, "cursor-pointer border-current/20")}
                        title={!canWrite ? `${label} (Permission Denied)` : label}
                        aria-label={!canWrite ? `${label} (Permission Denied)` : label}
                        aria-busy={action.loading || undefined}
                    >
                        {action.loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Icon className="w-4 h-4" aria-hidden="true" />
                        )}
                        {showLabels && !action.loading && <span className="text-[10px] font-black tracking-wider">{label}</span>}
                    </button>
                );
            })}

            {onDelete && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    disabled={isDeleting || !canWrite}
                    className={cn(actionButtonClass, "cursor-pointer border-danger/30 text-danger hover:bg-danger/15", !canWrite && "hidden")}
                    title={canWrite ? deleteTitle : `${deleteTitle} (Permission Denied)`}
                    aria-label={canWrite ? deleteTitle : `${deleteTitle} (Permission Denied)`}
                    aria-busy={isDeleting || undefined}
                >
                    {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                    )}
                    {showLabels && !isDeleting && <span className="text-[10px] font-black tracking-wider">{deleteTitle}</span>}
                </button>
            )}
        </div>
    );
};
