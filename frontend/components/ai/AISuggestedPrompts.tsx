'use client';

import { AISuggestedQuestion } from '@/types';
import { cn } from '@/lib/utils';

interface AISuggestedPromptsProps {
    suggestions: AISuggestedQuestion[];
    onSelect: (prompt: string) => void;
    disabled?: boolean;
    loading?: boolean;
}

export function AISuggestedPrompts({ suggestions, onSelect, disabled }: AISuggestedPromptsProps) {
    if (suggestions.length === 0) return null;

    return (
        <div className="flex max-h-[22svh] flex-wrap gap-2 overflow-y-auto pr-0.5 custom-scrollbar">
            {suggestions.slice(0, 3).map((suggestion) => (
                <button
                    key={suggestion.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(suggestion.prompt)}
                    className={cn(
                        'min-w-0 max-w-full rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-left text-xs font-bold leading-5 text-foreground shadow-xs transition-colors',
                        'hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        'disabled:pointer-events-none disabled:opacity-50',
                    )}
                >
                    <span className="line-clamp-2">{suggestion.prompt}</span>
                </button>
            ))}
        </div>
    );
}
