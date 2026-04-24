import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Container } from "@/types";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ContainerTable } from "./ContainerTable";
import type { ContainerActionHandlers, ContainerActionState } from "./containerTypes";

interface ContainerGroupCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  countLabel: string;
  containers: Container[];
  runningCount: number;
  stoppedCount: number;
  open: boolean;
  onToggle: () => void;
  showService?: boolean;
  actionHandlers: ContainerActionHandlers;
  actionState: ContainerActionState;
}

export function ContainerGroupCard({
  title,
  description,
  icon,
  countLabel,
  containers,
  runningCount,
  stoppedCount,
  open,
  onToggle,
  showService = false,
  actionHandlers,
  actionState,
}: ContainerGroupCardProps) {
  return (
    <Collapsible.Root open={open}>
      <Card>
        <button type="button" onClick={onToggle} className="w-full text-left">
          <CardHeader className="cursor-pointer hover:bg-background-hover/50 transition-colors rounded-t-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                {icon}
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {title}
                    <Badge variant="outline">{countLabel}</Badge>
                  </CardTitle>
                  <p className="text-sm text-text-muted mt-0.5">{description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <GroupStatus runningCount={runningCount} stoppedCount={stoppedCount} />
                {open ? (
                  <ChevronDown className="w-5 h-5 text-text-muted" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-text-muted" />
                )}
              </div>
            </div>
          </CardHeader>
        </button>
        <Collapsible.Content>
          <CardContent className="pt-0">
            <ContainerTable
              containers={containers}
              showService={showService}
              actionHandlers={actionHandlers}
              actionState={actionState}
            />
          </CardContent>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}

function GroupStatus({
  runningCount,
  stoppedCount,
}: {
  runningCount: number;
  stoppedCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {runningCount > 0 && (
        <span className="px-2 py-0.5 rounded bg-status-running/20 text-status-running">
          {runningCount} running
        </span>
      )}
      {stoppedCount > 0 && (
        <span className="px-2 py-0.5 rounded bg-status-stopped/20 text-status-stopped">
          {stoppedCount} stopped
        </span>
      )}
    </div>
  );
}
