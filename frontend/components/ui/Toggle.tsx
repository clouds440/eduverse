'use client';

import { forwardRef } from 'react';

interface ToggleProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    description?: string;
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
            onColor = 'bg-primary/70',
            offColor = 'bg-primary/20',
            knobColor = 'bg-muted-foreground',
            className = '',
            textColor = 'text-foreground',
        },
        ref
    ) => {
        const sizeClasses = {
            sm: 'h-5 w-9',
            md: 'h-6 w-11',
            lg: 'h-7 w-14',
        };

        const knobSizeClasses = {
            sm: 'h-3 w-3',
            md: 'h-4 w-4',
            lg: 'h-5 w-5',
        };

        const knobTranslateClasses = {
            sm: checked ? 'translate-x-5' : 'translate-x-1',
            md: checked ? 'translate-x-6' : 'translate-x-1',
            lg: checked ? 'translate-x-8' : 'translate-x-1',
        };

        return (
            <div className={`flex items-center w-auto gap-3 ${className}`}>
                <button
                    ref={ref}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={disabled}
                    onClick={() => !disabled && onCheckedChange(!checked)}
                    className={`
                        relative inline-flex items-center rounded-full transition-colors
                        focus:outline-none
                        ${sizeClasses[size]}
                        ${checked ? onColor : offColor}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                >
                    <span
                        className={`
                            inline-block transform rounded-full transition-transform
                            ${knobSizeClasses[size]}
                            ${knobColor}
                            ${knobTranslateClasses[size]}
                        `}
                    />
                </button>
                {(label || description) && (
                    <div className="flex flex-col">
                        {label && (
                            <span className={`text-xs font-bold ${textColor} tracking-wider`}>
                                {label}
                            </span>
                        )}
                        {description && (
                            <span className="text-[10px] text-muted-foreground">
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
