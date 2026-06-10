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
        case BillingCycle.SEMESTER:
            label = 'Per Semester';
            break;
        case BillingCycle.YEARLY:
            label = 'Yearly';
            break;
        case BillingCycle.ACADEMIC_CYCLE:
            label = 'Academic Cycle';
            break;
    }

    return (
        <Badge variant="neutral" className={`opacity-80 ${className}`}>
            {label}
        </Badge>
    );
}
