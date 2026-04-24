import { projectsAPI } from "@/services/api";
import type { CreateProjectRequest, UpdateProjectRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: projectsAPI.list,
    refetchInterval: 30000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success("Đã tạo project");
    },
    onError: (error) => toast.error(error),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success("Đã cập nhật project");
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveProject() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: projectsAPI.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      toast.success("Đã xóa project");
    },
    onError: (error) => toast.error(error),
  });
}
