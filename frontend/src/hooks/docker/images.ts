import { imagesAPI } from "@/services/api";
import type { PullImageRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useToastActions } from "./toastActions";

export function useImages() {
  return useQuery({
    queryKey: queryKeys.images.all,
    queryFn: imagesAPI.list,
    refetchInterval: 10000,
  });
}

export function useImage(id: string) {
  return useQuery({
    queryKey: queryKeys.images.detail(id),
    queryFn: () => imagesAPI.get(id),
    enabled: !!id,
  });
}

export function useRemoveImage() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) =>
      imagesAPI.remove(id, force),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });
      toast.success(`Image ${id} đã được xóa`);
    },
    onError: (error) => toast.error(error),
  });
}

export function usePullImage() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: (input: string | PullImageRequest) =>
      imagesAPI.pull(typeof input === "string" ? { image: input } : input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
      toast.success(`Image ${data.ref ?? "đã"} được tải về`);
    },
    onError: (error) => toast.error(error),
  });
}

export function useBulkRemoveImages() {
  const queryClient = useQueryClient();
  const toast = useToastActions();

  return useMutation({
    mutationFn: ({ ids, force = true }: { ids: string[]; force?: boolean }) =>
      imagesAPI.bulkRemove(ids, force),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.all });

      if (result.deleted > 0) {
        if (result.failed.length > 0) {
          toast.warning(`Đã xóa ${result.deleted}/${result.total} images`);
        } else {
          toast.success(`Đã xóa ${result.deleted}/${result.total} images`);
        }
      }

      if (result.failed.length > 0) {
        toast.failure(
          `${result.failed.length} images xóa thất bại`,
          "Một số images không thể xóa",
        );
      }
    },
    onError: (error) => toast.error(error),
  });
}
