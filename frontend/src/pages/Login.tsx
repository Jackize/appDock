import { useState } from 'react'
import { Container, Lock, User, Loader2, AlertCircle } from 'lucide-react'
import { authAPI } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { setToken } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authAPI.login({ username, password })
      setToken(response.token, response.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi đăng nhập')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent-teal/5 rounded-full blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-md">
        <div className="card p-8">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
              <Container className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              AppDock
            </h1>
            <p className="text-text-muted">
              Đăng nhập để quản lý Docker containers
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-status-stopped/10 border border-status-stopped/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-status-stopped flex-shrink-0 mt-0.5" />
              <p className="text-sm text-status-stopped">{error}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Tên đăng nhập
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-5 h-5 text-text-muted pointer-events-none z-10" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input w-full !pl-11"
                  placeholder="Nhập tên đăng nhập"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Mật khẩu
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-5 h-5 text-text-muted pointer-events-none z-10" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full !pl-11"
                  placeholder="Nhập mật khẩu"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Footer hint */}
          <p className="mt-6 text-center text-sm text-text-muted">
            Mặc định: admin / appdock
          </p>
        </div>

        {/* Version info */}
        <p className="mt-4 text-center text-xs text-text-muted">
          Docker Management Dashboard
        </p>
      </div>
    </div>
  )
}
