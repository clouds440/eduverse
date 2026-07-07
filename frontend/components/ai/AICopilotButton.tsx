'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAICopilot } from './AICopilotProvider';
import { useUI } from '@/context/UIContext';
import { cn } from '@/lib/utils';

export function AICopilotButton() {
    const { isOpen, toggle, entitlement, entitlementLoading, isSending } = useAICopilot();
    const { isDesktop, mounted } = useUI();
    const [dismissedOnPhone, setDismissedOnPhone] = useState(false);
    const isAllowed = entitlement?.allowed;

    if (!mounted || (!isDesktop && dismissedOnPhone && !isOpen)) return null;

    return (
        <div className="fixed bottom-4 right-4 z-80 lg:bottom-5 lg:right-5">
            {!isDesktop && !isOpen && (
                <button
                    type="button"
                    onClick={() => setDismissedOnPhone(true)}
                    aria-label="Dismiss AI Copilot button"
                    className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-md transition-colors hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}
            <button
                type="button"
                onClick={toggle}
                aria-label={isOpen ? 'Close EduVerse AI Copilot' : 'Open EduVerse AI Copilot'}
                aria-pressed={isOpen}
                className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-card text-primary shadow-xl',
                    'transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-2xl',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isAllowed && 'border-primary/30 bg-primary/10',
                    entitlementLoading && 'animate-pulse',
                    isOpen && 'scale-95 border-primary/40 bg-primary text-primary-foreground',
                )}
            >
                <Sparkles
                    className={cn(
                        'h-6 w-6 transition-transform duration-200',
                        isAllowed && 'fill-current',
                        isSending && 'animate-pulse',
                    )}
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}
