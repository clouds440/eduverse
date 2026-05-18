'use client';

import * as React from "react";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { LucideIcon, ChevronDown, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export interface MultiSelectOption {
    value: string;
    label: string;
    icon?: LucideIcon;
}

export interface CustomMultiSelectProps {
    options: MultiSelectOption[];
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    icon?: LucideIcon;
    className?: string;
    disabled?: boolean;
    error?: boolean;
}

function CustomMultiSelectComponent({
    options,
    values,
    onChange,
    placeholder = "Select options...",
    icon: Icon,
    className = "",
    disabled = false,
}: CustomMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; isMobile?: boolean } | null>(null);
    const [isFlipped, setIsFlipped] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Use a Set for O(1) lookups
    const valuesSet = useMemo(() => new Set(values), [values]);

    // Derived state for selected options - O(n)
    const selectedOptions = useMemo(() => options.filter(opt => valuesSet.has(opt.value)), [options, valuesSet]);

    // Filtered options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowSearch = searchTerm.toLowerCase();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(lowSearch)
        );
    }, [options, searchTerm]);

    const updateCoords = useCallback((recalculateFlip = false) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const dropdownHeight = 350;

            const isMobile = window.innerWidth <= 640;
            const shouldFlip = !isMobile && (rect.bottom + dropdownHeight > windowHeight) && (rect.top > dropdownHeight);

            if (recalculateFlip) {
                setIsFlipped(shouldFlip);
            }

            if (isMobile) {
                const margin = 16;
                setCoords({
                    top: rect.bottom + window.scrollY,
                    left: margin + window.scrollX,
                    width: window.innerWidth - margin * 2,
                    isMobile: true
                });
            } else {
                setCoords({
                    top: (isFlipped ? rect.top - dropdownHeight - 8 : rect.bottom) + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                });
            }
        }
    }, [isFlipped]);

    useLayoutEffect(() => {
        if (!isOpen) return;

        const syncCoords = () => updateCoords(false);
        const frameId = window.requestAnimationFrame(() => updateCoords(true));

        window.addEventListener('scroll', syncCoords, { passive: true, capture: true });
        window.addEventListener('resize', syncCoords, { passive: true });

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('scroll', syncCoords, { capture: true });
            window.removeEventListener('resize', syncCoords);
        };
    }, [isOpen, updateCoords]);

    // Clear search term when closed
    useEffect(() => {
        if (!isOpen) setSearchTerm("");
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current && !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = useCallback((val: string) => {
        if (valuesSet.has(val)) {
            onChange(values.filter(v => v !== val));
        } else {
            onChange([...values, val]);
        }
    }, [values, valuesSet, onChange]);

    const removeOption = useCallback((val: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(values.filter(v => v !== val));
    }, [values, onChange]);

    return (
        <div className={`relative group ${className}`} ref={containerRef} >
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    flex items-center w-full min-h-12 sm:min-h-13 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border transition-all duration-200 outline-none
                    ${isOpen
                        ? 'border-primary/60 ring-4 ring-primary/10 bg-background shadow-lg'
                        : 'border-border/50 bg-background/5 hover:border-primary/50'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    text-foreground
                `}
            >
                {Icon && (
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 shrink-0 transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground'}`} />
                )}

                <div className="flex flex-wrap gap-1.5 sm:gap-2 flex-1 items-center overflow-hidden py-1">
                    {selectedOptions.length > 0 ? (
                        selectedOptions.map(opt => (
                            <Badge
                                key={opt.value}
                                variant="secondary"
                                size="sm"
                                className="animate-in zoom-in-95 duration-100 pr-1"
                            >
                                {opt.label}
                                <button
                                    type="button"
                                    onClick={(e) => removeOption(opt.value, e)}
                                    className="ml-1 hover:bg-primary/20 dark:hover:bg-primary/20 p-0.5 rounded-full transition-colors"
                                    title="Remove option"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))
                    ) : (
                        <span className="text-muted-foreground text-sm sm:text-base font-medium">{placeholder}</span>
                    )}
                </div>

                <div className="flex items-center shrink-0 ml-1 sm:ml-2">
                    {values.length > 0 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange([]); }}
                            className="mr-1.5 sm:mr-2 text-muted-foreground hover:text-destructive transition-colors p-1"
                            title="Clear all"
                        >
                            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                    )}
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 text-muted-foreground ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && coords && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: coords.top + 8,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 9999
                    }}
                    className={`py-2 bg-linear-to-br from-background to-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl max-h-[60vh] sm:max-h-[70vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-100 ${coords.isMobile ? '' : ''}`}
                >
                    <div className="px-3 sm:px-4 pb-2 sm:pb-3 border-b border-border/50">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-border/50 rounded-2xl text-sm sm:text-base bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-56 sm:max-h-64 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 sm:py-4 text-sm sm:text-base text-muted-foreground text-center">No options found</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = valuesSet.has(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => toggleOption(option.value)}
                                        className={`
                                            flex items-center justify-between rounded-2xl w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold transition-all
                                            ${isSelected
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-foreground hover:bg-primary/5'
                                            }
                                            text-left
                                        `}
                                    >
                                        <div className="flex items-center truncate">
                                            {option.icon && <option.icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 text-muted-foreground/60" />}
                                            <span className="truncate">{option.label}</span>
                                        </div>
                                        {isSelected && <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0 ml-2 sm:ml-3" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function areMultiSelectPropsEqual(
    prevProps: CustomMultiSelectProps,
    nextProps: CustomMultiSelectProps
) {
    if (prevProps.placeholder !== nextProps.placeholder) return false;
    if (prevProps.icon !== nextProps.icon) return false;
    if (prevProps.className !== nextProps.className) return false;
    if (prevProps.disabled !== nextProps.disabled) return false;
    if (prevProps.error !== nextProps.error) return false;
    if (prevProps.onChange !== nextProps.onChange) return false;

    // Compare values array length and contents
    if (prevProps.values.length !== nextProps.values.length) return false;
    for (let i = 0; i < prevProps.values.length; i++) {
        if (prevProps.values[i] !== nextProps.values[i]) return false;
    }

    // Compare options array length and contents
    if (prevProps.options.length !== nextProps.options.length) return false;
    for (let i = 0; i < prevProps.options.length; i++) {
        const a = prevProps.options[i];
        const b = nextProps.options[i];
        if (a.value !== b.value || a.label !== b.label || a.icon !== b.icon) {
            return false;
        }
    }

    return true;
}

export const CustomMultiSelect = React.memo(CustomMultiSelectComponent, areMultiSelectPropsEqual);
