'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DismissiblePanelProps {
    children: ReactNode;
    title?: ReactNode;
    className?: string;
    contentClassName?: string;
    storageKey?: string;
    defaultCollapsedOnMobile?: boolean;
    dismissible?: boolean;
    collapsible?: boolean;
}

export function DismissiblePanel({
    children,
    title,
    className,
    contentClassName,
    defaultCollapsedOnMobile = false,
    dismissible = true,
    collapsible = true,
}: DismissiblePanelProps) {
    const [dismissed, setDismissed] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!defaultCollapsedOnMobile) return;
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const applyMobileDefault = () => setCollapsed(mediaQuery.matches);
        applyMobileDefault();
        mediaQuery.addEventListener('change', applyMobileDefault);
        return () => mediaQuery.removeEventListener('change', applyMobileDefault);
    }, [defaultCollapsedOnMobile]);

    if (dismissed) return null;

    return (
        <section className={cn('relative rounded-lg border border-border/60 bg-background/40 p-2 shadow-sm', className)}>
            {(title || collapsible || dismissible) && (
                <div className={cn('mb-2 flex min-h-8 items-center justify-between gap-2', !title && 'absolute right-1 top-1 z-10 mb-0')}>
                    {title && <div className="min-w-0 text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</div>}
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        {collapsible && (
                            <button
                                type="button"
                                onClick={() => setCollapsed((open) => !open)}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                aria-expanded={!collapsed}
                                aria-label={collapsed ? 'Show panel' : 'Collapse panel'}
                            >
                                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </button>
                        )}
                        {dismissible && (
                            <button
                                type="button"
                                onClick={() => setDismissed(true)}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                aria-label="Dismiss panel"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}
            {!collapsed && (
                <div className={contentClassName}>
                    {children}
                </div>
            )}
        </section>
    );
}
