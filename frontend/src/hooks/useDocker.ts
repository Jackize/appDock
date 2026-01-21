import {
  containersAPI,
  imagesAPI,
  networksAPI,
  systemAPI,
  volumesAPI,
} from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    mutationFn: imagesAPI.pull,
    onSuccess: (_, image) => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      addToast({
        title: "Thành công",
        description: `Image ${image} đã được tải về`,
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
