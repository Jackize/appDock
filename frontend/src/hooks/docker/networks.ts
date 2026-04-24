import { networksAPI } from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useNetworks() {
  return useQuery({
    queryKey: queryKeys.networks.all,
    queryFn: networksAPI.list,
    refetchInterval: 10000,
  });
}

export function useNetwork(id: string) {
  return useQuery({
    queryKey: queryKeys.networks.detail(id),
    queryFn: () => networksAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateNetwork() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: networksAPI.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Network ${data.id} đã được tạo`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveNetwork() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: networksAPI.remove,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Network ${id} đã được xóa`);
    },
    onError: (error) => toast.error(error),
  });
}
