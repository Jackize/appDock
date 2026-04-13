import { securityAPI } from "@/services/api";
import { useServerStore } from "@/stores/serverStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useNetworkSnapshot() {
  const currentServerId = useServerStore((s) => s.currentServerId);
  return useQuery({
    queryKey: ["security", "snapshot", currentServerId],
    queryFn: () => securityAPI.getSnapshot(),
    refetchInterval: 15000,
  });
}

export function useSecurityReports(filters?: {
  severity?: string;
  status?: string;
}) {
  const currentServerId = useServerStore((s) => s.currentServerId);
  return useQuery({
    queryKey: [
      "security",
      "reports",
      currentServerId,
      filters?.severity,
      filters?.status,
    ],
    queryFn: () =>
      securityAPI.listReports({
        serverId: currentServerId,
        severity: filters?.severity,
        status: filters?.status,
      }),
    refetchInterval: 30000,
  });
}

export function useAnalyzeSecurity() {
  const queryClient = useQueryClient();
  const currentServerId = useServerStore((s) => s.currentServerId);
  return useMutation({
    mutationFn: (opts?: { force?: boolean }) =>
      securityAPI.analyze({
        serverId: currentServerId,
        force: opts?.force,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security"] });
    },
  });
}

export function usePatchSecurityReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      status?: "open" | "acknowledged" | "resolved";
      notes?: string;
    }) => securityAPI.patchReport(args.id, { status: args.status, notes: args.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security", "reports"] });
    },
  });
}

export function useSecurityChat() {
  return useMutation({
    mutationFn: (args: {
      messages: { role: string; content: string }[];
      reportId?: string;
    }) => securityAPI.chat(args),
  });
}
