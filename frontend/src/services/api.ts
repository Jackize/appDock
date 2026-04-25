import { getAuthToken, useAuthStore } from "@/stores/authStore";
import type {
  Container,
  ContainerDetail,
  ContainerStats,
  CreateServerRequest,
  DockerStatusResponse,
  Image,
  Network,
  Server,
  SystemInfoResponse,
  SystemStats,
  TestConnectionResponse,
  UpdateServerRequest,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  Environment,
  CreateEnvironmentRequest,
  Resource,
  ResourceConfig,
  CreateResourceRequest,
  UpdateResourceRequest,
  CatalogApp,
  ProjectMember,
  CreateProjectInviteRequest,
  RegistryProject,
  CreateRegistryProjectRequest,
  UpdateRegistryProjectRequest,
  ComposeStack,
  CreateComposeStackRequest,
  UpdateComposeStackRequest,
  PullImageRequest,
  TraefikStatusResponse,
  UpdateTraefikConfigRequest,
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

// ==================== INVITES / MEMBERS ====================

export type InviteStatus = "pending" | "accepted" | "revoked";

export type Invite = {
  email: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  invitedBy?: string;
};

export const invitesAPI = {
  list: () =>
    fetchAPI<{ invites: Invite[] }>("/invites", {
      method: "GET",
    }),

  create: (email: string) =>
    fetchAPI<{
      email: string;
      status: InviteStatus;
      expiresAt: string;
      inviteLink: string;
      emailError?: string;
    }>("/invites", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  revoke: (email: string) =>
    fetchAPI<{ email: string; status: InviteStatus }>(
      `/invites/${encodeURIComponent(email)}/revoke`,
      { method: "POST" },
    ),
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
  getDockerStatus: () =>
    fetchAPI<DockerStatusResponse>("/system/docker-status"),
};

// ==================== CONTAINERS ====================

export const containersAPI = {
  list: (all = true) => fetchAPI<Container[]>(`/containers?all=${all}`),

  get: (id: string) => fetchAPI<ContainerDetail>(`/containers/${id}`),

  inspect: (id: string) => fetchAPI<unknown>(`/containers/${id}/inspect`),

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

  pull: (body: PullImageRequest) =>
    fetchAPI<{ message: string; ref?: string }>("/images/pull", {
      method: "POST",
      body: JSON.stringify(body),
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

// ==================== PROJECTS ====================

export const projectsAPI = {
  list: () => fetchAPI<Project[]>("/projects"),

  get: (id: string) => fetchAPI<Project>(`/projects/${id}`),

  create: (data: CreateProjectRequest) =>
    fetchAPI<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateProjectRequest) =>
    fetchAPI<Project>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/projects/${id}`, { method: "DELETE" }),

  environments: (projectId: string) =>
    fetchAPI<Environment[]>(`/projects/${projectId}/environments`),

  createEnvironment: (projectId: string, data: CreateEnvironmentRequest) =>
    fetchAPI<Environment>(`/projects/${projectId}/environments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeEnvironment: (environmentId: string, force = false) =>
    fetchAPI<{ message: string; removedResources: number }>(
      `/environments/${environmentId}?force=${force}`,
      { method: "DELETE" },
    ),

  members: (projectId: string) =>
    fetchAPI<ProjectMember[]>(`/projects/${projectId}/members`),

  invite: (projectId: string, data: CreateProjectInviteRequest) =>
    fetchAPI<{ invite: unknown; inviteLink: string; emailError?: string }>(
      `/projects/${projectId}/invites`,
      { method: "POST", body: JSON.stringify(data) },
    ),
};

// ==================== ENVIRONMENT RESOURCES ====================

export const resourcesAPI = {
  list: (environmentId: string) =>
    fetchAPI<Resource[]>(`/environments/${environmentId}/resources`),

  get: (id: string) => fetchAPI<Resource>(`/resources/${id}`),

  config: (id: string) => fetchAPI<ResourceConfig>(`/resources/${id}/config`),

  create: (environmentId: string, data: CreateResourceRequest) =>
    fetchAPI<Resource>(`/environments/${environmentId}/resources`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateResourceRequest) =>
    fetchAPI<Resource>(`/resources/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/resources/${id}`, { method: "DELETE" }),

  deploy: (id: string) =>
    fetchAPI<{ message: string; output?: string; resource?: Resource }>(
      `/resources/${id}/deploy`,
      { method: "POST" },
    ),

  undeploy: (id: string) =>
    fetchAPI<{ message: string; output?: string; resource?: Resource }>(
      `/resources/${id}/undeploy`,
      { method: "POST" },
    ),
};

// ==================== CATALOG ====================

export const catalogAPI = {
  list: () => fetchAPI<CatalogApp[]>("/catalog/apps"),
};

// ==================== REGISTRY PROJECTS ====================

export const registryProjectsAPI = {
  list: () => fetchAPI<RegistryProject[]>("/registry-projects"),

  get: (id: string) => fetchAPI<RegistryProject>(`/registry-projects/${id}`),

  create: (data: CreateRegistryProjectRequest) =>
    fetchAPI<RegistryProject>("/registry-projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateRegistryProjectRequest) =>
    fetchAPI<RegistryProject>(`/registry-projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/registry-projects/${id}`, {
      method: "DELETE",
    }),
};

// ==================== COMPOSE STACKS ====================

export const composeStacksAPI = {
  list: (projectId: string) =>
    fetchAPI<ComposeStack[]>(`/compose-stacks?projectId=${encodeURIComponent(projectId)}`),

  get: (id: string) => fetchAPI<ComposeStack>(`/compose-stacks/${id}`),

  create: (data: CreateComposeStackRequest) =>
    fetchAPI<ComposeStack>("/compose-stacks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateComposeStackRequest) =>
    fetchAPI<ComposeStack>(`/compose-stacks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/compose-stacks/${id}`, { method: "DELETE" }),

  deploy: (id: string) =>
    fetchAPI<{ message: string; output?: string; stack?: ComposeStack }>(
      `/compose-stacks/${id}/deploy`,
      { method: "POST" },
    ),

  undeploy: (id: string) =>
    fetchAPI<{ message: string; output?: string; stack?: ComposeStack }>(
      `/compose-stacks/${id}/undeploy`,
      { method: "POST" },
    ),
};

// ==================== TRAEFIK (LOCAL) ====================

export const traefikAPI = {
  status: () => fetchAPI<TraefikStatusResponse>("/traefik/status"),

  apply: (data: UpdateTraefikConfigRequest) =>
    fetchAPI<{ message: string; output?: string; config?: unknown }>(
      "/traefik/apply",
      { method: "POST", body: JSON.stringify(data) },
    ),

  logs: (tail = "200") =>
    fetchAPI<{ logs: string }>(`/traefik/logs?tail=${encodeURIComponent(tail)}`),
};
