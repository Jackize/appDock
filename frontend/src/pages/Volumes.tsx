import { useState } from 'react'
import { HardDrive, Trash2, Plus, MoreVertical, FolderOpen } from 'lucide-react'
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
import { useVolumes, useRemoveVolume, useCreateVolume } from '@/hooks/useDocker'
import { useAppStore } from '@/stores/appStore'
import { formatBytes, formatDate, truncate } from '@/lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import type { Volume } from '@/types'

export function Volumes() {
  const { data: volumes, isLoading, error } = useVolumes()
  const searchQuery = useAppStore((state) => state.searchQuery)
  const [volumeToDelete, setVolumeToDelete] = useState<Volume | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newVolumeName, setNewVolumeName] = useState('')

  const removeMutation = useRemoveVolume()
  const createMutation = useCreateVolume()

  // Filter volumes by search query
  const filteredVolumes = volumes?.filter((vol) =>
    vol.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = () => {
    if (volumeToDelete) {
      removeMutation.mutate(
        { name: volumeToDelete.name, force: true },
        { onSuccess: () => setVolumeToDelete(null) }
      )
    }
  }

  const handleCreate = () => {
    if (newVolumeName.trim()) {
      createMutation.mutate(
        { name: newVolumeName.trim() },
        {
          onSuccess: () => {
            setCreateDialogOpen(false)
            setNewVolumeName('')
          },
        }
      )
    }
  }

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
          <h1 className="text-2xl font-bold text-text-primary">Volumes</h1>
          <p className="text-text-secondary mt-1">
            Quản lý các Docker volumes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            Tổng cộng: {volumes?.length || 0} volumes
          </span>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Tạo Volume
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable />
      ) : filteredVolumes && filteredVolumes.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Volume</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Mountpoint</TableHead>
              <TableHead>Kích thước</TableHead>
              <TableHead>Tạo lúc</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVolumes.map((volume) => (
              <TableRow key={volume.name}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-status-created/10 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-status-created" />
                    </div>
                    <div>
                      <p className="font-medium">{truncate(volume.name, 30)}</p>
                      <p className="text-xs text-text-muted">{volume.scope}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{volume.driver}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-text-muted" />
                    <span
                      className="font-mono text-xs text-text-secondary max-w-[200px] truncate"
                      title={volume.mountpoint}
                    >
                      {volume.mountpoint}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {volume.usageData ? (
                    <div>
                      <span className="text-text-secondary">
                        {formatBytes(volume.usageData.size)}
                      </span>
                      <p className="text-xs text-text-muted">
                        {volume.usageData.refCount} refs
                      </p>
                    </div>
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-text-secondary text-sm">
                    {volume.createdAt ? formatDate(volume.createdAt) : '-'}
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
                            <HardDrive className="w-4 h-4" />
                            Xem chi tiết
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="h-px bg-border my-1" />
                          <DropdownMenu.Item
                            className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
                            onClick={() => setVolumeToDelete(volume)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Xóa volume
                          </DropdownMenu.Item>
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
          icon={<HardDrive className="w-8 h-8" />}
          title="Chưa có volume nào"
          description="Bạn chưa có volume nào. Volumes dùng để lưu trữ dữ liệu persistent cho containers."
          action={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Tạo Volume
            </Button>
          }
        />
      )}

      {/* Create Volume Dialog */}
      <Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Tạo Volume Mới
            </Dialog.Title>
            <Dialog.Description className="text-sm text-text-secondary mt-2">
              Tạo một Docker volume mới để lưu trữ dữ liệu persistent
            </Dialog.Description>
            <div className="mt-4">
              <label className="block text-sm font-medium text-text-primary mb-1">
                Tên Volume
              </label>
              <input
                type="text"
                placeholder="my-volume"
                value={newVolumeName}
                onChange={(e) => setNewVolumeName(e.target.value)}
                className="input w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">Hủy</Button>
              </Dialog.Close>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!newVolumeName.trim()}
              >
                <Plus className="w-4 h-4" />
                Tạo Volume
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <AlertDialog.Root
        open={!!volumeToDelete}
        onOpenChange={(open) => !open && setVolumeToDelete(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Xác nhận xóa volume
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              Bạn có chắc muốn xóa volume{' '}
              <span className="font-medium text-text-primary">
                {volumeToDelete?.name}
              </span>
              ? Tất cả dữ liệu trong volume sẽ bị mất vĩnh viễn.
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
                  Xóa volume
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}


