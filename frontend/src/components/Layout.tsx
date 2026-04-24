import { ReactNode, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { TabsPanel } from './TabsPanel'
import { useAppStore } from '@/stores/appStore'
import { useDockerStatus } from '@/hooks/useDocker'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const tabs = useAppStore((state) => state.tabs)
  const tabsPanelOpen = useAppStore((state) => state.tabsPanelOpen)
  const tabsPanelHeight = useAppStore((state) => state.tabsPanelHeight)
  const { data: dockerStatus } = useDockerStatus()
  
  const dockerAvailable = dockerStatus?.connected ?? true

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = () => setSidebarOpen(desktopQuery.matches)

    syncSidebar()

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', syncSidebar)
      return () => desktopQuery.removeEventListener('change', syncSidebar)
    }

    desktopQuery.addListener(syncSidebar)
    return () => desktopQuery.removeListener(syncSidebar)
  }, [setSidebarOpen])

  // Calculate bottom padding when tabs panel is open
  const bottomPadding = tabs.length > 0
    ? tabsPanelOpen
      ? `min(70dvh, ${tabsPanelHeight}px)`
      : '40px'
    : '0px'

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}
      >
        {/* Docker Offline Banner */}
        {!dockerAvailable && (
          <div className="flex flex-col gap-2 border-b border-status-stopped/30 bg-status-stopped/10 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <AlertTriangle className="w-5 h-5 text-status-stopped flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-status-stopped">
                Docker is not running
              </span>
              <span className="block text-sm text-text-muted sm:ml-2 sm:inline">
                - Container, image, network, and volume operations are unavailable. System stats (CPU, RAM, Disk) are still working.
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <Header />

        {/* Page content */}
        <main 
          className="flex-1 overflow-auto p-4 transition-all duration-200 sm:p-5 lg:p-6"
          style={{ paddingBottom: `calc(${bottomPadding} + 24px)` }}
        >
          <div className="mx-auto w-full max-w-[1600px] animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Tabs Panel */}
      <TabsPanel />
    </div>
  )
}
