import { catalogAPI } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

export function useCatalogApps() {
  return useQuery({
    queryKey: queryKeys.catalog.apps,
    queryFn: catalogAPI.list,
  });
}
