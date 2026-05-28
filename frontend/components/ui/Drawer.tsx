'use client';

import { useState, useRef, useEffect, ReactNode, useId } from 'react';
import { Filter, LucideIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { useBackStackEntry } from '@/context/BackNavigationContext';

interface DrawerProps {
    children: ReactNode;
    icon?: LucideIcon;
    label?: string;
    triggerClassName?: string;
    drawerClassName?: string;
    position?: 'left' | 'right';
}

export function Drawer({
    children,
    icon: Icon = Filter,
    label = 'Filters',
    triggerClassName,
    drawerClassName,
    position = 'right',
}: DrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const drawerId = useId();

    useBackStackEntry({
        enabled: isOpen,
        label,
        priority: 50,
        onBack: () => setIsOpen(false),
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                drawerRef.current &&
                !drawerRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="relative">
            <Button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    `transition-all border-none outline-none ${isOpen ? 'opacity-90 scale-98' : ''}`,
                    triggerClassName
                )}
                variant='secondary'
                icon={Icon}
                aria-expanded={isOpen}
                aria-controls={drawerId}
            >
                {label}
            </Button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-900 bg-[var(--app-surface-overlay)] backdrop-blur-sm md:hidden"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        id={drawerId}
                        ref={drawerRef}
                        className={cn(
                            'fixed inset-x-0 bottom-0 z-999 max-h-[85dvh] overflow-y-auto rounded-t-lg border border-border bg-card p-4 shadow-xl custom-scrollbar',
                            'md:absolute md:bottom-auto md:top-full md:mt-2 md:max-h-[min(70vh,32rem)] md:min-w-72 md:max-w-sm md:rounded-lg',
                            position === 'right' ? 'md:right-0' : 'md:left-0',
                            drawerClassName
                        )}
                        role="dialog"
                        aria-label={label}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                                {label}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                aria-label={`Close ${label}`}
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        {children}
                    </div>
                </>
            )}
        </div>
    );
}
