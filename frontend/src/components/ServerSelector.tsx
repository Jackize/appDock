import { useState, useRef, useEffect } from 'react'
import { Server, ChevronDown, Check, Wifi, WifiOff, Monitor } from 'lucide-react'
import { useServerStore } from '@/stores/serverStore'
import { useServers } from '@/hooks/useDocker'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

export function ServerSelector() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { servers, currentServerId, setCurrentServer } = useServerStore()
  const currentServer = servers.find(s => s.id === currentServerId)

  // Fetch servers list
  useServers()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectServer = (serverId: string) => {
    if (serverId !== currentServerId) {
      setCurrentServer(serverId)
      // Invalidate all queries to refetch data for new server
      queryClient.invalidateQueries()
    }
    setIsOpen(false)
  }

  const getStatusIcon = (status: string, isLocal: boolean) => {
    if (isLocal) {
      return <Monitor className="w-3 h-3 text-accent" />
    }
    if (status === 'online') {
      return <Wifi className="w-3 h-3 text-status-running" />
    }
    return <WifiOff className="w-3 h-3 text-status-stopped" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-status-running'
      case 'offline': return 'bg-status-stopped'
      default: return 'bg-text-muted'
    }
  }

  if (servers.length <= 1) {
    return null
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-tertiary border border-border hover:border-accent/50 transition-colors"
      >
        <Server className="w-4 h-4 text-accent" />
        <span className="text-sm text-text-primary font-medium max-w-[120px] truncate">
          {currentServer?.name || 'Local'}
        </span>
        <div className={cn(
          'w-2 h-2 rounded-full',
          getStatusColor(currentServer?.status || 'online')
        )} />
        <ChevronDown className={cn(
          'w-4 h-4 text-text-muted transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 py-1 rounded-lg bg-background-secondary border border-border shadow-lg z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Chọn Server
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => handleSelectServer(server.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-background-hover transition-colors',
                  server.id === currentServerId && 'bg-accent/10'
                )}
              >
                {getStatusIcon(server.status, server.isLocal)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {server.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {server.isLocal ? 'Local Server' : server.host}
                  </p>
                </div>
                {server.id === currentServerId && (
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                )}
                {server.isDefault && server.id !== currentServerId && (
                  <span className="text-xs text-text-muted bg-background-tertiary px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
