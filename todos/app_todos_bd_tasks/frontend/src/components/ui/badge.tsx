import * as React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

export function Badge({
  className = '',
  variant = 'default',
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'text-foreground border border-input',
    destructive: 'bg-destructive text-destructive-foreground',
  }

  return (
    <div
      className={`
        inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    />
  )
}