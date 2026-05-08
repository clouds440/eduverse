'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Filter, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

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

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
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
            >
                {label}
            </Button>

            {isOpen && (
                <div
                    ref={drawerRef}
                    className={cn(
                        'absolute top-full mt-2 z-999 bg-card border border-border rounded-xl shadow-xl p-4 min-w-64 max-w-sm',
                        position === 'right' ? 'right-0' : 'left-0',
                        drawerClassName
                    )}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
