import { Search, Bell, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'
import { useSystemInfo } from '@/hooks/useDocker'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function Header() {
  const queryClient = useQueryClient()
  const { searchQuery, setSearchQuery } = useAppStore()
  const { data: systemInfo } = useSystemInfo()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <header className="h-16 bg-background-secondary border-b border-border flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Tìm kiếm containers, images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full pl-10"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Docker info */}
        {systemInfo && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary border border-border">
            <div className="w-2 h-2 rounded-full bg-status-running animate-pulse" />
            <span className="text-sm text-text-secondary">
              Docker {systemInfo.dockerVersion}
            </span>
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-background-hover transition-colors"
          title="Làm mới dữ liệu"
        >
          <RefreshCw
            className={cn('w-5 h-5', isRefreshing && 'animate-spin')}
          />
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-background-hover transition-colors relative"
          title="Thông báo"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
        </button>
      </div>
    </header>
  )
}


