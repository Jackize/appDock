import { getAuthToken, useAuthStore } from "@/stores/authStore";
import type {
  Certificate,
  Container,
  ContainerDetail,
  ContainerStats,
  CreateDomainRequest,
  CreateServerRequest,
  DockerStatusResponse,
  Domain,
  Image,
  Network,
  NginxStatus,
  RequestCertificateRequest,
  Server,
  SystemInfoResponse,
  SystemStats,
  TestConnectionResponse,
  UpdateDomainRequest,
  UpdateServerRequest,
  Volume,
} from "@/types";

const API_BASE = "/api";

// Current server ID for multi-server support
let currentServerId: string = "local";

export function setCurrentServerId(id: string) {
  currentServerId = id;
}

export function getCurrentServerId(): string {
  return currentServerId;
}

// Custom error class for auth errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
  skipAuth = false,
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  // Add auth token if available and not skipping auth
  if (token && !skipAuth) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  // Add server ID header for multi-server support
  if (currentServerId && currentServerId !== "local") {
    (headers as Record<string, string>)["X-Server-ID"] = currentServerId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401) {
    // Logout user on auth error
    useAuthStore.getState().logout();
    throw new AuthError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Lỗi không xác định" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ==================== AUTH ====================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  expiresIn: number;
}

export interface AuthStatusResponse {
  enabled: boolean;
}

export const authAPI = {
  // Get auth status (public endpoint)
  getStatus: () =>
    fetchAPI<AuthStatusResponse>("/auth/status", undefined, true),

  // Login (public endpoint)
  login: (data: LoginRequest) =>
    fetchAPI<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      true,
    ),

  // Refresh token (requires auth)
  refresh: () =>
    fetchAPI<{ token: string; expiresIn: number }>("/auth/refresh", {
      method: "POST",
    }),

  // Get current user (requires auth)
  getMe: () => fetchAPI<{ username: string }>("/auth/me"),

  // Change password (requires auth)
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchAPI<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Change username (requires auth)
  changeUsername: (data: { currentPassword: string; newUsername: string }) =>
    fetchAPI<{ message: string; username: string }>("/auth/change-username", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ==================== SYSTEM ====================

export interface ChartPoint {
  time: string;
  cpu: number;
  disk: number;
  memUsed: number;
  memCached: number;
  memFree: number;
}

export const systemAPI = {
  getInfo: () => fetchAPI<SystemInfoResponse>("/system/info"),
  getStats: () => fetchAPI<SystemStats>("/system/stats"),
  getStatsHistory: () => fetchAPI<ChartPoint[]>("/system/stats/history"),
  getDockerStatus: () => fetchAPI<DockerStatusResponse>("/system/docker-status"),
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

// ==================== SERVERS ====================

export const serversAPI = {
  list: () => fetchAPI<Server[]>("/servers"),

  get: (id: string) => fetchAPI<Server>(`/servers/${id}`),

  create: (data: CreateServerRequest) =>
    fetchAPI<Server>("/servers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateServerRequest) =>
    fetchAPI<Server>(`/servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/servers/${id}`, { method: "DELETE" }),

  testConnection: (id: string) =>
    fetchAPI<TestConnectionResponse>(`/servers/${id}/test`),
};

// ==================== NGINX ====================

export const nginxAPI = {
  getStatus: () => fetchAPI<NginxStatus>("/nginx/status"),

  install: () =>
    fetchAPI<{ message: string }>("/nginx/install", { method: "POST" }),

  installCertbot: () =>
    fetchAPI<{ message: string }>("/nginx/install-certbot", { method: "POST" }),

  start: () =>
    fetchAPI<{ message: string }>("/nginx/start", { method: "POST" }),

  stop: () =>
    fetchAPI<{ message: string }>("/nginx/stop", { method: "POST" }),

  reload: () =>
    fetchAPI<{ message: string }>("/nginx/reload", { method: "POST" }),

  testConfig: () =>
    fetchAPI<{ valid: boolean; output: string }>("/nginx/test", {
      method: "POST",
    }),

  // Domains
  listDomains: () => fetchAPI<Domain[]>("/nginx/domains"),

  getDomain: (id: string) => fetchAPI<Domain>(`/nginx/domains/${id}`),

  createDomain: (data: CreateDomainRequest) =>
    fetchAPI<Domain>("/nginx/domains", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDomain: (id: string, data: UpdateDomainRequest) =>
    fetchAPI<Domain>(`/nginx/domains/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteDomain: (id: string) =>
    fetchAPI<{ message: string }>(`/nginx/domains/${id}`, {
      method: "DELETE",
    }),

  enableDomain: (id: string) =>
    fetchAPI<{ message: string }>(`/nginx/domains/${id}/enable`, {
      method: "POST",
    }),

  disableDomain: (id: string) =>
    fetchAPI<{ message: string }>(`/nginx/domains/${id}/disable`, {
      method: "POST",
    }),

  getDomainConfig: (id: string) =>
    fetchAPI<{ config: string }>(`/nginx/domains/${id}/config`),

  // SSL Certificates
  listCertificates: () => fetchAPI<Certificate[]>("/nginx/certificates"),

  requestCertificate: (data: RequestCertificateRequest) =>
    fetchAPI<{ message: string }>("/nginx/certificates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  revokeCertificate: (domain: string) =>
    fetchAPI<{ message: string }>(`/nginx/certificates/${domain}`, {
      method: "DELETE",
    }),
};

