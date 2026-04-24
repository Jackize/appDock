import type { Container } from "@/types";
import { COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from "./containerConstants";
import type { ContainerGroup } from "./containerTypes";

export function filterContainers(containers: Container[] | undefined, query: string) {
  if (!containers) return [];
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return containers;

  return containers.filter(
    (container) =>
      container.name.toLowerCase().includes(normalizedQuery) ||
      container.image.toLowerCase().includes(normalizedQuery) ||
      container.id.toLowerCase().includes(normalizedQuery),
  );
}

export function groupContainersByProject(containers: Container[]) {
  const groups: Record<string, Container[]> = {};
  const standaloneContainers: Container[] = [];

  containers.forEach((container) => {
    const projectName = container.labels?.[COMPOSE_PROJECT_LABEL];
    if (!projectName) {
      standaloneContainers.push(container);
      return;
    }

    groups[projectName] = groups[projectName] ?? [];
    groups[projectName].push(container);
  });

  const projectGroups: ContainerGroup[] = Object.entries(groups)
    .map(([name, projectContainers]) => ({
      name,
      containers: [...projectContainers].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      runningCount: countRunning(projectContainers),
      stoppedCount: projectContainers.length - countRunning(projectContainers),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { projectGroups, standaloneContainers };
}

export function getServiceName(container: Container) {
  return container.labels?.[COMPOSE_SERVICE_LABEL] || container.name;
}

export function countRunning(containers: Container[] | undefined) {
  return containers?.filter((container) => container.state === "running").length ?? 0;
}

export function countStopped(containers: Container[] | undefined) {
  return (containers?.length ?? 0) - countRunning(containers);
}

export function getPublishedPorts(container: Container) {
  return container.ports.filter((port) => port.publicPort);
}
