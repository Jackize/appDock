import { useState } from 'react'
import {
  Globe,
  Plus,
  Trash2,
  MoreVertical,
  Play,
  Square,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
  ToggleLeft,
  ToggleRight,
  Download,
} from 'lucide-react'
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
import {
  useNginxStatus,
  useDomains,
  useCertificates,
  useInstallNginx,
  useInstallCertbot,
  useStartNginx,
  useStopNginx,
  useReloadNginx,
  useCreateDomain,
  useDeleteDomain,
  useEnableDomain,
  useDisableDomain,
  useRequestCertificate,
  useRevokeCertificate,
} from '@/hooks/useNginx'
import { nginxAPI } from '@/services/api'
import { useAppStore } from '@/stores/appStore'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import type { Domain, Certificate } from '@/types'

export function Nginx() {
  const { data: status, isLoading: statusLoading } = useNginxStatus()
  const { data: domains, isLoading: domainsLoading } = useDomains()
  const { data: certificates } = useCertificates()
  const searchQuery = useAppStore((state) => state.searchQuery)

  // Mutations
  const installNginx = useInstallNginx()
  const installCertbot = useInstallCertbot()
  const startNginx = useStartNginx()
  const stopNginx = useStopNginx()
  const reloadNginx = useReloadNginx()
  const createDomain = useCreateDomain()
  const deleteDomain = useDeleteDomain()
  const enableDomain = useEnableDomain()
  const disableDomain = useDisableDomain()
  const requestCert = useRequestCertificate()
  const revokeCert = useRevokeCertificate()

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null)
  const [configDialogDomain, setConfigDialogDomain] = useState<Domain | null>(null)
  const [configContent, setConfigContent] = useState('')
  const [sslDialogDomain, setSslDialogDomain] = useState<Domain | null>(null)
  const [sslEmail, setSslEmail] = useState('')
  const [certToRevoke, setCertToRevoke] = useState<Certificate | null>(null)

  // Create form state
  const [newDomain, setNewDomain] = useState('')
  const [newUpstreamHost, setNewUpstreamHost] = useState('127.0.0.1')
  const [newUpstreamPort, setNewUpstreamPort] = useState('')

  // Filter domains
  const filteredDomains = domains?.filter(
    (d) =>
      d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.upstreamHost.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateDomain = () => {
    if (newDomain.trim() && newUpstreamPort) {
      createDomain.mutate(
        {
          domain: newDomain.trim(),
          upstreamHost: newUpstreamHost.trim() || '127.0.0.1',
          upstreamPort: parseInt(newUpstreamPort, 10),
          sslEnabled: false,
        },
        {
          onSuccess: () => {
            setCreateDialogOpen(false)
            setNewDomain('')
            setNewUpstreamHost('127.0.0.1')
            setNewUpstreamPort('')
          },
        }
      )
    }
  }

  const handleDeleteDomain = () => {
    if (domainToDelete) {
      deleteDomain.mutate(domainToDelete.id, {
        onSuccess: () => setDomainToDelete(null),
      })
    }
  }

  const handleViewConfig = async (domain: Domain) => {
    try {
      const result = await nginxAPI.getDomainConfig(domain.id)
      setConfigContent(result.config)
      setConfigDialogDomain(domain)
    } catch {
      setConfigContent('Không thể tải cấu hình')
      setConfigDialogDomain(domain)
    }
  }

  const handleRequestSSL = () => {
    if (sslDialogDomain && sslEmail.trim()) {
      requestCert.mutate(
        { domain: sslDialogDomain.domain, email: sslEmail.trim() },
        {
          onSuccess: () => {
            setSslDialogDomain(null)
            setSslEmail('')
          },
        }
      )
    }
  }

  const handleRevokeCert = () => {
    if (certToRevoke) {
      revokeCert.mutate(certToRevoke.domain, {
        onSuccess: () => setCertToRevoke(null),
      })
    }
  }

  const getSSLBadge = (domain: Domain) => {
    if (!domain.sslEnabled) {
      return <Badge variant="outline">Không SSL</Badge>
    }
    switch (domain.sslStatus) {
      case 'active':
        return <Badge variant="running">SSL Active</Badge>
      case 'expired':
        return <Badge variant="stopped">SSL Expired</Badge>
      case 'pending':
        return <Badge variant="paused">Pending</Badge>
      default:
        return <Badge variant="outline">Không SSL</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nginx</h1>
          <p className="text-text-secondary mt-1">
            Quản lý Nginx reverse proxy, domain và SSL
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status?.installed && (
            <span className="text-sm text-text-secondary">
              Tổng cộng: {domains?.length || 0} domains
            </span>
          )}
          {status?.installed && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Thêm Domain
            </Button>
          )}
        </div>
      </div>

      {/* Nginx Status Banner */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              status?.running ? 'bg-status-running/10' : 'bg-background-hover'
            }`}>
              <Globe className={`w-6 h-6 ${status?.running ? 'text-status-running' : 'text-text-muted'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text-primary">Nginx</h3>
                {status?.installed ? (
                  <Badge variant={status.running ? 'running' : 'stopped'}>
                    {status.running ? 'Running' : 'Stopped'}
                  </Badge>
                ) : (
                  <Badge variant="outline">Chưa cài đặt</Badge>
                )}
                {status?.configOk === false && status.installed && (
                  <Badge variant="stopped">Config lỗi</Badge>
                )}
              </div>
              {status?.installed && (
                <p className="text-sm text-text-secondary mt-0.5">
                  Phiên bản: {status.version}
                  {status.certbotInstalled ? ' | Certbot: Đã cài' : ' | Certbot: Chưa cài'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!status?.installed && !statusLoading && (
              <Button
                onClick={() => installNginx.mutate()}
                loading={installNginx.isPending}
              >
                <Download className="w-4 h-4" />
                Cài đặt Nginx
              </Button>
            )}
            {status?.installed && !status.certbotInstalled && (
              <Button
                variant="secondary"
                onClick={() => installCertbot.mutate()}
                loading={installCertbot.isPending}
              >
                <Download className="w-4 h-4" />
                Cài Certbot
              </Button>
            )}
            {status?.installed && !status.running && (
              <Button
                onClick={() => startNginx.mutate()}
                loading={startNginx.isPending}
              >
                <Play className="w-4 h-4" />
                Khởi động
              </Button>
            )}
            {status?.installed && status.running && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => reloadNginx.mutate()}
                  loading={reloadNginx.isPending}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload
                </Button>
                <Button
                  variant="danger"
                  onClick={() => stopNginx.mutate()}
                  loading={stopNginx.isPending}
                >
                  <Square className="w-4 h-4" />
                  Dừng
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Domains Table */}
      {status?.installed && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3">Domains</h2>
            {domainsLoading ? (
              <SkeletonTable />
            ) : filteredDomains && filteredDomains.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Upstream</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            {domain.sslEnabled ? (
                              <ShieldCheck className="w-5 h-5 text-status-running" />
                            ) : (
                              <Globe className="w-5 h-5 text-accent" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{domain.domain}</p>
                            <p className="text-xs text-text-muted font-mono">
                              {domain.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-text-secondary">
                          {domain.upstreamHost}:{domain.upstreamPort}
                        </span>
                      </TableCell>
                      <TableCell>{getSSLBadge(domain)}</TableCell>
                      <TableCell>
                        <Badge variant={domain.enabled ? 'running' : 'stopped'}>
                          {domain.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
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
                                className="min-w-[180px] bg-background-secondary border border-border rounded-lg p-1 shadow-lg z-50"
                                sideOffset={5}
                              >
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
                                  onClick={() => handleViewConfig(domain)}
                                >
                                  <Eye className="w-4 h-4" />
                                  Xem cấu hình
                                </DropdownMenu.Item>

                                {domain.enabled ? (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
                                    onClick={() => disableDomain.mutate(domain.id)}
                                  >
                                    <ToggleLeft className="w-4 h-4" />
                                    Tắt domain
                                  </DropdownMenu.Item>
                                ) : (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
                                    onClick={() => enableDomain.mutate(domain.id)}
                                  >
                                    <ToggleRight className="w-4 h-4" />
                                    Kích hoạt domain
                                  </DropdownMenu.Item>
                                )}

                                {!domain.sslEnabled && status?.certbotInstalled && (
                                  <DropdownMenu.Item
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
                                    onClick={() => setSslDialogDomain(domain)}
                                  >
                                    <Shield className="w-4 h-4" />
                                    Yêu cầu SSL
                                  </DropdownMenu.Item>
                                )}

                                <DropdownMenu.Separator className="h-px bg-border my-1" />
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
                                  onClick={() => setDomainToDelete(domain)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Xóa domain
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
                icon={<Globe className="w-8 h-8" />}
                title="Chưa có domain nào"
                description="Thêm domain để cấu hình reverse proxy cho ứng dụng của bạn."
                action={
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Thêm Domain
                  </Button>
                }
              />
            )}
          </div>

          {/* SSL Certificates Section */}
          {certificates && certificates.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Chứng chỉ SSL</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Hết hạn</TableHead>
                    <TableHead>Auto Renew</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert) => (
                    <TableRow key={cert.domain}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-status-running/10 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-status-running" />
                          </div>
                          <p className="font-medium">{cert.domain}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-text-secondary">{cert.issuer}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-text-secondary">
                          {new Date(cert.expiresAt).toLocaleDateString('vi-VN')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cert.autoRenew ? 'running' : 'outline'}>
                          {cert.autoRenew ? 'Có' : 'Không'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCertToRevoke(cert)}
                          >
                            <ShieldX className="w-4 h-4 text-status-stopped" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Create Domain Dialog */}
      <Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Thêm Domain Mới
            </Dialog.Title>
            <Dialog.Description className="text-sm text-text-secondary mt-2">
              Cấu hình Nginx reverse proxy cho domain của bạn
            </Dialog.Description>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Tên Domain
                </label>
                <input
                  type="text"
                  placeholder="app.example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Upstream Host
                </label>
                <input
                  type="text"
                  placeholder="127.0.0.1"
                  value={newUpstreamHost}
                  onChange={(e) => setNewUpstreamHost(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Upstream Port
                </label>
                <input
                  type="number"
                  placeholder="3000"
                  value={newUpstreamPort}
                  onChange={(e) => setNewUpstreamPort(e.target.value)}
                  className="input w-full"
                  min={1}
                  max={65535}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">Hủy</Button>
              </Dialog.Close>
              <Button
                onClick={handleCreateDomain}
                loading={createDomain.isPending}
                disabled={!newDomain.trim() || !newUpstreamPort}
              >
                <Plus className="w-4 h-4" />
                Thêm Domain
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* View Config Dialog */}
      <Dialog.Root
        open={!!configDialogDomain}
        onOpenChange={(open) => !open && setConfigDialogDomain(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-lg z-50">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Cấu hình Nginx — {configDialogDomain?.domain}
            </Dialog.Title>
            <div className="mt-4">
              <pre className="bg-background-primary border border-border rounded-lg p-4 text-sm font-mono text-text-secondary overflow-auto max-h-96">
                {configContent}
              </pre>
            </div>
            <div className="flex justify-end mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">Đóng</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Request SSL Dialog */}
      <Dialog.Root
        open={!!sslDialogDomain}
        onOpenChange={(open) => {
          if (!open) {
            setSslDialogDomain(null)
            setSslEmail('')
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Yêu cầu chứng chỉ SSL
            </Dialog.Title>
            <Dialog.Description className="text-sm text-text-secondary mt-2">
              Cấp chứng chỉ SSL miễn phí từ Let's Encrypt cho{' '}
              <span className="font-medium text-text-primary">
                {sslDialogDomain?.domain}
              </span>
            </Dialog.Description>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={sslEmail}
                  onChange={(e) => setSslEmail(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
                <p className="text-xs text-text-muted mt-1">
                  Let's Encrypt sẽ gửi thông báo gia hạn qua email này
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">Hủy</Button>
              </Dialog.Close>
              <Button
                onClick={handleRequestSSL}
                loading={requestCert.isPending}
                disabled={!sslEmail.trim()}
              >
                <Shield className="w-4 h-4" />
                Cấp SSL
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Domain Confirmation */}
      <AlertDialog.Root
        open={!!domainToDelete}
        onOpenChange={(open) => !open && setDomainToDelete(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Xác nhận xóa domain
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              Bạn có chắc muốn xóa domain{' '}
              <span className="font-medium text-text-primary">
                {domainToDelete?.domain}
              </span>
              ? Cấu hình Nginx sẽ bị xóa và không thể hoàn tác.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Hủy</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
                  onClick={handleDeleteDomain}
                  loading={deleteDomain.isPending}
                >
                  Xóa domain
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Revoke Certificate Confirmation */}
      <AlertDialog.Root
        open={!!certToRevoke}
        onOpenChange={(open) => !open && setCertToRevoke(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Thu hồi chứng chỉ SSL
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              Bạn có chắc muốn thu hồi chứng chỉ SSL cho{' '}
              <span className="font-medium text-text-primary">
                {certToRevoke?.domain}
              </span>
              ? Domain sẽ không còn hỗ trợ HTTPS.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Hủy</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
                  onClick={handleRevokeCert}
                  loading={revokeCert.isPending}
                >
                  Thu hồi SSL
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
