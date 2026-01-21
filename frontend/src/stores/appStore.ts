import { create } from 'zustand'

// Tab types
export type TabType = 'logs' | 'terminal'

export interface Tab {
  id: string
  type: TabType
  containerId: string
  containerName: string
  title: string
}

interface AppState {
  // Sidebar state
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Search state
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Selected items (for bulk actions)
  selectedContainers: string[]
  toggleContainerSelection: (id: string) => void
  clearContainerSelection: () => void
  selectAllContainers: (ids: string[]) => void

  // Toast notifications
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // Tabs management
  tabs: Tab[]
  activeTabId: string | null
  tabsPanelOpen: boolean
  tabsPanelHeight: number
  openTab: (containerId: string, containerName: string, type: TabType) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  toggleTabsPanel: () => void
  setTabsPanelHeight: (height: number) => void
  closeAllTabs: () => void
}

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
}

export const useAppStore = create<AppState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Selected containers
  selectedContainers: [],
  toggleContainerSelection: (id) =>
    set((state) => ({
      selectedContainers: state.selectedContainers.includes(id)
        ? state.selectedContainers.filter((cid) => cid !== id)
        : [...state.selectedContainers, id],
    })),
  clearContainerSelection: () => set({ selectedContainers: [] }),
  selectAllContainers: (ids) => set({ selectedContainers: ids }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Tabs
  tabs: [],
  activeTabId: null,
  tabsPanelOpen: false,
  tabsPanelHeight: 350,

  openTab: (containerId, containerName, type) =>
    set((state) => {
      // Check if tab already exists
      const existingTab = state.tabs.find(
        (t) => t.containerId === containerId && t.type === type
      )
      if (existingTab) {
        return {
          activeTabId: existingTab.id,
          tabsPanelOpen: true,
        }
      }

      // Create new tab
      const newTab: Tab = {
        id: `${containerId}-${type}-${Date.now()}`,
        type,
        containerId,
        containerName,
        title: `${type === 'logs' ? '📋' : '💻'} ${containerName}`,
      }

      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
        tabsPanelOpen: true,
      }
    }),

  closeTab: (tabId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTabId

      // If closing active tab, switch to another
      if (state.activeTabId === tabId) {
        const closedIndex = state.tabs.findIndex((t) => t.id === tabId)
        if (newTabs.length > 0) {
          newActiveId = newTabs[Math.min(closedIndex, newTabs.length - 1)].id
        } else {
          newActiveId = null
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
        tabsPanelOpen: newTabs.length > 0,
      }
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  toggleTabsPanel: () =>
    set((state) => ({ tabsPanelOpen: !state.tabsPanelOpen })),

  setTabsPanelHeight: (height) => set({ tabsPanelHeight: height }),

  closeAllTabs: () =>
    set({ tabs: [], activeTabId: null, tabsPanelOpen: false }),
}))


