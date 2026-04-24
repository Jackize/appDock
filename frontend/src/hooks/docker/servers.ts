import { serversAPI } from "@/services/api";
import { useServerStore } from "@/stores/serverStore";
import type { CreateServerRequest, UpdateServerRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useServers() {
  const setServers = useServerStore((state) => state.setServers);

  return useQuery({
    queryKey: queryKeys.servers.all,
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
    queryKey: queryKeys.servers.detail(id),
    queryFn: () => serversAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  const addServer = useServerStore((state) => state.addServer);
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateServerRequest) => serversAPI.create(data),
    onSuccess: (server) => {
      addServer(server);
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.all });
      toast.success(`Server ${server.name} đã được thêm`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();
  const updateServer = useServerStore((state) => state.updateServer);
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServerRequest }) =>
      serversAPI.update(id, data),
    onSuccess: (server) => {
      updateServer(server.id, server);
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.all });
      toast.success(`Server ${server.name} đã được cập nhật`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveServer() {
  const queryClient = useQueryClient();
  const removeServer = useServerStore((state) => state.removeServer);
  const toast = useToastActions();

  return useMutation({
    mutationFn: serversAPI.remove,
    onSuccess: (_, id) => {
      removeServer(id);
      queryClient.invalidateQueries({ queryKey: queryKeys.servers.all });
      toast.success("Server đã được xóa");
    },
    onError: (error) => toast.error(error),
  });
}

export function useTestServerConnection() {
  const updateServer = useServerStore((state) => state.updateServer);
  const toast = useToastActions();

  return useMutation({
    mutationFn: serversAPI.testConnection,
    onSuccess: (result, id) => {
      updateServer(id, { status: result.connected ? "online" : "offline" });
      if (result.connected) {
        toast.success("Server đang hoạt động", "Kết nối thành công");
      } else {
        toast.failure(
          result.error || "Không thể kết nối đến server",
          "Kết nối thất bại",
        );
      }
    },
    onError: (error) => toast.error(error),
  });
}
