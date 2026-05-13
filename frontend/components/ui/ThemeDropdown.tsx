'use client';

import { useState, useEffect, useRef } from 'react';
import { Monitor, Sun, Moon, ChevronDown } from 'lucide-react';
import { ThemeMode } from '@/types';
import { useUI } from '@/context/UIContext';

interface ThemeDropdownProps {
    currentMode: ThemeMode;
    onModeChange: (mode: ThemeMode) => void;
    className?: string;
    variant?: 'full' | 'compact';
}

export function ThemeDropdown({ currentMode, onModeChange, className = '', variant = 'full' }: ThemeDropdownProps) {
    const { isDesktop } = useUI();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const themeOptions = [
        { mode: ThemeMode.SYSTEM, label: 'System', icon: Monitor },
        { mode: ThemeMode.LIGHT, label: 'Light', icon: Sun },
        { mode: ThemeMode.DARK, label: 'Dark', icon: Moon }
    ];

    const currentOption = themeOptions.find(opt => opt.mode === currentMode) || themeOptions[0];
    const isCompact = variant === 'compact';

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
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

            {isOpen && (
                <div className={`absolute ${isDesktop ? 'right-0' : 'right-1/2 translate-x-1/2'} mt-2 bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden transform origin-top-right animate-in fade-in slide-in-from-top-2 z-100 ${isCompact ? 'w-48' : 'w-full'}`}>
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
                </div>
            )}
        </div>
    );
}
