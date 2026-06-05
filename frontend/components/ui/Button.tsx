'use client';

import * as React from "react"
import { Loader2 } from "lucide-react"
import { useGlobal } from "@/context/GlobalContext"
import { useAccess } from "@/hooks/useAccess"
import { cn } from "@/lib/utils"
import type { ButtonVariant } from "@/types"

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon'
type ButtonIconPosition = 'left' | 'right'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean
    loadingText?: string
    loadingId?: string
    variant?: ButtonVariant
    size?: ButtonSize
    icon?: React.ElementType<{ className?: string }>
    iconPosition?: ButtonIconPosition
    px?: string
    py?: 'py-2.5' | string;
    requireWrite?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover focus-visible:ring-primary/35",
    secondary: "border-border bg-surface-raised text-foreground shadow-xs hover:border-primary/35 hover:bg-muted/70 focus-visible:ring-primary/25",
    danger: "border-transparent bg-danger text-white shadow-xs hover:bg-danger/85 focus-visible:ring-danger/30",
    success: "border-transparent bg-success text-white shadow-xs hover:bg-success/85 focus-visible:ring-success/30",
    warning: "border-transparent bg-warning text-white shadow-xs hover:bg-warning/85 focus-visible:ring-warning/30",
    black: "border-border/50 bg-foreground text-background shadow-xs hover:bg-foreground/85 focus-visible:ring-foreground/25",
    ghost: "border-transparent bg-transparent text-foreground hover:bg-muted/65 focus-visible:ring-primary/25",
    outline: "border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-primary/25",
}

const sizeClasses: Record<ButtonSize, string> = {
    xs: "min-h-8 px-2.5 py-1.5 text-xs",
    sm: "min-h-9 px-3 py-2 text-sm",
    md: "min-h-11 px-4 py-2.5 text-sm",
    lg: "min-h-12 px-5 py-3 text-base",
    icon: "h-10 w-10 p-0 text-sm",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className,
        isLoading: localIsLoading,
        loadingId,
        loadingText,
        variant = 'primary',
        size = 'md',
        children,
        disabled,
        icon,
        iconPosition = 'left',
        px,
        py,
        requireWrite,
        title,
        'aria-label': ariaLabel,
        ...props
    }, ref) => {
        const { state } = useGlobal();
        const { canWrite } = useAccess();

        const isThisButtonProcessing = loadingId ? state.ui.processing[loadingId] : false;
        const accessDisabled = requireWrite && !canWrite;
        const effectiveDisabled = disabled || isThisButtonProcessing || localIsLoading || accessDisabled;
        const effectiveLoading = localIsLoading || isThisButtonProcessing;
        const Icon = icon;
        const hasVisibleLabel = effectiveLoading ? Boolean(loadingText) : React.Children.count(children) > 0;
        const accessibleLabel = ariaLabel ?? (typeof title === 'string' ? title : undefined);
        const showIconRight = Icon && iconPosition === 'right' && !effectiveLoading;
        const showIconLeft = Icon && iconPosition === 'left' && !effectiveLoading;
        const buttonTitle = accessDisabled
            ? "You do not have permission to perform this action (Read-only mode)"
            : title;

        return (
            <button
                className={cn(
                    "group relative inline-flex min-w-0 items-center justify-center gap-2 rounded-md border font-semibold leading-tight outline-none",
                    "transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:pointer-events-none disabled:opacity-55",
                    "active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
                    sizeClasses[size],
                    variantClasses[variant],
                    px,
                    py,
                    className,
                )}
                disabled={effectiveDisabled}
                ref={ref}
                title={buttonTitle}
                aria-label={!hasVisibleLabel ? accessibleLabel : ariaLabel}
                aria-busy={effectiveLoading || undefined}
                {...props}
            >
                {effectiveLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                        {loadingText && <span>{loadingText}</span>}
                        {!loadingText && <span className="sr-only">Loading</span>}
                    </>
                ) : (
                    <>
                        {showIconLeft && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        {children && <span className="min-w-0 text-center">{children}</span>}
                        {showIconRight && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </>
                )}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button }
