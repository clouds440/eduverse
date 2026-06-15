'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SECTION_COLOR_PALETTE } from '@/lib/utils';

interface ColorSelectorProps {
    value: string;
    onChange: (color: string) => void;
    ariaLabelPrefix?: string;
}

const INITIAL_VISIBLE_COUNT = 8;

export function ColorSelector({ value, onChange, ariaLabelPrefix = 'color' }: ColorSelectorProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const visibleColors = isExpanded
        ? SECTION_COLOR_PALETTE
        : SECTION_COLOR_PALETTE.slice(0, INITIAL_VISIBLE_COUNT);

    return (
        <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2 p-1.5 border border-border/70 rounded-xl bg-background/50 transition-all">
                {visibleColors.map((color) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => onChange(color)}
                        className={`h-8 w-8 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                            value === color
                                ? 'scale-115 border-foreground ring-2 ring-primary/30'
                                : 'border-border/70 hover:scale-105 hover:border-border-foreground'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Use ${ariaLabelPrefix} ${color}`}
                        aria-pressed={value === color}
                    />
                ))}
            </div>
            
            {SECTION_COLOR_PALETTE.length > INITIAL_VISIBLE_COUNT && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 focus-visible:outline-none transition-colors"
                >
                    {isExpanded ? (
                        <>
                            <span>Less</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                        </>
                    ) : (
                        <>
                            <span>More</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
