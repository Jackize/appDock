import { useState } from 'react'
import { Network as NetworkIcon, Trash2, Plus, MoreVertical } from 'lucide-react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useNetworks, useRemoveNetwork, useCreateNetwork } from '@/hooks/useDocker'
import { useAppStore } from '@/stores/appStore'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import type { Network } from '@/types'

export function Networks() {
  const { data: networks, isLoading, error } = useNetworks()
  const searchQuery = useAppStore((state) => state.searchQuery)
  const [networkToDelete, setNetworkToDelete] = useState<Network | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newNetworkName, setNewNetworkName] = useState('')
  const [newNetworkDriver, setNewNetworkDriver] = useState('bridge')

  const removeMutation = useRemoveNetwork()
  const createMutation = useCreateNetwork()

  // Filter networks by search query
  const filteredNetworks = networks?.filter(
    (net) =>
      net.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      net.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = () => {
    if (networkToDelete) {
      removeMutation.mutate(networkToDelete.id, {
        onSuccess: () => setNetworkToDelete(null),
      })
    }
  }

  const handleCreate = () => {
    if (newNetworkName.trim()) {
      createMutation.mutate(
        { name: newNetworkName.trim(), driver: newNetworkDriver },
        {
          onSuccess: () => {
            setCreateDialogOpen(false)
            setNewNetworkName('')
            setNewNetworkDriver('bridge')
          },
        }
      )
    }
  }

  const getDriverBadge = (driver: string) => {
    switch (driver) {
      case 'bridge':
        return <Badge variant="default">bridge</Badge>
      case 'host':
        return <Badge variant="running">host</Badge>
      case 'overlay':
        return <Badge variant="paused">overlay</Badge>
      default:
        return <Badge variant="outline">{driver}</Badge>
    }
  }

  // System networks that should not be deleted
  const isSystemNetwork = (name: string) =>
    ['bridge', 'host', 'none'].includes(name)

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-stopped">Lỗi: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Networks</h1>
          <p className="text-text-secondary mt-1">
            Quản lý các Docker networks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            Tổng cộng: {networks?.length || 0} networks
          </span>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Tạo Network
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable />
      ) : filteredNetworks && filteredNetworks.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Network</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Subnet</TableHead>
              <TableHead>Containers</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNetworks.map((network) => (
              <TableRow key={network.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-teal/10 flex items-center justify-center">
                      <NetworkIcon className="w-5 h-5 text-accent-teal" />
                    </div>
                    <div>
                      <p className="font-medium">{network.name}</p>
                      <p className="text-xs text-text-muted font-mono">
                        {network.id}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getDriverBadge(network.driver)}</TableCell>
                <TableCell>
                  <span className="text-text-secondary">{network.scope}</span>
                </TableCell>
                <TableCell>
                  {network.ipam.config.length > 0 ? (
                    <span className="font-mono text-sm text-text-secondary">
                      {network.ipam.config[0].subnet}
                    </span>
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-text-secondary">
                    {Object.keys(network.containers).length} containers
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="min-w-[160px] bg-background-secondary border border-border rounded-lg p-1 shadow-lg z-50"
                          sideOffset={5}
                        >
                          <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none">
                            <NetworkIcon className="w-4 h-4" />
                            Xem chi tiết
                          </DropdownMenu.Item>
                          {!isSystemNetwork(network.name) && (
                            <>
                              <DropdownMenu.Separator className="h-px bg-border my-1" />
                              <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
                                onClick={() => setNetworkToDelete(network)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Xóa network
                              </DropdownMenu.Item>
                            </>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<NetworkIcon className="w-8 h-8" />}
          title="Chưa có network nào"
          description="Bạn chưa có network tùy chỉnh nào. Hãy tạo network để kết nối các containers."
          action={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Tạo Network
            </Button>
          }
        />
      )}

      {/* Create Network Dialog */}
      <Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Tạo Network Mới
            </Dialog.Title>
            <Dialog.Description className="text-sm text-text-secondary mt-2">
              Tạo một Docker network mới để kết nối các containers
            </Dialog.Description>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Tên Network
                </label>
                <input
                  type="text"
                  placeholder="my-network"
                  value={newNetworkName}
                  onChange={(e) => setNewNetworkName(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Driver
                </label>
                <select
                  value={newNetworkDriver}
                  onChange={(e) => setNewNetworkDriver(e.target.value)}
                  className="input w-full"
                >
                  <option value="bridge">bridge</option>
                  <option value="overlay">overlay</option>
                  <option value="macvlan">macvlan</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">Hủy</Button>
              </Dialog.Close>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!newNetworkName.trim()}
              >
                <Plus className="w-4 h-4" />
                Tạo Network
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <AlertDialog.Root
        open={!!networkToDelete}
        onOpenChange={(open) => !open && setNetworkToDelete(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Xác nhận xóa network
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              Bạn có chắc muốn xóa network{' '}
              <span className="font-medium text-text-primary">
                {networkToDelete?.name}
              </span>
              ? Hành động này không thể hoàn tác.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Hủy</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={removeMutation.isPending}
                >
                  Xóa network
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}


