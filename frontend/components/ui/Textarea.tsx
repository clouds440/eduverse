import * as React from 'react'
import { LucideIcon } from 'lucide-react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: LucideIcon;
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, icon: Icon, error, ...props }, ref) => {
    return (
      <div className="relative group">
        {Icon && (
          <div className={`absolute top-3 sm:top-3.5 left-0 pl-3 sm:pl-3.5 flex items-start pointer-events-none transition-colors ${error ? 'text-destructive' : 'text-muted-foreground group-focus-within:text-primary'}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 focus:text-primary z-30" />
          </div>
        )}
        <textarea
          ref={ref}
          {...props}
          className={`w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 rounded-xl border bg-linear-to-br from-card/90 to-card/80 backdrop-blur-xl text-foreground placeholder:text-muted-foreground transition-all duration-200 shadow-sm resize-none outline-none min-h-24 sm:min-h-30 text-sm sm:text-base ${error ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50 focus:bg-card focus:border-primary/60 focus:ring-2 focus:ring-primary/20'} ${className || ''}`}
        />
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
