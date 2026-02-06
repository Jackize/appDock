import { Search, Bell, RefreshCw, User, LogOut, ChevronDown, Key, X, Loader2, Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useSystemInfo } from '@/hooks/useDocker'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { authAPI } from '@/services/api'

export function Header() {
  const queryClient = useQueryClient()
  const { searchQuery, setSearchQuery, addToast } = useAppStore()
  const { user, authEnabled, logout } = useAuthStore()
  const { data: systemInfo } = useSystemInfo()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
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

  const openPasswordModal = () => {
    setShowUserMenu(false)
    setShowPasswordModal(true)
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordError('')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    // Validate
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới không khớp')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    setIsChangingPassword(true)

    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      
      setShowPasswordModal(false)
      addToast({
        title: 'Đổi mật khẩu thành công',
        variant: 'success',
      })
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Đã xảy ra lỗi')
    } finally {
      setIsChangingPassword(false)
    }
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
                  onClick={openPasswordModal}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-background-hover transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Đổi mật khẩu
                </button>
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

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background-secondary rounded-xl border border-border w-full max-w-md mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">Đổi mật khẩu</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 rounded-lg bg-status-stopped/10 border border-status-stopped/20 text-sm text-status-stopped">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Mật khẩu hiện tại
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-5 h-5 text-text-muted pointer-events-none z-10" />
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="input w-full !pl-11"
                    placeholder="Nhập mật khẩu hiện tại"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative flex items-center">
                  <Key className="absolute left-3 w-5 h-5 text-text-muted pointer-events-none z-10" />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="input w-full !pl-11"
                    placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative flex items-center">
                  <Key className="absolute left-3 w-5 h-5 text-text-muted pointer-events-none z-10" />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="input w-full !pl-11"
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn-secondary flex-1"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    'Đổi mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}


