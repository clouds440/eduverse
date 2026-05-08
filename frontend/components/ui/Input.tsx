import * as React from "react"
import { LucideIcon, Eye, EyeOff } from "lucide-react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: LucideIcon;
    error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon: Icon, error, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false);
        const isPassword = type === 'password';
        const inputType = isPassword && showPassword ? 'text' : type;

        return (
            <div className="relative group">
                {Icon && (
                    <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none input-icon-container z-10 ${error ? 'input-icon-error' : ''}`}>
                        <Icon className="h-5 w-5 stroke-primary" />
                    </div>
                )}
                <input
                    type={inputType}
                    className={`
            block w-full rounded-2xl border bg-input
            ${Icon ? 'pl-11' : 'pl-4'} ${isPassword ? 'pr-12' : 'pr-4'} py-3
            text-card-foreground placeholder:text-muted-foreground
            transition-all duration-200 shadow-sm outline-none sm:text-sm
            ${error
                            ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5 focus:border-primary focus:ring-primary/20'
                            : 'border-border focus:bg-input focus:border-primary focus:ring-2 focus:ring-primary/20'
                        }
            ${className || ''}
          `}
                    ref={ref}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showPassword ? <EyeOff className="h-5 w-5 text-primary" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                    </button>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
