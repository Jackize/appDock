import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  useContainers,
  useRemoveContainer,
  useRestartContainer,
  useStartContainer,
  useStopContainer,
} from "@/hooks/useDocker";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { Container } from "@/types";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Container as ContainerIcon,
  FileText,
  Layers,
  MoreVertical,
  Play,
  RotateCcw,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

// Docker Compose label key for project name
const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";
const COMPOSE_SERVICE_LABEL = "com.docker.compose.service";

interface ContainerGroup {
  name: string;
  containers: Container[];
  runningCount: number;
  stoppedCount: number;
}

export function Containers() {
  const { data: containers, isLoading, error } = useContainers(true);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const openTab = useAppStore((state) => state.openTab);
  const [containerToDelete, setContainerToDelete] = useState<Container | null>(
    null
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(["__standalone__"])
  );

  const startMutation = useStartContainer();
  const stopMutation = useStopContainer();
  const restartMutation = useRestartContainer();
  const removeMutation = useRemoveContainer();

  // Filter containers by search query
  const filteredContainers = useMemo(() => {
    if (!containers) return [];
    return containers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [containers, searchQuery]);

  // Group containers by project
  const { projectGroups, standaloneContainers } = useMemo(() => {
    const groups: Record<string, Container[]> = {};
    const standalone: Container[] = [];

    filteredContainers.forEach((container) => {
      const projectName = container.labels?.[COMPOSE_PROJECT_LABEL];
      if (projectName) {
        if (!groups[projectName]) {
          groups[projectName] = [];
        }
        groups[projectName].push(container);
      } else {
        standalone.push(container);
      }
    });

    // Convert to array and sort by project name
    const projectGroups: ContainerGroup[] = Object.entries(groups)
      .map(([name, containers]) => ({
        name,
        containers: containers.sort((a, b) => a.name.localeCompare(b.name)),
        runningCount: containers.filter((c) => c.state === "running").length,
        stoppedCount: containers.filter((c) => c.state !== "running").length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { projectGroups, standaloneContainers: standalone };
  }, [filteredContainers]);

  const toggleProject = (projectName: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allProjects = new Set([
      ...projectGroups.map((g) => g.name),
      "__standalone__",
    ]);
    setExpandedProjects(allProjects);
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  const getStatusBadge = (state: string) => {
    switch (state.toLowerCase()) {
      case "running":
        return <Badge variant="running">Đang chạy</Badge>;
      case "exited":
        return <Badge variant="stopped">Đã dừng</Badge>;
      case "paused":
        return <Badge variant="paused">Tạm dừng</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const handleStart = (id: string) => {
    startMutation.mutate(id);
  };

  const handleStop = (id: string) => {
    stopMutation.mutate(id);
  };

  const handleRestart = (id: string) => {
    restartMutation.mutate(id);
  };

  const handleDelete = () => {
    if (containerToDelete) {
      removeMutation.mutate(
        { id: containerToDelete.id, force: true },
        { onSuccess: () => setContainerToDelete(null) }
      );
    }
  };

  // Get service name from container
  const getServiceName = (container: Container) => {
    return container.labels?.[COMPOSE_SERVICE_LABEL] || container.name;
  };

  // Container row component
  const ContainerRow = ({
    container,
    showService = false,
  }: {
    container: Container;
    showService?: boolean;
  }) => (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              container.state === "running"
                ? "bg-status-running animate-pulse"
                : "bg-status-stopped"
            }`}
          />
          <div>
            <p className="font-medium">
              {showService ? getServiceName(container) : container.name}
            </p>
            <p className="text-xs text-text-muted font-mono">{container.id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-text-secondary">
          {truncate(container.image, 40)}
        </span>
      </TableCell>
      <TableCell>{getStatusBadge(container.state)}</TableCell>
      <TableCell>
        {container.ports.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {container.ports
              .filter((p) => p.publicPort)
              .slice(0, 3)
              .map((port, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded bg-background-tertiary text-text-secondary"
                >
                  {port.publicPort}:{port.privatePort}
                </span>
              ))}
            {container.ports.filter((p) => p.publicPort).length > 3 && (
              <span className="text-xs text-text-muted">
                +{container.ports.filter((p) => p.publicPort).length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-text-muted">-</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-text-secondary">
          {formatRelativeTime(container.created)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {container.state === "running" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleStop(container.id)}
                disabled={stopMutation.isPending}
                title="Dừng"
              >
                <Square className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRestart(container.id)}
                disabled={restartMutation.isPending}
                title="Khởi động lại"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleStart(container.id)}
              disabled={startMutation.isPending}
              title="Khởi động"
            >
              <Play className="w-4 h-4" />
            </Button>
          )}

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
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
                  onClick={() => openTab(container.id, container.name, "terminal")}
                  disabled={container.state !== "running"}
                >
                  <Terminal className="w-4 h-4" />
                  Terminal
                  {container.state !== "running" && (
                    <span className="text-xs text-text-muted ml-auto">(cần chạy)</span>
                  )}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
                  onClick={() => openTab(container.id, container.name, "logs")}
                >
                  <FileText className="w-4 h-4" />
                  Xem logs
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
                  onClick={() => setContainerToDelete(container)}
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa container
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </TableCell>
    </TableRow>
  );

  // Container table component
  const ContainerTable = ({
    containers: containerList,
    showService = false,
  }: {
    containers: Container[];
    showService?: boolean;
  }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{showService ? "Service" : "Container"}</TableHead>
          <TableHead>Image</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ports</TableHead>
          <TableHead>Tạo lúc</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {containerList.map((container) => (
          <ContainerRow
            key={container.id}
            container={container}
            showService={showService}
          />
        ))}
      </TableBody>
    </Table>
  );

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-stopped">Lỗi: {error.message}</p>
      </div>
    );
  }

  const totalRunning =
    containers?.filter((c) => c.state === "running").length || 0;
  const totalStopped =
    containers?.filter((c) => c.state !== "running").length || 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Containers</h1>
          <p className="text-text-secondary mt-1">
            Quản lý các Docker containers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-accent/20 text-accent">
              {projectGroups.length} projects
            </span>
            <span className="px-2 py-1 rounded bg-status-running/20 text-status-running">
              {totalRunning} đang chạy
            </span>
            <span className="px-2 py-1 rounded bg-status-stopped/20 text-status-stopped">
              {totalStopped} đã dừng
            </span>
          </div>
          {(projectGroups.length > 0 || standaloneContainers.length > 0) && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={expandAll}>
                Mở tất cả
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                Thu gọn
              </Button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable />
      ) : filteredContainers.length > 0 ? (
        <div className="space-y-4">
          {/* Project groups */}
          {projectGroups.map((group) => (
            <Collapsible.Root
              key={group.name}
              open={expandedProjects.has(group.name)}
            >
              <Card>
                <button
                  type="button"
                  onClick={() => toggleProject(group.name)}
                  className="w-full text-left"
                >
                  <CardHeader className="cursor-pointer hover:bg-background-hover/50 transition-colors rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {group.name}
                            <Badge variant="outline" className="ml-2">
                              {group.containers.length} services
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-text-muted mt-0.5">
                            Docker Compose Project
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          {group.runningCount > 0 && (
                            <span className="px-2 py-0.5 rounded bg-status-running/20 text-status-running">
                              {group.runningCount} running
                            </span>
                          )}
                          {group.stoppedCount > 0 && (
                            <span className="px-2 py-0.5 rounded bg-status-stopped/20 text-status-stopped">
                              {group.stoppedCount} stopped
                            </span>
                          )}
                        </div>
                        {expandedProjects.has(group.name) ? (
                          <ChevronDown className="w-5 h-5 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-text-muted" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </button>
                <Collapsible.Content>
                  <CardContent className="pt-0">
                    <ContainerTable
                      containers={group.containers}
                      showService={true}
                    />
                  </CardContent>
                </Collapsible.Content>
              </Card>
            </Collapsible.Root>
          ))}

          {/* Standalone containers */}
          {standaloneContainers.length > 0 && (
            <Collapsible.Root open={expandedProjects.has("__standalone__")}>
              <Card>
                <button
                  type="button"
                  onClick={() => toggleProject("__standalone__")}
                  className="w-full text-left"
                >
                  <CardHeader className="cursor-pointer hover:bg-background-hover/50 transition-colors rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-text-muted/20 flex items-center justify-center">
                          <Box className="w-5 h-5 text-text-muted" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Standalone Containers
                            <Badge variant="outline" className="ml-2">
                              {standaloneContainers.length} containers
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-text-muted mt-0.5">
                            Containers không thuộc project nào
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          {standaloneContainers.filter(
                            (c) => c.state === "running"
                          ).length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-status-running/20 text-status-running">
                              {
                                standaloneContainers.filter(
                                  (c) => c.state === "running"
                                ).length
                              }{" "}
                              running
                            </span>
                          )}
                          {standaloneContainers.filter(
                            (c) => c.state !== "running"
                          ).length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-status-stopped/20 text-status-stopped">
                              {
                                standaloneContainers.filter(
                                  (c) => c.state !== "running"
                                ).length
                              }{" "}
                              stopped
                            </span>
                          )}
                        </div>
                        {expandedProjects.has("__standalone__") ? (
                          <ChevronDown className="w-5 h-5 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-text-muted" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </button>
                <Collapsible.Content>
                  <CardContent className="pt-0">
                    <ContainerTable containers={standaloneContainers} />
                  </CardContent>
                </Collapsible.Content>
              </Card>
            </Collapsible.Root>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<ContainerIcon className="w-8 h-8" />}
          title="Chưa có container nào"
          description="Bạn chưa có container nào. Hãy tạo container từ image để bắt đầu."
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog.Root
        open={!!containerToDelete}
        onOpenChange={(open) => !open && setContainerToDelete(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background-secondary border border-border rounded-xl p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-lg font-semibold text-text-primary">
              Xác nhận xóa container
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-text-secondary mt-2">
              Bạn có chắc muốn xóa container{" "}
              <span className="font-medium text-text-primary">
                {containerToDelete?.name}
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
                  Xóa container
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
