import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('shimmer rounded-lg', className)}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-background-tertiary p-4">
        <Skeleton className="h-4 w-full" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 border-t border-border">
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  )
}


