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
}

export function SearchBar({ value, onChange, placeholder = 'Search...', delay = 500, className, ariaLabel }: SearchBarProps) {
    const [localValue, setLocalValue] = useState(value);
    const debouncedValue = useDebounce(localValue, delay);
    const pathname = usePathname();
    const [prevValue, setPrevValue] = useState(value);
    const [prevPathname, setPrevPathname] = useState(pathname);
    const prevDebouncedValueRef = useRef(debouncedValue);

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
    };

    return (
        <div className={cn("relative group", className)} role="search">
            <input
                type="text"
                className="block h-11 w-full rounded-md border border-border bg-input pl-10 pr-10 text-sm font-medium text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={placeholder}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                aria-label={ariaLabel || placeholder}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5">
                <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden="true" />
            </div>
            {localValue && (
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
