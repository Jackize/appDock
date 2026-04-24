import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Container,
  Image,
  Network,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  X,
  Anchor,
  Server,
  Settings,
  Users,
  FolderKanban,
  Package,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/registry-projects', icon: Package, label: 'Registry' },
  { to: '/containers', icon: Container, label: 'Containers' },
  { to: '/images', icon: Image, label: 'Images' },
  { to: '/networks', icon: Network, label: 'Networks' },
  { to: '/volumes', icon: HardDrive, label: 'Volumes' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/members', icon: Users, label: 'Members' },
  { to: '/settings', icon: Settings, label: 'Cài đặt' },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useAppStore()

  const closeOnMobile = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpen(false)
    }
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-[100dvh] flex-col overflow-visible border-r border-border bg-background-secondary transition-all duration-300',
        sidebarOpen
          ? 'w-72 translate-x-0 lg:w-64'
          : 'w-72 -translate-x-full lg:w-20 lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-teal flex items-center justify-center shadow-glow">
            <Anchor className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 animate-fade-in">
              <h1 className="text-xl font-bold text-gradient">AppDock</h1>
              <p className="text-xs text-text-muted">Quản lý Docker</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-background-hover hover:text-text-primary lg:hidden"
          aria-label="Đóng menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 pb-24">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeOnMobile}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'text-text-secondary hover:bg-background-hover hover:text-text-primary'
              )
            }
          >
            <item.icon
              className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                'group-hover:text-accent'
              )}
            />
            {sidebarOpen && (
              <span className="font-medium animate-fade-in">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background-secondary text-text-secondary shadow-lg transition-colors hover:border-accent hover:text-accent lg:flex"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Footer */}
      {sidebarOpen && (
        <div className="absolute bottom-4 left-4 right-4 animate-fade-in">
          <div className="p-3 rounded-lg bg-background-tertiary border border-border">
            <p className="text-xs text-text-muted text-center">
              Phiên bản {__APP_VERSION__}
            </p>
          </div>
        </div>
      )}
    </aside>
  )
}
