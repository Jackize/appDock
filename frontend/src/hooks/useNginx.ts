import { nginxAPI } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateDomainRequest,
  RequestCertificateRequest,
  UpdateDomainRequest,
} from "@/types";

// ==================== NGINX STATUS HOOKS ====================

export function useNginxStatus() {
  return useQuery({
    queryKey: ["nginx", "status"],
    queryFn: nginxAPI.getStatus,
    refetchInterval: 10000,
  });
}

// ==================== NGINX SYSTEM HOOKS ====================

export function useInstallNginx() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: nginxAPI.install,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "status"] });
      addToast({
        title: "Thành công",
        description: "Nginx đã được cài đặt thành công",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useInstallCertbot() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: nginxAPI.installCertbot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "status"] });
      addToast({
        title: "Thành công",
        description: "Certbot đã được cài đặt thành công",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useStartNginx() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: nginxAPI.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "status"] });
      addToast({
        title: "Thành công",
        description: "Nginx đã được khởi động",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useStopNginx() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: nginxAPI.stop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "status"] });
      addToast({
        title: "Thành công",
        description: "Nginx đã được dừng",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useReloadNginx() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: nginxAPI.reload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "status"] });
      addToast({
        title: "Thành công",
        description: "Nginx đã được reload",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== DOMAIN HOOKS ====================

export function useDomains() {
  return useQuery({
    queryKey: ["nginx", "domains"],
    queryFn: nginxAPI.listDomains,
    refetchInterval: 10000,
  });
}

export function useDomain(id: string) {
  return useQuery({
    queryKey: ["nginx", "domains", id],
    queryFn: () => nginxAPI.getDomain(id),
    enabled: !!id,
  });
}

export function useDomainConfig(id: string) {
  return useQuery({
    queryKey: ["nginx", "domains", id, "config"],
    queryFn: () => nginxAPI.getDomainConfig(id),
    enabled: !!id,
  });
}

export function useCreateDomain() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: (data: CreateDomainRequest) => nginxAPI.createDomain(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Domain đã được tạo thành công",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useUpdateDomain() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDomainRequest }) =>
      nginxAPI.updateDomain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Domain đã được cập nhật",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useDeleteDomain() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: (id: string) => nginxAPI.deleteDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Domain đã được xóa",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useEnableDomain() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: (id: string) => nginxAPI.enableDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Domain đã được kích hoạt",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useDisableDomain() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: (id: string) => nginxAPI.disableDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Domain đã được tắt",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

// ==================== CERTIFICATE HOOKS ====================

export function useCertificates() {
  return useQuery({
    queryKey: ["nginx", "certificates"],
    queryFn: nginxAPI.listCertificates,
    refetchInterval: 30000,
  });
}

export function useRequestCertificate() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: (data: RequestCertificateRequest) =>
      nginxAPI.requestCertificate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "certificates"] });
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Chứng chỉ SSL đã được cấp thành công",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}

export function useRevokeCertificate() {
  const queryClient = useQueryClient();
  const addToast = useAppStore((s) => s.addToast);

  return useMutation({
    mutationFn: (domain: string) => nginxAPI.revokeCertificate(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nginx", "certificates"] });
      queryClient.invalidateQueries({ queryKey: ["nginx", "domains"] });
      addToast({
        title: "Thành công",
        description: "Chứng chỉ SSL đã được thu hồi",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Lỗi",
        description: error.message,
        variant: "error",
      });
    },
  });
}
