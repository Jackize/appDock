import type {
  Container,
  ContainerDetail,
  ContainerStats,
  Image,
  Network,
  SystemInfo,
  SystemStats,
  Volume,
} from "@/types";

const API_BASE = "/api";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Lỗi không xác định" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ==================== SYSTEM ====================

export const systemAPI = {
  getInfo: () => fetchAPI<SystemInfo>("/system/info"),
  getStats: () => fetchAPI<SystemStats>("/system/stats"),
};

// ==================== CONTAINERS ====================

export const containersAPI = {
  list: (all = true) => fetchAPI<Container[]>(`/containers?all=${all}`),

  get: (id: string) => fetchAPI<ContainerDetail>(`/containers/${id}`),

  start: (id: string) =>
    fetchAPI<{ message: string }>(`/containers/${id}/start`, {
      method: "POST",
    }),

  stop: (id: string) =>
    fetchAPI<{ message: string }>(`/containers/${id}/stop`, { method: "POST" }),

  restart: (id: string) =>
    fetchAPI<{ message: string }>(`/containers/${id}/restart`, {
      method: "POST",
    }),

  remove: (id: string, force = false) =>
    fetchAPI<{ message: string }>(`/containers/${id}?force=${force}`, {
      method: "DELETE",
    }),

  getLogs: (id: string, tail = "100") =>
    fetchAPI<{ logs: string }>(`/containers/${id}/logs?tail=${tail}`),

  getStats: (id: string) => fetchAPI<ContainerStats>(`/containers/${id}/stats`),
};

// ==================== IMAGES ====================

export interface BulkDeleteResult {
  success: string[];
  failed: { id: string; error: string }[];
  total: number;
  deleted: number;
}

export const imagesAPI = {
  list: () => fetchAPI<Image[]>("/images"),

  get: (id: string) => fetchAPI<Image>(`/images/${id}`),

  remove: (id: string, force = false) =>
    fetchAPI<{ message: string }>(`/images/${id}?force=${force}`, {
      method: "DELETE",
    }),

  bulkRemove: (ids: string[], force = false) =>
    fetchAPI<BulkDeleteResult>("/images/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids, force }),
    }),

  pull: (image: string) =>
    fetchAPI<{ message: string }>("/images/pull", {
      method: "POST",
      body: JSON.stringify({ image }),
    }),
};

// ==================== NETWORKS ====================

export const networksAPI = {
  list: () => fetchAPI<Network[]>("/networks"),

  get: (id: string) => fetchAPI<Network>(`/networks/${id}`),

  create: (data: {
    name: string;
    driver?: string;
    internal?: boolean;
    attachable?: boolean;
  }) =>
    fetchAPI<{ id: string; message: string }>("/networks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/networks/${id}`, { method: "DELETE" }),
};

// ==================== VOLUMES ====================

export const volumesAPI = {
  list: () => fetchAPI<Volume[]>("/volumes"),

  get: (name: string) => fetchAPI<Volume>(`/volumes/${name}`),

  create: (data: {
    name: string;
    driver?: string;
    labels?: Record<string, string>;
  }) =>
    fetchAPI<Volume>("/volumes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  remove: (name: string, force = false) =>
    fetchAPI<{ message: string }>(`/volumes/${name}?force=${force}`, {
      method: "DELETE",
    }),
};
