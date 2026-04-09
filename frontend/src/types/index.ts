// Container types
export interface PortMapping {
  privatePort: number;
  publicPort: number;
  type: string;
  ip: string;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: number;
  ports: PortMapping[];
  labels: Record<string, string>;
}

export interface ContainerConfig {
  hostname: string;
  env: string[];
  cmd: string[];
  workingDir: string;
  labels: Record<string, string>;
}

export interface NetworkEndpoint {
  networkId: string;
  ipAddress: string;
  gateway: string;
}

export interface MountInfo {
  type: string;
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface ContainerDetail extends Container {
  config: ContainerConfig;
  network: {
    networks: Record<string, NetworkEndpoint>;
  };
  mounts: MountInfo[];
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
}

// Image types
export interface Image {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  virtualSize: number;
  labels: Record<string, string>;
  inUse: boolean;
  containers: string[]; // Container names using this image
}

// Network types
export interface IPAMConfig {
  subnet: string;
  gateway: string;
}

export interface IPAMInfo {
  driver: string;
  config: IPAMConfig[];
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  attachable: boolean;
  ipam: IPAMInfo;
  containers: Record<string, string>;
  labels: Record<string, string>;
  created: string;
}

// Volume types
export interface VolumeUsage {
  size: number;
  refCount: number;
}

export interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
  labels: Record<string, string>;
  scope: string;
  usageData?: VolumeUsage;
}

// System types
export interface SystemInfo {
  dockerVersion: string;
  apiVersion: string;
  os: string;
  architecture: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  memoryTotal: number;
  cpus: number;
}

export interface SystemInfoResponse {
  dockerAvailable: boolean;
  info: SystemInfo;
}

export interface DockerStatusResponse {
  connected: boolean;
}

export interface SystemStats {
  containersRunning: number;
  containersStopped: number;
  imagesCount: number;
  volumesCount: number;
  networksCount: number;
  cpuUsage: number;
  cpuCores?: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryFree: number;
  memoryCached: number;
  cpuTemperature?: number;
  diskUsage: number;
  diskUsed: number;
  diskFree?: number;
  diskTotal: number;
}

// Server types
export type ServerStatus = 'online' | 'offline' | 'unknown';

export interface Server {
  id: string;
  name: string;
  host: string;
  isLocal: boolean;
  isDefault: boolean;
  status: ServerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerRequest {
  name: string;
  host: string;
  apiKey: string;
}

export interface UpdateServerRequest {
  name?: string;
  host?: string;
  apiKey?: string;
  isDefault?: boolean;
}

export interface TestConnectionResponse {
  connected: boolean;
  message?: string;
  error?: string;
}

// Nginx types
export type SSLStatus = 'none' | 'active' | 'expired' | 'pending';

export interface NginxStatus {
  installed: boolean;
  running: boolean;
  version: string;
  configOk: boolean;
  certbotInstalled: boolean;
}

export interface Domain {
  id: string;
  domain: string;
  upstreamHost: string;
  upstreamPort: number;
  sslEnabled: boolean;
  sslStatus: SSLStatus;
  sslExpiry?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  domain: string;
  issuer: string;
  expiresAt: string;
  path: string;
  keyPath: string;
  autoRenew: boolean;
}

export interface CreateDomainRequest {
  domain: string;
  upstreamHost: string;
  upstreamPort: number;
  sslEnabled: boolean;
  sslEmail?: string;
}

export interface UpdateDomainRequest {
  upstreamHost?: string;
  upstreamPort?: number;
  enabled?: boolean;
}

export interface RequestCertificateRequest {
  domain: string;
  email: string;
}

// DNS (Cloudflare) types
export interface CloudflareZone {
  id: string;
  name: string;
}

export interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean | null;
  ttl: number;
  priority?: number | null;
  comment?: string | null;
  created_on?: string;
  modified_on?: string;
}

export interface CloudflareCreateDNSRecordRequest {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
  comment?: string;
}

export interface CloudflareUpdateDNSRecordRequest
  extends CloudflareCreateDNSRecordRequest {}
