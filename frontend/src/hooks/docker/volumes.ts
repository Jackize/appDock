import { volumesAPI } from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useVolumes() {
  return useQuery({
    queryKey: queryKeys.volumes.all,
    queryFn: volumesAPI.list,
    refetchInterval: 10000,
  });
}

export function useVolume(name: string) {
  return useQuery({
    queryKey: queryKeys.volumes.detail(name),
    queryFn: () => volumesAPI.get(name),
    enabled: !!name,
  });
}

export function useCreateVolume() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: volumesAPI.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.volumes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Volume ${data.name} đã được tạo`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveVolume() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ name, force = false }: { name: string; force?: boolean }) =>
      volumesAPI.remove(name, force),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.volumes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Volume ${name} đã được xóa`);
    },
    onError: (error) => toast.error(error),
  });
}
