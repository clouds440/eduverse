import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'primary' | 'secondary' | 'info' | 'purple';
type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    title?: string;
    size?: BadgeSize;
    className?: string;
    /** Optional dot indicator */
    dot?: boolean;
    /** Optional icon on the left */
    icon?: React.ElementType;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: "bg-success/10 text-success dark:bg-success/30",
    error: "bg-danger/10 text-danger dark:bg-danger/30",
    warning: "bg-warning/10 text-warning dark:bg-warning/30",
    neutral: "bg-neutral/10 text-neutral dark:bg-neutral/30",
    primary: "bg-primary/10 text-primary dark:bg-primary/30",
    secondary: "bg-secondary/40 text-foreground dark:bg-secondary/50",
    info: "bg-info/10 text-info dark:bg-info/30",
    purple: "bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-600",
};

const dotColors: Record<BadgeVariant, string> = {
    success: "bg-success",
    error: "bg-danger",
    warning: "bg-warning",
    neutral: "bg-neutral",
    primary: "bg-primary",
    secondary: "bg-secondary",
    info: "bg-info",
    purple: "bg-purple-600",
};

const sizeStyles: Record<BadgeSize, string> = {
    xs: "h-3 px-1 text-[10px] gap-1",
    sm: "h-5 px-1.5 text-[11px] gap-1",
    md: "h-6 px-2 text-[12px] gap-1.5",
};

export function Badge({
    children,
    variant = 'neutral',
    title,
    size = 'md',
    className,
    dot,
    icon: Icon,
}: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center font-medium whitespace-nowrap",
                "rounded-md select-none shrink-0",
                sizeStyles[size],
                variantStyles[variant],
                className,
            )}
            title={title}
        >
            {dot && (
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])} />
            )}
            {Icon && (
                <Icon className="w-3.5 h-3.5 shrink-0" />
            )}
            {children}
        </span>
    );
}
