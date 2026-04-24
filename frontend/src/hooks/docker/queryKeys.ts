export const queryKeys = {
  system: {
    all: ["system"] as const,
    info: ["system", "info"] as const,
    stats: ["system", "stats"] as const,
    statsHistory: ["system", "stats", "history"] as const,
    dockerStatus: ["system", "docker-status"] as const,
  },
  containers: {
    all: ["containers"] as const,
    list: (all: boolean) => ["containers", { all }] as const,
    detail: (id: string) => ["containers", id] as const,
    inspect: (id: string) => ["containers", id, "inspect"] as const,
    stats: (id: string) => ["containers", id, "stats"] as const,
    logs: (id: string, tail: string) => ["containers", id, "logs", tail] as const,
  },
  images: {
    all: ["images"] as const,
    detail: (id: string) => ["images", id] as const,
  },
  networks: {
    all: ["networks"] as const,
    detail: (id: string) => ["networks", id] as const,
  },
  volumes: {
    all: ["volumes"] as const,
    detail: (name: string) => ["volumes", name] as const,
  },
  projects: {
    all: ["projects"] as const,
  },
  registryProjects: {
    all: ["registry-projects"] as const,
  },
  composeStacks: {
    all: ["compose-stacks"] as const,
    list: (projectId: string) => ["compose-stacks", projectId] as const,
  },
  traefik: {
    all: ["traefik"] as const,
    status: ["traefik", "status"] as const,
    logs: (tail: string) => ["traefik", "logs", tail] as const,
  },
  servers: {
    all: ["servers"] as const,
    detail: (id: string) => ["servers", id] as const,
  },
};
