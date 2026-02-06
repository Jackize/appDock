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
import { getAuthToken, useAuthStore } from "@/stores/authStore";

const API_BASE = "/api";

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
  skipAuth = false
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

import { hashPassword } from "@/lib/crypto";

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

  // Login (public endpoint) - password được hash SHA-256 trước khi gửi
  login: async (data: LoginRequest) => {
    const hashedPassword = await hashPassword(data.password);
    return fetchAPI<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.username,
        password: hashedPassword,
      }),
    }, true);
  },

  // Refresh token (requires auth)
  refresh: () =>
    fetchAPI<{ token: string; expiresIn: number }>("/auth/refresh", {
      method: "POST",
    }),

  // Get current user (requires auth)
  getMe: () => fetchAPI<{ username: string }>("/auth/me"),

  // Change password (requires auth) - passwords được hash SHA-256 trước khi gửi
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const [hashedCurrentPassword, hashedNewPassword] = await Promise.all([
      hashPassword(data.currentPassword),
      hashPassword(data.newPassword),
    ]);
    return fetchAPI<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: hashedCurrentPassword,
        newPassword: hashedNewPassword,
      }),
    });
  },
};

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
