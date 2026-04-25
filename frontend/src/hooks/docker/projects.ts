import { projectsAPI } from "@/services/api";
import type {
  CreateEnvironmentRequest,
  CreateProjectInviteRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
} from "@/types";
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

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsAPI.get(id),
    enabled: !!id,
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

export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.environments(projectId),
    queryFn: () => projectsAPI.environments(projectId),
    enabled: !!projectId,
  });
}

export function useCreateEnvironment(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateEnvironmentRequest) =>
      projectsAPI.createEnvironment(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.environments(projectId),
      });
      toast.success("Đã tạo environment");
    },
    onError: (error) => toast.error(error),
  });
}

export function useRemoveEnvironment(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      projectsAPI.removeEnvironment(id, !!force),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.environments(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.resources.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
      toast.success(
        res.removedResources
          ? `Đã xóa environment và ${res.removedResources} resources`
          : "Đã xóa environment",
      );
    },
    onError: (error) => toast.error(error),
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.members(projectId),
    queryFn: () => projectsAPI.members(projectId),
    enabled: !!projectId,
  });
}

export function useCreateProjectInvite(projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (data: CreateProjectInviteRequest) =>
      projectsAPI.invite(projectId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.members(projectId),
      });
      toast.success(
        res.emailError ? `Invite tạo xong, email lỗi: ${res.emailError}` : "Đã tạo invite",
      );
    },
    onError: (error) => toast.error(error),
  });
}
