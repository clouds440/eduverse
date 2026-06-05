'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, LucideIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusBannerVariant } from '@/types';

interface StatusBannerAction {
    label: string;
    href: string;
}

interface StatusBannerProps {
    title: string;
    description?: React.ReactNode;
    variant?: StatusBannerVariant;
    icon?: LucideIcon;
    action?: StatusBannerAction;
    children?: React.ReactNode;
    className?: string;
}

const variantClasses: Record<StatusBannerVariant, {
    shell: string;
    icon: string;
    title: string;
    action: string;
}> = {
    info: {
        shell: 'border-info/30 bg-info/10 text-info',
        icon: 'bg-info/10 text-info',
        title: 'text-info',
        action: 'bg-info text-white hover:bg-info/90',
    },
    success: {
        shell: 'border-success/30 bg-success/10 text-success',
        icon: 'bg-success/10 text-success',
        title: 'text-success',
        action: 'bg-success text-white hover:bg-success/90',
    },
    warning: {
        shell: 'border-warning/35 bg-warning/10 text-warning',
        icon: 'bg-warning/10 text-warning',
        title: 'text-warning',
        action: 'bg-warning text-white hover:bg-warning/90',
    },
    danger: {
        shell: 'border-danger/30 bg-danger/10 text-danger',
        icon: 'bg-danger/10 text-danger',
        title: 'text-danger',
        action: 'bg-danger text-white hover:bg-danger/90',
    },
    neutral: {
        shell: 'border-border/70 bg-card text-foreground',
        icon: 'bg-muted text-muted-foreground',
        title: 'text-foreground',
        action: 'bg-foreground text-background hover:bg-foreground/85',
    },
};

const DEFAULT_ICONS: Record<StatusBannerVariant, LucideIcon> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
    neutral: Info,
};

export function StatusBanner({
    title,
    description,
    variant = 'info',
    icon,
    action,
    children,
    className,
}: StatusBannerProps) {
    const tone = variantClasses[variant];
    const Icon = icon || DEFAULT_ICONS[variant];

    return (
        <section className={cn('rounded-lg border p-3 shadow-sm sm:p-4', tone.shell, className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/10', tone.icon)}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h2 className={cn('text-sm font-black leading-5', tone.title)}>{title}</h2>
                        {description && (
                            <div className="mt-1 text-sm font-medium leading-5 text-current/80">
                                {description}
                            </div>
                        )}
                    </div>
                </div>
                {action && (
                    <Link
                        href={action.href}
                        className={cn('inline-flex min-h-10 shrink-0 items-center justify-center rounded-md px-3 py-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30', tone.action)}
                    >
                        {action.label}
                    </Link>
                )}
            </div>
            {children && <div className="mt-3 text-current">{children}</div>}
        </section>
    );
}
