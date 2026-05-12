import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { BillingCycle } from '@/types';

interface BillingCycleBadgeProps {
    cycle: BillingCycle | string;
    className?: string;
}

export function BillingCycleBadge({ cycle, className }: BillingCycleBadgeProps) {
    let label = cycle;

    switch (cycle) {
        case BillingCycle.ONCE:
            label = 'One-Time';
            break;
        case BillingCycle.MONTHLY:
            label = 'Monthly';
            break;
        case BillingCycle.QUARTERLY:
            label = 'Quarterly';
            break;
        case BillingCycle.SEMESTER:
            label = 'Per Semester';
            break;
        case BillingCycle.ANNUAL:
            label = 'Annually';
            break;
    }

    return (
        <Badge variant="neutral" className={`opacity-80 ${className}`}>
            {label}
        </Badge>
    );
}
