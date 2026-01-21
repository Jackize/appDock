import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'running' | 'stopped' | 'paused' | 'outline'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-accent/20 text-accent border-accent/30',
  running: 'bg-status-running/20 text-status-running border-status-running/30',
  stopped: 'bg-status-stopped/20 text-status-stopped border-status-stopped/30',
  paused: 'bg-status-paused/20 text-status-paused border-status-paused/30',
  outline: 'bg-transparent text-text-secondary border-border',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}


