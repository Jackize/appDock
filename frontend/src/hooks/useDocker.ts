import {
  composeStacksAPI,
  containersAPI,
  imagesAPI,
  networksAPI,
  projectsAPI,
  registryProjectsAPI,
  serversAPI,
  systemAPI,
  traefikAPI,
  volumesAPI,
} from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useServerStore } from "@/stores/serverStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateComposeStackRequest,
  CreateProjectRequest,
  CreateRegistryProjectRequest,
  CreateServerRequest,
  PullImageRequest,
  UpdateTraefikConfigRequest,
  UpdateComposeStackRequest,
  UpdateProjectRequest,
  UpdateRegistryProjectRequest,
  UpdateServerRequest,
} from "@/types";

// ==================== SYSTEM HOOKS ====================

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system", "info"],
    queryFn: systemAPI.getInfo,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useSystemStats() {
  return useQuery({
    queryKey: ["system", "stats"],
    queryFn: systemAPI.getStats,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function useStatsHistory() {
  return useQuery({
    queryKey: ["system", "stats", "history"],
    queryFn: systemAPI.getStatsHistory,
    refetchInterval: 5000, // Sync with backend collection interval
  });
}

export function useDockerStatus() {
  return useQuery({
    queryKey: ["system", "docker-status"],
    queryFn: systemAPI.getDockerStatus,
    refetchInterval: 3000, // Check every 3 seconds for real-time status
  });
}

// ==================== CONTAINER HOOKS ====================

export function useContainers(all = true) {
  return useQuery({
    queryKey: ["containers", { all }],
    queryFn: () => containersAPI.list(all),
    refetchInterval: 5000,
  });
}

export function useContainer(id: string) {
  return useQuery({
    queryKey: ["containers", id],
    queryFn: () => containersAPI.get(id),
    enabled: !!id,
  });
}

export function useContainerInspect(id: string, enabled = true) {
  return useQuery({
    queryKey: ["containers", id, "inspect"],
    queryFn: () => containersAPI.inspect(id),
    enabled: !!id && enabled,
  });
}

export function useContainerStats(id: string) {
  return useQuery({
    queryKey: ["containers", id, "stats"],
    queryFn: () => containersAPI.getStats(id),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useContainerLogs(id: string, tail = "100") {
  return useQuery({
    queryKey: ["containers", id, "logs", tail],
    queryFn: () => containersAPI.getLogs(id, tail),
    enabled: !!id,
  });
}

export function useStartContainer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: containersAPI.start,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Container ${id} đã được khởi động`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useStopContainer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: containersAPI.stop,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Container ${id} đã được dừng`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRestartContainer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: containersAPI.restart,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      addToast({
        title: "Thành công",
        description: `Container ${id} đã được khởi động lại`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveContainer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      containersAPI.remove(id, force),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Container ${id} đã được xóa`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== IMAGE HOOKS ====================

export function useImages() {
  return useQuery({
    queryKey: ["images"],
    queryFn: imagesAPI.list,
    refetchInterval: 10000,
  });
}

export function useImage(id: string) {
  return useQuery({
    queryKey: ["images", id],
    queryFn: () => imagesAPI.get(id),
    enabled: !!id,
  });
}

export function useRemoveImage() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      imagesAPI.remove(id, force),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Image ${id} đã được xóa`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function usePullImage() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: (input: string | PullImageRequest) =>
      imagesAPI.pull(typeof input === "string" ? { image: input } : input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      addToast({
        title: "Thành công",
        description: `Image ${data.ref ?? "đã"} được tải về`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useBulkRemoveImages() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ ids, force = true }: { ids: string[]; force?: boolean }) =>
      imagesAPI.bulkRemove(ids, force),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });

      if (result.deleted > 0) {
        addToast({
          title: "Thành công",
          description: `Đã xóa ${result.deleted}/${result.total} images`,
          variant: result.failed.length > 0 ? "warning" : "success",
        });
      }

      if (result.failed.length > 0) {
        addToast({
          title: "Một số images không thể xóa",
          description: `${result.failed.length} images xóa thất bại`,
          variant: "error",
        });
      }
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== NETWORK HOOKS ====================

export function useNetworks() {
  return useQuery({
    queryKey: ["networks"],
    queryFn: networksAPI.list,
    refetchInterval: 10000,
  });
}

export function useNetwork(id: string) {
  return useQuery({
    queryKey: ["networks", id],
    queryFn: () => networksAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateNetwork() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: networksAPI.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["networks"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Network ${data.id} đã được tạo`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveNetwork() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: networksAPI.remove,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["networks"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Network ${id} đã được xóa`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== VOLUME HOOKS ====================

export function useVolumes() {
  return useQuery({
    queryKey: ["volumes"],
    queryFn: volumesAPI.list,
    refetchInterval: 10000,
  });
}

export function useVolume(name: string) {
  return useQuery({
    queryKey: ["volumes", name],
    queryFn: () => volumesAPI.get(name),
    enabled: !!name,
  });
}

export function useCreateVolume() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: volumesAPI.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["volumes"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Volume ${data.name} đã được tạo`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveVolume() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ name, force = false }: { name: string; force?: boolean }) =>
      volumesAPI.remove(name, force),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: ["volumes"] });
      queryClient.invalidateQueries({ queryKey: ["system"] });
      addToast({
        title: "Thành công",
        description: `Volume ${name} đã được xóa`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== PROJECT HOOKS ====================

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectsAPI.list,
    refetchInterval: 30000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      addToast({
        title: "Thành công",
        description: "Đã tạo project",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      addToast({
        title: "Thành công",
        description: "Đã cập nhật project",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveProject() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);

  return useMutation({
    mutationFn: projectsAPI.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      addToast({
        title: "Thành công",
        description: "Đã xóa project",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== REGISTRY PROJECT HOOKS ====================

export function useRegistryProjects() {
  return useQuery({
    queryKey: ["registry-projects"],
    queryFn: registryProjectsAPI.list,
    refetchInterval: 30000,
  });
}

export function useCreateRegistryProject() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (data: CreateRegistryProjectRequest) =>
      registryProjectsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registry-projects"] });
      addToast({
        title: "Thành công",
        description: "Đã tạo registry project",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useUpdateRegistryProject() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateRegistryProjectRequest;
    }) => registryProjectsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registry-projects"] });
      addToast({
        title: "Thành công",
        description: "Đã cập nhật registry project",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveRegistryProject() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: registryProjectsAPI.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registry-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      addToast({
        title: "Thành công",
        description: "Đã xóa registry project",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== COMPOSE STACK HOOKS ====================

export function useComposeStacks(projectId: string) {
  return useQuery({
    queryKey: ["compose-stacks", projectId],
    queryFn: () => composeStacksAPI.list(projectId),
    enabled: !!projectId,
    refetchInterval: 15000,
  });
}

export function useCreateComposeStack() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (data: CreateComposeStackRequest) =>
      composeStacksAPI.create(data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["compose-stacks", vars.projectId],
      });
      addToast({
        title: "Thành công",
        description: "Đã tạo compose stack",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useUpdateComposeStack() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (vars: {
      id: string;
      projectId: string;
      data: UpdateComposeStackRequest;
    }) => composeStacksAPI.update(vars.id, vars.data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["compose-stacks", vars.projectId],
      });
      addToast({
        title: "Thành công",
        description: "Đã cập nhật stack",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveComposeStack() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      composeStacksAPI.remove(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["compose-stacks", vars.projectId],
      });
      addToast({
        title: "Thành công",
        description: "Đã xóa stack",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useDeployComposeStack() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      composeStacksAPI.deploy(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["compose-stacks", vars.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      addToast({
        title: "Deploy",
        description: "Compose up đã chạy (local server)",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi deploy",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useUndeployComposeStack() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      composeStacksAPI.undeploy(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["compose-stacks", vars.projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["containers"] });
      addToast({
        title: "Undeploy",
        description: "Compose down đã chạy",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== SERVER HOOKS ====================

// ==================== TRAEFIK HOOKS ====================

export function useTraefikStatus() {
  return useQuery({
    queryKey: ["traefik", "status"],
    queryFn: traefikAPI.status,
    refetchInterval: 10000,
  });
}

export function useApplyTraefik() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  return useMutation({
    mutationFn: (data: UpdateTraefikConfigRequest) => traefikAPI.apply(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["traefik"] });
      addToast({
        title: "Traefik",
        description: res.message || "Đã áp dụng cấu hình",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Traefik lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useTraefikLogs(tail = "200") {
  return useQuery({
    queryKey: ["traefik", "logs", tail],
    queryFn: () => traefikAPI.logs(tail),
    refetchInterval: 5000,
  });
}

export function useServers() {
  const setServers = useServerStore((state) => state.setServers);

  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const servers = await serversAPI.list();
      setServers(servers);
      return servers;
    },
    refetchInterval: 30000,
  });
}

export function useServer(id: string) {
  return useQuery({
    queryKey: ["servers", id],
    queryFn: () => serversAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  const addServer = useServerStore((state) => state.addServer);

  return useMutation({
    mutationFn: (data: CreateServerRequest) => serversAPI.create(data),
    onSuccess: (server) => {
      addServer(server);
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      addToast({
        title: "Thành công",
        description: `Server ${server.name} đã được thêm`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  const updateServer = useServerStore((state) => state.updateServer);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServerRequest }) =>
      serversAPI.update(id, data),
    onSuccess: (server) => {
      updateServer(server.id, server);
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      addToast({
        title: "Thành công",
        description: `Server ${server.name} đã được cập nhật`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRemoveServer() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((state) => state.addToast);
  const removeServer = useServerStore((state) => state.removeServer);

  return useMutation({
    mutationFn: serversAPI.remove,
    onSuccess: (_, id) => {
      removeServer(id);
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      addToast({
        title: "Thành công",
        description: "Server đã được xóa",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useTestServerConnection() {
  const addToast = useAppStore((state) => state.addToast);
  const updateServer = useServerStore((state) => state.updateServer);

  return useMutation({
    mutationFn: serversAPI.testConnection,
    onSuccess: (result, id) => {
      updateServer(id, { status: result.connected ? "online" : "offline" });
      if (result.connected) {
        addToast({
          title: "Kết nối thành công",
          description: "Server đang hoạt động",
          variant: "success",
        });
      } else {
        addToast({
          title: "Kết nối thất bại",
          description: result.error || "Không thể kết nối đến server",
          variant: "error",
        });
      }
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}
