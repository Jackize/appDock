import { Search, Bell, RefreshCw, User, LogOut, ChevronDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useSystemInfo } from '@/hooks/useDocker'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Header() {
  const queryClient = useQueryClient()
  const { searchQuery, setSearchQuery } = useAppStore()
  const { user, authEnabled, logout } = useAuthStore()
  const { data: systemInfo } = useSystemInfo()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

        {/* User menu - only show if auth is enabled */}
        {authEnabled && user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary border border-border hover:border-accent/50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                <User className="w-4 h-4 text-accent" />
              </div>
              <span className="text-sm text-text-primary font-medium">
                {user.username}
              </span>
              <ChevronDown className={cn(
                'w-4 h-4 text-text-muted transition-transform',
                showUserMenu && 'rotate-180'
              )} />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 py-1 rounded-lg bg-background-secondary border border-border shadow-lg z-50">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-sm text-text-muted">Đăng nhập với</p>
                  <p className="text-sm font-medium text-text-primary">{user.username}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-status-stopped hover:bg-background-hover transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}


