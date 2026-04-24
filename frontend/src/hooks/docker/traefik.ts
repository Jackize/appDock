import { traefikAPI } from "@/services/api";
import type { UpdateTraefikConfigRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useTraefikStatus() {
  return useQuery({
    queryKey: queryKeys.traefik.status,
    queryFn: traefikAPI.status,
    refetchInterval: 10000,
  });
}

export function useApplyTraefik() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: UpdateTraefikConfigRequest) => traefikAPI.apply(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.traefik.all });
      toast.success(res.message || "Đã áp dụng cấu hình", "Traefik");
    },
    onError: (error) => toast.error(error, "Traefik lỗi"),
  });
}

export function useTraefikLogs(tail = "200") {
  return useQuery({
    queryKey: queryKeys.traefik.logs(tail),
    queryFn: () => traefikAPI.logs(tail),
    refetchInterval: 5000,
  });
}
