'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import type { ProfanityWarningDetail } from '@/lib/profanityWarning';

interface ProfanityWarningDialogProps {
    warning: ProfanityWarningDetail | null;
    onClose: () => void;
}

export function ProfanityWarningDialog({ warning, onClose }: ProfanityWarningDialogProps) {
    const [mounted, setMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!warning) return;

        const previousOverflow = document.body.style.overflow;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus({ preventScroll: true });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previousFocus?.focus?.({ preventScroll: true });
        };
    }, [onClose, warning]);

    if (!mounted || !warning) return null;

    return createPortal(
        <div className="fixed inset-0 z-500 flex items-center justify-center overflow-y-auto bg-[var(--app-surface-overlay)] p-3 backdrop-blur-sm sm:p-6">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="w-full max-w-md rounded-lg border border-border/60 bg-card p-5 text-card-foreground shadow-xl outline-none sm:p-6"
            >
                <div className="flex items-start gap-3">
                    <div className="rounded-md bg-warning/10 p-2 text-warning">
                        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h3 id={titleId} className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                            Profanity is not allowed
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {warning.message || 'Please revise the highlighted text before submitting again.'}
                        </p>
                        {warning.field && (
                            <p className="mt-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                                Field: {warning.field}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-5 flex justify-end">
                    <Button type="button" variant="primary" onClick={onClose}>
                        Review input
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
