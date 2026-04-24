import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatRelativeTime, truncate } from "@/lib/utils";
import type { Container } from "@/types";
import { ContainerActions } from "./ContainerActions";
import { ContainerStatusBadge } from "./ContainerStatusBadge";
import { getPublishedPorts, getServiceName } from "./containerUtils";
import type { ContainerActionHandlers, ContainerActionState } from "./containerTypes";

interface ContainerTableProps {
  containers: Container[];
  showService?: boolean;
  actionHandlers: ContainerActionHandlers;
  actionState: ContainerActionState;
}

export function ContainerTable({
  containers,
  showService = false,
  actionHandlers,
  actionState,
}: ContainerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{showService ? "Service" : "Container"}</TableHead>
          <TableHead>Image</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ports</TableHead>
          <TableHead>Tạo lúc</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {containers.map((container) => (
          <ContainerRow
            key={container.id}
            container={container}
            showService={showService}
            actionHandlers={actionHandlers}
            actionState={actionState}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface ContainerRowProps {
  container: Container;
  showService: boolean;
  actionHandlers: ContainerActionHandlers;
  actionState: ContainerActionState;
}

function ContainerRow({
  container,
  showService,
  actionHandlers,
  actionState,
}: ContainerRowProps) {
  const publishedPorts = getPublishedPorts(container);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              container.state === "running"
                ? "bg-status-running animate-pulse"
                : "bg-status-stopped"
            }`}
          />
          <div>
            <p className="font-medium">
              {showService ? getServiceName(container) : container.name}
            </p>
            <p className="text-xs text-text-muted font-mono">{container.id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-text-secondary">
          {truncate(container.image, 40)}
        </span>
      </TableCell>
      <TableCell>
        <ContainerStatusBadge state={container.state} />
      </TableCell>
      <TableCell>
        {publishedPorts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {publishedPorts.slice(0, 3).map((port, index) => (
              <span
                key={`${port.publicPort}-${port.privatePort}-${index}`}
                className="px-2 py-0.5 text-xs rounded bg-background-tertiary text-text-secondary"
              >
                {port.publicPort}:{port.privatePort}
              </span>
            ))}
            {publishedPorts.length > 3 && (
              <span className="text-xs text-text-muted">
                +{publishedPorts.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-text-muted">-</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-text-secondary">
          {formatRelativeTime(container.created)}
        </span>
      </TableCell>
      <TableCell>
        <ContainerActions
          container={container}
          handlers={actionHandlers}
          state={actionState}
        />
      </TableCell>
    </TableRow>
  );
}
