import * as React from 'react'

import { cn } from '../../lib/utils'

interface ConnectionPromptProps {
  action: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const ConnectionPrompt = React.forwardRef<HTMLDivElement, ConnectionPromptProps>(
  ({ action, className, size = 'md' }, ref) => {
    const sizeClasses = {
      sm: 'p-2 text-xs',
      md: 'p-4 text-sm',
      lg: 'p-6 text-base'
    }

    return (
      <div
        ref={ref}
        className={cn(
          'bg-muted border border-border rounded text-muted-foreground flex items-center justify-center gap-2 shadow-sm',
          sizeClasses[size],
          className
        )}
      >
        <span>Connect to Premiere Pro to {action}</span>
      </div>
    )
  }
)

ConnectionPrompt.displayName = 'ConnectionPrompt'

export { ConnectionPrompt }
