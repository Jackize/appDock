import { ConfirmDialog } from "@/components/resource/ConfirmDialog";
import { PageHeader } from "@/components/resource/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ContainerGroupCard } from "@/features/containers/ContainerGroupCard";
import { ContainerInspectDialog } from "@/features/containers/ContainerInspectDialog";
import { STANDALONE_GROUP_ID } from "@/features/containers/containerConstants";
import type {
  ContainerActionHandlers,
  ContainerActionState,
} from "@/features/containers/containerTypes";
import {
  countRunning,
  countStopped,
  filterContainers,
  groupContainersByProject,
} from "@/features/containers/containerUtils";
import {
  useContainers,
  useRemoveContainer,
  useRestartContainer,
  useStartContainer,
  useStopContainer,
} from "@/hooks/useDocker";
import { useAppStore } from "@/stores/appStore";
import type { Container } from "@/types";
import { Box, Container as ContainerIcon, Layers } from "lucide-react";
import { useMemo, useState } from "react";

export function Containers() {
  const { data: containers, isLoading, error } = useContainers(true);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const openTab = useAppStore((state) => state.openTab);
  const [containerToDelete, setContainerToDelete] = useState<Container | null>(
    null,
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set([STANDALONE_GROUP_ID]),
  );
  const [inspectDialogOpen, setInspectDialogOpen] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<Container | null>(null);

  const startMutation = useStartContainer();
  const stopMutation = useStopContainer();
  const restartMutation = useRestartContainer();
  const removeMutation = useRemoveContainer();

  const filteredContainers = useMemo(
    () => filterContainers(containers, searchQuery),
    [containers, searchQuery],
  );

  const { projectGroups, standaloneContainers } = useMemo(
    () => groupContainersByProject(filteredContainers),
    [filteredContainers],
  );

  const actionHandlers = useMemo<ContainerActionHandlers>(
    () => ({
      onStart: (container) => startMutation.mutate(container.id),
      onStop: (container) => stopMutation.mutate(container.id),
      onRestart: (container) => restartMutation.mutate(container.id),
      onInspect: (container) => {
        setInspectTarget(container);
        setInspectDialogOpen(true);
      },
      onDelete: (container) => setContainerToDelete(container),
      onOpenLogs: (container) => openTab(container.id, container.name, "logs"),
      onOpenTerminal: (container) =>
        openTab(container.id, container.name, "terminal"),
    }),
    [openTab, restartMutation, startMutation, stopMutation],
  );

  const actionState = useMemo<ContainerActionState>(
    () => ({
      starting: startMutation.isPending,
      stopping: stopMutation.isPending,
      restarting: restartMutation.isPending,
    }),
    [restartMutation.isPending, startMutation.isPending, stopMutation.isPending],
  );

  const totalRunning = countRunning(containers);
  const totalStopped = countStopped(containers);

  const toggleProject = (projectName: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectName)) {
        next.delete(projectName);
      } else {
        next.add(projectName);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjects(
      new Set([...projectGroups.map((group) => group.name), STANDALONE_GROUP_ID]),
    );
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  const handleDelete = () => {
    if (!containerToDelete) return;
    removeMutation.mutate(
      { id: containerToDelete.id, force: true },
      { onSuccess: () => setContainerToDelete(null) },
    );
  };

  const handleInspectOpenChange = (open: boolean) => {
    setInspectDialogOpen(open);
    if (!open) {
      setInspectTarget(null);
    }
  };

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-stopped">Lỗi: {error.message}</p>
      </div>
    );
  }

  const hasContainers =
    projectGroups.length > 0 || standaloneContainers.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Containers"
        description="Quản lý các Docker containers"
        stats={
          <div className="flex flex-wrap items-center gap-2 text-sm">
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
        }
        actions={
          hasContainers && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={expandAll}>
                Mở tất cả
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                Thu gọn
              </Button>
            </div>
          )
        }
      />

      {isLoading ? (
        <SkeletonTable />
      ) : filteredContainers.length > 0 ? (
        <div className="space-y-4">
          {projectGroups.map((group) => (
            <ContainerGroupCard
              key={group.name}
              title={group.name}
              description="Docker Compose Project"
              icon={
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-accent" />
                </div>
              }
              countLabel={`${group.containers.length} services`}
              containers={group.containers}
              runningCount={group.runningCount}
              stoppedCount={group.stoppedCount}
              open={expandedProjects.has(group.name)}
              onToggle={() => toggleProject(group.name)}
              showService
              actionHandlers={actionHandlers}
              actionState={actionState}
            />
          ))}

          {standaloneContainers.length > 0 && (
            <ContainerGroupCard
              title="Standalone Containers"
              description="Containers không thuộc project nào"
              icon={
                <div className="w-10 h-10 rounded-lg bg-text-muted/20 flex items-center justify-center">
                  <Box className="w-5 h-5 text-text-muted" />
                </div>
              }
              countLabel={`${standaloneContainers.length} containers`}
              containers={standaloneContainers}
              runningCount={countRunning(standaloneContainers)}
              stoppedCount={countStopped(standaloneContainers)}
              open={expandedProjects.has(STANDALONE_GROUP_ID)}
              onToggle={() => toggleProject(STANDALONE_GROUP_ID)}
              actionHandlers={actionHandlers}
              actionState={actionState}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={<ContainerIcon className="w-8 h-8" />}
          title="Chưa có container nào"
          description="Bạn chưa có container nào. Hãy tạo container từ image để bắt đầu."
        />
      )}

      <ConfirmDialog
        open={!!containerToDelete}
        onOpenChange={(open) => !open && setContainerToDelete(null)}
        title="Xác nhận xóa container"
        description={
          <>
            Bạn có chắc muốn xóa container{" "}
            <span className="font-medium text-text-primary">
              {containerToDelete?.name}
            </span>
            ? Hành động này không thể hoàn tác.
          </>
        }
        confirmLabel="Xóa container"
        loading={removeMutation.isPending}
        onConfirm={handleDelete}
      />

      <ContainerInspectDialog
        open={inspectDialogOpen}
        container={inspectTarget}
        onOpenChange={handleInspectOpenChange}
      />
    </div>
  );
}
