import { ReactNode } from 'react'
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
  const tabs = useAppStore((state) => state.tabs)
  const tabsPanelOpen = useAppStore((state) => state.tabsPanelOpen)
  const tabsPanelHeight = useAppStore((state) => state.tabsPanelHeight)
  const { data: dockerStatus } = useDockerStatus()
  
  const dockerAvailable = dockerStatus?.connected ?? true

  // Calculate bottom padding when tabs panel is open
  const bottomPadding = tabs.length > 0 ? (tabsPanelOpen ? tabsPanelHeight : 40) : 0

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-20'
        )}
      >
        {/* Docker Offline Banner */}
        {!dockerAvailable && (
          <div className="bg-status-stopped/10 border-b border-status-stopped/30 px-6 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-status-stopped flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-status-stopped">
                Docker is not running
              </span>
              <span className="text-sm text-text-muted ml-2">
                - Container, image, network, and volume operations are unavailable. System stats (CPU, RAM, Disk) are still working.
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <Header />

        {/* Page content */}
        <main 
          className="flex-1 overflow-auto p-6 transition-all duration-200"
          style={{ paddingBottom: bottomPadding + 24 }}
        >
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Tabs Panel */}
      <TabsPanel />
    </div>
  )
}


