import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    delay?: number;
    className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...', delay = 500, className }: SearchBarProps) {
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

    return (
        <div className={cn("relative group", className)}>
            <input
                type="text"
                className="block w-full pl-11 pr-4 h-12 bg-linear-to-br from-card/90 via-card/80 to-card/90 backdrop-blur-xl border border-border/50 rounded-2xl text-sm md:text-base font-semibold text-foreground placeholder-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/60 focus:bg-card transition-all duration-300 shadow-lg"
                placeholder={placeholder}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Search className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
        </div>
    );
}
