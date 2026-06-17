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
}

export function SearchBar({ value, onChange, placeholder = 'Search...', delay = 500, className, ariaLabel, mobileMode = 'full' }: SearchBarProps) {
    const [localValue, setLocalValue] = useState(value);
    const debouncedValue = useDebounce(localValue, delay);
    const pathname = usePathname();
    const [prevValue, setPrevValue] = useState(value);
    const [prevPathname, setPrevPathname] = useState(pathname);
    const [isExpanded, setIsExpanded] = useState(false);
    const prevDebouncedValueRef = useRef(debouncedValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const isExpandable = mobileMode === 'expandable';
    const isOpen = !isExpandable || isExpanded || Boolean(localValue);

    // Sync from parent prop or route change in render (React Compiler preferred pattern)
    if (value !== prevValue || pathname !== prevPathname) {
        setPrevValue(value);
        setPrevPathname(pathname);
        const newValue = pathname !== prevPathname ? '' : value;
        setLocalValue(newValue);
    }

    // Trigger parent onChange only when debounced value changes. This is to prevent the parent component from re-rendering unnecessarily.
    useEffect(() => {
        if (debouncedValue !== prevDebouncedValueRef.current) {
            prevDebouncedValueRef.current = debouncedValue;
            onChange(debouncedValue);
        }
    }, [debouncedValue, onChange]);

    const clearSearch = () => {
        setLocalValue('');
        prevDebouncedValueRef.current = '';
        onChange('');
        if (isExpandable) {
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
                isExpandable && 'w-11 max-w-full sm:w-full',
                isExpandable && isOpen && 'w-full',
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
                    className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-input text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:hidden"
                    aria-label={ariaLabel || placeholder}
                    title={placeholder}
                >
                    <Search className="h-4 w-4" aria-hidden="true" />
                </button>
            )}
            <input
                ref={inputRef}
                type="text"
                className={cn(
                    'block h-11 w-full rounded-md border border-border bg-input pl-10 pr-10 text-sm font-medium text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                    isExpandable && !isOpen && 'pointer-events-none absolute inset-0 opacity-0 sm:pointer-events-auto sm:static sm:opacity-100',
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
                'pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5',
                isExpandable && !isOpen && 'hidden sm:flex',
            )}>
                <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden="true" />
            </div>
            {localValue && isOpen && (
                <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Clear search"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
