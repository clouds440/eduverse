import * as React from "react"
import { LucideIcon, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

type InputSize = 'sm' | 'md' | 'lg'
type InputVariant = 'default' | 'quiet'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    icon?: LucideIcon;
    error?: boolean;
    size?: InputSize;
    variant?: InputVariant;
}

const sizeClasses: Record<InputSize, string> = {
    sm: "h-9 py-2 text-sm",
    md: "h-11 py-2.5 text-sm",
    lg: "h-12 py-3 text-base",
}

const iconPaddingClasses: Record<InputSize, string> = {
    sm: "pl-9",
    md: "pl-10",
    lg: "pl-11",
}

const basePaddingClasses: Record<InputSize, string> = {
    sm: "pl-3 pr-3",
    md: "pl-3.5 pr-3.5",
    lg: "pl-4 pr-4",
}

const passwordPaddingClasses: Record<InputSize, string> = {
    sm: "pr-10",
    md: "pr-11",
    lg: "pr-12",
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon: Icon, error, size = 'md', variant = 'default', disabled, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);
        const isPassword = type === 'password';
        const inputType = isPassword && showPassword ? 'text' : type;
        const hasIcon = Boolean(Icon);

        return (
            <div className="relative group">
                {Icon && (
                    <div
                        className={cn(
                            "pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5 transition-colors",
                            error ? "text-danger" : "text-muted-foreground group-focus-within:text-primary",
                        )}
                    >
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <input
                    type={inputType}
                    className={cn(
                        "block w-full rounded-md border text-foreground placeholder:text-muted-foreground outline-none shadow-xs",
                        "transition-colors duration-200 focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:text-muted-foreground disabled:opacity-75",
                        sizeClasses[size],
                        hasIcon ? iconPaddingClasses[size] : basePaddingClasses[size],
                        isPassword && passwordPaddingClasses[size],
                        variant === 'quiet' ? "bg-transparent" : "bg-input",
                        error
                            ? "border-danger/70 bg-danger/5 ring-1 ring-danger/20 focus:border-danger focus:ring-danger/20"
                            : "border-border focus:border-primary focus:bg-input focus:ring-primary/20",
                        className,
                    )}
                    ref={ref}
                    disabled={disabled}
                    aria-invalid={error || undefined}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                        disabled={disabled}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
