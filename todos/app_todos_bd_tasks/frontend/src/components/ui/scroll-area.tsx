import * as React from 'react'

export interface ScrollAreaProps {
  children?: React.ReactNode
  className?: string
}

export function ScrollArea({ children, className = '' }: ScrollAreaProps) {
  return (
    <div className={`overflow-auto ${className}`}>
      {children}
    </div>
  )
}