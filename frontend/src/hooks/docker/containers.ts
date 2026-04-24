import { containersAPI } from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useContainers(all = true) {
  return useQuery({
    queryKey: queryKeys.containers.list(all),
    queryFn: () => containersAPI.list(all),
    refetchInterval: 5000,
  });
}

export function useContainer(id: string) {
  return useQuery({
    queryKey: queryKeys.containers.detail(id),
    queryFn: () => containersAPI.get(id),
    enabled: !!id,
  });
}

export function useContainerInspect(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.containers.inspect(id),
    queryFn: () => containersAPI.inspect(id),
    enabled: !!id && enabled,
  });
}

export function useContainerStats(id: string) {
  return useQuery({
    queryKey: queryKeys.containers.stats(id),
    queryFn: () => containersAPI.getStats(id),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useContainerLogs(id: string, tail = "100") {
  return useQuery({
    queryKey: queryKeys.containers.logs(id, tail),
    queryFn: () => containersAPI.getLogs(id, tail),
    enabled: !!id,
  });
}

export function useStartContainer() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: containersAPI.start,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Container ${id} đã được khởi động`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useStopContainer() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: containersAPI.stop,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Container ${id} đã được dừng`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useRestartContainer() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: containersAPI.restart,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      toast.success(`Container ${id} đã được khởi động lại`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveContainer() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      containersAPI.remove(id, force),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Container ${id} đã được xóa`);
    },
    onError: (error) => toast.error(error),
  });
}
