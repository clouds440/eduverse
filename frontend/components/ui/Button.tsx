import * as React from "react"
import { useGlobal } from "@/context/GlobalContext"
import { useAccess } from "@/hooks/useAccess"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean
    loadingText?: string
    loadingId?: string
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'black'
    icon?: React.ElementType
    px?: string
    py?: 'py-2.5' | string;
    requireWrite?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, isLoading: localIsLoading, loadingId, loadingText, variant = 'primary', children, disabled, icon, px = 'px-6', py = 'py-3', requireWrite, ...props }, ref) => {
        const { state } = useGlobal();
        const { canWrite } = useAccess();

        // Determine effective loading/disabled state
        const isThisButtonProcessing = loadingId ? state.ui.processing[loadingId] : false;
        const accessDisabled = requireWrite && !canWrite;
        const effectiveDisabled = disabled || isThisButtonProcessing || localIsLoading || accessDisabled;

        // Only show spinner if local loading is true OR this specific button is processing
        const effectiveLoading = localIsLoading || isThisButtonProcessing;

        let variantClasses = "";
        if (variant === 'primary') {
            variantClasses = "bg-primary text-white hover:bg-primary/80 disabled:bg-primary/50 focus:ring-1 focus:ring-primary/30";
        } else if (variant === 'secondary') {
            variantClasses = "bg-neutral/30 text-foreground border border-border hover:bg-neutral/60 disabled:bg-neutral/30 disabled:text-muted-foreground focus:ring-1 focus:ring-neutral/20";
        } else if (variant === 'danger') {
            variantClasses = "bg-danger text-white border-danger hover:bg-danger/80 disabled:bg-danger/60 focus:ring-1 focus:ring-danger/30";
        } else if (variant === 'success') {
            variantClasses = "bg-success text-white border-success hover:bg-success/80 disabled:bg-success/60 focus:ring-1 focus:ring-success/30";
        } else if (variant === 'warning') {
            variantClasses = "bg-warning text-white border-warning hover:bg-warning/80 disabled:bg-warning/60 focus:ring-1 focus:ring-warning/30";
        } else if (variant === 'black') {
            variantClasses = "bg-foreground text-white border border-border/50 hover:bg-black/80 hover:text-white disabled:bg-black/60 disabled:opacity-70 focus:ring-1 focus:ring-foreground/20";
        }

        return (
            <button
                className={`
          group relative flex justify-center items-center space-x-3
          rounded-2xl border border-transparent ${px} ${py} text-base font-bold
          focus:outline-none focus:ring-4
          transition-all duration-300 shadow-lg
          ${variantClasses}
          ${effectiveDisabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}
          ${className || ''}
        `}
                disabled={effectiveDisabled}
                ref={ref}
                title={accessDisabled ? "You do not have permission to perform this action (Read-only mode)" : props.title}
                {...props}
            >
                {effectiveLoading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {loadingText && <span>{loadingText}</span>}
                    </>
                ) : (
                    <>
                        {icon && (
                            <div className="w-5 h-5 shrink-0">
                                {React.createElement(icon, { className: "w-full h-full" })}
                            </div>
                        )}
                        {children && <span>{children}</span>}
                    </>
                )}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button }
