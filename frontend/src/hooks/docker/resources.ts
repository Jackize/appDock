import { resourcesAPI } from "@/services/api";
import type { CreateResourceRequest, UpdateResourceRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useResources(environmentId: string) {
  return useQuery({
    queryKey: queryKeys.resources.list(environmentId),
    queryFn: () => resourcesAPI.list(environmentId),
    enabled: !!environmentId,
    refetchInterval: 15000,
  });
}

export function useResourceConfig(resourceId: string) {
  return useQuery({
    queryKey: queryKeys.resources.config(resourceId),
    queryFn: () => resourcesAPI.config(resourceId),
    enabled: !!resourceId,
  });
}

export function useCreateResource(environmentId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateResourceRequest) =>
      resourcesAPI.create(environmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.resources.list(environmentId),
      });
      toast.success("Đã tạo resource");
    },
    onError: (error) => toast.error(error),
  });
}

export function useUpdateResource(environmentId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateResourceRequest }) =>
      resourcesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.resources.list(environmentId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.resources.all });
      toast.success("Đã cập nhật resource");
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveResource(environmentId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: resourcesAPI.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.resources.list(environmentId),
      });
      toast.success("Đã xóa resource");
    },
    onError: (error) => toast.error(error),
  });
}

export function useDeployResource(environmentId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: resourcesAPI.deploy,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.resources.list(environmentId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      toast.success("Deploy đã chạy");
    },
    onError: (error) => toast.error(error, "Lỗi deploy"),
  });
}

export function useUndeployResource(environmentId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: resourcesAPI.undeploy,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.resources.list(environmentId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      toast.success("Undeploy đã chạy");
    },
    onError: (error) => toast.error(error),
  });
}
