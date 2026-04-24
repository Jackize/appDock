import type { Container } from "@/types";

export interface ContainerGroup {
  name: string;
  containers: Container[];
  runningCount: number;
  stoppedCount: number;
}

export interface ContainerActionHandlers {
  onStart: (container: Container) => void;
  onStop: (container: Container) => void;
  onRestart: (container: Container) => void;
  onInspect: (container: Container) => void;
  onDelete: (container: Container) => void;
  onOpenLogs: (container: Container) => void;
  onOpenTerminal: (container: Container) => void;
}

export interface ContainerActionState {
  starting: boolean;
  stopping: boolean;
  restarting: boolean;
}
