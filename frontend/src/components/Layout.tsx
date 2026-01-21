import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { TabsPanel } from './TabsPanel'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const tabs = useAppStore((state) => state.tabs)
  const tabsPanelOpen = useAppStore((state) => state.tabsPanelOpen)
  const tabsPanelHeight = useAppStore((state) => state.tabsPanelHeight)

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


