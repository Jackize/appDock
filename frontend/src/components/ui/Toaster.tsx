import { useEffect } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

const variantStyles = {
  default: 'bg-background-secondary border-border',
  success: 'bg-status-running/10 border-status-running/30',
  error: 'bg-status-stopped/10 border-status-stopped/30',
  warning: 'bg-status-paused/10 border-status-paused/30',
}

const variantIcons = {
  default: Info,
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
}

const variantColors = {
  default: 'text-accent',
  success: 'text-status-running',
  error: 'text-status-stopped',
  warning: 'text-status-paused',
}

export function Toaster() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

interface ToastProps {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  onClose: () => void
}

function Toast({ title, description, variant = 'default', onClose }: ToastProps) {
  const Icon = variantIcons[variant]

  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[320px] max-w-md animate-slide-up',
        variantStyles[variant]
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', variantColors[variant])} />
      <div className="flex-1">
        <p className="font-medium text-text-primary">{title}</p>
        {description && (
          <p className="text-sm text-text-secondary mt-1">{description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}


