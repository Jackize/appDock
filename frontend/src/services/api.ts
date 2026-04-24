import { getAuthToken, useAuthStore } from "@/stores/authStore";
import type {
  Certificate,
  CloudflareCreateDNSRecordRequest,
  CloudflareDNSRecord,
  CloudflareUpdateDNSRecordRequest,
  CloudflareZone,
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
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
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
  NetworkSnapshot,
  SecurityReport,
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

async function fetchAPIWithExtraHeaders<T>(
  endpoint: string,
  options?: RequestInit,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  return fetchAPI<T>(endpoint, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(extraHeaders || {}),
    },
  });
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

// ==================== NGINX ====================

export const nginxAPI = {
  getStatus: () => fetchAPI<NginxStatus>("/nginx/status"),

  install: () =>
    fetchAPI<{ message: string }>("/nginx/install", { method: "POST" }),

  installCertbot: () =>
    fetchAPI<{ message: string }>("/nginx/install-certbot", { method: "POST" }),

  start: () =>
    fetchAPI<{ message: string }>("/nginx/start", { method: "POST" }),

  stop: () => fetchAPI<{ message: string }>("/nginx/stop", { method: "POST" }),

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

// ==================== DNS (Cloudflare) ====================

type CloudflareAuthParams = {
  token?: string;
  email?: string;
  apiKey?: string;
};

/** Builds request headers for Cloudflare API token or Global Key auth. */
function cloudflareAuthHeaders(
  params: CloudflareAuthParams,
): Record<string, string> | undefined {
  if (params.token) {
    return { "X-Cloudflare-Token": params.token };
  }
  if (params.email && params.apiKey) {
    return {
      "X-Cloudflare-Email": params.email,
      "X-Cloudflare-Key": params.apiKey,
    };
  }
  return undefined;
}

export const securityAPI = {
  getSnapshot: () => fetchAPI<NetworkSnapshot>("/security/snapshot"),

  listReports: (params?: {
    serverId?: string;
    severity?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.serverId) q.set("serverId", params.serverId);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.status) q.set("status", params.status);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return fetchAPI<SecurityReport[]>(`/security/reports${suffix}`);
  },

  getReport: (id: string) => fetchAPI<SecurityReport>(`/security/reports/${id}`),

  patchReport: (
    id: string,
    body: { status?: SecurityReport["status"]; notes?: string },
  ) =>
    fetchAPI<SecurityReport>(`/security/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  analyze: (body?: { serverId?: string; force?: boolean }) =>
    fetchAPI<SecurityReport>("/security/analyze", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  chat: (body: {
    messages: { role: string; content: string }[];
    reportId?: string;
  }) =>
    fetchAPI<{ reply: string }>("/security/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const dnsAPI = {
  cloudflare: {
    verify: (params: CloudflareAuthParams) =>
      fetchAPIWithExtraHeaders<Record<string, unknown>>(
        `/dns/cloudflare/verify`,
        undefined,
        cloudflareAuthHeaders(params),
      ),

    listZones: (params: CloudflareAuthParams & { name?: string }) => {
      const q = new URLSearchParams();
      if (params.name) q.set("name", params.name);
      return fetchAPIWithExtraHeaders<CloudflareZone[]>(
        `/dns/cloudflare/zones${q.toString() ? `?${q.toString()}` : ""}`,
        undefined,
        cloudflareAuthHeaders(params),
      );
    },

    listRecords: (
      params: CloudflareAuthParams & {
        zoneId: string;
        type?: string;
        name?: string;
      },
    ) => {
      const q = new URLSearchParams();
      if (params.type) q.set("type", params.type);
      if (params.name) q.set("name", params.name);
      return fetchAPIWithExtraHeaders<CloudflareDNSRecord[]>(
        `/dns/cloudflare/zones/${params.zoneId}/records${
          q.toString() ? `?${q.toString()}` : ""
        }`,
        undefined,
        cloudflareAuthHeaders(params),
      );
    },

    createRecord: (
      params: CloudflareAuthParams & {
        zoneId: string;
        data: CloudflareCreateDNSRecordRequest;
      },
    ) =>
      fetchAPIWithExtraHeaders<CloudflareDNSRecord>(
        `/dns/cloudflare/zones/${params.zoneId}/records`,
        { method: "POST", body: JSON.stringify(params.data) },
        cloudflareAuthHeaders(params),
      ),

    updateRecord: (
      params: CloudflareAuthParams & {
        zoneId: string;
        recordId: string;
        data: CloudflareUpdateDNSRecordRequest;
      },
    ) =>
      fetchAPIWithExtraHeaders<CloudflareDNSRecord>(
        `/dns/cloudflare/zones/${params.zoneId}/records/${params.recordId}`,
        { method: "PUT", body: JSON.stringify(params.data) },
        cloudflareAuthHeaders(params),
      ),

    deleteRecord: (
      params: CloudflareAuthParams & {
        zoneId: string;
        recordId: string;
      },
    ) =>
      fetchAPIWithExtraHeaders<{ message: string }>(
        `/dns/cloudflare/zones/${params.zoneId}/records/${params.recordId}`,
        { method: "DELETE" },
        cloudflareAuthHeaders(params),
      ),
  },
};
