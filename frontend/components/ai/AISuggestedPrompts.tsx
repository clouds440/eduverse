'use client';

import { AIPromptSuggestion } from '@/lib/ai';
import { cn } from '@/lib/utils';

interface AISuggestedPromptsProps {
    suggestions: AIPromptSuggestion[];
    onSelect: (prompt: string) => void;
    disabled?: boolean;
}

const toneClasses: Record<AIPromptSuggestion['tone'], string> = {
    primary: 'text-primary bg-primary/10 border-primary/20 hover:border-primary/35 hover:bg-primary/15',
    success: 'text-success bg-success/10 border-success/20 hover:border-success/35 hover:bg-success/15',
    warning: 'text-warning bg-warning/10 border-warning/25 hover:border-warning/40 hover:bg-warning/15',
    info: 'text-info bg-info/10 border-info/20 hover:border-info/35 hover:bg-info/15',
    neutral: 'text-foreground bg-card border-border/70 hover:border-primary/25 hover:bg-muted/50',
};

export function AISuggestedPrompts({ suggestions, onSelect, disabled }: AISuggestedPromptsProps) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {suggestions.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                    <button
                        key={suggestion.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(suggestion.prompt)}
                        className={cn(
                            'group flex min-h-20 min-w-0 flex-col justify-between rounded-lg border p-3 text-left shadow-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                            'disabled:pointer-events-none disabled:opacity-50',
                            toneClasses[suggestion.tone],
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
                        <span className="mt-3 text-sm font-black leading-tight text-foreground">{suggestion.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
