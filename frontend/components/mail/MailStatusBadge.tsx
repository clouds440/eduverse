'use client';

import { BadgeVariant, MailStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';

const STATUS_CONFIG: Record<MailStatus, { label: string; variant: BadgeVariant }> = {
    [MailStatus.OPEN]: { label: 'Open', variant: 'info' },
    [MailStatus.IN_PROGRESS]: { label: 'In Progress', variant: 'warning' },
    [MailStatus.AWAITING_RESPONSE]: { label: 'Awaiting', variant: 'purple' },
    [MailStatus.RESOLVED]: { label: 'Resolved', variant: 'success' },
    [MailStatus.CLOSED]: { label: 'Closed', variant: 'neutral' },
    [MailStatus.NO_REPLY]: { label: 'Notice (No Reply)', variant: 'neutral' },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
    LOW: { label: 'Low', variant: 'neutral' },
    NORMAL: { label: 'Normal', variant: 'info' },
    HIGH: { label: 'High', variant: 'warning' },
    URGENT: { label: 'Urgent', variant: 'error' },
};

interface StatusBadgeProps {
    status: MailStatus;
    className?: string;
}

export function MailStatusBadge({ status, className = '' }: StatusBadgeProps) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[MailStatus.OPEN];
    return (
        <Badge variant={cfg.variant} className={className} size="sm">
            {cfg.label}
        </Badge>
    );
}

interface PriorityBadgeProps {
    priority: string;
    className?: string;
}

export function MailPriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.NORMAL;
    return (
        <Badge variant={cfg.variant} className={className} size="sm">
            {cfg.label}
        </Badge>
    );
}

export function useMailRowClassName() {
    return (status: MailStatus) => {
        const base = 'shadow-sm transition-colors';

        switch (status) {
            case MailStatus.OPEN:
                return `bg-info/50 dark:bg-info/30 border-l-4 border-l-info ${base}`;
            case MailStatus.IN_PROGRESS:
                return `bg-warning/50 dark:bg-warning/30 border-l-4 border-l-warning ${base}`;
            case MailStatus.AWAITING_RESPONSE:
                return `bg-primary/50 dark:bg-primary/30 border-l-4 border-l-primary ${base}`;
            case MailStatus.RESOLVED:
                return `bg-success/50 dark:bg-success/30 border-l-4 border-l-success ${base}`;
            case MailStatus.CLOSED:
                return `bg-muted/50 dark:bg-muted/30 border-l-4 border-l-muted-foreground/30 opacity-80 ${base}`;
            default:
                return 'transition-colors hover:bg-muted/40';
        }
    };
}
