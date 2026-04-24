import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ReactNode } from "react";

interface ResourceSectionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ResourceSection({
  icon,
  title,
  description,
  actions,
  children,
}: ResourceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <CardTitle>{title}</CardTitle>
              {description && (
                <p className="text-sm text-text-muted">{description}</p>
              )}
            </div>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
