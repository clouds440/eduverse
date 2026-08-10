import React from 'react';
import { cn, getSectionTintStyle, isValidHexColor } from '@/lib/utils';
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
    /** Exact hex identity color from the section/department color palette. Preserves variants when omitted. */
    color?: string | null;
    style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: "border-success/25 bg-success/10 text-success dark:bg-success/20",
    error: "border-danger/25 bg-danger/10 text-danger dark:bg-danger/20 dark:text-red-200",
    warning: "border-warning/30 bg-warning/10 text-warning dark:bg-warning/20 dark:text-amber-200",
    neutral: "border-border/80 bg-muted/55 text-muted-foreground",
    primary: "border-primary/25 bg-primary/10 text-primary dark:bg-primary/20",
    secondary: "border-secondary/35 bg-secondary/35 text-secondary-foreground dark:bg-secondary/25",
    info: "border-info/25 bg-info/10 text-info dark:bg-info/20 dark:text-blue-200",
    purple: "border-purple/25 bg-purple/10 text-purple dark:bg-purple/20 dark:text-violet-200",
    teal: "border-teal/25 bg-teal/10 text-teal dark:bg-teal/20 dark:text-teal-200",
    cyan: "border-cyan/25 bg-cyan/10 text-cyan dark:bg-cyan/20 dark:text-cyan-200",
    rose: "border-rose/25 bg-rose/10 text-rose dark:bg-rose/20 dark:text-pink-200",
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
    color,
    style,
    onClick,
}: BadgeProps) {
    const colorStyle = isValidHexColor(color) ? getSectionTintStyle(color) : undefined;
    const mergedStyle = colorStyle ? { ...colorStyle, ...style } : style;
    const classes = cn(
        "inline-flex items-center justify-center border font-semibold leading-none whitespace-nowrap shadow-xs",
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
                <span
                    className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[variant])}
                    style={colorStyle ? { backgroundColor: colorStyle.color } : undefined}
                />
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
                style={mergedStyle}
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
            style={mergedStyle}
        >
            {content}
        </span>
    );
}
