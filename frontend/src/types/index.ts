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

export interface SystemStats {
  containersRunning: number;
  containersStopped: number;
  imagesCount: number;
  volumesCount: number;
  networksCount: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
}
