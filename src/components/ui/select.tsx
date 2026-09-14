import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Native <select> drawn in the app's own style: same height, radius, border and
 * focus ring as <Input>, with the browser's arrow replaced by our chevron
 * (`.select-chevron` in index.css).
 *
 * It stays a real <select>, so react-hook-form `register`, `value`/`onChange`
 * and keyboard behaviour all work exactly as before. To go back to the
 * browser's default look, drop `select-chevron appearance-none pr-9 …` here.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'select-chevron flex h-9 w-full cursor-pointer appearance-none truncate rounded-md border border-input bg-background pl-3 pr-9 py-1 text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input [&_option]:bg-background [&_option]:text-foreground',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
