import * as React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type TextareaSize = 'sm' | 'md' | 'lg'
type TextareaVariant = 'default' | 'quiet'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: LucideIcon;
  error?: boolean;
  size?: TextareaSize;
  variant?: TextareaVariant;
}

const sizeClasses: Record<TextareaSize, string> = {
  sm: 'min-h-20 px-3 py-2 text-sm',
  md: 'min-h-24 px-3.5 py-2.5 text-sm',
  lg: 'min-h-30 px-4 py-3 text-base',
}

const iconPaddingClasses: Record<TextareaSize, string> = {
  sm: 'pl-9',
  md: 'pl-10',
  lg: 'pl-11',
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, icon: Icon, error, size = 'md', variant = 'default', disabled, ...props }, ref) => {
    return (
      <div className="relative group">
        {Icon && (
          <div
            className={cn(
              'pointer-events-none absolute left-0 top-3 z-10 flex items-start pl-3.5 transition-colors',
              error ? 'text-danger' : 'text-muted-foreground group-focus-within:text-primary',
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <textarea
          ref={ref}
          disabled={disabled}
          aria-invalid={error || undefined}
          {...props}
          className={cn(
            'w-full resize-none rounded-md border text-foreground placeholder:text-muted-foreground outline-none shadow-xs',
            'transition-colors duration-200 focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted/45 disabled:text-muted-foreground disabled:opacity-75',
            sizeClasses[size],
            Icon && iconPaddingClasses[size],
            variant === 'quiet' ? 'bg-transparent' : 'bg-input',
            error
              ? 'border-danger/70 bg-danger/5 ring-1 ring-danger/20 focus:border-danger focus:ring-danger/20'
              : 'border-border focus:border-primary focus:bg-input focus:ring-primary/20',
            className,
          )}
        />
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
