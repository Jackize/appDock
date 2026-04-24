import { composeStacksAPI } from "@/services/api";
import type { CreateComposeStackRequest, UpdateComposeStackRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useComposeStacks(projectId: string) {
  return useQuery({
    queryKey: queryKeys.composeStacks.list(projectId),
    queryFn: () => composeStacksAPI.list(projectId),
    enabled: !!projectId,
    refetchInterval: 15000,
  });
}

export function useCreateComposeStack() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateComposeStackRequest) => composeStacksAPI.create(data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.composeStacks.list(vars.projectId),
      });
      toast.success("Đã tạo compose stack");
    },
    onError: (error) => toast.error(error),
  });
}

export function useUpdateComposeStack() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (vars: {
      id: string;
      projectId: string;
      data: UpdateComposeStackRequest;
    }) => composeStacksAPI.update(vars.id, vars.data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.composeStacks.list(vars.projectId),
      });
      toast.success("Đã cập nhật stack");
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveComposeStack() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      composeStacksAPI.remove(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.composeStacks.list(vars.projectId),
      });
      toast.success("Đã xóa stack");
    },
    onError: (error) => toast.error(error),
  });
}

export function useDeployComposeStack() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      composeStacksAPI.deploy(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.composeStacks.list(vars.projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      toast.success("Compose up đã chạy (local server)", "Deploy");
    },
    onError: (error) => toast.error(error, "Lỗi deploy"),
  });
}

export function useUndeployComposeStack() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      composeStacksAPI.undeploy(vars.id),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.composeStacks.list(vars.projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      toast.success("Compose down đã chạy", "Undeploy");
    },
    onError: (error) => toast.error(error),
  });
}
