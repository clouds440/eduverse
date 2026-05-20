'use client';

import { useRef } from 'react';

interface VerificationCodeInputProps {
    value: string;
    onChange: (value: string) => void;
    length?: number;
    disabled?: boolean;
    error?: boolean;
    autoFocus?: boolean;
    id?: string;
}

export function VerificationCodeInput({
    value,
    onChange,
    length = 6,
    disabled = false,
    error = false,
    autoFocus = false,
    id,
}: VerificationCodeInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const digits = Array.from({ length }, (_, index) => value[index] || '');

    return (
        <div className="relative w-full max-w-xs" onClick={() => inputRef.current?.focus()}>
            <input
                ref={inputRef}
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, length))}
                onPaste={(event) => {
                    event.preventDefault();
                    onChange(event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length));
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={length}
                disabled={disabled}
                autoFocus={autoFocus}
                aria-label="Verification code"
                className="absolute inset-0 h-full w-full opacity-0 cursor-text disabled:cursor-not-allowed"
            />
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {digits.map((digit, index) => (
                    <div
                        key={index}
                        className={`
                            h-11 sm:h-12 rounded-xl border bg-background/70 text-center text-lg sm:text-xl font-black
                            flex items-center justify-center shadow-sm transition-all
                            ${error ? 'border-danger ring-2 ring-danger/15' : 'border-warning/40'}
                            ${disabled ? 'opacity-60' : 'hover:border-warning'}
                        `}
                    >
                        {digit || <span className="text-muted-foreground/30">-</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
