import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Container,
  Image,
  Network,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Anchor,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/containers', icon: Container, label: 'Containers' },
  { to: '/images', icon: Image, label: 'Images' },
  { to: '/networks', icon: Network, label: 'Networks' },
  { to: '/volumes', icon: HardDrive, label: 'Volumes' },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-background-secondary border-r border-border transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-20'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-teal flex items-center justify-center shadow-glow">
            <Anchor className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in">
              <h1 className="text-xl font-bold text-gradient">AppDock</h1>
              <p className="text-xs text-text-muted">Quản lý Docker</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
        className="absolute -right-3 top-20 w-6 h-6 bg-background-secondary border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-colors"
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
              Phiên bản 1.0.0
            </p>
          </div>
        </div>
      )}
    </aside>
  )
}


