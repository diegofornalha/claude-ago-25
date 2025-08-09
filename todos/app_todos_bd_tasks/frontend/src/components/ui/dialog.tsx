import * as React from 'react'

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ 
  children, 
  className = '' 
}: { 
  children?: React.ReactNode
  className?: string 
}) {
  return (
    <div className={`bg-background rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  )
}

export function DialogHeader({ children }: { children?: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>
}

export function DialogTitle({ children }: { children?: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>
}

export function DialogDescription({ children }: { children?: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}