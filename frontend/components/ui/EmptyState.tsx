import React from 'react';
import { Inbox, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateSize = 'sm' | 'md' | 'lg';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    size?: EmptyStateSize;
}

const sizeClasses: Record<EmptyStateSize, string> = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};

const iconSizeClasses: Record<EmptyStateSize, string> = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7',
};

export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
    children,
    className,
    size = 'md',
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/55 text-center',
                sizeClasses[size],
                className,
            )}
        >
            <div className="mb-3 rounded-md bg-muted/70 p-2 text-muted-foreground">
                <Icon className={iconSizeClasses[size]} aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-foreground sm:text-base">{title}</h3>
            {description && (
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            )}
            {children}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
