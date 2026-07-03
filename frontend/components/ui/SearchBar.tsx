import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    delay?: number;
    className?: string;
    ariaLabel?: string;
    mobileMode?: 'full' | 'expandable';
    expandOn?: 'mobile' | 'all';
    size?: 'default' | 'compact';
    appearance?: 'field' | 'nav';
    expandedClassName?: string;
    onClear?: () => void;
}

export function SearchBar({
    value,
    onChange,
    placeholder = 'Search...',
    delay = 500,
    className,
    ariaLabel,
    mobileMode = 'full',
    expandOn = 'mobile',
    size = 'default',
    appearance = 'field',
    expandedClassName,
    onClear,
}: SearchBarProps) {
    const [localValue, setLocalValue] = useState(value);
    const debouncedValue = useDebounce(localValue, delay);
    const pathname = usePathname();
    const [isExpanded, setIsExpanded] = useState(false);
    const prevDebouncedValueRef = useRef(debouncedValue);
    const onChangeRef = useRef(onChange);
    const onClearRef = useRef(onClear);
    const inputRef = useRef<HTMLInputElement>(null);
    const didMountPathRef = useRef(false);
    const isExpandable = mobileMode === 'expandable';
    const isOpen = !isExpandable || isExpanded || Boolean(localValue);
    const isCompact = size === 'compact';
    const isNav = appearance === 'nav';
    const heightClass = isCompact ? (isNav ? 'h-9' : 'h-10') : 'h-11';
    const collapsedWidthClass = isCompact ? (isNav ? 'w-9' : 'w-10') : 'w-11';
    const showClearButton = isOpen && (Boolean(localValue) || (isNav && isExpandable));
    const hiddenInputClass = expandOn === 'all'
        ? 'pointer-events-none absolute inset-0 opacity-0'
        : 'pointer-events-none absolute inset-0 opacity-0 sm:pointer-events-auto sm:static sm:opacity-100';

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onClearRef.current = onClear;
    }, [onClear]);

    useEffect(() => {
        // Keep the debounced local input synchronized with controlled route/query state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalValue(value);
        prevDebouncedValueRef.current = value;
    }, [value]);

    useEffect(() => {
        if (!didMountPathRef.current) {
            didMountPathRef.current = true;
            return;
        }
        // Route changes intentionally clear the transient search text.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalValue('');
        if (isExpandable) setIsExpanded(false);
    }, [isExpandable, pathname]);

    // Trigger parent onChange only when debounced value changes. This is to prevent the parent component from re-rendering unnecessarily.
    useEffect(() => {
        if (debouncedValue !== prevDebouncedValueRef.current) {
            prevDebouncedValueRef.current = debouncedValue;
            onChangeRef.current(debouncedValue);
        }
    }, [debouncedValue]);

    const clearSearch = () => {
        setLocalValue('');
        prevDebouncedValueRef.current = '';
        onChangeRef.current('');
        onClearRef.current?.();
        if (isExpandable && isNav) {
            setIsExpanded(false);
        } else if (isExpandable) {
            inputRef.current?.focus();
        }
    };

    const expandSearch = () => {
        setIsExpanded(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    return (
        <div
            className={cn(
                'relative group min-w-0 transition-[width] duration-200 ease-out',
                isExpandable && expandOn === 'mobile' && `${collapsedWidthClass} max-w-full sm:w-full`,
                isExpandable && expandOn === 'all' && `${collapsedWidthClass} max-w-[calc(100vw-1.5rem)]`,
                isExpandable && isOpen && (expandedClassName || (expandOn === 'all' ? 'w-72 sm:w-80' : 'w-full')),
                className,
            )}
            role="search"
            onBlurCapture={(event) => {
                if (!isExpandable) return;
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                if (!localValue) setIsExpanded(false);
            }}
        >
            {isExpandable && !isOpen && (
                <button
                    type="button"
                    onClick={expandSearch}
                    className={cn(
                        'flex items-center justify-center transition-colors focus-visible:outline-none',
                        heightClass,
                        collapsedWidthClass,
                        isNav
                            ? 'relative rounded-full text-primary/80 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/20'
                            : 'rounded-md border border-border bg-input text-muted-foreground shadow-xs hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30',
                        expandOn === 'mobile' && 'sm:hidden',
                    )}
                    aria-label={ariaLabel || placeholder}
                    title={placeholder}
                >
                    <Search className="h-4.5 w-4.5" aria-hidden="true" />
                </button>
            )}
            <input
                ref={inputRef}
                type="text"
                className={cn(
                    'block w-full border border-border text-sm font-medium text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                    heightClass,
                    isNav
                        ? 'rounded-full bg-card/95 pl-9 pr-9'
                        : 'rounded-md bg-card pl-10 pr-10',
                    isExpandable && !isOpen && hiddenInputClass,
                )}
                placeholder={placeholder}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onFocus={() => {
                    if (isExpandable) setIsExpanded(true);
                }}
                aria-label={ariaLabel || placeholder}
                tabIndex={isExpandable && !isOpen ? -1 : undefined}
            />
            <div className={cn(
                'pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center',
                isNav ? 'pl-3' : 'pl-3.5',
                isExpandable && !isOpen && (expandOn === 'all' ? 'hidden' : 'hidden sm:flex'),
            )}>
                <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden="true" />
            </div>
            {showClearButton && (
                <button
                    type="button"
                    onClick={clearSearch}
                    className={cn(
                        'absolute inset-y-0 right-0 z-20 flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                        isNav ? 'w-9 rounded-r-full text-foreground' : 'w-10 rounded-r-md',
                    )}
                    aria-label={localValue ? 'Clear search' : 'Close search'}
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
