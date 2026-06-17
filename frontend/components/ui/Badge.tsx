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
    onClick?: () => void;
    /** Optional dot indicator */
    dot?: boolean;
    /** Optional icon on the left */
    icon?: React.ElementType<{ className?: string }>;
    shape?: BadgeShape;
    style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: "border-success/20 bg-success/10 text-success dark:bg-success/20",
    error: "border-danger/20 bg-danger/50 text-white dark:bg-danger/70",
    warning: "border-warning/25 bg-warning/10 text-warning dark:bg-warning/20",
    neutral: "border-border bg-muted/55 text-muted-foreground",
    primary: "border-primary/20 bg-primary/10 text-primary dark:bg-primary/20",
    secondary: "border-secondary/35 bg-secondary/35 text-secondary-foreground dark:bg-secondary/30",
    info: "border-info/20 bg-info/10 text-info dark:bg-info/20",
    purple: "border-purple/20 bg-purple text-purple dark:bg-purple/25 dark:text-purple",
    teal: "border-teal/20 bg-teal text-teal dark:bg-teal/25 dark:text-teal",
    cyan: "border-cyan/20 bg-cyan text-cyan dark:bg-cyan/25 dark:text-cyan",
    rose: "border-rose/20 bg-rose text-rose dark:bg-rose/25 dark:text-rose",
};

const dotColors: Record<BadgeVariant, string> = {
    success: "bg-success",
    error: "bg-danger",
    warning: "bg-warning",
    neutral: "bg-neutral",
    primary: "bg-primary",
    secondary: "bg-secondary",
    info: "bg-info",
    purple: "bg-purple",
    teal: "bg-teal",
    cyan: "bg-cyan",
    rose: "bg-rose",
};

const sizeStyles: Record<BadgeSize, string> = {
    xs: "min-h-3 px-1.5 py-0 text-[10px] gap-1",
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
    onClick,
}: BadgeProps) {
    const classes = cn(
        "inline-flex items-center justify-center border font-semibold leading-none whitespace-nowrap",
        "select-none shrink-0",
        onClick && "cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        sizeStyles[size],
        shapeStyles[shape],
        variantStyles[variant],
        className,
    );
    const content = (
        <>
            {dot && (
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])} />
            )}
            {Icon && (
                <Icon className="w-3.5 h-3.5 shrink-0" />
            )}
            {children}
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                className={classes}
                title={title}
                style={style}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return (
        <span
            className={classes}
            title={title}
            style={style}
        >
            {content}
        </span>
    );
}
