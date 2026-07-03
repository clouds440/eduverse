'use client';

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { LucideIcon, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingPosition, getFloatingPosition } from "@/lib/floatingPosition";
import { useBackStackEntry } from "@/context/BackNavigationContext";
import { Badge } from "./Badge";
import { BrandIcon } from "./Brand";
import { SearchBar } from "./SearchBar";

export interface DropdownOption<T extends string = string> {
    value: T;
    label: string;
    icon?: LucideIcon;
    iconClassName?: string;
    badge?: number | string;
    description?: string;
    meta?: string;
    badges?: string[];
    avatarUser?: {
        id?: string;
        name?: string | null;
        avatarUrl?: string | null;
        avatarUpdatedAt?: string | null;
        role?: string;
    } | null;
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
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    isSearching?: boolean;
    emptyMessage?: string;
    clearable?: boolean;
    clearLabel?: string;
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
    searchable = false,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    isSearching = false,
    emptyMessage,
    clearable = false,
    clearLabel = 'Clear selection',
}: CustomSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [coords, setCoords] = useState<FloatingPosition | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchBarRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();

    useBackStackEntry({
        enabled: isOpen,
        label: placeholder,
        priority: 35,
        onBack: () => setIsOpen(false),
    });

    const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);
    const effectiveSearchTerm = searchValue ?? searchTerm;
    const usesRemoteSearch = Boolean(onSearchChange);
    const visibleOptions = useMemo(() => {
        if (!searchable || !effectiveSearchTerm || usesRemoteSearch) return options;
        const lowSearch = effectiveSearchTerm.toLowerCase();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(lowSearch) ||
            opt.description?.toLowerCase().includes(lowSearch) ||
            opt.meta?.toLowerCase().includes(lowSearch) ||
            opt.badges?.some((badge) => badge.toLowerCase().includes(lowSearch))
        );
    }, [effectiveSearchTerm, options, searchable, usesRemoteSearch]);
    const visibleOptionsCount = visibleOptions.length;
    const selectedVisibleIndex = useMemo(
        () => visibleOptions.findIndex((option) => option.value === value),
        [value, visibleOptions],
    );
    const getOptionId = useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);
    // Clear search term when closed
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve dropdown search reset behavior; moving this into close handlers previously caused runtime regressions.
        if (!isOpen && searchValue === undefined) setSearchTerm("");
    }, [isOpen, searchValue]);

    useEffect(() => {
        if (!isOpen) return;
        const frameId = window.requestAnimationFrame(() => {
            setActiveIndex(selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0);
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [isOpen, selectedVisibleIndex, visibleOptionsCount]);

    useEffect(() => {
        if (!isOpen || !searchable) return;
        const frameId = window.requestAnimationFrame(() => {
            searchBarRef.current?.querySelector('input')?.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [isOpen, searchable]);

    useEffect(() => {
        if (!isOpen) return;
        document.getElementById(getOptionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, getOptionId, isOpen]);

    const updateCoords = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const dropdownRect = dropdownRef.current?.getBoundingClientRect();
            setCoords(getFloatingPosition({
                anchorRect: rect,
                floatingRect: dropdownRect
                    ? { width: dropdownRect.width, height: dropdownRect.height }
                    : { width: rect.width, height: 320 },
                matchAnchorWidth: true,
                preferredPlacement: 'bottom',
                margin: 8,
                gap: 8,
            }));
        }
    }, []);

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
    }, [visibleOptionsCount, isOpen, effectiveSearchTerm, updateCoords]);

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

    const handleSearchChange = useCallback((nextSearch: string) => {
        if (searchValue === undefined) {
            setSearchTerm(nextSearch);
        }
        onSearchChange?.(nextSearch);
    }, [onSearchChange, searchValue]);

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

    const handleTriggerClick = useCallback(() => {
        if (disabled) return;
        if (!isOpen) {
            setIsOpen(true);
            return;
        }
        setIsOpen(false);
    }, [disabled, isOpen]);

    const handleChevronMouseDown = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) setIsOpen((open) => !open);
    }, [disabled]);

    const stopChevronClickPropagation = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
    }, []);

    const handleClearMouseDown = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) {
            onChange('' as T);
            setIsOpen(false);
        }
    }, [disabled, onChange]);

    const handleComboboxKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (disabled) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            else moveActiveOption(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) setIsOpen(true);
            else moveActiveOption(-1);
        } else if (event.key === 'Enter' && isOpen) {
            event.preventDefault();
            const option = visibleOptions[activeIndex];
            if (option) handleSelect(option.value);
        } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            closeDropdown();
        }
    }, [activeIndex, closeDropdown, disabled, handleSelect, isOpen, moveActiveOption, visibleOptions]);

    return (
        <div className={`relative group ${className}`} ref={containerRef}>
            <select
                required={required}
                disabled={disabled}
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

            <div
                onClick={handleTriggerClick}
                onKeyDown={handleComboboxKeyDown}
                className={cn(
                    "flex min-h-11 w-full items-center rounded-md border px-3.5 py-2.5 text-left text-sm font-medium outline-none transition-colors duration-200",
                    isOpen
                        ? 'border-primary bg-input ring-2 ring-primary/20'
                        : error
                            ? 'border-danger/70 bg-danger/5 ring-1 ring-danger/20'
                            : 'border-border bg-input hover:border-primary/45',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                    "text-foreground",
                    className
                )}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={isOpen && visibleOptions[activeIndex] ? getOptionId(activeIndex) : undefined}
                aria-invalid={error || undefined}
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : 0}
            >
                <>
                    {/* Prefix Icon (Prop) or Selected Option Icon */}
                    {(selectedOption?.icon || Icon) && (
                        <div className="mr-2 shrink-0">
                            {selectedOption?.icon ? (
                                <selectedOption.icon className={cn("h-4 w-4", selectedOption.iconClassName || (isOpen ? 'text-primary' : 'text-muted-foreground'))} />
                            ) : (
                                Icon && <Icon className={cn("h-4 w-4 transition-colors", isOpen ? 'text-primary' : error ? 'text-danger' : 'text-muted-foreground group-focus-within:text-primary')} />
                            )}
                        </div>
                    )}

                    {selectedOption?.avatarUser && (
                        <BrandIcon
                            variant="user"
                            size="sm"
                            user={selectedOption.avatarUser}
                            initialsFallback
                            className="mr-2 h-6 w-6"
                        />
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
                </>

                <div className="ml-2 flex shrink-0 items-center gap-1">
                    {clearable && value && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={handleClearMouseDown}
                            onClick={stopChevronClickPropagation}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-danger focus:outline-none"
                            aria-label={clearLabel}
                            title={clearLabel}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    )}
                    <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={handleChevronMouseDown}
                        onClick={stopChevronClickPropagation}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                        aria-label={isOpen ? 'Close options' : 'Open options'}
                    >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
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
                    className={cn(
                        "flex flex-col rounded-lg border border-border/60 bg-card py-2 shadow-lg animate-in fade-in zoom-in duration-100",
                        coords.placement === 'top' ? 'origin-bottom' : 'origin-top'
                    )}
                    id={listboxId}
                    role="listbox"
                    aria-label={placeholder}
                    onMouseDown={(event) => event.stopPropagation()}
                    onKeyDown={handleComboboxKeyDown}
                >
                    {searchable && (
                        <div ref={searchBarRef} className="border-b border-border/60 px-3 pb-2">
                            <SearchBar
                                value={effectiveSearchTerm}
                                onChange={handleSearchChange}
                                placeholder={searchPlaceholder || `Search ${placeholder.toLowerCase()}...`}
                                delay={350}
                                size="compact"
                                className="w-full"
                                ariaLabel={`Search ${placeholder}`}
                            />
                        </div>
                    )}
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {visibleOptions.length === 0 ? (
                            <div className="px-4 py-4 text-sm sm:text-base text-muted-foreground text-center text-balance">
                                {isSearching
                                    ? 'Searching...'
                                    : emptyMessage || (searchable && effectiveSearchTerm ? `No results found for "${effectiveSearchTerm}"` : 'No options available')}
                            </div>
                        ) : (
                            visibleOptions.map((option, index) => (
                                <button
                                    key={option.value}
                                    id={getOptionId(index)}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cn(
                                        "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
                                        option.value === value
                                            ? 'bg-primary text-primary-foreground'
                                            : index === activeIndex
                                                ? 'bg-primary/10 text-foreground'
                                                : 'text-foreground hover:bg-primary/10',
                                    )}
                                    role="option"
                                    aria-selected={option.value === value}
                                >
                                    {option.avatarUser ? (
                                        <BrandIcon
                                            variant="user"
                                            size="sm"
                                            user={option.avatarUser}
                                            initialsFallback
                                            className="mr-2 h-8 w-8"
                                        />
                                    ) : option.icon ? (
                                        <option.icon className={cn("mr-2 h-4 w-4", option.iconClassName)} />
                                    ) : null}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-bold">{option.label}</span>
                                        {(option.description || option.meta || option.badges?.length) && (
                                            <span className={cn(
                                                "mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-[11px] font-semibold",
                                                option.value === value ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                            )}>
                                                {option.description && <span className="truncate">{option.description}</span>}
                                                {option.meta && <span className="truncate">{option.meta}</span>}
                                                {option.badges?.slice(0, 3).map((item) => (
                                                    <Badge key={item} variant="neutral" size="sm" className="h-5 max-w-32 truncate px-1.5 text-[10px]">
                                                        {item}
                                                    </Badge>
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                    {option.badge !== undefined && (
                                        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${option.value === value ? 'bg-card/20 text-card-text' : 'bg-primary/10 text-primary'
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
    if (prevProps.searchValue !== nextProps.searchValue) return false;
    if (prevProps.onSearchChange !== nextProps.onSearchChange) return false;
    if (prevProps.searchPlaceholder !== nextProps.searchPlaceholder) return false;
    if (prevProps.isSearching !== nextProps.isSearching) return false;
    if (prevProps.emptyMessage !== nextProps.emptyMessage) return false;
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
            a.description !== b.description ||
            a.meta !== b.meta ||
            a.avatarUser !== b.avatarUser ||
            (a.badges || []).join('|') !== (b.badges || []).join('|') ||
            a.icon !== b.icon ||
            a.iconClassName !== b.iconClassName
        ) {
            return false;
        }
    }

    return true;
}

export const CustomSelect = React.memo(CustomSelectComponent, areEqual) as typeof CustomSelectComponent;
