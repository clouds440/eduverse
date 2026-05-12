import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { EntryStatus } from '@/types';

interface FinanceStatusBadgeProps {
    status: EntryStatus | string;
    className?: string;
}

export function FinanceStatusBadge({ status, className }: FinanceStatusBadgeProps) {
    let variant: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'neutral' = 'neutral';
    let label = status;

    switch (status) {
        case EntryStatus.PAID:
            variant = 'success';
            label = 'Paid';
            break;
        case EntryStatus.OVERDUE:
            variant = 'error';
            label = 'Overdue';
            break;
        case EntryStatus.PARTIAL:
            variant = 'warning';
            label = 'Partial';
            break;
        case EntryStatus.UNVERIFIED:
            variant = 'info';
            label = 'Unverified';
            break;
        case EntryStatus.PENDING:
            variant = 'neutral';
            label = 'Pending';
            break;
        case EntryStatus.CANCELLED:
            variant = 'neutral';
            label = 'Cancelled';
            break;
    }

    return (
        <Badge variant={variant} className={className}>
            {label}
        </Badge>
    );
}
