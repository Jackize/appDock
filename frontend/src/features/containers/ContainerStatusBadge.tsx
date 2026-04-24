import { Badge } from "@/components/ui/Badge";

interface ContainerStatusBadgeProps {
  state: string;
}

export function ContainerStatusBadge({ state }: ContainerStatusBadgeProps) {
  switch (state.toLowerCase()) {
    case "running":
      return <Badge variant="running">Đang chạy</Badge>;
    case "exited":
      return <Badge variant="stopped">Đã dừng</Badge>;
    case "paused":
      return <Badge variant="paused">Tạm dừng</Badge>;
    default:
      return <Badge variant="outline">{state}</Badge>;
  }
}
