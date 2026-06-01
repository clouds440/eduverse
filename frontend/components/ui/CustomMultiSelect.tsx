'use client';

import * as React from "react";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId } from "react";
import { createPortal } from "react-dom";
import { LucideIcon, ChevronDown, X, Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { FloatingPosition, getFloatingPosition } from "@/lib/floatingPosition";
import { useBackStackEntry } from "@/context/BackNavigationContext";
import { cn } from "@/lib/utils";

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
    error = false,
}: CustomMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [coords, setCoords] = useState<(FloatingPosition & { isMobile?: boolean }) | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();

    useBackStackEntry({
        enabled: isOpen,
        label: placeholder,
        priority: 35,
        onBack: () => setIsOpen(false),
    });

    // Use a Set for O(1) lookups
    const valuesSet = useMemo(() => new Set(values), [values]);

    // Derived state for selected options - O(n)
    const selectedOptions = useMemo(() => options.filter(opt => valuesSet.has(opt.value)), [options, valuesSet]);

    // Filtered options based on search term
    const visibleOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowSearch = searchTerm.toLowerCase();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(lowSearch)
        );
    }, [options, searchTerm]);
    const visibleOptionsCount = visibleOptions.length;
    const getOptionId = useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

    const updateCoords = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const isMobile = window.innerWidth <= 640;
            if (isMobile) {
                const margin = 16;
                setCoords({
                    top: rect.bottom + 8,
                    left: margin,
                    width: window.innerWidth - margin * 2,
                    maxHeight: Math.max(160, window.innerHeight - rect.bottom - margin - 8),
                    placement: 'bottom',
                    overflowY: 'hidden',
                    isMobile: true,
                });
            } else {
                const dropdownRect = dropdownRef.current?.getBoundingClientRect();
                setCoords(getFloatingPosition({
                    anchorRect: rect,
                    floatingRect: dropdownRect
                        ? { width: dropdownRect.width, height: dropdownRect.height }
                        : { width: rect.width, height: 350 },
                    matchAnchorWidth: true,
                    preferredPlacement: 'bottom',
                    margin: 8,
                    gap: 8,
                }));
            }
        }
    }, []);

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

    useLayoutEffect(() => {
        if (!isOpen) return;
        updateCoords();
    }, [visibleOptionsCount, isOpen, searchTerm, updateCoords]);

    // Clear search term when closed
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve dropdown search reset behavior; moving this into close handlers previously caused runtime regressions.
        if (!isOpen) setSearchTerm("");
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const frameId = window.requestAnimationFrame(() => {
            setActiveIndex(0);
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [isOpen, visibleOptionsCount]);

    useEffect(() => {
        if (!isOpen) return;
        const frameId = window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
        return () => window.cancelAnimationFrame(frameId);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        document.getElementById(getOptionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, getOptionId, isOpen]);

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

    const moveActiveOption = useCallback((direction: 1 | -1) => {
        setActiveIndex((currentIndex) => {
            if (visibleOptions.length === 0) return 0;
            return (currentIndex + direction + visibleOptions.length) % visibleOptions.length;
        });
    }, [visibleOptions.length]);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
        containerRef.current?.querySelector<HTMLElement>('[role="combobox"]')?.focus({ preventScroll: true });
    }, []);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (disabled) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            else moveActiveOption(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            else moveActiveOption(-1);
        } else if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
        } else if (event.key === 'Enter' && isOpen) {
            event.preventDefault();
            const option = visibleOptions[activeIndex];
            if (option) toggleOption(option.value);
        } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeDropdown();
        }
    }, [activeIndex, closeDropdown, disabled, isOpen, moveActiveOption, toggleOption, visibleOptions]);

    return (
        <div className={`relative group ${className}`} ref={containerRef} >
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                className={cn(
                    "flex min-h-11 w-full items-center rounded-md border px-3 py-2 text-foreground outline-none transition-colors duration-200",
                    isOpen
                        ? 'border-primary bg-input ring-2 ring-primary/20'
                        : error
                            ? 'border-danger/70 bg-danger/5 ring-1 ring-danger/20'
                            : 'border-border bg-input hover:border-primary/45',
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                )}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={isOpen && visibleOptions[activeIndex] ? getOptionId(activeIndex) : undefined}
                aria-invalid={error || undefined}
                tabIndex={disabled ? -1 : 0}
            >
                {Icon && (
                    <Icon className={`mr-2 h-4 w-4 shrink-0 transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground'}`} />
                )}

                <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden py-0.5">
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
                                    className="ml-1 rounded-full p-0.5 transition-colors hover:bg-primary/20 dark:hover:bg-primary/20"
                                    title={`Remove ${opt.label}`}
                                    aria-label={`Remove ${opt.label}`}
                                >
                                    <X className="h-3 w-3" aria-hidden="true" />
                                </button>
                            </Badge>
                        ))
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground">{placeholder}</span>
                    )}
                </div>

                <div className="ml-2 flex shrink-0 items-center">
                    {values.length > 0 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange([]); }}
                            className="mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                            title="Clear all"
                            aria-label="Clear selected options"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && coords && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        maxHeight: coords.maxHeight,
                        overflowY: 'hidden',
                        zIndex: 9999
                    }}
                    className={`flex flex-col rounded-lg border border-border/60 bg-card py-2 shadow-lg animate-in fade-in zoom-in duration-100 ${coords.placement === 'top' ? 'origin-bottom' : 'origin-top'}`}
                    id={listboxId}
                    role="listbox"
                    aria-label={placeholder}
                    aria-multiselectable="true"
                    onKeyDown={handleKeyDown}
                >
                    <div className="border-b border-border/60 px-3 pb-2">
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="block w-full rounded-md border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                                aria-label={`Search ${placeholder}`}
                            />
                        </div>
                    </div>

                    <div className="max-h-56 sm:max-h-64 overflow-y-auto custom-scrollbar">
                        {visibleOptions.length === 0 ? (
                            <div className="px-4 py-3 sm:py-4 text-sm sm:text-base text-muted-foreground text-center">No options found</div>
                        ) : (
                            visibleOptions.map((option, index) => {
                                const isSelected = valuesSet.has(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        id={getOptionId(index)}
                                        type="button"
                                        onClick={() => toggleOption(option.value)}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        className={cn(
                                            "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
                                            isSelected
                                                ? 'bg-primary/10 text-primary'
                                                : index === activeIndex
                                                    ? 'bg-primary/5 text-foreground'
                                                    : 'text-foreground hover:bg-primary/5',
                                        )}
                                        role="option"
                                        aria-selected={isSelected}
                                    >
                                        <div className="flex items-center truncate">
                                            {option.icon && <option.icon className="mr-2 h-4 w-4 text-muted-foreground/60" />}
                                            <span className="truncate">{option.label}</span>
                                        </div>
                                        {isSelected && <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />}
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
