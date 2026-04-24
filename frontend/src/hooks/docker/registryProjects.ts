import { registryProjectsAPI } from "@/services/api";
import type {
  CreateRegistryProjectRequest,
  UpdateRegistryProjectRequest,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useRegistryProjects() {
  return useQuery({
    queryKey: queryKeys.registryProjects.all,
    queryFn: registryProjectsAPI.list,
    refetchInterval: 30000,
  });
}

export function useCreateRegistryProject() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateRegistryProjectRequest) =>
      registryProjectsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.registryProjects.all });
      toast.success("Đã tạo registry project");
    },
    onError: (error) => toast.error(error),
  });
}

export function useUpdateRegistryProject() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateRegistryProjectRequest;
    }) => registryProjectsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.registryProjects.all });
      toast.success("Đã cập nhật registry project");
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveRegistryProject() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: registryProjectsAPI.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.registryProjects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success("Đã xóa registry project");
    },
    onError: (error) => toast.error(error),
  });
}
