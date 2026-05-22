'use client';

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Sun, Moon, ChevronDown } from 'lucide-react';
import { ThemeMode } from '@/types';
import { FloatingPosition, getFloatingPosition } from '@/lib/floatingPosition';

interface ThemeDropdownProps {
    currentMode: ThemeMode;
    onModeChange: (mode: ThemeMode) => void;
    className?: string;
    variant?: 'full' | 'compact';
}

const themeOptions = [
    { mode: ThemeMode.SYSTEM, label: 'System', icon: Monitor },
    { mode: ThemeMode.LIGHT, label: 'Light', icon: Sun },
    { mode: ThemeMode.DARK, label: 'Dark', icon: Moon }
];

export function ThemeDropdown({ currentMode, onModeChange, className = '', variant = 'full' }: ThemeDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<FloatingPosition | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                containerRef.current &&
                !containerRef.current.contains(target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentOption = themeOptions.find(opt => opt.mode === currentMode) || themeOptions[0];
    const isCompact = variant === 'compact';
    const dropdownWidth = isCompact ? 192 : undefined;

    const updateCoords = useCallback(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const dropdownRect = dropdownRef.current?.getBoundingClientRect();
        setCoords(getFloatingPosition({
            anchorRect: rect,
            floatingRect: dropdownRect
                ? { width: dropdownRect.width, height: dropdownRect.height }
                : { width: dropdownWidth || rect.width, height: 156 },
            matchAnchorWidth: !isCompact,
            preferredPlacement: 'bottom',
            margin: 8,
            gap: 8,
        }));
    }, [dropdownWidth, isCompact]);

    useLayoutEffect(() => {
        if (!isOpen) return;

        updateCoords();
        const frameId = window.requestAnimationFrame(updateCoords);

        window.addEventListener('scroll', updateCoords, { passive: true, capture: true });
        window.addEventListener('resize', updateCoords, { passive: true });

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('scroll', updateCoords, { capture: true });
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen, updateCoords]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                title={`Theme: ${currentOption.label}`}
                className={isCompact
                    ? "relative p-2 text-primary/80 hover:text-primary hover:bg-primary/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                    : "flex items-center justify-between w-full px-4 py-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-all text-sm font-medium text-foreground"
                }
                aria-label="Theme"
            >
                <div className="flex items-center gap-2">
                    <currentOption.icon className={isCompact ? "w-5 h-5" : "w-4 h-4"} />
                    {!isCompact && <span>{currentOption.label}</span>}
                </div>
                {!isCompact && <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </button>

            {isOpen && coords && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width ?? dropdownWidth,
                        maxHeight: coords.maxHeight,
                        overflowY: coords.overflowY,
                    }}
                    className={`${isCompact ? '-translate-x-18' : ''} bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden transform animate-in fade-in zoom-in duration-100 z-[9999] ${coords.placement === 'top' ? 'origin-bottom' : 'origin-top'}`}
                >
                    <div className="p-2">
                        {themeOptions.map(({ mode, label, icon: Icon }) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => {
                                    onModeChange(mode);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentMode === mode ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{label}</span>
                                {currentMode === mode && (
                                    <div className="ml-auto">
                                        <div className="w-2 h-2 rounded-full bg-current opacity-70" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
