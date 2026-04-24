import { Button } from "@/components/ui/Button";
import type { Container } from "@/types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  FileText,
  MoreVertical,
  Play,
  RotateCcw,
  Search,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import type { ContainerActionHandlers, ContainerActionState } from "./containerTypes";

interface ContainerActionsProps {
  container: Container;
  handlers: ContainerActionHandlers;
  state: ContainerActionState;
}

export function ContainerActions({
  container,
  handlers,
  state,
}: ContainerActionsProps) {
  const isRunning = container.state === "running";

  return (
    <div className="flex items-center justify-end gap-1">
      {isRunning ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlers.onStop(container)}
            disabled={state.stopping}
            title="Dừng"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlers.onRestart(container)}
            disabled={state.restarting}
            title="Khởi động lại"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handlers.onStart(container)}
          disabled={state.starting}
          title="Khởi động"
        >
          <Play className="w-4 h-4" />
        </Button>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[160px] bg-background-secondary border border-border rounded-lg p-1 shadow-lg z-50"
            sideOffset={5}
          >
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handlers.onOpenTerminal(container)}
              disabled={!isRunning}
            >
              <Terminal className="w-4 h-4" />
              Terminal
              {!isRunning && (
                <span className="text-xs text-text-muted ml-auto">(cần chạy)</span>
              )}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
              onClick={() => handlers.onInspect(container)}
            >
              <Search className="w-4 h-4" />
              Inspect
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded cursor-pointer outline-none"
              onClick={() => handlers.onOpenLogs(container)}
            >
              <FileText className="w-4 h-4" />
              Xem logs
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="h-px bg-border my-1" />
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-status-stopped hover:bg-status-stopped/10 rounded cursor-pointer outline-none"
              onClick={() => handlers.onDelete(container)}
            >
              <Trash2 className="w-4 h-4" />
              Xóa container
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
