'use client';

import { forwardRef, type ReactNode } from 'react';

interface ToggleProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    description?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    onColor?: string;
    offColor?: string;
    knobColor?: string;
    className?: string;
    textColor?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
    (
        {
            checked,
            onCheckedChange,
            disabled = false,
            label,
            description,
            size = 'md',
            onColor = 'bg-primary',
            offColor = 'bg-slate-700',
            knobColor = 'bg-white',
            className = '',
            textColor = 'text-foreground',
        },
        ref
    ) => {
        const sizeClasses = {
            sm: 'h-4 w-8',
            md: 'h-5 w-10',
            lg: 'h-6 w-12',
        };

        const knobSizeClasses = {
            sm: 'h-2.5 w-2.5',
            md: 'h-3.5 w-3.5',
            lg: 'h-4.5 w-4.5',
        };

        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <button
                    ref={ref}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={disabled}
                    onClick={() => !disabled && onCheckedChange(!checked)}
                    className={`
                        relative inline-flex items-center rounded-full transition-all duration-300
                        shrink-0
                        ${sizeClasses[size]}
                        ${checked ? onColor : offColor}
                        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
                        focus:outline-none focus:ring-2 focus:ring-primary/20
                    `}
                >
                    <span
                        className={`
                            absolute top-1/2 rounded-full transition-all duration-300 shadow-md
                            ${knobSizeClasses[size]}
                            ${knobColor}
                        `}
                        style={{
                            left: checked ? 'calc(100% - 3px)' : '3px',
                            transform: `translate(${checked ? '-100%' : '0'}, -50%)`,
                        }}
                    />
                </button>
                {(label || description) && (
                    <div className="flex flex-col min-w-0">
                        {label && (
                            <span className={`text-[11px] md:text-base font-bold ${textColor} tracking-tight leading-tight truncate`}>
                                {label}
                            </span>
                        )}
                        {description && (
                            <span className="text-[10px] md:text-sm max-w-auto text-muted-foreground leading-tight">
                                {description}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }
);

Toggle.displayName = 'Toggle';
