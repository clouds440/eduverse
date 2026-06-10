'use client';

import { useState, useRef, useEffect, ReactNode, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

    const updateCoords = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const margin = 12;
        const width = Math.min(384, window.innerWidth - margin * 2);
        const left = effectivePosition === 'right'
            ? Math.min(Math.max(margin, rect.right - width), window.innerWidth - width - margin)
            : Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
        const top = Math.min(rect.bottom + 8, window.innerHeight - 160);
        setCoords({
            top,
            left,
            width,
            maxHeight: Math.max(160, window.innerHeight - top - margin),
        });
    };

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

    useLayoutEffect(() => {
        if (!isOpen) return;
        updateCoords();
        const frameId = window.requestAnimationFrame(updateCoords);
        window.addEventListener('resize', updateCoords, { passive: true });
        window.addEventListener('scroll', updateCoords, { passive: true, capture: true });
        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, { capture: true });
        };
    }, [isOpen, effectivePosition]);

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

            {isOpen && mounted && createPortal(
                <>
                    <div
                        id={drawerId}
                        ref={drawerRef}
                        className={cn(
                            'fixed z-9999 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-xl custom-scrollbar',
                            drawerClassName
                        )}
                        style={{
                            top: coords?.top ?? 0,
                            left: coords?.left ?? 12,
                            width: coords?.width ?? 'calc(100vw - 1.5rem)',
                            maxHeight: coords?.maxHeight ?? '70dvh',
                        }}
                        role="dialog"
                        aria-label={label}
                    >
                        {children}
                    </div>
                </>,
                document.body,
            )}
        </div>
    );
}
