'use client';

import { Sparkles } from 'lucide-react';
import { useAICopilot } from './AICopilotProvider';
import { cn } from '@/lib/utils';

export function AICopilotButton() {
    const { isOpen, toggle, entitlement, entitlementLoading, isSending } = useAICopilot();
    const isAllowed = entitlement?.allowed;
    const statusClass = entitlementLoading
        ? 'bg-warning'
        : isAllowed
            ? 'bg-success'
            : 'bg-muted-foreground';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isOpen ? 'Close EduVerse AI Copilot' : 'Open EduVerse AI Copilot'}
            aria-pressed={isOpen}
            className={cn(
                'fixed bottom-4 right-4 z-80 flex h-14 items-center justify-center rounded-full border border-border/70 bg-card text-primary shadow-xl',
                'transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-2xl',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'lg:bottom-5 lg:right-5',
                'w-14',
                isOpen && 'scale-95 border-primary/40 bg-primary text-primary-foreground',
            )}
        >
            <Sparkles className={cn('h-6 w-6 transition-transform duration-200', isSending && 'animate-pulse')} aria-hidden="true" />
            <span className={cn('absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-card', statusClass)} />
        </button>
    );
}
