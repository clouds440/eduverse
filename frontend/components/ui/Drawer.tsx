'use client';

import { useState, useRef, useEffect, ReactNode, useId } from 'react';
import { Filter, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { useBackStackEntry } from '@/context/BackNavigationContext';
import { useUI } from '@/context/UIContext';

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
    const { isDesktop, mounted } = useUI();
    const effectivePosition = mounted && isDesktop ? 'right' : position;

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
                        id={drawerId}
                        ref={drawerRef}
                        className={cn(
                            'absolute top-full z-999 mt-2 w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-xl custom-scrollbar',
                            'max-h-[min(70dvh,32rem)] sm:w-80',
                            effectivePosition === 'right' ? 'right-0' : 'left-0',
                            drawerClassName
                        )}
                        role="dialog"
                        aria-label={label}
                    >
                        {children}
                    </div>
                </>
            )}
        </div>
    );
}
