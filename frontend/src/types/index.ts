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

/** Logical grouping of deployments on a Docker host (Compose stack names, etc.). */
export interface Project {
  id: string;
  name: string;
  description: string;
  serverId: string;
  registryProjectId?: string;
  composeProjectNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  serverId?: string;
  registryProjectId?: string;
  composeProjectNames?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  serverId?: string;
  registryProjectId?: string | null;
  composeProjectNames?: string[];
}

/** Harbor-style registry namespace + credentials (stored on server; protect data dir). */
export interface RegistryProject {
  id: string;
  name: string;
  description: string;
  host: string;
  namespace: string;
  username?: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistryProjectRequest {
  name: string;
  description?: string;
  host: string;
  namespace?: string;
  username?: string;
  password?: string;
}

export interface UpdateRegistryProjectRequest {
  name?: string;
  description?: string;
  host?: string;
  namespace?: string;
  username?: string;
  password?: string;
}

export interface ComposeStack {
  id: string;
  projectId: string;
  serverId: string;
  name: string;
  composeProjectName: string;
  composeYaml: string;
  envContent?: string;
  lastDeployAt?: string;
  lastDeployMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComposeStackRequest {
  projectId: string;
  serverId?: string;
  name: string;
  composeProjectName: string;
  composeYaml: string;
  envContent?: string;
}

export interface UpdateComposeStackRequest {
  name?: string;
  composeProjectName?: string;
  composeYaml?: string;
  envContent?: string;
  serverId?: string;
}

export type PullImageRequest =
  | { image: string }
  | {
      registryProjectId: string;
      repository: string;
      tag?: string;
    };

export interface TraefikConfig {
  enabled: boolean;
  domain: string;
  cloudflareToken: string;
  acmeEmail: string;
  dashboardHost: string;
  createdAt: string;
  updatedAt: string;
  lastApplyOutput?: string;
  lastApplyError?: string;
  lastAppliedAt?: string;
}

export interface TraefikStatusResponse {
  config: TraefikConfig;
  running: boolean;
  status: string;
}

export interface UpdateTraefikConfigRequest {
  enabled?: boolean;
  domain?: string;
  cloudflareToken?: string;
  acmeEmail?: string;
  dashboardHost?: string;
}

