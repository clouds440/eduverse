import * as React from "react"
import { cn } from "@/lib/utils"

type LabelSize = 'sm' | 'md'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    size?: LabelSize;
    required?: boolean;
}

const sizeClasses: Record<LabelSize, string> = {
    sm: "text-xs",
    md: "text-sm",
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ className, children, size = 'md', required, ...props }, ref) => {
        return (
            <label
                ref={ref}
                className={cn(
                    "mb-1.5 block font-medium leading-none text-foreground/75 transition-colors hover:text-foreground",
                    sizeClasses[size],
                    className,
                )}
                {...props}
            >
                {children}
                {required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}
            </label>
        )
    }
)
Label.displayName = "Label"

export { Label }
