import React from 'react';
import { cn } from '@/lib/utils';
import type { BadgeVariant } from '@/types';
type BadgeSize = 'xs' | 'sm' | 'md';
type BadgeShape = 'rounded' | 'pill';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    title?: string;
    size?: BadgeSize;
    className?: string;
    /** Optional dot indicator */
    dot?: boolean;
    /** Optional icon on the left */
    icon?: React.ElementType<{ className?: string }>;
    shape?: BadgeShape;
    style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: "border-success/20 bg-success/10 text-success dark:bg-success/20",
    error: "border-danger/20 bg-danger/10 text-danger dark:bg-danger/20",
    warning: "border-warning/25 bg-warning/10 text-warning dark:bg-warning/20",
    neutral: "border-border bg-muted/55 text-muted-foreground",
    primary: "border-primary/20 bg-primary/10 text-primary dark:bg-primary/20",
    secondary: "border-secondary/35 bg-secondary/35 text-secondary-foreground dark:bg-secondary/30",
    info: "border-info/20 bg-info/10 text-info dark:bg-info/20",
    purple: "border-purple-500/20 bg-purple-100 text-purple-700 dark:bg-purple-900/25 dark:text-purple-300",
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
    xs: "min-h-4 px-1.5 py-0.5 text-[10px] gap-1",
    sm: "min-h-5 px-2 py-0.5 text-[11px] gap-1",
    md: "min-h-6 px-2.5 py-1 text-xs gap-1.5",
};

const shapeStyles: Record<BadgeShape, string> = {
    rounded: "rounded-md",
    pill: "rounded-full",
};

export function Badge({
    children,
    variant = 'neutral',
    title,
    size = 'md',
    className,
    dot,
    icon: Icon,
    shape = 'rounded',
    style,
}: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center justify-center border font-semibold leading-none whitespace-nowrap",
                "select-none shrink-0",
                sizeStyles[size],
                shapeStyles[shape],
                variantStyles[variant],
                className,
            )}
            title={title}
            style={style}
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
