import { systemAPI } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

export function useSystemInfo() {
  return useQuery({
    queryKey: queryKeys.system.info,
    queryFn: systemAPI.getInfo,
    refetchInterval: 30000,
  });
}

export function useSystemStats() {
  return useQuery({
    queryKey: queryKeys.system.stats,
    queryFn: systemAPI.getStats,
    refetchInterval: 5000,
  });
}

export function useStatsHistory() {
  return useQuery({
    queryKey: queryKeys.system.statsHistory,
    queryFn: systemAPI.getStatsHistory,
    refetchInterval: 5000,
  });
}

export function useDockerStatus() {
  return useQuery({
    queryKey: queryKeys.system.dockerStatus,
    queryFn: systemAPI.getDockerStatus,
    refetchInterval: 3000,
  });
}
