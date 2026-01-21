import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format bytes to human readable
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Format Unix timestamp to relative time in Vietnamese
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'Vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} tháng trước`
  return `${Math.floor(diff / 31536000)} năm trước`
}

// Format date to Vietnamese format
export function formatDate(date: string | number): string {
  const d = new Date(typeof date === 'number' ? date * 1000 : date)
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Truncate string with ellipsis
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

// Get status color class
export function getStatusColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'running':
      return 'badge-running'
    case 'exited':
    case 'stopped':
      return 'badge-stopped'
    case 'paused':
      return 'badge-paused'
    default:
      return 'badge bg-text-muted/20 text-text-muted'
  }
}

// Get status text in Vietnamese
export function getStatusText(state: string): string {
  switch (state.toLowerCase()) {
    case 'running':
      return 'Đang chạy'
    case 'exited':
    case 'stopped':
      return 'Đã dừng'
    case 'paused':
      return 'Tạm dừng'
    case 'created':
      return 'Đã tạo'
    case 'restarting':
      return 'Đang khởi động lại'
    default:
      return state
  }
}


