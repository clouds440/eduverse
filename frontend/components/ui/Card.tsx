'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
    className?: string;
    accentColor?: string; // Tailwind color class, e.g., 'bg-primary'
    hoverable?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'default' | 'muted' | 'raised' | 'bare';
    animate?: boolean;
    delay?: number; // delay in ms
}

export const Card = ({
    children,
    onClick,
    className,
    accentColor,
    hoverable = true,
    padding = 'md',
    variant = 'default',
    animate = false,
    delay = 0,
    onKeyDown,
}: CardProps) => {
    const paddingClasses = {
        none: 'p-0',
        sm: 'p-3 md:p-4',
        md: 'p-4 md:p-6',
        lg: 'p-5 md:p-7',
        xl: 'p-6 md:p-8',
    };
    const variantClasses = {
        default: 'border-border/70 bg-card text-card-foreground shadow-xs',
        muted: 'border-border/60 bg-muted/35 text-foreground shadow-none',
        raised: 'border-border/70 bg-surface-raised text-foreground shadow-sm',
        bare: 'border-transparent bg-transparent text-foreground shadow-none',
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
        onKeyDown?.(event);
        if (!onClick || event.defaultPrevented) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.currentTarget.click();
        }
    };

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            className={cn(
                "relative flex h-full flex-col overflow-hidden rounded-lg border transition-colors duration-200",
                paddingClasses[padding],
                variantClasses[variant],
                hoverable && "group hover:border-primary/40 hover:shadow-sm",
                onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                animate && "opacity-0 animate-fade-in-up-subtle",
                className
            )}
            style={animate ? { animationDelay: `${delay}ms` } : undefined}
        >
            {/* Premium Accent Line */}
            {accentColor && (
                <div className="absolute top-0 left-0 w-full h-1 group-hover:bg-primary/10 transition-colors duration-200">
                    <div className={cn(
                        "h-full w-full",
                        accentColor
                    )} />
                </div>
            )}
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
        {children}
    </div>
);

export const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("flex-1 space-y-4", className)}>
        {children}
    </div>
);

export const CardFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("mt-6 flex items-center justify-between gap-3 border-t border-border pt-4", className)}>
        {children}
    </div>
);
