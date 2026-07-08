"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AISuggestedQuestion } from "@/types";
import { cn } from "@/lib/utils";

interface AISuggestedPromptsProps {
  suggestions: AISuggestedQuestion[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function AISuggestedPrompts({
  suggestions,
  onSelect,
  disabled,
}: AISuggestedPromptsProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  if (suggestions.length === 0) return null;
  const visibleSuggestions = suggestions.slice(0, 3);
  const scrollBy = (direction: -0.5 | 0.5) => {
    scrollRef.current?.scrollBy({
      left: direction * Math.max(180, scrollRef.current.clientWidth * 0.72),
      behavior: "smooth",
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={() => scrollBy(-0.5)}
        disabled={disabled || visibleSuggestions.length <= 1}
        aria-label="Previous suggested question"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground shadow-xs transition-colors hover:border-primary/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto scroll-smooth py-0 scrollbar-none"
      >
        {visibleSuggestions.map((suggestion, i) => (
          <button
            key={suggestion.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion.prompt)}
            className={cn(
              "shrink-0 max-w-fit rounded-full cursor-pointer border border-border/70 bg-background/80 px-3 py-1.5 text-left text-xs font-bold leading-5 text-foreground shadow-xs transition-colors",
              "hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:pointer-events-none disabled:opacity-50",
              i === 0
                ? "bg-success/5 text-success"
                : i === 1
                  ? "bg-warning/5 text-warning"
                  : "bg-danger/5 text-danger",
            )}
          >
            <span className="block truncate min-w-fit">
              {suggestion.prompt}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(0.5)}
        disabled={disabled || visibleSuggestions.length <= 1}
        aria-label="Next suggested question"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground shadow-xs transition-colors hover:border-primary/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
