'use client';

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { LucideIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingPosition, getFloatingPosition } from "@/lib/floatingPosition";

export interface DropdownOption<T extends string = string> {
    value: T;
    label: string;
    icon?: LucideIcon;
    iconClassName?: string;
    badge?: number | string;
}

export interface CustomSelectProps<T extends string = string> {
    options: DropdownOption<T>[];
    value: T;
    onChange: (value: T) => void;
    placeholder?: string;
    icon?: LucideIcon;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    error?: boolean;
    searchable?: boolean;
}

function CustomSelectComponent<T extends string = string>({
    options,
    value,
    onChange,
    placeholder = "Select an option",
    icon: Icon,
    className = "",
    disabled = false,
    required = false,
    error = false,
    searchable = false
}: CustomSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [coords, setCoords] = useState<FloatingPosition | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);
    const visibleOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        const lowSearch = searchTerm.toLowerCase();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(lowSearch)
        );
    }, [options, searchTerm, searchable]);
    const visibleOptionsCount = visibleOptions.length;

    // Clear search term when closed
    useEffect(() => {
        if (!isOpen) setSearchTerm("");
    }, [isOpen]);

    const updateCoords = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const dropdownRect = dropdownRef.current?.getBoundingClientRect();
            setCoords(getFloatingPosition({
                anchorRect: rect,
                floatingRect: dropdownRect
                    ? { width: dropdownRect.width, height: dropdownRect.height }
                    : { width: rect.width, height: searchable ? 360 : 320 },
                matchAnchorWidth: true,
                preferredPlacement: 'bottom',
                margin: 8,
                gap: 8,
            }));
        }
    }, [searchable]);

    useLayoutEffect(() => {
        if (isOpen) {
            updateCoords();
            const frameId = window.requestAnimationFrame(updateCoords);

            // Use a passive scroll listener for better performance
            window.addEventListener('scroll', updateCoords, { passive: true, capture: true });
            window.addEventListener('resize', updateCoords, { passive: true });
            return () => {
                window.cancelAnimationFrame(frameId);
                window.removeEventListener('scroll', updateCoords, { capture: true });
                window.removeEventListener('resize', updateCoords);
            };
        }
    }, [isOpen, updateCoords]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        updateCoords();
    }, [visibleOptionsCount, isOpen, searchTerm, updateCoords]);

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

    const handleSelect = useCallback((val: T) => {
        onChange(val);
        setIsOpen(false);
    }, [onChange]);

    return (
        <div className={`relative group ${className}`} ref={containerRef}>
            <select
                required={required}
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
            >
                <option value="">{placeholder}</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex items-center w-full px-4 py-3 rounded-2xl border transition-all duration-200 outline-none",
                    isOpen
                        ? 'border-primary ring-4 ring-primary/10 bg-background'
                        : error
                            ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5'
                            : 'border-border/50 bg-primary/5 hover:border-primary/50',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    "text-foreground font-semibold text-left text-base",
                    className
                )}
            >
                {/* Prefix Icon (Prop) or Selected Option Icon */}
                {(selectedOption?.icon || Icon) && (
                    <div className="mr-2 sm:mr-3 shrink-0">
                        {selectedOption?.icon ? (
                            <selectedOption.icon className={cn("h-5 w-5", selectedOption.iconClassName || (isOpen ? 'text-primary' : 'text-muted-foreground'))} />
                        ) : (
                            Icon && <Icon className={cn("h-5 w-5 transition-colors", isOpen ? 'text-primary' : error ? 'text-destructive' : 'text-muted-foreground group-focus-within:text-primary')} />
                        )}
                    </div>
                )}

                <span className={`flex-1 truncate ${!selectedOption ? 'text-muted-foreground' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>

                {/* Selected Option Badge (Visible when closed too) */}
                {selectedOption?.badge !== undefined && (
                    <span className="mx-2 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary shrink-0">
                        {selectedOption.badge}
                    </span>
                )}

                <ChevronDown className={cn("h-4 w-4 ml-2 sm:ml-2.5 transition-transform duration-200 text-muted-foreground", isOpen && "rotate-180")} />
            </button>

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
                    className={cn(
                        "py-2 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in duration-100",
                        coords.placement === 'top' ? 'origin-bottom' : 'origin-top'
                    )}
                >
                    {searchable && (
                        <div className="px-3 sm:px-4 pb-2 sm:pb-3 border-b border-border/50">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-border/50 rounded-2xl text-xs sm:text-sm bg-primary/5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {visibleOptions.length === 0 ? (
                            <div className="px-4 py-4 text-sm sm:text-base text-muted-foreground text-center text-balance">{searchable ? `No results found for "${searchTerm}"` : 'No options available'}</div>
                        ) : (
                            visibleOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                    flex items-center w-full px-3 sm:px-4 rounded-2xl py-2.5 sm:py-3 text-sm sm:text-base font-semibold transition-all
                                    ${option.value === value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-foreground hover:bg-primary/10'
                                        }
                                    text-left
                                `}
                                >
                                    {option.icon && <option.icon className={cn("h-5 w-5 mr-2 sm:mr-3", option.iconClassName)} />}
                                    <span className="flex-1">{option.label}</span>
                                    {option.badge !== undefined && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${option.value === value ? 'bg-card/20 text-card-text' : 'bg-primary/10 text-primary'
                                            }`}>
                                            {option.badge}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function areEqual<T extends string = string>(
    prevProps: CustomSelectProps<T>,
    nextProps: CustomSelectProps<T>
) {
    if (prevProps.value !== nextProps.value) return false;
    if (prevProps.placeholder !== nextProps.placeholder) return false;
    if (prevProps.icon !== nextProps.icon) return false;
    if (prevProps.className !== nextProps.className) return false;
    if (prevProps.disabled !== nextProps.disabled) return false;
    if (prevProps.required !== nextProps.required) return false;
    if (prevProps.error !== nextProps.error) return false;
    if (prevProps.searchable !== nextProps.searchable) return false;
    if (prevProps.onChange !== nextProps.onChange) return false;

    // Compare options length
    if (prevProps.options.length !== nextProps.options.length) return false;

    // Shallow compare each option's properties
    for (let i = 0; i < prevProps.options.length; i++) {
        const a = prevProps.options[i];
        const b = nextProps.options[i];
        if (
            a.value !== b.value ||
            a.label !== b.label ||
            a.badge !== b.badge ||
            a.icon !== b.icon ||
            a.iconClassName !== b.iconClassName
        ) {
            return false;
        }
    }

    return true;
}

export const CustomSelect = React.memo(CustomSelectComponent, areEqual) as typeof CustomSelectComponent;
